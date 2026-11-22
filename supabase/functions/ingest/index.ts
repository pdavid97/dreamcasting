// 정본 데이터 적재 Edge Function
// action=credits : TMDB 출연 기록을 work, credit에 적재(원본은 raw_fetch). 아직 안 한 인물부터, 30일 지난 인물 재적재
// action=remakes : 위키데이터 "기반 작품(P144)" 관계로 한국과 미국 사이 리메이크 쌍을 찾아 adaptation, 배역 연결, 캐스팅 결과, 평점 적재
// action=signals : 현재 후보 세트 인물의 뉴스 언급 건수(매시간), TMDB 인기와 위키백과 조회수(하루 1회, daily=true)
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const up = (table: string, rows: unknown[], conflict: string) => rows.length ? rest(`${table}?on_conflict=${conflict}`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) }) : null;
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  for (let i = 0; i < 3; i++) { const r = await fetch(u, { headers: h }); if (r.status === 429) { await sleep(800 * (i + 1)); continue; } return r.ok ? await r.json() : null; }
  return null;
}
const NOT_ACTING = [10767, 10763, 10764, 99, 10402];
const ANTH = /스페셜|단막|베스트극장|드라마시티|로 앤 오더|Law & Order|SNL|Saturday Night|시상식|어워즈|Awards|투어|콘서트|Tour|Concert|Package|Live in/i;
const SELF = /self|himself|herself|본인|자기 자신|host|narrator/i;
type Cr = { id: number; media_type: string; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string; character?: string; order?: number; genre_ids?: number[]; original_language?: string; origin_country?: string[] };
const GEN: Record<number, string> = {};
async function genres() { for (const k of ["movie", "tv"]) { const g = await tm(`/genre/${k}/list`, { language: "ko" }); for (const x of g?.genres || []) GEN[x.id] = x.name; } }

// TMDB 작품을 work에 넣고 id 맵을 돌려줌
async function ensureWorks(cs: Cr[]) {
  const rows = new Map<string, Record<string, unknown>>();
  for (const c of cs) {
    const media = c.media_type === "tv" ? "tv" : "movie", d = c.release_date || c.first_air_date || "";
    rows.set(`${media}:${c.id}`, { tmdb_id: c.id, media, title: c.title || c.name, title_en: c.original_title || c.original_name || null, year: d ? +d.slice(0, 4) : null, genres: (c.genre_ids || []).map((g) => GEN[g]).filter(Boolean), orig_lang: c.original_language || null, country: (c.origin_country || [])[0] || null, srcs: ["tmdb"], updated_at: new Date().toISOString() });
  }
  const list = [...rows.values()];
  for (let i = 0; i < list.length; i += 300) await up("work", list.slice(i, i + 300), "media,tmdb_id");
  const ids = new Map<string, number>();
  const keys = [...rows.keys()];
  for (const media of ["movie", "tv"]) {
    const t = keys.filter((k) => k.startsWith(media + ":")).map((k) => k.split(":")[1]);
    for (let i = 0; i < t.length; i += 150) {
      const r = await (await rest(`work?select=id,tmdb_id&media=eq.${media}&tmdb_id=in.(${t.slice(i, i + 150).join(",")})`)).json();
      for (const w of Array.isArray(r) ? r : []) ids.set(`${media}:${w.tmdb_id}`, w.id);
    }
  }
  return ids;
}

async function credits(limit: number) {
  await genres();
  // 진행 중 후보와 원작 배우부터, 그다음 인기순(dc_credit_queue)
  const ppl = await (await rest("rpc/dc_credit_queue", { method: "POST", body: JSON.stringify({ lim: limit }) })).json();
  let n = 0, c = 0;
  for (const p of Array.isArray(ppl) ? ppl : []) {
    const d = await tm(`/person/${p.tmdb_id}/combined_credits`, { language: "ko-KR" });
    if (!d) continue;
    await rest("raw_fetch", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ source: "tmdb", key: `person_credits:${p.tmdb_id}`, status: 200, payload: { n: (d.cast || []).length } }) });
    const cs = ((d.cast || []) as Cr[]).filter((x) => (x.title || x.name) && !(x.genre_ids || []).some((g) => NOT_ACTING.includes(g)) && !SELF.test(x.character || ""));
    const ids = await ensureWorks(cs);
    const rows = new Map<number, Record<string, unknown>>();
    for (const x of cs) {
      const wid = ids.get(`${x.media_type === "tv" ? "tv" : "movie"}:${x.id}`); if (!wid || rows.has(wid)) continue;
      rows.set(wid, { person_id: p.id, work_id: wid, character: x.character || null, ord: x.order ?? null, anthology: ANTH.test(x.title || x.name || ""), src: "tmdb" });
    }
    await up("credit", [...rows.values()], "person_id,work_id,src");
    await rest(`people?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ credits_at: new Date().toISOString() }) });
    n++; c += rows.size;
  }
  return { people: n, credits: c };
}

// 위키데이터: 한국 원작과 미국 리메이크(또는 반대). P144 기반 작품, P495 원산국, P4947 TMDB 영화 ID, P4983 TMDB TV ID
async function wdPairs() {
  const q = `SELECT DISTINCT ?src ?dst ?sm ?st ?dm ?dt ?sc ?dc WHERE {
    ?dst wdt:P144 ?src . ?src wdt:P495 ?sco . ?dst wdt:P495 ?dco .
    VALUES (?sco ?dco ?sc ?dc) { (wd:Q884 wd:Q30 "kr" "us") (wd:Q30 wd:Q884 "us" "kr") }
    OPTIONAL { ?src wdt:P4947 ?sm } OPTIONAL { ?src wdt:P4983 ?st }
    OPTIONAL { ?dst wdt:P4947 ?dm } OPTIONAL { ?dst wdt:P4983 ?dt }
    FILTER((BOUND(?sm) || BOUND(?st)) && (BOUND(?dm) || BOUND(?dt)))
  } LIMIT 400`;
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)", accept: "application/sparql-results+json" } });
  if (!r.ok) return [];
  const j = await r.json();
  // deno-lint-ignore no-explicit-any
  return (j.results?.bindings || []).map((b: any) => ({
    srcQ: b.src.value.split("/").pop(), dstQ: b.dst.value.split("/").pop(),
    s: b.sm ? { media: "movie", id: +b.sm.value } : { media: "tv", id: +b.st.value },
    d: b.dm ? { media: "movie", id: +b.dm.value } : { media: "tv", id: +b.dt.value },
    dir: `${b.sc.value}2${b.dc.value}`,
  })).filter((x: { s: { id: number }; d: { id: number } }) => x.s.id && x.d.id);
}
// deno-lint-ignore no-explicit-any
async function workFromTmdb(media: string, id: number, qid: string): Promise<{ wid: number; det: any; cast: any[] } | null> {
  const det = await tm(`/${media}/${id}`, { language: "ko-KR", append_to_response: media === "tv" ? "aggregate_credits" : "credits" });
  if (!det?.id) return null;
  const d = det.release_date || det.first_air_date || "";
  await up("work", [{ tmdb_id: id, media, title: det.title || det.name, title_en: det.original_title || det.original_name || null, year: d ? +d.slice(0, 4) : null, genres: (det.genres || []).map((g: { name: string }) => g.name), orig_lang: det.original_language || null, country: (det.origin_country || det.production_countries?.map((c: { iso_3166_1: string }) => c.iso_3166_1) || [])[0] || null, srcs: ["tmdb", "wikidata"], updated_at: new Date().toISOString() }], "media,tmdb_id");
  if (qid) await rest(`work?media=eq.${media}&tmdb_id=eq.${id}&qid=is.null`, { method: "PATCH", body: JSON.stringify({ qid }) });
  const w = await (await rest(`work?select=id&media=eq.${media}&tmdb_id=eq.${id}`)).json();
  const cast = (media === "tv" ? det.aggregate_credits?.cast : det.credits?.cast) || [];
  if (det.vote_count) {
    const at = new Date().toISOString().slice(0, 10);
    const perf = [{ metric: "rating", value: det.vote_average }, { metric: "votes", value: det.vote_count }, ...(det.revenue ? [{ metric: "revenue_usd", value: det.revenue }] : [])];
    await up("work_perf", perf.map((x) => ({ work_id: w[0].id, source: "tmdb", at, ...x })), "work_id,source,metric,at");
  }
  return { wid: w[0].id, det, cast };
}
async function personFor(m: { id: number; name: string; gender?: number }) {
  let r = await (await rest(`people?select=id,birth,gender&tmdb_id=eq.${m.id}`)).json();
  if (!r?.[0]) {
    const pd = await tm(`/person/${m.id}`, { language: "ko-KR" });
    await up("people", [{ tmdb_id: m.id, name: pd?.name || m.name, gender: pd?.gender || m.gender || null, birth: /^\d{4}-\d{2}-\d{2}$/.test(pd?.birthday || "") ? pd.birthday : null, pob: pd?.place_of_birth || null, pop: pd?.popularity || null, kinds: ["actor"], acted: true, srcs: ["tmdb"] }], "tmdb_id");
    r = await (await rest(`people?select=id,birth,gender&tmdb_id=eq.${m.id}`)).json();
  }
  return r[0] as { id: number; birth: string | null; gender: number | null };
}
const roleName = (m: { character?: string; roles?: { character: string }[] }) => (m.character || m.roles?.[0]?.character || "").replace(/\s*\(.*\)$/, "").trim();
type Pair = { srcQ: string; dstQ: string; s: { media: string; id: number }; d: { media: string; id: number }; dir: string; url?: string; src?: string };
async function remakes(limit: number, manual?: Pair[]) {
  let pairs: Pair[] = manual || await wdPairs();
  if (!manual) {
    const done = await (await rest("adaptation?select=w:work!adaptation_dst_work_id_fkey(media,tmdb_id)")).json();
    const seen = new Set((Array.isArray(done) ? done : []).map((x: { w: { media: string; tmdb_id: number } }) => `${x.w?.media}:${x.w?.tmdb_id}`));
    pairs = pairs.filter((x) => !seen.has(`${x.d.media}:${x.d.id}`));
  }
  pairs = pairs.slice(0, limit);
  let made = 0, chars = 0;
  for (const pr of pairs) {
    const a = await workFromTmdb(pr.s.media, pr.s.id, pr.srcQ), b = await workFromTmdb(pr.d.media, pr.d.id, pr.dstQ);
    if (!a || !b) continue;
    const rel = (b.det.release_date || b.det.first_air_date || "") || null;
    await up("adaptation", [{ src_work_id: a.wid, dst_work_id: b.wid, relation: "remake", direction: pr.dir, status: rel && rel <= new Date().toISOString().slice(0, 10) ? "released" : "announced", released_at: rel, evidence_url: pr.url || `https://www.wikidata.org/wiki/${pr.dstQ}`, src: pr.src || "wikidata" }], "src_work_id,dst_work_id");
    made++;
    // 배역 연결: 같은 이름이면 name, 아니면 같은 성별 안에서 출연 순서로(order). order 연결은 추정이라 method로 구분
    const top = (cs: { gender?: number; order?: number }[]) => cs.filter((m) => m.gender === 1 || m.gender === 2).slice(0, 6);
    const A = top(a.cast), B = top(b.cast);
    const used = new Set<number>();
    for (const ma of A as { id: number; name: string; gender: number; character?: string }[]) {
      const ca = roleName(ma); if (!ca) continue;
      let mb = (B as { id: number; name: string; gender: number; character?: string }[]).find((x) => !used.has(x.id) && roleName(x) === ca);
      let method = "name";
      if (!mb) { mb = (B as { id: number; name: string; gender: number }[]).find((x) => !used.has(x.id) && x.gender === ma.gender); method = "order"; }
      if (!mb) continue; used.add(mb.id);
      const label = `${ca} / ${roleName(mb) || "?"}`;
      await up("story_character", [{ family_work_id: a.wid, label }], "family_work_id,label");
      const sc = await (await rest(`story_character?select=id&family_work_id=eq.${a.wid}&label=eq.${encodeURIComponent(label)}`)).json();
      const pa = await personFor(ma), pb = await personFor(mb);
      await up("character_map", [{ character_id: sc[0].id, work_id: a.wid, role_name: ca, person_id: pa.id, method }, { character_id: sc[0].id, work_id: b.wid, role_name: roleName(mb) || "?", person_id: pb.id, method }], "character_id,work_id");
      const ya = +(a.det.release_date || a.det.first_air_date || "0").slice(0, 4), yb = +(b.det.release_date || b.det.first_air_date || "0").slice(0, 4);
      const ageA = pa.birth && ya ? ya - +pa.birth.slice(0, 4) : null, ageB = pb.birth && yb ? yb - +pb.birth.slice(0, 4) : null;
      await up("casting_outcome", [{ character_id: sc[0].id, work_id: b.wid, person_id: pb.id, announced_at: null, age_at: ageB, pop_at: null, buzz_at: null, orig_age_gap: ageA != null && ageB != null ? ageB - ageA : null, src: "tmdb" }], "character_id,work_id,person_id");
      chars++;
    }
  }
  return { pairs: pairs.length, made, chars };
}

// 신호: 현재 세트 인물 + 인기 상위
const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim();
async function newsCount(name: string) {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(`"${name}" when:1d`)}&hl=ko&gl=KR&ceid=KR:ko`, { headers: { "User-Agent": "Mozilla/5.0 dreamcasting" } });
    if (!r.ok) return null;
    const x = await r.text();
    return [...x.matchAll(/<title>([\s\S]*?)<\/title>/g)].slice(1).filter((m) => dec(m[1]).includes(name)).length;
  } catch { return null; }
}
async function signals(daily: boolean, limit: number) {
  const cs = await (await rest("candidates?select=person_id,pool_id&in_set=is.true&limit=2000")).json();
  const ids = new Set<number>(), pools: number[] = [];
  for (const c of Array.isArray(cs) ? cs : []) { if (c.person_id) ids.add(c.person_id); else if (c.pool_id) pools.push(c.pool_id); }
  for (let i = 0; i < pools.length; i += 200) { const r = await (await rest(`cast_pool?select=person_id&id=in.(${pools.slice(i, i + 200).join(",")})`)).json(); for (const x of Array.isArray(r) ? r : []) if (x.person_id) ids.add(x.person_id); }
  const ppl = ids.size ? await (await rest(`people?select=id,name,tmdb_id,qid&id=in.(${[...ids].join(",")})`)).json() : [];
  const hour = new Date(); hour.setMinutes(0, 0, 0);
  const at = hour.toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const p of (ppl as { id: number; name: string; tmdb_id: number | null; qid: string | null }[]).slice(0, limit)) {
    const n = await newsCount(p.name);
    if (n != null) rows.push({ person_id: p.id, source: "google_news", metric: "news_mentions_1d", at, value: n });
    await sleep(150);
  }
  if (daily) {
    const day = new Date().toISOString().slice(0, 10) + "T00:00:00Z";
    const top = await (await rest("people?select=id,tmdb_id,qid,name&tmdb_id=not.is.null&order=pop.desc.nullslast&limit=500")).json();
    const all = new Map<number, { id: number; tmdb_id: number | null; qid: string | null; name: string }>();
    for (const p of [...(ppl as []), ...(Array.isArray(top) ? top : [])] as { id: number; tmdb_id: number | null; qid: string | null; name: string }[]) all.set(p.id, p);
    for (const p of all.values()) {
      if (!p.tmdb_id) continue;
      const d = await tm(`/person/${p.tmdb_id}`);
      if (d?.popularity != null) { rows.push({ person_id: p.id, source: "tmdb", metric: "tmdb_pop", at: day, value: d.popularity }); await rest(`people?id=eq.${p.id}`, { method: "PATCH", body: JSON.stringify({ pop: d.popularity }) }); }
    }
    // 위키백과 조회수(어제 하루). 위키데이터에서 한국어 문서 제목을 찾음
    const withQ = [...all.values()].filter((p) => p.qid && ids.has(p.id)).slice(0, 300);
    for (let i = 0; i < withQ.length; i += 50) {
      const chunk = withQ.slice(i, i + 50);
      const wd = await (await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=kowiki|enwiki&ids=${chunk.map((p) => p.qid).join("|")}`, { headers: { "User-Agent": "dreamcasting/1.0" } })).json();
      for (const p of chunk) {
        const sl = wd.entities?.[p.qid!]?.sitelinks || {};
        const site = sl.kowiki ? ["ko.wikipedia", sl.kowiki.title] : sl.enwiki ? ["en.wikipedia", sl.enwiki.title] : null;
        if (!site) continue;
        const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10).replace(/-/g, "");
        const pv = await fetch(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${site[0]}/all-access/user/${encodeURIComponent(site[1].replace(/ /g, "_"))}/daily/${y}/${y}`, { headers: { "User-Agent": "dreamcasting/1.0" } });
        if (pv.ok) { const j = await pv.json(); const v = j.items?.[0]?.views; if (v != null) rows.push({ person_id: p.id, source: "wikipedia_pv", metric: `pageviews_${site[0].slice(0, 2)}`, at: day, value: v }); }
      }
    }
  }
  for (let i = 0; i < rows.length; i += 500) await up("signal", rows.slice(i, i + 500), "person_id,source,metric,at");
  return { people: ids.size, rows: rows.length };
}

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({}));
  const job = `ingest:${b.action || "credits"}`;
  const jr = await (await rest("job_run", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ job }) })).json();
  const jid = jr?.[0]?.id;
  try {
    // action=pair: 위키데이터에 아직 없는 리메이크를 운영자가 근거 링크와 함께 추가. d.query와 d.year로 TMDB 검색 가능
    if (b.action === "pair") {
      const d = b.d || {};
      if (!d.id && d.query) { const r = await tm(`/search/${d.media || "movie"}`, { query: d.query, language: "ko-KR", ...(d.year ? { [d.media === "tv" ? "first_air_date_year" : "year"]: String(d.year) } : {}) }); d.id = r?.results?.[0]?.id; }
      if (!b.s?.id || !d.id || !b.url) throw new Error("s.id, d.id(또는 d.query), url이 필요해요");
      b.action = "pair_run"; b.pairs = [{ srcQ: "", dstQ: "", s: b.s, d: { media: d.media || "movie", id: d.id }, dir: b.dir || "", url: b.url, src: "manual" }];
    }
    const out = b.action === "pair_run" ? await remakes(1, b.pairs) : b.action === "remakes" ? await remakes(b.limit || 20) : b.action === "signals" ? await signals(!!b.daily, b.limit || 400) : await credits(b.limit || 25);
    if (jid) await rest(`job_run?id=eq.${jid}`, { method: "PATCH", body: JSON.stringify({ status: "ok", finished_at: new Date().toISOString(), counts: out }) });
    return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    if (jid) await rest(`job_run?id=eq.${jid}`, { method: "PATCH", body: JSON.stringify({ status: "failed", finished_at: new Date().toISOString(), error: String(e).slice(0, 500) }) });
    return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 });
  }
});
