// Empire XY – Desktop-Hülle: Fenster, Bausteine-Ordner mit Watcher, automatische Updates im Hintergrund
const {app,BrowserWindow,ipcMain,shell,Menu}=require('electron');
const path=require('path'),fs=require('fs');
const {autoUpdater}=require('electron-updater');

let win=null;
const modsDir=()=>path.join(app.getPath('userData'),'bausteine');
const send=(ch,data)=>{if(win&&!win.isDestroyed())win.webContents.send(ch,data)};

function createWindow(){
  win=new BrowserWindow({
    width:1400,height:900,minWidth:960,minHeight:600,backgroundColor:'#0e1316',title:'Empire XY',
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,sandbox:false},
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname,'app','index.html'));
  win.webContents.setWindowOpenHandler(({url})=>{shell.openExternal(url);return{action:'deny'}});
  win.webContents.on('before-input-event',(e,i)=>{if(i.type==='keyDown'&&i.key==='F11')win.setFullScreen(!win.isFullScreen())});
}

// ---- Bausteine (Mods): eigener Ordner + mitgelieferte Beispiele, Ordner wird überwacht
function ensureModsDir(){fs.mkdirSync(modsDir(),{recursive:true})}
function listMods(){
  ensureModsDir();
  return fs.readdirSync(modsDir()).filter(f=>f.endsWith('.js')).sort().map(f=>({file:f,code:fs.readFileSync(path.join(modsDir(),f),'utf8')}));
}
function watchMods(){
  ensureModsDir();let t=null;
  try{fs.watch(modsDir(),()=>{clearTimeout(t);t=setTimeout(()=>send('mods-changed'),400)})}catch(e){}
}
ipcMain.on('mods-list',e=>{e.returnValue=listMods()});
ipcMain.on('mods-save',(e,{name,code})=>{ensureModsDir();fs.writeFileSync(path.join(modsDir(),path.basename(name)),code);e.returnValue=true});
ipcMain.on('mods-open',()=>{ensureModsDir();shell.openPath(modsDir())});

// ---- automatische Updates aus den GitHub Releases (privates Repository)
function readToken(){
  for(const p of [path.join(process.resourcesPath||'','update-token.txt'),path.join(app.getPath('userData'),'update-token.txt')]){
    try{const t=fs.readFileSync(p,'utf8').trim();if(t)return t}catch(e){}
  }
  return null;
}
function setupUpdater(){
  if(!app.isPackaged)return;
  const token=readToken();
  if(!token){console.log('Kein Update-Schlüssel gefunden, Update-Watcher ist aus.');return}
  autoUpdater.setFeedURL({provider:'github',owner:'pfingsti',repo:'empire-xy',private:true,token});
  autoUpdater.autoDownload=true;
  autoUpdater.autoInstallOnAppQuit=true;
  autoUpdater.on('update-available',i=>send('update',{state:'available',version:i.version}));
  autoUpdater.on('download-progress',p=>send('update',{state:'progress',percent:p.percent}));
  autoUpdater.on('update-downloaded',i=>send('update',{state:'ready',version:i.version}));
  autoUpdater.on('error',e=>console.log('Update-Fehler:',e&&e.message));
  const check=()=>autoUpdater.checkForUpdates().catch(()=>{});
  setTimeout(check,5000);
  setInterval(check,30*60*1000); // alle 30 Minuten im Hintergrund nachsehen
}
ipcMain.on('update-install',()=>autoUpdater.quitAndInstall());

if(!app.requestSingleInstanceLock())app.quit();
else{
  app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus()}});
  app.whenReady().then(()=>{createWindow();watchMods();setupUpdater()});
  app.on('window-all-closed',()=>app.quit());
}
