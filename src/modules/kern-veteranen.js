// Kern-Baustein: Veteranen-Aura, Pioniere mit Tunneln und das Söldnerlager (nach Stronghold, Cossacks und Age of Empires III).
(function(){
const MERC=['knight','heavy','spear','marks','harcher','cavalry','ranged','infantry','skirm'];
function sapper(g,u,a){
  const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner];
  if(u.digT>0){g.fillStyle='#5a4128';g.beginPath();g.ellipse(x,y+4,9,4,0,0,7);g.fill();g.fillStyle='rgba(0,0,0,.5)';g.fillRect(x-10,y-14,20,3);g.fillStyle='#e9be72';g.fillRect(x-10,y-14,20*Math.min(1,u.digT/30),3);
    const s=Math.sin(a.time*10)*3;g.strokeStyle='#8a8f96';g.lineWidth=2;g.beginPath();g.moveTo(x-2,y-6+s);g.lineTo(x+4,y+2);g.stroke();return}
  g.fillStyle='#6b5a3e';g.beginPath();g.arc(x,y,6,0,7);g.fill();g.fillStyle=pc;g.fillRect(x-4,y-2,8,3);
  g.fillStyle='#d9a77a';g.beginPath();g.arc(x,y-7,3,0,7);g.fill();g.strokeStyle='#8a8f96';g.lineWidth=1.6;g.beginPath();g.moveTo(x+5,y+5);g.lineTo(x+9,y-7);g.lineTo(x+5,y-9);g.stroke();
}
function camp(g,b,a){
  const {x,y,s,pc}=a,base=y+s-4;
  g.fillStyle='#7a5a34';g.fillRect(x+3,base-6,s-6,6);
  for(const [dx,c] of [[.25,'#8e3a2c'],[.6,'#2f4a6b'],[.85,'#5b6b2f']]){const cx=x+s*dx;g.fillStyle=c;g.beginPath();g.moveTo(cx-12,base-4);g.lineTo(cx,base-28);g.lineTo(cx+12,base-4);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.moveTo(cx,base-28);g.lineTo(cx+12,base-4);g.lineTo(cx,base-4);g.fill()}
  g.fillStyle='#e9be72';g.beginPath();g.arc(x+s/2,base-34,4,0,7);g.fill();g.fillStyle=pc;g.fillRect(x+4,base-12,4,4);
}
function offer(api,b){
  if(!b.offer||api.time>b.offerT){const pool=MERC.filter(t=>EmpireXY.units[t]);const pick=[];
    // Angebot hängt nur vom Gebäude und der Zeit ab, damit es im Mehrspieler auf allen Rechnern gleich ist
    const slot=Math.floor(api.time/90);let sd=(b.id*7919+slot*104729)%2147483647||1;const rnd=()=>(sd=sd*16807%2147483647)/2147483647;
    while(pick.length<Math.min(3,pool.length)){const t=pool[Math.floor(rnd()*pool.length)];if(!pick.includes(t))pick.push(t)}b.offer=pick;b.offerT=(slot+1)*90}
  return b.offer;
}
EmpireXY.register({
  id:'kern-veteranen',name:'Kern: Veteranen, Tunnel und Söldner',version:'1.0.0',core:true,
  description:'Veteranen stärken ihre Kameraden, Pioniere graben Tunnel unter Mauern, das Söldnerlager liefert sofort Truppen gegen Gold.',
  units:{
    sapper:{label:'Pionier',from:'workshop',cls:'civil',civil:true,stealth:true,ai:false,minEpoch:3,names:['','','','Mineur','Mineur','Pionier','Pionier','Pionier','Sprengmeister','Sprengmeister'],
      hp:60,atk:0,range:.5,rate:9,speed:1.5,sight:6,cost:{wood:80,gold:60},time:16,r:.3,pop:1,draw:sapper,
      desc:'Getarnt. Steht er neben einer feindlichen Mauer, gräbt er 30 Sekunden einen Tunnel, dann stürzt die Mauer ein.'},
  },
  buildings:{
    mercs:{name:'Söldnerlager',size:3,hp:1200,cost:{wood:300,gold:300},time:40,sight:6,minEpoch:2,slot:25,draw:camp,ai:{minWorkers:30},
      desc:'Drei wechselnde Söldnertruppen, sofort einsatzbereit, aber dreimal so teuer.',
      cmds:(b,api)=>offer(api,b).map(t=>{const base=api.uCost(b.owner,t),c={};for(const k in base)c[k]=base[k]*3;const U=EmpireXY.units?EmpireXY.units[t]:null;
        return {label:'Söldner: '+((U&&U.label)||t),cost:c,desc:'Sofort verfügbar. Das Angebot wechselt alle 90 Sekunden.',act:()=>{const pl=api.players[api.me];if(pl.pop+1>pl.cap){for(const k in c)pl.res[k]+=c[k];api.toast('Kein Wohnraum frei.','warn');return}
          const ct=api.center(b),u=api.spawnUnit(b.owner,t,ct.x,ct.y+b.size/2+.8);if(u){u.merc=1;api.toast('Söldner angeheuert.','good')}}}})},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents;
      for(const v of ents){if(v.rank!==2||v.dead||v.kind!=='unit')continue;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner===v.owner&&e!==v&&Math.hypot(e.x-v.x,e.y-v.y)<3)e.vetAuraT=api.time+.5}
      for(const u of ents){if(u.type!=='sapper'||u.dead)continue;
        if(u.moving){u.digT=0;continue}
        const w=ents.find(e=>e.kind==='bld'&&(e.type==='wall'||e.type==='gate')&&!e.dead&&e.owner!==u.owner&&Math.hypot(e.x+.5-u.x,e.y+.5-u.y)<1.8);
        if(!w){u.digT=0;if(api.players[u.owner].ai&&u.order.t==='idle'){let bw=null,bd=1e9;for(const e of ents)if(e.kind==='bld'&&e.type==='wall'&&!e.dead&&e.owner!==u.owner){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<bd){bd=d;bw=e}}if(bw)api.order(u,{t:'move',x:bw.x+.5,y:bw.y+1.5})}continue}
        u.digT=(u.digT||0)+dt;
        if(u.digT>=30){u.digT=0;for(const e of ents)if(e.kind==='bld'&&(e.type==='wall'||e.type==='gate')&&!e.dead&&e.owner!==u.owner&&Math.hypot(e.x+.5-u.x,e.y+.5-u.y)<2.6){api.fx(e.x+.5,e.y+.5,'boom');api.damage(e,99999,u)}
          if(u.owner===api.me)api.toast('Der Tunnel ist eingestürzt und hat die Mauer mitgerissen!','good');else api.toast('Feindliche Mineure haben unsere Mauer zum Einsturz gebracht!','warn');api.damage(u,99999,null)}
      }
      for(const pl of api.players){if(!pl.ai||pl.defeated||pl.epoch<3)continue;pl.sapT=(pl.sapT||0)-dt;if(pl.sapT>0)continue;pl.sapT=40;
        const ws=ents.find(e=>e.kind==='bld'&&e.type==='workshop'&&e.owner===pl.i&&e.built&&!e.dead);
        if(ws&&!ws.queue.length&&pl.res.gold>=120&&pl.res.wood>=160&&!ents.some(e=>e.type==='sapper'&&e.owner===pl.i&&!e.dead)&&ents.some(e=>e.kind==='bld'&&e.type==='wall'&&e.owner!==pl.i&&!e.dead)){pl.res.wood-=80;pl.res.gold-=60;ws.queue.push({u:'sapper',t:0,total:16,cost:{wood:80,gold:60}})}}
    },
  },
});
})();
