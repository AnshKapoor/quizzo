import { describe, expect, it } from 'vitest';
import type { Deck, Library } from '../types';
import {
  appsScript,
  backupPayload,
  CloudClient,
  connectionLink,
  fingerprint,
  mergeMissingDecks,
  parseConnection,
  parseLibraryBackup,
  restoreInto,
} from './cloud';
import { emptyLibrary } from './storage';
import { DEFAULT_APPEARANCE } from './appearance';

// ---- a tiny fake of the Google Sheets / Apps Script services the script uses ----

class FakeSheet {
  cells: unknown[][] = [];
  getLastRow() {
    let last = 0;
    this.cells.forEach((r, i) => {
      if (r && r.some((v) => v !== '' && v !== undefined)) last = i + 1;
    });
    return last;
  }
  getRange(row: number, col: number, rows = 1, cols = 1) {
    const sheet = this;
    const range = {
      setValues(values: unknown[][]) {
        expect(values.length).toBe(rows);
        values.forEach((r, i) => {
          expect(r.length).toBe(cols);
          r.forEach((v, j) => {
            // A cell holds at most 50,000 characters.
            if (typeof v === 'string') expect(v.length).toBeLessThanOrEqual(50000);
            (sheet.cells[row - 1 + i] ??= [])[col - 1 + j] = v;
          });
        });
        return range;
      },
      getValues() {
        return Array.from({ length: rows }, (_, i) =>
          Array.from({ length: cols }, (_, j) => sheet.cells[row - 1 + i]?.[col - 1 + j] ?? ''),
        );
      },
      clearContent() {
        for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) if (sheet.cells[row - 1 + i]) sheet.cells[row - 1 + i][col - 1 + j] = '';
        return range;
      },
      setNumberFormat: () => range,
      setFontWeight: () => range,
      setFontSize: () => range,
    };
    return range;
  }
  setFrozenRows() {}
  setColumnWidth() {}
  clear() {
    this.cells = [];
  }
}

function fakeScript(key: string) {
  const sheets: Record<string, FakeSheet> = {};
  const ss = {
    getSheetByName: (n: string) => sheets[n] ?? null,
    insertSheet: (n: string) => (sheets[n] = new FakeSheet()),
  };
  const env = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ScriptApp: { getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ABC/exec' }) },
  };
  const app = new Function(...Object.keys(env), `${appsScript(key)}\nreturn { doGet, doPost };`)(
    ...Object.values(env),
  ) as { doGet(e: unknown): { text: string }; doPost(e: unknown): { text: string } };

  const http = async (url: string, init: { method: 'GET' | 'POST'; body?: string }) => {
    const parameter = Object.fromEntries(new URL(url).searchParams);
    const out = init.method === 'POST' ? app.doPost({ parameter, postData: { contents: init.body } }) : app.doGet({ parameter });
    return { status: 200, text: out.text };
  };
  return { sheets, http };
}

const deck = (id: string, cards = 1): Deck => ({
  id,
  title: `Deck ${id}`,
  language: { target: 'de', native: 'en' },
  cards: Array.from({ length: cards }, (_, i) => ({ id: `c${i}`, type: 'flashcard' as const, front: `Wort ${i} ${'x'.repeat(200)}`, back: `word ${i}` })),
});

const lib = (decks: Deck[]): Library => ({
  ...emptyLibrary(),
  decks,
  seeded: [],
  progress: { [`${decks[0]?.id}:c0`]: { reps: 1, lapses: 0, ease: 2.5, interval: 1, due: 5, last: 1 } },
  appearance: { ...DEFAULT_APPEARANCE, theme: 'dark' },
  cloud: { url: 'https://script.google.com/macros/s/ABC/exec', key: 'k1', auto: true },
});

describe('Google Sheet backup', () => {
  const conn = { url: 'https://script.google.com/macros/s/ABC/exec', key: 'k1' };

  it('backs up, lists and restores a large library across many cells', async () => {
    const { sheets, http } = fakeScript('k1');
    const client = new CloudClient(conn, http);
    expect(await client.ping()).toMatchObject({ backups: 0 });

    const big = lib([deck('a', 600), deck('b', 2)]);
    expect(backupPayload(big).length).toBeGreaterThan(100000);
    const info = await client.save(big, 'Test PC');
    expect(info).toMatchObject({ device: 'Test PC', decks: 2, cards: 602 });
    expect(sheets['Quizzo backups'].getLastRow()).toBeGreaterThan(3); // header + several chunks

    const list = await client.list();
    expect(list.map((b) => b.id)).toEqual([info.id]);
    const restored = parseLibraryBackup(await client.get(info.id));
    expect(restored.errors).toEqual([]);
    expect(restored.library!.decks).toHaveLength(2);
    expect(restored.library!.decks[0].cards).toHaveLength(600);
    expect(restored.library!.progress).toEqual(big.progress);
    expect(restored.library!.appearance).toEqual(big.appearance);
    // The device's own connection isn't part of the backup.
    expect(restored.library!.cloud).toBeUndefined();

    // Info tab carries the link for other devices.
    expect(JSON.stringify(sheets['Quizzo'].cells)).toContain('/exec?key=k1');
  });

  it('keeps only the newest 20 backups, newest first', async () => {
    const { http } = fakeScript('k1');
    const client = new CloudClient(conn, http);
    for (let i = 0; i < 23; i++) await client.save(lib([deck(`d${i}`)]), `PC ${i}`);
    const list = await client.list();
    expect(list).toHaveLength(20);
    const newest = parseLibraryBackup(await client.get(list[0].id)).library!;
    expect(newest.decks[0].id).toBe('d22');
  });

  it('rejects a wrong key and stores values Sheets could misread as text', async () => {
    const { http } = fakeScript('k1');
    await expect(new CloudClient({ ...conn, key: 'nope' }, http).list()).rejects.toThrow(/key does not match/);
    const tricky = lib([{ ...deck('a'), title: '=SUM(1,2)' }]);
    const client = new CloudClient(conn, http);
    const info = await client.save(tricky, 'PC');
    expect(parseLibraryBackup(await client.get(info.id)).library!.decks[0].title).toBe('=SUM(1,2)');
  });

  it('explains a login page instead of data', async () => {
    const client = new CloudClient(conn, async () => ({ status: 200, text: '<html>Sign in</html>' }));
    await expect(client.list()).rejects.toThrow(/Who has access: Anyone/);
  });
});

describe('connection links', () => {
  it('round-trips and validates', () => {
    const c = { url: 'https://script.google.com/macros/s/ABC/exec', key: 'abc123' };
    expect(parseConnection(connectionLink(c))).toEqual(c);
    expect(parseConnection(' https://script.google.com/macros/s/ABC/exec ', 'kk')).toEqual({ ...c, key: 'kk' });
    expect(parseConnection('https://docs.google.com/spreadsheets/d/x/edit')).toHaveProperty('error');
    expect(parseConnection('https://script.google.com/macros/s/ABC/dev?key=1')).toHaveProperty('error');
    expect(parseConnection('https://script.google.com/macros/s/ABC/exec')).toHaveProperty('error');
    expect(parseConnection('hello')).toHaveProperty('error');
  });
});

describe('restoring', () => {
  it('replaces everything but keeps this device connected and marks it as backed up', () => {
    const here = lib([deck('a')]);
    const backup = parseLibraryBackup(backupPayload(lib([deck('b')]))).library!;
    const next = restoreInto(here, backup);
    expect(next.decks.map((d) => d.id)).toEqual(['b']);
    expect(next.cloud?.url).toBe(here.cloud!.url);
    expect(next.cloud?.lastHash).toBe(fingerprint(backupPayload(next)));
  });

  it('can add only missing decks, with their progress', () => {
    const here = lib([deck('a')]);
    const other = lib([deck('a'), deck('b')]);
    other.progress['b:c0'] = { reps: 3, lapses: 0, ease: 2.5, interval: 4, due: 9, last: 2 };
    other.progress['a:c0'] = { reps: 9, lapses: 0, ease: 2.5, interval: 4, due: 9, last: 2 };
    const { library: next, added } = mergeMissingDecks(here, other);
    expect(added).toBe(1);
    expect(next.decks.map((d) => d.id)).toEqual(['a', 'b']);
    expect(next.progress['b:c0'].reps).toBe(3);
    expect(next.progress['a:c0'].reps).toBe(1); // own progress untouched
  });

  it('points deck files to Import and skips broken decks', () => {
    expect(parseLibraryBackup(JSON.stringify({ format: 'quizzo-deck', version: 1, deck: deck('a') })).errors[0]).toMatch(/Import/);
    const r = parseLibraryBackup(JSON.stringify({ ...lib([deck('a')]), decks: [deck('a'), { title: 5 }] }));
    expect(r.library!.decks).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});
