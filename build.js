// Baut aus src/ + mods/ eine einzelne HTML-Datei:
//   index.html             -> Artifact-Version (ohne <html>-Gerüst)
//   desktop/app/index.html -> Desktop-Version (vollständiges Dokument)
const fs=require('fs'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const shell=R('src/shell.html');
const core=fs.readdirSync(path.join(__dirname,'src/modules')).filter(f=>f.endsWith('.js')).sort().map(f=>`// --- ${f}\n`+R('src/modules/'+f));
const examples=fs.readdirSync(path.join(__dirname,'mods')).filter(f=>f.endsWith('.js')).sort()
  .map(f=>`// --- Beispiel-Baustein ${f}\nEmpireXY.loadSource(${JSON.stringify(R('mods/'+f)).replace(/<\/script/gi,'<\\/script')},'beispiel');`);
const body=shell+'<script>\n'+R('src/registry.js')+'\n'+core.join('\n')+'\n'+examples.join('\n')+'\n</script>\n<script>\n'+R('src/boot.js')+'\n</script>\n<script>\n'+R('src/engine.js')+'</script>\n';
fs.writeFileSync(path.join(__dirname,'index.html'),body);
const full='<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'+body+'</body>\n</html>\n';
fs.mkdirSync(path.join(__dirname,'desktop/app'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'desktop/app/index.html'),full);
console.log('gebaut:',Math.round(body.length/1024)+' KB,',core.length,'Kern-Bausteine,',examples.length,'Beispiel-Bausteine');
