// Kern-Baustein: Seefahrt. Der Hafen muss am Ufer stehen; Schiffe fahren nur auf Wasser.
(function(){
// Schiffe in Seitenansicht wie in EE2: Rumpf mit Planken und Wasserlinie, Bugwelle und Kielwasser, Takelage oder Aufbauten je Epoche
function ship(g,u,api,big){
  const x=u.x*api.T,y=u.y*api.T,ep=api.epochOf(u.owner),pc=api.PCOL[u.owner],t=api.time,sh=api.shade;
  const dir=Math.cos(u.ang)>=0?1:-1,L=big?44:32,mv=u.moving,bob=Math.sin(t*1.6+u.id)*.8,roll=Math.sin(t*1.1+u.id*2)*.025;
  const modern=ep>=7,iron=ep>=7,carrier=big&&ep>=9;
  g.translate(x,y+4);
  // Kielwasser und Bugwelle (nicht gespiegelt gezeichnet, nur Richtung)
  g.save();g.scale(dir,1);
  if(mv){for(let k=0;k<3;k++){const ph=(t*1.5+k/3)%1;g.strokeStyle=`rgba(230,240,240,${(.35*(1-ph)).toFixed(2)})`;g.lineWidth=1;g.beginPath();g.moveTo(-L/2-ph*14,1+ph*3);g.quadraticCurveTo(-L/2+4,0,-L/2+8,1);g.moveTo(-L/2-ph*14,1-ph*2.4);g.lineTo(-L/2+6,.4);g.stroke()}
    g.fillStyle='rgba(235,242,240,.55)';g.beginPath();g.ellipse(L/2-1,.8,3.5,1.2,0,0,7);g.fill()}
  g.fillStyle='rgba(10,30,45,.28)';g.beginPath();g.ellipse(0,1.6,L*.55,2.6,0,0,7);g.fill();   // Schatten/Spiegelung im Wasser
  g.translate(0,bob);g.rotate(roll);
  const plank=(y0,y1)=>{g.strokeStyle='rgba(20,12,6,.35)';g.lineWidth=.4;g.beginPath();for(let k=y0;k<y1;k+=1.5){g.moveTo(-L/2+2,k);g.lineTo(L/2-3,k)}g.stroke()};
  const hullPath=(top,stern,bow,bowX)=>{g.beginPath();g.moveTo(-L/2,top-stern);g.lineTo(L/2-4,top);g.quadraticCurveTo(bowX,top-bow,L/2+2,top-bow);g.quadraticCurveTo(L/2,0,L/2-6,1);g.lineTo(-L/2+4,1);g.quadraticCurveTo(-L/2-1,0,-L/2,top-stern);g.closePath()};
  if(modern){// Stahlrumpf, Aufbauten, Schornstein mit Rauch, Geschütztürme
    const hg=g.createLinearGradient(0,-7,0,1);hg.addColorStop(0,'#8a939a');hg.addColorStop(1,'#3e464c');g.fillStyle=hg;hullPath(-6,1,2.4,L/2+1);g.fill();
    g.fillStyle='#7a2a24';g.fillRect(-L/2+4,-.6,L-10,1.4);g.fillStyle='rgba(255,255,255,.15)';g.fillRect(-L/2+1,-6,L-6,.7);
    if(carrier){g.fillStyle='#4a5258';g.fillRect(-L/2-2,-8.4,L+4,2.6);g.strokeStyle='rgba(230,230,210,.6)';g.lineWidth=.4;g.setLineDash([2,2]);g.beginPath();g.moveTo(-L/2,-7.1);g.lineTo(L/2,-7.1);g.stroke();g.setLineDash([]);
      g.fillStyle='#6a737a';g.fillRect(4,-15,6,6.6);g.fillStyle='#2e3438';g.fillRect(5,-14,4,1.2);g.fillStyle='#8a939a';for(const px of [-12,-4]){g.beginPath();g.moveTo(px-3,-8.6);g.lineTo(px+3,-8.6);g.lineTo(px,-10.4);g.fill()}}
    else{g.fillStyle='#7c858c';g.fillRect(-6,-11,12,5.2);g.fillRect(-3,-14.5,6,3.6);g.fillStyle='#2b2f33';for(let k=-5;k<5;k+=2)g.fillRect(k,-9.6,1.2,1);g.fillRect(-2.4,-13.6,4.8,.9);
      g.fillStyle='#4a4f54';g.fillRect(-11,-11.5,3.4,5);g.fillStyle='#202326';g.fillRect(-11,-12,3.4,1);
      const sm=(t*.8+u.id)%1;for(let k=0;k<3;k++){const q=(sm+k/3)%1;g.fillStyle=`rgba(90,90,90,${(.35*(1-q)).toFixed(2)})`;g.beginPath();g.arc(-9.3-q*8,-13-q*6,1.6+q*3,0,7);g.fill()}
      for(const [tx,dd] of [[L/2-12,1],[-L/2+7,-1]]){g.fillStyle='#5e676e';g.beginPath();g.ellipse(tx,-6.6,2.8,1.4,0,Math.PI,0);g.fill();g.fillRect(tx-2.8,-6.8,5.6,.8);g.strokeStyle='#2b2f33';g.lineWidth=.9;g.beginPath();g.moveTo(tx+dd*1.5,-7.4);g.lineTo(tx+dd*(big?8:6),-8.2);g.stroke()}
      g.strokeStyle='#3a3f44';g.lineWidth=.5;g.beginPath();g.moveTo(0,-14.5);g.lineTo(0,-19);g.moveTo(-1.6,-17.6);g.lineTo(1.6,-17.6);g.stroke()}
    g.fillStyle=pc;g.fillRect(-L/2+1,-10,.6,4);g.fillRect(-L/2+1.6,-10,3,2)}
  else{// Holzschiffe
    const galley=ep<=3,viking=ep===4,tall=ep>=5,hullC=ep>=6?'#3a2a1e':ep>=5?'#5a3a22':'#7a5530',top=tall?(big?-8:-6.5):-4.6;
    const hg=g.createLinearGradient(0,top,0,1);hg.addColorStop(0,sh(hullC,25));hg.addColorStop(1,sh(hullC,-35));g.fillStyle=hg;
    hullPath(top,tall?(big?5:3):viking?4:1,viking?6:galley?1:3,L/2+(viking?0:2));g.fill();plank(top+1,1);
    if(viking){g.strokeStyle=sh(hullC,-20);g.lineWidth=1.4;g.beginPath();g.moveTo(-L/2,top-4);g.quadraticCurveTo(-L/2-3,top-7,-L/2+1,top-8);g.moveTo(L/2+2,top-6);g.quadraticCurveTo(L/2+4,top-9,L/2,top-10);g.stroke();
      for(let k=-L/2+5;k<L/2-5;k+=3.4){g.fillStyle=(k*7|0)%2?pc:'#c8b88a';g.beginPath();g.arc(k,top+1.2,1.4,0,7);g.fill();g.fillStyle='#6a6e70';g.beginPath();g.arc(k,top+1.2,.45,0,7);g.fill()}}
    if(galley){g.fillStyle='#4a4f52';g.beginPath();g.moveTo(L/2-1,-.6);g.lineTo(L/2+4,0);g.lineTo(L/2-1,.8);g.fill();g.fillStyle='rgba(240,232,210,.8)';g.beginPath();g.arc(L/2-6,top+1.8,.8,0,7);g.fill()}
    if(galley||viking){const n=galley&&ep>=2?(big?12:9):7,ph=mv?Math.sin(t*5+u.id):0;g.strokeStyle='#5a3f22';g.lineWidth=.6;g.beginPath();
      for(let k=0;k<n;k++){const ox=-L/2+6+k*(L-14)/(n-1);g.moveTo(ox,top+2);g.lineTo(ox-2+ph*2,3.2);if(ep>=3&&galley){g.moveTo(ox+1,top+3);g.lineTo(ox-1+ph*2,3.6)}}g.stroke()}
    if(tall){g.fillStyle='#e8d48a';g.fillRect(-L/2+2,top+2.4,L-8,.7);
      if(ep>=6){g.fillStyle='#1a120c';for(let k=-L/2+5;k<L/2-6;k+=3.6)g.fillRect(k,top+3.6,1.6,1.4);if(big)for(let k=-L/2+6;k<L/2-8;k+=3.6)g.fillRect(k,top+6,1.6,1.3)}
      g.fillStyle=sh(hullC,10);g.fillRect(-L/2,top-(big?5:3),L*.22,big?5:3)}
    // Masten und Segel
    const masts=galley||viking?1:big?3:ep>=6?3:2,mH=galley?16:viking?18:big?28:22;
    for(let m=0;m<masts;m++){const mx=masts===1?-1:-L*.3+m*(L*.6/(masts-1)),h=mH-(masts===3&&m!==1?4:0);
      g.strokeStyle='#3a2a1a';g.lineWidth=1;g.beginPath();g.moveTo(mx,top);g.lineTo(mx,top-h);g.stroke();
      const sw=mv?1:.6,sail=(y0,hh,w)=>{const sg=g.createLinearGradient(mx-w,0,mx+w,0);sg.addColorStop(0,'#cfc4a4');sg.addColorStop(.5,ep>=5?'#f0e8d4':'#e2d3a8');sg.addColorStop(1,'#b8ac8a');g.fillStyle=sg;
        g.beginPath();g.moveTo(mx-w,y0);g.lineTo(mx+w,y0);g.quadraticCurveTo(mx+w+1.6*sw,y0+hh*.55,mx+w*.9,y0+hh);g.lineTo(mx-w*.9,y0+hh);g.quadraticCurveTo(mx-w+1.6*sw,y0+hh*.55,mx-w,y0);g.fill();
        g.strokeStyle='#4a3220';g.lineWidth=.6;g.beginPath();g.moveTo(mx-w-.5,y0);g.lineTo(mx+w+.5,y0);g.stroke()};
      if(galley||viking){sail(top-h+1,h-5,big?7:6);g.fillStyle=pc;g.globalAlpha=.75;if(viking){for(let k=0;k<3;k++)g.fillRect(mx-5+k*3.6,top-h+1.4,1.6,h-6.4)}else g.fillRect(mx-6,top-h+(h-5)*.45,12,1.8);g.globalAlpha=1}
      else{const w=big?6:5;sail(top-h+1,h*.32,w);sail(top-h+h*.36,h*.36,w+1);g.fillStyle=pc;g.beginPath();g.moveTo(mx,top-h);g.lineTo(mx-5,top-h+1.2);g.lineTo(mx,top-h+2.4);g.fill()}}
    if(tall){g.strokeStyle='rgba(40,28,16,.55)';g.lineWidth=.35;g.beginPath();g.moveTo(L/2+2,top-3);g.lineTo(-L*.3+(L*.6)*(masts>1?1:.5),top-mH+2);g.moveTo(-L/2,top-4);g.lineTo(-L*.3,top-mH+4);g.stroke();
      g.strokeStyle='#3a2a1a';g.lineWidth=.9;g.beginPath();g.moveTo(L/2,top-2);g.lineTo(L/2+7,top-6);g.stroke()}}
  g.restore();
}
// Hafen: Lagerhaus, Bohlensteg auf Pfählen, Ladekran mit Last, Fracht und ein vertäutes Ruderboot
function dockGfx(g,s,ep,pc,a){
  const bx=4,by=36,x1=bx+s,y1=by+s,modern=ep>=7,mat=a.MAT[Math.min(ep,a.MAT.length-1)];let sd=ep*131+7;const rn=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const dy=by+s*.5;
  // Pfähle und Wasserschatten unter dem Steg
  g.fillStyle='rgba(10,24,34,.35)';g.fillRect(bx+4,y1-1,s-2,5);
  for(let px=bx+3;px<x1;px+=7){g.fillStyle=modern?'#6a6e70':'#3a2a1a';g.fillRect(px,y1-2,2.2,5);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(px,y1-2,.7,5)}
  // Bohlendeck
  const dg=g.createLinearGradient(0,dy,0,y1);dg.addColorStop(0,modern?'#9a9c98':'#8a6a44');dg.addColorStop(1,modern?'#74766f':'#6a4e30');g.fillStyle=dg;g.fillRect(bx,dy,s,y1-dy);
  if(!modern){for(let px=bx+2.4;px<x1;px+=2.6){g.fillStyle='rgba(30,18,8,.35)';g.fillRect(px,dy,.5,y1-dy);if(rn()<.4){g.fillStyle='rgba(255,230,190,.12)';g.fillRect(px+.6,dy+rn()*(y1-dy-6),1.6,5)}}}
  else{g.strokeStyle='rgba(40,40,40,.3)';g.lineWidth=.5;g.beginPath();for(let py=dy+6;py<y1;py+=8){g.moveTo(bx,py);g.lineTo(x1,py)}g.stroke();g.fillStyle='#c9a227';g.fillRect(bx,y1-2.2,s,1.2)}
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(bx,y1-1,s,1.2);
  // Lagerhaus
  a.hall(g,bx+2,by+2,bx+s*.64,dy+6,11,mat,a.wall,a.roof,ep>=2,7);
  // Poller mit Tau, Fässer, Kisten, Säcke
  for(const px of [bx+6,bx+s*.5,x1-6]){g.fillStyle=modern?'#3a3e42':'#2e2418';g.beginPath();g.ellipse(px,y1-4,1.6,1,0,0,7);g.fill();g.fillRect(px-1.4,y1-7,2.8,3);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(px-1.2,y1-7,.8,3)}
  g.strokeStyle='#b8a272';g.lineWidth=.8;g.beginPath();g.ellipse(bx+12,y1-6,3,1.4,0,0,7);g.ellipse(bx+12,y1-6.6,2.2,1,0,0,7);g.stroke();
  const crate=(cx,cy,w)=>{g.fillStyle='#8a6a3e';g.fillRect(cx,cy-w,w,w);g.fillStyle='#6a4e2a';g.fillRect(cx+w,cy-w-1,2,w+1);g.fillStyle='#a8865a';g.fillRect(cx,cy-w-1.4,w+2,1.4);g.strokeStyle='rgba(40,24,10,.5)';g.lineWidth=.5;g.beginPath();g.moveTo(cx,cy-w);g.lineTo(cx+w,cy);g.stroke()};
  const barrel=(cx,cy)=>{g.fillStyle='#6a4a2a';g.beginPath();g.ellipse(cx,cy-3,2.4,3.4,0,0,7);g.fill();g.fillStyle='#3a3a3a';g.fillRect(cx-2.4,cy-5,4.8,.6);g.fillRect(cx-2.4,cy-1.6,4.8,.6);g.fillStyle='#8a6a44';g.beginPath();g.ellipse(cx,cy-6.2,2,.8,0,0,7);g.fill()};
  if(modern){g.fillStyle='#7a3a2a';g.fillRect(bx+s*.68,dy+3,12,6);g.fillStyle='#2e5a7a';g.fillRect(bx+s*.68,dy-3,12,6);g.fillStyle='rgba(0,0,0,.2)';for(let k=0;k<12;k+=1.5){g.fillRect(bx+s*.68+k,dy-3,.4,12)}}
  else{crate(bx+s*.68,dy+10,5);crate(bx+s*.68+6.5,dy+10,4.5);crate(bx+s*.68+2.5,dy+5,4);barrel(bx+s*.42,dy+12);barrel(bx+s*.42+5,dy+13);
    g.fillStyle='#c4ad7c';g.beginPath();g.ellipse(bx+s*.3,dy+13,3,2.2,0,0,7);g.fill();g.fillStyle='rgba(0,0,0,.2)';g.fillRect(bx+s*.3-2.6,dy+13.6,5.2,.6)}
  // Ladekran: Holzmast mit Ausleger (Tretradkran) bzw. Stahlkran
  const kx=x1-9,ky=dy+14;
  if(modern){g.strokeStyle='#c9a227';g.lineWidth=2;g.beginPath();g.moveTo(kx-4,ky);g.lineTo(kx-2,ky-34);g.moveTo(kx+4,ky);g.lineTo(kx+2,ky-34);g.stroke();g.lineWidth=.6;g.beginPath();for(let k=0;k<34;k+=5){g.moveTo(kx-4+k*.06,ky-k);g.lineTo(kx+4-(k+5)*.06,ky-k-5)}g.stroke();
    g.lineWidth=1.8;g.beginPath();g.moveTo(kx+6,ky-33);g.lineTo(kx-24,ky-31);g.stroke();g.fillStyle='#3a3e42';g.fillRect(kx-4,ky-38,8,5)}
  else{g.strokeStyle='#4a3220';g.lineWidth=2.2;g.beginPath();g.moveTo(kx,ky);g.lineTo(kx,ky-28);g.stroke();g.lineWidth=1.6;g.beginPath();g.moveTo(kx,ky-26);g.lineTo(kx-20,ky-34);g.moveTo(kx,ky-14);g.lineTo(kx-12,ky-30.6);g.stroke();
    g.strokeStyle='rgba(255,230,190,.2)';g.lineWidth=.6;g.beginPath();g.moveTo(kx-.6,ky);g.lineTo(kx-.6,ky-28);g.stroke();
    g.fillStyle='#5a3f22';g.beginPath();g.arc(kx+3,ky-4,4,0,7);g.fill();g.strokeStyle='#3a2a1a';g.lineWidth=.5;g.beginPath();for(let k=0;k<6;k++){const q=k*Math.PI/3;g.moveTo(kx+3,ky-4);g.lineTo(kx+3+Math.cos(q)*4,ky-4+Math.sin(q)*4)}g.stroke()}
  g.strokeStyle='#2a2018';g.lineWidth=.5;g.beginPath();g.moveTo(kx-19,ky-33);g.lineTo(kx-19,ky-18);g.stroke();
  g.fillStyle=modern?'#2e5a7a':'#8a6a3e';g.fillRect(kx-22,ky-18,6,5);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(kx-22,ky-14,6,1);
  a.banner(g,bx+s*.66,dy-2,pc,16);
  // vertäutes Ruderboot am Stegrand
  const rx=bx+s*.18,ry=y1+3.5;g.fillStyle='rgba(10,24,34,.3)';g.beginPath();g.ellipse(rx+8,ry+1.5,10,1.6,0,0,7);g.fill();
  g.fillStyle=modern?'#c8ccd0':'#7a5530';g.beginPath();g.moveTo(rx,ry-3);g.lineTo(rx+17,ry-3);g.quadraticCurveTo(rx+18,ry,rx+14,ry+1);g.lineTo(rx+3,ry+1);g.quadraticCurveTo(rx-.6,ry,rx,ry-3);g.fill();
  g.fillStyle=modern?'#7a2a24':'#4a3220';g.fillRect(rx+1,ry-3.4,16,.8);g.strokeStyle='#b8a272';g.lineWidth=.4;g.beginPath();g.moveTo(rx+16,ry-3);g.lineTo(bx+6,y1-6);g.stroke();
}
EmpireXY.register({
  id:'kern-seefahrt',name:'Kern: Seefahrt',version:'1.0.0',core:true,
  description:'Hafen am Ufer, Kriegsschiffe und Linienschiffe von der Kupferzeit bis zur Moderne.',
  buildings:{
    dock:{name:'Hafen',size:2,hp:900,cost:{wood:150},time:28,minEpoch:1,shore:true,sight:6,slot:16,
      desc:'Muss direkt am Wasser stehen. Baut Kriegsschiffe.',
      draw(g,b,a){const {x,y,s,ep,pc}=a,c=a.sprite('b|dock|'+ep+'|'+b.owner,s+24,s+48,g2=>dockGfx(g2,s,ep,pc,a));g.drawImage(c,x-4,y-36,c.lw,c.lh);
      }},
  },
  units:{
    warship:{label:'Kriegsschiff',cls:'ship',naval:true,from:'dock',minEpoch:1,names:['','Kriegskanu','Bireme','Trireme','Langschiff','Karavelle','Fregatte','Panzerkreuzer','Zerstörer','Lenkwaffenkreuzer'],
      hp:180,atk:8,range:5,rate:1.8,speed:2.2,sight:8,cost:{wood:120,gold:40},time:20,r:.45,pop:2,proj:1,noShadow:true,bonus:{ship:1.4},
      desc:'Schnelles Kampfschiff gegen Schiffe und Truppen am Ufer.',draw(g,u,api){ship(g,u,api,false)}},
    bigship:{label:'Linienschiff',cls:'ship',naval:true,from:'dock',minEpoch:5,names:['','','','','','Galeone','Linienschiff','Panzerschiff','Schlachtschiff','Flugzeugträger'],
      hp:420,atk:24,range:7.5,rate:3.4,speed:1.5,sight:9,cost:{wood:200,gold:150},time:32,r:.55,pop:3,proj:2,noShadow:true,vsUnit:.6,vsBld:2.6,
      desc:'Schwimmende Festung, beschießt Gebäude an der Küste.',draw(g,u,api){ship(g,u,api,true)}},
  },
});
})();
