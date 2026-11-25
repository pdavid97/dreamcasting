// 판 자동 생성(초안): 화제작과 해외 인기작에서 캐스팅 판 초안을 만들어 승인 대기열(topics.auto.status=pending)에 올림
// POST { n: 5 } : 최대 n개 초안 생성. 한국 작품은 할리우드판(k2us), 미국과 영국 작품은 한국판(us2k)
// 배역: 원작 출연 순서대로 남녀 주연, 조연 최대 4개(이름 있는 배역만). 후보는 recommend 함수가 채움
// 초안은 opens_at을 먼 미래로 두어 공개되지 않음. 운영자가 admin.html에서 승인하면 공개
import { rr } from "./rr.ts";
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
const get = async (p: string) => { const r = await fetch(`${SB}/rest/v1/${p}`, { headers: H }); if (!r.ok) throw new Error(p + " " + await r.text()); return await r.json(); };
const post = async (t: string, rows: unknown[], ret = false) => {
  const r = await fetch(`${SB}/rest/v1/${t}`, { method: "POST", headers: { ...H, Prefer: ret ? "return=representation" : "return=minimal" }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(t + " " + await r.text()); return ret ? await r.json() : null;
};
const NO_GENRE = /리얼리티|토크|뉴스|다큐|애니메이션|키즈|Reality|Talk|News|Documentary|Animation|Kids/i;
const NO_CH = /^(self|himself|herself|themselves|본인|narrator|내레이터|voice|목소리)\b|\(voice\)|uncredited/i;
const CTRY: Record<string, string> = { US: "미국", GB: "영국", KR: "한국" };
type W = { key: string; title: string; title_en: string; year: number; lang: string; countries: string[]; genres: string[]; pop: number; poster: string | null; grp: string[] };
type C = { name: string; character: string; ord: number; gender: number };

Deno.serve(async (req) => {
  const b = await req.json().catch(() => ({})) as { n?: number; dry?: boolean };
  const n = Math.min(10, Math.max(1, Number(b.n) || 5));
  try {
    // 이미 있는 판(초안, 반려 포함)은 건너뜀
    const ex = await get("topics?select=title,auto,work->>tmdb_id&limit=5000") as { title: string; auto: { key?: string } | null; tmdb_id: string | null }[];
    const seenKey = new Set(ex.map((t) => t.auto?.key).filter(Boolean)), seenId = new Set(ex.map((t) => t.tmdb_id).filter(Boolean)), seenTitle = new Set(ex.map((t) => t.title));
    // 후보 작품: 화제 점수 순(buzz_cards), 그다음 해외 인기작 인기순
    const buzz = await (await fetch(`${SB}/rest/v1/rpc/buzz_cards`, { method: "POST", headers: H, body: JSON.stringify({ n: 30 }) })).json() as { key: string; kr: number | null; gl: number | null; tt: number | null }[];
    const sig = new Map(buzz.map((x) => [x.key, { kr: x.kr, gl: x.gl, tt: x.tt }]));
    const pop = await get("ip_work?select=key&grp=ov.{us_tv,netflix_tv,ott_tv,us_film}&order=pop.desc.nullslast&limit=200") as { key: string }[];
    const keys = [...new Set([...buzz.map((x) => x.key), ...pop.map((x) => x.key)])].filter((k) => !seenKey.has(k) && !seenId.has(k.split(":")[1]));
    const made: unknown[] = [], skip: string[] = [];
    for (let i = 0; i < keys.length && made.length < n; i += 40) {
      const part = keys.slice(i, i + 40);
      const ws = await get(`ip_work?select=key,title,title_en,year,lang,countries,genres,pop,poster,grp&key=in.(${encodeURIComponent(part.map((k) => `"${k}"`).join(","))})`) as W[];
      const byKey = new Map(ws.map((w) => [w.key, w]));
      for (const key of part) {
        if (made.length >= n) break;
        const w = byKey.get(key); if (!w || seenTitle.has(w.title)) continue;
        const kr = w.lang === "ko" && (w.countries || []).includes("KR"), us = w.lang === "en" && (w.countries || []).some((c) => c === "US" || c === "GB");
        if (!kr && !us) { skip.push(w.title + ": 국가"); continue; }
        if ((w.genres || []).some((g) => NO_GENRE.test(g))) { skip.push(w.title + ": 장르"); continue; }
        const cast = await get(`ip_cast?select=name,character,ord,gender&key=eq.${encodeURIComponent(key)}&order=ord.asc&limit=20`) as C[];
        const roles: { ch: string; orig: string; slot: string; gender: number }[] = [];
        const want = [["male_lead", 2], ["female_lead", 1], ["male_sub", 2], ["female_sub", 1]] as const;
        const used = new Set<string>();
        for (const [slot, g] of want) {
          // 한국 작품은 로마자 배역명을 한글로 바꿀 수 있는 이름 있는 배역만 씀
          const nm = (x: C) => { const ch = x.character.split("/")[0].replace(/\s*\(.*?\)\s*/g, "").trim(); return kr ? rr(ch) : ch.slice(0, 40); };
          const c = cast.find((x) => x.gender === g && x.character && !NO_CH.test(x.character) && !used.has(x.name) && x.ord <= 12 && nm(x));
          if (c) { used.add(c.name); roles.push({ ch: nm(c)!, orig: c.name, slot, gender: g }); }
        }
        if (roles.filter((r) => r.slot.endsWith("lead")).length < 1 || roles.length < 2) { skip.push(w.title + ": 배역"); continue; }
        const [m, id] = key.split(":");
        const medium = m === "tv" ? "드라마" : "영화";
        const tid = "au" + m[0] + id;
        const cat = kr ? "k2us" : "us2k";
        const ctry = kr ? "한국" : CTRY[(w.countries || []).find((c) => c === "US" || c === "GB") || "US"];
        const topic = {
          id: tid, cat, title: w.title, info: `${w.year}년 ${ctry} ${medium}`, fact: "", user_made: false,
          tags: (w.genres || []).slice(0, 3), src_medium: medium, dst_medium: medium,
          work: { tmdb_id: Number(id), kind: medium, title: w.title, original: w.title_en, year: String(w.year || ""), genres: w.genres || [],
            poster: w.poster ? "https://image.tmdb.org/t/p/w342" + w.poster : "", tmdb: `https://www.themoviedb.org/${m}/${id}`, cast: roles.map((r) => ({ ch: r.ch, name: r.orig })) },
          work_at: "2099-01-01T00:00:00Z", // 작품 정보를 이미 채웠으므로 제목 검색으로 덮어쓰지 않게 함
          opens_at: "2099-01-01T00:00:00Z", season: 1,
          auto: { status: "pending", key, src: sig.has(key) ? "buzz" : "pop", signal: sig.get(key) || null, at: new Date().toISOString() },
        };
        if (b.dry) { made.push({ tid, title: w.title, cat, roles }); seenTitle.add(w.title); continue; }
        await post("topics", [topic]);
        await post("roles", roles.map((r, pos) => ({ topic_id: tid, pos, ch: r.ch, orig: r.orig, descr: "", stage: "dream", kind: "actor", slot: r.slot, gender: r.gender })));
        const rc = await fetch(`${SB}/functions/v1/recommend`, { method: "POST", headers: H, body: JSON.stringify({ tid, limit: 1 }) });
        const cnt = await get(`candidates?select=role_id,roles!candidates_role_id_fkey!inner(topic_id)&roles.topic_id=eq.${tid}`) as unknown[];
        made.push({ tid, title: w.title, cat, roles: roles.length, cands: cnt.length, rec: rc.status });
        seenTitle.add(w.title);
      }
    }
    return j({ made, skip: skip.slice(0, 30) });
  } catch (e) { return j({ error: String(e) }, 502); }
});
