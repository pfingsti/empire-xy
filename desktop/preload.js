// Brücke zwischen Spiel und Desktop: Bausteine-Ordner, Update-Meldungen, Steam (Errungenschaften und Cloud)
const {contextBridge,ipcRenderer}=require('electron');

// ---- Steam Cloud: Spielstände und Errungenschaften liegen im localStorage des Spiels.
// Vor dem Laden des Spiels werden neuere Cloud-Stände übernommen, danach wird jede Änderung hochgeladen.
const CLOUD_KEYS=['empire-xy.spielstand','empire-xy.spielstand.platz1','empire-xy.spielstand.platz2','empire-xy.spielstand.platz3','empire-xy.erfolge'];
const steam=ipcRenderer.sendSync('steam-info')||{};
const savedAt=t=>{try{return JSON.parse(t).saved||0}catch(e){return 0}};
const readLS=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
function mergeCloud(){
  const cloud=ipcRenderer.sendSync('steam-cloud-pull')||{};
  for(const k of CLOUD_KEYS){
    const c=cloud[k];if(typeof c!=='string')continue;
    const l=readLS(k);
    try{
      if(k==='empire-xy.erfolge')localStorage.setItem(k,JSON.stringify({...JSON.parse(c||'{}'),...JSON.parse(l||'{}')}));
      else if(l===null||savedAt(c)>savedAt(l))localStorage.setItem(k,c);
    }catch(e){}
  }
}
const last={};
function pushChanged(sync){
  const out={};let any=false;
  for(const k of CLOUD_KEYS){const v=readLS(k);if(v!==last[k]){last[k]=v;out[k]=v;any=true}}
  if(any)sync?ipcRenderer.sendSync('steam-cloud-push-sync',out):ipcRenderer.send('steam-cloud-push',out);
}
if(steam.cloud){
  mergeCloud();
  for(const k of CLOUD_KEYS)last[k]=readLS(k);
  setInterval(()=>pushChanged(false),10000); // Autosave läuft alle 30 s, 10 s reichen zum Nachziehen
  window.addEventListener('beforeunload',()=>pushChanged(true));
}

contextBridge.exposeInMainWorld('desktop',{
  listMods:()=>ipcRenderer.sendSync('mods-list'),
  saveMod:(name,code)=>ipcRenderer.sendSync('mods-save',{name,code}),
  openModsFolder:()=>ipcRenderer.send('mods-open'),
  onModsChanged:cb=>ipcRenderer.on('mods-changed',()=>cb()),
  onUpdate:cb=>ipcRenderer.on('update',(e,d)=>cb(d)),
  installUpdate:()=>ipcRenderer.send('update-install'),
  steam:{active:!!steam.active,cloud:!!steam.cloud},
  steamAchievement:id=>ipcRenderer.send('steam-achievement',String(id)),
});
