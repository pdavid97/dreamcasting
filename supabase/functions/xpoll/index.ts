// X 투표 결과 가져오기 Edge Function
// 유저가 연결한 X 게시물(x_polls)의 투표 선택지와 표 수를 X API v2로 읽어 저장
// 비밀값: X_BEARER_TOKEN (X 개발자 콘솔의 Bearer Token, David가 Supabase 대시보드에 직접 넣음). 없으면 status='nokey'로 남겨 두고 나중에 다시 시도
// 비용: X API 사용량 과금(게시물 읽기 1건당 과금). 20분에 한 번만 다시 읽고, 마감된 투표는 마지막 한 번만 읽음
// 요청: POST { id?: number }  id가 있으면 그 게시물만, 없으면 다시 읽을 차례인 게시물 최대 100개
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/];
const cors = (o: string | null) => ({ "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", Vary: "Origin" });
const j = (o: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
const norm = (s: string) => (s || "").replace(/\s*\(.*?\)\s*/g, "").replace(/[\s._-]/g, "").toLowerCase();
const match = (label: string, name: string) => { const a = norm(label), b = norm(name); return !!a && !!b && (a === b || a.includes(b) || b.includes(a)); };

type Row = { id: number; tweet_id: string; la: string; lb: string };

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  let one = 0;
  try { const b = await req.json(); one = Number(b.id) || 0; } catch { /* 전체 */ }
  const rows: Row[] = one
    ? await (await fetch(`${SB}/rest/v1/x_polls?select=id,tweet_id,la,lb&id=eq.${one}`, { headers: H })).json()
    : await (await fetch(`${SB}/rest/v1/rpc/x_poll_due`, { method: "POST", headers: H, body: JSON.stringify({ n: 100 }) })).json();
  if (!Array.isArray(rows) || !rows.length) return j({ n: 0 }, 200, h);
  const key = Deno.env.get("X_BEARER_TOKEN") || "";
  const save = (list: unknown[]) => fetch(`${SB}/rest/v1/rpc/x_poll_set`, { method: "POST", headers: H, body: JSON.stringify({ rows: list }) });
  if (!key) { await save(rows.map((r) => ({ id: r.id, status: "nokey" }))); return j({ n: rows.length, status: "nokey" }, 200, h); }
  const out: unknown[] = [];
  for (let i = 0; i < rows.length; i += 100) {
    const part = rows.slice(i, i + 100);
    const url = `https://api.x.com/2/tweets?ids=${part.map((r) => r.tweet_id).join(",")}&expansions=attachments.poll_ids&poll.fields=options,voting_status,end_datetime`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) { await save(part.map((x) => ({ id: x.id, status: r.status === 429 ? "new" : "error" }))); return j({ error: "x", status: r.status }, 502, h); }
    const d = await r.json();
    const polls = new Map<string, { options: { label: string; votes: number }[]; end_datetime?: string; voting_status?: string }>();
    for (const p of d.includes?.polls || []) polls.set(p.id, p);
    const byTweet = new Map<string, string>();
    for (const t of d.data || []) { const pid = t.attachments?.poll_ids?.[0]; if (pid) byTweet.set(t.id, pid); }
    for (const x of part) {
      const p = polls.get(byTweet.get(x.tweet_id) || "");
      if (!p) { out.push({ id: x.id, status: (d.data || []).some((t: { id: string }) => t.id === x.tweet_id) ? "nopoll" : "error" }); continue; }
      const oa = p.options.find((o) => match(o.label, x.la)), ob = p.options.find((o) => match(o.label, x.lb));
      const total = p.options.reduce((s, o) => s + (o.votes || 0), 0);
      out.push({ id: x.id, opts: p.options, va: oa ? oa.votes : 0, vb: ob ? ob.votes : 0, total, ends_at: p.end_datetime || "", status: oa && ob ? "ok" : "nomatch" });
    }
  }
  await save(out);
  return j({ n: out.length }, 200, h);
});
