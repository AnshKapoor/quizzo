// Electron entry point. Loads the built web app (or the Vite dev server with --dev)
// and keeps the library as a plain JSON file in the user's app-data folder.
const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEV = process.argv.includes('--dev');
const libraryFile = () => path.join(app.getPath('userData'), 'library.json');

ipcMain.handle('library:path', () => libraryFile());

ipcMain.handle('library:read', async () => {
  try {
    return await fs.readFile(libraryFile(), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
});

ipcMain.handle('library:write', async (_event, json) => {
  if (typeof json !== 'string') throw new Error('library must be a JSON string');
  JSON.parse(json); // never write a broken file
  const file = libraryFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fs.writeFile(tmp, json, 'utf8');
  await fs.rename(tmp, file); // atomic replace
});

// Cloud backup requests go through here (no CORS in the main process). Only Google Apps Script
// web apps are allowed, so the page can't use this as a general-purpose proxy.
ipcMain.handle('http:request', async (_event, url, init) => {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.hostname !== 'script.google.com') throw new Error('Only Google Apps Script links are allowed');
  const method = init && init.method === 'POST' ? 'POST' : 'GET';
  const res = await net.fetch(u.toString(), {
    method,
    body: method === 'POST' ? String(init.body ?? '') : undefined,
    headers: method === 'POST' ? { 'Content-Type': 'text/plain;charset=utf-8' } : undefined,
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 380,
    title: 'Quizzo',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Links with target=_blank (help, Google) open in the normal browser, not a bare Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (DEV) win.loadURL('http://localhost:5173');
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
