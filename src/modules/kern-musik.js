// Kern-Baustein: Dynamische Musik, Festungsausbau und Piraten.
// Musik: leise synthetische Aufbaumusik, die bei Feinden in der Nähe der eigenen Stadt in Kampfmusik übergeht (2 s Überblendung).
// Festung: Türme lassen sich zu Bogentürmen ausbauen, Tore bekommen Ölkessel. Piraten: schwarze Segel auf dem Wasser, entern möglich.
(function(){
let ac=null,gPeace=null,gWar=null,master=null,nextT=0,step=0,warLvl=0;
const SCALE=[0,2,4,7,9,12,14,16],BASS=[0,-5,-3,-7];
function note(gain,f,t,len,type,vol){const o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.exponentialRampToValueAtTime(.0005,t+len);o.connect(g);g.connect(gain);o.start(t);o.stop(t+len+.05)}
function ensure(){
  if(ac)return true;
  try{ac=new (window.AudioContext||window.webkitAudioContext)();master=ac.createGain();master.gain.value=.10;master.connect(ac.destination);
    gPeace=ac.createGain();gWar=ac.createGain();gPeace.gain.value=1;gWar.gain.value=0;gPeace.connect(master);gWar.connect(master);return true}catch(e){return false}
}
function musicOn(){const b=document.getElementById('btnSound');return b&&/an/.test(b.textContent)&&localStorageOk()}
function localStorageOk(){try{return localStorage.getItem('empire-xy.musik')!=='0'}catch(e){return true}}
function schedule(){
  const t0=ac.currentTime;if(nextT<t0)nextT=t0+.05;
  while(nextT<t0+.6){
    const base=step%32<16?220:196,beat=step%8;
    // Frieden: sanfte Arpeggien
    if(step%2===0)note(gPeace,base*Math.pow(2,SCALE[(step*3)%8]/12),nextT,1.1,'sine',.35);
    if(beat===0)note(gPeace,base/2*Math.pow(2,BASS[(step>>3)%4]/12),nextT,2.2,'triangle',.4);
    // Krieg: Trommeln und Moll-Ostinato
    note(gWar,step%4===0?60:step%4===2?90:140,nextT,.18,'square',step%4===0?.5:.18);
    if(step%2===1)note(gWar,base*Math.pow(2,[0,3,7,3,10,7,3,0][beat]/12),nextT,.22,'sawtooth',.16);
    if(beat===0)note(gWar,base/4,nextT,1,'sawtooth',.3);
    nextT+=.22;step++;
  }
}
function setWar(w){if(w===warLvl)return;warLvl=w;const t=ac.currentTime;
  gPeace.gain.cancelScheduledValues(t);gWar.gain.cancelScheduledValues(t);gPeace.gain.setValueAtTime(gPeace.gain.value,t);gWar.gain.setValueAtTime(gWar.gain.value,t);
  gPeace.gain.linearRampToValueAtTime(w?0:1,t+2);gWar.gain.linearRampToValueAtTime(w?1:0,t+2)}
let started=false;
window.addEventListener('pointerdown',()=>{started=true},{once:true});
function pirate(g,u,a){
  const T=a.T,x=u.x*T,y=u.y*T;g.save();g.translate(x,y);g.rotate(u.ang||0);
  g.fillStyle='#2a1c12';g.beginPath();g.moveTo(-15,-6);g.lineTo(12,-6);g.lineTo(18,0);g.lineTo(12,6);g.lineTo(-15,6);g.closePath();g.fill();
  g.fillStyle='#4a3424';g.fillRect(-12,-3,22,6);g.restore();
  g.fillStyle='#111';g.beginPath();g.moveTo(x-2,y-24);g.lineTo(x+12,y-14);g.lineTo(x-2,y-6);g.closePath();g.fill();g.fillStyle='#ddd';g.beginPath();g.arc(x+3,y-15,2.2,0,7);g.fill();
  g.strokeStyle='#3a2a18';g.lineWidth=2;g.beginPath();g.moveTo(x-2,y-26);g.lineTo(x-2,y);g.stroke();
}
EmpireXY.register({
  id:'kern-musik',name:'Kern: Musik, Festungsausbau, Piraten',version:'1.0.0',core:true,
  description:'Dynamische Musik je nach Lage, Bogentürme und Ölkessel, Piratenschiffe zum Entern.',
  units:{
    pirate:{label:'Piratenschiff',cls:'ship',naval:true,ai:false,minEpoch:0,names:['Piratenschiff'],hp:220,atk:10,range:4,rate:2,speed:2,sight:7,cost:{},time:1,r:.5,pop:0,draw:pirate,proj:1,
      desc:'Gekapertes Piratenschiff. Trägt Beute an Bord.'},
  },
  buildings:{
    tower:{cmds:(b,api)=>[b.upg?null:{label:'Bogenturm',cost:{wood:120,gold:60},desc:'Ausbau zum Bogenturm: +50 % Reichweite und schnellere Pfeile.',act:()=>{b.upg=1;api.toast('Wachturm zum Bogenturm ausgebaut.','good')}}]},
    gate:{cmds:(b,api)=>[b.oil?null:{label:'Ölkessel',cost:{wood:60,gold:80},desc:'Siedendes Öl über dem Tor: 20 Schaden für jeden Feind, der hindurch will.',act:()=>{b.oil=1;api.toast('Ölkessel über dem Tor angebracht.','good')}}]},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents;
      // Musik
      if(started&&musicOn()&&ensure()){if(ac.state==='suspended')ac.resume();schedule();
        const home=ents.filter(e=>e.kind==='bld'&&e.owner===0&&!e.dead&&e.type==='tc');
        const war=ents.some(e=>e.kind==='unit'&&!e.dead&&e.owner!==0&&api.isMil(e)&&home.some(h=>Math.hypot(e.x-h.x,e.y-h.y)<15));setWar(war?1:0)}
      else if(ac&&master)master.gain.value=0;
      if(ac&&master&&musicOn())master.gain.value=.10;
      // Ölkessel
      for(const b of ents){if(b.type!=='gate'||!b.oil||!b.built||b.dead)continue;b.oilCd=(b.oilCd||0)-dt;if(b.oilCd>0)continue;
        let hit=false;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner!==b.owner&&Math.hypot(e.x-b.x-.5,e.y-b.y-.5)<1.6){api.damage(e,20,b);hit=true}
        if(hit){b.oilCd=3;api.fx(b.x+.5,b.y+.5,'boom')}}
      // Piraten: alle 4 bis 6 Minuten erscheint ein Piratenschiff auf dem Wasser
      const P=api.players[1];if(!P)return;P.pirT=(P.pirT??(api.time+240))-0;
      if(api.time>P.pirT){P.pirT=api.time+240+Math.random()*120;
        for(let k=0;k<200;k++){const x=Math.floor(Math.random()*api.W),y=Math.floor(Math.random()*api.W);if(api.water&&api.water(x,y)){const u=api.spawnUnit(1,'pirate',x+.5,y+.5);if(u){u.pirate=1;u.loot={gold:150+Math.floor(Math.random()*150),food:100};api.toast('Piraten sind auf dem Wasser gesichtet worden!','warn')}break}}}
      for(const u of ents){if(!u.pirate||u.dead||u.owner===0)continue;
        if(u.order.t==='idle'){let t=null,bd=20;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner===0&&(e.type==='fishboat'||e.type==='caravan'||e.type==='warship')){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<bd){bd=d;t=e}}if(t)api.order(u,{t:'attack',target:t.id})}
        // Entern: eigenes Kriegsschiff daneben und Pirat angeschlagen
        if(u.hp<u.maxhp*.5&&ents.some(e=>e.kind==='unit'&&!e.dead&&e.owner===0&&e.type!=='pirate'&&e.type!=='fishboat'&&EmpireXY.units[e.type]&&EmpireXY.units[e.type].naval&&Math.hypot(e.x-u.x,e.y-u.y)<1.8)){
          u.owner=0;u.pirate=0;api.order(u,{t:'idle'});const pl=api.players[0];for(const r in u.loot){pl.res[r]+=u.loot[r];api.income(pl,r,u.loot[r])}api.toast('Piratenschiff geentert! Beute: '+Object.entries(u.loot).map(([r,v])=>v+' '+({gold:'Gold',food:'Nahrung'}[r])).join(', ')+'.','good');u.loot={}}}
    },
  },
});
})();
