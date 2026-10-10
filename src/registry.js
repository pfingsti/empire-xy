// Empire XY – Baustein-Registry.
// Jeder Baustein (Modul) ruft EmpireXY.register({...}) auf. Vor jedem Spielstart setzt
// build() aus allen aktivierten Bausteinen die Spielinhalte neu zusammen.
(function(){
'use strict';
const PREF_KEY='empire-xy.bausteine';
const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY))||{}}catch(e){return{}}};
const writePrefs=p=>{try{localStorage.setItem(PREF_KEY,JSON.stringify(p))}catch(e){}};
const copyDef=d=>{const c={...d};for(const k of ['cost','bonus','names'])if(d[k])c[k]=Array.isArray(d[k])?[...d[k]]:{...d[k]};return c};
const clear=o=>{for(const k of Object.keys(o))delete o[k]};

const XY={
  version:'1.0.0',
  modules:[],
  units:{},buildings:{},nodes:{},techs:{},epochs:[],
  resources:{list:[],label:{},color:{}},
  hooks:{},
  listeners:[],
  loadingSource:null,
  register(m){
    if(!m||typeof m.id!=='string')throw new Error('Ein Baustein braucht eine "id".');
    const prefs=readPrefs();
    m.source=m.source||XY.loadingSource||'eingebaut';
    m.enabled=m.core?true:(m.id in prefs?!!prefs[m.id]:(m.enabledByDefault!==undefined?!!m.enabledByDefault:m.source!=='beispiel'));
    const i=XY.modules.findIndex(x=>x.id===m.id);
    if(i>=0)XY.modules[i]=m;else XY.modules.push(m);
    XY.changed();
    return m;
  },
  setEnabled(id,on){
    const m=XY.modules.find(x=>x.id===id);if(!m||m.core)return;
    m.enabled=!!on;const p=readPrefs();p[id]=!!on;writePrefs(p);XY.changed();
  },
  changed(){for(const f of XY.listeners)try{f()}catch(e){}},
  // Spielinhalte aus allen aktivierten Bausteinen zusammensetzen (Reihenfolge: Kern zuerst, dann nach "order")
  build(){
    clear(XY.units);clear(XY.buildings);clear(XY.nodes);clear(XY.techs);XY.epochs.length=0;
    const R=XY.resources;R.list.length=0;clear(R.label);clear(R.color);
    XY.hooks={};
    const mods=XY.modules.filter(m=>m.enabled).sort((a,b)=>(b.core?1:0)-(a.core?1:0)||(a.order||0)-(b.order||0));
    for(const m of mods){
      try{
        if(m.resources)for(const k in m.resources){if(!R.list.includes(k))R.list.push(k);R.label[k]=m.resources[k].label;R.color[k]=m.resources[k].color}
        if(m.nodes)for(const k in m.nodes)XY.nodes[k]=copyDef(m.nodes[k]);
        if(m.epochs)for(const e of m.epochs)XY.epochs.push({...e,cost:e.cost?{...e.cost}:null});
        if(m.units)for(const k in m.units)XY.units[k]=copyDef(m.units[k]);
        if(m.buildings)for(const k in m.buildings)XY.buildings[k]=XY.buildings[k]&&!m.buildings[k].name?Object.assign(XY.buildings[k],copyDef(m.buildings[k])):copyDef(m.buildings[k]);
        if(m.techs)for(const k in m.techs)XY.techs[k]=copyDef(m.techs[k]);
        if(m.patch)m.patch(XY);
        if(m.hooks)for(const h in m.hooks)(XY.hooks[h]=XY.hooks[h]||[]).push(m.hooks[h]);
        m.error=null;
      }catch(e){m.error=e.message;console.warn('Baustein '+m.id+':',e)}
    }
  },
  emit(name,...args){for(const f of XY.hooks[name]||[])try{f(...args)}catch(e){console.warn(e)}},
  // Baustein-Quelltext ausführen (aus Datei, Mods-Ordner oder Browser-Speicher)
  loadSource(code,source){
    XY.loadingSource=source||'datei';
    try{new Function('EmpireXY',code)(XY);return null}
    catch(e){return e.message}
    finally{XY.loadingSource=null}
  },
};
window.EmpireXY=XY;
})();
