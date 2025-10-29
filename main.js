const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const Store = require('electron-store').default;
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs/promises');
const path = require('path');
const { fileURLToPath } = require('url');

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

ipcMain.handle('mediaTools:normalize-paths', async (_event, rawValues) => {
  if (!Array.isArray(rawValues)) {
    return [];
  }

  const results = await Promise.all(rawValues.map(async (raw) => {
    if (typeof raw !== 'string') {
      return null;
    }

    let candidate = raw.trim();
    if (!candidate) {
      return null;
    }

    if (candidate.startsWith('file://')) {
      try {
        candidate = fileURLToPath(candidate);
      } catch (err) {
        console.warn('Failed to convert file url to path', candidate, err);
      }
    }

    if (!path.isAbsolute(candidate)) {
      return null;
    }

    try {
      return await fs.realpath(candidate);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') {
        console.warn('Failed to resolve real path', candidate, err);
      }
      return candidate;
    }
  }));

  return results;
});
