// 바깥 링크 이동 + 클릭 기록 Edge Function (JWT 검증 끔: 일반 링크로 열리기 때문. 대신 허용된 주소로만 보냄)
// GET /functions/v1/go?t=작품id&p=파트너id&k=종류&u=이동할주소&pl=노출자리id&s=브라우저id&pg=페이지
// 허용 주소: partners.domains에 등록된 도메인, 그 작품의 공식 사이트(TMDB homepage), 주제 링크(topics.links), 노출 자리(placements.url)
// partners.utm이 켜진 곳은 utm_source=dreamcasting 등을 붙여 보냄(제작사, 플랫폼이 우리 유입을 직접 확인할 수 있게)
const SB = Deno.env.get("SUPABASE_URL")!, SR = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const H = { apikey: SR, Authorization: `Bearer ${SR}`, "Content-Type": "application/json" };
const HOME = "https://pdavid97.github.io/dreamcasting/";
const get = async (path: string) => { const r = await fetch(`${SB}/rest/v1/${path}`, { headers: H }); return r.ok ? await r.json() : []; };

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams;
  const raw = q.get("u") || "", tid = (q.get("t") || "").slice(0, 40), pid = (q.get("p") || "").slice(0, 30);
  let to: URL;
  try { to = new URL(raw); } catch { return Response.redirect(HOME, 302); }
  if (to.protocol !== "https:") return Response.redirect(HOME, 302);
  const host = to.hostname.toLowerCase();
  const [partners, topic, pls] = await Promise.all([
    get("partners?select=id,domains,utm&active=eq.true"),
    tid ? get(`topics?select=work,links&id=eq.${encodeURIComponent(tid)}`) : Promise.resolve([]),
    tid ? get(`placements?select=id,url,sponsored&or=(topic_id.eq.${encodeURIComponent(tid)},topic_id.is.null)`) : Promise.resolve([]),
  ]);
  const t = topic[0] || {};
  const hostOf = (u: string) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ""; } };
  const pl = (pls as { id: number; url: string; sponsored: boolean }[]).find((x) => x.url === raw || String(x.id) === q.get("pl"));
  const byDomain = (partners as { id: string; domains: string[]; utm: boolean }[]).find((p) => (p.domains || []).includes(host));
  const ok = !!byDomain || !!pl ||
    (t.work && t.work.homepage && hostOf(t.work.homepage) === host) ||
    ((t.links || []) as { url: string }[]).some((l) => hostOf(l.url) === host);
  if (!ok) return Response.redirect(HOME, 302);
  const named = (partners as { id: string; utm: boolean }[]).find((p) => p.id === pid);
  // 시청처 버튼은 TMDB 시청 페이지로 가더라도 클릭은 그 플랫폼(p) 몫으로 기록
  const partner = named || byDomain || { id: "official", utm: true };
  const utm = byDomain ? byDomain.utm : partner.utm;
  if (utm && !to.searchParams.has("utm_source")) {
    to.searchParams.set("utm_source", "dreamcasting");
    to.searchParams.set("utm_medium", pl && pl.sponsored ? "sponsored" : "referral");
    if (tid) to.searchParams.set("utm_campaign", tid);
  }
  await fetch(`${SB}/rest/v1/out_clicks`, {
    method: "POST", headers: H,
    body: JSON.stringify({ topic_id: tid || null, partner_id: partner.id, placement_id: pl ? pl.id : null, kind: (q.get("k") || "").slice(0, 20) || null,
      url: raw.slice(0, 500), sid: (q.get("s") || "").slice(0, 40) || null, page: (q.get("pg") || "").slice(0, 40) || null, sponsored: !!(pl && pl.sponsored) }),
  }).catch(() => {});
  return new Response(null, { status: 302, headers: { Location: to.toString(), "Cache-Control": "no-store", "Referrer-Policy": "origin" } });
});
