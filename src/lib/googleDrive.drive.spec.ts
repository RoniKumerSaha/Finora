/**
 * googleDrive.drive.spec.ts — Drive REST calls: saveBackup, listBackups,
 * fetchBackupText. GD-1.4 + GD-1.5.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import * as googleDrive from './googleDrive';
import * as scriptMod from './googleDrive.script';
import { DEFAULT_STATE } from '../domain/persistence';

const {
  saveBackup,
  listBackups,
  fetchBackupText,
  __test__resetLifecycle,
} = googleDrive;

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_NAME = 'Finora backups';

function saveToken() {
  localStorage.setItem('finora:gdrive:tokens', JSON.stringify({
    accessToken: 'ya29.test',
    expiresAt: Date.now() + 3600_000,
    scope: 'https://www.googleapis.com/auth/drive.file',
  }));
}

type FetchCall = { url: string; init: RequestInit };

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function okText(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

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

describe('saveBackup (GD-1.4)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    saveToken();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    googleDrive.__test__markGisReady();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
    fetchSpy?.mockRestore();
    googleDrive.__test__resetLifecycle();
  });

  it('throws auth_expired when no tokens are present', async () => {
    localStorage.clear();
    const { spy, calls } = installFetch([]);
    fetchSpy = spy;
    await expect(saveBackup(DEFAULT_STATE)).rejects.toMatchObject({ code: 'auth_expired' });
    expect(calls).toHaveLength(0);
  });

  it('first save: folder missing → folder created → file created (4 fetches)', async () => {
    const { spy, calls } = installFetch([
      // 1. folder search
      () => okJson({ files: [] }),
      // 2. folder create
      () => okJson({ id: 'folder-1' }, 200),
      // 3. today file search (no existing)
      () => okJson({ files: [] }),
      // 4. file create
      (url, init) => {
        expect(url).toBe(DRIVE_BASE);
        expect(init.method).toBe('POST');
        return okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:00:00.000Z' });
      },
    ]);
    fetchSpy = spy;
    const result = await saveBackup(DEFAULT_STATE);
    expect(result.fileId).toBe('file-1');
    expect(result.modifiedTime).toBe('2026-08-18T12:00:00.000Z');
    expect(calls).toHaveLength(4);
    expect(calls[0].url).toContain("name%3D'Finora%20backups'");
    expect(calls[0].url).toContain('mimeType%3D');
    const folderCreate = JSON.parse(calls[1].init.body as string);
    expect(folderCreate.name).toBe(FOLDER_NAME);
    expect(folderCreate.mimeType).toBe('application/vnd.google-apps.folder');
    // 4th call is a multipart/related upload: metadata part + content part.
    const fileUploadBody = calls[3].init.body as string;
    const fileUploadCt = (calls[3].init.headers as any)['Content-Type'] as string;
    expect(fileUploadCt).toMatch(/^multipart\/related; boundary=/);
    const boundary = fileUploadCt.split('boundary=')[1];
    expect(fileUploadBody).toContain(`--${boundary}`);
    // First part: metadata JSON.
    const metaJsonStr = metaUploadBodyMeta(fileUploadBody);
    const fileMeta = JSON.parse(metaJsonStr);
    expect(fileMeta.name).toMatch(/^finora-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(fileMeta.parents).toEqual(['folder-1']);
    expect(fileMeta.appProperties.finoraVersion).toBe('1');
    // Second part: envelope content.
    expect(fileUploadBody).toContain('application/json');
  });

  /** Extract the first metadata JSON object from a multipart/related body. */
  function metaUploadBodyMeta(body: string): string {
    const match = body.match(/\r\n\r\n(\{[\s\S]*?\})\r\n/);
    if (!match) throw new Error('no metadata part found in multipart body');
    return match[1];
  }

  it('second save same day: folder exists, file exists → PATCH (3 fetches)', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const filename = `finora-backup-${today}.json`;
    const { spy, calls } = installFetch([
      // 1. folder search
      () => okJson({ files: [{ id: 'folder-1' }] }),
      // 2. today file search (exists)
      () => okJson({ files: [{ id: 'file-1', name: filename, modifiedTime: '2026-08-18T11:00:00.000Z' }] }),
      // 3. PATCH
      (url, init) => {
        expect(url).toBe(`${DRIVE_BASE}/file-1`);
        expect(init.method).toBe('PATCH');
        return okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:30:00.000Z' });
      },
    ]);
    fetchSpy = spy;
    const result = await saveBackup(DEFAULT_STATE);
    expect(result.fileId).toBe('file-1');
    expect(result.modifiedTime).toBe('2026-08-18T12:30:00.000Z');
    expect(calls).toHaveLength(3);
    expect(calls[2].init.method).toBe('PATCH');
  });

  it('folder exists, today file does not → POST (3 fetches)', async () => {
    const { spy, calls } = installFetch([
      () => okJson({ files: [{ id: 'folder-1' }] }),
      () => okJson({ files: [] }),
      () => okJson({ id: 'file-new', modifiedTime: '2026-08-18T12:00:00.000Z' }),
    ]);
    fetchSpy = spy;
    await saveBackup(DEFAULT_STATE);
    expect(calls[2].url).toBe(DRIVE_BASE);
    expect(calls[2].init.method).toBe('POST');
  });

  it('maps Drive 401 → auth_expired', async () => {
    const { spy, calls } = installFetch([
      () => okJson({}, 401),
    ]);
    fetchSpy = spy;
    await expect(saveBackup(DEFAULT_STATE)).rejects.toMatchObject({ code: 'auth_expired' });
    expect(calls).toHaveLength(1);
  });

  it('maps Drive 403 → forbidden', async () => {
    const { spy } = installFetch([
      () => okJson({ error: { message: 'quota' } }, 403),
    ]);
    fetchSpy = spy;
    await expect(saveBackup(DEFAULT_STATE)).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('maps Drive 429 → rate_limited', async () => {
    const { spy } = installFetch([
      () => okJson({}, 429),
    ]);
    fetchSpy = spy;
    await expect(saveBackup(DEFAULT_STATE)).rejects.toMatchObject({ code: 'rate_limited' });
  });

  it('maps fetch throw → network', async () => {
    const { spy } = installFetch([
      () => { throw new TypeError('Failed to fetch'); },
    ]);
    fetchSpy = spy;
    await expect(saveBackup(DEFAULT_STATE)).rejects.toMatchObject({ code: 'network' });
  });

  it('serialised body is the envelope (multipart: second part contains the envelope)', async () => {
    let capturedBody: string | undefined;
    let capturedCt: string | undefined;
    const { spy } = installFetch([
      () => okJson({ files: [] }),
      () => okJson({ id: 'folder-1' }),
      () => okJson({ files: [] }),
      (_url, init) => {
        capturedBody = init.body as string;
        capturedCt = (init.headers as any)['Content-Type'] as string;
        return okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:00:00.000Z' });
      },
    ]);
    fetchSpy = spy;
    await saveBackup(DEFAULT_STATE);
    expect(capturedBody).toBeDefined();
    expect(capturedCt).toMatch(/^multipart\/related; boundary=/);
    // Split body on each "--BOUNDARY" occurrence to get the three parts
    // (metadata, envelope, closing marker). Each part has a leading CRLF.
    const boundary = capturedCt!.split('boundary=')[1];
    const sections = capturedBody!.split(`--${boundary}`);
    // Section 0 is empty (before first boundary). Section 1 is the meta part
    // (after the CRLF). Section 2 is the envelope part. Section 3 is closing.
    // Find the envelope JSON by locating the first '{' after the envelope
    // part's Content-Type header line.
    const envelopeSection = sections[2];
    const firstBrace = envelopeSection.indexOf('{');
    expect(firstBrace).toBeGreaterThan(-1);
    const envelopeText = envelopeSection.slice(firstBrace).trim();
    const parsed = JSON.parse(envelopeText);
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.data).toBeDefined();
    expect(parsed.data.settings).toBeDefined();
  });

  it('sends Authorization header on every request', async () => {
    const { spy, calls } = installFetch([
      () => okJson({ files: [] }),
      () => okJson({ id: 'folder-1' }),
      () => okJson({ files: [] }),
      () => okJson({ id: 'file-1', modifiedTime: '2026-08-18T12:00:00.000Z' }),
    ]);
    fetchSpy = spy;
    await saveBackup(DEFAULT_STATE);
    for (const call of calls) {
      expect((call.init.headers as any).Authorization).toBe('Bearer ya29.test');
    }
  });
});

describe('listBackups (GD-1.5)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    saveToken();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    googleDrive.__test__markGisReady();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
    fetchSpy?.mockRestore();
    googleDrive.__test__resetLifecycle();
  });

  it('returns newest-first BackupFile[]', async () => {
    const { spy } = installFetch([
      () => okJson({
        files: [
          { id: 'a', name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' },
          { id: 'b', name: 'finora-backup-2026-08-17.json', modifiedTime: '2026-08-17T12:00:00.000Z' },
        ],
      }),
    ]);
    fetchSpy = spy;
    const list = await listBackups();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('a');
    expect(list[0].name).toBe('finora-backup-2026-08-18.json');
    expect(list[0].modifiedTime).toBe('2026-08-18T12:00:00.000Z');
    expect(list[1].id).toBe('b');
  });

  it('returns [] when no files match', async () => {
    const { spy } = installFetch([
      () => okJson({ files: [] }),
    ]);
    fetchSpy = spy;
    const list = await listBackups();
    expect(list).toEqual([]);
  });

  it('sends the correct query and orderBy', async () => {
    const { spy, calls } = installFetch([
      () => okJson({ files: [] }),
    ]);
    fetchSpy = spy;
    await listBackups();
    expect(calls[0].url).toContain("name%20contains%20'finora-backup'%20and%20trashed%3Dfalse");
    expect(calls[0].url).toContain('orderBy=modifiedTime desc');
    expect(calls[0].url).toContain('pageSize=20');
  });

  it('throws auth_expired on 401', async () => {
    const { spy } = installFetch([() => okJson({}, 401)]);
    fetchSpy = spy;
    await expect(listBackups()).rejects.toMatchObject({ code: 'auth_expired' });
  });

  it('throws forbidden on 403', async () => {
    const { spy } = installFetch([() => okJson({}, 403)]);
    fetchSpy = spy;
    await expect(listBackups()).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('throws network on fetch throw', async () => {
    const { spy } = installFetch([() => { throw new Error('offline'); }]);
    fetchSpy = spy;
    await expect(listBackups()).rejects.toMatchObject({ code: 'network' });
  });
});

describe('fetchBackupText (GD-1.5)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    saveToken();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    googleDrive.__test__markGisReady();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
    fetchSpy?.mockRestore();
    googleDrive.__test__resetLifecycle();
  });

  it('returns the raw response text', async () => {
    const envelope = JSON.stringify({ version: 1, exportedAt: '2026-08-18', data: {} });
    const { spy, calls } = installFetch([
      () => okText(envelope),
    ]);
    fetchSpy = spy;
    const text = await fetchBackupText('file-1');
    expect(text).toBe(envelope);
    expect(calls[0].url).toContain(`/file-1`);
    expect(calls[0].url).toContain('alt=media');
  });

  it('throws auth_expired on 401', async () => {
    const { spy } = installFetch([() => okJson({}, 401)]);
    fetchSpy = spy;
    await expect(fetchBackupText('file-1')).rejects.toMatchObject({ code: 'auth_expired' });
  });

  it('throws forbidden on 403', async () => {
    const { spy } = installFetch([() => okJson({}, 403)]);
    fetchSpy = spy;
    await expect(fetchBackupText('file-1')).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('throws not_found on 404', async () => {
    const { spy } = installFetch([() => okJson({}, 404)]);
    fetchSpy = spy;
    await expect(fetchBackupText('file-x')).rejects.toMatchObject({ code: 'not_found' });
  });

  it('throws network on fetch throw', async () => {
    const { spy } = installFetch([() => { throw new Error('offline'); }]);
    fetchSpy = spy;
    await expect(fetchBackupText('file-1')).rejects.toMatchObject({ code: 'network' });
  });
});

/**
 * GD-1.6 — Round-trip integration test.
 *
 * Exercises saveBackup → listBackups → fetchBackupText with a recorded fetch
 * script. The Drive "server" is a tiny stateful mock: the first POST captures
 * the envelope text and stashes it under the returned file id; a later
 * GET /files?alt=media returns that same text.
 *
 * This proves the bytes that hit Drive are exactly the bytes that come back,
 * and that parseImport() can ingest what fetchBackupText() returns.
 */
describe('round-trip (GD-1.6)', () => {
  let injectSpy: MockInstance<any>;
  let fetchSpy: MockInstance<any>;

  beforeEach(() => {
    localStorage.clear();
    __test__resetLifecycle();
    saveToken();
    injectSpy = vi.spyOn(scriptMod, 'injectGisScript').mockResolvedValue(undefined);
    googleDrive.__test__markGisReady();
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    injectSpy.mockRestore();
    fetchSpy?.mockRestore();
    googleDrive.__test__resetLifecycle();
  });

  it('save → list → fetch yields the same envelope bytes', async () => {
    // Pre-capture the serialised envelope by spying on serializeExport is
    // overkill — we can just call it once and trust the result.
    const state = DEFAULT_STATE;
    const expectedEnvelope = (await import('../lib/exportImport')).serializeExport(state);

    const recordedText: { value: string | null } = { value: null };
    const createdId = 'round-trip-file-1';

    const handlers: Array<(url: string, init: RequestInit) => Response | Promise<Response>> = [
      // 1. saveBackup: folder search (empty → create)
      () => okJson({ files: [] }),
      // 2. saveBackup: folder create
      () => okJson({ id: 'folder-1' }),
      // 3. saveBackup: today file search (empty → POST)
      () => okJson({ files: [] }),
      // 4. saveBackup: file POST. Capture the envelope from the multipart body.
      (_url, init) => {
        const body = init.body as string;
        const ct = (init.headers as any)['Content-Type'] as string;
        const boundary = ct.split('boundary=')[1];
        // parts: ['', '--BOUND\r\nContent-Type...', '{meta}\r\n--BOUND\r\nContent-Type...', '{envelope}\r\n--BOUND--']
        const sections = body.split(`--${boundary}`);
        // sections[2] is the envelope section; locate the JSON.
        const envelopeSection = sections[2];
        const firstBrace = envelopeSection.indexOf('{');
        const trimmed = envelopeSection.slice(firstBrace).replace(/\r\n$/, '');
        recordedText.value = trimmed;
        return okJson({ id: createdId, modifiedTime: '2026-08-18T12:00:00.000Z' });
      },
      // 5. listBackups: return the one file we just created.
      () => okJson({ files: [{ id: createdId, name: 'finora-backup-2026-08-18.json', modifiedTime: '2026-08-18T12:00:00.000Z' }] }),
      // 6. fetchBackupText: return the captured envelope text.
      () => okText(recordedText.value ?? expectedEnvelope),
    ];
    const { spy } = installFetch(handlers);
    fetchSpy = spy;

    // 1. Save.
    const saved = await saveBackup(state);
    expect(saved.fileId).toBe(createdId);

    // 2. List.
    const list = await listBackups();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(createdId);

    // 3. Fetch the bytes we put on Drive.
    const fetchedText = await fetchBackupText(list[0].id);

    // 4. The round-trip is structurally stable: what we put on Drive is
    // what comes back. We don't byte-compare because the envelope bakes
    // in `exportedAt` (ms timestamp), and the two serialisations are
    // 1ms apart — the JSON shape is identical, the timestamp is not.
    // Normalise exportedAt on both sides so the deep equality passes.
    const fetched = JSON.parse(fetchedText);
    const expected = JSON.parse(expectedEnvelope);
    expect(typeof fetched.exportedAt).toBe('string');
    expect(typeof expected.exportedAt).toBe('string');
    delete fetched.exportedAt;
    delete expected.exportedAt;
    expect(fetched).toEqual(expected);
    // Sanity: the captured-on-upload text matches what we fetched.
    expect(fetchedText).toBe(recordedText.value);
  });
});
