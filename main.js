const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const Store = require('electron-store');
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');

const settingsStore = new Store({ name: 'playlist-settings' });
ffmpeg.setFfprobePath(ffprobeStatic.path);

function createWindow () {
  const win = new BrowserWindow({
    width: 700,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
});

ipcMain.handle('mediaTools:select-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || !Array.isArray(filePaths)) {
    return [];
  }
  return filePaths;
});

ipcMain.handle('mediaTools:get-duration', async (_event, filePath) => {
  if (!filePath) {
    return null;
  }

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        resolve(null);
        return;
      }
      const rawDuration = data?.format?.duration;
      const numericDuration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);
      resolve(Number.isFinite(numericDuration) ? numericDuration : null);
    });
  });
});

ipcMain.handle('mediaTools:save-data', (_event, key, value) => {
  if (!key) {
    return false;
  }
  settingsStore.set(key, value);
  return true;
});

ipcMain.handle('mediaTools:load-data', (_event, key) => {
  if (!key) {
    return null;
  }
  return settingsStore.get(key, null);
});
