// Electron entry point. Loads the built web app (or the Vite dev server with --dev)
// and keeps the library as a plain JSON file in the user's app-data folder.
const { app, BrowserWindow, ipcMain } = require('electron');
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 380,
    title: 'Quizzo',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
