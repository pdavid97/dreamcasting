// KOBIS 오픈API 수집 (비밀값 KOBIS_KEY, 하루 3000회 한도)
// POST { ping: true } : 키 확인(어제 박스오피스 1회 호출)
// POST {}             : 어제 박스오피스 저장, 한국 영화 목록을 연도별로 이어서 수집, 상세(출연진과 배역명)가 없는 장편을 최신 개봉순으로 채움
// 크론이 공개 anon 키로 호출. 하루 실행 횟수를 kobis_state에 세서 한도(MAX_RUNS)를 넘으면 바로 끝남
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, KEY = (Deno.env.get("KOBIS_KEY") || "").trim().replace(/^["']|["']$/g, "");
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const API = "https://www.kobis.or.kr/kobisopenapi/webservice/rest";
const MAX_RUNS = 8, LIST_PAGES = 15, INFO_MAX = 300, Y0 = 1995;
const j = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
let calls = 0;
async function k(path: string, q: Record<string, string>) {
  calls++;
  const r = await fetch(`${API}/${path}.json?` + new URLSearchParams({ key: KEY, ...q }));
  const t = await r.json().catch(() => null);
  if (!r.ok || !t || t.faultInfo) throw new Error("kobis " + (t?.faultInfo?.message || r.status));
  return t;
}
async function upsert(t: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const r = await fetch(`${SB}/rest/v1/${t}?on_conflict=${conflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) throw new Error(t + " " + (await r.text()));
  }
}
async function getState(key: string) { const r = await (await fetch(`${SB}/rest/v1/kobis_state?k=eq.${key}&select=v`, { headers: H })).json(); return r[0]?.v; }
const setState = (key: string, v: unknown) => upsert("kobis_state", "k", [{ k: key, v, updated_at: new Date().toISOString() }]);
const d8 = (s?: string) => s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null;
const names = (a?: { peopleNm?: string; nationNm?: string; genreNm?: string }[], f = "peopleNm") => (a || []).map((x) => (x as Record<string, string>)[f]).filter(Boolean).join(", ") || null;

Deno.serve(async (req) => {
  if (!KEY) return j({ error: "KOBIS_KEY 없음" }, 500);
  const b = await req.json().catch(() => ({})) as { ping?: boolean };
  const yd = new Date(Date.now() + 9 * 36e5 - 864e5).toISOString().slice(0, 10);
  try {
    if (b.ping) { const t = await k("boxoffice/searchDailyBoxOfficeList", { targetDt: yd.replace(/-/g, "") }); return j({ ok: true, day: yd, n: t.boxOfficeResult.dailyBoxOfficeList.length }); }
    const today = yd.slice(0, 10), runs = (await getState("runs")) || {};
    const n = runs.day === today ? runs.n : 0;
    if (n >= MAX_RUNS) return j({ skip: "daily limit" });
    await setState("runs", { day: today, n: n + 1 });
    const out: Record<string, unknown> = {};
    // 1) 어제 박스오피스
    const have = await (await fetch(`${SB}/rest/v1/kobis_box?day=eq.${yd}&select=movie_cd&limit=1`, { headers: H })).json();
    if (!have.length) {
      const l = (await k("boxoffice/searchDailyBoxOfficeList", { targetDt: yd.replace(/-/g, "") })).boxOfficeResult.dailyBoxOfficeList;
      await upsert("kobis_movie", "movie_cd", l.map((x: Record<string, string>) => ({ movie_cd: x.movieCd, nm: x.movieNm, open_dt: x.openDt || null })));
      await upsert("kobis_box", "day,movie_cd", l.map((x: Record<string, string>) => ({ day: yd, movie_cd: x.movieCd, rank: +x.rank, nm: x.movieNm, audi_cnt: +x.audiCnt, audi_acc: +x.audiAcc, sales_acc: +x.salesAcc, scrn_cnt: +x.scrnCnt })));
      out.box = l.length;
    }
    // 2) 한국 영화 목록(최신 연도부터 Y0까지, 끝나면 올해만 다시)
    let cur = (await getState("list")) || { year: +today.slice(0, 4), page: 1 };
    let listed = 0;
    for (let p = 0; p < LIST_PAGES; p++) {
      const r = (await k("movie/searchMovieList", { repNationCd: "22041011", openStartDt: String(cur.year), openEndDt: String(cur.year), itemPerPage: "100", curPage: String(cur.page) })).movieListResult;
      const ml = r.movieList || [];
      await upsert("kobis_movie", "movie_cd", ml.map((x: Record<string, unknown>) => ({ movie_cd: x.movieCd, nm: x.movieNm, nm_en: x.movieNmEn || null, prdt_year: +(x.prdtYear as string) || null, open_dt: d8(x.openDt as string), type_nm: x.typeNm || null, nation: x.nationAlt || null, genre: x.genreAlt || null, directors: names(x.directors as []), updated_at: new Date().toISOString() })));
      listed += ml.length;
      if (cur.page * 100 >= r.totCnt) cur = cur.year > Y0 ? { year: cur.year - 1, page: 1 } : { year: +today.slice(0, 4), page: 1 };
      else cur = { ...cur, page: cur.page + 1 };
    }
    await setState("list", cur); out.listed = listed; out.next = cur;
    // 3) 상세(출연진과 배역명): 박스오피스 영화 먼저, 그 다음 장편 최신순
    const need = await (await fetch(`${SB}/rest/v1/kobis_movie?info_at=is.null&and=${encodeURIComponent("(or(type_nm.eq.장편,type_nm.is.null),or(genre.is.null,genre.not.ilike.*성인물*))")}&select=movie_cd&order=open_dt.desc.nullslast&limit=${INFO_MAX}`, { headers: H })).json() as { movie_cd: string }[];
    let info = 0, fail = 0;
    for (let i = 0; i < need.length; i += 4) {
      await Promise.all(need.slice(i, i + 4).map(async ({ movie_cd }) => {
        try {
          const m = (await k("movie/searchMovieInfo", { movieCd: movie_cd })).movieInfoResult.movieInfo;
          const cast = (m.actors || []).map((a: Record<string, string>, ix: number) => ({ movie_cd, ord: ix + 1, name: a.peopleNm, name_en: a.peopleNmEn || null, role: a.cast || null, role_en: a.castEn || null })).filter((x: { name: string }) => x.name);
          await upsert("kobis_movie", "movie_cd", [{ movie_cd, nm: m.movieNm, nm_en: m.movieNmEn || null, prdt_year: +m.prdtYear || null, open_dt: d8(m.openDt), type_nm: m.typeNm || null, nation: names(m.nations, "nationNm"), genre: names(m.genres, "genreNm"), directors: names(m.directors), show_tm: +m.showTm || null, info_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
          if (cast.length) await upsert("kobis_cast", "movie_cd,ord", cast);
          info++;
        } catch { fail++; }
      }));
    }
    out.info = info; out.fail = fail; out.calls = calls;
    return j(out);
  } catch (e) { return j({ error: String(e), calls, klen: KEY.length, hex: /^[0-9a-f]+$/i.test(KEY) }, 502); }
});
