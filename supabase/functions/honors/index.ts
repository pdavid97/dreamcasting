// 수상 크레딧 Edge Function (Wikidata P166, 수상만, 후보 지명은 넣지 않음)
// 요청: { person: TMDB 인물 id, works: [["movie", 155], ["tv", 1399], ...] (최대 120) }
// 응답: { p: [{ n: 상 이름, y: 연도, m, id }] 배우 본인 수상(어느 작품으로 받았는지 TMDB id로),
//         w: { "movie:155": [{ n, y }] } 작품이 받은 작품상, 대상 같은 작품 단위 상 }
// 결과는 tmdb_cache에 7일 캐시. 기록이 없으면 비워 두고 지어내지 않음
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, TTL = 7 * 864e5;
const H = { apikey: SR, Authorization: `Bearer ${SR}` };
const UA = { accept: "application/sparql-results+json", "User-Agent": "dreamcasting/1.0 (https://pdavid97.github.io/dreamcasting/)" };
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
});
// 작품 단위로 작품성을 인정받은 상만 남김(개인 연기상, 기술상은 제외)
const WORK_HONOR = /작품상|대상|최우수\s?작품|최우수\s?드라마|황금종려|황금사자|황금곰|심사위원\s?대상|Best Picture|Best Film|Best Motion Picture|Best Feature|Best Drama Series|Best Comedy Series|Outstanding (Drama|Comedy|Limited) Series|Palme d|Golden Lion|Golden Bear|Grand Prix|Grand Jury Prize|Daesang|Grand Prize/i;
const PERSONAL = /남우|여우|연기|배우|Actor|Actress|Performance|Supporting|Lead/i;

async function cget(k: string) {
  const since = new Date(Date.now() - TTL).toISOString();
  const r = await fetch(`${SB}/rest/v1/tmdb_cache?select=url&k=eq.${encodeURIComponent(k)}&updated_at=gte.${since}`, { headers: H });
  const d = r.ok ? await r.json() : [];
  return d.length ? d[0].url as string : undefined;
}
async function cput(k: string, v: string) {
  await fetch(`${SB}/rest/v1/tmdb_cache?on_conflict=k`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify([{ k, url: v, updated_at: new Date().toISOString() }]) });
}
async function sparql(q: string) {
  const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q), { headers: UA });
  if (!r.ok) return null;
  return ((await r.json()).results?.bindings || []) as Record<string, { value: string }>[];
}
const yr = (b: Record<string, { value: string }>) => (b.t?.value ? b.t.value.slice(0, 4) : "");
const lab = (b: Record<string, { value: string }>) => b.awLabel?.value || "";

async function personAwards(tp: number) {
  const k = "honor:p:" + tp, c = await cget(k);
  if (c !== undefined) return JSON.parse(c);
  const b = await sparql(`SELECT ?aw ?awLabel ?t ?tm ?tv WHERE { ?p wdt:P4985 "${tp}". ?p p:P166 ?s. ?s ps:P166 ?aw. OPTIONAL { ?s pq:P585 ?t } OPTIONAL { ?s pq:P1686 ?for. OPTIONAL { ?for wdt:P4947 ?tm } OPTIONAL { ?for wdt:P4983 ?tv } } SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". } } LIMIT 120`);
  if (!b) return null;
  const seen = new Set<string>(), out: { n: string; y: string; m?: string; id?: number }[] = [];
  for (const x of b) {
    const n = lab(x); if (!n || /^Q\d+$/.test(n)) continue;
    const m = x.tm ? "movie" : x.tv ? "tv" : undefined, id = x.tm ? +x.tm.value : x.tv ? +x.tv.value : undefined;
    const key = n + yr(x) + (id || ""); if (seen.has(key)) continue; seen.add(key);
    out.push({ n, y: yr(x), ...(m ? { m, id } : {}) });
  }
  await cput(k, JSON.stringify(out));
  return out;
}
async function workHonors(works: [string, number][]) {
  const res: Record<string, { n: string; y: string }[]> = {}, need: [string, number][] = [];
  const keys = works.map(([m, id]) => `honor:w:${m}:${id}`), since = new Date(Date.now() - TTL).toISOString(), hit: Record<string, string> = {};
  if (keys.length) {
    const r = await fetch(`${SB}/rest/v1/tmdb_cache?select=k,url&updated_at=gte.${since}&k=in.(${keys.map((k) => `"${k}"`).join(",")})`, { headers: H });
    for (const x of (r.ok ? await r.json() : []) as { k: string; url: string }[]) hit[x.k] = x.url;
  }
  for (const [m, id] of works) { const c = hit[`honor:w:${m}:${id}`]; if (c !== undefined) { const v = JSON.parse(c); if (v.length) res[`${m}:${id}`] = v; } else need.push([m, id]); }
  for (const med of ["movie", "tv"]) {
    const ids = need.filter((x) => x[0] === med).map((x) => x[1]);
    for (let i = 0; i < ids.length; i += 60) {
      const part = ids.slice(i, i + 60), prop = med === "movie" ? "P4947" : "P4983";
      const b = await sparql(`SELECT ?tm ?aw ?awLabel ?t WHERE { VALUES ?tm { ${part.map((x) => `"${x}"`).join(" ")} } ?f wdt:${prop} ?tm. ?f p:P166 ?s. ?s ps:P166 ?aw. OPTIONAL { ?s pq:P585 ?t } SERVICE wikibase:label { bd:serviceParam wikibase:language "ko,en". } }`);
      if (!b) continue;
      const got: Record<string, { n: string; y: string }[]> = {};
      for (const x of b) {
        const n = lab(x); if (!n || /^Q\d+$/.test(n) || !WORK_HONOR.test(n) || PERSONAL.test(n)) continue;
        const k = `${med}:${x.tm.value}`; (got[k] = got[k] || []);
        if (!got[k].some((y) => y.n === n)) got[k].push({ n, y: yr(x) });
      }
      const rows = part.map((id) => { const k = `${med}:${id}`, v = got[k] || []; if (v.length) res[k] = v; return { k: `honor:w:${k}`, url: JSON.stringify(v), updated_at: new Date().toISOString() }; });
      await fetch(`${SB}/rest/v1/tmdb_cache?on_conflict=k`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(rows) });
    }
  }
  return res;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  const out = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
  let b: { person?: unknown; works?: unknown };
  try { b = await req.json(); } catch { return out({ error: "bad json" }, 400); }
  const tp = Number(b.person);
  const works = (Array.isArray(b.works) ? b.works : []).filter((x): x is [string, number] => Array.isArray(x) && (x[0] === "movie" || x[0] === "tv") && Number.isInteger(+x[1]) && +x[1] > 0).map((x) => [x[0], +x[1]] as [string, number]).slice(0, 120);
  try {
    const [p, w] = await Promise.all([Number.isInteger(tp) && tp > 0 ? personAwards(tp) : Promise.resolve([]), workHonors(works)]);
    return out({ p: p || [], w, p_ok: p !== null });
  } catch (e) { return out({ error: String(e) }, 500); }
});
