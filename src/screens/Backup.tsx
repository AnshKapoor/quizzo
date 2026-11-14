import { useEffect, useRef, useState } from 'react';
import type { Library } from '../types';
import {
  appsScript,
  backupPayload,
  CloudClient,
  type CloudError,
  type CloudBackupInfo,
  connectionLink,
  defaultDeviceName,
  fingerprint,
  librarySummary,
  mergeMissingDecks,
  setupKey as savedSetupKey,
  parseConnection,
  parseLibraryBackup,
  restoreInto,
} from '../lib/cloud';
import { downloadJson } from '../lib/storage';

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
  const [pending, setPending] = useState<Pending | null>(null);
  const [undo, setUndo] = useState<Library | null>(null);
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
      if (cloud) setBackups(await new CloudClient(cloud).list());
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
      askRestore(`the backup from ${when(b.created)} (${b.device})`, await new CloudClient(cloud!).get(b.id));
    });

  const applyRestore = (mode: 'replace' | 'merge') => {
    if (!pending) return;
    if (mode === 'replace') {
      setUndo(library);
      update((l) => restoreInto(l, pending.library));
      const s = librarySummary(pending.library);
      setMessage({ kind: 'ok', text: `Restored ${s.decks} deck(s), ${s.cards} card(s), progress, quizzes and appearance.` });
    } else {
      const { added } = mergeMissingDecks(library, pending.library);
      update((l) => mergeMissingDecks(l, pending.library).library);
      setMessage({ kind: 'ok', text: added ? `Added ${added} deck(s).` : 'You already have every deck in that backup.' });
    }
    if (pending.warnings.length) setMessage((m) => m && { ...m, text: `${m.text} ${pending.warnings.join(' ')}` });
    setPending(null);
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
          <span>Restore done.</span>
          <button
            type="button"
            onClick={() => {
              update((l) => ({ ...undo, cloud: l.cloud }));
              setUndo(null);
              setMessage({ kind: 'ok', text: 'Undone. Your previous decks are back.' });
            }}
          >
            Undo restore
          </button>
        </div>
      )}

      {pending && (
        <div className="backup-panel restore-choice" role="dialog" aria-label="Restore">
          <strong>Restore {pending.label}?</strong>
          <p className="sub">
            It has {librarySummary(pending.library).decks} deck(s) and {librarySummary(pending.library).cards} card(s).
          </p>
          <div className="row wrap">
            <button type="button" className="primary" onClick={() => applyRestore('replace')}>
              Replace everything here
            </button>
            <button type="button" onClick={() => applyRestore('merge')}>
              Only add decks I don't have
            </button>
            <button type="button" className="ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
          <small className="sub">"Replace" can be undone until you leave this screen.</small>
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
              onClick={() => downloadJson(`quizzo-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.parse(backupPayload(library)))}
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
