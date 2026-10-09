// Kern-Baustein: Seefahrt. Der Hafen muss am Ufer stehen; Schiffe fahren nur auf Wasser.
(function(){
// Rumpf, Segel oder Schornstein je nach Epoche
function ship(g,u,api,big){
  const x=u.x*api.T,y=u.y*api.T,ep=api.epochOf(u.owner),L=big?26:20,W=big?9:7,pc=api.PCOL[u.owner];
  g.translate(x,y);g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.ellipse(0,3,L*.75,W*.7,u.ang,0,7);g.fill();g.rotate(u.ang);
  const modern=ep>=7,hull=modern?'#59626a':ep>=5?'#5a3a22':'#7a5530';
  g.fillStyle=api.shade(hull,-25);g.beginPath();g.moveTo(-L/2,-W/2);g.lineTo(L/2-6,-W/2);g.quadraticCurveTo(L/2+4,0,L/2-6,W/2);g.lineTo(-L/2,W/2);g.closePath();g.fill();
  g.fillStyle=hull;g.beginPath();g.moveTo(-L/2+2,-W/2+1.5);g.lineTo(L/2-7,-W/2+1.5);g.quadraticCurveTo(L/2+1,0,L/2-7,W/2-1.5);g.lineTo(-L/2+2,W/2-1.5);g.closePath();g.fill();
  g.fillStyle=pc;g.fillRect(-L/2+1,-W/2,L-8,1.6);
  if(modern){g.fillStyle='#7c858c';g.fillRect(-5,-3,10,6);g.fillStyle='#2b2f33';g.fillRect(-2,-2,4,4);g.strokeStyle='#2b2f33';g.lineWidth=2;g.beginPath();g.moveTo(5,0);g.lineTo(big?14:11,0);g.stroke()}
  else{const masts=big&&ep>=5?2:1;for(let m=0;m<masts;m++){const mx=masts>1?(m?5:-5):0;g.fillStyle='#3a2a1a';g.beginPath();g.arc(mx,0,1.4,0,7);g.fill();
      g.fillStyle=ep>=5?'#f1ead6':'#e2d3a8';g.beginPath();g.ellipse(mx,0,2.4,W*.9+2,0,0,7);g.fill();g.fillStyle=pc;g.fillRect(mx-1,-1,2,2)}
    if(ep<=3){g.strokeStyle='#5a3f22';g.lineWidth=1;g.beginPath();for(let i=-L/2+4;i<L/2-6;i+=4){g.moveTo(i,-W/2);g.lineTo(i-2,-W/2-4);g.moveTo(i,W/2);g.lineTo(i-2,W/2+4)}g.stroke()}}
}
EmpireXY.register({
  id:'kern-seefahrt',name:'Kern: Seefahrt',version:'1.0.0',core:true,
  description:'Hafen am Ufer, Kriegsschiffe und Linienschiffe von der Kupferzeit bis zur Moderne.',
  buildings:{
    dock:{name:'Hafen',size:2,hp:900,cost:{wood:150},time:28,minEpoch:1,shore:true,sight:6,slot:16,
      desc:'Muss direkt am Wasser stehen. Baut Kriegsschiffe.',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,modern=ep>=7;
        g.fillStyle=modern?'#8b8f90':'#7a5530';g.fillRect(x,y+s*.45,s,s*.5);
        g.strokeStyle=modern?'#6b6f70':'#4a3220';g.lineWidth=1;g.beginPath();for(let i=x+4;i<x+s;i+=5){g.moveTo(i,y+s*.45);g.lineTo(i,y+s*.95)}g.stroke();
        g.fillStyle=a.shade(a.wall,-10);g.fillRect(x+6,y+4,s*.5,s*.42);g.fillStyle=a.roof;g.beginPath();g.moveTo(x+3,y+6);g.lineTo(x+6+s*.25,y-8);g.lineTo(x+9+s*.5,y+6);g.closePath();g.fill();
        g.strokeStyle=modern?'#c9a227':'#5a3f22';g.lineWidth=2;g.beginPath();g.moveTo(x+s-8,y+s*.9);g.lineTo(x+s-8,y-10);g.lineTo(x+s*.45,y-4);g.stroke();
        g.fillStyle=pc;g.fillRect(x+s-9,y-14,8,4);
      }},
  },
  units:{
    warship:{label:'Kriegsschiff',cls:'ship',naval:true,from:'dock',minEpoch:1,names:['','Kriegskanu','Bireme','Trireme','Langschiff','Karavelle','Fregatte','Panzerkreuzer','Zerstörer','Lenkwaffenkreuzer'],
      hp:180,atk:8,range:5,rate:1.8,speed:2.2,sight:8,cost:{wood:120,gold:40},time:20,r:.45,pop:2,proj:1,bonus:{ship:1.4},
      desc:'Schnelles Kampfschiff gegen Schiffe und Truppen am Ufer.',draw(g,u,api){ship(g,u,api,false)}},
    bigship:{label:'Linienschiff',cls:'ship',naval:true,from:'dock',minEpoch:5,names:['','','','','','Galeone','Linienschiff','Panzerschiff','Schlachtschiff','Flugzeugträger'],
      hp:420,atk:24,range:7.5,rate:3.4,speed:1.5,sight:9,cost:{wood:200,gold:150},time:32,r:.55,pop:3,proj:2,vsUnit:.6,vsBld:2.6,
      desc:'Schwimmende Festung, beschießt Gebäude an der Küste.',draw(g,u,api){ship(g,u,api,true)}},
  },
});
})();
