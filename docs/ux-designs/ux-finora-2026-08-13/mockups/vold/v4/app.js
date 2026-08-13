/* ===========================================================
   app.js — shared interaction layer for v4 mockups
   Loaded as <script src="app.js" defer></script> in each page.
   Provides: tab switching, modal/sheet, toast, slider live
   recompute, form validation, empty/loading toggle, theme.
   =========================================================== */

(function () {
  'use strict';

  // ---------- Theme toggle ----------
  const stored = localStorage.getItem('theme');
  if (stored) document.documentElement.setAttribute('data-theme', stored);
  window.toggleTheme = function () {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : (cur === 'light' ? null : 'dark');
    if (next) document.documentElement.setAttribute('data-theme', next);
    else document.documentElement.removeAttribute('data-theme');
    if (next) localStorage.setItem('theme', next);
    else localStorage.removeItem('theme');
  };

  // ---------- Tab switching ----------
  document.addEventListener('click', function (e) {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    const group = tab.closest('[data-tab-group]');
    if (!group) return;
    group.querySelectorAll('[data-tab]').forEach(t => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
    const targetSel = tab.getAttribute('data-tab-target');
    if (targetSel) {
      const target = document.querySelector(targetSel);
      const siblings = group.querySelectorAll('[data-tab-target]');
      siblings.forEach(s => s === target ? s.removeAttribute('hidden') : s.setAttribute('hidden', ''));
    }
    if (tab.onclick) tab.onclick();
  });

  // ---------- Modal open/close ----------
  // Track which element opened the modal so we can restore focus on close.
  let lastFocused = null;
  window.openModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    lastFocused = document.activeElement;
    m.removeAttribute('hidden');
    const focusable = m.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (focusable) setTimeout(() => focusable.focus(), 50);
    document.body.style.overflow = 'hidden';
  };
  window.closeModal = function (id) {
    const m = document.getElementById(id);
    if (!m) return;
    m.setAttribute('hidden', '');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try { lastFocused.focus(); } catch (e) { /* element gone */ }
    }
    lastFocused = null;
  };
  // Focus trap: keep Tab/Shift-Tab inside the open modal.
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    const open = Array.from(document.querySelectorAll('.modal-backdrop:not([hidden]), .sheet-backdrop:not([hidden])')).pop();
    if (!open) return;
    const focusables = Array.from(open.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
  window.openSheet = window.openModal;
  window.closeSheet = window.closeModal;

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-close-modal]')) {
      const m = e.target.closest('.modal-backdrop, .sheet-backdrop');
      if (m) window.closeModal(m.id);
    }
    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      window.closeModal(e.target.id);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not([hidden]), .sheet-backdrop:not([hidden])').forEach(m => window.closeModal(m.id));
    }
  });

  // ---------- Toast ----------
  window.toast = function (message, variant) {
    let host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast' + (variant ? ' ' + variant : '');
    t.textContent = message;
    host.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 200ms ease';
      setTimeout(() => t.remove(), 220);
    }, 3000);
  };

  // ---------- Plan editor: live recompute ----------
  window.bindPlanEditor = function (available) {
    const rows = document.querySelectorAll('[data-plan-row]');
    function recompute() {
      let total = 0;
      const items = [];
      rows.forEach(row => {
        const range = row.querySelector('input[type="range"]');
        const num = row.querySelector('input[type="number"]');
        const val = parseInt(num.value || range.value || '0', 10);
        const pct = (val / available) * 100;
        range.value = val;
        const pctEl = row.querySelector('[data-pct]');
        if (pctEl) pctEl.textContent = Math.round(pct) + '%';
        total += val;
        items.push({ row, val, pct });
      });
      // update stack
      const stack = document.querySelector('[data-stack]');
      if (stack) {
        let html = '';
        items.forEach(it => { html += '<i style="width:' + it.pct + '%; background:' + it.row.dataset.color + '"></i>'; });
        stack.innerHTML = html;
      }
      // update total
      const totalEl = document.querySelector('[data-total]');
      if (totalEl) totalEl.textContent = 'BDT ' + total.toLocaleString('en-IN');
      const unalloc = available - total;
      const unallocEl = document.querySelector('[data-unallocated]');
      if (unallocEl) {
        unallocEl.textContent = 'BDT ' + unalloc.toLocaleString('en-IN');
        unallocEl.classList.toggle('neg', unalloc < 0);
        unallocEl.classList.toggle('pos', unalloc >= 0);
      }
      // over-allocated state
      const over = total > available;
      const banner = document.querySelector('[data-over-banner]');
      const accept = document.querySelector('[data-accept]');
      rows.forEach((row, i) => {
        const range = row.querySelector('input[type="range"]');
        const num = row.querySelector('input[type="number"]');
        const isOver = (over && items[i].val > 0);
        if (isOver) {
          range.setAttribute('aria-invalid', 'true');
          num.setAttribute('aria-invalid', 'true');
          row.classList.add('over');
        } else {
          range.removeAttribute('aria-invalid');
          num.removeAttribute('aria-invalid');
          row.classList.remove('over');
        }
      });
      if (banner) {
        if (over) {
          banner.removeAttribute('hidden');
          banner.querySelector('[data-over-delta]').textContent = 'BDT ' + (total - available).toLocaleString('en-IN');
        } else banner.setAttribute('hidden', '');
      }
      if (accept) accept.disabled = over;
    }
    rows.forEach(row => {
      const range = row.querySelector('input[type="range"]');
      const num = row.querySelector('input[type="number"]');
      if (range) range.addEventListener('input', () => { num.value = range.value; recompute(); });
      if (num) num.addEventListener('input', () => { range.value = num.value; recompute(); });
    });
    document.querySelector('[data-reset]')?.addEventListener('click', () => {
      rows.forEach(row => {
        const def = row.dataset.default;
        const num = row.querySelector('input[type="number"]');
        if (num && def != null) num.value = def;
      });
      recompute();
      window.toast('Plan reset to recommended.');
    });
    document.querySelector('[data-accept]')?.addEventListener('click', () => {
      window.toast('Plan accepted.', 'good');
    });
    recompute();
  };

  // ---------- Form: live validation ----------
  window.bindForm = function (formSel, rules) {
    const form = document.querySelector(formSel);
    if (!form) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      let valid = true;
      rules.forEach(r => {
        const input = form.querySelector(r.sel);
        const helper = form.querySelector(r.sel + ' ~ .input-helper');
        if (r.required && !input.value) {
          input.setAttribute('aria-invalid', 'true');
          if (helper) { helper.classList.add('danger'); helper.textContent = 'Required.'; }
          valid = false;
        } else if (r.min != null && parseFloat(input.value) < r.min) {
          input.setAttribute('aria-invalid', 'true');
          if (helper) { helper.classList.add('danger'); helper.textContent = 'Must be ≥ ' + r.min + '.'; }
          valid = false;
        } else {
          input.removeAttribute('aria-invalid');
          if (helper) { helper.classList.remove('danger'); helper.textContent = r.help || ''; }
        }
      });
      if (valid) window.toast('Saved.', 'good');
    });
  };

  // ---------- Toggle: empty <-> populated ----------
  window.bindStateToggle = function (groupSel) {
    const group = document.querySelector(groupSel);
    if (!group) return;
    group.querySelectorAll('[data-state]').forEach(el => el.setAttribute('hidden', ''));
    group.querySelector('[data-state="' + (group.dataset.initialState || 'populated') + '"]')?.removeAttribute('hidden');
    group.addEventListener('click', e => {
      const btn = e.target.closest('[data-show-state]');
      if (!btn) return;
      group.querySelectorAll('[data-state]').forEach(el => el.setAttribute('hidden', ''));
      group.querySelector('[data-state="' + btn.dataset.showState + '"]')?.removeAttribute('hidden');
    });
  };

  // ---------- Quick-add numpad (mobile mockup) ----------
  window.bindNumpad = function (displaySel) {
    const display = document.querySelector(displaySel);
    if (!display) return;
    let val = '';
    const update = () => {
      display.textContent = 'BDT ' + (val ? parseInt(val, 10).toLocaleString('en-IN') : '0');
    };
    document.addEventListener('click', e => {
      const k = e.target.closest('[data-key]');
      if (!k) return;
      const key = k.dataset.key;
      if (key === 'back') val = val.slice(0, -1);
      else if (key === '.') { /* no decimals in V1 */ }
      else val += key;
      update();
    });
    update();
  };

  // ---------- Numpad display live format helper ----------
  window.fmtBDT = function (n) { return 'BDT ' + Number(n).toLocaleString('en-IN'); };

  // ---------- Tabs as URL hash for deep links ----------
  document.addEventListener('DOMContentLoaded', () => {
    const hash = location.hash.slice(1);
    if (hash) {
      const btn = document.querySelector('[data-tab="' + hash + '"]');
      if (btn) btn.click();
    }
  });

})();
