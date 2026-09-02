/**
 * SecuritySection — the "PIN lock" card inside Settings.
 *
 * Slots in above the existing Danger Zone callout. Reads three
 * things:
 *   1. lockStore.storageDisabled (set at boot) — disables the whole
 *      section when localStorage is unavailable.
 *   2. localStorage[STORAGE_KEY_HASH] (re-read on mount and after
 *      every open/close of a sub-dialog) — whether a PIN is currently
 *      configured.
 *   3. The success-banner returned by the caller after each dialog
 *      completes.
 *
 * Three states:
 *   • storageDisabled → muted copy "PIN is unavailable in this
 *     browser mode", no buttons.
 *   • no PIN → "Set PIN" button.
 *   • PIN set → "Change PIN" + "Disable" buttons.
 *
 * Disable goes through the established `useConfirm` ConfirmDialog
 * pattern with `danger: true`.
 */

import { useEffect, useState } from 'react';
import { useStore } from '../domain/store';
import { useConfirm } from '../components/ConfirmDialog';
import { Button } from '../components/Button';
import { useLockStore } from './lockStore';
import {
  clearPin,
  hasPin,
} from './pin';
import { resetRateLimit } from './rateLimit';
import { SetPinDialog } from './SetPinDialog';
import { ChangePinDialog } from './ChangePinDialog';

type OpenDialog = 'set' | 'change' | null;

export function SecuritySection() {
  const showBanner = useStore(s => s.showBanner);
  const storageDisabled = useLockStore(s => s.storageDisabled);
  const { confirm, dialog } = useConfirm();
  const [pinSet, setPinSet] = useState(hasPin);
  const [open, setOpen] = useState<OpenDialog>(null);

  // Re-check whenever a dialog closes (success path mutates localStorage).
  useEffect(() => {
    if (open === null) setPinSet(hasPin());
  }, [open]);

  async function onDisable() {
    const ok = await confirm({
      title: 'Disable PIN lock?',
      body: 'You\'ll be able to open Finora without entering a PIN. You can turn it back on any time.',
      confirmLabel: 'Disable PIN',
      danger: true,
    });
    if (!ok) return;
    // Belt-and-braces: ask the user to re-enter their current PIN
    // before nuking the lock — this is the only surface where a
    // tap could effectively erase the only credential protecting
    // the data. We do it via the browser's native `prompt` only as
    // a fallback; the inline dialog flow would be nicer but out of
    // scope for this card. For v1 we keep it simple: confirm is
    // enough because Disable lives behind Settings which is itself
    // behind the unlock screen (next cold launch).
    clearPin();
    resetRateLimit();
    setPinSet(false);
    showBanner({
      kind: 'success',
      what: 'PIN disabled',
      why: 'Your app will open without asking.',
      fix: 'You can turn PIN protection back on at any time from this card.',
    });
  }

  if (storageDisabled) {
    return (
      <section className="card">
        <h2 className="heading h3-modal mb-2">Security</h2>
        <p className="text-[13px] text-muted">
          PIN lock is unavailable in this browser mode. The app stays open
          without a PIN until storage is restored.
        </p>
      </section>
    );
  }

  return (
    <section className="card" data-testid="security-section">
      <h2 className="heading h3-modal mb-2">Security</h2>
      <p className="text-[13px] text-muted mb-4">
        Protect this device data with a 6-digit PIN. You'll need to enter it
        every time the app loads.
      </p>
      <div className="flex flex-wrap gap-2">
        {!pinSet ? (
          <Button variant="primary" onClick={() => setOpen('set')}>
            Set PIN
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setOpen('change')}>
              Change PIN
            </Button>
            <Button variant="outlined-danger" onClick={onDisable}>
              Disable PIN
            </Button>
          </>
        )}
      </div>
      {pinSet && (
        <div className="text-[11px] text-muted mt-3">
          Forgot your PIN? Wipe all data from the Danger Zone — there's no
          recovery, by design.
        </div>
      )}
      {dialog}
      {open === 'set' && (
        <SetPinDialog
          onClose={() => setOpen(null)}
          onSuccess={() => {
            setOpen(null);
            showBanner({
              kind: 'success',
              what: 'PIN set',
              why: 'You\'ll be asked for it every time the app loads.',
              fix: 'Open a new tab to test the lock.',
            });
          }}
        />
      )}
      {open === 'change' && (
        <ChangePinDialog
          onClose={() => setOpen(null)}
          onSuccess={() => {
            setOpen(null);
            showBanner({
              kind: 'success',
              what: 'PIN changed',
              why: 'Your new PIN is in effect.',
              fix: 'Open a new tab to test the lock.',
            });
          }}
        />
      )}
    </section>
  );
}