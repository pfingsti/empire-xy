// Kern-Baustein: Militärlager, heilt eigene Einheiten im Umkreis.
(function(){
const R=5;
function camp(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
  g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.ellipse(x+s/2,base,s/2-2,7,0,0,7);g.fill();
  for(const [dx,w] of [[6,22],[s-30,24]]){g.fillStyle='#c8b48a';g.beginPath();g.moveTo(x+dx,base);g.lineTo(x+dx+w/2,base-24);g.lineTo(x+dx+w,base);g.fill();g.fillStyle='#8c7a58';g.fillRect(x+dx+w/2-2,base-10,4,10)}
  g.fillStyle='#5a4630';g.fillRect(x+s/2-1,base-40,2,40);g.fillStyle=pc;g.fillRect(x+s/2+1,base-40,12,8);
  g.fillStyle='#c33';g.fillRect(x+s/2-6,base-18,12,4);g.fillRect(x+s/2-2,base-22,4,12);
  if(b.healT>a.time){g.strokeStyle='rgba(120,230,120,.35)';g.lineWidth=2;g.beginPath();g.ellipse(x+s/2,y+s/2,R*a.T,R*a.T*.55,0,0,7);g.stroke()}}
EmpireXY.register({
  id:'kern-militaerlager',name:'Kern: Militärlager',version:'1.0.0',core:true,
  description:'Ein Lager pro Spieler ab der 3. Epoche, das Einheiten im Umkreis um 5 Leben pro Sekunde heilt.',
  buildings:{
    milcamp:{name:'Militärlager',size:2,hp:900,cost:{wood:250,food:100},time:30,sight:6,minEpoch:2,slot:30,unique:true,draw:camp,ai:{minWorkers:18},
      desc:'Heilt eigene Einheiten im Umkreis von 5 Feldern um 5 Leben pro Sekunde. Nur eines pro Spieler.'},
  },
  hooks:{
    tick(api,dt){
      for(const b of api.ents){if(b.type!=='milcamp'||!b.built||b.dead)continue;const c=api.center(b);
        for(const u of api.ents)if(u.kind==='unit'&&!u.dead&&u.owner===b.owner&&u.hp<u.maxhp&&Math.hypot(u.x-c.x,u.y-c.y)<=R){api.heal(u,5*dt);b.healT=api.time+.5}}
    },
  },
});
})();
