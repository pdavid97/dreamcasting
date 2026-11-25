// 위키백과 조회수 수집 (Wikimedia Pageviews API, 키 없음)
// POST { targets: true }  : pv_target_qids()의 인물에 대해 Wikidata에서 한국어, 영어 위키백과 문서 제목을 찾아 wiki_target에 저장(주 1회)
// POST { days: 7 }         : wiki_target 전체의 최근 일별 조회수를 pageviews에 저장(매일)
// 크론이 공개 anon 키로 호출. 누가 불러도 공개 위키백과 조회수만 저장하고, 이미 갱신된 날은 바로 끝나서 남용돼도 외부 호출이 늘지 않음
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)";
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
async function upsert(t: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await fetch(`${SB}/rest/v1/${t}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 1000)) });
    if (!r.ok) throw new Error(t + " " + (await r.text()));
  }
}
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({})) as { targets?: boolean; days?: number };
  if (b.targets) {
    const last = await (await fetch(`${SB}/rest/v1/wiki_target?select=updated_at&order=updated_at.desc&limit=1`, { headers: H })).json();
    if (last[0] && Date.now() - new Date(last[0].updated_at).getTime() < 6 * 864e5) return j({ skip: "recent" });
    const r = await fetch(`${SB}/rest/v1/rpc/pv_target_qids`, { method: "POST", headers: H, body: "{}" });
    const qs: string[] = (await r.json()).map((x: unknown) => typeof x === "string" ? x : Object.values(x as Record<string, string>)[0]);
    const out: unknown[] = [];
    for (let i = 0; i < qs.length; i += 300) {
      const vals = qs.slice(i, i + 300).map((q) => "wd:" + q).join(" ");
      const q = `SELECT ?p ?art WHERE { VALUES ?p {${vals}} ?art schema:about ?p; schema:isPartOf ?w. VALUES ?w {<https://ko.wikipedia.org/> <https://en.wikipedia.org/>} }`;
      const s = await fetch("https://query.wikidata.org/sparql", { method: "POST", headers: { "User-Agent": UA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ query: q, format: "json" }) });
      if (!s.ok) return j({ error: "wikidata " + s.status, done: out.length }, 502);
      for (const x of (await s.json()).results.bindings) {
        const u = x.art.value as string;
        out.push({ qid: (x.p.value as string).split("/").pop(), wiki: u.includes("//ko.") ? "ko" : "en", title: decodeURIComponent(u.split("/wiki/")[1]), kind: "person", updated_at: new Date().toISOString() });
      }
      if (i + 300 < qs.length) await new Promise((r) => setTimeout(r, 61000));
    }
    await upsert("wiki_target", "qid,wiki", out);
    return j({ qids: qs.length, targets: out.length });
  }
  const days = Math.min(30, Math.max(1, Number(b.days) || 7));
  const yd = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const t = await (await fetch(`${SB}/rest/v1/wiki_target?select=qid,wiki,title`, { headers: H })).json() as { qid: string; wiki: string; title: string }[];
  const cnt = Number((await fetch(`${SB}/rest/v1/pageviews?select=qid&day=eq.${yd}`, { headers: { ...H, Prefer: "count=exact", Range: "0-0" } })).headers.get("content-range")?.split("/")[1] || 0);
  if (cnt >= t.length * 0.9) return j({ skip: "done", day: yd, have: cnt });
  const end = new Date(Date.now() - 864e5), start = new Date(end.getTime() - (days - 1) * 864e5), rows: unknown[] = [];
  let fail = 0;
  for (let i = 0; i < t.length; i += 4) {
    await Promise.all(t.slice(i, i + 4).map(async (x) => {
      const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${x.wiki}.wikipedia/all-access/user/${encodeURIComponent(x.title.replace(/ /g, "_"))}/daily/${ymd(start)}/${ymd(end)}`;
      let r = await fetch(u, { headers: { "User-Agent": UA } });
      if (r.status === 429) { await new Promise((z) => setTimeout(z, 1500)); r = await fetch(u, { headers: { "User-Agent": UA } }); }
      if (!r.ok) { fail++; return; }
      for (const it of (await r.json()).items || []) rows.push({ qid: x.qid, wiki: x.wiki, day: `${it.timestamp.slice(0, 4)}-${it.timestamp.slice(4, 6)}-${it.timestamp.slice(6, 8)}`, views: it.views });
    }));
  }
  await upsert("pageviews", "qid,wiki,day", rows);
  return j({ targets: t.length, rows: rows.length, fail });
});
