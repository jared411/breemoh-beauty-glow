import { json, fail, uid, clean, clientIp, readJson, rateLimited, isDate, isTime, isEmail } from "../_lib/util.js";
import { notifyNewBooking } from "../_lib/notify.js";

// Today's date in Nairobi (UTC+3), as YYYY-MM-DD
const todayNairobi = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

export async function onRequestPost(context) {
  const { request, env } = context;
  const waitUntil = (p) => context.waitUntil(p);
  const body = await readJson(request);
  if (!body) return fail("Invalid request");

  const name = clean(body.customer_name, 80);
  const phone = clean(body.phone, 20);
  const email = clean(body.email, 120);
  const notes = clean(body.notes, 500);
  const date = clean(body.booking_date, 10);
  const time = clean(body.booking_time, 5);
  const serviceId = clean(body.service_id, 64);

  if (name.length < 2) return fail("Please enter your name");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return fail("Please enter a valid phone number");
  if (email && !isEmail(email)) return fail("Please enter a valid email");
  if (!isDate(date) || date < todayNairobi()) return fail("Please choose a valid future date");
  if (!isTime(time) || time < "08:00" || time > "19:00") return fail("Please choose a time between 08:00 and 19:00");

  if (await rateLimited(env.DB, `book-ip:${clientIp(request)}`, 10, 3600) ||
      await rateLimited(env.DB, `book-phone:${digits}`, 5, 3600)) {
    return fail("Too many requests. Please try again later or contact us on WhatsApp.", 429);
  }

  const svc = await env.DB.prepare("SELECT id, name FROM services WHERE id = ?1 AND active = 1").bind(serviceId).first();
  if (!svc) return fail("Please choose a service");

  const booking = {
    id: uid(), service_id: svc.id, customer_name: name, phone, email: email || null,
    booking_date: date, booking_time: time, notes: notes || null,
  };
  await env.DB.prepare(
    `INSERT INTO bookings (id, service_id, customer_name, phone, email, booking_date, booking_time, notes)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
  ).bind(booking.id, booking.service_id, booking.customer_name, booking.phone, booking.email,
         booking.booking_date, booking.booking_time, booking.notes).run();

  waitUntil(notifyNewBooking(env, booking, svc.name));
  return json({ ok: true }, 201);
}
