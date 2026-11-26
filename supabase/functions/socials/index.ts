// 배우 공식 인스타그램 계정 수집 Edge Function
// Wikidata P2003(Instagram username)을 TMDB 인물 id(P4985) 또는 Wikidata id로 찾아 people.ig에 저장
// 요청: POST { n?: 150 }  아직 확인하지 않은 인물(ig_at is null)부터 n명씩 처리. 쓰기는 service role로 이 함수 안에서만
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const IG = /^[A-Za-z0-9._]{1,30}$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return j({ error: "method" }, 405);
  let n = 150;
  try { const b = await req.json(); n = Math.max(20, Math.min(500, Number(b.n) || 150)); } catch { /* 기본값 */ }
  const pr = await fetch(`${SB}/rest/v1/rpc/people_ig_todo`, { method: "POST", headers: H, body: JSON.stringify({ n }) });
  if (!pr.ok) return j({ error: "db" }, 500);
  const P: { id: number; tmdb_id: number | null; qid: string | null }[] = await pr.json();
  if (!P.length) return j({ done: true, n: 0 });
  const tids = P.filter((p) => p.tmdb_id).map((p) => `"${p.tmdb_id}"`).join(" ");
  const qids = P.filter((p) => p.qid && /^Q\d+$/.test(p.qid)).map((p) => `wd:${p.qid}`).join(" ");
  const sp = async (q: string) => {
    const r = await fetch("https://query.wikidata.org/sparql", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/sparql-results+json", "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)" }, body: "query=" + encodeURIComponent(q) });
    if (!r.ok) throw new Error("wikidata " + r.status);
    return (await r.json()).results.bindings as Record<string, { value: string }>[];
  };
  const byT = new Map<string, string>(), byQ = new Map<string, string>();
  try {
    if (tids) for (const r of await sp(`SELECT ?tid ?ig WHERE { VALUES ?tid { ${tids} } ?item wdt:P4985 ?tid ; wdt:P2003 ?ig . }`)) if (IG.test(r.ig.value) && !byT.has(r.tid.value)) byT.set(r.tid.value, r.ig.value);
    if (qids) for (const r of await sp(`SELECT ?item ?ig WHERE { VALUES ?item { ${qids} } ?item wdt:P2003 ?ig . }`)) { const q2 = r.item.value.split("/").pop()!; if (IG.test(r.ig.value) && !byQ.has(q2)) byQ.set(q2, r.ig.value); }
  } catch (e) { return j({ error: String(e) }, 502); }
  const rows = P.map((p) => ({ id: p.id, ig: (p.tmdb_id && byT.get(String(p.tmdb_id))) || (p.qid && byQ.get(p.qid)) || null }));
  const up = await fetch(`${SB}/rest/v1/rpc/people_set_ig`, { method: "POST", headers: H, body: JSON.stringify({ rows }) });
  if (!up.ok) return j({ error: "save", detail: await up.text() }, 500);
  return j({ n: P.length, found: rows.filter((r) => r.ig).length });
});
