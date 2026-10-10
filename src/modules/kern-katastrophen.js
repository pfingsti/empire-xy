// Kern-Baustein: Naturkatastrophen und Volkseinheiten.
// Katastrophen (nach SimCity und Age of Mythology): Erdbeben, Vulkan, Tsunami, mit 5 Sekunden Vorwarnung.
// Volkseinheiten (nach Age of Empires II): jedes Volk hat eine eigene Einheit mit Sonderfähigkeit.
(function(){
let pend=null;
function warn(api,text){api.toast(text,'warn');try{const AC=window.AudioContext||window.webkitAudioContext;if(!warn.ac)warn.ac=new AC();const ac=warn.ac,t=ac.currentTime;for(let i=0;i<3;i++){const o=ac.createOscillator(),g=ac.createGain();o.type='square';o.frequency.value=440;g.gain.setValueAtTime(.06,t+i*.35);g.gain.exponentialRampToValueAtTime(.001,t+i*.35+.25);o.connect(g);g.connect(ac.destination);o.start(t+i*.35);o.stop(t+i*.35+.3)}}catch(e){}}
function strike(api,ev){
  const ents=api.ents;
  if(ev.k==='quake'){let n=0;for(const b of ents)if(b.kind==='bld'&&!b.dead&&Math.hypot(b.x-ev.x,b.y-ev.y)<10){api.damage(b,b.maxhp*.3,null);n++}for(let i=0;i<12;i++)api.fx(ev.x+(Math.random()-.5)*16,ev.y+(Math.random()-.5)*16,'boom');api.toast('Erdbeben! '+n+' Gebäude beschädigt.','warn')}
  if(ev.k==='volcano'){ev.r=0;ev.until=api.time+20;lava.push(ev);api.toast('Ein Vulkan bricht aus! Lava breitet sich aus.','warn')}
  if(ev.k==='tsunami'){let n=0;for(const u of ents)if(u.kind==='unit'&&!u.dead&&!(EmpireXY.units[u.type]||{}).naval){let near=false;for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++)if(api.water(u.x+dx,u.y+dy)){near=true;break}if(near&&Math.random()<.7){api.damage(u,9999,null);n++}}api.toast('Tsunami! '+n+' Einheiten an der Küste weggespült.','warn')}
}
const lava=[];
function legion(g,u,a){const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner];g.fillStyle='#8e2a22';g.fillRect(x-5,y-4,10,10);g.fillStyle='#d9a77a';g.beginPath();g.arc(x,y-7,3.2,0,7);g.fill();g.fillStyle='#c9ccd0';g.fillRect(x-4,y-11,8,3);g.fillStyle='#b8322c';g.fillRect(x-1,y-14,2,4);
  g.fillStyle=pc;g.fillRect(x-10,y-5,5,12);g.strokeStyle='#e9be72';g.lineWidth=1;g.strokeRect(x-10,y-5,5,12)}
EmpireXY.register({
  id:'kern-katastrophen',name:'Kern: Katastrophen und Volkseinheiten',version:'1.0.0',core:true,
  description:'Erdbeben, Vulkane und Tsunamis mit Vorwarnung, dazu eine eigene Einheit für jedes Volk.',
  units:{
    legion:{label:'Legionär',civ:'roemer',from:'barracks',cls:'infantry',ai:false,minEpoch:2,shield:true,names:['','','Legionär'],hp:120,atk:11,range:.5,rate:1.2,speed:1.7,sight:6,cost:{food:60,gold:30},time:14,r:.32,pop:1,draw:legion,
      desc:'Römische Einheit. Im Schildwall halbiert sie den erlittenen Schaden (statt −30 %).'},
    horsearcher:{label:'Steppenreiter',civ:'mongolen',from:'stable',cls:'cavalry',look:'cavalry',ai:false,minEpoch:2,names:['','','Steppenreiter'],hp:85,atk:7,range:4.5,rate:1.4,speed:3.2,sight:8,cost:{food:50,gold:60},time:15,r:.38,pop:1,proj:1,
      desc:'Mongolische Einheit. Sehr schneller berittener Bogenschütze, der dem Feind ausweicht und weiterschießt.'},
    eagle:{label:'Adlerkrieger',civ:'azteken',from:'barracks',cls:'infantry',ai:false,minEpoch:1,names:['','Adlerkrieger'],hp:75,atk:8,range:.5,rate:1,speed:2.8,sight:10,cost:{food:50,gold:20},time:11,r:.3,pop:1,bonus:{ranged:1.6,siege:2},
      desc:'Aztekische Einheit. Schnell wie ein Adler, weite Sicht, stark gegen Fernkämpfer und Belagerung.'},
    berserker:{label:'Berserker',civ:'germanen',from:'barracks',cls:'infantry',ai:false,minEpoch:2,names:['','','Berserker'],hp:110,atk:13,range:.5,rate:1.1,speed:1.9,sight:6,cost:{food:65,gold:25},time:13,r:.32,pop:1,regen:2,
      desc:'Germanische Einheit. Heilt sich im Kampf von selbst (2 Leben pro Sekunde).'},
    chariot:{label:'Streitwagen des Pharao',civ:'aegypter',from:'stable',cls:'cavalry',look:'cavalry',ai:false,minEpoch:1,names:['','Pharaonenwagen'],hp:140,atk:10,range:.5,rate:1.3,speed:2.5,sight:7,cost:{food:60,wood:40,gold:30},time:16,r:.42,pop:2,armor:2,
      desc:'Ägyptische Einheit. Schwer gepanzerter Streitwagen, überrennt Fußvolk.',bonus:{infantry:1.4}},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents;
      for(const u of ents)if(u.kind==='unit'&&!u.dead&&u.hp<u.maxhp&&(EmpireXY.units[u.type]||{}).regen)api.heal(u,EmpireXY.units[u.type].regen*dt);
      // KI bildet gelegentlich ihre Volkseinheit aus
      for(const pl of api.players){if(!pl.ai||pl.defeated)continue;pl.civT=(pl.civT||0)-dt;if(pl.civT>0)continue;pl.civT=45;
        const k=Object.keys(EmpireXY.units).find(t=>EmpireXY.units[t].civ===pl.civ);if(!k)continue;const U=EmpireXY.units[k];if((U.minEpoch||0)>pl.epoch)continue;
        const b=ents.find(e=>e.kind==='bld'&&e.type===U.from&&e.owner===pl.i&&e.built&&!e.dead&&e.queue.length<2);if(!b)continue;const c=api.uCost(pl.i,k);
        if(Object.keys(c).every(r=>pl.res[r]>=c[r]+100)){for(const r in c)pl.res[r]-=c[r];b.queue.push({u:k,t:0,total:U.time,cost:c})}}
      // Katastrophen: etwa alle 5 Minuten, ab Minute 6
      const P=api.players[0];if(!P)return;if(P.disT===undefined)P.disT=api.time+360+Math.random()*120;
      if(!pend&&api.time>P.disT){P.disT=api.time+270+Math.random()*90;
        const k=['quake','volcano','tsunami'][Math.floor(Math.random()*3)],tgt=ents.filter(e=>e.kind==='bld'&&!e.dead);const b=tgt[Math.floor(Math.random()*tgt.length)];if(!b)return;
        pend={k,x:b.x,y:b.y,at:api.time+5};warn(api,{quake:'Die Erde bebt bald! Erdbeben in 5 Sekunden.',volcano:'Der Berg grollt! Vulkanausbruch in 5 Sekunden.',tsunami:'Das Meer zieht sich zurück! Tsunami in 5 Sekunden.'}[k]);api.fx(b.x,b.y,'hit')}
      if(pend&&api.time>=pend.at){strike(api,pend);pend=null}
      for(let i=lava.length-1;i>=0;i--){const L=lava[i];if(api.time>L.until){lava.splice(i,1);continue}L.r=Math.min(5,L.r+dt*.35);
        if(Math.random()<dt*6)api.fx(L.x+(Math.random()-.5)*L.r*2,L.y+(Math.random()-.5)*L.r*2,'boom');
        for(const e of ents)if(!e.dead&&e.owner>=0&&Math.hypot((e.x+(e.size?e.size/2:0))-L.x,(e.y+(e.size?e.size/2:0))-L.y)<L.r)api.damage(e,(e.kind==='bld'?60:25)*dt,null)}
    },
  },
});
})();
