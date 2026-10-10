// Kern-Baustein: Epochenwunder (nach Civilization und Rise of Nations). Jede Epoche hat ein einziges Großbauwerk.
// Wer es zuerst errichtet, bekommt seinen Bonus für immer; danach ist es für alle anderen gesperrt.
(function(){
const MON=[
  ['Stonehenge','+10 % Sammeltempo',{gather:.10}],
  ['Große Pyramide','+12 Beliebtheit',{mood:12}],
  ['Hängende Gärten','+15 % Sammeltempo',{gather:.15}],
  ['Kolosseum','+15 % Kampfkraft',{atk:.15}],
  ['Kathedrale von Chartres','+15 % Produktionstempo',{prod:.15}],
  ['Leuchtturm von Alexandria','+20 % Produktionstempo',{prod:.20}],
  ['Börse','+1 Gold pro Sekunde',{gold:1}],
  ['Eiffelturm','+15 Beliebtheit und +10 % Sammeltempo',{mood:15,gather:.10}],
  ['Pentagon','+25 % Kampfkraft',{atk:.25}],
  ['Raumstation','deckt die Karte auf, +20 % Kampfkraft',{atk:.20,reveal:1}],
];
function draw(g,b,a){
  const {x,y,s,pc}=a,ep=b.mep??a.ep,cx=x+s/2,base=y+s-4;
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(cx+4,base,s/2,8,0,0,7);g.fill();
  const st='#a9a08a',dk=a.shade(st,-25),lt=a.shade(st,15);
  if(ep===0){for(let i=0;i<8;i++){const an=i/8*Math.PI*2,px=cx+Math.cos(an)*s*.36,py=base-s*.3+Math.sin(an)*s*.18;g.fillStyle=dk;g.fillRect(px-3,py-20,7,20);g.fillStyle=lt;g.fillRect(px-3,py-20,3,20)}g.fillStyle=dk;g.fillRect(cx-s*.3,base-s*.3-24,s*.6,5)}
  else if(ep===1){g.fillStyle='#d8c08a';g.beginPath();g.moveTo(x+4,base);g.lineTo(cx,y-14);g.lineTo(x+s-4,base);g.closePath();g.fill();g.fillStyle='#b89c62';g.beginPath();g.moveTo(cx,y-14);g.lineTo(x+s-4,base);g.lineTo(cx,base);g.closePath();g.fill()}
  else if(ep===2){for(let k=0;k<3;k++){g.fillStyle=a.shade('#b89c72',-k*8);g.fillRect(x+6+k*8,base-14-k*16,s-12-k*16,14);g.fillStyle='#4f8a3c';g.fillRect(x+6+k*8,base-16-k*16,s-12-k*16,4)}}
  else if(ep===3){g.fillStyle=dk;g.beginPath();g.ellipse(cx,base-18,s*.46,22,0,0,7);g.fill();g.fillStyle=lt;g.beginPath();g.ellipse(cx,base-22,s*.42,18,0,0,7);g.fill();g.fillStyle='#6a5f4c';for(let i=-3;i<=3;i++){g.fillRect(cx+i*10-3,base-30,6,9)}g.fillStyle='#c9a86a';g.beginPath();g.ellipse(cx,base-22,s*.24,9,0,0,7);g.fill()}
  else if(ep===4){g.fillStyle=dk;g.fillRect(x+10,base-46,s-20,46);g.fillStyle=lt;for(const tx of [x+10,x+s-22]){g.fillRect(tx,base-80,12,80);g.fillStyle=dk;g.beginPath();g.moveTo(tx-2,base-80);g.lineTo(tx+6,base-104);g.lineTo(tx+14,base-80);g.fill();g.fillStyle=lt}g.fillStyle='#4a6fa8';g.beginPath();g.arc(cx,base-34,8,0,7);g.fill()}
  else if(ep===5){g.fillStyle=lt;g.fillRect(cx-12,base-30,24,30);g.fillStyle=st;g.fillRect(cx-8,base-70,16,40);g.fillStyle=dk;g.fillRect(cx-5,base-96,10,26);g.fillStyle='rgba(255,210,90,'+(.6+.4*Math.sin(a.time*3))+')';g.beginPath();g.arc(cx,base-100,6,0,7);g.fill()}
  else if(ep===6){g.fillStyle=lt;g.fillRect(x+8,base-40,s-16,40);g.fillStyle=dk;g.beginPath();g.moveTo(x+4,base-40);g.lineTo(cx,base-62);g.lineTo(x+s-4,base-40);g.fill();g.fillStyle='#f4f0e4';for(let i=0;i<6;i++)g.fillRect(x+12+i*(s-28)/5,base-38,5,36)}
  else if(ep===7){g.strokeStyle='#6a5a48';g.lineWidth=3;g.beginPath();g.moveTo(x+6,base);g.quadraticCurveTo(cx-4,base-40,cx-2,y-40);g.moveTo(x+s-6,base);g.quadraticCurveTo(cx+4,base-40,cx+2,y-40);g.stroke();g.lineWidth=2;for(const h of [24,54]){g.beginPath();g.moveTo(cx-s*.3+h*.4,base-h);g.lineTo(cx+s*.3-h*.4,base-h);g.stroke()}g.beginPath();g.moveTo(cx,y-40);g.lineTo(cx,y-56);g.stroke()}
  else if(ep===8){g.fillStyle='#9c9f98';g.beginPath();for(let i=0;i<5;i++){const an=-Math.PI/2+i*Math.PI*2/5;g.lineTo(cx+Math.cos(an)*s*.46,base-s*.3+Math.sin(an)*s*.3)}g.closePath();g.fill();g.fillStyle='#6f736c';g.beginPath();for(let i=0;i<5;i++){const an=-Math.PI/2+i*Math.PI*2/5;g.lineTo(cx+Math.cos(an)*s*.2,base-s*.3+Math.sin(an)*s*.13)}g.closePath();g.fill()}
  else{g.fillStyle='#c7cbcc';g.fillRect(cx-4,base-60,8,60);g.fillStyle='#8fa6c4';g.fillRect(x+2,base-56,s-4,8);g.fillStyle='#e8ecee';g.beginPath();g.ellipse(cx,base-52,14,10,0,0,7);g.fill();g.fillStyle='rgba(120,200,255,'+(.5+.4*Math.sin(a.time*4))+')';g.beginPath();g.arc(cx,base-66,4,0,7);g.fill()}
  g.fillStyle=pc;g.fillRect(x+s-10,base-8,6,6);
}
EmpireXY.register({
  id:'kern-epochenwunder',name:'Kern: Epochenwunder',version:'1.0.0',core:true,
  description:'Ein einziges Großbauwerk pro Epoche und Partie mit dauerhaftem Bonus.',
  buildings:{
    monument:{name:'Epochenwunder',names:MON.map(m=>m[0]),size:3,hp:2400,cost:{wood:400,stone:400,gold:250},time:90,sight:6,slot:23,monument:true,ai:{minWorkers:22},
      desc:'Pro Epoche gibt es ein Wunder, und nur das erste Reich, das es baut, bekommt es: '+MON.map(m=>m[0]+' ('+m[1]+')').join(', ')+'.',draw},
  },
  hooks:{
    tick(api,dt){
      for(const pl of api.players){pl.monGather=1;pl.monAtk=0;pl.monProd=1;pl.monMood=0}
      for(const b of api.ents){if(b.type!=='monument'||b.dead)continue;
        if(b.mep===undefined){b.mep=api.players[b.owner].epoch;}
        if(!b.built)continue;const pl=api.players[b.owner],e=MON[Math.min(9,b.mep)][2];
        if(!b.announced){b.announced=1;api.toast((b.owner===0?'Unser Epochenwunder steht: ':'Ein Gegner hat ein Epochenwunder errichtet: ')+MON[Math.min(9,b.mep)][0]+'.',b.owner===0?'good':'warn')}
        if(e.gather)pl.monGather+=e.gather;if(e.atk)pl.monAtk+=e.atk;if(e.prod)pl.monProd+=e.prod;if(e.mood)pl.monMood+=e.mood;
        if(e.gold){b.goldAcc=(b.goldAcc||0)+e.gold*dt;if(b.goldAcc>=1){pl.res.gold+=1;api.income(pl,'gold',1);b.goldAcc-=1}}
        if(e.reveal&&b.owner===0&&!b.revealed){b.revealed=1;api.revealAll()}
      }
    },
  },
});
})();
