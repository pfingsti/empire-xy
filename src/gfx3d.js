// ================= 3D-Gebäude =================
// Gebäude werden aus echten 3D-Körpern (Quader, Dächer, Zylinder, Kegel) gebaut und in Parallelprojektion gezeichnet:
// Grundriss bleibt deckungsgleich mit den Kacheln, Höhen steigen nach oben und kippen leicht nach links, sodass
// Südwand, Ostwand und Dach sichtbar sind. Jede Fläche bekommt eine Materialtextur (affin, also verzerrungsfrei),
// Licht nach ihrer Ausrichtung zur Sonne, Bodenverschattung und einen Schlagschatten auf den Boden.
const K3={kx:.26,kz:1.1};
const n3=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return [v[0]/l,v[1]/l,v[2]/l]};
const SUN3=n3([-.5,.22,.84]),VIEW3=n3([K3.kx,K3.kz,1]);
const sub3=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add3=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul3=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot3=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  crs3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len3=a=>Math.hypot(a[0],a[1],a[2]);

// ---- Materialtexturen (doppelte Auflösung, 1 Einheit = 1 Weltpixel)
const TEX3=new Map();
function tex3(key,w,h,fn){let c=TEX3.get(key);if(c)return c;c=document.createElement('canvas');c.width=w*4;c.height=h*4;const g=c.getContext('2d');g.scale(4,4);
  let s=7;for(const ch of key)s=(s*31+ch.charCodeAt(0))>>>0;const r=()=>((s=(s*1664525+1013904223)>>>0)/4294967296);fn(g,r,w,h);TEX3.set(key,c);return c}
const tint=(c,r,a)=>{const k=hex2rgb(c),d=(r()-.5)*a;return '#'+k.map(v=>Math.max(0,Math.min(255,Math.round(v+d))).toString(16).padStart(2,'0')).join('')};
const MT={
  brick:c=>tex3('brick'+c,16,8,(g,r)=>{g.fillStyle=shade(c,38);g.fillRect(0,0,16,8);for(let row=0;row<4;row++){const off=row%2?2:0;for(let x=-4;x<18;x+=4){g.fillStyle=tint(c,r,26);g.fillRect(x+off+.2,row*2+.25,3.6,1.55);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(x+off+.2,row*2+.25,3.6,.35)}}}),
  ashlar:c=>tex3('ashlar'+c,24,12,(g,r)=>{g.fillStyle=shade(c,-30);g.fillRect(0,0,24,12);for(let row=0;row<3;row++){let x=row%2?-3:0;while(x<24){const w=4+r()*4;g.fillStyle=tint(c,r,18);g.fillRect(x+.25,row*4+.25,w-.5,3.5);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(x+.25,row*4+.25,w-.5,.5);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x+.25,row*4+3.2,w-.5,.55);x+=w}}}),
  rubble:c=>tex3('rubble'+c,16,16,(g,r)=>{g.fillStyle=shade(c,-38);g.fillRect(0,0,16,16);for(let i=0;i<34;i++){const x=r()*16,y=r()*16,w=1.6+r()*2.6,h=1.2+r()*1.8;g.fillStyle=tint(c,r,30);g.beginPath();g.ellipse(x,y,w,h,r(),0,7);g.fill();g.fillStyle='rgba(255,255,255,.1)';g.beginPath();g.ellipse(x-.3,y-.4,w*.6,h*.4,0,0,7);g.fill()}}),
  plaster:c=>tex3('plaster'+c,16,16,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,16,16);for(let i=0;i<120;i++){g.fillStyle=r()<.5?'rgba(255,255,255,.06)':'rgba(60,40,20,.07)';g.fillRect(r()*16,r()*16,.5+r(),.5+r())}for(let i=0;i<3;i++){g.fillStyle='rgba(90,70,40,.05)';g.beginPath();g.ellipse(r()*16,r()*16,2+r()*3,1.5+r()*3,0,0,7);g.fill()}}),
  mud:c=>tex3('mud'+c,16,16,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,16,16);for(let i=0;i<70;i++){g.fillStyle=tint(c,r,30);g.beginPath();g.ellipse(r()*16,r()*16,.6+r()*1.6,.4+r()*.9,0,0,7);g.fill()}g.strokeStyle='rgba(220,190,120,.35)';g.lineWidth=.18;for(let i=0;i<26;i++){const x=r()*16,y=r()*16;g.beginPath();g.moveTo(x,y);g.lineTo(x+r()*1.6-.8,y+r()*.6);g.stroke()}}),
  wattle:c=>tex3('wattle'+c,8,8,(g,r)=>{g.fillStyle=shade(c,-30);g.fillRect(0,0,8,8);for(let row=0;row<4;row++){g.fillStyle=tint(c,r,20);g.beginPath();g.ellipse(4,row*2+1,5,.85,0,0,7);g.fill();g.fillStyle='rgba(255,255,255,.08)';g.fillRect(0,row*2+.5,8,.3)}g.fillStyle=shade(c,-45);for(const x of [1,5])g.fillRect(x,0,.6,8)}),
  planks:c=>tex3('planks'+c,12,12,(g,r)=>{for(let x=0;x<12;x+=2){g.fillStyle=tint(c,r,24);g.fillRect(x,0,2,12);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x+1.75,0,.25,12);g.strokeStyle='rgba(60,30,10,.18)';g.lineWidth=.12;for(let k=0;k<3;k++){g.beginPath();g.moveTo(x+.4+r()*1.2,0);g.lineTo(x+.4+r()*1.2,12);g.stroke()}}}),
  clap:c=>tex3('clap'+c,12,6,(g,r)=>{for(let y=0;y<6;y+=1.5){const gr=g.createLinearGradient(0,y,0,y+1.5);gr.addColorStop(0,shade(c,-22));gr.addColorStop(.25,shade(c,6));gr.addColorStop(1,c);g.fillStyle=gr;g.fillRect(0,y,12,1.5)}}),
  logs:c=>tex3('logs'+c,12,6,(g,r)=>{for(let y=0;y<6;y+=2){const gr=g.createLinearGradient(0,y,0,y+2);gr.addColorStop(0,shade(c,-35));gr.addColorStop(.35,shade(c,12));gr.addColorStop(1,shade(c,-25));g.fillStyle=gr;g.fillRect(0,y,12,2);g.strokeStyle='rgba(40,20,5,.25)';g.lineWidth=.12;g.beginPath();g.moveTo(r()*12,y+.8);g.lineTo(r()*12,y+1.1);g.stroke()}}),
  thatch:c=>tex3('thatch'+c,12,6,(g,r)=>{g.fillStyle=shade(c,-28);g.fillRect(0,0,12,6);for(let row=0;row<3;row++)for(let i=0;i<60;i++){const x=r()*12,y=row*2+r()*1.2;g.strokeStyle=tint(c,r,40);g.lineWidth=.22;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*.6,y+1.4+r()*.8);g.stroke()}for(let row=0;row<3;row++){g.fillStyle='rgba(0,0,0,.18)';g.fillRect(0,row*2+1.75,12,.3)}}),
  tiles:c=>tex3('tiles'+c,8,6,(g,r)=>{g.fillStyle=shade(c,-40);g.fillRect(0,0,8,6);for(let row=0;row<3;row++)for(let x=(row%2)*1;x<9;x+=2){const gr=g.createLinearGradient(x-1,0,x+1,0);const k=tint(c,r,20);gr.addColorStop(0,shade(k,-25));gr.addColorStop(.45,shade(k,12));gr.addColorStop(1,shade(k,-30));g.fillStyle=gr;g.beginPath();g.moveTo(x-.95,row*2);g.lineTo(x+.95,row*2);g.lineTo(x+.95,row*2+1.7);g.quadraticCurveTo(x,row*2+2.15,x-.95,row*2+1.7);g.fill()}}),
  slate:c=>tex3('slate'+c,8,6,(g,r)=>{g.fillStyle=shade(c,-30);g.fillRect(0,0,8,6);for(let row=0;row<4;row++)for(let x=(row%2)*1.2-1.2;x<9;x+=2.4){g.fillStyle=tint(c,r,16);g.fillRect(x+.1,row*1.5+.1,2.2,1.3);g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x+.1,row*1.5+.1,2.2,.25)}}),
  shingle:c=>tex3('shingle'+c,8,6,(g,r)=>{g.fillStyle=shade(c,-35);g.fillRect(0,0,8,6);for(let row=0;row<4;row++)for(let x=(row%2)*.8-.8;x<9;x+=1.6+r()*.3){g.fillStyle=tint(c,r,26);g.fillRect(x+.1,row*1.5+.1,1.4,1.3)}}),
  concrete:c=>tex3('concrete'+c,24,12,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,24,12);for(let i=0;i<160;i++){g.fillStyle=r()<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.06)';g.fillRect(r()*24,r()*12,.4+r()*.6,.4+r()*.6)}g.fillStyle='rgba(0,0,0,.16)';g.fillRect(0,11.8,24,.2);g.fillRect(11.9,0,.2,12);for(let i=0;i<3;i++){g.fillStyle='rgba(70,60,50,.05)';g.fillRect(r()*24,0,1+r()*2,12)}}),
  metal:c=>tex3('metal'+c,8,8,(g,r)=>{for(let x=0;x<8;x+=1){const gr=g.createLinearGradient(x,0,x+1,0);gr.addColorStop(0,shade(c,-18));gr.addColorStop(.5,shade(c,14));gr.addColorStop(1,shade(c,-18));g.fillStyle=gr;g.fillRect(x,0,1,8)}g.fillStyle='rgba(120,70,40,.08)';g.fillRect(0,6,8,2)}),
  hide:c=>tex3('hide'+c,12,12,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,12,12);for(let i=0;i<40;i++){g.fillStyle=tint(c,r,24);g.beginPath();g.ellipse(r()*12,r()*12,.8+r()*1.6,.6+r(),0,0,7);g.fill()}g.strokeStyle='rgba(60,40,20,.4)';g.lineWidth=.15;g.setLineDash([.4,.3]);g.beginPath();g.moveTo(6,0);g.lineTo(6,12);g.moveTo(0,6);g.lineTo(12,6);g.stroke();g.setLineDash([])}),
  flat:c=>tex3('flat'+c,8,8,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,8,8);for(let i=0;i<30;i++){g.fillStyle=r()<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.05)';g.fillRect(r()*8,r()*8,.6,.6)}}),
  gravel:c=>tex3('gravel'+c,8,8,(g,r)=>{g.fillStyle=c;g.fillRect(0,0,8,8);for(let i=0;i<50;i++){g.fillStyle=tint(c,r,40);g.fillRect(r()*8,r()*8,.5+r()*.5,.4+r()*.4)}}),
  glass:c=>tex3('glass'+c,12,12,(g,r)=>{const gr=g.createLinearGradient(0,0,12,12);gr.addColorStop(0,shade(c,40));gr.addColorStop(.5,c);gr.addColorStop(1,shade(c,-30));g.fillStyle=gr;g.fillRect(0,0,12,12);g.fillStyle='rgba(255,255,255,.18)';g.beginPath();g.moveTo(0,8);g.lineTo(8,0);g.lineTo(10,0);g.lineTo(0,10);g.fill();g.fillStyle='rgba(30,30,30,.55)';g.fillRect(0,0,12,.3);g.fillRect(0,0,.3,12)}),
};
const M3=(kind,col)=>({kind,col});

// ---- Szene: Flächen sammeln, dann mit Licht und Schatten zeichnen
function Scene3(){
  const F=[];
  const face=(pts,mat,o,ud,vd,L1,L2,opt)=>{const c=pts.reduce((a,p)=>add3(a,mul3(p,1/pts.length)),[0,0,0]);let n=n3(crs3(ud,vd));if(opt&&opt.ref){if(dot3(n,sub3(c,opt.ref))<0)n=mul3(n,-1)}// Ausdehnung in u/v (bei schiefen Achsen reicht 0..L1 nicht)
    const ab=dot3(ud,vd),det=1-ab*ab||1;let U0=0,U1=L1,V0=0,V1=L2;for(const p of pts){const d=sub3(p,o),du=dot3(d,ud),dv=dot3(d,vd),u=(du-ab*dv)/det,v=(dv-ab*du)/det;U0=Math.min(U0,u);U1=Math.max(U1,u);V0=Math.min(V0,v);V1=Math.max(V1,v)}
    F.push({pts,mat,o,ud,vd,L1,L2,U0,U1,V0,V1,n,c,opt:opt||{}})};
  const S={F,
    // Viereck p0..p3 (umlaufend); Textur u entlang p0→p1, v entlang p0→p3
    quad(p0,p1,p2,p3,mat,opt){const a=sub3(p1,p0),b=sub3(p3,p0),L1=len3(a),L2=len3(b);if(L1<.01||L2<.01)return;face([p0,p1,p2,p3],mat,p0,mul3(a,1/L1),mul3(b,1/L2),L1,L2,opt)},
    // Dreieck mit waagrechter Grundkante p0→p1 und Spitze p2; v senkrecht
    tri(p0,p1,p2,mat,opt){const a=sub3(p1,p0),L1=len3(a),ud=mul3(a,1/L1);let vd=sub3(p2,add3(p0,mul3(ud,dot3(sub3(p2,p0),ud))));const L2=len3(vd);if(L2<.01)return;vd=mul3(vd,1/L2);
      // Ursprung so, dass v nach unten zur Grundkante läuft (Textur aufrecht)
      const o=add3(p0,mul3(vd,L2));face([p0,p1,p2],mat,o,ud,mul3(vd,-1),L1,L2,opt)},
    // Quader; deco: {s,e,w,n,t} je Seite (Zeichnen in u/v-Koordinaten der Fläche, v=0 oben)
    box(x0,y0,z0,x1,y1,z1,wall,top,deco){const ref=[(x0+x1)/2,(y0+y1)/2,(z0+z1)/2],d=deco||{};
      if(top)S.quad([x0,y1,z1],[x1,y1,z1],[x1,y0,z1],[x0,y0,z1],top,{ref,deco:d.t,up:1});
      S.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],wall,{ref,deco:d.s,ao:1});
      S.quad([x1,y1,z1],[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],wall,{ref,deco:d.e,ao:1});
      S.quad([x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0],wall,{ref,deco:d.w,ao:1});
      S.quad([x1,y0,z1],[x0,y0,z1],[x0,y0,z0],[x1,y0,z0],wall,{ref,deco:d.n,ao:1})},
    // Satteldach: First entlang x (axis 'x') oder y; o = Dachüberstand
    gable(x0,y0,x1,y1,z,h,roof,gab,axis,o,deco){o=o===undefined?1.6:o;const d=deco||{};
      if(axis!=='y'){const ym=(y0+y1)/2,ref=[(x0+x1)/2,ym,z];
        S.quad([x0-o,ym,z+h],[x1+o,ym,z+h],[x1+o,y1+o,z-o*.6],[x0-o,y1+o,z-o*.6],roof,{ref,roof:1,deco:d.rs});
        S.quad([x1+o,ym,z+h],[x0-o,ym,z+h],[x0-o,y0-o,z-o*.6],[x1+o,y0-o,z-o*.6],roof,{ref,roof:1});
        if(gab){S.tri([x1,y1,z],[x1,y0,z],[x1,ym,z+h],gab,{ref,deco:d.ge});S.tri([x0,y0,z],[x0,y1,z],[x0,ym,z+h],gab,{ref})}}
      else{const xm=(x0+x1)/2,ref=[xm,(y0+y1)/2,z];
        S.quad([xm,y1+o,z+h],[xm,y0-o,z+h],[x1+o,y0-o,z-o*.6],[x1+o,y1+o,z-o*.6],roof,{ref,roof:1});
        S.quad([xm,y0-o,z+h],[xm,y1+o,z+h],[x0-o,y1+o,z-o*.6],[x0-o,y0-o,z-o*.6],roof,{ref,roof:1});
        if(gab){S.tri([x0,y1,z],[x1,y1,z],[xm,y1,z+h],gab,{ref,deco:d.gs});S.tri([x1,y0,z],[x0,y0,z],[xm,y0,z+h],gab,{ref})}}},
    // Walmdach (First entlang der längeren Seite)
    hip(x0,y0,x1,y1,z,h,roof,o){o=o===undefined?1.6:o;const ax=x0-o,bx=x1+o,ay=y0-o,by=y1+o,ez=z-o*.6,ref=[(x0+x1)/2,(y0+y1)/2,z];
      if(Math.abs((bx-ax)-(by-ay))<.05){const t=[(ax+bx)/2,(ay+by)/2,z+h];S.tri([ax,by,ez],[bx,by,ez],t,roof,{ref,roof:1});S.tri([bx,by,ez],[bx,ay,ez],t,roof,{ref,roof:1});S.tri([bx,ay,ez],[ax,ay,ez],t,roof,{ref,roof:1});S.tri([ax,ay,ez],[ax,by,ez],t,roof,{ref,roof:1})}
      else if(bx-ax>=by-ay){const ym=(ay+by)/2,ins=(by-ay)/2,r0=[ax+ins,ym,z+h],r1=[bx-ins,ym,z+h];
        S.quad(r0,r1,[bx,by,ez],[ax,by,ez],roof,{ref,roof:1});S.quad(r1,r0,[ax,ay,ez],[bx,ay,ez],roof,{ref,roof:1});
        S.tri([bx,by,ez],[bx,ay,ez],r1,roof,{ref,roof:1});S.tri([ax,ay,ez],[ax,by,ez],r0,roof,{ref,roof:1})}
      else{const xm=(ax+bx)/2,ins=(bx-ax)/2,r0=[xm,ay+ins,z+h],r1=[xm,by-ins,z+h];
        S.tri([ax,by,ez],[bx,by,ez],r1,roof,{ref,roof:1});S.tri([bx,ay,ez],[ax,ay,ez],r0,roof,{ref,roof:1});
        S.quad(r1,r0,[bx,ay,ez],[bx,by,ez],roof,{ref,roof:1});S.quad(r0,r1,[ax,by,ez],[ax,ay,ez],roof,{ref,roof:1})}},
    pyramid(cx,cy,w,d,z,h,roof,o){S.hip(cx-w/2,cy-d/2,cx+w/2,cy+d/2,z,h,roof,o||0)},
    // Zylinder mit n Segmenten, Textur läuft um den Mantel
    cyl(cx,cy,r,z0,z1,wall,top,n,deco){n=n||16;const ref=[cx,cy,(z0+z1)/2],seg=2*Math.PI*r/n;
      for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,p=(a,z)=>[cx+Math.cos(a)*r,cy+Math.sin(a)*r,z];
        S.quad(p(a0,z1),p(a1,z1),p(a1,z0),p(a0,z0),wall,{ref,ao:1,useg:i*seg,deco:deco&&((g,L1,L2)=>deco(g,L1,L2,i,n))})}
      if(top){const pts=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r,z1])}face(pts,top,[cx-r,cy-r,z1],[1,0,0],[0,1,0],2*r,2*r,{ref,up:1})}},
    cone(cx,cy,r,z,h,roof,n){n=n||16;const ref=[cx,cy,z];for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2;S.tri([cx+Math.cos(a0)*r,cy+Math.sin(a0)*r,z],[cx+Math.cos(a1)*r,cy+Math.sin(a1)*r,z],[cx,cy,z+h],roof,{ref,roof:1})}},
    // flache Bodenfläche (Hof, Pflaster, Beet)
    ground(x0,y0,x1,y1,mat,deco){S.quad([x0,y0,.05],[x1,y0,.05],[x1,y1,.05],[x0,y1,.05],mat,{ground:1,noshadow:1,deco})},
  };
  return S}

function render3(g,ox,oy,S,opt){opt=opt||{};const kx=K3.kx,kz=K3.kz,P=p=>[ox+p[0]-p[2]*kx,oy+p[1]-p[2]*kz];
  // Schlagschatten: alle Flächen auf den Boden projiziert, einmal deckend gesammelt, dann halbtransparent aufgelegt
  const shadow=()=>{if(opt.shadow===0)return;const cv=g.canvas,sh=document.createElement('canvas');sh.width=cv.width;sh.height=cv.height;const sg=sh.getContext('2d');sg.setTransform(g.getTransform());sg.fillStyle='#000';
    const gp=p=>{const t=p[2]/SUN3[2];return P([p[0]-SUN3[0]*t,p[1]-SUN3[1]*t,0])};
    for(const f of S.F){if(f.opt.noshadow)continue;sg.beginPath();f.pts.forEach((p,i)=>{const q=gp(p);i?sg.lineTo(q[0],q[1]):sg.moveTo(q[0],q[1])});sg.closePath();sg.fill()}
    g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=opt.shadow||.36;g.filter='blur(1.2px)';g.drawImage(sh,0,0);g.restore()};
  let shDone=0;const fs=S.F.filter(f=>f.opt.ground||dot3(f.n,VIEW3)>.004).map(f=>({f,k:f.opt.ground?-1e6:dot3(f.c,VIEW3)+(f.opt.bias||0)})).sort((a,b)=>a.k-b.k);
  for(const {f} of fs){if(!shDone&&!f.opt.ground){shadow();shDone=1}
    const sp=f.pts.map(P);g.save();g.beginPath();sp.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath();g.clip();
    const o=P(f.o),pu=P(add3(f.o,f.ud)),pv=P(add3(f.o,f.vd));g.transform(pu[0]-o[0],pu[1]-o[1],pv[0]-o[0],pv[1]-o[1],o[0],o[1]);
    const m=f.mat,tx=MT[m.kind]?MT[m.kind](m.col):null;
    if(tx){const pat=g.createPattern(tx,'repeat');pat.setTransform(new DOMMatrix([.25,0,0,.25,-(f.opt.useg||0),0]));g.fillStyle=pat}else g.fillStyle=m.col;
    const R=[f.U0-1,f.V0-1,f.U1-f.U0+2,f.V1-f.V0+2];g.fillRect(...R);
    if(f.opt.deco)f.opt.deco(g,f.L1,f.L2);
    // Grundstück weich in das Gelände auslaufen lassen
    if(f.opt.ground&&f.L1>40&&f.L2>30){const W=5;g.globalCompositeOperation='destination-out';for(const [x0,y0,x1,y1,rx,ry,rw,rh] of [[0,0,W,0,0,0,W,f.L2],[f.L1,0,f.L1-W,0,f.L1-W,0,W,f.L2],[0,0,0,W,0,0,f.L1,W],[0,f.L2,0,f.L2-W,0,f.L2-W,f.L1,W]]){const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,'rgba(0,0,0,.95)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(rx,ry,rw,rh)}g.globalCompositeOperation='source-over'}
    // Licht: Umgebungslicht + Sonne nach Flächenneigung, Dächer etwas heller vom Himmel
    const dif=Math.max(0,dot3(f.n,SUN3)),sky=Math.max(0,f.n[2])*.12,l=(f.opt.ground?1:.56+.62*dif+sky)*(m.lit||1);
    if(l<1){g.fillStyle=`rgba(16,22,40,${Math.min(.8,(1-l)*.95).toFixed(3)})`;g.fillRect(...R)}else if(l>1){g.fillStyle=`rgba(255,236,196,${Math.min(.35,(l-1)*.7).toFixed(3)})`;g.fillRect(...R)}
    // Bodenverschattung an Wänden
    if(f.opt.ao&&f.vd[2]<-.5){const gr=g.createLinearGradient(0,f.L2-Math.min(5,f.L2*.4),0,f.L2);gr.addColorStop(0,'rgba(10,12,8,0)');gr.addColorStop(1,'rgba(10,12,8,.38)');g.fillStyle=gr;g.fillRect(-1,f.L2-6,f.L1+2,7)}
    // Traufschatten oben an der Wand
    if(f.opt.ao&&f.vd[2]<-.5&&f.L2>5){const gr=g.createLinearGradient(0,0,0,2.6);gr.addColorStop(0,'rgba(12,14,20,.3)');gr.addColorStop(1,'rgba(12,14,20,0)');g.fillStyle=gr;g.fillRect(f.U0-1,0,f.U1-f.U0+2,2.6)}
    if(f.opt.glow)f.opt.glow(g,f.L1,f.L2);
    g.restore()}
  if(!shDone)shadow()}

// ---- Fassadendetails in Flächenkoordinaten
const D3={
  win(g,u,v,w,h,o){o=o||{};g.fillStyle=o.frame||'#e6dfcc';g.fillRect(u-.5,v-.5,w+1,h+1);
    const gr=g.createLinearGradient(u,v,u+w,v+h);gr.addColorStop(0,o.lit?'#f0c070':'#7d93a3');gr.addColorStop(1,o.lit?'#c88a3a':'#27333d');g.fillStyle=gr;g.fillRect(u,v,w,h);
    if(o.bars!==0){g.fillStyle=o.frame||'#e6dfcc';g.fillRect(u+w/2-.2,v,.4,h);if(h>w*1.2)g.fillRect(u,v+h/2-.2,w,.4)}
    if(o.sill!==0){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(u-.7,v+h+.5,w+1.4,.5);g.fillStyle=o.frame||'#e6dfcc';g.fillRect(u-.7,v+h+.2,w+1.4,.5)}
    if(o.shut){g.fillStyle=o.shut;g.fillRect(u-w*.55-.5,v-.3,w*.5,h+.6);g.fillRect(u+w+.5,v-.3,w*.5,h+.6);g.fillStyle='rgba(0,0,0,.2)';for(let k=v+.5;k<v+h;k+=.9){g.fillRect(u-w*.55-.5,k,w*.5,.2);g.fillRect(u+w+.5,k,w*.5,.2)}}
    if(o.arch){g.fillStyle=o.frame||'#e6dfcc';g.beginPath();g.arc(u+w/2,v,w/2+.5,Math.PI,0);g.fill();g.fillStyle=o.lit?'#e8b060':'#56687a';g.beginPath();g.arc(u+w/2,v,w/2,Math.PI,0);g.fill()}},
  door(g,u,v,w,h,col,o){o=o||{};g.fillStyle='rgba(0,0,0,.45)';g.fillRect(u-.6,v-.6,w+1.2,h+.6);g.fillStyle=col||'#5a3a22';g.fillRect(u,v,w,h);g.fillStyle='rgba(0,0,0,.25)';for(let x=u+w/3;x<u+w-.2;x+=w/3)g.fillRect(x,v,.25,h);
    if(o.arch){g.fillStyle='rgba(0,0,0,.45)';g.beginPath();g.arc(u+w/2,v,w/2+.6,Math.PI,0);g.fill();g.fillStyle=col||'#5a3a22';g.beginPath();g.arc(u+w/2,v,w/2,Math.PI,0);g.fill()}
    g.fillStyle='#c8a050';g.fillRect(u+w*.75,v+h*.55,.6,.6)},
  // Fachwerk: Ständer, Riegel und Streben
  frame(g,L1,L2,col,step){col=col||'#3a2a1c';step=step||7;g.fillStyle=col;g.fillRect(0,0,L1,1);g.fillRect(0,L2-1,L1,1);g.fillRect(0,L2*.5-.4,L1,.8);
    for(let x=0;x<=L1+.1;x+=step){g.fillRect(Math.min(x,L1-1),0,1,L2)}g.lineWidth=.8;g.strokeStyle=col;g.beginPath();for(let x=0;x+step<=L1+.1;x+=step*2){g.moveTo(x+.5,L2*.5);g.lineTo(x+step+.5,0)}g.stroke()},
  band(g,L1,y,h,col){g.fillStyle=col;g.fillRect(0,y,L1,h);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,y,L1,h*.3)},
};

// ---- weitere Körper: Tonnengewölbe (Halle), beliebiges Vieleck
function vault3(S,x0,y0,x1,y1,z,r,mat,endMat,n){n=n||10;const ym=(y0+y1)/2,hw=(y1-y0)/2,ref=[(x0+x1)/2,ym,z],p=(x,a)=>[x,ym+Math.cos(a)*hw,z+Math.sin(a)*r];
  for(let i=0;i<n;i++){const a0=i/n*Math.PI,a1=(i+1)/n*Math.PI;S.quad(p(x0,a0),p(x1,a0),p(x1,a1),p(x0,a1),mat,{ref,roof:1})}
  if(endMat){const pts=[];for(let i=n;i>=0;i--)pts.push(p(x1,i/n*Math.PI));S.F.push(polyFace(pts,endMat,ref))}}
function polyFace(pts,mat,ref,opt){const c=pts.reduce((a,p)=>add3(a,mul3(p,1/pts.length)),[0,0,0]);const a=n3(sub3(pts[1],pts[0]));let n=n3(crs3(sub3(pts[1],pts[0]),sub3(pts[2],pts[0])));if(dot3(n,sub3(c,ref))<0)n=mul3(n,-1);
  const vd=n3(crs3(n,a));let minU=1e9,minV=1e9,maxU=-1e9,maxV=-1e9;for(const p of pts){const d=sub3(p,pts[0]),u=dot3(d,a),v=dot3(d,vd);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v)}
  const o=add3(pts[0],add3(mul3(a,minU),mul3(vd,minV)));return {pts,mat,o,ud:a,vd,L1:maxU-minU,L2:maxV-minV,n,c,opt:Object.assign({ref},opt||{})}}
const PR3=(bx,by)=>(x,y,z)=>[bx+x-z*K3.kx,by+y-z*K3.kz];

// ---- Gebäudemodelle je Epoche
const B3={};
// Fenster in einer Reihe über die Breite verteilen
const winRow=(g,L1,v,w,h,n,o,skip)=>{const gap=(L1-n*w)/(n+1);for(let i=0;i<n;i++){if(skip&&skip(i))continue;D3.win(g,gap+i*(w+gap),v,w,h,o&&o(i))}};
const litOf=(i,k)=>((i*7+k*3)%5)===0;
function hutDoor(g,L1,L2,i,n){if(i===Math.round(n/4)){g.fillStyle='rgba(20,12,6,.85)';g.beginPath();g.moveTo(L1*.1,L2);g.lineTo(L1*.1,L2*.25);g.quadraticCurveTo(L1*.5,-L2*.1,L1*.9,L2*.25);g.lineTo(L1*.9,L2);g.fill()}}
function propsYard(s,ep,x0,y0){// Holzstapel, Fass, Zaun – kleine Körper im Hof
  s.box(x0,y0,0,x0+9,y0+3.5,3,M3('logs','#7a5634'),M3('flat','#c8a06a'));
  if(ep>=2)s.cyl(x0+12,y0+1.5,1.6,0,3.2,M3('planks','#7a5a36'),M3('flat','#5a4028'),8)}

B3.house=(g,bx,by,S,rep,pc)=>{const s=Scene3(),pr=PR3(bx,by);
  if(rep===0){s.ground(6,10,58,58,M3('mud','#6e5c40'));
    s.cyl(26,34,12,0,6,M3('wattle','#8a6a44'),null,14,hutDoor);s.cone(26,34,15.5,5,16,M3('thatch','#a48a52'),14);
    s.cyl(48,24,7,0,4,M3('wattle','#7a5c3a'),null,10);s.cone(48,24,9.5,3.5,10,M3('thatch','#9a8048'),10);
    for(const [x,y] of [[44,46],[50,44],[47,51]])s.box(x,y,0,x+1.6,y+1.6,1.4,M3('rubble','#8a8478'),M3('rubble','#8a8478'));
    s.box(8,46,0,9,47,9,M3('logs','#5a4028'),null);s.box(20,46,0,21,47,9,M3('logs','#5a4028'),null);s.quad([8.5,46.5,8.5],[20.5,46.5,8.5],[20.5,47,2],[8.5,47,2],M3('hide','#a07a50'),{ref:[14,40,4]});
    s.box(36,50,0,45,53.5,2.4,M3('logs','#6b4a2a'),M3('flat','#b08858'));
    render3(g,bx,by,s);const f=pr(47,48,1.5);g.save();g.globalCompositeOperation='lighter';const gr=g.createRadialGradient(f[0],f[1],0,f[0],f[1],7);gr.addColorStop(0,'rgba(255,170,70,.75)');gr.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=gr;g.fillRect(f[0]-7,f[1]-7,14,14);g.restore();return true}
  if(rep<=2){const wall=rep===1?M3('mud','#ad8a5c'):M3('plaster','#cdb48a'),roof=M3('thatch',rep===1?'#a88c52':'#b49a5c');s.ground(5,12,59,58,M3('mud','#7a6646'));
    s.box(10,24,0,40,44,8,wall,null,{s:(g,L1,L2)=>{D3.door(g,L1*.42,L2-6,4,6,'#5a3e24');D3.win(g,L1*.15,2.4,2.4,2,{bars:0,sill:0,frame:'#7a5a3a'});D3.win(g,L1*.75,2.4,2.4,2,{bars:0,sill:0,frame:'#7a5a3a'})}});
    s.gable(10,24,40,44,8,rep===1?6:9,roof,wall,'x',2);
    s.cyl(51,31,5,0,7,M3('mud','#a8865a'),null,10);s.cone(51,31,6.5,6.5,6,roof,10);
    for(let x=6;x<58;x+=4)s.box(x,56,0,x+.9,56.9,3.2,M3('logs','#6b4a2a'),M3('flat','#8a6a44'));s.box(6,56.2,2,58,56.7,2.6,M3('logs','#7a5634'),null);
    propsYard(s,rep,44,46);render3(g,bx,by,s);return true}
  if(rep===3){const wall=M3('planks','#7a5a3a');s.ground(5,12,59,58,M3('mud','#7a6646'));
    s.box(8,24,0,44,42,7,wall,null,{s:(g,L1,L2)=>{D3.door(g,L1*.45,L2-6,4,6,'#4a3420');D3.win(g,L1*.2,2,2.4,2,{bars:0,frame:'#4a3420'});D3.win(g,L1*.75,2,2.4,2,{bars:0,frame:'#4a3420'})}});
    s.hip(8,24,44,42,7,12,M3('thatch','#a89058'),2.2);s.box(47,28,0,57,38,5,M3('planks','#6a4c30'),null);s.gable(47,28,57,38,5,5,M3('thatch','#9a8450'),M3('planks','#6a4c30'),'y',1.2);
    propsYard(s,rep,30,48);render3(g,bx,by,s);return true}
  if(rep===4){const base=M3('rubble','#9a9284'),up=M3('plaster','#dccfb2');s.ground(5,12,59,58,M3('gravel','#8a7a5c'));
    s.box(10,22,0,42,44,6,base,null,{s:(g,L1,L2)=>{D3.door(g,L1*.4,L2-5.5,4.2,5.5,'#5a3a22',{arch:1});D3.win(g,L1*.12,1.5,2.4,2.4,{bars:0,frame:'#6a6056'})}});
    s.box(10,22,6,42,44,14,up,null,{s:(g,L1,L2)=>{D3.frame(g,L1,L2,'#3e2c1e',6.4);D3.win(g,4,2.4,2.6,3,{lit:1,frame:'#3e2c1e'});D3.win(g,L1-8,2.4,2.6,3,{frame:'#3e2c1e'})},e:(g,L1,L2)=>D3.frame(g,L1,L2,'#3e2c1e',5.5)});
    s.gable(10,22,42,44,14,13,M3('tiles','#9a4a32'),up,'x',2,{ge:(g,L1,L2)=>{g.fillStyle='#3e2c1e';g.fillRect(L1/2-.5,0,1,L2);g.fillRect(0,L2-1,L1,1)}});
    s.box(33,27,14,37,31,29,M3('rubble','#8a8274'),M3('flat','#3a3430'));
    s.box(47,40,0,57,52,1.2,M3('mud','#5a4a30'),M3('mud','#4e6a2c'));propsYard(s,rep,12,50);render3(g,bx,by,s);return true}
  if(rep===5){const wall=M3('plaster','#e0d2ae');s.ground(5,12,59,58,M3('gravel','#9a8a6a'));
    s.box(8,20,0,44,44,17,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,7.6,.8,'#c8b890');D3.band(g,L1,L2-1.6,1.6,'#a89a80');winRow(g,L1,2,2.6,3.6,4,i=>({lit:litOf(i,1),frame:'#f0ead8'}));winRow(g,L1,10,2.6,3.6,4,i=>({frame:'#f0ead8'}),i=>i===1);D3.door(g,L1*.33-1,L2-6.4,4,6.4,'#4a3222',{arch:1})},e:(g,L1,L2)=>{D3.band(g,L1,7.6,.8,'#c8b890');winRow(g,L1,2,2.4,3.4,2)}});
    s.gable(8,20,44,44,17,12,M3('tiles','#a85a3a'),wall,'x',1.8);s.box(14,24,17,18,28,30,M3('plaster','#cfc0a0'),M3('flat','#3a3430'));s.box(36,36,17,40,40,30,M3('plaster','#cfc0a0'),M3('flat','#3a3430'));
    propsYard(s,rep,47,48);render3(g,bx,by,s);return true}
  if(rep===6){const wall=M3('clap','#e6e2d6');s.ground(5,12,59,58,M3('gravel','#8a8068'));
    s.box(8,22,0,42,42,12,wall,null,{s:(g,L1,L2)=>{winRow(g,L1,2.4,2.4,3.6,4,i=>({shut:'#3a5a3a',frame:'#f4f2ea',lit:litOf(i,2)}),i=>i===1);D3.door(g,L1*.32,L2-6.2,3.6,6.2,'#6a2a22')}});
    s.gable(8,22,42,42,12,11,M3('shingle','#5a4c40'),wall,'x',1.8);
    s.box(10,42,0,40,48,.8,M3('planks','#8a7a64'),M3('planks','#a8987e'));for(const x of [11,20,30,39])s.cyl(x,47,.6,0,7,M3('flat','#f0eee6'),null,6);
    s.quad([9,42,8.5],[41,42,8.5],[41,49,7],[9,49,7],M3('shingle','#5a4c40'),{ref:[25,45,0],roof:1});
    s.box(36,26,12,39,29,24,M3('brick','#8a4a3a'),M3('flat','#3a3430'));propsYard(s,rep,46,30);render3(g,bx,by,s);return true}
  if(rep===7){const wall=M3('brick','#a45a44');s.ground(4,12,60,58,M3('gravel','#8a8478'));
    s.box(8,20,0,40,42,23,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,0,1.4,'#d8cfb8');D3.band(g,L1,11,1,'#d8cfb8');winRow(g,L1,3,2.6,5,4,i=>({lit:litOf(i,3),frame:'#ece6d6'}));winRow(g,L1,13.5,2.6,5,4,i=>({frame:'#ece6d6',lit:litOf(i,4)}),i=>i===1);D3.door(g,L1*.33-1.4,L2-7,3.8,7,'#3a2a20');g.fillStyle='#d8cfb8';g.fillRect(L1*.33-2.4,L2-7.8,5.8,.9)},e:(g,L1,L2)=>{D3.band(g,L1,11,1,'#d8cfb8');winRow(g,L1,3,2.4,5,2);winRow(g,L1,13.5,2.4,5,2)}});
    s.hip(8,20,40,42,23,9,M3('slate','#4a4e58'),1.4);for(const x of [11,34])s.box(x,26,24,x+4,29,34,wall,M3('flat','#3a2a24'));
    s.box(46,46,0,47,47,15,M3('metal','#2a2a2a'),null);for(let x=6;x<44;x+=2.2)s.box(x,54,0,x+.4,54.4,3.6,M3('metal','#2a2a2a'),null);
    render3(g,bx,by,s);const l=pr(46.5,46.5,15.5);g.fillStyle='#2a2a2a';g.fillRect(l[0]-1.6,l[1]-3,3.2,3);g.fillStyle='rgba(255,220,150,.95)';g.fillRect(l[0]-1,l[1]-2.5,2,2);return true}
  if(rep===8){const wall=M3('plaster','#d6cbae');s.ground(4,12,60,58,M3('gravel','#8e8a7c'));
    s.box(8,20,0,42,44,17,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,L2-3,3,'#8a8270');winRow(g,L1,2.4,3,4.4,3,i=>({shut:'#4a5a3a',frame:'#f0ece0',lit:litOf(i,5)}));winRow(g,L1,10,3,3.6,3,i=>({shut:'#4a5a3a',frame:'#f0ece0'}),i=>i===1);D3.door(g,L1/2-2,L2-6.6,4,6.6,'#5a3a24')}});
    s.hip(8,20,42,44,17,10,M3('tiles','#9a4a34'),1.8);s.box(34,28,18,37,31,30,M3('plaster','#bfb49a'),M3('flat','#3a3430'));
    for(let i=0;i<5;i++)s.box(46,24+i*5,0,50,28+i*5,5+(i%2),M3('flat','#3a5228'),M3('flat','#4a6a30'));propsYard(s,rep,12,50);render3(g,bx,by,s);return true}
  // Moderne
  {const wall=M3('plaster','#eeebe4');s.ground(4,12,60,58,M3('gravel','#9a9890'));s.ground(44,42,60,58,M3('concrete','#b0aea6'));
   s.box(8,20,0,38,44,13,wall,M3('gravel','#8a8a84'),{s:(g,L1,L2)=>{D3.win(g,2,2,L1-14,5,{bars:0,sill:0,frame:'#3a3a3a'});D3.win(g,2,8.5,9,L2-9,{bars:0,sill:0,frame:'#3a3a3a'});D3.door(g,L1-9,L2-7,3.6,7,'#3a3a3a')}});
   s.box(30,20,0,40,44,13.5,M3('planks','#8a6440'),M3('gravel','#8a8a84'));
   for(let i=0;i<3;i++){const x=11+i*6;s.quad([x,27,15.5],[x+5,27,15.5],[x+5,33,13.2],[x,33,13.2],M3('glass','#24344a'),{ref:[x+2,30,0]})}
   s.box(46,46,0,57,51,3,M3('flat',shade(pc,-5)),M3('flat',shade(pc,10)));s.box(48.5,46.5,3,54,50.5,5,M3('glass','#3a5a6a'),M3('flat',shade(pc,5)));
   s.box(6,52,0,40,55,3.4,M3('flat','#3e5a2a'),M3('flat','#4e6c34'));render3(g,bx,by,s);return true}};

// ---- gemeinsame Bauteile
// Zinnen ringsum auf einer Mauerkrone
function crenel3(s,x0,y0,x1,y1,z,mat,st,h){st=st||3;h=h||2;const w=st*.55;
  for(let x=x0;x<=x1-w+.01;x+=st){s.box(x,y1-1.2,z,x+w,y1,z+h,mat,mat);s.box(x,y0,z,x+w,y0+1.2,z+h,mat,mat)}
  for(let y=y0+st;y<=y1-w-st+.01;y+=st){s.box(x1-1.2,y,z,x1,y+w,z+h,mat,mat);s.box(x0,y,z,x0+1.2,y+w,z+h,mat,mat)}}
// Fahne in Spielerfarbe an einem Mast
function flag3(s,x,y,z,h,pc,w){w=w||7;s.box(x-.35,y-.35,z,x+.35,y+.35,z+h,M3('metal','#5a5450'),M3('flat','#c8b070'));
  const f=M3('flat',pc);s.quad([x+.4,y,z+h-.4],[x+w*.5,y+.6,z+h-.9],[x+w*.5,y+.6,z+h-4.6],[x+.4,y,z+h-4.4],f,{ref:[x,y-5,z+h-2],noshadow:0});
  s.quad([x+w*.5,y+.6,z+h-.9],[x+w,y,z+h-.5],[x+w,y,z+h-4.6],[x+w*.5,y+.6,z+h-4.6],f,{ref:[x,y-5,z+h-2]})}
// Säulenreihe entlang x
function cols3(s,x0,x1,y,n,z0,z1,mat,r){r=r||1;for(let i=0;i<n;i++){const x=x0+(x1-x0)*(n<2?.5:i/(n-1));s.cyl(x,y,r,z0,z1,mat,null,8);s.box(x-r*1.3,y-r*1.3,z1-.6,x+r*1.3,y+r*1.3,z1,mat,mat)}}
// Treppe nach Süden
function steps3(s,x0,x1,y,n,dz,mat){for(let i=0;i<n;i++)s.box(x0,y+i*1.4,0,x1,y+i*1.4+1.4,dz*(n-i),mat,mat)}
const SAND=M3('ashlar','#c8b48a');

B3.tc=(g,bx,by,S,rep,pc)=>{const s=Scene3();
  if(rep===0){s.ground(6,12,90,90,M3('mud','#6e5c40'));
    s.cyl(42,46,19,0,8,M3('wattle','#86663f'),null,18,hutDoor);s.cone(42,46,23,7,22,M3('thatch','#a48a52'),18);
    for(const [x,y,r] of [[74,30,8],[76,64,7.5],[16,74,7]]){s.cyl(x,y,r,0,4.5,M3('wattle','#7a5c3a'),null,10,hutDoor);s.cone(x,y,r*1.32,4,r*1.25,M3('thatch','#9a8048'),10)}
    for(let a=0;a<Math.PI*2;a+=.21){const x=48+Math.cos(a)*40,y=52+Math.sin(a)*36;if(Math.abs(a-1.57)<.3)continue;s.box(x-.8,y-.8,0,x+.8,y+.8,5+(a*7%1.5),M3('logs','#6b4a2a'),M3('flat','#8a6a44'))}
    s.box(56,72,0,57.6,73.6,14,M3('logs','#5a3a22'),M3('flat','#3a2a1a'));flag3(s,22,32,0,18,pc,6);
    s.box(50,78,0,62,82,2.4,M3('logs','#6b4a2a'),M3('flat','#b08858'));
    render3(g,bx,by,s);const f=PR3(bx,by)(64,72,1.4);g.save();g.globalCompositeOperation='lighter';const gr=g.createRadialGradient(f[0],f[1],0,f[0],f[1],9);gr.addColorStop(0,'rgba(255,170,70,.8)');gr.addColorStop(1,'rgba(255,120,40,0)');g.fillStyle=gr;g.fillRect(f[0]-9,f[1]-9,18,18);g.restore();return true}
  if(rep<=2){const w=rep===1?M3('mud','#b08c5c'):M3('mud','#bf9c6a'),top=M3('flat','#a88a60');s.ground(5,12,91,91,M3('mud','#7e6a48'));
    s.box(10,22,0,86,30,4.5,w,top);s.box(10,22,0,18,86,4.5,w,top);s.box(78,22,0,86,86,4.5,w,top);
    s.box(10,82,0,36,86,4.5,w,top);s.box(60,82,0,86,86,4.5,w,top);
    s.box(24,30,0,72,62,12,w,top,{s:(g,L1,L2)=>{D3.door(g,L1/2-3,L2-8,6,8,'#4a3020');winRow(g,L1,3,2.4,2.6,6,()=>({bars:0,sill:0,frame:'#6a5034'}),i=>i===2||i===3)}});
    s.box(32,36,12,64,56,20,w,top,{s:(g,L1,L2)=>winRow(g,L1,2.4,2.4,2.6,4,()=>({bars:0,sill:0,frame:'#6a5034'}))});
    s.box(40,40,20,56,50,24,w,M3('thatch','#9a8450'));
    for(let x=26;x<72;x+=6)s.box(x,62,10.6,x+1.2,63.2,11.8,M3('logs','#5a4028'),null);
    for(const x of [28,66])s.cyl(x,72,4.6,0,7,w,null,10),s.cone(x,72,5.6,6.5,5,M3('thatch','#a88c52'),10);
    flag3(s,38,62,0,22,pc);flag3(s,58,62,0,22,pc);render3(g,bx,by,s);return true}
  if(rep===3){const st=M3('ashlar','#d6cbb0');s.ground(5,12,91,91,M3('gravel','#9a8c70'));s.ground(30,66,66,91,M3('ashlar','#bdb294'));
    s.box(18,26,0,78,62,4,st,st);steps3(s,26,70,62,3,1.3,st);
    s.box(24,30,4,72,56,17,M3('plaster','#e4dac0'),null,{s:(g,L1,L2)=>{D3.door(g,L1/2-3.5,L2-9,7,9,'#5a3a22')}});
    cols3(s,22,74,59,9,4,19,M3('ashlar','#ece4d0'),1.2);s.box(20,28,19,76,61,21,st,null,{s:(g,L1,L2)=>D3.band(g,L1,0,.8,'#f4ecd8')});
    s.gable(20,28,76,61,21,9,M3('tiles','#a05434'),st,'x',1.4);
    s.box(4,30,0,16,52,9,M3('plaster','#d8ccb0'),null);s.gable(4,30,16,52,9,5,M3('tiles','#984e32'),M3('plaster','#d8ccb0'),'y',1);
    s.box(80,30,0,92,52,9,M3('plaster','#d8ccb0'),null);s.gable(80,30,92,52,9,5,M3('tiles','#984e32'),M3('plaster','#d8ccb0'),'y',1);
    flag3(s,30,80,0,20,pc);flag3(s,66,80,0,20,pc);render3(g,bx,by,s);return true}
  if(rep===4){const st=M3('ashlar','#a8a090'),rb=M3('rubble','#9a9284');s.ground(5,12,91,91,M3('gravel','#8a7c62'));
    // Ringmauer mit Torbau, Bergfried, Palas
    s.box(8,20,0,88,24,9,rb,rb);s.box(8,20,0,12,88,9,rb,rb);s.box(84,20,0,88,88,9,rb,rb);s.box(8,84,0,40,88,9,rb,rb);s.box(56,84,0,88,88,9,rb,rb);
    crenel3(s,8,20,88,88,9,rb,3.2,1.8);
    s.box(40,80,0,56,90,14,st,st,{s:(g,L1,L2)=>D3.door(g,L1/2-3.5,L2-9,7,9,'#3a2618',{arch:1})});crenel3(s,40,80,56,90,14,st,3,1.8);
    s.box(16,26,0,38,48,34,st,st,{s:(g,L1,L2)=>{D3.win(g,L1/2-1,6,2,4,{bars:0,arch:1,frame:'#8a8478'});D3.win(g,L1/2-1,16,2,4,{bars:0,arch:1,frame:'#8a8478',lit:1})},e:(g,L1,L2)=>D3.win(g,L1/2-1,10,2,4,{bars:0,arch:1,frame:'#8a8478'})});crenel3(s,16,26,38,48,34,st,3,2.2);
    s.box(44,30,0,80,54,10,st,null,{s:(g,L1,L2)=>{winRow(g,L1,2,2.4,3.6,5,i=>({arch:1,bars:0,frame:'#8a8478',lit:litOf(i,6)}))}});
    s.box(44,30,10,80,54,19,M3('plaster','#dccfb2'),null,{s:(g,L1,L2)=>{D3.frame(g,L1,L2,'#3e2c1e',6);winRow(g,L1,2.6,2.4,3,4,()=>({frame:'#3e2c1e'}))}});
    s.gable(44,30,80,54,19,12,M3('tiles','#8e4a32'),M3('plaster','#dccfb2'),'x',1.6);
    flag3(s,27,37,36,12,pc,8);flag3(s,48,85,16,10,pc,6);render3(g,bx,by,s);return true}
  if(rep===5){const wall=M3('plaster','#e6d8b6'),st=M3('ashlar','#c8bca0');s.ground(5,12,91,91,M3('ashlar','#a89c84'));
    s.box(14,30,0,82,62,20,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,L2-3,3,'#bfb294');D3.band(g,L1,9,1,'#cfc2a2');winRow(g,L1,2.4,2.8,4.4,8,i=>({lit:litOf(i,7),frame:'#f2ead6'}),i=>i===3||i===4);winRow(g,L1,11.4,2.8,4.4,8,()=>({frame:'#f2ead6',arch:1}),i=>i===3||i===4)},e:(g,L1,L2)=>{winRow(g,L1,2.4,2.8,4.4,3);winRow(g,L1,11.4,2.8,4.4,3,null)}});
    s.hip(14,30,82,62,20,12,M3('tiles','#9a4c32'),1.8);
    // Rathausturm mit Uhr und Haube
    s.box(40,52,0,56,66,34,st,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-3,L2-9,6,9,'#4a2e1c',{arch:1});g.fillStyle='#f0ead8';g.beginPath();g.arc(L1/2,7,3.4,0,7);g.fill();g.strokeStyle='#2a2420';g.lineWidth=.5;g.stroke();g.beginPath();g.moveTo(L1/2,7);g.lineTo(L1/2,4.6);g.moveTo(L1/2,7);g.lineTo(L1/2+1.6,7.6);g.stroke()}});
    s.box(42,54,34,54,64,40,st,null,{s:(g,L1,L2)=>winRow(g,L1,1,2,4.4,2,()=>({arch:1,bars:0,frame:'#c8bca0'}))});
    s.pyramid(48,59,13,11,40,12,M3('metal','#4e7a6a'),.4);flag3(s,48,59,51,6,pc,5);
    steps3(s,38,58,66,3,.7,st);for(const x of [20,74])s.cyl(x,80,4,0,1.4,st,M3('flat','#5a7a8a'),12);
    render3(g,bx,by,s);return true}
  if(rep===6){const wall=M3('plaster','#ece6d6'),st=M3('ashlar','#d8d0bc');s.ground(5,12,91,91,M3('gravel','#9c9480'));s.ground(34,62,62,91,M3('ashlar','#b8b09a'));
    s.box(10,28,0,86,58,22,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,L2-4,4,'#c8c0aa');D3.band(g,L1,0,1.4,'#d8d0bc');winRow(g,L1,3,2.8,5,9,i=>({shut:'#3a5040',frame:'#fff',lit:litOf(i,8)}),i=>i===4);winRow(g,L1,11.6,2.8,5,9,()=>({shut:'#3a5040',frame:'#fff'}),i=>i===4)}});
    s.hip(10,28,86,58,22,10,M3('slate','#545a64'),1.4);
    // Portikus mit Giebel
    s.box(36,58,0,60,66,2,st,st);cols3(s,38,58,63.6,4,2,20,M3('ashlar','#f4f0e4'),1.1);s.box(35,56,20,61,66,22.4,st,st);s.gable(35,56,61,66,22.4,6,M3('slate','#545a64'),M3('ashlar','#ece6d6'),'y',.6);
    s.cyl(48,43,7,32,38,wall,null,14,(g,L1,L2,i,n)=>{if(i%2===0)D3.win(g,L1*.3,1.4,L1*.4,3.2,{bars:0,sill:0,frame:'#fff'})});s.cone(48,43,7.8,38,7,M3('metal','#5e8a78'),14);flag3(s,48,43,45,6,pc,5);
    steps3(s,36,60,66,3,.7,st);render3(g,bx,by,s);return true}
  if(rep===7){const wall=M3('brick','#9e5440'),st=M3('ashlar','#d0c6b0');s.ground(4,12,92,92,M3('ashlar','#8e8a80'));
    s.box(8,26,0,88,60,26,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,0,1.6,'#d8cfb8');D3.band(g,L1,12,1,'#d8cfb8');D3.band(g,L1,L2-3,3,'#b8ae98');winRow(g,L1,3.4,2.8,6,10,i=>({frame:'#ece6d6',lit:litOf(i,9)}));winRow(g,L1,14.4,2.8,6,10,i=>({frame:'#ece6d6',lit:litOf(i,10)}),i=>i===4||i===5)}});
    s.hip(8,26,88,60,26,9,M3('slate','#464a54'),1.2);
    s.box(40,54,0,56,64,46,wall,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-3,L2-10,6,10,'#3a2a20',{arch:1});D3.band(g,L1,22,1,'#d8cfb8');g.fillStyle='#f4efe2';g.beginPath();g.arc(L1/2,7,4,0,7);g.fill();g.strokeStyle='#222';g.lineWidth=.5;g.stroke();g.beginPath();g.moveTo(L1/2,7);g.lineTo(L1/2,4.2);g.moveTo(L1/2,7);g.lineTo(L1/2+2,7.4);g.stroke()},e:(g,L1,L2)=>{g.fillStyle='#f4efe2';g.beginPath();g.arc(L1/2,7,3.4,0,7);g.fill()}});
    s.pyramid(48,59,17,11,46,14,M3('slate','#3e424c'),.6);flag3(s,48,59,59,7,pc,6);
    for(const x of [14,80])s.box(x,74,0,x+1,75,12,M3('metal','#2a2a2a'),null);steps3(s,40,56,64,3,.7,st);render3(g,bx,by,s);return true}
  if(rep===8){const c=M3('concrete','#c2beb4');s.ground(4,12,92,92,M3('concrete','#9a9890'));
    s.box(8,24,0,88,58,18,c,M3('gravel','#8a8880'),{s:(g,L1,L2)=>{for(let k=0;k<3;k++)for(let x=2;x<L1-2;x+=3.6)D3.win(g,x,1.6+k*5.6,2.6,3.8,{bars:0,sill:0,frame:'#7a7870',lit:((x*3+k)%7|0)===0})}});
    s.box(30,30,18,66,52,46,c,M3('gravel','#8a8880'),{s:(g,L1,L2)=>{for(let k=0;k<5;k++)for(let x=2;x<L1-2;x+=3.6)D3.win(g,x,1.4+k*5.6,2.6,3.8,{bars:0,sill:0,frame:'#7a7870',lit:((x+k*5)%9|0)===0})}});
    s.box(38,58,0,58,66,7,M3('glass','#405868'),M3('concrete','#d0ccc2'));for(const x of [38.6,57.4])s.box(x-.6,65,0,x+.6,66,7,c,c);
    s.box(54,36,46,58,40,52,M3('metal','#7a7a7a'),null);flag3(s,22,74,0,20,pc);flag3(s,74,74,0,20,pc);flag3(s,48,74,0,22,pc);render3(g,bx,by,s);return true}
  {const gl=M3('glass','#2e4a62');s.ground(4,12,92,92,M3('concrete','#a8a8a4'));s.ground(14,66,82,92,M3('concrete','#c4c2bc'));
   s.box(10,30,0,86,60,10,gl,M3('gravel','#9a9a96'));s.box(8,28,10,88,62,11,M3('concrete','#e4e2dc'),M3('concrete','#d8d6d0'));
   s.box(30,32,11,66,54,58,gl,M3('concrete','#cfcdc6'),{s:(g,L1,L2)=>{g.fillStyle='rgba(220,230,240,.25)';for(let y=0;y<L2;y+=4)g.fillRect(0,y,L1,.25);for(let x=0;x<L1;x+=3)g.fillRect(x,0,.2,L2)},e:(g,L1,L2)=>{g.fillStyle='rgba(220,230,240,.2)';for(let y=0;y<L2;y+=4)g.fillRect(0,y,L1,.25)}});
   s.box(40,38,58,56,48,62,M3('metal','#8a8a8a'),M3('metal','#6a6a6a'));s.cyl(62,36,1.6,58,61,M3('metal','#9a9a9a'),M3('flat','#e0e0e0'),8);
   for(const x of [18,28,68,78])s.cyl(x,78,2.8,0,5,M3('flat','#4a3a2a'),null,8),s.cyl(x,78,3.6,4,7.5,M3('flat','#3e6a30'),M3('flat','#4e7a3a'),8);
   flag3(s,40,72,0,22,pc);flag3(s,56,72,0,22,pc);render3(g,bx,by,s);return true}};

// Übungspuppe und Waffengestell
function dummy3(s,x,y){s.box(x-.4,y-.4,0,x+.4,y+.4,6,M3('logs','#6b4a2a'),null);s.box(x-2.4,y-.4,4.2,x+2.4,y+.4,5,M3('logs','#6b4a2a'),null);s.cyl(x,y,1.2,5,7.4,M3('wattle','#b09a62'),M3('flat','#b09a62'),6)}
function rack3(s,x,y,n){s.box(x,y,0,x+n*1.6,y+.6,4.4,M3('logs','#5a4028'),null);for(let i=0;i<n;i++)s.box(x+.4+i*1.6,y-.3,0,x+.8+i*1.6,y,6.4,M3('metal','#8a8a90'),null)}
B3.barracks=(g,bx,by,S,rep,pc)=>{const s=Scene3();
  if(rep===0){s.ground(6,12,90,90,M3('mud','#6e5c40'));
    for(let x=8;x<88;x+=2.1)if(x<40||x>56)s.box(x,86,0,x+1.6,87.6,6+(x*13%1.6),M3('logs','#6b4a2a'),M3('flat','#8a6a44'));
    for(let y=16;y<88;y+=2.1){s.box(8,y,0,9.6,y+1.6,6+(y*7%1.4),M3('logs','#6b4a2a'),M3('flat','#8a6a44'));s.box(86,y,0,87.6,y+1.6,6+(y*5%1.4),M3('logs','#6b4a2a'),M3('flat','#8a6a44'))}
    for(let x=8;x<88;x+=2.1)s.box(x,16,0,x+1.6,17.6,6,M3('logs','#6b4a2a'),M3('flat','#8a6a44'));
    s.box(16,24,0,58,44,6,M3('wattle','#86663f'),null,{s:(g,L1,L2)=>D3.door(g,L1/2-2.5,L2-5,5,5,'#2a1a10')});s.gable(16,24,58,44,6,10,M3('thatch','#a48a52'),M3('wattle','#86663f'),'x',2);
    s.cyl(72,34,9,0,5,M3('hide','#9a7650'),null,12,hutDoor);s.cone(72,34,10,4.6,9,M3('hide','#8a6844'),12);
    for(const [x,y] of [[30,64],[44,66],[58,62]])dummy3(s,x,y);rack3(s,66,58,5);flag3(s,40,82,0,16,pc,6);render3(g,bx,by,s);return true}
  if(rep<=2){const w=M3('mud',rep===1?'#ad8a5c':'#b8956a'),top=M3('flat','#a2845c');s.ground(5,12,91,91,M3('mud','#7e6a48'));
    s.box(10,22,0,86,46,10,w,top,{s:(g,L1,L2)=>{for(const u of [.2,.5,.8])D3.door(g,L1*u-2.5,L2-6.5,5,6.5,'#3a2818');winRow(g,L1,2.2,2,2,8,()=>({bars:0,sill:0,frame:'#6a5034'}))}});
    s.box(10,22,10,86,46,11,w,M3('thatch','#a08850'));for(let x=12;x<86;x+=5)s.box(x,46,8,x+1,47,9,M3('logs','#5a4028'),null);
    s.box(64,46,0,86,86,7,w,top);s.box(10,82,0,64,86,4,w,top);
    for(const [x,y] of [[22,62],[34,66],[46,62]])dummy3(s,x,y);rack3(s,24,74,6);rack3(s,44,74,6);
    flag3(s,20,48,0,18,pc);flag3(s,76,48,7,14,pc);render3(g,bx,by,s);return true}
  if(rep===3){const pl=M3('planks','#7a5a3a');s.ground(5,12,91,91,M3('mud','#7a6646'));
    for(let x=6;x<90;x+=2)s.box(x,14,0,x+1.6,15.6,8,M3('logs','#6b4a2a'),M3('flat','#8a6a44'));for(let y=16;y<88;y+=2){s.box(6,y,0,7.6,y+1.6,8,M3('logs','#6b4a2a'),M3('flat','#8a6a44'));s.box(88,y,0,89.6,y+1.6,8,M3('logs','#6b4a2a'),M3('flat','#8a6a44'))}
    s.box(14,22,0,74,44,9,pl,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-3,L2-7,6,7,'#3a2818');winRow(g,L1,2.4,2.4,2.4,6,()=>({bars:0,frame:'#4a3420'}),i=>i===2||i===3)}});
    s.gable(14,22,74,44,9,14,M3('shingle','#6a5a44'),pl,'x',2.2,{ge:(g,L1,L2)=>{g.fillStyle='#4a3420';g.fillRect(L1/2-.4,0,.8,L2)}});
    s.box(16,64,0,40,72,1,M3('mud','#6a5838'),null);for(const [x,y] of [[48,62],[58,66],[68,62]])dummy3(s,x,y);rack3(s,20,56,7);
    s.box(76,62,0,86,80,12,M3('logs','#6b4a2a'),M3('planks','#8a6a44'));s.pyramid(81,71,12,20,12,5,M3('shingle','#6a5a44'),.6);flag3(s,81,71,17,8,pc);render3(g,bx,by,s);return true}
  if(rep===4){const st=M3('ashlar','#a8a090'),rb=M3('rubble','#9a9284');s.ground(5,12,91,91,M3('gravel','#8a7c62'));s.ground(14,54,82,88,M3('mud','#7a6a4c'));
    s.box(10,20,0,86,46,12,st,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-3.5,L2-8,7,8,'#3a2618',{arch:1});winRow(g,L1,2.6,2,3.4,10,()=>({bars:0,arch:1,frame:'#8a8478'}),i=>i===4||i===5)}});
    s.gable(10,20,86,46,12,11,M3('tiles','#8a4a30'),st,'x',1.6);
    s.box(10,46,0,16,88,6,rb,rb);s.box(80,46,0,86,88,6,rb,rb);s.box(10,84,0,40,88,6,rb,rb);s.box(56,84,0,86,88,6,rb,rb);crenel3(s,10,46,86,88,6,rb,3.4,1.6);
    for(const [x,y] of [[30,64],[42,70],[54,64],[66,70]])dummy3(s,x,y);rack3(s,20,72,6);s.box(70,58,0,76,64,3,M3('planks','#6a4c30'),M3('planks','#7a5a3a'));
    flag3(s,40,86,6,14,pc);flag3(s,56,86,6,14,pc);render3(g,bx,by,s);return true}
  if(rep===5){const wall=M3('plaster','#ddd0b0'),st=M3('ashlar','#bcb098');s.ground(5,12,91,91,M3('ashlar','#9e9480'));
    s.box(8,20,0,88,44,18,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,L2-2.4,2.4,'#b8ac90');D3.band(g,L1,8.6,.8,'#c8bc9e');winRow(g,L1,2.2,2.6,4,10,i=>({frame:'#efe6d0',lit:litOf(i,11)}));winRow(g,L1,10.8,2.6,4,10,()=>({frame:'#efe6d0'}),i=>i===4||i===5);D3.door(g,L1/2-3.5,L2-7,7,7,'#4a2e1c',{arch:1})}});
    s.hip(8,20,88,44,18,9,M3('tiles','#984a30'),1.6);s.box(8,44,0,20,86,12,wall,null,{e:(g,L1,L2)=>winRow(g,L1,3,2.4,3.8,5)});s.hip(8,44,20,86,12,6,M3('tiles','#984a30'),1.2);
    for(let i=0;i<4;i++)for(let k=0;k<3;k++)dummy3(s,32+i*13,56+k*10);rack3(s,74,84,6);flag3(s,48,46,0,22,pc,8);render3(g,bx,by,s);return true}
  if(rep===6){const wall=M3('brick','#9a5642'),st=M3('ashlar','#d0c6b0');s.ground(5,12,91,91,M3('gravel','#958a74'));
    s.box(8,20,0,88,42,17,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,0,1.2,'#d8cfb8');D3.band(g,L1,L2-2,2,'#b8ae98');winRow(g,L1,2.6,2.6,4.4,11,()=>({frame:'#ece6d6'}));winRow(g,L1,10.4,2.6,4.4,11,i=>({frame:'#ece6d6',lit:litOf(i,12)}),i=>i===5);D3.door(g,L1/2-3,L2-7,6,7,'#3a2a20',{arch:1})}});
    s.gable(8,20,88,42,17,8,M3('slate','#4e525c'),wall,'x',1.2);for(const x of [20,48,76])s.box(x,26,20,x+3,29,28,wall,M3('flat','#3a2a24'));
    s.box(70,42,0,88,86,10,wall,null,{w:(g,L1,L2)=>winRow(g,L1,2.4,2.4,4,6)});s.gable(70,42,88,86,10,6,M3('slate','#4e525c'),wall,'y',1);
    s.box(14,74,0,22,82,8,M3('planks','#6a4c30'),null);for(let k=0;k<3;k++)rack3(s,26,60+k*8,8);flag3(s,48,46,0,22,pc,8);
    for(let x=10;x<68;x+=2.4)s.box(x,88,0,x+.4,88.4,4,M3('metal','#2a2a2a'),null);render3(g,bx,by,s);return true}
  if(rep===7){const wall=M3('brick','#8e4e3c');s.ground(4,12,92,92,M3('gravel','#8a8478'));
    s.box(8,18,0,88,40,20,wall,null,{s:(g,L1,L2)=>{D3.band(g,L1,0,1.4,'#c8bea8');D3.band(g,L1,10,1,'#c8bea8');winRow(g,L1,3,2.8,5.2,10,()=>({frame:'#e8e2d2'}));winRow(g,L1,12.6,2.8,5.2,10,i=>({frame:'#e8e2d2',lit:litOf(i,13)}),i=>i===4);D3.door(g,L1*.45,L2-7.4,6,7.4,'#2a2a28')}});
    s.hip(8,18,88,40,20,7,M3('slate','#44484f'),1);
    vault3(s,10,48,46,70,0,9,M3('metal','#6a6a62'),M3('planks','#5a4a38'),10);vault3(s,52,48,88,70,0,9,M3('metal','#6a6a62'),M3('planks','#5a4a38'),10);
    s.ground(10,74,88,90,M3('concrete','#9a968c'));for(let i=0;i<6;i++)s.box(16+i*12,80,0,22+i*12,84,3,M3('hide','#6a6a48'),M3('hide','#7a7a52'));flag3(s,48,44,0,26,pc,8);render3(g,bx,by,s);return true}
  if(rep===8){const c=M3('concrete','#b4b0a4');s.ground(4,12,92,92,M3('concrete','#9a9890'));
    s.box(8,18,0,60,42,14,c,M3('gravel','#8a8880'),{s:(g,L1,L2)=>{for(let k=0;k<2;k++)for(let x=2;x<L1-2;x+=4)D3.win(g,x,2+k*6,2.8,3.6,{bars:0,sill:0,frame:'#6a6860',lit:((x+k*3)%11|0)===0})}});
    s.box(64,18,0,88,48,16,M3('metal','#6e7468'),M3('metal','#5e6458'),{s:(g,L1,L2)=>{g.fillStyle='#3a3e38';g.fillRect(3,L2-12,L1-6,12);g.fillStyle='rgba(0,0,0,.25)';for(let y=L2-12;y<L2;y+=1)g.fillRect(3,y,L1-6,.2)}});
    vault3(s,10,52,58,74,0,10,M3('metal','#7a7e70'),M3('concrete','#a8a498'),12);
    s.ground(8,78,88,92,M3('concrete','#aaa69c'));for(let i=0;i<3;i++)s.box(14+i*18,80,0,26+i*18,86,3.4,M3('metal',shade(pc,-40)),M3('metal',shade(pc,-30)));
    for(let x=6;x<90;x+=3)s.box(x,90,0,x+.3,90.3,5,M3('metal','#3a3a3a'),null);flag3(s,30,46,0,24,pc,8);render3(g,bx,by,s);return true}
  {const c=M3('concrete','#d4d2cc');s.ground(4,12,92,92,M3('concrete','#a8a8a4'));
   s.box(8,18,0,88,46,15,c,M3('gravel','#9a9a96'),{s:(g,L1,L2)=>{D3.win(g,3,2,L1-6,4.6,{bars:0,sill:0,frame:'#3a3a3a'});g.fillStyle='#3a3e44';g.fillRect(L1*.6,L2-8,L1*.3,8);g.fillStyle='rgba(255,255,255,.12)';for(let y=L2-8;y<L2;y+=1.2)g.fillRect(L1*.6,y,L1*.3,.2)}});
   s.box(10,20,15,40,44,17,M3('metal','#7a7e84'),M3('glass','#2a3a50'));for(let i=0;i<4;i++)s.quad([48+i*9,22,16.5],[55+i*9,22,16.5],[55+i*9,30,15],[48+i*9,30,15],M3('glass','#22344a'),{ref:[50+i*9,26,0]});
   s.ground(8,54,88,90,M3('concrete','#bcbab4'));for(let x=12;x<88;x+=10)s.box(x,72,0,x+.4,72.4,.3,M3('flat','#e8e4c8'),M3('flat','#e8e4c8'));
   s.box(18,58,0,34,66,4,M3('metal',shade(pc,-30)),M3('metal',shade(pc,-20)));s.box(22,59,4,30,65,6,M3('metal',shade(pc,-35)),M3('glass','#2a3a44'));
   flag3(s,48,50,0,24,pc,8);flag3(s,70,50,0,24,pc,8);render3(g,bx,by,s);return true}};

B3.tower=(g,bx,by,S,rep,pc)=>{const s=Scene3();
  if(rep===0){s.ground(8,14,58,58,M3('mud','#6e5c40'));for(const [x,y] of [[20,26],[40,26],[20,44],[40,44]])s.box(x,y,0,x+1.8,y+1.8,24,M3('logs','#5e4228'),null);
    s.box(17,23,20,45,49,21.4,M3('planks','#7a5a36'),M3('planks','#8a6a44'));s.box(17,47.6,21.4,45,49,24,M3('logs','#6b4a2a'),null);s.box(17,23,21.4,18.4,49,24,M3('logs','#6b4a2a'),null);
    s.pyramid(31,36,32,30,26,9,M3('thatch','#a08850'),0);for(let z=3;z<20;z+=3.2)s.box(28,49.2,z,34,49.8,z+.5,M3('logs','#6b4a2a'),null);s.box(28,49,0,28.6,50,21,M3('logs','#5e4228'),null);s.box(33.4,49,0,34,50,21,M3('logs','#5e4228'),null);
    flag3(s,44,26,26,6,pc,5);render3(g,bx,by,s);return true}
  if(rep<=2){const w=M3('mud',rep===1?'#ad8a5c':'#b8956a');s.ground(8,14,58,58,M3('mud','#7a6646'));
    s.box(18,22,0,44,48,28,w,M3('flat','#a08458'),{s:(g,L1,L2)=>{D3.door(g,L1/2-2.5,L2-6,5,6,'#3a2818');D3.win(g,L1/2-1,8,2,3,{bars:0,sill:0,frame:'#6a5034'})},e:(g,L1,L2)=>D3.win(g,L1/2-1,6,2,3,{bars:0,sill:0,frame:'#6a5034'})});
    crenel3(s,18,22,44,48,28,w,3,2.2);flag3(s,22,26,28,8,pc,5);render3(g,bx,by,s);return true}
  if(rep===3){s.ground(8,14,58,58,M3('gravel','#8a7c62'));s.box(18,24,0,44,48,8,M3('rubble','#958c7c'),null);
    s.box(19,25,8,43,47,26,M3('planks','#7a5a3a'),null,{s:(g,L1,L2)=>{D3.win(g,L1/2-1.5,4,3,3,{bars:0,frame:'#4a3420'})}});s.box(16,22,26,46,50,27,M3('planks','#6a4c30'),M3('planks','#8a6a44'));
    for(const [x,y] of [[16,22],[44.6,22],[16,48.6],[44.6,48.6]])s.box(x,y,27,x+1.4,y+1.4,33,M3('logs','#5e4228'),null);s.pyramid(31,36,34,32,33,9,M3('shingle','#6a5a44'),0);
    flag3(s,31,36,42,6,pc,5);render3(g,bx,by,s);return true}
  if(rep===4){const st=M3('ashlar','#a8a090');s.ground(8,14,58,58,M3('gravel','#8a7c62'));
    s.cyl(31,36,12,0,34,st,M3('planks','#7a5a3a'),16,(g,L1,L2,i,n)=>{if(i===4||i===12)D3.win(g,L1/2-.8,8,1.6,4,{bars:0,arch:1,frame:'#8a8478'});if(i===4)D3.door(g,L1/2-2,L2-6,4,6,'#3a2618',{arch:1})});
    s.cyl(31,36,13.2,30,34,st,null,16);s.cone(31,36,14.4,34,16,M3('slate','#545a64'),16);flag3(s,31,36,49,7,pc,5);render3(g,bx,by,s);return true}
  if(rep===5){const st=M3('ashlar','#bcb098');s.ground(8,14,58,58,M3('ashlar','#9e9480'));
    s.box(17,22,0,45,50,36,st,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-2.5,L2-7,5,7,'#4a2e1c',{arch:1});D3.win(g,L1/2-1.2,6,2.4,4,{arch:1,bars:0});D3.win(g,L1/2-1.2,16,2.4,4,{arch:1,bars:0,lit:1})},e:(g,L1,L2)=>D3.win(g,L1/2-1.2,10,2.4,4,{arch:1,bars:0})});
    s.box(15,20,36,47,52,38,st,st);crenel3(s,15,20,47,52,38,st,3,2.4);s.pyramid(31,36,22,22,38,14,M3('tiles','#984a30'),0);flag3(s,31,36,52,6,pc,5);render3(g,bx,by,s);return true}
  if(rep===6){const st=M3('ashlar','#c8bea6'),b=M3('brick','#9a5642');s.ground(8,14,58,58,M3('gravel','#958a74'));
    s.box(14,22,0,48,52,14,st,st,{s:(g,L1,L2)=>{D3.door(g,L1/2-3,L2-7,6,7,'#3a2a20',{arch:1})}});
    s.cyl(31,37,11,14,32,b,M3('planks','#7a5a3a'),14,(g,L1,L2,i)=>{if(i%3===1)D3.win(g,L1/2-.8,5,1.6,3.4,{bars:0})});crenel3(s,21,27,41,47,32,b,2.6,2);
    s.box(30,46,30,32,52,32,M3('metal','#2a2a2a'),null);flag3(s,31,37,32,12,pc,6);render3(g,bx,by,s);return true}
  if(rep===7){const b=M3('brick','#8e4e3c');s.ground(8,14,58,58,M3('gravel','#8a8478'));
    s.box(18,24,0,44,48,30,b,null,{s:(g,L1,L2)=>{D3.door(g,L1/2-2.5,L2-7,5,7,'#2a2a28');for(const v of [6,15])D3.win(g,L1/2-3,v,6,2,{bars:0,frame:'#c8bea8'})}});
    s.box(14,20,30,48,52,32,M3('concrete','#9a968c'),M3('planks','#7a6448'));for(const [x,y] of [[14,20],[46.6,20],[14,50.6],[46.6,50.6]])s.box(x,y,32,x+1.4,y+1.4,37,M3('metal','#3a3a3a'),null);
    s.pyramid(31,36,36,34,37,6,M3('metal','#5a6058'),0);s.cyl(42,26,1.4,37,39,M3('metal','#888'),null,6);flag3(s,31,36,43,6,pc,5);render3(g,bx,by,s);return true}
  if(rep===8){const c=M3('concrete','#a8a49a');s.ground(8,14,58,58,M3('concrete','#9a9890'));
    s.box(16,24,0,46,50,9,c,c,{s:(g,L1,L2)=>{g.fillStyle='#1a1a1a';g.fillRect(4,3,L1-8,1.6);D3.door(g,L1-8,L2-6,4,6,'#4a4a44')}});
    s.cyl(31,36,8,9,34,c,c,12,(g,L1,L2,i)=>{if(i%3===0){g.fillStyle='#1a1a1a';g.fillRect(L1*.2,3,L1*.6,1.4)}});s.cyl(31,36,10,34,38,c,M3('concrete','#8a887e'),12,(g,L1,L2,i)=>{g.fillStyle='#141414';g.fillRect(L1*.1,1.2,L1*.8,1.4)});
    s.box(29,22,38,33,26,40,M3('metal','#3a3c38'),null);flag3(s,40,30,38,6,pc,5);
    for(let x=10;x<56;x+=2.4)s.box(x,56,0,x+.3,56.3,3.4,M3('metal','#3a3a3a'),null);render3(g,bx,by,s);return true}
  {const m=M3('metal','#8a9098');s.ground(8,14,58,58,M3('concrete','#a8a8a4'));
   s.box(18,26,0,44,48,8,M3('concrete','#d0ceca'),M3('concrete','#c0beb8'),{s:(g,L1,L2)=>{D3.win(g,3,2,L1-6,3,{bars:0,sill:0,frame:'#3a3a3a'})}});
   for(const [x,y] of [[24,30],[38,30],[24,44],[38,44]])s.box(x,y,8,x+1.2,y+1.2,40,m,null);for(let z=12;z<40;z+=7){s.box(24,30,z,39,31,z+.8,m,null);s.box(24,44,z,39,45,z+.8,m,null)}
   s.box(20,26,40,42,48,48,M3('glass','#2a4058'),M3('metal','#6a7078'));s.cyl(31,37,4.6,48,49,m,M3('flat','#e8e8ec'),10);s.box(30.6,36.6,49,31.4,37.4,56,m,null);
   s.quad([24,37,56],[38,37,56],[38,37,53],[24,37,53],M3('metal','#c8ccd2'),{ref:[31,30,54]});flag3(s,44,30,8,16,pc,5);render3(g,bx,by,s);return true}};
