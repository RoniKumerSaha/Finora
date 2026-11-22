/**
 * sync.queue.spec.ts — offline push queue tests.
 *
 * Verifies the FIFO + coalesce behaviour. Reads/writes go through
 * the real IndexedDB (fake-indexeddb in happy-dom), so the queue is
 * genuinely persisted between calls within a test.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { enqueue, readQueue, dequeue, clearQueue, queueLength } from '@/domain/sync.queue';
import { resetIDB } from '../../support/idb-helpers';
import { makeStampedState } from '../../support/state';

const makeState = (stamp: number) => makeStampedState(stamp);

beforeEach(async () => {
  await resetIDB();
});

describe('sync.queue', () => {
  it('returns [] when empty', async () => {
    expect(await readQueue()).toEqual([]);
    expect(await queueLength()).toBe(0);
  });

  it('appends on first enqueue', async () => {
    await enqueue(makeState(1));
    expect(await queueLength()).toBe(1);
    const q = await readQueue();
    expect(q[0].settings.stateUpdatedAt).toBe(1);
  });

  it('coalesces: a second enqueue while one is pending replaces its tail', async () => {
    await enqueue(makeState(1));
    await enqueue(makeState(2));
    expect(await queueLength()).toBe(1);
    const q = await readQueue();
    expect(q[0].settings.stateUpdatedAt).toBe(2);
  });

  it('dequeue removes the head and returns the new queue', async () => {
    await enqueue(makeState(1));
    await enqueue(makeState(2));
    // After coalesce, only one entry exists.
    const after = await dequeue();
    expect(after.length).toBe(0);
    expect(await queueLength()).toBe(0);
  });

  it('clearQueue empties immediately', async () => {
    await enqueue(makeState(1));
    await enqueue(makeState(2));
    await clearQueue();
    expect(await queueLength()).toBe(0);
  });
});