// 게임, 애니 실사화 판 초안과 뉴스 감지
// POST { gender: true } : AniList에서 anime_char 성별과 인기(즐겨찾기 수)를 채움(키 없음, 분당 30회). 배역은 주연(MAIN) 중 인기 순
// POST { news: true }   : Google 뉴스 RSS(비상업 이용)에서 실사화, 캐스팅 기사 제목을 모아 DB의 게임, 애니 제목과 배우 이름을 찾아 news_hint에 저장
// POST { make: 3 }      : 뉴스 단서가 있는 작품부터, 그다음 인기 애니 순으로 판 초안을 만들어 승인 대기열에 올림
//   애니(일본 원작): 한국판 실사화(ip2live, 한국 배우 후보). 서구 게임: 할리우드판(k2us, 해외 배우 후보)
//   기사에 나온 배우는 후보로 먼저 넣고, 사실 문구는 기사 제목과 링크만 씀(추측 문구 없음). 원작 그림은 쓰지 않음
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CID = (Deno.env.get("TWITCH_CLIENT_ID") || "").trim(), CS = (Deno.env.get("TWITCH_CLIENT_SECRET") || "").trim();
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const UA = "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)";
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const get = async (p: string) => { const r = await fetch(`${SB}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(p + " " + await r.text()); return await r.json(); };
async function up(t: string, rows: unknown[], conflict = "", ret = false) {
  const r = await fetch(`${SB}/rest/v1/${t}${conflict ? "?on_conflict=" + conflict : ""}`, { method: "POST", headers: { ...H, Prefer: (conflict ? "resolution=merge-duplicates," : "") + (ret ? "return=representation" : "return=minimal") }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(t + " " + await r.text()); return ret ? await r.json() : null;
}
const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, "'").replace(/[^a-z0-9가-힣' ]+/g, " ").replace(/\s+/g, " ").trim();
const has = (hay: string, needle: string) => { const n = norm(needle); return n.length >= 4 && (" " + hay + " ").includes(" " + n + " "); };
const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
async function rss(q: string, ko: boolean) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&${ko ? "hl=ko&gl=KR&ceid=KR:ko" : "hl=en-US&gl=US&ceid=US:en"}`;
  const r = await fetch(u, { headers: { "User-Agent": UA } }); if (!r.ok) return [];
  const x = await r.text();
  return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => { const g = (t: string) => dec((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || ""); return { title: g("title").replace(/\s+-\s+[^-]+$/, ""), url: g("link"), source: g("source"), pub: g("pubDate") }; });
}
let tok = "";
async function igdb(ep: string, body: string) {
  if (!tok) { const t = await (await fetch(`https://id.twitch.tv/oauth2/token?` + new URLSearchParams({ client_id: CID, client_secret: CS, grant_type: "client_credentials" }), { method: "POST" })).json(); tok = t.access_token || ""; }
  await sleep(300);
  const r = await fetch(`https://api.igdb.com/v4/${ep}`, { method: "POST", headers: { "Client-ID": CID, Authorization: `Bearer ${tok}`, "Content-Type": "text/plain" }, body });
  return r.ok ? await r.json() : [];
}
const gslot = (g: string | null) => g === "Female" ? 1 : g === "Male" ? 2 : 0;

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({})) as { gender?: boolean; news?: boolean; make?: number; dry?: boolean };
  const out: Record<string, unknown> = {};
  try {
    if (b.gender) {
      const ids = (await get("anime_char?fav=is.null&select=char_id&limit=2000") as { char_id: number }[]).map((x) => x.char_id);
      let n = 0;
      for (let i = 0; i < ids.length; i += 50) {
        const q = `query($ids:[Int]){Page(perPage:50){characters(id_in:$ids){id gender favourites}}}`;
        const r = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": UA }, body: JSON.stringify({ query: q, variables: { ids: ids.slice(i, i + 50) } }) });
        if (r.status === 429) { await sleep(60000); i -= 50; continue; }
        const d = await r.json();
        for (const c of d?.data?.Page?.characters || []) { await fetch(`${SB}/rest/v1/anime_char?char_id=eq.${c.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ gender: c.gender || null, fav: c.favourites || 0 }) }); n++; }
        await sleep(2100);
      }
      out.gender = n;
    }
    if (b.news) {
      const items = [
        ...(await rss('"live-action" casting game', false)), ...(await rss('"live-action" adaptation cast anime', false)),
        ...(await rss('"video game" movie cast actor', false)), ...(await rss("실사화 캐스팅", true)), ...(await rss("실사판 주연 캐스팅", true)),
      ];
      const games = await get("game?select=id,name,franchise&rating_count=gt.300&limit=1000") as { id: number; name: string; franchise: string | null }[];
      const anime = await get("anime_media?select=id,romaji,english,native&limit=1000") as { id: number; romaji: string; english: string | null; native: string | null }[];
      const ppl = await get("people?select=name,name_en&name_en=not.is.null&limit=20000") as { name: string; name_en: string }[];
      const seen = new Set((await get("news_hint?select=url&limit=5000")).map((x: { url: string }) => x.url));
      const rows: unknown[] = [];
      for (const it of items) {
        if (!it.url || seen.has(it.url)) continue; seen.add(it.url);
        const h = norm(it.title);
        // 제목이 긴 작품을 먼저 맞춤(Red Dead Redemption 2가 Red Dead Redemption보다 먼저)
        const g = games.filter((x) => has(h, x.name) || (x.franchise && has(h, x.franchise))).sort((a, z) => z.name.length - a.name.length)[0];
        const a = anime.filter((x) => [x.english, x.romaji, x.native].some((t) => t && (t.length >= 4) && (has(h, t) || it.title.includes(t)))).sort((p, q) => (q.english || q.romaji).length - (p.english || p.romaji).length)[0];
        if (!g && !a) continue;
        const actors = ppl.filter((p) => has(h, p.name_en) || (/[가-힣]/.test(p.name) && p.name.length >= 2 && it.title.includes(p.name))).map((p) => p.name).slice(0, 4);
        rows.push({ url: it.url, title: it.title.slice(0, 200), source: it.source || null, published: it.pub ? new Date(it.pub).toISOString() : null,
          kind: g ? "game" : "anime", ref: String(g ? g.id : a!.id), ref_title: g ? (g.franchise && has(h, g.franchise) && !has(h, g.name) ? g.franchise : g.name) : (a!.english || a!.romaji), actors });
      }
      if (rows.length) await up("news_hint", rows, "url");
      out.news = { scanned: items.length, hints: rows.length, sample: rows.slice(0, 5) };
    }
    if (b.make) {
      const n = Math.min(5, Math.max(1, b.make));
      const ex = await get("topics?select=title,auto&limit=5000") as { title: string; auto: { key?: string } | null }[];
      const seenKey = new Set(ex.map((t) => t.auto?.key).filter(Boolean)), seenTitle = new Set(ex.map((t) => t.title));
      const hints = await get("news_hint?topic_id=is.null&order=published.desc.nullslast&limit=50") as { id: number; url: string; title: string; source: string | null; kind: string; ref: string; ref_title: string; actors: string[] }[];
      const pop = await get("anime_media?select=id&order=popularity.desc.nullslast&limit=80") as { id: number }[];
      const queue = [...hints.map((h) => ({ kind: h.kind, ref: h.ref, hint: h })), ...pop.map((p) => ({ kind: "anime", ref: String(p.id), hint: null as null | typeof hints[0] }))];
      const made: unknown[] = [], skip: string[] = [];
      for (const q of queue) {
        if (made.length >= n) break;
        const key = (q.kind === "game" ? "game:" : "anime:") + q.ref;
        if (seenKey.has(key)) continue;
        let title = "", info = "", src = "", cat = "", roles: { ch: string; slot: string; gender: number; seed?: string }[] = [];
        const hintActors = q.hint?.actors || [];
        if (q.kind === "anime") {
          const m = (await get(`anime_media?id=eq.${q.ref}&select=romaji,english,native,format`))[0]; if (!m) continue;
          const cs = await get(`anime_char?media_id=eq.${q.ref}&select=name,role,gender&order=role.asc,fav.desc.nullslast&limit=40`) as { name: string; role: string; gender: string | null }[];
          title = m.english || m.romaji; src = m.format === "MANGA" ? "만화" : "애니메이션"; cat = "ip2live"; info = `일본 ${src}`;
          const want = [["male_lead", 2, "MAIN"], ["female_lead", 1, "MAIN"], ["male_sub", 2, ""], ["female_sub", 1, ""]] as const;
          const used = new Set<string>();
          for (const [slot, g, role] of want) { const c = cs.find((x) => gslot(x.gender) === g && !used.has(x.name) && (!role || x.role === role)); if (c) { used.add(c.name); roles.push({ ch: c.name, slot, gender: g }); } }
        } else {
          const g = (await get(`game?id=eq.${q.ref}&select=name,franchise,year`))[0]; if (!g) continue;
          title = q.hint?.ref_title || g.name; src = "게임"; cat = "k2us"; info = `${g.year || ""}년 게임`.replace(/^년 /, "");
          // 기사 제목에 나온 캐릭터를 IGDB에서 확인, 없으면 시리즈 대표 캐릭터를 IGDB 검색으로
          const cands = await igdb("characters", `fields name,character_gender.name,games; where games = (${q.ref}); limit 500;`) as { name: string; character_gender?: { name: string } }[];
          const ht = norm(q.hint?.title || "");
          const named = cands.filter((c) => has(ht, c.name));
          for (const c of named.slice(0, 2)) { const gg = gslot(c.character_gender?.name || null); roles.push({ ch: c.name, slot: gg === 1 ? "female_lead" : "male_lead", gender: gg || 2, seed: hintActors[0] }); }
          if (!roles.length) { skip.push(title + ": 기사에 캐릭터 없음"); seenKey.add(key); continue; }
        }
        if (roles.length < 1 || !roles.some((r) => r.slot.endsWith("lead"))) { skip.push(title + ": 배역"); continue; }
        if (seenTitle.has(title)) { skip.push(title + ": 이미 있음"); continue; }
        const tid = (q.kind === "game" ? "aug" : "aua") + q.ref;
        const topic = { id: tid, cat, title, info, fact: q.hint ? `관련 기사: ${q.hint.title}` : "", user_made: false, tags: [src], src_medium: src, dst_medium: "영화",
          work: { kind: src, title, cast: [] }, work_at: "2099-01-01T00:00:00Z", opens_at: "2099-01-01T00:00:00Z", season: 1,
          auto: { status: "pending", key, src: q.hint ? "news" : "pop", news: q.hint ? { t: q.hint.title, u: q.hint.url, s: q.hint.source } : null, at: new Date().toISOString() } };
        if (b.dry) { made.push({ tid, title, cat, roles, actors: hintActors }); seenKey.add(key); continue; }
        await up("topics", [topic]);
        const rs = await up("roles", roles.map((r, pos) => ({ topic_id: tid, pos, ch: r.ch, orig: null, descr: "", stage: "dream", kind: "actor", slot: r.slot, gender: r.gender })), "", true) as { id: number; slot: string }[];
        // 기사에 나온 배우는 첫 배역 후보로 먼저 넣음
        if (hintActors.length) await up("candidates", hintActors.slice(0, 2).map((nm) => ({ role_id: rs[0].id, name: nm, kind: "actor", pick: "seed", in_set: true })));
        const rc = await fetch(`${SB}/functions/v1/recommend`, { method: "POST", headers: H, body: JSON.stringify({ tid, limit: 1 }) });
        if (q.hint) await fetch(`${SB}/rest/v1/news_hint?id=eq.${q.hint.id}`, { method: "PATCH", headers: H, body: JSON.stringify({ topic_id: tid }) });
        made.push({ tid, title, cat, roles: roles.length, rec: rc.status }); seenKey.add(key); seenTitle.add(title);
      }
      out.made = made; out.skip = skip.slice(0, 20);
    }
    return j(out);
  } catch (e) { return j({ error: String(e), ...out }, 502); }
});
