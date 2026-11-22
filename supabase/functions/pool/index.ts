// 후보 풀 수집 Edge Function
// action:
//  kr     : TMDB 인기 한국 드라마, 영화(페이지 범위) 주요 출연진 12명씩 → cast_pool(region kr)
//  intl   : TMDB 인기 인물(해외 배우) → cast_pool(region intl)
//  names  : 한국어 이름, 생일, 대표작이 비어 있는 행을 TMDB 상세로 채움(한 번에 limit명)
//  wd     : 위키데이터에서 한국 국적 개그맨, 가수, 아이돌, 뮤지컬과 연극 배우, 유튜버, 인플루언서 → cast_pool(kind별)
// 호출 예: {action:"kr", from:1, to:5}
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: h });
    if (r.status === 429) { await sleep(1000 * (i + 1)); continue; }
    return r.ok ? await r.json() : null;
  }
  return null;
}
const HANGUL = /[가-힣]/;
type Row = Record<string, unknown>;
async function upsert(rows0: Row[], key: string) {
  const m = new Map<unknown, Row>(); for (const r of rows0) m.set(r[key], { ...(m.get(r[key]) || {}), ...r }); const rows = [...m.values()];
  for (let i = 0; i < rows.length; i += 200) {
    const r = await rest(`cast_pool?on_conflict=${key}`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows.slice(i, i + 200)) });
    if (!r.ok) throw new Error(await r.text());
  }
}

async function kr(from: number, to: number) {
  const seen = new Map<number, Row>();
  for (const kind of ["tv", "movie"]) {
    for (let page = from; page <= to; page++) {
      const d = await tm(`/discover/${kind}`, { with_origin_country: "KR", sort_by: "popularity.desc", "vote_count.gte": kind === "tv" ? "20" : "50", page: String(page), language: "ko-KR" });
      for (const w of d?.results || []) {
        const c = await tm(`/${kind}/${w.id}/${kind === "tv" ? "aggregate_credits" : "credits"}`, { language: "ko-KR" });
        for (const p of (c?.cast || []).slice(0, 12)) {
          if (p.known_for_department && p.known_for_department !== "Acting") continue;
          const prev = seen.get(p.id);
          const pop = Math.max(Number(prev?.pop || 0), p.popularity || 0);
          seen.set(p.id, { tmdb_id: p.id, name: p.name, name_en: p.original_name || p.name, gender: p.gender ?? 0, pop, region: "kr", kind: "actor", acted: true, src: `tmdb_kr_${kind}`, updated_at: new Date().toISOString() });
        }
      }
    }
  }
  await upsert([...seen.values()], "tmdb_id");
  return seen.size;
}
async function intl(from: number, to: number) {
  const rows: Row[] = [];
  for (let page = from; page <= to; page++) {
    const d = await tm("/person/popular", { page: String(page), language: "ko-KR" });
    for (const p of d?.results || []) {
      if (p.known_for_department !== "Acting" || p.adult) continue;
      const known = (p.known_for || []).slice(0, 3).map((k: { original_language?: string }) => ({ lang: k.original_language }));
      // 한국 작품이 대표작인 배우는 kr로
      const region = known.some((k: { lang?: string }) => k.lang === "ko") ? "kr" : "intl";
      rows.push({ tmdb_id: p.id, name: p.name, name_en: p.name, gender: p.gender ?? 0, pop: p.popularity || 0, region, kind: "actor", acted: true, src: "tmdb_popular", updated_at: new Date().toISOString() });
    }
  }
  await upsert(rows, "tmdb_id");
  return rows.length;
}
// 상세: 한국어 이름(also_known_as의 한글), 생일, 대표작(투표 수 많은 출연작 3개)
async function names(limit: number) {
  const rows = await (await rest(`cast_pool?select=id,tmdb_id,name&tmdb_id=not.is.null&known=is.null&order=pop.desc&limit=${limit}`)).json();
  let n = 0;
  for (const r of Array.isArray(rows) ? rows : []) {
    const d = await tm(`/person/${r.tmdb_id}`, { language: "ko-KR", append_to_response: "combined_credits" });
    if (!d) { await rest(`cast_pool?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ known: [] }) }); continue; }
    const ko = [d.name, ...(d.also_known_as || [])].find((x: string) => HANGUL.test(x) && !/[a-zA-Z]/.test(x) && x.length <= 12);
    const cast = ((d.combined_credits?.cast || []) as { title?: string; name?: string; release_date?: string; first_air_date?: string; character?: string; vote_count?: number; genre_ids?: number[] }[])
      .filter((c) => (c.title || c.name) && !(c.genre_ids || []).some((g) => [10767, 10763, 10764].includes(g)));
    const known = [...cast].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 4).map((c) => ({ t: c.title || c.name, y: (c.release_date || c.first_air_date || "").slice(0, 4) || null, ch: (c.character || "").slice(0, 30) || null }));
    const body: Row = { known, birth: d.birthday || null, aka: (d.also_known_as || []).slice(0, 8), updated_at: new Date().toISOString() };
    if (ko) body.name = ko;
    if (d.gender != null) body.gender = d.gender;
    await rest(`cast_pool?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify(body) });
    n++;
  }
  return n;
}
// 위키데이터: 한국 국적 인물 중 비배우 직군(배우 겸업이면 acted=true)
async function wd(minLinks: number) {
  const q = `SELECT ?p ?ko ?en ?g ?b ?sl (GROUP_CONCAT(DISTINCT ?occEn; separator="|") AS ?occs) WHERE {
    ?p wdt:P27 wd:Q884; wdt:P31 wd:Q5; wdt:P106 ?occ; wikibase:sitelinks ?sl.
    FILTER(?sl >= ${minLinks})
    ?occ rdfs:label ?occEn. FILTER(lang(?occEn) = "en")
    ?p rdfs:label ?ko. FILTER(lang(?ko) = "ko")
    OPTIONAL { ?p rdfs:label ?en. FILTER(lang(?en) = "en") }
    OPTIONAL { ?p wdt:P21 ?g }
    OPTIONAL { ?p wdt:P569 ?b }
    FILTER NOT EXISTS { ?p wdt:P570 ?dead }
  } GROUP BY ?p ?ko ?en ?g ?b ?sl LIMIT 6000`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { "User-Agent": "DreamcastingPool/1.0 (https://pdavid97.github.io/dreamcasting/)", Accept: "application/sparql-results+json" } });
  if (!r.ok) throw new Error("wikidata " + r.status + " " + (await r.text()).slice(0, 200));
  const j = await r.json();
  const rows: Row[] = [];
  for (const b of j.results.bindings) {
    const occ = String(b.occs?.value || "").toLowerCase();
    const acted = /actor|actress/.test(occ);
    const kind = /youtuber|streamer|vlogger/.test(occ) ? "youtuber"
      : /comedian|gagman|humorist/.test(occ) ? "comedian"
      : /musical theatre|musical actor/.test(occ) ? "musical"
      : /stage actor|theatre actor|theater actor/.test(occ) ? "stage"
      : /idol|k-pop/.test(occ) ? "idol"
      : /singer|rapper/.test(occ) ? "singer"
      : /influencer|model|television presenter|broadcaster/.test(occ) ? "influencer" : null;
    if (!kind) continue; // 순수 배우는 TMDB에서 모음
    const g = String(b.g?.value || "");
    rows.push({ qid: b.p.value.split("/").pop(), name: b.ko.value, name_en: b.en?.value || null, kind, region: "kr", acted, gender: g.endsWith("Q6581072") ? 1 : g.endsWith("Q6581097") ? 2 : 0, birth: b.b?.value ? b.b.value.slice(0, 10) : null, pop: Number(b.sl.value), src: "wikidata", updated_at: new Date().toISOString() });
  }
  // 같은 사람이 TMDB 행으로 이미 있으면(이름과 생일이 같으면) 직군 정보만 보강
  await upsert(rows, "qid");
  return rows.length;
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}));
    const a = b.action || "names";
    let n = 0;
    if (a === "kr") n = await kr(b.from || 1, b.to || 3);
    else if (a === "intl") n = await intl(b.from || 1, b.to || 10);
    else if (a === "names") n = await names(Math.min(400, b.limit || 150));
    else if (a === "wd") n = await wd(b.min || 4);
    const c = await rest("cast_pool?select=id", { headers: { Prefer: "count=exact", Range: "0-0" } });
    return new Response(JSON.stringify({ action: a, n, total: c.headers.get("content-range") }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 }); }
});
