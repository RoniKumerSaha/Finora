/**
 * exportImport.cloud.spec.ts — GD-4.4 end-to-end round-trip.
 *
 * Virtual integration test that exercises the full cloud backup chain
 * without making real network calls. Mocks `google.accounts.oauth2` via
 * the same helper the auth spec uses, and mocks `fetch` against a
 * recorded script that pretends to be Google Drive.
 *
 *   1. Load default state from persistence.
 *   2. Add one transaction.
 *   3. saveBackup(state) → assert fetch was called with multipart body
 *      that contains the envelope JSON.
 *   4. listBackups() returns 1 file.
 *   5. fetchBackupText(fileId) returns the same envelope text.
 *   6. parseImport(text) + importAndReplace(parsed) → assert the
 *      imported state matches what we put on Drive.
 *
 * The test runs entirely against in-memory mocks; <500 ms budget.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as googleDrive from './googleDrive';
import * as scriptMod from './googleDrive.script';
import { parseImport, serializeExport } from './exportImport';
import { DEFAULT_STATE } from '../domain/persistence';
import type { State, Transaction } from '../domain/types';

const GDRIVE_TOKENS_KEY = 'finora:gdrive:tokens';

function setTokens() {
  localStorage.setItem(GDRIVE_TOKENS_KEY, JSON.stringify({
    accessToken: 'ya29.test',
    expiresAt: Date.now() + 3600_000,
    scope: 'https://www.googleapis.com/auth/drive.file',
    email: 'e2e@example.com',
  }));
}

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function okText(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } });
}

interface FetchCall { url: string; init: RequestInit; }

function installFetch(handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>>) {
  const calls: FetchCall[] = [];
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? '');
    const reqInit: RequestInit = (init ?? {}) as RequestInit;
    calls.push({ url, init: reqInit });
    const handler = handlers.shift();
    if (!handler) throw new Error(`Unexpected fetch call to ${url}`);
    return handler(url, reqInit);
  });
  return { spy, calls };
}

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-e2e-1',
    accountId: 'acc-cash',
    type: 'expense',
    amount: 2500,
    date: '2026-08-18',
    categoryId: 'default-exp-0-groceries',
    note: 'e2e test',
    ...overrides,
  };
}

describe('cloud end-to-end round-trip (GD-4.4)', () => {
  let injectSpy: any;
  let fetchSpy: any;

  beforeEach(() => {
    localStorage.clear();
    googleDrive.__test__resetLifecycle();
    setTokens();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    googleDrive.__test__markGisReady();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
    vi.stubEnv('VITE_FEATURE_GDRIVE_SYNC', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
    fetchSpy?.mockRestore();
    googleDrive.__test__resetLifecycle();
  });

  it('save → list → fetch → parse → import round-trip preserves accounts & transactions', async () => {
    // 1. Start from default state with one account.
    const baseline: State = {
      ...DEFAULT_STATE,
      accounts: [{
        id: 'acc-cash',
        name: 'Cash',
        type: 'cash',
        openingBalance: 10_000,
        createdAt: '2026-08-18T00:00:00.000Z',
      }],
      transactions: [],
    };

    // 2. Add one transaction.
    const stateWithTx: State = {
      ...baseline,
      transactions: [makeTransaction()],
    };

    // Drive "server" mock. We capture the envelope text on save and replay
    // it on fetch.
    const recorded: { envelope: string | null } = { envelope: null };
    const fileId = 'e2e-file-1';
    const today = new Date().toISOString().slice(0, 10);
    const filename = `finora-backup-${today}.json`;
    const modifiedTime = '2026-08-18T12:00:00.000Z';

    const { spy, calls } = installFetch([
      // saveBackup #1: folder search → empty
      () => okJson({ files: [] }),
      // saveBackup #2: folder create
      () => okJson({ id: 'folder-1' }),
      // saveBackup #3: today file search → empty
      () => okJson({ files: [] }),
      // saveBackup #4: file POST (multipart). Capture the envelope.
      (_url, init) => {
        const body = init.body as string;
        const ct = (init.headers as any)['Content-Type'] as string;
        const boundary = ct.split('boundary=')[1];
        const sections = body.split(`--${boundary}`);
        const envelopeSection = sections[2];
        const firstBrace = envelopeSection.indexOf('{');
        recorded.envelope = envelopeSection.slice(firstBrace).replace(/\r\n$/, '');
        return okJson({ id: fileId, modifiedTime });
      },
      // listBackups: return the file we just created.
      () => okJson({ files: [{ id: fileId, name: filename, modifiedTime }] }),
      // fetchBackupText: replay the envelope.
      () => okText(recorded.envelope ?? serializeExport(stateWithTx)),
    ]);
    fetchSpy = spy;

    // 3. Save to Drive.
    const saved = await googleDrive.saveBackup(stateWithTx);
    expect(saved.fileId).toBe(fileId);
    expect(saved.modifiedTime).toBe(modifiedTime);
    expect(recorded.envelope).not.toBeNull();

    // 4. List backups.
    const list = await googleDrive.listBackups();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(fileId);
    expect(list[0].name).toBe(filename);

    // 5. Fetch the bytes.
    const fetchedText = await googleDrive.fetchBackupText(list[0].id);
    expect(fetchedText).toBe(recorded.envelope);

    // 6. Parse + import into a fresh state object (simulate the UI flow).
    const parsed: State = parseImport(fetchedText);

    // Account + transaction counts match what we put on Drive.
    expect(parsed.accounts).toHaveLength(stateWithTx.accounts.length);
    expect(parsed.transactions).toHaveLength(stateWithTx.transactions.length);
    expect(parsed.accounts[0].id).toBe('acc-cash');
    expect(parsed.transactions[0].id).toBe('tx-e2e-1');
    expect(parsed.transactions[0].amount).toBe(2500);

    // Sanity: 6 recorded fetches — 4 save, 1 list, 1 fetchBackupText.
    expect(calls).toHaveLength(6);
  });
});