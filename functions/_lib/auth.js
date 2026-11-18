// Single-owner admin login using a password stored as a Cloudflare secret.
// A successful login sets a signed, HttpOnly, SameSite=Strict cookie.

const COOKIE = "bbg_admin";
const SESSION_SECONDS = 60 * 60 * 12; // 12 hours

const enc = new TextEncoder();

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

// Compare two strings in constant time by comparing their HMACs.
export async function safeEqual(a, b, secret) {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ ya[i];
  return diff === 0;
}

export async function makeSessionCookie(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = String(exp);
  const sig = b64url(await hmac(env.SESSION_SECRET, payload));
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}

export const clearSessionCookie = () =>
  `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAdmin(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return false;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = b64url(await hmac(env.SESSION_SECRET, payload));
  return safeEqual(sig, expected, env.SESSION_SECRET);
}
