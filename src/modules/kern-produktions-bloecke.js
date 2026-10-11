// Kern-Baustein: Produktions-Blöcke (Christian 2026-10-11: „max 20 Sammler, dann Epochenforschung, dann wieder max 20 Sammler, für alle Gebäude“;
// 13:11 präzisiert: „wenn mehrfach auf Sammler ausbilden geklickt wird, sollen sich die auszubildenden Einheiten im Gebäudefenster anzeigen“).
// Warteschlange wie in AoE2/EE2: Jeder Klick auf eine Einheit, die Epoche oder eine Forschung reiht sie hinten an, bezahlt wird sofort.
// Im Gebäudefenster stehen die Aufträge als Kacheln mit Bild; gleiche Einheiten hintereinander bilden einen Block mit Zähler (höchstens 20 je Block):
//   [Sammlerin ×20] [Kupferzeit] [Sammlerin ×20]
// Klick auf eine Kachel bricht einen Auftrag des Blocks ab, Shift + Klick den ganzen Block (Rohstoffe kommen zurück). Shift + Klick auf eine Einheit reiht 5 ein.
// Die Engine-Warteschlange (höchstens 6) bleibt kurz: Der Baustein hält die Aufträge in b.pbq und schiebt sie der Reihe nach nach.
// b.pbq=[{k:'u'|'ep'|'tech',u,tech,cost}] liegt am Gebäude und wird mitgespeichert. Änderungen über api.command (Mehrspieler-sicher).
(function(){
const ID='kern-produktions-bloecke';
const BLOCK=20,MAXQ=60,AHEAD=2,QMAX=6;
const SLOTKEYS=['Q','W','E','R','T','A','S','D','F','G','Y','X','C','V','B','U','I','O','M','J','K','L'];
let A=null,obs=null,timer=0;
const icons={};   // 'u:worker|Epoche' → Bild (dataURL) aus dem Befehlsfeld
const U=()=>EmpireXY.units,TE=()=>EmpireXY.techs,EP=()=>EmpireXY.epochs;
const afford=(pl,c)=>{for(const k in c)if((pl.res[k]||0)<c[k])return false;return true};
const pay=(pl,c)=>{for(const k in c)pl.res[k]-=c[k]};
const refund=(pl,c)=>{for(const k in c)pl.res[k]=(pl.res[k]||0)+c[k]};
const uName=(u,ep)=>{const d=U()[u];return d?(d.names&&(d.names[ep]||d.names[d.names.length-1]))||d.name||d.label||u:u};
const countOf=(a,p,type)=>{let n=0;for(const e of a.units)if(!e.dead&&e.owner===p&&e.type===type)n++;
  for(const e of a.blds)if(e.owner===p&&!e.dead){for(const q of e.queue)if(q.u===type)n++;if(e.pbq)for(const q of e.pbq)if(q.u===type)n++}return n};
const techQueued=(a,p,id)=>a.blds.some(e=>e.owner===p&&!e.dead&&e.pbq&&e.pbq.some(q=>q.tech===id));

// ---------- Befehle (laufen im Mehrspieler auf allen Rechnern gleich) ----------
function exec(a,p,c){const b=a.byId(c.b);if(!b||b.dead||b.kind!=='bld'||b.owner!==p||!b.built)return;
  const pl=a.players[p],Q=b.pbq||(b.pbq=[]),me=p===a.local;
  if(c.op==='add'){let n=0;
    for(let i=0;i<(c.n|0||1);i++){
      if(Q.length>=MAXQ){if(me&&!n)a.toast('Warteschlange voll (höchstens '+MAXQ+' Aufträge).','warn');break}
      let it=null;
      if(c.k==='u'){const d=U()[c.v];if(!d||d.from!==b.type||(d.minEpoch||0)>pl.epoch)break;if(d.max&&countOf(a,p,c.v)>=d.max){if(me&&!n)a.toast('Höchstens '+d.max+' gleichzeitig.','warn');break}
        it={k:'u',u:c.v,cost:a.uCost(p,c.v)}}
      else if(c.k==='ep'){const E=EP()[pl.epoch+1];if(b.type!=='tc'||!E||pl.advancing||pl.epoch+1>(c.max==null?99:c.max))break;it={k:'ep',cost:{...(E.cost||{})}}}
      else if(c.k==='tech'){const t=TE()[c.v];if(!t||t.at!==b.type||a.techState(p,c.v)!=='open')break;if(techQueued(a,p,c.v)){if(me)a.toast('Wird bereits erforscht.','warn');break}it={k:'tech',tech:c.v,cost:{...(t.cost||{})}}}
      if(!it)break;
      if(!afford(pl,it.cost)){if(me&&!n)a.toast('Nicht genug Rohstoffe.','warn');break}
      pay(pl,it.cost);if(it.k==='ep')pl.advancing=true;Q.push(it);n++}
    if(n)feed(a,b)}
  else if(c.op==='del'){// Aufträge [i0,i1) aus dem eigenen Vorrat zurücknehmen, von hinten
    const i0=Math.max(0,c.i|0),i1=Math.min(Q.length,c.j==null?i0+1:c.j|0);
    for(let i=i1-1;i>=i0;i--){const it=Q[i];Q.splice(i,1);refund(pl,it.cost);if(it.k==='ep')pl.advancing=false}}
  if(!Q.length)delete b.pbq}
// Vorrat der Reihe nach in die Engine-Warteschlange schieben (Einheiten höchstens 2 im Voraus, damit die Reihenfolge stimmt)
function feed(a,b){const Q=b.pbq;if(!Q||!Q.length)return;const pl=a.players[b.owner];
  for(let g=0;g<4&&Q.length&&b.queue.length<QMAX;g++){const it=Q[0];
    if(it.k==='u'){if(b.queue.filter(q=>q.u).length>=AHEAD)break;const d=U()[it.u];Q.shift();if(!d){refund(pl,it.cost);continue}
      b.queue.push({u:it.u,t:0,total:d.time,cost:it.cost})}
    else if(it.k==='ep'){const E=EP()[pl.epoch+1];Q.shift();if(!E){refund(pl,it.cost);pl.advancing=false;continue}
      b.queue.push({ep:true,t:0,total:E.time||60,cost:it.cost})}
    else{const t=TE()[it.tech];Q.shift();if(!t||pl.techs[it.tech]){refund(pl,it.cost);continue}
      const tot=t.time||30,t0=Math.min(tot*.99,(pl.techProg&&pl.techProg[it.tech])||0);if(pl.techProg)delete pl.techProg[it.tech];
      b.queue.push({tech:it.tech,t:t0,total:tot,cost:it.cost})}}
  if(!Q.length)delete b.pbq}

// ---------- Bedienung: Klicks und Tasten im Befehlsfeld abfangen ----------
function cur(){if(!A)return null;let s;try{s=A.sel()}catch(e){return null}if(!s||s.length!==1)return null;const b=s[0];
  return b&&b.kind==='bld'&&!b.dead&&b.built&&b.owner===A.local?b:null}
function cmdAt(i){const m=window.__mech;let c=null;try{c=m&&m.getCommands?m.getCommands()[i]:null}catch(e){}return c&&c.key?c:null}
function actOf(b,c){const k=String(c.key);
  if(k.startsWith('u:'))return{k:'u',v:k.slice(2)};
  if(k==='ep'&&b.type==='tc')return{k:'ep'};
  if(k.startsWith('t:'))return{k:'tech',v:k.slice(2)};return null}
function maxEp(){const s=document.getElementById('epEndSel');return s&&s.value!==''?+s.value:99}
function handle(i,ev,shift){const b=cur();if(!b)return false;const c=cmdAt(i);if(!c||c.ui)return false;const x=actOf(b,c);if(!x)return false;
  if(c.dis&&c.need)return false;   // gesperrt (Epoche, Höchstzahl …): Hinweis der Engine zeigen
  ev.preventDefault();ev.stopImmediatePropagation();
  A.command({m:ID,op:'add',b:b.id,k:x.k,v:x.v,n:x.k==='u'&&shift?5:1,max:maxEp()});setTimeout(render,0);return true}
function onClick(ev){const btn=ev.target.closest&&ev.target.closest('#cmds .cmd');if(!btn)return;const i=[...btn.parentNode.children].indexOf(btn);
  try{if(handle(i,ev,ev.shiftKey))grabIcon(btn,i)}catch(e){console.warn(e)}}
function onKey(ev){if(!cur())return;const tg=ev.target;if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT'||tg.isContentEditable))return;
  if(ev.ctrlKey||ev.altKey||ev.metaKey)return;const k=ev.key;if((k==='q'||k==='e')&&!ev.shiftKey)return;   // Q/E drehen die Kamera
  const i=SLOTKEYS.indexOf(String(k).toUpperCase());if(i<0)return;try{handle(i,ev,false)}catch(e){console.warn(e)}}
function grabIcon(btn,i){const c=cmdAt(i),cv=btn.querySelector('canvas.ci');if(!c||!cv)return;try{icons[c.key]=cv.toDataURL()}catch(e){}}
function grabAll(){const box=document.getElementById('cmds');if(!box)return;[...box.children].forEach((b,i)=>{const c=cmdAt(i);if(c&&!icons[c.key]&&b.querySelector('canvas.ci'))grabIcon(b,i)})}

// ---------- Anzeige im Gebäudefenster ----------
const css=`#info.pbqOn .queue{display:none}
.pbq{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end;margin-top:4px}
.pbq .pbt{position:relative;width:46px;height:46px;padding:0;border:1px solid #120c06;border-radius:2px;cursor:pointer;overflow:hidden;
  background:linear-gradient(#4b3a26,#2e2215);box-shadow:inset 0 1px 0 rgba(235,195,120,.25);color:#ecdcb6;font-size:10px;line-height:1.05;display:grid;place-items:center}
.pbq .pbt:hover{border-color:#e3bd73}.pbq .pbt.run{box-shadow:0 0 0 1px #e3bd73 inset}.pbq .pbt.ep{background:linear-gradient(#6a5223,#3b2c12)}.pbq .pbt.tq{background:linear-gradient(#34424d,#1d262d)}
.pbq .pbt img{width:40px;height:40px;pointer-events:none}.pbq .pbt span{padding:0 2px;text-align:center;pointer-events:none}
.pbq .pbt b{position:absolute;right:1px;bottom:3px;min-width:14px;padding:0 2px;font-size:11px;font-weight:700;color:#1d1306;background:linear-gradient(#f0cf86,#a77a3c);border-radius:2px;pointer-events:none}
.pbq .pbt i{position:absolute;left:0;bottom:0;height:3px;background:#e3bd73;pointer-events:none}
.pbq .pbh{font-size:11px;color:#e0a85a;align-self:center}`;
function ensureCss(){if(document.getElementById('pbqCss'))return;const s=document.createElement('style');s.id='pbqCss';s.textContent=css;document.head.appendChild(s)}
// Engine-Warteschlange und eigener Vorrat als eine Liste, gleiche Einheiten hintereinander zu Blöcken (höchstens 20) zusammengefasst
function blocks(b){const pl=A.players[b.owner],L=[];
  b.queue.forEach((q,i)=>L.push({k:q.ep?'ep':q.up?'up':q.tech?'tech':'u',u:q.u,tech:q.tech,qi:i,q}));
  (b.pbq||[]).forEach((q,i)=>L.push({k:q.k,u:q.u,tech:q.tech,pi:i}));
  const out=[];for(const x of L){const l=out[out.length-1];
    if(l&&x.k==='u'&&l.k==='u'&&l.u===x.u&&l.items.length<BLOCK)l.items.push(x);else out.push({k:x.k,u:x.u,tech:x.tech,items:[x]})}
  for(const B of out){B.name=B.k==='u'?uName(B.u,pl.epoch):B.k==='ep'?(A.epochName(pl.epoch+1)||'Epoche'):B.k==='up'?'Ausbau':(TE()[B.tech]?TE()[B.tech].name:B.tech);
    B.key=B.k==='u'?'u:'+B.u:B.k==='tech'?'t:'+B.tech:B.k}
  return out}
const sigOf=(b,bl)=>bl.map(B=>B.key+'×'+B.items.length).join(',')+'|'+A.players[b.owner].epoch+'|'+(b.queue[0]&&b.queue[0].blocked?1:0);
function render(){const box=document.getElementById('info');if(!box)return;const b=cur();let el=box.querySelector('.pbq');
  if(!b||(!b.queue.length&&!(b.pbq&&b.pbq.length))){if(el)el.remove();box.classList.remove('pbqOn');return}
  ensureCss();grabAll();const bl=blocks(b),sig=sigOf(b,bl);
  if(!el){el=document.createElement('div');el.className='pbq';const at=box.querySelector('.queue')||box.querySelector('.hint')||box.querySelector('.prio');if(at)box.insertBefore(el,at);else box.appendChild(el);el.onclick=onTile}
  box.classList.add('pbqOn');
  if(el.dataset.b!==String(b.id)||el.dataset.sig!==sig){el.dataset.b=b.id;el.dataset.sig=sig;
    el.innerHTML=bl.map((B,j)=>{const n=B.items.length,ic=icons[B.key];
      return`<button class="pbt${B.k==='ep'?' ep':B.k==='tech'?' tq':''}" data-j="${j}" title="${n>1?n+'× ':''}${B.name}. Klick: einen Auftrag abbrechen, Shift + Klick: ganzen Block abbrechen">${ic?`<img src="${ic}" alt="">`:`<span>${B.name.slice(0,9)}</span>`}${n>1?`<b>${n}</b>`:''}<i></i></button>`}).join('')+
      (b.queue[0]&&b.queue[0].blocked?`<span class="pbh">${b.queue[0].blocked==='storm'?'Sturm: Schiffe warten':'Bevölkerungslimit'}</span>`:'')}
  // Fortschritt: laufender Auftrag (und parallele Forschung) im jeweiligen Block
  const tiles=el.querySelectorAll('.pbt');bl.forEach((B,j)=>{const t=tiles[j];if(!t)return;const r=B.items.find(x=>x.q&&(x.qi===0||(x.q.tech&&x.q.t>0)));
    const w=r?Math.min(100,r.q.t/r.q.total*100):0,bar=t.querySelector('i');if(bar)bar.style.width=w+'%';t.classList.toggle('run',!!r)})}
function onTile(ev){const t=ev.target.closest('.pbt');if(!t)return;ev.stopPropagation();const b=cur();if(!b)return;
  const B=blocks(b)[+t.dataset.j];if(!B)return;const items=ev.shiftKey?B.items.slice():[B.items[B.items.length-1]];
  // eigener Vorrat: über den Befehl zurücknehmen; Einträge der Engine-Warteschlange über ihren eigenen Abbrechen-Knopf (von hinten)
  const pi=items.filter(x=>x.pi!=null).map(x=>x.pi);if(pi.length)A.command({m:ID,op:'del',b:b.id,i:Math.min(...pi),j:Math.max(...pi)+1});
  const qi=items.filter(x=>x.qi!=null).map(x=>x.qi).sort((x,y)=>y-x);
  for(const i of qi){const q=document.querySelector('#info .queue .qi[data-i="'+i+'"]');if(q)q.click()}
  setTimeout(render,0)}
function watch(){if(obs)return;const box=document.getElementById('info');if(!box)return;
  obs=new MutationObserver(()=>{if(cur()&&!box.querySelector('.pbq'))queueMicrotask(render)});obs.observe(box,{childList:true});
  document.addEventListener('click',onClick,true);window.addEventListener('keydown',onKey,true);
  timer=setInterval(()=>{try{render()}catch(e){}},150)}

EmpireXY.register({
  id:ID,name:'Kern: Produktions-Blöcke',version:'2.0.0',core:true,
  description:'Warteschlange wie in AoE2: Mehrfachklick reiht Einheiten, Epoche und Forschung als Kacheln im Gebäudefenster auf, gleiche Einheiten als Block mit Zähler (bis 20), z. B. 20 Sammler → Epoche → 20 Sammler. Klick bricht ab.',
  hooks:{
    start(a){A=a;try{watch()}catch(e){}},
    load(a){A=a;for(const b of a.blds)delete b.pbl;try{watch()}catch(e){}},   // Daten der Fassung 1.x verwerfen
    tick(a){A=a;for(const b of a.blds)if(b.pbq&&!b.dead&&b.built)feed(a,b)},
    command(a,p,c){if(c&&c.m===ID)exec(a,p,c)},
  },
});
})();
