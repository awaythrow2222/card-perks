// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/monarch.js';

const CSV = `Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner,Reviewed,Id
2026-03-01,Dunkin',Eating Out,Gold Card (...1007),AMEX DUNKIN' CREDIT,,7.00,,,,a1
2026-02-05,Dunkin',Transfer,Gold Card (...1007),AMEX DUNKIN' CREDIT,,7.00,,,,a2
2026-02-05,Restaurants,Eating Out,Gold Card (...1007),AMEX Dining Credit,,10.00,,,,a3
2026-07-03,Resy,Eating Out,Gold Card (...1007),AMEX RESY CREDIT,,50.00,,,,a4
2026-07-12,Travel Credit,Transfer,Chase Sapphire RESERVE,TRAVEL CREDIT $300/YEAR,,198.54,,,,c1
2026-06-14,Dining Credit,Eating Out,Chase Sapphire RESERVE,DINING CREDIT $300/YEAR,,150.00,,,,c2
2026-06-14,StubHub,Entertainment,Chase Sapphire RESERVE,STUBHUB INC,,-143.59,,,,c3
2026-10-12,Amazon,Misc Shopping,Chase Sapphire RESERVE,Amazon.com,,88.62,,,,c4
2026-01-01,Autopay,Credit Card Payment,Chase Sapphire RESERVE,AUTOPAY PAYMENT,,500.00,,,,c5
2026-05-01,Paycheck,Paychecks,Checking (...5025),"ACME, INC PAYROLL",,2000.00,,,,k1
`;

const gold = { id: 'g', catalogId: 'amex-gold', anniv: '03-15' };
const csr = { id: 's', catalogId: 'csr', anniv: '06-01' };
const cards = [gold, csr];

test('parses quoted fields and Monarch columns', () => {
  const t = M.monarchTransactions(CSV);
  assert.equal(t.length, 10);
  assert.equal(t.at(-1).statement, 'ACME, INC PAYROLL');
  assert.equal(t[0].amount, 7);
  assert.throws(() => M.monarchTransactions('a,b\n1,2\n'), /Monarch/);
});

test('guesses cards from account names', () => {
  assert.equal(M.guessCard('Dallas - American Express Gold Card (...1007)', cards), 'g');
  assert.equal(M.guessCard('Chase Sapphire RESERVE - Dallas ', cards), 's');
  assert.equal(M.guessCard('Dallas - Checking (...5025)', cards), '');
  assert.equal(M.guessCard('Chase Freedom 2 (Previously Sapphire Preferred)', [{ id: 'f', catalogId: 'freedom' }, { id: 'p', catalogId: 'csp' }]), 'f');
});

test('matches credits to benefits and periods; ignores purchases, payments and refunds', () => {
  const txns = M.monarchTransactions(CSV);
  const map = { 'Gold Card (...1007)': 'g', 'Chase Sapphire RESERVE': 's' };
  const { matched, other } = M.matchCredits(txns, cards, map, {});
  const got = matched.map((m) => `${m.card.id}:${m.b.id}:${m.p.key}:${m.t.amount}`).sort();
  assert.deepEqual(got, [
    'g:dining:2026-02:10', 'g:dunkin:2026-02:7', 'g:dunkin:2026-03:7', 'g:resy:2026-H2:50',
    's:dining:2026-H1:150', 's:travel:CY2026:198.54',
  ]);
  assert.deepEqual(other.map((o) => o.t.id), ['c4']); // the Amazon refund, not the payment
});

test('a credit posting early in the next month falls back when that month is already full', () => {
  const txns = [
    { id: 'x1', date: '2026-03-01', account: 'A', amount: 7, statement: "AMEX DUNKIN' CREDIT", merchant: '', category: '' },
    { id: 'x2', date: '2026-03-20', account: 'A', amount: 7, statement: "AMEX DUNKIN' CREDIT", merchant: '', category: '' },
  ];
  const { matched } = M.matchCredits(txns, cards, { A: 'g' }, {});
  // The Mar 20 credit fills March, so if Mar 1 was February's purchase it would need to move back.
  // Sorted by date, Mar 1 is placed first in March; Mar 20 then finds March full and Feb more than 10 days away, so it stays.
  assert.deepEqual(matched.map((m) => m.p.key), ['2026-03', '2026-03']);
  const usage = { 'g|dunkin|2026-03': { amt: 7, done: true } };
  const r2 = M.matchCredits([txns[0]], cards, { A: 'g' }, usage);
  assert.equal(r2.matched[0].p.key, '2026-02');
});

test('re-importing the same file adds nothing', () => {
  const txns = M.monarchTransactions(CSV);
  const map = { 'Gold Card (...1007)': 'g' };
  const first = M.matchCredits(txns, cards, map, {});
  const usage = {};
  for (const m of first.matched) {
    const k = `${m.card.id}|${m.b.id}|${m.p.key}`;
    usage[k] = { ...usage[k], ...M.applyToRecord(m.b, usage[k], [m]) };
  }
  assert.deepEqual(usage['g|resy|2026-H2'], { amt: 50, done: true, skipped: false, imported: { a4: 50 } });
  const again = M.matchCredits(txns, cards, map, usage);
  assert.ok(again.matched.every((m) => m.dup));
  assert.deepEqual(M.applyToRecord(first.matched[0].b, usage['g|dunkin|2026-02'], [first.matched[0]]).amt, 7);
});
