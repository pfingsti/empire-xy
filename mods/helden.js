// Beispiel-Baustein: Helden (inspiriert von den Heldeneinheiten klassischer Echtzeitstrategie).
// Zeigt, wie ein Baustein eine neue Einheit mit eigener Grafik und eigener Spiellogik hinzufügt.
EmpireXY.register({
  id:'helden',name:'Helden',version:'1.1.0',enabledByDefault:true,
  description:'Ab der Kupferzeit kann jedes Stadtzentrum einen Feldherrn ausbilden. Er heilt Verbündete in der Nähe.',
  units:{
    hero:{
      label:'Held',from:'tc',minEpoch:1,max:1,
      names:['','Stammesfürst','Kriegsherr','Feldherr','Kreuzritter','Condottiere','Marschall','General','Feldmarschall','Kommandant'],
      hp:260,atk:14,range:.5,rate:1,speed:1.9,sight:8,cost:{food:200,gold:150},time:30,r:.36,pop:1,
      bonus:{infantry:1.3,cavalry:1.3},
      desc:'Einzigartiger Anführer. Heilt Verbündete im Umkreis von 4 Feldern.',
      // eigene Grafik: Kreis in Spielerfarbe mit goldenem Ring und Stern
      draw(g,u,api){
        const x=u.x*api.T,y=u.y*api.T;
        g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(x,y+9,12,5,0,0,7);g.fill();
        g.strokeStyle='rgba(233,190,114,'+(.35+.25*Math.sin(api.time*3))+')';g.lineWidth=2;g.beginPath();g.arc(x,y,13,0,7);g.stroke();
        g.fillStyle=api.PCOL_DK[u.owner];g.beginPath();g.arc(x,y,9,0,7);g.fill();
        g.fillStyle=api.PCOL[u.owner];g.beginPath();g.arc(x,y,8,0,7);g.fill();
        g.fillStyle='#f2cf4f';g.beginPath();
        for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?2.5:6;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}
        g.fill();
      },
    },
  },
  hooks:{
    // jede Sekunde: Helden heilen verbündete Einheiten in der Nähe
    tick(api,dt){
      for(const h of api.ents){
        if(h.dead||h.type!=='hero')continue;
        for(const e of api.ents)if(e.kind==='unit'&&!e.dead&&e.owner===h.owner&&e!==h&&e.hp<e.maxhp&&Math.hypot(e.x-h.x,e.y-h.y)<4)api.heal(e,3*dt);
      }
    },
  },
});
