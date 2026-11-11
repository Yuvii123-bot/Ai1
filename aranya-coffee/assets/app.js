/* ============================================================
   ARANYA — Himalayan Roastery · interactive layer
   Cart (localStorage) · Sunday Club · brew calculator · FAQ
   ============================================================ */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const USD_RATE = 133; // indicative NPR per USD
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const reduceMotion = (typeof window.matchMedia === "function") ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
const fmt = (npr) => store.get("aranya.ccy", "NPR") === "NPR"
  ? `Rs ${Math.round(npr).toLocaleString("en-IN")}`
  : `$${(npr / USD_RATE).toFixed(2)}`;

/* ─────────── product catalogue ─────────── */
const PRODUCTS = [
  {
    id: "ridge", name: "Ridge No 1", origin: "Gulmi · Washed · Typica",
    notes: ["Bergamot", "Apricot", "Cane sugar"], process: "Washed",
    altitude: "1,600–1,850 m", cup: 88.5, roast: 2, img: "assets/img/bag-ridge.jpg",
    alt: "Matte black ARANYA Ridge No 1 bag, gold serif lettering, scattered beans",
    prices: { 250: 1350, 500: 2500 },
  },
  {
    id: "fogline", name: "Fog Line", origin: "Arghakhanchi · Honey · Bourbon",
    notes: ["Milk chocolate", "Orange zest", "Brown butter"], process: "Honey",
    altitude: "1,450–1,700 m", cup: 87.25, roast: 3, img: "assets/img/bag-fogline.jpg",
    alt: "Kraft-cream ARANYA Fog Line bag with terracotta lettering",
    prices: { 250: 1450, 500: 2700 },
  },
  {
    id: "midnight", name: "Midnight", origin: "Sindhupalchowk · Natural · Typica",
    notes: ["Black cherry", "Cocoa nib", "Molasses"], process: "Natural",
    altitude: "1,300–1,600 m", cup: 86.75, roast: 5, img: "assets/img/bag-midnight.jpg",
    alt: "Deep brown ARANYA Midnight bag with burnt-orange lettering and moonlit rim light",
    prices: { 250: 1550, 500: 2900 },
  },
];
const sizeOf = (el) => Number(el.dataset.size || 250);

function productCard(p) {
  const card = document.createElement("article");
  card.className = "product";
  card.dataset.id = p.id;
  card.innerHTML = `
    <img class="product-img" src="${p.img}" alt="${p.alt}" width="1408" height="768" loading="lazy" />
    <div class="product-body">
      <div class="product-top">
        <span class="product-badge">${p.process} process</span>
        <span class="product-score">Cup <b>${p.cup}</b></span>
      </div>
      <h3 class="product-name">${p.name}</h3>
      <p class="product-origin">${p.origin} · ${p.altitude}</p>
      <div class="notes">${p.notes.map(n => `<span class="note-chip">${n}</span>`).join("")}</div>
      <div class="product-meta">
        <div class="roast-meter" aria-label="Roast level ${p.roast} of 5" role="img">
          <span>Roast</span>
          ${[1,2,3,4,5].map(i => `<i class="roast-dot${i <= p.roast ? " full" : ""}"></i>`).join("")}
        </div>
      </div>
      <div class="buy-row">
        <div class="price"><b data-price>Rs ${p.prices[250].toLocaleString("en-IN")}</b><small data-price-alt>for 250 g</small></div>
        <div class="size-group" role="group" aria-label="Bag size">
          <button type="button" class="size-btn is-active" data-size="250" aria-pressed="true">250 g</button>
          <button type="button" class="size-btn" data-size="500" aria-pressed="false">500 g</button>
        </div>
      </div>
      <button type="button" class="btn btn-gold add-btn">Add to basket
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    </div>`;
  const priceEl = $("[data-price]", card), altEl = $("[data-price-alt]", card);
  const paint = () => {
    const size = sizeOf($(".size-btn.is-active", card));
    priceEl.textContent = fmt(p.prices[size]);
    altEl.textContent = `for ${size} g`;
  };
  $$(".size-btn", card).forEach(btn => btn.addEventListener("click", () => {
    $$(".size-btn", card).forEach(b => { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
    paint();
  }));
  $(".add-btn", card).addEventListener("click", () => addToCart(p.id, sizeOf($(".size-btn.is-active", card))));
  card._paint = paint;
  return card;
}
const grid = $("#productGrid");
const cards = PRODUCTS.map(p => { const c = productCard(p); grid.appendChild(c); return c; });
function repaintPrices() { cards.forEach(c => c._paint && c._paint()); }

/* currency toggle */
const ccy = store.get("aranya.ccy", "NPR");
$$(".currency-btn").forEach(btn => {
  const active = btn.dataset.ccy === ccy;
  btn.classList.toggle("is-active", active);
  btn.setAttribute("aria-pressed", String(active));
  btn.addEventListener("click", () => {
    store.set("aranya.ccy", btn.dataset.ccy);
    $$(".currency-btn").forEach(b => { const a = b.dataset.ccy === btn.dataset.ccy; b.classList.toggle("is-active", a); b.setAttribute("aria-pressed", String(a)); });
    repaintPrices(); renderCart();
  });
});
repaintPrices();

/* ─────────── cart ─────────── */
let cart = store.get("aranya.cart", []);
const productById = (id) => PRODUCTS.find(p => p.id === id);
const cartCount = () => cart.reduce((n, l) => n + l.qty, 0);
const cartValue = () => cart.reduce((sum, l) => sum + productById(l.id).prices[l.size] * l.qty, 0);
const DELIVERY_FREE_AT = 2500, DELIVERY_FEE = 150;

const cartDrawer = $("#cartDrawer"), scrim = $("#scrim"), cartItems = $("#cartItems"),
      cartEmpty = $("#cartEmpty"), cartSummary = $("#cartSummary"), cartCountEl = $("#cartCount");

function renderCart() {
  cartCountEl.textContent = String(cartCount());
  if (!cart.length) {
    cartEmpty.hidden = false; cartItems.hidden = true; cartSummary.hidden = true;
    return;
  }
  cartEmpty.hidden = true; cartItems.hidden = false; cartSummary.hidden = false;
  cartItems.innerHTML = cart.map(l => {
    const p = productById(l.id);
    return `<li class="cart-line" data-key="${l.id}-${l.size}">
      <img src="${p.img}" alt="${p.alt}" width="64" height="84" />
      <div class="cart-line-info">
        <div class="cart-line-name">${p.name}</div>
        <div class="cart-line-meta">${p.process} · ${l.size} g</div>
        <div class="qty" aria-label="Quantity of ${p.name} ${l.size} g">
          <button type="button" data-act="dec" aria-label="Decrease quantity">−</button>
          <span>${l.qty}</span>
          <button type="button" data-act="inc" aria-label="Increase quantity">+</button>
        </div>
      </div>
      <div class="cart-line-right">
        <span class="line-total">${fmt(p.prices[l.size] * l.qty)}</span>
        <button type="button" class="line-remove" data-act="remove">Remove</button>
      </div>
    </li>`;
  }).join("");
  const sub = cartValue();
  const delivery = sub >= DELIVERY_FREE_AT ? 0 : DELIVERY_FEE;
  $("#sumSubtotal").textContent = fmt(sub);
  $("#sumDelivery").textContent = delivery === 0 ? "Free" : fmt(delivery);
  $("#sumTotal").textContent = fmt(sub + delivery);
}
function addToCart(id, size) {
  const key = `${id}-${size}`;
  const line = cart.find(l => `${l.id}-${l.size}` === key);
  if (line) line.qty += 1; else cart.push({ id, size, qty: 1 });
  store.set("aranya.cart", cart);
  renderCart();
  cartCountEl.classList.remove("pop"); void cartCountEl.offsetWidth; cartCountEl.classList.add("pop");
  const p = productById(id);
  showToast(`${p.name} · ${size} g added to your basket`);
}
cartItems.addEventListener("click", e => {
  const btn = e.target.closest("[data-act]"); if (!btn) return;
  const li = btn.closest(".cart-line"); const [id, size] = li.dataset.key.split("-");
  const line = cart.find(l => l.id === id && l.size === Number(size)); if (!line) return;
  if (btn.dataset.act === "inc") line.qty = Math.min(20, line.qty + 1);
  if (btn.dataset.act === "dec") line.qty -= 1;
  if (btn.dataset.act === "remove" || line.qty <= 0) cart = cart.filter(l => l !== line);
  store.set("aranya.cart", cart);
  renderCart();
});
function openCart() {
  cartDrawer.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => { cartDrawer.classList.add("open"); scrim.classList.add("show"); });
  document.body.style.overflow = "hidden";
  $("#cartClose").focus();
}
function closeCart() {
  cartDrawer.classList.remove("open"); scrim.classList.remove("show");
  document.body.style.overflow = "";
  const done = () => { cartDrawer.hidden = true; scrim.hidden = true; cartDrawer.removeEventListener("transitionend", done); };
  if (reduceMotion.matches) done(); else cartDrawer.addEventListener("transitionend", done);
  $("#cartBtn").focus();
}
$("#cartBtn").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
$("#scrim").addEventListener("click", closeCart);
$("#emptyBrowse").addEventListener("click", () => { $("#shop").scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth" }); closeCart(); });

/* ─────────── reserve flow ─────────── */
const reserveModal = $("#reserveModal");
function refCode() { return "ARY-" + Date.now().toString(36).toUpperCase().slice(-4) + Math.random().toString(36).toUpperCase().slice(2, 5); }
$("#reserveBtn").addEventListener("click", () => {
  if (!cart.length) return;
  const units = cartCount(), total = cartValue() + (cartValue() >= DELIVERY_FREE_AT ? 0 : DELIVERY_FEE);
  $("#resRef").textContent = refCode();
  $("#resDetail").textContent = `${units} ${units === 1 ? "bag" : "bags"} · ${fmt(total)} · pickup at Jhamsikhel`;
  cart = []; store.set("aranya.cart", cart); renderCart();
  reserveModal.hidden = false;
  $("#resDone").focus();
});
function closeReserve() { reserveModal.hidden = true; $("#cartBtn").focus(); }
$("#resDone").addEventListener("click", closeReserve);
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (!reserveModal.hidden) { closeReserve(); return; }
  if (!cartDrawer.hidden) closeCart();
});

/* ─────────── brew calculator ─────────── */
const METHODS = [
  { id: "v60", label: "V60", mult: 15, temp: "94°C", time: "3:00", grind: "Medium-fine", unit: "ml", tip: "Bloom with 2× the dose of water for 30 s, then pour in slow spirals to full weight by 1:30." },
  { id: "aeropress", label: "AeroPress", mult: 13, temp: "85°C", time: "1:30", grind: "Medium-fine", unit: "ml", tip: "Immerse fully, stir five times, steep one minute, then press for thirty seconds." },
  { id: "french", label: "French Press", mult: 12, temp: "94°C", time: "4:00", grind: "Coarse", unit: "ml", tip: "Steep four minutes, skim the crust with two spoons, press slowly, decant immediately." },
  { id: "espresso", label: "Espresso", mult: 2, temp: "92°C", time: "26 s", grind: "Fine", unit: "g yield", tip: "18 g in, ~36 g out in 25–30 s. Choking? Grind coarser. Gushing? Finer." },
];
const methodGroup = $("#methodGroup");
METHODS.forEach((m, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "method-btn"; b.textContent = m.label; b.dataset.id = m.id;
  b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(i === 0));
  b.addEventListener("click", () => { methodGroup.dataset.active = m.id; paintBrew(); $$(".method-btn", methodGroup).forEach(o => o.setAttribute("aria-checked", String(o.dataset.id === m.id))); });
  methodGroup.appendChild(b);
});
methodGroup.dataset.active = "v60";
const doseRange = $("#doseRange"), doseOut = $("#doseOut");
function paintBrew() {
  const m = METHODS.find(x => x.id === methodGroup.dataset.active);
  const dose = Number(doseRange.value);
  const out = dose * m.mult;
  doseOut.textContent = `${dose} g`;
  $("#waterLabel").textContent = m.unit === "ml" ? "Water" : "Yield";
  $("#waterOut").textContent = String(Math.round(out));
  $("#waterUnit").textContent = m.unit === "ml" ? "ml" : "g";
  $("#timeOut").textContent = m.time;
  $("#tempOut").textContent = m.temp;
  $("#grindOut").textContent = m.grind;
  $("#ratioOut").textContent = `1 : ${m.mult}`;
  $("#ratioFill").style.width = `${Math.round(((m.mult - 2) / 13) * 78 + 22)}%`;
  $("#tipOut").textContent = m.tip;
}
doseRange.addEventListener("input", paintBrew);
paintBrew();

/* ─────────── Sunday Club ─────────── */
const TIERS = [
  { id: "explorer", name: "Explorer", grams: "250 g", price: 990, blurb: "a month, every month",
    features: ["250 g of the week's cup-score winner", "Roast preference honoured, light to dark", "Pause or cancel any month"] },
  { id: "enthusiast", name: "Enthusiast", grams: "500 g", price: 1750, blurb: "the enthusiast's dose",
    features: ["Two rotating 250 g lots, or 500 g of one", "Monthly cupping seat — first Sunday", "10% off additional bags"] },
  { id: "house", name: "The House", grams: "1 kg", price: 3100, blurb: "never run dry",
    features: ["1 kg of the table's top lot, every Sunday", "First refusal on micro-lots", "Free delivery ×2 a month", "Gulmi farm-visit lottery, annually"] },
];
const tierGroup = $("#tierGroup");
TIERS.forEach((t, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "tier"; b.dataset.id = t.id;
  b.setAttribute("role", "radio"); b.setAttribute("aria-checked", String(i === 1));
  b.innerHTML = `
    <span class="tier-name">${t.name}<span class="tier-radio"></span></span>
    <span class="tier-grams">${t.grams}<small> / month</small></span>
    <span class="tier-price"><b>${fmt(t.price)}</b> · ${t.blurb}</span>
    <ul>${t.features.map(f => `<li>${f}</li>`).join("")}</ul>`;
  b.addEventListener("click", () => $$(".tier", tierGroup).forEach(o => o.setAttribute("aria-checked", String(o === b))));
  tierGroup.appendChild(b);
});
tierGroup.dataset.selected = "enthusiast";
tierGroup.addEventListener("click", e => { const t = e.target.closest(".tier"); if (t) tierGroup.dataset.selected = t.dataset.id; });

const clubForm = $("#clubForm"), clubSuccess = $("#clubSuccess");
clubForm.addEventListener("submit", e => {
  e.preventDefault();
  const name = $("#clubName").value.trim(), email = $("#clubEmail").value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (name.length < 2 || !emailOk) { showToast("Please enter a valid name and email.", true); return; }
  const tier = TIERS.find(t => t.id === tierGroup.dataset.selected) || TIERS[1];
  const member = "ARY-" + String(Math.floor(1000 + Math.random() * 9000));
  store.set("aranya.club.member", { name, email, tier: tier.id, member, joined: new Date().toISOString() });
  $("#clubMemberNo").textContent = member;
  $("#clubTierOut").textContent = tier.name;
  clubForm.hidden = true; clubSuccess.hidden = false;
  showToast(`Welcome to The Sunday Club, ${name.split(" ")[0]}.`);
});

/* ─────────── reviews ─────────── */
const REVIEWS = [
  { quote: "The Fog Line is the best milk-chocolate cup I have had under Rs 1,500 — and I include hotels.", name: "Suvekshya R.", place: "Patan, Kathmandu" },
  { quote: "Ridge No 1 at 94 degrees with thirty seconds of bloom — bergamot on a Tuesday morning, like a postcard from Gulmi.", name: "Jonas M.", place: "Pokhara" },
  { quote: "Roasted on Sunday, in my basket Wednesday. The lot number on the bag is not decoration; it is accountability.", name: "Nirjala T.", place: "Baluwatar, Kathmandu" },
];
const star = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9 2.9-6z"/></svg>';
$$(".stars").forEach(el => { el.innerHTML = star.repeat(5); });
const reviewGrid = $("#reviewGrid");
REVIEWS.forEach(r => {
  const div = document.createElement("figure");
  div.className = "review";
  div.innerHTML = `<blockquote>&ldquo;${r.quote}&rdquo;</blockquote><footer><div class="review-name">${r.name}</div><div class="review-place">${r.place}</div></footer>`;
  reviewGrid.appendChild(div);
});

/* ─────────── FAQ ─────────── */
const FAQ = [
  { q: "How fast is delivery?", a: "Inside the Kathmandu Valley, 1–2 working days by Pathao/Daharahar. The rest of Nepal: 2–4 working days by air-linked courier. Rs 150 flat, free over Rs 2,500. We dispatch on Sunday and Wednesday, always roasted that week." },
  { q: "How fresh is the coffee, really?", a: "Roasted on Sunday, vacuum-and-valve sealed within four hours, and dated on the bag. Rest it 5–7 days after roast for filter, 10 for espresso. Six weeks of peak flavour; after that it is still good, just quieter." },
  { q: "How do I pay?", a: "Reserve online, pay at pickup or on delivery — eSewa, Khalti, card, bank transfer or cash. No card details ever touch this page; reservation just holds your bags." },
  { q: "How should I store it?", a: "Sealed, cool, dark and dry — the valve bag is enough for six weeks. Never the fridge (condensation is the enemy); a cupboard with the rice is fine. Grind just before brewing; whole bean keeps twice as long." },
  { q: "Do you supply cafés or offices?", a: "Yes — wholesale for cafés, hotels and offices across Nepal, with on-site calibration. Write to hello@aranya.coffee or visit the cupping table on Friday at 15:00; the kettle is always on." },
];
const faqList = $("#faqList");
FAQ.forEach((item, i) => {
  const id = `faq-${i}`;
  const div = document.createElement("div");
  div.className = "faq-item";
  div.dataset.open = i === 0 ? "true" : "false";
  div.innerHTML = `
    <button type="button" class="faq-q" id="${id}-btn" aria-expanded="${i === 0}" aria-controls="${id}-panel">
      ${item.q}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
    </button>
    <div class="faq-a" id="${id}-panel" role="region" aria-labelledby="${id}-btn"><div class="faq-a-inner"><p>${item.a}</p></div></div>`;
  $(".faq-q", div).addEventListener("click", () => {
    const open = div.dataset.open === "true";
    div.dataset.open = String(!open);
    $(".faq-q", div).setAttribute("aria-expanded", String(!open));
  });
  faqList.appendChild(div);
});

/* ─────────── newsletter ─────────── */
const newsForm = $("#newsForm");
newsForm.addEventListener("submit", e => {
  e.preventDefault();
  const email = $("#newsEmail").value.trim(), result = $("#newsResult");
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  if (!ok) { result.textContent = "That address doesn't look right."; result.classList.add("err"); return; }
  const subs = store.get("aranya.letters", []);
  if (!subs.includes(email)) { subs.push(email); store.set("aranya.letters", subs); }
  result.classList.remove("err");
  result.textContent = "See you on Sunday. The kettle is already on.";
  $("#newsEmail").value = "";
});

/* ─────────── toast ─────────── */
const toast = $("#toast");
let toastTimer = null;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.borderColor = isError ? "var(--danger)" : "";
  toast.style.color = isError ? "var(--danger)" : "";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

/* ─────────── chrome: year, nav scroll, marquee, reveals ─────────── */
$("#year").textContent = String(new Date().getFullYear());
const navBar = $("#navBar");
const onScroll = () => navBar.classList.toggle("scrolled", window.scrollY > 40);
window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

const track = $("#marqueeTrack");
if (track) track.innerHTML += track.innerHTML; // duplicate for a seamless -50% loop

const revealTargets = $$(".section-head, .product, .origin-media, .origin-copy, .ritual-controls, .recipe-card, .tier, .review, .review-summary, .faq-item, .club-form");
if ("IntersectionObserver" in window && !reduceMotion.matches) {
  revealTargets.forEach(el => el.classList.add("rv"));
  const io = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  revealTargets.forEach(el => io.observe(el));
}

renderCart();
