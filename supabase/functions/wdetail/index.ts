// 작품 상세 Edge Function: 필모그래피 카드를 누르면 줄거리, 주요 출연진, 광장 안 연결(투표 주제, 배우 페이지)을 돌려줌
// 요청: { media: "movie" | "tv", id: TMDB id }. 결과는 tmdb_cache에 7일 캐시
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TTL = 7 * 864e5;
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
});
const j = (o: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}
const IMG = (p: string | null | undefined, s = "w342") => (p ? `https://image.tmdb.org/t/p/${s}${p}` : "");

async function detail(media: string, id: number) {
  const ck = `wd:${media}:${id}`;
  const since = new Date(Date.now() - TTL).toISOString();
  const c = await (await rest(`tmdb_cache?select=url&k=eq.${encodeURIComponent(ck)}&updated_at=gte.${since}`)).json();
  let base: Record<string, unknown>;
  if (Array.isArray(c) && c[0]) base = JSON.parse(c[0].url);
  else {
    const d = await tm(`/${media}/${id}`, { language: "ko-KR", append_to_response: media === "tv" ? "aggregate_credits" : "credits" });
    if (!d?.id) return null;
    const cr = (media === "tv" ? d.aggregate_credits?.cast : d.credits?.cast) || [];
    base = {
      media, id, title: d.title || d.name, original: d.original_title || d.original_name || "",
      year: String(d.release_date || d.first_air_date || "").slice(0, 4), overview: d.overview || "",
      genres: (d.genres || []).map((g: { name: string }) => g.name), rating: Math.round((d.vote_average || 0) * 10) / 10, votes: d.vote_count || 0,
      poster: IMG(d.poster_path), backdrop: IMG(d.backdrop_path, "w780"),
      cast: cr.slice(0, 10).map((m: { id: number; name: string; character?: string; roles?: { character: string }[]; profile_path?: string }) => ({
        tmdb_id: m.id, name: m.name, ch: String(m.character || m.roles?.[0]?.character || "").replace(/\s*\(.*$/, "").slice(0, 30), photo: IMG(m.profile_path, "w185"),
      })),
    };
    await rest("tmdb_cache?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k: ck, url: JSON.stringify(base), updated_at: new Date().toISOString() }]) });
  }
  // 광장 안 연결: 이 작품을 다루는 투표 주제, 출연 배우의 광장 페이지(people id)와 지금 후보로 오른 가상 캐스팅
  const cast = base.cast as { tmdb_id: number; name: string }[];
  const ids = cast.map((m) => m.tmdb_id).join(",");
  const [topics, ppl] = await Promise.all([
    (await rest(`topics?select=id,title,cat&closed_at=is.null&work->>tmdb_id=eq.${id}`)).json(),
    ids ? (await rest(`people?select=id,tmdb_id,name&tmdb_id=in.(${ids})`)).json() : [],
  ]);
  const pid = new Map<number, { id: number; name: string }>((Array.isArray(ppl) ? ppl : []).map((p: { id: number; tmdb_id: number; name: string }) => [p.tmdb_id, p]));
  const names = [...pid.values()].map((p) => p.name);
  const races = names.length ? await (await rest(`candidates?select=name,roles!candidates_role_id_fkey!inner(ch,topic_id,topics!inner(title,closed_at))&in_set=is.true&roles.topics.closed_at=is.null&name=in.(${names.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})&limit=30`)).json() : [];
  const adapt = await (await rest(`work?select=id,adaptation!adaptation_src_work_id_fkey(direction,status,dst:work!adaptation_dst_work_id_fkey(title,year,media,tmdb_id)),orig:adaptation!adaptation_dst_work_id_fkey(direction,src:work!adaptation_src_work_id_fkey(title,year,media,tmdb_id))&media=eq.${media}&tmdb_id=eq.${id}`)).json();
  return {
    ...base,
    cast: (base.cast as { tmdb_id: number }[]).map((m) => ({ ...m, pid: pid.get(m.tmdb_id)?.id || null })),
    topics: Array.isArray(topics) ? topics : [],
    races: (Array.isArray(races) ? races : []).map((r: { name: string; roles: { ch: string; topic_id: string; topics: { title: string } } }) => ({ name: r.name, ch: r.roles.ch, tid: r.roles.topic_id, title: r.roles.topics.title })),
    remakes: Array.isArray(adapt) && adapt[0] ? adapt[0].adaptation || [] : [],
    origins: Array.isArray(adapt) && adapt[0] ? adapt[0].orig || [] : [],
  };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  try {
    const b = await req.json().catch(() => ({}));
    const media = b.media === "tv" ? "tv" : "movie", id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) return j({ error: "bad id" }, 400, h);
    const d = await detail(media, id);
    return d ? j(d, 200, h) : j({ error: "not found" }, 404, h);
  } catch (e) { return j({ error: String((e as Error)?.message || e) }, 502, h); }
});
