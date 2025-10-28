const { contextBridge, ipcRenderer } = require('electron');

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
  getDuration(filePath) {
    return ipcRenderer.invoke('mediaTools:get-duration', filePath);
  },
  saveData(key, value) {
    return ipcRenderer.invoke('mediaTools:save-data', key, value);
  },
  loadData(key) {
    return ipcRenderer.invoke('mediaTools:load-data', key);
  }
});
