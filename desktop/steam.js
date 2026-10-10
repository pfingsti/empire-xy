// Empire XY – Steam-Anbindung über steamworks.js: Errungenschaften, Steam Cloud, Overlay.
// Läuft nur in der Steam-Fassung (npm run dist:steam setzt "steamBuild" in package.json).
// Ohne laufenden Steam-Client oder in der normalen Fassung bleibt alles stumm, das Spiel läuft weiter.
const {app,ipcMain}=require('electron');
const pkg=require('./package.json');

const APP_ID=Number(process.env.EMPIRE_XY_STEAM_APPID||pkg.steamAppId||480); // 480 = Valves Testspiel "Spacewar"
const isSteamBuild=!!pkg.steamBuild||!!process.env.EMPIRE_XY_STEAM;
let sw=null,client=null;

function lib(){
  if(sw!==null)return sw;
  try{sw=require('steamworks.js')}catch(e){console.log('steamworks.js fehlt:',e.message);sw=false}
  return sw;
}

// Aus dem Explorer gestartet statt über Steam: Steam startet das Spiel neu (nur echte App-ID, nur gepackt)
function mustRestartThroughSteam(){
  if(!isSteamBuild||!app.isPackaged||APP_ID===480||!lib())return false;
  try{return sw.restartAppIfNecessary(APP_ID)}catch(e){return false}
}

function enableOverlay(){
  if(!isSteamBuild||!lib())return;
  try{sw.electronEnableSteamOverlay()}catch(e){console.log('Steam-Overlay:',e.message)}
}

// Cloud-Dateinamen: nur Spielstände und Errungenschaften, als JSON-Text
const cloudName=key=>key.replace(/[^a-z0-9.\-]/gi,'_')+'.json';

function start(){
  if(!isSteamBuild||!lib())return;
  try{client=sw.init(APP_ID);console.log('Steam verbunden, App',APP_ID)}
  catch(e){client=null;console.log('Steam nicht verfügbar:',e.message)}
}

const cloudOn=()=>{try{return client&&client.cloud.isEnabledForAccount()&&client.cloud.isEnabledForApp()}catch(e){return false}};

ipcMain.on('steam-info',e=>{e.returnValue={active:!!client,cloud:!!cloudOn(),appId:APP_ID}});

ipcMain.on('steam-achievement',(e,id)=>{
  if(!client)return;
  try{if(!client.achievement.isActivated(id))client.achievement.activate(id)}catch(err){console.log('Errungenschaft',id,err.message)}
});

// Beim Start: alle Cloud-Dateien an das Spiel geben, das Spiel übernimmt die neueren Stände
ipcMain.on('steam-cloud-pull',e=>{
  const out={};
  if(cloudOn()){
    try{for(const f of client.cloud.listFiles()){
      if(!f.name.endsWith('.json'))continue;
      try{out[f.name.slice(0,-5)]=client.cloud.readFile(f.name)}catch(err){}
    }}catch(err){console.log('Steam Cloud lesen:',err.message)}
  }
  e.returnValue=out;
});

function cloudPush(files){
  if(!cloudOn())return;
  for(const key in files){
    try{
      if(files[key]===null){if(client.cloud.fileExists(cloudName(key)))client.cloud.deleteFile(cloudName(key))}
      else client.cloud.writeFile(cloudName(key),files[key]);
    }catch(err){console.log('Steam Cloud schreiben:',err.message)}
  }
}
ipcMain.on('steam-cloud-push',(e,files)=>cloudPush(files));
ipcMain.on('steam-cloud-push-sync',(e,files)=>{cloudPush(files);e.returnValue=true}); // beim Schließen des Fensters

module.exports={isSteamBuild,APP_ID,start,enableOverlay,mustRestartThroughSteam};
