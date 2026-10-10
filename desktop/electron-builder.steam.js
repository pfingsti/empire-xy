// Steam-Fassung: kein Installer, kein Update-Watcher, kein GitHub-Schlüssel. Steam installiert und aktualisiert selbst.
// Ergebnis: ../release/steam/win-unpacked  ->  von steam/upload.bat per SteamPipe hochgeladen
const base=require('./package.json').build;
module.exports={
  ...base,
  extraResources:[],
  extraMetadata:{steamBuild:true},
  directories:{output:'../release/steam'},
  win:{...base.win,target:[{target:'dir',arch:['x64']}]},
  // steam_api64.dll gehört neben die EXE, sonst findet der Steam-Client das Spiel nicht immer
  extraFiles:[{from:'node_modules/steamworks.js/dist/win64/steam_api64.dll',to:'steam_api64.dll'}],
  publish:null,
};
