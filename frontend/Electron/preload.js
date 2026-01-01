const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: You can add IPC methods here if needed
  // invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  // on: (channel, func) => ipcRenderer.on(channel, func),
  // removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// For now, this is just a placeholder
