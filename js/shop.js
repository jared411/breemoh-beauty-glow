(function () {
  const C = window.BBG_CONFIG;
  const $ = (id) => document.getElementById(id);
  const money = (n) => `${C.CURRENCY} ${Number(n).toLocaleString()}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CART_KEY = "bbg_cart";

  $("yr").textContent = new Date().getFullYear();

  let products = [];
  let cart = {}; // { productId: qty }
  try { cart = JSON.parse(localStorage.getItem("bbg_cart") || "{}") || {}; } catch (e) { cart = {}; }
  const saveCart = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} };

  if (C.SUPABASE_URL.includes("YOUR-PROJECT")) {
    $("products-grid").innerHTML = '<p class="section-sub">Site not connected yet. Add your Supabase keys in js/config.js.</p>';
    return;
  }
  const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  // ----- Drawer -----
  const openCart = () => { $("cart").classList.remove("hidden"); $("cart-overlay").classList.remove("hidden"); };
  const closeCart = () => { $("cart").classList.add("hidden"); $("cart-overlay").classList.add("hidden"); };
  $("cart-open").addEventListener("click", openCart);
  $("cart-close").addEventListener("click", closeCart);
  $("cart-overlay").addEventListener("click", closeCart);

  // ----- Products -----
  async function loadProducts() {
    const { data, error } = await db.from("products").select("*").eq("active", true).order("created_at");
    if (error) { $("products-grid").innerHTML = '<p class="section-sub">Could not load products.</p>'; return; }
    products = data;
    if (!data.length) { $("products-grid").innerHTML = '<p class="section-sub">Products coming soon.</p>'; return; }

    $("products-grid").innerHTML = data.map((p) => `
      <div class="card">
        <div class="img">${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">` : "&#129524;"}</div>
        <div class="body">
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description)}</p>
          <div class="meta"><span class="price">${money(p.price)}</span>
            <span>${p.stock > 0 ? (p.stock <= 5 ? `Only ${p.stock} left` : "In stock") : "Sold out"}</span></div>
          <button class="btn small" data-add="${p.id}" style="margin-top:12px" ${p.stock < 1 ? "disabled" : ""}>Add to cart</button>
        </div>
      </div>`).join("");
    pruneCart();
    renderCart();
  }

  $("products-grid").addEventListener("click", (e) => {
    const id = e.target.dataset.add;
    if (!id) return;
    const p = products.find((x) => x.id === id);
    if (!p) return;
    cart[id] = Math.min((cart[id] || 0) + 1, p.stock, 20);
    saveCart(); renderCart(); openCart();
  });

  // Drop items that no longer exist or are out of stock
  function pruneCart() {
    Object.keys(cart).forEach((id) => {
      const p = products.find((x) => x.id === id);
      if (!p || p.stock < 1) delete cart[id];
      else cart[id] = Math.min(cart[id], p.stock, 20);
    });
    saveCart();
  }

  // ----- Cart -----
  function renderCart() {
    const ids = Object.keys(cart).filter((id) => products.some((p) => p.id === id));
    $("cart-count").textContent = ids.reduce((n, id) => n + cart[id], 0);
    if (!ids.length) {
      $("cart-items").innerHTML = '<p style="color:var(--muted);padding:12px 0">Your cart is empty.</p>';
      $("cart-total").textContent = money(0);
      $("checkout-form").classList.add("hidden");
      return;
    }
    $("checkout-form").classList.remove("hidden");
    let total = 0;
    $("cart-items").innerHTML = ids.map((id) => {
      const p = products.find((x) => x.id === id);
      total += p.price * cart[id];
      return `<div class="cart-line">
        <div><strong>${esc(p.name)}</strong><br><small>${money(p.price)}</small></div>
        <div class="qty">
          <button type="button" data-dec="${id}" aria-label="Decrease">-</button>
          <span>${cart[id]}</span>
          <button type="button" data-inc="${id}" aria-label="Increase">+</button>
        </div>
      </div>`;
    }).join("");
    $("cart-total").textContent = money(total);
  }

  $("cart-items").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.inc) {
      const p = products.find((x) => x.id === t.dataset.inc);
      cart[t.dataset.inc] = Math.min((cart[t.dataset.inc] || 0) + 1, p.stock, 20);
    } else if (t.dataset.dec) {
      cart[t.dataset.dec] = (cart[t.dataset.dec] || 0) - 1;
      if (cart[t.dataset.dec] < 1) delete cart[t.dataset.dec];
    } else return;
    saveCart(); renderCart();
  });

  // ----- Checkout (server calculates prices via place_order) -----
  $("checkout-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("checkout-msg");
    const btn = e.target.querySelector("button[type=submit]");
    msg.className = "msg";
    const items = Object.keys(cart).map((id) => ({ id, qty: cart[id] }));
    if (!items.length) return;
    btn.disabled = true;

    const { error } = await db.rpc("place_order", {
      p_name: $("c-name").value,
      p_phone: $("c-phone").value,
      p_email: $("c-email").value,
      p_address: $("c-address").value,
      p_items: items
    });

    btn.disabled = false;
    if (error) {
      msg.className = "msg err";
      msg.textContent = /stock|unavailable/i.test(error.message)
        ? "Sorry, an item just went out of stock. Please review your cart."
        : "Sorry, we could not place your order. Please check your details or contact us on WhatsApp.";
      loadProducts();
      return;
    }
    cart = {}; saveCart(); e.target.reset();
    msg.className = "msg ok";
    msg.textContent = "Thank you! Your order was received. We'll contact you shortly.";
    loadProducts();
  });

  renderCart();
  loadProducts();
})();
