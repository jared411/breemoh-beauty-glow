import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare("SELECT id, name, description, price, stock, image_url FROM products WHERE active = 1 ORDER BY created_at")
    .all();
  return json(results);
}
