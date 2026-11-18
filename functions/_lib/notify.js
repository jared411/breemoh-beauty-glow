// Email (Resend) and SMS (Africa's Talking). Every function is a no-op if the
// matching secrets are not set, and never throws, so a failed message can
// never break a booking or order.

const BRAND = "Bremoh Beauty Glow";

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function normPhone(p) {
  let d = String(p).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("0")) d = "254" + d.slice(1);
  return "+" + d;
}

export async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !to) return;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.FROM_EMAIL || `${BRAND} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
    });
    if (!r.ok) console.error("Email failed", r.status, await r.text());
  } catch (e) {
    console.error("Email error", e);
  }
}

export async function sendSms(env, to, message) {
  if (!env.AT_API_KEY || !env.AT_USERNAME || !to) return;
  try {
    const body = new URLSearchParams({ username: env.AT_USERNAME, to: normPhone(to), message });
    if (env.AT_SENDER) body.set("from", env.AT_SENDER);
    const r = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: { apiKey: env.AT_API_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) console.error("SMS failed", r.status, await r.text());
  } catch (e) {
    console.error("SMS error", e);
  }
}

export async function notifyNewBooking(env, b, serviceName) {
  const when = `${b.booking_date} at ${b.booking_time}`;
  await Promise.all([
    sendEmail(env, env.OWNER_EMAIL, `New booking: ${b.customer_name}`,
      `<h3>New booking request</h3><p><b>${esc(b.customer_name)}</b> (${esc(b.phone)}${b.email ? ", " + esc(b.email) : ""})<br>
       ${esc(serviceName)}<br>${esc(when)}<br>${esc(b.notes ?? "")}</p>`),
    sendSms(env, env.OWNER_PHONE, `${BRAND}: new booking from ${b.customer_name} (${b.phone}) for ${serviceName}, ${when}.`),
    b.email
      ? sendEmail(env, b.email, `We received your booking - ${BRAND}`,
          `<p>Hi ${esc(b.customer_name)}, thank you for booking <b>${esc(serviceName)}</b> on ${esc(when)}. We will contact you shortly to confirm.</p>`)
      : null,
  ]);
}

export async function notifyBookingStatus(env, b, serviceName, status) {
  if (!["confirmed", "cancelled"].includes(status)) return;
  const when = `${b.booking_date} at ${b.booking_time}`;
  await Promise.all([
    sendSms(env, b.phone, `${BRAND}: your booking for ${serviceName} on ${when} has been ${status}.`),
    b.email
      ? sendEmail(env, b.email, `Your booking is ${status} - ${BRAND}`,
          `<p>Hi ${esc(b.customer_name)}, your booking for <b>${esc(serviceName)}</b> on ${esc(when)} has been <b>${status}</b>.</p>`)
      : null,
  ]);
}

export async function notifyNewOrder(env, o, lines) {
  const total = Number(o.total).toLocaleString();
  await Promise.all([
    sendEmail(env, env.OWNER_EMAIL, `New order: ${o.customer_name}`,
      `<h3>New order</h3><p><b>${esc(o.customer_name)}</b> (${esc(o.phone)})<br>${esc(o.address)}<br>${esc(lines)}<br><b>Total: ${total}</b></p>`),
    sendSms(env, env.OWNER_PHONE, `${BRAND}: new order from ${o.customer_name} (${o.phone}). ${lines}. Total ${total}.`),
    o.email
      ? sendEmail(env, o.email, `We received your order - ${BRAND}`,
          `<p>Hi ${esc(o.customer_name)}, thank you for your order: ${esc(lines)}. Total <b>${total}</b>. We will contact you to arrange payment and delivery.</p>`)
      : null,
  ]);
}

export async function notifyOrderStatus(env, o, status) {
  if (!["confirmed", "delivered", "cancelled"].includes(status)) return;
  await sendSms(env, o.phone, `${BRAND}: your order is now ${status}.`);
}
