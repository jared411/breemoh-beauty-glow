(function () {
  const C = window.BBG_CONFIG;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => `${C.CURRENCY} ${Number(n).toLocaleString()}`;
  const flash = (el, ok, text) => { el.className = "msg " + (ok ? "ok" : "err"); el.textContent = text; };
  const A = "/api/admin/";

  let services = [], products = [];

  // ---------- Auth ----------
  async function checkSession() {
    try { await api(A + "me"); } catch (e) { return showLogin(); }
    $("login").classList.add("hidden");
    $("dash").classList.remove("hidden");
    loadAll();
  }
  function showLogin() { $("login").classList.remove("hidden"); $("dash").classList.add("hidden"); }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api(A + "login", { method: "POST", body: { password: $("l-pass").value } });
      $("l-pass").value = "";
      checkSession();
    } catch (err) { flash($("login-msg"), false, err.message); }
  });
  $("logout").addEventListener("click", async () => {
    try { await api(A + "logout", { method: "POST", body: {} }); } catch (e) {}
    showLogin();
  });

  // Any admin call that comes back 401 sends you to the login screen
  async function call(path, options) {
    try { return await api(A + path, options); }
    catch (err) { if (err.status === 401) showLogin(); throw err; }
  }

  // ---------- Tabs ----------
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    ["bookings", "services", "gallery", "products", "orders"].forEach((t) => $("tab-" + t).classList.toggle("hidden", t !== b.dataset.tab));
  }));

  function loadAll() { loadServices(); loadBookings(); loadGallery(); loadProducts(); loadOrders(); }

  // ---------- Image upload (resized in the browser to keep files small) ----------
  function resizeToBase64(file, maxSide = 1000, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image")); };
      img.src = url;
    });
  }
  async function uploadImage(file) {
    const data = await resizeToBase64(file);
    const res = await call("upload", { method: "POST", body: { content_type: "image/jpeg", data } });
    return res.url;
  }

  // ---------- Bookings ----------
  async function loadBookings() {
    const body = $("bookings-body");
    let rows;
    try { rows = await call("bookings"); } catch (e) { body.innerHTML = '<tr><td colspan="5">Could not load bookings.</td></tr>'; return; }
    const f = $("status-filter").value;
    if (f) rows = rows.filter((b) => b.status === f);
    if (!rows.length) { body.innerHTML = '<tr><td colspan="5">No bookings yet.</td></tr>'; return; }
    body.innerHTML = rows.map((b) => `
      <tr>
        <td>${esc(b.booking_date)}<br>${esc(b.booking_time)}</td>
        <td><strong>${esc(b.customer_name)}</strong><br>
            <a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>${b.email ? `<br>${esc(b.email)}` : ""}
            ${b.notes ? `<br><em>${esc(b.notes)}</em>` : ""}</td>
        <td>${esc(b.service_name || "-")}</td>
        <td><span class="badge ${esc(b.status)}">${esc(b.status)}</span></td>
        <td><div class="actions-cell">
          ${["confirmed", "completed", "cancelled"].filter((s) => s !== b.status).map((s) =>
            `<button class="btn small outline" data-status="${s}" data-id="${esc(b.id)}">${s}</button>`).join("")}
          <button class="btn small danger" data-del="${esc(b.id)}">Delete</button>
        </div></td>
      </tr>`).join("");
  }
  $("bookings-body").addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.status) {
        await call("bookings/" + t.dataset.id, { method: "PATCH", body: { status: t.dataset.status } });
        loadBookings();
      } else if (t.dataset.del && confirm("Delete this booking?")) {
        await call("bookings/" + t.dataset.del, { method: "DELETE" });
        loadBookings();
      }
    } catch (err) { alert(err.message); }
  });
  $("status-filter").addEventListener("change", loadBookings);
  $("refresh").addEventListener("click", loadBookings);

  // ---------- Services ----------
  async function loadServices() {
    try { services = await call("services"); } catch (e) { services = []; }
    $("services-body").innerHTML = services.map((s) => `
      <tr>
        <td><strong>${esc(s.name)}</strong><br><small>${esc(s.description || "")}</small></td>
        <td>${money(s.price)}</td><td>${s.duration_minutes} min</td>
        <td>${s.active ? "Yes" : "No"}</td>
        <td><div class="actions-cell">
          <button class="btn small outline" data-edit="${esc(s.id)}">Edit</button>
          <button class="btn small danger" data-sdel="${esc(s.id)}">Delete</button>
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
      const s = services.find((x) => x.id === t.dataset.edit);
      $("sf-id").value = s.id; $("sf-name").value = s.name; $("sf-price").value = s.price;
      $("sf-duration").value = s.duration_minutes; $("sf-desc").value = s.description || "";
      $("sf-active").checked = !!s.active; $("sf-title").textContent = "Edit service";
      $("sf-cancel").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.sdel && confirm("Delete this service? Existing bookings keep their record.")) {
      try { await call("services/" + t.dataset.sdel, { method: "DELETE" }); loadServices(); } catch (err) { alert(err.message); }
    }
  });
  $("service-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("sf-msg");
    try {
      const row = {
        name: $("sf-name").value,
        price: Number($("sf-price").value),
        duration_minutes: Number($("sf-duration").value),
        description: $("sf-desc").value,
        active: $("sf-active").checked
      };
      const file = $("sf-image").files[0];
      if (file) row.image_url = await uploadImage(file);
      const id = $("sf-id").value;
      await call(id ? "services/" + id : "services", { method: id ? "PUT" : "POST", body: row });
      flash(msg, true, "Saved.");
      resetServiceForm(); loadServices();
    } catch (err) { flash(msg, false, "Could not save: " + err.message); }
  });

  // ---------- Gallery ----------
  async function loadGallery() {
    let rows = [];
    try { rows = await call("gallery"); } catch (e) {}
    $("gallery-admin").innerHTML = rows.map((g) => `
      <div>
        <img src="${esc(g.image_url)}" alt="${esc(g.caption || "")}" loading="lazy">
        <button class="btn small danger" data-gdel="${esc(g.id)}" style="margin-top:6px;width:100%">Delete</button>
      </div>`).join("") || "<p>No photos yet.</p>";
  }
  $("gallery-admin").addEventListener("click", async (e) => {
    if (e.target.dataset.gdel && confirm("Remove this photo?")) {
      try { await call("gallery/" + e.target.dataset.gdel, { method: "DELETE" }); loadGallery(); } catch (err) { alert(err.message); }
    }
  });
  $("gallery-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("gf-msg");
    try {
      const url = await uploadImage($("gf-file").files[0]);
      await call("gallery", { method: "POST", body: { image_url: url, caption: $("gf-caption").value } });
      flash(msg, true, "Uploaded.");
      e.target.reset(); loadGallery();
    } catch (err) { flash(msg, false, "Upload failed: " + err.message); }
  });

  // ---------- Products ----------
  async function loadProducts() {
    try { products = await call("products"); } catch (e) { products = []; }
    $("products-body").innerHTML = products.map((p) => `
      <tr>
        <td><strong>${esc(p.name)}</strong><br><small>${esc(p.description || "")}</small></td>
        <td>${money(p.price)}</td>
        <td>${p.stock}</td>
        <td>${p.active ? "Yes" : "No"}</td>
        <td><div class="actions-cell">
          <button class="btn small outline" data-pedit="${esc(p.id)}">Edit</button>
          <button class="btn small danger" data-pdel="${esc(p.id)}">Delete</button>
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
      const p = products.find((x) => x.id === t.dataset.pedit);
      $("pf-id").value = p.id; $("pf-name").value = p.name; $("pf-price").value = p.price;
      $("pf-stock").value = p.stock; $("pf-desc").value = p.description || "";
      $("pf-active").checked = !!p.active; $("pf-title").textContent = "Edit product";
      $("pf-cancel").classList.remove("hidden"); window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (t.dataset.pdel && confirm("Delete this product?")) {
      try { await call("products/" + t.dataset.pdel, { method: "DELETE" }); loadProducts(); } catch (err) { alert(err.message); }
    }
  });
  $("product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("pf-msg");
    try {
      const row = {
        name: $("pf-name").value,
        price: Number($("pf-price").value),
        stock: parseInt($("pf-stock").value, 10),
        description: $("pf-desc").value,
        active: $("pf-active").checked
      };
      const file = $("pf-image").files[0];
      if (file) row.image_url = await uploadImage(file);
      const id = $("pf-id").value;
      await call(id ? "products/" + id : "products", { method: id ? "PUT" : "POST", body: row });
      flash(msg, true, "Saved.");
      resetProductForm(); loadProducts();
    } catch (err) { flash(msg, false, "Could not save: " + err.message); }
  });

  // ---------- Orders ----------
  async function loadOrders() {
    const body = $("orders-body");
    let rows;
    try { rows = await call("orders"); } catch (e) { body.innerHTML = '<tr><td colspan="6">Could not load orders.</td></tr>'; return; }
    const f = $("order-filter").value;
    if (f) rows = rows.filter((o) => o.status === f);
    if (!rows.length) { body.innerHTML = '<tr><td colspan="6">No orders yet.</td></tr>'; return; }
    const badge = { new: "pending", confirmed: "confirmed", delivered: "completed", cancelled: "cancelled" };
    body.innerHTML = rows.map((o) => `
      <tr>
        <td>${esc(o.created_at)}</td>
        <td><strong>${esc(o.customer_name)}</strong><br>
            <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>${o.email ? `<br>${esc(o.email)}` : ""}<br>
            <small>${esc(o.address)}</small></td>
        <td>${(o.items || []).map((i) => `${esc(i.qty)} x ${esc(i.name)}`).join("<br>")}</td>
        <td>${money(o.total)}</td>
        <td><span class="badge ${badge[o.status] || ""}">${esc(o.status)}</span></td>
        <td><div class="actions-cell">
          ${["confirmed", "delivered", "cancelled"].filter((s) => s !== o.status).map((s) =>
            `<button class="btn small outline" data-ostatus="${s}" data-id="${esc(o.id)}">${s}</button>`).join("")}
          <button class="btn small danger" data-odel="${esc(o.id)}">Delete</button>
        </div></td>
      </tr>`).join("");
  }
  $("orders-body").addEventListener("click", async (e) => {
    const t = e.target;
    try {
      if (t.dataset.ostatus) {
        await call("orders/" + t.dataset.id, { method: "PATCH", body: { status: t.dataset.ostatus } });
        loadOrders(); loadProducts();
      } else if (t.dataset.odel && confirm("Delete this order?")) {
        await call("orders/" + t.dataset.odel, { method: "DELETE" });
        loadOrders();
      }
    } catch (err) { alert(err.message); }
  });
  $("order-filter").addEventListener("change", loadOrders);
  $("order-refresh").addEventListener("click", loadOrders);

  checkSession();
})();
