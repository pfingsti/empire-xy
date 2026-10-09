// Kern-Baustein: Produktionsketten (nach Die Siedler, Anno und Caesar).
// Felder liefern Weizen, die Mühle mahlt ihn zu Mehl, die Bäckerei backt daraus Brot (Nahrung).
// Das Sägewerk schneidet Holz zu Brettern (schneller bauen), der Steinmetz behaut Stein (stärkere Gebäude).
// Die Erzmine fördert Erz, die Schmiede macht daraus Werkzeug. Werkzeug beschleunigt alle Arbeiter (bis +25 %).
(function(){
const has=(api,p,t)=>api.ents.some(e=>e.kind==='bld'&&e.type===t&&e.owner===p&&e.built&&!e.dead);
EmpireXY.register({
  id:'kern-ketten',name:'Kern: Produktionsketten',version:'1.0.0',core:true,
  description:'Weizen → Mühle → Mehl → Bäckerei → Brot, Holz → Sägewerk → Bretter, Stein → Steinmetz → Quader, Erz → Schmiede → Werkzeug.',
  buildings:{
    bakery:{name:'Bäckerei',names:['Backofen','Backhaus','Bäckerei','Bäckerei','Bäckerei','Bäckerei','Großbäckerei','Brotfabrik','Brotfabrik','Lebensmittelwerk'],size:2,hp:500,cost:{wood:110,stone:40},time:24,minEpoch:1,sight:4,slot:13,ai:{minWorkers:16},
      desc:'Backt aus Mehl Brot (+6 Nahrung je Ladung). Felder liefern Weizen, die Mühle mahlt ihn zu Mehl.',
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
    sawmill:{name:'Sägewerk',names:['Holzplatz','Zimmerei','Zimmerei','Sägegrube','Sägemühle','Sägewerk','Sägewerk','Dampfsägewerk','Holzwerk','Holzwerk'],size:2,hp:500,cost:{wood:90,stone:30},time:22,minEpoch:1,sight:4,slot:20,ai:{minWorkers:17},
      desc:'Schneidet Holz zu Brettern. Bretter lassen alle Gebäude schneller entstehen (bis +40 %).',
      draw(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+6,base-2,s-6,5);
        g.fillStyle='#5a3f22';for(const px of [x+5,x+s-8])g.fillRect(px,base-24,3,24);
        g.fillStyle=a.roof;g.beginPath();g.moveTo(x+1,base-22);g.lineTo(x+s/2,base-34);g.lineTo(x+s-1,base-22);g.closePath();g.fill();
        g.fillStyle='#b08850';for(let k=0;k<4;k++)g.fillRect(x+8,base-6-k*3,s-16,2.5);
        const r=a.time*(b.sawing?8:0);g.strokeStyle='#c9ccd0';g.lineWidth=1.5;g.beginPath();g.arc(x+s/2,base-14,6,r,r+5.5);g.stroke();g.lineWidth=1;
        g.fillStyle=pc;g.fillRect(x+s/2-2,base-30,4,4)}},
    mason:{name:'Steinmetz',names:['Steinplatz','Steinplatz','Steinmetz','Steinmetz','Bauhütte','Steinmetzhütte','Steinmetzhütte','Steinwerk','Betonwerk','Betonwerk'],size:2,hp:700,cost:{wood:80,stone:60},time:24,minEpoch:2,sight:4,slot:21,ai:{minWorkers:19},
      desc:'Behaut Stein zu Quadern. Quader machen neue Gebäude widerstandsfähiger (bis +30 % Leben).',
      draw(g,b,a){const {x,y,s,pc}=a,base=y+s-4;
        g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x+6,base-2,s-6,5);
        g.fillStyle=a.shade(a.wall,-8);g.fillRect(x+4,base-18,s/2,18);g.fillStyle=a.roof;g.fillRect(x+2,base-22,s/2+4,5);
        g.fillStyle='#a9a69c';for(let k=0;k<3;k++)for(let j=0;j<3-k;j++){g.fillRect(x+s/2+6+j*7+k*3.5,base-6-k*5,6,4.5)}
        g.strokeStyle='rgba(0,0,0,.3)';for(let k=0;k<3;k++)for(let j=0;j<3-k;j++)g.strokeRect(x+s/2+6+j*7+k*3.5,base-6-k*5,6,4.5);
        g.fillStyle=pc;g.fillRect(x+8,base-14,4,4)}},
  },
  hooks:{
    tick(api,dt){
      for(const pl of api.players){
        const p=pl.i,gd=pl.goods||(pl.goods={wheat:0,ore:0,tools:0});for(const k of ['flour','planks','blocks'])gd[k]=gd[k]||0;pl.chainT=(pl.chainT||0)+dt;if(pl.chainT<1)continue;const step=pl.chainT;pl.chainT=0;
        const mine=api.ents.filter(e=>e.kind==='bld'&&e.owner===p&&e.built&&!e.dead);
        gd.wheat=Math.min(200,gd.wheat+.12*step*mine.filter(b=>b.type==='farm').length);
        for(const b of mine){
          if(b.type==='mill'&&gd.wheat>=1){b.cyc=(b.cyc||0)+step;if(b.cyc>=2){b.cyc=0;gd.wheat-=1;gd.flour=Math.min(200,gd.flour+1)}}
          if(b.type==='sawmill'){b.sawing=pl.res.wood>=60;if(b.sawing){b.cyc=(b.cyc||0)+step;if(b.cyc>=4){b.cyc=0;pl.res.wood-=6;gd.planks=Math.min(40,gd.planks+1)}}}
          if(b.type==='mason'&&pl.res.stone>=60){b.cyc=(b.cyc||0)+step;if(b.cyc>=5){b.cyc=0;pl.res.stone-=5;gd.blocks=Math.min(40,gd.blocks+1)}}
          if(b.type==='bakery'){b.baking=gd.flour>=1;if(b.baking){b.cyc=(b.cyc||0)+step;if(b.cyc>=3){b.cyc=0;gd.flour-=1;const v=Math.round(6*(pl.moodMul||1));pl.res.food+=v;api.income(pl,'food',v)}}}
          if(b.type==='mine'){gd.ore=Math.min(200,gd.ore+.25*step)}
          if(b.type==='smith'){b.forging=gd.ore>=1;if(b.forging){b.cyc=(b.cyc||0)+step;if(b.cyc>=5){b.cyc=0;gd.ore-=1;gd.tools=Math.min(50,gd.tools+1)}}}
        }
        // Werkzeug nutzt sich langsam ab
        gd.tools=Math.max(0,gd.tools-.004*step*gd.tools);
        pl.toolMul=1+Math.min(.25,gd.tools*.005);
        gd.planks=Math.max(0,gd.planks-.003*step*gd.planks);gd.blocks=Math.max(0,gd.blocks-.002*step*gd.blocks);
        // Bretter → Baugeschwindigkeit, Quader → Gebäudeleben (als Aufschlag auf die Forschungswerte)
        const nb=Math.min(.4,gd.planks*.02),nh=Math.min(.3,gd.blocks*.015);
        pl.fx.build+=nb-(pl.chainBuild||0);pl.chainBuild=nb;pl.fx.bldHp+=nh-(pl.chainHp||0);pl.chainHp=nh;
      }
    },
  },
});
})();
