// 메타 정보 Edge Function (TMDB + Wikidata)
// 요청 (POST, 하나만):
//   { person: 12 }                 people.id 배우 페이지용 프로필. 필모(TMDB)와 수상(Wikidata P166)을 people.profile에 7일 캐시
//   { work: "작품명", cat: "k2" }   새 주제 제안용 원작 출연진(배역명, 배우, 생년) 상위 8명
//   { ages: ["배우1", ...] }        배우 생년(최대 40명). 캐스팅 보드에서 나이 표시용
//   { topic: "작품 id" }            작품 상세(TMDB: 줄거리, 방송사, 장르, 감독/작가, 공식 사이트, 국내 시청처)를 topics.work에 7일 캐시
//   { ensure: "배우 이름" }          TMDB에서 인물을 찾아 people에 등록하고 id를 돌려줌(배우 페이지 진입용)
// 수상 정보는 Wikidata에 기록된 것만 보여주고, 없는 정보는 만들지 않음
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TTL = 30 * 864e5, PTTL = 7 * 864e5;
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
});
const j = (o: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
const H = { apikey: SR, Authorization: `Bearer ${SR}` };

async function cget(k: string, ttl = TTL): Promise<string | undefined> {
  const since = new Date(Date.now() - ttl).toISOString();
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
async function personId(name: string, token: string): Promise<number | null> {
  const c = await cget("pid:" + name);
  if (c !== undefined) return c ? +c : null;
  const d = await tm("/search/person", { query: name, language: "ko-KR" }, token);
  const x = d && (d.results || []).find((r: { known_for_department?: string }) => r.known_for_department === "Acting") || (d && d.results && d.results[0]);
  await cput("pid:" + name, x ? String(x.id) : "");
  return x ? x.id : null;
}
async function birth(pid: number, token: string): Promise<string> {
  const c = await cget("bd:" + pid);
  if (c !== undefined) return c;
  const d = await tm(`/person/${pid}`, {}, token);
  const v = d && d.birthday ? String(d.birthday) : "";
  await cput("bd:" + pid, v);
  return v;
}
const SKIP = [10767, 10763, 10764];

// Wikidata 수상 기록: TMDB 인물 id(P4985)로 찾음
async function awards(tmdbId: number, qid: string) {
  const who = /^Q\d+$/.test(qid) ? `BIND(wd:${qid} AS ?p)` : `?p wdt:P4985 "${tmdbId}".`;
  const q = `SELECT ?aw ?awLabel ?t ?forLabel WHERE { ${who} ?p p:P166 ?s. ?s ps:P166 ?aw. OPTIONAL { ?s pq:P585 ?t } OPTIONAL { ?s pq:P1686 ?for } SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". } } LIMIT 80`;
  try {
    const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { accept: "application/sparql-results+json", "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)" } });
    if (!r.ok) return null;
    const d = await r.json();
    const seen = new Set<string>();
    const list = (d.results?.bindings || []).map((b: Record<string, { value: string }>) => ({
      name: b.awLabel?.value || "", year: b.t?.value ? b.t.value.slice(0, 4) : "", work: b.forLabel?.value || "", src: b.aw?.value || "",
    })).filter((x: { name: string; year: string; work: string }) => {
      const k = x.name + x.year + x.work; if (seen.has(k) || /^Q\d+$/.test(x.name)) return false; seen.add(k); return true;
    });
    list.sort((a: { year: string }, b: { year: string }) => (b.year || "0").localeCompare(a.year || "0"));
    return list;
  } catch { return null; }
}

async function person(id: number, token: string) {
  const r = await fetch(`${SB}/rest/v1/people?select=id,name,tmdb_id,profile,profile_at&id=eq.${id}`, { headers: H });
  const row = r.ok ? (await r.json())[0] : null;
  if (!row) return { error: "not found", status: 404 };
  if (row.profile && row.profile_at && Date.now() - Date.parse(row.profile_at) < PTTL) return { profile: row.profile };
  const d = await tm(`/person/${row.tmdb_id}`, { language: "ko-KR", append_to_response: "combined_credits,external_ids" }, token);
  if (!d) return { error: "tmdb", status: 502 };
  let bio = d.biography || "";
  if (!bio) { const e = await tm(`/person/${row.tmdb_id}`, { language: "en-US" }, token); bio = e?.biography || ""; }
  const seen = new Set<string>();
  const works = (d.combined_credits?.cast || [])
    .filter((x: Record<string, unknown>) => !((x.genre_ids as number[]) || []).some((g) => SKIP.includes(g)))
    .filter((x: Record<string, unknown>) => { const k = x.media_type + ":" + x.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .map((x: Record<string, string | number>) => ({
      id: x.id, type: x.media_type === "movie" ? "영화" : "드라마", title: String(x.title || x.name || ""),
      year: String(x.release_date || x.first_air_date || "").slice(0, 4), ch: String(x.character || ""),
      rating: Math.round((+x.vote_average || 0) * 10) / 10, votes: +x.vote_count || 0,
      poster: x.poster_path ? "https://image.tmdb.org/t/p/w185" + x.poster_path : "",
    }))
    .sort((a: { year: string }, b: { year: string }) => (b.year || "9999").localeCompare(a.year || "9999"))
    .slice(0, 60);
  const aw = await awards(row.tmdb_id, d.external_ids?.wikidata_id || "");
  const profile = {
    birthday: d.birthday || "", place: d.place_of_birth || "", bio: bio.slice(0, 1200),
    photo: d.profile_path ? "https://image.tmdb.org/t/p/h632" + d.profile_path : "",
    tmdb: `https://www.themoviedb.org/person/${row.tmdb_id}`,
    wikidata: d.external_ids?.wikidata_id ? `https://www.wikidata.org/wiki/${d.external_ids.wikidata_id}` : "",
    instagram: d.external_ids?.instagram_id || "",
    works, awards: aw || [], awards_ok: aw !== null,
  };
  await fetch(`${SB}/rest/v1/people?id=eq.${id}`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ profile, profile_at: new Date().toISOString() }) });
  if (d.birthday) await cput("bd:" + row.tmdb_id, d.birthday);
  return { profile };
}

async function work(title: string, token: string) {
  const ck = "wk:" + title;
  const c = await cget(ck);
  if (c) return JSON.parse(c);
  const s = await tm("/search/multi", { query: title, language: "ko-KR" }, token);
  const hits = (s?.results || []).filter((x: { media_type: string }) => x.media_type === "tv" || x.media_type === "movie").slice(0, 5);
  if (!hits.length) return { hits: [] };
  const x = hits[0];
  const cr = x.media_type === "tv" ? await tm(`/tv/${x.id}/aggregate_credits`, { language: "ko-KR" }, token) : await tm(`/movie/${x.id}/credits`, { language: "ko-KR" }, token);
  const cast = (cr?.cast || []).slice(0, 8).map((m: Record<string, unknown>) => ({
    id: m.id as number, name: String(m.name || ""),
    ch: String(x.media_type === "tv" ? ((m.roles as { character: string }[]) || [])[0]?.character || "" : m.character || "").replace(/\s*\(.*$/, "").slice(0, 20),
  }));
  await Promise.all(cast.map(async (m: { id: number; name: string; birthday?: string }) => { m.birthday = await birth(m.id, token); await cput("pid:" + m.name, String(m.id)); }));
  const out = {
    pick: { id: x.id, type: x.media_type === "movie" ? "영화" : "드라마", title: x.title || x.name, year: String(x.release_date || x.first_air_date || "").slice(0, 4), poster: x.poster_path ? "https://image.tmdb.org/t/p/w342" + x.poster_path : "" },
    others: hits.slice(1).map((h: Record<string, string>) => ({ title: h.title || h.name, year: String(h.release_date || h.first_air_date || "").slice(0, 4) })),
    cast,
  };
  await cput(ck, JSON.stringify(out));
  return out;
}

// Wikidata에 등록된 스트리밍 작품 id로 플랫폼 작품 페이지 직링크를 만듦(없으면 화면에서 플랫폼 검색으로 연결)
async function directLinks(qid: string) {
  if (!/^Q\d+$/.test(qid)) return {};
  const q = `SELECT ?p ?v WHERE { VALUES ?p { wdt:P1874 wdt:P7595 wdt:P7596 wdt:P8055 wdt:P9586 } wd:${qid} ?p ?v }`;
  try {
    const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { accept: "application/sparql-results+json", "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)" } });
    if (!r.ok) return {};
    const d = await r.json(), out: Record<string, string> = {};
    for (const b of d.results?.bindings || []) {
      const p = String(b.p.value).split("/").pop(), v = encodeURIComponent(String(b.v.value));
      if (p === "P1874") out.netflix = `https://www.netflix.com/title/${v}`;
      if (p === "P7595") out.disney = `https://www.disneyplus.com/movies/${v}`;
      if (p === "P7596") out.disney = `https://www.disneyplus.com/series/${v}`;
      if (p === "P8055") out.prime = `https://www.primevideo.com/detail/${v}`;
      if (p === "P9586") out.appletv = `https://tv.apple.com/show/${v}`;
    }
    return out;
  } catch { return {}; }
}

async function topicWork(tid: string, token: string) {
  const r = await fetch(`${SB}/rest/v1/topics?select=id,title,cat,work,work_at,tags&id=eq.${encodeURIComponent(tid)}`, { headers: H });
  const t = r.ok ? (await r.json())[0] : null;
  if (!t) return { error: "not found", status: 404 };
  if (t.work_at && Date.now() - Date.parse(t.work_at) < PTTL) return { work: t.work };
  const s = await tm("/search/multi", { query: t.title, language: "ko-KR" }, token);
  const norm = (v: string) => String(v || "").replace(/[\s:,.!?'"]/g, "").toLowerCase();
  // 제목이 정확히 같은 작품만 연결(동명 다른 작품을 잘못 붙이지 않도록)
  const x = (s?.results || []).find((y: Record<string, string>) => (y.media_type === "tv" || y.media_type === "movie") && [y.name, y.title, y.original_name, y.original_title].some((v) => v && norm(v) === norm(t.title)));
  let work: Record<string, unknown> | null = null;
  if (x) {
    const kind = x.media_type;
    const d = await tm(`/${kind}/${x.id}`, { language: "ko-KR", append_to_response: "credits,watch/providers,external_ids,videos", include_video_language: "ko,en,null" }, token);
    if (d) {
      const makers = kind === "tv"
        ? (d.created_by || []).map((c: { name: string }) => c.name)
        : (d.credits?.crew || []).filter((c: { job: string }) => c.job === "Director" || c.job === "Screenplay" || c.job === "Writer").map((c: { name: string }) => c.name);
      const kr = d["watch/providers"]?.results?.KR || null;
      const prov = kr ? [...(kr.flatrate || []), ...(kr.free || []), ...(kr.ads || [])].map((p: { provider_name: string; logo_path: string }) => ({ name: p.provider_name, logo: p.logo_path ? "https://image.tmdb.org/t/p/w92" + p.logo_path : "" })) : [];
      work = {
        tmdb_id: d.id, kind: kind === "tv" ? "드라마" : "영화", title: d.name || d.title, original: d.original_name || d.original_title || "",
        year: String(d.first_air_date || d.release_date || "").slice(0, 4), overview: String(d.overview || "").slice(0, 900),
        genres: (d.genres || []).map((g: { name: string }) => g.name), makers: [...new Set(makers)].slice(0, 6),
        networks: (d.networks || d.production_companies || []).slice(0, 3).map((n: { name: string }) => n.name),
        episodes: d.number_of_episodes || null, runtime: d.runtime || null, rating: Math.round((d.vote_average || 0) * 10) / 10, votes: d.vote_count || 0,
        homepage: /^https?:\/\//.test(d.homepage || "") ? d.homepage : "", tmdb: `https://www.themoviedb.org/${kind}/${d.id}`,
        imdb: d.external_ids?.imdb_id ? `https://www.imdb.com/title/${d.external_ids.imdb_id}/` : "",
        poster: d.poster_path ? "https://image.tmdb.org/t/p/w342" + d.poster_path : "", backdrop: d.backdrop_path ? "https://image.tmdb.org/t/p/w780" + d.backdrop_path : "",
        watch: prov.slice(0, 6), watch_link: kr?.link || "", direct: await directLinks(d.external_ids?.wikidata_id || ""),
        videos: (d.videos?.results || []).filter((v: { site: string }) => v.site === "YouTube")
          .sort((a: { type: string; iso_639_1: string }, b: { type: string; iso_639_1: string }) => (+(b.type === "Trailer") - +(a.type === "Trailer")) || (+(b.iso_639_1 === "ko") - +(a.iso_639_1 === "ko")))
          .slice(0, 4).map((v: { key: string; name: string; type: string }) => ({ key: v.key, name: String(v.name || "").slice(0, 60), type: v.type })),
        cast: (d.credits?.cast || []).slice(0, 8).map((c: { name: string; character: string }) => ({ name: c.name, ch: String(c.character || "").replace(/\s*\(.*$/, "").slice(0, 20) })),
      };
    }
  }
  const tags = [...new Set([...(t.tags || []), ...((work?.genres as string[]) || []), ...((work?.makers as string[]) || [])])].slice(0, 12);
  await fetch(`${SB}/rest/v1/topics?id=eq.${encodeURIComponent(tid)}`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ work, work_at: new Date().toISOString(), tags }) });
  return { work };
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  const token = Deno.env.get("TMDB_TOKEN") || "";
  if (!token) return j({ error: "no TMDB_TOKEN" }, 503, h);
  let b: { person?: unknown; work?: unknown; ages?: unknown; ensure?: unknown; topic?: unknown };
  try { b = await req.json(); } catch { return j({ error: "json" }, 400, h); }
  try {
    if (typeof b.person === "number") {
      const r = await person(b.person, token) as { error?: string; status?: number };
      return j(r, r.status || 200, h);
    }
    if (typeof b.topic === "string" && b.topic.length <= 40) {
      const r = await topicWork(b.topic, token) as { error?: string; status?: number };
      return j(r, r.status || 200, h);
    }
    if (typeof b.work === "string" && b.work.trim() && b.work.length <= 40) return j(await work(b.work.trim(), token), 200, h);
    if (typeof b.ensure === "string" && b.ensure.trim() && b.ensure.length <= 20) {
      const n = b.ensure.trim(), pid = await personId(n, token);
      if (!pid) return j({ id: null }, 200, h);
      const r = await fetch(`${SB}/rest/v1/rpc/resolve_person`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ nm: n }) });
      const id = r.ok ? await r.json() : null;
      if (id) await fetch(`${SB}/rest/v1/candidates?name=eq.${encodeURIComponent(n)}&person_id=is.null`, { method: "PATCH", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ person_id: id }) });
      return j({ id }, 200, h);
    }
    if (Array.isArray(b.ages)) {
      const names = [...new Set(b.ages.filter((x) => typeof x === "string" && x.trim() && x.length <= 20).map((x) => (x as string).trim()))].slice(0, 40);
      const out: Record<string, string> = {};
      await Promise.all(names.map(async (n) => { const pid = await personId(n, token); out[n] = pid ? await birth(pid, token) : ""; }));
      return j({ ages: out }, 200, h);
    }
    return j({ error: "bad request" }, 400, h);
  } catch (e) {
    return j({ error: String((e as Error).message || e) }, 502, h);
  }
});
