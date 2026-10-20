// UI: hash-routed views (home, cards, card detail, best card, summary, settings).
import { CATALOG, catalogById, CATEGORIES, CURRENCIES, ROTATING } from './data.js';
import * as L from './logic.js';
import * as store from './store.js';
import * as sync from './sync.js';
import * as M from './monarch.js';

const $ = (s, el = document) => el.querySelector(s);
const S = () => store.get();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n, dp) => {
  n = Number(n) || 0;
  const d = dp ?? (Math.abs(n - Math.round(n)) > 0.004 ? 2 : 0);
  return `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
};
const pct = (n) => `${(Math.round(n * 10) / 10).toLocaleString('en-US')}%`;
const cardById = (id) => S().cards.find((c) => c.id === id);
const PERIOD_LABEL = { monthly: 'Monthly', quarterly: 'Quarterly', semiannual: 'Twice a year', annual: 'Calendar year', cardyear: 'Card year', multiyear: 'Every few years' };
const ann = (b) => (b.period === 'multiyear' ? `every ${b.years || 4} yrs` : PERIOD_LABEL[b.period]?.toLowerCase());

// ---------- shell ----------
const ROUTES = [
  { path: 'home', label: 'Home', icon: '⏰' },
  { path: 'cards', label: 'Cards', icon: '💳' },
  { path: 'best', label: 'Best card', icon: '🏆' },
  { path: 'summary', label: 'Summary', icon: '📊' },
  { path: 'settings', label: 'Settings', icon: '⚙️' },
];

function route() {
  const [path, arg] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  return { path, arg };
}

function render() {
  const { path, arg } = route();
  const view = { home: viewHome, cards: viewCards, card: viewCard, best: viewBest, summary: viewSummary, settings: viewSettings }[path] || viewHome;
  const active = path === 'card' ? 'cards' : path;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === active));
  const main = $('#main');
  main.innerHTML = view(arg);
  main.focus({ preventScroll: true });
  renderSync();
}

function renderNav() {
  const links = ROUTES.map((r) => `<a href="#/${r.path}" data-nav="${r.path}"><span class="ni">${r.icon}</span><span>${r.label}</span></a>`).join('');
  $('#topnav').innerHTML = links;
  $('#bottomnav').innerHTML = links;
}

function renderSync() {
  const u = sync.currentUser();
  const { status } = sync.syncStatus();
  const el = $('#syncBadge');
  el.className = `sync ${status}`;
  el.textContent = !u ? 'Sign in to sync' : status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Sync error' : 'Synced';
  el.title = u ? `${u.email} — ${sync.syncStatus().lastError || status}` : 'Sign in with Google to sync between devices';
}

// ---------- shared pieces ----------
function cardChip(card) {
  const d = L.cardDef(card);
  return `<span class="chip"><i class="swatch" style="background:${d.color}"></i>${esc(d.name)}</span>`;
}

function dueLabel(s) {
  if (s.daysLeft == null) return s.p.locked ? esc(s.p.label) : s.b.auto ? `<span class="due">Posts automatically</span>` : 'No deadline';
  const when = L.fmtShort(s.p.deadline);
  if (s.daysLeft < 0) return `<span class="due late">Deadline passed ${when}</span>`;
  if (s.daysLeft === 0) return `<span class="due urgent">Due today</span>`;
  const cls = s.daysLeft <= 7 ? 'urgent' : s.daysLeft <= 30 ? 'soon' : '';
  return `<span class="due ${cls}">${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} · ${when}</span>`;
}

function progress(s) {
  if (s.b.kind !== 'amount' || !s.total) return '';
  const w = Math.min(100, (s.used / s.total) * 100);
  return `<div class="bar"><i style="width:${w}%"></i></div>`;
}

function amountText(s) {
  if (s.b.kind === 'amount') return s.used ? `${money(s.remaining)} of ${money(s.total)} left` : `${money(s.total)} available`;
  return s.total ? `≈ ${money(s.total)} value` : 'Reminder';
}

function actions(s, { compact = false } = {}) {
  const k = `${s.card.id}|${s.b.id}|${s.p.key}`;
  if (s.p.locked) return `<button class="btn ghost sm" data-act="unuse" data-key="${k}">Undo</button>`;
  if (s.done) return `<button class="btn ghost sm" data-act="unuse" data-key="${k}">Undo</button>`;
  const skip = compact ? `<button class="btn ghost sm" data-act="skip" data-key="${k}" title="Not using this one this period">Skip</button>` : '';
  if (s.b.kind === 'amount') {
    return `${skip}<button class="btn sm" data-act="log" data-card="${s.card.id}" data-ben="${s.b.id}" data-period="${s.p.key}">Log $</button>
      <button class="btn primary sm" data-act="full" data-key="${k}" data-amt="${s.total}">Used all</button>`;
  }
  return `${skip}<button class="btn primary sm" data-act="done" data-key="${k}">Mark done</button>`;
}

function todoRow(s) {
  const d = L.cardDef(s.card);
  return `<li class="todo" style="--c:${d.color}">
    <div class="todo-main">
      <div class="todo-title">${esc(s.b.name)}</div>
      <div class="todo-meta">${cardChip(s.card)} <span class="muted">${esc(s.p.label)}</span></div>
      ${progress(s)}
      <div class="todo-amt">${amountText(s)}</div>
    </div>
    <div class="todo-side">${dueLabel(s)}<div class="todo-actions">${actions(s, { compact: true })}</div></div>
  </li>`;
}

const empty = (msg) => `<div class="empty"><p>${msg}</p><a class="btn primary" href="#/cards">Add your cards</a></div>`;

// ---------- Home ----------
function viewHome() {
  const st = S();
  if (!st.cards.length) {
    return `<h1>Welcome</h1>${empty('Add the cards you own and their credits, deadlines and earning rates fill in automatically.')}`;
  }
  const todo = L.todoList(st.cards, st.usage);
  const groups = [
    ['Due within 7 days', (s) => s.daysLeft != null && s.daysLeft <= 7],
    ['Due this month', (s) => s.daysLeft != null && s.daysLeft > 7 && s.daysLeft <= 31],
    ['Later', (s) => s.daysLeft != null && s.daysLeft > 31],
    ['Anytime (no deadline)', (s) => s.daysLeft == null],
  ];
  const y = Number(L.today().slice(0, 4));
  const sums = st.cards.map((c) => L.cardYearSummary(c, st, y));
  const fees = sums.reduce((a, s) => a + s.fee, 0), used = sums.reduce((a, s) => a + s.used, 0);
  const week = todo.filter((s) => s.daysLeft != null && s.daysLeft <= 7).reduce((a, s) => a + s.remaining, 0);
  const month = todo.filter((s) => s.daysLeft != null && s.daysLeft <= 31).reduce((a, s) => a + s.remaining, 0);
  const rot = rotatingBanner();
  return `
    <h1>What to use next</h1>
    <div class="stats">
      <div class="stat"><span>Expiring in 7 days</span><b class="${week ? 'warn' : ''}">${money(week)}</b></div>
      <div class="stat"><span>Expiring in 31 days</span><b>${money(month)}</b></div>
      <a class="stat" href="#/summary"><span>${y} value vs. fees</span><b class="${used >= fees ? 'good' : ''}">${money(used)} / ${money(fees)}</b></a>
    </div>
    ${rot}
    ${todo.length ? groups.map(([title, f]) => {
      const items = todo.filter(f);
      return items.length ? `<section><h2>${title} <span class="count">${items.length}</span></h2><ul class="todos">${items.map(todoRow).join('')}</ul></section>` : '';
    }).join('') : '<div class="empty"><p>🎉 Everything is used up for now.</p></div>'}
    ${skippedNote(st)}
  `;
}

function skippedNote(st) {
  const n = st.cards.flatMap((c) => L.cardBenefits(c).map((b) => L.benefitStatus(c, b, st.usage))).filter((s) => s.skipped && !s.expired).length;
  return n ? `<p class="muted small">${n} benefit${n > 1 ? 's' : ''} skipped this period — open the card to undo.</p>` : '';
}

function rotatingBanner() {
  const st = S(), d = L.today();
  const out = [];
  for (const card of st.cards) {
    const def = L.cardDef(card);
    if (!def.rotating) continue;
    const rot = L.rotatingFor(def.rotating, d, st.settings);
    if (!rot) { out.push(`<b>${esc(def.name)}</b>: this quarter’s 5% categories aren’t set — <a href="#/settings">add them in Settings</a>.`); continue; }
    out.push(`<b>${esc(def.name)}</b> 5% this quarter: ${esc(rot.note || rot.cats.join(', '))}`);
  }
  return out.length ? `<div class="banner">${out.map((x) => `<div>🔄 ${x}</div>`).join('')}</div>` : '';
}

// ---------- Cards ----------
function viewCards() {
  const st = S();
  const y = Number(L.today().slice(0, 4));
  const tiles = st.cards.map((c) => {
    const d = L.cardDef(c), sum = L.cardYearSummary(c, st, y);
    const open = L.todoList([c], st.usage).filter((s) => s.daysLeft != null).length;
    return `<a class="ccard" href="#/card/${c.id}" style="--c:${d.color}">
      <div class="ccard-art"><span class="ccard-name">${esc(d.name)}</span><span class="ccard-net">${esc(d.network)}</span></div>
      <div class="ccard-info">
        <div><span class="muted">Annual fee</span> <b>${money(d.fee)}</b></div>
        <div><span class="muted">Value ${y}</span> <b>${money(sum.used)}</b></div>
        <div><span class="muted">To use</span> <b>${open}</b></div>
      </div></a>`;
  }).join('');
  return `
    <div class="h-row"><h1>My cards</h1><button class="btn primary" data-act="add-card">+ Add card</button></div>
    ${st.cards.length ? `<div class="cgrid">${tiles}</div>` : empty('No cards yet.')}
  `;
}

function openAddCard() {
  const held = new Set(S().cards.map((c) => c.catalogId));
  const items = CATALOG.map((c) => `<button class="pick" data-pick="${c.id}" style="--c:${c.color}">
      <i class="swatch big" style="background:${c.color}"></i>
      <span><b>${esc(c.name)}</b><small>${c.custom ? 'Enter your own details' : `${money(c.fee)}/yr · ${c.benefits.length} tracked credit${c.benefits.length === 1 ? '' : 's'}`}${held.has(c.id) ? ' · added' : ''}</small></span>
    </button>`).join('');
  dialog(`<h2>Add a card</h2><input type="search" id="pickSearch" placeholder="Search cards…" autocomplete="off" autofocus><div class="picks">${items}</div>`, (dlg) => {
    $('#pickSearch', dlg).oninput = (e) => {
      const q = e.target.value.toLowerCase();
      dlg.querySelectorAll('.pick').forEach((b) => { b.hidden = !b.textContent.toLowerCase().includes(q); });
    };
    dlg.querySelectorAll('[data-pick]').forEach((b) => { b.onclick = () => { dlg.close(); setupCard(b.dataset.pick); }; });
  });
}

function setupCard(catalogId, existing) {
  const def = catalogById[catalogId];
  const c = existing || {};
  const [am, ad] = c.anniv ? c.anniv.split('-').map(Number) : [Number(L.today().slice(5, 7)), 1];
  const months = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${am === i + 1 ? 'selected' : ''}>${L.monthName(i + 1)}</option>`).join('');
  const custom = def.custom ? `
    <label>Card name<input id="fName" required value="${esc(c.custom?.name || '')}" placeholder="e.g. Wells Fargo Autograph"></label>
    <div class="row2">
      <label>Network<select id="fNet">${['Visa', 'Mastercard', 'Amex', 'Discover'].map((n) => `<option ${c.custom?.network === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Rewards<select id="fCur">${Object.entries(CURRENCIES).map(([k, v]) => `<option value="${k}" ${(c.custom?.currency || 'CASH') === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    </div>
    <label>Base earning rate (x or %)<input id="fBase" type="number" step="0.25" min="0" value="${c.custom?.base ?? 1}"></label>` : '';
  dialog(`
    <h2>${existing ? 'Card settings' : esc(def.name)}</h2>
    <form id="cardForm" class="form">
      ${custom}
      ${def.custom ? '' : `<label>Nickname (optional)<input id="fNick" value="${esc(c.nickname || '')}" placeholder="${esc(def.name)}"></label>`}
      <fieldset><legend>Card anniversary <small>(the month you opened it — card-year credits reset then)</small></legend>
        <div class="row2"><select id="fMonth">${months}</select><input id="fDay" type="number" min="1" max="31" value="${ad}" aria-label="Day"></div>
      </fieldset>
      <label>Annual fee you pay<input id="fFee" type="number" min="0" step="1" value="${c.fee ?? def.fee}"></label>
      <div class="dlg-actions">
        ${existing ? '<button type="button" class="btn danger" id="fRemove">Remove card</button>' : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button class="btn primary">${existing ? 'Save' : 'Add card'}</button>
      </div>
    </form>`, (dlg) => {
    $('#cardForm', dlg).onsubmit = (e) => {
      e.preventDefault();
      const fee = Number($('#fFee', dlg).value);
      const fields = {
        anniv: `${String($('#fMonth', dlg).value).padStart(2, '0')}-${String($('#fDay', dlg).value || 1).padStart(2, '0')}`,
        fee: fee === def.fee ? null : fee,
      };
      if (def.custom) fields.custom = { name: $('#fName', dlg).value.trim() || 'My card', network: $('#fNet', dlg).value, currency: $('#fCur', dlg).value, base: Number($('#fBase', dlg).value) || 1 };
      else fields.nickname = $('#fNick', dlg).value.trim();
      dlg.close();
      if (existing) store.updateCard(existing.id, fields);
      else { const card = store.addCard(catalogId, fields); location.hash = `#/card/${card.id}`; }
      render();
    };
    const rm = $('#fRemove', dlg);
    if (rm) rm.onclick = () => {
      if (!confirm(`Remove ${L.cardDef(existing).name} and all its tracked usage?`)) return;
      dlg.close(); store.removeCard(existing.id); location.hash = '#/cards'; render();
    };
  });
}

// ---------- Card detail ----------
function historyChips(card, b) {
  const y = Number(L.today().slice(0, 4)), t = L.today();
  let periods = [];
  if (b.period === 'monthly') periods = Array.from({ length: 12 }, (_, i) => [L.ymd(y, i + 1, 1), L.monthName(i + 1)[0]]);
  else if (b.period === 'quarterly') periods = [1, 4, 7, 10].map((m, i) => [L.ymd(y, m, 1), `Q${i + 1}`]);
  else if (b.period === 'semiannual') periods = [[L.ymd(y, 1, 1), 'H1'], [L.ymd(y, 7, 1), 'H2']];
  else return '';
  return `<div class="hist" aria-label="${y} history">${periods.map(([d, lab]) => {
    const p = L.periodFor(b, card, d);
    const future = p.start > t;
    const ended = b.expires && p.start > b.expires;
    const rec = S().usage[`${card.id}|${b.id}|${p.key}`];
    const v = L.recordValue(b, rec), done = L.isDone(b, rec);
    const cls = ended ? 'na' : future ? 'future' : rec?.skipped ? 'skip' : done ? 'full' : v > 0 ? 'part' : p.end < (card.trackedSince || card.addedOn || '') ? 'pre' : p.end < t ? 'miss' : 'open';
    const tip = `${p.label}: ${ended ? 'ended' : rec?.skipped ? 'skipped' : b.kind === 'amount' ? `${money(v)} of ${money(b.amount)}` : done ? 'done' : 'not done'}`;
    return `<button class="h ${cls}" title="${tip}" aria-label="${tip}" ${future || ended ? 'disabled' : ''} data-act="log" data-card="${card.id}" data-ben="${b.id}" data-period="${p.key}">${lab}</button>`;
  }).join('')}</div>`;
}

function benefitBlock(card, b) {
  const s = L.benefitStatus(card, b, S().usage);
  const state = s.expired ? '<span class="tag">Ended</span>' : s.skipped ? '<span class="tag">Skipped</span>' : s.done ? '<span class="tag good">✓ Done</span>' : dueLabel(s);
  const per = b.kind === 'amount' ? `${money(b.amount)} ${ann(b)}` : `${b.value ? `≈ ${money(b.value)} ` : ''}${ann(b)}`;
  return `<li class="ben ${s.done || s.expired ? 'is-done' : ''}">
    <div class="ben-head">
      <div><div class="ben-name">${esc(b.name)} ${b.custom ? '<span class="tag">Custom</span>' : ''}</div>
        <div class="muted small">${per}${b.expires ? ` · until ${L.fmtDate(b.expires)}` : ''}</div></div>
      <div class="ben-state">${state}</div>
    </div>
    ${b.note ? `<p class="small muted">${esc(b.note)}</p>` : ''}
    ${!s.expired ? `${progress(s)}<div class="ben-foot"><span class="small">${esc(s.p.label)} — ${s.skipped ? 'skipped' : amountText(s)}</span>
      <span class="todo-actions">${s.skipped ? `<button class="btn ghost sm" data-act="unuse" data-key="${card.id}|${b.id}|${s.p.key}">Undo skip</button>` : actions(s)}
      <button class="btn ghost sm icon" data-act="edit-ben" data-card="${card.id}" data-ben="${b.id}" title="Edit amount / hide" aria-label="Edit ${esc(b.name)}">✎</button></span></div>` : ''}
    ${historyChips(card, b)}
  </li>`;
}

function viewCard(id) {
  const st = S(), card = cardById(id);
  if (!card) return `<p>Card not found. <a href="#/cards">Back to cards</a></p>`;
  const d = L.cardDef(card), cat = catalogById[card.catalogId];
  const y = Number(L.today().slice(0, 4));
  const sum = L.cardYearSummary(card, st, y);
  const all = L.cardBenefits(card, { includeHidden: true });
  const visible = all.filter((b) => !b.hidden), hidden = all.filter((b) => b.hidden);
  const [am, ad] = L.anniversary(card);
  const cur = CURRENCIES[d.currency];
  const cpp = L.cppFor(d.currency, st.cards, st.settings);
  const bonus = CATEGORIES.map((c) => ({ c, e: L.earnFor(card, c.id, st.cards, st.usage, st.settings) }))
    .filter(({ c, e }) => c.id !== 'foreign' && (e.rate !== d.base || card.earnOverrides?.[c.id] != null));
  const unit = d.currency === 'CASH' ? '%' : 'x';
  const extras = st.extras.filter((e) => e.cardId === card.id).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <a class="back" href="#/cards">← All cards</a>
    <div class="hero" style="--c:${d.color}">
      <div class="hero-art"><span class="ccard-name">${esc(d.name)}</span><span class="ccard-net">${esc(d.network)}</span></div>
      <div class="hero-info">
        <h1>${esc(d.name)}</h1>
        <p class="muted">${esc(cat.issuer || '')}${cat.issuer ? ' · ' : ''}${esc(cur?.label || '')} · anniversary ${L.monthName(am)} ${ad}</p>
        <button class="btn sm" data-act="card-settings" data-card="${card.id}">Card settings</button>
      </div>
    </div>
    <div class="stats">
      <div class="stat"><span>Annual fee</span><b>${money(sum.fee)}</b></div>
      <div class="stat"><span>Value used ${y}</span><b>${money(sum.used)}</b></div>
      <div class="stat"><span>Net ${y}</span><b class="${sum.used - sum.fee >= 0 ? 'good' : 'bad'}">${money(sum.used - sum.fee)}</b></div>
      <div class="stat"><span>Max credits / yr</span><b>${money(sum.potential)}</b></div>
    </div>

    <section>
      <div class="h-row"><h2>Credits & perks to track</h2><button class="btn sm" data-act="add-ben" data-card="${card.id}">+ Custom benefit</button></div>
      ${visible.length ? `<ul class="bens">${visible.map((b) => benefitBlock(card, b)).join('')}</ul>` : '<p class="muted">This card has no recurring credits to track.</p>'}
      ${hidden.length ? `<p class="small muted">Hidden: ${hidden.map((b) => `<button class="link" data-act="unhide" data-card="${card.id}" data-ben="${b.id}">${esc(b.name)} (show)</button>`).join(', ')}</p>` : ''}
    </section>

    <section>
      <div class="h-row"><h2>Extra perk value</h2><button class="btn sm" data-act="add-extra" data-card="${card.id}">+ Log value</button></div>
      <p class="small muted">One-off perks with a dollar value — a lounge visit, a free checked bag, a hotel property credit, a companion ticket.</p>
      ${extras.length ? `<ul class="extras">${extras.map((e) => `<li><span>${L.fmtDate(e.date)}</span><span>${esc(e.desc)}</span><b>${money(e.value)}</b><button class="btn ghost sm icon" data-act="del-extra" data-id="${e.id}" aria-label="Delete">✕</button></li>`).join('')}</ul>` : ''}
    </section>

    <section>
      <div class="h-row"><h2>Earning rates</h2><button class="btn sm" data-act="edit-earn" data-card="${card.id}">Edit rates</button></div>
      <table class="tbl">
        <thead><tr><th>Category</th><th>Earns</th><th title="At ${cpp}¢ per point">≈ Return</th></tr></thead>
        <tbody>
          ${bonus.map(({ c, e }) => `<tr><td>${c.icon} ${esc(c.label)}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}${e.warn ? `<div class="small warn">⚠️ ${esc(e.warn)}</div>` : ''}</td><td>${e.rate}${unit}</td><td>${pct(e.pct)}</td></tr>`).join('')}
          <tr><td>💳 Everything else</td><td>${d.base}${unit}</td><td>${pct(d.base * cpp)}</td></tr>
        </tbody>
      </table>
      ${d.currency !== 'CASH' ? `<p class="small muted">Return assumes ${cpp}¢ per ${cur.short === 'mi' ? 'mile' : 'point'} (change in Settings).</p>` : ''}
    </section>

    ${cat.perks.length ? `<section><h2>Other benefits</h2><ul class="perks">${cat.perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></section>` : ''}
  `;
}

function openLog(cardId, benId, periodKey) {
  const card = cardById(cardId);
  const b = L.cardBenefits(card, { includeHidden: true }).find((x) => x.id === benId);
  const key = `${cardId}|${benId}|${periodKey}`;
  const rec = S().usage[key] || {};
  // find a label for the period
  const label = periodKey.match(/^\d{4}-\d{2}$/) ? `${L.monthName(Number(periodKey.slice(5)))} ${periodKey.slice(0, 4)}` : periodKey.replace('-', ' ').replace(/^CY/, 'Card year ').replace(/^M/, 'Used in ');
  if (b.kind === 'check') {
    dialog(`<h2>${esc(b.name)}</h2><p class="muted">${esc(label)}</p>
      <form class="form" id="chk"><label class="check"><input type="checkbox" id="cDone" ${rec.done ? 'checked' : ''}> Done / received</label>
      <div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (dlg) => {
      $('#chk', dlg).onsubmit = (e) => { e.preventDefault(); store.setUsage(key, { done: $('#cDone', dlg).checked, skipped: false }); dlg.close(); render(); };
    });
    return;
  }
  const used = L.recordValue(b, rec);
  dialog(`<h2>${esc(b.name)}</h2><p class="muted">${esc(L.cardDef(card).name)} · ${esc(label)} · ${money(b.amount)} credit</p>
    <form class="form" id="logf">
      <label>Add an amount used<div class="money-in"><span>$</span><input id="lAdd" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00" autofocus></div></label>
      <p class="small">Used so far: <b>${money(used)}</b> of ${money(b.amount)}</p>
      <details><summary class="small">Set the total instead</summary>
        <label>Total used this period<div class="money-in"><span>$</span><input id="lSet" type="number" min="0" step="0.01" inputmode="decimal" value="${used || ''}"></div></label></details>
      <div class="dlg-actions">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="button" class="btn" id="lFull">Used all ${money(b.amount)}</button>
        <button class="btn primary">Save</button>
      </div>
    </form>`, (dlg) => {
    const save = (amt) => {
      amt = Math.max(0, Math.round(amt * 100) / 100);
      store.setUsage(key, { amt, done: amt >= b.amount - 0.005, skipped: false });
      dlg.close(); render();
    };
    $('#lFull', dlg).onclick = () => save(b.amount);
    $('#logf', dlg).onsubmit = (e) => {
      e.preventDefault();
      const set = $('#lSet', dlg).value, add = Number($('#lAdd', dlg).value) || 0;
      const setChanged = set !== '' && Number(set) !== used;
      save(setChanged ? Number(set) : used + add);
    };
  });
}

function openEditBenefit(cardId, benId) {
  const card = cardById(cardId);
  const b = benId ? L.cardBenefits(card, { includeHidden: true }).find((x) => x.id === benId) : null;
  const isNew = !b;
  const kind = b?.kind || 'amount';
  const periods = Object.entries(PERIOD_LABEL).map(([k, v]) => `<option value="${k}" ${(b?.period || 'monthly') === k ? 'selected' : ''}>${v}</option>`).join('');
  dialog(`<h2>${isNew ? 'Add a custom benefit' : esc(b.name)}</h2>
    <form class="form" id="benf">
      ${isNew || b.custom ? `
        <label>Name<input id="bName" required value="${esc(b?.name || '')}" placeholder="e.g. Hotel property credit"></label>
        <div class="row2">
          <label>Type<select id="bKind"><option value="amount" ${kind === 'amount' ? 'selected' : ''}>Dollar credit</option><option value="check" ${kind === 'check' ? 'selected' : ''}>Checkbox perk</option></select></label>
          <label>Resets<select id="bPeriod">${periods}</select></label>
        </div>
        <label>Every how many years (if “Every few years”)<input id="bYears" type="number" min="1" value="${b?.years || 4}"></label>
        <label>Note<input id="bNote" value="${esc(b?.note || '')}"></label>` : `<p class="small muted">${esc(PERIOD_LABEL[b.period])} · ${esc(b.note || '')}</p>`}
      <label id="bAmtL">${kind === 'amount' ? 'Credit amount per period' : 'Estimated value per period'}<div class="money-in"><span>$</span><input id="bAmt" type="number" min="0" step="0.01" value="${b ? L.benefitAmount(b) : ''}" required></div></label>
      <div class="dlg-actions">
        ${!isNew ? `<button type="button" class="btn danger" id="bHide">${b.custom ? 'Delete' : 'Hide from tracking'}</button>` : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button>
      </div>
    </form>`, (dlg) => {
    const kindSel = $('#bKind', dlg);
    if (kindSel) kindSel.onchange = () => { $('#bAmtL', dlg).firstChild.textContent = kindSel.value === 'amount' ? 'Credit amount per period' : 'Estimated value per period'; };
    $('#benf', dlg).onsubmit = (e) => {
      e.preventDefault();
      const amt = Number($('#bAmt', dlg).value) || 0;
      if (isNew || b.custom) {
        const k = $('#bKind', dlg).value;
        const nb = { id: b?.id || `c-${store.uid()}`, name: $('#bName', dlg).value.trim(), kind: k, period: $('#bPeriod', dlg).value, years: Number($('#bYears', dlg).value) || 4, note: $('#bNote', dlg).value.trim(), [k === 'amount' ? 'amount' : 'value']: amt };
        const list = (card.customBenefits || []).filter((x) => x.id !== nb.id);
        store.updateCard(card.id, { customBenefits: [...list, nb] });
      } else {
        const ov = { ...(card.benefitOverrides || {}) };
        ov[b.id] = { ...(ov[b.id] || {}), [b.kind === 'amount' ? 'amount' : 'value']: amt };
        store.updateCard(card.id, { benefitOverrides: ov });
      }
      dlg.close(); render();
    };
    const hide = $('#bHide', dlg);
    if (hide) hide.onclick = () => {
      if (b.custom) store.updateCard(card.id, { customBenefits: card.customBenefits.filter((x) => x.id !== b.id) });
      else store.updateCard(card.id, { benefitOverrides: { ...card.benefitOverrides, [b.id]: { ...(card.benefitOverrides?.[b.id] || {}), hidden: true } } });
      dlg.close(); render();
    };
  });
}

function openEditEarn(cardId) {
  const card = cardById(cardId), d = L.cardDef(card), st = S();
  const rows = CATEGORIES.filter((c) => c.id !== 'foreign').map((c) => {
    const e = L.earnFor(card, c.id, st.cards, st.usage, st.settings);
    const ov = card.earnOverrides?.[c.id];
    return `<label class="earn-row"><span>${c.icon} ${esc(c.label)}</span><input type="number" min="0" step="0.25" data-cat="${c.id}" value="${ov ?? ''}" placeholder="${e.rate}"></label>`;
  }).join('');
  dialog(`<h2>Earning rates</h2><p class="small muted">Leave blank to use the built-in rate (shown greyed). Enter ${d.currency === 'CASH' ? '% back' : 'points per $'}.</p>
    <form class="form" id="earnf"><div class="earn-grid">${rows}</div>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`, (dlg) => {
    $('#earnf', dlg).onsubmit = (e) => {
      e.preventDefault();
      const ov = {};
      dlg.querySelectorAll('[data-cat]').forEach((i) => { if (i.value !== '') ov[i.dataset.cat] = Number(i.value); });
      store.updateCard(card.id, { earnOverrides: ov });
      dlg.close(); render();
    };
  });
}

function openAddExtra(cardId) {
  dialog(`<h2>Log extra perk value</h2><form class="form" id="exf">
    <label>What<input id="eDesc" required placeholder="e.g. Priority Pass lounge visit (SFO)"></label>
    <div class="row2"><label>Date<input id="eDate" type="date" value="${L.today()}" required></label>
    <label>Estimated value<div class="money-in"><span>$</span><input id="eVal" type="number" min="0" step="0.01" required></div></label></div>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Add</button></div></form>`, (dlg) => {
    $('#exf', dlg).onsubmit = (e) => {
      e.preventDefault();
      store.addExtra({ cardId, desc: $('#eDesc', dlg).value.trim(), date: $('#eDate', dlg).value, value: Number($('#eVal', dlg).value) || 0 });
      dlg.close(); render();
    };
  });
}

// ---------- Best card ----------
function viewBest() {
  const st = S();
  if (!st.cards.length) return `<h1>Best card for each purchase</h1>${empty('Add cards to see which to use where.')}`;
  const ranks = L.rankings(st.cards, st.usage, st.settings);
  const unitOf = (e) => (e.def.currency === 'CASH' ? `${e.rate}%` : `${e.rate}x`);
  return `
    <h1>Best card for each purchase</h1>
    <p class="muted">Ranked by estimated return: points × their value (${Object.entries(CURRENCIES).filter(([k]) => k !== 'CASH' && st.cards.some((c) => L.cardDef(c).currency === k)).map(([k, v]) => `${v.brief} ${L.cppFor(k, st.cards, st.settings)}¢`).join(', ')}). Caps and rotating categories are noted.</p>
    ${rotatingBanner()}
    <div class="best">
      ${ranks.map(({ cat, list }) => {
        const [top, ...rest] = list;
        return `<details class="cat">
          <summary>
            <span class="cat-ic">${cat.icon}</span>
            <span class="cat-main"><b>${esc(cat.label)}</b>
              <span class="cat-top">${top.excluded ? 'No accepted card' : `${cardChip(top.card)} <b>${pct(top.pct)}</b> <span class="muted">(${unitOf(top)})</span>`}</span>
              ${top.warn ? `<span class="small warn">⚠️ ${esc(top.warn)}</span>` : ''}
            </span>
          </summary>
          ${cat.note ? `<p class="small muted">${esc(cat.note)}</p>` : ''}
          <ol class="rank">${list.map((e) => `<li class="${e.excluded ? 'excluded' : ''}">
            ${cardChip(e.card)}<span class="r-val">${e.excluded ? '—' : `${pct(e.pct)} <span class="muted">(${unitOf(e)})</span>`}</span>
            ${e.note || e.excluded || e.warn ? `<div class="small muted">${esc(e.excluded || e.note)}${e.warn ? ` <span class="warn">⚠️ ${esc(e.warn)}</span>` : ''}</div>` : ''}
          </li>`).join('')}</ol>
        </details>`;
      }).join('')}
    </div>`;
}

// ---------- Summary ----------
function viewSummary(arg) {
  const st = S();
  if (!st.cards.length) return `<h1>Summary</h1>${empty('Add cards to compare fees with value.')}`;
  const thisYear = Number(L.today().slice(0, 4));
  const year = Number(arg) || thisYear;
  const sums = st.cards.map((c) => L.cardYearSummary(c, st, year)).sort((a, b) => b.fee - a.fee || b.used - a.used);
  const fees = sums.reduce((a, s) => a + s.fee, 0);
  const credits = sums.reduce((a, s) => a + s.credits, 0);
  const extras = sums.reduce((a, s) => a + s.extras, 0);
  const used = credits + extras, net = used - fees;
  const potential = sums.reduce((a, s) => a + s.potential, 0);
  const left = year === thisYear ? L.remainingThisYear(st.cards, st.usage) : 0;
  const max = Math.max(1, ...sums.map((s) => Math.max(s.fee, s.used)));
  const years = [thisYear - 1, thisYear];
  return `
    <div class="h-row"><h1>Summary</h1>
      <div class="seg">${years.map((y) => `<a href="#/summary/${y}" class="${y === year ? 'on' : ''}">${y}</a>`).join('')}</div></div>
    <div class="stats big">
      <div class="stat"><span>Total annual fees</span><b>${money(fees)}</b></div>
      <div class="stat"><span>Value used ${year}</span><b>${money(used)}</b><small>${money(credits)} credits · ${money(extras)} extras</small></div>
      <div class="stat"><span>Net</span><b class="${net >= 0 ? 'good' : 'bad'}">${net >= 0 ? '+' : ''}${money(net)}</b><small>${fees ? `${Math.round((used / fees) * 100)}% of fees recovered` : ''}</small></div>
      ${year === thisYear ? `<div class="stat"><span>Still available by Dec 31</span><b>${money(left)}</b><small>${money(used + left)} possible this year</small></div>` : ''}
    </div>
    ${fees ? `<div class="meter" role="img" aria-label="${money(used)} used of ${money(fees)} in fees"><i style="width:${Math.min(100, (used / fees) * 100)}%"></i>${used + left > used ? `<i class="pot" style="width:${Math.min(100, (left / fees) * 100)}%"></i>` : ''}</div>
      <div class="legend small"><span><i class="lg used"></i>Used</span>${year === thisYear ? '<span><i class="lg pot"></i>Still available</span>' : ''}<span class="muted">Bar = total fees</span></div>` : ''}
    <section>
      <h2>By card</h2>
      <div class="table-wrap"><table class="tbl sum">
        <thead><tr><th>Card</th><th>Fee</th><th>Used</th><th>Net</th><th class="hide-sm">Max credits/yr</th></tr></thead>
        <tbody>${sums.map((s) => `<tr>
          <td><a href="#/card/${s.card.id}">${cardChip(s.card)}</a>
            <div class="mini"><i class="f" style="width:${(s.fee / max) * 100}%"></i><i class="u" style="width:${(s.used / max) * 100}%"></i></div></td>
          <td>${money(s.fee)}</td><td>${money(s.used)}</td>
          <td class="${s.used - s.fee >= 0 ? 'good' : 'bad'}">${money(s.used - s.fee)}</td>
          <td class="hide-sm">${money(s.potential)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td><td>${money(fees)}</td><td>${money(used)}</td><td class="${net >= 0 ? 'good' : 'bad'}">${money(net)}</td><td class="hide-sm">${money(potential)}</td></tr></tfoot>
      </table></div>
      <p class="small muted">Value counts statement credits and perks you’ve logged, not points or cash back from everyday spending. Card-year credits count in the year you logged them. Fees count in full for each year you hold the card.</p>
    </section>`;
}

// ---------- Settings ----------
function viewSettings() {
  const st = S(), u = sync.currentUser(), ss = sync.syncStatus();
  const curs = Object.entries(CURRENCIES).filter(([k]) => k !== 'CASH');
  const q = L.quarterKey(L.today());
  const programs = [['chase', 'Chase Freedom'], ['discover', 'Discover it']];
  return `
    <h1>Settings</h1>
    <section class="panel">
      <h2>Account & sync</h2>
      ${u ? `<p>Signed in as <b>${esc(u.email)}</b>. ${ss.status === 'error' ? `<span class="bad">${esc(ss.lastError)}</span>` : 'Your cards sync to your other devices.'}</p>
        <button class="btn" data-act="signout">Sign out</button>`
        : `<p>Sign in with Google to keep your cards in sync between your phone and computer. Without signing in, data stays in this browser only.</p>
        ${ss.status === 'error' ? `<p class="bad small">${esc(ss.lastError)}</p>` : ''}
        <button class="btn primary" data-act="signin">Sign in with Google</button>`}
    </section>
    <section class="panel">
      <h2>Point values</h2>
      <p class="small muted">Cents per point used to rank cards on the Best card page.</p>
      <form id="cppf" class="cpp-grid">${curs.map(([k, v]) => `<label>${esc(v.label)}<div class="money-in"><input type="number" step="0.05" min="0" data-cpp="${k}" value="${st.settings.cpp?.[k] ?? v.cpp}"><span>¢</span></div>${v.note ? `<small class="muted">${esc(v.note)}</small>` : ''}</label>`).join('')}</form>
    </section>
    <section class="panel">
      <h2>Rotating 5% categories — ${q.replace('-', ' ')}</h2>
      <p class="small muted">Built in for quarters announced so far. When a new quarter starts, tick its categories here.</p>
      ${programs.map(([p, name]) => {
        const rot = L.rotatingFor(p, L.today(), st.settings);
        return `<fieldset class="rot"><legend>${name}${ROTATING[p]?.[q] && !st.settings.rotating?.[p]?.[q] ? ' <small class="muted">(built in)</small>' : ''}</legend>
          ${CATEGORIES.filter((c) => !['foreign', 'other', 'portal'].includes(c.id)).map((c) => `<label class="check"><input type="checkbox" data-rot="${p}" value="${c.id}" ${rot?.cats.includes(c.id) ? 'checked' : ''}> ${c.icon} ${esc(c.label)}</label>`).join('')}
        </fieldset>`;
      }).join('')}
    </section>
    <section class="panel">
      <h2>Import from Monarch</h2>
      <p class="small muted">In Monarch, open Transactions → ⋯ → Download, then choose the CSV here. Statement credits (Amex dining, Dunkin’, Resy, Chase travel and dining credits…) are matched to your benefits, and you review them before anything is saved. Importing the same file twice won’t double count. The file is read in your browser and never uploaded.</p>
      <label class="btn primary">Choose Monarch CSV<input type="file" accept=".csv,text/csv" id="monarchFile" hidden></label>
    </section>
    <section class="panel">
      <h2>Backup</h2>
      <div class="btns"><button class="btn" data-act="export">Export JSON</button>
      <label class="btn">Import JSON<input type="file" accept="application/json" id="importFile" hidden></label></div>
    </section>
    <p class="small muted">Card terms were researched in October 2026 and change often — check your issuer’s site, and edit any amount on the card page.</p>`;
}

// ---------- Monarch import ----------
function openMonarchImport(txns, fileName) {
  const st = S();
  if (!st.cards.length) { alert('Add your cards first, then import.'); return; }
  const accounts = [...new Set(txns.map((t) => t.account))].filter((a) => !/checking|savings|personal profile/i.test(a)).sort();
  const saved = st.settings.accountMap || {};
  const map = Object.fromEntries(accounts.map((a) => [a, saved[a] ?? M.guessCard(a, st.cards)]));
  const dates = txns.map((t) => t.date).sort();
  const cardOpts = (sel) => `<option value="">— ignore —</option>${st.cards.map((c) => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(L.cardDef(c).name)}</option>`).join('')}`;
  let result;

  const body = () => {
    result = M.matchCredits(txns, st.cards, map, st.usage);
    const fresh = result.matched.filter((m) => !m.dup);
    const mapped = st.cards.filter((c) => Object.values(map).includes(c.id));
    const invisible = mapped.flatMap((c) => L.cardBenefits(c).filter((b) => M.notOnStatement(c, b) && !L.isExpired(b) && L.benefitAmount(b) > 0).map((b) => `${esc(b.name)} <span class="muted">(${esc(L.cardDef(c).name)})</span>`));
    return `
      <h3>Credits found <span class="count">${fresh.length} new</span></h3>
      ${result.matched.length ? `<ul class="imp">${result.matched.map((m, i) => `<li class="${m.dup ? 'dup' : ''}">
        <label class="check"><input type="checkbox" data-m="${i}" ${m.dup ? 'disabled' : 'checked'}>
        <span class="imp-main"><b>${esc(m.b.name)}</b> · ${esc(m.p.label)}<br><span class="small muted">${L.fmtDate(m.t.date)} · ${cardChip(m.card)} · ${esc(m.t.statement)}${m.dup ? ' · already imported' : ''}</span></span>
        <b class="imp-amt">${money(m.t.amount)}</b></label></li>`).join('')}</ul>` : '<p class="muted small">No statement credits found for the mapped accounts.</p>'}
      ${result.other.length ? `<details class="imp-other"><summary>Other credits on these cards (${result.other.length}) — refunds, or credits worded differently</summary>
        <p class="small muted">If one of these is a benefit credit, pick the benefit to add it.</p>
        <ul class="imp">${result.other.map((o, i) => `<li class="${o.dup ? 'dup' : ''}"><span class="imp-main">${L.fmtDate(o.t.date)} · ${esc(o.t.statement)}<br><span class="small">${cardChip(o.card)}</span></span>
          <b class="imp-amt">${money(o.t.amount)}</b>
          <select data-o="${i}" ${o.dup ? 'disabled' : ''}><option value="">— not a benefit —</option>${L.cardBenefits(o.card).map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></li>`).join('')}</ul></details>` : ''}
      ${invisible.length ? `<details class="imp-other"><summary>Benefits bank data can’t show (${invisible.length})</summary><p class="small muted">These are applied inside an app or post as miles, so mark them yourself on the Home screen:</p><ul class="small">${invisible.map((x) => `<li>${x}</li>`).join('')}</ul></details>` : ''}`;
  };

  dialog(`<h2>Import from Monarch</h2>
    <p class="small muted">${esc(fileName)} · ${txns.length} transactions · ${L.fmtDate(dates[0])} – ${L.fmtDate(dates.at(-1))}</p>
    <h3>Which card is each account?</h3>
    <div class="imp-map">${accounts.map((a) => `<label><span>${esc(a)}</span><select data-acct="${esc(a)}">${cardOpts(map[a])}</select></label>`).join('')}</div>
    <div id="impBody">${body()}</div>
    <div class="dlg-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button type="button" class="btn primary" id="impGo">Add credits</button></div>`, (dlg) => {
    dlg.classList.add('wide');
    dlg.addEventListener('close', () => dlg.classList.remove('wide'), { once: true });
    const count = () => {
      const n = dlg.querySelectorAll('[data-m]:checked').length + [...dlg.querySelectorAll('[data-o]')].filter((s) => s.value).length;
      $('#impGo', dlg).textContent = n ? `Add ${n} credit${n === 1 ? '' : 's'}` : 'Nothing new — save accounts';
    };
    dlg.querySelectorAll('[data-acct]').forEach((s) => { s.onchange = () => { map[s.dataset.acct] = s.value; $('#impBody', dlg).innerHTML = body(); count(); }; });
    dlg.addEventListener('change', (e) => { if (e.target.dataset.m != null || e.target.dataset.o != null) count(); });
    count();
    $('#impGo', dlg).onclick = () => {
      const picked = [...dlg.querySelectorAll('[data-m]:checked')].map((i) => result.matched[i.dataset.m]);
      for (const s of dlg.querySelectorAll('[data-o]')) {
        if (!s.value) continue;
        const o = result.other[s.dataset.o];
        const b = L.cardBenefits(o.card).find((x) => x.id === s.value);
        picked.push({ t: o.t, card: o.card, b, p: L.periodFor(b, o.card, o.t.date, st.usage) });
      }
      const groups = new Map();
      for (const m of picked) {
        const k = L.usageKey(m.card, m.b, m.p);
        if (!groups.has(k)) groups.set(k, { b: m.b, items: [] });
        groups.get(k).items.push(m);
      }
      for (const [k, { b, items }] of groups) store.setUsage(k, M.applyToRecord(b, S().usage[k], items));
      store.setSettings({ accountMap: { ...saved, ...map } });
      // The export covers these cards from its first date, so earlier gaps in the history strip are real misses.
      for (const id of new Set(Object.values(map).filter(Boolean))) {
        const c = cardById(id);
        if (c && dates[0] < (c.trackedSince || c.addedOn || '9999')) store.updateCard(id, { trackedSince: dates[0] });
      }
      const total = picked.reduce((a, m) => a + m.t.amount, 0);
      dlg.close();
      location.hash = '#/summary';
      render();
      toast(picked.length ? `Added ${money(total)} from ${picked.length} credit${picked.length === 1 ? '' : 's'}.` : 'No new credits — you’re up to date.');
    };
  });
}

function toast(msg) {
  const el = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg, role: 'status' });
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
}

// ---------- dialog ----------
function dialog(html, mount) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<button class="dlg-x" data-close aria-label="Close">✕</button>${html}`;
  dlg.querySelectorAll('[data-close]').forEach((b) => { b.onclick = () => dlg.close(); });
  mount?.(dlg);
  dlg.showModal();
  dlg.querySelector('[autofocus]')?.focus();
}

// ---------- events ----------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const { act, key, card, ben, period } = t.dataset;
  switch (act) {
    case 'add-card': openAddCard(); break;
    case 'card-settings': { const c = cardById(card); setupCard(c.catalogId, c); break; }
    case 'log': openLog(card, ben, period); break;
    case 'full': store.setUsage(key, { amt: Number(t.dataset.amt), done: true, skipped: false }); render(); break;
    case 'done': store.setUsage(key, { done: true, skipped: false }); render(); break;
    case 'skip': store.setUsage(key, { skipped: true }); render(); break;
    case 'unuse': store.setUsage(key, { amt: 0, done: false, skipped: false }); render(); break;
    case 'edit-ben': openEditBenefit(card, ben); break;
    case 'add-ben': openEditBenefit(card, null); break;
    case 'unhide': {
      const c = cardById(card);
      store.updateCard(card, { benefitOverrides: { ...c.benefitOverrides, [ben]: { ...(c.benefitOverrides?.[ben] || {}), hidden: false } } });
      render(); break;
    }
    case 'edit-earn': openEditEarn(card); break;
    case 'add-extra': openAddExtra(card); break;
    case 'del-extra': store.removeExtra(t.dataset.id); render(); break;
    case 'signin': try { await sync.signIn(); } catch (err) { alert(err.message); } break;
    case 'signout': if (confirm('Sign out? Your data stays in your account and is removed from this device.')) await sync.signOut(); break;
    case 'export': {
      const blob = new Blob([JSON.stringify(store.syncable(), null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `card-perks-${L.today()}.json` });
      a.click(); URL.revokeObjectURL(a.href); break;
    }
  }
});

document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.cpp) {
    store.setSettings({ cpp: { ...S().settings.cpp, [t.dataset.cpp]: Number(t.value) } });
  } else if (t.dataset.rot) {
    const p = t.dataset.rot, q = L.quarterKey(L.today());
    const cats = [...document.querySelectorAll(`[data-rot="${p}"]:checked`)].map((i) => i.value);
    const labels = cats.map((c) => CATEGORIES.find((x) => x.id === c).label).join(', ');
    store.setSettings({ rotating: { ...S().settings.rotating, [p]: { ...(S().settings.rotating?.[p] || {}), [q]: { cats, note: labels } } } });
  } else if (t.id === 'monarchFile' && t.files[0]) {
    const file = t.files[0];
    t.value = '';
    try { openMonarchImport(M.monarchTransactions(await file.text()), file.name); } catch (err) { alert(`Import failed: ${err.message}`); }
  } else if (t.id === 'importFile' && t.files[0]) {
    try {
      const data = JSON.parse(await t.files[0].text());
      if (!Array.isArray(data.cards)) throw new Error('Not a Card Perks backup.');
      if (confirm(`Replace this device’s data with ${data.cards.length} cards from the backup?`)) { store.replaceAll(data); render(); }
    } catch (err) { alert(`Import failed: ${err.message}`); }
  }
});

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
sync.onSyncChange(({ remoteChanged }) => { if (remoteChanged) render(); else renderSync(); });
$('#syncBadge').onclick = () => { location.hash = '#/settings'; };

// Re-render at midnight-ish so deadlines stay right on a long-open tab.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') render(); });

renderNav();
render();
sync.initSync();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
