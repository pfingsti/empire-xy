// Kern-Baustein: Lagerhaus, hebt das Lagerlimit jeder Ressource um 500.
(function(){
function wh(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
  g.fillStyle='rgba(0,0,0,.22)';g.fillRect(x+3,base-2,s-4,5);g.fillStyle=a.shade(a.wall||'#8a6a40',0);g.fillRect(x+4,base-26,s-8,26);
  g.fillStyle=a.shade(a.roof||'#7a4a2a',0);g.beginPath();g.moveTo(x+1,base-26);g.lineTo(x+s/2,base-40);g.lineTo(x+s-1,base-26);g.fill();
  g.fillStyle='#3a2a1a';g.fillRect(x+s/2-7,base-16,14,16);g.fillStyle=pc;g.fillRect(x+s/2-1,base-46,2,8);g.fillRect(x+s/2+1,base-46,6,4);
  for(let i=0;i<3;i++){g.fillStyle=['#a07a48','#b8b8b0','#e9c54a'][i];g.fillRect(x+6+i*6,base-6,5,6)}}
EmpireXY.register({
  id:'kern-lagerhaus',name:'Kern: Lagerhaus',version:'1.0.0',core:true,
  description:'Jede Ressource hat ein Lagerlimit von 2000. Jedes Lagerhaus erhöht es um 1000.',
  buildings:{
    warehouse:{name:'Lagerhaus',size:2,hp:800,cost:{wood:150},time:25,sight:4,slot:31,draw:wh,ai:{minWorkers:10},
      desc:'Erhöht das Lagerlimit jeder Ressource um 1000 (Grundlimit 2000). Ist ein Lager voll, hören die Arbeiter auf zu sammeln.'},
  },
});
})();
