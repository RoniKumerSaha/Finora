/**
 * formatSyncError.spec.ts — verify the Supabase/network error mapper
 * returns the right ThreePartError for each known category.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { formatSyncError } from '../errors';

describe('formatSyncError', () => {
  let onLineDescriptor: PropertyDescriptor | undefined;
  beforeEach(() => {
    onLineDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'onLine');
  });
  afterEach(() => {
    if (onLineDescriptor) {
      Object.defineProperty(globalThis.navigator, 'onLine', onLineDescriptor);
    } else {
      // @ts-expect-error — happy-dom may or may not allow this
      delete globalThis.navigator.onLine;
    }
  });

  it('reports offline when navigator.onLine is false', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: false, configurable: true });
    const out = formatSyncError(new Error('whatever'));
    expect(out.what.toLowerCase()).toContain('offline');
  });

  it('reports network failure for AuthRetryableFetchError', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const err = Object.assign(new Error('Could not fetch'), { name: 'AuthRetryableFetchError' });
    const out = formatSyncError(err);
    expect(out.what.toLowerCase()).toContain('reach supabase');
  });

  it('reports token-expiry for 401', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const err = Object.assign(new Error('JWT expired'), { status: 401 });
    const out = formatSyncError(err);
    expect(out.what.toLowerCase()).toContain('expired');
  });

  it('reports RLS denial for 403', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const err = Object.assign(new Error('new row violates row-level security policy'), { status: 403 });
    const out = formatSyncError(err);
    expect(out.what.toLowerCase()).toContain('denied');
  });

  it('reports 5xx as server-side', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const err = Object.assign(new Error('boom'), { status: 503 });
    const out = formatSyncError(err);
    expect(out.what.toLowerCase()).toContain('trouble');
  });

  it('falls back to a generic message while preserving the original', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const out = formatSyncError(new Error('something custom'));
    expect(out.what).toContain('something custom');
  });

  it('handles non-Error throws gracefully', () => {
    Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
    const out = formatSyncError('plain string error');
    expect(out.what).toBeTruthy();
    expect(out.fix).toBeTruthy();
  });
});
