// 작품 지표 수집 Edge Function (pg_cron이 하루 1회 호출, 20시간 안에 다시 부르면 건너뜀)
// 수집: TMDB 인기도/평점/평가 수(작품별 하루 1점), Netflix Top 10 공개 데이터(주간 시청 수, 시청 시간, 순위), Wikidata 작품 수상
// 저장: work_metrics(topic_id, day, source, metric, value), work_awards
// 출처: Netflix Top 10은 넷플릭스가 공개하는 주간 데이터(top10.netflix.com), 시청률(닐슨 등)은 공개 API가 없어 유저 제보 + 운영자 승인으로만 받음
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const NF = "https://www.netflix.com/tudum/top10/data/all-weeks-global.tsv";
const today = () => new Date().toISOString().slice(0, 10);
const rest = async (path: string, init: RequestInit = {}) => fetch(`${SB}/rest/v1/${path}`, { ...init, headers: { ...H, ...(init.headers || {}) } });

async function tm(path: string, params: Record<string, string>, token: string) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (token.length > 60) h.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}
async function wdAwards(qid: string) {
  const q = `SELECT ?awLabel ?t WHERE { wd:${qid} p:P166 ?s. ?s ps:P166 ?aw. OPTIONAL { ?s pq:P585 ?t } SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". } } LIMIT 60`;
  try {
    const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: { accept: "application/sparql-results+json", "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)" } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results?.bindings || []).map((b: Record<string, { value: string }>) => ({ name: b.awLabel?.value || "", year: b.t?.value ? b.t.value.slice(0, 4) : "" })).filter((x: { name: string }) => x.name && !/^Q\d+$/.test(x.name));
  } catch { return []; }
}
const norm = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9가-힣]/g, "");

Deno.serve(async (req) => {
  let force = false;
  try { force = !!(await req.json()).force; } catch { /* 빈 본문 */ }
  const cfg = await (await rest("app_config?select=v&k=eq.metrics_run")).json();
  const last = cfg[0]?.v?.last;
  if (!force && last && Date.now() - Date.parse(last) < 20 * 3600e3) return new Response(JSON.stringify({ skipped: true, last }), { headers: { "Content-Type": "application/json" } });
  await rest("app_config?k=eq.metrics_run", { method: "PATCH", body: JSON.stringify({ v: { last: new Date().toISOString() } }) });
  const token = Deno.env.get("TMDB_TOKEN") || "";
  if (!token) return new Response(JSON.stringify({ error: "no TMDB_TOKEN" }), { status: 503 });

  // 작품 정보가 아직 없는 주제는 meta 함수로 먼저 채움
  let topics = await (await rest("topics?select=id,title,work,work_at")).json();
  for (const t of topics.filter((x: { work_at: string | null }) => !x.work_at).slice(0, 20)) {
    await fetch(`${SB}/functions/v1/meta`, { method: "POST", headers: H, body: JSON.stringify({ topic: t.id }) }).catch(() => {});
  }
  topics = (await (await rest("topics?select=id,title,work")).json()).filter((t: { work: { tmdb_id?: number } | null }) => t.work && t.work.tmdb_id);

  const rows: Record<string, unknown>[] = [], awards: Record<string, unknown>[] = [], day = today();
  const enTitle: Record<string, string> = {};
  for (const t of topics) {
    const kind = t.work.kind === "영화" ? "movie" : "tv";
    const d = await tm(`/${kind}/${t.work.tmdb_id}`, { language: "en-US", append_to_response: "external_ids" }, token);
    if (!d) continue;
    enTitle[t.id] = d.name || d.title || "";
    const url = `https://www.themoviedb.org/${kind}/${t.work.tmdb_id}`;
    rows.push({ topic_id: t.id, day, source: "tmdb", metric: "popularity", value: d.popularity || 0, src_url: url });
    rows.push({ topic_id: t.id, day, source: "tmdb", metric: "rating", value: d.vote_average || 0, src_url: url });
    rows.push({ topic_id: t.id, day, source: "tmdb", metric: "votes", value: d.vote_count || 0, src_url: url });
    const qid = d.external_ids?.wikidata_id;
    if (qid && /^Q\d+$/.test(qid)) for (const a of await wdAwards(qid)) awards.push({ topic_id: t.id, name: a.name.slice(0, 120), year: a.year, src: `https://www.wikidata.org/wiki/${qid}` });
  }

  // Netflix Top 10 (글로벌 주간). 영어 제목으로 맞춤
  let nfRows = 0;
  try {
    const r = await fetch(NF);
    if (r.ok) {
      const lines = (await r.text()).split("\n");
      const head = lines[0].split("\t");
      const ix = (k: string) => head.indexOf(k);
      const byTitle = new Map<string, string[]>();
      for (const t of topics) { const k = norm(enTitle[t.id]); if (k) (byTitle.get(k) || byTitle.set(k, []).get(k)!).push(t.id); }
      for (const ln of lines.slice(1)) {
        const c = ln.split("\t"); if (c.length < head.length) continue;
        const ids = byTitle.get(norm(c[ix("show_title")])); if (!ids) continue;
        const wk = c[ix("week")], season = c[ix("season_title")] || "", meta = { season, category: c[ix("category")] };
        for (const id of ids) {
          const add = (m: string, v: string) => { if (v && v !== "N/A" && !isNaN(+v)) { rows.push({ topic_id: id, day: wk, source: "netflix", metric: m, value: +v, meta, src_url: "https://www.netflix.com/tudum/top10" }); nfRows++; } };
          add("weekly_rank", c[ix("weekly_rank")]); add("weekly_views", c[ix("weekly_views")]); add("weekly_hours", c[ix("weekly_hours_viewed")]); add("weeks_in_top10", c[ix("cumulative_weeks_in_top_10")]);
        }
      }
    }
  } catch { /* 넷플릭스 파일을 못 받아도 나머지는 저장 */ }

  // 같은 키(작품, 날짜, 출처, 지표)가 여럿이면 마지막 값만(시즌이 여러 개인 주간 등)
  const uniq = new Map<string, Record<string, unknown>>();
  for (const x of rows) uniq.set(`${x.topic_id}|${x.day}|${x.source}|${x.metric}`, x);
  const list = [...uniq.values()].map((x) => ({ meta: null, ...x }));
  for (let i = 0; i < list.length; i += 500) {
    await rest("work_metrics?on_conflict=topic_id,day,source,metric", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(list.slice(i, i + 500)) });
  }
  if (awards.length) await rest("work_awards?on_conflict=topic_id,name,year", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(awards) });
  return new Response(JSON.stringify({ topics: topics.length, metrics: list.length, netflix: nfRows, awards: awards.length }), { headers: { "Content-Type": "application/json" } });
});
