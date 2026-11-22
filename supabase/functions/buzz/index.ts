// 화제성 계산 Edge Function (pg_cron 하루 1회, 20시간 안에 다시 부르면 건너뜀)
// 점수 = 최근 7일 뉴스 기사 수(Google News RSS) + TMDB 이번 주 인기 순위 진입 + 광장 활동(7일 이벤트 수)
// 결과: topics.buzz, buzz_at, buzz_meta({news:[{t,u,s,d}], n, trending, act})
// 덤: "실사화, 드라마화, 캐스팅" 최근 7일 기사 제목을 buzz_ideas에 모아 운영자가 새 주제로 검토
// SNS(X, 인스타그램)는 무료 공개 API가 없어 포함하지 않음
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
    const items = [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const g = (t: string) => dec((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "");
      return { t: g("title").slice(0, 140), u: g("link"), s: g("source"), d: g("pubDate") };
    });
    return items;
  } catch { return null; }
}
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
async function run(req: Request) {
  let force = false;
  try { force = !!(await req.json()).force; } catch { /* 빈 본문 */ }
  const cfg = await (await rest("app_config?select=v&k=eq.buzz_run")).json();
  const last = Array.isArray(cfg) ? cfg[0]?.v?.last : null;
  if (!force && last && Date.now() - Date.parse(last) < 20 * 3600e3) return new Response(JSON.stringify({ skipped: true, last }));
  await rest("app_config?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k: "buzz_run", v: { last: new Date().toISOString() } }]) });

  const token = Deno.env.get("TMDB_TOKEN") || "";
  const trend = new Set<number>();
  if (token) for (const p of ["/trending/tv/week?language=ko-KR", "/trending/movie/week?language=ko-KR"]) {
    const d = await tm(p, token); (d?.results || []).forEach((x: { id: number }) => trend.add(x.id));
  }
  const topics = await (await rest("topics?select=id,title,work&closed_at=is.null")).json();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const ev = await (await rest(`events?select=topic_id&created_at=gte.${since}&topic_id=not.is.null&limit=50000`)).json();
  const act: Record<string, number> = {};
  for (const e of (Array.isArray(ev) ? ev : [])) act[e.topic_id] = (act[e.topic_id] || 0) + 1;

  let done = 0;
  for (const t of (Array.isArray(topics) ? topics : [])) {
    const items = await news(`"${t.title}"`);
    const n = items ? items.length : 0;
    const tr = !!(t.work?.tmdb_id && trend.has(t.work.tmdb_id));
    const a = act[t.id] || 0;
    const score = Math.round((Math.log1p(n) * 10 + (tr ? 15 : 0) + Math.log1p(a) * 5) * 10) / 10;
    await rest(`topics?id=eq.${encodeURIComponent(t.id)}`, { method: "PATCH", body: JSON.stringify({ buzz: score, buzz_at: new Date().toISOString(), buzz_meta: { n, trending: tr, act: a, news: (items || []).slice(0, 3) } }) });
    done++;
    await new Promise((r) => setTimeout(r, 300));
  }

  // 새 주제 후보: 실사화, 드라마화 소식
  const ideas: Record<string, unknown>[] = [];
  for (const q of ["실사화 확정", "드라마화 확정", "웹툰 원작 드라마 캐스팅", "웹소설 원작 드라마 캐스팅"]) {
    for (const it of (await news(q)) || []) if (it.u) ideas.push({ title: it.t, url: it.u.slice(0, 1000), source: it.s || null, published: it.d ? new Date(it.d).toISOString() : null });
  }
  if (ideas.length) await rest("buzz_ideas?on_conflict=url", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(ideas.slice(0, 200)) });
  return new Response(JSON.stringify({ topics: done, trending: trend.size, ideas: ideas.length }), { headers: { "Content-Type": "application/json" } });
}
