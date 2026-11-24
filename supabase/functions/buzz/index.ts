// 화제성 계산 Edge Function (pg_cron 하루 1회: collect를 6개씩 여러 번 부른 뒤 score 한 번)
// v3 점수(0~100): 소스별 log1p 값을 그날 전체 작품의 95번째 백분위로 나눠 0~1로 맞춘 뒤 가중 평균
//   뉴스 0.20(Google News RSS, 드라마/영화 등 맥락어 포함), 광장 활동 0.20, 네이버 데이터랩 0.20(키 있을 때만),
//   위키백과 조회수 0.10, TMDB 주간 트렌딩 0.10. 데이터가 없는 소스는 분모에서 뺌
//   + 위키 조회수 최근 7일 대 직전 7일 모멘텀(최대 ±15%) + Google Trends 한국 급상승 RSS에 걸리면 +5
// 자세한 근거: docs/buzz-sources.md
// 덤: "실사화, 드라마화, 캐스팅" 최근 7일 기사 제목을 buzz_ideas에 모아 운영자가 새 주제로 검토
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

async function news(q: string) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 dreamcasting" } });
    if (!r.ok) return null;
    const x = await r.text();
    // CPU 제한(요청당 수 초) 때문에 정규식 대신 indexOf로 가볍게, 최대 40건만
    const tag = (blk: string, t: string) => { const a = blk.indexOf(`<${t}`); if (a < 0) return ""; const b = blk.indexOf(">", a); const c = blk.indexOf(`</${t}>`, b); return c < 0 ? "" : dec(blk.slice(b + 1, c)); };
    const items: { t: string; u: string; s: string; d: string }[] = [];
    let i = 0;
    while (items.length < 40) { const a = x.indexOf("<item>", i); if (a < 0) break; const b = x.indexOf("</item>", a); if (b < 0) break; const blk = x.slice(a, b); items.push({ t: tag(blk, "title").slice(0, 140), u: tag(blk, "link"), s: tag(blk, "source"), d: tag(blk, "pubDate") }); i = b + 7; }
    return items;
  } catch { return null; }
}
const UA = "DreamcastingBuzz/3.0 (https://pdavid97.github.io/dreamcasting/) deno";
const CTX = "(드라마 OR 영화 OR 웹툰 OR 웹소설 OR 캐스팅 OR 리메이크 OR 배우)";
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function trendsKR() {
  try {
    const r = await fetch("https://trends.google.com/trending/rss?geo=KR", { headers: { "User-Agent": UA } });
    if (!r.ok) return [] as string[];
    const x = await r.text();
    return [...x.matchAll(/<(title|ht:news_item_title)>([\s\S]*?)<\/\1>/g)].map((m) => dec(m[2]));
  } catch { return [] as string[]; }
}
async function wikiGet(u: string) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": UA, "Api-User-Agent": UA } });
      if (r.status === 429) { await sleep(1500 * (i + 1)); continue; }
      return r.ok ? await r.json() : null;
    } catch { await sleep(800); }
  }
  return null;
}
async function wikiTitle(title: string) {
  // "제목 (드라마)" 같은 작품 전용 문서를 먼저 찾고, 없으면 제목 그대로
  for (const sfx of [" (드라마)", " (텔레비전 드라마)", " (영화)"]) { const x = await wikiTitle1(title + sfx); if (x) return x; }
  return await wikiTitle1(title);
}
async function wikiTitle1(title: string) {
  const j = await wikiGet(`https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!j || j.type === "disambiguation") return null;
  // 동명 문서(예: 노트북 = 휴대용 컴퓨터) 오인 방지: 작품 문서로 보일 때만 채택
  if (!/드라마|영화|웹툰|소설|만화|애니메이션|텔레비전|시리즈|작품|게임/.test(`${j.description || ""} ${(j.extract || "").slice(0, 200)}`)) return "";
  return j.titles?.canonical || null;
}
async function wikiViews(art: string) {
  const end = new Date(Date.now() - 864e5), start = new Date(Date.now() - 14 * 864e5);
  const j = await wikiGet(`https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/ko.wikipedia/all-access/user/${encodeURIComponent(art)}/daily/${ymd(start)}/${ymd(end)}`);
  const it = (j?.items || []) as { views: number }[];
  if (!it.length) return null;
  const last = it.slice(-7).reduce((a, b) => a + b.views, 0), prev = it.slice(0, Math.max(0, it.length - 7)).reduce((a, b) => a + b.views, 0);
  return { last, prev };
}
// 네이버 데이터랩(NAVER API HUB). 키가 비밀값에 있을 때만. 값이 요청 안에서 상대값이라 고정 기준어 "드라마"로 환산
async function naverRatios(titles: string[]) {
  const id = Deno.env.get("NAVER_HUB_KEY_ID"), key = Deno.env.get("NAVER_HUB_KEY");
  const out: Record<string, number> = {};
  if (!id || !key) return null;
  const end = new Date(Date.now() - 864e5), start = new Date(Date.now() - 7 * 864e5);
  const f = (d: Date) => d.toISOString().slice(0, 10);
  for (let i = 0; i < titles.length; i += 4) {
    const grp = titles.slice(i, i + 4);
    const body = { startDate: f(start), endDate: f(end), timeUnit: "date", keywordGroups: [{ groupName: "__anchor", keywords: ["드라마"] }, ...grp.map((t) => ({ groupName: t, keywords: [t] }))] };
    try {
      const r = await fetch("https://naverapihub.apigw.ntruss.com/search-trend/v1/search", { method: "POST", headers: { "X-NCP-APIGW-API-KEY-ID": id, "X-NCP-APIGW-API-KEY": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const j = await r.json();
      const sum: Record<string, number> = {};
      for (const g of j.results || []) sum[g.title] = (g.data || []).reduce((a: number, b: { ratio: number }) => a + b.ratio, 0);
      const a = sum["__anchor"] || 0;
      if (a > 0) for (const t of grp) out[t] = Math.round(((sum[t] || 0) / a) * 1000) / 10;
    } catch { /* 다음 묶음 */ }
    await sleep(200);
  }
  return out;
}
// 기사 관련성 검사: 제목이 다른 단어의 일부로 들어간 기사(예: 게임 '도깨비의세계')와 맥락 없는 동음이의 기사를 걸러냄
const HANGUL = /[\uac00-\ud7a3]/;
const PARTICLE = /^(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서|처럼|까지|만|보다|이다|이자|측|팀)?($|[^\uac00-\ud7a3])/;
const CTXW = /드라마|영화|캐스팅|배우|출연|리메이크|웹툰|웹소설|원작|실사화|방영|시즌|OST|넷플릭스|티빙|웨이브|디즈니|쿠팡플레이|tvN|JTBC|KBS|MBC|SBS|ENA|개봉|촬영|주연|시청률|감독|작가/;
function relevant(title: string, work: string, names: string[]) {
  const h = title.replace(/\s+-\s+[^-]+$/, "");
  let ok = false, i = h.indexOf(work);
  while (i >= 0) {
    const before = i > 0 ? h[i - 1] : "", after = h.slice(i + work.length);
    if (!HANGUL.test(before) && PARTICLE.test(after)) { ok = true; break; }
    i = h.indexOf(work, i + 1);
  }
  if (!ok) return false;
  // 짧은 제목(도깨비, 노트북, 프렌즈처럼 일반 단어와 겹치기 쉬운 것)만 작품 맥락어나 배우, 배역 이름을 추가로 요구
  if (work.replace(/\s/g, "").length > 4) return true;
  return CTXW.test(h) || names.some((n) => n && n.length > 1 && h.includes(n));
}
const p95 = (xs: number[]) => { const v = xs.filter((x) => x > 0).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] : 0; };
async function tm(path: string, token: string) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  const h: Record<string, string> = { accept: "application/json" };
  if (token.length > 60) h.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}

Deno.serve(async (req) => {
  try { return await run(req); } catch (e) { return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 }); }
});
// 한 번에 모든 작품을 처리하면 워커 자원 한도를 넘어서 단계를 나눔
//  phase "collect": offset부터 limit개 작품의 기사, 위키, 네이버, 트렌드 신호를 모아 topics.buzz_raw에 저장
//  phase "score": 저장된 신호와 활동량(topic_activity)으로 정규화 점수를 매기고, 새 주제 후보 뉴스를 모음
async function run(req: Request) {
  let b: { phase?: string; offset?: number; limit?: number } = {};
  try { b = await req.json(); } catch { /* 빈 본문 */ }
  const phase = b.phase || "collect", off = b.offset || 0, lim = Math.min(b.limit || 6, 8);
  const all = await (await rest("topics?select=id,title,work,buzz_meta,buzz_raw&closed_at=is.null&order=id")).json();
  const list = (Array.isArray(all) ? all : []) as { id: string; title: string; work?: { tmdb_id?: number }; buzz_meta?: { wiki?: string }; buzz_raw?: Record<string, unknown> }[];
  if (phase === "collect") {
    const part = list.slice(off, off + lim);
    if (!part.length) return new Response(JSON.stringify({ phase, done: 0 }));
    const token = Deno.env.get("TMDB_TOKEN") || "";
    const trend = new Set<number>();
    if (token) for (const p of ["/trending/tv/week?language=ko-KR", "/trending/movie/week?language=ko-KR"]) {
      const d = await tm(p, token); (d?.results || []).forEach((x: { id: number }) => trend.add(x.id));
    }
    const rl = await (await rest(`roles?select=topic_id,ch,orig&topic_id=in.(${part.map((t) => encodeURIComponent(t.id)).join(",")})`)).json();
    const NM: Record<string, string[]> = {};
    for (const r of (Array.isArray(rl) ? rl : [])) (NM[r.topic_id] ||= []).push(...[r.orig, (r.ch || "").split(/[ (]/)[0]].filter(Boolean));
    const tr7 = await trendsKR();
    const nv = await naverRatios(part.map((t) => t.title));
    let done = 0;
    for (const t of part) {
      const raw = await news(`"${t.title}" ${CTX}`); await sleep(300);
      const items = raw ? raw.filter((x) => relevant(x.t, t.title, NM[t.id] || [])) : null;
      let wiki: string | null | undefined = t.buzz_meta?.wiki;
      if (!wiki) wiki = await wikiTitle(t.title);
      const wv = wiki ? await wikiViews(wiki) : null;
      const r = { n: items ? items.length : 0, news: (items || []).slice(0, 3), tr: !!(t.work?.tmdb_id && trend.has(t.work.tmdb_id)), tb: tr7.some((x) => x.includes(t.title)), wiki: wiki || null, wv, nav: nv ? (nv[t.title] ?? 0) : null, at: new Date().toISOString() };
      await rest(`topics?id=eq.${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ buzz_raw: r }) });
      done++;
    }
    return new Response(JSON.stringify({ phase, offset: off, done, total: list.length }), { headers: { "Content-Type": "application/json" } });
  }
  // score
  const actRows = await (await fetch(`${SB}/rest/v1/rpc/topic_activity`, { method: "POST", headers: { ...H, "Content-Type": "application/json" }, body: JSON.stringify({ days: 7 }) })).json();
  const act: Record<string, number> = {};
  for (const a of (Array.isArray(actRows) ? actRows : [])) act[a.topic_id] = +a.n || 0;
  type Raw = { n: number; news: { t: string }[]; tr: boolean; tb: boolean; wiki: string | null; wv: { last: number; prev: number } | null; nav: number | null };
  const rows = list.filter((t) => t.buzz_raw).map((t) => ({ t, r: t.buzz_raw as unknown as Raw, a: act[t.id] || 0 }));
  const P = {
    news: p95(rows.map((x) => Math.log1p(x.r.n))), act: p95(rows.map((x) => Math.log1p(x.a))),
    wiki: p95(rows.map((x) => Math.log1p(x.r.wv?.last || 0))), nav: p95(rows.map((x) => Math.log1p(x.r.nav || 0))),
  };
  const nz = (x: number, p: number) => (p > 0 ? Math.min(1, x / p) : 0);
  let done = 0;
  for (const { t, r, a } of rows) {
    const parts: [number, number][] = [[0.20, nz(Math.log1p(r.n), P.news)], [0.20, nz(Math.log1p(a), P.act)], [0.10, r.tr ? 1 : 0]];
    if (r.wv) parts.push([0.10, nz(Math.log1p(r.wv.last), P.wiki)]);
    if (r.nav !== null) parts.push([0.20, nz(Math.log1p(r.nav), P.nav)]);
    const wsum = parts.reduce((x, y) => x + y[0], 0);
    let base = parts.reduce((x, y) => x + y[0] * y[1], 0) / wsum;
    const mom = r.wv && r.wv.prev > 0 ? Math.max(-0.15, Math.min(0.15, (r.wv.last - r.wv.prev) / r.wv.prev * 0.15)) : 0;
    base = base * (1 + mom) + (r.tb ? 0.05 : 0);
    const score = Math.round(Math.min(1, base) * 1000) / 10;
    const meta = { n: r.n, trending: r.tr, act: a, wiki: r.wiki, wiki7: r.wv?.last ?? null, wikiPrev7: r.wv?.prev ?? null, naver: r.nav, gtrend: r.tb, mom: Math.round(mom * 1000) / 1000, news: r.news || [], v: 4 };
    await rest(`topics?id=eq.${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ buzz: score, buzz_at: new Date().toISOString(), buzz_meta: meta }) });
    done++;
  }
  const ideas: Record<string, unknown>[] = [];
  for (const q of ["실사화 확정", "드라마화 확정", "웹툰 원작 드라마 캐스팅", "웹소설 원작 드라마 캐스팅"]) {
    for (const it of (await news(q)) || []) if (it.u) ideas.push({ title: it.t, url: it.u.slice(0, 1000), source: it.s || null, published: it.d ? new Date(it.d).toISOString() : null });
    await sleep(300);
  }
  if (ideas.length) await rest("buzz_ideas?on_conflict=url", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(ideas.slice(0, 200)) });
  await rest("app_config?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k: "buzz_run", v: { last: new Date().toISOString() } }]) });
  return new Response(JSON.stringify({ phase, topics: done, ideas: ideas.length, top: rows.sort((x, y) => y.r.n - x.r.n).slice(0, 5).map((x) => [x.t.title, x.r.n]) }), { headers: { "Content-Type": "application/json" } });
}
