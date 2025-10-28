const { contextBridge } = require('electron');
const ffmpeg = require('fluent-ffmpeg');
const Store = require('electron-store');
const store = new Store();

contextBridge.exposeInMainWorld('mediaTools', {
  getDuration: (filePath) => {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err || !metadata || !metadata.format) return resolve(null);
        resolve(metadata.format.duration || null);
      });
    });
  },
  saveData: (key, value) => {
    store.set(key, value);
  },
  loadData: (key) => {
    return store.get(key);
  }
});
