// Kern-Baustein: Produktionsketten (nach Die Siedler, Anno und Caesar).
// Felder liefern Weizen, sobald eine Mühle steht. Die Bäckerei backt daraus Brot (Nahrung).
// Die Erzmine fördert Erz, die Schmiede macht daraus Werkzeug. Werkzeug beschleunigt alle Arbeiter (bis +25 %).
(function(){
const has=(api,p,t)=>api.ents.some(e=>e.kind==='bld'&&e.type===t&&e.owner===p&&e.built&&!e.dead);
EmpireXY.register({
  id:'kern-ketten',name:'Kern: Produktionsketten',version:'1.0.0',core:true,
  description:'Weizen → Mühle → Bäckerei → Brot, Erzmine → Schmiede → Werkzeug.',
  buildings:{
    bakery:{name:'Bäckerei',names:['Backofen','Backhaus','Bäckerei','Bäckerei','Bäckerei','Bäckerei','Großbäckerei','Brotfabrik','Brotfabrik','Lebensmittelwerk'],size:2,hp:500,cost:{wood:110,stone:40},time:24,minEpoch:1,sight:4,slot:13,ai:{minWorkers:16},
      desc:'Backt aus Weizen Brot (+6 Nahrung je Ladung). Weizen kommt von Feldern, wenn eine Mühle steht.',
      draw(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+6,base-2,s-6,5);
        g.fillStyle=a.wall;g.fillRect(x+5,base-22,s-10,22);g.fillStyle=a.shade(a.wall,-18);g.fillRect(x+s/2,base-22,s/2-5,22);
        g.fillStyle=a.roof;g.beginPath();g.moveTo(x+2,base-22);g.lineTo(x+s/2,base-36);g.lineTo(x+s-2,base-22);g.closePath();g.fill();
        g.fillStyle='#8a5a3a';g.beginPath();g.arc(x+s/2,base-4,8,Math.PI,0);g.fill();const glow=b.baking?.6+Math.sin(a.time*9)*.3:.15;
        g.fillStyle=`rgba(255,150,50,${glow})`;g.beginPath();g.arc(x+s/2,base-4,5,Math.PI,0);g.fill();
        g.fillStyle='#6a5a4a';g.fillRect(x+s-14,base-44,6,14);g.fillStyle=pc;g.fillRect(x+8,base-18,5,5)}},
    mine:{name:'Erzmine',names:['Erzgrube','Erzgrube','Erzmine','Erzmine','Bergwerk','Bergwerk','Bergwerk','Zeche','Zeche','Tagebau'],size:2,hp:600,cost:{wood:120,gold:30},time:26,minEpoch:2,sight:4,slot:14,ai:{minWorkers:18},
      desc:'Fördert Erz für die Schmiede.',
      draw(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
        g.fillStyle='#7d7468';g.beginPath();g.moveTo(x+2,base);g.lineTo(x+s/2,base-30);g.lineTo(x+s-2,base);g.closePath();g.fill();
        g.fillStyle='#968c7e';g.beginPath();g.moveTo(x+2,base);g.lineTo(x+s/2,base-30);g.lineTo(x+s/2,base);g.closePath();g.fill();
        g.fillStyle='#1c1612';g.beginPath();g.arc(x+s/2,base,8,Math.PI,0);g.fill();g.strokeStyle='#6b4a2a';g.lineWidth=2.5;g.beginPath();g.arc(x+s/2,base,9,Math.PI,0);g.stroke();g.lineWidth=1;
        g.fillStyle='#5a3f22';g.fillRect(x+s-14,base-6,10,5);g.fillStyle='#b0563a';for(let k=0;k<3;k++){g.beginPath();g.arc(x+s-12+k*3,base-7,1.6,0,7);g.fill()}
        g.fillStyle=pc;g.fillRect(x+s/2-1,base-36,2,8);g.fillRect(x+s/2+1,base-36,5,3)}},
    smith:{name:'Schmiede',names:['Feuerstelle','Kupferschmiede','Bronzegießerei','Schmiede','Schmiede','Schmiede','Eisenhütte','Stahlwerk','Stahlwerk','Werkzeugfabrik'],size:2,hp:600,cost:{wood:100,stone:80},time:28,minEpoch:2,sight:4,slot:19,ai:{minWorkers:20},
      desc:'Schmiedet aus Erz Werkzeug. Jedes Werkzeug macht alle Arbeiter schneller (bis +25 %).',
      draw(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+6,base-2,s-6,5);
        g.fillStyle=a.shade(a.wall,-10);g.fillRect(x+4,base-20,s-8,20);g.fillStyle=a.roof;g.fillRect(x+2,base-26,s-4,7);
        g.fillStyle='#4a4038';g.fillRect(x+6,base-42,8,18);const hot=b.forging?.8:.2;g.fillStyle=`rgba(255,120,40,${hot})`;g.fillRect(x+s/2-4,base-12,9,8);
        g.fillStyle='#3a3a3e';g.fillRect(x+s-18,base-8,12,4);g.fillRect(x+s-14,base-4,4,4);g.fillStyle=pc;g.fillRect(x+s-10,base-24,4,4)}},
  },
  hooks:{
    tick(api,dt){
      for(const pl of api.players){
        const p=pl.i,gd=pl.goods||(pl.goods={wheat:0,ore:0,tools:0});pl.chainT=(pl.chainT||0)+dt;if(pl.chainT<1)continue;const step=pl.chainT;pl.chainT=0;
        const mine=api.ents.filter(e=>e.kind==='bld'&&e.owner===p&&e.built&&!e.dead);
        if(mine.some(b=>b.type==='mill'))gd.wheat=Math.min(200,gd.wheat+.12*step*mine.filter(b=>b.type==='farm').length);
        for(const b of mine){
          if(b.type==='bakery'){b.baking=gd.wheat>=1;if(b.baking){b.cyc=(b.cyc||0)+step;if(b.cyc>=3){b.cyc=0;gd.wheat-=1;const v=Math.round(6*(pl.moodMul||1));pl.res.food+=v;api.income(pl,'food',v)}}}
          if(b.type==='mine'){gd.ore=Math.min(200,gd.ore+.25*step)}
          if(b.type==='smith'){b.forging=gd.ore>=1;if(b.forging){b.cyc=(b.cyc||0)+step;if(b.cyc>=5){b.cyc=0;gd.ore-=1;gd.tools=Math.min(50,gd.tools+1)}}}
        }
        // Werkzeug nutzt sich langsam ab
        gd.tools=Math.max(0,gd.tools-.004*step*gd.tools);
        pl.toolMul=1+Math.min(.25,gd.tools*.005);
      }
    },
  },
});
})();
