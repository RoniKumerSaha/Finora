/**
 * app.js — Finora V1 render layer + router + state glue.
 *
 * Per AD-6 + AD-7:
 *   - Hybrid render: every screen has a `render(state)` hook. On data change,
 *     we call render(state) for the active screen.
 *   - Focus rule: if `document.activeElement` is inside the active screen,
 *     skip full re-render and only update derived text (the "remaining"
 *     label on a goal form, etc.). Otherwise full re-render.
 *   - Hash routing with `<a href="#screen">` upgrade — buttons inside forms
 *     use `data-goto` and the existing click bridge handles them.
 *   - Theming: settings.theme drives `document.documentElement.dataset.theme`.
 *     'auto' listens to prefers-color-scheme.
 *   - Persistence: state is saved to localStorage on every dataChanged().
 *
 * This module is browser-loadable as an ES module. The init() function is
 * the entry point called from a `<script type="module">` block at the end
 * of index.html.
 */

import { load, save } from './persistence.js';
import { recomputeDerived } from './recompute.js';
import * as accounts from './accounts.js';
import * as transactions from './transactions.js';
import * as goals from './goals.js';
import * as debts from './debts.js';
import * as investments from './investments.js';
import {
  monthlyIncome, monthlyExpenses, accountBalance,
  investmentMaturityValue, goalRequiredPerMonth,
  daysToMaturity,
} from './math.js';

let state = null;          // current state (mutable in place; reads are pure)
let activeScreenId = null; // id of the currently visible screen

/**
 * Boot. Loads state, wires theme, sets up router + render hooks.
 * Idempotent: calling twice is safe but the second call is a no-op.
 */
export function init() {
  if (state !== null) return;
  state = load();

  applyTheme(state.settings.theme);

  // Initial route from hash, then render.
  activeScreenId = (location.hash || '#home').slice(1);
  if (!document.getElementById(activeScreenId)) activeScreenId = 'home';

  showScreen(activeScreenId, /*skipRender*/ true);

  // Wire the click bridge for [data-goto].
  document.addEventListener('click', onClickNav);

  // Save on tab close as a safety net.
  window.addEventListener('beforeunload', () => save(state));
}

/**
 * Mark state as changed, persist, and trigger render for the active screen.
 * Honors the focus rule: if the user is typing inside the active screen,
 * skip the full render and only update derived text via screen.update(state).
 */
export function dataChanged(mutator = null) {
  if (typeof mutator === 'function') {
    const result = mutator(state);
    if (result && typeof result === 'object') state = result;
  }
  state = recomputeDerived(state);
  save(state);
  renderActive();
}

/**
 * Render the active screen, applying the focus rule.
 *   - No focused element inside the active screen → full render
 *   - Focused element IS inside the active screen  → render only derived
 *     text via screen.update(state), never touching the focused input.
 */
export function renderActive() {
  const screen = document.getElementById(activeScreenId);
  if (!screen) return;
  const hook = SCREEN_HOOKS[activeScreenId] || SCREEN_HOOKS.default;
  const active = document.activeElement;
  const insideActive = active && screen.contains(active);
  if (!insideActive) {
    hook.render(state);
  } else if (hook.update) {
    hook.update(state);
  }
}

/** Switch the visible screen, update hash, scroll to top, render. */
export function showScreen(id, skipRender = false) {
  const target = document.getElementById(id);
  if (!target) return;
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.toggle('active', s === target);
  });
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.goto === id);
  });
  window.scrollTo(0, 0);
  history.replaceState(null, '', '#' + id);
  activeScreenId = id;
  if (!skipRender) renderActive();
}

// ---------- click bridge ----------

function onClickNav(e) {
  // Prefer <a href="#x"> so the browser updates the URL natively.
  const a = e.target.closest('a[href^="#"]');
  if (a) {
    const id = a.getAttribute('href').slice(1);
    if (document.getElementById(id)) {
      e.preventDefault();
      showScreen(id);
      return;
    }
  }
  const t = e.target.closest('[data-goto]');
  if (t) {
    const id = t.dataset.goto;
    if (document.getElementById(id)) {
      e.preventDefault();
      showScreen(id);
    }
  }
}

// ---------- theming ----------

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    root.dataset.theme = mql.matches ? 'dark' : 'light';
    // Future changes via listener — for V1 we just snapshot at boot.
  } else {
    root.dataset.theme = theme || 'dark';
  }
}

// ---------- per-screen render hooks ----------
// Each hook exposes:
//   render(state)   — populate the screen with data; safe to overwrite text
//   update?(state)  — refresh derived text only (e.g. goal "remaining" label)
//                       invoked under the focus rule when the user is typing.

const SCREEN_HOOKS = {

  home: {
    render(state) {
      const txs = state.transactions;
      const now = new Date();
      const y = now.getUTCFullYear();
      const m = now.getUTCMonth() + 1;
      const income = monthlyIncome(txs, y, m);
      const expenses = monthlyExpenses(txs, y, m);

      const accList = accounts.list(state);
      const totalBalance = accList.reduce((sum, a) => sum + accountBalance(a, txs), 0);

      const activeDebts = debts.list(state).filter(d => d.status === 'active');
      const iOwe = activeDebts.filter(d => d.direction === 'i_owe')
                              .reduce((s, d) => s + (Number(d.total) || 0) - (d.paidSoFar || 0), 0);
      const owedToMe = activeDebts.filter(d => d.direction === 'owed_to_me')
                                  .reduce((s, d) => s + (d.paidSoFar || 0), 0);

      const activeInvs = investments.list(state).filter(i => i.status === 'active' || i.status === 'matured');
      const totalInvested = activeInvs.reduce((s, i) => s + (Number(i.principal) || 0), 0);

      const activeGoals = goals.list(state);
      const goalsSaved = activeGoals.reduce((s, g) => s + (Number(g.saved) || 0), 0);

      write('[data-bind="total-balance"]', fmtBDT(totalBalance));
      write('[data-bind="monthly-income"]', fmtBDT(income));
      write('[data-bind="monthly-expenses"]', fmtBDT(expenses));
      write('[data-bind="i-owe"]', fmtBDT(iOwe));
      write('[data-bind="owed-to-me"]', fmtBDT(owedToMe));
      write('[data-bind="total-invested"]', fmtBDT(totalInvested));
      write('[data-bind="goals-saved"]', fmtBDT(goalsSaved));
    },
  },

  transactions: {
    render(state) {
      const list = document.querySelector('#transactions [data-bind="tx-list"]');
      if (!list) return;
      const txs = transactions.list(state);
      if (txs.length === 0) {
        list.innerHTML = '<div class="empty">No transactions yet.</div>';
        return;
      }
      list.innerHTML = txs
        .slice()
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .map(tx => `
          <div class="tx-row" data-tx-id="${tx.id}">
            <div class="tx-date">${tx.date}</div>
            <div class="tx-amount tx-${tx.type}">${tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : '⇄'} ${fmtBDT(tx.amount)}</div>
            <div class="tx-note">${escapeHtml(tx.note || tx.type)}</div>
          </div>
        `)
        .join('');
    },
  },

  accounts: {
    render(state) {
      const list = document.querySelector('#accounts [data-bind="account-list"]');
      if (!list) return;
      const accs = accounts.list(state);
      if (accs.length === 0) {
        list.innerHTML = '<div class="empty">No accounts yet.</div>';
        return;
      }
      list.innerHTML = accs.map(a => {
        const bal = accountBalance(a, state.transactions);
        return `
          <div class="card" data-account-id="${a.id}">
            <div class="row">
              <div class="title">${escapeHtml(a.name)}</div>
              <div class="amount">${fmtBDT(bal)}</div>
            </div>
            <div class="muted">${escapeHtml(a.type)} · opens at ${fmtBDT(a.openingBalance)}</div>
          </div>
        `;
      }).join('');
    },
  },

  goals: {
    render(state) {
      const list = document.querySelector('#goals [data-bind="goal-list"]');
      if (!list) return;
      const gs = goals.list(state);
      if (gs.length === 0) {
        list.innerHTML = '<div class="empty">No goals yet.</div>';
        return;
      }
      list.innerHTML = gs.map(g => {
        const pct = Math.min(100, Math.round(((Number(g.saved) || 0) / (Number(g.target) || 1)) * 100));
        return `
          <div class="card" data-goal-id="${g.id}">
            <div class="row">
              <div class="title">${escapeHtml(g.name)}</div>
              <div class="amount">${fmtBDT(g.saved || 0)} / ${fmtBDT(g.target)}</div>
            </div>
            <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="muted">Target ${g.targetDate}</div>
          </div>
        `;
      }).join('');
    },
  },

  debts: {
    render(state) {
      const list = document.querySelector('#debts [data-bind="debt-list"]');
      if (!list) return;
      const ds = debts.list(state);
      if (ds.length === 0) {
        list.innerHTML = '<div class="empty">No debts yet.</div>';
        return;
      }
      list.innerHTML = ds.map(d => {
        const pct = d.total > 0 ? Math.min(100, Math.round(((d.paidSoFar || 0) / d.total) * 100)) : 0;
        return `
          <div class="card" data-debt-id="${d.id}">
            <div class="row">
              <div class="title">${escapeHtml(d.name)}</div>
              <div class="amount ${d.direction}">${d.direction === 'i_owe' ? '−' : '+'}${fmtBDT(d.paidSoFar || 0)} / ${fmtBDT(d.total)}</div>
            </div>
            <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="muted">${d.direction === 'i_owe' ? 'You owe' : 'Owed to you'} · ${d.status}</div>
          </div>
        `;
      }).join('');
    },
  },

  investments: {
    render(state) {
      const list = document.querySelector('#investments [data-bind="investment-list"]');
      if (!list) return;
      const invs = investments.list(state);
      if (invs.length === 0) {
        list.innerHTML = '<div class="empty">No investments yet.</div>';
        return;
      }
      list.innerHTML = invs.map(inv => {
        const mat = investmentMaturityValue(inv);
        const days = daysToMaturity(inv);
        const label = days > 0 ? `${days}d to maturity` : days === 0 ? 'Matures today' : `${-days}d past maturity`;
        return `
          <div class="card" data-investment-id="${inv.id}">
            <div class="row">
              <div class="title">${escapeHtml(inv.name)}</div>
              <div class="amount">${fmtBDT(mat)}</div>
            </div>
            <div class="muted">${inv.type.toUpperCase()} · ${label} · ${inv.status}</div>
          </div>
        `;
      }).join('');
    },
  },

  default: {
    render(_state) {
      // No-op for screens that don't have a render hook yet.
    },
  },
};

// ---------- utilities ----------

function write(selector, value) {
  document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
}

function fmtBDT(n) {
  const num = Number(n) || 0;
  return '৳' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ---------- expose a minimal global for inline handlers ----------
// Buttons inside forms (Save / Add) call window.finora.app.action(...)
// from their onClick. We keep that surface small for V1 — most actions
// will be wired per-screen in later passes.

// Expose a minimal global for inline handlers — browser only.
if (typeof window !== 'undefined') {
  window.finora = window.finora || {};
  window.finora.app = {
    init,
    dataChanged,
    showScreen,
    // Convenience getters for inline handlers / debugging.
    getState: () => state,
    // CRUD bridges — used by inline onClick handlers that need to mutate state.
    accounts, transactions, goals, debts, investments,
  };
}