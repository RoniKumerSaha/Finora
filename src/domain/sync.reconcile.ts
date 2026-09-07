/**
 * sync.reconcile.ts — last-write-wins reconciliation (sync layer).
 *
 * On boot, after the local IndexedDB cache has primed, the SyncEngine
 * pulls the cloud row (if any) and asks this module "which one wins?"
 *
 * The LWW key is `settings.stateUpdatedAt` (a ms-epoch bumped inside
 * the store on every mutation). Cloud's own `updated_at` is the
 * tiebreaker when both sides have the same stateUpdatedAt — important
 * for the rare case where a device's clock is wrong.
 *
 * Pure functions only. No I/O, no Supabase client. The engine calls
 * `pickWinner` to decide what to do; the caller wires the result back
 * through `recomputeDerived` + `save`.
 */
import type { State } from './types';

export interface CloudRow {
  /** The state blob as stored in `public.finora_state.payload`. */
  payload: State;
  /** Server-side timestamp; trust this over the client's clock. */
  updatedAt: number;
}

export type ReconcileOutcome =
  | { kind: 'keep-local'; reason: 'no-cloud' }
  | { kind: 'keep-local'; reason: 'local-newer'; localStamp: number; cloudStamp: number }
  | { kind: 'keep-local'; reason: 'equal-and-cloud-not-newer' }
  | { kind: 'adopt-cloud'; cloud: CloudRow };

/**
 * Decide whether the local state or the cloud state should win.
 * Pure. Both inputs are nullable: missing cloud means local wins.
 */
export function pickWinner(local: State, cloud: CloudRow | null): ReconcileOutcome {
  if (!cloud) return { kind: 'keep-local', reason: 'no-cloud' };

  const localStamp = local.settings.stateUpdatedAt ?? 0;
  const cloudStamp = cloud.payload.settings.stateUpdatedAt ?? 0;

  if (cloudStamp > localStamp) {
    return { kind: 'adopt-cloud', cloud };
  }

  if (cloudStamp < localStamp) {
    return { kind: 'keep-local', reason: 'local-newer', localStamp, cloudStamp };
  }

  // Equal client stamps → fall back to server timestamp. The cloud
  // `updated_at` was set by the Postgres trigger; if it's strictly
  // newer than the local stamp the cloud row was written *after*
  // sync replicated, so trust the cloud. Otherwise keep local.
  if (cloud.updatedAt > localStamp) {
    return { kind: 'adopt-cloud', cloud };
  }

  return { kind: 'keep-local', reason: 'equal-and-cloud-not-newer' };
}
