// Kern-Baustein: Scharfschützenturm und Depot.
(function(){
function sniper(g,b,a){const {x,y,s,pc}=a,cx=x+s/2,base=y+s-3,st=a.shade('#9c9f98',0);
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(cx-6,base-2,14,5);g.fillStyle=a.shade(st,-18);g.fillRect(cx-5,base-62,10,62);g.fillStyle=st;g.fillRect(cx-5,base-62,5,62);
  g.fillStyle=a.shade(st,-30);g.fillRect(cx-8,base-70,16,8);g.fillStyle='#1a1614';g.fillRect(cx-3,base-68,6,3);g.fillStyle=pc;g.fillRect(cx-1,base-80,2,10);g.fillRect(cx+1,base-80,6,4)}
function depot(g,b,a){const {x,y,s,pc}=a,base=y+s-4;g.fillStyle='#6b5a3e';g.fillRect(x+4,base-22,s-8,22);g.fillStyle='#8a6a40';g.beginPath();g.moveTo(x+2,base-22);g.lineTo(x+s/2,base-34);g.lineTo(x+s-2,base-22);g.fill();
  for(let i=0;i<3;i++){g.fillStyle=['#a07a48','#b8b8b0','#e9c54a'][i];g.fillRect(x+8+i*10,base-8,8,8)}g.fillStyle=pc;g.fillRect(x+s-10,base-30,4,4);
  if(b.xfer>a.time){g.fillStyle='#e9be72';g.font='bold 12px sans-serif';g.fillText('⇄',x+s/2-5,base-38)}}
EmpireXY.register({
  id:'kern-depot',name:'Kern: Scharfschützenturm und Depot',version:'1.0.0',core:true,
  description:'Weitreichender Scharfschützenturm und ein Depot, das Überschüsse verteilt.',
  buildings:{
    sniper:{name:'Scharfschützenturm',size:1,hp:600,cost:{stone:150,gold:120},time:35,atk:50,range:14,rate:3,sight:15,minEpoch:6,slot:28,draw:sniper,ai:{minWorkers:24},
      desc:'Verteidigung: doppelte Reichweite eines Wachturms, ein Schuss alle 3 Sekunden mit 50 Schaden.'},
    depot:{name:'Depot',size:2,hp:700,cost:{wood:200,stone:50},time:25,sight:4,minEpoch:2,slot:29,draw:depot,
      desc:'Hat ein Rohstoff mehr als 500, gibt das Depot Überschuss ab: an Verbündete mit weniger als 50, sonst tauscht es 2 zu 1 in deinen knappsten Rohstoff (20 pro Sekunde).'},
  },
  hooks:{
    tick(api,dt){
      for(const b of api.ents){if(b.type!=='depot'||!b.built||b.dead)continue;const pl=api.players[b.owner],R=['food','wood','stone','gold'];
        const rich=R.filter(r=>pl.res[r]>500).sort((x,y)=>pl.res[y]-pl.res[x])[0];if(!rich)continue;
        const ally=api.players.find(o=>o!==pl&&o.ally===pl.i&&!o.defeated&&o.res[rich]<50);const amt=Math.min(20*dt,pl.res[rich]-500);
        if(ally){pl.res[rich]-=amt;ally.res[rich]+=amt;b.xfer=api.time+1;continue}
        const poor=R.filter(r=>r!==rich&&pl.res[r]<50).sort((x,y)=>pl.res[x]-pl.res[y])[0];if(!poor)continue;pl.res[rich]-=amt;pl.res[poor]+=amt/2;b.xfer=api.time+1;pl.depotXfer=api.time+1}
    },
  },
});
})();
