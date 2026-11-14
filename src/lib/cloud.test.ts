import { describe, expect, it } from 'vitest';
import type { Deck, Library } from '../types';
import {
  appsScript,
  backupPayload,
  CloudClient,
  connectionLink,
  fingerprint,
  parseConnection,
  parseLibraryBackup,
  restoreInto,
  stampedBackup,
  CloudError,
  setupKey,
  WebPageError,
} from './cloud';
import { emptyLibrary } from './storage';
import { inlineDeckImages, normalizeImages } from './image';
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

  it('stamps backups with time and device, without changing the auto-backup fingerprint', () => {
    const l = lib([deck('a')]);
    const backup = parseLibraryBackup(stampedBackup(l, 'Phone', 1234)).library!;
    expect(backup.backedUpAt).toBe(1234);
    expect(backup.backedUpFrom).toBe('Phone');
    expect(backupPayload(backup)).toBe(backupPayload(l));
    expect(restoreInto(l, backup)).not.toHaveProperty('backedUpAt');
  });

  it('points deck files to Import and skips broken decks', () => {
    expect(parseLibraryBackup(JSON.stringify({ format: 'quizzo-deck', version: 1, deck: deck('a') })).errors[0]).toMatch(/Import/);
    const r = parseLibraryBackup(JSON.stringify({ ...lib([deck('a')]), decks: [deck('a'), { title: 5 }] }));
    expect(r.library!.decks).toHaveLength(1);
    expect(r.errors).toHaveLength(1);
  });
});

describe('connect problems', () => {
  const conn = { url: 'https://script.google.com/macros/s/ABC/exec', key: 'k1' };

  it('accepts school / work (Workspace) links and trailing slashes', () => {
    expect(parseConnection('https://script.google.com/a/macros/uni.de/s/ABC/exec?key=k1')).toEqual({
      url: 'https://script.google.com/a/macros/uni.de/s/ABC/exec',
      key: 'k1',
    });
    expect(parseConnection('https://script.google.com/macros/s/ABC/exec/?key=k1')).toEqual(conn);
    expect(parseConnection('https://script.google.com/home/projects/ABC/edit?key=k1')).toHaveProperty('error');
  });

  it('explains a Google page (blocked by the browser) instead of saying it could not reach the Sheet', async () => {
    const client = new CloudClient(conn, async () => {
      throw new WebPageError('page');
    });
    const err = (await client.ping().catch((e) => e)) as CloudError;
    expect(err.message).toMatch(/web page/);
    expect(err.message).toMatch(/Who has access: Anyone/);
    expect(err.testUrl).toBe('https://script.google.com/macros/s/ABC/exec?action=ping&key=k1');
  });

  it('a real network failure still says so', async () => {
    const client = new CloudClient(conn, async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await client.ping().catch((e) => e)).message).toMatch(/Could not reach Google \(Failed to fetch\)/);
  });

  it('keeps the setup key of a connected device', () => {
    expect(setupKey('abc')).toBe('abc');
  });
});

describe('pictures in backups', () => {
  const conn = { url: 'https://script.google.com/macros/s/ABC/exec', key: 'k1' };
  const pic = (n: number) => 'data:image/webp;base64,' + 'A'.repeat(60000 + n); // larger than one cell
  const withPics = (): Library =>
    normalizeImages({
      ...emptyLibrary(),
      decks: [
        {
          id: 'd',
          title: 'D',
          language: { target: 'de', native: 'en' },
          cards: [
            { id: 'c1', type: 'flashcard', front: 'a', back: 'b', image: pic(1), hintImage: pic(2) },
            { id: 'c2', type: 'flashcard', front: 'c', back: 'd', image: pic(1) }, // same picture again
          ],
        },
      ],
    });
  const counting = (http: ReturnType<typeof fakeScript>['http']) => {
    const calls: string[] = [];
    const wrapped: typeof http = async (url, init) => {
      calls.push(new URL(url).searchParams.get('action')!);
      return http(url, init);
    };
    return { calls, http: wrapped };
  };

  it('stores each picture once in the library, with references on the cards', () => {
    const l = withPics();
    expect(Object.keys(l.images!)).toHaveLength(2);
    expect(l.decks[0].cards[0].image).toMatch(/^img:/);
    expect(l.decks[0].cards[1].image).toBe(l.decks[0].cards[0].image);
    expect(normalizeImages(l)).toBe(l); // nothing to do
    // Exported deck files carry the pictures inline again.
    expect(inlineDeckImages(l.decks[0], l.images).cards[0].image).toBe(pic(1));
    // Removing the only card using a picture drops the picture.
    const fewer = normalizeImages({ ...l, decks: [{ ...l.decks[0], cards: [l.decks[0].cards[1]] }] });
    expect(Object.keys(fewer.images!)).toHaveLength(1);
  });

  it('uploads pictures once (script v2) and restores them, skipping ones the device has', async () => {
    const { sheets, http } = fakeScript('k1');
    const c = counting(http);
    const client = new CloudClient(conn, c.http);
    const l = withPics();
    const first = await client.save(l, 'PC');
    expect(sheets['Quizzo images'].getLastRow()).toBeGreaterThan(2); // header + chunks of 2 pictures
    const rowsAfterFirst = sheets['Quizzo images'].getLastRow();
    const backupText = JSON.parse(JSON.parse((await http(`${conn.url}?action=get&id=${first.id}&key=k1`, { method: 'GET' })).text).data);
    expect(backupText.imageIds).toHaveLength(2);
    expect(backupText.images).toBeUndefined(); // the backup itself is small

    // A second backup with an edit: no picture uploaded again.
    c.calls.length = 0;
    await client.save({ ...l, decks: [{ ...l.decks[0], title: 'D2' }] }, 'PC');
    expect(c.calls).not.toContain('putImages');
    expect(sheets['Quizzo images'].getLastRow()).toBe(rowsAfterFirst);

    // Restore on a new device: pictures come back, cards point at them.
    const restored = parseLibraryBackup(await client.get(first.id)).library!;
    expect(restored.images).toEqual(l.images);
    expect(restored.decks[0].cards[0].image).toBe(l.decks[0].cards[0].image);

    // Restore on a device that has the pictures: none downloaded.
    c.calls.length = 0;
    await client.get(first.id, l.images);
    expect(c.calls).not.toContain('getImages');
  });

  it('keeps pictures inside the backup for Sheets still on script version 1', async () => {
    const { http } = fakeScript('k1');
    const v1: typeof http = async (url, init) => {
      if (new URL(url).searchParams.get('action') === 'ping') return { status: 200, text: '{"ok":true,"version":1,"backups":0}' };
      return http(url, init);
    };
    const client = new CloudClient(conn, v1);
    const l = withPics();
    const info = await client.save(l, 'PC');
    const restored = parseLibraryBackup(await client.get(info.id)).library!;
    expect(restored.images).toEqual(l.images);
  });

  it('turns pictures in older backups (inside the cards) into stored pictures', () => {
    const old = { ...emptyLibrary(), decks: [{ ...withPics().decks[0], cards: [{ id: 'c1', type: 'flashcard', front: 'a', back: 'b', image: pic(1) }] }] };
    const r = parseLibraryBackup(JSON.stringify(old)).library!;
    expect(r.decks[0].cards[0].image).toMatch(/^img:/);
    expect(Object.values(r.images!)).toEqual([pic(1)]);
  });
});
