// Shared helpers for all API routes.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

export const fail = (message, status = 400) => json({ error: message }, status);

export const uid = () => crypto.randomUUID();

export const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

// Reads a JSON body; returns null if the body is missing or not JSON.
export async function readJson(request) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Returns true if the bucket has already used `limit` hits in the last `windowSec`
// seconds. Otherwise records a hit and returns false.
export async function rateLimited(db, bucket, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  const since = now - windowSec;
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM rate_limits WHERE bucket = ?1 AND ts > ?2")
    .bind(bucket, since)
    .first();
  if ((row?.n ?? 0) >= limit) return true;
  await db.prepare("INSERT INTO rate_limits (bucket, ts) VALUES (?1, ?2)").bind(bucket, now).run();
  // Occasionally tidy old rows
  if (Math.random() < 0.05) {
    await db.prepare("DELETE FROM rate_limits WHERE ts < ?1").bind(now - 86400).run();
  }
  return false;
}

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
export const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
