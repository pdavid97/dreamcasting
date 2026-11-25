// 화제작 신호 수집
// POST { netflix: true } : 넷플릭스 공식 주간 Top 10 TSV(전세계 전체 기간, 국가별은 한국, 미국, 일본)를 nf_top10에 저장하고 제목을 TMDB 작품으로 연결(nf_title). 새 주차가 없으면 바로 끝남
// POST { tvmaze: true, days: 3 } : TVmaze 스트리밍 방영 일정(CC BY-SA 4.0)을 날짜별로 tvm_web에 저장하고 작품을 IMDb/TVDB 번호로 TMDB에 연결
// 공개 데이터만 저장. 크론이 공개 anon 키로 호출
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TK = (Deno.env.get("TMDB_TOKEN") || "").trim();
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const UA = "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)";
const NF = "https://www.netflix.com/tudum/top10/data/";
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const get = async (p: string) => await (await fetch(`${SB}/rest/v1/${p}`, { headers: H })).json();
async function upsert(t: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await fetch(`${SB}/rest/v1/${t}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 1000)) });
    if (!r.ok) throw new Error(t + " " + (await r.text()));
  }
}
async function tmdb(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3/" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TK.length > 60) h.Authorization = "Bearer " + TK; else u.searchParams.set("api_key", TK);
  const r = await fetch(u, { headers: h }); return r.ok ? await r.json() : null;
}
const num = (s: string) => (s && s !== "N/A" ? Math.round(+s) || null : null);
async function tsv(name: string, keep?: (l: string) => boolean) {
  const r = await fetch(NF + name, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("netflix " + r.status);
  const lines = (await r.text()).split("\n"); const head = lines.shift()!.split("\t");
  return lines.filter((l) => l && (!keep || keep(l))).map((l) => { const c = l.split("\t"); return Object.fromEntries(head.map((h, i) => [h.trim(), (c[i] || "").trim()])); });
}

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({})) as { netflix?: boolean; tvmaze?: boolean; days?: number };
  const out: Record<string, unknown> = {};
  try {
    if (b.netflix) {
      const last = (await get("nf_top10?scope=eq.global&select=week&order=week.desc&limit=1"))[0]?.week || "2000-01-01";
      const g = await tsv("all-weeks-global.tsv");
      const newest = g.reduce((m, x) => (x.week > m ? x.week : m), "");
      if (newest > last) {
        await upsert("nf_top10", "week,scope,category,rank", g.filter((x) => x.week > last).map((x) => ({ week: x.week, scope: "global", category: x.category, rank: +x.weekly_rank, title: x.show_title, season: x.season_title === "N/A" ? null : x.season_title, views: num(x.weekly_views), hours: num(x.weekly_hours_viewed), weeks: +x.cumulative_weeks_in_top_10 || null })));
        const c = await tsv("all-weeks-countries.tsv", (l) => /\t(KR|US|JP)\t/.test(l) && l.split("\t")[2] > last);
        await upsert("nf_top10", "week,scope,category,rank", c.filter((x) => x.week > last && ["KR", "US", "JP"].includes(x.country_iso2)).map((x) => ({ week: x.week, scope: x.country_iso2, category: x.category, rank: +x.weekly_rank, title: x.show_title, season: x.season_title === "N/A" ? null : x.season_title, views: null, hours: null, weeks: +x.cumulative_weeks_in_top_10 || null })));
        out.nf_new_from = last; out.nf_newest = newest;
      } else out.nf = "no new week";
      // 제목 연결: 아직 확인 안 한 제목을 최근 주차부터 최대 250개
      const recent = await get(`nf_top10?select=title,category&order=week.desc&limit=20000`) as { title: string; category: string }[];
      const seen = new Set((await get("nf_title?select=title,kind&limit=50000")).map((x: { title: string; kind: string }) => x.title + "|" + x.kind));
      const todo: { title: string; kind: string }[] = [];
      for (const r of recent) { const kind = r.category.startsWith("Films") ? "movie" : "tv", k = r.title + "|" + kind; if (!seen.has(k)) { seen.add(k); todo.push({ title: r.title, kind }); } if (todo.length >= 250) break; }
      const rows: unknown[] = [];
      for (let i = 0; i < todo.length; i += 8) {
        await Promise.all(todo.slice(i, i + 8).map(async ({ title, kind }) => {
          const d = await tmdb(`search/${kind}`, { query: title, language: "en-US" });
          const x = (d?.results || [])[0];
          rows.push({ title, kind, key: x ? `${kind}:${x.id}` : null, checked_at: new Date().toISOString() });
        }));
      }
      await upsert("nf_title", "title,kind", rows); out.nf_mapped = rows.length;
    }
    if (b.tvmaze) {
      const days = Math.min(30, Math.max(1, Number(b.days) || 3)); let eps = 0;
      for (let d = 1; d <= days; d++) {
        const day = new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
        if ((await get(`tvm_web?day=eq.${day}&select=show_id&limit=1`)).length) continue;
        const r = await fetch(`https://api.tvmaze.com/schedule/web?date=${day}`, { headers: { "User-Agent": UA } });
        if (!r.ok) continue;
        const cnt = new Map<number, number>(), shows = new Map<number, unknown>();
        for (const e of await r.json()) {
          const s = e._embedded?.show; if (!s) continue;
          cnt.set(s.id, (cnt.get(s.id) || 0) + 1);
          const ch = s.webChannel || s.network;
          shows.set(s.id, { show_id: s.id, name: s.name, channel: ch?.name || null, country: ch?.country?.code || null, imdb: s.externals?.imdb || null, tvdb: s.externals?.thetvdb || null });
        }
        await upsert("tvm_show", "show_id", [...shows.values()]);
        await upsert("tvm_web", "day,show_id", [...cnt].map(([show_id, n]) => ({ day, show_id, eps: n })));
        eps += cnt.size; await new Promise((z) => setTimeout(z, 600));
      }
      // TMDB 연결: 아직 확인 안 한 작품 최대 200개
      const todo = await get("tvm_show?checked_at=is.null&or=(imdb.not.is.null,tvdb.not.is.null)&select=show_id,imdb,tvdb&limit=200") as { show_id: number; imdb: string | null; tvdb: number | null }[];
      const rows: unknown[] = [];
      for (let i = 0; i < todo.length; i += 8) {
        await Promise.all(todo.slice(i, i + 8).map(async (s) => {
          const d = s.imdb ? await tmdb(`find/${s.imdb}`, { external_source: "imdb_id" }) : await tmdb(`find/${s.tvdb}`, { external_source: "tvdb_id" });
          const x = d?.tv_results?.[0];
          rows.push({ show_id: s.show_id, key: x ? `tv:${x.id}` : null, checked_at: new Date().toISOString() });
        }));
      }
      for (const r of rows as { show_id: number; key: string | null; checked_at: string }[]) await fetch(`${SB}/rest/v1/tvm_show?show_id=eq.${r.show_id}`, { method: "PATCH", headers: H, body: JSON.stringify({ key: r.key, checked_at: r.checked_at }) });
      out.tvm_shows = eps; out.tvm_mapped = rows.length;
    }
    return j(out);
  } catch (e) { return j({ error: String(e), ...out }, 502); }
});
