import { json } from "../_lib/util.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB
    .prepare("SELECT id, image_url, caption FROM gallery ORDER BY created_at DESC LIMIT 24")
    .all();
  return json(results);
}
