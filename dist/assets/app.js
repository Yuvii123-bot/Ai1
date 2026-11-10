/* ============================================================
   The Cabinet of Ten Wonders — gallery logic
   ============================================================ */
const EXHIBITS = [
  {
    n: "I", slug: "orrery", room: "exhibits/10-orrery/index.html",
    title: "The Working Orrery",
    glyph: "🪐", tag: "astronomy",
    blurb: "The solar system, alive. Every planet in true relative orbit around a real star, at speeds you can slow to a crawl or spin forward a century."
  },
  {
    n: "II", slug: "truesize", room: "exhibits/03-truesize/index.html",
    title: "True Size",
    glyph: "🌍", tag: "perspective",
    blurb: "174 real countries, decoded offline. Drag any of them to the equator and watch the map's lie collapse to true scale."
  },
  {
    n: "III", slug: "darkforest", room: "exhibits/07-darkforest/index.html",
    title: "The Dark Forest",
    glyph: "🌑", tag: "simulation",
    blurb: "Four thousand civilisations, alone in the dark. Five billion years in ninety seconds — and two hypotheses that end very differently."
  },
  {
    n: "IV", slug: "lifeseed", room: "exhibits/04-lifeseed/index.html",
    title: "Life Seed",
    glyph: "🧬", tag: "life",
    blurb: "A living thing is born. Click, drag and hurt it and it flinches — a real creature inside a computer, with a heart, a mind and a memory."
  },
  {
    n: "V", slug: "nepal", room: "exhibits/01-nepal/index.html",
    title: "Nepal in the Palm",
    glyph: "🇳🇵", tag: "identity",
    blurb: "Learn Devanagari in an afternoon. Write Nepali on a real keyboard, hear every letter, convert dates to Bikram Sambat, and see the mountains."
  },
  {
    n: "VI", slug: "cartographer", room: "exhibits/06-cartographer/index.html",
    title: "The Cartographer's Secret",
    glyph: "🗺", tag: "geography",
    blurb: "A game you cannot cheat. Draw the borders of the world from memory — local storage names the places you were fooling yourself about."
  },
  {
    n: "VII", slug: "decoder", room: "exhibits/05-decoder/index.html",
    title: "Rosetta",
    glyph: "📜", tag: "language",
    blurb: "56 languages, 1,120 real translations, no labels. The machine rediscovers the family tree from the sound of the words — 100% purity."
  },
  {
    n: "VIII", slug: "leak", room: "exhibits/02-leak/index.html",
    title: "The Leak Detector",
    glyph: "🔍", tag: "privacy",
    blurb: "Paste anything. It tells you what a stranger can work out about you — then assembles the stalker profile so you can see it. Nothing leaves your tab."
  },
  {
    n: "IX", slug: "meter", room: "exhibits/08-meter/index.html",
    title: "The Alchemist's Meter",
    glyph: "⚗️", tag: "money",
    blurb: "Turns any job into a defensible price, a realistic schedule and a sendable proposal. Calibrated to real Nepali rates — use it to earn."
  },
  {
    n: "X", slug: "cabinet", room: "exhibits/09-cabinet/index.html",
    title: "The Cabinet Archive",
    glyph: "🔑", tag: "craft",
    blurb: "The tenth wonder is the other nine. This page fetches every exhibit, parses it, compiles its scripts, and tells you the truth about what is here."
  }
];

const $ = (s, r = document) => r.querySelector(s);

/* ---------- build cards ---------- */
const grid = $("#grid");
EXHIBITS.forEach((ex, i) => {
  const card = document.createElement("a");
  card.className = "card";
  card.href = "#" + ex.slug;
  card.dataset.slug = ex.slug;
  card.innerHTML = `
    <div class="card-top">
      <span class="card-num">${String(i + 1).padStart(2, "0")} / ${ex.n}</span>
      <span class="card-tag${["money", "privacy"].includes(ex.tag) ? " hot" : ""}">${ex.tag}</span>
    </div>
    <div class="card-glyph">${ex.glyph}</div>
    <div class="card-body">
      <h3>${ex.title}</h3>
      <p>${ex.blurb}</p>
      <div class="card-cta">View exhibit <span>⟶</span></div>
    </div>`;
  card.addEventListener("click", e => { e.preventDefault(); open(ex.slug); });
  grid.appendChild(card);
});

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en, i) => {
    if (en.isIntersecting) {
      setTimeout(() => en.target.classList.add("in"), (i % 3) * 90);
      io.unobserve(en.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll(".card").forEach(c => io.observe(c));

/* ---------- theatre ---------- */
const theatre = $("#theatre"), stage = $("#stage"),
      tTitle = $("#tTitle"), tNum = $("#tNum"), popout = $("#popout");

let lastScroll = 0;

function open(slug) {
  const ex = EXHIBITS.find(e => e.slug === slug);
  if (!ex) return;
  lastScroll = window.scrollY;
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
}

$("#backBtn").addEventListener("click", e => { e.preventDefault(); close(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !theatre.hidden) close(); });

/* deep-link support */
window.addEventListener("load", () => {
  const slug = location.hash.replace("#", "");
  if (slug && EXHIBITS.some(e => e.slug === slug)) open(slug);
});

/* ---------- playful stat: rough LOC count ---------- */
fetch("assets/app.js").then(r => r.text()).then(() => {}).catch(() => {});
(async () => {
  try {
    let total = 0;
    const files = ["assets/style.css", "assets/app.js", "index.html"];
    for (const f of files) {
      const t = await fetch(f).then(r => r.text());
      total += t.split("\n").length;
    }
    const el = document.getElementById("locCount");
    let cur = 0, target = total;
    const step = () => {
      cur += Math.max(1, Math.ceil((target - cur) / 14));
      if (cur >= target) { el.textContent = target.toLocaleString() + "+"; return; }
      el.textContent = cur.toLocaleString();
      requestAnimationFrame(step);
    };
    step();
  } catch (e) {}
})();
