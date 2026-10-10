// Kern-Baustein: Karawanen und Belagerungstürme (nach Age of Empires und Stronghold).
// Karawanen werden am Marktplatz ausgebildet und pendeln selbst zu einem anderen Markt; je weiter, desto mehr Gold.
// Rechtsklick mit einer Karawane auf einen Markt legt das Ziel fest. Belagerungstürme machen feindliche Mauern
// neben sich für die eigenen Truppen begehbar.
(function(){
function cart(g,u,a){
  const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner],ph=u.moving?a.time*10:0;
  g.save();g.translate(x,y);g.rotate(u.ang||0);
  g.fillStyle='#7a5a32';g.fillRect(-9,-6,14,12);g.fillStyle='#e9dcc0';g.beginPath();g.ellipse(-2,-1,8,7,0,Math.PI,0);g.fill();g.fillRect(-10,-1,16,2);
  g.fillStyle=pc;g.fillRect(-4,-5,3,3);
  g.strokeStyle='#3a2a18';g.lineWidth=1.6;for(const wy of [-7,7]){g.beginPath();g.arc(-4,wy,3,0,7);g.stroke();g.beginPath();g.moveTo(-4+Math.cos(ph)*3,wy+Math.sin(ph)*3);g.lineTo(-4-Math.cos(ph)*3,wy-Math.sin(ph)*3);g.stroke()}
  g.fillStyle='#8a6a48';g.beginPath();g.ellipse(11,0,5,3,0,0,7);g.fill();g.beginPath();g.arc(16,0,2.2,0,7);g.fill();
  g.restore();
}
function tower(g,u,a){
  const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner];
  g.fillStyle='#5e4226';g.fillRect(x-9,y-30,18,36);g.fillStyle='#7a5a34';g.fillRect(x-9,y-30,9,36);
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=1;for(let k=-24;k<6;k+=6){g.beginPath();g.moveTo(x-9,y+k);g.lineTo(x+9,y+k);g.stroke()}
  g.fillStyle='#3a2a18';g.fillRect(x-11,y-33,22,4);g.fillStyle=pc;g.fillRect(x-1,y-44,2,11);g.fillRect(x+1,y-44,7,5);
  g.fillStyle='#2a1e10';for(const dx of [-8,8]){g.beginPath();g.arc(x+dx,y+6,3,0,7);g.fill()}
  if(u.climb&&u.climb.length){g.fillStyle='#8a6a40';g.fillRect(x+9,y-28,10,3)}
}
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
EmpireXY.register({
  id:'kern-karawanen',name:'Kern: Karawanen',version:'1.0.0',core:true,
  description:'Handelskarawanen zwischen Märkten und Belagerungstürme gegen Mauern.',
  units:{
    caravan:{label:'Karawane',from:'market',cls:'civil',civil:true,ai:false,minEpoch:1,names:['','Handelskarren','Karawane','Karawane','Handelswagen','Planwagen','Postkutsche','Güterwagen','Lastwagen','Sattelzug'],
      hp:70,atk:0,range:.5,rate:9,speed:1.7,sight:5,cost:{food:60,gold:40},time:14,r:.36,pop:1,draw:cart,
      desc:'Pendelt zwischen zwei Märkten und bringt Gold, je weiter, desto mehr. Rechtsklick auf einen Markt legt das Ziel fest. Feinde können sie überfallen.'},
    siegetower:{label:'Belagerungsturm',from:'workshop',cls:'siege',ai:false,minEpoch:2,names:['','','Sturmturm','Belagerungsturm','Belagerungsturm','Belagerungsturm','Belagerungsturm','Sturmbrücke','Sturmbrücke','Sturmbrücke'],
      hp:420,atk:0,range:.5,rate:9,speed:.9,sight:6,cost:{wood:200},time:20,r:.45,pop:2,draw:tower,armor:2,
      desc:'Fährt an eine feindliche Mauer. Solange er dort steht, klettern die eigenen Truppen über die Mauer.'},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents,gate=api.gate,mk=ents.filter(e=>e.kind==='bld'&&e.type==='market'&&e.built&&!e.dead);
      for(const u of ents){
        if(u.dead||u.kind!=='unit')continue;
        if(u.type==='caravan'){
          if(u.order.t!=='idle')continue;
          let home=ents.find(e=>e.id===u.home&&!e.dead);if(!home){home=mk.filter(m=>m.owner===u.owner).sort((a,b)=>near(api.center(a),u)-near(api.center(b),u))[0];if(!home)continue;u.home=home.id}
          let dest=ents.find(e=>e.id===u.dest&&!e.dead&&e.id!==home.id);
          if(!dest){let bd=0;for(const m of mk)if(m.id!==home.id&&m.owner===u.owner){const d=near(api.center(m),api.center(home));if(d>bd){bd=d;dest=m}}if(!dest)continue;u.dest=dest.id}
          const at=u.leg?dest:home,c=api.center(at);
          if(near(u,c)<at.size/2+2){
            if(u.leg){const pl=api.players[u.owner],v=Math.round(Math.min(60,near(api.center(home),api.center(dest))*1.1)*(pl.moodMul||1));pl.res.gold+=v;api.income(pl,'gold',v);pl.carried=(pl.carried||0)+v}
            u.leg=u.leg?0:1;const t=api.center(u.leg?dest:home);api.order(u,{t:'move',x:t.x,y:t.y+at.size/2+1});
          }else api.order(u,{t:'move',x:c.x,y:c.y+at.size/2+1});
        }else if(u.type==='siegetower'){
          if(u.climb)for(const i of u.climb)if(gate[i]===u.owner+1)gate[i]=0;
          u.climb=[];
          if(u.moving)continue;
          for(const w of ents)if(w.kind==='bld'&&(w.type==='wall'||w.type==='palisade')&&!w.dead&&w.owner!==u.owner&&Math.hypot(w.x+.5-u.x,w.y+.5-u.y)<1.7){const i=api.idx(w.x,w.y);if(gate[i]===0){gate[i]=u.owner+1;u.climb.push(i)}}
          if(api.players[u.owner].ai&&u.order.t==='idle'){let bw=null,bd=1e9;for(const w of ents)if(w.kind==='bld'&&w.type==='wall'&&!w.dead&&w.owner!==u.owner){const d=Math.hypot(w.x-u.x,w.y-u.y);if(d<bd){bd=d;bw=w}}if(bw&&bd>1.5)api.order(u,{t:'move',x:bw.x+.5,y:bw.y+1.5})}
        }
      }
      // KI: Karawanen ab zwei Märkten, ein Belagerungsturm wenn der Gegner Mauern hat
      for(const pl of api.players){if(!pl.ai||pl.defeated)continue;pl.kwT=(pl.kwT||0)-dt;if(pl.kwT>0)continue;pl.kwT=20;
        const own=t=>ents.filter(e=>e.kind==='unit'&&e.type===t&&e.owner===pl.i&&!e.dead).length,m=mk.filter(b=>b.owner===pl.i);
        if(m.length>=2&&own('caravan')<3&&pl.res.food>=120&&pl.res.gold>=80&&!m[0].queue.length){pl.res.food-=60;pl.res.gold-=40;m[0].queue.push({u:'caravan',t:0,total:14,cost:{food:60,gold:40}})}
        const ws=ents.find(e=>e.kind==='bld'&&e.type==='workshop'&&e.owner===pl.i&&e.built&&!e.dead);
        if(ws&&pl.epoch>=2&&own('siegetower')<1&&pl.res.wood>=300&&!ws.queue.length&&ents.some(e=>e.kind==='bld'&&e.type==='wall'&&e.owner!==pl.i&&!e.dead)){pl.res.wood-=200;ws.queue.push({u:'siegetower',t:0,total:20,cost:{wood:200}})}
      }
    },
  },
});
})();
