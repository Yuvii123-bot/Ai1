/* ============================================================
   The Cabinet of Ten Wonders — gallery logic
   Icons: inline SVG (1.5px stroke, currentColor) — no emoji.
   See docs/design-system.md §5.
   ============================================================ */

/* js-gated pre-reveal state (see style.css) */
document.documentElement.classList.add("js");

/* ---------- inline SVG icon set (Phosphor/Lucide geometry) ---------- */
const svg = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

const ICONS = {
  /* orrery — sun, tilted orbit, moon on the rail */
  orrery: svg(`<circle cx="12" cy="12" r="4.2"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-22 12 12)"/><circle cx="18.8" cy="7" r="1.1" fill="currentColor" stroke="none"/>`),
  /* truesize — wireframe globe */
  truesize: svg(`<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3.3 9.4h17.4M3.3 14.6h17.4"/>`),
  /* darkforest — conifer, the forest that does not speak */
  darkforest: svg(`<path d="M12 3 7.1 10.3h2.7L5.5 17h13l-4.3-6.7h2.7L12 3Z"/><path d="M12 17v3.5M8.5 21h7"/>`),
  /* lifeseed — double helix */
  lifeseed: svg(`<path d="M8.2 3h7.6M8.2 21h7.6"/><path d="M9.7 3c0 4.2 4.6 4.8 4.6 9s-4.6 4.8-4.6 9"/><path d="M14.3 3c0 4.2-4.6 4.8-4.6 9s4.6 4.8 4.6 9"/><path d="M10.1 7.1h3.8M10.1 12h3.8M10.1 16.9h3.8"/>`),
  /* nepal — Himalaya with snow caps and a sun */
  nepal: svg(`<circle cx="17.4" cy="5.2" r="1.5"/><path d="m3.5 19 6.3-11.3 3.3 5.9 2.6-4 5 9.4H3.5Z"/><path d="M9.8 7.7l1.2 2.1 1.2-1.2"/>`),
  /* cartographer — compass rose */
  cartographer: svg(`<circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9 4.9-1.9Z"/>`),
  /* decoder — Rosetta languages */
  decoder: svg(`<path d="m3.6 8.3 5.4 5.4"/><path d="m2.7 13.2 5.4-5.4L11 4.2"/><path d="M2 5h9"/><path d="M6.6 2.4h1"/><path d="m21.6 21-4.2-9.3L13 21"/><path d="M14.9 17.2h4.9"/>`),
  /* leak detector — scan corners around a lens */
  leak: svg(`<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="11.4" cy="11.4" r="3.1"/><path d="m16.1 16.1 4 4"/>`),
  /* alchemist's meter — conical flask */
  meter: svg(`<path d="M9.6 3h4.8"/><path d="M10.3 3v5.5L5.1 17.3a2 2 0 0 0 1.9 2.7h10a2 2 0 0 0 1.9-2.7L13.7 8.5V3"/><path d="M7.4 14.4h9.2"/>`),
  /* cabinet archive — skeleton key, the tenth wonder */
  cabinet: svg(`<circle cx="8" cy="15.6" r="4.4"/><path d="m11.6 12.1 8.6-8.6"/><path d="m15.8 8 2.6 2.6M13.1 10.7l2.6 2.6"/>`),
};

const EXHIBITS = [
  {
    n: "I", slug: "orrery", room: "exhibits/10-orrery/index.html",
    title: "The Working Orrery",
    icon: "orrery", tag: "astronomy",
    blurb: "The solar system, alive. Every planet in true relative orbit around a real star, at speeds you can slow to a crawl or spin forward a century."
  },
  {
    n: "II", slug: "truesize", room: "exhibits/03-truesize/index.html",
    title: "True Size",
    icon: "truesize", tag: "perspective",
    blurb: "174 real countries, decoded offline. Drag any of them to the equator and watch the map's lie collapse to true scale."
  },
  {
    n: "III", slug: "darkforest", room: "exhibits/07-darkforest/index.html",
    title: "The Dark Forest",
    icon: "darkforest", tag: "simulation",
    blurb: "Four thousand civilisations, alone in the dark. Five billion years in ninety seconds — and two hypotheses that end very differently."
  },
  {
    n: "IV", slug: "lifeseed", room: "exhibits/04-lifeseed/index.html",
    title: "Life Seed",
    icon: "lifeseed", tag: "life",
    blurb: "A living thing is born. Click, drag and hurt it and it flinches — a real creature inside a computer, with a heart, a mind and a memory."
  },
  {
    n: "V", slug: "nepal", room: "exhibits/01-nepal/index.html",
    title: "Nepal in the Palm",
    icon: "nepal", tag: "identity",
    blurb: "Learn Devanagari in an afternoon. Write Nepali on a real keyboard, hear every letter, convert dates to Bikram Sambat, and see the mountains."
  },
  {
    n: "VI", slug: "cartographer", room: "exhibits/06-cartographer/index.html",
    title: "The Cartographer's Secret",
    icon: "cartographer", tag: "geography",
    blurb: "A game you cannot cheat. Draw the borders of the world from memory — local storage names the places you were fooling yourself about."
  },
  {
    n: "VII", slug: "decoder", room: "exhibits/05-decoder/index.html",
    title: "Rosetta",
    icon: "decoder", tag: "language",
    blurb: "56 languages, 1,120 real translations, no labels. The machine rediscovers the family tree from the sound of the words — 97% pure on the groups it forms."
  },
  {
    n: "VIII", slug: "leak", room: "exhibits/02-leak/index.html",
    title: "The Leak Detector",
    icon: "leak", tag: "privacy",
    blurb: "Paste anything. It tells you what a stranger can work out about you — then assembles the stalker profile so you can see it. Nothing leaves your tab."
  },
  {
    n: "IX", slug: "meter", room: "exhibits/08-meter/index.html",
    title: "The Alchemist's Meter",
    icon: "meter", tag: "money",
    blurb: "Turns any job into a defensible price, a realistic schedule and a sendable proposal. Calibrated to real Nepali rates — use it to earn."
  },
  {
    n: "X", slug: "cabinet", room: "exhibits/09-cabinet/index.html",
    title: "The Cabinet Archive",
    icon: "cabinet", tag: "craft",
    blurb: "The tenth wonder is the other nine. This page fetches every exhibit, parses it, compiles its scripts, and tells you the truth about what is here."
  }
];

const $ = (s, r = document) => r.querySelector(s);

/* ---------- build cards ---------- */
const grid = $("#grid");
grid.setAttribute("role", "list");
EXHIBITS.forEach((ex, i) => {
  const card = document.createElement("a");
  card.className = "card";
  card.href = "#" + ex.slug;
  card.dataset.slug = ex.slug;
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-label", `Exhibit ${ex.n}: ${ex.title}`);
  card.innerHTML = `
    <div class="card-top">
      <span class="card-num">${String(i + 1).padStart(2, "0")} / ${ex.n}</span>
      <span class="card-tag${["money", "privacy"].includes(ex.tag) ? " hot" : ""}">${ex.tag}</span>
    </div>
    <div class="card-glyph" aria-hidden="true">${ICONS[ex.icon] || ""}</div>
    <div class="card-body">
      <h3>${ex.title}</h3>
      <p>${ex.blurb}</p>
      <div class="card-cta">View exhibit <span aria-hidden="true">⟶</span></div>
    </div>`;
  card.addEventListener("click", e => { e.preventDefault(); open(ex.slug); });
  grid.appendChild(card);
});

/* ---------- reveal on scroll (fails open: no IO ⇒ everything visible) ---------- */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const cards = document.querySelectorAll(".card");
if (reduceMotion.matches || !("IntersectionObserver" in window)) {
  cards.forEach(c => c.classList.add("in"));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en, i) => {
      if (en.isIntersecting) {
        setTimeout(() => en.target.classList.add("in"), (i % 3) * 90);
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.15 });
  cards.forEach(c => io.observe(c));
}

/* ---------- theatre (modal dialog) ---------- */
const theatre = $("#theatre"), stage = $("#stage"),
      tTitle = $("#tTitle"), tNum = $("#tNum"), popout = $("#popout");

let lastScroll = 0;
let lastTrigger = null;

function open(slug) {
  const ex = EXHIBITS.find(e => e.slug === slug);
  if (!ex) return;
  lastScroll = window.scrollY;
  lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  tNum.textContent = ex.n;
  tTitle.textContent = ex.title;
  stage.src = ex.room;
  popout.href = ex.room;
  theatre.hidden = false;
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", "#" + slug);
  stage.focus();
}

function close() {
  theatre.hidden = true;
  stage.src = "about:blank";
  document.body.style.overflow = "";
  history.replaceState(null, "", " ");
  window.scrollTo(0, lastScroll);
  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  lastTrigger = null;
}

$("#backBtn").addEventListener("click", e => { e.preventDefault(); close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !theatre.hidden) close(); });

/* deep-link support */
window.addEventListener("load", () => {
  const slug = location.hash.replace("#", "");
  if (slug && EXHIBITS.some(e => e.slug === slug)) open(slug);
});

/* ---------- the honest stat: count every line we actually shipped ---------- */
(async () => {
  const el = document.getElementById("locCount");
  if (!el) return;
  try {
    const files = [
      "index.html", "assets/style.css", "assets/app.js",
      ...EXHIBITS.map(e => e.room),
    ];
    let total = 0;
    for (const f of files) {
      const t = await fetch(f).then(r => r.ok ? r.text() : "");
      total += t ? t.split("\n").length : 0;
    }
    if (reduceMotion.matches) { el.textContent = total.toLocaleString(); return; }
    let cur = 0;
    const step = () => {
      cur += Math.max(1, Math.ceil((total - cur) / 14));
      if (cur >= total) { el.textContent = total.toLocaleString(); return; }
      el.textContent = cur.toLocaleString();
      requestAnimationFrame(step);
    };
    step();
  } catch (e) { el.textContent = "—"; }
})();
