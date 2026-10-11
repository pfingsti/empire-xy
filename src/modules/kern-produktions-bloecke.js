// Kern-Baustein: Produktions-Blöcke (Christian 2026-10-11: „max 20 Sammler, dann Epochenforschung, dann wieder max 20 Sammler, für alle Gebäude“).
// Jedes eigene Gebäude, das ausbildet oder forscht, bekommt in der Infoleiste eine Block-Kette, die der Reihe nach abgearbeitet wird:
//   [20× Sammlerin] → [Epoche] → [20× Sammlerin]
// Ein Block ist eine Einheit mit Stückzahl, das Vorrücken in die nächste Epoche (nur Stadtzentrum) oder eine Forschung dieses Gebäudes.
// Der Baustein hält die normale Warteschlange gefüllt (höchstens 2 Einheiten aus dem Block im Voraus, damit nicht alles auf einmal bezahlt wird)
// und geht zum nächsten Block, sobald der aktuelle erfüllt ist. „Wiederholen“ beginnt nach dem letzten Block wieder von vorn.
// Daten: b.pbl={on,loop,i,seq,list:[{id,k:'u'|'ep'|'tech',u,tech,n,done,ep}],seen}. Liegt am Gebäude und wird mit dem Spielstand gespeichert.
// Änderungen laufen über api.command (im Mehrspieler über den Lockstep), die Abarbeitung im tick: auf allen Rechnern gleich.
(function(){
const ID='kern-produktions-bloecke';
const MAXB=12,AHEAD=2,QMAX=6;
let A=null,EPEND=99,feedT=0,obs=null,timer=0;
const why=new Map();   // Gebäude-id → warum der aktuelle Block gerade wartet (nur Anzeige)
const form={};         // Gebäude-id → zuletzt gewählte Aktion/Stückzahl im Formular (nur Anzeige)
const U=()=>EmpireXY.units,TE=()=>EmpireXY.techs,EP=()=>EmpireXY.epochs;
const maxEp=()=>{const n=EP().length-1;return A&&typeof A.maxEpoch==='number'?Math.min(n,A.maxEpoch):Math.min(n,EPEND)};
const afford=(pl,c)=>{for(const k in c)if((pl.res[k]||0)<c[k])return false;return true};
const pay=(pl,c)=>{for(const k in c)pl.res[k]-=c[k]};
const uName=(u,ep)=>{const d=U()[u];return d?(d.names&&d.names[ep])||d.name||d.label||u:u};
const trains=(a,b)=>{const pl=a.players[b.owner];return Object.keys(U()).filter(k=>U()[k].from===b.type&&(!U()[k].civ||U()[k].civ===pl.civ))};
const techsAt=b=>Object.keys(TE()).filter(id=>TE()[id].at===b.type);
const hasOpts=(a,b)=>trains(a,b).length||b.type==='tc'||techsAt(b).length;
const countOf=(a,p,type)=>{let n=0;for(const e of a.units)if(!e.dead&&e.owner===p&&e.type===type)n++;for(const e of a.blds)if(e.owner===p&&!e.dead)for(const q of e.queue)if(q.u===type)n++;return n};
const label=(a,b,B)=>{const pl=a.players[b.owner];
  if(B.k==='u')return B.n+'× '+uName(B.u,pl.epoch);
  if(B.k==='ep')return'Epoche'+(B.ep?': '+a.epochName(B.ep):pl.epoch<maxEp()?': '+a.epochName(pl.epoch+1):'');
  const t=TE()[B.tech];return t?t.name:B.tech};

// ---------- Abarbeitung (Simulation) ----------
function qUnit(a,b,pl,B){const d=U()[B.u],c=a.uCost(b.owner,B.u);if(!afford(pl,c))return'wartet auf Rohstoffe';
  pay(pl,c);const s=b.pbl.seq++;b.queue.push({u:B.u,t:0,total:d.time,cost:c,pbk:B.id,pbs:s});B.done++;return null}
function qEpoch(b,pl){const E=EP()[pl.epoch+1],c={...(E.cost||{})};if(!afford(pl,c))return'wartet auf Rohstoffe';
  pay(pl,c);pl.advancing=true;b.queue.push({ep:true,t:0,total:E.time||60,cost:c});return null}
function qTech(a,b,pl,id){const t=TE()[id];if(!afford(pl,t.cost||{}))return'wartet auf Rohstoffe';
  pay(pl,t.cost||{});const tot=t.time||30,t0=Math.min(tot*.99,(pl.techProg&&pl.techProg[id])||0);if(pl.techProg)delete pl.techProg[id];
  b.queue.push({tech:id,t:t0,total:tot,cost:t.cost||{}});return null}
function next(P){P.i++;if(P.i>=P.list.length&&P.loop){P.i=0;for(const B of P.list){B.done=0;B.ep=0}}}
// Abgebrochene Einheiten aus einem Block zählen nicht: verschwindet ein Eintrag, bevor er fertig war, wird er wieder offen
function track(b){const P=b.pbl,now={};
  b.queue.forEach(q=>{if(q.pbs)now[q.pbs]=[q.pbk,q.total-q.t]});
  for(const s in P.seen)if(!now[s]){const [bk,r]=P.seen[s];if(r>1.5){const j=P.list.findIndex(B=>B.id===bk);if(j>=P.i&&P.list[j].done>0)P.list[j].done--}}
  P.seen=now}
function feed(a,b){const P=b.pbl,pl=a.players[b.owner];let w=null;
  if(!P.on||P.i>=P.list.length){why.delete(b.id);return}
  const B=P.list[P.i];
  if(B.k==='u'){const d=U()[B.u];
    if(!d)return next(P);
    if(B.done>=B.n){if(!b.queue.some(q=>q.pbk===B.id))next(P);else w='letzte Einheiten in Ausbildung'}
    else if((d.minEpoch||0)>pl.epoch)w='ab '+a.epochName(d.minEpoch);
    else if(d.max&&countOf(a,b.owner,B.u)>=d.max)w='höchstens '+d.max+' gleichzeitig';
    else if(b.queue.length>=QMAX)w='Warteschlange voll';
    else if(b.queue.filter(q=>q.u).length<AHEAD)w=qUnit(a,b,pl,B);
  }else if(B.k==='ep'){
    if(B.ep&&pl.epoch>=B.ep)next(P);
    else if(!B.ep&&pl.epoch>=maxEp())next(P);
    else if(pl.advancing){if(!B.ep)B.ep=pl.epoch+1;w='Vorrücken läuft'}
    else if(B.ep&&pl.epoch<B.ep){B.ep=0}// Vorrücken wurde abgebrochen: neu einreihen
    else if(b.queue.length>=QMAX)w='Warteschlange voll';
    else{w=qEpoch(b,pl);if(!w)B.ep=pl.epoch+1}
  }else{const t=TE()[B.tech];const st=t?a.techState(b.owner,B.tech):'none';
    if(st==='done'||st==='none')next(P);
    else if(st==='running')w='wird erforscht';
    else if(st==='epoch')w='ab '+a.epochName(t.epoch);
    else if(st!=='open')w='Voraussetzung fehlt';
    else if(b.queue.length>=QMAX)w='Warteschlange voll';
    else w=qTech(a,b,pl,B.tech);
  }
  if(w)why.set(b.id,w);else why.delete(b.id)}

// ---------- Befehle (Mehrspieler-sicher) ----------
function exec(a,p,c){const b=a.byId(c.b);if(!b||b.dead||b.kind!=='bld'||b.owner!==p)return;
  const P=b.pbl||(b.pbl={on:true,loop:false,i:0,seq:1,list:[],seen:{}}),L=P.list,j=c.j|0;
  const mk=(k,v,n)=>{const B={id:P.seq++,k,n:Math.max(1,Math.min(200,n|0||1)),done:0,ep:0};
    if(k==='u'){if(!U()[v]||U()[v].from!==b.type)return null;B.u=v}else if(k==='tech'){if(!TE()[v]||TE()[v].at!==b.type)return null;B.tech=v;B.n=1}else if(k==='ep'){if(b.type!=='tc')return null;B.n=1}else return null;return B};
  switch(c.op){
    case'add':{if(L.length>=MAXB)return;const B=mk(c.k,c.v,c.n);if(B)L.push(B);break}
    case'del':if(L[j]){L.splice(j,1);if(j<P.i)P.i--;P.i=Math.max(0,Math.min(P.i,L.length))}break;
    case'mv':{const k=j+(c.d>0?1:-1);if(L[j]&&L[k]){[L[j],L[k]]=[L[k],L[j]];if(P.i===j)P.i=k;else if(P.i===k)P.i=j}break}
    case'n':if(L[j]&&L[j].k==='u'){L[j].n=Math.max(1,Math.min(200,c.n|0||1))}break;
    case'go':if(L[j]){P.i=j;for(let x=j;x<L.length;x++){L[x].done=0;L[x].ep=0}}break;   // ab diesem Block (neu) beginnen
    case'on':P.on=!P.on;break;
    case'loop':P.loop=!P.loop;if(P.loop&&P.i>=L.length)next(Object.assign(P,{i:L.length-1}));break;
    case'reset':P.i=0;for(const B of L){B.done=0;B.ep=0}break;
    case'clear':b.pbl=null;why.delete(b.id);return;
    case'preset':{if(b.type!=='tc')return;P.list=[];P.i=0;const w=trains(a,b).includes('worker')?'worker':trains(a,b)[0];if(!w)return;
      for(const B of [mk('u',w,20),mk('ep'),mk('u',w,20)])if(B)P.list.push(B);break}
  }
  if(!P.list.length&&c.op!=='add')b.pbl=null}

// ---------- Anzeige in der Infoleiste ----------
const css=`#info.pblOn{overflow-y:auto}
.pbl{margin-top:4px;border-top:1px solid rgba(235,195,120,.18);padding-top:4px;font-size:12px}
.pbl .pbh{display:flex;align-items:center;gap:6px;color:var(--muted,#bba)}.pbl .pbh b{color:#ecdcb6;font-weight:600;margin-right:auto}
.pbl .pbh button,.pbl .pba button,.pbl .pbk button{font-size:11px;padding:1px 6px;cursor:pointer;border:1px solid #120c06;border-radius:2px;background:linear-gradient(#4b3a26,#2e2215);color:#ecdcb6}
.pbl .pbh button.on{background:linear-gradient(#5d7a32,#3a4f1c)}
.pbl .pbs{display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin:4px 0}
.pbl .pbk{display:inline-flex;align-items:center;gap:2px;padding:1px 3px 1px 6px;border:1px solid #120c06;border-radius:2px;background:rgba(46,34,21,.85);color:#d8c9a4}
.pbl .pbk.cur{border-color:#e0b85a;box-shadow:0 0 0 1px rgba(224,184,90,.45);color:#fff2cf}.pbl .pbk.ok{opacity:.55}
.pbl .pbk small{color:#c8b27a;margin-left:2px}.pbl .pbk button{padding:0 4px;line-height:14px}
.pbl .pbar{color:#8a7a5a}.pbl .pbw{color:#e0a85a;font-size:11px;min-height:13px}
.pbl .pba{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.pbl .pba select{font-size:11px;max-width:150px}.pbl .pba input{width:44px;font-size:11px}`;
function ensureCss(){if(document.getElementById('pblCss'))return;const s=document.createElement('style');s.id='pblCss';s.textContent=css;document.head.appendChild(s)}
const cmd=(b,o)=>A.command({m:ID,b:b.id,...o});
function cur(){if(!A)return null;let s;try{s=A.sel()}catch(e){return null}if(!s||s.length!==1)return null;const b=s[0];
  return b&&b.kind==='bld'&&!b.dead&&b.built&&b.owner===A.local&&hasOpts(A,b)?b:null}
function options(b){const pl=A.players[b.owner],o=[];
  for(const u of trains(A,b)){const d=U()[u],l=(d.minEpoch||0)>pl.epoch;o.push(['u:'+u,uName(u,Math.max(pl.epoch,d.minEpoch||0))+(l?' (ab '+A.epochName(d.minEpoch)+')':'')])}
  if(b.type==='tc')o.push(['ep','Nächste Epoche erforschen']);
  for(const id of techsAt(b).sort((x,y)=>(TE()[x].epoch||0)-(TE()[y].epoch||0))){const st=A.techState(b.owner,id);if(st!=='done'&&st!=='none')o.push(['t:'+id,'Forschung: '+TE()[id].name])}
  return o}
const sig=b=>{const P=b.pbl;return P?[P.on,P.loop,P.i,P.list.map(B=>B.id+'/'+B.n).join(','),A.players[b.owner].epoch].join('|'):'-'};
function chips(b){const P=b.pbl;if(!P||!P.list.length)return'<span class="pbar">Noch keine Blöcke. Unten Aktion wählen und „Block hinzufügen“.</span>';
  return P.list.map((B,j)=>(j?'<span class="pbar">→</span>':'')+`<span class="pbk${j===P.i&&P.on?' cur':j<P.i?' ok':''}" data-j="${j}" title="Klick: ab diesem Block beginnen">${label(A,b,B)}${B.k==='u'?`<small data-p="${j}">${Math.min(B.done,B.n)}/${B.n}</small>`:''}`+
    `${j?`<button data-op="mv" data-d="-1" title="Nach vorn">‹</button>`:''}${j<P.list.length-1?`<button data-op="mv" data-d="1" title="Nach hinten">›</button>`:''}<button data-op="del" title="Entfernen">×</button></span>`).join('')+
    (P.loop?'<span class="pbar" title="Beginnt nach dem letzten Block von vorn">⟲</span>':P.i>=P.list.length?'<span class="pbar">✓ fertig</span>':'')}
function render(){const box=document.getElementById('info');if(!box)return;const b=cur();let el=box.querySelector('.pbl');
  if(!b){if(el)el.remove();box.classList.remove('pblOn');return}
  if(el&&el.dataset.b==String(b.id)&&el.dataset.sig===sig(b)){live(el,b);return}
  ensureCss();const P=b.pbl,f=form[b.id]||(form[b.id]={v:b.type==='tc'?'u:worker':'',n:b.type==='tc'?20:5}),opts=options(b);
  if(!opts.some(o=>o[0]===f.v))f.v=opts[0]?opts[0][0]:'';
  const html=`<div class="pbh"><b>Produktions-Blöcke</b>${P?`<button data-op="on" class="${P.on?'on':''}" title="Abarbeitung an/aus">${P.on?'Aktiv':'Pausiert'}</button><button data-op="loop" class="${P.loop?'on':''}" title="Nach dem letzten Block von vorn beginnen">⟲ Wiederholen</button><button data-op="clear" title="Alle Blöcke entfernen">Leeren</button>`:''}</div>
    <div class="pbs">${chips(b)}</div><div class="pbw"></div>
    <div class="pba"><select>${opts.map(o=>`<option value="${o[0]}"${o[0]===f.v?' selected':''}>${o[1]}</option>`).join('')}</select><input type="number" min="1" max="200" value="${f.n}" title="Stückzahl (nur Einheiten)"${f.v.startsWith('u:')?'':' hidden'}><button data-op="add">Block hinzufügen</button>${b.type==='tc'&&!(P&&P.list.length)?'<button data-op="preset" title="20 Sammler, dann Epoche, dann 20 Sammler">Vorlage</button>':''}</div>`;
  if(!el){el=document.createElement('div');el.className='pbl';const pr=box.querySelector('.prio');if(pr)box.insertBefore(el,pr);else box.appendChild(el)}
  el.dataset.b=b.id;el.dataset.sig=sig(b);el.innerHTML=html;box.classList.add('pblOn');
  const sl=el.querySelector('.pba select'),inp=el.querySelector('.pba input');
  sl.onchange=()=>{f.v=sl.value;inp.hidden=!f.v.startsWith('u:');if(f.v.startsWith('u:')&&!inp.dataset.t){f.n=f.v==='u:worker'?20:5;inp.value=f.n}};
  inp.oninput=()=>{inp.dataset.t=1;f.n=Math.max(1,Math.min(200,+inp.value|0||1))};
  el.onclick=ev=>{const t=ev.target.closest('button,.pbk');if(!t||!el.contains(t))return;ev.stopPropagation();const k=t.closest('.pbk'),j=k?+k.dataset.j:0;
    const op=t.tagName==='BUTTON'?t.dataset.op:'go';
    if(op==='add'){if(!f.v)return;const [k2,v]=f.v==='ep'?['ep','']:f.v.startsWith('u:')?['u',f.v.slice(2)]:['tech',f.v.slice(2)];
      if(b.pbl&&b.pbl.list.length>=MAXB){A.toast('Höchstens '+MAXB+' Blöcke je Gebäude.','warn');return}cmd(b,{op:'add',k:k2,v,n:f.n})}
    else if(op==='mv')cmd(b,{op,j,d:+t.dataset.d});else if(op==='del'||op==='go')cmd(b,{op,j});else cmd(b,{op});
    setTimeout(render,0)};
  live(el,b)}
function live(el,b){const P=b.pbl;if(!P)return;
  for(const s of el.querySelectorAll('small[data-p]')){const B=P.list[+s.dataset.p];if(B){const t=Math.min(B.done,B.n)+'/'+B.n;if(s.textContent!==t)s.textContent=t}}
  const w=el.querySelector('.pbw'),t=!P.on?'Pausiert.':P.i>=P.list.length?(P.list.length?'Alle Blöcke erledigt.':''):(why.get(b.id)?'Aktueller Block '+why.get(b.id)+'.':'');if(w.textContent!==t)w.textContent=t}
function watch(){const box=document.getElementById('info');if(!box||obs)return;
  obs=new MutationObserver(()=>{if(!box.querySelector('.pbl')||!cur())queueMicrotask(render)});obs.observe(box,{childList:true});
  timer=setInterval(()=>{try{render()}catch(e){}},300)}
function readEpEnd(){const s=document.getElementById('epEndSel');EPEND=s&&s.value!==''?+s.value:99}

EmpireXY.register({
  id:ID,name:'Kern: Produktions-Blöcke',version:'1.0.0',core:true,
  description:'Warteschlange in Blöcken für alle Gebäude: z. B. 20 Sammler → Epoche → 20 Sammler. Blöcke hinzufügen, entfernen, umsortieren, optional wiederholen.',
  hooks:{
    start(a){A=a;feedT=0;why.clear();readEpEnd();try{watch()}catch(e){}},
    load(a,d){A=a;feedT=0;why.clear();EPEND=d&&d.epEnd!=null?d.epEnd:99;try{watch()}catch(e){}},
    tick(a,dt){A=a;feedT+=dt;const go=feedT>=.25;if(go)feedT=0;
      for(const b of a.blds){if(!b.pbl||b.dead||!b.built)continue;track(b);if(go)feed(a,b)}},
    command(a,p,c){if(c&&c.m===ID)exec(a,p,c)},
  },
});
})();
