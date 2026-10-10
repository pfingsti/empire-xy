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
function pirate(g,u,a){// Piratenschiff in Seitenansicht: schwarzer Rumpf, geflickte dunkle Segel, schwarze Flagge
  const T=a.T,x=u.x*T,y=u.y*T,dir=Math.cos(u.ang||0)>=0?1:-1,t=a.time,L=34,bob=Math.sin(t*1.5+u.id)*.8;
  g.save();g.translate(x,y+4);g.fillStyle='rgba(10,30,45,.3)';g.beginPath();g.ellipse(0,1.6,L*.56,2.6,0,0,7);g.fill();g.scale(dir,1);g.translate(0,bob);g.rotate(Math.sin(t*1.1+u.id)*.02);
  const hg=g.createLinearGradient(0,-8,0,1);hg.addColorStop(0,'#3a2a1e');hg.addColorStop(1,'#140e0a');g.fillStyle=hg;
  g.beginPath();g.moveTo(-L/2,-11);g.lineTo(-L/2+7,-8);g.lineTo(L/2-4,-7);g.quadraticCurveTo(L/2+2,-9,L/2+3,-10);g.quadraticCurveTo(L/2,0,L/2-6,1);g.lineTo(-L/2+4,1);g.quadraticCurveTo(-L/2-1,-2,-L/2,-11);g.fill();
  g.fillStyle='#8a2a20';g.fillRect(-L/2+2,-6,L-6,.8);g.fillStyle='#0a0806';for(let k=-L/2+5;k<L/2-6;k+=4)g.fillRect(k,-4.6,1.6,1.4);
  g.strokeStyle='rgba(255,230,190,.12)';g.lineWidth=.4;g.beginPath();for(let k=-3;k<0;k+=1.4){g.moveTo(-L/2+3,k);g.lineTo(L/2-6,k)}g.stroke();
  for(const [mx,h] of [[-6,22],[6,26]]){g.strokeStyle='#2a1c12';g.lineWidth=1;g.beginPath();g.moveTo(mx,-7);g.lineTo(mx,-7-h);g.stroke();
    for(const [y0,hh,w] of [[-7-h+1,h*.34,5],[-7-h+h*.38,h*.38,6]]){g.fillStyle='#3a3630';g.beginPath();g.moveTo(mx-w,y0);g.lineTo(mx+w,y0);g.quadraticCurveTo(mx+w+1.2,y0+hh*.5,mx+w*.9,y0+hh);g.lineTo(mx-w*.9,y0+hh);g.quadraticCurveTo(mx-w+1.2,y0+hh*.5,mx-w,y0);g.fill();
      g.fillStyle='#4a453c';g.fillRect(mx-w*.5,y0+hh*.3,w*.6,hh*.3);g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.moveTo(mx+w*.4,y0+hh);g.lineTo(mx+w*.9,y0+hh);g.lineTo(mx+w*.7,y0+hh*.7);g.fill()}}
  const wv=Math.sin(t*4+u.id)*.8;g.fillStyle='#0c0c0c';g.beginPath();g.moveTo(6,-33);g.quadraticCurveTo(1,-32+wv,-3,-32.4);g.lineTo(-3,-28);g.quadraticCurveTo(1,-28.6-wv,6,-28.6);g.closePath();g.fill();g.fillStyle='#ddd';g.beginPath();g.arc(1.4,-30.8,.9,0,7);g.fill();
  g.strokeStyle='#2a1c12';g.lineWidth=.8;g.beginPath();g.moveTo(L/2+1,-10);g.lineTo(L/2+9,-14);g.stroke();g.strokeStyle='rgba(40,28,16,.5)';g.lineWidth=.3;g.beginPath();g.moveTo(L/2+8,-14);g.lineTo(6,-33);g.moveTo(-L/2,-11);g.lineTo(-6,-29);g.stroke();
  g.restore();
}
EmpireXY.register({
  id:'kern-musik',name:'Kern: Musik, Festungsausbau, Piraten',version:'1.0.0',core:true,
  description:'Dynamische Musik je nach Lage, Bogentürme und Ölkessel, Piratenschiffe zum Entern.',
  units:{
    pirate:{label:'Piratenschiff',cls:'ship',naval:true,ai:false,minEpoch:0,names:['Piratenschiff'],hp:220,atk:10,range:4,rate:2,speed:2,sight:7,cost:{},time:1,r:.5,pop:0,noShadow:true,draw:pirate,proj:1,
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
        const home=ents.filter(e=>e.kind==='bld'&&e.owner===api.me&&!e.dead&&e.type==='tc');
        const war=ents.some(e=>e.kind==='unit'&&!e.dead&&e.owner!==api.me&&e.owner>=0&&api.isMil(e)&&home.some(h=>Math.hypot(e.x-h.x,e.y-h.y)<15));setWar(war?1:0)}
      else if(ac&&master)master.gain.value=0;
      if(ac&&master&&musicOn())master.gain.value=.10;
      // Ölkessel
      for(const b of ents){if(b.type!=='gate'||!b.oil||!b.built||b.dead)continue;b.oilCd=(b.oilCd||0)-dt;if(b.oilCd>0)continue;
        let hit=false;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner!==b.owner&&Math.hypot(e.x-b.x-.5,e.y-b.y-.5)<1.6){api.damage(e,20,b);hit=true}
        if(hit){b.oilCd=3;api.fx(b.x+.5,b.y+.5,'boom')}}
      // Piraten: alle 4 bis 6 Minuten erscheint ein Piratenschiff auf dem Wasser
      const P=api.players[1];if(!P||api.mp)return;P.pirT=(P.pirT??(api.time+240))-0;
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
