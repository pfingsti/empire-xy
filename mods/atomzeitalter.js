// Beispiel-Baustein: eine elfte Epoche mit Panzern.
// Zeigt, wie ein Baustein eine Epoche anhängt und bestehende Einheiten per patch() verändert.
EmpireXY.register({
  id:'atomzeitalter',name:'Atomzeitalter',version:'1.0.0',order:10,
  description:'Fügt nach der Moderne das Atomzeitalter hinzu. Die Werkstatt baut dann Kampfpanzer.',
  epochs:[{name:'Atomzeitalter',cost:{food:2000,gold:1500,stone:600},time:80,roof:'#2f3a3f',roofHi:'#4f6670',wall:'#9aa3a8'}],
  units:{
    tank:{
      label:'Atompanzer',from:'workshop',minEpoch:10,names:['','','','','','','','','','','Atompanzer'],
      hp:300,atk:22,range:4.5,rate:2.2,speed:2.1,sight:8,cost:{food:100,gold:200},time:28,r:.42,pop:3,proj:2,vsBld:2,
      bonus:{infantry:1.4,ranged:1.4},
      desc:'Schwer gepanzert, schießt über mittlere Distanz.',
      draw(g,u,api){
        const x=u.x*api.T,y=u.y*api.T;g.translate(x,y);
        g.fillStyle='rgba(0,0,0,.3)';g.fillRect(-13,-8,28,20);
        g.rotate(u.ang);
        g.fillStyle='#2a2d30';g.fillRect(-13,-10,26,5);g.fillRect(-13,5,26,5);
        g.fillStyle='#4e5a3c';g.fillRect(-11,-7,22,14);
        g.fillStyle=api.PCOL[u.owner];g.fillRect(-11,-7,22,3);
        g.fillStyle='#3d4730';g.beginPath();g.arc(0,0,6,0,7);g.fill();
        g.fillStyle='#24282b';g.fillRect(4,-1.5,15,3);
      },
    },
  },
  patch(xy){
    // neue Namen für bestehende Einheiten in der elften Epoche
    const add={worker:'Techniker',infantry:'Sturmsoldat',ranged:'Raketenschütze',cavalry:'Spähpanzer',siege:'Raketenwerfer'};
    for(const k in add)if(xy.units[k])xy.units[k].names[10]=add[k];
  },
});
