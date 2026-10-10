// Kern-Baustein: Kampagnen. Drei Feldzüge mit Story, Briefing, Missionszielen im HUD,
// gespeichertem Fortschritt (localStorage) und Abschluss-Bildschirm.
// Missions-Ziele (goals): build {type,n} · army {n} · survive {sec} · collect {res} · destroy · epoch {n} · escort
// Zusatzregeln je Mission: limit (Sekunden bis zur Niederlage), calm (spätere KI-Angriffe), raids, enemy, start
(function(){
'use strict';
const XY=window.EmpireXY;
const CAMPAIGNS=[
  {id:'rom',name:'Aufstieg Roms',era:'Eisenzeit',civ:'roemer',epStart:3,epEnd:4,emblem:'laurel',
   intro:'Vom Dorf am Tiber zum Herrn des Mittelmeers. Führe Rom durch Gründung, Krieg und Handel bis zur Pax Romana.',
   epilog:'Die Legionen stehen an allen Grenzen, die Straßen sind sicher, das Getreide fließt. Rom ist kein Dorf mehr, Rom ist die Welt. Die Geschichtsschreiber werden deinen Namen neben den der Gründer setzen.',
   missions:[
    {title:'Die sieben Hügel',seed:1101,calm:240,
     brief:'Siedler aus Alba Longa haben sich an einer Furt des Tiber niedergelassen. Sichere den Ort, bevor die Nachbarstämme ihn für sich beanspruchen.',
     win:'Palisaden stehen, die ersten Kohorten exerzieren. Aus dem Lager wird eine Stadt.',
     goals:[{t:'build',type:'barracks',n:1},{t:'build',type:'house',n:4},{t:'army',n:6}]},
    {title:'Der Sturm der Gallier',seed:1102,
     brief:'Brennus hat die Alpen überquert, seine Krieger ziehen plündernd nach Süden. Halte die Stadt, bis die Legionen aus dem Süden eintreffen.',
     win:'Die Gallier ziehen ab, beladen nur mit ihren Toten. Rom hat gelernt, dass Mauern Leben retten.',
     goals:[{t:'survive',sec:300}],raids:{every:55,n:3,grow:1,first:40}},
    {title:'Kornkammer am Nil',seed:1103,limit:720,calm:200,
     brief:'Die Stadt wächst schneller als ihre Felder. Fülle die Speicher mit Getreide und Gold, ehe der Winter kommt und das Volk hungert.',
     win:'Die Speicher sind voll, Händler aus dem Osten drängen sich auf dem Forum. Der Senat lobt deine Umsicht.',
     goals:[{t:'collect',res:{food:1500,gold:600}}],start:{res:{wood:150}}},
    {title:'Der Bote des Senats',seed:1104,calm:150,
     brief:'Ein Gesandter muss die Friedensbedingungen ins verbündete Lager bringen. Feindliche Späher lauern am Weg. Er darf nicht fallen.',
     win:'Der Bote erreicht das Lager mit versiegelten Tafeln. Das Bündnis hält, die Grenze ist ruhig.',
     goals:[{t:'escort'}],vip:{name:'Gesandter Marcus',type:'cavalry'},guards:5},
    {title:'Karthago muss fallen',seed:1105,
     brief:'Karthago rüstet erneut zum Krieg. Cato fordert es in jeder Rede: Zerstöre das Stadtzentrum der Punier und brich ihre Macht.',
     win:'Die Mauern Karthagos liegen in Trümmern. Kein Rivale bedroht mehr Roms Seewege.',
     goals:[{t:'destroy'}],enemy:{army:6,res:1.3},start:{army:{infantry:4,ranged:3}}},
    {title:'Pax Romana',seed:1106,
     brief:'Ein letzter Rivale verweigert sich dem Frieden. Führe Rom ins neue Zeitalter und unterwirf das gegnerische Reich endgültig.',
     win:'Der letzte Widerstand ist gebrochen. Für zwei Jahrhunderte herrscht Frieden unter Roms Adler.',
     goals:[{t:'epoch',n:4},{t:'destroy'}],enemy:{army:8,res:1.5,towers:2},start:{res:{food:300,gold:200}}},
   ]},
  {id:'mittelalter',name:'Kronen und Kreuze',era:'Mittelalter',civ:'germanen',epStart:4,epEnd:5,emblem:'crown',
   intro:'Ein junges Herzogtum zwischen Fehden, Belagerungen und Handelsbünden. Schmiede aus verstreuten Burgen ein Königreich.',
   epilog:'Die Glocken läuten im ganzen Land, als die Krone auf dein Haupt gesetzt wird. Aus zerstrittenen Grafschaften ist ein Reich geworden, dessen Banner von der Küste bis zu den Bergen weht.',
   missions:[
    {title:'Die Burg am Fluss',seed:2101,calm:240,
     brief:'Der alte Herzog ist tot, die Grenzmark liegt offen. Befestige den Flussübergang mit Türmen und stelle eine Wache auf.',
     win:'Die Türme stehen, die Wache zieht auf. Wer jetzt den Fluss überqueren will, zahlt Zoll oder Blut.',
     goals:[{t:'build',type:'tower',n:2},{t:'build',type:'barracks',n:1},{t:'army',n:8}]},
    {title:'Die Belagerung',seed:2102,
     brief:'Ein rivalisierender Graf zieht mit Söldnern vor deine Mauern. Halte durch, bis der Entsatz eintrifft.',
     win:'Der Entsatz erscheint am Horizont, die Belagerer fliehen in die Wälder. Deine Burg hat standgehalten.',
     goals:[{t:'survive',sec:420}],raids:{every:60,n:4,grow:1,first:45},start:{res:{stone:200}}},
    {title:'Der Hansebund',seed:2103,limit:900,calm:240,
     brief:'Die Kaufleute der Hanse bieten dir einen Sitz im Bund, wenn du liefern kannst. Sammle Holz, Gold und Stein, bevor die Flotte ausläuft.',
     win:'Deine Waren füllen die Koggen. Die Hanse nimmt dich auf, Silber fließt in deine Schatzkammer.',
     goals:[{t:'collect',res:{wood:1500,gold:800,stone:400}}]},
    {title:'Die Flucht der Königin',seed:2104,calm:150,
     brief:'Die Königinwitwe ist in Gefahr. Geleite sie sicher durch feindliches Gebiet zum Kloster, wo ihr Asyl gewährt wird.',
     win:'Hinter den Klostermauern ist die Königin in Sicherheit. Ihr Wort wird dir die Treue des Adels sichern.',
     goals:[{t:'escort'}],vip:{name:'Königin Adelheid',type:'cavalry'},guards:7},
    {title:'Der Grenzkrieg',seed:2105,
     brief:'Der Graf von Nordmark hat deine Dörfer gebrandschatzt. Zieh ins Feld und zerstöre seine Stammburg.',
     win:'Die Stammburg des Grafen brennt. Seine Vasallen schwören dir nun die Treue.',
     goals:[{t:'destroy'}],enemy:{army:8,res:1.4,towers:1},start:{army:{spear:3,knight:2,ranged:3}}},
    {title:'Das Zeitalter der Entdecker',seed:2106,calm:300,
     brief:'Neue Ideen aus dem Süden verändern die Welt. Führe dein Reich in die Renaissance und stelle ein stehendes Heer auf.',
     win:'Druckerpressen, Kanonen, Kartenwerke: Dein Hof ist das Zentrum einer neuen Zeit.',
     goals:[{t:'epoch',n:5},{t:'army',n:15}],start:{res:{food:400,gold:300}}},
    {title:'Die Krönung',seed:2107,
     brief:'Nur ein Herzog steht noch zwischen dir und der Krone. Brich seine Macht, und das Reich ist geeint.',
     win:'Der letzte Herzog kniet vor dir. Das Reich ist geeint.',
     goals:[{t:'destroy'}],enemy:{army:10,res:1.6,towers:2},start:{res:{food:300,gold:300,stone:200}}},
   ]},
  {id:'industrie',name:'Dampf und Stahl',era:'Industriezeitalter',epStart:7,epEnd:8,emblem:'gear',
   intro:'Kohle, Eisen und Eisenbahnen verändern alles. Baue eine Industrienation auf und bestehe in den Kriegen einer neuen Zeit.',
   epilog:'Schlote rauchen über einer Nation, die sich selbst neu erfunden hat. Der Krieg ist vorbei, und die Fabriken, die Kanonen gossen, bauen nun Lokomotiven und Brücken.',
   missions:[
    {title:'Die erste Fabrik',seed:3101,calm:240,
     brief:'Ein Erfinder hat eine Dampfmaschine gebaut, die zehn Pferde ersetzt. Errichte Werkstätten und Wohnungen für die Arbeiter, die in die Stadt strömen.',
     win:'Die Maschinen stampfen Tag und Nacht. Die Stadt hat ihr Gesicht für immer verändert.',
     goals:[{t:'build',type:'workshop',n:2},{t:'build',type:'house',n:5},{t:'army',n:6}]},
    {title:'Kohle und Eisen',seed:3102,limit:840,calm:240,
     brief:'Die Hochöfen brauchen Erz und Kapital. Fördere Stein und Gold, bevor die Konkurrenz die Märkte übernimmt.',
     win:'Die Gruben laufen, die Banken vertrauen dir. Dein Stahl ist der beste des Kontinents.',
     goals:[{t:'collect',res:{stone:1200,gold:1200}}]},
    {title:'Der Streik an der Front',seed:3103,
     brief:'Feindliche Truppen nutzen den Arbeiterstreik für einen Großangriff. Halte die Industriestadt, bis Verstärkung per Eisenbahn eintrifft.',
     win:'Die Züge rollen ein, die Front stabilisiert sich. Die Stadt hat gehalten.',
     goals:[{t:'survive',sec:480}],raids:{every:60,n:4,grow:2,first:45},start:{res:{gold:300}}},
    {title:'Der Ingenieur',seed:3104,calm:150,
     brief:'Der Ingenieur, der die neue Brückenbautechnik erfunden hat, muss zur Hauptstadt. Agenten des Feindes wollen ihn aufhalten.',
     win:'Der Ingenieur ist in Sicherheit. Seine Pläne werden das Land verbinden.',
     goals:[{t:'escort'}],vip:{name:'Ingenieur Brunel',type:'cavalry'},guards:8},
    {title:'Die Weltkriegszeit',seed:3105,calm:300,
     brief:'Die Spannungen zwischen den Großmächten explodieren. Modernisiere dein Heer und erreiche die Weltkriegszeit, ehe der Feind es tut.',
     win:'Deine Divisionen sind die modernsten der Welt. Der Feind zögert.',
     goals:[{t:'epoch',n:8},{t:'army',n:20}],start:{res:{food:500,gold:400,stone:200}}},
    {title:'Stahlgewitter',seed:3106,
     brief:'Der letzte große Krieg. Zerstöre das Hauptquartier des Feindes und beende ihn.',
     win:'Die Waffen schweigen. Der Krieg ist gewonnen.',
     goals:[{t:'destroy'}],enemy:{army:12,res:1.7,towers:3},start:{res:{food:500,gold:500},army:{infantry:6,ranged:4,cavalry:3}}},
   ]},
];
const KEY='empire-xy.kampagne',DIFF_KEY='empire-xy.kampagne.stufe';
const readProg=()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return{}}};
const writeProg=p=>{try{localStorage.setItem(KEY,JSON.stringify(p))}catch(e){}};
let campDiff=1;try{const v=localStorage.getItem(DIFF_KEY);if(v!=null&&v!=='')campDiff=Math.max(0,Math.min(2,+v))}catch(e){}
const doneOf=(c,i)=>((readProg()[c.id]||{}).done||{})[i];
const unlocked=(c,i)=>i===0||!!doneOf(c,i-1);
const fmt=t=>{t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const MIL=['infantry','spear','ranged','skirm','cavalry','heavy','harcher','knight','marks'];
function nameOf(D,ep,fb){if(!D)return fb;const n=D.names||[];for(let i=Math.min(ep,n.length-1);i>=0;i--)if(n[i])return n[i];return D.name||D.label||fb}
function goalText(g,ep){
  if(g.t==='build')return (g.n>1?g.n+'× ':'')+nameOf(XY.buildings[g.type],ep,g.type)+' errichten';
  if(g.t==='army')return g.n+' Kampfeinheiten aufstellen';
  if(g.t==='survive')return fmt(g.sec)+' Minuten überleben';
  if(g.t==='collect')return Object.entries(g.res).map(([r,v])=>v+' '+(XY.resources.label[r]||r)).join(', ')+' sammeln';
  if(g.t==='destroy')return 'Feindliches Stadtzentrum zerstören';
  if(g.t==='epoch')return 'Die '+((XY.epochs[g.n]||{}).name||('Epoche '+(g.n+1)))+' erreichen';
  if(g.t==='escort')return 'Begleite die Person zum markierten Ort'+(C&&C.dir?' im '+C.dir:'');
  return '';
}

// ===== Darstellung =====
const css=document.createElement('style');css.textContent=`
#campMenu,#campBrief,#campFinal{z-index:40;background:radial-gradient(ellipse at 50% 30%,#27333a,#080b0d 75%)}
.cpCard{width:min(760px,100%);display:flex;flex-direction:column;gap:14px;padding-block:8px}
.cpCard h1{font-family:var(--f-display);font-size:clamp(32px,7vw,54px);margin:0;line-height:1;color:var(--bronze-hi);letter-spacing:.03em}
.cpCard h2{font-family:var(--f-display);font-weight:500;font-size:24px;margin:0;color:var(--bronze-hi)}
.cpCard .tag{font-size:16px;line-height:1.45;margin:0;max-width:60ch}
.cpList{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.cpCamp{display:flex;flex-direction:column;gap:8px;text-align:left;padding:14px;border:1px solid #5a4424;border-radius:6px;cursor:pointer;
  background:linear-gradient(160deg,rgba(74,58,36,.55),rgba(20,26,30,.92) 60%),repeating-linear-gradient(45deg,rgba(255,255,255,.015) 0 2px,transparent 2px 6px);box-shadow:inset 0 0 0 1px rgba(233,190,114,.08),0 6px 18px rgba(0,0,0,.4)}
.cpCamp:hover{border-color:var(--bronze);filter:brightness(1.08)}
.cpCard svg{width:56px;height:56px;flex:none}.cpCamp svg{width:46px;height:46px}
.cpCamp b{font-family:var(--f-display);font-size:20px;color:var(--bronze-hi);font-weight:500}
.cpCamp small{color:var(--muted);font-size:13px}
.cpCamp .bar{height:4px;background:var(--line);border-radius:2px;overflow:hidden}.cpCamp .bar i{display:block;height:100%;background:var(--bronze-hi)}
.cpMis{display:flex;flex-direction:column;gap:6px}
.cpM{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:5px;background:rgba(23,32,37,.85);text-align:left;cursor:pointer}
.cpM:hover:not([disabled]){border-color:var(--bronze)}
.cpM[disabled]{opacity:.5;cursor:not-allowed}
.cpM .n{font-family:var(--f-display);font-size:20px;color:var(--bronze);text-align:center}
.cpM .t{font-size:15px}.cpM .t small{display:block;color:var(--muted);font-size:12px;margin-top:2px}
.cpM .s{font-size:12px;padding:2px 8px;border-radius:10px;border:1px solid var(--line);white-space:nowrap}
.cpM .s.ok{color:#1b130a;background:var(--ok);border-color:var(--ok)}.cpM .s.av{color:var(--bronze-hi);border-color:var(--bronze)}
.cpGoals{margin:0;padding:10px 14px 10px 30px;background:rgba(14,19,22,.6);border-left:3px solid var(--bronze);border-radius:2px;font-size:15px;line-height:1.6}
.cpBrief{font-style:italic;font-size:17px;line-height:1.5;margin:0;padding:14px 16px;background:linear-gradient(rgba(233,214,170,.09),rgba(233,214,170,.04));border:1px solid rgba(196,149,74,.35);border-radius:4px}
#campHud{position:absolute;left:12px;bottom:10px;z-index:6;min-width:230px;max-width:min(340px,70%);background:rgba(14,19,22,.86);border:1px solid #5a4424;border-radius:5px;padding:7px 10px;font-size:13px;box-shadow:0 4px 14px rgba(0,0,0,.45);cursor:pointer}
#campHud h4{margin:0 0 4px;font-family:var(--f-display);font-weight:500;font-size:15px;color:var(--bronze-hi);display:flex;justify-content:space-between;gap:10px}
#campHud ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px}
#campHud li{display:grid;grid-template-columns:16px 1fr auto;gap:6px;font-variant-numeric:tabular-nums}
#campHud li.ok{color:var(--ok)}#campHud li .p{color:var(--muted)}#campHud li.ok .p{color:var(--ok)}
#campHud .warn{color:var(--danger);margin-top:3px}
#campHud.min ul,#campHud.min .warn{display:none}
#campEnd{display:flex;flex-direction:column;gap:10px}
.cpRow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cpCard .cpMedal{width:110px;height:110px;align-self:center}
`;document.head.appendChild(css);
const EMB={
  laurel:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#2a2216" stroke="#c4954a" stroke-width="1.5"/><path d="M24 38c-8-2-13-9-12-19M24 38c8-2 13-9 12-19" fill="none" stroke="#9aa05a" stroke-width="2"/>'+[0,1,2,3,4].map(i=>`<ellipse cx="${13+i*.6}" cy="${33-i*4}" rx="3" ry="1.5" transform="rotate(${-50+i*8} ${13+i*.6} ${33-i*4})" fill="#b7b46a"/><ellipse cx="${35-i*.6}" cy="${33-i*4}" rx="3" ry="1.5" transform="rotate(${50-i*8} ${35-i*.6} ${33-i*4})" fill="#b7b46a"/>`).join('')+'<text x="24" y="28" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#e9be72">SPQR</text></svg>',
  crown:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#1d2228" stroke="#c4954a" stroke-width="1.5"/><path d="M12 32l-2-14 7 6 7-10 7 10 7-6-2 14z" fill="#d9b15a" stroke="#7a5a24"/><rect x="12" y="32" width="24" height="4" fill="#b08a3e"/><circle cx="24" cy="25" r="2" fill="#a2312a"/><circle cx="17" cy="28" r="1.4" fill="#2f5a8c"/><circle cx="31" cy="28" r="1.4" fill="#2f5a8c"/></svg>',
  gear:'<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#20201e" stroke="#c4954a" stroke-width="1.5"/><g fill="#8b8f93" stroke="#4a4e52">'+[...Array(8)].map((_,i)=>`<rect x="21.5" y="8" width="5" height="7" transform="rotate(${i*45} 24 24)"/>`).join('')+'<circle cx="24" cy="24" r="10"/></g><circle cx="24" cy="24" r="4" fill="#20201e"/><path d="M8 40h32" stroke="#6a4a2a" stroke-width="2"/></svg>',
};
function overlay(id){let o=document.getElementById(id);if(!o){o=document.createElement('div');o.className='overlay';o.id=id;o.hidden=true;document.body.appendChild(o)}return o}
const menuO=overlay('campMenu'),briefO=overlay('campBrief'),finalO=overlay('campFinal');
let menuCamp=null;
function openMenu(c){
  menuCamp=c||null;const prog=readProg();
  const diffBtns=['Leicht','Normal','Schwer'].map((n,i)=>`<button class="opt" data-cd="${i}" aria-pressed="${i===campDiff}">${n}</button>`).join('');
  if(!menuCamp){
    menuO.innerHTML=`<div class="cpCard"><h1>Kampagne</h1><p class="tag">Wähle einen Feldzug. Jede Mission schaltet die nächste frei, dein Fortschritt wird gespeichert.</p>
      <div class="row"><span class="lbl">Schwierigkeit</span>${diffBtns}</div>
      <div class="cpList">${CAMPAIGNS.map((c,i)=>{const d=Object.keys((prog[c.id]||{}).done||{}).length,n=c.missions.length;
        return `<button class="cpCamp" data-camp="${i}">${EMB[c.emblem]||''}<b>${esc(c.name)}</b><small>${esc(c.era)} · ${n} Missionen</small><span style="font-size:13px;line-height:1.4">${esc(c.intro)}</span>
        <span class="bar"><i style="width:${d/n*100}%"></i></span><small>${d>=n?'Abgeschlossen':d+' von '+n+' Missionen erfüllt'}</small></button>`}).join('')}</div>
      <div class="row"><button class="opt" data-back>Zurück zum Hauptmenü</button></div></div>`;
  }else{
    const c=menuCamp,ci=CAMPAIGNS.indexOf(c);
    menuO.innerHTML=`<div class="cpCard"><div class="cpRow">${EMB[c.emblem]||''}<h1 style="font-size:clamp(28px,6vw,44px)">${esc(c.name)}</h1></div><p class="tag">${esc(c.intro)}</p>
      <div class="row"><span class="lbl">Schwierigkeit</span>${diffBtns}</div>
      <div class="cpMis">${c.missions.map((m,i)=>{const d=doneOf(c,i),u=unlocked(c,i);
        return `<button class="cpM" data-mis="${ci}:${i}"${u?'':' disabled'}><span class="n">${['I','II','III','IV','V','VI','VII','VIII'][i]}</span><span class="t">${esc(m.title)}<small>${esc(m.goals.map(g=>goalText(g,c.epStart)).join(' · '))}</small></span>
        <span class="s ${d?'ok':u?'av':''}">${d?'✓ abgeschlossen · '+fmt(d.t):u?'verfügbar':'🔒 gesperrt'}</span></button>`}).join('')}</div>
      <div class="row"><button class="opt" data-camps>Alle Kampagnen</button><button class="opt" data-back>Hauptmenü</button></div></div>`;
  }
  menuO.hidden=false;
}
menuO.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.dataset.cd!=null){campDiff=+b.dataset.cd;try{localStorage.setItem(DIFF_KEY,campDiff)}catch(err){}openMenu(menuCamp);return}
  if(b.dataset.camp!=null){openMenu(CAMPAIGNS[+b.dataset.camp]);return}
  if(b.hasAttribute('data-camps')){openMenu(null);return}
  if(b.hasAttribute('data-back')){menuO.hidden=true;return}
  if(b.dataset.mis){const [ci,mi]=b.dataset.mis.split(':').map(Number);openBrief(ci,mi)}
});
function openBrief(ci,mi){
  const c=CAMPAIGNS[ci],m=c.missions[mi];
  briefO.innerHTML=`<div class="cpCard"><small style="color:var(--muted);letter-spacing:.12em;text-transform:uppercase">${esc(c.name)} · Mission ${mi+1} von ${c.missions.length}</small>
    <h1>${esc(m.title)}</h1><p class="cpBrief">${esc(m.brief)}</p>
    <h2>Ziele</h2><ul class="cpGoals">${m.goals.map(g=>`<li>${esc(goalText(g,c.epStart))}</li>`).join('')}${m.limit?`<li style="color:var(--danger)">Zeitlimit: ${fmt(m.limit)}</li>`:''}${m.vip?`<li style="color:var(--danger)">${esc(m.vip.name)} darf nicht fallen.</li>`:''}</ul>
    <div class="row"><button class="go" data-go>Mission starten</button><button class="opt" data-list>Zur Missionsliste</button></div></div>`;
  briefO.hidden=false;menuO.hidden=true;
  briefO.querySelector('[data-go]').onclick=()=>startMission(ci,mi);
  briefO.querySelector('[data-list]').onclick=()=>{briefO.hidden=true;openMenu(c)};
}

// ===== Missionsablauf =====
let C=null,pending=null,lastApi=null;
function startMission(ci,mi){
  const c=CAMPAIGNS[ci],m=c.missions[mi];
  briefO.hidden=menuO.hidden=finalO.hidden=true;
  pending={ci,mi,diff:campDiff};
  XY.game.start({diff:campDiff,seed:m.seed,epStart:c.epStart,epEnd:c.epEnd,civ:c.civ,limit:0});
}
function freeSpot(api,cx,cy,size,maxR){
  for(let r=0;r<(maxR||14);r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    const x=Math.round(cx+dx),y=Math.round(cy+dy);let ok=x>1&&y>1&&x+size<api.W-1&&y+size<api.W-1;
    for(let yy=y-1;ok&&yy<=y+size;yy++)for(let xx=x-1;xx<=x+size;xx++)if(!api.free(xx,yy)){ok=false;break}
    if(ok)return{x,y}}
  return null;
}
const unitsFor=ep=>MIL.filter(k=>XY.units[k]&&(XY.units[k].minEpoch||0)<=ep);
function spawnNear(api,owner,type,cx,cy){const s=freeSpot(api,cx,cy,0,12);if(!s||!XY.units[type])return null;return api.spawnUnit(owner,type,s.x+.5,s.y+.5)}
function setupMission(api){
  const c=CAMPAIGNS[C.ci],m=c.missions[C.mi],P=api.players[0],E=api.players[1],b0=api.bases[0],b1=api.bases[1];
  C.t0=api.time;C.nextRaid=(m.raids?m.raids.first:0);C.wave=0;
  if(m.calm)api.aiS.nextAttack+=m.calm;
  if(m.raids)api.aiS.nextAttack=Math.max(api.aiS.nextAttack,m.raids.first+20);
  if(m.start&&m.start.res)for(const r in m.start.res)P.res[r]=(P.res[r]||0)+m.start.res[r];
  if(m.start&&m.start.army)for(const t in m.start.army)for(let k=0;k<m.start.army[t];k++)spawnNear(api,0,XY.units[t]?t:'infantry',b0.x+2,b0.y+6);
  if(m.enemy){const e=m.enemy;if(e.res)for(const r in E.res)E.res[r]=Math.round(E.res[r]*e.res);
    const types=unitsFor(E.epoch);for(let k=0;k<(e.army||0);k++)spawnNear(api,1,types[k%types.length],b1.x+2,b1.y+6);
    for(let k=0;k<(e.towers||0);k++){const s=freeSpot(api,b1.x+(k%2?-4:6),b1.y+(k%2?6:-3),(XY.buildings.tower||{}).size||1,8);if(s&&XY.buildings.tower)api.placeBld(1,'tower',s.x,s.y,true)}}
  if(m.vip){const u=spawnNear(api,0,XY.units[m.vip.type]?m.vip.type:'infantry',b0.x+1.5,b0.y+1.5);
    if(u){u.vip=1;u.hname=m.vip.name;u.maxhp=Math.round(u.maxhp*2.5);u.hp=u.maxhp}
    // Ziel: abseits der direkten Linie zwischen den Basen, quer zur Front
    const mx=(b0.x+b1.x)/2,my=(b0.y+b1.y)/2,dx=b1.x-b0.x,dy=b1.y-b0.y,l=Math.hypot(dx,dy)||1,s=(C.mi%2?1:-1);
    let tx=mx+(-dy/l)*24*s,ty=my+(dx/l)*24*s;tx=Math.max(5,Math.min(api.W-6,tx));ty=Math.max(5,Math.min(api.W-6,ty));
    const t=freeSpot(api,tx,ty,0,16)||{x:tx|0,y:ty|0};C.target={x:t.x+.5,y:t.y+.5};
    {const a=Math.atan2(C.target.y-b0.y,C.target.x-b0.x),k=Math.round(((a+Math.PI*2)%(Math.PI*2))/(Math.PI/4))%8;C.dir=['Osten','Südosten','Süden','Südwesten','Westen','Nordwesten','Norden','Nordosten'][k]}
    const types=unitsFor(E.epoch);for(let k=0;k<(m.guards||4);k++){const f=.45+.1*(k%3);spawnNear(api,1,types[k%types.length],b0.x+(C.target.x-b0.x)*f+(k%2?2:-2),b0.y+(C.target.y-b0.y)*f)}}
  hud.hidden=false;renderHud(api);
  api.toast('Mission: '+m.title,'good');
}
function goalState(api,g){
  const P=api.players[0],mine=api.ents.filter(e=>!e.dead&&e.owner===0);
  if(g.t==='build'){const n=mine.filter(e=>e.kind==='bld'&&e.type===g.type&&e.built).length;return[n>=g.n,Math.min(n,g.n)+'/'+g.n]}
  if(g.t==='army'){const n=mine.filter(api.isMil).length;return[n>=g.n,Math.min(n,g.n)+'/'+g.n]}
  if(g.t==='survive'){const left=g.sec-(api.time-C.t0);return[left<=0,left>0?fmt(left):'✓']}
  if(g.t==='collect'){const tot=P.tot||{};let ok=true,parts=[];for(const r in g.res){const v=Math.floor(tot[r]||0);if(v<g.res[r])ok=false;parts.push(Math.min(v,g.res[r])+'/'+g.res[r])}return[ok,parts.join(' · ')]}
  if(g.t==='destroy'){const tcs=api.ents.filter(e=>!e.dead&&e.owner===1&&e.type==='tc').length;return[tcs===0,tcs?tcs+' übrig':'✓']}
  if(g.t==='epoch')return[P.epoch>=g.n,(P.epoch+1)+'/'+(g.n+1)];
  if(g.t==='escort'){const v=api.ents.find(e=>e.vip&&!e.dead&&e.owner===0);if(!v||!C.target)return[false,'–'];const d=Math.hypot(v.x-C.target.x,v.y-C.target.y);return[d<2.5,Math.round(d)+' Felder']}
  return[false,''];
}
const hud=document.createElement('div');hud.id='campHud';hud.hidden=true;hud.title='Klicken zum Ein- und Ausklappen';
hud.onclick=()=>hud.classList.toggle('min');
function mountHud(){const st=document.getElementById('stage');if(st&&hud.parentNode!==st)st.appendChild(hud)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountHud);else mountHud();
function renderHud(api){
  if(!C){hud.hidden=true;return}mountHud();
  const c=CAMPAIGNS[C.ci],m=c.missions[C.mi],P=api.players[0];
  const rows=m.goals.map(g=>{const [ok,p]=goalState(api,g);return `<li class="${ok?'ok':''}"><span>${ok?'✓':'○'}</span><span>${esc(goalText(g,P.epoch))}</span><span class="p">${esc(p)}</span></li>`}).join('');
  const el=api.time-C.t0;
  hud.innerHTML=`<h4><span>${esc(m.title)}</span><span style="color:var(--muted);font-family:var(--f-ui);font-size:12px">${fmt(el)}</span></h4><ul>${rows}</ul>`+
    (m.limit?`<div class="warn">Zeitlimit: noch ${fmt(m.limit-el)}</div>`:'')+(m.vip?`<div class="warn">${esc(m.vip.name)} muss überleben.</div>`:'');
}
function raidTick(api){
  const m=CAMPAIGNS[C.ci].missions[C.mi];if(!m.raids)return;
  const el=api.time-C.t0;if(el<C.nextRaid||el>=(m.goals.find(g=>g.t==='survive')||{sec:1e9}).sec)return;
  C.nextRaid=el+m.raids.every;const n=m.raids.n+C.wave*m.raids.grow+(C.diff-1);C.wave++;
  const E=api.players[1],b1=api.bases[1],types=unitsFor(E.epoch);
  const tc=api.ents.find(e=>!e.dead&&e.owner===0&&e.type==='tc')||api.ents.find(e=>!e.dead&&e.owner===0&&e.kind==='bld');if(!tc)return;
  for(let k=0;k<Math.max(2,n);k++){const u=spawnNear(api,1,types[(k+C.wave)%types.length],b1.x+2+(k%3),b1.y+5);if(u){u.raid=1;api.order(u,{t:'attack',target:tc.id,forced:true})}}
  api.toast('Angriffswelle '+C.wave+' rückt an!','warn');
}
function finish(api,win,text){if(C.ended)return;C.ended=true;api.endGame(win,text)}
function checkMission(api){
  const m=CAMPAIGNS[C.ci].missions[C.mi],el=api.time-C.t0;
  // Raider ohne Ziel wieder auf die Stadt hetzen
  for(const u of api.ents)if(u.raid&&!u.dead&&u.order&&u.order.t==='idle'){const t=api.ents.find(e=>!e.dead&&e.owner===0&&e.kind==='bld');if(t)api.order(u,{t:'attack',target:t.id,forced:true})}
  if(m.vip&&!api.ents.some(e=>e.vip&&!e.dead&&e.owner===0))return finish(api,false,m.vip.name+' ist gefallen. Die Mission ist gescheitert.');
  if(m.goals.every(g=>goalState(api,g)[0]))return finish(api,true,'Alle Missionsziele erfüllt.');
  if(m.limit&&el>=m.limit)return finish(api,false,'Die Zeit ist abgelaufen.');
}

// ===== Ende einer Mission =====
function onEnd(api,win){
  hud.hidden=true;
  const old=document.getElementById('campEnd');if(old)old.remove();
  if(!C)return;
  const c=CAMPAIGNS[C.ci],m=c.missions[C.mi],el=api.time-C.t0,ci=C.ci,mi=C.mi;
  if(win){const p=readProg(),cp=p[c.id]=p[c.id]||{done:{}};cp.done=cp.done||{};const prev=cp.done[mi];
    if(!prev||el<prev.t)cp.done[mi]={t:Math.round(el),diff:C.diff,at:Date.now()};writeProg(p)}
  const last=mi===c.missions.length-1;
  C=null;
  setTimeout(()=>{
    const card=document.querySelector('#endScreen .card')||document.getElementById('endScreen');
    document.getElementById('endTitle').textContent=win?'Mission erfüllt':'Mission gescheitert';
    const box=document.createElement('div');box.id='campEnd';
    box.innerHTML=(win?`<p class="cpBrief">${esc(m.win)}</p>`+(last?'':`<p class="tag" style="font-size:15px">Freigeschaltet: <b style="color:var(--bronze-hi)">${esc(c.missions[mi+1].title)}</b></p>`)
      :`<p class="cpBrief">Der Feldzug ist noch nicht verloren. Sammle deine Kräfte und versuche es erneut.</p>`)+
      `<div class="cpRow">${win&&!last?'<button class="go" data-next>Nächste Mission</button>':''}${win&&last?'<button class="go" data-final>Abschluss ansehen</button>':''}${!win?'<button class="go" data-retry>Erneut versuchen</button>':''}<button class="opt" data-cmenu>Missionsliste</button></div>`;
    const st=document.getElementById('endStats');card.insertBefore(box,st&&st.parentNode===card?st:null);
    const toMenu=()=>{XY.game.menu()};
    box.onclick=e=>{const b=e.target.closest('button');if(!b)return;
      if(b.hasAttribute('data-next')){toMenu();openBrief(ci,mi+1)}
      else if(b.hasAttribute('data-retry')){toMenu();openBrief(ci,mi)}
      else if(b.hasAttribute('data-final')){toMenu();openFinal(ci)}
      else if(b.hasAttribute('data-cmenu')){toMenu();openMenu(c)}};
    if(win&&last)setTimeout(()=>{if(!document.getElementById('endScreen').hidden){toMenu();openFinal(ci)}},2600);
  },0);
}
function openFinal(ci){
  const c=CAMPAIGNS[ci],d=(readProg()[c.id]||{}).done||{};let total=0;
  const rows=c.missions.map((m,i)=>{const x=d[i];if(x)total+=x.t;return `<span>${esc(m.title)}</span><span>${x?fmt(x.t):'–'}</span><span>${x?['Leicht','Normal','Schwer'][x.diff]||'':''}</span>`}).join('');
  finalO.innerHTML=`<div class="cpCard" style="align-items:stretch"><svg class="cpMedal" viewBox="0 0 96 96"><path d="M34 4h28l-6 30H40z" fill="#7a2a24"/><path d="M40 4h16l-4 30h-8z" fill="#a8423a"/>
    <circle cx="48" cy="58" r="30" fill="#b8892f"/><circle cx="48" cy="58" r="25" fill="#e2bb5c" stroke="#8a6420" stroke-width="2"/><g transform="translate(24 34)">${(EMB[c.emblem]||'').replace('<svg viewBox="0 0 48 48">','<svg viewBox="0 0 48 48" width="48" height="48">')}</g></svg>
    <small style="color:var(--muted);letter-spacing:.12em;text-transform:uppercase;text-align:center">Kampagne abgeschlossen</small>
    <h1 style="text-align:center">${esc(c.name)}</h1><p class="cpBrief">${esc(c.epilog)}</p>
    <div class="stattbl"><span class="h">Mission</span><span class="h">Bestzeit</span><span class="h">Stufe</span>${rows}<span><b>Gesamt</b></span><span><b>${fmt(total)}</b></span><span></span></div>
    <div class="row"><button class="go" data-camps>Zur Kampagnenauswahl</button><button class="opt" data-close>Hauptmenü</button></div></div>`;
  finalO.hidden=false;
  finalO.querySelector('[data-camps]').onclick=()=>{finalO.hidden=true;openMenu(null)};
  finalO.querySelector('[data-close]').onclick=()=>{finalO.hidden=true};
}

// ===== Knopf im Hauptmenü =====
function addBtn(){const sb=document.getElementById('startBtn');if(!sb||document.getElementById('campBtn'))return;
  const b=document.createElement('button');b.className='go';b.id='campBtn';b.textContent='Kampagne';b.onclick=()=>openMenu(null);
  sb.parentNode.insertBefore(b,sb.nextSibling)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addBtn);else setTimeout(addBtn,0);
window.__kampagne={list:CAMPAIGNS,open:openMenu,brief:openBrief,start:startMission,final:openFinal,get state(){return C},progress:readProg,
  reset(){try{localStorage.removeItem(KEY)}catch(e){}}};

EmpireXY.register({
  id:'kern-kampagne',name:'Kern: Kampagnen',version:'1.0.0',core:true,
  description:'Drei Kampagnen (Rom, Mittelalter, Industrie) mit 19 Missionen: Aufbau, Überleben, Wirtschaft, Rettung und Eroberung.',
  hooks:{
    start(api){lastApi=api;C=pending;pending=null;const old=document.getElementById('campEnd');if(old)old.remove();
      if(C)setupMission(api);else hud.hidden=true},
    tick(api,dt){if(!C||C.ended)return;lastApi=api;if((C._t=(C._t||0)+dt)<.5)return;C._t=0;raidTick(api);checkMission(api);if(C&&!C.ended)renderHud(api)},
    end(api,win){onEnd(api,win)},
    save(data){if(C&&!C.ended){const {_t,...rest}=C;data.kampagne=rest}},
    load(api,d){C=d.kampagne&&CAMPAIGNS[d.kampagne.ci]?{...d.kampagne}:null;if(C){renderHud(api);hud.hidden=false}else hud.hidden=true},
    draw(g,D){if(!C||!lastApi)return;const T=D.T,t=D.time;
      if(C.target){const x=C.target.x*T,y=C.target.y*T,p=.5+.5*Math.sin(t*3);
        g.save();g.strokeStyle=`rgba(233,190,114,${.45+.4*p})`;g.lineWidth=2;g.beginPath();g.ellipse(x,y,T*2.5,T*1.4,0,0,7);g.stroke();
        g.setLineDash([5,5]);g.lineDashOffset=-t*12;g.beginPath();g.ellipse(x,y,T*1.6+p*4,T*.9+p*2,0,0,7);g.stroke();g.setLineDash([]);
        g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(x+2,y+2,6,2.5,0,0,7);g.fill();
        g.strokeStyle='#4a3a26';g.lineWidth=2;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-34);g.stroke();
        const w=Math.sin(t*4)*2;g.fillStyle='#8a2a22';g.beginPath();g.moveTo(x,y-34);g.quadraticCurveTo(x+9,y-31+w,x+18,y-30);g.lineTo(x+18,y-21);g.quadraticCurveTo(x+9,y-22+w,x,y-24);g.closePath();g.fill();
        g.fillStyle='#e9be72';g.beginPath();g.arc(x+9,y-27.5+w*.4,2,0,7);g.fill();g.restore()}
      for(const u of lastApi.ents){if(!u.vip||u.dead)continue;const x=u.x*T,y=u.y*T;g.save();
        g.strokeStyle=`rgba(233,190,114,${.55+.3*Math.sin(t*4)})`;g.lineWidth=1.5;g.beginPath();g.ellipse(x,y+6,13,6,0,0,7);g.stroke();
        g.font='600 11px sans-serif';g.textAlign='center';g.lineWidth=3;g.strokeStyle='rgba(0,0,0,.7)';g.strokeText(u.hname||'',x,y-30);g.fillStyle='#f3e0b0';g.fillText(u.hname||'',x,y-30);g.restore()}},
  },
});
})();
