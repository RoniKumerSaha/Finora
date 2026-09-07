/**
 * sync.queue.ts — IndexedDB-backed offline push queue.
 *
 * When the engine tries to push but the device is offline, or the
 * Supabase request fails after the retry budget, the pending State
 * blob is appended to this queue. The next `online` event — or the
 * next successful push — drains the queue serially.
 *
 * Queue shape: JSON array of State snapshots, ordered FIFO. Only the
 * MOST RECENT snapshot matters at any time; older entries are
 * redundant. To keep the queue small we coalesce on enqueue: while a
 * queued snapshot already exists, replace it with the latest one
 * rather than appending. This means a 10-minute offline session with
 * 30 edits collapses to a single push on reconnect.
 *
 * Storage: Dexie `kv` row at id=`cloudQueue`, accessed via the
 * `getSyncRow` / `putSyncRow` helpers in `persistence.ts`. The queue
 * survives reloads — closing the tab offline then coming back online
 * the next morning still flushes.
 */
import type { State } from './types';
import {
  CLOUD_QUEUE_KEY,
  getSyncRow,
  putSyncRow,
} from './persistence';

/** Read the current queue (in FIFO order, oldest first). Returns []
 *  if the row is missing or unreadable. */
export async function readQueue(): Promise<State[]> {
  const raw = await getSyncRow(CLOUD_QUEUE_KEY);
  if (!Array.isArray(raw)) return [];
  return raw as State[];
}

/** Append `state` to the queue. If the queue is non-empty, replace
 *  its tail with `state` (coalesce) so a burst of offline edits
 *  collapses to a single pending snapshot. */
export async function enqueue(state: State): Promise<void> {
  const existing = await readQueue();
  const next = existing.length === 0
    ? [state]
    : [...existing.slice(0, -1), state];
  putSyncRow(CLOUD_QUEUE_KEY, next);
}

/** Remove the head of the queue (the snapshot we just successfully
 *  pushed). Returns the new queue. */
export async function dequeue(): Promise<State[]> {
  const existing = await readQueue();
  if (existing.length === 0) return existing;
  const next = existing.slice(1);
  if (next.length === 0) {
    // Last entry drained — clear the row entirely so subsequent reads
    // are cheap and the IDB doesn't carry a [single-entry] forever.
    const { deleteSyncRow } = await import('./persistence');
    await deleteSyncRow(CLOUD_QUEUE_KEY);
  } else {
    putSyncRow(CLOUD_QUEUE_KEY, next);
  }
  return next;
}

/** Empty the queue entirely (e.g. on sign-out, or after a successful
 *  force-sync that already wrote the latest state). */
export async function clearQueue(): Promise<void> {
  const { deleteSyncRow } = await import('./persistence');
  await deleteSyncRow(CLOUD_QUEUE_KEY);
}

/** Cheap length probe for UI (`Offline · N pending`). */
export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}
