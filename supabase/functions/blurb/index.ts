// 후보 소개 Edge Function v3: 선발 이유(pick_why)를 첫 줄로, 근거를 둘째 줄로.
// (v2 설명) "왜 하필 이 배우인가"를 근거 있는 이유로 찾아 위트 있게 쓴다.
// 이유 후보(우선순위 순). 실제 데이터에서 확인된 것만 쓰고, 없으면 쓰지 않는다.
//  talk   : 원작 배우와 후보가 함께 제목에 나오고 추천, 극찬, 후계자 같은 말이 들어간 기사(출처 링크 포함)
//  same   : 원작 작품에 이미 출연(같은 배역이면 "다른 시절을 나눠 연기")
//  buzz   : 후보 이름과 작품명이 함께 나온 가상캐스팅, 실사화, 캐스팅 기사(최근 1년, 건수와 대표 기사 링크)
//  alike  : 다른 작품에서 비슷한 배역(기사, 황제, 형사, 저승사자 같은 직업과 신분 키워드가 배역명에 들어간 출연작)
//  costar : 원작 배우와 같은 작품에 출연한 적 있음
//  age    : 원작 배우가 그 역을 맡았을 때 나이와 비교
//  famous : 대표작
// 결과: candidates.blurb = {recent:{t,y}, up:{t,y}, why, reasons:[{k,text,src?:{t,u}}], pid}
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}
const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
async function news(q: string) {
  const u = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 dreamcasting" } });
    if (!r.ok) return [];
    const x = await r.text();
    return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
      const g = (t: string) => dec((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "");
      return { t: g("title").replace(/\s+-\s+[^-]+$/, "").slice(0, 120), u: g("link") };
    });
  } catch { return []; }
}

// 조사
const lastc = (w: string) => w.trim().slice(-1).charCodeAt(0);
const isH = (c: number) => c >= 0xac00 && c <= 0xd7a3;
const jong = (w: string) => { const c = lastc(w); return isH(c) ? (c - 0xac00) % 28 !== 0 : false; };
const iga = (w: string) => w + (jong(w) ? "이" : "가");
const eunneun = (w: string) => w + (jong(w) ? "은" : "는");
const eulreul = (w: string) => w + (jong(w) ? "을" : "를");
const gwawa = (w: string) => w + (jong(w) ? "과" : "와");
const ro = (w: string) => { const c = lastc(w); if (!isH(c)) return "로"; const j = (c - 0xac00) % 28; return j === 0 || j === 8 ? "로" : "으로"; };
const T = (t: string) => `《${t}》`;
const pick = <X,>(arr: X[], seed: number) => arr[Math.abs(seed) % arr.length];
const today = new Date().toISOString().slice(0, 10);
const NOT_ACTING = new Set([10767, 10763, 10764, 99, 10402]);
const SELF = /self|himself|herself|본인|자기 자신|host|narrator|voice/i;

type Credit = { id: number; media_type?: string; title?: string; name?: string; release_date?: string; first_air_date?: string; character?: string; genre_ids?: number[]; vote_count?: number };
const ctitle = (c: Credit) => c.title || c.name || "";
const cdate = (c: Credit) => c.release_date || c.first_air_date || "";
type P = { id: number; birthday: string | null; credits: Credit[] };
const PCACHE: Record<string, P | null> = {};
async function person(name: string): Promise<P | null> {
  if (name in PCACHE) return PCACHE[name];
  let id: number | null = null;
  const ppl = await (await rest(`cast_pool?select=tmdb_id&name=eq.${encodeURIComponent(name)}&tmdb_id=not.is.null&limit=1`)).json();
  if (Array.isArray(ppl) && ppl[0]?.tmdb_id) id = ppl[0].tmdb_id;
  if (!id) {
    const s = await tm("/search/person", { query: name, language: "ko-KR" });
    const hit = (s?.results || []).find((x: { known_for_department?: string }) => x.known_for_department === "Acting") || (s?.results || [])[0];
    id = hit?.id || null;
  }
  if (!id) return (PCACHE[name] = null);
  const d = await tm(`/person/${id}`, { language: "ko-KR", append_to_response: "combined_credits" });
  if (!d) return (PCACHE[name] = null);
  const credits = ((d.combined_credits?.cast || []) as Credit[]).filter((c) => ctitle(c) && !SELF.test(c.character || "") && !(c.genre_ids || []).some((g) => NOT_ACTING.has(g)));
  return (PCACHE[name] = { id, birthday: d.birthday || null, credits });
}
const ageAt = (b: string | null, y: number) => (b ? y - +b.slice(0, 4) : null);
const GENRES: Record<number, string> = {};
async function loadGenres() { for (const k of ["movie", "tv"]) { const g = await tm(`/genre/${k}/list`, { language: "ko" }); for (const x of g?.genres || []) GENRES[x.id] = x.name; } }

// 직업과 신분 키워드: 배역 이름과 설명에서 찾고, 후보의 다른 출연작 배역명에서 같은 계열을 찾는다
const ARCH: [string, RegExp, string][] = [
  ["기사", /기사|knight|paladin/i, "칼 찬 기사"], ["황제", /황제|황태자|emperor/i, "황제"], ["황후", /황후|왕비|empress|queen/i, "왕관"],
  ["왕", /세자|대군|임금|king/i, "곤룡포"], ["왕자", /왕자|prince/i, "왕자님"], ["공주", /공주|princess/i, "공주님"],
  ["형사", /형사|경위|경감|경찰|detective|cop/i, "형사"], ["검사", /검사|prosecutor/i, "검사"], ["변호사", /변호사|lawyer|attorney/i, "변호사"],
  ["의사", /의사|외과|전공의|doctor|dr\./i, "의사 가운"], ["재벌", /재벌|회장|본부장|상무|전무|후계자|ceo|heir/i, "재벌 n세"],
  ["도깨비", /도깨비|goblin/i, "인간이 아닌 존재"], ["저승사자", /저승사자|사신|grim reaper|reaper/i, "저승사자"],
  ["군인", /군인|대위|중위|소령|병장|장교|특전사|soldier|captain|lieutenant|sergeant/i, "군복"], ["헌터", /헌터|hunter/i, "헌터"],
  ["킬러", /킬러|암살|assassin|killer|hitman/i, "킬러"], ["요원", /요원|스파이|국정원|agent|spy/i, "요원"],
  ["교사", /교사|선생|교수|teacher|professor/i, "선생님"], ["아이돌", /아이돌|가수|밴드|idol|singer/i, "무대 위 아이돌"],
  ["셰프", /셰프|요리사|chef/i, "셰프"], ["작가", /작가|writer|novelist/i, "작가"], ["무사", /무사|검객|무림|검수|swordsman|samurai/i, "칼잡이"],
  ["뱀파이어", /뱀파이어|흡혈|vampire/i, "뱀파이어"], ["마법사", /마법사|마탑|wizard|mage|witch/i, "마법사"],
];
// 제목 경계 검사: "구기동프렌즈"처럼 다른 말에 붙은 경우는 제외
const PART = /^(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서|처럼|까지|만|보다)?($|[^\uac00-\ud7a3])/;
function hasWord(h: string, w: string) { let i = h.indexOf(w); while (i >= 0) { const b = i > 0 ? h[i - 1] : ""; if (!/[\uac00-\ud7a3]/.test(b) && PART.test(h.slice(i + w.length))) return true; i = h.indexOf(w, i + 1); } return false; }
// 회차마다 출연진이 다른 단막극, 옴니버스, 시상식, 쇼는 같은 작품 출연으로 치지 않음
const ANTH = /스페셜|단막|베스트극장|드라마시티|로 앤 오더|Law & Order|SNL|시상식|어워즈|Awards|투어|콘서트|Saturday Night|Tour|Concert|Package|Live in/i;
const archOf = (text: string) => ARCH.filter(([, re]) => re.test(text));

type Reason = { k: string; text: string; src?: { t: string; u: string }; w: number };

async function reasonsFor(o: { others: { name: string; ch: string; slot: string | null }[]; slot: string | null; cid: number; name: string; ch: string; descr: string; orig: string | null; title: string; workId: number | null; workYear: number | null; workGenres: string[]; p: P; op: P | null }) {
  const { name, ch, orig, title, p, op, cid } = o;
  const R: Reason[] = [];
  const past = p.credits.filter((c) => cdate(c) && cdate(c) <= today);
  const ch0 = ch.split(" ")[0];

  // 원작 배우의 추천, 극찬 기사
  if (orig) {
    const items = await news(`"${orig}" "${name}"`);
    const hit = items.find((x) => hasWord(x.t, orig) && hasWord(x.t, name) && /추천|극찬|후계자|러브콜|칭찬|닮은꼴|롤모델/.test(x.t));
    if (hit) R.push({ k: "talk", w: 100, src: { t: hit.t, u: hit.u }, text: pick([`원작의 ${gwawa(orig)} 한 기사 제목에 나란히 오른 사이예요. 무슨 얘기였는지는 출처에서 확인해 보세요.`, `${gwawa(orig)} ${name}, 기사 제목에서 이미 한 번 만났어요. 바통 터치 각?`], cid) });
    await sleep(250);
  }
  // 원작 작품에 이미 출연
  if (o.workId) {
    const c = past.find((x) => x.id === o.workId);
    if (c) {
      const same = !!(c.character && ch0 && c.character.includes(ch0));
      R.push({ k: "same", w: 95, text: same ? `원작 ${T(title)}에서 ${ch0}의 다른 시절을 이미 연기했어요. 이번엔 통째로 맡겨볼 차례.` : `원작 ${T(title)}에 ${c.character && /[\uac00-\ud7a3]/.test(c.character) ? `${c.character} 역으로 ` : ""}이미 출연했어요. 세트장 가는 길은 안 헤매겠네요.` });
    }
  }
  // 같은 작품의 다른 배역 후보와 이미 호흡을 맞춘 작품(커플, 라이벌 조합 미리보기)
  {
    const mine = new Map(past.map((c) => [`${c.media_type}:${c.id}`, c]));
    const found: { ot: { name: string; ch: string; slot: string | null }; both: Credit; couple: boolean }[] = [];
    for (const ot of o.others) {
      const q = await person(ot.name); if (!q) continue;
      const both = q.credits.map((c) => mine.get(`${c.media_type}:${c.id}`)).filter((c): c is Credit => !!c && c.id !== o.workId && !ANTH.test(ctitle(c))).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0];
      if (!both) continue;
      const couple = (o.slot === "male_lead" && ot.slot === "female_lead") || (o.slot === "female_lead" && ot.slot === "male_lead");
      found.push({ ot, both, couple });
    }
    found.sort((a, b) => Number(b.couple) - Number(a.couple) || (b.both.vote_count || 0) - (a.both.vote_count || 0));
    const f = found[0];
    if (f) {
      const oc = f.ot.ch.split(" ")[0];
      R.push({ k: "pair", w: f.couple ? 90 : 72, text: f.couple
        ? pick([`${oc} 후보 ${gwawa(f.ot.name)} ${T(ctitle(f.both))}에서 이미 호흡을 맞춘 사이. 둘 다 뽑으면 케미는 검증된 셈이에요.`, `${T(ctitle(f.both))} 이후 ${gwawa(f.ot.name)} 재회하는 그림, 상상만 해도 시청률 그래프가 올라가요.`], cid)
        : pick([`${oc} 후보 ${gwawa(f.ot.name)} ${T(ctitle(f.both))}에서 함께 출연했어요. 촬영장 분위기는 미리 보장.`, `${T(ctitle(f.both))}에서 ${gwawa(f.ot.name)} 만난 적 있는 사이. 같은 판에서 다시 만나면 반가울 듯해요.`], cid) });
    }
  }
  // 원작 배우와 같은 작품
  if (op && orig) {
    const ids = new Set(op.credits.map((c) => `${c.media_type}:${c.id}`));
    const co = past.filter((c) => ids.has(`${c.media_type}:${c.id}`) && c.id !== o.workId && !ANTH.test(ctitle(c))).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0];
    if (co) R.push({ k: "costar", w: 60, text: pick([`${T(ctitle(co))}에서 ${gwawa(orig)} 한솥밥을 먹은 사이. 선배 배역 물려받기 딱 좋은 인연이에요.`, `${eunneun(orig)} ${T(ctitle(co))}에서 이미 만나본 상대. 인수인계가 빠를 듯해요.`], cid) });
  }
  // 나이
  const age = ageAt(p.birthday, new Date().getFullYear());
  const origAge = op && o.workYear ? ageAt(op.birthday, o.workYear) : null;
  // 배우 나이는 어떤 형태로도 문구에 넣지 않음(2026-11-25 운영 원칙)
  void age; void origAge;
  // 대표작
  const famous = [...past].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0];
  if (famous) R.push({ k: "famous", w: 20, text: pick([`${T(ctitle(famous))}${ro(ctitle(famous))} 얼굴 도장은 이미 꾹. 이번엔 ${ch0} 차례?`, `${T(ctitle(famous))}의 그 얼굴이 ${iga(ch0)} 된다면?`], cid) });
  R.sort((a, b) => b.w - a.w);
  const seen = new Set<string>();
  return R.filter((r) => (seen.has(r.k) ? false : (seen.add(r.k), true))).slice(0, 3).map(({ k, text, src }) => (src ? { k, text, src } : { k, text }));
}

Deno.serve(async (req) => {
  try {
    let body: { limit?: number; force?: boolean; ids?: number[] } = {};
    try { body = await req.json(); } catch { /* 빈 본문 */ }
    if (!TOKEN) return new Response(JSON.stringify({ error: "TMDB_TOKEN 없음" }), { status: 500 });
    const lim = Math.min(40, body.limit || 25);
    let q = "candidates?select=id,name,pitch,pick,pick_why,pick_src,role_id,roles!candidates_role_id_fkey!inner(ch,orig,descr,slot,topic_id,topics!inner(title,work,closed_at))&roles.topics.closed_at=is.null&in_set=is.true&order=id&limit=" + lim;
    if (body.ids?.length) q += `&id=in.(${body.ids.map(Number).join(",")})`;
    else if (!body.force) q += `&or=(blurb.is.null,blurb_at.is.null,blurb_at.lt.${new Date(Date.now() - 14 * 864e5).toISOString()})`;
    const rows = await (await rest(q)).json();
    if (!Array.isArray(rows)) return new Response(JSON.stringify({ error: rows }), { status: 500 });
    await loadGenres();
    const tids = [...new Set(rows.map((r) => r.roles?.topic_id))].filter(Boolean);
    const oth = tids.length ? await (await rest(`candidates?select=id,name,role_id,roles!candidates_role_id_fkey!inner(ch,slot,topic_id)&in_set=is.true&roles.topic_id=in.(${tids.map((x) => `"${x}"`).join(",")})`)).json() : [];
    const out: unknown[] = [];
    for (const r of rows) {
      const role = r.roles, tp = role?.topics || {}, work = tp.work || {};
      const p = r.pick === "wild" ? null : await person(r.name);
      const op = role?.orig ? await person(role.orig) : null;
      const wy = work.year ? +String(work.year).slice(0, 4) : null;
      const ch = String(role?.ch || "").replace(/\s*\(.*\)$/, "");
      let reasons: { k: string; text: string; src?: { t: string; u: string } }[] = [];
      let recent = null, up = null;
      if (p) {
        const others = (Array.isArray(oth) ? oth : []).filter((x) => x.roles?.topic_id === role?.topic_id && x.role_id !== r.role_id).map((x) => ({ name: x.name, ch: x.roles.ch || "", slot: x.roles.slot || null }));
        reasons = await reasonsFor({ others, slot: role?.slot || null, cid: r.id, name: r.name, ch, descr: role?.descr || "", orig: role?.orig || null, title: tp.title || "", workId: work.tmdb_id || null, workYear: wy, workGenres: work.genres || [], p, op });
        const past = p.credits.filter((c) => cdate(c) && cdate(c) <= today).sort((a, b) => cdate(b).localeCompare(cdate(a)));
        const fut = p.credits.filter((c) => cdate(c) > today).sort((a, b) => cdate(a).localeCompare(cdate(b)));
        if (past[0]) recent = { t: ctitle(past[0]), y: +cdate(past[0]).slice(0, 4) };
        if (fut[0]) up = { t: ctitle(fut[0]), y: +cdate(fut[0]).slice(0, 4) };
      }
      if (r.pick_why) {
        const pw = String(r.pick_why);
        const titles = [...pw.matchAll(/《([^》]+)》/g)].map((m) => m[1]);
        const rest2 = r.pick === "wild" ? [] : reasons.filter((x) => !titles.some((t) => x.text.includes(t)) && !(x.k === "genre" && pw.includes("장르")) && !(x.k === "age" && pw.includes("살")) && !(x.k === "pair" && r.pick === "chem"));
        reasons = [{ k: r.pick || "pick", text: pw, ...(r.pick_src ? { src: r.pick_src } : {}) }, ...rest2].slice(0, 2);
      }
      if (r.pitch) reasons = [{ k: "pitch", text: `제안자 한마디: "${String(r.pitch).slice(0, 80)}"` }, ...reasons].slice(0, 2);
      reasons = reasons.slice(0, 2);
      if (!reasons.length) reasons = [{ k: "base", text: role?.orig ? `${iga(role.orig)} 남긴 큰 신발, ${r.name}에게도 맞을지 신겨볼까요?` : "원작 팬들이 머릿속으로 먼저 캐스팅한 이름이에요." }];
      const blurb = { recent, up, why: reasons[0].text, reasons, pid: p?.id || null };
      await rest(`candidates?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ blurb, blurb_at: new Date().toISOString() }) });
      out.push([r.name, reasons.map((x) => x.k).join("+"), reasons.map((x) => x.text).join(" / "), reasons.find((x) => x.src)?.src?.t || null]);
    }
    return new Response(JSON.stringify({ done: rows.length, sample: out }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 }); }
});
