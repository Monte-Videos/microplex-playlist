const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

contextBridge.exposeInMainWorld('mediaTools', {
  async selectFiles() {
    try {
      const paths = await ipcRenderer.invoke('mediaTools:select-files');
      return Array.isArray(paths) ? paths : [];
    } catch (err) {
      console.warn('selectFiles failed', err);
      return [];
    }
  },
  async selectFolder() {
    try {
      return await ipcRenderer.invoke('mediaTools:select-folder');
    } catch (err) {
      console.warn('selectFolder failed', err);
      return null;
    }
  },
  getDuration(filePath) {
    return ipcRenderer.invoke('mediaTools:get-duration', filePath);
  },
  probeMedia(filePath) {
    return ipcRenderer.invoke('mediaTools:probe-media', filePath);
  },
  saveData(key, value) {
    return ipcRenderer.invoke('mediaTools:save-data', key, value);
  },
  loadData(key) {
    return ipcRenderer.invoke('mediaTools:load-data', key);
  },
  normalizePaths(values) {
    return ipcRenderer.invoke('mediaTools:normalize-paths', values);
  },
  readDirectory(dirPath) {
    return ipcRenderer.invoke('mediaTools:read-directory', dirPath);
  },
  basename(targetPath) {
    if (typeof targetPath !== 'string') {
      return '';
    }
    return path.basename(targetPath);
  },
  dirname(targetPath) {
    if (typeof targetPath !== 'string') {
      return '';
    }
    return path.dirname(targetPath);
  },
  toFileUrl(targetPath) {
    if (typeof targetPath !== 'string') {
      return '';
    }
    try {
      return pathToFileURL(targetPath).toString();
    } catch (err) {
      console.warn('toFileUrl failed', err);
      return '';
    }
  }
});
