(function () {
  const C = window.BBG_CONFIG;
  const $ = (id) => document.getElementById(id);
  const money = (n) => `${C.CURRENCY} ${Number(n).toLocaleString()}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Contact links
  $("yr").textContent = new Date().getFullYear();
  const waUrl = `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent("Hello Bremoh Beauty Glow, I'd like to book an appointment.")}`;
  $("wa-link").href = waUrl;
  $("wa-float").href = waUrl;
  $("tel-link").href = `tel:${C.PHONE_DISPLAY.replace(/\s/g, "")}`;
  $("tel-link").textContent = C.PHONE_DISPLAY;
  $("mail-link").href = `mailto:${C.EMAIL}`;
  $("mail-link").textContent = C.EMAIL;

  // Date: no past dates
  $("date").min = new Date().toISOString().split("T")[0];

  async function loadServices() {
    let data;
    try { data = await api("/api/services"); }
    catch (e) { $("services-grid").innerHTML = '<p class="section-sub">Could not load services.</p>'; return; }
    if (!data.length) { $("services-grid").innerHTML = '<p class="section-sub">Services coming soon.</p>'; return; }

    $("services-grid").innerHTML = data.map((s) => `
      <div class="card">
        <div class="img">${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" loading="lazy">` : "&#10024;"}</div>
        <div class="body">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.description)}</p>
          <div class="meta"><span class="price">${money(s.price)}</span><span>${s.duration_minutes} min</span></div>
          <a href="#book" class="btn small" data-service="${esc(s.id)}" style="margin-top:12px">Book this</a>
        </div>
      </div>`).join("");

    $("service").innerHTML = '<option value="">Select a service</option>' +
      data.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} - ${money(s.price)}</option>`).join("");

    document.querySelectorAll("[data-service]").forEach((b) =>
      b.addEventListener("click", () => { $("service").value = b.dataset.service; }));
  }

  async function loadGallery() {
    let data = [];
    try { data = await api("/api/gallery"); } catch (e) { /* hide section below */ }
    const g = $("gallery-grid");
    if (!data.length) { g.closest("section").style.display = "none"; return; }
    g.innerHTML = data.map((i) => `<img src="${esc(i.image_url)}" alt="${esc(i.caption || "Bremoh Beauty Glow work")}" loading="lazy">`).join("");
  }

  $("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("booking-msg");
    const btn = e.target.querySelector("button");
    msg.className = "msg";
    btn.disabled = true;

    try {
      await api("/api/bookings", {
        method: "POST",
        body: {
          service_id: $("service").value,
          customer_name: $("name").value,
          phone: $("phone").value,
          email: $("email").value,
          booking_date: $("date").value,
          booking_time: $("time").value,
          notes: $("notes").value
        }
      });
      msg.className = "msg ok";
      msg.textContent = "Thank you! Your booking request was received. We'll contact you to confirm.";
      e.target.reset();
    } catch (err) {
      msg.className = "msg err";
      msg.textContent = err.status === 400 || err.status === 429
        ? err.message
        : "Sorry, something went wrong. Please try again or contact us on WhatsApp.";
    }
    btn.disabled = false;
  });

  loadServices();
  loadGallery();
})();
