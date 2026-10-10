// Kern-Baustein: Fahrzeuge und Luftwaffe als eigene Einheitenkategorien.
// cls 'vehicle' = Bodenfahrzeuge aus der Panzerfabrik, cls 'aircraft' = Flugzeuge und Hubschrauber vom Flughafen.
// air:true lässt eine Einheit über Gelände, Wasser und Mauern fliegen; Nahkämpfer und Belagerung können sie nicht treffen.
// seats = Truppentransport: Fußtruppen steigen per Rechtsklick ein, „Absitzen“ lässt sie wieder aussteigen.
(function(){
const L0={x:-.7071,y:-.7071}; // Licht von links oben, unabhängig von der Drehung der Einheit
function lit(g,ang,len,c,api,hi,lo){const ca=Math.cos(-ang),sa=Math.sin(-ang),lx=L0.x*ca-L0.y*sa,ly=L0.x*sa+L0.y*ca;
  const gr=g.createLinearGradient(lx*len,ly*len,-lx*len,-ly*len);gr.addColorStop(0,api.shade(c,hi||28));gr.addColorStop(.5,c);gr.addColorStop(1,api.shade(c,lo||-34));return gr}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath()}
function poly(g,pts){g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()}
// Rumpf dreht träge, Turm zeigt sofort aufs Ziel
function hullAng(u,api){const t=api.time;if(u.hAng===undefined||u.hT===undefined||t-u.hT>1){u.hAng=u.ang;u.hT=t}
  const dt=Math.max(0,t-u.hT);u.hT=t;let d=u.ang-u.hAng;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;
  if(u.moving||Math.abs(d)>1.2)u.hAng+=d*Math.min(1,dt*(u.moving?6:1.5));return u.hAng}

// ---------- Bodenfahrzeuge ----------
function tracks(g,L,W,tw,u,api,col){
  const off=u.moving?(api.time*18)%3:0;
  for(const s of [-1,1]){const y0=s<0?-W/2:W/2-tw;
    g.fillStyle=col||'#25241f';rr(g,-L/2,y0,L,tw,2);g.fill();
    g.strokeStyle='rgba(0,0,0,.55)';g.lineWidth=.8;g.beginPath();for(let x=-L/2+1+off;x<L/2-1;x+=3){g.moveTo(x,y0+.6);g.lineTo(x,y0+tw-.6)}g.stroke();
    g.fillStyle='rgba(160,155,140,.25)';g.fillRect(-L/2+1,s<0?y0+.4:y0+tw-1.2,L-2,.8)}
}
function barrel(g,x0,len,w,u,brake){const rec=u.swing>.12?-3:0;
  g.fillStyle='#22241f';g.fillRect(x0+rec,-w/2,len,w);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(x0+rec,-w/2,len,w*.35);
  if(brake){g.fillStyle='#1c1d19';g.fillRect(x0+len-3+rec,-w*.9,3,w*1.8)}
  if(u.swing>.17){const tx=x0+len+rec+1;g.fillStyle='rgba(255,236,170,.95)';g.beginPath();g.moveTo(tx,0);g.lineTo(tx+5,-2.6);g.lineTo(tx+9,0);g.lineTo(tx+5,2.6);g.closePath();g.fill();
    g.fillStyle='rgba(255,170,60,.6)';g.beginPath();g.arc(tx+3,0,3.2,0,7);g.fill()}}
function shadowRect(g,u,ha,L,W,api){g.save();g.translate(u.x*api.T+4,u.y*api.T+4);g.rotate(ha);g.fillStyle='rgba(6,10,4,.32)';rr(g,-L/2-1,-W/2-1,L+2,W+2,4);g.fill();g.restore()}
const CAMO={steam:'#5f574a',light:'#6b6a4d',medium:'#525c3a',heavy:'#8a7f56',mbt:'#5d6449',future:'#3c444a',apc8:'#5a6040',apc9:'#5f6650'};

// Bodenfahrzeuge in Seitenansicht wie in EE2: Laufwerk mit Rollen und Kette, Wanne mit Bugplatte, Turm mit Rohr, Rückstoß und Mündungsfeuer
function sideStart(g,u,api,L){const T=api.T,dir=Math.cos(u.ang)>=0?1:-1;g.translate(u.x*T,u.y*T+(u.r||.5)*T*.5);
  g.fillStyle='rgba(6,10,4,.32)';g.beginPath();g.ellipse(2,1,L*.58,3.4,0,0,7);g.fill();g.scale(dir,1)}
function grad(g,y0,y1,c,api){const gr=g.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,api.shade(c,24));gr.addColorStop(.55,c);gr.addColorStop(1,api.shade(c,-34));return gr}
function sideTrack(g,L,h,n,u,api,col){const r=h/2,mv=u.moving?api.time*14:0;
  g.fillStyle=col||'#25261f';g.beginPath();g.moveTo(-L/2+r,-h);g.lineTo(L/2-r,-h);g.arc(L/2-r,-r,r,-Math.PI/2,Math.PI/2);g.lineTo(-L/2+r,0);g.arc(-L/2+r,-r,r,Math.PI/2,Math.PI*1.5);g.fill();
  g.strokeStyle='rgba(90,90,80,.5)';g.lineWidth=.6;g.beginPath();for(let x=-L/2+r+(mv%2.4);x<L/2-r;x+=2.4){g.moveTo(x,-h);g.lineTo(x,-h+.9);g.moveTo(x,-.9);g.lineTo(x,0)}g.stroke();
  for(let k=0;k<n;k++){const wx=-L/2+r+.6+k*(L-2*r-1.2)/(n-1),wr=k===0||k===n-1?r*.78:r*.68;g.fillStyle='#3a3b34';g.beginPath();g.arc(wx,-r,wr,0,7);g.fill();g.fillStyle='#55574d';g.beginPath();g.arc(wx,-r,wr*.45,0,7);g.fill();g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.arc(wx-wr*.2,-r-wr*.25,wr*.3,0,7);g.fill()}}
function sideGun(g,x0,y0,len,w,u,brake,col){const rec=u.swing>.12?-3:0;g.fillStyle=col||'#2e3128';g.fillRect(x0+rec,y0-w/2,len,w);g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x0+rec,y0-w/2,len,w*.3);
  if(brake){g.fillStyle='#24261f';g.fillRect(x0+rec+len-2.6,y0-w*.85,2.6,w*1.7)}
  if(u.swing>.18){const fx=x0+rec+len+2;g.fillStyle='rgba(255,210,120,.9)';g.beginPath();g.ellipse(fx,y0,3.4,1.8,0,0,7);g.fill();for(let k=0;k<3;k++){const pg=g.createRadialGradient(fx+3+k*4,y0-1-k*2,0,fx+3+k*4,y0-1-k*2,4+k);pg.addColorStop(0,'rgba(200,196,186,.55)');pg.addColorStop(1,'rgba(200,196,186,0)');g.fillStyle=pg;g.beginPath();g.arc(fx+3+k*4,y0-1-k*2,4+k,0,7);g.fill()}}}
function camo(g,pts,api,c){g.fillStyle=api.shade(c,-22);g.globalAlpha=.55;for(const [x,y,w] of pts){g.beginPath();g.ellipse(x,y,w,1.6,.2,0,7);g.fill()}g.globalAlpha=1}
function drawTank(g,u,api,kind){
  const pc=api.PCOL[u.owner],c=CAMO[kind],L={steam:32,light:24,medium:30,heavy:36,mbt:36,future:36}[kind];
  sideStart(g,u,api,L);
  if(kind==='steam'){// Landschiff aus dem Ersten Weltkrieg: Rhombenform, umlaufende Kette, Seitenerker mit Geschütz, Schornstein
    const tr=[[-L/2,-4],[-L/2+4,-15],[L/2-2,-15],[L/2+3,-4],[L/2-4,0],[-L/2+3,0]];g.fillStyle='#2a261f';g.beginPath();tr.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();
    g.fillStyle=grad(g,-14,-1,c,api);g.beginPath();g.moveTo(-L/2+3,-4);g.lineTo(-L/2+6,-13);g.lineTo(L/2-3,-13);g.lineTo(L/2,-4);g.lineTo(L/2-5,-1.6);g.lineTo(-L/2+5,-1.6);g.closePath();g.fill();
    g.fillStyle='rgba(30,25,20,.7)';for(let x=-L/2+6;x<L/2-3;x+=2.6){g.fillRect(x,-12.4,.7,.7);g.fillRect(x,-2.6,.7,.7)}
    g.fillStyle=api.shade(c,-12);g.fillRect(-4,-11,9,6);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(3,-11,2,6);sideGun(g,5,-8,7,1.8,u,false,'#2a2620');
    g.fillStyle='#2e2a24';g.fillRect(-L/2+8,-21,3,8);for(let i=0;i<4;i++){const f=((api.time*.9+i/4+u.id*.13)%1);g.fillStyle=`rgba(110,105,100,${(.45*(1-f)).toFixed(2)})`;g.beginPath();g.arc(-L/2+9.5-f*8,-23-f*14,1.6+f*3,0,7);g.fill()}
    g.fillStyle=pc;g.fillRect(-L/2+7,-11,3,3);return}
  if(kind==='future'){// Schwebepanzer: flache Keilform über Antigrav-Kufen, Lichtspalt darunter
    const hv=Math.sin(api.time*3+u.id)*.6-3;g.fillStyle='rgba(150,200,220,.25)';g.beginPath();g.ellipse(0,-1.5,L*.42,1.6,0,0,7);g.fill();
    g.translate(0,hv);g.fillStyle='#24292d';g.fillRect(-L/2+2,-4,L-4,3);g.fillStyle='rgba(150,210,230,.55)';g.fillRect(-L/2+4,-1.2,L-8,.7);
    g.fillStyle=grad(g,-11,-3,c,api);g.beginPath();g.moveTo(-L/2,-4);g.lineTo(-L/2+1,-10);g.lineTo(L/2-8,-11);g.lineTo(L/2+2,-5);g.lineTo(L/2-2,-3.4);g.closePath();g.fill();
    g.fillStyle=api.shade(c,10);g.beginPath();g.moveTo(-10,-10.6);g.lineTo(-8,-16);g.lineTo(6,-16);g.lineTo(10,-11);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-10,-12,20,1);
    sideGun(g,8,-14.2,18,1.4,u,false,'#1c2024');sideGun(g,8,-12,16,1.2,{swing:0},false,'#1c2024');g.fillStyle=pc;g.fillRect(-L/2+3,-8.6,4,2.4);return}
  const tH={light:5,medium:6,heavy:7,mbt:6.4}[kind];sideTrack(g,L,tH,kind==='light'?4:kind==='medium'?5:6,u,api);
  // Wanne: Kettenabdeckung, Bugplatte schräg, Heck
  const hy=-tH,hh={light:5,medium:6,heavy:7,mbt:5.4}[kind];g.fillStyle=grad(g,hy-hh,hy+1,c,api);
  g.beginPath();g.moveTo(-L/2-1,hy+.6);g.lineTo(-L/2,hy-hh);g.lineTo(L/2-(kind==='mbt'?9:6),hy-hh);g.lineTo(L/2+1,hy+(kind==='mbt'?-1:.6));g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-L/2,hy-.6,L,1.2);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(-L/2,hy-hh,L-8,.7);
  if(kind==='mbt'){g.fillStyle=api.shade(c,-8);g.fillRect(-L/2+2,hy-2.4,L-6,2.4);g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=.5;g.beginPath();for(let x=-L/2+6;x<L/2-4;x+=6){g.moveTo(x,hy-2.4);g.lineTo(x,hy)}g.stroke()}
  if(kind==='heavy'||kind==='mbt')camo(g,[[-8,hy-hh*.5,4],[4,hy-hh*.4,5]],api,c);
  g.fillStyle=pc;g.fillRect(-L/2+2,hy-hh+1.6,3.4,2.2);
  // Turm
  const tb=hy-hh,tc=api.shade(c,6);
  if(kind==='light'){g.fillStyle=grad(g,tb-5,tb,tc,api);g.beginPath();g.moveTo(-6,tb);g.lineTo(-5,tb-5);g.lineTo(3,tb-5);g.lineTo(5,tb);g.closePath();g.fill();sideGun(g,4,tb-2.6,9,1.4,u)}
  else if(kind==='medium'){g.fillStyle=grad(g,tb-7,tb,tc,api);g.beginPath();g.moveTo(-8,tb);g.quadraticCurveTo(-8,tb-7,-2,tb-7.4);g.lineTo(3,tb-7.4);g.quadraticCurveTo(7,tb-6,7,tb);g.closePath();g.fill();sideGun(g,6,tb-3.6,15,1.8,u);
    g.fillStyle=api.shade(tc,-10);g.fillRect(-4,tb-9,4,1.8)}
  else if(kind==='heavy'){g.fillStyle=grad(g,tb-8,tb,tc,api);g.beginPath();g.moveTo(-11,tb);g.lineTo(-10,tb-8);g.lineTo(5,tb-8);g.lineTo(9,tb-3);g.lineTo(9,tb);g.closePath();g.fill();sideGun(g,8,tb-4.4,20,2.2,u,true);
    camo(g,[[-4,tb-4,3.4]],api,c);g.fillStyle=api.shade(tc,-12);g.fillRect(-7,tb-10,5,2.2)}
  else{g.fillStyle=grad(g,tb-7,tb,tc,api);g.beginPath();g.moveTo(-13,tb);g.lineTo(-13,tb-6);g.lineTo(2,tb-7);g.lineTo(10,tb-4);g.lineTo(9,tb);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.22)';g.fillRect(-13,tb-6,3,6);
    sideGun(g,9,tb-3.8,22,1.9,u);g.fillStyle='#2a2d26';g.fillRect(-6,tb-9,3,2);g.fillStyle='#3a3d33';g.fillRect(-2,tb-9.6,5,2.6);g.strokeStyle='#2a2a2a';g.lineWidth=.5;g.beginPath();g.moveTo(-10,tb-6);g.lineTo(-11,tb-13);g.stroke()}
}
function drawApc(g,u,api){
  const pc=api.PCOL[u.owner],ep=api.epochOf(u.owner),modern=ep>=9,L=modern?32:28,c=modern?CAMO.apc9:CAMO.apc8,n=(u.cargo||[]).length,rot=u.moving?api.time*9:0;
  sideStart(g,u,api,L);
  const wheel=(wx,r)=>{g.fillStyle='#1d1e1b';g.beginPath();g.arc(wx,-r,r,0,7);g.fill();g.fillStyle='#4a4c44';g.beginPath();g.arc(wx,-r,r*.45,0,7);g.fill();g.strokeStyle='rgba(120,120,110,.5)';g.lineWidth=.4;g.beginPath();for(let k=0;k<3;k++){const q=rot+k*2.1;g.moveTo(wx,-r);g.lineTo(wx+Math.cos(q)*r*.45,-r+Math.sin(q)*r*.45)}g.stroke()};
  if(modern){for(const wx of [-11,-4,5,12])wheel(wx,3.4);
    g.fillStyle=grad(g,-14,-3,c,api);g.beginPath();g.moveTo(-L/2,-4);g.lineTo(-L/2,-13);g.lineTo(L/2-8,-14);g.lineTo(L/2+1,-8);g.lineTo(L/2,-4);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-L/2,-6,L,1.2);g.fillStyle='#2a3a44';g.fillRect(L/2-9,-12,3,2.6);g.fillStyle=api.shade(c,-8);g.fillRect(-4,-17,8,3.4);sideGun(g,3,-15.6,10,1.2,u,false,'#22241f');g.fillStyle=pc;g.fillRect(-L/2+2,-11,3.4,2.4)}
  else{// Halbkette: Vorderrad, Kettenlaufwerk hinten, offener Kampfraum mit Helmen
    sideTrack(g,L*.55,5.6,4,u,api);wheel(L/2-5,3.4);
    g.fillStyle=grad(g,-13,-4,c,api);g.beginPath();g.moveTo(-L/2,-5);g.lineTo(-L/2,-12);g.lineTo(L/2-12,-12);g.lineTo(L/2-8,-9);g.lineTo(L/2+1,-8);g.lineTo(L/2+1,-5);g.closePath();g.fill();
    g.fillStyle='#3a3a30';g.fillRect(L/2-4,-8,3,2);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-L/2,-6,L,1);
    for(let i=0;i<Math.min(4,n);i++){g.fillStyle='#55553c';g.beginPath();g.arc(-L/2+4+i*3.6,-12.6,1.6,Math.PI,0);g.fill()}g.fillStyle=pc;g.fillRect(-L/2+2,-10.6,3.4,2.4)}
}

// ---------- Luftfahrzeuge ----------
// shape(g,S,api,u) zeichnet die Maschine; S=true heißt Schattenpass (alles einfarbig dunkel)
function flyer(g,u,api,shape,o){
  const T=api.T,t=api.time;let x=u.x*T,y=u.y*T,a=u.ang;
  const alt=(o.alt||26)+(o.hover?Math.sin(t*2.2+u.id)*1.6:0);
  if(!u.moving&&!o.hover&&!(u.swing>0)){const ph=t*(o.circle||.8)+u.id*1.7,R=o.R||10;x+=Math.cos(ph)*R;y+=Math.sin(ph)*R*.55;a=Math.atan2(Math.cos(ph)*R*.55,-Math.sin(ph)*R)}
  u.airX=x;u.airY=y-alt; // für Treffer und Auswahl
  g.save();g.translate(x+alt*.42,y+alt*.12);g.rotate(a);g.globalAlpha=.3;shape(g,true,api,u);g.restore();
  g.save();g.translate(x,y-alt);g.rotate(a);shape(g,false,api,u);g.restore();
}
const SH='rgba(4,8,4,1)';
const F=(S,c)=>S?SH:c;
function prop(g,S,x,r){if(S)return;g.fillStyle='rgba(40,40,40,.28)';g.beginPath();g.ellipse(x,0,1.3,r,0,0,7);g.fill();g.fillStyle='#222';g.beginPath();g.arc(x,0,1.1,0,7);g.fill()}
function roundel(g,S,x,y,pc,r){if(S)return;g.fillStyle=pc;g.beginPath();g.arc(x,y,r,0,7);g.fill();g.fillStyle='#e9e4d6';g.beginPath();g.arc(x,y,r*.55,0,7);g.fill();g.fillStyle=pc;g.beginPath();g.arc(x,y,r*.25,0,7);g.fill()}
function glass(g,S,x,y,rx,ry){if(S)return;const gr=g.createLinearGradient(x-rx,y-ry,x+rx,y+ry);gr.addColorStop(0,'#cfe3ea');gr.addColorStop(.5,'#5d7e8c');gr.addColorStop(1,'#1d2c33');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fill()}
function flame(g,S,x,u,api){if(S||!u.moving)return;const f=.8+.2*Math.sin(api.time*40+u.id);const gr=g.createLinearGradient(x,0,x-9*f,0);gr.addColorStop(0,'rgba(255,240,200,.95)');gr.addColorStop(.4,'rgba(255,150,60,.75)');gr.addColorStop(1,'rgba(90,120,255,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x-4*f,0,5*f,1.6,0,0,7);g.fill()}
function fill(g,S,api,u,c,len){g.fillStyle=S?SH:lit(g,u.ang,len||12,c,api)}

const PLANES={
  biplane(g,S,api,u){const pc=api.PCOL[u.owner];
    g.fillStyle=F(S,'#6d6446');g.fillRect(-1,-14,6,28); // unterer Flügel
    fill(g,S,api,u,'#7d7352',10);rr(g,-11,-2.2,23,4.4,2);g.fill();
    g.fillStyle=F(S,'#6d6446');g.fillRect(-12,-5.5,4,11);
    fill(g,S,api,u,'#8d8360',14);g.fillRect(-2.5,-16,6.5,32);
    if(!S){g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=.6;g.beginPath();for(let i=-14;i<=14;i+=4){g.moveTo(-2.5,i);g.lineTo(4,i)}g.stroke();g.fillStyle='#2a2620';g.beginPath();g.arc(-4,0,1.6,0,7);g.fill()}
    roundel(g,S,.8,-12,pc,2.4);roundel(g,S,.8,12,pc,2.4);prop(g,S,12.5,6)},
  propfighter(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#59613f',14);poly(g,[[5,-2],[3,-15],[-1,-16],[-3,-2],[-3,2],[-1,16],[3,15],[5,2]]);g.fill();
    poly(g,[[-11,-1],[-13,-6],[-15,-6],[-15,6],[-13,6],[-11,1]]);g.fill();
    fill(g,S,api,u,'#636b47',12);g.beginPath();g.ellipse(0,0,13,2.8,0,0,7);g.fill();
    glass(g,S,0,0,3,1.6);if(!S){g.fillStyle=pc;g.fillRect(-8,-2.6,2,5.2);g.beginPath();g.arc(13,0,1.6,0,7);g.fill()}
    roundel(g,S,1,-11,pc,1.8);roundel(g,S,1,11,pc,1.8);prop(g,S,14,7)},
  sabre(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#a5abb0',14);poly(g,[[4,-2],[-6,-15],[-9,-15],[-5,-2],[-5,2],[-9,15],[-6,15],[4,2]]);g.fill();
    poly(g,[[-10,-1],[-15,-6],[-17,-6],[-14,0],[-17,6],[-15,6],[-10,1]]);g.fill();
    fill(g,S,api,u,'#b4babe',12);g.beginPath();g.ellipse(-1,0,14,2.6,0,0,7);g.fill();
    if(!S){g.fillStyle='#1b1d1f';g.beginPath();g.arc(13,0,1.4,0,7);g.fill();g.fillStyle=pc;g.fillRect(-12,-2,3,4)}glass(g,S,5,0,2.6,1.4);
    roundel(g,S,-4,-10,pc,1.6);roundel(g,S,-4,10,pc,1.6);flame(g,S,-15,u,api)},
  jet(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#7e868c',14);poly(g,[[8,-2],[0,-5],[-6,-14],[-9,-14],[-8,-3],[-8,3],[-9,14],[-6,14],[0,5],[8,2]]);g.fill();
    poly(g,[[-11,-1],[-15,-7],[-17,-7],[-16,0],[-17,7],[-15,7],[-11,1]]);g.fill();
    fill(g,S,api,u,'#8a9298',12);poly(g,[[16,0],[10,-2.2],[-14,-2.4],[-16,0],[-14,2.4],[10,2.2]]);g.fill();
    if(!S){g.strokeStyle='#e8e8e2';g.lineWidth=1;g.beginPath();g.moveTo(-4,-14.5);g.lineTo(-10,-14.5);g.moveTo(-4,14.5);g.lineTo(-10,14.5);g.stroke();g.fillStyle=pc;g.fillRect(-16,-1,2.5,2)}
    glass(g,S,8,0,3.2,1.4);flame(g,S,-16,u,api)},
  bomber(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#5f6644',20);poly(g,[[4,-3],[1,-24],[-3,-24],[-5,-3],[-5,3],[-3,24],[1,24],[4,3]]);g.fill();
    poly(g,[[-15,-1],[-17,-8],[-20,-8],[-20,8],[-17,8],[-15,1]]);g.fill();
    for(const s of [-1,1])for(const d of [7,14]){g.fillStyle=F(S,'#4d5236');rr(g,-1,s*d-1.6,8,3.2,1.4);g.fill();if(!S){g.save();g.translate(0,s*d);prop(g,S,8,5);g.restore()}}
    fill(g,S,api,u,'#686f4b',16);g.beginPath();g.ellipse(-2,0,18,3.2,0,0,7);g.fill();
    glass(g,S,15,0,2.6,2.4);if(!S){g.fillStyle=pc;g.fillRect(-12,-3,2.5,6)}roundel(g,S,0,-19,pc,2.2);roundel(g,S,0,19,pc,2.2)},
  stealth(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#2f3438',22);poly(g,[[12,0],[-6,-27],[-10,-21],[-6,-14],[-12,-8],[-8,0],[-12,8],[-6,14],[-10,21],[-6,27]]);g.fill();
    if(!S){g.fillStyle='rgba(255,255,255,.07)';poly(g,[[12,0],[-6,-27],[-4,-20],[4,-3],[4,3],[-4,20],[-6,27]]);g.fill();
      g.fillStyle='#14181b';for(const s of [-1,1]){g.beginPath();g.ellipse(0,s*5,3.4,1.4,0,0,7);g.fill()}g.fillStyle='#4d5b62';g.fillRect(6,-1.6,2.4,3.2);g.fillStyle=pc;g.fillRect(-5,-24,1.6,3);g.fillRect(-5,21,1.6,3)}},
  drone(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#9ca2a6',16);poly(g,[[2,-1],[1,-18],[-1,-18],[-1.5,-1],[-1.5,1],[-1,18],[1,18],[2,1]]);g.fill();
    poly(g,[[-9,-1],[-13,-6],[-14,-6],[-12,0],[-14,6],[-13,6],[-9,1]]);g.fill();
    fill(g,S,api,u,'#aeb3b6',10);g.beginPath();g.ellipse(0,0,10,1.9,0,0,7);g.fill();g.beginPath();g.arc(8,0,2.4,0,7);g.fill();
    if(!S){g.fillStyle='#2a3034';g.beginPath();g.arc(9,0,1,0,7);g.fill();g.fillStyle=pc;g.fillRect(-3,-17,2,3);g.fillRect(-3,14,2,3)}prop(g,S,-12,4)},
  heli(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#4c5340',12);rr(g,-19,-1,14,2,1);g.fill();g.fillRect(-20,-3.5,3,7);
    poly(g,[[11,0],[8,-3],[-6,-3.5],[-8,0],[-6,3.5],[8,3]]);g.fill();
    g.fillStyle=F(S,'#3c4233');g.fillRect(-1,-8,3,16);for(const s of [-1,1]){g.fillStyle=F(S,'#2c2f28');rr(g,-1.5,s*8-1.6,5,3.2,1);g.fill()}
    glass(g,S,7,0,2.6,1.8);glass(g,S,2.5,0,2.4,1.8);if(!S){g.fillStyle=pc;g.fillRect(-13,-1,3,2)}
    rotor(g,S,api,u,0,17,1)},
  chinook(g,S,api,u){const pc=api.PCOL[u.owner];
    fill(g,S,api,u,'#565c45',16);rr(g,-17,-4,34,8,3.5);g.fill();
    if(!S){g.fillStyle='rgba(0,0,0,.25)';for(let i=-10;i<10;i+=4)g.fillRect(i,-4,1.6,1.2);g.fillStyle=pc;g.fillRect(-4,-4,6,1.6);g.fillRect(-4,2.4,6,1.6)}
    glass(g,S,14,0,2.4,2.6);rotor(g,S,api,u,11,14,1);rotor(g,S,api,u,-12,14,-1)},
};
function rotor(g,S,api,u,cx,R,dir){if(S){g.globalAlpha*=.4;g.beginPath();g.arc(cx,0,R,0,7);g.fill();g.globalAlpha/=.4;return}
  g.fillStyle='rgba(30,32,30,.16)';g.beginPath();g.arc(cx,0,R,0,7);g.fill();
  const r0=api.time*28*dir+u.id;g.strokeStyle='rgba(25,27,25,.55)';g.lineWidth=1.4;g.beginPath();for(let i=0;i<4;i++){const a=r0+i*Math.PI/2;g.moveTo(cx,0);g.lineTo(cx+Math.cos(a)*R,Math.sin(a)*R)}g.stroke();
  g.fillStyle='#1d1f1c';g.beginPath();g.arc(cx,0,1.6,0,7);g.fill()}

const byEp=(u,api,list)=>{const ep=api.epochOf(u.owner);let k=list[0][1];for(const [e,v] of list)if(ep>=e)k=v;return k};
const veh=(kinds)=>function(g,u,api){drawTank(g,u,api,byEp(u,api,kinds))};
const air=(kinds,o)=>function(g,u,api){flyer(g,u,api,PLANES[byEp(u,api,kinds)],o||{})};

// ---------- Gebäude ----------
function drawFactory(g,b,a){
  const {x,y,s,ep,pc,lift}=a,modern=ep>=8;if(!b.built)g.globalAlpha=.65;
  g.fillStyle='#7c7a72';g.fillRect(x+1,y+1,s-2,s-2);g.fillStyle='rgba(0,0,0,.12)';for(let i=0;i<5;i++)g.fillRect(x+4+i*19,y+s-14,12,1);
  const hx=x+5,hy=y+4,hw=s-10,hh=s*.62,wall=modern?'#8c8a82':'#7d4a38';
  g.fillStyle='rgba(0,0,0,.3)';g.fillRect(hx+4,hy+4,hw,hh+lift);
  g.fillStyle=a.shade(wall,-18);g.fillRect(hx,hy+hh,hw,lift);
  if(!modern){g.strokeStyle='rgba(40,20,14,.35)';g.lineWidth=.6;g.beginPath();for(let r=hy+hh+2;r<hy+hh+lift;r+=2.5){g.moveTo(hx,r);g.lineTo(hx+hw,r)}g.stroke()}
  // Sheddach: Glasbänder im Wechsel mit Dachflächen
  const n=4,bw=hw/n;for(let i=0;i<n;i++){const bx=hx+i*bw;
    const gr=g.createLinearGradient(bx,0,bx+bw,0);gr.addColorStop(0,modern?'#6f767b':'#5a4a40');gr.addColorStop(1,modern?'#9aa1a6':'#7b665a');g.fillStyle=gr;g.fillRect(bx,hy,bw*.68,hh);
    const gl=g.createLinearGradient(bx+bw*.68,hy,bx+bw,hy+hh);gl.addColorStop(0,'#a9c3cc');gl.addColorStop(1,'#4d6670');g.fillStyle=gl;g.fillRect(bx+bw*.68,hy,bw*.32,hh);
    g.strokeStyle='rgba(30,40,45,.6)';g.lineWidth=.6;g.beginPath();for(let r=hy+4;r<hy+hh;r+=5){g.moveTo(bx+bw*.68,r);g.lineTo(bx+bw,r)}g.stroke()}
  // Rolltor und Schild
  g.fillStyle='#4a4d4f';g.fillRect(hx+hw*.32,hy+hh+1,hw*.36,lift-1);g.strokeStyle='rgba(0,0,0,.35)';g.beginPath();for(let r=hy+hh+2;r<hy+hh+lift;r+=1.6){g.moveTo(hx+hw*.32,r);g.lineTo(hx+hw*.68,r)}g.stroke();
  g.fillStyle=pc;g.fillRect(hx+hw*.4,hy+hh-5,hw*.2,4);
  // Schornstein mit Rauch
  const cx=x+s-14,cy=y+6;g.fillStyle='#5b3a2e';g.fillRect(cx-3,cy-18,6,20);g.fillStyle='#2a1d17';g.fillRect(cx-3,cy-19,6,2);
  if(b.built)for(let i=0;i<4;i++){const f=((a.time*.35+i/4+b.id*.17)%1);g.fillStyle=`rgba(95,92,88,${(.4*(1-f)).toFixed(2)})`;g.beginPath();g.arc(cx+f*12,cy-20-f*22,3+f*7,0,7);g.fill()}
}
function drawAirfield(g,b,a){
  const {x,y,s,ep,pc,lift}=a,paved=ep>=8,t=a.time;if(!b.built)g.globalAlpha=.65;
  g.fillStyle=paved?'#6f7069':'#6f7a4a';g.fillRect(x+1,y+1,s-2,s-2);
  // Startbahn
  const ry=y+s*.62,rh=s*.24;g.fillStyle=paved?'#3b3d3c':'#8a8a5c';g.fillRect(x+2,ry,s-4,rh);
  if(paved){g.fillStyle='#e9e7df';for(let i=x+14;i<x+s-14;i+=12)g.fillRect(i,ry+rh/2-.8,7,1.6);for(let k=0;k<4;k++){g.fillRect(x+5,ry+3+k*(rh-6)/4,6,2);g.fillRect(x+s-11,ry+3+k*(rh-6)/4,6,2)}}
  else{g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x+2,ry+rh*.35,s-4,rh*.3)}
  // Hangar mit Tonnendach
  const hx=x+6,hy=y+6,hw=s*.5,hh=s*.4;g.fillStyle='rgba(0,0,0,.3)';g.fillRect(hx+4,hy+4,hw,hh+lift);
  const gr=g.createLinearGradient(hx,hy,hx,hy+hh);gr.addColorStop(0,paved?'#b5b9bb':'#8b7a5c');gr.addColorStop(.45,paved?'#8e9396':'#6e5f46');gr.addColorStop(1,paved?'#5d6265':'#4a3f2f');g.fillStyle=gr;g.fillRect(hx,hy,hw,hh);
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.6;g.beginPath();for(let i=hx+3;i<hx+hw;i+=4){g.moveTo(i,hy);g.lineTo(i,hy+hh)}g.stroke();
  g.fillStyle='#1c1e1f';g.fillRect(hx+hw*.15,hy+hh,hw*.7,lift);g.fillStyle=pc;g.fillRect(hx+hw*.4,hy+hh-4,hw*.2,3);
  // geparktes Flugzeug vor dem Hangar
  if(b.built){g.save();g.translate(hx+hw/2,hy+hh+lift+9);g.rotate(Math.PI/2);g.scale(.7,.7);PLANES[ep>=9?'jet':ep>=8?'sabre':'propfighter'](g,false,a,{owner:b.owner,ang:Math.PI/2,moving:false,id:b.id});g.restore()}
  // Tower mit Glaskanzel, Windsack in Spielerfarbe
  const tx=x+s-26,ty=y+10;g.fillStyle='rgba(0,0,0,.3)';g.fillRect(tx+3,ty+3,14,14+lift);g.fillStyle=a.shade('#b9b4a6',-20);g.fillRect(tx,ty+14,14,lift);g.fillStyle='#b9b4a6';g.fillRect(tx,ty,14,14);
  const gc=g.createLinearGradient(tx,ty-8,tx+14,ty);gc.addColorStop(0,'#cfe6ea');gc.addColorStop(1,'#3f6672');g.fillStyle=gc;g.fillRect(tx-1,ty-8,16,8);g.fillStyle='#2c2f30';g.fillRect(tx-2,ty-10,18,2);
  g.strokeStyle='#888';g.lineWidth=1;g.beginPath();g.moveTo(tx+12,ty-10);g.lineTo(tx+12,ty-18);g.stroke();
  const wx=x+s-8,wy=y+s*.5;g.strokeStyle='#ccc';g.beginPath();g.moveTo(wx,wy+8);g.lineTo(wx,wy-6);g.stroke();g.fillStyle=pc;g.beginPath();g.moveTo(wx,wy-6);g.lineTo(wx-9,wy-4+Math.sin(t*3)*1.2);g.lineTo(wx-9,wy-1+Math.sin(t*3)*1.2);g.lineTo(wx,wy-2);g.closePath();g.fill();
}

const NOSH={noShadow:true,scale:1};
EmpireXY.register({
  id:'kern-fahrzeuge',name:'Kern: Fahrzeuge und Luftwaffe',version:'1.0.0',core:true,order:5,
  description:'Panzerfabrik und Flughafen: Panzer vom Dampfpanzer bis zum Zukunftspanzer, Truppentransporter, Doppeldecker, Jäger, Bomber, Drohnen und Hubschrauber.',
  buildings:{
    factory:{name:'Panzerfabrik',size:3,hp:1400,cost:{wood:250,stone:150,gold:100},time:45,minEpoch:6,sight:6,cat:2,ai:{minWorkers:20,prio:true},techTitle:'Militärtechnik',
      desc:'Baut Panzer und Truppentransporter. Forschung: Militärtechnik.',draw:drawFactory},
    airfield:{name:'Flughafen',names:['','','','','','','','Flugfeld','Flughafen','Luftwaffenbasis'],size:4,hp:1600,cost:{wood:300,stone:200,gold:200},time:55,minEpoch:7,sight:7,cat:2,ai:{minWorkers:22,prio:true},techTitle:'Luftfahrt',
      desc:'Startet Flugzeuge und Hubschrauber. Forschung: Luftfahrt.',draw:drawAirfield},
  },
  units:{
    tank:{label:'Panzer',cls:'vehicle',from:'factory',minEpoch:6,names:['','','','','','','Dampfpanzer','Leichter Panzer','Mittlerer Panzer','Kampfpanzer','Zukunftspanzer'],
      hp:230,atk:15,range:4.2,rate:2.2,speed:1.8,sight:8,cost:{wood:110,gold:90},time:26,r:.5,pop:3,proj:2,vsUnit:1,vsBld:1.8,bonus:{infantry:1.6,ranged:1.6,cavalry:1.5},...NOSH,
      desc:'Gepanzert, stark gegen Infanterie und Kavallerie. Schwach gegen Artillerie und Luftwaffe, kann nicht auf Flugzeuge schießen.',
      draw:veh([[0,'steam'],[7,'light'],[8,'medium'],[9,'mbt'],[10,'future']])},
    heavytank:{label:'Schwerer Panzer',cls:'vehicle',from:'factory',minEpoch:8,names:['','','','','','','','','Schwerer Panzer','Zukunftspanzer','Kolosspanzer'],
      hp:360,atk:24,range:4.6,rate:2.9,speed:1.3,sight:8,cost:{wood:140,gold:150,stone:40},time:34,r:.56,pop:4,proj:2,vsBld:2.2,bonus:{infantry:1.5,ranged:1.5,cavalry:1.5,vehicle:1.3},...NOSH,
      desc:'Langsamer Koloss mit dicker Panzerung. Knackt auch andere Panzer.',
      draw:veh([[0,'heavy'],[9,'future']])},
    apc:{label:'Truppentransporter',cls:'vehicle',from:'factory',minEpoch:8,ai:false,seats:6,names:['','','','','','','','','Schützenpanzerwagen','Radpanzer','Schwebetransporter'],
      hp:200,atk:5,range:4,rate:1,speed:2.8,sight:8,cost:{wood:90,gold:60},time:20,r:.48,pop:2,proj:1,bonus:{infantry:1.3},...NOSH,
      desc:'Fährt bis zu 6 Fußsoldaten geschützt an die Front. Rechtsklick mit Infanterie auf den Transporter zum Aufsitzen.',draw:drawApc},
    fighter:{label:'Jagdflugzeug',cls:'aircraft',air:true,from:'airfield',minEpoch:7,names:['','','','','','','','Doppeldecker','Propellerjäger','Düsenjäger','Abfangjäger'],
      hp:120,atk:9,range:3.5,rate:1.1,speed:4.4,sight:10,cost:{wood:100,gold:100},time:24,r:.5,pop:2,proj:1,vsBld:.3,bonus:{aircraft:1.8,vehicle:1.2},...NOSH,
      desc:'Schnell und wendig, holt feindliche Flugzeuge vom Himmel. Fliegt über Wasser, Wald und Mauern.',
      draw:air([[0,'biplane'],[8,'propfighter'],[9,'sabre']])},
    jet:{label:'Mehrzweckjet',cls:'aircraft',air:true,from:'airfield',minEpoch:9,names:['','','','','','','','','','Mehrzweckjet','Hyperschalljet'],
      hp:180,atk:15,range:4.5,rate:1.3,speed:5.6,sight:11,cost:{wood:80,gold:170,stone:30},time:30,r:.5,pop:3,proj:1,vsBld:.8,bonus:{aircraft:2,vehicle:1.5},...NOSH,
      desc:'Der schnellste Jäger mit Raketen gegen Flugzeuge und Panzer.',draw:air([[0,'jet']],{R:12,circle:1})},
    bomber:{label:'Bomber',cls:'aircraft',air:true,from:'airfield',minEpoch:8,names:['','','','','','','','','Propellerbomber','Tarnkappenbomber','Orbitalbomber'],
      hp:260,atk:36,range:1.2,rate:4,speed:3,sight:9,cost:{wood:140,gold:170},time:36,r:.6,pop:4,proj:2,vsUnit:.7,vsBld:3.6,...NOSH,
      desc:'Wirft Bomben auf Gebäude und Truppen darunter. Braucht Jägerschutz.',draw:air([[0,'bomber'],[9,'stealth']],{alt:32,R:14,circle:.5})},
    drone:{label:'Kampfdrohne',cls:'aircraft',air:true,from:'airfield',minEpoch:9,names:['','','','','','','','','','Kampfdrohne','Drohnenschwarm'],
      hp:80,atk:11,range:5,rate:1.6,speed:3.6,sight:13,cost:{wood:40,gold:90},time:16,r:.42,pop:1,proj:1,bonus:{vehicle:1.8},...NOSH,
      desc:'Billig, sieht sehr weit und jagt Panzer mit Lenkraketen.',draw:air([[0,'drone']],{alt:30,R:8,circle:.6})},
    heli:{label:'Kampfhubschrauber',cls:'aircraft',air:true,from:'airfield',minEpoch:9,names:['','','','','','','','','','Kampfhubschrauber','Tarnhubschrauber'],
      hp:220,atk:13,range:5,rate:1.4,speed:3.2,sight:10,cost:{wood:90,gold:140},time:28,r:.55,pop:3,proj:1,bonus:{vehicle:2,infantry:1.3},...NOSH,
      desc:'Schwebt über dem Schlachtfeld und zerstört Panzer.',draw:air([[0,'heli']],{alt:18,hover:true})},
    transheli:{label:'Transporthubschrauber',cls:'aircraft',air:true,from:'airfield',minEpoch:9,ai:false,seats:8,names:['','','','','','','','','','Transporthubschrauber','Schwerlast-Rotor'],
      hp:240,atk:2,range:3,rate:2,speed:3.4,sight:9,cost:{wood:110,gold:80},time:26,r:.6,pop:2,proj:1,...NOSH,
      desc:'Fliegt bis zu 8 Fußsoldaten über Wasser und Mauern. Absitzen nur über Land.',draw:air([[0,'chinook']],{alt:20,hover:true})},
  },
  techs:(()=>{const out={};
    const LINES=[
      ['panzerung','factory',{6:'Genietete Platten',7:'Walzstahl',8:'Schräge Panzerung',9:'Verbundpanzerung'},{hp:{vehicle:.15}},{wood:120,gold:110},'Fahrzeuge: Leben +15 %.'],
      ['motoren','factory',{6:'Hochdruckdampf',7:'Benzinmotor',8:'Dieselmotor',9:'Gasturbine'},{speed:{vehicle:.08},atk:{vehicle:.1}},{wood:110,gold:120},'Fahrzeuge: Tempo +8 %, Angriff +10 %.'],
      ['triebwerke','airfield',{7:'Sternmotor',8:'Strahltriebwerk',9:'Nachbrenner'},{speed:{aircraft:.08},atk:{aircraft:.12}},{wood:120,gold:140},'Luftwaffe: Tempo +8 %, Angriff +12 %.'],
      ['avionik','airfield',{7:'Funkgerät',8:'Radar',9:'Avionik'},{hp:{aircraft:.12},range:{aircraft:.3}},{wood:100,gold:150},'Luftwaffe: Leben +12 %, Reichweite +0,3.'],
    ];
    for(const [line,at,names,effect,cost,desc] of LINES){let prev=null;
      for(const ep of Object.keys(names).map(Number).sort((a,b)=>a-b)){const id=line+'_'+ep,m=1+ep*.6,c={};for(const k in cost)c[k]=Math.round(cost[k]*m/5)*5;
        out[id]={name:names[ep],at,epoch:ep,requires:prev?[prev]:[],cost:c,time:24+ep*5,effect,desc,line};prev=id}}
    return out})(),
  // Konter: Artillerie und Panzerjäger gegen Fahrzeuge, Flak gegen Flugzeuge
  patch(xy){
    const U=xy.units,add=(k,o)=>{if(U[k])U[k].bonus=Object.assign(U[k].bonus||{},o)};
    add('siege',{vehicle:2.2});add('spear',{vehicle:1.5});add('ranged',{aircraft:1.3});add('warship',{aircraft:1.4});
    if(U.bolt){U.bolt.aa=true;add('bolt',{aircraft:2.6,vehicle:1.2})}
    // Pferde bleiben Pferde: die Panzernamen wandern in die Fahrzeug-Kategorie
    const ren={cavalry:{8:'Kosakenreiter',9:'Gebirgsreiter'},knight:{8:'Garde-Kavallerie',9:'Ehrengarde'},harcher:{8:'Karabinerreiter',9:'Berittene Schützen'},scout:{8:'Meldereiter',9:'Grenzreiter'},siege:{9:'Raketenartillerie'},ram:{8:'Sprengtrupp',9:'Pioniertrupp'}};
    for(const k in ren)if(U[k]&&U[k].names)for(const i in ren[k])U[k].names[i]=ren[k][i];
  },
});
})();
