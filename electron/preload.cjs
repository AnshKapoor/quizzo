const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('quizzoNative', {
  readLibrary: () => ipcRenderer.invoke('library:read'),
  writeLibrary: (json) => ipcRenderer.invoke('library:write', json),
  libraryPath: () => ipcRenderer.invoke('library:path'),
});
