// Backups: whole-library backup files and a Google Sheet used as cloud storage.
//
// The Sheet side is a small Google Apps Script the user pastes into their own Sheet and deploys as a
// web app (see APPS_SCRIPT). No Google sign-in happens inside Quizzo: the app only talks to that
// web app's URL, protected by a random key that is part of the "connection link".
import type { CloudSettings, Library } from '../types';
import { normalizeLibrary } from './storage';
import { validateDeck } from './validate';
import { fingerprint } from './util';

export { fingerprint };

// ---- the library as a backup ----

/** What goes into a backup: everything except this device's cloud settings. Same text for the same library. */
export function backupPayload(lib: Library): string {
  const { cloud: _cloud, backedUpAt: _at, backedUpFrom: _from, ...rest } = lib;
  return JSON.stringify(rest);
}

/** A backup as stored: the payload plus when and on which device it was made. */
export function stampedBackup(lib: Library, device: string, now = Date.now()): string {
  return JSON.stringify({ ...JSON.parse(backupPayload(lib)), backedUpAt: now, backedUpFrom: device });
}

export function librarySummary(lib: Library) {
  return {
    decks: lib.decks.length,
    cards: lib.decks.reduce((n, d) => n + d.cards.length, 0),
    titles: lib.decks.map((d) => d.title),
  };
}

/**
 * Reads a backup (from a file or the Sheet). Decks are validated one by one; broken ones are skipped
 * and reported rather than failing the whole restore.
 */
export function parseLibraryBackup(json: string): { library?: Library; errors: string[] } {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { errors: [`Not valid JSON: ${(e as Error).message}`] };
  }
  if (data?.format !== 'quizzo-library' || !Array.isArray(data.decks)) {
    const isDeck = data?.format === 'quizzo-deck' || Array.isArray(data?.cards);
    return {
      errors: [
        isDeck
          ? 'This is a single deck file, not a full backup. Use Import on the start screen to add it.'
          : 'This is not a Quizzo backup file.',
      ],
    };
  }
  const errors: string[] = [];
  const decks = data.decks.flatMap((d: unknown, i: number) => {
    const r = validateDeck(d);
    if (!r.deck) errors.push(`Deck ${i + 1} skipped: ${r.errors[0] ?? 'invalid'}`);
    return r.deck ? [r.deck] : [];
  });
  const { cloud: _cloud, ...rest } = data;
  return { library: normalizeLibrary({ ...rest, decks }), errors };
}

/** Replaces this library with a backup, keeping this device's cloud connection. */
export function restoreInto(current: Library, backup: Library): Library {
  const cloud = current.cloud && { ...current.cloud, lastHash: fingerprint(backupPayload(backup)) };
  const { backedUpAt: _at, backedUpFrom: _from, ...rest } = backup;
  return { ...rest, cloud };
}

// ---- connection link ----

const SCRIPT_HOST = 'script.google.com';

export function newKey(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `https://script.google.com/macros/s/…/exec?key=…`: everything another device needs. */
export function connectionLink(cloud: Pick<CloudSettings, 'url' | 'key'>): string {
  return `${cloud.url}?key=${cloud.key}`;
}

/**
 * Accepts the web app URL (key then comes from `fallbackKey`, the one in the script this device showed)
 * or a full connection link.
 */
export function parseConnection(text: string, fallbackKey?: string): { url: string; key: string } | { error: string } {
  let u: URL;
  try {
    u = new URL(text.trim());
  } catch {
    return { error: 'That is not a link. Paste the whole web app URL, starting with https://' };
  }
  // Google Workspace (school / work) accounts get links like /a/macros/<domain>/s/…/exec.
  const path = u.pathname.replace(/\/+$/, '');
  if (u.hostname !== SCRIPT_HOST || !/^\/(a\/macros\/[^/]+|macros)\/s\//.test(path)) {
    return {
      error:
        'This is not a web app link. In Apps Script use Deploy → New deployment → Web app, then copy the "Web app" URL (it starts with https://script.google.com/macros/). The Sheet\'s own address does not work.',
    };
  }
  if (path.endsWith('/dev')) {
    return { error: 'This is the test (/dev) URL. Copy the "Web app" URL from Deploy → Manage deployments (it ends in /exec).' };
  }
  const key = u.searchParams.get('key') ?? fallbackKey;
  if (!key) return { error: 'This link has no key. Copy the full connection link from your other device or from the Quizzo tab in your Sheet.' };
  return { url: `${u.origin}${path}`, key };
}

/** The ping request as a link: opened in a browser tab it shows exactly what Google answers. */
export function testLink(conn: { url: string; key: string }): string {
  return `${conn.url}?${new URLSearchParams({ action: 'ping', key: conn.key })}`;
}

const KEY_STORE = 'quizzo.cloud.setupKey';

/**
 * The key put into the setup script. Kept on this device until it connects, so leaving the Backup
 * screen (e.g. to deploy the script) doesn't change it and make the Sheet answer "Wrong key".
 */
export function setupKey(saved?: string): string {
  if (saved) return saved;
  try {
    const stored = localStorage.getItem(KEY_STORE);
    if (stored && /^[0-9a-f]{24}$/.test(stored)) return stored;
    const key = newKey();
    localStorage.setItem(KEY_STORE, key);
    return key;
  } catch {
    return newKey();
  }
}

// ---- talking to the web app ----

export interface CloudBackupInfo {
  id: string;
  /** Epoch ms. */
  created: number;
  device: string;
  decks: number;
  cards: number;
}

type Http = (url: string, init: { method: 'GET' | 'POST'; body?: string }) => Promise<{ status: number; text: string }>;

/** Google answered, but with one of its own pages (sign-in, error, not found) that the browser won't show us. */
export class WebPageError extends Error {}

/** Desktop goes through the main process (no CORS involved); browser and Android use fetch. */
const defaultHttp: Http = async (url, init) => {
  if (window.quizzoNative?.http) return window.quizzoNative.http(url, init);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      body: init.body,
      // text/plain keeps this a "simple" request, so the browser sends no preflight Apps Script can't answer.
      headers: init.body ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
      redirect: 'follow',
    });
  } catch (e) {
    // Google's own pages carry no CORS header, so the browser hides them and fetch fails as if offline.
    // A no-cors request still goes through when Google is reachable: then it's the deployment, not the network.
    const reachable = await fetch(url, { mode: 'no-cors', redirect: 'follow' }).then(
      () => true,
      () => false,
    );
    if (reachable) throw new WebPageError('Google answered with a web page');
    throw e;
  }
  return { status: res.status, text: await res.text() };
};

const WEB_PAGE_HELP =
  'Google answered with a web page instead of Quizzo data, so the web app is not set up the way Quizzo needs. ' +
  'Press "Open test link" to see that page. Usually this fixes it: in Apps Script open Deploy → Manage deployments → ✎ Edit, ' +
  'set "Execute as: Me" and "Who has access: Anyone" (not "Anyone with Google account"), pick Version: New version and press Deploy. ' +
  'If Google asks for access, allow it. Then copy the Web app URL shown there (it ends in /exec) and paste it here again.';

export class CloudError extends Error {
  /** A link that shows what Google answers, to help find setup problems. */
  testUrl?: string;
  constructor(message: string, testUrl?: string) {
    super(message);
    this.testUrl = testUrl;
  }
}

export class CloudClient {
  constructor(
    private conn: { url: string; key: string },
    private http: Http = defaultHttp,
  ) {}

  private async call<T>(params: Record<string, string>, body?: object): Promise<T> {
    const q = new URLSearchParams({ ...params, key: this.conn.key }).toString();
    let res;
    try {
      res = await this.http(`${this.conn.url}?${q}`, body ? { method: 'POST', body: JSON.stringify(body) } : { method: 'GET' });
    } catch (e) {
      if (e instanceof WebPageError) throw new CloudError(WEB_PAGE_HELP, testLink(this.conn));
      throw new CloudError(
        `Could not reach Google (${(e as Error).message || 'network error'}). Check the internet connection, and that no ad blocker or network filter blocks script.google.com.`,
        testLink(this.conn),
      );
    }
    let data: any;
    try {
      data = JSON.parse(res.text);
    } catch {
      throw new CloudError(
        res.status === 404
          ? 'The web app was not found. Was the deployment deleted? Deploy again and paste the new link.'
          : WEB_PAGE_HELP,
        testLink(this.conn),
      );
    }
    if (!data?.ok) {
      const msg = String(data?.error ?? 'Unknown error');
      throw new CloudError(
        msg === 'Wrong key'
          ? 'The key does not match the script in the Sheet. Paste the full connection link (it ends in ?key=…) from your other device or from the Quizzo tab in the Sheet.'
          : msg,
      );
    }
    return data as T;
  }

  private version?: number;

  async ping(): Promise<{ version: number; backups: number }> {
    const r = await this.call<{ version: number; backups: number }>({ action: 'ping' });
    this.version = Number(r.version) || 1;
    return r;
  }

  /** Version of the script in the Sheet (1 = stores pictures inside every backup). */
  async scriptVersion(): Promise<number> {
    if (this.version === undefined) await this.ping();
    return this.version!;
  }

  async list(): Promise<CloudBackupInfo[]> {
    return (await this.call<{ backups: CloudBackupInfo[] }>({ action: 'list' })).backups;
  }

  /**
   * A backup's text, complete with its pictures. Pictures this device already has (`have`) aren't downloaded.
   */
  async get(id: string, have: Record<string, string> = {}): Promise<string> {
    const text = (await this.call<{ data: string }>({ action: 'get', id })).data;
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return text; // let the restore code report it
    }
    if (!Array.isArray(data?.imageIds)) return text; // script version 1: pictures are inside
    const ids: string[] = data.imageIds;
    const images: Record<string, string> = {};
    const missing: string[] = [];
    for (const i of ids) {
      if (have[i] !== undefined) images[i] = have[i];
      else missing.push(i);
    }
    for (let i = 0; i < missing.length; i += IMAGE_BATCH_IDS) {
      const got = await this.call<{ images: Record<string, string> }>(
        { action: 'getImages' },
        { ids: missing.slice(i, i + IMAGE_BATCH_IDS) },
      );
      Object.assign(images, got.images);
    }
    const { imageIds: _ids, ...rest } = data;
    return JSON.stringify({ ...rest, images });
  }

  /**
   * Backs up the library. With script version 2 the pictures go into their own tab, each uploaded once:
   * only pictures the Sheet doesn't have yet are sent, and the backup itself just lists their names.
   */
  async save(lib: Library, device: string): Promise<CloudBackupInfo> {
    const s = librarySummary(lib);
    const full = JSON.parse(stampedBackup(lib, device));
    const images: Record<string, string> = full.images ?? {};
    let data: string;
    if (Object.keys(images).length && (await this.scriptVersion()) >= 2) {
      const stored = new Set((await this.call<{ ids: string[] }>({ action: 'imageIds' })).ids);
      let batch: Record<string, string> = {};
      let size = 0;
      const flush = async () => {
        if (!size) return;
        await this.call({ action: 'putImages' }, { images: batch });
        batch = {};
        size = 0;
      };
      for (const [id, src] of Object.entries(images)) {
        if (stored.has(id)) continue;
        batch[id] = src;
        size += src.length;
        if (size >= IMAGE_BATCH_CHARS) await flush();
      }
      await flush();
      const { images: _img, ...rest } = full;
      data = JSON.stringify({ ...rest, imageIds: Object.keys(images) });
    } else data = JSON.stringify(full);
    return (await this.call<{ backup: CloudBackupInfo }>({ action: 'save' }, { device, ...s, data })).backup;
  }
}

/** Pictures per upload request (characters) and per download request (count), well under Google's limits. */
const IMAGE_BATCH_CHARS = 3_000_000;
const IMAGE_BATCH_IDS = 40;

export function defaultDeviceName(): string {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const desktop = typeof window !== 'undefined' && !!window.quizzoNative;
  if (/Android/i.test(ua)) return 'Android phone';
  if (/iPhone|iPad/i.test(ua)) return 'iPhone';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : '';
  return desktop ? `${os || 'Desktop'} PC`.replace('Mac PC', 'Mac') : `${os ? os + ' ' : ''}browser`;
}

// ---- the script that runs inside the user's Google Sheet ----

export const SCRIPT_VERSION = 2;

/** Google Apps Script source. KEY is filled in per user. */
export function appsScript(key: string): string {
  return APPS_SCRIPT.replace('__KEY__', key);
}

const APPS_SCRIPT = `// Quizzo cloud backup (script version ${SCRIPT_VERSION}).
// Paste this into Extensions > Apps Script of a Google Sheet, then
// Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
// Backups are stored in the "Quizzo backups" tab of this Sheet. Don't edit that tab by hand.

const KEY = '__KEY__';  // must match the key in the Quizzo app
const KEEP = 20;        // how many backups to keep
const CHUNK = 40000;    // characters per cell (a cell holds at most 50,000)
const DATA_TAB = 'Quizzo backups';
const INFO_TAB = 'Quizzo';
const IMG_TAB = 'Quizzo images'; // each card picture once, shared by all backups

function doGet(e) {
  return handle_(e && e.parameter ? e.parameter : {}, null);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) {}
  return handle_(e && e.parameter ? e.parameter : {}, body);
}

function handle_(p, body) {
  let result;
  try {
    if (p.key !== KEY) throw new Error('Wrong key');
    if (p.action === 'ping') result = { version: ${SCRIPT_VERSION}, backups: list_().length };
    else if (p.action === 'list') result = { backups: list_() };
    else if (p.action === 'get') result = { data: get_(String(p.id)) };
    else if (p.action === 'save' && body) result = { backup: save_(body) };
    else if (p.action === 'imageIds') result = { ids: imageIds_() };
    else if (p.action === 'putImages' && body) result = { stored: putImages_(body.images || {}) };
    else if (p.action === 'getImages' && body) result = { images: getImages_(body.ids || []) };
    else throw new Error('Unknown action');
    result.ok = true;
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

function dataSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DATA_TAB);
  if (!sh) {
    sh = ss.insertSheet(DATA_TAB);
    sh.getRange(1, 1, 1, 8).setValues([['id', 'created', 'device', 'decks', 'cards', 'part', 'parts', 'data']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_() {
  const sh = dataSheet_();
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 8).getValues() : [];
}

function list_() {
  const seen = {};
  const out = [];
  rows_().forEach(function (r, row) {
    const id = String(r[0]);
    if (!id || seen[id]) return;
    seen[id] = true;
    out.push({ id: id, created: Number(r[1]), device: String(r[2]), decks: Number(r[3]), cards: Number(r[4]), row: row });
  });
  // Newest first; rows further down were added later (ties when two backups land in the same millisecond).
  out.sort(function (a, b) { return b.created - a.created || b.row - a.row; });
  return out.map(function (b) { delete b.row; return b; });
}

function get_(id) {
  const parts = rows_().filter(function (r) { return String(r[0]) === id; });
  if (!parts.length) throw new Error('Backup not found');
  parts.sort(function (a, b) { return Number(a[5]) - Number(b[5]); });
  if (parts.length !== Number(parts[0][6])) throw new Error('Backup is incomplete');
  // Each piece starts with "|" so Sheets never reads it as a number or formula.
  return parts.map(function (r) { return String(r[7]).slice(1); }).join('');
}

function save_(b) {
  const data = String(b.data || '');
  JSON.parse(data); // never store something that can't be restored
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = dataSheet_();
    const created = Date.now();
    const id = created.toString(36) + Math.random().toString(36).slice(2, 6);
    const device = String(b.device || 'Unknown').slice(0, 60);
    const decks = Number(b.decks) || 0;
    const cards = Number(b.cards) || 0;
    const pieces = [];
    for (let i = 0; i < data.length || i === 0; i += CHUNK) pieces.push(data.slice(i, i + CHUNK));
    const values = pieces.map(function (piece, i) { return [id, created, device, decks, cards, i + 1, pieces.length, '|' + piece]; });
    const start = sh.getLastRow() + 1;
    const range = sh.getRange(start, 1, values.length, 8);
    range.setNumberFormat('@');
    range.setValues(values);
    prune_(sh);
    writeInfo_(created, device, decks, cards, b.titles);
    return { id: id, created: created, device: device, decks: decks, cards: cards };
  } finally {
    lock.releaseLock();
  }
}

// ---- pictures: one row per piece, named by a fingerprint of the picture ----

function imageSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(IMG_TAB);
  if (!sh) {
    sh = ss.insertSheet(IMG_TAB);
    sh.getRange(1, 1, 1, 5).setValues([['id', 'part', 'parts', 'added', 'data']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function imageRows_() {
  const sh = imageSheet_();
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 5).getValues() : [];
}

/** Ids of pictures stored completely. */
function imageIds_() {
  const parts = {};
  imageRows_().forEach(function (r) {
    const id = String(r[0]);
    if (!id) return;
    parts[id] = parts[id] || { have: 0, need: Number(r[2]) };
    parts[id].have++;
  });
  return Object.keys(parts).filter(function (id) { return parts[id].have === parts[id].need; });
}

function putImages_(images) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const have = {};
    imageIds_().forEach(function (id) { have[id] = true; });
    const values = [];
    const now = Date.now();
    Object.keys(images).forEach(function (id) {
      const src = String(images[id] || '');
      if (have[id] || !/^[0-9a-z-]+$/.test(id) || src.indexOf('data:image/') !== 0) return;
      const pieces = [];
      for (let i = 0; i < src.length; i += CHUNK) pieces.push(src.slice(i, i + CHUNK));
      pieces.forEach(function (piece, i) { values.push([id, i + 1, pieces.length, now, '|' + piece]); });
      have[id] = true;
    });
    if (values.length) {
      const sh = imageSheet_();
      const range = sh.getRange(sh.getLastRow() + 1, 1, values.length, 5);
      range.setNumberFormat('@');
      range.setValues(values);
    }
    return values.length;
  } finally {
    lock.releaseLock();
  }
}

function getImages_(ids) {
  const want = {};
  ids.forEach(function (id) { want[String(id)] = true; });
  const parts = {};
  imageRows_().forEach(function (r) {
    const id = String(r[0]);
    if (want[id]) (parts[id] = parts[id] || []).push(r);
  });
  const out = {};
  Object.keys(parts).forEach(function (id) {
    const rows = parts[id].sort(function (a, b) { return Number(a[1]) - Number(b[1]); });
    if (rows.length === Number(rows[0][2])) out[id] = rows.map(function (r) { return String(r[4]).slice(1); }).join('');
  });
  return out;
}

/** Drops pictures no kept backup uses (only ones older than a day, so uploads in progress stay). */
function pruneImages_() {
  const used = {};
  list_().forEach(function (b) {
    try {
      const ids = JSON.parse(get_(b.id)).imageIds;
      if (ids) ids.forEach(function (id) { used[id] = true; });
    } catch (err) {}
  });
  const sh = imageSheet_();
  const all = imageRows_();
  const old = Date.now() - 24 * 60 * 60 * 1000;
  const kept = all.filter(function (r) { return used[String(r[0])] || Number(r[3]) > old; });
  if (kept.length === all.length) return;
  sh.getRange(2, 1, all.length, 5).clearContent();
  if (kept.length) sh.getRange(2, 1, kept.length, 5).setNumberFormat('@').setValues(kept);
}

function prune_(sh) {
  const keep = {};
  list_().slice(0, KEEP).forEach(function (b) { keep[b.id] = true; });
  const all = rows_();
  const kept = all.filter(function (r) { return keep[String(r[0])]; });
  if (kept.length === all.length) return;
  sh.getRange(2, 1, all.length, 8).clearContent();
  if (kept.length) sh.getRange(2, 1, kept.length, 8).setNumberFormat('@').setValues(kept);
  if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IMG_TAB)) pruneImages_();
}

function writeInfo_(created, device, decks, cards, titles) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(INFO_TAB) || ss.insertSheet(INFO_TAB, 0);
  sh.clear();
  let link = '';
  try { link = ScriptApp.getService().getUrl() + '?key=' + KEY; } catch (err) {}
  const rows = [
    ['Quizzo backup', ''],
    ['Connection link', link],
    ['', 'Paste this link into Quizzo on another device (Backup > Google Sheet) to restore there.'],
    ['Last backup', new Date(created)],
    ['From', device],
    ['Decks', decks],
    ['Cards', cards],
    ['', ''],
    ['Decks in the last backup', ''],
  ];
  (Array.isArray(titles) ? titles : []).slice(0, 500).forEach(function (t) { rows.push(['', String(t)]); });
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.setColumnWidth(1, 190);
  sh.setColumnWidth(2, 520);
}
`;
