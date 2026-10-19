// Pure logic: benefit periods and deadlines, value used, and best-card rankings. No DOM, no storage.
import { CATALOG, catalogById, CURRENCIES, ROTATING, CATEGORIES } from './data.js';

// ---------- dates (local 'YYYY-MM-DD' strings) ----------
const pad = (n) => String(n).padStart(2, '0');
export const ymd = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};
export function today() {
  const d = new Date();
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}
export const parse = (s) => s.split('-').map(Number);
export const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export function daysBetween(a, b) {
  const [y1, m1, d1] = parse(a), [y2, m2, d2] = parse(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
export const addDays = (s, n) => { const [y, m, d] = parse(s); return ymd(y, m, d + n); };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthName = (m) => MONTHS[m - 1];
export const fmtDate = (s) => { const [y, m, d] = parse(s); return `${MONTHS[m - 1]} ${d}, ${y}`; };
export const fmtShort = (s) => { const [, m, d] = parse(s); return `${MONTHS[m - 1]} ${d}`; };
export const quarterKey = (s) => { const [y, m] = parse(s); return `${y}-Q${Math.floor((m - 1) / 3) + 1}`; };

// ---------- cards ----------
/** The catalog entry for a held card, with the user's custom fields applied. */
export function cardDef(card) {
  const base = catalogById[card.catalogId] || catalogById.custom;
  const c = card.custom || {};
  return {
    ...base,
    name: card.nickname || c.name || base.name,
    fee: card.fee ?? base.fee,
    network: c.network || base.network,
    currency: c.currency || base.currency,
    base: c.base ?? base.base,
    color: c.color || base.color,
  };
}

/** Benefits for a card with the user's per-benefit overrides and custom benefits merged in. */
export function cardBenefits(card, { includeHidden = false } = {}) {
  const def = catalogById[card.catalogId] || catalogById.custom;
  const ov = card.benefitOverrides || {};
  const list = [...def.benefits, ...(card.customBenefits || []).map((b) => ({ ...b, custom: true }))]
    .map((b) => ({ ...b, ...(ov[b.id] || {}) }));
  return includeHidden ? list : list.filter((b) => !b.hidden);
}

/** Card anniversary as [month, day]; defaults to the month the card was added. */
export function anniversary(card) {
  if (card.anniv) { const [m, d] = card.anniv.split('-').map(Number); return [m, d || 1]; }
  const [, m] = parse(card.addedOn || today());
  return [m, 1];
}

// ---------- periods ----------
/**
 * The period a benefit is in on `date`: { key, start, end, deadline, label }.
 * For multiyear benefits pass the card's usage map so the last use can be found.
 */
export function periodFor(b, card, date = today(), usage = {}) {
  const [y, m] = parse(date);
  let p;
  switch (b.period) {
    case 'monthly':
      p = { key: `${y}-${pad(m)}`, start: ymd(y, m, 1), end: ymd(y, m, lastDay(y, m)), label: `${monthName(m)} ${y}` };
      break;
    case 'quarterly': {
      const q = Math.floor((m - 1) / 3) + 1, em = q * 3;
      p = { key: `${y}-Q${q}`, start: ymd(y, em - 2, 1), end: ymd(y, em, lastDay(y, em)), label: `Q${q} ${y}` };
      if (b.deadlineDay) p.deadline = ymd(y, em, b.deadlineDay);
      break;
    }
    case 'semiannual': {
      const h = m <= 6 ? 1 : 2;
      p = { key: `${y}-H${h}`, start: ymd(y, h === 1 ? 1 : 7, 1), end: h === 1 ? ymd(y, 6, 30) : ymd(y, 12, 31), label: `${h === 1 ? 'Jan–Jun' : 'Jul–Dec'} ${y}` };
      break;
    }
    case 'annual':
      p = { key: `${y}`, start: ymd(y, 1, 1), end: ymd(y, 12, 31), label: `${y}` };
      break;
    case 'cardyear': {
      const [am, ad] = anniversary(card);
      const thisYear = ymd(y, am, Math.min(ad, lastDay(y, am)));
      const sy = date >= thisYear ? y : y - 1;
      const start = ymd(sy, am, Math.min(ad, lastDay(sy, am)));
      const next = ymd(sy + 1, am, Math.min(ad, lastDay(sy + 1, am)));
      p = { key: `CY${sy}`, start, end: addDays(next, -1), label: `Card year ${fmtShort(start)} ${sy}–${fmtShort(addDays(next, -1))} ${sy + 1}` };
      break;
    }
    case 'multiyear': {
      // Keyed by the calendar year it was used; available again `years` later.
      const years = b.years || 4;
      const used = Object.entries(usage)
        .filter(([k, r]) => k.startsWith(`${card.id}|${b.id}|M`) && isDone(b, r))
        .map(([k]) => Number(k.split('|M')[1])).sort((a, c) => c - a)[0];
      if (used && y - used < years) {
        p = { key: `M${used}`, start: ymd(used, 1, 1), end: ymd(used + years, 1, 1), label: `Used ${used} · next ${used + years}`, locked: true };
      } else {
        p = { key: `M${y}`, start: ymd(y, 1, 1), end: null, label: `Every ${years} years` };
      }
      break;
    }
    default:
      p = { key: 'once', start: date, end: null, label: '' };
  }
  p.deadline ??= p.end;
  if (b.expires && p.deadline && b.expires < p.deadline) p.deadline = b.expires;
  return p;
}

export const isExpired = (b, date = today()) => !!b.expires && date > b.expires;
export const usageKey = (card, b, p) => `${card.id}|${b.id}|${p.key}`;

export const benefitAmount = (b) => (b.kind === 'amount' ? Number(b.amount) || 0 : Number(b.value) || 0);
export function isDone(b, rec) {
  if (!rec) return false;
  if (b.kind === 'amount') return !!rec.done || (Number(rec.amt) || 0) >= (Number(b.amount) || 0) - 0.005;
  return !!rec.done;
}
/** Dollar value captured by one usage record. */
export function recordValue(b, rec) {
  if (!rec || rec.skipped) return 0;
  if (b.kind === 'amount') {
    const amt = rec.done && rec.amt == null ? b.amount : Number(rec.amt) || 0;
    return Math.min(amt, Number(b.amount) || 0);
  }
  return rec.done ? Number(b.value) || 0 : 0;
}

/** Current status of one benefit on one card. */
export function benefitStatus(card, b, usage, date = today()) {
  const p = periodFor(b, card, date, usage);
  const rec = usage[usageKey(card, b, p)];
  const total = benefitAmount(b);
  const used = recordValue(b, rec);
  const done = p.locked || isDone(b, rec);
  return {
    card, b, p, rec, total, used, done,
    skipped: !!rec?.skipped,
    expired: isExpired(b, date),
    remaining: Math.max(0, total - used),
    daysLeft: p.deadline && !b.auto ? daysBetween(date, p.deadline) : null,
  };
}

/** Everything that still needs doing, soonest deadline first. Benefits without a deadline go last. */
export function todoList(cards, usage, date = today()) {
  const out = [];
  for (const card of cards) {
    for (const b of cardBenefits(card)) {
      const s = benefitStatus(card, b, usage, date);
      if (s.expired || s.done || s.skipped) continue;
      out.push(s);
    }
  }
  return out.sort((a, c) => {
    if (a.daysLeft == null || c.daysLeft == null) return (a.daysLeft == null) - (c.daysLeft == null) || c.remaining - a.remaining;
    return a.daysLeft - c.daysLeft || c.remaining - a.remaining;
  });
}

// ---------- yearly value ----------
const PER_YEAR = { monthly: 12, quarterly: 4, semiannual: 2, annual: 1, cardyear: 1 };

/** Which calendar year a usage record counts toward. */
function recordYear(b, key, rec) {
  const pk = key.split('|')[2];
  if (b.period === 'cardyear' || !pk) return rec.date ? Number(rec.date.slice(0, 4)) : Number(pk?.slice(2));
  if (pk.startsWith('M')) return Number(pk.slice(1));
  return Number(pk.slice(0, 4));
}

/** Value used and fees for one card in a calendar year. */
export function cardYearSummary(card, state, year) {
  const def = cardDef(card);
  const benefits = cardBenefits(card, { includeHidden: true });
  const byId = Object.fromEntries(benefits.map((b) => [b.id, b]));
  let credits = 0;
  for (const [k, rec] of Object.entries(state.usage)) {
    const [cid, bid] = k.split('|');
    if (cid !== card.id || !byId[bid]) continue;
    if (recordYear(byId[bid], k, rec) === year) credits += recordValue(byId[bid], rec);
  }
  const extras = state.extras.filter((e) => e.cardId === card.id && e.date?.startsWith(String(year)))
    .reduce((s, e) => s + (Number(e.value) || 0), 0);
  // Potential: what the visible credits are worth over a full year.
  const potential = cardBenefits(card).reduce((s, b) => {
    const n = b.period === 'multiyear' ? 1 / (b.years || 4) : PER_YEAR[b.period] ?? 0;
    return s + benefitAmount(b) * n;
  }, 0);
  return { card, def, fee: Number(def.fee) || 0, credits, extras, used: credits + extras, potential };
}

/** Credit value still available between `date` and Dec 31 of its year, counting future periods too. */
export function remainingThisYear(cards, usage, date = today()) {
  const [y, m] = parse(date);
  let sum = 0;
  for (const card of cards) {
    for (const b of cardBenefits(card)) {
      if (isExpired(b, date) || b.period === 'multiyear') continue;
      // Walk each period start from now until year end.
      const starts = [];
      if (b.period === 'monthly') for (let i = m; i <= 12; i++) starts.push(i === m ? date : ymd(y, i, 1));
      else if (b.period === 'quarterly') for (let i = m; i <= 12; i += 3) starts.push(i === m ? date : ymd(y, Math.floor((i - 1) / 3) * 3 + 1, 1));
      else if (b.period === 'semiannual') { starts.push(date); if (m <= 6) starts.push(ymd(y, 7, 1)); }
      else starts.push(date);
      for (const d of starts) {
        if (b.expires && d > b.expires) continue;
        const s = benefitStatus(card, b, usage, d);
        if (!s.done && !s.skipped) sum += s.remaining;
      }
    }
  }
  return sum;
}

// ---------- best card per category ----------
export function rotatingFor(program, date, settings) {
  const q = quarterKey(date);
  return settings?.rotating?.[program]?.[q] || ROTATING[program]?.[q] || null;
}

/** Cents per point for a currency, given which cards the user holds. */
export function cppFor(currency, cards, settings) {
  const v = Number(settings?.cpp?.[currency] ?? CURRENCIES[currency]?.cpp ?? 1);
  if (currency === 'UR' && !cards.some((c) => ['csr', 'csp'].includes(c.catalogId))) return Math.min(v, 1); // no Sapphire to pool into
  return v;
}

/** Earning on one card for one category: { rate, pct, note, warn, excluded }. */
export function earnFor(card, cat, cards, usage, settings, date = today()) {
  const def = cardDef(card);
  const ov = card.earnOverrides?.[cat];
  let rate = def.base, note = '', warn = '';
  if (ov != null && ov !== '') { rate = Number(ov); note = 'Your custom rate'; }
  else {
    for (const r of def.earn) if (r.cats.includes(cat) && r.rate > rate) { rate = r.rate; note = r.note || ''; }
  }
  if (def.rotating) {
    const rot = rotatingFor(def.rotating, date, settings);
    if (rot?.cats.includes(cat) && rate < 5) {
      rate = 5;
      note = `5% rotating category ${quarterKey(date).replace('-', ' ')} · first $1,500`;
      const act = cardBenefits(card).find((b) => b.id === 'activate');
      if (act && !benefitStatus(card, act, usage, date).done) warn = 'Activate the 5% categories first';
    }
  }
  if (cat === 'foreign') { rate = def.base; note = def.ftf ? '3% foreign transaction fee' : 'No foreign transaction fee'; }
  const cpp = cppFor(def.currency, cards, settings);
  let pct = rate * cpp;
  if (cat === 'foreign' && def.ftf) pct -= 3;
  const excluded = cat === 'costco' && def.network !== 'Visa' ? 'Not accepted in Costco warehouses (Visa only)' : '';
  return { card, def, rate, pct, cpp, note, warn, excluded };
}

export function rankings(cards, usage, settings, date = today()) {
  return CATEGORIES.map((c) => {
    const list = cards.map((card) => earnFor(card, c.id, cards, usage, settings, date));
    list.sort((a, b) => (!!a.excluded - !!b.excluded) || b.pct - a.pct || a.def.fee - b.def.fee);
    return { cat: c, list };
  });
}

export { CATALOG };
