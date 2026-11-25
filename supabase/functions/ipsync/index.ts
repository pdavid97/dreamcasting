// 해외 인기작 기초 데이터(TMDB): 할리우드 영화, 미국 드라마, 넷플릭스와 주요 OTT 오리지널을 ip_work, ip_cast에 적재
// POST { grp: "us_film" | "us_tv" | "netflix_tv" | "netflix_film" | "ott_tv" | "buzz" } (buzz: 넷플릭스 Top 10과 스트리밍 방영작, work_buzz 기준) : 그 묶음의 목록을 받고, 아직 없는 작품의 상세와 출연진(상위 20명)을 한 번에 최대 MAX편 채움
// 같은 묶음을 다시 부르면 이어서 채움. 공개 TMDB 정보만 저장하고, 묶음별 목록 갱신은 20시간에 한 번
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TK = (Deno.env.get("TMDB_TOKEN") || "").trim();
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const MAX = 220;
const P: Record<string, { m: "movie" | "tv"; q: Record<string, string>; pages: number }[]> = {
  us_film: [{ m: "movie", q: { with_origin_country: "US", sort_by: "vote_count.desc" }, pages: 20 }],
  us_tv: [{ m: "tv", q: { with_origin_country: "US", sort_by: "vote_count.desc" }, pages: 20 }],
  netflix_tv: [{ m: "tv", q: { with_networks: "213", sort_by: "vote_count.desc" }, pages: 15 }],
  netflix_film: [{ m: "movie", q: { with_companies: "178464", sort_by: "vote_count.desc" }, pages: 10 }, { m: "movie", q: { with_watch_providers: "8", watch_region: "KR", with_watch_monetization_types: "flatrate", sort_by: "vote_count.desc" }, pages: 10 }],
  buzz: [],
  ott_tv: [{ m: "tv", q: { with_networks: "49|2552|2739|1024|453", sort_by: "vote_count.desc" }, pages: 15 }],
};
async function t(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3/" + path);
  for (const [k, v] of Object.entries({ language: "ko-KR", ...q })) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TK.length > 60) h.Authorization = "Bearer " + TK; else u.searchParams.set("api_key", TK);
  const r = await fetch(u, { headers: h });
  if (!r.ok) throw new Error("tmdb " + r.status + " " + path);
  return await r.json();
}
async function upsert(tb: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/${tb}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(tb + " " + (await r.text()));
  }
}
const get = async (path: string) => await (await fetch(`${SB}/rest/v1/${path}`, { headers: H })).json();

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({})) as { grp?: string };
  const g = String(b.grp || ""), spec = P[g];
  if (!spec) return j({ error: "grp", ok: Object.keys(P) }, 400);
  if (!TK) return j({ error: "TMDB_TOKEN 없음" }, 500);
  try {
    // 1) 목록: kobis_state에 묶음별로 저장(20시간 캐시)
    const sk = "ipsync_" + g;
    const st = (await get(`kobis_state?k=eq.${sk}&select=v,updated_at`))[0];
    let keys: string[] = st?.v?.keys || [];
    if (g === "buzz") keys = (await get("work_buzz?select=key&limit=5000")).map((x: { key: string }) => x.key).filter((k: string) => /^(movie|tv):\d+$/.test(k));
    else if (!st || Date.now() - new Date(st.updated_at).getTime() > 20 * 36e5) {
      const ks = new Set<string>();
      for (const s of spec) for (let p = 1; p <= s.pages; p++) {
        const d = await t(`discover/${s.m}`, { ...s.q, page: String(p), "vote_count.gte": "200" });
        for (const x of d.results || []) ks.add(`${s.m}:${x.id}`);
        if (p >= (d.total_pages || 0)) break;
      }
      keys = [...ks];
      await upsert("kobis_state", "k", [{ k: sk, v: { keys }, updated_at: new Date().toISOString() }]);
    }
    // 2) 이미 있는 작품은 grp만 합침
    const have = new Map<string, string[]>();
    for (let i = 0; i < keys.length; i += 150) {
      const part = keys.slice(i, i + 150).map((k) => `"${k}"`).join(",");
      for (const r of await get(`ip_work?key=in.(${encodeURIComponent(part)})&select=key,grp`)) have.set(r.key, r.grp || []);
    }
    const add = [...have].filter(([, gr]) => !gr.includes(g)).map(([key, gr]) => ({ key, grp: [...gr, g] }));
    for (const a of add) await fetch(`${SB}/rest/v1/ip_work?key=eq.${encodeURIComponent(a.key)}`, { method: "PATCH", headers: H, body: JSON.stringify({ grp: a.grp }) });
    // 3) 없는 작품 상세와 출연진
    const todo = keys.filter((k) => !have.has(k)).slice(0, MAX);
    let done = 0, fail = 0, castN = 0;
    for (let i = 0; i < todo.length; i += 8) {
      await Promise.all(todo.slice(i, i + 8).map(async (key) => {
        try {
          const [m, id] = key.split(":");
          const d = await t(`${m}/${id}`, { append_to_response: m === "tv" ? "aggregate_credits" : "credits" });
          const cast = m === "tv"
            ? (d.aggregate_credits?.cast || []).slice(0, 20).map((c: any, o: number) => ({ key, tmdb_person: c.id, name: c.name, character: c.roles?.[0]?.character || "", ord: o, gender: c.gender ?? null, profile: c.profile_path || null }))
            : (d.credits?.cast || []).slice(0, 20).map((c: any) => ({ key, tmdb_person: c.id, name: c.name, character: c.character || "", ord: c.order, gender: c.gender ?? null, profile: c.profile_path || null }));
          await upsert("ip_work", "key", [{ key, grp: [g], title: d.title || d.name, title_en: d.original_title || d.original_name, year: +String(d.release_date || d.first_air_date || "").slice(0, 4) || null, lang: d.original_language || null, countries: d.origin_country || (d.production_countries || []).map((c: any) => c.iso_3166_1), genres: (d.genres || []).map((x: any) => x.name), pop: d.popularity || null, poster: d.poster_path || null, updated_at: new Date().toISOString() }]);
          const uq = [...new Map(cast.map((c: any) => [c.tmdb_person + "|" + c.character, c])).values()];
          if (uq.length) await upsert("ip_cast", "key,tmdb_person,character", uq);
          done++; castN += cast.length;
        } catch { fail++; }
      }));
    }
    return j({ grp: g, list: keys.length, merged: add.length, added: done, cast: castN, fail, left: keys.filter((k) => !have.has(k)).length - done });
  } catch (e) { return j({ error: String(e) }, 502); }
});
