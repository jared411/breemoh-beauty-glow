// Supabase Edge Function: sends email (Resend) and SMS (Africa's Talking)
// when a booking or order is created, and tells customers when a booking
// is confirmed or cancelled.
//
// Triggered by Database Webhooks (see README). Required secrets:
//   WEBHOOK_SECRET, OWNER_EMAIL, OWNER_PHONE (e.g. +254700000000)
//   RESEND_API_KEY, FROM_EMAIL           (email, optional)
//   AT_USERNAME, AT_API_KEY, AT_SENDER   (SMS, optional; AT_SENDER may be empty)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
const BRAND = "Bremoh Beauty Glow";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function normPhone(p: string): string {
  let d = p.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.startsWith("0")) d = "254" + d.slice(1);
  return "+" + d;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!env("RESEND_API_KEY") || !to) return;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("FROM_EMAIL") || `${BRAND} <onboarding@resend.dev>`, to: [to], subject, html }),
  });
  if (!r.ok) console.error("Email failed", r.status, await r.text());
}

async function sendSms(to: string, message: string) {
  if (!env("AT_API_KEY") || !to) return;
  const body = new URLSearchParams({ username: env("AT_USERNAME"), to: normPhone(to), message });
  if (env("AT_SENDER")) body.set("from", env("AT_SENDER"));
  const r = await fetch("https://api.africastalking.com/version1/messaging", {
    method: "POST",
    headers: { apiKey: env("AT_API_KEY"), Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) console.error("SMS failed", r.status, await r.text());
}

async function onBooking(type: string, rec: any, old: any) {
  const { data: svc } = await db.from("services").select("name").eq("id", rec.service_id).maybeSingle();
  const service = svc?.name ?? "a service";
  const when = `${rec.booking_date} at ${String(rec.booking_time).slice(0, 5)}`;

  if (type === "INSERT") {
    await Promise.all([
      sendEmail(env("OWNER_EMAIL"), `New booking: ${rec.customer_name}`,
        `<h3>New booking request</h3><p><b>${esc(rec.customer_name)}</b> (${esc(rec.phone)}${rec.email ? ", " + esc(rec.email) : ""})<br>
         ${esc(service)}<br>${esc(when)}<br>${esc(rec.notes ?? "")}</p>`),
      sendSms(env("OWNER_PHONE"), `${BRAND}: new booking from ${rec.customer_name} (${rec.phone}) for ${service}, ${when}.`),
      rec.email
        ? sendEmail(rec.email, `We received your booking - ${BRAND}`,
            `<p>Hi ${esc(rec.customer_name)}, thank you for booking <b>${esc(service)}</b> on ${esc(when)}. We will contact you shortly to confirm.</p>`)
        : Promise.resolve(),
    ]);
  } else if (type === "UPDATE" && old && old.status !== rec.status && ["confirmed", "cancelled"].includes(rec.status)) {
    const word = rec.status === "confirmed" ? "confirmed" : "cancelled";
    await Promise.all([
      sendSms(rec.phone, `${BRAND}: your booking for ${service} on ${when} has been ${word}.`),
      rec.email
        ? sendEmail(rec.email, `Your booking is ${word} - ${BRAND}`,
            `<p>Hi ${esc(rec.customer_name)}, your booking for <b>${esc(service)}</b> on ${esc(when)} has been <b>${word}</b>.</p>`)
        : Promise.resolve(),
    ]);
  }
}

async function onOrder(type: string, rec: any, old: any) {
  const lines = (rec.items as any[]).map((i) => `${i.qty} x ${i.name}`).join(", ");
  const total = Number(rec.total).toLocaleString();

  if (type === "INSERT") {
    await Promise.all([
      sendEmail(env("OWNER_EMAIL"), `New order: ${rec.customer_name}`,
        `<h3>New order</h3><p><b>${esc(rec.customer_name)}</b> (${esc(rec.phone)})<br>${esc(rec.address)}<br>${esc(lines)}<br><b>Total: ${total}</b></p>`),
      sendSms(env("OWNER_PHONE"), `${BRAND}: new order from ${rec.customer_name} (${rec.phone}). ${lines}. Total ${total}.`),
      rec.email
        ? sendEmail(rec.email, `We received your order - ${BRAND}`,
            `<p>Hi ${esc(rec.customer_name)}, thank you for your order: ${esc(lines)}. Total <b>${total}</b>. We will contact you to arrange payment and delivery.</p>`)
        : Promise.resolve(),
    ]);
  } else if (type === "UPDATE" && old && old.status !== rec.status && ["confirmed", "delivered", "cancelled"].includes(rec.status)) {
    await sendSms(rec.phone, `${BRAND}: your order is now ${rec.status}.`);
  }
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== env("WEBHOOK_SECRET") || !env("WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const { type, table, record, old_record } = await req.json();
    if (table === "bookings") await onBooking(type, record, old_record);
    else if (table === "orders") await onOrder(type, record, old_record);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
