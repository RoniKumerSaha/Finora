/**
 * googleDrive.ts — Google Drive integration (Finora V1.1).
 *
 * Public API surface lives here. The GIS <script> tag injector lives in
 * `googleDrive.script.ts` so this module stays free of DOM side effects
 * at import time (which lets unit tests import it cleanly).
 *
 * Story mapping:
 *   GD-1.1  types + token storage (this file)
 *   GD-1.2  GIS lifecycle (googleDrive.script.ts + lifecycle hooks here)
 *   GD-1.3  OAuth connect/disconnect/getAccessToken
 *   GD-1.4  saveBackup + folder bootstrap
 *   GD-1.5  listBackups + fetchBackupText
 */

export interface GdriveTokens {
  accessToken: string;
  expiresAt: number;
  scope: string;
  email?: string;
}

export interface BackupFile {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface SaveResult {
  fileId: string;
  modifiedTime: string;
}

export type GdriveErrorCode =
  | 'popup_closed'
  | 'access_denied'
  | 'popup_blocked'
  | 'script_load_failed'
  | 'script_not_ready'
  | 'auth_expired'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'parse'
  | 'unknown';

export class GdriveError extends Error {
  readonly code: GdriveErrorCode;
  readonly status?: number;
  readonly cause?: unknown;
  constructor(code: GdriveErrorCode, message: string, opts?: { status?: number; cause?: unknown }) {
    super(message);
    this.name = 'GdriveError';
    this.code = code;
    if (opts?.status !== undefined) this.status = opts.status;
    if (opts?.cause !== undefined) this.cause = opts.cause;
  }
}

export const GDRIVE_TOKENS_KEY = 'finora:gdrive:tokens';

export type GisLoadErrorListener = (reason: GdriveError) => void;

const FEATURE_FLAG = 'VITE_FEATURE_GDRIVE_SYNC';
const CLIENT_ID_ENV = 'VITE_GOOGLE_CLIENT_ID';
const GIS_URL = 'https://accounts.google.com/gsi/client';
const DEFAULT_SCRIPT_TIMEOUT_MS = 10_000;

import { injectGisScript } from './googleDrive.script';

/** Read a build-time env var. Falls back to (globalThis as any).process.env
 *  so vitest specs can use vi.stubEnv to set these without needing @types/node. */
function readEnv(key: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)?.[key];
  if (fromVite) return fromVite;
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[key];
}

/** Feature flag check. The single source of truth for whether the
 *  Cloud section is allowed to run. */
export function isFeatureEnabled(): boolean {
  return readEnv(FEATURE_FLAG) === 'true';
}

// ── GIS lifecycle (module-private singleton) ─────────────────────────

let gisReady = false;
let gisLoadPromise: Promise<void> | null = null;
const readyListeners = new Set<() => void>();
const loadErrorListeners = new Set<(e: GdriveError) => void>();

/** Public: has the GIS script loaded and the global function available? */
export function isGisReady(): boolean {
  return gisReady;
}

/** Public: subscribe to "ready". If already ready, fires on next microtask. */
export function onGisReady(cb: () => void): () => void {
  readyListeners.add(cb);
  if (gisReady) {
    queueMicrotask(() => {
      if (readyListeners.has(cb)) cb();
    });
  }
  return () => {
    readyListeners.delete(cb);
  };
}

/** Public: subscribe to "load failed". Fires once per failed load. */
export function onGisLoadError(cb: GisLoadErrorListener): () => void {
  loadErrorListeners.add(cb);
  return () => {
    loadErrorListeners.delete(cb);
  };
}

/** Public: idempotent loader. Short-circuits when the feature flag is off. */
export function loadGisScript(): Promise<void> {
  if (!isFeatureEnabled()) return Promise.resolve();
  if (gisReady) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = injectAndAwait();
  return gisLoadPromise;
}

async function injectAndAwait(): Promise<void> {
  try {
    await injectGisScript({
      url: GIS_URL,
      timeoutMs: DEFAULT_SCRIPT_TIMEOUT_MS,
    });
    gisReady = true;
    for (const cb of readyListeners) {
      try { cb(); } catch (err) { console.warn('[googleDrive] ready listener threw:', err); }
    }
  } catch (cause) {
    const err = new GdriveError(
      'script_load_failed',
      'Google Identity Services script failed to load.',
      { cause },
    );
    for (const cb of loadErrorListeners) {
      try { cb(err); } catch (listenerErr) { console.warn('[googleDrive] load-error listener threw:', listenerErr); }
    }
    // Allow a future retry by clearing the in-flight promise.
    gisLoadPromise = null;
    throw err;
  }
}

/** Test seam: explicitly mark the GIS global ready. Only for unit tests. */
export function __test__markGisReady(): void {
  if (gisReady) return;
  gisReady = true;
  for (const cb of readyListeners) {
    try { cb(); } catch (err) { console.warn('[googleDrive] ready listener threw:', err); }
  }
}

/** Test seam: reset the singleton lifecycle state. Only for unit tests. */
export function __test__resetLifecycle(): void {
  gisReady = false;
  gisLoadPromise = null;
  readyListeners.clear();
  loadErrorListeners.clear();
  folderCache = null;
}

// ── OAuth (GD-1.3) ───────────────────────────────────────────────────

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const REFRESH_LEAD_MS = 60_000;
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

interface GoogleAccountsOauth2 {
  initTokenClient: (config: any) => { requestAccessToken: (opts: { prompt?: string }) => void };
  refresh?: (config: any) => void;
}

function getGis(): GoogleAccountsOauth2 | null {
  const g = (globalThis as any).google?.accounts?.oauth2;
  if (!g?.initTokenClient) return null;
  return g as GoogleAccountsOauth2;
}

/** Public: open the OAuth popup. Resolves with the populated tokens.
 *  Rejects with GdriveError codes: script_not_ready, unknown, popup_closed,
 *  access_denied, popup_blocked. */
export function connect(): Promise<GdriveTokens> {
  return new Promise<GdriveTokens>((resolve, reject) => {
    if (!isGisReady()) {
      reject(new GdriveError('script_not_ready', 'Google Identity Services is not loaded yet.'));
      return;
    }
    const clientId = readEnv(CLIENT_ID_ENV) ?? '';
    if (!clientId) {
      console.error('[googleDrive] VITE_GOOGLE_CLIENT_ID is not set. Set it in .env or your build config.');
      reject(new GdriveError('unknown', 'VITE_GOOGLE_CLIENT_ID is not configured.'));
      return;
    }
    const gis = getGis();
    if (!gis) {
      reject(new GdriveError('unknown', 'google.accounts.oauth2 missing from global scope.'));
      return;
    }
    const existing = loadTokens();
    try {
      const client = gis.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        callback: (resp: any) => {
          if (!resp?.access_token) {
            reject(new GdriveError('unknown', 'Google returned no access token.', { cause: resp }));
            return;
          }
          const tokens: GdriveTokens = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
            scope: resp.scope ?? DRIVE_FILE_SCOPE,
            email: resp.email,
          };
          saveTokens(tokens);
          resolve(tokens);
        },
        error_callback: (err: { type?: string; message?: string }) => {
          const code = mapGisErrorToCode(err);
          reject(new GdriveError(code, err?.message ?? 'Google OAuth error.', { cause: err }));
        },
      });
      client.requestAccessToken({ prompt: existing ? '' : 'consent' });
    } catch (cause) {
      reject(new GdriveError('popup_blocked', 'Failed to open Google OAuth popup.', { cause }));
    }
  });
}

function mapGisErrorToCode(err: { type?: string }): GdriveErrorCode {
  switch (err?.type) {
    case 'popup_closed': return 'popup_closed';
    case 'access_denied': return 'access_denied';
    case 'popup_failed_to_open':
    case 'popup_blocked_by_browser': return 'popup_blocked';
    default: return 'unknown';
  }
}

/** Public: clear local tokens + fire-and-forget revoke. */
export async function disconnect(): Promise<void> {
  const existing = loadTokens();
  clearTokens();
  if (!existing?.accessToken) return;
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(existing.accessToken)}`, {
      method: 'POST',
    });
  } catch {
    // Fire-and-forget: user can still revoke from myaccount.google.com.
  }
}

/** Public (internal seam): get a current access token, refreshing if needed.
 *  All Drive API calls go through this. */
export async function getAccessToken(): Promise<string> {
  const existing = loadTokens();
  if (!existing) {
    throw new GdriveError('auth_expired', 'No Google Drive tokens in local storage.');
  }
  if (existing.expiresAt - Date.now() >= REFRESH_LEAD_MS) {
    return existing.accessToken;
  }
  const gis = getGis();
  if (!gis?.refresh) {
    clearTokens();
    throw new GdriveError('auth_expired', 'Google refresh not available.');
  }
  return new Promise<string>((resolve, reject) => {
    try {
      gis.refresh!({
        client_id: readEnv(CLIENT_ID_ENV) ?? '',
        scope: DRIVE_FILE_SCOPE,
        callback: (resp: any) => {
          if (!resp?.access_token) {
            clearTokens();
            reject(new GdriveError('auth_expired', 'Refresh returned no token.', { cause: resp }));
            return;
          }
          const tokens: GdriveTokens = {
            accessToken: resp.access_token,
            expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000,
            scope: resp.scope ?? existing.scope,
            email: resp.email ?? existing.email,
          };
          saveTokens(tokens);
          resolve(tokens.accessToken);
        },
        error_callback: (err: { type?: string; message?: string }) => {
          clearTokens();
          reject(new GdriveError('auth_expired', err?.message ?? 'Refresh failed.', { cause: err }));
        },
      });
    } catch (cause) {
      clearTokens();
      reject(new GdriveError('auth_expired', 'Refresh threw.', { cause }));
    }
  });
}

/** Read tokens from localStorage. Returns null on missing / malformed / denied access. */
export function loadTokens(): GdriveTokens | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(GDRIVE_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GdriveTokens;
    if (
      typeof parsed?.accessToken !== 'string' ||
      typeof parsed?.expiresAt !== 'number' ||
      typeof parsed?.scope !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Write tokens to localStorage. Swallows quota errors with a console warn
 *  so the UI can treat the absence as "disconnected". */
export function saveTokens(t: GdriveTokens): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(GDRIVE_TOKENS_KEY, JSON.stringify(t));
  } catch (err) {
    console.warn('[googleDrive] saveTokens failed:', err);
  }
}

/** Remove tokens. The only path that removeItems the key. */
export function clearTokens(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(GDRIVE_TOKENS_KEY);
  } catch {
    // Storage denied — nothing meaningful to do.
  }
}

// ── Drive API (GD-1.4, GD-1.5) ──────────────────────────────────────

import type { State } from '../domain/types';
import { serializeExport, exportFilename } from './exportImport';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_NAME = 'Finora backups';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FILE_MIME = 'application/json';

interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
}

interface DriveFolderList {
  files?: DriveFileMeta[];
}

interface FolderCache {
  id: string;
}

/**
 * Internal: cached folder id. Saves one Drive round-trip per save
 * within a session. Cleared on disconnect.
 */
let folderCache: FolderCache | null = null;

function resetFolderCache(): void {
  folderCache = null;
}

/** Test seam: clear the folder cache. Call from __test__resetLifecycle. */
export function __test__resetFolderCache(): void {
  folderCache = null;
}

/**
 * Drive → GdriveError mapping. Network throws map to `network`. Anything
 * 2xx that's unparseable is treated as `unknown`. We never throw a raw
 * Error from this module past the boundary.
 */
async function driveFetch(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (cause) {
    throw new GdriveError('network', `Drive request to ${url} failed.`, { cause });
  }
  if (res.status === 401) {
    clearTokens();
    resetFolderCache();
    throw new GdriveError('auth_expired', 'Drive rejected the access token.', { status: 401 });
  }
  if (res.status === 403) {
    let message = res.statusText;
    try {
      const body = await res.clone().json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // ignore parse failure on body
    }
    throw new GdriveError('forbidden', message || 'Drive returned 403.', { status: 403 });
  }
  if (res.status === 404) {
    throw new GdriveError('not_found', 'Drive returned 404.', { status: 404 });
  }
  if (res.status === 429) {
    throw new GdriveError('rate_limited', 'Drive rate-limited the request.', { status: 429 });
  }
  return res;
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

/** Build a multipart/related body for the Drive upload. The first part is
 *  the metadata JSON; the second part is the file content. Drive requires
 *  a boundary string — we make a short random one. */
function buildMultipartBody(meta: object, content: string, boundary: string): { body: BodyInit; contentType: string } {
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`;
  const contentPart = `--${boundary}\r\nContent-Type: ${FILE_MIME}\r\n\r\n${content}\r\n`;
  const closing = `--${boundary}--`;
  return {
    body: metaPart + contentPart + closing,
    contentType: `multipart/related; boundary=${boundary}`,
  };
}

function makeBoundary(): string {
  return '-------finora' + Math.random().toString(36).slice(2, 12);
}

/**
 * Internal: find or create the "Finora backups" folder. Caches the id.
 * Returns the folder id.
 */
async function findOrCreateFolder(token: string): Promise<string> {
  if (folderCache?.id) return folderCache.id;
  const q = `name='${FOLDER_NAME}' and mimeType='${FOLDER_MIME}' and trashed=false`;
  const search = await driveFetch(
    `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { method: 'GET', headers: authHeaders(token) },
  );
  const listed = (await search.json()) as DriveFolderList;
  if (listed.files?.[0]?.id) {
    folderCache = { id: listed.files[0].id };
    return listed.files[0].id;
  }
  const created = await driveFetch(DRIVE_API, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  const createdMeta = (await created.json()) as DriveFileMeta;
  folderCache = { id: createdMeta.id };
  return createdMeta.id;
}

/**
 * Internal: find today's existing file (if any) inside the folder.
 * Returns its id or null.
 */
async function findTodaysFile(token: string, folderId: string, name: string): Promise<string | null> {
  const q = `name='${name}' and '${folderId}' in parents and trashed=false`;
  const search = await driveFetch(
    `${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime)`,
    { method: 'GET', headers: authHeaders(token) },
  );
  const listed = (await search.json()) as DriveFolderList;
  return listed.files?.[0]?.id ?? null;
}

/** Public: save the current state to Drive. Overwrites today's file in
 *  place if it exists; otherwise creates it. Uses multipart/related upload
 *  because Drive does not accept file content in a JSON-only body. */
export async function saveBackup(state: State): Promise<SaveResult> {
  const token = await getAccessToken();
  const folderId = await findOrCreateFolder(token);
  const filename = exportFilename();
  const existingId = await findTodaysFile(token, folderId, filename);
  const body = serializeExport(state);
  const meta = {
    name: filename,
    mimeType: FILE_MIME,
    parents: existingId ? undefined : [folderId],
    appProperties: { finoraVersion: '1' },
  };
  const { body: uploadBody, contentType } = buildMultipartBody(meta, body, makeBoundary());
  const headers = { ...authHeaders(token), 'Content-Type': contentType };
  let res: Response;
  if (existingId) {
    res = await driveFetch(`${DRIVE_API}/${existingId}`, {
      method: 'PATCH',
      headers,
      body: uploadBody,
    });
  } else {
    res = await driveFetch(DRIVE_API, {
      method: 'POST',
      headers,
      body: uploadBody,
    });
  }
  const saved = (await res.json()) as DriveFileMeta;
  return { fileId: saved.id, modifiedTime: saved.modifiedTime ?? '' };
}

/** Public: list backup files, newest-first. */
export async function listBackups(): Promise<BackupFile[]> {
  const token = await getAccessToken();
  const q = `name contains 'finora-backup' and trashed=false`;
  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=20&fields=files(id,name,modifiedTime)`;
  const res = await driveFetch(url, { method: 'GET', headers: authHeaders(token) });
  const listed = (await res.json()) as DriveFolderList;
  return (listed.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime ?? '',
  }));
}

/** Public: fetch a backup file's raw text content. The caller is
 *  expected to pipe it through `parseImport()`. */
export async function fetchBackupText(fileId: string): Promise<string> {
  const token = await getAccessToken();
  const res = await driveFetch(`${DRIVE_API}/${fileId}?alt=media`, {
    method: 'GET',
    headers: authHeaders(token),
  });
  return res.text();
}
