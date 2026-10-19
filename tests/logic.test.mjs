// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import { catalogById } from '../js/data.js';

const gold = { id: 'g', catalogId: 'amex-gold', anniv: '03-15' };
const csr = { id: 's', catalogId: 'csr', anniv: '08-01' };
const vx = { id: 'v', catalogId: 'venture-x', anniv: '12-10' };
const flex = { id: 'f', catalogId: 'freedom-flex', anniv: '01-01' };
const disc = { id: 'd', catalogId: 'discover-it', anniv: '01-01' };
const amexBen = (id) => catalogById['amex-gold'].benefits.find((b) => b.id === id);

test('monthly, semiannual and quarterly periods', () => {
  const uber = amexBen('uber');
  assert.deepEqual(L.periodFor(uber, gold, '2026-10-19').key, '2026-10');
  assert.equal(L.periodFor(uber, gold, '2026-02-10').end, '2026-02-28');
  const resy = amexBen('resy');
  assert.equal(L.periodFor(resy, gold, '2026-10-19').key, '2026-H2');
  assert.equal(L.periodFor(resy, gold, '2026-03-01').end, '2026-06-30');
  const act = catalogById['freedom-flex'].benefits[0];
  const p = L.periodFor(act, flex, '2026-10-19');
  assert.equal(p.key, '2026-Q4');
  assert.equal(p.deadline, '2026-12-14');
});

test('card-year periods follow the anniversary', () => {
  const travel = catalogById['venture-x'].benefits.find((b) => b.id === 'travel');
  const p = L.periodFor(travel, vx, '2026-10-19');
  assert.equal(p.key, 'CY2025');
  assert.equal(p.start, '2025-12-10');
  assert.equal(p.end, '2026-12-09');
  assert.equal(L.periodFor(travel, vx, '2026-12-10').key, 'CY2026');
});

test('expiring benefits cap the deadline', () => {
  const hotel = catalogById.csr.benefits.find((b) => b.id === 'chase-hotel');
  assert.equal(L.periodFor(hotel, csr, '2026-10-19').deadline, '2026-12-31');
  assert.equal(L.isExpired(hotel, '2027-01-02'), true);
});

test('amount benefits auto-complete at the full value', () => {
  const uber = amexBen('uber');
  assert.equal(L.isDone(uber, { amt: 9.5 }), false);
  assert.equal(L.isDone(uber, { amt: 10 }), true);
  assert.equal(L.recordValue(uber, { amt: 14 }), 10);
});

test('multiyear benefits lock after use', () => {
  const ge = catalogById.csr.benefits.find((b) => b.id === 'global-entry');
  const usage = { 's|global-entry|M2024': { amt: 120, done: true } };
  const p = L.periodFor(ge, csr, '2026-10-19', usage);
  assert.equal(p.locked, true);
  assert.equal(L.periodFor(ge, csr, '2028-02-01', usage).locked, undefined);
});

test('todo list is sorted soonest first and skips done items', () => {
  const usage = { 'g|uber|2026-10': { amt: 10, done: true } };
  const todo = L.todoList([gold], usage, '2026-10-19');
  assert.ok(!todo.some((s) => s.b.id === 'uber'));
  for (let i = 1; i < todo.length; i++) assert.ok((todo[i - 1].daysLeft ?? 1e9) <= (todo[i].daysLeft ?? 1e9));
});

test('yearly summary counts credits in their year', () => {
  const state = { usage: { 'g|uber|2026-01': { amt: 10, done: true }, 'g|uber|2025-12': { amt: 10, done: true }, 'g|resy|2026-H1': { amt: 30 } }, extras: [{ cardId: 'g', date: '2026-05-01', value: 40 }] };
  const s = L.cardYearSummary(gold, state, 2026);
  assert.equal(s.credits, 40);
  assert.equal(s.extras, 40);
  assert.equal(s.fee, 325);
  assert.equal(s.potential, 120 + 120 + 100 + 84);
});

test('rankings: rotating 5%, Visa-only Costco, foreign fees, UR pooling', () => {
  const cards = [gold, csr, vx, flex, disc];
  const r = Object.fromEntries(L.rankings(cards, {}, {}, '2026-10-19').map((x) => [x.cat.id, x.list]));
  assert.equal(r.groceries[0].card.id, 'f');           // Freedom Flex 5x UR in Q4 2026
  assert.match(r.groceries[0].warn, /Activate/);
  assert.ok(r.costco.find((e) => e.card.id === 'g').excluded);
  assert.ok(!r.costco.find((e) => e.card.id === 'v').excluded);
  assert.ok(r.foreign.find((e) => e.card.id === 'f').pct < r.foreign.find((e) => e.card.id === 'v').pct);
  // Without a Sapphire card, UR points are valued as cash.
  assert.equal(L.cppFor('UR', [flex], {}), 1);
  assert.equal(L.cppFor('UR', [flex, csr], {}), 1.5);
});

test('remaining value counts future months', () => {
  const left = L.remainingThisYear([gold], {}, '2026-10-19');
  // Uber + dining + Dunkin for Oct–Dec, plus the H2 Resy credit
  assert.equal(left, (10 + 10 + 7) * 3 + 50);
});
