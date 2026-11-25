// TMDB 이미지 중계 Edge Function
// 방문자는 TMDB 키 없이 배우 프로필 사진과 작품 포스터 주소를 받음. 키는 서버 비밀값으로만 보관
// 비밀값(Supabase 대시보드 > Edge Functions > Secrets):
//   TMDB_TOKEN  David가 직접 넣음. TMDB API Key(v3) 또는 API Read Access Token(v4) 중 하나
// 요청: POST { names: ["배우 이름", ...], titles: ["작품 제목", ...] }  (합쳐서 최대 40개)
// 응답: { p: { "배우 이름": "https://image.tmdb.org/...jpg" | "" }, w: { "작품 제목": "..." | "" }, k: { "tv:123": "..." } }
// filmo: "배우 이름", alt: "원어 이름" 을 주면 그 배우의 출연작 목록(제목, 연도, 배역, 포스터)을 돌려줌. DB에 출연 기록이 없는 배우용
// tagged: "배우 이름", alt: "원어 이름", tk: "movie:123" 을 주면 TMDB에서 그 배우가 태그된 그 작품의 사진(스틸, 포스터)을 돌려줌
// works: ["tv:123", "movie:456"] 를 주면 TMDB 번호로 정확한 포스터를 돌려줌(제목 검색보다 정확)
// pids: [123, ...] 를 주면 TMDB 인물 번호로 이름(영문), 다른 이름, 출생지, 사진을 돌려줌(최대 40)
// who: ["이름", ...] 를 주면 인물 검색 상위 3명(연기 분야 우선)의 번호, 이름, 사진, 인지도를 돌려줌(최대 20). 후보 사진 검수용
// imgs: "tv:123" 을 주면 그 작품의 포스터와 배경 이미지 목록(경로, 크기, 언어, 평점)을 돌려줌. 단체 사진 고르기용
// tagl: 123, tk: "tv:456" 을 주면 TMDB에서 그 인물이 태그된 그 작품 이미지 경로 목록을 돌려줌(사람이 태그한 정보, 얼굴 인식 아님). 원작 배우들이 함께 나온 단체 사진 찾기용
// cast, kws, disc: IP 캐릭터와 실사화 데이터 보강용(아래 설명)
// tmdb_cache의 updated_at이 먼 미래인 항목은 검수 끝난 값이라 다시 검색하지 않음
// 결과는 tmdb_cache 테이블에 30일 보관해 TMDB 호출을 줄임
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TTL = 30 * 864e5;

function cors(origin: string | null) {
  const ok = origin && ORIGINS.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://pdavid97.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}
const j = (o: unknown, s: number, h: Record<string, string>) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });

async function cacheGet(keys: string[]) {
  if (!keys.length) return new Map<string, string>();
  const inList = keys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",");
  const since = new Date(Date.now() - TTL).toISOString();
  const r = await fetch(`${SB}/rest/v1/tmdb_cache?select=k,url&updated_at=gte.${since}&k=in.(${encodeURIComponent(inList)})`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  const rows: { k: string; url: string }[] = r.ok ? await r.json() : [];
  return new Map(rows.map((x) => [x.k, x.url]));
}
async function cachePut(rows: { k: string; url: string }[]) {
  if (!rows.length) return;
  await fetch(`${SB}/rest/v1/tmdb_cache?on_conflict=k`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows.map((x) => ({ ...x, updated_at: new Date().toISOString() }))),
  });
}
async function tmdb(path: string, q: string, token: string) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  u.searchParams.set("query", q);
  u.searchParams.set("language", "ko-KR");
  const h: Record<string, string> = { accept: "application/json" };
  if (token.length > 60) h.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
  const r = await fetch(u, { headers: h });
  if (r.status === 401) throw new Error("TMDB 401");
  if (!r.ok) return null;
  return await r.json();
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  const token = Deno.env.get("TMDB_TOKEN") || "";
  if (!token) return j({ error: "no TMDB_TOKEN" }, 503, h);
  let b: { names?: unknown; titles?: unknown; works?: unknown; filmo?: unknown; alt?: unknown; tagged?: unknown; tk?: unknown };
  try { b = await req.json(); } catch { return j({ error: "json" }, 400, h); }
  if (typeof b.tagged === "string" && b.tagged.trim() && b.tagged.length <= 40 && typeof b.tk === "string" && /^(tv|movie):\d{1,9}$/.test(b.tk)) {
    const nm = b.tagged.trim(), alt = typeof b.alt === "string" && b.alt.length <= 60 ? b.alt.trim() : "", tk = b.tk;
    const ck = "t:" + nm + ":" + tk, hit0 = await cacheGet([ck]);
    if (hit0.has(ck)) return j({ u: hit0.get(ck) }, 200, h);
    try {
      let pid: unknown = null;
      for (const q of [alt, nm].filter(Boolean)) {
        const d = await tmdb("/search/person", q, token);
        const p = (d?.results || []).find((r: Record<string, unknown>) => r.known_for_department === "Acting");
        if (p) { pid = p.id; break; }
      }
      let url = "";
      if (pid) {
        const [m, id] = tk.split(":");
        const hh: Record<string, string> = { accept: "application/json" };
        const u = new URL(`https://api.themoviedb.org/3/person/${pid}/tagged_images`);
        if (token.length > 60) hh.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
        for (let page = 1; page <= 3 && !url; page++) {
          u.searchParams.set("page", String(page));
          const r = await fetch(u, { headers: hh });
          if (!r.ok) break;
          const d = await r.json();
          const xs = (d.results || []).filter((x: Record<string, unknown>) => { const md = x.media as Record<string, unknown> | undefined; return md && String(md.id) === id && (x.media_type === m || (m === "tv" && x.media_type === "tv")); });
          const best = xs.sort((a: Record<string, number>, z: Record<string, number>) => (z.vote_average || 0) - (a.vote_average || 0))[0];
          if (best) url = `https://image.tmdb.org/t/p/w500${best.file_path}`;
          if (!d.total_pages || page >= d.total_pages) break;
        }
      }
      await cachePut([{ k: ck, url }]);
      return j({ u: url }, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  if (typeof b.filmo === "string" && b.filmo.trim() && b.filmo.length <= 40) {
    const nm = b.filmo.trim(), alt = typeof b.alt === "string" && b.alt.length <= 60 ? b.alt.trim() : "";
    const ck = "f:" + nm, hit0 = await cacheGet([ck]);
    if (hit0.has(ck)) { try { return j(JSON.parse(hit0.get(ck)!), 200, h); } catch { /* 다시 조회 */ } }
    try {
      let person: Record<string, unknown> | null = null;
      for (const q of [alt, nm].filter(Boolean)) {
        const d = await tmdb("/search/person", q, token);
        person = (d?.results || []).find((r: Record<string, unknown>) => r.known_for_department === "Acting") || null;
        if (person) break;
      }
      if (!person) { await cachePut([{ k: ck, url: JSON.stringify({ f: [], p: "" }) }]); return j({ f: [], p: "" }, 200, h); }
      const u = new URL(`https://api.themoviedb.org/3/person/${person.id}/combined_credits`); u.searchParams.set("language", "ko-KR");
      const hh: Record<string, string> = { accept: "application/json" };
      if (token.length > 60) hh.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
      const r = await fetch(u, { headers: hh });
      const cc = r.ok ? await r.json() : { cast: [] };
      const BAD = [10767, 10763, 10764, 99, 10402];
      const seen = new Set<string>(), Y = new Date().getFullYear();
      const f = (cc.cast || []).filter((c: Record<string, unknown>) => !((c.genre_ids as number[]) || []).some((g) => BAD.includes(g)) && !/self|himself|herself|본인|narrator/i.test(String(c.character || "")) && (c.release_date || c.first_air_date))
        .map((c: Record<string, unknown>) => ({ t: String(c.title || c.name || ""), y: +String(c.release_date || c.first_air_date).slice(0, 4), ch: /[가-힣]/.test(String(c.character || "")) ? String(c.character).replace(/\s*\(.*\)$/, "") : "", tk: `${c.media_type === "movie" ? "movie" : "tv"}:${c.id}`, p: c.poster_path ? `https://image.tmdb.org/t/p/w185${c.poster_path}` : "", v: +(c.vote_count as number || 0) }))
        .filter((x: { t: string; y: number }) => x.t && x.y && x.y < Y && x.y >= 1950)
        .sort((a: { v: number }, z: { v: number }) => z.v - a.v)
        .filter((x: { t: string; y: number }) => { const k = x.t + x.y; if (seen.has(k)) return false; seen.add(k); return true; })
        .slice(0, 30).sort((a: { y: number }, z: { y: number }) => z.y - a.y).map(({ v: _v, ...x }: { v: number }) => x);
      const out = { f, p: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : "" };
      await cachePut([{ k: ck, url: JSON.stringify(out) }]);
      return j(out, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  const auth = (u: URL) => { const hh: Record<string, string> = { accept: "application/json" }; if (token.length > 60) hh.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token); return hh; };
  const im = (b as Record<string, unknown>).imgs;
  if (typeof im === "string" && /^(tv|movie):\d{1,9}$/.test(im)) {
    try {
      const [m, id] = im.split(":");
      const u = new URL(`https://api.themoviedb.org/3/${m}/${id}/images`); u.searchParams.set("include_image_language", "ko,en,null");
      const r = await fetch(u, { headers: auth(u) });
      if (r.status === 401) throw new Error("TMDB 401");
      const d = r.ok ? await r.json() : {};
      const pick = (a: Record<string, unknown>[]) => (a || []).slice(0, 30).map((x) => ({ p: x.file_path, w: x.width, h: x.height, l: x.iso_639_1, v: x.vote_average }));
      return j({ posters: pick(d.posters), backdrops: pick(d.backdrops) }, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  const tl = Number((b as Record<string, unknown>).tagl), tlk = String((b as Record<string, unknown>).tk || "");
  if (Number.isInteger(tl) && tl > 0 && /^(tv|movie):\d{1,9}$/.test(tlk)) {
    try {
      const [m, id] = tlk.split(":"), out: unknown[] = [];
      for (let page = 1; page <= 5; page++) {
        const u = new URL(`https://api.themoviedb.org/3/person/${tl}/tagged_images`); u.searchParams.set("page", String(page));
        const r = await fetch(u, { headers: auth(u) });
        if (!r.ok) break;
        const d = await r.json();
        for (const x of (d.results || []) as Record<string, unknown>[]) { const md = x.media as Record<string, unknown> | undefined; if (md && String(md.id) === id) out.push({ p: x.file_path, w: x.width, h: x.height, t: x.image_type, v: x.vote_average }); }
        if (!d.total_pages || page >= d.total_pages) break;
      }
      return j({ imgs: out }, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  // cast: ["movie:123","tv:456"] 를 주면 작품 정보와 출연진(배우 번호, 이름, 배역, 순서, 성별, 사진)을 돌려줌(최대 10). IP 캐릭터와 실사화 배우 데이터 보강용
  if (Array.isArray((b as Record<string, unknown>).cast)) {
    const ks = ((b as Record<string, unknown>).cast as unknown[]).map(String).filter((x) => /^(tv|movie):\d{1,9}$/.test(x)).slice(0, 10);
    try {
      const out: Record<string, unknown> = {};
      await Promise.all(ks.map(async (k) => {
        const [m, id] = k.split(":");
        const u = new URL(`https://api.themoviedb.org/3/${m}/${id}`); u.searchParams.set("language", "ko-KR"); u.searchParams.set("append_to_response", m === "tv" ? "aggregate_credits" : "credits");
        const r = await fetch(u, { headers: auth(u) });
        if (r.status === 401) throw new Error("TMDB 401");
        if (!r.ok) { out[k] = null; return; }
        const d = await r.json();
        const cr = (m === "tv" ? d.aggregate_credits?.cast : d.credits?.cast) || [];
        out[k] = { t: d.title || d.name, te: d.original_title || d.original_name, y: String(d.release_date || d.first_air_date || "").slice(0, 4), l: d.original_language, c: d.origin_country || (d.production_countries || []).map((x: Record<string, unknown>) => x.iso_3166_1), g: (d.genres || []).map((x: Record<string, unknown>) => x.name), pop: d.popularity || 0, poster: d.poster_path || "",
          cast: (cr as Record<string, unknown>[]).slice(0, 25).map((x) => ({ id: x.id, n: x.name, ch: x.character || ((x.roles as Record<string, unknown>[] | undefined) || []).map((y) => y.character).filter(Boolean).join(" / "), o: x.order, g: x.gender, p: x.profile_path || "" })) };
      }));
      return j(out, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  // kws: "검색어" 를 주면 TMDB 키워드 번호 목록. disc: { m: "movie"|"tv", kw: "1,2", co: "420", page: 1 } 를 주면 그 조건의 작품 목록(인기순)
  if (typeof (b as Record<string, unknown>).kws === "string") {
    try {
      const u = new URL("https://api.themoviedb.org/3/search/keyword"); u.searchParams.set("query", String((b as Record<string, unknown>).kws).slice(0, 60));
      const r = await fetch(u, { headers: auth(u) }); const d = r.ok ? await r.json() : {};
      return j({ kw: (d.results || []).slice(0, 20) }, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  const dc = (b as Record<string, unknown>).disc as Record<string, unknown> | undefined;
  if (dc && typeof dc === "object") {
    try {
      const m = dc.m === "tv" ? "tv" : "movie", u = new URL(`https://api.themoviedb.org/3/discover/${m}`);
      u.searchParams.set("language", "ko-KR"); u.searchParams.set("sort_by", "popularity.desc"); u.searchParams.set("page", String(Math.min(20, Math.max(1, Number(dc.page) || 1))));
      if (dc.kw && /^[\d,|]+$/.test(String(dc.kw))) u.searchParams.set("with_keywords", String(dc.kw));
      if (dc.co && /^[\d,|]+$/.test(String(dc.co))) u.searchParams.set("with_companies", String(dc.co));
      if (dc.g && /^[\d,|]+$/.test(String(dc.g))) u.searchParams.set("with_genres", String(dc.g));
      if (dc.ng && /^[\d,|]+$/.test(String(dc.ng))) u.searchParams.set("without_genres", String(dc.ng));
      const r = await fetch(u, { headers: auth(u) }); const d = r.ok ? await r.json() : {};
      return j({ pages: d.total_pages || 0, res: (d.results || []).map((x: Record<string, unknown>) => ({ k: `${m}:${x.id}`, t: x.title || x.name, te: x.original_title || x.original_name, y: String(x.release_date || x.first_air_date || "").slice(0, 4), pop: x.popularity, l: x.original_language })) }, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  if (Array.isArray((b as Record<string, unknown>).pids)) {
    const ids = [...new Set(((b as Record<string, unknown>).pids as unknown[]).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 40);
    try {
      const out: Record<string, unknown> = {};
      await Promise.all(ids.map(async (id) => {
        const u = new URL(`https://api.themoviedb.org/3/person/${id}`); u.searchParams.set("language", "en-US");
        const r = await fetch(u, { headers: auth(u) });
        if (r.status === 401) throw new Error("TMDB 401");
        const d = r.ok ? await r.json() : null;
        out[id] = d ? { id, name: d.name, aka: (d.also_known_as || []).slice(0, 20), pob: d.place_of_birth || "", dep: d.known_for_department || "", pop: d.popularity || 0, p: d.profile_path || "" } : null;
      }));
      return j(out, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  if (Array.isArray((b as Record<string, unknown>).who)) {
    const qs = [...new Set(((b as Record<string, unknown>).who as unknown[]).filter((x) => typeof x === "string" && x.trim() && (x as string).length <= 60).map((x) => (x as string).trim()))].slice(0, 20);
    try {
      const out: Record<string, unknown> = {};
      await Promise.all(qs.map(async (q) => {
        const d = await tmdb("/search/person", q, token);
        const rs = ((d?.results || []) as Record<string, unknown>[]).sort((a, z) => (z.known_for_department === "Acting" ? 1 : 0) - (a.known_for_department === "Acting" ? 1 : 0));
        out[q] = rs.slice(0, 3).map((r) => ({ id: r.id, name: r.name, dep: r.known_for_department, pop: r.popularity, p: r.profile_path || "", kf: ((r.known_for || []) as Record<string, unknown>[]).map((k) => k.title || k.name).slice(0, 3) }));
      }));
      return j(out, 200, h);
    } catch (e) { return j({ error: String(e) }, 500, h); }
  }
  const clean = (a: unknown) => (Array.isArray(a) ? a : []).filter((x) => typeof x === "string" && x.trim() && x.length <= 40).map((x) => (x as string).trim());
  const names = [...new Set(clean(b.names))], titles = [...new Set(clean(b.titles))];
  if (names.length + titles.length > 40) return j({ error: "too many" }, 400, h);
  const works = [...new Set((Array.isArray(b.works) ? b.works : []).filter((x) => typeof x === "string" && /^(tv|movie):\d{1,9}$/.test(x as string)))] as string[];
  if (works.length > 40) return j({ error: "too many" }, 400, h);
  const keys = [...names.map((n) => "p:" + n), ...titles.map((t) => "w:" + t), ...works.map((w) => "k:" + w)];
  const hit = await cacheGet(keys);
  const out = { p: {} as Record<string, string>, w: {} as Record<string, string>, k: {} as Record<string, string> }, fresh: { k: string; url: string }[] = [];
  try {
    await Promise.all(keys.map(async (k) => {
      let url = hit.get(k);
      if (url === undefined && k.startsWith("k:")) {
        const [m, id] = k.slice(2).split(":");
        const u = new URL(`https://api.themoviedb.org/3/${m}/${id}`); u.searchParams.set("language", "ko-KR");
        const hh: Record<string, string> = { accept: "application/json" };
        if (token.length > 60) hh.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
        const r = await fetch(u, { headers: hh });
        if (r.status === 401) throw new Error("TMDB 401");
        const d = r.ok ? await r.json() : null;
        url = d && d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : "";
        fresh.push({ k, url });
      }
      if (url === undefined) {
        const isP = k.startsWith("p:"), q = k.slice(2);
        const d = await tmdb(isP ? "/search/person" : "/search/multi", q, token);
        if (d) {
          const x = (d.results || []).find((r: Record<string, string>) => isP ? r.profile_path : r.poster_path && (r.media_type === "tv" || r.media_type === "movie"));
          url = x ? `https://image.tmdb.org/t/p/${isP ? "w185" : "w342"}${isP ? x.profile_path : x.poster_path}` : "";
          fresh.push({ k, url });
        } else url = "";
      }
      (k.startsWith("p:") ? out.p : k.startsWith("k:") ? out.k : out.w)[k.slice(2)] = url;
    }));
  } catch (e) {
    return j({ error: String(e) }, String(e).includes("401") ? 502 : 500, h);
  }
  await cachePut(fresh);
  return j(out, 200, h);
});
