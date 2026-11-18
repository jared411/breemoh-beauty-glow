(function () {
  const C = window.BBG_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${C.CURRENCY} ${Number(n).toLocaleString()}`;
  const flash = (el, ok, text) => { el.className = "msg " + (ok ? "ok" : "err"); el.textContent = text; };

  const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
  let servicesCache = [];

  // ---------- Auth ----------
  async function checkSession() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return showLogin();
    const { data } = await db.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (!data) {
      await db.auth.signOut();
      flash($("login-msg"), false, "This account is not an admin.");
      return showLogin();
    }
    $("login").classList.add("hidden");
    $("dash").classList.remove("hidden");
    loadAll();
  }
  function showLogin() { $("login").classList.remove("hidden"); $("dash").classList.add("hidden"); }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await db.auth.signInWithPassword({ email: $("l-email").value, password: $("l-pass").value });
    if (error) return flash($("login-msg"), false, "Invalid email or password.");
    checkSession();
  });
  $("logout").addEventListener("click", async () => { await db.auth.signOut(); showLogin(); });

  // ---------- Tabs ----------
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ["bookings", "services", "gallery", "products", "orders"].forEach((t) => $("tab-" + t).classList.toggle("hidden", t !== b.dataset.tab));
  }));

  function loadAll() { loadServices().then(loadBookings); loadGallery(); loadProducts(); loadOrders(); }

  // ---------- Image upload ----------
  async function uploadImage(file) {
    const ext = file.name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from(C.BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return db.storage.from(C.BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // ---------- Bookings ----------
  async function loadBookings() {
    let q = db.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false });
    if ($("status-filter").value) q = q.eq("status", $("status-filter").value);
    const { data, error } = await q;
    const body = $("bookings-body");
    if (error) { body.innerHTML = '<tr><td colspan="5">Could not load bookings.</td></tr>'; return; }
    if (!data.length) { body.innerHTML = '<tr><td colspan="5">No bookings yet.</td></tr>'; return; }
    const sName = (id) => (servicesCache.find((s) => s.id === id) || {}).name || "-";
    body.innerHTML = data.map((b) => `
      <tr>
        <td>${esc(b.booking_date)}<br>${esc(String(b.booking_time).slice(0, 5))}</td>
        <td><strong>${esc(b.customer_name)}</strong><br>
            <a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>${b.email ? `<br>${esc(b.email)}` : ""}
            ${b.notes ? `<br><em>${esc(b.notes)}</em>` : ""}</td>
        <td>${esc(sName(b.service_id))}</td>
        <td><span class="badge ${esc(b.status)}">${esc(b.status)}</span></td>
        <td><div class="actions-cell">
          ${["confirmed", "completed", "cancelled"].filter((s) => s !== b.status).map((s) =>
            `<button class="btn small outline" data-status="${s}" data-id="${b.id}">${s}</button>`).join("")}
          <button class="btn small danger" data-del="${b.id}">Delete</button>
        </div></td>
      </tr>`).join("");
  }
  $("bookings-body").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.dataset.status) {
      await db.from("bookings").update({ status: t.dataset.status }).eq("id", t.dataset.id);
      loadBookings();
    } else if (t.dataset.del && confirm("Delete this booking?")) {
      await db.from("bookings").delete().eq("id", t.dataset.del);
      loadBookings();
    }
  });
  $("status-filter").addEventListener("change", loadBookings);
  $("refresh").addEventListener("click", loadBookings);

  // ---------- Services ----------
  async function loadServices() {
    const { data } = await db.from("services").select("*").order("created_at");
    servicesCache = data || [];
    $("services-body").innerHTML = servicesCache.map((s) => `
      <tr>
        <td><strong>${esc(s.name)}</strong><br><small>${esc(s.description || "")}</small></td>
        <td>${money(s.price)}</td><td>${s.duration_minutes} min</td>
        <td>${s.active ? "Yes" : "No"}</td>
        <td><div class="actions-cell">
          <button class="btn small outline" data-edit="${s.id}">Edit</button>
          <button class="btn small danger" data-sdel="${s.id}">Delete</button>
        </div></td>
      </tr>`).join("") || '<tr><td colspan="5">No services yet.</td></tr>';
  }
  function resetServiceForm() {
    $("service-form").reset();
    $("sf-id").value = ""; $("sf-title").textContent = "Add service"; $("sf-cancel").classList.add("hidden");
  }
  $("sf-cancel").addEventListener("click", resetServiceForm);
  $("services-body").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.dataset.edit) {
      const s = servicesCache.find((x) => x.id === t.dataset.edit);
      $("sf-id").value = s.id; $("sf-name").value = s.name; $("sf-price").value = s.price;
      $("sf-duration").value = s.duration_minutes; $("sf-desc").value = s.description || "";
      $("sf-active").checked = s.active; $("sf-title").textContent = "Edit service";
      $("sf-cancel").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.sdel && confirm("Delete this service? Existing bookings keep their record.")) {
      await db.from("services").delete().eq("id", t.dataset.sdel);
      loadServices();
    }
  });
  $("service-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("sf-msg");
    try {
      const row = {
        name: $("sf-name").value.trim(),
        price: Number($("sf-price").value),
        duration_minutes: Number($("sf-duration").value),
        description: $("sf-desc").value.trim(),
        active: $("sf-active").checked
      };
      const file = $("sf-image").files[0];
      if (file) row.image_url = await uploadImage(file);
      const id = $("sf-id").value;
      const { error } = id ? await db.from("services").update(row).eq("id", id) : await db.from("services").insert(row);
      if (error) throw error;
      flash(msg, true, "Saved.");
      resetServiceForm(); loadServices();
    } catch (err) { flash(msg, false, "Could not save: " + (err.message || "error")); }
  });

  // ---------- Gallery ----------
  async function loadGallery() {
    const { data } = await db.from("gallery").select("*").order("created_at", { ascending: false });
    $("gallery-admin").innerHTML = (data || []).map((g) => `
      <div>
        <img src="${esc(g.image_url)}" alt="${esc(g.caption || "")}" loading="lazy">
        <button class="btn small danger" data-gdel="${g.id}" style="margin-top:6px;width:100%">Delete</button>
      </div>`).join("") || "<p>No photos yet.</p>";
  }
  $("gallery-admin").addEventListener("click", async (e) => {
    if (e.target.dataset.gdel && confirm("Remove this photo?")) {
      await db.from("gallery").delete().eq("id", e.target.dataset.gdel);
      loadGallery();
    }
  });
  $("gallery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("gf-msg");
    try {
      const url = await uploadImage($("gf-file").files[0]);
      const { error } = await db.from("gallery").insert({ image_url: url, caption: $("gf-caption").value.trim() || null });
      if (error) throw error;
      flash(msg, true, "Uploaded.");
      e.target.reset(); loadGallery();
    } catch (err) { flash(msg, false, "Upload failed: " + (err.message || "error")); }
  });

  // ---------- Products ----------
  let productsCache = [];
  async function loadProducts() {
    const { data, error } = await db.from("products").select("*").order("created_at");
    if (error) { $("products-body").innerHTML = '<tr><td colspan="5">Shop tables not found. Run supabase/schema_v2.sql.</td></tr>'; return; }
    productsCache = data || [];
    $("products-body").innerHTML = productsCache.map((p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong><br><small>${esc(p.description || "")}</small></td>
        <td>${money(p.price)}</td>
        <td>${p.stock}</td>
        <td>${p.active ? "Yes" : "No"}</td>
        <td><div class="actions-cell">
          <button class="btn small outline" data-pedit="${p.id}">Edit</button>
          <button class="btn small danger" data-pdel="${p.id}">Delete</button>
        </div></td>
      </tr>`).join("") || '<tr><td colspan="5">No products yet.</td></tr>';
  }
  function resetProductForm() {
    $("product-form").reset();
    $("pf-id").value = ""; $("pf-title").textContent = "Add product"; $("pf-cancel").classList.add("hidden");
  }
  $("pf-cancel").addEventListener("click", resetProductForm);
  $("products-body").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.dataset.pedit) {
      const p = productsCache.find((x) => x.id === t.dataset.pedit);
      $("pf-id").value = p.id; $("pf-name").value = p.name; $("pf-price").value = p.price;
      $("pf-stock").value = p.stock; $("pf-desc").value = p.description || "";
      $("pf-active").checked = p.active; $("pf-title").textContent = "Edit product";
      $("pf-cancel").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.pdel && confirm("Delete this product?")) {
      await db.from("products").delete().eq("id", t.dataset.pdel);
      loadProducts();
    }
  });
  $("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("pf-msg");
    try {
      const row = {
        name: $("pf-name").value.trim(),
        price: Number($("pf-price").value),
        stock: parseInt($("pf-stock").value, 10),
        description: $("pf-desc").value.trim(),
        active: $("pf-active").checked
      };
      const file = $("pf-image").files[0];
      if (file) row.image_url = await uploadImage(file);
      const id = $("pf-id").value;
      const { error } = id ? await db.from("products").update(row).eq("id", id) : await db.from("products").insert(row);
      if (error) throw error;
      flash(msg, true, "Saved.");
      resetProductForm(); loadProducts();
    } catch (err) { flash(msg, false, "Could not save: " + (err.message || "error")); }
  });

  // ---------- Orders ----------
  async function loadOrders() {
    let q = db.from("orders").select("*").order("created_at", { ascending: false });
    if ($("order-filter").value) q = q.eq("status", $("order-filter").value);
    const { data, error } = await q;
    const body = $("orders-body");
    if (error) { body.innerHTML = '<tr><td colspan="6">Shop tables not found. Run supabase/schema_v2.sql.</td></tr>'; return; }
    if (!data.length) { body.innerHTML = '<tr><td colspan="6">No orders yet.</td></tr>'; return; }
    const badge = { new: "pending", confirmed: "confirmed", delivered: "completed", cancelled: "cancelled" };
    body.innerHTML = data.map((o) => `
      <tr>
        <td>${esc(new Date(o.created_at).toLocaleString())}</td>
        <td><strong>${esc(o.customer_name)}</strong><br>
            <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.email ? `<br>${esc(o.email)}` : ""}<br>
            <small>${esc(o.address)}</small></td>
        <td>${(o.items || []).map((i) => `${esc(i.qty)} x ${esc(i.name)}`).join("<br>")}</td>
        <td>${money(o.total)}</td>
        <td><span class="badge ${badge[o.status] || ""}">${esc(o.status)}</span></td>
        <td><div class="actions-cell">
          ${["confirmed", "delivered", "cancelled"].filter((s) => s !== o.status).map((s) =>
            `<button class="btn small outline" data-ostatus="${s}" data-id="${o.id}">${s}</button>`).join("")}
          <button class="btn small danger" data-odel="${o.id}">Delete</button>
        </div></td>
      </tr>`).join("");
  }
  $("orders-body").addEventListener("click", async (e) => {
    const t = e.target;
    if (t.dataset.ostatus) {
      await db.from("orders").update({ status: t.dataset.ostatus }).eq("id", t.dataset.id);
      loadOrders();
    } else if (t.dataset.odel && confirm("Delete this order?")) {
      await db.from("orders").delete().eq("id", t.dataset.odel);
      loadOrders();
    }
  });
  $("order-filter").addEventListener("change", loadOrders);
  $("order-refresh").addEventListener("click", loadOrders);

  checkSession();
})();
