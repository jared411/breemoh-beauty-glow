// All owner-only endpoints live here: /api/admin/<resource>[/<id>]
import { json, fail, uid, clean, clientIp, readJson, rateLimited } from "../../_lib/util.js";
import { isAdmin, makeSessionCookie, clearSessionCookie, safeEqual } from "../../_lib/auth.js";
import { notifyBookingStatus, notifyOrderStatus } from "../../_lib/notify.js";

const IMG_URL = /^\/api\/image\/[0-9a-f-]{36}$/;
const MAX_IMAGE_B64 = 1_400_000; // keeps each D1 row safely under its size limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

// Column rules for each editable resource. Each function returns a clean value or undefined (= invalid).
const RESOURCES = {
  services: {
    cols: {
      name: (v) => (clean(v, 80).length >= 2 ? clean(v, 80) : undefined),
      description: (v) => clean(v, 500),
      price: (v) => num(v, 0, 10_000_000) ?? undefined,
      duration_minutes: (v) => { const n = num(v, 5, 1440); return n === null ? undefined : Math.round(n); },
      image_url: (v) => (!v ? null : IMG_URL.test(v) ? v : undefined),
      active: (v) => (v ? 1 : 0),
    },
    required: ["name", "price", "duration_minutes"],
    order: "created_at",
  },
  products: {
    cols: {
      name: (v) => (clean(v, 80).length >= 2 ? clean(v, 80) : undefined),
      description: (v) => clean(v, 500),
      price: (v) => num(v, 0, 10_000_000) ?? undefined,
      stock: (v) => { const n = num(v, 0, 100000); return n === null ? undefined : Math.round(n); },
      image_url: (v) => (!v ? null : IMG_URL.test(v) ? v : undefined),
      active: (v) => (v ? 1 : 0),
    },
    required: ["name", "price", "stock"],
    order: "created_at",
  },
  gallery: {
    cols: {
      image_url: (v) => (IMG_URL.test(v || "") ? v : undefined),
      caption: (v) => clean(v, 120) || null,
    },
    required: ["image_url"],
    order: "created_at DESC",
  },
};

const idFromUrl = (url) => (url && IMG_URL.test(url) ? url.split("/").pop() : null);
const dropImage = (env, url) => {
  const id = idFromUrl(url);
  return id ? env.DB.prepare("DELETE FROM images WHERE id = ?1").bind(id).run() : null;
};

export async function onRequest(context) {
  const { request, env, params } = context;
  const waitUntil = (p) => context.waitUntil(p);
  const path = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const [resource, id] = path;
  const method = request.method;

  // Block cross-site writes
  if (method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== new URL(request.url).host) return fail("Forbidden", 403);
  }

  // ----- Auth endpoints -----
  if (resource === "login" && method === "POST") {
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return fail("Admin login is not configured yet.", 500);
    const ip = clientIp(request);
    if (await rateLimited(env.DB, `login:${ip}`, 8, 900)) return fail("Too many attempts. Try again in 15 minutes.", 429);
    const body = await readJson(request);
    const ok = body && typeof body.password === "string" &&
      (await safeEqual(body.password, env.ADMIN_PASSWORD, env.SESSION_SECRET));
    if (!ok) return fail("Incorrect password", 401);
    return json({ ok: true }, 200, { "Set-Cookie": await makeSessionCookie(env) });
  }
  if (resource === "logout" && method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }

  if (!(await isAdmin(request, env))) return fail("Not signed in", 401);
  if (resource === "me") return json({ ok: true });

  // ----- Image upload -----
  if (resource === "upload" && method === "POST") {
    const body = await readJson(request);
    if (!body || !ALLOWED_TYPES.includes(body.content_type)) return fail("Use a JPG, PNG or WebP image");
    const data = String(body.data || "");
    if (!data || data.length > MAX_IMAGE_B64 || !/^[A-Za-z0-9+/=]+$/.test(data)) return fail("Image is too large or invalid");
    const imgId = uid();
    await env.DB.prepare("INSERT INTO images (id, content_type, data) VALUES (?1, ?2, ?3)")
      .bind(imgId, body.content_type, data).run();
    return json({ url: `/api/image/${imgId}` }, 201);
  }

  // ----- Bookings -----
  if (resource === "bookings") {
    if (method === "GET") {
      const { results } = await env.DB.prepare(
        `SELECT b.*, s.name AS service_name FROM bookings b LEFT JOIN services s ON s.id = b.service_id
         ORDER BY b.booking_date DESC, b.booking_time DESC LIMIT 500`
      ).all();
      return json(results);
    }
    if (id && method === "PATCH") {
      const body = await readJson(request);
      const status = body?.status;
      if (!["pending", "confirmed", "completed", "cancelled"].includes(status)) return fail("Invalid status");
      const b = await env.DB.prepare(
        "SELECT b.*, s.name AS service_name FROM bookings b LEFT JOIN services s ON s.id = b.service_id WHERE b.id = ?1"
      ).bind(id).first();
      if (!b) return fail("Not found", 404);
      await env.DB.prepare("UPDATE bookings SET status = ?1 WHERE id = ?2").bind(status, id).run();
      if (b.status !== status) waitUntil(notifyBookingStatus(env, b, b.service_name || "your service", status));
      return json({ ok: true });
    }
    if (id && method === "DELETE") {
      await env.DB.prepare("DELETE FROM bookings WHERE id = ?1").bind(id).run();
      return json({ ok: true });
    }
  }

  // ----- Orders -----
  if (resource === "orders") {
    if (method === "GET") {
      const { results } = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 500").all();
      return json(results.map((o) => ({ ...o, items: safeParse(o.items) })));
    }
    if (id && method === "PATCH") {
      const body = await readJson(request);
      const status = body?.status;
      if (!["new", "confirmed", "delivered", "cancelled"].includes(status)) return fail("Invalid status");
      const o = await env.DB.prepare("SELECT * FROM orders WHERE id = ?1").bind(id).first();
      if (!o) return fail("Not found", 404);
      await env.DB.prepare("UPDATE orders SET status = ?1 WHERE id = ?2").bind(status, id).run();
      // Cancelling an order puts the stock back (once)
      if (status === "cancelled" && o.status !== "cancelled") {
        for (const it of safeParse(o.items)) {
          await env.DB.prepare("UPDATE products SET stock = stock + ?1 WHERE id = ?2").bind(it.qty, it.id).run();
        }
      }
      if (o.status !== status) waitUntil(notifyOrderStatus(env, o, status));
      return json({ ok: true });
    }
    if (id && method === "DELETE") {
      await env.DB.prepare("DELETE FROM orders WHERE id = ?1").bind(id).run();
      return json({ ok: true });
    }
  }

  // ----- Services / products / gallery (generic CRUD) -----
  const cfg = RESOURCES[resource];
  if (cfg) {
    if (method === "GET" && !id) {
      const { results } = await env.DB.prepare(`SELECT * FROM ${resource} ORDER BY ${cfg.order}`).all();
      return json(results);
    }

    if ((method === "POST" && !id) || (method === "PUT" && id)) {
      const body = await readJson(request);
      if (!body) return fail("Invalid request");
      const values = {};
      for (const [col, check] of Object.entries(cfg.cols)) {
        if (col in body) {
          const v = check(body[col]);
          if (v === undefined) return fail(`Invalid value for ${col}`);
          values[col] = v;
        }
      }
      if (method === "POST") {
        for (const r of cfg.required) if (!(r in values)) return fail(`Missing ${r}`);
        const newId = uid();
        const cols = ["id", ...Object.keys(values)];
        await env.DB.prepare(`INSERT INTO ${resource} (${cols.join(",")}) VALUES (${cols.map((_, i) => `?${i + 1}`).join(",")})`)
          .bind(newId, ...Object.values(values)).run();
        return json({ id: newId }, 201);
      }
      const keys = Object.keys(values);
      if (!keys.length) return fail("Nothing to update");
      const old = await env.DB.prepare(`SELECT image_url FROM ${resource} WHERE id = ?1`).bind(id).first();
      if (!old) return fail("Not found", 404);
      await env.DB.prepare(`UPDATE ${resource} SET ${keys.map((k, i) => `${k} = ?${i + 1}`).join(", ")} WHERE id = ?${keys.length + 1}`)
        .bind(...Object.values(values), id).run();
      if ("image_url" in values && old.image_url && old.image_url !== values.image_url) waitUntil(Promise.resolve(dropImage(env, old.image_url)));
      return json({ ok: true });
    }

    if (method === "DELETE" && id) {
      const old = await env.DB.prepare(`SELECT image_url FROM ${resource} WHERE id = ?1`).bind(id).first();
      await env.DB.prepare(`DELETE FROM ${resource} WHERE id = ?1`).bind(id).run();
      if (old?.image_url) waitUntil(Promise.resolve(dropImage(env, old.image_url)));
      return json({ ok: true });
    }
  }

  return fail("Not found", 404);
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return []; }
}
