// Empire XY – Baustein-Verwaltung im Hauptmenü, Laden eigener Bausteine, Desktop-Anbindung (Updates, Mods-Ordner)
(function(){
'use strict';
const XY=window.EmpireXY,desk=window.desktop||null;
const $=s=>document.querySelector(s);
const STORE='empire-xy.dateien';
const SRC_LABEL={eingebaut:'Kern',beispiel:'Beispiel',datei:'Eigener Baustein',ordner:'Bausteine-Ordner'};
const readStore=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{}}catch(e){return{}}};
const writeStore=o=>{try{localStorage.setItem(STORE,JSON.stringify(o))}catch(e){}};
const loadErrors={};

function loadUserMods(){
  if(desk){for(const m of desk.listMods()){const err=XY.loadSource(m.code,'ordner');if(err)loadErrors[m.file]=err;else delete loadErrors[m.file]}}
  else{const st=readStore();for(const f in st){const err=XY.loadSource(st[f],'datei');if(err)loadErrors[f]=err}}
}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function render(){
  const ul=$('#modList');if(!ul)return;
  const mods=[...XY.modules].sort((a,b)=>(b.core?1:0)-(a.core?1:0));
  ul.innerHTML=mods.map(m=>`<li><input type="checkbox" id="mod-${esc(m.id)}" data-id="${esc(m.id)}" ${m.enabled?'checked':''} ${m.core?'disabled':''}>
    <label class="mn" for="mod-${esc(m.id)}">${esc(m.name||m.id)} <span class="ms">${esc(m.version||'')}</span></label><span class="ms">${esc(SRC_LABEL[m.source]||m.source)}</span>
    ${m.description?`<span class="md">${esc(m.description)}</span>`:''}${m.error?`<span class="err">Fehler: ${esc(m.error)}</span>`:''}</li>`).join('')+
    Object.keys(loadErrors).map(f=>`<li><span></span><span class="mn">${esc(f)}</span><span class="ms">nicht geladen</span><span class="err">${esc(loadErrors[f])}</span></li>`).join('');
  ul.querySelectorAll('input[data-id]').forEach(i=>i.onchange=()=>XY.setEnabled(i.dataset.id,i.checked));
}
XY.listeners.push(render);

$('#modFile').addEventListener('change',async e=>{
  for(const f of e.target.files){
    const code=await f.text();
    const err=XY.loadSource(code,desk?'ordner':'datei');
    if(err){loadErrors[f.name]=err;continue}
    delete loadErrors[f.name];
    if(desk)desk.saveMod(f.name,code);else{const st=readStore();st[f.name]=code;writeStore(st)}
  }
  e.target.value='';render();
});

if(desk){
  const fb=$('#modFolder');fb.hidden=false;fb.onclick=()=>desk.openModsFolder();
  desk.onModsChanged(()=>{loadUserMods();render()});
  const box=$('#updBox'),txt=$('#updText'),btn=$('#updBtn');
  desk.onUpdate(u=>{
    box.hidden=false;btn.hidden=true;
    if(u.state==='available')txt.textContent='Update '+u.version+' gefunden';
    else if(u.state==='progress')txt.textContent='Update wird geladen: '+Math.round(u.percent)+' %';
    else if(u.state==='ready'){txt.textContent='Version '+u.version+' ist bereit.';btn.hidden=false}
    else box.hidden=true;
  });
  btn.onclick=()=>desk.installUpdate();
}
loadUserMods();
render();
})();
