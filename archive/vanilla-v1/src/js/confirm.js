/**
 * confirm.js — AD-11 of the V1 architecture spine.
 *
 * Per PRD §11: destructive actions (delete account with linked txs, delete
 * debt, replace-on-import) use a modal with Cancel | Confirm. No toast.
 *
 * This module owns:
 *   - The confirm modal lifecycle: open with a question, get a boolean back.
 *   - Promise-based so the call site can `await` the user's choice.
 *   - Trap focus inside the modal while it's open.
 *   - Escape key closes (with Cancel as the answer).
 *
 * Markup convention: a single #confirm-modal element on the page; we just
 * fill its slots and toggle .visible. Inline HTML in v2/index.html provides
 * the markup; if it's not present we lazy-create it.
 */

const MODAL_ID = 'confirm-modal';

export function confirm({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    const modal = ensureModal();
    fillModal(modal, { title, body, confirmLabel, cancelLabel, danger });
    showModal(modal);

    const cleanup = (answer) => {
      hideModal(modal);
      modal.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      // Restore focus to the trigger if we tracked it.
      if (lastFocused) lastFocused.focus();
      resolve(answer);
    };

    function onClick(e) {
      const t = e.target.closest('[data-confirm-answer]');
      if (!t) {
        // Click on backdrop = cancel.
        if (e.target === modal || e.target.classList.contains('modal-bg')) {
          cleanup(false);
        }
        return;
      }
      cleanup(t.dataset.confirmAnswer === 'yes');
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      if (e.key === 'Tab') trapTab(e, modal);
    }

    modal.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);

    // Focus the safer default (Cancel) so accidental Enter doesn't confirm.
    const cancelBtn = modal.querySelector('[data-confirm-answer="no"]');
    if (cancelBtn) cancelBtn.focus();
  });
}

let lastFocused = null;

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = MODAL_ID;
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-bg"></div>
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h3 id="confirm-title" class="modal-title"></h3>
      <div class="modal-body"></div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" data-confirm-answer="no"></button>
        <button type="button" class="btn-danger"  data-confirm-answer="yes"></button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function fillModal(modal, { title, body, confirmLabel, cancelLabel, danger }) {
  modal.querySelector('.modal-title').textContent = title || 'Are you sure?';
  modal.querySelector('.modal-body').innerHTML = body || '';
  const cancelBtn = modal.querySelector('[data-confirm-answer="no"]');
  const confirmBtn = modal.querySelector('[data-confirm-answer="yes"]');
  cancelBtn.textContent = cancelLabel;
  confirmBtn.textContent = confirmLabel;
  // Allow non-danger confirmations (e.g. "Roll over").
  confirmBtn.className = danger ? 'btn-danger' : 'btn-primary';
}

function showModal(modal) {
  lastFocused = document.activeElement;
  modal.classList.add('visible');
}

function hideModal(modal) {
  modal.classList.remove('visible');
}

// Minimal focus trap — keep Tab cycling inside the modal card.
function trapTab(e, modal) {
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}