/**
 * googleDrive.script.ts — GIS <script> tag injector.
 *
 * Kept separate from googleDrive.ts so the public module stays
 * importable in tests without DOM side-effects.
 *
 * Public surface used by googleDrive.ts: `injectGisScript({ url, timeoutMs })`.
 * Idempotent — if a script with the same URL is already in the DOM,
 * the in-flight (or already-resolved) promise is returned.
 */

const TAG_PROP = Symbol.for('__finora_gis_script_tag__');

interface InjectOpts {
  url: string;
  timeoutMs: number;
}

let inFlight: Promise<void> | null = null;

export function injectGisScript(opts: InjectOpts): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('No document available'));
  }
  // Idempotency: same script URL = same promise.
  if (inFlight) return inFlight;

  inFlight = new Promise<void>((resolve, reject) => {
    // Reuse if a previous injection already landed in the head.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${opts.url}"]`,
    );
    if (existing) {
      if ((existing as any)[TAG_PROP] === 'ready') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('script failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = opts.url;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      script.remove();
      inFlight = null;
      reject(new Error(`GIS script load timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);

    script.addEventListener(
      'load',
      () => {
        if (timedOut) return;
        clearTimeout(timer);
        (script as any)[TAG_PROP] = 'ready';
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      'error',
      () => {
        if (timedOut) return;
        clearTimeout(timer);
        script.remove();
        inFlight = null;
        reject(new Error('GIS script failed to load'));
      },
      { once: true },
    );

    document.head.appendChild(script);
  }).catch((err) => {
    inFlight = null;
    throw err;
  });

  return inFlight;
}
