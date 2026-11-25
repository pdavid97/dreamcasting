// 캐스팅 시트 AI 포스터 배경 Edge Function
// 요청: POST { sid: 시트 id, mood: "melo"|"thr"|"fan"|"com", figures: 1~6 }  로그인 사용자 JWT 필요
// 동작: 한도 확인(app_config.poster_ai, 하루 1인 3장, 전체 200장)과 안목 포인트 50 차감 > fal.ai FLUX 호출(실패하면 포인트 돌려줌) > Storage posters에 저장 > 시트에 연결
// 비밀값: FAL_KEY (David가 Supabase 대시보드에 직접 넣음). 없거나 poster_ai.on=false면 503으로 꺼진 상태를 알림
// 원칙: 프롬프트에 배우 이름, 작품명, 유저 자유 문구를 넣지 않음. 얼굴 없는 실루엣 배경만 만들고 이름과 제목은 화면에서 얹음
const ORIGINS = [/^https:\/\/pdavid97\.github\.io$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/, /^null$/];
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const cors = (o: string | null) => ({
  "Access-Control-Allow-Origin": o && ORIGINS.some((r) => r.test(o)) ? o : "https://pdavid97.github.io",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info",
  "Vary": "Origin",
});
const j = (o: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(o), { status: s, headers: { ...h, "Content-Type": "application/json" } });
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };

const MOOD: Record<string, string> = {
  melo: "soft romantic dusk light, pastel pink and warm gold palette, falling petals, dreamy bokeh",
  thr: "dark noir city at night, rain, red neon accents, high contrast shadows, tense atmosphere",
  fan: "epic fantasy palace under a starry indigo sky, glowing golden particles, grand scale",
  com: "bright sunny pop colors, playful bold yellow and orange palette, cheerful city street",
};

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return j({ error: "method" }, 405, h);
  const key = Deno.env.get("FAL_KEY") || "";
  // 로그인 사용자 확인
  const auth = req.headers.get("authorization") || "";
  const ur = await fetch(`${SB}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } });
  if (!ur.ok) return j({ error: "login" }, 401, h);
  const user = await ur.json();
  let b: { sid?: unknown; mood?: unknown; figures?: unknown };
  try { b = await req.json(); } catch { return j({ error: "json" }, 400, h); }
  const sid = Number(b.sid), mood = String(b.mood || "melo"), n = Math.max(1, Math.min(6, Number(b.figures) || 2));
  if (!Number.isInteger(sid) || !MOOD[mood]) return j({ error: "bad request" }, 400, h);
  if (!key) return j({ error: "off" }, 503, h);
  // 한도 확인과 기록
  const cr = await fetch(`${SB}/rest/v1/rpc/poster_gen_claim`, { method: "POST", headers: H, body: JSON.stringify({ u: user.id, sid }) });
  const claim = cr.ok ? await cr.json() : { ok: false, why: "db" };
  if (!claim.ok) return j({ error: claim.why }, claim.why === "off" ? 503 : claim.why === "points" ? 402 : 429, h);
  const fail = async (e: string) => { await fetch(`${SB}/rest/v1/rpc/poster_gen_refund`, { method: "POST", headers: H, body: JSON.stringify({ u: user.id, gid: claim.gid }) }).catch(() => null); return j({ error: e }, 502, h); };
  const prompt = `Cinematic drama key art background, ${MOOD[mood]}. ${n} human figures shown only as dark backlit silhouettes seen from behind, ` +
    `faces not visible, no recognizable people, no text, no letters, no logos, empty space at the bottom for credits, portrait composition.`;
  const fr = await fetch(`https://fal.run/${claim.model || "fal-ai/flux/schnell"}`, {
    method: "POST", headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, image_size: "portrait_4_3", num_images: 1, enable_safety_checker: true }),
  });
  if (!fr.ok) return await fail("gen");
  const out = await fr.json();
  const src = out?.images?.[0]?.url;
  if (!src) return await fail("gen");
  const img = await fetch(src);
  if (!img.ok) return await fail("gen");
  const bytes = new Uint8Array(await img.arrayBuffer());
  const ct = img.headers.get("content-type") || "image/jpeg";
  const path = `${user.id}/ai-${sid}-${Date.now()}.${ct.includes("png") ? "png" : "jpg"}`;
  const up = await fetch(`${SB}/storage/v1/object/posters/${path}`, { method: "POST", headers: { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": ct }, body: bytes });
  if (!up.ok) return await fail("store");
  const url = `${SB}/storage/v1/object/public/posters/${path}`;
  await fetch(`${SB}/rest/v1/rpc/poster_gen_done`, { method: "POST", headers: H, body: JSON.stringify({ u: user.id, sid, url }) });
  return j({ url, left: claim.left }, 200, h);
});
