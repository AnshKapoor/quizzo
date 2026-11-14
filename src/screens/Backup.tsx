import { useEffect, useRef, useState } from 'react';
import type { Library } from '../types';
import {
  appsScript,
  SCRIPT_VERSION,
  backupPayload,
  stampedBackup,
  CloudClient,
  type CloudError,
  type CloudBackupInfo,
  connectionLink,
  defaultDeviceName,
  fingerprint,
  librarySummary,
  setupKey as savedSetupKey,
  parseConnection,
  parseLibraryBackup,
  restoreInto,
} from '../lib/cloud';
import { downloadJson } from '../lib/storage';
import { lastChange, mergeLibraries, newer, type Conflict, type Side } from '../lib/merge';

interface Props {
  library: Library;
  update: (fn: (l: Library) => Library) => void;
  /** Runs a cloud backup of the current library (shared with auto backup). */
  onBackupNow: () => Promise<CloudBackupInfo>;
  /** Last auto-backup problem, if any. */
  autoError: string | null;
  onHelp: () => void;
  onBack: () => void;
}

/** A backup waiting for the user to choose how to restore it. */
interface Pending {
  label: string;
  library: Library;
  warnings: string[];
}

const isAndroid = () => !!(window as any).Capacitor?.isNativePlatform?.();

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function Backup({ library, update, onBackupNow, autoError, onHelp, onBack }: Props) {
  const cloud = library.cloud?.url ? library.cloud : undefined;
  // Key shown in the setup script; saved once the user connects.
  const [setupKey] = useState(() => savedSetupKey(library.cloud?.key));
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string; testUrl?: string } | null>(null);
  const [backups, setBackups] = useState<CloudBackupInfo[] | null>(null);
  /** Version of the script in the connected Sheet (older ones store every picture in every backup). */
  const [scriptVersion, setScriptVersion] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [undo, setUndo] = useState<Library | null>(null);
  /** Conflicts found when merging the pending backup, with the side chosen for each. */
  const [conflicts, setConflicts] = useState<{ list: Conflict[]; choices: Record<string, Side> } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const summary = librarySummary(library);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ kind: 'error', text: (e as Error).message, testUrl: (e as CloudError).testUrl });
    } finally {
      setBusy(null);
    }
  };

  const refresh = () =>
    run('Loading backups…', async () => {
      if (!cloud) return;
      const client = new CloudClient(cloud);
      setBackups(await client.list());
      setScriptVersion(await client.scriptVersion());
    });

  useEffect(() => {
    if (cloud) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloud?.url, cloud?.key]);

  // Remember the key as soon as the script is copied or shown, so the pasted script still matches
  // if the user leaves this screen while setting up the Sheet.
  const keepSetupKey = () => update((l) => (l.cloud?.key ? l : { ...l, cloud: { url: '', key: setupKey } }));

  const flashCopied = async (what: string, text: string) => {
    if (await copy(text)) {
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } else setMessage({ kind: 'error', text: 'Could not copy. Select the text and copy it by hand.' });
  };

  const connect = () =>
    run('Connecting…', async () => {
      const conn = parseConnection(link, setupKey);
      if ('error' in conn) throw new Error(conn.error);
      const info = await new CloudClient(conn).ping();
      update((l) => ({
        ...l,
        cloud: { ...conn, auto: true, device: l.cloud?.device || defaultDeviceName() },
      }));
      setLink('');
      setMessage({
        kind: 'ok',
        text: info.backups
          ? `Connected. The Sheet has ${info.backups} backup(s); pick one below to restore it here.`
          : 'Connected. Press "Back up now" to make the first backup.',
      });
    });

  const backupNow = () =>
    run('Backing up…', async () => {
      const b = await onBackupNow();
      setBackups((list) => [b, ...(list ?? [])].slice(0, 20));
      setMessage({ kind: 'ok', text: `Backed up ${b.decks} deck(s), ${b.cards} card(s) at ${when(b.created)}.` });
    });

  const askRestore = (label: string, json: string) => {
    const { library: lib, errors } = parseLibraryBackup(json);
    if (!lib) {
      setMessage({ kind: 'error', text: errors.join(' ') });
      return;
    }
    setPending({ label, library: lib, warnings: errors });
  };

  const restoreCloud = (b: CloudBackupInfo) =>
    run('Downloading backup…', async () => {
      askRestore(`the backup from ${when(b.created)} (${b.device})`, await new CloudClient(cloud!).get(b.id, library.images));
    });

  const finish = (text: string) => {
    if (!pending) return;
    setMessage({ kind: 'ok', text: [text, ...pending.warnings].join(' ') });
    setPending(null);
    setConflicts(null);
  };

  const replaceAll = () => {
    if (!pending) return;
    setUndo(library);
    update((l) => restoreInto(l, pending.library));
    const s = librarySummary(pending.library);
    finish(`Restored ${s.decks} deck(s), ${s.cards} card(s), progress, quizzes and appearance.`);
  };

  /** Merges with the chosen sides; first time round, stops to ask when there are conflicts. */
  const mergeNow = (choices?: Record<string, Side>) => {
    if (!pending) return;
    const pick = (c: Conflict) => choices?.[c.id] ?? newer(c);
    const result = mergeLibraries(library, pending.library, pick);
    if (!choices && result.conflicts.length) {
      setConflicts({ list: result.conflicts, choices: Object.fromEntries(result.conflicts.map((c) => [c.id, newer(c)])) });
      return;
    }
    setUndo(library);
    update((l) => ({ ...mergeLibraries(l, pending.library, pick).library, cloud: l.cloud }));
    const parts = [
      result.added && `${result.added} card(s) added`,
      result.updated && `${result.updated} updated from the backup`,
      result.removed && `${result.removed} removed (deleted on the other device)`,
      result.conflicts.length && `${result.conflicts.length} conflict(s) settled as you chose`,
    ].filter(Boolean);
    finish(`Merged. ${parts.length ? parts.join(', ') + '.' : 'Nothing was different.'} Progress and quiz results from both sides are kept.`);
  };

  const disconnect = () => {
    if (!confirm('Disconnect this device from the Google Sheet? The backups stay in the Sheet.')) return;
    update((l) => ({ ...l, cloud: l.cloud && { url: '', key: l.cloud.key } }));
    setBackups(null);
    setMessage(null);
  };

  const setCloud = (change: Partial<NonNullable<Library['cloud']>>) =>
    update((l) => (l.cloud ? { ...l, cloud: { ...l.cloud, ...change } } : l));

  const unsaved = cloud && fingerprint(backupPayload(library)) !== cloud.lastHash;

  return (
    <div className="screen backup">
      <header className="bar">
        <button type="button" className="ghost" onClick={onBack}>
          ← Back
        </button>
        <strong>Backup &amp; restore</strong>
        <button type="button" className="ghost" onClick={onHelp}>
          ? Help
        </button>
      </header>

      <p className="sub">
        This device has {summary.decks} deck(s) with {summary.cards} card(s). A backup holds all of it: decks, quizzes,
        study progress, quiz results and appearance.
      </p>

      {busy && <div className="notice">{busy}</div>}
      {message && (
        <div className={`notice ${message.kind === 'error' ? 'bad' : 'good'}`}>
          {message.text}
          {message.testUrl && (
            <>
              {' '}
              <a href={message.testUrl} target="_blank" rel="noreferrer">
                Open test link
              </a>{' '}
              <small>
                (it should show <code>{'{"ok":true,…}'}</code>; a sign-in or error page there is what needs fixing in
                Apps Script).
              </small>
            </>
          )}
        </div>
      )}
      {undo && (
        <div className="notice row wrap">
          <span>Restore / merge done.</span>
          <button
            type="button"
            onClick={() => {
              update((l) => ({ ...undo, cloud: l.cloud }));
              setUndo(null);
              setMessage({ kind: 'ok', text: 'Undone. Everything is as it was before.' });
            }}
          >
            Undo restore
          </button>
        </div>
      )}

      {pending && !conflicts && (
        <div className="backup-panel restore-choice" role="dialog" aria-label="Restore">
          <strong>Restore {pending.label}?</strong>
          <p className="sub">
            It has {librarySummary(pending.library).decks} deck(s) and {librarySummary(pending.library).cards} card(s).
          </p>
          <ul className="stamp-list">
            <li>
              Backup made: <b>{pending.library.backedUpAt ? when(pending.library.backedUpAt) : 'unknown time (older backup)'}</b>
              {pending.library.backedUpFrom && <> on {pending.library.backedUpFrom}</>}
            </li>
            <li>
              Last change on this device: <b>{lastChange(library) ? when(lastChange(library)) : 'unknown'}</b>
            </li>
          </ul>
          <div className="row wrap">
            <button type="button" className="primary" onClick={() => mergeNow()}>
              Merge with this device
            </button>
            <button type="button" onClick={replaceAll}>
              Replace everything here
            </button>
            <button type="button" className="ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
          <small className="sub">
            Merge keeps cards from both sides; if a card was changed on both, you choose which version stays. Both can be
            undone until you leave this screen.
          </small>
        </div>
      )}

      {pending && conflicts && (
        <div className="backup-panel restore-choice" role="dialog" aria-label="Merge conflicts">
          <strong>
            {conflicts.list.length} card(s) differ between this device and the backup. Which version should stay?
          </strong>
          <p className="sub">The newer version is picked for each one. Change any you like, then press Merge.</p>
          <div className="row wrap">
            {(['newer', 'mine', 'theirs'] as const).map((all) => (
              <button
                key={all}
                type="button"
                className="ghost"
                onClick={() =>
                  setConflicts({
                    ...conflicts,
                    choices: Object.fromEntries(conflicts.list.map((c) => [c.id, all === 'newer' ? newer(c) : all])),
                  })
                }
              >
                {all === 'newer' ? 'All: newer' : all === 'mine' ? 'All: this device' : 'All: backup'}
              </button>
            ))}
          </div>
          <ul className="conflict-list">
            {conflicts.list.map((c) => {
              const pick = (side: Side) => setConflicts({ ...conflicts, choices: { ...conflicts.choices, [c.id]: side } });
              const option = (side: Side, text: string | undefined, time: number, gone: string) => (
                <label className={`conflict-side ${conflicts.choices[c.id] === side ? 'chosen' : ''}`}>
                  <input type="radio" name={c.id} checked={conflicts.choices[c.id] === side} onChange={() => pick(side)} />
                  <span>
                    <small className="sub">
                      {side === 'mine' ? 'This device' : 'Backup'} · {time ? when(time) : 'time unknown'}
                      {time && time === Math.max(c.mineAt, c.theirsAt) && c.mineAt !== c.theirsAt ? ' · newer' : ''}
                    </small>
                    <span className={text === undefined ? 'sub' : ''}>{text ?? gone}</span>
                  </span>
                </label>
              );
              return (
                <li key={c.id}>
                  <small className="badge">{c.deckTitle}</small>
                  {option(
                    'mine',
                    c.mine,
                    c.mineAt,
                    c.kind === 'deleted-here' ? 'Deleted here' : 'Not here',
                  )}
                  {option(
                    'theirs',
                    c.theirs,
                    c.theirsAt,
                    c.kind === 'deck-deleted-there' ? 'Whole deck deleted on the other device' : 'Deleted on the other device',
                  )}
                </li>
              );
            })}
          </ul>
          <div className="row wrap">
            <button type="button" className="primary" onClick={() => mergeNow(conflicts.choices)}>
              Merge
            </button>
            <button type="button" className="ghost" onClick={() => setConflicts(null)}>
              Back
            </button>
          </div>
        </div>
      )}

      <section className="backup-panel">
        <h2>☁ Google Sheet</h2>
        {cloud ? (
          <>
            <p className="sub">
              Connected.{' '}
              {cloud.lastBackupAt ? `Last backup from this device: ${when(cloud.lastBackupAt)}.` : 'No backup from this device yet.'}
              {unsaved && cloud.lastBackupAt ? ' There are changes since then.' : ''}
            </p>
            {autoError && cloud.auto && <div className="notice bad">Auto backup failed: {autoError}</div>}
            <div className="row wrap">
              <button type="button" className="primary" disabled={!!busy} onClick={backupNow}>
                Back up now
              </button>
              <button type="button" disabled={!!busy} onClick={refresh}>
                ↻ Refresh list
              </button>
            </div>
            <label className="check">
              <input type="checkbox" checked={!!cloud.auto} onChange={(e) => setCloud({ auto: e.target.checked })} />
              Back up automatically (about half a minute after changes, while Quizzo is open)
            </label>
            <label className="field">
              <span>This device's name</span>
              <input
                value={cloud.device ?? ''}
                placeholder={defaultDeviceName()}
                maxLength={60}
                onChange={(e) => setCloud({ device: e.target.value })}
              />
              <small>Shown next to backups made here.</small>
            </label>

            <h3>Backups in the Sheet</h3>
            {backups === null ? (
              <p className="sub">{busy ? 'Loading…' : 'Not loaded.'}</p>
            ) : backups.length === 0 ? (
              <p className="sub">None yet.</p>
            ) : (
              <ul className="card-list backup-list">
                {backups.map((b) => (
                  <li key={b.id}>
                    <span className="backup-meta">
                      <strong>{when(b.created)}</strong>
                      <small className="sub">
                        {b.device} · {b.decks} deck(s), {b.cards} card(s)
                      </small>
                    </span>
                    <button type="button" disabled={!!busy} onClick={() => restoreCloud(b)}>
                      Restore…
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <small className="sub">The Sheet keeps the 20 newest backups.</small>

            {scriptVersion !== null && scriptVersion < SCRIPT_VERSION && (
              <div className="notice">
                <strong>Update the script in your Sheet for much smaller backups.</strong> The script there is
                version {scriptVersion}; it stores every picture again in every backup. Version {SCRIPT_VERSION} stores
                each picture once and only uploads new ones. Backups keep working either way.
                <ol>
                  <li>
                    <button type="button" onClick={() => flashCopied('update', appsScript(cloud.key))}>
                      {copied === 'update' ? '✓ Copied' : 'Copy new script'}
                    </button>
                  </li>
                  <li>In the Sheet: Extensions → Apps Script. Select all the old code, paste the new script, 💾 Save.</li>
                  <li>
                    Deploy → Manage deployments → ✎ Edit → Version: <b>New version</b> → Deploy. The link stays the same.
                  </li>
                  <li>Come back here and press ↻ Refresh list.</li>
                </ol>
              </div>
            )}

            <h3>Use it on another device</h3>
            <p className="sub">
              Install Quizzo there, open Backup, and paste this connection link. Keep it private: anyone with the link can
              read and add backups. It is also in the "Quizzo" tab of your Sheet after the first backup.
            </p>
            <div className="row wrap link-row">
              <input readOnly value={connectionLink(cloud)} onFocus={(e) => e.target.select()} aria-label="Connection link" />
              <button type="button" onClick={() => flashCopied('link', connectionLink(cloud))}>
                {copied === 'link' ? '✓ Copied' : 'Copy link'}
              </button>
            </div>
            <div className="row">
              <span className="spacer" />
              <button type="button" className="ghost danger" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="sub">
              Keep backups in a Google Sheet of your own and restore them on any device (desktop or phone). Set it up once,
              in a browser on a computer; it takes about 3 minutes.
            </p>

            <div className="field">
              <span>Already set up on another device?</span>
              <small>Paste the connection link from there (or from the "Quizzo" tab of your Sheet).</small>
            </div>
            <div className="row wrap link-row">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://script.google.com/macros/s/…/exec?key=…"
                aria-label="Connection link or web app URL"
              />
              <button type="button" className="primary" disabled={!link.trim() || !!busy} onClick={connect}>
                Connect
              </button>
            </div>

            <details className="help-box setup-steps" open={!link}>
              <summary>First time: create the backup Sheet</summary>
              <ol>
                <li>
                  Open{' '}
                  <a href="https://sheets.new" target="_blank" rel="noreferrer">
                    sheets.new
                  </a>{' '}
                  to create a blank Google Sheet. Name it, e.g. "Quizzo backup".
                </li>
                <li>
                  In the Sheet: <b>Extensions → Apps Script</b>. Delete the code that is there and paste this script:
                  <div className="row wrap">
                    <button type="button" className="primary" onClick={() => {
                        keepSetupKey();
                        flashCopied('script', appsScript(setupKey));
                      }}>
                      {copied === 'script' ? '✓ Copied' : 'Copy script'}
                    </button>
                    <small className="sub">It contains a private key made for you.</small>
                  </div>
                  <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && keepSetupKey()}>
                    <summary className="sub">Show the script</summary>
                    <textarea className="script-box" readOnly rows={10} value={appsScript(setupKey)} />
                  </details>
                </li>
                <li>
                  Press 💾 Save, then <b>Deploy → New deployment</b>. Click ⚙ next to "Select type" and choose <b>Web app</b>.
                  Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, then <b>Deploy</b>.
                </li>
                <li>
                  Google asks you to authorize the script. Choose your account; if it says "Google hasn't verified this
                  app", click <b>Advanced → Go to … (unsafe)</b>. It is your own script and only touches this Sheet.
                </li>
                <li>
                  Copy the <b>Web app URL</b> (it ends in <code>/exec</code>), paste it in the box above, and press
                  Connect.
                </li>
              </ol>
            </details>
          </>
        )}
      </section>

      <section className="backup-panel">
        <h2>📄 Backup file</h2>
        <p className="sub">A single .json file with everything. Keep it anywhere, or move it to another device.</p>
        {isAndroid() && (
          <small className="sub">Saving files doesn't work on Android yet; use the Google Sheet to back up from your phone.</small>
        )}
        <div className="row wrap">
          {!isAndroid() && (
            <button
              type="button"
              onClick={() => downloadJson(`quizzo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.parse(stampedBackup(library, library.cloud?.device || defaultDeviceName())))}
            >
              ⤓ Save backup file
            </button>
          )}
          <button type="button" onClick={() => fileInput.current?.click()}>
            Restore from file…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) askRestore(`"${f.name}"`, await f.text());
            }}
          />
        </div>
      </section>
    </div>
  );
}
