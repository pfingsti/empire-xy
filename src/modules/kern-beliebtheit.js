// Kern-Baustein: Beliebtheit (nach Stronghold, Caesar und Tropico).
// Volle Speicher, Märkte und Tempel machen das Volk zufrieden; Hunger, Enge und Krieg verärgern es.
// Die Beliebtheit (0–100) ändert das Sammeltempo aller Arbeiter zwischen 75 % und 125 %.
EmpireXY.register({
  id:'kern-beliebtheit',name:'Kern: Beliebtheit',version:'1.0.0',core:true,
  description:'Zufriedenheit des Volkes mit Markt und Tempel, wirkt auf das Sammeltempo.',
  buildings:{
    market:{name:'Marktplatz',size:3,hp:900,cost:{wood:180,gold:40},time:30,minEpoch:1,sight:5,slot:17,mood:10,ai:{minWorkers:16},
      desc:'+10 Beliebtheit (höchstens zwei Märkte zählen).',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a;g.fillStyle=ep>=7?'#a9a69c':'#b79f72';g.fillRect(x+2,y+6,s-4,s-8);
        g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=.8;g.beginPath();for(let i=x+8;i<x+s;i+=8){g.moveTo(i,y+6);g.lineTo(i,y+s-2)}g.stroke();
        const cols=['#b8322c','#2f6fb3','#d9a43a','#3c8a4a'];
        for(let i=0;i<4;i++){const sx=x+8+(i%2)*(s/2-2),sy=y+14+Math.floor(i/2)*(s/2-6);
          g.fillStyle='#5a3f22';g.fillRect(sx,sy+6,2,12);g.fillRect(sx+22,sy+6,2,12);g.fillStyle='#7a5530';g.fillRect(sx,sy+12,24,5);
          g.fillStyle=cols[i];g.beginPath();g.moveTo(sx-3,sy+7);g.lineTo(sx+12,sy-2);g.lineTo(sx+27,sy+7);g.closePath();g.fill();
          g.fillStyle='rgba(255,255,255,.35)';for(let k=0;k<3;k++)g.fillRect(sx+3+k*8,sy+3,3,4);
          g.fillStyle=['#e0814f','#8fc06a','#e8c650'][i%3];for(let k=0;k<4;k++){g.beginPath();g.arc(sx+4+k*5,sy+12,1.8,0,7);g.fill()}}
        g.fillStyle=pc;g.fillRect(x+s/2-2,y+s/2-2,4,4);
      }},
    temple:{name:'Tempel',names:['Ahnenstein','Schrein','Tempel','Tempel','Kloster','Kirche','Kathedrale','Kirche','Kapelle','Gemeindezentrum'],size:2,hp:800,cost:{stone:120,gold:60},time:30,sight:5,slot:18,mood:8,ai:{minWorkers:20},
      desc:'+8 Beliebtheit (höchstens zwei zählen).',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,cx=x+s/2,base=y+s-4,stone=ep>=3?a.wall:'#9a8e78';
        g.fillStyle='rgba(0,0,0,.28)';g.fillRect(x+6,base-2,s-4,6);
        if(ep===0){for(const [dx,h] of [[-14,22],[-5,28],[5,28],[14,22]]){g.fillStyle='#8d8a82';g.fillRect(cx+dx-3,base-h,6,h);g.fillStyle='#a9a69c';g.fillRect(cx+dx-3,base-h,3,h)}g.fillStyle='#8d8a82';g.fillRect(cx-9,base-31,18,4);return}
        g.fillStyle=a.shade(stone,-12);g.fillRect(x+6,base-26,s-12,26);g.fillStyle=a.shade(stone,6);g.fillRect(x+6,base-26,(s-12)/2,26);
        if(ep<=3){g.fillStyle=a.shade(stone,18);for(let i=0;i<5;i++)g.fillRect(x+8+i*(s-18)/4,base-24,3,22);g.fillStyle=a.roof;g.beginPath();g.moveTo(x+3,base-26);g.lineTo(cx,base-40);g.lineTo(x+s-3,base-26);g.closePath();g.fill()}
        else{g.fillStyle=a.roof;g.beginPath();g.moveTo(x+4,base-26);g.lineTo(cx,base-38);g.lineTo(x+s-4,base-26);g.closePath();g.fill();
          g.fillStyle=a.shade(stone,-20);g.fillRect(cx-5,base-52,10,26);g.fillStyle=a.roof;g.beginPath();g.moveTo(cx-6,base-52);g.lineTo(cx,base-64);g.lineTo(cx+6,base-52);g.closePath();g.fill()}
        g.fillStyle='#2b1d12';g.beginPath();g.moveTo(cx-4,base);g.lineTo(cx-4,base-8);g.arc(cx,base-8,4,Math.PI,0);g.lineTo(cx+4,base);g.fill();
        g.fillStyle=pc;g.fillRect(cx-1,base-20,2,6);g.fillRect(cx-3,base-18,6,2);
      }},
  },
  hooks:{
    tick(api,dt){
      for(const pl of api.players){
        pl.moodT=(pl.moodT||0)-dt;if(pl.moodT>0)continue;pl.moodT=1;
        let m=50;const why=[];
        const food=pl.res.food;if(food>=400){m+=12;why.push('volle Speicher +12')}else if(food>=150){m+=5;why.push('genug Nahrung +5')}else if(food<40){m-=18;why.push('Hunger −18')}
        if(pl.cap>0&&pl.pop>=pl.cap){m-=10;why.push('Wohnungsnot −10')}
        const blds=api.ents.filter(e=>e.kind==='bld'&&e.owner===pl.i&&e.built&&!e.dead);
        if(blds.some(b=>b.type==='wonder')){m+=15;why.push('Weltwunder +15')}
        for(const t of ['market','temple']){const n=Math.min(2,blds.filter(b=>b.type===t).length);if(n){const v=n*(t==='market'?10:8);m+=v;why.push((t==='market'?'Märkte':'Tempel')+' +'+v)}}
        const lost=(pl.st&&pl.st.lost)||0,recent=lost-(pl.moodLost||0);pl.moodLost=lost;pl.moodWar=Math.max(0,(pl.moodWar||0)*.97+recent*2);
        if(pl.moodWar>1){const v=Math.min(20,Math.round(pl.moodWar));m-=v;why.push('Kriegsverluste −'+v)}
        m=Math.max(0,Math.min(100,m));pl.mood=(pl.mood??50)+(m-(pl.mood??50))*.15;
        pl.moodMul=(.75+pl.mood/200)*(pl.wonderGather||1);pl.moodWhy=why.length?why.join(', ')+'.':'keine Einflüsse.';
      }
    },
  },
});
