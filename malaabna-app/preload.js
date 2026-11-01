const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  register: (payload) => ipcRenderer.invoke('auth:register', payload),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getUser: () => ipcRenderer.invoke('auth:me'),
  hasUsers: () => ipcRenderer.invoke('auth:hasUsers'),
  adminCreateAccount: (payload) => ipcRenderer.invoke('auth:adminCreateAccount', payload),
  listUsers: () => ipcRenderer.invoke('auth:listUsers'),
  updatePermissions: (payload) => ipcRenderer.invoke('auth:updatePermissions', payload),
  deleteUser: (payload) => ipcRenderer.invoke('auth:deleteUser', payload),
  printPDF: (payload) => ipcRenderer.invoke('export:pdf', payload),
  getGeminiKey: () => ipcRenderer.invoke('secret:getGeminiKey'),
  setGeminiKey: (value) => ipcRenderer.invoke('secret:setGeminiKey', value),
  clearGeminiKey: () => ipcRenderer.invoke('secret:clearGeminiKey'),
  vaultEncrypt: (value) => ipcRenderer.invoke('vault:encrypt', value),
  vaultDecrypt: (value) => ipcRenderer.invoke('vault:decrypt', value),
});
