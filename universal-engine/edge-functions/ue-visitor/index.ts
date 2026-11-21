// Universal Engine visitor number API. Public ingress, privileged DB call stays server-side.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers });
const visitorRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();
async function dailyHash(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const day = new Date().toISOString().slice(0, 10);
  const bytes = await crypto.subtle.sign("HMAC", key, encoder.encode(day + ":" + ip));
  return [...new Uint8Array(bytes)].map(n => n.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method === "GET") return json({ status: "ok" });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const length = Number(request.headers.get("content-length") || "0");
  if (length > 2048) return json({ error: "invalid_request" }, 413);
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 2048) return json({ error: "invalid_request" }, 413);
    body = JSON.parse(text);
    if (!body || Array.isArray(body) || typeof body !== "object") throw Error("body");
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const visitorId = body.visitor_id;
  if (typeof visitorId !== "string" || !visitorRegex.test(visitorId)) {
    return json({ error: "invalid_visitor_id" }, 400);
  }
  const rawDevice = body.device_class;
  const device = typeof rawDevice === "string" &&
    ["desktop", "mobile", "tablet", "vr"].includes(rawDevice)
    ? rawDevice : "unknown";
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "service_unavailable" }, 503);
  // Gateway-provided address, used only to derive a short-lived daily rate-limit digest.
  // No raw address, user-agent or permanent IP hash is stored in the visitors table.
  const ip = request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || "";
  const rateKey = ip ? await dailyHash(ip, serviceKey) : null;
  try {
    const response = await fetch(url + "/rest/v1/rpc/ue_register_visit", {
      method: "POST",
      headers: {
        "apikey": serviceKey,
        "Authorization": "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_visitor_id: visitorId,
        p_device: device,
        p_rate_key: rateKey,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (result?.code === "P0001") return json({ error: "rate_limited" }, 429);
      console.error("ue-visitor RPC failed", result?.code || response.status);
      return json({ error: "service_unavailable" }, 503);
    }
    return json(result);
  } catch (error) {
    console.error("ue-visitor unexpected error", String(error));
    return json({ error: "service_unavailable" }, 503);
  }
});
