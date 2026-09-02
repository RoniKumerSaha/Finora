/**
 * PinCells — six OTP-style input boxes.
 *
 * One box per digit, monospace digit, auto-advance focus on type,
 * backspace jumps to the previous box, paste of "123456" auto-fills
 * every box. This is the standard bank/email-OTP pattern.
 *
 * Controlled component: the parent owns `value` AND receives every
 * intermediate change via `onChange`. The parent is the source of
 * truth; we just mirror it into the individual inputs.
 *
 * Wrong-PIN shake: when `shakeKey` changes the wrapper replays a
 * short horizontal shake. We re-key the container so React handles
 * the animation reset deterministically.
 *
 * The component does NOT own submission — the parent listens for
 * the 6th digit landing via `onComplete`.
 */
import { useEffect, useRef } from 'react';

interface PinCellsProps {
  /** Current PIN string (0..6 chars). */
  value: string;
  /** Fired on every keystroke / paste / backspace. */
  onChange: (next: string) => void;
  /** Bump to replay the shake animation. */
  shakeKey?: number | string;
  /** Whether the boxes are disabled (lockout / submitting). */
  disabled?: boolean;
  /** Set to true to show a danger border (e.g. wrong PIN). */
  hasError?: boolean;
  /** Optional aria label override (a11y). */
  ariaLabel?: string;
  /** Optional onComplete — fired when the 6th digit lands. */
  onComplete?: (pin: string) => void;
  /**
   * Whether to mask the typed digit visually. When true (the default
   * for security surfaces like the lock screen and PIN dialogs), each
   * filled box shows a centered dot rather than the actual number.
   * The underlying `value` is unaffected — masking is purely visual.
   */
  masked?: boolean;
}

const PIN_LENGTH = 6;
const CELL_WIDTH = 44;
const CELL_HEIGHT = 54;
const GAP = 8;

export function PinCells({
  value,
  onChange,
  shakeKey,
  disabled,
  hasError,
  ariaLabel,
  onComplete,
  masked = true,
}: PinCellsProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Ref mirror of the latest `value` prop. We use this in event
  // handlers so they always read the most recent value, even when
  // multiple keystrokes land before the parent has re-rendered (the
  // closure `value` becomes stale in that window).
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  // Auto-focus the first empty box on mount and whenever the
  // disabled flag flips from true → false (e.g. lockout ended).
  useEffect(() => {
    if (disabled) return;
    const emptyIdx = Array.from({ length: PIN_LENGTH }).findIndex(
      (_, i) => !value[i],
    );
    const target = emptyIdx === -1 ? PIN_LENGTH - 1 : emptyIdx;
    inputRefs.current[target]?.focus();
  }, [disabled, shakeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function setRef(idx: number, el: HTMLInputElement | null) {
    inputRefs.current[idx] = el;
  }

  function commit(next: string) {
    onChange(next);
    if (next.length === PIN_LENGTH && onComplete) {
      onComplete(next);
    }
  }

  function handleChange(idx: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    const ch = digits.slice(-1);
    // Read the latest value via ref to avoid stale-closure issues when
    // multiple keystrokes fire before the parent re-renders.
    const current = valueRef.current;
    if (ch) {
      const arr = current.split('');
      while (arr.length < PIN_LENGTH) arr.push('');
      arr[idx] = ch;
      const next = arr.join('').slice(0, PIN_LENGTH);
      // Optimistically mirror locally so subsequent keystrokes in the
      // same tick see the updated value too.
      valueRef.current = next;
      commit(next);
      if (idx < PIN_LENGTH - 1) {
        inputRefs.current[idx + 1]?.focus();
        inputRefs.current[idx + 1]?.select();
      }
    } else {
      const arr = current.split('');
      while (arr.length < PIN_LENGTH) arr.push('');
      arr[idx] = '';
      const next = arr.join('').slice(0, PIN_LENGTH);
      valueRef.current = next;
      commit(next);
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const current = valueRef.current;
    if (e.key === 'Backspace' && !current[idx] && idx > 0) {
      e.preventDefault();
      const arr = current.split('');
      while (arr.length < PIN_LENGTH) arr.push('');
      arr[idx - 1] = '';
      const next = arr.join('').slice(0, PIN_LENGTH);
      valueRef.current = next;
      commit(next);
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
      inputRefs.current[idx - 1]?.select();
    } else if (e.key === 'ArrowRight' && idx < PIN_LENGTH - 1) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
      inputRefs.current[idx + 1]?.select();
    } else if (e.key === 'Enter' && current.replace(/\s/g, '').length === PIN_LENGTH) {
      e.preventDefault();
      onComplete?.(current.replace(/\s/g, ''));
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const data = (e.clipboardData.getData('text') || '').replace(/\D/g, '');
    if (!data) return;
    const current = valueRef.current;
    const start = (e.target as HTMLInputElement).dataset.idx
      ? Number((e.target as HTMLInputElement).dataset.idx)
      : 0;
    const slice = data.slice(0, PIN_LENGTH - start);
    const arr = current.split('');
    while (arr.length < PIN_LENGTH) arr.push('');
    for (let i = 0; i < slice.length; i++) {
      arr[start + i] = slice[i];
    }
    const next = arr.join('').slice(0, PIN_LENGTH);
    valueRef.current = next;
    commit(next);
    const lastFilled = Math.min(start + slice.length, PIN_LENGTH) - 1;
    inputRefs.current[Math.max(0, lastFilled)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? `PIN entry, ${value.length} of ${PIN_LENGTH} digits entered`}
      key={shakeKey}
      style={{
        display: 'flex',
        gap: `${GAP}px`,
        justifyContent: 'center',
        animation: shakeKey == null ? undefined : 'pin-shake 320ms cubic-bezier(.36,.07,.19,.97) both',
      }}
    >
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const v = value[i] !== undefined ? value[i] : '';
        const hasValue = v.length > 0;
        return (
          <div
            key={i}
            onClick={() => inputRefs.current[i]?.focus()}
            style={{
              position: 'relative',
              width: `${CELL_WIDTH}px`,
              height: `${CELL_HEIGHT}px`,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          >
            {/* Input first (stacked below). transparent color hides
                the digit; caretColor keeps the cursor visible. */}
            <input
              ref={(el) => setRef(i, el)}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={v}
              disabled={disabled}
              data-idx={i}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={`Digit ${i + 1}`}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                textAlign: 'center',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                fontSize: '22px',
                fontWeight: 600,
                lineHeight: 1,
                color: 'transparent',
                background: hasValue ? 'var(--surface-2)' : 'var(--surface)',
                border: `1.5px solid ${hasError ? 'var(--danger)' : hasValue ? 'var(--divider)' : 'var(--border)'}`,
                borderRadius: '12px',
                outline: 'none',
                caretColor: 'var(--primary)',
                transition: 'border-color 120ms, background 120ms',
                padding: 0,
                boxSizing: 'border-box',
                zIndex: 1,
              }}
              onFocusCapture={(e) => {
                if (!hasError) e.currentTarget.style.boxShadow = '0 0 0 3px var(--primary-soft)';
              }}
              onBlurCapture={(e) => { e.currentTarget.style.boxShadow = ''; }}
            />
            {/* Visual overlay — sits ON TOP of the input so the bullet
                (or digit) is always visible. pointerEvents disabled
                so clicks still reach the input underneath. */}
            {hasValue && (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  userSelect: 'none',
                  zIndex: 2,
                }}
              >
                {masked ? (
                  /* Filled circle drawn as a solid div — guaranteed
                     visible regardless of font support. */
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '999px',
                      background: 'var(--ink)',
                      display: 'block',
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: 'var(--ink)',
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                      lineHeight: 1,
                    }}
                  >
                    {v}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
