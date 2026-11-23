// 외국 배우 원어 이름과 사진. 요청 { names: string[] (한국어 표기, 최대 60) } -> { 이름: { o: 원어 이름, p: 사진 주소, id: tmdb id } }
// 한국 배우(원어가 한글)는 o를 비움. 결과는 tmdb_cache(k = 'orig:' + 이름)에 30일 캐시
// 원어 기준: 중국어권은 한자 이름(people.name_en에 한자가 있으면 그것, 없으면 TMDB also_known_as의 한자), 그 밖은 TMDB 영어 이름
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const HAN = /[一-鿿]/, HANGUL = /[가-힣]/;
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}
type Out = { o: string | null; p: string | null; id: number | null };
// 원작 출연진처럼 이름 검색으로 안 잡히는 경우: 요청에 실린 작품(ctx)의 한국어 출연진 목록에서 이름으로 id를 찾음
const CTXID: Record<string, number> = {};
async function loadCtx(ctx: { media: string; id: number }[]) {
  await Promise.all(ctx.slice(0, 6).map(async (w) => {
    const d = await tm(`/${w.media}/${w.id}/${w.media === "tv" ? "aggregate_credits" : "credits"}`, { language: "ko-KR" });
    const cast = (d?.cast || []).slice(0, 40) as { id: number; name: string; character?: string; roles?: { character: string }[] }[];
    for (const c of cast) if (c.name && !CTXID[c.name]) CTXID[c.name] = c.id;
    // 상위 출연진은 TMDB 번역 데이터에서 한국어 이름을 받아 맞춤(원작 출연진 대부분이 여기서 잡힘)
    await Promise.all(cast.slice(0, 12).map(async (c) => {
      const tr = await tm(`/person/${c.id}/translations`);
      const ko = ((tr?.translations || []) as { iso_639_1: string; data?: { name?: string } }[]).find((t) => t.iso_639_1 === "ko")?.data?.name;
      if (ko && !CTXID[ko]) CTXID[ko] = c.id;
    }));
    // 우리 작품 정보(work.cast)는 한국어 이름과 영어 배역명 쌍이라, 배역명으로 TMDB 출연진과 맞춤
    const tp = await (await rest(`topics?select=work&work->>tmdb_id=eq.${w.id}&limit=1`)).json();
    for (const x of ((Array.isArray(tp) && tp[0]?.work?.cast) || []) as { ch: string; name: string }[]) {
      const ch = (x.ch || "").toLowerCase();
      const hit = ch && cast.find((c) => [c.character, ...(c.roles || []).map((r) => r.character)].some((y) => (y || "").toLowerCase() === ch));
      if (hit && x.name && !CTXID[x.name]) CTXID[x.name] = hit.id;
    }
  }));
}
async function resolve(n: string, pp: { tmdb_id: number | null; name_en: string | null; region: string | null } | undefined): Promise<Out> {
  let id = pp?.tmdb_id || CTXID[n] || null;
  if (!id) {
    const s = await tm("/search/person", { query: n, language: "ko-KR" });
    const hit = (s?.results || []).find((x: { known_for_department?: string }) => x.known_for_department === "Acting") || (s?.results || [])[0];
    id = hit?.id || null;
  }
  if (!id) return { o: null, p: null, id: null };
  const d = await tm(`/person/${id}`, { language: "en-US" });
  const p = d?.profile_path ? "https://image.tmdb.org/t/p/w185" + d.profile_path : null;
  const sinic = ["cn", "tw", "hk"].includes(pp?.region || "") || /China|Taiwan|Hong Kong/i.test(d?.place_of_birth || "");
  let o: string | null = null;
  if (sinic) o = (pp?.name_en && HAN.test(pp.name_en) ? pp.name_en : ((d?.also_known_as || []) as string[]).find((x) => HAN.test(x) && !HANGUL.test(x))) || d?.name || null;
  else if (d?.name && !HANGUL.test(d.name)) o = d.name;
  // 한국 배우는 원어를 붙이지 않음
  if (o && (HANGUL.test(o) || pp?.region === "kr" || (/Korea/i.test(d?.place_of_birth || "") && !sinic))) o = null;
  return { o, p, id };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const names: string[] = [...new Set((Array.isArray(b.names) ? b.names : []).filter((x: unknown) => typeof x === "string" && x.length > 0 && x.length <= 40))].slice(0, 60) as string[];
    const out: Record<string, Out> = {};
    if (!names.length) return new Response("{}", { headers: { ...CORS, "Content-Type": "application/json" } });
    const keys = names.map((n) => "orig:" + n);
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    const c = await (await rest(`tmdb_cache?select=k,url&updated_at=gte.${since}&k=in.(${keys.map((k) => `"${k.replace(/"/g, "")}"`).join(",")})`)).json();
    for (const x of Array.isArray(c) ? c : []) { try { out[x.k.slice(5)] = JSON.parse(x.url); } catch { /* 다시 받기 */ } }
    const need = names.filter((n) => !out[n] || (!out[n].id && Array.isArray(b.ctx) && b.ctx.length));
    if (need.length) {
      if (Array.isArray(b.ctx)) await loadCtx(b.ctx.filter((w: { media: string; id: number }) => w && (w.media === "tv" || w.media === "movie") && Number.isFinite(+w.id)));
      const ppl = await (await rest(`people?select=name,tmdb_id,name_en,region,pop&name=in.(${need.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})&order=pop.desc.nullslast`)).json();
      const P: Record<string, { tmdb_id: number | null; name_en: string | null; region: string | null }> = {};
      for (const p of Array.isArray(ppl) ? ppl : []) if (!P[p.name]) P[p.name] = p;
      const rows: { k: string; url: string; updated_at: string }[] = [];
      for (let i = 0; i < need.length; i += 6) {
        await Promise.all(need.slice(i, i + 6).map(async (n) => { const r = await resolve(n, P[n]); out[n] = r; rows.push({ k: "orig:" + n, url: JSON.stringify(r), updated_at: new Date().toISOString() }); }));
      }
      if (rows.length) await rest("tmdb_cache?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
    }
    return new Response(JSON.stringify(out), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
