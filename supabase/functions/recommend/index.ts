// 배역별 후보 6명 자동 선발 Edge Function
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
  for (let i = 0; i < 3; i++) { const r = await fetch(u, { headers: h }); if (r.status === 429) { await sleep(800 * (i + 1)); continue; } return r.ok ? await r.json() : null; }
  return null;
}
const dec = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
async function news(q: string) {
  try {
    const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`, { headers: { "User-Agent": "Mozilla/5.0 dreamcasting" } });
    if (!r.ok) return [];
    const x = await r.text();
    return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => { const g = (t: string) => dec((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || ""); return { t: g("title").replace(/\s+-\s+[^-]+$/, ""), u: g("link") }; });
  } catch { return []; }
}
const lastc = (w: string) => w.trim().slice(-1).charCodeAt(0);
const isH = (c: number) => c >= 0xac00 && c <= 0xd7a3;
const jong = (w: string) => { const c = lastc(w); return isH(c) ? (c - 0xac00) % 28 !== 0 : false; };
const gwawa = (w: string) => w + (jong(w) ? "과" : "와");
const iga = (w: string) => w + (jong(w) ? "이" : "가");
const T = (t: string) => `《${t}》`;
const pick = <X,>(a: X[], s: number) => a[Math.abs(s) % a.length];
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
const PART = /^(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서|처럼|까지|만|보다)?($|[^가-힣])/;
function hasWord(h: string, w: string) { let i = h.indexOf(w); while (i >= 0) { const b = i > 0 ? h[i - 1] : ""; if (!/[가-힣]/.test(b) && PART.test(h.slice(i + w.length))) return true; i = h.indexOf(w, i + 1); } return false; }
const ARCH: [string, RegExp][] = [
  ["기사", /기사|knight/i], ["황제", /황제|황태자|emperor/i], ["황후", /황후|왕비|empress|queen/i], ["왕자", /왕자|prince/i], ["공주", /공주|princess/i],
  ["형사", /형사|경찰|detective|cop/i], ["검사", /검사|prosecutor/i], ["변호사", /변호사|lawyer/i], ["의사", /의사|외과|doctor/i],
  ["재벌", /재벌|회장|본부장|후계자|ceo|heir/i], ["도깨비", /도깨비|goblin/i], ["저승사자", /저승사자|사신|reaper/i], ["군인", /군인|대위|중위|장교|soldier|captain/i],
  ["헌터", /헌터|hunter/i], ["킬러", /킬러|암살|assassin|killer/i], ["요원", /요원|스파이|agent|spy/i], ["교사", /교사|선생|teacher/i], ["아이돌", /아이돌|idol|가수|singer/i],
  ["셰프", /셰프|요리사|chef/i], ["무사", /무사|검객|무림|swordsman/i], ["마법사", /마법사|wizard|mage|witch/i], ["뱀파이어", /뱀파이어|vampire/i],
];
const KIND_KO: Record<string, string> = { comedian: "개그맨", singer: "가수", idol: "아이돌", musical: "뮤지컬 배우", stage: "연극 배우", youtuber: "유튜버", influencer: "방송인" };
const KIND_LINE: Record<string, string[]> = {
  comedian: ["웃음 타이밍은 이미 검증 완료. 진지한 장면에서 반전 매력이 터질지도?", "개그로 단련된 순발력, 대본 밖 애드리브가 기대되는 카드예요."],
  singer: ["OST는 본인이 부르면 되겠네요. 노래로 감정선 잡는 건 이미 프로.", "무대 위 존재감을 화면으로 옮기면 어떨까요?"],
  idol: ["팬덤 화력은 이미 준비 완료. 연기돌 데뷔작이 이 작품이 된다면?", "칼군무로 다진 체력, 액션 신도 문제없을 듯해요."],
  musical: ["뮤지컬 무대에서 다진 발성과 몰입, 카메라 앞에서도 통할까요?", "커튼콜에 익숙한 사람, 엔딩 신 장악력은 보장."],
  stage: ["연극 무대에서 다진 내공, 한 컷 롱테이크에 강한 타입이에요.", "대학로가 먼저 알아본 얼굴, 이제 화면 차례?"],
  youtuber: ["구독자들이 먼저 시청률을 보장해 줄 카드예요.", "카메라 앞이 이미 일상인 사람, 연기 데뷔각?"],
  influencer: ["화면 장악력은 방송으로 이미 증명. 연기 변신 한 번 볼까요?", "예능에서 보여준 캐릭터, 드라마에서 다시 보고 싶다면 이 사람."],
};

type Pool = { pob?: string | null; src?: string; id: number; tmdb_id: number | null; name: string; kind: string; region: string; gender: number; birth: string | null; pop: number; acted: boolean; known: { t: string; y: string | null; ch: string | null }[] | null };
let POOL: Pool[] = [];
async function loadPool() {
  const all: Pool[] = [];
  for (let off = 0; ; off += 1000) {
    const r = await (await rest(`cast_pool?select=id,tmdb_id,name,kind,region,gender,birth,pop,acted,known,pob,src&order=id&offset=${off}&limit=1000`)).json();
    if (!Array.isArray(r) || !r.length) break; all.push(...r); if (r.length < 1000) break;
  }
  const EN = /USA|U\.S\.|United States|California|New York|Texas|Florida|Illinois|Georgia|Ohio|Pennsylvania|Washington|Massachusetts|New Jersey|Michigan|UK|England|London|Scotland|Wales|Ireland|Canada|Ontario|Quebec|British Columbia|Australia|New Zealand/i;
  POOL = all.filter((p) => p.region !== "intl" || p.src === "wikidata_us" || EN.test(p.pob || ""));
  ACTORS = new Set(all.filter((p) => p.kind === "actor").map((p) => p.name));
}
let ACTORS = new Set<string>();
const ageNow = (b: string | null) => (b ? new Date().getFullYear() - +b.slice(0, 4) : null);
type Cred = { id: number; media_type: string; title?: string; name?: string; character?: string; genre_ids?: number[]; vote_count?: number; release_date?: string; first_air_date?: string };
const CREDS = new Map<number, Cred[]>();
async function creds(tid: number) {
  if (CREDS.has(tid)) return CREDS.get(tid)!;
  const d = await tm(`/person/${tid}/combined_credits`, { language: "ko-KR" });
  const c = ((d?.cast || []) as Cred[]).filter((x) => (x.title || x.name) && !(x.genre_ids || []).some((g) => [10767, 10763, 10764, 99, 10402].includes(g)) && !/self|himself|herself|본인/i.test(x.character || ""));
  CREDS.set(tid, c); return c;
}
const ct = (c: Cred) => c.title || c.name || "";
let GENRES: Record<number, string> = {};
async function loadGenres() { for (const k of ["movie", "tv"]) { const g = await tm(`/genre/${k}/list`, { language: "ko" }); for (const x of g?.genres || []) GENRES[x.id] = x.name; } }
const STOP = new Set(["주연", "조연", "배우", "가수", "감독", "작가", "제작", "주인공", "원작"]);
const ANTH = /스페셜|단막|베스트극장|드라마시티|로 앤 오더|Law & Order|SNL|시상식|어워즈|Awards|투어|콘서트|Tour|Concert|Package|Live in/i;

async function findPerson(name: string): Promise<Pool | null> {
  const hit = POOL.find((p) => p.name === name);
  if (hit) return hit;
  const s = await tm("/search/person", { query: name, language: "ko-KR" });
  const p = (s?.results || []).find((x: { known_for_department?: string }) => x.known_for_department === "Acting");
  if (!p) return null;
  const d = await tm(`/person/${p.id}`, { language: "ko-KR" });
  return { id: 0, tmdb_id: p.id, name, kind: "actor", region: "kr", gender: p.gender || 0, birth: d?.birthday || null, pop: p.popularity || 0, acted: true, known: null };
}

type Pick = { pool: Pool; pick: string; why: string; src?: { t: string; u: string } };

async function chooseForRole(o: { role: Record<string, any>; topic: Record<string, any>; partnerTop: Pool | null; usedWild: Set<number>; seedNames: Set<string>; usedTopic: Set<string>; origs: Set<string>; usage: Map<string, number> }) {
  const { role, topic } = o;
  const work = topic.work || {};
  // 국적권: 할리우드판은 영미권(intl), 중국판 cn, 대만판 tw, 홍콩판 hk, 나머지는 한국(kr)
  const region = ({ k2us: "intl", k2cn: "cn", k2tw: "tw", k2hk: "hk" } as Record<string, string>)[topic.cat] || "kr";
  const slot: string = role.slot || "";
  const orig = role.orig ? await findPerson(role.orig) : null;
  let gender = (role.gender as number) || (slot.startsWith("male") ? 2 : slot.startsWith("female") ? 1 : (orig?.gender || 0));
  if (!gender) { // 성별 정보가 없는 배역(주연, 조연)은 기존 후보들의 성별 다수결로 추정
    const g = [...o.seedNames].map((n) => POOL.find((p) => p.name === n)?.gender || 0).filter((x) => x);
    const m = g.filter((x) => x === 2).length, f = g.filter((x) => x === 1).length;
    gender = m > f ? 2 : f > m ? 1 : 0;
  }
  // 한번 정한 배역 성별은 저장해 다음 실행에서 후보군 쏠림으로 뒤집히지 않게 함
  if (gender && !role.gender && role.id) await rest(`roles?id=eq.${role.id}`, { method: "PATCH", body: JSON.stringify({ gender }), headers: { "Content-Type": "application/json", Prefer: "return=minimal" } });
  const wy = work.year ? +String(work.year).slice(0, 4) : null;
  const origAge = orig?.birth && wy ? wy - +orig.birth.slice(0, 4) : null;
  const target = Math.max(slot.includes("lead") ? 22 : 20, origAge ?? (slot.includes("sub") || slot === "support" ? 32 : 29));
  const ch = String(role.ch || "").replace(/\s*\(.*\)$/, "").split(" ")[0];
  const arch = ARCH.filter(([, re]) => re.test(`${role.ch} ${role.descr || ""}`));
  const genres: string[] = (work.genres || []).filter((g: string) => g !== "드라마");
  const exclude = new Set<string>([role.orig || "", ...o.origs, ...((work.cast || []) as { name: string }[]).map((c) => c.name)]);
  const picks: Pick[] = [];
  const okName = (n: string) => region === "kr" ? /^[가-힣]{2,5}$/.test(n) : /[가-힣]/.test(n) && !/[()]/.test(n);
  const ok = (p: Pool) => !exclude.has(p.name) && (!orig?.tmdb_id || p.tmdb_id !== orig.tmdb_id) && !o.usedTopic.has(p.name) && !picks.some((x) => x.pool.name === p.name) && p.region === region && (!gender || p.gender === gender);
  const use = (n: string) => o.usage.get(n) || 0;
  const maxPop = Math.max(1, ...POOL.filter((p) => p.kind === "actor" && p.region === region).map((p) => p.pop));

  const base = POOL.filter((p) => p.kind === "actor" && p.region === region && p.tmdb_id && okName(p.name) && ok(p)).map((p) => {
    const a = ageNow(p.birth); const gap = a == null ? 8 : Math.abs(a - target);
    const s = 0.5 * Math.log1p(p.pop) / Math.log1p(maxPop) + 0.35 * Math.max(0, 1 - gap / 10) + (o.seedNames.has(p.name) ? 0.15 : 0) - 0.12 * use(p.name);
    return { p, s, a };
  }).filter((x) => x.a == null || Math.abs(x.a - target) <= 9).sort((a, b) => b.s - a.s).slice(0, 14);
  const scored: { p: Pool; s: number; why: string }[] = [];
  for (const b of base) {
    const all = await creds(b.p.tmdb_id!);
    if (work.tmdb_id && all.some((c) => c.id === work.tmdb_id)) continue; // 원작 출연자는 후보에서 제외
    const cs = all.filter((c) => !ANTH.test(ct(c)));
    let s = b.s, why = "";
    for (const [kw, re] of arch) { const c = cs.filter((x) => x.character && re.test(x.character)).sort((a, z) => (z.vote_count || 0) - (a.vote_count || 0))[0]; if (c) { s += 0.35; why = pick([`${T(ct(c))}에서 ${c.character} 역을 맡았던 ${kw} 경력자. 이 배역은 사실상 경력직 채용이에요.`, `${kw} 역은 ${T(ct(c))}에서 이미 해봤어요. 이력서 한 줄이면 서류 통과.`], hash(b.p.name)); break; } }
    if (genres.length) { const n = cs.filter((c) => (c.genre_ids || []).some((g) => genres.includes(GENRES[g]))).length; if (n >= 3) s += Math.min(0.2, n * 0.02); }
    const a = b.a;
    if (!why && a != null && origAge != null && role.orig) why = Math.abs(a - origAge) <= 3 ? `${role.orig}${jong(role.orig) ? "이" : "가"} ${ch} 역을 맡았을 때 ${origAge}살, 지금 ${a}살. 나이 궁합부터 합격이에요.` : (a < origAge ? `원작 ${role.orig}${jong(role.orig) ? "이" : "가"} 연기할 때보다 ${origAge - a}살 어려요. 더 젊은 ${ch}${jong(ch) ? "을" : "를"} 그려볼 수 있는 카드.` : `원작 ${role.orig}${jong(role.orig) ? "이" : "가"} 연기할 때보다 ${a - origAge}살 많아요. 연륜이 붙은 ${ch}${jong(ch) ? "을" : "를"} 보고 싶다면 이쪽.`);
    if (!why) {
      const opts: string[] = [];
      const rank = base.slice().sort((x, z) => z.p.pop - x.p.pop).findIndex((x) => x.p.name === b.p.name) + 1;
      if (rank > 0 && rank <= 5) opts.push(pick([`이 배역 나이대 후보군에서 요즘 인기 지수 ${rank}위. 숫자가 먼저 추천한 이름이에요.`, `같은 나이대 배우 중 인기 지수 ${rank}위, 시청자 눈도장은 이미 받아 둔 셈이에요.`], hash(b.p.name)));
      const rc = cs.filter((c) => (c.release_date || c.first_air_date || "") <= new Date().toISOString().slice(0, 10)).sort((x, z) => (z.release_date || z.first_air_date || "").localeCompare(x.release_date || x.first_air_date || ""))[0];
      if (rc) opts.push(`최근작 ${T(ct(rc))}의 여운이 남아 있을 때가 캐스팅 타이밍이에요.`);
      const f = [...cs].sort((x, z) => (z.vote_count || 0) - (x.vote_count || 0))[0];
      if (f) opts.push(`${T(ct(f))}의 그 얼굴이 ${iga(ch)} 된다면? 상상만으로 예고편이 그려져요.`);
      why = opts.length ? pick(opts, hash(b.p.name + role.id)) : `지금 나이와 인지도가 ${ch} 역의 정석 라인에 딱 들어와요.`;
    }
    scored.push({ p: b.p, s, why });
  }
  scored.sort((a, b) => b.s - a.s);
  for (const x of scored.slice(0, 3)) picks.push({ pool: x.p, pick: "classic", why: x.why });

  {
    const items = [...await news(`"${topic.title}" (가상캐스팅 OR "가상 캐스팅" OR 캐스팅 OR 실사화 OR 드라마화 OR 리메이크 OR 물망) when:1y`), ...(ch.length > 1 ? await news(`"${topic.title}" "${ch}" when:1y`) : [])];
    const cnt = new Map<string, { n: number; src: { t: string; u: string } }>();
    for (const it of items) for (const p of POOL) {
      if (p.name.length < 2 || STOP.has(p.name) || !okName(p.name) || !ok(p) || !(p.kind === "actor" || p.acted)) continue;
      if (hasWord(it.t, p.name) && hasWord(it.t, topic.title)) { const c = cnt.get(p.name) || { n: 0, src: { t: it.t, u: it.u } }; c.n++; cnt.set(p.name, c); }
    }
    const ranked = [...cnt.entries()].sort((a, b) => b[1].n - a[1].n);
    let bestOk: typeof ranked[0] | undefined;
    for (const e of ranked) { const p = POOL.find((x) => x.name === e[0]); if (!p) continue; if (p.tmdb_id && work.tmdb_id && (await creds(p.tmdb_id)).some((c) => c.id === work.tmdb_id)) continue; bestOk = e; break; }
    if (bestOk) { const best = bestOk; const p = POOL.find((x) => x.name === best[0])!; picks.push({ pool: p, pick: "buzz", src: best[1].src, why: best[1].n >= 2 ? `최근 1년 ${T(topic.title)} 캐스팅 기사에 이름이 ${best[1].n}번 올랐어요. 여론이 먼저 고른 사람.` : `${T(topic.title)} 관련 기사 제목에 이름이 걸린 적 있어요. 아니 땐 굴뚝에 연기 날까요?` }); }
    else {
      const hot = POOL.filter((p) => p.kind === "actor" && p.region === region && okName(p.name) && ok(p)).filter((p) => { const a = ageNow(p.birth); return a != null && Math.abs(a - target) <= 6; }).sort((a, b) => b.pop / (1 + use(b.name)) - a.pop / (1 + use(a.name)))[0];
      if (hot) picks.push({ pool: hot, pick: "buzz", why: `이 배역 나이대에서 요즘 TMDB 인기 지수가 가장 높은 배우예요. 지금 제일 핫한 얼굴로 한 칸.` });
    }
  }
  if (o.partnerTop?.tmdb_id) {
    const pc = (await creds(o.partnerTop.tmdb_id)).filter((c) => !ANTH.test(ct(c)) && c.id !== work.tmdb_id).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).slice(0, 25);
    let best: { p: Pool; c: Cred; s: number } | null = null;
    for (const c of pc) {
      const cast = await tm(`/${c.media_type}/${c.id}/${c.media_type === "tv" ? "aggregate_credits" : "credits"}`, { language: "ko-KR" });
      for (const m of (cast?.cast || []).slice(0, 10)) {
        const p = POOL.find((x) => x.tmdb_id === m.id); if (!p || !okName(p.name) || !ok(p) || p.name === o.partnerTop.name) continue;
        if (work.tmdb_id && c.id === work.tmdb_id) continue;
        const a = ageNow(p.birth); if (a != null && Math.abs(a - target) > 10) continue;
        const s = Math.log1p(p.pop) + Math.log1p(c.vote_count || 0) * 0.5 - use(p.name);
        if (!best || s > best.s) best = { p, c, s };
      }
      if (best && pc.indexOf(c) >= 6) break;
    }
    if (best) picks.push({ pool: best.p, pick: "chem", why: pick([`상대역 후보 ${gwawa(o.partnerTop.name)} ${T(ct(best.c))}에서 이미 호흡을 맞췄어요. 케미는 검증된 카드.`, `${T(ct(best.c))} 이후 ${gwawa(o.partnerTop.name)} 다시 만나는 그림. 재회 서사까지 덤이에요.`], hash(best.p.name)) });
  }
  {
    const pool = POOL.filter((p) => p.kind !== "actor" && !ACTORS.has(p.name) && !(p.acted && (p.kind === "stage" || p.kind === "influencer")) && (region === "kr" ? /^[가-힣]{1,5}$/.test(p.name) : okName(p.name)) && ok(p) && !o.usedWild.has(p.id) && use(p.name) === 0).filter((p) => { const a = ageNow(p.birth); return a != null && Math.abs(a - target) <= 8; });
    pool.sort((a, b) => b.pop - a.pop);
    const top = pool.slice(0, 12);
    const w = top.length ? top[Math.abs(hash(topic.id + role.id)) % top.length] : null;
    if (w) { o.usedWild.add(w.id); picks.push({ pool: w, pick: "wild", why: `${KIND_KO[w.kind] || "셀럽"} 와일드카드${w.acted ? ", 연기 경험도 있어요" : ", 연기는 첫 도전"}. ${pick(KIND_LINE[w.kind] || ["의외의 한 수, 이런 캐스팅이 판을 바꿔요."], hash(w.name))}` }); }
  }
  for (const x of scored.slice(3)) { if (picks.length >= 6) break; if (!picks.some((p) => p.pool.name === x.p.name)) picks.push({ pool: x.p, pick: "classic", why: x.why }); }
  return picks.slice(0, 6);
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}));
    await Promise.all([loadPool(), loadGenres()]);
    let tq = "topics?select=id,title,cat,work&closed_at=is.null&order=id";
    if (b.tid) tq += `&id=eq.${encodeURIComponent(b.tid)}`;
    const off = b.offset || 0; const topics = (await (await rest(tq)).json()).slice(off, off + (b.limit || 4));
    const usedWild = new Set<number>();
    const out: unknown[] = [];
    const usage = new Map<string, number>();
    const tidsNow = new Set(topics.map((t: { id: string }) => t.id));
    const us = await (await rest("candidates?select=name,roles!candidates_role_id_fkey!inner(topic_id)&in_set=is.true&pick=in.(classic,buzz,chem,wild)&limit=5000")).json();
    for (const u of Array.isArray(us) ? us : []) if (!tidsNow.has(u.roles?.topic_id)) usage.set(u.name, (usage.get(u.name) || 0) + 1);
    for (const t of topics) {
      const usedTopic = new Set<string>();
      const origs = new Set<string>();
      const roles = await (await rest(`roles?select=id,ch,orig,descr,slot,gender&topic_id=eq.${encodeURIComponent(t.id)}&slot=not.is.null&stage=in.(dream,rumor)&order=pos`)).json();
      const order = ["male_lead", "female_lead", "lead", "male_sub", "female_sub", "support"];
      roles.sort((a: { slot: string }, z: { slot: string }) => order.indexOf(a.slot) - order.indexOf(z.slot));
      for (const r of roles) if (r.orig) origs.add(r.orig);
      const topByRole: Record<string, Pool> = {};
      for (const r of roles) {
        const cs = await (await rest(`candidates?select=name,votes(count)&role_id=eq.${r.id}&order=id`)).json();
        const top = (Array.isArray(cs) ? cs : []).sort((a: { votes: { count: number }[] }, z: { votes: { count: number }[] }) => (z.votes?.[0]?.count || 0) - (a.votes?.[0]?.count || 0))[0];
        if (top) { const p = await findPerson(top.name); if (p) topByRole[r.slot] = p; }
      }
      for (const r of roles) {
        const cands = await (await rest(`candidates?select=id,name,pick,in_set,votes(count)&role_id=eq.${r.id}`)).json();
        const seedNames = new Set<string>((Array.isArray(cands) ? cands : []).filter((c: { pick: string }) => c.pick === "seed" || c.pick === "user").map((c: { name: string }) => c.name));
        const partnerSlot = r.slot === "male_lead" ? "female_lead" : r.slot === "female_lead" ? "male_lead" : r.slot === "male_sub" ? "male_lead" : r.slot === "female_sub" ? "female_lead" : r.slot === "support" ? "lead" : r.slot === "lead" ? "support" : "";
        const picks = await chooseForRole({ role: r, topic: t, partnerTop: topByRole[partnerSlot] || null, usedWild, seedNames, usedTopic, origs, usage });
        for (const p of picks) { usedTopic.add(p.pool.name); usage.set(p.pool.name, (usage.get(p.pool.name) || 0) + 1); }
        const keep = new Set<number>();
        for (const p of picks) {
          const ex = (Array.isArray(cands) ? cands : []).find((c: { name: string }) => c.name === p.pool.name);
          const body = { pick: p.pick, pick_why: p.why, pick_src: p.src || null, in_set: true, pool_id: p.pool.id || null, blurb_at: null };
          if (ex) { await rest(`candidates?id=eq.${ex.id}`, { method: "PATCH", body: JSON.stringify(body) }); keep.add(ex.id); }
          else { const ins = await rest("candidates", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ role_id: r.id, name: p.pool.name.replace(/\s*\(.*\)$/, ""), ...body }) }); const j = await ins.json(); if (Array.isArray(j) && j[0]) keep.add(j[0].id); else out.push({ err: j }); }
        }
        for (const c of (Array.isArray(cands) ? cands : [])) if (!keep.has(c.id)) { const voted = (c.votes?.[0]?.count || 0) > 0; await rest(`candidates?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify({ in_set: voted }) }); }
        out.push({ t: t.title, ch: r.ch, picks: picks.map((p) => `${p.pick}:${p.pool.name}`) });
      }
    }
    return new Response(JSON.stringify({ topics: topics.length, out }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 }); }
});
