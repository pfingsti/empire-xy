// Kern-Baustein: Botschafter, Volksaufstand und Geheimgesellschaften (nach Civilization, Stronghold und Assassin's-Creed-artigen Orden).
(function(){
let box=null;
function dialog(title,text,choices){
  if(!box){box=document.createElement('div');box.style.cssText='position:fixed;left:50%;top:20%;transform:translateX(-50%);z-index:40;max-width:440px;width:calc(100% - 32px);background:#1b2420;border:1px solid #c9a86a;border-radius:8px;padding:16px 18px;color:#efe6d2;font:14px/1.45 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)';document.body.appendChild(box)}
  box.innerHTML='<h3 style="margin:0 0 6px;font-family:Georgia,serif;color:#e9be72">'+title+'</h3><p style="margin:0 0 12px">'+text+'</p><div style="display:flex;gap:8px;flex-wrap:wrap"></div>';
  for(const [l,f,t] of choices){const b=document.createElement('button');b.className='tbtn';b.textContent=l;if(t)b.title=t;b.onclick=()=>{box.hidden=true;f()};box.lastChild.appendChild(b)}box.hidden=false;
}
const army=(api,o)=>api.ents.filter(e=>e.kind==='unit'&&!e.dead&&e.owner===o&&api.isMil(e)).length;
function envoy(g,u,a){const T=a.T,x=u.x*T,y=u.y*T,pc=a.PCOL[u.owner];g.fillStyle='#e8dcc0';g.beginPath();g.moveTo(x-6,y+8);g.lineTo(x,y-5);g.lineTo(x+6,y+8);g.closePath();g.fill();g.fillStyle=pc;g.fillRect(x-6,y+1,12,3);
  g.fillStyle='#d9a77a';g.beginPath();g.arc(x,y-7,3,0,7);g.fill();g.fillStyle='#fff';g.fillRect(x+6,y-12,7,5);g.strokeStyle='#7a5530';g.lineWidth=1.2;g.beginPath();g.moveTo(x+6,y-12);g.lineTo(x+6,y+6);g.stroke()}
function rebel(g,u,a){const T=a.T,x=u.x*T,y=u.y*T;g.fillStyle='#5a4a3a';g.beginPath();g.arc(x,y,6,0,7);g.fill();g.fillStyle='#d9a77a';g.beginPath();g.arc(x,y-7,3,0,7);g.fill();
  g.strokeStyle='#a8a8a8';g.lineWidth=1.5;g.beginPath();g.moveTo(x+4,y+4);g.lineTo(x+9,y-9);g.stroke();g.fillStyle='rgba(255,90,40,'+(.6+.4*Math.sin(a.time*9))+')';g.beginPath();g.arc(x+9,y-10,2.2,0,7);g.fill()}
function keep(color){return (g,b,a)=>{const {x,y,s,pc}=a,base=y+s-4;g.fillStyle=a.shade(color,-20);g.fillRect(x+6,base-40,s-12,40);g.fillStyle=color;g.fillRect(x+6,base-40,(s-12)/2,40);
  g.fillStyle=a.shade(color,-35);for(let i=0;i<5;i++)g.fillRect(x+6+i*(s-12)/5,base-46,(s-12)/10,6);g.fillStyle=pc;g.fillRect(x+s/2-1,base-60,2,14);g.fillRect(x+s/2+1,base-60,8,5);
  g.fillStyle='#1a1614';g.fillRect(x+s/2-5,base-14,10,14)}}
EmpireXY.register({
  id:'kern-botschaft',name:'Kern: Botschafter, Aufstand, Orden',version:'1.0.0',core:true,
  description:'Botschafter verhandeln in der feindlichen Hauptstadt, Hunger und Unmut führen zu Aufständen, zwei Geheimorden geben Boni.',
  units:{
    envoy:{label:'Botschafter',from:'tc',cls:'civil',civil:true,ai:false,minEpoch:1,max:1,names:['','Gesandter','Gesandter','Botschafter'],hp:50,atk:0,range:.5,rate:9,speed:1.8,sight:7,cost:{food:50,gold:80},time:15,r:.28,pop:1,draw:envoy,
      desc:'Unbewaffnet. Schick ihn zum feindlichen Stadtzentrum, dort verhandelt er: Frieden, Bündnis oder Tributforderung.'},
    rebel:{label:'Aufständischer',cls:'infantry',ai:false,minEpoch:0,names:['Aufständischer'],hp:60,atk:7,range:.5,rate:1.2,speed:1.6,sight:6,cost:{},time:1,r:.3,pop:0,draw:rebel,desc:'Unzufriedene Bürger mit Fackeln.'},
  },
  buildings:{
    templar:{name:'Templerburg',size:3,hp:2200,cost:{stone:300,gold:500},time:60,sight:7,minEpoch:4,maxEpoch:6,unique:true,slot:26,draw:keep('#b9b2a2'),ai:{minWorkers:28},
      desc:'Ordensburg der Tempelritter, nur eine pro Partie, baubar von Hochmittelalter bis Kolonialzeit. Alle Reiter und Ritter +30 % Angriff.'},
    lodge:{name:'Freimaurerloge',size:2,hp:1400,cost:{stone:200,gold:600},time:50,sight:5,minEpoch:8,unique:true,slot:27,draw:keep('#4a4f63'),ai:{minWorkers:28},
      desc:'Geheime Loge, nur eine pro Partie, ab der Moderne. +25 % Forschungstempo.'},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents,me=api.players[0],ai=api.players[1];if(!me||!ai)return;const S=api.aiS;
      for(const pl of api.players){pl.templar=ents.some(b=>b.type==='templar'&&b.built&&!b.dead&&b.owner===pl.i);pl.lodge=ents.some(b=>b.type==='lodge'&&b.built&&!b.dead&&b.owner===pl.i)}
      // Botschafter am feindlichen Stadtzentrum
      for(const u of ents){if(u.type!=='envoy'||u.dead||u.owner!==0||u.talked)continue;
        const tc=ents.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===1&&!e.dead&&Math.hypot(e.x+e.size/2-u.x,e.y+e.size/2-u.y)<e.size/2+2.5);if(!tc)continue;u.talked=1;
        const ratio=(army(api,0)+1)/(army(api,1)+1),end=()=>{api.damage(u,9999,null)};
        dialog('Audienz beim Gegner','Dein Botschafter steht vor dem Herrscher der '+(ai.civName||'Gegner')+'. Kräfteverhältnis: '+army(api,0)+' eigene gegen '+army(api,1)+' feindliche Soldaten.',[
          ['Friedensangebot (300 Gold)',()=>{if(me.res.gold<300){api.toast('Nicht genug Gold für das Angebot.','warn');u.talked=0;return}
            if(ratio>.6||Math.random()<.5){me.res.gold-=300;ai.res.gold+=300;S.peaceUntil=Math.max(S.peaceUntil||0,api.time+300);S.nextAttack=Math.max(S.nextAttack,S.peaceUntil);S.attacking=false;api.toast('Frieden für fünf Minuten geschlossen.','good')}else api.toast('Der Gegner lacht über dein Angebot.','warn');end()},'Kauft fünf Minuten Frieden. Ein schwacher Gegner nimmt eher an.'],
          ['Allianzanfrage',()=>{if(ratio>1.3){S.peaceUntil=Math.max(S.peaceUntil||0,api.time+600);S.nextAttack=Math.max(S.nextAttack,S.peaceUntil);S.attacking=false;api.revealAll&&api.revealAll();api.toast('Der Gegner fürchtet dich und schließt ein Bündnis: zehn Minuten Frieden und offene Karten.','good')}
            else api.toast('Der Gegner lehnt ein Bündnis ab. Er hält sich für stark genug.','warn');end()},'Nur wenn du deutlich stärker bist: zehn Minuten Frieden und Sicht auf die ganze Karte.'],
          ['Tribut fordern',()=>{if(ratio>1.6){ai.tributeTo0=api.time+600;api.toast('Der Gegner beugt sich und zahlt zehn Minuten lang Tribut.','good')}
            else{S.peaceUntil=0;S.nextAttack=api.time;S.wave=(S.wave||4)+3;api.toast('Der Gegner lehnt ab und erklärt dir den Krieg!','warn')}end()},'Nur bei großer Übermacht. Sonst greift der Gegner sofort an.'],
        ])}
      if(ai.tributeTo0>api.time){ai.tribAcc=(ai.tribAcc||0)+dt;if(ai.tribAcc>=6){ai.tribAcc=0;const v=Math.min(5,Math.floor(ai.res.gold));ai.res.gold-=v;me.res.gold+=v;api.income(me,'gold',v)}}
      // Volksaufstand: Beliebtheit unter 20 oder Hunger länger als 30 s
      const bad=(me.mood??50)<20||me.res.food<10;me.unrest=bad?(me.unrest||0)+dt:Math.max(0,(me.unrest||0)-dt*2);
      if(me.unrest>30&&!me.unrestWarn){me.unrestWarn=api.time;api.toast('Die Bevölkerung ist unzufrieden! Sorge für Nahrung und bessere Stimmung, sonst gibt es einen Aufstand.','warn')}
      if(me.unrestWarn&&!bad&&me.unrest<10)me.unrestWarn=0;
      if(me.unrestWarn&&api.time-me.unrestWarn>15&&bad){me.unrestWarn=0;me.unrest=0;const tc=ents.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===0&&!e.dead);
        if(tc){const c=api.center(tc),n=3+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const r=api.spawnUnit(1,'rebel',c.x-2+i,c.y+tc.size/2+1.2);if(r){r.rebel=1;api.order(r,{t:'attack',target:tc.id})}}api.toast('Aufstand! '+n+' Aufständische greifen die Stadt an. Schick Soldaten!','warn')}}
    },
  },
});
})();
