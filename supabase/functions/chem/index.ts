// 케미 분석 Edge Function: 배우들끼리 함께 출연한 작품을 TMDB 출연 기록에서 찾아 돌려줌
// 요청: POST { names: ["배우1", "배우2", ...] }  (2~8명)
// 응답: { people: { 이름: { id, known } }, pairs: [ { a, b, works: [ { title, year, type, a_role, b_role, rating, votes, revenue } ] } ] }
// 수상, 인터뷰 같은 이야기는 여기서 만들지 않음(유저의 출처 링크 제보로만 받음)
// 캐시: tmdb_cache 테이블(인물 id, 출연 목록, 영화 흥행 수익) 30일
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TTL = 30 * 864e5;
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
});
const j = (o: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

async function cget(k: string): Promise<string | undefined> {
  const since = new Date(Date.now() - TTL).toISOString();
  const r = await fetch(`${SB}/rest/v1/tmdb_cache?select=url&k=eq.${encodeURIComponent(k)}&updated_at=gte.${since}`, { headers: H });
  const d = r.ok ? await r.json() : [];
  return d.length ? d[0].url : undefined;
}
async function cput(k: string, v: string) {
  await fetch(`${SB}/rest/v1/tmdb_cache?on_conflict=k`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k, url: v, updated_at: new Date().toISOString() }]) });
}
async function tm(path: string, params: Record<string, string>, token: string) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (token.length > 60) h.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
  const r = await fetch(u, { headers: h });
  if (r.status === 401) throw new Error("TMDB 401");
  return r.ok ? await r.json() : null;
}
type Credit = { k: string; t: string; y: string; ty: string; ch: string; va: number; vc: number };

async function personId(name: string, token: string): Promise<number | null> {
  const c = await cget("pid:" + name);
  if (c !== undefined) return c ? +c : null;
  const d = await tm("/search/person", { query: name, language: "ko-KR" }, token);
  const x = d && (d.results || []).find((r: { known_for_department?: string }) => r.known_for_department === "Acting") || (d && d.results && d.results[0]);
  await cput("pid:" + name, x ? String(x.id) : "");
  return x ? x.id : null;
}
async function credits(pid: number, token: string): Promise<Credit[]> {
  const c = await cget("cc:" + pid);
  if (c) return JSON.parse(c);
  const d = await tm(`/person/${pid}/combined_credits`, { language: "ko-KR" }, token);
  const list: Credit[] = (d?.cast || []).filter((x: Record<string, unknown>) => !(x.genre_ids as number[] || []).includes(10767) && !(x.genre_ids as number[] || []).includes(10763))
    .map((x: Record<string, string | number>) => ({ k: x.media_type + ":" + x.id, t: String(x.title || x.name || ""), y: String(x.release_date || x.first_air_date || "").slice(0, 4), ty: String(x.media_type), ch: String(x.character || ""), va: +x.vote_average || 0, vc: +x.vote_count || 0 }));
  await cput("cc:" + pid, JSON.stringify(list));
  return list;
}
async function revenue(id: string, token: string): Promise<number> {
  const c = await cget("mv:" + id);
  if (c !== undefined) return +c || 0;
  const d = await tm(`/movie/${id}`, {}, token);
  const v = d && d.revenue ? d.revenue : 0;
  await cput("mv:" + id, String(v));
  return v;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  const token = Deno.env.get("TMDB_TOKEN") || "";
  if (!token) return j({ error: "no TMDB_TOKEN" }, 503, h);
  let b: { names?: unknown };
  try { b = await req.json(); } catch { return j({ error: "json" }, 400, h); }
  const names = [...new Set((Array.isArray(b.names) ? b.names : []).filter((x) => typeof x === "string" && x.trim() && x.length <= 20).map((x) => (x as string).trim()))].slice(0, 8);
  if (names.length < 2) return j({ people: {}, pairs: [] }, 200, h);
  try {
    const ids = await Promise.all(names.map((n) => personId(n, token)));
    const cr = await Promise.all(ids.map((id) => (id ? credits(id, token) : Promise.resolve([] as Credit[]))));
    const people: Record<string, { id: number | null; known: number }> = {};
    names.forEach((n, i) => (people[n] = { id: ids[i], known: cr[i].length }));
    const pairs = [];
    for (let i = 0; i < names.length; i++) for (let k = i + 1; k < names.length; k++) {
      if (!ids[i] || !ids[k] || ids[i] === ids[k]) continue;
      const mapB = new Map(cr[k].map((c) => [c.k, c]));
      const seen = new Set<string>();
      const works = [];
      for (const c of cr[i]) {
        const o = mapB.get(c.k);
        if (!o || seen.has(c.k)) continue;
        seen.add(c.k);
        works.push({ key: c.k, title: c.t, year: c.y, type: c.ty === "movie" ? "영화" : "드라마", a_role: c.ch, b_role: o.ch, rating: Math.round(c.va * 10) / 10, votes: c.vc, revenue: 0 });
      }
      works.sort((x, y) => y.votes - x.votes || (y.year > x.year ? 1 : -1));
      const top = works.slice(0, 5);
      await Promise.all(top.filter((w) => w.key.startsWith("movie:")).map(async (w) => (w.revenue = await revenue(w.key.split(":")[1], token))));
      pairs.push({ a: names[i], b: names[k], count: works.length, works: top.map(({ key: _k, ...w }) => w) });
    }
    return j({ people, pairs }, 200, h);
  } catch (e) {
    return j({ error: String(e) }, 502, h);
  }
});
