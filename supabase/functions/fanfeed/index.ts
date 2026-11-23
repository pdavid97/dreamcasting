// 리포트용 팬 소식: 최애 배우 신작(TMDB), 팬미팅, 내한 등 행사 기사와 굿즈, 앨범 기사(구글 뉴스 RSS), AV룸 작품 시청처(TMDB, JustWatch 데이터)
// 요청: { names: string[] (최대 4), works: {media,id,title}[] (최대 12), region?: "KR" }
// 결과는 tmdb_cache에 캐시(뉴스 6시간, TMDB 24시간). 기사 제목과 링크만 보여주고 일정은 기사 기준이라고 표시
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const rest = (p: string, i: RequestInit = {}) => fetch(`${SB}/rest/v1/${p}`, { ...i, headers: { ...H, ...(i.headers || {}) } });
const TOKEN = Deno.env.get("TMDB_TOKEN") || "";
const IMG = "https://image.tmdb.org/t/p/";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

async function cached<T>(k: string, hours: number, make: () => Promise<T>): Promise<T> {
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  try {
    const c = await (await rest(`tmdb_cache?select=url&k=eq.${encodeURIComponent(k)}&updated_at=gte.${since}`)).json();
    if (Array.isArray(c) && c[0]?.url) return JSON.parse(c[0].url);
  } catch { /* 캐시 실패는 새로 받기 */ }
  const v = await make();
  await rest("tmdb_cache?on_conflict=k", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k, url: JSON.stringify(v), updated_at: new Date().toISOString() }]) });
  return v;
}
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
  const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`, { headers: { "User-Agent": "Mozilla/5.0 dreamcasting" } });
  if (!r.ok) return [];
  const x = await r.text();
  return [...x.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const g = (t: string) => dec((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "");
    const t = g("title"), src = g("source");
    return { t: t.replace(/\s+-\s+[^-]+$/, ""), u: g("link"), src, at: g("pubDate") ? new Date(g("pubDate")).toISOString() : null };
  });
}
const EVENT = /팬미팅|팬 미팅|내한|무대인사|콘서트|투어|팬사인회|쇼케이스|시사회|GV|기자간담회|페스티벌/;
const GOODS = /굿즈|팝업|블루레이|DVD|OST 발매|OST 음원|화보집|포토북|시즌그리팅|응원봉|한정판|대본집|에세이|앨범 발매|싱글 발매|팬클럽|머천다이즈|MD/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const names: string[] = (Array.isArray(b.names) ? b.names : []).filter((n: unknown) => typeof n === "string" && n.length <= 40).slice(0, 4);
    const works: { media: string; id: number; title: string }[] = (Array.isArray(b.works) ? b.works : []).filter((w: any) => w && (w.media === "movie" || w.media === "tv") && Number.isFinite(+w.id)).slice(0, 12);
    const region = /^[A-Z]{2}$/.test(b.region || "") ? b.region : "KR";
    const today = new Date().toISOString().slice(0, 10);

    // 사람 tmdb id
    const ppl = names.length ? await (await rest(`people?select=name,tmdb_id,pop&name=in.(${names.map((n) => `"${n.replace(/"/g, "")}"`).join(",")})&tmdb_id=not.is.null&order=pop.desc.nullslast`)).json() : [];
    const tid = (n: string) => (ppl as { name: string; tmdb_id: number }[]).find((p) => p.name === n)?.tmdb_id;

    const per = await Promise.all(names.map(async (n) => {
      const id = tid(n);
      const up = id ? await cached(`ff:up:${id}`, 24, async () => {
        const d = await tm(`/person/${id}/combined_credits`, { language: "ko-KR" });
        return ((d?.cast || []) as any[]).map((c) => ({ media: c.media_type, id: c.id, title: c.title || c.name, date: c.release_date || c.first_air_date || "", ch: c.character || "", poster: c.poster_path ? IMG + "w185" + c.poster_path : null }))
          .filter((c) => c.date && c.date > today && !/self|himself|herself|본인/i.test(c.ch)).sort((a, z) => a.date.localeCompare(z.date)).slice(0, 4);
      }) : [];
      const nw = await cached(`ff:news2:${n}`, 6, async () => {
        const ev = (await news(`"${n}" (팬미팅 OR 내한 OR 무대인사 OR 콘서트 OR 투어 OR 팬사인회 OR 시사회) when:60d`)).filter((x) => x.t.includes(n) && EVENT.test(x.t)).slice(0, 4);
        const gd = (await news(`"${n}" (굿즈 OR 팝업 OR 블루레이 OR 화보집 OR 포토북 OR 시즌그리팅 OR 대본집 OR 앨범 발매) when:60d`)).filter((x) => x.t.includes(n) && GOODS.test(x.t)).slice(0, 4);
        return { ev, gd };
      });
      return { name: n, up, ev: nw.ev, gd: nw.gd };
    }));

    const providers = await Promise.all(works.map((w) => cached(`ff:wp:${w.media}:${w.id}:${region}`, 24, async () => {
      const d = await tm(`/${w.media}/${w.id}/watch/providers`);
      const r = d?.results?.[region];
      const pick = (a: any[] | undefined) => (a || []).slice(0, 4).map((p) => ({ name: p.provider_name, logo: p.logo_path ? IMG + "w92" + p.logo_path : null }));
      return { media: w.media, id: w.id, title: w.title, link: r?.link || null, flat: pick(r?.flatrate), rent: pick(r?.rent), buy: pick(r?.buy) };
    })));

    return new Response(JSON.stringify({ at: new Date().toISOString(), region, per, providers }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
