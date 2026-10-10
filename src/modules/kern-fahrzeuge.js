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

function drawTank(g,u,api,kind){
  const T=api.T,x=u.x*T,y=u.y*T,pc=api.PCOL[u.owner],ha=hullAng(u,api),ta=u.ang-ha;
  const S={steam:[30,21],light:[22,14],medium:[28,18],heavy:[33,21],mbt:[32,20],future:[34,22]}[kind],L=S[0],W=S[1],tw=W*.25,c=CAMO[kind];
  shadowRect(g,u,ha,L,W,api);
  g.translate(x,y);g.rotate(ha);
  if(kind==='future'){ // schwebt: Antigrav-Kufen statt Ketten
    const gl=.5+.5*Math.sin(api.time*6+u.id);for(const s of [-1,1]){g.fillStyle='#24292d';rr(g,-L/2,s<0?-W/2:W/2-tw,L,tw,3);g.fill();g.fillStyle=`rgba(120,220,255,${(.35+.4*gl).toFixed(2)})`;g.fillRect(-L/2+3,s<0?-W/2+tw*.4:W/2-tw*.6,L-6,1.2)}}
  else tracks(g,L,W,tw,u,api,kind==='steam'?'#3a3027':null);
  // Wanne
  const hw=W-tw*1.1;g.fillStyle=lit(g,ha,L*.6,c,api);
  if(kind==='mbt'||kind==='future')poly(g,[[-L/2+1,-hw/2],[L/2-5,-hw/2],[L/2,-hw/2+3],[L/2,hw/2-3],[L/2-5,hw/2],[-L/2+1,hw/2]]);else rr(g,-L/2+1,-hw/2,L-2,hw,kind==='steam'?1:3);
  g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.8;g.stroke();
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(L/2-6,-hw/2+1,4,hw-2); // Bugplatte im Schatten
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.6;g.beginPath();for(let i=0;i<4;i++){g.moveTo(-L/2+3+i*2,-hw/2+3);g.lineTo(-L/2+3+i*2,hw/2-3)}g.stroke(); // Motorgitter
  g.fillStyle=pc;g.fillRect(-L/2+1,-hw/2,2,hw); // Heckmarkierung in Spielerfarbe
  if(kind==='heavy'){g.fillStyle='rgba(70,82,48,.55)';for(const [a,b,w] of [[-8,-4,6],[2,3,7],[6,-6,5]]){g.beginPath();g.ellipse(a,b,w,2.2,.6,0,7);g.fill()}}
  if(kind==='steam'){ // genieteter Kasten mit Schornstein und Seitengeschützen
    g.fillStyle='rgba(255,255,255,.15)';g.fillRect(-L/2+2,-1,L-4,1.4);g.fillStyle='rgba(30,25,20,.7)';for(let i=-L/2+3;i<L/2-2;i+=3){g.fillRect(i,-hw/2+1,1,1);g.fillRect(i,hw/2-2,1,1)}
    for(const s of [-1,1]){g.fillStyle='#2a2620';g.fillRect(2+(u.swing>.12?-2:0),s*(hw/2)-1.2,9,2.4)}
    api.blob(g,-L/2+7,0,3.6,'#5a4c3e','#2c241d','#120e0b');g.fillStyle='#0b0907';g.beginPath();g.arc(-L/2+7,0,2,0,7);g.fill();
    g.fillStyle='#3a332b';g.fillRect(L/2-2,-hw/2+2,3,hw-4);
    g.rotate(-ha);for(let i=0;i<4;i++){const f=((api.time*.9+i/4+u.id*.13)%1),bx=Math.cos(ha)*(-L/2+7)-f*10,by=Math.sin(ha)*(-L/2+7)-6-f*16;g.fillStyle=`rgba(110,105,100,${(.45*(1-f)).toFixed(2)})`;g.beginPath();g.arc(bx,by,2.5+f*5,0,7);g.fill()}
    return}
  // Turm
  g.rotate(ta);const tc=api.shade(c,6);
  if(kind==='light'){g.fillStyle=lit(g,u.ang,6,tc,api);g.beginPath();g.arc(0,0,4.6,0,7);g.fill();barrel(g,3,8,1.8,u)}
  else if(kind==='medium'){g.fillStyle=lit(g,u.ang,8,tc,api);g.beginPath();g.ellipse(-1,0,7,6.2,0,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.stroke();barrel(g,5,14,2.2,u)}
  else if(kind==='heavy'){g.fillStyle=lit(g,u.ang,9,tc,api);rr(g,-8,-7,15,14,2);g.fill();g.strokeStyle='rgba(0,0,0,.4)';g.stroke();barrel(g,7,18,2.6,u,true)}
  else if(kind==='mbt'){g.fillStyle=lit(g,u.ang,10,tc,api);poly(g,[[-9,-7],[4,-7],[9,-3],[9,3],[4,7],[-9,7]]);g.fill();g.strokeStyle='rgba(0,0,0,.4)';g.stroke();
    g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-9,-7,3,14);barrel(g,9,19,2.4,u)}
  else{g.fillStyle=lit(g,u.ang,10,tc,api);poly(g,[[-10,-7],[3,-8],[10,-3],[10,3],[3,8],[-10,7]]);g.fill();g.strokeStyle='rgba(120,220,255,.6)';g.lineWidth=.8;g.stroke();
    barrel(g,8,18,1.8,{swing:u.swing});g.translate(0,3.5);barrel(g,8,16,1.6,{swing:0});g.translate(0,-3.5)}
  g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.arc(-3,-2.5,1.8,0,7);g.fill();g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.arc(-3.4,-2.9,.8,0,7);g.fill();
  g.fillStyle=pc;g.fillRect(-4,1.5,4,2.2);
}
function drawApc(g,u,api){
  const T=api.T,x=u.x*T,y=u.y*T,pc=api.PCOL[u.owner],ep=api.epochOf(u.owner),ha=hullAng(u,api),modern=ep>=9,L=modern?30:27,W=modern?17:15,c=modern?CAMO.apc9:CAMO.apc8;
  shadowRect(g,u,ha,L,W,api);g.translate(x,y);g.rotate(ha);
  if(modern){for(const s of [-1,1])for(let i=0;i<4;i++){g.fillStyle='#1d1e1b';rr(g,-L/2+3+i*7,s<0?-W/2-1:W/2-3,5,4,1.5);g.fill()}}
  else{tracks(g,L*.55,W,3.6,u,api);for(const s of [-1,1]){g.fillStyle='#1d1e1b';rr(g,L/2-8,s<0?-W/2-.5:W/2-3.5,5,4,1.5);g.fill()}}
  g.fillStyle=lit(g,ha,L*.6,c,api);poly(g,[[-L/2+1,-W/2+2],[L/2-6,-W/2+2],[L/2,-W/2+5],[L/2,W/2-5],[L/2-6,W/2-2],[-L/2+1,W/2-2]]);g.fill();g.strokeStyle='rgba(0,0,0,.4)';g.lineWidth=.8;g.stroke();
  // Mannschaftsraum: offen (Halbkette) mit Helmen, sonst Dachluken
  const n=(u.cargo||[]).length;
  if(!modern){g.fillStyle='#1e1f1a';g.fillRect(-L/2+3,-W/2+4,L*.55,W-8);for(let i=0;i<n;i++){api.blob(g,-L/2+5+(i>>1)*4.2,(i&1?2:-2),1.6,'#7d7a5a','#55553c','#2e2e20')}}
  else{g.fillStyle='rgba(0,0,0,.3)';for(const [a,b] of [[-8,-3],[-8,3],[-2,-3],[-2,3]]){g.beginPath();g.arc(a,b,1.6,0,7);g.fill()}g.rotate(u.ang-ha);g.fillStyle='#3a3d33';rr(g,2,-2.5,6,5,1);g.fill();barrel(g,6,7,1.2,u);g.rotate(ha-u.ang)}
  g.fillStyle=pc;g.fillRect(-L/2+1,-W/2+2,2,W-4);
}

// ---------- Luftfahrzeuge ----------
// shape(g,S,api,u) zeichnet die Maschine; S=true heißt Schattenpass (alles einfarbig dunkel)
function flyer(g,u,api,shape,o){
  const T=api.T,t=api.time;let x=u.x*T,y=u.y*T,a=u.ang;
  const alt=(o.alt||26)+(o.hover?Math.sin(t*2.2+u.id)*1.6:0);
  if(!u.moving&&!o.hover&&!(u.swing>0)){const ph=t*(o.circle||.8)+u.id*1.7,R=o.R||10;x+=Math.cos(ph)*R;y+=Math.sin(ph)*R*.55;a=Math.atan2(Math.cos(ph)*R*.55,-Math.sin(ph)*R)}
  u.fx=x;u.fy=y-alt; // für Treffer und Auswahl
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
    factory:{name:'Panzerfabrik',size:3,hp:1400,cost:{wood:250,stone:150,gold:100},time:45,minEpoch:6,sight:6,cat:2,ai:{minWorkers:22},techTitle:'Militärtechnik',
      desc:'Baut Panzer und Truppentransporter. Forschung: Militärtechnik.',draw:drawFactory},
    airfield:{name:'Flughafen',names:['','','','','','','','Flugfeld','Flughafen','Luftwaffenbasis'],size:4,hp:1600,cost:{wood:300,stone:200,gold:200},time:55,minEpoch:7,sight:7,cat:2,ai:{minWorkers:25},techTitle:'Luftfahrt',
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
