// Public contact details shown on the website. Edit these, commit, and the site updates.
// (No secrets belong in this file. Passwords and API keys go in Cloudflare settings.)
window.BBG_CONFIG = {
  CURRENCY: "KES",
  WHATSAPP: "254700000000", // your number, country code, no + or spaces
  PHONE_DISPLAY: "+254 700 000 000",
  EMAIL: "hello@bremohbeautyglow.com"
};

// Small helper shared by all pages
window.api = async function (path, options = {}) {
  const opts = { credentials: "same-origin", ...options };
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
    opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
};
