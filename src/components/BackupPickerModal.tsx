/**
 * BackupPickerModal — pick which Drive backup to restore (GD-3.3).
 *
 * Shown when there are 2+ backups in Drive. Renders a list of backup
 * rows (filename + relative time). Clicking a row fires `onPick(fileId)`.
 * The parent then chains into the existing Replace current data?
 * confirm and finally importAndReplace.
 *
 * Single-backup restores don't use this component — they go straight
 * from listBackups → useConfirm.
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BackupFile } from '../lib/googleDrive';
import { fmtRelativeShort } from '../lib/format';

interface BackupPickerModalProps {
  backups: BackupFile[];
  onPick: (fileId: string) => void;
  onCancel: () => void;
}

export function BackupPickerModal({ backups, onPick, onCancel }: BackupPickerModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-picker-title"
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className="absolute inset-0 cursor-default"
        style={{
          background: 'var(--overlay)',
          backdropFilter: 'blur(8px)',
          animation: 'backdrop-fade-in 180ms ease-out both',
        }}
      />
      <div
        className="relative rounded-card w-[520px] max-w-full shadow-modal"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-modal), var(--card-inset)',
          padding: '24px',
          animation: 'modal-pop-in 180ms ease-out both',
        }}
      >
        <h3 id="backup-picker-title" className="heading h3-modal m-0 mb-2">
          Choose a backup to restore
        </h3>
        <p className="text-[13px] text-muted mb-4">
          Pick the version you want to restore. This will overwrite your current data after confirmation.
        </p>
        <ul className="flex flex-col gap-1.5 mb-4 max-h-[320px] overflow-y-auto">
          {backups.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onClick={() => onPick(b.id)}
                className="w-full text-left rounded-btn px-3.5 py-2.5 border border-border bg-surface hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <div className="text-[13.5px] font-semibold text-ink">{b.name}</div>
                <div className="text-[12px] text-muted mt-0.5">
                  {fmtRelativeShort(b.modifiedTime)}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2.5 justify-end mt-4">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            className="inline-flex items-center justify-center px-[18px] py-2.5 rounded-btn font-bold text-sm bg-surface text-ink border border-border hover:bg-surface-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}