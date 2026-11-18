import { json, fail, uid, clean, clientIp, readJson, rateLimited, isEmail } from "../_lib/util.js";
import { notifyNewOrder } from "../_lib/notify.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const waitUntil = (p) => context.waitUntil(p);
  const body = await readJson(request);
  if (!body) return fail("Invalid request");

  const name = clean(body.customer_name, 80);
  const phone = clean(body.phone, 20);
  const email = clean(body.email, 120);
  const address = clean(body.address, 300);
  const items = Array.isArray(body.items) ? body.items : [];

  if (name.length < 2) return fail("Please enter your name");
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return fail("Please enter a valid phone number");
  if (email && !isEmail(email)) return fail("Please enter a valid email");
  if (address.length < 3) return fail("Please enter a delivery address");
  if (items.length < 1 || items.length > 30) return fail("Your cart is empty or too large");

  if (await rateLimited(env.DB, `order-ip:${clientIp(request)}`, 10, 3600) ||
      await rateLimited(env.DB, `order-phone:${digits}`, 5, 3600)) {
    return fail("Too many requests. Please try again later or contact us on WhatsApp.", 429);
  }

  // Merge duplicate lines, validate quantities
  const wanted = new Map();
  for (const it of items) {
    const id = clean(it?.id, 64);
    const qty = Number.parseInt(it?.qty, 10);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 20) return fail("Invalid quantity");
    wanted.set(id, (wanted.get(id) || 0) + qty);
  }

  // Price everything on the server and reserve stock. If any line fails, put back what we took.
  const taken = [];
  const snapshot = [];
  let total = 0;
  const rollback = async () => {
    for (const t of taken) {
      await env.DB.prepare("UPDATE products SET stock = stock + ?1 WHERE id = ?2").bind(t.qty, t.id).run();
    }
  };

  for (const [id, qty] of wanted) {
    const p = await env.DB.prepare("SELECT id, name, price FROM products WHERE id = ?1 AND active = 1").bind(id).first();
    if (!p || qty > 20) { await rollback(); return fail("Sorry, an item is unavailable. Please review your cart.", 409); }
    const upd = await env.DB
      .prepare("UPDATE products SET stock = stock - ?1 WHERE id = ?2 AND active = 1 AND stock >= ?1")
      .bind(qty, id).run();
    if (!upd.meta || upd.meta.changes !== 1) {
      await rollback();
      return fail(`Sorry, not enough stock for ${p.name}.`, 409);
    }
    taken.push({ id, qty });
    total += p.price * qty;
    snapshot.push({ id: p.id, name: p.name, price: p.price, qty });
  }

  const order = {
    id: uid(), customer_name: name, phone, email: email || null, address,
    items: JSON.stringify(snapshot), total,
  };
  try {
    await env.DB.prepare(
      "INSERT INTO orders (id, customer_name, phone, email, address, items, total) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).bind(order.id, order.customer_name, order.phone, order.email, order.address, order.items, order.total).run();
  } catch (e) {
    await rollback();
    return fail("Could not place your order. Please try again.", 500);
  }

  const lines = snapshot.map((i) => `${i.qty} x ${i.name}`).join(", ");
  waitUntil(notifyNewOrder(env, order, lines));
  return json({ ok: true }, 201);
}
