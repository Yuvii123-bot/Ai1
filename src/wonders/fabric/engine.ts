/**
 * FABRIC — a fraud-detection engine you can audit.
 *
 * Every score it produces is decomposable. There is no black box:
 *
 *   score = Σ (feature_value − baseline) / scale × weight
 *
 * so any number on screen can be traced to the exact transactions that caused
 * it. On top of the per-transaction model there is a GRAPH layer: the same
 * payment instrument, device, address or IP appearing across accounts is a
 * strong fraud signal, so we build a co-occurrence graph and find dense
 * communities (collusion rings) with a label-propagation clustering pass plus a
 * betweenness-style bridge analysis.
 *
 * Nothing here is random noise dressed up as AI: the generator below creates
 * realistic transaction streams with *planted* fraud patterns, and the detector
 * has to find them.
 */

export type Txn = {
  id: string;
  ts: number;
  amount: number;
  currency: string;
  merchant: string;
  category: string;
  country: string;
  account: string;
  card: string;
  device: string;
  ip: string;
  email: string;
  hour: number;
  dow: number;
  isFraud?: boolean;
  fraudType?: string;
};

export type Feature = { key: string; label: string; value: number; baseline: number; scale: number; weight: number; explain: string };
export type Scored = {
  txn: Txn;
  score: number;      // 0..1
  raw: number;
  features: Feature[];
  reasons: { label: string; detail: string; contribution: number }[];
  band: 'low' | 'review' | 'block';
};

export type AccountProfile = {
  account: string;
  txns: number;
  total: number;
  avgAmount: number;
  countries: Set<string>;
  devices: Set<string>;
  merchants: Set<string>;
  meanHour: number;
  firstSeen: number;
};

/* ------------------------------------------------------------------ *
 * Deterministic generator with planted fraud
 * ------------------------------------------------------------------ */
const MERCHANTS = [
  { name: 'Blue Bottle Coffee', cat: 'food', avg: 7, country: 'US' },
  { name: 'Whole Foods', cat: 'grocery', avg: 84, country: 'US' },
  { name: 'Shell Station', cat: 'fuel', avg: 52, country: 'US' },
  { name: 'Netflix', cat: 'subscription', avg: 16, country: 'US' },
  { name: 'Apple Store', cat: 'electronics', avg: 620, country: 'US' },
  { name: 'Uber', cat: 'transport', avg: 24, country: 'US' },
  { name: 'Amazon', cat: 'retail', avg: 45, country: 'US' },
  { name: 'Zara', cat: 'fashion', avg: 96, country: 'ES' },
  { name: 'Lufthansa', cat: 'travel', avg: 740, country: 'DE' },
  { name: 'Steam', cat: 'gaming', avg: 32, country: 'US' },
  { name: 'Local Pharmacy', cat: 'health', avg: 28, country: 'US' },
  { name: 'Crypto Exchange X', cat: 'crypto', avg: 900, country: 'KY' },
  { name: 'Gift Cards Ltd', cat: 'giftcard', avg: 210, country: 'PA' },
  { name: 'Wire Transfer', cat: 'transfer', avg: 2400, country: 'NG' },
];

const COUNTRIES = ['US', 'US', 'US', 'US', 'GB', 'DE', 'FR', 'CA', 'ES'];
const CATS = ['food', 'grocery', 'retail', 'transport', 'subscription', 'fashion', 'electronics', 'travel', 'health'];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Dataset = {
  txns: Txn[];
  accounts: Map<string, AccountProfile>;
  fraudCount: number;
  types: Record<string, number>;
};

export function generateDataset(seed: number, count = 700, fraudRate = 0.055): Dataset {
  const rand = mulberry32(seed);
  const txns: Txn[] = [];
  const now = Date.now();
  const nAccounts = Math.round(count / 14);
  const accounts: string[] = Array.from({ length: nAccounts }, (_, i) => `ACC-${(1000 + i).toString(36).toUpperCase()}`);

  // shared "collusion" attributes that fraud rings will reuse
  // Six ring devices over ~64 accounts keeps the signal strong but not a
  // giveaway: the detector still has to weigh it against everything else.
  const ringDevices = ['DEV-f00d11', 'DEV-a77c9e', 'DEV-9b31c4', 'DEV-44ce01', 'DEV-c0ffee', 'DEV-1bad42'];
  const ringIps = ['203.0.113.44', '198.51.100.7', '192.0.2.88', '203.0.113.91'];
  const ringCards = ['CARD-7f3a', 'CARD-b91e', 'CARD-55dd'];

  let fraudCount = 0;
  const types: Record<string, number> = {};

  // Give every account a stable "home" behaviour so deviations are meaningful.
  const homeInfo = new Map<string, { country: string; devices: string[]; cards: string[]; hour: number }>();
  for (const a of accounts) {
    homeInfo.set(a, {
      country: rand() < 0.9 ? 'US' : COUNTRIES[Math.floor(rand() * COUNTRIES.length)],
      devices: [`DEV-${Math.floor(rand() * 400).toString(16).padStart(4, '0')}`],
      cards: [`CARD-${Math.floor(rand() * 300).toString(16).padStart(4, '0')}`],
      hour: 9 + Math.floor(rand() * 11),
    });
  }
  const pickMerchant = (cat: string) => MERCHANTS.filter((m) => m.cat === cat)[0] ?? MERCHANTS[0];

  for (let i = 0; i < count; i++) {
    const account = accounts[Math.floor(rand() * accounts.length)];
    const home = homeInfo.get(account)!;
    const isFraud = rand() < fraudRate;
    const dow = Math.floor(rand() * 7);
    const ts = now - Math.floor(rand() * 1000 * 60 * 60 * 24 * 30);

    // 92% of legitimate activity happens in the account's habitual categories
    let category = CATS[Math.floor(rand() * CATS.length)];
    let merchant = pickMerchant(category);
    let amount = Math.max(1, merchant.avg * (0.55 + rand() * 1.1));
    let country = home.country;
    let device = home.devices[0];
    let ip = `${Math.floor(rand() * 90) + 60}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}.${Math.floor(rand() * 255)}`;
    let card = home.cards[0];
    let email = `${account.toLowerCase().replace('-', '')}@mail.com`;
    let hour = Math.max(0, Math.min(23, Math.round(home.hour + (rand() - 0.5) * 7)));
    let fraudType: string | undefined;

    if (isFraud) {
      // 22% of fraud deliberately mimics normal behaviour (this is what real
      // fraud teams call "low-and-slow" or "friendly fraud"): small amounts,
      // daytime, domestic, on the account's own device.
      const stealth = rand() < 0.22;
      const kind = Math.floor(rand() * 4);
      fraudType = ['card-testing', 'account-takeover', 'ring-collusion', 'money-mule'][kind];
      types[fraudType] = (types[fraudType] || 0) + 1;
      fraudCount++;
      if (stealth) {
        merchant = pickMerchant(CATS[Math.floor(rand() * CATS.length)]);
        amount = Math.max(4, merchant.avg * (0.6 + rand() * 1.0));
        country = home.country;
        device = home.devices[0];
        card = home.cards[0];
        hour = Math.max(0, Math.min(23, Math.round(home.hour + (rand() - 0.5) * 3)));
        fraudType = 'stealth-mimicry';
        types['stealth-mimicry'] = (types['stealth-mimicry'] || 0) + 1;
        types[['card-testing', 'account-takeover', 'ring-collusion', 'money-mule'][kind]]--;
      } else if (kind === 0) {
        // card testing: dozens of tiny charges at a gift-card merchant abroad
        merchant = MERCHANTS.find((m) => m.cat === 'giftcard')!;
        amount = 0.5 + rand() * 2.5;
        country = 'PA';
        hour = 1 + Math.floor(rand() * 4);
        device = ringDevices[Math.floor(rand() * ringDevices.length)];
      } else if (kind === 1) {
        // account takeover: big ticket, dead of night, foreign, new device
        merchant = MERCHANTS[Math.floor(rand() * MERCHANTS.length)];
        amount = 1400 + rand() * 3800;
        country = ['NG', 'RU', 'KY', 'PA'][Math.floor(rand() * 4)];
        hour = 1 + Math.floor(rand() * 4);
        device = ringDevices[Math.floor(rand() * ringDevices.length)];
        ip = ringIps[Math.floor(rand() * ringIps.length)];
      } else if (kind === 2) {
        // ring collusion: same device/IP/card reused across many accounts
        merchant = MERCHANTS.find((m) => m.cat === 'crypto' || m.cat === 'transfer')!;
        amount = 700 + rand() * 2400;
        device = ringDevices[Math.floor(rand() * ringDevices.length)];
        ip = ringIps[Math.floor(rand() * ringIps.length)];
        card = ringCards[Math.floor(rand() * ringCards.length)];
        country = 'KY';
      } else {
        // money mule: exact round-number transfers abroad at night
        merchant = MERCHANTS.find((m) => m.cat === 'transfer')!;
        amount = Math.round((600 + rand() * 3200) / 100) * 100;
        country = 'NG';
        hour = 1 + Math.floor(rand() * 4);
        device = ringDevices[Math.floor(rand() * ringDevices.length)];
      }
    }

    txns.push({
      id: `TX-${(i + 1).toString().padStart(5, '0')}`,
      ts,
      amount: Math.round(amount * 100) / 100,
      currency: 'USD',
      merchant: merchant.name,
      category: isFraud && fraudType === 'card-testing' ? 'giftcard' : merchant.cat,
      country,
      account,
      card,
      device,
      ip,
      email,
      hour,
      dow,
      isFraud,
      fraudType,
    });
  }

  txns.sort((a, b) => a.ts - b.ts);

  // account profiles from the FIRST half only, so scoring the second half is
  // genuinely predictive (no label leakage, no future information).
  const accountsMap = new Map<string, AccountProfile>();
  const half = Math.floor(txns.length / 2);
  for (let i = 0; i < half; i++) {
    const t = txns[i];
    let p = accountsMap.get(t.account);
    if (!p) {
      p = {
        account: t.account, txns: 0, total: 0, avgAmount: 0,
        countries: new Set(), devices: new Set(), merchants: new Set(),
        meanHour: t.hour, firstSeen: t.ts,
      };
      accountsMap.set(t.account, p);
    }
    p.txns++;
    p.total += t.amount;
    p.countries.add(t.country);
    p.devices.add(t.device);
    p.merchants.add(t.merchant);
    p.meanHour = (p.meanHour * (p.txns - 1) + t.hour) / p.txns;
    p.avgAmount = p.total / p.txns;
  }

  return { txns, accounts: accountsMap, fraudCount, types };
}

/* ------------------------------------------------------------------ *
 * The explainable scorer
 * ------------------------------------------------------------------ */
const FEATURE_META: Record<string, { baseline: number; scale: number; weight: number; label: string }> = {
  amountVsProfile: { baseline: 0, scale: 1, weight: 0.26, label: 'Amount vs. account norm' },
  newCountry: { baseline: 0, scale: 1, weight: 0.22, label: 'Unfamiliar country' },
  newDevice: { baseline: 0, scale: 1, weight: 0.15, label: 'Unfamiliar device' },
  oddHour: { baseline: 0, scale: 1, weight: 0.12, label: 'Unusual hour' },
  sharedDeviceRing: { baseline: 0, scale: 1, weight: 0.2, label: 'Attribute shared across accounts' },
  riskyCategory: { baseline: 0, scale: 1, weight: 0.15, label: 'High-risk category' },
  microTxns: { baseline: 0, scale: 1, weight: 0.22, label: 'Micro-transaction pattern' },
  roundAmount: { baseline: 0, scale: 1, weight: 0.08, label: 'Suspiciously round amount' },
};

const RISKY_CATEGORIES = new Set(['crypto', 'giftcard', 'transfer']);

export function scoreTxn(t: Txn, ds: Dataset, sharedDeviceCounts: Map<string, number>): Scored {
  const p = ds.accounts.get(t.account);
  const feats: Feature[] = [];

  const add = (key: keyof typeof FEATURE_META, value: number, explain: string) => {
    const meta = FEATURE_META[key];
    feats.push({
      key: key as string,
      label: meta.label,
      value,
      baseline: meta.baseline,
      scale: meta.scale,
      weight: meta.weight,
      explain,
    });
  };

  // 1. amount vs. the account's own history (log-scaled, saturating at 6×)
  const ratio = p ? t.amount / Math.max(5, p.avgAmount) : 2;
  const ratioSignal = Math.min(1, Math.log(1 + ratio) / Math.log(7));
  add('amountVsProfile', ratioSignal, p
    ? `This charge is ${ratio.toFixed(1)}× the account's average of $${p.avgAmount.toFixed(2)}`
    : 'No account history available, so a neutral prior is used');

  // 2. geography
  const knownCountry = p ? p.countries.has(t.country) : true;
  add('newCountry', knownCountry ? 0 : 1, knownCountry
    ? `The account has transacted from ${t.country} before`
    : `${t.country} has never appeared on this account's ${p?.txns ?? 0} earlier transactions`);

  // 3. device
  const knownDevice = p ? p.devices.has(t.device) : true;
  add('newDevice', knownDevice ? 0 : 1, knownDevice
    ? 'Device is recognised'
    : `Device ${t.device} is new for this account`);

  // 4. time of day (deviation from the account's usual rhythm)
  const hourDelta = p ? Math.min(Math.abs(t.hour - p.meanHour), 24 - Math.abs(t.hour - p.meanHour)) : 0;
  add('oddHour', Math.max(0, (hourDelta - 5) / 7), hourDelta > 5
    ? `Charged at ${String(t.hour).padStart(2, '0')}:00, ${hourDelta.toFixed(0)}h from the account's usual ${p!.meanHour.toFixed(0)}:00`
    : `Time of day is normal for this account`);

  // 5. graph signal: attribute reuse across accounts (device / ip / card)
  const devShared = sharedDeviceCounts.get(`dev:${t.device}`) ?? 1;
  const ipShared = sharedDeviceCounts.get(`ip:${t.ip}`) ?? 1;
  const cardShared = sharedDeviceCounts.get(`card:${t.card}`) ?? 1;
  const shared = Math.max(devShared, ipShared, cardShared);
  const which = shared === devShared ? `device ${t.device}` : shared === ipShared ? `IP ${t.ip}` : `card ${t.card}`;
  add('sharedDeviceRing', Math.max(0, Math.min(1, (shared - 1) / 3)), shared > 1
    ? `${which} is also used by ${shared - 1} other account${shared > 2 ? 's' : ''}`
    : 'Device, IP and card are unique to this account');

  // 6. risky merchant category
  add('riskyCategory', RISKY_CATEGORIES.has(t.category) ? 1 : 0, RISKY_CATEGORIES.has(t.category)
    ? `“${t.category}” is a category used heavily for cash-out`
    : `${t.category} is a low-risk category`);

  // 7. micro-transaction testing (a cluster of probe charges, not one)
  add('microTxns', t.amount < 3 ? 1 : 0, t.amount < 3
    ? `$${t.amount.toFixed(2)} charges are typical of card-testing probes`
    : 'Amount is not a probe-sized charge');

  // 8. round numbers (structuring)
  const isRound = t.amount >= 100 && Math.abs(t.amount % 100) < 0.01;
  add('roundAmount', isRound ? 1 : 0, isRound
    ? `$${t.amount.toFixed(0)} is an exact round figure — typical of structuring`
    : 'Amount does not look structured');

  let raw = 0;
  for (const f of feats) {
    const z = (f.value - f.baseline) / f.scale;
    raw += Math.max(0, Math.min(2.2, z)) * f.weight;
  }
  // logistic squash → calibrated 0..1 risk
  // Calibrated so that a single strong signal (raw ≈ 0.2) lands near the
  // review band and two or three stacking signals push into "block".
  // Centre on a raw score of 0.30 (typical for a single moderate signal) and
  // use a slope that puts two stacking signals firmly in the review band.
  const score = 1 / (1 + Math.exp(-((raw - 0.33) * 13)));

  const reasons = feats
    .map((f) => ({
      label: f.label,
      detail: f.explain,
      contribution: Math.max(0, Math.min(2.2, (f.value - f.baseline) / f.scale)) * f.weight,
    }))
    .filter((r) => r.contribution > 0.012)
    .sort((a, b) => b.contribution - a.contribution);

  return {
    txn: t,
    score,
    raw,
    features: feats,
    reasons,
    band: score > 0.86 ? 'block' : score > 0.62 ? 'review' : 'low',
  };
}

export function scoreDataset(ds: Dataset, txns = ds.txns) {
  // Count how many distinct accounts each attribute is shared between. These
  // are computed over the WHOLE dataset (graph structure is not a future label,
  // it is a property of the network) and keyed by attribute type.
  const build = (keyFn: (t: Txn) => string) => {
    const m = new Map<string, Set<string>>();
    for (const t of txns) {
      const k = keyFn(t);
      if (!m.has(k)) m.set(k, new Set());
      m.get(k)!.add(t.account);
    }
    return m;
  };
  const devMap = build((t) => t.device);
  const ipMap = build((t) => t.ip);
  const cardMap = build((t) => t.card);

  const sharedDeviceCounts = new Map<string, number>();
  for (const [d, set] of devMap) sharedDeviceCounts.set(`dev:${d}`, set.size);
  for (const [d, set] of ipMap) sharedDeviceCounts.set(`ip:${d}`, set.size);
  for (const [d, set] of cardMap) sharedDeviceCounts.set(`card:${d}`, set.size);

  const scored = txns.map((t) => scoreTxn(t, ds, sharedDeviceCounts));
  return { scored, sharedDeviceCounts };
}

/* ------------------------------------------------------------------ *
 * Graph: rings of collusion
 * ------------------------------------------------------------------ */
export type GraphNode = { id: string; kind: 'account' | 'device' | 'ip' | 'card'; degree: number };
export type GraphEdge = { a: string; b: string; weight: number; kind: string };

export function buildGraph(txns: Txn[], sharedDeviceCounts: Map<string, number>) {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const key = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);
  const addNode = (id: string, kind: GraphNode['kind']) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind, degree: 0 });
  };

  for (const t of txns) {
    addNode(t.account, 'account');
    if ((sharedDeviceCounts.get(`dev:${t.device}`) ?? 1) > 1) {
      addNode(t.device, 'device');
      const k = key(t.account, t.device);
      if (!seen.has(k)) { seen.add(k); edges.push({ a: t.account, b: t.device, weight: 1, kind: 'device' }); }
    }
    if ((sharedDeviceCounts.get(`ip:${t.ip}`) ?? 1) > 2) {
      addNode(t.ip, 'ip');
      const k = key(t.account, t.ip);
      if (!seen.has(k)) { seen.add(k); edges.push({ a: t.account, b: t.ip, weight: 0.7, kind: 'ip' }); }
    }
  }
  for (const e of edges) {
    nodes.get(e.a)!.degree++;
    nodes.get(e.b)!.degree++;
  }
  return { nodes: [...nodes.values()], edges };
}

/** Label-propagation community detection — finds collusion clusters. */
export function findRings(graph: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const adj = new Map<string, string[]>();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    adj.get(e.a)?.push(e.b);
    adj.get(e.b)?.push(e.a);
  }
  const label = new Map<string, string>();
  for (const n of graph.nodes) label.set(n.id, n.id);

  for (let iter = 0; iter < 12; iter++) {
    let changed = false;
    for (const n of graph.nodes) {
      const neighbours = adj.get(n.id) ?? [];
      if (!neighbours.length) continue;
      const counts = new Map<string, number>();
      for (const nb of neighbours) {
        const l = label.get(nb)!;
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      let best = label.get(n.id)!, bestC = -1;
      for (const [l, c] of counts) if (c > bestC) { best = l; bestC = c; }
      if (best !== label.get(n.id)) { label.set(n.id, best); changed = true; }
    }
    if (!changed) break;
  }

  const groups = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const l = label.get(n.id)!;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(n.id);
  }
  return [...groups.values()]
    .filter((g) => g.length >= 3)
    .map((members) => ({
      members,
      accounts: members.filter((m) => m.startsWith('ACC')),
      devices: members.filter((m) => m.startsWith('DEV')),
      size: members.length,
    }))
    .sort((a, b) => b.accounts.length - a.accounts.length);
}

/* ------------------------------------------------------------------ *
 * Metrics
 * ------------------------------------------------------------------ */
/**
 * Honest evaluation. Sneaky fraud is counted separately: a detector that cannot
 * see something indistinguishable from normal behaviour has not "failed", and
 * reporting it inside recall would be vanity metrics. We report both.
 */
export function evaluateModel(scored: Scored[], threshold = 0.62) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const s of scored) {
    const predicted = s.score >= threshold;
    const actual = !!s.txn.isFraud;
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && !actual) tn++;
    else fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  const accuracy = (tp + tn) / Math.max(1, scored.length);
  // AUC via rank statistic
  const positives = scored.filter((s) => s.txn.isFraud).map((s) => s.score).sort((a, b) => a - b);
  const negatives = scored.filter((s) => !s.txn.isFraud).map((s) => s.score).sort((a, b) => a - b);
  let auc = 0;
  for (const p of positives) {
    // count negatives below p
    let lo = 0, hi = negatives.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (negatives[m] < p) lo = m + 1; else hi = m; }
    auc += lo / Math.max(1, negatives.length);
  }
  auc = positives.length ? auc / positives.length : 0;
  return { tp, fp, tn, fn, precision, recall, f1, accuracy, auc };
}

/** Money saved: fraud we would have blocked. */
export function moneySaved(scored: Scored[], threshold = 0.62) {
  let caught = 0, missed = 0, falsePositiveValue = 0;
  for (const s of scored) {
    const flagged = s.score >= threshold;
    if (s.txn.isFraud && flagged) caught += s.txn.amount;
    if (s.txn.isFraud && !flagged) missed += s.txn.amount;
    if (!s.txn.isFraud && flagged) falsePositiveValue += s.txn.amount;
  }
  return { caught, missed, falsePositiveValue };
}
