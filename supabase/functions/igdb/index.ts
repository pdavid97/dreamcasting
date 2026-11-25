// IGDB 수집 (비밀값 TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, 초당 4회 한도)
// POST { ping: true }  : 토큰 발급과 1회 조회 확인
// POST { link: true }  : ip_work의 game_live 작품마다 원작 게임을 찾아 game, game_link에 저장(이미 연결된 작품은 건너뜀)
// POST { chars: true } : 연결된 게임과 인기 게임(평가 수 상위)의 캐릭터를 game_char에 저장
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CID = (Deno.env.get("TWITCH_CLIENT_ID") || "").trim(), CS = (Deno.env.get("TWITCH_CLIENT_SECRET") || "").trim();
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let tok = "";
async function token() {
  const r = await fetch(`https://id.twitch.tv/oauth2/token?` + new URLSearchParams({ client_id: CID, client_secret: CS, grant_type: "client_credentials" }), { method: "POST" });
  const t = await r.json(); if (!t.access_token) throw new Error("twitch token " + r.status + " " + (t.message || "")); tok = t.access_token;
}
async function q(ep: string, body: string) {
  await sleep(280);
  let r = await fetch(`https://api.igdb.com/v4/${ep}`, { method: "POST", headers: { "Client-ID": CID, Authorization: `Bearer ${tok}`, "Content-Type": "text/plain" }, body });
  if (r.status === 429) { await sleep(1500); r = await fetch(`https://api.igdb.com/v4/${ep}`, { method: "POST", headers: { "Client-ID": CID, Authorization: `Bearer ${tok}`, "Content-Type": "text/plain" }, body }); }
  if (!r.ok) throw new Error(`igdb ${ep} ${r.status} ${await r.text()}`);
  return await r.json();
}
async function upsert(t: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/${t}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(t + " " + (await r.text()));
  }
}
const GF = "fields name,slug,url,first_release_date,total_rating_count,franchises.name;";
const gameRow = (g: Record<string, any>) => ({ id: g.id, name: g.name, slug: g.slug || null, url: g.url || null, year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null, rating_count: g.total_rating_count || 0, franchise: g.franchises?.[0]?.name || null, updated_at: new Date().toISOString() });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

Deno.serve(async (req) => {
  if (!CID || !CS) return j({ error: "TWITCH 비밀값 없음" }, 500);
  const b = await req.json().catch(() => ({})) as { ping?: boolean; link?: boolean; chars?: boolean; top?: number };
  try {
    await token();
    if (b.ping) { const g = await q("games", `${GF} search "The Last of Us"; limit 1;`); return j({ ok: true, sample: g[0]?.name }); }
    const out: Record<string, unknown> = {};
    if (b.link) {
      const works = await (await fetch(`${SB}/rest/v1/ip_work?grp=cs.{game_live}&select=key,title_en,year`, { headers: H })).json() as { key: string; title_en: string; year: number }[];
      const done = new Set((await (await fetch(`${SB}/rest/v1/game_link?select=work_key`, { headers: H })).json()).map((x: { work_key: string }) => x.work_key));
      let linked = 0, miss: string[] = [];
      for (const w of works) {
        if (done.has(w.key) || !w.title_en) continue;
        const base = w.title_en.replace(/\s*[:\-].*$/, "").replace(/\s+(\d+|II|III|IV)$/i, "").replace(/^(A|The)\s+|\s+Movie$/gi, "").trim();
        const gs = await q("games", `${GF} search "${base.replace(/"/g, "")}"; where game_type = (0,8,9,10) & total_rating_count > 5; limit 10;`) as Record<string, any>[];
        const nb = norm(base);
        const c = gs.filter((g) => (!w.year || !g.first_release_date || new Date(g.first_release_date * 1000).getUTCFullYear() <= w.year) && (norm(g.name).includes(nb) || nb.includes(norm(g.name)) || norm(g.franchises?.[0]?.name || "").includes(nb)))
          .sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0));
        if (!c.length) { miss.push(w.title_en); continue; }
        const top = c.slice(0, 3);
        await upsert("game", "id", top.map(gameRow));
        await upsert("game_link", "work_key,game_id", top.map((g, i) => ({ work_key: w.key, game_id: g.id, score: i === 0 ? 1 : 0.5 })));
        linked++;
      }
      out.works = works.length; out.linked = linked; out.miss = miss;
    }
    if (b.chars) {
      const top = Math.min(500, b.top ?? 300);
      const pop = await q("games", `${GF} where total_rating_count > 200 & game_type = (0,8,9,10); sort total_rating_count desc; limit ${top};`) as Record<string, any>[];
      await upsert("game", "id", pop.map(gameRow));
      const ids = [...new Set([...pop.map((g) => g.id), ...(await (await fetch(`${SB}/rest/v1/game_link?select=game_id`, { headers: H })).json()).map((x: { game_id: number }) => x.game_id)])];
      let n = 0;
      for (let i = 0; i < ids.length; i += 10) {
        const part = ids.slice(i, i + 10);
        for (let off = 0; off < 2000; off += 500) {
          const cs = await q("characters", `fields name,slug,url,games,mug_shot.image_id,character_gender.name; where games = (${part.join(",")}); limit 500; offset ${off};`) as Record<string, any>[];
          const rows = cs.map((c) => ({ id: c.id, game_id: (c.games || []).find((g: number) => part.includes(g)) ?? null, name: c.name, gender: c.character_gender?.name || null, slug: c.slug || null, url: c.url || null, mug: c.mug_shot?.image_id || null, updated_at: new Date().toISOString() })).filter((r) => r.name);
          await upsert("game_char", "id", rows); n += rows.length;
          if (cs.length < 500) break;
        }
      }
      out.games = ids.length; out.chars = n;
    }
    return j(out);
  } catch (e) { return j({ error: String(e) }, 502); }
});
