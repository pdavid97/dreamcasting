// 후보 한 줄 소개 Edge Function
// 후보마다 TMDB에서 최근작, 차기작, 출연 장르, 생년을 가져와 "후보에 오를 만한 이유"를 짧은 문장으로 만든다.
// 문장은 모두 TMDB 데이터에서 나온 사실(작품명, 연도, 편수, 나이)만 쓰고, 소문이나 평가는 지어내지 않는다.
// 결과: candidates.blurb = {recent:{t,y,ch}, up:{t,y}, why, pid}
// 호출: {limit?: number, force?: boolean, ids?: number[]}  (pg_cron 하루 1회 + 새 후보 반영용)
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
async function tm(path: string, q: Record<string, string> = {}) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  const h: Record<string, string> = { accept: "application/json" };
  if (TOKEN.length > 60) h.Authorization = "Bearer " + TOKEN; else u.searchParams.set("api_key", TOKEN);
  const r = await fetch(u, { headers: h });
  return r.ok ? await r.json() : null;
}
// 받침 여부로 조사 고르기
const jong = (w: string) => { const c = w.trim().slice(-1).charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false; };
const iga = (w: string) => w + (jong(w) ? "이" : "가");
const ro = (w: string) => { const c = w.trim().slice(-1).charCodeAt(0); if (c < 0xac00 || c > 0xd7a3) return "로"; const j = (c - 0xac00) % 28; return j === 0 || j === 8 ? "로" : "으로"; };
const eunneun = (w: string) => w + (jong(w) ? "은" : "는");
const today = new Date().toISOString().slice(0, 10);
const NOT_ACTING = new Set([10767, 10763, 10764]); // 토크쇼, 뉴스, 리얼리티
const SELF = /self|himself|herself|본인|자기 자신|host|narrator/i;

type Credit = { title?: string; name?: string; release_date?: string; first_air_date?: string; character?: string; genre_ids?: number[]; popularity?: number; vote_count?: number; episode_count?: number };
const ctitle = (c: Credit) => c.title || c.name || "";
const cdate = (c: Credit) => c.release_date || c.first_air_date || "";

const PCACHE: Record<string, { id: number; birthday: string | null; credits: Credit[] } | null> = {};
async function person(name: string) {
  if (name in PCACHE) return PCACHE[name];
  let id: number | null = null;
  const ppl = await (await rest(`people?select=tmdb_id&name=eq.${encodeURIComponent(name)}&tmdb_id=not.is.null&limit=1`)).json();
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
const yr = (s: string) => (s ? +s.slice(0, 4) : null);
const ageAt = (b: string | null, y: number) => (b ? y - +b.slice(0, 4) : null);

let GENRES: Record<number, string> = {};
async function loadGenres() {
  for (const k of ["movie", "tv"]) { const g = await tm(`/genre/${k}/list`, { language: "ko" }); for (const x of g?.genres || []) GENRES[x.id] = x.name; }
}
const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(seed) % arr.length];

function compose(o: { id: number; name: string; ch: string; orig: string | null; origAge: number | null; workYear: number | null; workGenres: string[]; p: { birthday: string | null; credits: Credit[] } }) {
  const { name, ch, orig, p } = o;
  const past = p.credits.filter((c) => cdate(c) && cdate(c) <= today).sort((a, b) => cdate(b).localeCompare(cdate(a)));
  const fut = p.credits.filter((c) => cdate(c) > today).sort((a, b) => cdate(a).localeCompare(cdate(b)));
  const rc = past[0], up = fut[0];
  const famous = [...past].sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0))[0];
  const now = new Date().getFullYear();
  const age = ageAt(p.birthday, now);
  const reasons: string[] = [];
  // 1) 나이: 원작 배우가 그 역을 맡았던 나이와 비교
  if (age != null && o.origAge != null && orig) {
    const d = age - o.origAge;
    if (Math.abs(d) <= 3) reasons.push(pick([`${eunneun(orig)} ${o.origAge}살에 ${ch}${jong(ch) ? "을" : "를"} 연기했어요. ${eunneun(name)} 지금 ${age}살, 나이 궁합 합격.`, `원작의 ${orig} 나이가 ${o.origAge}살, ${name}${jong(name) ? "은" : "는"} 지금 ${age}살. 분장팀이 칼퇴하는 캐스팅이에요.`], o.id));
    else if (d > 3) { const by = +(p.birthday || "0").slice(0, 4) + o.origAge; reasons.push(pick([`지금은 원작보다 ${d}살 많지만, 다이얼을 ${by}년으로 돌리면 딱 그 나이예요.`, `원작 기준 ${d}살 선배. ${by}년의 ${name}${jong(name) ? "이라면" : "라면"} 이야기가 달라져요.`], o.id)); }
    else reasons.push(pick([`원작 배우보다 ${-d}살 어려요. 풋풋한 리부트를 원한다면 바로 이 사람.`, `원작보다 ${-d}살 젊은 ${ch}. 시즌 2까지 길게 갈 수 있는 나이예요.`], o.id));
  }
  // 2) 장르 궁합
  if (o.workGenres.length) {
    const cnt: Record<string, number> = {};
    for (const c of past) for (const g of c.genre_ids || []) { const n = GENRES[g]; if (n && o.workGenres.includes(n)) cnt[n] = (cnt[n] || 0) + 1; }
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) reasons.push(pick([`${top[0]} 출연작만 ${top[1]}편. 이 장르는 거의 홈그라운드예요.`, `${top[0]} 장르 필모가 ${top[1]}편, 낯가릴 틈이 없어요.`], o.id + 1));
  }
  // 3) 대표작
  if (famous && famous !== rc) reasons.push(pick([`《${ctitle(famous)}》${ro(ctitle(famous))} 얼굴 도장은 이미 꾹. 이번엔 ${ch} 차례?`, `《${ctitle(famous)}》의 그 얼굴이 ${ch}${jong(ch) ? "이" : "가"} 된다면?`], o.id + 2));
  // 4) 기본
  if (orig) reasons.push(`${iga(orig)} 남긴 큰 신발, ${name}에게도 맞을지 신겨볼까요?`);
  else reasons.push(`원작 팬들이 머릿속으로 먼저 캐스팅한 이름, 이제 표로 확인할 차례예요.`);
  let why = reasons[0];
  if (up && reasons.length < 3) why += ` 차기작 《${ctitle(up)}》도 대기 중.`;
  return {
    recent: rc ? { t: ctitle(rc), y: yr(cdate(rc)), ch: (rc.character || "").slice(0, 30) || null } : null,
    up: up ? { t: ctitle(up), y: yr(cdate(up)) } : null,
    why, pid: null as number | null,
  };
}

Deno.serve(async (req) => {
  try {
    let body: { limit?: number; force?: boolean; ids?: number[] } = {};
    try { body = await req.json(); } catch { /* 빈 본문 */ }
    if (!TOKEN) return new Response(JSON.stringify({ error: "TMDB_TOKEN 없음" }), { status: 500 });
    const lim = Math.min(80, body.limit || 40);
    let q = "candidates?select=id,name,role_id,roles!candidates_role_id_fkey!inner(ch,orig,topic_id,topics!inner(work,closed_at))&roles.topics.closed_at=is.null&order=id&limit=" + lim;
    if (body.ids?.length) q += `&id=in.(${body.ids.map(Number).join(",")})`;
    else if (!body.force) q += `&or=(blurb.is.null,blurb_at.lt.${new Date(Date.now() - 14 * 864e5).toISOString()})`;
    const rows = await (await rest(q)).json();
    if (!Array.isArray(rows)) return new Response(JSON.stringify({ error: rows }), { status: 500 });
    await loadGenres();
    const out: unknown[] = [];
    for (const r of rows) {
      const role = r.roles, work = role?.topics?.work || {};
      const p = await person(r.name);
      let origAge: number | null = null;
      const wy = work.year ? +String(work.year).slice(0, 4) : null;
      if (role?.orig && wy) { const op = await person(role.orig); origAge = op ? ageAt(op.birthday, wy) : null; }
      const ch = String(role?.ch || "").replace(/\s*\(.*\)$/, "");
      const blurb = p ? compose({ id: r.id, name: r.name, ch, orig: role?.orig || null, origAge, workYear: wy, workGenres: work.genres || [], p }) : { recent: null, up: null, why: role?.orig ? `${iga(role.orig)} 남긴 큰 신발, ${r.name}에게도 맞을지 신겨볼까요?` : "원작 팬들이 먼저 떠올린 이름이에요.", pid: null };
      if (p) blurb.pid = p.id;
      await rest(`candidates?id=eq.${r.id}`, { method: "PATCH", body: JSON.stringify({ blurb, blurb_at: new Date().toISOString() }) });
      out.push([r.name, blurb.recent?.t || null, blurb.why]);
      await new Promise((s) => setTimeout(s, 60));
    }
    return new Response(JSON.stringify({ done: rows.length, sample: out.slice(0, 12) }), { headers: { "Content-Type": "application/json" } });
  } catch (e) { return new Response(JSON.stringify({ error: String((e as Error)?.stack || e) }), { status: 500 }); }
});
