const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const Store = require('electron-store').default;
const ffmpeg = require('fluent-ffmpeg');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
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

ipcMain.handle('mediaTools:select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled || !Array.isArray(filePaths) || !filePaths.length) {
    return null;
  }
  return filePaths[0];
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

ipcMain.handle('mediaTools:probe-media', async (_event, filePath) => {
  if (!filePath) {
    return null;
  }

  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data = {}) => {
      if (err) {
        resolve(null);
        return;
      }

      const streams = Array.isArray(data.streams) ? data.streams : [];
      const audioTracks = [];
      const subtitleTracks = [];

      streams.forEach((stream, idx) => {
        if (!stream || !stream.codec_type) {
          return;
        }

        const baseTrack = {
          id: typeof stream.index === 'number' ? stream.index : idx,
          codec: stream.codec_name || '',
          channels: stream.channels,
          channelLayout: stream.channel_layout || '',
          language: (stream.tags?.language || stream.tags?.LANGUAGE || '').toLowerCase(),
          title: stream.tags?.title || stream.tags?.handler_name || '',
          default: !!(stream.disposition && stream.disposition.default),
          forced: !!(stream.disposition && stream.disposition.forced)
        };

        if (stream.codec_type === 'audio') {
          audioTracks.push(baseTrack);
        } else if (stream.codec_type === 'subtitle') {
          subtitleTracks.push(baseTrack);
        }
      });

      const rawDuration = data?.format?.duration;
      const numericDuration = typeof rawDuration === 'number' ? rawDuration : Number(rawDuration);

      resolve({
        duration: Number.isFinite(numericDuration) ? numericDuration : null,
        audioTracks,
        subtitleTracks
      });
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

ipcMain.handle('mediaTools:read-directory', async (_event, dirPath) => {
  if (!dirPath || typeof dirPath !== 'string') {
    return [];
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => {
      const entryPath = path.join(dirPath, entry.name);
      return {
        name: entry.name,
        path: entryPath,
        isDirectory: entry.isDirectory()
      };
    });
  } catch (err) {
    console.warn('Failed to read directory', dirPath, err);
    return [];
  }
});

function fromFinderColonPath(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  const colonPattern = /^[^/\\]+:(?:[^/\\]+:)*[^/\\]+$/;
  if (!colonPattern.test(trimmed)) {
    return value;
  }
  const pieces = trimmed.split(':').filter(Boolean);
  if (!pieces.length) {
    return value;
  }
  if (pieces[0] === 'Volumes') {
    return path.posix.join('/', ...pieces);
  }
  if (pieces.length === 1) {
    return '/' + pieces[0];
  }
  return path.posix.join('/', ...pieces.slice(1));
}

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

    candidate = fromFinderColonPath(candidate) || candidate;

    if (candidate.startsWith('~')) {
      const remainder = candidate.slice(1).replace(/^\/+/, '');
      candidate = path.join(os.homedir(), remainder);
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
      return path.normalize(candidate);
    }
  }));

  return results;
});
