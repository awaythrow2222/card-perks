// App state in localStorage, with change listeners for cloud sync.
import { today } from './logic.js';

const KEY = 'cardperks:v1';

const defaults = () => ({
  cards: [],        // [{ id, catalogId, nickname, anniv:'MM-DD', fee, custom, earnOverrides, benefitOverrides, customBenefits, addedOn, updatedAt }]
  usage: {},        // { 'cardId|benefitId|periodKey': { amt, done, skipped, date, updatedAt } }
  extras: [],       // [{ id, cardId, date, desc, value, updatedAt }] — one-off perk value (lounge visit, free bag…)
  deleted: {},      // { id: timestamp } so deletions sync across devices
  settings: { cpp: {}, rotating: {}, updatedAt: 0 },
  updatedAt: 0,
  ownerUid: null,
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const s = JSON.parse(raw);
    return { ...defaults(), ...s, settings: { ...defaults().settings, ...s.settings } };
  } catch {
    return defaults();
  }
}

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** Persist. `remote: true` means the change came from the cloud, so don't echo it back. */
export function save({ remote = false } = {}) {
  if (!remote) state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Could not save', e); }
  if (!remote) listeners.forEach((fn) => fn());
}

export const get = () => state;
export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- cards ----------
export function addCard(catalogId, fields = {}) {
  const card = { id: uid(), catalogId, addedOn: today(), benefitOverrides: {}, earnOverrides: {}, customBenefits: [], ...fields, updatedAt: Date.now() };
  state.cards.push(card);
  save();
  return card;
}
export function updateCard(id, patch) {
  const c = state.cards.find((x) => x.id === id);
  if (!c) return;
  Object.assign(c, patch, { updatedAt: Date.now() });
  save();
}
export function removeCard(id) {
  state.cards = state.cards.filter((c) => c.id !== id);
  state.deleted[id] = Date.now();
  for (const k of Object.keys(state.usage)) if (k.startsWith(`${id}|`)) delete state.usage[k];
  state.extras = state.extras.filter((e) => e.cardId !== id);
  save();
}

// ---------- usage ----------
export function setUsage(key, patch) {
  const prev = state.usage[key] || { date: today() };
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  if (!next.amt && !next.done && !next.skipped) { delete state.usage[key]; state.deleted[key] = Date.now(); }
  else state.usage[key] = next;
  save();
}

// ---------- extras ----------
export function addExtra(e) { state.extras.push({ id: uid(), ...e, updatedAt: Date.now() }); save(); }
export function removeExtra(id) { state.extras = state.extras.filter((e) => e.id !== id); state.deleted[id] = Date.now(); save(); }

export function setSettings(patch) { Object.assign(state.settings, patch, { updatedAt: Date.now() }); save(); }

// ---------- backup / sync helpers ----------
export function replaceAll(next) { state = { ...defaults(), ...next, ownerUid: state.ownerUid }; save(); }
export function resetAll() { state = defaults(); save({ remote: true }); }
export function syncable(s = state) { const { ownerUid, ...rest } = s; return rest; }
export const hasData = (s = state) => s.cards.length > 0 || Object.keys(s.usage).length > 0;

/** Merge two snapshots record by record (newest wins), honouring deletions. Order-independent. */
export function merge(a, b) {
  const d = defaults();
  a = { ...d, ...a }; b = { ...d, ...b };
  const deleted = { ...a.deleted };
  for (const [k, t] of Object.entries(b.deleted)) deleted[k] = Math.max(deleted[k] || 0, t);
  const alive = (id, rec) => !(deleted[id] && deleted[id] >= (rec.updatedAt || 0));
  const newest = (x, y) => (!x ? y : !y ? x : (y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);

  const byId = (xs, ys) => {
    const m = new Map();
    for (const r of [...xs, ...ys]) m.set(r.id, newest(m.get(r.id), r));
    return [...m.values()].filter((r) => alive(r.id, r));
  };
  const usage = {};
  for (const k of new Set([...Object.keys(a.usage), ...Object.keys(b.usage)])) {
    const r = newest(a.usage[k], b.usage[k]);
    if (alive(k, r)) usage[k] = r;
  }
  const cards = byId(a.cards, b.cards);
  const cardIds = new Set(cards.map((c) => c.id));
  for (const k of Object.keys(usage)) if (!cardIds.has(k.split('|')[0])) delete usage[k];
  return {
    ...d,
    cards,
    usage,
    extras: byId(a.extras, b.extras).filter((e) => cardIds.has(e.cardId)),
    deleted,
    settings: (a.settings.updatedAt || 0) >= (b.settings.updatedAt || 0) ? a.settings : b.settings,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
}

export function applyRemote(remote, uidv) {
  state = { ...defaults(), ...remote, ownerUid: uidv };
  save({ remote: true });
}
export function setOwner(uidv) { state.ownerUid = uidv; save({ remote: true }); }
