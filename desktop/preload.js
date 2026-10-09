// Brücke zwischen Spiel und Desktop: Bausteine-Ordner und Update-Meldungen
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktop',{
  listMods:()=>ipcRenderer.sendSync('mods-list'),
  saveMod:(name,code)=>ipcRenderer.sendSync('mods-save',{name,code}),
  openModsFolder:()=>ipcRenderer.send('mods-open'),
  onModsChanged:cb=>ipcRenderer.on('mods-changed',()=>cb()),
  onUpdate:cb=>ipcRenderer.on('update',(e,d)=>cb(d)),
  installUpdate:()=>ipcRenderer.send('update-install'),
});
