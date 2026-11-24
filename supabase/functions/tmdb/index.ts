// TMDB 이미지 중계 Edge Function
// 방문자는 TMDB 키 없이 배우 프로필 사진과 작품 포스터 주소를 받음. 키는 서버 비밀값으로만 보관
// 비밀값(Supabase 대시보드 > Edge Functions > Secrets):
//   TMDB_TOKEN  David가 직접 넣음. TMDB API Key(v3) 또는 API Read Access Token(v4) 중 하나
// 요청: POST { names: ["배우 이름", ...], titles: ["작품 제목", ...] }  (합쳐서 최대 40개)
// 응답: { p: { "배우 이름": "https://image.tmdb.org/...jpg" | "" }, w: { "작품 제목": "..." | "" }, k: { "tv:123": "..." } }
// works: ["tv:123", "movie:456"] 를 주면 TMDB 번호로 정확한 포스터를 돌려줌(제목 검색보다 정확)
// 결과는 tmdb_cache 테이블에 30일 보관해 TMDB 호출을 줄임
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TTL = 30 * 864e5;

function cors(origin: string | null) {
  const ok = origin && ORIGINS.some((r) => r.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "https://pdavid97.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
    "Vary": "Origin",
  };
}
const j = (o: unknown, s: number, h: Record<string, string>) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });

async function cacheGet(keys: string[]) {
  if (!keys.length) return new Map<string, string>();
  const inList = keys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",");
  const since = new Date(Date.now() - TTL).toISOString();
  const r = await fetch(`${SB}/rest/v1/tmdb_cache?select=k,url&updated_at=gte.${since}&k=in.(${encodeURIComponent(inList)})`, {
    headers: { apikey: SR, Authorization: `Bearer ${SR}` },
  });
  const rows: { k: string; url: string }[] = r.ok ? await r.json() : [];
  return new Map(rows.map((x) => [x.k, x.url]));
}
async function cachePut(rows: { k: string; url: string }[]) {
  if (!rows.length) return;
  await fetch(`${SB}/rest/v1/tmdb_cache?on_conflict=k`, {
    method: "POST",
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows.map((x) => ({ ...x, updated_at: new Date().toISOString() }))),
  });
}
async function tmdb(path: string, q: string, token: string) {
  const u = new URL("https://api.themoviedb.org/3" + path);
  u.searchParams.set("query", q);
  u.searchParams.set("language", "ko-KR");
  const h: Record<string, string> = { accept: "application/json" };
  if (token.length > 60) h.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
  const r = await fetch(u, { headers: h });
  if (r.status === 401) throw new Error("TMDB 401");
  if (!r.ok) return null;
  return await r.json();
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  const token = Deno.env.get("TMDB_TOKEN") || "";
  if (!token) return j({ error: "no TMDB_TOKEN" }, 503, h);
  let b: { names?: unknown; titles?: unknown; works?: unknown };
  try { b = await req.json(); } catch { return j({ error: "json" }, 400, h); }
  const clean = (a: unknown) => (Array.isArray(a) ? a : []).filter((x) => typeof x === "string" && x.trim() && x.length <= 40).map((x) => (x as string).trim());
  const names = [...new Set(clean(b.names))], titles = [...new Set(clean(b.titles))];
  if (names.length + titles.length > 40) return j({ error: "too many" }, 400, h);
  const works = [...new Set((Array.isArray(b.works) ? b.works : []).filter((x) => typeof x === "string" && /^(tv|movie):\d{1,9}$/.test(x as string)))] as string[];
  if (works.length > 40) return j({ error: "too many" }, 400, h);
  const keys = [...names.map((n) => "p:" + n), ...titles.map((t) => "w:" + t), ...works.map((w) => "k:" + w)];
  const hit = await cacheGet(keys);
  const out = { p: {} as Record<string, string>, w: {} as Record<string, string>, k: {} as Record<string, string> }, fresh: { k: string; url: string }[] = [];
  try {
    await Promise.all(keys.map(async (k) => {
      let url = hit.get(k);
      if (url === undefined && k.startsWith("k:")) {
        const [m, id] = k.slice(2).split(":");
        const u = new URL(`https://api.themoviedb.org/3/${m}/${id}`); u.searchParams.set("language", "ko-KR");
        const hh: Record<string, string> = { accept: "application/json" };
        if (token.length > 60) hh.Authorization = "Bearer " + token; else u.searchParams.set("api_key", token);
        const r = await fetch(u, { headers: hh });
        if (r.status === 401) throw new Error("TMDB 401");
        const d = r.ok ? await r.json() : null;
        url = d && d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : "";
        fresh.push({ k, url });
      }
      if (url === undefined) {
        const isP = k.startsWith("p:"), q = k.slice(2);
        const d = await tmdb(isP ? "/search/person" : "/search/multi", q, token);
        if (d) {
          const x = (d.results || []).find((r: Record<string, string>) => isP ? r.profile_path : r.poster_path && (r.media_type === "tv" || r.media_type === "movie"));
          url = x ? `https://image.tmdb.org/t/p/${isP ? "w185" : "w342"}${isP ? x.profile_path : x.poster_path}` : "";
          fresh.push({ k, url });
        } else url = "";
      }
      (k.startsWith("p:") ? out.p : k.startsWith("k:") ? out.k : out.w)[k.slice(2)] = url;
    }));
  } catch (e) {
    return j({ error: String(e) }, String(e).includes("401") ? 502 : 500, h);
  }
  await cachePut(fresh);
  return j(out, 200, h);
});
