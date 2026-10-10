// Kern-Baustein: Feldlager und Assassinengilde (nach Stronghold Crusader und Assassin-Missionen aus Age of Kings).
(function(){
function camp(g,b,a){
  const {x,y,s,pc}=a,p=b.built?1:b.prog;
  g.fillStyle='rgba(120,90,50,.25)';g.fillRect(x+2,y+2,s-4,s-4);
  g.fillStyle='#6b4a2a';const n=Math.floor(14*p);
  for(let i=0;i<n;i++){const t=i/14*4,side=Math.floor(t),f=t-side,px=side===0?x+2+f*(s-4):side===1?x+s-4:side===2?x+s-4-f*(s-4):x+2,py=side===0?y+2:side===1?y+2+f*(s-4):side===2?y+s-4:y+s-4-f*(s-4);
    g.fillRect(px,py-8,3,10);g.fillStyle='#8a6a40';g.beginPath();g.moveTo(px,py-8);g.lineTo(px+1.5,py-11);g.lineTo(px+3,py-8);g.fill();g.fillStyle='#6b4a2a'}
  if(p>.5){g.fillStyle='#d8cbaa';g.beginPath();g.moveTo(x+s/2-9,y+s/2+6);g.lineTo(x+s/2,y+s/2-8);g.lineTo(x+s/2+9,y+s/2+6);g.closePath();g.fill();g.fillStyle=pc;g.fillRect(x+s/2-1,y+s/2-16,2,9);g.fillRect(x+s/2+1,y+s/2-16,6,4)}
}
function guild(g,b,a){
  const {x,y,s,pc}=a,base=y+s-4;
  g.fillStyle='#3a3530';g.fillRect(x+4,base-30,s-8,30);g.fillStyle='#2a2622';g.beginPath();g.moveTo(x+2,base-30);g.lineTo(x+s/2,base-46);g.lineTo(x+s-2,base-30);g.fill();
  g.fillStyle='#1a1614';g.fillRect(x+s/2-4,base-14,8,14);g.fillStyle='#b8322c';g.beginPath();g.moveTo(x+s/2-5,base-36);g.lineTo(x+s/2+5,base-36);g.lineTo(x+s/2,base-26);g.fill();
  g.fillStyle=pc;g.fillRect(x+6,base-6,4,4);
}
function plot(api,b,kind){
  const ents=api.ents,me=b.owner,pl=api.players[me],say=(m,k)=>{if(me===0)api.toast(m,k);else if(k==='warn'&&/gescheitert/.test(m))api.toast('Ein feindlicher Meuchler wurde gefasst!','good');else if(k==='good')api.toast(/Held/.test(m)?'Unser Held wurde ermordet!':'Feindliche Saboteure haben zugeschlagen!','warn')};
  if(kind==='hero'){const h=ents.find(e=>e.type==='hero'&&!e.dead&&e.owner!==me);if(!h){say('Kein feindlicher Held auf der Karte.','warn');pl.res.gold+=150;return}
    if(Math.random()<.7){api.damage(h,99999,null);say('Attentat geglückt: Der feindliche Held ist tot.','good')}else{say('Attentat gescheitert. Der Feind ist gewarnt.','warn');api.players[h.owner].warnedT=api.time}return}
  const tg=ents.filter(e=>e.kind==='bld'&&e.built&&!e.dead&&e.owner!==me&&e.queue&&e.type!=='house'&&e.type!=='wall');if(!tg.length){say('Kein Ziel gefunden.','warn');pl.res.gold+=100;return}
  const t=tg.sort((a,c)=>c.queue.length-a.queue.length)[0];
  if(Math.random()<.5){t.sabotUntil=api.time+90;say('Sabotage geglückt: '+(t.type)+' arbeitet 90 Sekunden nur halb so schnell.','good')}else say('Sabotage gescheitert. Der Feind ist gewarnt.','warn');
}
EmpireXY.register({
  id:'kern-feldlager',name:'Kern: Feldlager und Assassinen',version:'1.0.0',core:true,
  description:'Befestigte Feldlager für Truppen und eine Assassinengilde für Attentate und Sabotage.',
  buildings:{
    fieldcamp:{name:'Feldlager',size:2,hp:500,cost:{wood:80},time:10,sight:5,walk:true,draw:camp,desc:'Befestigtes Lager: +40 % Abwehr und Heilung für eigene Truppen im Umkreis.'},
    guild:{name:'Assassinengilde',names:['','','','','Assassinengilde','Assassinengilde','Geheimbund','Geheimdienst','Geheimdienst','Geheimdienst'],size:2,hp:700,cost:{gold:200,stone:60},time:30,sight:5,minEpoch:4,slot:24,ai:{minWorkers:26},
      desc:'Geheimes Haus der Meuchler. Beauftrage ein Attentat auf den feindlichen Helden (70 %) oder Sabotage (50 %).',draw:guild,
      cmds:(b,api)=>[
        {label:'Attentat',cost:{gold:150},desc:'Ein Meuchler tötet den feindlichen Helden. Gelingt zu 70 %, sonst ist der Feind gewarnt.',act:()=>plot(api,b,'hero')},
        {label:'Sabotage',cost:{gold:100},desc:'Das geschäftigste feindliche Gebäude arbeitet 90 Sekunden nur halb so schnell. Gelingt zu 50 %.',act:()=>plot(api,b,'bld')},
      ]},
  },
  hooks:{
    tick(api,dt){
      for(const b of api.ents){if(b.type!=='fieldcamp'||b.dead)continue;
        if(!b.built){b.prog=Math.min(1,(b.prog||0)+dt/10);b.hp=Math.max(b.hp,b.maxhp*b.prog);if(b.prog>=1)b.built=true;continue}
        const cx=b.x+1,cy=b.y+1;for(const u of api.ents)if(u.kind==='unit'&&!u.dead&&u.owner===b.owner&&Math.hypot(u.x-cx,u.y-cy)<4){u.campT=api.time+.5;if(u.hp<u.maxhp)api.heal(u,1.5*dt)}}
      // KI: Gilde nutzt Gold für Sabotage, wenn reichlich vorhanden
      for(const pl of api.players){if(!pl.ai||pl.defeated)continue;pl.guildT=(pl.guildT||0)-dt;if(pl.guildT>0)continue;pl.guildT=90;
        const g=api.ents.find(e=>e.type==='guild'&&e.owner===pl.i&&e.built&&!e.dead);if(g&&pl.res.gold>600){pl.res.gold-=100;plot(api,g,Math.random()<.4?'hero':'bld')}}
    },
  },
});
})();
