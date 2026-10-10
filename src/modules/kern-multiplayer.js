// Kern-Baustein: Mehrspieler für 2 bis 4 Spieler (jeder mit eigenem Volk und eigener Farbe).
//
// Architektur: Peer-to-Peer über WebRTC, ohne eigenen Server. Ein Spieler ist Gastgeber. Er vergibt einen Raum-Code,
// die anderen verbinden sich direkt mit ihm (Sternform). Zum Finden der Mitspieler dient der kostenlose PeerJS-Vermittler,
// danach laufen alle Daten direkt zwischen den Rechnern. Für Tests auf einem PC gibt es die Verbindung „Dieser PC“
// (mehrere Fenster oder Tabs über BroadcastChannel). Eine Steam-Anbindung (Steamworks P2P) passt später als weitere
// Verbindungsart in TRANSPORTS, der Rest bleibt gleich.
//
// Synchronisation: Lockstep. Kein Rechner verändert den Spielstand direkt. Jeder Klick wird als Befehl an den Gastgeber
// geschickt. Der Gastgeber sammelt alle Befehle und verschickt alle 100 ms einen „Takt“ mit den Befehlen, die in diesem
// Takt gelten. Alle Rechner führen dieselben Befehle im selben Takt aus und rechnen danach 3 Simulationsschritte.
// Weil die Simulation deterministisch ist (fester Zeitschritt, gemeinsamer Zufallsgenerator), bleiben alle Spiele gleich.
// Alle 10 Takte wird eine Prüfsumme verglichen, um Abweichungen (Desync) zu melden.
(function(){
'use strict';
const XY=window.EmpireXY;
const PROTO=1,TURN=.1,STEPS=3,DELAY=3,MAXLEAD=20,TIMEOUT=10000,MAXP=4;
const CODECH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PEERJS='https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
const G=()=>XY.game;
const $=s=>document.querySelector(s);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store={get(k,d){try{const v=localStorage.getItem('empire-xy.mp.'+k);return v==null?d:v}catch(e){return d}},set(k,v){try{localStorage.setItem('empire-xy.mp.'+k,v)}catch(e){}}};
const now=()=>performance.now();
const modSig=()=>XY.modules.filter(m=>m.enabled).map(m=>m.id+'@'+(m.version||'')).sort();

// ================= Verbindungen =================
// Jede Verbindung liefert Objekte {send(obj), close(), onmsg, onclose}
function mkConn(sendFn,closeFn){const c={onmsg:null,onclose:null,open:true,
  send(o){if(c.open)try{sendFn(o)}catch(e){}},
  close(){if(!c.open)return;c.open=false;try{closeFn()}catch(e){}if(c.onclose)c.onclose()},
  _msg(o){if(c.open&&c.onmsg)c.onmsg(o)},_closed(){if(!c.open)return;c.open=false;if(c.onclose)c.onclose()}};return c}

const TRANSPORTS={
  // Mehrere Fenster oder Tabs auf demselben PC (zum Ausprobieren ohne Internet)
  local:{name:'Dieser PC (Test mit mehreren Fenstern)',
    host(code,onConn){return new Promise(res=>{
      const ch=new BroadcastChannel('empire-xy-'+code),conns=new Map();let taken=false;
      // erst prüfen, ob es den Raum schon gibt
      ch.onmessage=e=>{const m=e.data;if(m.to==='probe'&&m.t==='here')taken=true};ch.postMessage({to:'host',from:'probe',t:'probe'});
      setTimeout(()=>{if(taken){ch.close();res({error:'Dieser Raum-Code ist schon vergeben.'});return}
        ch.onmessage=e=>{const m=e.data;if(m.to!=='host')return;
          if(m.t==='probe'){ch.postMessage({to:m.from,from:'host',t:'here'});return}
          let c=conns.get(m.from);
          if(m.t==='open'){if(!c){c=mkConn(d=>ch.postMessage({to:m.from,from:'host',d}),()=>ch.postMessage({to:m.from,from:'host',t:'close'}));conns.set(m.from,c);onConn(c)}ch.postMessage({to:m.from,from:'host',t:'ok'});return}
          if(!c)return;if(m.t==='close'){conns.delete(m.from);c._closed();return}c._msg(m.d)};
        res({close(){for(const c of conns.values())c.close();ch.close()}})},250)})},
    join(code){return new Promise(res=>{
      const ch=new BroadcastChannel('empire-xy-'+code),me='c'+Math.random().toString(36).slice(2,9);let c=null;
      const t=setTimeout(()=>{ch.close();res({error:'Kein offenes Spiel mit diesem Code gefunden.'})},2500);
      ch.onmessage=e=>{const m=e.data;if(m.to!==me)return;
        if(m.t==='ok'&&!c){clearTimeout(t);c=mkConn(d=>ch.postMessage({to:'host',from:me,d}),()=>{ch.postMessage({to:'host',from:me,t:'close'});ch.close()});res({conn:c});return}
        if(!c)return;if(m.t==='close'){c._closed();ch.close();return}c._msg(m.d)};
      ch.postMessage({to:'host',from:me,t:'open'})})},
  },
  // Internet: WebRTC Peer-to-Peer, Vermittlung über den öffentlichen PeerJS-Server
  web:{name:'Internet (WebRTC, Code teilen)',
    lib(){if(window.Peer)return Promise.resolve();return new Promise((res,rej)=>{const s=document.createElement('script');s.src=PEERJS;s.onload=()=>res();s.onerror=()=>rej(new Error('PeerJS konnte nicht geladen werden. Besteht eine Internetverbindung?'));document.head.appendChild(s)})},
    wrap(dc){const c=mkConn(o=>dc.send(o),()=>dc.close());dc.on('data',d=>c._msg(d));dc.on('close',()=>c._closed());dc.on('error',()=>c._closed());return c},
    async host(code,onConn){
      try{await this.lib()}catch(e){return{error:e.message}}
      return new Promise(res=>{const peer=new window.Peer('empire-xy-'+code.toLowerCase());let done=false;
        peer.on('open',()=>{done=true;res({close(){peer.destroy()}})});
        peer.on('connection',dc=>{dc.on('open',()=>onConn(this.wrap(dc)))});
        peer.on('error',e=>{if(!done){done=true;peer.destroy();res({error:e.type==='unavailable-id'?'Dieser Raum-Code ist schon vergeben.':'Vermittlung nicht erreichbar ('+(e.type||e.message)+').'})}});
        setTimeout(()=>{if(!done){done=true;peer.destroy();res({error:'Der Vermittlungsserver antwortet nicht.'})}},12000)})},
    async join(code){
      try{await this.lib()}catch(e){return{error:e.message}}
      return new Promise(res=>{const peer=new window.Peer();let done=false;const fin=r=>{if(!done){done=true;res(r)}};
        peer.on('open',()=>{const dc=peer.connect('empire-xy-'+code.toLowerCase(),{reliable:true,serialization:'json'});
          dc.on('open',()=>{const c=this.wrap(dc);const cl=c.close;c.close=()=>{cl();peer.destroy()};fin({conn:c})})});
        peer.on('error',e=>{peer.destroy();fin({error:e.type==='peer-unavailable'?'Kein offenes Spiel mit diesem Code gefunden.':'Verbindung fehlgeschlagen ('+(e.type||e.message)+').'})});
        setTimeout(()=>{peer.destroy();fin({error:'Zeitüberschreitung beim Verbinden.'})},15000)})},
  },
};

// ================= Sitzung =================
let S=null; // aktuelle Sitzung (Lobby oder Spiel)
function newSession(host,code,transport){
  return {host,code,transport,me:0,phase:'lobby',players:[],conn:null,srv:null,chat:[],
    settings:{epStart:+($('#epStartSel')||{}).value||0,epEnd:+(($('#epEndSel')||{}).value??99),limit:+($('#limitSel')||{}).value||0},
    // Lockstep
    turns:new Map(),cur:0,acc:0,gen:0,genAcc:0,pending:[],paused:false,hashes:{},desync:false,stallT:0,lastHeard:now(),pingT:0,ping:0};
}
const myName=()=>(store.get('name','')||'').trim().slice(0,16)||'Spieler';
function sendAll(o,except){for(const p of S.players)if(p.conn&&p.conn!==except)p.conn.send(o)}
function toHost(o){if(S.host)onHostMsg(S.players[0],o);else if(S.conn)S.conn.send(o)}

// ---------- Gastgeber ----------
async function hostGame(transport){
  const code=Array.from({length:5},()=>CODECH[Math.random()*CODECH.length|0]).join('');
  S=newSession(true,code,transport);
  S.players=[{name:myName(),civ:store.get('civ','roemer'),ready:true,host:true,conn:null,ping:0}];
  ui.status('Spiel wird eröffnet …');
  const r=await TRANSPORTS[transport].host(code,c=>onJoin(c));
  if(r.error){S=null;ui.status(r.error,true);return}
  S.srv=r;ui.showLobby();lobbyUpdate();
}
function onJoin(c){
  const p={name:'?',civ:'roemer',ready:false,conn:c,ping:0,lastHeard:now(),ack:-1,pending:true};
  c.onmsg=m=>{p.lastHeard=now();onHostMsg(p,m)};
  c.onclose=()=>dropPlayer(p);
  setTimeout(()=>{if(p.pending)c.close()},8000);
}
function onHostMsg(p,m){
  if(!S||!m||typeof m!=='object')return;
  if(p.pending){
    if(m.t!=='hello')return;
    const why=S.phase!=='lobby'?'Das Spiel läuft bereits.':S.players.length>=MAXP?'Das Spiel ist voll (höchstens '+MAXP+' Spieler).':m.ver!==PROTO?'Andere Spielversion. Bitte beide auf denselben Stand bringen.':null;
    const mine=modSig(),theirs=Array.isArray(m.mods)?m.mods:[];
    const diff=mine.filter(x=>!theirs.includes(x)).concat(theirs.filter(x=>!mine.includes(x)));
    if(why||diff.length){p.conn.send({t:'reject',why:why||'Unterschiedliche Bausteine: '+diff.join(', ')+'. Alle Spieler brauchen dieselben Bausteine.'});setTimeout(()=>p.conn.close(),300);return}
    p.pending=false;p.name=String(m.name||'Spieler').slice(0,16);p.civ=String(m.civ||'roemer');S.players.push(p);
    sysChat(p.name+' ist beigetreten.');lobbyUpdate();return}
  switch(m.t){
    case 'set':if(S.phase!=='lobby')return;if(typeof m.civ==='string')p.civ=m.civ.slice(0,20);if(typeof m.ready==='boolean')p.ready=m.ready;if(typeof m.name==='string'&&m.name.trim())p.name=m.name.trim().slice(0,16);lobbyUpdate();break;
    case 'chat':{const text=String(m.text||'').slice(0,160).trim();if(!text)return;const o={t:'chat',from:p.name,slot:S.players.indexOf(p),text};sendAll(o);onClientMsg(o);break}
    case 'cmd':if(S.phase==='game'&&m.c&&typeof m.c.k==='string')S.pending.push([S.players.indexOf(p),m.c]);break;
    case 'ack':p.ack=Math.max(p.ack,m.n|0);break;
    case 'pong':p.ping=Math.round(now()-m.ts);break;
    case 'hash':checkHash(S.players.indexOf(p),m.n|0,m.h);break;
    case 'pause':if(S.phase==='game')setPause(!!m.on,p.name);break;
    case 'leave':p.conn&&p.conn.close();break;
  }
}
function dropPlayer(p){
  if(!S||!S.host)return;const i=S.players.indexOf(p);if(i<0)return;
  if(S.phase==='lobby'){S.players.splice(i,1);sysChat(p.name+' hat die Lobby verlassen.');lobbyUpdate();return}
  if(p.gone)return;p.gone=true;p.conn=null;S.pending.push([i,{k:'leave'}]);sysChat(p.name+' hat die Verbindung verloren.');
}
function lobbyUpdate(){
  if(!S||!S.host)return;
  const list=S.players.map(p=>({name:p.name,civ:p.civ,ready:p.ready,host:!!p.host,ping:p.ping}));
  S.players.forEach((p,i)=>{const o={t:'lobby',you:i,code:S.code,players:list,settings:S.settings};if(p.conn)p.conn.send(o);else onClientMsg(o)});
}
function sysChat(text){const o={t:'chat',from:'',slot:-1,text};sendAll(o);onClientMsg(o)}
function startGame(){
  if(!S||!S.host||S.phase!=='lobby')return;
  if(S.players.length<2){ui.status('Mindestens zwei Spieler werden gebraucht.',true);return}
  if(!S.players.every(p=>p.ready)){ui.status('Noch nicht alle Spieler sind bereit.',true);return}
  const cfg={seed:(Math.random()*99999)|0,players:S.players.map(p=>({name:p.name,civ:p.civ})),epStart:S.settings.epStart,epEnd:S.settings.epEnd,timeLimit:S.settings.limit};
  S.players.forEach((p,i)=>{const o={t:'start',cfg:Object.assign({},cfg,{me:i})};if(p.conn)p.conn.send(o);else onClientMsg(o)});
  // die ersten Takte sind leer, damit Befehle einen kleinen Vorlauf haben
  for(let n=0;n<DELAY;n++){const o={t:'turn',n,cmds:[]};sendAll(o);S.turns.set(n,[])}
  S.gen=DELAY;
}
function hostTick(dt){
  if(S.paused){S.genAcc=0;return}
  S.genAcc+=dt;
  while(S.genAcc>=TURN){
    let minAck=S.cur-1;for(const p of S.players)if(p.conn&&!p.gone)minAck=Math.min(minAck,p.ack);
    if(S.gen-minAck>MAXLEAD){S.genAcc=Math.min(S.genAcc,TURN);break} // ein Mitspieler hängt hinterher: warten
    const o={t:'turn',n:S.gen,cmds:S.pending.splice(0)};sendAll(o);S.turns.set(S.gen,o.cmds);S.gen++;S.genAcc-=TURN;
  }
  S.pingT-=dt;if(S.pingT<=0){S.pingT=1;hostPing()}
}
// Ping an alle, Zeitüberschreitung erkennen (auch in der Lobby)
function hostPing(){const ts=now();
  for(const p of S.players){if(!p.conn)continue;p.conn.send({t:'ping',ts});if(ts-p.lastHeard>TIMEOUT)p.conn.close()}
  const o={t:'pings',v:S.players.map(p=>p.conn?p.ping:p.gone?-1:0)};sendAll(o);onClientMsg(o)}
setInterval(()=>{if(!S||S.phase!=='lobby')return;if(S.host)hostPing();else if(!S.closing&&now()-S.lastHeard>TIMEOUT&&S.conn)S.conn.close()},1000);
function checkHash(slot,n,h){
  const e=S.hashes[n]=S.hashes[n]||{};e[slot]=h;
  if(e[0]!==undefined)for(const k in e)if(e[k]!==e[0]&&!S.desync){S.desync=true;const o={t:'desync',n,who:S.players[k]?S.players[k].name:'?'};sendAll(o);onClientMsg(o)}
  for(const k in S.hashes)if(+k<n-200)delete S.hashes[k];
}
function setPause(on,by){if(!S||!S.host)return;S.paused=on;const o={t:'pause',on,by};sendAll(o);onClientMsg(o)}

// ---------- Mitspieler ----------
async function joinGame(transport,code){
  code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length<4){ui.status('Bitte den Raum-Code des Gastgebers eingeben.',true);return}
  ui.status('Verbinde …');
  const r=await TRANSPORTS[transport].join(code);
  if(r.error){ui.status(r.error,true);return}
  S=newSession(false,code,transport);S.conn=r.conn;
  r.conn.onmsg=m=>{S&&(S.lastHeard=now());onClientMsg(m)};
  r.conn.onclose=()=>lostHost();
  r.conn.send({t:'hello',ver:PROTO,name:myName(),civ:store.get('civ','roemer'),mods:modSig()});
}
function lostHost(){
  if(!S||S.host||S.closing)return;const inGame=S.phase==='game';S.closing=true;
  if(inGame&&G().running){G().end('Die Verbindung zum Gastgeber ist abgebrochen.')}
  else if(!inGame){S=null;ui.showMenu();ui.status('Der Gastgeber hat das Spiel geschlossen.',true)}
  ui.hud();
}
// Nachrichten an alle Spieler (auch der Gastgeber verarbeitet sie für sich selbst hier)
function onClientMsg(m){
  if(!S||!m)return;
  switch(m.t){
    case 'reject':{ui.status(m.why,true);const c=S.conn;S.closing=true;S=null;if(c)c.close();ui.showMenu();break}
    case 'lobby':S.me=m.you;S.players=S.host?S.players:m.players;S.lobby=m;S.settings=m.settings;if(S.phase==='lobby'){ui.showLobby();ui.lobby()}break;
    case 'chat':S.chat.push({from:m.from,slot:m.slot,text:m.text,t:now()});if(S.chat.length>60)S.chat.shift();ui.chat();break;
    case 'start':S.phase='game';S.me=m.cfg.me;S.names=m.cfg.players.map(p=>p.name);ui.hideAll();G().start(m.cfg);ui.hud();break;
    case 'turn':if(S.phase==='game'&&!S.host)S.turns.set(m.n|0,Array.isArray(m.cmds)?m.cmds:[]);break;
    case 'ping':if(S.conn)S.conn.send({t:'pong',ts:m.ts});break;
    case 'pings':S.pings=m.v;if(!S.host)S.ping=m.v[S.me]||0;ui.hud();break;
    case 'pause':S.paused=m.on;G().setPaused(m.on);G().toast(m.on?(m.by?m.by+' hat':'Das Spiel wurde')+' pausiert.':'Weiter geht’s.');break;
    case 'desync':G().toast('Achtung: Die Spielstände weichen voneinander ab (bei '+m.who+'). Bitte die Partie neu starten.','warn');break;
  }
}

// ---------- Lockstep (läuft in jedem Bild über den Spiel-Loop) ----------
function advance(dt){
  if(!S||S.phase!=='game')return;
  if(S.host)hostTick(dt);
  else if(!S.closing&&now()-S.lastHeard>TIMEOUT){S.conn&&S.conn.close();return}
  // Bei Pause schickt der Gastgeber keine neuen Takte mehr; bereits empfangene werden noch abgearbeitet
  S.acc=Math.min(S.acc+dt,TURN*6);
  const behind=S.turns.size>DELAY+1;let ran=0;const max=behind?8:2; // wer zurückliegt, holt schneller auf
  while((S.acc>=TURN||behind&&ran<max)&&S.turns.has(S.cur)&&ran<max){
    const cmds=S.turns.get(S.cur);S.turns.delete(S.cur);
    for(const pc of cmds)if(Array.isArray(pc))G().exec(pc[0]|0,pc[1]||{});
    for(let i=0;i<STEPS;i++)G().step();
    const n=S.cur++;S.acc=Math.max(0,S.acc-TURN);ran++;
    if(S.host)S.players[0].ack=n;else S.conn.send({t:'ack',n});
    if(n%10===0){const h=G().hash();if(S.host)checkHash(0,n,h);else S.conn.send({t:'hash',n,h})}
    if(!G().running)break;
  }
  if(!S.turns.has(S.cur)&&S.acc>=TURN){S.acc=TURN;S.stallT+=dt}else S.stallT=0;
  ui.wait(S.stallT>.6&&!S.paused);
}
const net={
  get active(){return !!S&&S.phase==='game'},
  advance,
  command(c){if(!S||S.phase!=='game')return;if(S.host)S.pending.push([0,c]);else S.conn.send({t:'cmd',c})},
  pause(on){if(!S)return;if(S.host)setPause(on,S.players[0].name);else S.conn.send({t:'pause',on})},
  gameOver(){if(S)S.over=true},
  leave(){
    if(S){S.closing=true;if(S.host){if(S.srv)S.srv.close();for(const p of S.players)if(p.conn)p.conn.close()}else if(S.conn){S.conn.send({t:'leave'});const c=S.conn;setTimeout(()=>c.close(),200)}}
    const wasGame=S&&S.phase==='game';S=null;ui.hideAll();ui.hud();if(wasGame&&G())G().quit();
  },
  chat(text){text=String(text||'').trim().slice(0,160);if(!text||!S)return;if(S.host)onHostMsg(S.players[0],{t:'chat',text});else S.conn.send({t:'chat',text})},
  get session(){return S},
};
XY.net=net;
window.addEventListener('beforeunload',()=>{if(S)net.leave()});

// ================= Oberfläche =================
const CSS=`
#mpScreen .card{width:min(620px,100%)}
#mpScreen input[type=text]{background:var(--panel-2);border:1px solid var(--line);border-radius:4px;color:var(--text);padding:6px 10px;font:inherit;font-size:15px}
#mpCode{width:8ch;text-transform:uppercase;letter-spacing:.15em}
#mpStatus{min-height:1.3em;font-size:14px;color:var(--muted);margin:0}#mpStatus.err{color:var(--danger)}
.mpCodeBig{font-family:var(--f-display);font-size:30px;letter-spacing:.2em;color:var(--bronze-hi)}
#mpPlayers{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
#mpPlayers li{display:grid;grid-template-columns:14px 1fr auto auto;gap:10px;align-items:center;background:var(--panel-2);border:1px solid var(--line);border-radius:4px;padding:6px 10px}
#mpPlayers li.empty{opacity:.45}
#mpPlayers .sw{width:14px;height:14px;border-radius:3px}
#mpPlayers .st{font-size:13px;color:var(--muted)}#mpPlayers .st.ok{color:var(--ok)}
#mpPlayers select{max-width:210px}
.mpChatLog{height:140px;overflow:auto;background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:4px;padding:6px 8px;font-size:14px;display:flex;flex-direction:column;gap:2px}
.mpChatLog .sys{color:var(--muted);font-style:italic}
.mpChatLog b{font-weight:600}
#mpIngame{position:absolute;left:12px;bottom:12px;z-index:6;width:min(380px,70%);display:flex;flex-direction:column;gap:4px;pointer-events:none}
#mpIngame .ln{background:rgba(10,14,16,.72);border-radius:4px;padding:3px 8px;font-size:14px;transition:opacity .6s}
#mpIngame .ln.old{opacity:0}
#mpIngame input{pointer-events:auto;background:rgba(10,14,16,.9);border:1px solid var(--bronze);border-radius:4px;color:var(--text);padding:5px 8px;font:inherit;font-size:14px}
#mpWait{position:absolute;top:50px;left:50%;transform:translateX(-50%);z-index:8;background:rgba(10,14,16,.85);border:1px solid var(--line);border-radius:6px;padding:6px 14px;font-size:14px}
#mpPanel{position:absolute;top:52px;right:10px;z-index:7;width:320px;max-width:calc(100vw - 32px);background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.45)}
#mpPanel h3{margin:0;font-size:15px}#mpPanel .pr{display:grid;grid-template-columns:12px 1fr auto;gap:8px;align-items:center;font-size:14px}
#mpPanel .sw{width:12px;height:12px;border-radius:3px}#mpPanel .hint{margin:0;font-size:11px;color:var(--muted)}
#mpPanel .trib{display:flex;gap:4px;flex-wrap:wrap;grid-column:2/4}
`;
const pc=i=>(G()&&G().PCOL[i])||['#4a8ae8','#d4473c','#4f9e48','#d9ad35'][i];
const civs=()=>{const C=G()&&G().CIVS();return C?Object.entries(C):[['roemer',{name:'Römer'}]]};
const civName=k=>{const c=civs().find(x=>x[0]===k);return c?c[1].name:k};
const ui={
  init(){
    if($('#mpScreen'))return;const sb=$('#startBtn');if(!sb)return;
    const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
    const b=document.createElement('button');b.className='opt';b.id='mpBtn';b.textContent='Mehrspieler';b.title='Mit bis zu drei Freunden spielen';sb.after(b);b.onclick=()=>ui.showMenu();
    const o=document.createElement('div');o.className='overlay';o.id='mpScreen';o.hidden=true;
    o.innerHTML=`<div class="card">
      <h1>Mehrspieler</h1>
      <div id="mpMenu" style="display:flex;flex-direction:column;gap:14px">
        <p class="tag">Bis zu vier Spieler, jeder mit eigenem Volk und eigener Farbe. Einer eröffnet das Spiel und schickt den anderen den Raum-Code.</p>
        <div class="row"><span class="lbl">Dein Name</span><input type="text" id="mpName" maxlength="16" autocomplete="off"></div>
        <div class="row"><span class="lbl">Verbindung</span><label class="epsel"><select id="mpTransport">${Object.entries(TRANSPORTS).sort((a,b)=>a[0]==='web'?-1:1).map(([k,t])=>`<option value="${k}">${t.name}</option>`).join('')}</select></label></div>
        <div class="row"><button class="go" id="mpHost">Spiel eröffnen</button></div>
        <div class="row"><span class="lbl">Beitreten</span><input type="text" id="mpCode" maxlength="6" placeholder="CODE" autocomplete="off"><button class="opt" id="mpJoin">Beitreten</button></div>
      </div>
      <div id="mpLobby" hidden style="display:flex;flex-direction:column;gap:14px">
        <div class="row"><span class="lbl">Raum-Code</span><span class="mpCodeBig" id="mpCodeShow"></span><button class="opt" id="mpCopy">Kopieren</button></div>
        <ul id="mpPlayers"></ul>
        <div class="row" id="mpSet"></div>
        <div class="mpChatLog" id="mpChatLog" aria-live="polite"></div>
        <div class="row"><input type="text" id="mpChatIn" maxlength="160" placeholder="Nachricht an alle, Enter zum Senden" style="flex:1" autocomplete="off"></div>
        <div class="row"><button class="go" id="mpStart" hidden>Spiel starten</button><button class="opt" id="mpReady">Bereit</button><button class="opt" id="mpLeave">Lobby verlassen</button></div>
      </div>
      <p id="mpStatus"></p>
      <div class="row"><button class="opt" id="mpBack">Zurück zum Hauptmenü</button></div>
    </div>`;
    document.body.appendChild(o);
    $('#mpName').value=myName()==='Spieler'&&!store.get('name','')?'':myName();$('#mpName').placeholder='Spieler';
    $('#mpName').onchange=()=>store.set('name',$('#mpName').value.trim().slice(0,16));
    $('#mpTransport').value=store.get('transport','web');$('#mpTransport').onchange=()=>store.set('transport',$('#mpTransport').value);
    $('#mpHost').onclick=()=>{store.set('name',$('#mpName').value.trim().slice(0,16));hostGame($('#mpTransport').value)};
    $('#mpJoin').onclick=()=>{store.set('name',$('#mpName').value.trim().slice(0,16));joinGame($('#mpTransport').value,$('#mpCode').value)};
    $('#mpCode').onkeydown=e=>{if(e.key==='Enter')$('#mpJoin').click()};
    $('#mpBack').onclick=()=>{if(S)net.leave();ui.hideAll();$('#startScreen').hidden=false};
    $('#mpLeave').onclick=()=>{net.leave();ui.showMenu()};
    $('#mpCopy').onclick=()=>{try{navigator.clipboard.writeText(S.code);ui.status('Code kopiert.')}catch(e){}};
    $('#mpStart').onclick=()=>startGame();
    $('#mpReady').onclick=()=>{if(!S||S.host)return;const me=S.players[S.me];toHost({t:'set',ready:!(me&&me.ready)})};
    $('#mpChatIn').onkeydown=e=>{if(e.key==='Enter'){net.chat(e.target.value);e.target.value=''}};
    // im Spiel: Chat, Warteanzeige, Mitspieler-Knopf mit Ping
    const stage=$('#stage');
    const ig=document.createElement('div');ig.id='mpIngame';ig.hidden=true;stage.appendChild(ig);
    const w=document.createElement('div');w.id='mpWait';w.hidden=true;w.textContent='Warte auf Mitspieler …';stage.appendChild(w);
    const pb=document.createElement('button');pb.className='tbtn';pb.id='btnMp';pb.hidden=true;pb.title='Mitspieler, Ping und Tribut (Enter öffnet den Chat)';$('#clock').before(pb);
    pb.onclick=()=>{const p=$('#mpPanel');p.hidden=!p.hidden;if(!p.hidden)ui.panel()};
    const pn=document.createElement('div');pn.id='mpPanel';pn.hidden=true;$('#app')?$('#app').appendChild(pn):stage.appendChild(pn);
    window.addEventListener('keydown',e=>{if(!net.active||e.key!=='Enter'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT')return;e.preventDefault();ui.chatInput()});
    setInterval(()=>{if(net.active){ui.ingameChat();if(!$('#mpPanel').hidden)ui.panel()}},1000);
  },
  status(t,err){const s=$('#mpStatus');if(s){s.textContent=t||'';s.classList.toggle('err',!!err)}},
  hideAll(){const o=$('#mpScreen');if(o)o.hidden=true},
  showMenu(){ui.init();$('#startScreen').hidden=true;$('#mpScreen').hidden=false;$('#mpMenu').hidden=false;$('#mpLobby').hidden=true;$('#mpBack').hidden=false},
  showLobby(){ui.init();$('#startScreen').hidden=true;$('#mpScreen').hidden=false;$('#mpMenu').hidden=true;$('#mpLobby').hidden=false;$('#mpBack').hidden=true;ui.status('');ui.lobby();ui.chat()},
  lobby(){
    if(!S||$('#mpLobby').hidden)return;const L=S.lobby;if(!L)return;
    $('#mpCodeShow').textContent=L.code;
    $('#mpPlayers').innerHTML=Array.from({length:MAXP},(_,i)=>{const p=L.players[i];
      if(!p)return `<li class="empty"><span class="sw" style="background:${pc(i)}"></span><span>Freier Platz</span><span></span><span></span></li>`;
      const civ=i===S.me?`<select id="mpCiv" aria-label="Dein Volk">${civs().map(([k,c])=>`<option value="${k}"${k===p.civ?' selected':''}>${esc(c.name)}</option>`).join('')}</select>`:`<span>${esc(civName(p.civ))}</span>`;
      return `<li><span class="sw" style="background:${pc(i)}"></span><span>${esc(p.name)}${p.host?' (Gastgeber)':''}${i===S.me?' · du':''}</span>${civ}<span class="st${p.ready?' ok':''}">${p.host?'':p.ready?'bereit':'wartet'}${p.ping&&i!==S.me?' · '+p.ping+' ms':''}</span></li>`}).join('');
    const cs=$('#mpCiv');if(cs)cs.onchange=()=>{store.set('civ',cs.value);toHost({t:'set',civ:cs.value})};
    // Einstellungen: der Gastgeber wählt Epochen und Zeitlimit
    const eps=[...($('#epStartSel')||{options:[]}).options].map(o=>o.textContent),st=S.settings;
    const sel=(id,opts,v)=>`<select id="${id}"${S.host?'':' disabled'}>${opts.map(([k,n])=>`<option value="${k}"${+k===+v?' selected':''}>${esc(n)}</option>`).join('')}</select>`;
    $('#mpSet').innerHTML=`<span class="lbl">Einstellungen</span><label class="epsel">von ${sel('mpEpS',eps.map((n,i)=>[i,n]),st.epStart)}</label><label class="epsel">bis ${sel('mpEpE',eps.map((n,i)=>[i,n]),Math.min(st.epEnd,eps.length-1))}</label><label class="epsel">${sel('mpLim',[[0,'ohne Zeitlimit'],[20,'20 Min.'],[40,'40 Min.'],[60,'60 Min.']],st.limit)}</label>`;
    if(S.host){const upd=()=>{let a=+$('#mpEpS').value,b=+$('#mpEpE').value;if(b<a)b=a;S.settings={epStart:a,epEnd:b,limit:+$('#mpLim').value};lobbyUpdate()};['#mpEpS','#mpEpE','#mpLim'].forEach(s=>$(s).onchange=upd)}
    const me=L.players[S.me];
    $('#mpStart').hidden=!S.host;$('#mpReady').hidden=S.host;$('#mpReady').textContent=me&&me.ready?'Doch nicht bereit':'Bereit';
    if(S.host){const ok=L.players.length>=2&&L.players.every(p=>p.ready);$('#mpStart').disabled=!ok;ui.status(L.players.length<2?'Warte auf Mitspieler. Schicke ihnen den Raum-Code.':ok?'Alle sind bereit.':'Warte, bis alle bereit sind.')}
  },
  chat(){const box=$('#mpChatLog');if(box&&S){box.innerHTML=S.chat.map(c=>c.slot<0?`<div class="sys">${esc(c.text)}</div>`:`<div><b style="color:${pc(c.slot)}">${esc(c.from)}:</b> ${esc(c.text)}</div>`).join('');box.scrollTop=box.scrollHeight}ui.ingameChat()},
  ingameChat(){const ig=$('#mpIngame');if(!ig)return;ig.hidden=!net.active;if(!net.active)return;const t=now(),inp=ig.querySelector('input');
    const lines=S.chat.slice(-6).map(c=>`<div class="ln${t-c.t>14000&&!inp?' old':''}">${c.slot<0?`<i>${esc(c.text)}</i>`:`<b style="color:${pc(c.slot)}">${esc(c.from)}:</b> ${esc(c.text)}`}</div>`).join('');
    const box=ig.querySelector('.lines')||(()=>{const d=document.createElement('div');d.className='lines';d.style.cssText='display:flex;flex-direction:column;gap:3px';ig.prepend(d);return d})();if(box.innerHTML!==lines)box.innerHTML=lines},
  chatInput(){const ig=$('#mpIngame');let inp=ig.querySelector('input');if(inp){inp.focus();return}
    inp=document.createElement('input');inp.type='text';inp.maxLength=160;inp.placeholder='Nachricht, Enter senden, Esc schließen';ig.appendChild(inp);inp.focus();ui.ingameChat();
    inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'){net.chat(inp.value);inp.remove()}else if(e.key==='Escape')inp.remove()};inp.onblur=()=>setTimeout(()=>inp.remove(),150)},
  wait(on){const w=$('#mpWait');if(w&&w.hidden===on)w.hidden=!on},
  hud(){const b=$('#btnMp');if(!b)return;b.hidden=!net.active;if(!net.active){$('#mpPanel').hidden=true;$('#mpIngame').hidden=true;$('#mpWait').hidden=true;return}
    const v=S.host?(S.pings||[]).filter((x,i)=>i&&x>0):[S.ping];const ms=v.length?Math.max(...v):0;b.textContent='Mitspieler · '+(S.host&&!v.length?'–':ms+' ms');
    b.style.color=ms>250?'var(--danger)':ms>120?'var(--warn,#d9a43a)':''},
  panel(){const p=$('#mpPanel');if(!S||!G())return;const pl=G().players,me=S.me;
    p.innerHTML=`<h3>Mitspieler</h3>`+pl.map((x,i)=>{const pg=(S.pings||[])[i];const st=x.defeated?(x.left?'verlassen':'besiegt'):i===me?'du':S.host&&i===0?'':pg<0?'getrennt':pg?pg+' ms':'';
      return `<div class="pr"><span class="sw" style="background:${pc(i)}"></span><span>${esc(x.name||'')} · ${esc(civName(x.civ))}</span><span class="hint">${st}${i===0?' (Gastgeber)':''}</span>${i!==me&&!x.defeated&&!pl[me].defeated?`<div class="trib">${['food','wood','stone','gold'].map(r=>`<button class="tbtn" data-to="${i}" data-r="${r}">100 ${({food:'Nahrung',wood:'Holz',stone:'Stein',gold:'Gold'})[r]}</button>`).join('')}</div>`:''}</div>`}).join('')+
      `<p class="hint">Tribut: Rohstoffe an einen Mitspieler schicken. Enter öffnet den Chat. Ping = Verzögerung zum Gastgeber.</p><button class="tbtn" id="mpQuit">Partie verlassen</button>`;
    p.querySelectorAll('[data-to]').forEach(b=>b.onclick=()=>{G().cmd('trib',{to:+b.dataset.to,r:b.dataset.r,n:100});G().toast('Tribut wird geschickt.')});
    $('#mpQuit').onclick=()=>{p.hidden=true;net.leave()}},
};

XY.register({
  id:'kern-multiplayer',name:'Kern: Mehrspieler',version:'1.0.0',core:true,
  description:'Bis zu 4 Spieler über das Internet (WebRTC) mit Lobby, Chat, Ping-Anzeige und Lockstep-Synchronisation.',
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>ui.init());else setTimeout(()=>ui.init(),0);
})();
