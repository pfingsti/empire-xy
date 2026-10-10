// Kern-Baustein: Religion und Fischerei (nach Age of Empires: Mönche bekehren, Fischerboote).
// Priester aus dem Tempel bekehren feindliche Einheiten in ihrer Nähe. Tempel heilen und ermutigen
// eigene Truppen im Umkreis. Fischerboote holen am Hafen von selbst Nahrung aus dem Wasser.
(function(){
function priest(g,u,a){
  const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner],bob=u.moving?Math.sin(a.time*12)*1.2:0;
  g.fillStyle='#e8e0cc';g.beginPath();g.moveTo(x-6,y+8);g.lineTo(x-3,y-4+bob);g.lineTo(x+3,y-4+bob);g.lineTo(x+6,y+8);g.closePath();g.fill();
  g.fillStyle=pc;g.fillRect(x-1,y-3+bob,2,10);g.fillRect(x-3,y+bob,6,2);
  g.fillStyle=a.SKIN?a.SKIN[0]||'#d9a77a':'#d9a77a';g.beginPath();g.arc(x,y-7+bob,3.2,0,7);g.fill();
  g.strokeStyle='#7a5530';g.lineWidth=1.4;g.beginPath();g.moveTo(x+7,y+8);g.lineTo(x+7,y-10+bob);g.stroke();
  if(u.convT>0){g.strokeStyle='rgba(242,207,79,'+(.4+.4*Math.sin(a.time*8))+')';g.lineWidth=1.5;g.beginPath();g.arc(x,y,11+u.convT*2,0,7);g.stroke()}
}
function boat(g,u,a){// Fischerboot in Seitenansicht: Einbaum mit Paddel, später Kahn mit Lateinsegel, Fischer und Netz
  const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner],ep=a.epochOf(u.owner),dir=Math.cos(u.ang||0)>=0?1:-1,t=a.time,bob=Math.sin(t*1.8+u.id)*.6;
  g.save();g.translate(x,y+3);g.fillStyle='rgba(10,30,45,.28)';g.beginPath();g.ellipse(0,1.4,12,2,0,0,7);g.fill();
  if(u.moving){g.strokeStyle='rgba(230,240,240,.4)';g.lineWidth=.7;g.beginPath();g.moveTo(-dir*10,1);g.lineTo(-dir*18,2.4);g.stroke()}
  g.scale(dir,1);g.translate(0,bob);
  const hg=g.createLinearGradient(0,-4,0,1);hg.addColorStop(0,'#9a7650');hg.addColorStop(1,'#4a3220');g.fillStyle=hg;
  g.beginPath();g.moveTo(-11,-3.4);g.lineTo(9,-3.4);g.quadraticCurveTo(12.5,-4.4,12,-5);g.quadraticCurveTo(11,0,7,1);g.lineTo(-8,1);g.quadraticCurveTo(-11,.4,-11,-3.4);g.fill();
  g.fillStyle='rgba(30,18,8,.4)';g.fillRect(-10,-2,19,.5);g.fillStyle=pc;g.fillRect(-9,-3.4,3,1);
  // Fischer am Heck
  g.save();g.translate(-5,0);g.fillStyle='#5a4a36';g.fillRect(-1.6,-9,3.2,5.6);g.fillStyle='#c49a76';g.beginPath();g.arc(0,-10.4,1.6,0,7);g.fill();g.fillStyle=ep>=1?'#b8984a':'#3a2a1c';g.beginPath();g.ellipse(0,-11.4,ep>=1?2.6:1.6,.8,0,0,7);g.fill();
  g.restore();
  if(ep===0){const w=Math.sin(t*3+u.id)*.5;g.strokeStyle='#6b4a2a';g.lineWidth=.8;g.beginPath();g.moveTo(1,-7);g.lineTo(-5+w*4,1.4);g.stroke()}
  else{g.strokeStyle='#3a2a1a';g.lineWidth=.8;g.beginPath();g.moveTo(4,-3.4);g.lineTo(4,-18);g.stroke();g.fillStyle='rgba(226,214,184,.92)';g.beginPath();g.moveTo(4,-18.6);g.quadraticCurveTo(0,-11,-6,-4.4);g.lineTo(4,-4.4);g.closePath();g.fill();g.strokeStyle='rgba(90,70,40,.5)';g.lineWidth=.4;g.beginPath();g.moveTo(4,-18.6);g.lineTo(-6,-4.4);g.stroke()}
  if(u.working||!u.moving){g.strokeStyle='rgba(200,190,160,.6)';g.lineWidth=.35;g.beginPath();g.moveTo(-6,-3);g.quadraticCurveTo(-11,0,-14,2);g.moveTo(-6,-3);g.quadraticCurveTo(-9,1,-10,2.4);g.stroke();for(let k=0;k<3;k++){g.fillStyle='#c8a050';g.beginPath();g.arc(-11+k*1.6,2+(k%2)*.4,.5,0,7);g.fill()}}
  g.restore();
}
const D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
EmpireXY.register({
  id:'kern-religion',name:'Kern: Religion und Fischerei',version:'1.0.0',core:true,
  description:'Priester bekehren Feinde, Tempel stärken Truppen, Fischerboote fangen Nahrung.',
  units:{
    priest:{label:'Priester',from:'temple',cls:'civil',civil:true,ai:false,minEpoch:2,names:['','','Priester','Priester','Mönch','Mönch','Prediger','Missionar','Missionar','Missionar'],
      hp:45,atk:0,range:.5,rate:9,speed:1.4,sight:8,cost:{gold:100},time:18,r:.27,pop:1,draw:priest,
      desc:'Steht er 6 Sekunden still neben einer feindlichen Einheit (bis 4 Felder), läuft sie zu dir über. Helden, Schiffe und Belagerung widerstehen.'},
    fishboat:{label:'Fischerboot',from:'dock',cls:'ship',naval:true,civil:true,ai:false,minEpoch:0,names:['Einbaum','Fischerboot','Fischerboot','Fischerboot','Fischerboot','Kutter','Kutter','Trawler','Trawler','Fangschiff'],
      hp:60,atk:0,range:.5,rate:9,speed:1.8,sight:6,cost:{wood:60},time:12,r:.35,pop:1,noShadow:true,draw:boat,
      desc:'Fängt auf dem Wasser bis 12 Felder um den eigenen Hafen von selbst Nahrung.'},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents;
      for(const u of ents){
        if(u.dead||u.kind!=='unit')continue;
        if(u.type==='priest'){
          if(u.moving){u.convT=0;continue}
          let t=null,bd=4;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner!==u.owner&&!api.players[e.owner].ally&&!['hero','priest','siegetower'].includes(e.type)){const c=e.type;if(['siege','warship','frigate','ram','bolt','fishboat'].includes(c)||api.players[e.owner].defeated)continue;const d=D(u,e);if(d<bd){bd=d;t=e}}
          const cur=u.convId&&ents.find(e=>e.id===u.convId&&!e.dead&&e.owner!==u.owner&&D(u,e)<4);if(cur)t=cur;
          if(!t){u.convT=0;u.convId=0;continue}if(t.id!==u.convId)u.convT=0;
          u.convId=t.id;u.convT=(u.convT||0)+dt;
          if(u.convT>=6){u.convT=0;u.convId=0;const was=t.owner;t.owner=u.owner;api.order(t,{t:'idle'});api.fx(t.x,t.y,'hit');
            if(u.owner===api.me)api.toast('Ein Feind ist zu uns übergelaufen!','good');else if(was===api.me)api.toast('Eine unserer Einheiten wurde bekehrt!','warn')}
        }else if(u.type==='fishboat'){
          if(u.moving)continue;
          const dock=ents.find(e=>e.kind==='bld'&&e.type==='dock'&&e.built&&!e.dead&&e.owner===u.owner&&D(api.center(e),u)<12);
          if(dock){const pl=api.players[u.owner];u.fishAcc=(u.fishAcc||0)+.55*dt*(pl.moodMul||1);if(u.fishAcc>=1){const v=Math.floor(u.fishAcc);u.fishAcc-=v;pl.res.food+=v;api.income(pl,'food',v)}}
        }
      }
      // Tempel: eigene Einheiten im Umkreis von 6 Feldern heilen langsam und kämpfen 10 % stärker
      for(const b of ents){if(b.kind!=='bld'||b.type!=='temple'||!b.built||b.dead)continue;const c=api.center(b);
        for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner===b.owner&&Math.hypot(e.x-c.x,e.y-c.y)<6){if(e.hp<e.maxhp)api.heal(e,1*dt);e.templeT=api.time+1}}
      // KI: Tempel ab Bronzezeit bauen lassen, Priester und Fischer ausbilden
      for(const pl of api.players){if(!pl.ai||pl.defeated)continue;pl.relT=(pl.relT||0)-dt;if(pl.relT>0)continue;pl.relT=15;
        const own=t=>ents.filter(e=>e.kind==='unit'&&e.type===t&&e.owner===pl.i&&!e.dead).length,b=t=>ents.find(e=>e.kind==='bld'&&e.type===t&&e.owner===pl.i&&e.built&&!e.dead);
        const tp=b('temple');if(tp&&pl.epoch>=2&&own('priest')<2&&pl.res.gold>=180&&!tp.queue.length){pl.res.gold-=100;tp.queue.push({u:'priest',t:0,total:18,cost:{gold:100}})}
        const dk=b('dock');if(dk&&own('fishboat')<3&&pl.res.wood>=120&&!dk.queue.length){pl.res.wood-=60;dk.queue.push({u:'fishboat',t:0,total:12,cost:{wood:60}})}
        // KI-Priester ziehen mit der Armee: zum nächsten Feind in Sichtweite
        for(const p of ents)if(p.type==='priest'&&p.owner===pl.i&&!p.dead&&p.order.t==='idle'){let t=null,bd=14;for(const e of ents)if(e.kind==='unit'&&!e.dead&&e.owner!==pl.i&&!api.players[e.owner].ally){const d=D(p,e);if(d<bd){bd=d;t=e}}if(t&&bd>3)api.order(p,{t:'move',x:t.x,y:t.y})}
      }
    },
  },
});
})();
