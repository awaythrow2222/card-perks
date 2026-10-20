// Monarch Money CSV import: parse the export, map accounts to cards, and match statement credits to benefits.
// Pure functions only; the review dialog lives in app.js. Everything runs in the browser — the CSV is never uploaded.
import * as L from './logic.js';

// How each issuer words its statement credits. Only positive (credit) transactions are tested.
// Every pattern needs the word "credit" (or a known issuer phrase) so refunds from the same merchant don't match.
export const STATEMENT_RULES = {
  'amex-gold': {
    dunkin: /AMEX DUNKIN'? CREDIT/i,
    dining: /AMEX DINING CREDIT/i,
    resy: /AMEX RESY CREDIT/i,
  },
  'amex-plat': {
    resy: /AMEX RESY CREDIT/i,
    digital: /DIGITAL ENTERTAINMENT CREDIT|AMEX DIGITAL CREDIT/i,
    lululemon: /LULULEMON CREDIT/i,
    hotel: /AMEX (FHR|HOTEL)[A-Z ]*CREDIT|HOTEL COLLECTION CREDIT|FINE HOTELS.*CREDIT/i,
    'uber-one': /UBER ONE CREDIT/i,
    airline: /AIRLINE (FEE|INCIDENTAL)[A-Z ]*CREDIT|AMEX AIRLINE/i,
    clear: /CLEAR[A-Z +]*CREDIT/i,
    oura: /OURA[A-Z ]*CREDIT/i,
    walmart: /WALMART\+?[A-Z ]*CREDIT/i,
    equinox: /EQUINOX[A-Z ]*CREDIT/i,
    saks: /SAKS[A-Z ]*CREDIT/i,
    'global-entry': /(GLOBAL ENTRY|TSA ?PRE|NEXUS)[A-Z ]*CREDIT/i,
  },
  csr: {
    travel: /^TRAVEL CREDIT/i,
    dining: /DINING CREDIT/i,
    stubhub: /STUBHUB[A-Z /]*CREDIT|VIAGOGO[A-Z ]*CREDIT/i,
    edit: /EDIT[A-Z ]*CREDIT/i,
    'chase-hotel': /CHASE TRAVEL HOTEL CREDIT|SELECT HOTEL CREDIT/i,
    peloton: /PELOTON[A-Z ]*CREDIT/i,
    lyft: /LYFT[A-Z ]*CREDIT/i,
    'global-entry': /(GLOBAL ENTRY|TSA ?PRE|NEXUS)[A-Z ]*CREDIT/i,
  },
  csp: {
    hotel: /HOTEL CREDIT/i,
  },
  'venture-x': {
    travel: /CAPITAL ONE TRAVEL CREDIT|TRAVEL CREDIT/i,
    'global-entry': /(GLOBAL ENTRY|TSA ?PRE|NEXUS)[A-Z ]*CREDIT/i,
  },
};

// Benefits that never show up as a statement credit (applied in an app, posted as miles, etc.).
export const notOnStatement = (card, b) => !STATEMENT_RULES[card.catalogId]?.[b.id];

/** Minimal RFC 4180 CSV parser → array of objects keyed by the header row. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  const keys = head.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** Normalised transactions from a Monarch export. Throws if the columns don't look like Monarch's. */
export function monarchTransactions(text) {
  const rows = parseCSV(text);
  if (!rows.length || !('Date' in rows[0]) || !('Amount' in rows[0]) || !('Account' in rows[0])) {
    throw new Error('This doesn’t look like a Monarch transactions export (needs Date, Account and Amount columns).');
  }
  return rows.map((r) => ({
    id: r.Id || `${r.Date}|${r.Account}|${r.Amount}|${r['Original Statement'] || r.Merchant}`,
    date: r.Date,
    account: r.Account,
    amount: Number(String(r.Amount).replace(/[$,]/g, '')) || 0,
    merchant: r.Merchant || '',
    statement: r['Original Statement'] || r.Merchant || '',
    category: r.Category || '',
  })).filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date));
}

const ACCOUNT_HINTS = [
  // Freedom first: product-changed cards are often named "Freedom (previously Sapphire Preferred)".
  [/freedom unlimited/i, 'freedom-unlimited'], [/freedom flex/i, 'freedom-flex'], [/freedom/i, ['freedom', 'freedom-flex']],
  [/sapphire reserve/i, 'csr'], [/sapphire preferred/i, 'csp'],
  [/ink/i, 'ink-cash'], [/platinum/i, 'amex-plat'], [/(amex|american express).*gold|gold card/i, 'amex-gold'],
  [/venture x/i, 'venture-x'], [/discover/i, 'discover-it'], [/costco/i, 'costco'],
  [/aadvantage|mileup|aviator/i, 'aa-mileup'], [/alaska|atmos/i, 'atmos-ascent'],
  [/prime visa|amazon/i, 'prime-visa'], [/double cash/i, 'double-cash'],
];

/** Best guess at which held card a Monarch account name refers to. */
export function guessCard(account, cards) {
  for (const [re, ids] of ACCOUNT_HINTS) {
    if (!re.test(account)) continue;
    const want = [].concat(ids);
    const hit = cards.find((c) => want.includes(c.catalogId));
    if (hit) return hit.id;
  }
  return '';
}

const PAYMENT = /PAYMENT|AUTOPAY|AUTO-PMT|CREDIT BALANCE REFUND/i;

/**
 * Match transactions against the user's cards.
 * `accountMap` maps Monarch account names → card ids ('' = ignore).
 * Returns { matched, other, skippedAccounts } where matched items carry a card, benefit and period key.
 */
export function matchCredits(txns, cards, accountMap, usage) {
  const already = new Set();
  for (const r of Object.values(usage)) for (const id of Object.keys(r.imported || {})) already.add(id);
  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const matched = [], other = [];
  // Running totals so several credits in one period never exceed the benefit amount.
  const fill = {};
  const used = (card, b, p) => {
    const k = L.usageKey(card, b, p);
    return fill[k] ??= L.recordValue(b, usage[k]);
  };

  for (const t of [...txns].sort((a, b) => a.date.localeCompare(b.date))) {
    const card = byId[accountMap[t.account]];
    if (!card || t.amount <= 0) continue;
    const rules = STATEMENT_RULES[card.catalogId] || {};
    const benefits = L.cardBenefits(card, { includeHidden: true });
    const b = benefits.find((x) => rules[x.id]?.test(t.statement) || rules[x.id]?.test(t.merchant));
    if (!b) {
      if (t.category !== 'Credit Card Payment' && !PAYMENT.test(t.statement)) other.push({ t, card, dup: already.has(t.id) });
      continue;
    }
    matched.push(place(t, card, b, usage, used, fill, already.has(t.id)));
  }
  return { matched, other };
}

/** Choose the period for one credit. Credits can post a few days into the next period, so overflow goes back one. */
export function place(t, card, b, usage, used, fill, dup) {
  let p = L.periodFor(b, card, t.date, usage);
  if (b.kind === 'amount' && !dup && ['monthly', 'quarterly', 'semiannual'].includes(b.period)) {
    const room = (pp) => b.amount - used(card, b, pp);
    if (room(p) < t.amount - 0.005) {
      const prev = L.periodFor(b, card, L.addDays(p.start, -1), usage);
      if (room(prev) >= t.amount - 0.005 && L.daysBetween(prev.end, t.date) <= 10) p = prev;
    }
  }
  if (!dup) fill[L.usageKey(card, b, p)] = used(card, b, p) + (b.kind === 'amount' ? t.amount : 0);
  return { t, card, b, p, dup };
}

/** The usage patch for a set of credits landing in one record. */
export function applyToRecord(b, rec = {}, items) {
  const imported = { ...(rec.imported || {}) };
  let amt = Number(rec.amt) || 0;
  for (const { t } of items) {
    if (imported[t.id] != null) continue;
    imported[t.id] = t.amount;
    amt += t.amount;
  }
  amt = Math.round(amt * 100) / 100;
  return b.kind === 'amount'
    ? { amt, done: amt >= b.amount - 0.005, skipped: false, imported }
    : { done: true, skipped: false, imported };
}
