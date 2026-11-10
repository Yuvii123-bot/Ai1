/* ============================================================
   NEPAL IN THE PALM — engine
   Devanagari is an abugida: consonants carry an inherent 'a'
   unless a vowel sign (matra) attaches to them. This engine
   implements that rule, plus halant/virama stacking, and the
   full Bikram Sambat calendar (BS 2000–2090).
   ============================================================ */

/* ---------- Bikram Sambat ---------- */
const BS_MONTHS = {"2000":[30,32,31,32,31,30,30,30,29,30,29,31],"2001":[31,31,32,31,31,31,30,29,30,29,30,30],"2002":[31,31,32,32,31,30,30,29,30,29,30,30],"2003":[31,32,31,32,31,30,30,30,29,29,30,31],"2004":[30,32,31,32,31,30,30,30,29,30,29,31],"2005":[31,31,32,31,31,31,30,29,30,29,30,30],"2006":[31,31,32,32,31,30,30,29,30,29,30,30],"2007":[31,32,31,32,31,30,30,30,29,29,30,31],"2008":[31,31,31,32,31,31,29,30,30,29,29,31],"2009":[31,31,32,31,31,31,30,29,30,29,30,30],"2010":[31,31,32,32,31,30,30,29,30,29,30,30],"2011":[31,32,31,32,31,30,30,30,29,29,30,31],"2012":[31,31,31,32,31,31,29,30,30,29,30,30],"2013":[31,31,32,31,31,31,30,29,30,29,30,30],"2014":[31,31,32,32,31,30,30,29,30,29,30,30],"2015":[31,32,31,32,31,30,30,30,29,29,30,31],"2016":[31,31,31,32,31,31,29,30,30,29,30,30],"2017":[31,31,32,31,31,31,30,29,30,29,30,30],"2018":[31,32,31,32,31,30,30,29,30,29,30,30],"2019":[31,32,31,32,31,30,30,30,29,30,29,31],"2020":[31,31,31,32,31,31,30,29,30,29,30,30],"2021":[31,31,32,31,31,31,30,29,30,29,30,30],"2022":[31,32,31,32,31,30,30,30,29,29,30,30],"2023":[31,32,31,32,31,30,30,30,29,30,29,31],"2024":[31,31,31,32,31,31,30,29,30,29,30,30],"2025":[31,31,32,31,31,31,30,29,30,29,30,30],"2026":[31,32,31,32,31,30,30,30,29,29,30,31],"2027":[30,32,31,32,31,30,30,30,29,30,29,31],"2028":[31,31,32,31,31,31,30,29,30,29,30,30],"2029":[31,31,32,31,32,30,30,29,30,29,30,30],"2030":[31,32,31,32,31,30,30,30,29,29,30,31],"2031":[30,32,31,32,31,30,30,30,29,30,29,31],"2032":[31,31,32,31,31,31,30,29,30,29,30,30],"2033":[31,31,32,32,31,30,30,29,30,29,30,30],"2034":[31,32,31,32,31,30,30,30,29,29,30,31],"2035":[30,32,31,32,31,31,29,30,30,29,29,31],"2036":[31,31,32,31,31,31,30,29,30,29,30,30],"2037":[31,31,32,32,31,30,30,29,30,29,30,30],"2038":[31,32,31,32,31,30,30,30,29,29,30,31],"2039":[31,31,31,32,31,31,29,30,30,29,30,30],"2040":[31,31,32,31,31,31,30,29,30,29,30,30],"2041":[31,31,32,32,31,30,30,29,30,29,30,30],"2042":[31,32,31,32,31,30,30,30,29,29,30,31],"2043":[31,31,31,32,31,31,29,30,30,29,30,30],"2044":[31,31,32,31,31,31,30,29,30,29,30,30],"2045":[31,32,31,32,31,30,30,29,30,29,30,30],"2046":[31,32,31,32,31,30,30,30,29,29,30,31],"2047":[31,31,31,32,31,31,30,29,30,29,30,30],"2048":[31,31,32,31,31,31,30,29,30,29,30,30],"2049":[31,32,31,32,31,30,30,30,29,29,30,30],"2050":[31,32,31,32,31,30,30,30,29,30,29,31],"2051":[31,31,31,32,31,31,30,29,30,29,30,30],"2052":[31,31,32,31,31,31,30,29,30,29,30,30],"2053":[31,32,31,32,31,30,30,30,29,29,30,30],"2054":[31,32,31,32,31,30,30,30,29,30,29,31],"2055":[31,31,32,31,31,31,30,29,30,29,30,30],"2056":[31,31,32,31,32,30,30,29,30,29,30,30],"2057":[31,32,31,32,31,30,30,30,29,29,30,31],"2058":[30,32,31,32,31,30,30,30,29,30,29,31],"2059":[31,31,32,31,31,31,30,29,30,29,30,30],"2060":[31,31,32,32,31,30,30,29,30,29,30,30],"2061":[31,32,31,32,31,30,30,30,29,29,30,31],"2062":[30,32,31,32,31,31,29,30,29,30,29,31],"2063":[31,31,32,31,31,31,30,29,30,29,30,30],"2064":[31,31,32,32,31,30,30,29,30,29,30,30],"2065":[31,32,31,32,31,30,30,30,29,29,30,31],"2066":[31,31,31,32,31,31,29,30,30,29,29,31],"2067":[31,31,32,31,31,31,30,29,30,29,30,30],"2068":[31,31,32,32,31,30,30,29,30,29,30,30],"2069":[31,32,31,32,31,30,30,30,29,29,30,31],"2070":[31,31,31,32,31,31,29,30,30,29,30,30],"2071":[31,31,32,31,31,31,30,29,30,29,30,30],"2072":[31,32,31,32,31,30,30,29,30,29,30,30],"2073":[31,32,31,32,31,30,30,30,29,29,30,31],"2074":[31,31,31,32,31,31,30,29,30,29,30,30],"2075":[31,31,32,31,31,31,30,29,30,29,30,30],"2076":[31,32,31,32,31,30,30,30,29,29,30,30],"2077":[31,32,31,32,31,30,30,30,29,30,29,31],"2078":[31,31,31,32,31,31,30,29,30,29,30,30],"2079":[31,31,32,31,31,31,30,29,30,29,30,30],"2080":[31,32,31,32,31,30,30,30,29,29,30,30],"2081":[31,32,31,32,31,30,30,30,29,30,29,31],"2082":[31,31,32,31,31,31,30,29,30,29,30,30],"2083":[31,31,32,31,31,31,30,29,30,29,30,30],"2084":[31,31,32,31,31,30,30,30,29,30,30,30],"2085":[31,32,31,32,30,31,30,30,29,30,30,30],"2086":[30,32,31,32,31,30,30,30,29,30,30,30],"2087":[31,31,32,31,31,31,30,30,29,30,30,30],"2088":[30,31,32,32,30,31,30,30,29,30,30,30],"2089":[30,32,31,32,31,30,30,30,29,30,30,30],"2090":[30,32,31,32,31,30,30,30,29,30,30,30]};

const BS_NAMES = ['Baisakh','Jestha','Asar','Shrawan','Bhadra','Aswin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
const BS_NE   = ['बैशाख','जेठ','असार','श्रावण','भाद्र','आश्विन','कार्तिक','मंसिर','पौष','माघ','फाल्गुन','चैत'];
const BS_EPOCH = Date.UTC(1943, 3, 14);   // 1 Baisakh 2000 = 14 April 1943

function bsDays(y){ return BS_MONTHS[y].reduce((a,b)=>a+b,0); }

function adToBs(y, m, d){
  const dt = Date.UTC(y, m-1, d);
  let days = Math.round((dt - BS_EPOCH) / 86400000);
  let by = 2000;
  while(BS_MONTHS[by] && days >= bsDays(by)){ days -= bsDays(by); by++; }
  if(!BS_MONTHS[by]) return null;
  let bm = 1;
  while(days >= BS_MONTHS[by][bm-1]){ days -= BS_MONTHS[by][bm-1]; bm++; }
  return { y: by, m: bm, d: days+1 };
}
function bsToAd(by, bm, bd){
  if(!BS_MONTHS[by]) return null;
  let days = 0;
  for(let y=2000; y<by; y++) days += bsDays(y);
  for(let m=1; m<bm; m++) days += BS_MONTHS[by][m-1];
  days += bd-1;
  return new Date(BS_EPOCH + days*86400000);
}
function bsDayOfWeek(by,bm,bd){
  const dt = bsToAd(by,bm,bd);
  return dt ? dt.getUTCDay() : 0;
}

/* ---------- Devanagari model ---------- */
/* independent vowels */
const VOWELS = {
  'a':  {ch:'अ', matra:''},
  'aa': {ch:'आ', matra:'ा'},
  'i':  {ch:'इ', matra:'ि'},
  'ii': {ch:'ई', matra:'ी'},
  'u':  {ch:'उ', matra:'ु'},
  'uu': {ch:'ऊ', matra:'ू'},
  'e':  {ch:'ए', matra:'े'},
  'ai': {ch:'ऐ', matra:'ै'},
  'o':  {ch:'ओ', matra:'ो'},
  'au': {ch:'औ', matra:'ौ'},
  'ri': {ch:'ऋ', matra:'ृ'},
};

/* consonants: key -> [letter, name, english hint]
   Scheme: plain letters are DENTAL (t, th, d, dh, n);
   capitals are RETROFLEX (T, Th, D, Dh, N). sh = श, Sh = ष. */
const CONS = [
  ['k','क','ka','unaspirated k, as in "skip"'],
  ['kh','ख','kha','aspirated k, a puff of air'],
  ['g','ग','ga','g as in "go"'],
  ['gh','घ','gha','aspirated g'],
  ['ng','ङ','nga','ng as in "sing"'],
  ['ch','च','cha','unaspirated ch'],
  ['chh','छ','chha','aspirated ch'],
  ['j','ज','ja','j as in "jump"'],
  ['jh','झ','jha','aspirated j'],
  ['ny','ञ','nya','ny as in "canyon"'],
  ['T','ट','Ta','retroflex t — tongue curled to the roof'],
  ['T.','ट','Ta','retroflex t'],
  ['Th','ठ','Tha','aspirated retroflex t'],
  ['D','ड','Da','retroflex d'],
  ['D.','ड','Da','retroflex d'],
  ['Dh','ढ','Dha','aspirated retroflex d'],
  ['N','ण','Na','retroflex n'],
  ['t','त','ta','dental t — tongue touches the teeth'],
  ['th','थ','tha','aspirated dental t'],
  ['d','द','da','dental d'],
  ['dh','ध','dha','aspirated dental d'],
  ['n','न','na','dental n'],
  ['p','प','pa','unaspirated p'],
  ['ph','फ','pha','aspirated p'],
  ['b','ब','ba','b as in "boy"'],
  ['bh','भ','bha','aspirated b'],
  ['m','म','ma','m as in "man"'],
  ['y','य','ya','y as in "yes"'],
  ['r','र','ra','tapped r'],
  ['l','ल','la','l as in "love"'],
  ['w','व','wa','v / w'],
  ['v','व','va','v / w'],
  ['sh','श','sha','sh as in "ship"'],
  ['Sh','ष','Sha','retroflex sh'],
  ['s','स','sa','s as in "sun"'],
  ['h','ह','ha','h as in "home"'],
  ['ksh','क्ष','ksha','k + sh ligature'],
  ['tr','त्र','tra','t + r ligature'],
  ['gy','ज्ञ','gya','j + ny ligature'],
];
const CONS_MAP = {};
CONS.forEach(c => CONS_MAP[c[0]] = {ch:c[1], name:c[2], hint:c[3]});

const HALANT = '्';       /* virama — kills the inherent vowel */
const ANUSVARA = 'ं';     /* nasal */
const VISARGA = 'ः';
const CANDRABINDU = 'ँ';

/* longest match first */
const NO_MATCH = new Set(['ny','ng']);   // taught in the table, not matched phonetically
const CONS_KEYS = CONS.map(c=>c[0]).filter(k=>!NO_MATCH.has(k)).sort((a,b)=>b.length-a.length);
const VOWEL_KEYS = ['aa','ai','au','ii','uu','ri','i','u','e','o','a'];

/* ============================================================
   The rule, stated plainly:
   a consonant carries a built-in 'a'. That 'a' survives unless
   a vowel sign replaces it (matra) or another consonant crowds
   in, in which case a halant is inserted to silence it.
   So we track one bit: is a consonant currently "open"?
   ============================================================ */
function romanToDevanagari(input){
  const s = input;          // case-sensitive: T is not t
  let out = '';
  let i = 0;
  let open = false;         // a consonant with its vowel slot still unfilled

  const closeOpen = () => { if(open){ out += HALANT; open = false; } };

  while(i < s.length){
    const ch = s[i];

    /* whitespace / punctuation / unknown: pass through, close syllables */
    if(/\s/.test(ch)){ open = false; out += ' '; i++; continue; }
    if(ch === 'M'){ out += ANUSVARA; i++; continue; }
    if(ch === 'H'){ out += VISARGA; i++; continue; }
    if(ch === '~'){ out += CANDRABINDU; i++; continue; }
    if(ch === '.' && s[i+1] === 'n'){ out += ANUSVARA; i += 2; continue; }
    if(!/[a-zA-Z]/.test(ch)){ open = false; out += ch; i++; continue; }

    /* consonant? */
    let matched = null;
    for(const k of CONS_KEYS){ if(s.startsWith(k, i)){ matched = k; break; } }
    if(matched){
      closeOpen();                       // silence the previous consonant
      out += CONS_MAP[matched].ch;
      open = true;
      i += matched.length;
      continue;
    }

    /* vowel? */
    let vm = null;
    for(const v of VOWEL_KEYS){ if(s.startsWith(v, i)){ vm = v; break; } }
    if(vm){
      const V = VOWELS[vm];
      if(open){
        if(vm === 'a'){ /* inherent vowel — nothing to draw */ }
        else out += V.matra;
        open = false;
      } else {
        out += V.ch;
      }
      i += vm.length;
      continue;
    }

    /* unknown letter: pass through */
    out += ch; i++;
  }
  return out;
}

/* word-level renderer for the letter table: consonant + each vowel */
const CONS_VOWEL_LABEL = {a:'a',aa:'ā',i:'i',ii:'ī',u:'u',uu:'ū',e:'e',ai:'ai',o:'o',au:'au',ri:'ṛ'};
function conjugate(consCh){
  return Object.entries(VOWELS).map(([k,V]) => ({
    key:k,
    form: consCh + (k==='a' ? '' : (V.matra || HALANT)),
    label: CONS_VOWEL_LABEL[k]
  }));
}

/* ---------- Nepali number words ---------- */
const NUM_NE = ['शून्य','एक','दुई','तीन','चार','पाँच','छ','सात','आठ','नौ','दश',
'एघार','बाह्र','तेह्र','चौध','पन्ध्र','सोह्र','सत्र','अठार','उन्नाइस','बीस',
'एक्काइस','बाइस','तेइस','चौबीस','पच्चीस'] ;
const DIGIT_NE = ['०','१','२','३','४','५','६','७','८','९'];
function neDigits(s){ return String(s).replace(/\d/g, d => DIGIT_NE[+d]); }
function numWordNe(n){
  if(n <= 25) return NUM_NE[n];
  if(n < 100){
    const t = Math.floor(n/10), r = n%10;
    const tens = {3:'तीस',4:'चालीस',5:'पचास',6:'साठी',7:'सत्तर',8:'असी',9:'नब्बे'};
    return tens[t] + (r? ' ' + NUM_NE[r] : '');
  }
  return neDigits(n);
}

/* ---------- UI wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initCalendar();
  initTypist();
  initAlphabet();
  initMountain();
  initNums();
});

/* ============================================================
   CLOCK
   ============================================================ */
function initClock(){
  const tick = () => {
    const now = new Date();
    // Nepal is UTC+5:45 — compute explicitly so it's right anywhere
    const utc = now.getTime() + now.getTimezoneOffset()*60000;
    const nep = new Date(utc + (5*60+45)*60000);

    const y = nep.getFullYear(), m = nep.getMonth()+1, d = nep.getDate();
    const bs = adToBs(y,m,d);

    const timeStr = [nep.getHours(), nep.getMinutes(), nep.getSeconds()]
      .map(v=>String(v).padStart(2,'0')).join(':');

    const ne = document.getElementById('clk-time');
    if(ne) ne.textContent = neDigits(timeStr);
    const en = document.getElementById('clk-time-en');
    if(en) en.textContent = timeStr;

    const dow = nep.getDay();
    const DOW_NE = ['आइतबार','सोमबार','मंगलबार','बुधबार','बिहीबार','शुक्रबार','शनिबार'];
    const DOW_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

    if(bs){
      setText('clk-bs', `${neDigits(bs.d)} ${BS_NE[bs.m-1]} ${neDigits(bs.y)}`);
      setText('clk-bs-en', `${bs.d} ${BS_NAMES[bs.m-1]} ${bs.y} BS`);
      setText('clk-dow', DOW_NE[dow]);
      setText('clk-dow-en', DOW_EN[dow]);
    }
    setText('clk-ad', `${String(d).padStart(2,'0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`);
    setText('clk-tz', 'UTC+5:45 · Kathmandu');
  };
  tick();
  setInterval(tick, 1000);
}
function setText(id, v){ const e=document.getElementById(id); if(e) e.textContent=v; }

/* ============================================================
   CALENDAR
   ============================================================ */
let calY = null, calM = null;
function initCalendar(){
  const now = new Date();
  const today = adToBs(now.getFullYear(), now.getMonth()+1, now.getDate());
  calY = today.y; calM = today.m;
  document.getElementById('cal-prev').onclick = () => { calM--; if(calM<1){calM=12;calY--;} drawCal(); };
  document.getElementById('cal-next').onclick = () => { calM++; if(calM>12){calM=1;calY++;} drawCal(); };
  document.getElementById('cal-today').onclick = () => { calY=today.y; calM=today.m; drawCal(); };
  drawCal();
}
function drawCal(){
  const today = adToBs(new Date().getFullYear(), new Date().getMonth()+1, new Date().getDate());
  setText('cal-title', BS_NAMES[calM-1] + ' ' + calY);
  setText('cal-title-ne', BS_NE[calM-1] + ' ' + neDigits(calY));

  const dim = BS_MONTHS[calY] ? BS_MONTHS[calY][calM-1] : 30;
  const first = bsDayOfWeek(calY, calM, 1);
  const adStart = bsToAd(calY, calM, 1);
  const adEnd = bsToAd(calY, calM, dim);
  const fmt = dt => dt ? dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '';
  setText('cal-range', `${fmt(adStart)} — ${fmt(adEnd)} ${adEnd?adEnd.getUTCFullYear():''}`);

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  DOW.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-dow'; h.textContent = d;
    grid.appendChild(h);
  });
  for(let i=0;i<first;i++){
    const e = document.createElement('div'); e.className='cal-cell empty'; grid.appendChild(e);
  }
  for(let d=1; d<=dim; d++){
    const cell = document.createElement('button');
    cell.className = 'cal-cell';
    const isToday = (calY===today.y && calM===today.m && d===today.d);
    if(isToday) cell.classList.add('today');
    if(bsDayOfWeek(calY,calM,d) === 6) cell.classList.add('sat');
    const ad = bsToAd(calY,calM,d);
    cell.innerHTML = `<span class="cd">${neDigits(d)}</span><span class="ce">${ad?ad.getUTCDate():''}</span>`;
    cell.onclick = () => showDay(calY,calM,d);
    grid.appendChild(cell);
  }
}
function showDay(y,m,d){
  const ad = bsToAd(y,m,d);
  const iso = ad ? ad.toISOString().slice(0,10) : '';
  const panel = document.getElementById('cal-detail');
  panel.innerHTML = `
    <div class="cd-ne">${neDigits(d)} ${BS_NE[m-1]} ${neDigits(y)}</div>
    <div class="cd-en">${d} ${BS_NAMES[m-1]} ${y} BS</div>
    <div class="cd-ad">= ${ad ? ad.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '—'} AD</div>
    <div class="cd-iso">${iso}</div>`;
}
function initCalendar2(){}

/* ============================================================
   TYPIST
   ============================================================ */
const PHRASES = [
  ['namaste', 'नमस्ते', 'hello / I bow to you'],
  ['dhanyavaad', 'धन्यवाद', 'thank you'],
  ['mero naam ... ho', 'मेरो नाम ... हो', 'my name is ...'],
  ['tapaaiiMlaaii kasto chha?', 'तपाईंलाई कस्तो छ?', 'how are you?'],
  ['ma kaaThaamaaDauMmaa baschhu', 'म काठमाडौंमा बस्छु', 'I live in Kathmandu'],
  ['paahaD. raamro chha', 'पहाड राम्रो छ', 'the mountain is beautiful'],
  ['khaana khaayau?', 'खाना खायौ?', 'have you eaten?'],
  ['ma nepaalii sikdai chhu', 'म नेपाली सिक्दै छु', 'I am learning Nepali'],
];
function initTypist(){
  const inp = document.getElementById('rom');
  const out = document.getElementById('dev');
  const update = () => {
    const v = inp.value;
    out.textContent = romanToDevanagari(v) || '—';
  };
  inp.addEventListener('input', update);
  update();

  const chips = document.getElementById('chips');
  PHRASES.forEach(([rom, dev, en]) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = `<b>${dev}</b><span>${en}</span>`;
    b.onclick = () => { inp.value = rom; update(); speak(dev); };
    chips.appendChild(b);
  });

  document.getElementById('say').onclick = () => speak(out.textContent);
  document.getElementById('copy').onclick = async () => {
    try{ await navigator.clipboard.writeText(out.textContent); flash('copy','Copied'); }
    catch(e){ flash('copy','Select it manually'); }
  };
  document.getElementById('clear').onclick = () => { inp.value=''; update(); };
  document.getElementById('keys').onclick = () => {
    document.getElementById('keymap').classList.toggle('open');
  };
  buildKeymap();
}
function buildKeymap(){
  const el = document.getElementById('keymap');
  el.innerHTML = CONS.map(([k,ch,name,hint]) =>
    `<button class="kk" data-say="${ch}"><b>${ch}</b><i>${k}</i></button>`).join('') +
    `<button class="kk" data-say="ा"><b>ा</b><i>aa</i></button>
     <button class="kk" data-say="ि"><b>ि</b><i>i</i></button>
     <button class="kk" data-say="ु"><b>ु</b><i>u</i></button>
     <button class="kk" data-say="े"><b>े</b><i>e</i></button>
     <button class="kk" data-say="ो"><b>ो</b><i>o</i></button>
     <button class="kk" data-say="्"><b>्</b><i>halant</i></button>`;
  el.querySelectorAll('.kk').forEach(b => {
    b.onclick = () => {
      const inp = document.getElementById('rom');
      inp.value += b.querySelector('i').textContent + 'a';
      inp.dispatchEvent(new Event('input'));
      speak(b.dataset.say);
    };
  });
}
function flash(id, msg){
  const el = document.getElementById(id);
  const old = el.textContent;
  el.textContent = msg;
  setTimeout(()=>el.textContent = old, 1400);
}
function speak(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ne-NP';
  u.rate = .82;
  const vs = speechSynthesis.getVoices();
  const ne = vs.find(v=>v.lang && v.lang.toLowerCase().startsWith('ne')) ||
             vs.find(v=>v.lang && v.lang.toLowerCase().startsWith('hi'));
  if(ne) u.voice = ne;
  speechSynthesis.speak(u);
}

/* ============================================================
   ALPHABET
   ============================================================ */
function initAlphabet(){
  const grid = document.getElementById('alpha');
  CONS.forEach(([k,ch,name,hint]) => {
    const b = document.createElement('button');
    b.className='glyph';
    b.innerHTML = `<span class="g">${ch}</span><span class="n">${k}</span>`;
    b.onclick = () => {
      grid.querySelectorAll('.glyph').forEach(x=>x.classList.remove('sel'));
      b.classList.add('sel');
      speak(ch);
      const table = document.getElementById('conj');
      const nameEl = document.getElementById('conj-name');
      nameEl.innerHTML = `<b>${ch}</b> ${name} <span>· ${hint}</span>`;
      table.innerHTML = Object.entries(VOWELS).map(([vk,V])=>{
        const form = vk==='a' ? ch : ch + (V.matra || HALANT);
        return `<button class="cj" data-say="${form}">${form}<i>${CONS_VOWEL_LABEL[vk]}</i></button>`;
      }).join('');
      table.querySelectorAll('.cj').forEach(x=>x.onclick=()=>speak(x.dataset.say));
    };
    grid.appendChild(b);
  });
}

/* ============================================================
   THE MOUNTAIN
   ============================================================ */
const PEAKS = [
  {name:'Everest / सगरमाथा', h:8849, x:.52,  en:'Sagarmatha'},
  {name:'Kanchenjunga', h:8586, x:.82, en:'Kumbhakarna'},
  {name:'Lhotse', h:8516, x:.47, en:'Lhotse'},
  {name:'Makalu', h:8485, x:.63, en:'Makalu'},
  {name:'Cho Oyu', h:8188, x:.42, en:'Cho Oyu'},
  {name:'Dhaulagiri', h:8167, x:.16, en:'Dhaulagiri'},
  {name:'Manaslu', h:8163, x:.33, en:'Manaslu'},
  {name:'Annapurna I', h:8091, x:.25, en:'Annapurna'},
];
function initMountain(){
  const cv = document.getElementById('mtn');
  const ctx = cv.getContext('2d');
  let W=0,H=0,DPR=Math.min(devicePixelRatio||1,2);
  function resize(){
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W*DPR; cv.height = H*DPR;
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  setTimeout(resize, 30); addEventListener('resize', resize);

  /* deterministic ridge: sum of sines with fixed seeds */
  function ridge(x, seed, rough){
    let v = 0, amp = 1, freq = 1;
    for(let i=0;i<5;i++){
      v += Math.sin(x*freq*6.2 + seed*(i+1)*1.7) * amp * (0.5 + rough*i*0.28);
      amp *= .52; freq *= 2.1;
    }
    return v;
  }

  let mouseX = .5, targetX = .5;
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    targetX = (e.clientX - r.left)/r.width;
  });

  let t0 = performance.now();
  function draw(now){
    const t = (now - t0)/1000;
    mouseX += (targetX - mouseX)*.05;
    if(W === 0){ setTimeout(resize,60); requestAnimationFrame(draw); return; }

    // Nepali time of day drives the sky
    const utc = Date.now() + new Date().getTimezoneOffset()*60000;
    const nep = new Date(utc + (5*60+45)*60000);
    const hour = nep.getHours() + nep.getMinutes()/60;
    const dawn = Math.exp(-Math.pow((hour-6.2)/2.2,2));
    const dusk = Math.exp(-Math.pow((hour-18.3)/2.2,2));
    const night = Math.max(0, Math.min(1, (Math.abs(hour-12)/9)));

    // sky gradient
    const sky = ctx.createLinearGradient(0,0,0,H);
    const topN = [10,14,32], topD = [40,52,96], topDawn=[92,70,120];
    const botDawn=[236,150,110], botD=[196,214,240], botN=[22,26,48];
    const mix=(a,b,k)=>a.map((v,i)=>Math.round(v+(b[i]-v)*k));
    const dk = Math.max(dawn,dusk);
    const top = mix(mix(topN, topD, 1-night), topDawn, dk*0.8);
    const bot = mix(mix(botN, botD, 1-night), botDawn, dk);
    sky.addColorStop(0, `rgb(${top})`);
    sky.addColorStop(.55, `rgb(${mix(top,bot,.5)})`);
    sky.addColorStop(1, `rgb(${bot})`);
    ctx.fillStyle = sky; ctx.fillRect(0,0,W,H);

    // stars at night
    if(night > .3){
      ctx.globalAlpha = Math.min(.9,(night-.3)*1.6);
      for(let i=0;i<70;i++){
        const x = ((i*137.5)%W);
        const y = ((i*73.3)%(H*.55));
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // sun/moon disc
    const sunY = H*0.62 + Math.sin((hour-6)/12*Math.PI)*-H*0.42;
    const sunX = W*(0.1 + ((hour-6)/12)*0.8);
    if(hour>5 && hour<19){
      const sg = ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,120);
      sg.addColorStop(0,'rgba(255,238,200,.95)');
      sg.addColorStop(.2,'rgba(255,210,140,.42)');
      sg.addColorStop(1,'rgba(255,180,100,0)');
      ctx.fillStyle=sg; ctx.beginPath(); ctx.arc(sunX,sunY,120,0,7); ctx.fill();
      ctx.fillStyle='#fff6dd'; ctx.beginPath(); ctx.arc(sunX,sunY,13,0,7); ctx.fill();
    }

    // three ridges, far to near, parallax by mouseX
    const layers = [
      {seed:1.3, base:.56, amp:.20, col:'#5b6f96', par:.012, detail:.6},
      {seed:3.7, base:.68, amp:.26, col:'#3d4e73', par:.028, detail:.9},
      {seed:8.1, base:.82, amp:.30, col:'#232f4c', par:.05, detail:1.2},
      {seed:12.4, base:.98, amp:.22, col:'#141c30', par:.075, detail:1.4},
    ];
    layers.forEach((L, li) => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      const off = (mouseX-.5)*W*L.par;
      for(let x=-40; x<=W+40; x+=4){
        const nx = x/W;
        const h = ridge(nx + off/W*3, L.seed, L.detail);
        const y = H*L.base - h*H*L.amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = L.col;
      ctx.fill();
      // snow caps on the far ridge
      if(li === 0 || li === 1){
        ctx.save();
        ctx.clip();
        const snow = ctx.createLinearGradient(0, H*L.base-H*L.amp, 0, H*L.base+40);
        snow.addColorStop(0, 'rgba(255,255,255,.72)');
        snow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = snow;
        ctx.fillRect(0,0,W,H);
        ctx.restore();
      }
    });

    // peak labels on the far ridge
    ctx.font = '500 8.5px Inter, sans-serif';
    ctx.textAlign='center';
    PEAKS.forEach((p, i) => {
      const x = p.x*W - (mouseX-.5)*W*0.012;
      const h = ridge(p.x + (mouseX-.5)*0.036, 1.3, .6);
      const y = H*0.56 - h*H*0.20;
      const bob = Math.sin(t*1.2 + i)*1.2;
      ctx.strokeStyle='rgba(232,207,154,.45)';
      ctx.beginPath(); ctx.moveTo(x, y-8+bob); ctx.lineTo(x, y-26+bob); ctx.stroke();
      ctx.fillStyle='rgba(232,215,180,.9)';
      ctx.fillText(p.name.split(' /')[0].toUpperCase(), x, y-31+bob);
      ctx.fillStyle='rgba(232,207,154,.55)';
      ctx.font='7.5px JetBrains Mono, monospace';
      ctx.fillText(p.h.toLocaleString()+' m', x, y-21+bob);
      ctx.font = '500 8.5px Inter, sans-serif';
      ctx.beginPath(); ctx.arc(x,y-6+bob,1.4,0,7);
      ctx.fillStyle='rgba(255,240,210,.85)'; ctx.fill();
    });

    // mist
    const mist = ctx.createLinearGradient(0,H*.62,0,H);
    mist.addColorStop(0,'rgba(180,200,235,0)');
    mist.addColorStop(.5,`rgba(180,200,235,${.05+night*.03})`);
    mist.addColorStop(1,`rgba(180,200,235,${.16})`);
    ctx.fillStyle=mist; ctx.fillRect(0,H*.55,W,H*.45);

    // caption
    ctx.textAlign='left';
    ctx.font='8px Inter, sans-serif';
    ctx.fillStyle='rgba(255,255,255,.34)';
    ctx.fillText('THE HIMALAYA · SEEN FROM NEPAL', 16, H-14);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
}

/* ============================================================
   NUMBERS
   ============================================================ */
function initNums(){
  const inp = document.getElementById('num');
  const upd = () => {
    const n = parseInt(inp.value, 10);
    if(isNaN(n)){ setText('num-ne','—'); setText('num-digits','—'); return; }
    setText('num-ne', numWordNe(Math.min(n, 99999)));
    setText('num-digits', neDigits(n));
  };
  inp.addEventListener('input', upd);
  upd();
  document.getElementById('num-say').onclick = () => speak(document.getElementById('num-ne').textContent);
}
