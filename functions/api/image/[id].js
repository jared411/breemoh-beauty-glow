// Serves an uploaded image from D1.
export async function onRequestGet({ env, params }) {
  const id = String(params.id || "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });

  const row = await env.DB.prepare("SELECT content_type, data FROM images WHERE id = ?1").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });

  const bin = atob(row.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      "Content-Type": row.content_type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
