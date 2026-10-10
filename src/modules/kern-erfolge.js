// Kern-Baustein: Errungenschaften und Tutorial.
(function(){
const ACH=[
  ['stein','Steinzeit-Überlebender','Überstehe 10 Minuten.',(p,a)=>a.time>=600],
  ['feldherr','Großer Feldherr','Besiege 50 feindliche Einheiten.',p=>p.st.killed>=50],
  ['baumeister','Baumeister','Errichte 20 Gebäude.',p=>p.st.built>=20],
  ['forscher','Forscher','Erforsche 8 Stufen einer Technologielinie.',p=>{const c={};for(const k in p.techs){if(!p.techs[k])continue;const l=k.replace(/_\d+$/,'');c[l]=(c[l]||0)+1}return Object.values(c).some(n=>n>=8)}],
  ['haendler','Händler','Transportiere 100 Gold per Karawane.',p=>(p.carried||0)>=100],
  ['wunder','Weltwunder','Vollende ein Weltwunder.',(p,a)=>a.ents.some(e=>e.type==='wonder'&&e.owner===0&&e.built&&!e.dead)],
  ['zeit','Zeitreisender','Erreiche die 10. Epoche.',p=>p.epoch>=9],
  ['heer','Heerführer','Bilde 100 Einheiten aus.',p=>p.st.trained>=100],
  ['sammler','Sammler','Sammle 10 000 Rohstoffe.',p=>p.st.gathered>=10000],
  ['reich','Schatzkammer','Besitze 2000 Gold auf einmal.',p=>p.res.gold>=2000],
  ['epoche5','Aufsteiger','Erreiche die 5. Epoche.',p=>p.epoch>=4],
  ['festung','Festungsherr','Besitze 5 Türme gleichzeitig.',(p,a)=>a.ents.filter(e=>e.owner===0&&e.kind==='bld'&&e.built&&!e.dead&&/tower|sniper/.test(e.type)).length>=5],
  ['erste_epoche','Neue Zeit','Steige zum ersten Mal in eine neue Epoche auf.',p=>p.epoch>=1&&p.epoch>(p.epStart0||0)],
  ['rohstoffe1000','Volle Kornkammer','Sammle 1000 Rohstoffe.',p=>p.st.gathered>=1000],
  ['zehn_gebaeude','Dorfgründer','Errichte 10 Gebäude.',p=>p.st.built>=10],
  ['sieg','Eroberer','Gewinne eine Partie.',(p,a)=>!!a._won],
];
// Steam: Errungenschaft "id" heißt dort ACH_ID (z. B. ACH_ERSTE_EPOCHE), siehe steam/STEAM.md
const steamAch=id=>{try{window.desktop&&window.desktop.steamAchievement&&window.desktop.steamAchievement('ACH_'+id.toUpperCase())}catch(e){}};
let got={};try{got=JSON.parse(localStorage.getItem('empire-xy.erfolge')||'{}')}catch(e){}
for(const id in got)steamAch(id); // früher freigeschaltete auch bei Steam nachtragen
const css=document.createElement('style');css.textContent=`#achBanner{position:fixed;top:56px;right:14px;z-index:60;background:linear-gradient(#f3d27a,#c99a2e);color:#2a1d05;border:2px solid #fff3c4;border-radius:8px;padding:8px 14px;font:600 14px sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.5);transition:opacity .4s,transform .4s;pointer-events:none}
#achBanner small{display:block;font-weight:400}
#tutBox{position:fixed;z-index:70;max-width:300px;background:#fffbe9;color:#2a1d05;border:2px solid #c99a2e;border-radius:10px;padding:10px 12px;font:14px sans-serif;box-shadow:0 6px 22px rgba(0,0,0,.5)}
#tutBox b{display:block;margin-bottom:4px}#tutBox button{margin-top:8px;margin-right:6px}
#tutArrow{position:fixed;z-index:70;font-size:34px;color:#f3d27a;text-shadow:0 0 6px #000;pointer-events:none;animation:tutB 1s infinite}
@keyframes tutB{50%{transform:translateY(-8px)}}`;document.head.appendChild(css);
const ban=document.createElement('div');ban.id='achBanner';ban.style.opacity=0;document.body.appendChild(ban);
const queue=[];let banT=0;
function show(a){queue.push(a)}
setInterval(()=>{if(banT>performance.now()||!queue.length){if(banT<=performance.now())ban.style.opacity=0;return}const a=queue.shift();
  ban.innerHTML='🏆 '+a[1]+'<small>'+a[2]+'</small>';ban.style.opacity=1;banT=performance.now()+3000},200);
window.__ach={list:ACH.map(a=>a[0]),got:()=>got};
// Tutorial
const STEPS=[
  ['Wähle einen Arbeiter','Klicke mit links auf einen deiner Arbeiter neben dem Stadtzentrum.',a=>a.sel().some(e=>e.type==='worker')],
  ['Schicke ihn zum Wald','Rechtsklick auf einen Baum: der Arbeiter fällt Holz.',a=>a.ents.some(e=>e.owner===0&&e.type==='worker'&&(e.ct==='wood'||(e.order&&e.order.rt==='wood')))],
  ['Baue eine Hütte','Mit gewähltem Arbeiter unten im Befehlsfeld ein Haus wählen und auf die Karte setzen.',a=>a.ents.some(e=>e.owner===0&&e.type==='house')],
  ['Rekrutiere einen Krieger','Wähle die Kaserne oder das Stadtzentrum und bilde eine Kampfeinheit aus.',a=>a.ents.some(e=>e.owner===0&&e.kind==='unit'&&e.type!=='worker'&&!e.dead)],
  ['Forsche Technologie','Öffne den Technologiebaum (Taste N) und starte eine Forschung.',a=>Object.keys(a.players[0].techs).length>0||a.ents.some(e=>e.owner===0&&e.queue&&e.queue.some(q=>q.tech))],
  ['Steige in die nächste Epoche auf','Wähle das Stadtzentrum und klicke auf den Epochen-Aufstieg.',a=>a.players[0].epoch>=1||a.players[0].advancing],
];
const ARROW=[null,null,'#cmds','#cmds','#btnTech','#cmds'];
let tut=-1,done=false;
const box=document.createElement('div');box.id='tutBox';box.hidden=true;document.body.appendChild(box);
const arr=document.createElement('div');arr.id='tutArrow';arr.textContent='⬇';arr.hidden=true;document.body.appendChild(arr);
function render(){if(tut<0||tut>=STEPS.length){box.hidden=arr.hidden=true;return}const s=STEPS[tut];box.hidden=false;
  box.innerHTML='<b>Schritt '+(tut+1)+'/6: '+s[0]+'</b>'+s[1]+'<div>'+(done?'✔ Geschafft!':'…')+'</div><button id="tutNext"'+(done?'':' disabled')+'>Weiter</button><button id="tutEnd">Beenden</button>';
  box.style.left='50%';box.style.top='70px';box.style.transform='translateX(-50%)';
  box.querySelector('#tutNext').onclick=()=>{tut++;done=false;if(tut>=STEPS.length){toastE('Tutorial abgeschlossen!');tut=-1}render()};
  box.querySelector('#tutEnd').onclick=()=>{tut=-1;render()};
  const sel=ARROW[tut]&&document.querySelector(ARROW[tut]);if(sel&&sel.offsetParent){const r=sel.getBoundingClientRect();arr.hidden=false;arr.style.left=(r.left+r.width/2-12)+'px';arr.style.top=(r.top-44)+'px'}else arr.hidden=true}
let toastE=()=>{};
window.__tut={start(){tut=0;done=false;render()},get step(){return tut}};
function addBtn(){const sb=document.getElementById('startBtn');if(!sb||document.getElementById('tutBtn'))return;const b=document.createElement('button');b.className='opt';b.id='tutBtn';b.textContent='Tutorial';
  b.onclick=()=>{sb.click();window.__tut.start()};sb.parentNode.appendChild(b)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addBtn);else setTimeout(addBtn,0);
function check(api){const p=api.players[0];if(!p)return;
  for(const a of ACH)if(!got[a[0]]&&a[3](p,api)){got[a[0]]=1;show(a);steamAch(a[0]);try{localStorage.setItem('empire-xy.erfolge',JSON.stringify(got))}catch(e){}}}
EmpireXY.register({
  id:'kern-erfolge',name:'Kern: Errungenschaften und Tutorial',version:'1.0.0',core:true,
  description:'Sechzehn Errungenschaften (auch bei Steam) mit Goldbanner und ein geführtes Tutorial in sechs Schritten.',
  hooks:{
    start(api){api._won=false;const p=api.players[0];if(p)p.epStart0=p.epoch},
    end(api,win){if(win){api._won=true;check(api)}},
    tick(api,dt){const p=api.players[0];if(!p)return;toastE=m=>api.toast(m,'good');
      if(tut>=0&&!done&&STEPS[tut][2]({ents:api.ents,players:api.players,sel:()=>api.sel?api.sel():[]})){done=true;render()}
      if((api._achT=(api._achT||0)+dt)<1)return;api._achT=0;check(api);
    },
  },
});
})();
