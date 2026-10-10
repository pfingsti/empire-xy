// Kern-Baustein: Stadtchronik und Perlentaucher.
// Chronik: hält die Meilensteine der Partie mit Spielzeit fest (Knopf „Chronik“ oben).
// Taucher (ab Hochmittelalter) holen Perlen aus dem Wasser nahe dem Hafen; der Markt verkauft sie als Luxusgut.
(function(){
const fmt=t=>{t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
const EPN=['Steinzeit','Kupferzeit','Bronzezeit','Eisenzeit','Hochmittelalter','Renaissance','Kolonialzeit','Industriezeitalter','Moderne','Atomzeitalter'];
function log(pl,api,text){(pl.chron=pl.chron||[]).push([api.time,text]);render(pl)}
function render(pl){const el=document.getElementById('chronLog');if(!el||document.getElementById('chronPanel').hidden)return;
  el.innerHTML=(pl.chron||[]).slice().reverse().map(([t,x])=>'<div><b>'+fmt(t)+'</b>'+x+'</div>').join('')||'<div>Noch keine Einträge.</div>'}
let wired=false,lastPl=null;
function diver(g,u,a){const T=a.T,x=u.x*T,y=u.y*T,ph=Math.sin(a.time*4+u.id)*2;
  g.strokeStyle='rgba(220,240,255,.5)';g.lineWidth=1;g.beginPath();g.ellipse(x,y+2,8+ph,3,0,0,7);g.stroke();
  g.fillStyle='#3a7bc8';g.beginPath();g.arc(x,y-1+ph*.3,4.5,0,7);g.fill();g.fillStyle=a.PCOL[u.owner];g.fillRect(x-3,y-2+ph*.3,6,2);
  g.fillStyle='#bfe3ff';g.fillRect(x-2,y-4+ph*.3,4,2);if(u.pearlAcc>.5){g.fillStyle='#f4efe2';g.beginPath();g.arc(x+6,y-6,1.6,0,7);g.fill()}}
EmpireXY.register({
  id:'kern-chronik',name:'Kern: Chronik und Perlen',version:'1.0.0',core:true,
  description:'Stadtchronik mit Meilensteinen, Taucher und Perlen als Luxusgut.',
  units:{
    diver:{label:'Taucher',from:'dock',cls:'ship',naval:true,civil:true,ai:false,minEpoch:4,names:['','','','','Perlentaucher','Perlentaucher','Perlentaucher','Taucher','Taucher','Taucher'],
      hp:40,atk:0,range:.5,rate:9,speed:1.6,sight:5,cost:{food:50,gold:30},time:14,r:.3,pop:1,draw:diver,
      desc:'Holt bis 10 Felder um den Hafen Perlen aus dem Wasser. Perlen verkauft der Marktplatz teuer.'},
  },
  buildings:{
    market:{cmds:(b,api)=>[{label:'Perlen verkaufen',desc:'10 Perlen gegen 120 Gold. Perlen sind ein Luxusgut, das nur Taucher finden.',dis:(api.players[api.me].pearls||0)<10,
      act:()=>{const pl=api.players[api.me];if((pl.pearls||0)<10){api.toast('Zu wenig Perlen.','warn');return}pl.pearls-=10;pl.res.gold+=120;api.income(pl,'gold',120);api.toast('Perlen verkauft: +120 Gold.','good')}}]},
  },
  hooks:{
    tick(api,dt){
      const pl=api.players[api.me];if(!pl)return;
      if(!wired){const b=document.getElementById('btnChron');if(b){wired=true;b.onclick=()=>{const p=document.getElementById('chronPanel');p.hidden=!p.hidden;['savePanel','diploPanel'].forEach(id=>{const e=document.getElementById(id);if(e&&!p.hidden)e.hidden=true});render(lastPl)}}}
      lastPl=pl;
      // Perlen
      for(const u of api.ents){if(u.type!=='diver'||u.dead||u.moving)continue;const d=api.ents.find(e=>e.kind==='bld'&&e.type==='dock'&&e.built&&!e.dead&&e.owner===u.owner&&Math.hypot(e.x-u.x,e.y-u.y)<10);
        if(d){u.pearlAcc=(u.pearlAcc||0)+.12*dt;if(u.pearlAcc>=1){u.pearlAcc-=1;const p=api.players[u.owner];p.pearls=(p.pearls||0)+1;if(p.ai&&p.pearls>=10){p.pearls-=10;p.res.gold+=120}}}}
      if(pl.pearls){pl.goods=pl.goods||{};pl.goods.pearls=pl.pearls}else if(pl.goods)pl.goods.pearls=0;
      // Chronik: einmal pro Sekunde den Stand vergleichen
      pl.chT=(pl.chT||0)-dt;if(pl.chT>0)return;pl.chT=1;
      const c=pl.chk=pl.chk||{ep:pl.epoch,built:pl.st.built,killed:0,lost:0,pop:pl.pop,trained:pl.st.trained,ep1:api.players[1]?api.players[1].epoch:0,pearl:0};
      if(!pl.chron){pl.chron=[];log(pl,api,'Das Volk lässt sich nieder. Die Chronik beginnt.')}
      if(pl.epoch>c.ep){c.ep=pl.epoch;log(pl,api,EPN[pl.epoch]+' erreicht.')}
      const P1=api.players[1];if(P1&&P1.epoch>c.ep1){c.ep1=P1.epoch;log(pl,api,'Der Gegner erreicht die '+EPN[P1.epoch]+'.')}
      if(pl.st.trained>c.trained){if(!c.trained0){c.trained0=1;log(pl,api,'Erste Einheit rekrutiert.')}c.trained=pl.st.trained}
      for(const [k,n,txt] of [['built',1,'Erstes Gebäude fertiggestellt.'],['built',10,'Zehn Gebäude stehen.'],['built',30,'Die Stadt zählt 30 Gebäude.'],['killed',1,'Erster Feind besiegt.'],['killed',25,'25 Feinde besiegt.'],['killed',100,'100 Feinde besiegt.'],['lost',1,'Erster eigener Verlust.']])
        if(pl.st[k]>=n&&!c[k+n]){c[k+n]=1;log(pl,api,txt)}
      for(const n of [25,50,100,150])if(pl.pop>=n&&!c['pop'+n]){c['pop'+n]=1;log(pl,api,n+' Einwohner.')}
      if((pl.pearls||0)>=1&&!c.pearl){c.pearl=1;log(pl,api,'Erste Perle aus dem Meer geholt.')}
      for(const b of api.ents)if(b.kind==='bld'&&b.owner===api.me&&b.built&&!b.chron&&['wonder','monument','temple','market','castle','guild','mercs'].includes(b.type)){b.chron=1;log(pl,api,(b.type==='monument'?'Epochenwunder':b.type==='wonder'?'Weltwunder':b.type==='temple'?'Tempel':b.type==='market'?'Marktplatz':b.type==='castle'?'Burg':b.type==='guild'?'Assassinengilde':'Söldnerlager')+' errichtet.')}
      if(pl.heroDeadUntil>api.time&&!c.heroDead){c.heroDead=1;log(pl,api,'Unser Held ist gefallen.')}else if(!(pl.heroDeadUntil>api.time))c.heroDead=0;
      render(pl);
    },
  },
});
})();
