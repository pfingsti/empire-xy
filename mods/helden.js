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
      desc:'Einzigartiger Anführer. Heilaura, Schlachtruf (+20 % Kampfkraft, 30 s) und ab Stufe 3 Sammelruf. Steigt durch Siege auf. Fällt er, trauert das Volk 60 s.',
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
        if(u.buffUntil>api.time){g.strokeStyle='rgba(255,90,60,.7)';g.lineWidth=1.5;g.beginPath();g.arc(x,y,16,0,7);g.stroke()}
        g.fillStyle='#f2cf4f';for(let i=1;i<(u.lvl||1);i++)g.fillRect(x-6+i*4,y-17,3,3);
      },
    },
  },
  hooks:{
    // jede Sekunde: Helden heilen verbündete Einheiten in der Nähe
    tick(api,dt){
      for(const pl of api.players){if(pl.heroId){const h=api.ents.find(e=>e.id===pl.heroId);if(!h||h.dead){pl.heroId=0;pl.heroDeadUntil=api.time+60;if(pl.i===0)api.toast('Unser Held ist gefallen! Das Volk trauert.','warn')}}}
      for(const h of api.ents){
        if(h.dead||h.type!=='hero')continue;
        const pl=api.players[h.owner];pl.heroId=h.id;
        // Stufen: 3 Siege → Stufe 2 (mehr Leben), 8 Siege → Stufe 3 (Sammelruf: Truppen in der Nähe laufen schneller)
        const lv=(h.kills||0)>=8?3:(h.kills||0)>=3?2:1;
        if(lv>(h.lvl||1)){h.lvl=lv;h.maxhp=Math.round(h.maxhp*1.25);h.hp=h.maxhp;api.fx(h.x,h.y,'hit');if(h.owner===0)api.toast('Held erreicht Stufe '+lv+(lv===3?': Sammelruf freigeschaltet.':': mehr Lebenskraft.'),'good')}
        // Schlachtruf: sobald Feinde nah sind, +20 % Schaden für eigene Truppen im Umkreis, 30 s, alle 90 s
        if(api.time>(h.cryReady||0)&&api.ents.some(e=>e.kind==='unit'&&!e.dead&&e.owner!==h.owner&&!api.players[e.owner].ally&&Math.hypot(e.x-h.x,e.y-h.y)<5)){
          h.cryReady=api.time+90;for(const e of api.ents)if(e.kind==='unit'&&!e.dead&&e.owner===h.owner&&Math.hypot(e.x-h.x,e.y-h.y)<6)e.buffUntil=api.time+30;
          if(h.owner===0)api.toast('Schlachtruf! +20 % Kampfkraft für 30 Sekunden.','good')}
        if(h.lvl===3)for(const e of api.ents)if(e.kind==='unit'&&!e.dead&&e.owner===h.owner&&e.moving&&Math.hypot(e.x-h.x,e.y-h.y)<5&&e!==h)e.rallyUntil=api.time+1;
        for(const e of api.ents)if(e.kind==='unit'&&!e.dead&&e.owner===h.owner&&e!==h&&e.hp<e.maxhp&&Math.hypot(e.x-h.x,e.y-h.y)<4)api.heal(e,3*dt);
      }
    },
  },
});
