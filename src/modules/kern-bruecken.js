// Kern-Baustein: Brücken (nach Die Siedler und Age of Empires 3).
// Brücken werden quer über Wasser gezogen wie eine Mauer. Jedes Stück baut sich selbst vom Ufer aus,
// sobald es an Land oder an ein fertiges Brückenstück grenzt. Wird ein Stück zerstört, ist der Weg wieder offen für Schiffe und zu für Truppen.
EmpireXY.register({
  id:'kern-bruecken',name:'Kern: Brücken',version:'1.0.0',core:true,
  description:'Brücken über Flüsse und Seen, Stück für Stück vom Ufer aus gebaut.',
  buildings:{
    bridge:{name:'Brücke',names:['Steg','Holzbrücke','Holzbrücke','Steinbrücke','Steinbrücke','Steinbrücke','Bogenbrücke','Eisenbrücke','Stahlbrücke','Betonbrücke'],size:1,hp:500,cost:{wood:30},time:6,sight:2,slot:22,
      water:true,line:true,walk:true,
      desc:'Über Wasser ziehen. Jedes Stück baut sich vom Ufer aus selbst; Truppen laufen darüber, Schiffe fahren darunter durch.',
      draw(g,b,a){const {x,y,s,ep,pc}=a,k=b.built?1:Math.max(.15,b.prog);
        g.globalAlpha=b.built?1:.55;
        g.fillStyle=ep>=3?a.shade(a.wall,-10):'#7a5530';g.fillRect(x-1,y+3,s+2,s-6);
        g.fillStyle=ep>=3?a.shade(a.wall,8):'#9a7244';for(let i=0;i<4;i++)g.fillRect(x+i*s/4,y+4,s/4-1,s-8);
        g.fillStyle=ep>=3?a.shade(a.wall,-25):'#4e3620';g.fillRect(x-1,y+2,s+2,2);g.fillRect(x-1,y+s-4,s+2,2);
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x,y+s-2,s,2);
        if(!b.built){g.globalAlpha=1;g.fillStyle='rgba(0,0,0,.6)';g.fillRect(x+3,y+s/2-2,s-6,4);g.fillStyle='#e9be72';g.fillRect(x+3,y+s/2-2,(s-6)*k,4)}
        g.globalAlpha=1;
      }},
  },
});
