(()=>{
'use strict';
// ================= constants =================
const T=32, W=72, H=72, DT=1/30;
const $=s=>document.querySelector(s);
const cv=$('#game'), ctx=cv.getContext('2d');
const mm=$('#minimap'), mctx=mm.getContext('2d');
const XY=window.EmpireXY;
const RES=XY.resources.list, RES_DE=XY.resources.label, RES_COL=XY.resources.color;
const EPOCHS=[],EPOCH_COST=[],EPOCH_TIME=[],ROOF=[],ROOF_HI=[],WALL=[];
let epStart=0,epEnd=99,timeLimit=0; // vom Startmenü gewählt (timeLimit in Minuten)
const MAXEP=()=>Math.min(EPOCHS.length-1,epEnd);
// cls = Gattung für Konter und Forschung, look = Grafikvorlage
const CLS=t=>(UNITS[t]&&UNITS[t].cls)||t,LOOK=t=>(UNITS[t]&&(UNITS[t].look||UNITS[t].cls))||t;
const TIER=[];const VIS=ep=>TIER[ep]!==undefined?TIER[ep]:Math.min(4,ep);
function syncRegistry(){
  XY.build();
  for(const a of [EPOCHS,EPOCH_COST,EPOCH_TIME,ROOF,ROOF_HI,WALL])a.length=0;
  XY.epochs.forEach((e,i)=>{EPOCHS.push(e.name);EPOCH_COST.push(i?e.cost:null);EPOCH_TIME.push(e.time||0);ROOF.push(e.roof||'#777');ROOF_HI.push(e.roofHi||e.roof||'#999');WALL.push(e.wall||'#999');TIER.push(e.tier!==undefined?e.tier:Math.min(4,i))});
  let slot=0;const used=new Set(Object.values(BLD).map(d=>d.slot).filter(x=>x!==undefined));
  for(const t in BLD)if(BLD[t].slot===undefined){while(used.has(slot)||slot===13||slot===14)slot++;BLD[t].slot=slot;used.add(slot)}
  trainCache={};SPR.clear();
}
let trainCache={};
const trainsOf=t=>trainCache[t]||(trainCache[t]=Object.keys(UNITS).filter(k=>UNITS[k].from===t));
const bname=(D,ep)=>{const n=D.names||[];for(let i=Math.min(ep,n.length-1);i>=0;i--)if(n[i])return n[i];return D.name};
const uname=(U,ep)=>{const n=U.names||[];for(let i=Math.min(ep,n.length-1);i>=0;i--)if(n[i])return n[i];return U.label};
const PCOL=['#4a8ae8','#d4473c','#4f9e48','#d9ad35'];
const PCOL_DK=['#2b5aa8','#8f2a23','#2e6a2a','#94721c'];
// Mehrspieler: ME = Spieler, aus dessen Sicht gerade gehandelt wird (beim Ausführen eines Netzbefehls kurz der Absender),
// LOCAL = Spieler an diesem Rechner, MP = Spielkonfiguration im Mehrspieler (sonst null), CMDX = Netzbefehl läuft gerade
let ME=0,LOCAL=0,MP=null,CMDX=false;
const uiRand=Math.random; // für reine Grafik-Effekte, damit der Zufall der Simulation unberührt bleibt
const FORMS=['keine','Schildwall','Keil','Schützenlinie'];
const SLOTKEYS=['Q','W','E','R','T','A','S','D','F','G','Y','X','C','V','B','U','I','O','M','J','K','L'];

const UNITS=XY.units, BLD=XY.buildings, RESDEF=XY.nodes, TECHS=XY.techs;
const DIFF=[
  {name:'Leicht',workers:12,gather:.75,firstAttack:480,wave:5,waveGrow:2,reserve:1.4,think:1.6},
  {name:'Normal',workers:18,gather:1,firstAttack:330,wave:7,waveGrow:3,reserve:1.1,think:1},
  {name:'Schwer',workers:26,gather:1.3,firstAttack:230,wave:9,waveGrow:4,reserve:1,think:.7},
];

// ================= rng & noise =================
let rng=Math.random;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeNoise(scale){
  const gw=Math.ceil(Math.max(W,H)/scale)+3, g=new Float32Array(gw*gw);
  for(let i=0;i<g.length;i++)g[i]=rng();
  const s=t=>t*t*(3-2*t);
  return (x,y)=>{const fx=x/scale,fy=y/scale,ix=fx|0,iy=fy|0,tx=s(fx-ix),ty=s(fy-iy);
    const a=g[iy*gw+ix],b=g[iy*gw+ix+1],c=g[(iy+1)*gw+ix],d=g[(iy+1)*gw+ix+1];
    return (a+(b-a)*tx)+((c+(d-c)*tx)-(a+(b-a)*tx))*ty;};
}

// ================= state =================
let ents,byId,nextId,block,gate,terr,vis,exp,proj,fx,players,gameT,sel,bases,diff,aiS,over,paused=false,started=false;
let stats;
const terrC=document.createElement('canvas'), terrMini=document.createElement('canvas'), fogC=document.createElement('canvas');
const surfC=[document.createElement('canvas'),document.createElement('canvas')];   // Brandungssäume, im Bild sanft pulsierend
fogC.width=W;fogC.height=H;const fogX=fogC.getContext('2d'),fogImg=fogX.createImageData(W,H);
terrMini.width=W;terrMini.height=H;
const cam={x:0,y:0,z:1};

function addEnt(e){e.id=nextId++;ents.push(e);byId.set(e.id,e);return e}
const idx=(x,y)=>y*W+x;
const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;

function addRes(type,x,y){
  if(!inb(x,y)||block[idx(x,y)]!==0||terr[idx(x,y)]===1)return null;
  const d=RESDEF[type];
  const r=addEnt({kind:'res',type,rt:d.rt,x,y,size:1,amount:d.amt,max:d.amt,v:rng(),owner:-1});
  block[idx(x,y)]=r.id;return r;
}
function clearRes(x,y){const i=idx(x,y),id=block[i];if(id>0){const e=byId.get(id);if(e&&e.kind==='res'){e.dead=true;block[i]=0}}}

let CUSTOM_MAP=null,useCustomMap=false;try{CUSTOM_MAP=JSON.parse(localStorage.getItem('empire-xy.karte')||'null')}catch(e){}
function applyCustomMap(M){
  for(let i=0;i<W*H;i++)terr[i]=M.terr[i]||0;
  bases=[{x:M.starts[0][0],y:M.starts[0][1]},{x:M.starts[1][0],y:M.starts[1][1]}];
  for(const b of bases)for(let y=b.y-1;y<b.y+5;y++)for(let x=b.x-1;x<b.x+5;x++)if(inb(x,y))terr[idx(x,y)]=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=idx(x,y);if(terr[i]===1||terr[i]===3){block[i]=-1;continue}
    if(terr[i]===0){let nearW=false;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const xx=x+ox,yy=y+oy;if(inb(xx,yy)&&terr[idx(xx,yy)]===1)nearW=true}if(nearW)terr[i]=2}}
  for(const [t,x,y] of M.res||[])if(inb(x,y)&&block[idx(x,y)]===0&&!bases.some(b=>x>=b.x-1&&x<b.x+5&&y>=b.y-1&&y<b.y+5))addRes(t,x,y);
}
function genMap(){
  terr.fill(0);block.fill(0);
  if(CUSTOM_MAP&&useCustomMap){applyCustomMap(CUSTOM_MAP);return}
  const lake=makeNoise(10),forest=makeNoise(6),det=makeNoise(3);
  // zwei Reiche diagonal gegenüber; im Mehrspieler mit 3 oder 4 Spielern zusätzlich die beiden anderen Ecken
  const NB=MP?MP.players.length:2;
  bases=[{x:9,y:H-12},{x:W-12,y:9},{x:9,y:9},{x:W-12,y:H-12}].slice(0,NB);
  const nearBase=(x,y,r)=>bases.some(b=>Math.hypot(x-b.x-1.5,y-b.y-1.5)<r);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const n=lake(x,y)*.8+det(x,y)*.2;
    if(n>.665&&!nearBase(x,y,15))terr[idx(x,y)]=1;
  }
  // guaranteed land bridge between the two capitals
  const c0={x:bases[0].x+1.5,y:bases[0].y+1.5},c1={x:bases[1].x+1.5,y:bases[1].y+1.5};
  for(let s=0;s<=1;s+=.004){const px=c0.x+(c1.x-c0.x)*s,py=c0.y+(c1.y-c0.y)*s+Math.sin(s*9)*4;
    for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const x=Math.round(px+ox),y=Math.round(py+oy);if(inb(x,y))terr[idx(x,y)]=0}}
  for(const b of bases.slice(2)){const c={x:b.x+1.5,y:b.y+1.5};
    for(let s=0;s<=1;s+=.004){const px=c.x+(W/2-c.x)*s,py=c.y+(H/2-c.y)*s+Math.sin(s*9)*3;
      for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const x=Math.round(px+ox),y=Math.round(py+oy);if(inb(x,y))terr[idx(x,y)]=0}}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=idx(x,y);if(terr[i]===1){block[i]=-1;continue}
    let nearW=false;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const xx=x+ox,yy=y+oy;if(inb(xx,yy)&&terr[idx(xx,yy)]===1)nearW=true}
    if(nearW)terr[i]=2;
  }
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    if(terr[idx(x,y)]===1||nearBase(x,y,8.5))continue;
    const edge=x<1||y<1||x>W-2||y>H-2;
    if(forest(x,y)>.64||rng()<.012||(edge&&rng()<.7))addRes('tree',x,y);
  }
  const cluster=(type,cx,cy,n)=>{
    cx=Math.round(cx);cy=Math.round(cy);const cand=[];
    for(let oy=-4;oy<=4;oy++)for(let ox=-4;ox<=4;ox++){const x=cx+ox,y=cy+oy;if(inb(x,y)&&x>0&&y>0&&x<W-1&&y<H-1&&terr[idx(x,y)]!==1)cand.push([Math.hypot(ox,oy)+rng()*.9,x,y])}
    cand.sort((a,b)=>a[0]-b[0]);let k=0;
    for(const [,x,y] of cand){if(k>=n)break;clearRes(x,y);if(block[idx(x,y)]===0){addRes(type,x,y);k++}}
  };
  const offs=[['berry',5,3,6],['gold',-4,-6,5],['stone',6,-5,4],['tree',-7,4,14],['berry',-6,-1,0]];
  bases.forEach(b=>{const sx=b.x<W/2?1:-1,sy=b.y>H/2?1:-1,cx=b.x+1.5,cy=b.y+1.5;
    for(const [t,ox,oy,n] of offs)if(n)cluster(t,cx+ox*sx,cy+oy*sy,n);
    cluster('tree',cx+9*sx,cy+7*sy,10);
  });
  for(let k=0;k<(NB>2?4:6);k++){
    let x,y,tries=0;
    do{x=6+rng()*(W-12);y=6+rng()*(H-12);tries++}while(tries<50&&(nearBase(x,y,16)||nearBase(W-1-x,H-1-y,16)));
    const t=k%2?'stone':'gold';cluster(t,x,y,5);cluster(t,W-1-x,H-1-y,5);
    if(NB>2){cluster(t,W-1-x,y,5);cluster(t,x,H-1-y,5)}
  }
  // remove leftover dead resources
  ents=ents.filter(e=>!e.dead);
}

// ================= terrain (rounded shores, depth-shaded water, grass mottling, relief light) =================
const mixC=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const sstep=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
function renderTerrain(){
  const PW=W*T,PH=H*T;terrC.width=PW;terrC.height=PH;const g=terrC.getContext('2d');
  const water=new Float32Array(W*H),deep=new Float32Array(W*H),worn=new Float32Array(W*H);
  for(let i=0;i<W*H;i++)water[i]=terr[i]===1?1:0;
  // weichgezeichnetes Wasserfeld für runde, natürliche Uferlinien (statt Treppenstufen)
  const wsm=new Float32Array(W*H);
  {const tmp=new Float32Array(W*H),K=[1,4,6,4,1];
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-2;k<=2;k++)s+=K[k+2]*water[idx(Math.min(W-1,Math.max(0,x+k)),y)];tmp[idx(x,y)]=s/16}
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;for(let k=-2;k<=2;k++)s+=K[k+2]*tmp[idx(x,Math.min(H-1,Math.max(0,y+k)))];wsm[idx(x,y)]=s/16}}
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    let s=0,n=0;for(let oy=-3;oy<=3;oy++)for(let ox=-3;ox<=3;ox++){const xx=Math.min(W-1,Math.max(0,x+ox)),yy=Math.min(H-1,Math.max(0,y+oy));s+=water[idx(xx,yy)];n++}
    deep[idx(x,y)]=s/n;
    let w=0;for(const b of bases){const d=Math.hypot(x-b.x-1.5,y-b.y-1.5);w=Math.max(w,1-sstep(3,7.5,d))}
    worn[idx(x,y)]=w;
  }
  const samp=(f,fx,fy)=>{fx=Math.max(0,Math.min(W-1.001,fx));fy=Math.max(0,Math.min(H-1.001,fy));const x=fx|0,y=fy|0,tx=fx-x,ty=fy-y,i=y*W+x;
    const a=f[i],b=f[i+1<W*H?i+1:i],c=f[i+W<W*H?i+W:i],d=f[i+W+1<W*H?i+W+1:i];return (a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty};
  const nA=makeNoise(7),nB=makeNoise(2.5),nH=makeNoise(13),nF=makeNoise(.9);
  const HS=2,RW=PW/HS|0,RH=PH/HS|0;               // compute at half resolution, upscale smoothly
  const half=document.createElement('canvas');half.width=RW;half.height=RH;const hg=half.getContext('2d');
  const img=hg.createImageData(RW,RH),D=img.data;
  const sI=surfC.map(c=>{c.width=RW;c.height=RH;return c.getContext('2d').createImageData(RW,RH)});
  const GA=[78,114,48],GB=[110,146,60],GD=[58,92,40],GY=[146,146,78],SA=[200,182,124],SB=[172,152,102],DIRT=[136,112,74],WS=[70,156,164],WD=[22,66,104];
  const mi=terrMini.getContext('2d'),mimg=mi.createImageData(W,H);
  for(let py=0;py<RH;py++){
    const fy=(py+.5)*HS/T-.5;
    for(let px=0;px<RW;px++){
      const fx=(px+.5)*HS/T-.5;
      const w=samp(water,fx,fy),a=nA(fx+.5,fy+.5),b=nB(fx+.5,fy+.5),f=nF(fx+.5,fy+.5);
      let c=mixC(GA,GB,a);
      c=mixC(c,GD,sstep(.55,.85,b)*.45);
      const hh=nH(fx+.5,fy+.5);c=mixC(c,GY,Math.max(0,hh-.62)*1.6);
      const wr=samp(worn,fx,fy)*(.75+.5*f);if(wr>.3)c=mixC(c,DIRT,sstep(.3,.9,wr)*.7);
      // relief light from the top-left
      const rel=(nH(fx+.2,fy+.2)-nH(fx+.8,fy+.8))*3.2+(f-.5)*.08;
      c=[c[0]*(1+rel),c[1]*(1+rel),c[2]*(1+rel)];
      // Ufer aus dem weichen Feld, mit Rauschen ausgefranst
      const ws=samp(wsm,fx,fy)+(b-.5)*.10+(f-.5)*.05;
      const sand=sstep(.10,.34,ws);
      if(sand>0)c=mixC(c,mixC(SA,SB,b),sand);
      const wet=sstep(.30,.44,ws);if(wet>0)c=mixC(c,mixC(c,[112,98,70],.55),wet);   // nasser, dunkler Sand am Wasser
      const wa=sstep(.43,.49,ws);
      if(wa>0){const dp=sstep(.35,.95,samp(deep,fx,fy));let wc=mixC(WS,WD,dp);wc=mixC(wc,[wc[0]+20,wc[1]+24,wc[2]+26],(b-.5)*.7);
        const shal=1-sstep(.46,.62,ws);wc=mixC(wc,[118,150,128],shal*.55);   // Flachwasser: Grund schimmert durch
        const foam=Math.max(0,1-Math.abs(ws-.475)/.022)*sstep(.35,.7,f)*.5;wc=mixC(wc,[214,226,220],foam*.5);c=mixC(c,wc,wa);
        // zwei Säume: Spülsaum direkt am Sand, auflaufende Welle etwas weiter draußen
        const o=(py*RW+px)*4,br=sstep(.3,.75,f)*(.6+.4*a);
        const s1=Math.max(0,1-Math.abs(ws-.468)/.018)*br,s2=Math.max(0,1-Math.abs(ws-.53)/.02)*br*.8;
        for(const [I,v] of [[sI[0],s1],[sI[1],s2]])if(v>0){I.data[o]=232;I.data[o+1]=240;I.data[o+2]=236;I.data[o+3]=v*200}}
      const o=(py*RW+px)*4;D[o]=c[0];D[o+1]=c[1];D[o+2]=c[2];D[o+3]=255;
    }
  }
  hg.putImageData(img,0,0);surfC.forEach((c,i)=>c.getContext('2d').putImageData(sI[i],0,0));
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(half,0,0,PW,PH);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=((Math.min(RH-1,((y+.5)*T/HS)|0))*RW+Math.min(RW-1,((x+.5)*T/HS)|0))*4,o=(y*W+x)*4;mimg.data[o]=D[p];mimg.data[o+1]=D[p+1];mimg.data[o+2]=D[p+2];mimg.data[o+3]=255}
  mi.putImageData(mimg,0,0);
  // fine grain
  const gr=document.createElement('canvas');gr.width=gr.height=96;const gg=gr.getContext('2d');
  for(let i=0;i<1600;i++){gg.fillStyle=rng()<.5?'rgba(255,255,230,.07)':'rgba(0,0,0,.08)';gg.fillRect(rng()*96|0,rng()*96|0,1,1)}
  g.fillStyle=g.createPattern(gr,'repeat');g.fillRect(0,0,PW,PH);
  // decor: grass blades, flowers, pebbles
  const isGrass=(x,y)=>{const tx=x/T|0,ty=y/T|0;return inb(tx,ty)&&terr[idx(tx,ty)]===0&&samp(water,x/T-.5,y/T-.5)<.08&&samp(worn,x/T-.5,y/T-.5)<.6};
  // Wiesenflecken: trockene, gelbliche Partien und sattere, dunkle Mulden mit weichem Rand
  for(let i=0;i<W*H*.12;i++){const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;const r=T*(.8+rng()*2.2),dry=rng()<.45;
    const rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,dry?'rgba(168,160,92,.20)':'rgba(30,58,24,.20)');rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.beginPath();g.ellipse(x,y,r,r*.7,rng()*3,0,7);g.fill()}
  // offene Erdstellen mit Kieseln
  for(let i=0;i<W*H*.025;i++){const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;const r=3+rng()*5;
    g.fillStyle='rgba(104,86,58,.45)';g.beginPath();g.ellipse(x,y,r,r*.6,rng()*3,0,7);g.fill();g.fillStyle='rgba(84,68,44,.4)';g.beginPath();g.ellipse(x+r*.2,y+r*.15,r*.6,r*.35,0,0,7);g.fill();
    for(let k=0;k<4;k++){const sx=x+(rng()-.5)*r*1.4,sy=y+(rng()-.5)*r*.8;g.fillStyle='rgba(150,142,126,.7)';g.beginPath();g.ellipse(sx,sy,.9,.6,0,0,7);g.fill();g.fillStyle='rgba(40,34,24,.35)';g.fillRect(sx-.4,sy+.5,1.2,.4)}}
  // Grasbüschel (Horste): dichte Halme, dunkler Fuß, helle Spitzen, kleiner Schatten
  g.lineCap='round';
  for(let i=0;i<W*H*1.1;i++){const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;const n=7+rng()*7|0,h=4+rng()*4,dry=rng()<.12;
    g.fillStyle='rgba(16,30,10,.28)';g.beginPath();g.ellipse(x+1.5,y+.6,3.4,1.1,0,0,7);g.fill();
    for(let k=0;k<n;k++){const a=(k/n-.5)*1.6+(rng()-.5)*.3,l=h*(.6+rng()*.5),ex=x+Math.sin(a)*l*.7,ey=y-Math.cos(a)*l;
      g.strokeStyle=dry?`rgba(${150+rng()*30|0},${140+rng()*25|0},${80+rng()*20|0},.75)`:`rgba(${54+rng()*30|0},${86+rng()*30|0},${34+rng()*14|0},.8)`;g.lineWidth=.8;g.beginPath();g.moveTo(x+(rng()-.5)*1.5,y);g.quadraticCurveTo(x+Math.sin(a)*l*.2,y-l*.6,ex,ey);g.stroke();
      if(k%3===0){g.strokeStyle=dry?'rgba(214,204,150,.55)':'rgba(170,196,104,.5)';g.lineWidth=.5;g.beginPath();g.moveTo(x+Math.sin(a)*l*.5,y-l*.75);g.lineTo(ex,ey);g.stroke()}}}
  g.lineCap='round';
  for(let i=0;i<W*H*9;i++){
    const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;
    const l=3+rng()*4,lean=(rng()-.5)*3;
    g.strokeStyle=rng()<.55?`rgba(${150+rng()*40|0},${185+rng()*30|0},${90+rng()*20|0},.45)`:'rgba(28,52,22,.35)';
    g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+lean*.3,y-l*.6,x+lean,y-l);g.stroke();
  }
  const FLOW=['#cfc27a','#d8d4c6','#a99cb4','#b98a78'];
  for(let i=0;i<W*H*.6;i++){const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;const c=FLOW[rng()*4|0];
    const show=(i%4)===0;for(let k=0;k<3;k++){const fx=x+(rng()-.5)*8,fy=y+(rng()-.5)*6;if(show){g.fillStyle=c;g.globalAlpha=.7;g.beginPath();g.arc(fx,fy,.9,0,7);g.fill();g.globalAlpha=1}}}
  for(let i=0;i<W*H*.8;i++){const x=rng()*PW,y=rng()*PH,tx=x/T|0,ty=y/T|0;if(!inb(tx,ty)||terr[idx(tx,ty)]===1)continue;
    if(terr[idx(tx,ty)]===2||samp(worn,x/T-.5,y/T-.5)>.5){g.fillStyle='rgba(90,80,64,.55)';g.beginPath();g.ellipse(x,y,1.6+rng()*1.4,1.1+rng(),0,0,7);g.fill();g.fillStyle='rgba(230,220,200,.35)';g.fillRect(x-1,y-1,1,1)}}
  g.lineCap='butt';
  // water: soft highlight ripples
  for(let i=0;i<W*H*2;i++){const x=rng()*PW,y=rng()*PH;if(samp(water,x/T-.5,y/T-.5)<.75)continue;
    g.strokeStyle='rgba(200,235,240,.16)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+5,y-2,x+10,y);g.stroke()}
  // Wüste und Gebirge (aus dem Karteneditor)
  for(let ty=0;ty<H;ty++)for(let tx=0;tx<W;tx++){const t=terr[idx(tx,ty)],x=tx*T,y=ty*T;
    if(t===4){g.fillStyle='rgba(206,182,124,.85)';g.fillRect(x,y,T,T);g.lineWidth=.8;for(let k=0;k<5;k++){const yy=y+3+k*6+rng()*2;g.strokeStyle='rgba(150,122,74,.35)';g.beginPath();g.moveTo(x,yy);g.quadraticCurveTo(x+T*.5,yy-2.5+rng(),x+T,yy);g.stroke();g.strokeStyle='rgba(240,224,180,.3)';g.beginPath();g.moveTo(x,yy-1);g.quadraticCurveTo(x+T*.5,yy-3.5,x+T,yy-1);g.stroke()}}
    else if(t===3){// Fels: Grundton mit Rauschen, Grate mit Licht- und Schattenflanke, Geröll, Schneereste in Mulden
      const v=(rng()-.5)*14;g.fillStyle=shade('#6c665d',v|0);g.fillRect(x,y,T,T);
      for(let k=0;k<3;k++){const cx=x+rng()*T,cy=y+rng()*T,len=8+rng()*14,ang=-.6+(rng()-.5)*.8;const ex=cx+Math.cos(ang)*len,ey=cy+Math.sin(ang)*len*.6;
        g.fillStyle='rgba(176,168,152,.55)';g.beginPath();g.moveTo(cx,cy);g.lineTo(ex,ey);g.lineTo(ex-2,ey-4);g.lineTo(cx-3,cy-5);g.closePath();g.fill();
        g.fillStyle='rgba(30,26,22,.4)';g.beginPath();g.moveTo(cx,cy);g.lineTo(ex,ey);g.lineTo(ex+1,ey+4);g.lineTo(cx+1,cy+5);g.closePath();g.fill()}
      for(let k=0;k<6;k++){const sx=x+rng()*T,sy=y+rng()*T,r=.8+rng()*1.6;g.fillStyle='rgba(150,142,128,.8)';g.beginPath();g.ellipse(sx,sy,r,r*.7,0,0,7);g.fill();g.fillStyle='rgba(20,18,14,.35)';g.fillRect(sx-r*.6,sy+r*.5,r*1.2,.5)}
      if(rng()<.35){g.fillStyle='rgba(232,236,238,.65)';g.beginPath();g.ellipse(x+rng()*T,y+rng()*T*.6,3+rng()*4,1.5+rng()*1.5,-.3,0,7);g.fill()}}}
  {// Schilf und Kies an Uferkanten: Landfelder neben Wasser bekommen Halme und nasse Kanten
    const g=terrC.getContext('2d');let sd=77;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;
    for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){if(terr[idx(x,y)]===1)continue;
      const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([a,b])=>terr[idx(x+a,y+b)]===1);if(!nb.length)continue;
      rr();
      if(rr()<.55){const [a,b]=nb[0];for(let k=0;k<7;k++){const bx=(x+.5+a*.3)*T+(rr()-.5)*T*(b?1:.4),byy=(y+.5+b*.3)*T+(rr()-.5)*T*(a?1:.4),h=5+rr()*7;
        g.strokeStyle=rr()<.5?'#5e6a3a':'#7a7a46';g.lineWidth=.9;g.beginPath();g.moveTo(bx,byy);g.quadraticCurveTo(bx+1,byy-h*.6,bx+(rr()-.3)*3,byy-h);g.stroke();
        if(rr()<.25){g.fillStyle='#5a4128';g.fillRect(bx-.8+(rr()-.5)*2,byy-h-3,1.6,3.5)}}}}}
  grade(terrC,.78,8,13);
}

function newPlayer(i,ai){return{i,ai,techs:{},fx:{gather:{},atk:{},hp:{},speed:{},range:{},carry:0,build:0,bldHp:0,bldAtk:0},res:{food:200,wood:200,stone:150,gold:100},epoch:0,pop:0,cap:0,advancing:false,wonderT:-1,defeated:false,
  st:{trained:0,lost:0,killed:0,gathered:0,built:0}}}

// mp (nur Mehrspieler): {me, players:[{name,civ}], epStart, epEnd, timeLimit}
function newGame(d,seed,mp){
  MP=mp||null;LOCAL=ME=MP?MP.me:0;svis=[];
  if(MP){epStart=MP.epStart||0;epEnd=MP.epEnd!=null?MP.epEnd:99;timeLimit=MP.timeLimit||0;useCustomMap=false;gameSpeed=1;paused=false}
  // Zeitgeber zurücksetzen, damit alle Rechner im Mehrspieler im selben Takt rechnen
  aiTimer=0;popT=0;pathT=0;visT=0;SEASON=0;lastAlarm=-99;
  syncRegistry();
  rng=mulberry32(seed);diff=d;curSeed=seed;
  ents=[];corpses=[];byId=new Map();nextId=1;block=new Int32Array(W*H);gate=new Uint8Array(W*H);terr=new Uint8Array(W*H);vis=new Uint8Array(W*H);exp=new Uint8Array(W*H);
  proj=[];fx=[];sel=[];gameT=0;over=false;placing=null;aMode=false;groups={};
  players=MP?MP.players.map((p,i)=>Object.assign(newPlayer(i,!!p.ai),{name:p.name},p.ai?{aiDiff:Math.max(0,Math.min(2,p.diff|0)),aiT:0}:{})):[newPlayer(0,false),newPlayer(1,true)];
  genMap();renderTerrain();
  bases.forEach((b,p)=>{
    const tc=placeBld(p,'tc',b.x,b.y,true);
    for(let k=0;k<4;k++){const s=freeAround(tc);if(s)spawnUnit(p,'worker',s.x+.5,s.y+.5)}
    const s=freeAround(tc);if(s)spawnUnit(p,'infantry',s.x+.5,s.y+.5);
  });
  epStart=Math.min(epStart,MAXEP());
  if(epStart>0)for(const pl of players){pl.epoch=epStart;for(const k in pl.res)pl.res[k]=Math.round(pl.res[k]*(1+epStart*.7))}
  aiS={t:0,nextAttack:DIFF[d].firstAttack,wave:DIFF[d].wave,attacking:false,lastDef:0};
  // Mehrspieler: jeder KI-Platz hat eigenen Zustand und eigene Schwierigkeit
  for(const pl of players)if(MP&&pl.ai){const D=DIFF[pl.aiDiff];pl.aiS={t:0,nextAttack:D.firstAttack,wave:D.wave,attacking:false,lastDef:0}}
  WX={kind:'sun',until:150,speed:1,night:0};
  // Völker mit eigenen Boni (wie in Age of Empires 2); der Gegner zieht ein zufälliges anderes Volk
  if(MP)players.forEach((pl,i)=>{pl.civ=CIVS[MP.players[i].civ]?MP.players[i].civ:'roemer'});
  else{players[0].civ=chosenCiv;const others=Object.keys(CIVS).filter(k=>k!==chosenCiv);players[1].civ=others[(rng()*others.length)|0]}
  for(const pl of players)CIVS[pl.civ].apply(pl.fx);
  recalcPop();updateVis(true);if(MP)simVis();
  XY.emit('start',API);
  const tc=ents.find(e=>e.type==='tc'&&e.owner===ME);centerOn(tc.x+1.5,tc.y+1.5);
  select([tc]);
  toast('Dein Volk erwacht in der '+EPOCHS[players[ME].epoch]+'. Sammle Nahrung und Holz.', 'good');
  if(MP)toast('Du führst die '+CIVS[players[ME].civ].name+' ('+CIVS[players[ME].civ].bonus+'). Gegner: '+players.filter(p=>p.i!==ME).map(p=>p.name+' ('+CIVS[p.civ].name+')').join(', ')+'.');
  else toast('Du führst die '+CIVS[players[0].civ].name+' ('+CIVS[players[0].civ].bonus+'). Gegner: '+CIVS[players[1].civ].name+'.');
}

// ================= entities =================
// Wetter und Tageszeit: Sonne, Regen (−20 % Tempo), Schnee (−10 %); ein Tag dauert 8 Minuten, nachts sinkt die Sicht
let WX={kind:'sun',until:150,speed:1,night:0};
const WXN={sun:'Sonnenschein',rain:'Regen: alle Truppen 10 % langsamer',snow:'Schneefall: Bewegung halbiert',storm:'Sturm: keine Schiffe aus den Häfen'};
const SEAS=['Frühling','Sommer','Herbst','Winter'],SEAS_I=['🌱','☀','🍂','❄'],SEAS_D=['Nahrung +30 %','Bauen +20 %','Holz +25 %','Produktion −20 %, Bewegung −30 %'];let SEASON=0;
function weatherTick(){
  {const sn=Math.floor(gameT/180)%4;if(sn!==SEASON){SEASON=sn;if(started)toast(SEAS[sn]+' beginnt: '+SEAS_D[sn]+'.');if(sn===3){WX.kind='snow';WX.speed=.5;WX.until=gameT+180}else if(WX.kind==='snow'){WX.until=gameT}}}
  {const ph=gameT%240;WX.night=ph<120?Math.max(0,Math.min(1,(ph-117)/3)):Math.max(0,Math.min(1,(237-ph)/3));const n=WX.night>.5;if(started&&n!==WX.wasN){WX.wasN=n;toast(n?'Die Nacht bricht herein: −20 % Angriff, Bogenschützen sehen nichts.':'Der Tag bricht an.')}}// alle 120 s Tag/Nacht
  if(gameT>=WX.until){const r=rng(),ep=players[0].epoch,old=WX.kind;WX.kind=SEASON===3?'snow':r<.12?'storm':r<.6?'sun':r<.85&&ep<=4?'rain':ep<=4?'rain':'sun';WX.until=gameT+90+rng()*150;
    WX.speed=WX.kind==='rain'?.9:WX.kind==='snow'?.5:1;if(started&&old!==WX.kind)toast(WXN[WX.kind]+'.')}
}
function uStat(u){const d=UNITS[u.type],pl=players[u.owner],f=pl.fx,t=CLS(u.type),e=pl.epoch,m=1+.17*e;return{hp:Math.round(d.hp*m*(1+(f.hp[t]||0))),atk:d.atk*m*(1+(f.atk[t]||0)),range:(d.range+(f.range[t]||0))*(u.form===3?1.4:1),rate:d.rate,speed:d.speed*(1+.03*e)*(1+(f.speed[t]||0))*(d.naval?1:WX.speed)*(u.rallyUntil>gameT?1.2:1)*(u.form===1?.5:u.form===3?.02:1),sight:Math.max(2,d.sight-WX.night*2)}}
function spawnUnit(p,type,x,y){
  const d=UNITS[type];
  const u=addEnt({kind:'unit',type,owner:p,x,y,r:d.r,hp:0,cd:0,ang:[-Math.PI*.25,Math.PI*.75,Math.PI*.25,-Math.PI*.75][p]??0,order:{t:'idle'},path:null,pathCD:0,carry:0,ct:null,scan:rng()*.5,anim:rng()*6});
  u.hp=uStat(u).hp;u.maxhp=u.hp;return u;
}
function placeBld(p,type,x,y,done){
  const d=BLD[type];
  const b=addEnt({kind:'bld',type,owner:p,x,y,size:d.size,built:!!done,prog:done?1:0,hp:done?Math.round(d.hp*(1+players[p].fx.bldHp)):1,maxhp:Math.round(d.hp*(1+players[p].fx.bldHp)),queue:[],rally:null,cd:0,seen:p===LOCAL});
  if(!d.walk)for(let yy=y;yy<y+d.size;yy++)for(let xx=x;xx<x+d.size;xx++){block[idx(xx,yy)]=b.id;if(d.gate)gate[idx(xx,yy)]=p+1}
  // push units out of the footprint
  for(const u of ents)if(u.kind==='unit'&&!d.walk&&u.x>=x&&u.x<x+d.size&&u.y>=y&&u.y<y+d.size){const s=freeAround(b);if(s){u.x=s.x+.5;u.y=s.y+.5;u.path=null}}
  return b;
}
function canPlace(p,type,x,y){
  const d=BLD[type];
  if(x<1||y<1||x+d.size>W-1||y+d.size>H-1)return false;
  if(d.unique&&ents.some(e=>e.type===type&&!e.dead&&e.owner===p))return false;if(d.maxEpoch!=null&&players[p].epoch>d.maxEpoch)return false;
  if(d.monument&&ents.some(e=>e.type===type&&!e.dead&&(e.mep??players[e.owner].epoch)===players[p].epoch))return false;
  if(d.water){const i=idx(x,y);if(terr[i]!==1||block[i]!==-1||(p===ME&&!CMDX&&!exp[i]))return false;for(const e of ents)if(e.type==='bridge'&&!e.dead&&e.x===x&&e.y===y)return false;return true}
  for(let yy=y;yy<y+d.size;yy++)for(let xx=x;xx<x+d.size;xx++){
    const i=idx(xx,yy);if(block[i]!==0||terr[i]===1)return false;
    if(p===ME&&!CMDX&&!exp[i])return false;
    for(const e of ents)if(e.kind==='bld'&&BLD[e.type].walk&&!e.dead&&xx>=e.x&&xx<e.x+e.size&&yy>=e.y&&yy<e.y+e.size)return false;
  }
  if(d.shore){let w=0;for(let yy=y-1;yy<=y+d.size;yy++)for(let xx=x-1;xx<=x+d.size;xx++)if(inb(xx,yy)&&terr[idx(xx,yy)]===1)w++;if(w<2)return false}
  return true;
}
function freeAround(b,pref,naval){
  const s=b.size;
  for(let r=1;r<8;r++){
    const cand=[];
    for(let y=b.y-r;y<b.y+s+r;y++)for(let x=b.x-r;x<b.x+s+r;x++){
      if(x>b.x-r&&x<b.x+s+r-1&&y>b.y-r&&y<b.y+s+r-1)continue;
      if(inb(x,y)&&(naval?terr[idx(x,y)]===1:block[idx(x,y)]===0))cand.push({x,y,d:pref?Math.hypot(x-pref.x,y-pref.y):(y<b.y+s?2:0)+rng()});
    }
    if(cand.length){cand.sort((a,b)=>a.d-b.d);return cand[0]}
  }
  return null;
}
const isMil=u=>u.kind==='unit'&&u.type!=='worker'&&!(UNITS[u.type]&&UNITS[u.type].civil);
const alive=e=>e&&!e.dead;
function canAfford(p,c){for(const k in c)if(players[p].res[k]<c[k])return false;return true}
function pay(p,c){for(const k in c)players[p].res[k]-=c[k]}
// Einkommen je Rohstoff der letzten 60 Sekunden (für die Anzeige oben)
function resCap(pl){let n=0;for(const e of ents)if(e.type==='warehouse'&&e.owner===pl.i&&e.built&&!e.dead)n++;return 1000+500*n}
function income(pl,r,v){(pl.tot=pl.tot||{})[r]=(pl.tot[r]||0)+v;(pl.inc=pl.inc||[]).push([gameT,r,v])}
function incomeRate(pl,r){if(!pl.inc)return 0;while(pl.inc.length&&pl.inc[0][0]<gameT-60)pl.inc.shift();let s=0;for(const x of pl.inc)if(x[1]===r)s+=x[2];return Math.round(s*60/Math.min(60,Math.max(10,gameT)))}
function refund(p,c){for(const k in c)players[p].res[k]+=c[k]}
function costOf(type){return UNITS[type]?UNITS[type].cost:BLD[type].cost}

function recalcPop(){
  for(const pl of players){pl.pop=0;pl.cap=0}
  for(const e of ents){if(e.dead)continue;
    if(e.kind==='unit'){players[e.owner].pop+=UNITS[e.type].pop;if(e.cargo)for(const c of e.cargo)players[e.owner].pop+=(UNITS[c.type]||{pop:1}).pop}
    else if(e.kind==='bld'&&e.built&&BLD[e.type].pop)players[e.owner].cap+=BLD[e.type].pop;
    if(e.kind==='bld')for(const q of e.queue)if(q.started&&q.u)players[e.owner].pop+=UNITS[q.u].pop;
  }
  for(const pl of players)pl.cap=Math.min(200,pl.cap);
}

// ================= geometry =================
function distEnt(u,t){
  if(t.kind==='unit')return Math.hypot(t.x-u.x,t.y-u.y)-t.r-u.r;
  const cx=Math.max(t.x,Math.min(u.x,t.x+t.size)),cy=Math.max(t.y,Math.min(u.y,t.y+t.size));
  return Math.hypot(u.x-cx,u.y-cy)-u.r;
}
function center(e){return e.kind==='unit'?{x:e.x,y:e.y}:{x:e.x+e.size/2,y:e.y+e.size/2}}

// ================= pathfinding =================
const gS=new Float32Array(W*H),from=new Int32Array(W*H),stamp=new Uint32Array(W*H),cls=new Uint32Array(W*H);let gen=0;
const hp_i=[],hp_f=[];
function hpush(i,f){hp_i.push(i);hp_f.push(f);let c=hp_i.length-1;while(c>0){const p=(c-1)>>1;if(hp_f[p]<=hp_f[c])break;[hp_i[p],hp_i[c]]=[hp_i[c],hp_i[p]];[hp_f[p],hp_f[c]]=[hp_f[c],hp_f[p]];c=p}}
function hpop(){const top=hp_i[0],li=hp_i.pop(),lf=hp_f.pop();if(hp_i.length){hp_i[0]=li;hp_f[0]=lf;let c=0;for(;;){const l=c*2+1,r=l+1;let m=c;if(l<hp_i.length&&hp_f[l]<hp_f[m])m=l;if(r<hp_i.length&&hp_f[r]<hp_f[m])m=r;if(m===c)break;[hp_i[m],hp_i[c]]=[hp_i[c],hp_i[m]];[hp_f[m],hp_f[c]]=[hp_f[c],hp_f[m]];c=m}}return top}
const DIRS=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
// Tore: für den Besitzer begehbar, für alle anderen Mauer. passOwner = wer gerade läuft
let passOwner=-1,passNaval=false,passAir=false;
const pass=(x,y)=>{if(!inb(x,y))return false;if(passAir)return true;const i=idx(x,y),b=block[i];if(passNaval)return terr[i]===1;return b===0||(b>0&&gate[i]===passOwner+1&&passOwner>=0)};
function findPath(sx,sy,goal,hx,hy,maxN){
  gen++;hp_i.length=0;hp_f.length=0;
  const s=idx(sx,sy);gS[s]=0;stamp[s]=gen;from[s]=-1;
  const h=(x,y)=>{const dx=Math.abs(x-hx),dy=Math.abs(y-hy);return Math.max(dx,dy)+.414*Math.min(dx,dy)};
  hpush(s,h(sx,sy));let best=s,bestH=1e9,n=0,found=-1;
  while(hp_i.length){
    const c=hpop();if(cls[c]===gen)continue;cls[c]=gen;
    const cx=c%W,cy=(c/W)|0;
    if(goal(cx,cy)){found=c;break}
    const hh=h(cx,cy);if(hh<bestH){bestH=hh;best=c}
    if(++n>(maxN||2600))break;
    for(const [dx,dy,cost] of DIRS){
      const nx=cx+dx,ny=cy+dy;if(!pass(nx,ny))continue;
      if(dx&&dy&&(!pass(cx+dx,cy)||!pass(cx,cy+dy)))continue;
      const ni=idx(nx,ny),ng=gS[c]+cost;
      if(stamp[ni]!==gen||ng<gS[ni]){stamp[ni]=gen;gS[ni]=ng;from[ni]=c;cls[ni]=0;hpush(ni,ng+h(nx,ny))}
    }
  }
  let c=found>=0?found:best;const path=[];
  while(c!==-1&&c!==s){path.push(c);c=from[c]}
  path.reverse();return path;
}
// line of sight for a unit of radius r between two points (no corner cutting through blocked tiles)
function clearLine(ax,ay,bx,by,r){
  const dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);if(L<.01)return true;
  const nx=-dy/L*r,ny=dx/L*r,n=Math.ceil(L/.2);
  for(let i=1;i<=n;i++){const x=ax+dx*i/n,y=ay+dy*i/n;
    if(!pass(Math.floor(x),Math.floor(y))||!pass(Math.floor(x+nx),Math.floor(y+ny))||!pass(Math.floor(x-nx),Math.floor(y-ny)))return false}
  return true;
}
// string-pulling: drop waypoints that can be skipped in a straight line
function smoothPath(u,path){
  if(path.length<3)return path;
  const out=[],c=i=>({x:path[i]%W+.5,y:(path[i]/W|0)+.5});let cx=u.x,cy=u.y,i=0;
  while(i<path.length){
    let j=Math.min(path.length-1,i+14);
    while(j>i){const p=c(j);if(clearLine(cx,cy,p.x,p.y,u.r*.9))break;j--}
    out.push(path[j]);const p=c(j);cx=p.x;cy=p.y;i=j+1;
  }
  return out;
}
function pathToPoint(u,tx,ty){
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;passAir=!!UNITS[u.type].air;
  const gx=Math.floor(tx),gy=Math.floor(ty);const ok=pass(gx,gy);
  u.path=smoothPath(u,findPath(Math.floor(u.x),Math.floor(u.y),(x,y)=>ok?(x===gx&&y===gy):Math.abs(x-gx)<=1&&Math.abs(y-gy)<=1,gx,gy));
  u.goal=ok?{x:tx,y:ty}:null;
}
function pathToEnt(u,t){
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;passAir=!!UNITS[u.type].air;
  const c=center(t);
  let goal;
  if(t.kind==='unit'){const gx=Math.floor(t.x),gy=Math.floor(t.y);goal=(x,y)=>Math.abs(x-gx)<=1&&Math.abs(y-gy)<=1}
  else goal=(x,y)=>x>=t.x-1&&x<=t.x+t.size&&y>=t.y-1&&y<=t.y+t.size;
  u.path=smoothPath(u,findPath(Math.floor(u.x),Math.floor(u.y),goal,Math.floor(c.x),Math.floor(c.y)));
  u.goal=null;u.pathFor=t.id;
}
// returns true when path is finished
// turn toward the heading and accelerate; returns the distance this unit may travel this tick
function drive(u,dx,dy,dt){
  const want=Math.atan2(dy,dx);let diff=want-u.ang;while(diff>Math.PI)diff-=Math.PI*2;while(diff<-Math.PI)diff+=Math.PI*2;
  const heavy=u.type==='cavalry'||u.type==='siege'||UNITS[u.type].pop>1;
  const turn=(heavy?5:11)*dt;u.ang+=Math.max(-turn,Math.min(turn,diff));
  u.v=Math.min(1,(u.v||.3)+dt*(heavy?1.6:3.5));
  return uStat(u).speed*dt*u.v*Math.max(.25,Math.cos(Math.min(Math.PI/2,Math.abs(diff))));
}
function follow(u,dt){
  if(u.path&&u.path.length){
    const ni=u.path[0];
    if(!pass(ni%W,ni/W|0)){u.path=null;u.pathCD=0;return false}
    let tx=ni%W+.5,ty=(ni/W|0)+.5;
    if(u.path.length===1&&u.goal){tx=u.goal.x;ty=u.goal.y}
    const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy),sp=drive(u,dx,dy,dt);
    if(d<=sp||(u.path.length>1&&d<.42)){if(d<=sp){u.x=tx;u.y=ty}u.path.shift()}
    else{const nx=u.x+dx/d*sp,ny=u.y+dy/d*sp;
      if(!pass(Math.floor(nx),Math.floor(ny))&&pass(Math.floor(u.x),Math.floor(u.y))){u.path=null;u.pathCD=0;return false}
      u.x=nx;u.y=ny}
    u.moving=true;
    return !u.path.length;
  }
  return true;
}
function steer(u,tx,ty,dt){
  const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);if(d<.01)return;const sp=drive(u,dx,dy,dt);
  const nx=u.x+dx/d*Math.min(sp,d),ny=u.y+dy/d*Math.min(sp,d);
  if(pass(Math.floor(nx),Math.floor(ny))||!pass(Math.floor(u.x),Math.floor(u.y))){u.x=nx;u.y=ny;u.moving=true}
}
// move unit toward entity t; handles repathing
function approach(u,t,dt){
  u.pathCD-=dt;
  const c=center(t),dd=Math.hypot(c.x-u.x,c.y-u.y);
  if(t.kind==='unit'&&dd<2.2){u.path=null;steer(u,t.x,t.y,dt);return}
  if((!u.path||u.pathFor!==t.id||(t.kind==='unit'&&u.pathCD<=0))&&u.pathCD<=0){pathToEnt(u,t);u.pathCD=t.kind==='unit'?1:.6}
  if(u.path&&u.path.length)follow(u,dt);
  else steer(u,c.x,c.y,dt);
}

// ================= orders =================
function order(u,o){u.order=o;u.path=null;u.pathCD=0;u.pathFor=0}
function nextWp(u){if(u.wq&&u.wq.length){const w=u.wq.shift();order(u,{t:w.a?'amove':'move',x:w.x,y:w.y});pathToPoint(u,w.x,w.y)}}
let shiftHeld=false;addEventListener('keydown',e=>{if(e.key==='Shift')shiftHeld=true});addEventListener('keyup',e=>{if(e.key==='Shift')shiftHeld=false});addEventListener('blur',()=>shiftHeld=false);
function cmdMove(units,wx,wy,amove){
  const n=units.length,cols=Math.ceil(Math.sqrt(n));let k=0;
  const sorted=[...units].sort((a,b)=>Math.hypot(a.x-wx,a.y-wy)-Math.hypot(b.x-wx,b.y-wy));
  for(const u of sorted){
    let tx=wx,ty=wy;
    if(n>1){const cx=k%cols-(cols-1)/2,cy=Math.floor(k/cols)-(Math.ceil(n/cols)-1)/2;tx=wx+cx*.8;ty=wy+cy*.8;passNaval=!!UNITS[u.type].naval;passAir=!!UNITS[u.type].air;if(!pass(Math.floor(tx),Math.floor(ty))){tx=wx;ty=wy}}
    k++;
    order(u,{t:amove?'amove':'move',x:tx,y:ty});pathToPoint(u,tx,ty);
  }
}
function cmdTarget(units,t,force){
  let moved=[];
  for(const u of units){
    if(t.kind==='res'){if(u.type==='worker')order(u,{t:'gather',target:t.id,rt:t.rt});else moved.push(u)}
    else if(t.owner!==u.owner&&t.owner>=0&&aiS&&aiS.allied){if(u.owner===0)toast('Verbündete kann man nicht angreifen.','warn')}
    else if(t.owner!==u.owner&&t.owner>=0)order(u,{t:'attack',target:t.id,forced:true});
    else if(t.kind==='bld'&&t.owner===u.owner&&u.type==='worker'){
      if(!t.built)order(u,{t:'build',target:t.id});
      else if(t.type==='farm')order(u,{t:'gather',target:t.id,rt:'food'});
      else if(BLD[t.type].drop&&u.carry>0)order(u,{t:'return',resume:null,drop:t.id});
      else if(t.hp<t.maxhp)order(u,{t:'build',target:t.id});
      else moved.push(u);
    }else moved.push(u);
  }
  if(moved.length){const c=center(t);cmdMove(moved,c.x,c.y,false)}
}

function nearestRes(rt,x,y,maxD,owner){
  let best=null,bd=maxD||1e9;
  for(const e of ents){
    if(e.dead)continue;
    let ok=false;
    if(e.kind==='res'&&e.rt===rt)ok=true;
    else if(rt==='food'&&e.kind==='bld'&&e.type==='farm'&&e.owner===owner&&e.built&&!farmTaken(e))ok=true;
    if(!ok)continue;
    const d=Math.hypot(e.x+.5-x,e.y+.5-y);if(d<bd){bd=d;best=e}
  }
  return best;
}
function farmTaken(f,except){return ents.some(u=>u.kind==='unit'&&!u.dead&&u!==except&&u.order.t==='gather'&&u.order.target===f.id)}
function nearestDrop(p,x,y){
  let best=null,bd=1e9;
  for(const e of ents)if(e.kind==='bld'&&e.owner===p&&e.built&&!e.dead&&BLD[e.type].drop){const c=center(e),d=Math.hypot(c.x-x,c.y-y);if(d<bd){bd=d;best=e}}
  return best;
}
// Flugzeuge treffen nur Fernkämpfer, Flak, Schiffe, Türme und andere Flugzeuge, keine Granaten und keine Nahkämpfer
const isAir=e=>!!(e&&e.kind==='unit'&&UNITS[e.type]&&UNITS[e.type].air);
function canHit(u,t){if(!isAir(t))return true;if(u.kind!=='unit')return true;const D=UNITS[u.type];if(!D)return false;if(D.air||D.aa)return true;return D.proj===1&&D.range>=2}
function enemyNear(u,radius,wantBld){
  let best=null,bd=radius;
  for(const e of ents){
    if(e.dead||e.owner<0||e.owner===u.owner||aiS&&aiS.allied||e.kind==='unit'&&hidden(e)&&Math.hypot(e.x-u.x,e.y-u.y)>2.5)continue;
    if(e.kind==='res')continue;
    if(e.kind==='bld'&&!wantBld)continue;
    if(!canHit(u,e))continue;
    if(!players[u.owner].ai&&e.kind==='unit'&&!pvis(u.owner)[idx(e.x|0,e.y|0)])continue;
    let d=distEnt(u,e);if(e.kind==='bld')d+=2;else if(e.type==='worker')d+=1;
    if(d<bd){bd=d;best=e}
  }
  return best;
}

// ================= combat =================
const vetRank=u=>(u.kills||0)>=5?2:(u.kills||0)>=2?1:0,vetMul=u=>u&&u.rank?(u.rank===2?1.15:1.05):1;
function damage(t,dmg,src){if(src&&src.kind==='unit'&&WX.night>.5)dmg*=.8;if(src&&aiS&&aiS.allied&&src.owner>=0&&t.owner>=0&&src.owner!==t.owner)return;
  if(t.dead)return;
  if(src&&src.buffUntil>gameT)dmg*=1.2;if(src&&src.templeT>gameT)dmg*=1.1;if(src&&src.form===2)dmg*=1.3;if(src&&src.owner>=0&&players[src.owner]&&players[src.owner].templar&&(src.type==='knight'||CLS(src.type)==='cavalry'))dmg*=1.3;if(t.form===1)dmg*=UNITS[t.type]&&UNITS[t.type].shield?.5:.7;if(src&&src.owner>=0&&players[src.owner]&&players[src.owner].raceUntil>gameT)dmg*=1.1;if(t.campT>gameT)dmg*=.6;else if(t.form===2)dmg*=1.2;if(src&&src.owner!=null&&players[src.owner]&&players[src.owner].monAtk)dmg*=1+players[src.owner].monAtk;if(src&&src.kind==='unit'&&t.kind==='unit'&&t.hp>0&&t.hp<=dmg*vetMul(src)){src.kills=(src.kills||0)+1;const r=vetRank(src);if(r>(src.rank||0)){src.rank=r;if(src.type!=='hero'){src.maxhp=Math.round(src.maxhp*(r===1?1.05:1.1));if(src.owner===ME&&r===2)toast(uname(UNITS[src.type],players[ME].epoch)+' ist jetzt ein Veteran.','good')}}}
  if(src)dmg*=vetMul(src);if(t.rank)dmg/=t.rank===2?1.15:1.05;if(src&&src.vetAuraT>gameT&&!src.rank)dmg*=1.08;
  t.hp-=dmg;t.hitT=gameT;t.revealT=gameT+6;if(src)src.revealT=gameT+6;if(visibleEnt(t))sfx(dmg>20?'boom':src&&src.kind==='unit'&&uStat(src).range<1.5&&!['siege'].includes(CLS(src.type))?'sword':'hit');
  fx.push({x:center(t).x+(rng()-.5)*.4,y:center(t).y+(rng()-.5)*.4,t:0,k:'hit'});
  if(t.owner===ME&&gameT-lastAlarm>20&&src){lastAlarm=gameT;toast('Wir werden angegriffen!','warn');ping=center(t);pingT=3}
  if(t.kind==='unit'&&src&&!src.dead&&src.owner!==t.owner){
    if(isMil(t)&&!UNITS[t.type].stealth&&canHit(t,src)&&(t.order.t==='idle'||(t.order.t==='amove')))order(t,{t:'attack',target:src.id,resume:t.order.t==='amove'?t.order:null});
    else if(t.type==='worker'&&players[t.owner].ai)aiOf(t.owner).alarm={x:t.x,y:t.y,time:gameT};
  }
  if(t.kind==='bld'&&t.owner>=0&&players[t.owner].ai&&src)aiOf(t.owner).alarm={x:src.x,y:src.y,time:gameT};
  if(t.hp<=0)kill(t,src);
}
let lastAlarm=-99,ping=null,pingT=0;
let corpses=[];
function kill(e,src){
  e.dead=true;
  const mech=e.kind==='unit'&&UNITS[e.type]&&(UNITS[e.type].air||CLS(e.type)==='vehicle');
  if(mech){for(let k=0;k<5;k++)fx.push({x:e.x+(rng()-.5)*.6,y:e.y+(rng()-.5)*.6,t:-k*.12,k:k?'smoke':'boom'});if(e.cargo&&e.cargo.length)players[e.owner].st.lost+=e.cargo.length}
  if(e.kind==='unit'&&!mech&&!(UNITS[e.type]&&UNITS[e.type].naval)&&visibleEnt(e)){corpses.push(Object.assign({},e,{moving:false,swing:0,working:false,carry:0,dt0:gameT,fall:uiRand()<.5?1:-1}));if(corpses.length>60)corpses.shift()}
  if(e.kind==='bld'){
    if(BLD[e.type].water)block[idx(e.x,e.y)]=-1;
    if(!BLD[e.type].walk)for(let y=e.y;y<e.y+e.size;y++)for(let x=e.x;x<e.x+e.size;x++)if(block[idx(x,y)]===e.id){block[idx(x,y)]=0;gate[idx(x,y)]=0}
    for(const q of e.queue)if(q.u&&!q.started)refund(e.owner,q.cost||UNITS[q.u].cost);
    if(e.queue.some(q=>q.ep))players[e.owner].advancing=false;
    for(let k=0;k<6;k++)fx.push({x:e.x+rng()*e.size,y:e.y+rng()*e.size,t:-k*.1,k:'smoke'});
    if(e.type==='wonder')players[e.owner].wonderT=-1;
  }else if(e.kind==='res'){block[idx(e.x,e.y)]=0}
  else{fx.push({x:e.x,y:e.y,t:0,k:'die',c:PCOL[e.owner]})}
  if(e.owner>=0&&e.kind!=='res'){players[e.owner].st.lost++;if(src&&src.owner>=0)players[src.owner].st.killed++}
  recalcPop();
}
function hitDmg(ut,atk,t){
  const D=UNITS[ut]||{};let dmg=atk;
  if(t.kind==='unit'){if(D.bonus&&D.bonus[CLS(t.type)])dmg*=D.bonus[CLS(t.type)];if(D.vsUnit)dmg*=D.vsUnit}
  else dmg*=D.vsBld||(ut==='worker'?.3:.35);
  return dmg;
}
function attackTick(u,t,dt,st){
  const d=distEnt(u,t);
  if(d<=st.range+.05){
    u.path=null;const c=center(t);u.ang=Math.atan2(c.y-u.y,c.x-u.x);
    if(u.cd<=0&&WX.night>.5&&CLS(u.type)==='ranged'){u.cd=.5}
    else if(u.cd<=0){
      u.cd=st.rate;u.swing=.25;
      const D=UNITS[u.type],ep=players[u.owner].epoch;
      if(D.proj===2){ // ballistic shell: flies to where the target is now, splash on impact
        const sx=(rng()-.5)*.5,sy=(rng()-.5)*.5;
        proj.push({x:u.x,y:u.y,ground:true,tx:c.x+sx,ty:c.y+sy,tid:t.id,atk:st.atk,ut:u.type,owner:u.owner,src:u.id,k:'ball',ep,sp:7,arc:Math.hypot(c.x-u.x,c.y-u.y)});
      }else if(D.proj){
        const miss=t.kind==='unit'&&t.moving&&rng()<(ep>=5?.08:.18);
        proj.push({x:u.x,y:u.y,tid:t.id,dmg:hitDmg(u.type,st.atk,t),miss,src:u.id,k:'arrow',ep,sp:13,arc:Math.hypot(c.x-u.x,c.y-u.y)});
      }else damage(t,hitDmg(u.type,st.atk,t),u);
    }
    return true;
  }
  approach(u,t,dt);return false;
}

// ================= unit update =================
// Produktionskette: Mühlen in der Nähe machen Felder ergiebiger (Wert farmBoost am Gebäude)
function farmBoost(f){if(f.boostT>gameT)return f.boostV;let v=1;for(const e of ents)if(e.kind==='bld'&&e.built&&!e.dead&&e.owner===f.owner&&BLD[e.type].farmBoost&&Math.hypot(e.x-f.x,e.y-f.y)<8)v=Math.max(v,BLD[e.type].farmBoost);f.boostT=gameT+3;f.boostV=v;return v}
function updUnit(u,dt){
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;passAir=!!UNITS[u.type].air;
  const st=uStat(u);u.cd-=dt;u.swing=Math.max(0,(u.swing||0)-dt);if(!u.moving)u.v=Math.max(.3,(u.v||.3)-dt*3);u.moving=false;u.scan-=dt;
  const o=u.order;
  switch(o.t){
    case 'idle':{
      if(isMil(u)&&!UNITS[u.type].stealth&&u.scan<=0){u.scan=.5;const e=enemyNear(u,st.sight,u.type==='siege');if(e)order(u,{t:'attack',target:e.id,resume:{t:'guard',x:u.x,y:u.y}})}
      break;}
    case 'guard':{ // return to post after a skirmish
      if(u.scan<=0){u.scan=.5;const e=enemyNear(u,st.sight,u.type==='siege');if(e){order(u,{t:'attack',target:e.id,resume:{t:'guard',x:o.x,y:o.y}});break}}
      if(Math.hypot(o.x-u.x,o.y-u.y)<.6){u.order={t:'idle'};break}
      if(!u.path){if(u.pathCD<=0){pathToPoint(u,o.x,o.y);u.pathCD=1}else u.pathCD-=dt}
      if(follow(u,dt)&&u.path&&!u.path.length)u.order={t:'idle'};
      break;}
    case 'move':{
      if(!u.path){pathToPoint(u,o.x,o.y)}
      if(follow(u,dt)){u.path=null;u.order={t:'idle'};u.scan=.2;nextWp(u)}
      break;}
    case 'amove':{
      if(u.scan<=0){u.scan=.4;const e=enemyNear(u,st.sight,true);if(e){order(u,{t:'attack',target:e.id,resume:{t:'amove',x:o.x,y:o.y}});break}}
      if(!u.path){if(u.pathCD<=0){pathToPoint(u,o.x,o.y);u.pathCD=.8}else u.pathCD-=dt}
      if(u.path&&follow(u,dt)){u.path=null;if(Math.hypot(o.x-u.x,o.y-u.y)<1.5)u.order={t:'idle'}}
      break;}
    case 'attack':{
      const t=byId.get(o.target);
      if(!alive(t)||!canHit(u,t)||(!players[u.owner].ai&&t.kind==='unit'&&!pvis(u.owner)[idx(t.x|0,t.y|0)])){
        if(o.resume){const r=o.resume;order(u,r)}else{order(u,{t:'idle'});u.scan=0}break}
      // chasing too far without a forced order: give up
      if(!o.forced&&o.resume&&o.resume.x!==undefined&&Math.hypot(u.x-o.resume.x,u.y-o.resume.y)>14){order(u,o.resume);break}
      // re-evaluate: prefer units over buildings when idle-triggered
      if(t.kind==='bld'&&!o.forced&&u.scan<=0){u.scan=.6;const e=enemyNear(u,st.sight,false);if(e){o.target=e.id;u.path=null;break}}
      attackTick(u,t,dt,st);
      break;}
    case 'gather':{
      let r=byId.get(o.target);
      if(!alive(r)||(r.kind==='bld'&&r.owner!==u.owner)){
        const ref=r||u;r=nearestRes(o.rt,ref.x,ref.y,10,u.owner);
        if(r){o.target=r.id;u.path=null}else{if(u.carry>0)order(u,{t:'return',resume:null});else order(u,{t:'idle'});break}
      }
      if(u.carry>0&&u.ct!==o.rt){order(u,{t:'return',resume:o});break}
      if(players[u.owner].res[o.rt]>=resCap(players[u.owner])){u.working=false;if(u.carry>0)order(u,{t:'return',resume:o});break}
      if(u.carry>=10+players[u.owner].fx.carry){order(u,{t:'return',resume:o});break}
      if(distEnt(u,r)<=.5){
        u.path=null;const c=center(r);u.ang=Math.atan2(c.y-u.y,c.x-u.x);
        const rate={wood:.85,food:r.kind==='bld'?.6:.95,stone:.65,gold:.65}[o.rt]*(players[u.owner].moodMul||1)*(players[u.owner].toolMul||1)*(r.kind==='bld'?farmBoost(r):1)*(1+.06*players[u.owner].epoch)*(1+(players[u.owner].fx.gather[o.rt]||0))*(players[u.owner].ai?DIFF[aiDiffOf(u.owner)].gather:1)*(SEASON===0&&o.rt==='food'?1.3:SEASON===2&&o.rt==='wood'?1.25:1);
        const amt=Math.min(rate*dt,r.kind==='res'?r.amount:99);
        u.carry+=amt;u.ct=o.rt;u.working=true;if(u.owner===ME&&visibleEnt(u)&&onScreen(u))sfx(o.rt==='wood'?'chop':o.rt==='food'?'':'mine');
        if(r.kind==='res'){r.amount-=amt;if(r.amount<=0.001)kill(r)}
      }else approach(u,r,dt);
      break;}
    case 'return':{
      let d=o.drop?byId.get(o.drop):null;
      if(!alive(d)||!d.built){d=nearestDrop(u.owner,u.x,u.y);if(!d){order(u,{t:'idle'});break}o.drop=d.id;u.path=null}
      if(distEnt(u,d)<=.5){
        const pl=players[u.owner];pl.res[u.ct]=Math.max(pl.res[u.ct],Math.min(resCap(pl),pl.res[u.ct]+u.carry));pl.st.gathered+=u.carry;income(pl,u.ct,u.carry);u.carry=0;
        if(o.resume){const r=o.resume;order(u,r)}else order(u,{t:'idle'});
      }else approach(u,d,dt);
      break;}
    case 'board':{ // in einen Transporter einsteigen
      const c=byId.get(o.target);
      if(!alive(c)||c.owner!==u.owner||(c.cargo||[]).length>=(UNITS[c.type].seats||0)){order(u,{t:'idle'});break}
      if(distEnt(u,c)<=.7){(c.cargo=c.cargo||[]).push({type:u.type,hp:u.hp,kills:u.kills||0,rank:u.rank||0});u.dead=true;u.boarded=true;if(c.owner===LOCAL)uiDirty=true;recalcPop();break}
      approach(u,c,dt);break}
    case 'build':{
      const b=byId.get(o.target);
      if(!alive(b)){order(u,{t:'idle'});findMoreWork(u);break}
      if(b.built&&b.hp>=b.maxhp){
        if(b.type==='farm'&&!farmTaken(b,u)){order(u,{t:'gather',target:b.id,rt:'food'});break}
        if(BLD[b.type].drop&&players[u.owner].ai){order(u,{t:'idle'});break}
        order(u,{t:'idle'});findMoreWork(u);break}
      if(distEnt(u,b)<=.5){
        u.path=null;const c=center(b);u.ang=Math.atan2(c.y-u.y,c.x-u.x);u.working=true;
        const D=BLD[b.type];
        if(!b.built){
          const inc=dt/D.time*(players[u.owner].ai?DIFF[aiDiffOf(u.owner)].gather:1)*(1+players[u.owner].fx.build)*(SEASON===1?1.2:1);b.prog=Math.min(1,b.prog+inc);b.hp=Math.min(b.maxhp,b.hp+b.maxhp*inc);
          if(b.prog>=1){b.built=true;players[b.owner].st.built++;recalcPop();if(b.owner===ME){toast(D.name+' fertiggestellt.');sfx('bell')}
            if(b.type==='wonder'){players[b.owner].wonderT=180;toast((b.owner===ME?'Dein Weltwunder steht!':MP?'Das Weltwunder von '+players[b.owner].name+' steht!':'Das feindliche Weltwunder steht!')+' 3 Minuten bis zum Sieg.',b.owner===ME?'good':'warn')}}
        }else{b.hp=Math.min(b.maxhp,b.hp+b.maxhp*dt/D.time*.6)}
      }else approach(u,b,dt);
      break;}
  }
  u.working=(o.t==='gather'||o.t==='build')&&!u.moving&&!u.path;
  // stuck detection: units that make no progress briefly pass through others
  u.chk=(u.chk||0)-dt;u.ghost=Math.max(0,(u.ghost||0)-dt);
  if(u.chk<=0){u.chk=.8;if(u.moving&&u.lx!==undefined&&Math.hypot(u.x-u.lx,u.y-u.ly)<.25)u.ghost=1.2;u.lx=u.x;u.ly=u.y}
}
// Truppentransport: Fußtruppen steigen in Fahrzeuge oder Hubschrauber mit "seats" ein
const canBoard=t=>{const D=UNITS[t];return !!D&&!D.naval&&!D.air&&!D.seats&&(D.pop||1)<=1&&!['vehicle','cavalry','siege','ship'].includes(CLS(t))};
function unload(c){
  if(!c.cargo||!c.cargo.length)return 0;const D=UNITS[c.type],i0=idx(c.x|0,c.y|0);
  if(D.air&&(terr[i0]===1||block[i0]!==0)){if(c.owner===ME)toast('Absitzen nur über freiem Land.','warn');return 0}
  const n=c.cargo.length;passOwner=c.owner;passNaval=false;passAir=false;
  c.cargo.forEach((p,i)=>{let x=c.x+Math.cos(i/n*6.28)*.8,y=c.y+Math.sin(i/n*6.28)*.8;if(!pass(x|0,y|0)){x=c.x;y=c.y}
    const u=spawnUnit(c.owner,p.type,x,y);u.hp=Math.min(u.maxhp,p.hp);u.kills=p.kills;u.rank=p.rank});
  c.cargo=[];recalcPop();return n}
function findMoreWork(u){
  // help on nearby unfinished buildings, otherwise resume gathering near
  let best=null,bd=10;
  for(const e of ents)if(e.kind==='bld'&&e.owner===u.owner&&!e.built&&!e.dead){const d=Math.hypot(e.x-u.x,e.y-u.y);if(d<bd){bd=d;best=e}}
  if(best){order(u,{t:'build',target:best.id});return}
  for(const rt of ['wood','gold','stone','food']){
    const r=nearestRes(rt,u.x,u.y,4,u.owner);if(r){order(u,{t:'gather',target:r.id,rt});return}
  }
}

// ================= building update =================
function updBld(b,dt){
  const D=BLD[b.type],pl=players[b.owner];
  if(!b.built)return;
  if(D.atk){
    b.cd-=dt;
    if(b.cd<=0){
      let best=null,bd=D.range*(b.upg?1.5:1);
      for(const e of ents){if(e.kind!=='unit'||e.dead||e.owner===b.owner||hidden(e))continue;const c=center(b),d=Math.hypot(e.x-c.x,e.y-c.y)-b.size/2;if(d<bd){bd=d;best=e}}
      if(best){b.cd=D.rate*(b.upg?.6:1);const c=center(b);proj.push({x:c.x,y:c.y-.6,tid:best.id,dmg:D.atk*(1+.14*pl.epoch)*(1+pl.fx.bldAtk),src:b.id,k:'arrow',ep:pl.epoch,sp:14,arc:bd})}
    }
  }
  const q=b.queue[0];if(!q)return;const sdt=(b.sabotUntil>gameT?dt*.5:dt)*(players[b.owner].crowdMul||1)*(players[b.owner].monProd||1)*(SEASON===3?.8:1);// sabotiert: halbe Produktion
  if(q.tech){
    q.t+=sdt*(pl.raceUntil>gameT?2:1)*(pl.lodge?1.25:1);
    if(q.t>=q.total){b.queue.shift();applyTech(pl,q.tech);
      if(b.owner===ME)toast('Forschung abgeschlossen: '+TECHS[q.tech].name+'.','good');uiDirty=true}
    return;
  }
  if(q.ep){
    q.t+=sdt;
    if(q.t>=q.total){b.queue.shift();pl.advancing=false;pl.epoch++;
      if(!players.some(o=>o!==pl&&o.epoch>=pl.epoch)){pl.raceUntil=gameT+120;pl.raceEp=pl.epoch;toast((b.owner===ME?'Dein Volk':'Die '+CIVS[pl.civ].name)+' erreichte als Erste die '+EPOCHS[pl.epoch]+'! 2 Minuten doppelte Forschung und +10 % Kampfkraft.',b.owner===ME?'good':'warn')}
      for(const u of ents)if(u.kind==='unit'&&u.owner===b.owner&&!u.dead){const f=u.hp/u.maxhp;u.maxhp=uStat(u).hp;u.hp=Math.max(1,Math.round(u.maxhp*f))}
      if(b.owner===ME)toast('Willkommen in der '+EPOCHS[pl.epoch]+'! Neue Einheiten und Gebäude sind verfügbar.','good');
      else toast((MP?pl.name:'Der Gegner')+' hat die '+EPOCHS[pl.epoch]+' erreicht.','warn');
      uiDirty=true;
    }
    return;
  }
  const U=UNITS[q.u];
  if(U.naval&&WX.kind==='storm'){q.blocked=true;return}
  if(!q.started){if(pl.pop+U.pop>pl.cap){q.blocked=true;if(b.owner===ME&&gameT-(b.popWarn||-99)>15){b.popWarn=gameT;toast('Bevölkerungslimit erreicht. Baue Wohnhäuser.','warn')}return}q.started=true;q.blocked=false;recalcPop();if(b.prio===2){const c=q.cost||U.cost;if(Object.keys(c).every(r=>pl.res[r]>=c[r])){for(const r in c)pl.res[r]-=c[r];q.boost=true}}}
  q.t+=sdt*(q.boost?2:b.prio===.5?.5:1);
  if(q.t>=q.total){
    b.queue.shift();
    const s=freeAround(b,b.rally?{x:b.rally.x,y:b.rally.y}:null,!!U.naval);
    if(!s){q.t=q.total;b.queue.unshift(q);return}
    const u=spawnUnit(b.owner,q.u,s.x+.5,s.y+.5);pl.st.trained++;recalcPop();
    if(b.rally){
      const t=b.rally.id?byId.get(b.rally.id):null;
      if(t&&alive(t))cmdTarget([u],t);else cmdMove([u],b.rally.x,b.rally.y,false);
    }else if(!pl.ai&&u.type==='worker'){
      // auto-gather nearest food so the economy keeps running
      const r=nearestRes('food',u.x,u.y,8,b.owner)||nearestRes('wood',u.x,u.y,12,b.owner);if(r)order(u,{t:'gather',target:r.id,rt:r.rt||'food'});
    }
  }
}
function countUnits(p,type){let n=0;for(const e of ents)if(!e.dead&&e.owner===p&&e.type===type&&e.kind==='unit')n++;for(const e of ents)if(e.kind==='bld'&&e.owner===p)for(const q of e.queue)if(q.u===type)n++;return n}
// Kosten je Epoche: früh viel Nahrung und wenig Gold, später teure Gold-Ausrüstung
const EPC={food:[.8,.9,1,1,1,1,.95,.9,.85,.8],wood:[.9,1,1,1,1.05,1.1,1.1,1,.9,.8],gold:[.6,.8,1,1.1,1.2,1.35,1.5,1.7,1.9,2.1]};
function uCost(p,type){const U=UNITS[type],c=U.cost||{};if(U.civil||type==='worker'||!p&&p!==0)return c;const ep=Math.min(9,players[p].epoch),r={};let sum=0;
  for(const k in c){r[k]=Math.round(c[k]*(EPC[k]?EPC[k][ep]:1));sum+=c[k]}
  if(!c.gold&&ep>=5&&sum>0)r.gold=Math.round(sum*.1*(ep-4));return r}
function queueUnit(b,type){
  const pl=players[b.owner],c=uCost(b.owner,type);
  if(b.queue.length>=6||!canAfford(b.owner,c))return false;
  const U=UNITS[type];if(U.max&&countUnits(b.owner,type)>=U.max)return false;
  pay(b.owner,c);b.queue.push({u:type,t:0,total:UNITS[type].time,cost:c});return true;
}
function queueEpoch(b){
  const pl=players[b.owner];if(pl.advancing||pl.epoch>=MAXEP())return false;const c=EPOCH_COST[pl.epoch+1];
  if(!canAfford(b.owner,c))return false;pay(b.owner,c);pl.advancing=true;b.queue.push({ep:true,t:0,total:EPOCH_TIME[pl.epoch+1],cost:c});return true;
}
function techState(p,id){
  const pl=players[p],t=TECHS[id];if(!t)return'none';
  if(pl.techs[id])return'done';
  if(ents.some(e=>e.kind==='bld'&&e.owner===p&&!e.dead&&e.queue.some(q=>q.tech===id)))return'running';
  if((t.requires||[]).some(r=>!pl.techs[r]))return'requires';
  if((t.epoch||0)>pl.epoch)return'epoch';
  return'open';
}
function queueTech(b,id){
  const t=TECHS[id];if(!t||t.at!==b.type||!b.built||b.queue.length>=6||techState(b.owner,id)!=='open'||!canAfford(b.owner,t.cost))return false;
  pay(b.owner,t.cost);b.queue.push({tech:id,t:0,total:t.time||30,cost:t.cost});return true;
}
function applyTech(pl,id){
  const t=TECHS[id],e=t.effect||{},f=pl.fx;pl.techs[id]=true;
  for(const k of ['gather','atk','hp','speed','range'])if(e[k])for(const x in e[k])f[k][x]=(f[k][x]||0)+e[k][x];
  for(const k of ['carry','build','bldHp','bldAtk'])if(e[k])f[k]+=e[k];
  {const cls=new Set();for(const k of ['atk','hp','speed','range'])if(e[k])for(const x in e[k])cls.add(x);const gat=e.gather||e.carry,bl=e.bldHp||e.bldAtk||e.build;
    for(const v of ents)if(!v.dead&&v.owner===pl.i&&(v.kind==='unit'?cls.has(CLS(v.type))||(gat&&v.type==='worker')||(e.build&&v.type==='worker'):v.kind==='bld'&&(bl&&(!e.bldAtk||BLD[v.type].atk)||v.type===t.at)))v.glowT=gameT+3}
  for(const u of ents)if(!u.dead&&u.owner===pl.i){
    if(u.kind==='unit'){const fr=u.hp/u.maxhp;u.maxhp=uStat(u).hp;u.hp=Math.max(1,Math.round(u.maxhp*fr))}
    else if(u.kind==='bld'&&e.bldHp){const fr=u.hp/u.maxhp;u.maxhp=Math.round(BLD[u.type].hp*(1+f.bldHp));u.hp=Math.max(1,Math.round(u.maxhp*fr))}
  }
  if(t.onComplete)try{t.onComplete(API,pl)}catch(err){}
}
function cancelQ(b,i){
  const q=b.queue[i];if(!q)return;b.queue.splice(i,1);
  if(q.ep){refund(b.owner,q.cost);players[b.owner].advancing=false}else if(q.tech)refund(b.owner,q.cost);else refund(b.owner,q.cost||UNITS[q.u].cost);
  recalcPop();
}

// ================= projectiles & fx =================
function updProj(dt){
  for(const p of proj){
    if(p.ground){
      const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.hypot(dx,dy),s=p.sp*dt;p.ang=Math.atan2(dy,dx);
      if(d>s){p.x+=dx/d*s;p.y+=dy/d*s;continue}
      p.done=true;fx.push({x:p.tx,y:p.ty,t:0,k:'boom'});const src=byId.get(p.src)||null;
      for(const e of ents){ // splash damage, falls off toward the edge
        if(e.dead||e.owner<0||e.owner===p.owner||e.kind==='res'||isAir(e))continue;
        let dd;if(e.kind==='unit')dd=Math.hypot(e.x-p.tx,e.y-p.ty)-e.r;else{const cx=Math.max(e.x,Math.min(p.tx,e.x+e.size)),cy=Math.max(e.y,Math.min(p.ty,e.y+e.size));dd=Math.hypot(cx-p.tx,cy-p.ty)}
        if(dd<.9)damage(e,hitDmg(p.ut,p.atk,e)*(1-.5*Math.max(0,dd)/.9),src);
        else if(dd<3&&players[p.owner]&&players[p.owner].techs.siege_2&&p.ut==='siege')damage(e,hitDmg(p.ut,p.atk,e)*.5,src);
      }
      if(players[p.owner]&&players[p.owner].techs.siege_2&&p.ut==='siege')fx.push({x:p.tx,y:p.ty,t:0,k:'ring3'});
      continue;
    }
    const t=byId.get(p.tid);
    if(!alive(t)){p.done=true;continue}
    const c=center(t),dx=c.x-p.x,dy=c.y-p.y,d=Math.hypot(dx,dy),s=p.sp*dt;
    p.ang=Math.atan2(dy,dx);
    if(d<=s+.15){p.done=true;if(p.miss)fx.push({x:c.x+(rng()-.5)*.8,y:c.y+(rng()-.5)*.8,t:0,k:'stuck',a:p.ang});else damage(t,p.dmg,byId.get(p.src)||null)}
    else{p.x+=dx/d*s;p.y+=dy/d*s}
  }
  proj=proj.filter(p=>!p.done);
  for(const f of fx)f.t+=dt;
  fx=fx.filter(f=>f.t<(f.k==='smoke'?1.6:f.k==='die'?1.2:f.k==='stuck'?4:f.k==='ring3'?.6:.4));
}

// ================= separation =================
function separate(){
  const grid=new Map();
  for(const u of ents){if(u.kind!=='unit'||u.dead)continue;const k=(u.x|0)+(u.y|0)*W;let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(u)}
  for(const u of ents){if(u.kind!=='unit'||u.dead)continue;
    const gx=u.x|0,gy=u.y|0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=grid.get(gx+ox+(gy+oy)*W);if(!a)continue;
      for(const v of a){if(v===u||v.id<u.id||!!UNITS[u.type].naval!==!!UNITS[v.type].naval||!!UNITS[u.type].air!==!!UNITS[v.type].air)continue;
        const dx=v.x-u.x,dy=v.y-u.y,d=Math.hypot(dx,dy)||.01,m=u.r+v.r-.04;
        if(d<m){const push=(m-d)*.5,nx=dx/d,ny=dy/d;
          if(u.ghost||v.ghost)continue;
          const wu=u.working?0.15:1,wv=v.working?0.15:1;
          tryNudge(u,-nx*push*wu,-ny*push*wu);tryNudge(v,nx*push*wv,ny*push*wv)}}}
  }
}
function tryNudge(u,dx,dy){const nx=u.x+dx,ny=u.y+dy;passOwner=u.owner;passNaval=!!UNITS[u.type].naval;passAir=!!UNITS[u.type].air;if(pass(nx|0,ny|0)){u.x=nx;u.y=ny}}

// ================= visibility =================
let visT=0;
function updateVis(force){
  vis.fill(spectating?1:0);if(spectating)exp.fill(1);
  for(const e of ents){if(e.dead||(e.owner!==ME&&!(!MP&&aiS&&aiS.allied&&e.owner===1)))continue;
    const s=e.kind==='unit'?uStat(e).sight:(e.built?BLD[e.type].sight:2),c=center(e),r2=s*s;
    const x0=Math.max(0,Math.floor(c.x-s)),x1=Math.min(W-1,Math.ceil(c.x+s)),y0=Math.max(0,Math.floor(c.y-s)),y1=Math.min(H-1,Math.ceil(c.y+s));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=x+.5-c.x,dy=y+.5-c.y;if(dx*dx+dy*dy<=r2){vis[idx(x,y)]=1;exp[idx(x,y)]=1}}
  }
  for(const e of ents)if(e.kind==='bld'&&e.owner!==ME&&e.owner>=0&&!e.dead){for(let y=e.y;y<e.y+e.size&&!e.seen;y++)for(let x=e.x;x<e.x+e.size;x++)if(vis[idx(x,y)]){e.seen=true;break}}
  const d=fogImg.data;
  for(let i=0;i<W*H;i++){d[i*4]=8;d[i*4+1]=12;d[i*4+2]=14;d[i*4+3]=vis[i]?0:exp[i]?140:255}
  fogX.putImageData(fogImg,0,0);
}

// Sicht je Spieler für die Simulation (Mehrspieler): hängt nur vom Spielzustand ab, nie vom eigenen Bildschirm
let svis=[];
function pvis(p){return MP?(svis[p]||vis):vis}
function simVis(){
  for(const pl of players){let v=svis[pl.i];if(!v)v=svis[pl.i]=new Uint8Array(W*H);else v.fill(0)}
  for(const e of ents){if(e.dead||e.owner<0||!svis[e.owner])continue;const v=svis[e.owner];
    const s=e.kind==='unit'?uStat(e).sight:(e.built?BLD[e.type].sight:2),c=center(e),r2=s*s;
    const x0=Math.max(0,Math.floor(c.x-s)),x1=Math.min(W-1,Math.ceil(c.x+s)),y0=Math.max(0,Math.floor(c.y-s)),y1=Math.min(H-1,Math.ceil(c.y+s));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=x+.5-c.x,dy=y+.5-c.y;if(dx*dx+dy*dy<=r2)v[idx(x,y)]=1}}
}

// ================= AI =================
// Schwierigkeit und Zustand einer KI: im Mehrspieler pro Platz, sonst die globale Einstellung
const aiDiffOf=p=>players[p]&&players[p].aiDiff!=null?players[p].aiDiff:diff,aiOf=p=>players[p]&&players[p].aiS||aiS;
// Feinde der KI P: alle anderen Reiche, die noch im Spiel sind
const aiFoe=(P,o)=>o>=0&&o!==P&&!!players[o]&&!players[o].defeated;
function aiThink(P=1){
  const pl=players[P],dk=aiDiffOf(P),D=DIFF[dk];
  // nächstgelegene feindliche Basis (im Einzelspiel immer die des Spielers)
  let foeB=bases[0];{let bd=1e9;for(let i=0;i<bases.length;i++)if(aiFoe(P,i)){const d=Math.hypot(bases[i].x-bases[P].x,bases[i].y-bases[P].y);if(d<bd){bd=d;foeB=bases[i]}}}
  const mine=ents.filter(e=>!e.dead&&e.owner===P);
  const workers=mine.filter(e=>e.kind==='unit'&&e.type==='worker');
  const army=mine.filter(e=>isMil(e)&&!(UNITS[e.type]&&UNITS[e.type].naval));
  const ships=mine.filter(e=>e.kind==='unit'&&UNITS[e.type]&&UNITS[e.type].naval);
  const blds=mine.filter(e=>e.kind==='bld');
  const tcs=blds.filter(b=>b.type==='tc');
  const count=t=>blds.filter(b=>b.type===t).length;
  const home=tcs[0]?center(tcs[0]):(workers[0]?{x:workers[0].x,y:workers[0].y}:{x:bases[P].x,y:bases[P].y});
  const ep=pl.epoch;
  const want=(t,c)=>c&&canAfford(P,mulCost(c,D.reserve));
  // --- reserve while saving for the next epoch
  const saving=!pl.advancing&&ep<MAXEP()&&workers.length>=7+ep*3;
  const spare=c=>{if(!saving)return canAfford(P,c);const e=EPOCH_COST[ep+1],r={};for(const k in c)r[k]=c[k]+(e[k]||0)*.8;return canAfford(P,r)};
  // --- workers
  if(tcs.length&&workers.length<D.workers+ep*2){for(const tc of tcs)if(tc.built&&tc.queue.length<2&&!tc.queue.some(q=>q.ep)&&canAfford(P,UNITS.worker.cost))queueUnit(tc,'worker')}
  // --- epoch
  if(saving&&tcs.length&&tcs[0].built&&canAfford(P,EPOCH_COST[ep+1])&&tcs[0].queue.length===0)queueEpoch(tcs[0]);
  // --- build helpers
  const unfinished=blds.filter(b=>!b.built);
  const build=(type,near,minR,maxR)=>{
    if(!canAfford(P,BLD[type].cost))return false;
    const s=findSpot(P,type,near,minR||3,maxR||14);if(!s)return false;
    pay(P,BLD[type].cost);const b=placeBld(P,type,s.x,s.y,false);
    const n=type==='house'||type==='farm'?1:type==='wonder'?6:2;
    const free=workers.filter(w=>w.order.t!=='build').sort((a,b2)=>Math.hypot(a.x-s.x,a.y-s.y)-Math.hypot(b2.x-s.x,b2.y-s.y)).slice(0,n);
    for(const w of free)order(w,{t:'build',target:b.id});
    return true;
  };
  if(!tcs.length&&workers.length&&canAfford(P,BLD.tc.cost)){build('tc',home,0,12);return}
  const housing=unfinished.some(b=>b.type==='house');
  if(pl.cap<200&&pl.cap-pl.pop<4+Math.floor(blds.length/4)&&!housing)build('house',home,4,10);
  const prodWant=[['barracks',5],['range',8],['camp',7],['stable',12,1],['workshop',16,2],['barracks',18],['range',20],['stable',22,1],['tower',14,1],['tower',20,2]];
  if(!unfinished.some(b=>b.type!=='house'&&b.type!=='farm')){
    const have={};
    for(const t in BLD)if(BLD[t].ai&&!prodWant.some(w=>w[0]===t)){const w=[t,BLD[t].ai.minWorkers||15,BLD[t].minEpoch||0];if(BLD[t].ai.prio)prodWant.splice(2,0,w);else prodWant.push(w)}
    for(const [t,minW,minE] of prodWant){
      have[t]=(have[t]||0)+1;
      if((minE||0)>ep||workers.length<minW)continue;
      if(count(t)>=have[t])continue;
      if(!spare(BLD[t].cost))break;
      if(t==='camp'){const r=nearestRes('wood',home.x,home.y,30,P)||nearestRes('gold',home.x,home.y,30,P);if(r&&build('camp',{x:r.x,y:r.y},2,6))break;continue}
      if(t==='dock'){if(!BLD.dock)continue;const wt=nearWater(home,28);if(wt&&build('dock',wt,0,6))break;continue}
      if(t==='tower'){if(build('tower',{x:home.x+(foeB.x-home.x)*.15,y:home.y+(foeB.y-home.y)*.15},2,8))break;continue}
      if(build(t,home,5,15))break;
    }
    if(BLD.dock&&ep>=1&&workers.length>=11&&!count('dock')&&gameT>(aiS.dockTry||0)&&spare(BLD.dock.cost)){aiS.dockTry=gameT+60;const wt=nearWater(home,28);if(wt)build('dock',wt,0,6)}
    if(BLD.wonder&&ep>=BLD.wonder.minEpoch&&dk===2&&!count('wonder')&&canAfford(P,mulCost(BLD.wonder.cost,1.2)))build('wonder',home,6,16);
  }
  // --- Mauerabschnitt mit Tor Richtung Gegner (wie die AoE2-KI)
  if(BLD.wall&&BLD.gate&&!aiS.walled&&ep>=2&&workers.length>=16&&tcs.length&&pl.res.stone>=260){
    aiS.walled=true;const dx=foeB.x-home.x,dy=foeB.y-home.y,dl=Math.hypot(dx,dy)||1,ux=dx/dl,uy=dy/dl;
    const mx=home.x+ux*11,my=home.y+uy*11,bs=[];
    for(let k=-5;k<=5;k++){const x=Math.round(mx-uy*k),y=Math.round(my+ux*k),t=k===0?'gate':'wall';
      if(canPlace(P,t,x,y)&&canAfford(P,BLD[t].cost)){pay(P,BLD[t].cost);bs.push(placeBld(P,t,x,y,false))}}
    const ws=workers.filter(w=>w.order.t!=='build').slice(0,3);
    ws.forEach((w,i)=>{const b=bs[Math.floor(i*bs.length/ws.length)];if(b)order(w,{t:'build',target:b.id})});
  }
  // --- Schiffe: Gewässer bei der Heimat sichern
  for(const sh of ships)if(sh.order.t==='idle'){let best=null,bd=40;
    for(const e of ents)if(!e.dead&&aiFoe(P,e.owner)&&((e.kind==='unit'&&UNITS[e.type]&&UNITS[e.type].naval)||e.type==='dock')){const c=center(e),d=Math.hypot(c.x-sh.x,c.y-sh.y);if(d<bd){bd=d;best=c}}
    if(best)order(sh,{t:'amove',x:best.x,y:best.y})}
  // --- farms when berries run low
  const berries=nearestRes('food',home.x,home.y,12,P);
  const farms=blds.filter(b=>b.type==='farm');
  const foodW=workers.filter(w=>w.order.rt==='food').length;
  // --- assign idle workers
  const desired={food:.4,wood:.3,gold:.18+.03*ep,stone:.1+.02*ep};
  if(saving){const e=EPOCH_COST[ep+1];for(const k in e)if(pl.res[k]<e[k])desired[k]+=.12}
  if(ep>=4&&dk===2&&pl.res.stone<1000){desired.stone+=.08;desired.gold+=.05}
  const counts={food:0,wood:0,gold:0,stone:0};
  for(const w of workers)if(w.order.rt)counts[w.order.rt]++;
  // move one worker per think from the most over-staffed to the most under-staffed resource
  if(workers.length>=6){
    let hi=null,lo=null,hs=-1,ls=1;
    for(const rt of RES){const d=counts[rt]/workers.length-desired[rt];if(d>hs){hs=d;hi=rt}if(d<ls){ls=d;lo=rt}}
    if(hs-ls>.12&&hi!==lo){const w=workers.find(w=>w.order.t==='gather'&&w.order.rt===hi);
      const r=w&&nearestRes(lo,w.x,w.y,40,P);if(r){order(w,{t:'gather',target:r.id,rt:lo});counts[hi]--;counts[lo]++}}
  }
  for(const w of workers){
    if(w.order.t!=='idle')continue;
    let best='food',bs=-1e9;
    for(const rt of RES){const s=desired[rt]-counts[rt]/Math.max(1,workers.length);if(s>bs){bs=s;best=rt}}
    let r=nearestRes(best,w.x,w.y,40,P);
    if(!r&&best==='food'){
      if(build('farm',home,3,9)){continue}
      r=nearestRes('wood',w.x,w.y,40,P);best='wood';
    }
    if(r){order(w,{t:'gather',target:r.id,rt:r.rt||'food'});counts[best]++}
  }
  if(!berries&&farms.length<Math.min(10,foodW+1)&&foodW<workers.length*.45&&!unfinished.some(b=>b.type==='farm'))build('farm',home,3,10);
  // --- unfinished buildings with no builders
  for(const b of unfinished){if(!workers.some(w=>w.order.target===b.id)){const w=workers.filter(w=>w.order.rt!=='food').sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y))[0];if(w)order(w,{t:'build',target:b.id})}}
  // --- research (one per think, gather upgrades first)
  if(gameT>120){
    const prio=id=>(TECHS[id].effect&&TECHS[id].effect.gather?0:1)+rng()*.5;
    const opts=[];
    for(const b of blds)if(b.built&&b.queue.length===0)for(const id in TECHS)if(TECHS[id].at===b.type&&techState(P,id)==='open')opts.push([prio(id),b,id]);
    opts.sort((a,c)=>a[0]-c[0]);
    for(const [,b,id] of opts){if(spare(TECHS[id].cost)){queueTech(b,id);break}}
  }
  // --- train army
  const mix=['infantry','ranged','cavalry','siege'];
  for(const b of blds){
    if(!b.built||b.queue.length>=2)continue;
    const opts=trainsOf(b.type).filter(k=>k!=='worker'&&UNITS[k].ai!==false&&(UNITS[k].minEpoch||0)<=ep&&!(UNITS[k].max&&countUnits(P,k)>=UNITS[k].max));
    if(!opts.length)continue;const tr=opts[(rng()*opts.length)|0],U=UNITS[tr];
    if(UNITS[tr].naval&&ships.length>=6)continue;
    if(CLS(tr)==='siege'&&army.filter(a=>CLS(a.type)==='siege').length>=4)continue;
    if(gameT<90&&dk<2)continue;
    if(spare(uCost(P,tr)))queueUnit(b,tr);
  }
  // --- defend
  const threat=ents.find(e=>!e.dead&&aiFoe(P,e.owner)&&e.kind==='unit'&&blds.some(b=>Math.hypot(e.x-b.x-b.size/2,e.y-b.y-b.size/2)<12));
  if(threat){
    for(const a of army)if(a.order.t!=='attack'||!a.order.forced)if(!aiS.attacking||Math.hypot(a.x-home.x,a.y-home.y)<25)order(a,{t:'attack',target:threat.id,forced:true});
    if(army.length<3&&tcs.length)for(const w of workers)if(Math.hypot(w.x-threat.x,w.y-threat.y)<5&&threat.type==='worker')order(w,{t:'attack',target:threat.id,forced:true});
  }
  // --- Verwundete (unter 30 % Leben) ziehen sich nach Hause zurück, Heiler und Burg pflegen sie dort
  for(const a of army){if(a.retreat){if(a.hp>a.maxhp*.75||Math.hypot(a.x-home.x,a.y-home.y)<6&&a.hp>a.maxhp*.6)a.retreat=false;else continue}
    if(a.hp<a.maxhp*.3&&Math.hypot(a.x-home.x,a.y-home.y)>10&&dk>0){a.retreat=true;a.waveAt=null;cmdMove([a],home.x+(rng()-.5)*4,home.y+4+(rng()-.5)*3,false)}}
  // Rückzügler heilen langsam in der Heimat
  for(const a of army)if(a.retreat&&Math.hypot(a.x-home.x,a.y-home.y)<7)a.hp=Math.min(a.maxhp,a.hp+a.maxhp*.02*D.think);
  // --- attack waves
  if(aiS.attacking){
    const out=army.filter(a=>a.waveAt||a.order.t==='amove'||a.order.t==='attack');
    if(out.length<Math.max(2,aiS.sent*.25)){aiS.attacking=false;aiS.nextAttack=gameT+70;for(const a of army)cmdMove([a],home.x+(rng()-.5)*6,home.y+6+(rng()-.5)*4,false)}
    else for(const a of army)if(a.retreat)continue;else if(a.waveAt&&gameT>=a.waveAt.t){order(a,{t:'amove',x:a.waveAt.x+(rng()-.5)*2,y:a.waveAt.y+(rng()-.5)*2});a.waveAt=null}
    else if(!a.waveAt&&(a.order.t==='idle'||a.order.t==='guard')){const t=playerTarget(a,P);if(t){const c=center(t);order(a,{t:'amove',x:c.x,y:c.y})}}
  }else if(gameT>=aiS.nextAttack-(WX.night>.6&&!(aiS.peaceUntil>gameT)?40:0)&&army.length>=aiS.wave&&!(aiS.peaceUntil>gameT)){
    const t=playerTarget(army[0],P);
    if(t){aiS.attacking=true;aiS.sent=army.length;aiS.wave+=D.waveGrow;const c=center(t);
      // Formation: erst am Sammelpunkt aufstellen (Nahkampf vorn, Fernkampf hinten), dann losmarschieren
      const dx=c.x-home.x,dy=c.y-home.y,dl=Math.hypot(dx,dy)||1,ux=dx/dl,uy=dy/dl,sx0=home.x+ux*10,sy0=home.y+uy*10;
      const ranged=a=>(UNITS[a.type]&&UNITS[a.type].range>1.5);
      const rows=[army.filter(a=>!ranged(a)),army.filter(ranged)];
      rows.forEach((row,ri)=>row.forEach((a,k)=>{const off=(k-(row.length-1)/2)*.9,back=ri*1.6;
        // jede dritte Einheit eines großen Heeres sammelt sich seitlich versetzt und fällt von der Flanke ein
        const fl=army.length>=6&&k%3===2,side=fl?(k%2?1:-1)*9:0,fwd=fl?6:0;
        a.waveAt={x:c.x,y:c.y,t:gameT+14};cmdMove([a],sx0-uy*(off+side)-ux*(back-fwd),sy0+ux*(off+side)-uy*(back-fwd),false)}));
      if(!MP){toast('Feindliche Armee sammelt sich!','warn');ping={x:army[0].x,y:army[0].y};pingT=3}}
  }else{
    // rally idle army in front of home
    const rx=home.x+(foeB.x-home.x)*.12,ry=home.y+(foeB.y-home.y)*.12;
    for(const a of army)if(a.order.t==='idle'&&Math.hypot(a.x-rx,a.y-ry)>6)cmdMove([a],rx+(rng()-.5)*4,ry+(rng()-.5)*4,false);
  }
}
function mulCost(c,m){const r={};for(const k in c)r[k]=c[k]*m;return r}
function playerTarget(from,P=1){
  let best=null,bd=1e9;
  for(const e of ents)if(!e.dead&&aiFoe(P,e.owner)&&e.kind==='bld'){const c=center(e),d=Math.hypot(c.x-from.x,c.y-from.y)+(e.type==='tc'?-6:0)+(e.type==='farm'?8:0)+(['camp','mill','mine','market','dock'].includes(e.type)?-8:0)+(['tower','castle','wall','gate'].includes(e.type)?10:0);if(d<bd){bd=d;best=e}}
  if(!best)for(const e of ents)if(!e.dead&&aiFoe(P,e.owner)&&e.kind==='unit'){const d=Math.hypot(e.x-from.x,e.y-from.y);if(d<bd){bd=d;best=e}}
  return best;
}
function nearWater(c,maxR){let best=null,bd=1e9;
  for(let y=Math.max(0,(c.y|0)-maxR);y<Math.min(H,(c.y|0)+maxR);y++)for(let x=Math.max(0,(c.x|0)-maxR);x<Math.min(W,(c.x|0)+maxR);x++)
    if(terr[idx(x,y)]!==1){let w=false;for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]])if(inb(x+ox,y+oy)&&terr[idx(x+ox,y+oy)]===1)w=true;
      if(w){const d=Math.hypot(x-c.x,y-c.y);if(d<bd){bd=d;best={x,y}}}}
  return best}
function findSpot(p,type,near,minR,maxR){
  const s=BLD[type].size;const cx=Math.round(near.x-s/2),cy=Math.round(near.y-s/2);
  for(let r=minR;r<=maxR;r++){
    const cand=[];
    for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
      if(Math.max(Math.abs(x-cx),Math.abs(y-cy))!==r)continue;
      if(!canPlace(p,type,x,y))continue;
      // keep a walkway free around non-farm buildings
      let ok=true;
      if(!BLD[type].walk)for(let yy=y-1;yy<=y+s&&ok;yy++)for(let xx=x-1;xx<=x+s;xx++){if(!inb(xx,yy)){ok=false;break}const b=block[idx(xx,yy)];if(b>0){const e=byId.get(b);if(e&&e.kind==='bld'){ok=false;break}}}
      if(ok)cand.push({x,y});
    }
    if(cand.length)return cand[(rng()*cand.length)|0];
  }
  return null;
}

// ================= module API =================
const API={
  get ents(){return ents},income(pl,r,v){income(pl,r,v)},get players(){return players},get time(){return gameT},
  spawnUnit,uCost,get aiS(){return aiS},water:(x,y)=>inb(x|0,y|0)&&terr[idx(x|0,y|0)]===1,get gate(){return gate},idx,W,placeBld,toast,damage,order,applyTech,techState,center,distEnt,alive,isMil,uStat,
  heal(e,amt){e.hp=Math.min(e.maxhp,e.hp+amt)},
  revealAll(){exp.fill(1)},sel:()=>sel,kill,nearestRes,
  get me(){return ME},get local(){return LOCAL},get mp(){return !!MP},
  fx(x,y,k){fx.push({x,y,t:0,k:k||'hit'})},
  free:(x,y)=>inb(x|0,y|0)&&block[idx(x|0,y|0)]===0&&terr[idx(x|0,y|0)]!==1,get bases(){return bases},
  endGame:(win,text)=>endGame(win,text),centerOn:(x,y)=>centerOn(x,y),epochName:i=>EPOCHS[i],
};
// ================= main step =================
let aiTimer=0,popT=0;
let pathT=0;
function wearPaths(){// Trampelpfade: wo oft gelaufen wird, wird das Gras zu Erde
  const g=terrC.getContext('2d');g.save();
  for(const u of ents){if(u.dead||u.kind!=='unit'||!u.moving||UNITS[u.type].naval||UNITS[u.type].air)continue;const i=idx(u.x|0,u.y|0);if(terr[i]===1)continue;
    g.fillStyle='rgba(112,92,62,.045)';g.beginPath();g.ellipse(u.x*T,u.y*T+4,5,3,0,0,7);g.fill()}
  // Pflaster um das Stadtzentrum ab Epoche 3: unregelmäßige Steinplatten mit Fugen
  for(const b of ents){if(b.dead||b.type!=='tc'||!b.built||b.paved||!players[b.owner]||players[b.owner].epoch<3)continue;b.paved=1;
    const cx=(b.x+b.size/2)*T,cy=(b.y+b.size/2)*T,R=(b.size/2+1.6)*T;let sd=b.id*97+13;const rr=()=>(sd=(sd*16807)%2147483647)/2147483647;
    for(let y=cy-R;y<cy+R;y+=7)for(let x=cx-R+((y/7|0)%2)*4;x<cx+R;x+=8){const d=Math.hypot(x-cx,y-cy)/R;if(d>1||rr()<d*d*.7)continue;
      const tx=x/T|0,ty=y/T|0;if(!inb(tx,ty)||terr[idx(tx,ty)]===1)continue;const v=118+rr()*40|0;
      g.fillStyle=`rgba(${v+6},${v},${v-12},${.9-d*.4})`;g.fillRect(x+.5,y+.5,7,6);g.fillStyle='rgba(0,0,0,.12)';g.fillRect(x+.5,y+5.5,7,1)}}
  g.restore()}
function step(dt){
  gameT+=dt;if((pathT+=dt)>=.5){pathT=0;wearPaths()}
  for(const e of ents){if(e.dead)continue;if(e.kind==='unit')updUnit(e,dt);else if(e.kind==='bld')updBld(e,dt)}
  separate();updProj(dt);
  if(ents.some(e=>e.dead)){ents=ents.filter(e=>{if(e.dead){byId.delete(e.id);return false}return true});const before=sel.length;sel=sel.filter(e=>!e.dead);if(sel.length!==before)uiDirty=true}
  if(MP){for(const pl of players)if(pl.ai&&!pl.defeated&&(pl.aiT-=dt)<=0){pl.aiT=DIFF[pl.aiDiff].think;const sv=aiS;aiS=pl.aiS;try{aiThink(pl.i)}finally{aiS=sv}}}
  else{aiTimer-=dt;if(aiTimer<=0){aiTimer=DIFF[diff].think;if(players.some(p=>p.ai))aiThink();if(window.__autoplayer)autoPlayer()}}
  visT-=dt;if(visT<=0){visT=.2;updateVis();if(MP)simVis()}
  popT-=dt;if(popT<=0){popT=1;recalcPop();checkEnd()}
  pingT-=dt;weatherTick();
  // Brückenstücke bauen sich vom Ufer oder vom letzten fertigen Stück aus selbst
  for(const b of ents){if(b.dead||b.built||!BLD[b.type]||!BLD[b.type].water)continue;
    let ok=false;for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=b.x+ox,yy=b.y+oy;if(!inb(xx,yy))continue;const j=idx(xx,yy);if(terr[j]!==1){ok=true;break}
      for(const o of ents)if(o.type==='bridge'&&o.built&&!o.dead&&o.x===xx&&o.y===yy){ok=true;break}if(ok)break}
    if(!ok)continue;const inc=dt/BLD[b.type].time*(1+players[b.owner].fx.build)*(SEASON===1?1.2:1);b.prog=Math.min(1,b.prog+inc);b.hp=Math.min(b.maxhp,b.hp+b.maxhp*inc);
    if(b.prog>=1){b.built=true;block[idx(b.x,b.y)]=0;players[b.owner].st.built++}}
  XY.emit('tick',API,dt);
  if(timeLimit&&!over){const left=timeLimit*60-gameT;
    if(left<=60&&left+dt>60)toast('Noch eine Minute bis zum Zeitlimit!','warn');
    if(left<=0){if(MP){const alive=players.filter(p=>!p.defeated),sc=alive.map(score),best=alive[sc.indexOf(Math.max(...sc))];
        endGame(best.i===LOCAL,'Zeitlimit erreicht. Punkte: '+alive.map((p,k)=>p.name+' '+sc[k]).join(', ')+'.')}
      else{const a=score(players[0]),b=score(players[1]);endGame(a>=b,'Zeitlimit erreicht. Punkte: Du '+a+', Gegner '+b+'.')}}}
  for(const pl of players)if(pl.wonderT>0&&!pl.defeated){pl.wonderT-=dt;if(pl.wonderT<=0){endGame(pl.i===LOCAL,MP&&pl.i!==LOCAL?'Das Weltwunder von '+pl.name+' hat drei Minuten überdauert.':'Das Weltwunder hat drei Minuten überdauert.')}}
}
function score(pl){let s=pl.epoch*200+pl.st.killed*8+pl.st.gathered/20+Object.keys(pl.techs).length*30;
  for(const e of ents)if(!e.dead&&e.owner===pl.i)s+=e.kind==='bld'?(e.type==='wonder'?500:25):(isMil(e)?6:2);return Math.round(s)}
function checkEnd(){
  if(over)return;
  if(MP){ // Mehrspieler: wer kein Reich mehr hat, scheidet aus; der letzte Überlebende gewinnt
    for(const pl of players){if(pl.defeated)continue;
      const mine=ents.filter(e=>!e.dead&&e.owner===pl.i),units=mine.filter(e=>e.kind==='unit');
      if(pl.left||(!mine.some(e=>e.type==='tc')&&!units.some(u=>u.type==='worker')&&!units.some(isMil))||(!mine.some(e=>e.kind==='bld'&&e.type!=='farm')&&!units.length)){
        pl.defeated=true;for(const e of mine)if(!e.dead)kill(e,null)
        if(pl.i===LOCAL){if(players.filter(p=>!p.defeated).length>1)endGame(false,pl.left?'Du hast das Spiel verlassen.':'Dein Reich ist untergegangen.',true)}
        else toast(pl.name+(pl.left?' hat das Spiel verlassen.':' wurde besiegt.'),'warn')}}
    const alive=players.filter(p=>!p.defeated);
    if(alive.length>1&&!alive.some(p=>!p.ai)){endGame(false,'Nur noch KI-Reiche sind übrig.');return}
    if(alive.length<=1){const w=alive[0];endGame(!!w&&w.i===LOCAL,w?(w.i===LOCAL?'Alle Gegner sind besiegt.':w.name+' hat als Letzter überlebt.'):'Kein Reich hat überlebt.')}
    return}
  for(const pl of players){
    const mine=ents.filter(e=>!e.dead&&e.owner===pl.i);
    const hasTC=mine.some(e=>e.type==='tc'),units=mine.filter(e=>e.kind==='unit');
    const dead=(!hasTC&&!units.some(u=>u.type==='worker')&&!units.some(isMil))||(!mine.some(e=>e.kind==='bld'&&e.type!=='farm')&&!units.length);
    if(dead){endGame(pl.i===1,pl.i===1?'Das feindliche Reich ist gefallen.':'Dein Reich ist untergegangen.');return}
  }
}
// keep: im Mehrspieler ausgeschieden, das Spiel der anderen läuft weiter (man kann zuschauen)
function endGame(win,text,keep){
  if(over)return;if(!keep){over=true;if(MP&&XY.net)XY.net.gameOver()}if(!MP)clearSave();XY.emit('end',API,win,text);
  $('#endTitle').textContent=win?'Sieg':'Niederlage';
  $('#endText').textContent=text+' Spielzeit '+fmtTime(gameT)+', erreichte Epoche: '+EPOCHS[players[LOCAL].epoch]+'.';
  const cols=MP?players.map(p=>p.i===LOCAL?'Du':p.name):['Du','Gegner'],order=MP?players.map(p=>p.i):[0,1];
  $('#endStats').style.gridTemplateColumns='auto'+' auto'.repeat(cols.length);$('#endBars').style.gridTemplateColumns='auto'+' 1fr'.repeat(cols.length);
  $('.evh .lg').innerHTML=cols.map((c,i)=>`<i style="background:${PCOL[order[i]]}"></i>${c.replace(/[&<>]/g,'')}`).join(' ');
  $('#againBtn').textContent=MP?'Zum Hauptmenü':'Neues Spiel';
  let wb=$('#watchBtn');if(!wb){wb=document.createElement('button');wb.className='opt';wb.id='watchBtn';wb.textContent='Weiter zuschauen';$('#againBtn').after(wb);wb.onclick=()=>{$('#endScreen').hidden=true;spectating=true;updateVis()}}
  wb.hidden=!keep;
  const rows=[['Ausgebildet','trained'],['Gefallen / zerstört','lost'],['Besiegte Feinde','killed'],['Gesammelte Rohstoffe','gathered'],['Gebäude errichtet','built']];
  const val=(pl,k)=>k==='techs'?Object.keys(pl.techs).length:k==='epoch'?EPOCHS[pl.epoch]:k==='score'?score(pl):Math.round(pl.st[k]||0);
  rows.push(['Erforschte Techniken','techs'],['Erreichte Epoche','epoch'],['Punkte','score']);
  $('#endStats').innerHTML='<span class="h"></span>'+cols.map(c=>`<span class="h">${c.replace(/[&<>]/g,'')}</span>`).join('')+rows.map(([l,k])=>`<span>${l}</span>`+order.map(i=>`<span>${val(players[i],k)}</span>`).join('')).join('');
  const bars=[['Rohstoffe gesamt',pl=>Math.round(Object.values(pl.tot||{}).reduce((a,b)=>a+b,0)||pl.st.gathered)],['Einheiten produziert',pl=>pl.st.trained],['Einheiten verloren',pl=>pl.st.lost],['Forschungen',pl=>Object.keys(pl.techs).length],['Gebäude gebaut',pl=>pl.st.built]];
  for(const r of ['food','wood','stone','gold'])bars.splice(1+['food','wood','stone','gold'].indexOf(r),0,['  '+RESN[r],pl=>Math.round((pl.tot||{})[r]||0)]);
  $('#endBars').innerHTML=bars.map(([l,f])=>{const v=order.map(i=>f(players[i])||0),m=Math.max(1,...v);return `<div class="bl">${l}</div>`+v.map((a,k)=>`<div class="bw"><i style="width:${a/m*100}%;background:${PCOL[order[k]]}"></i><span>${a}</span></div>`).join('')}).join('');
  setTimeout(()=>{$('#endScreen').hidden=false},900);
}
const fmtTime=t=>{t=Math.floor(t);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};

// ================= rendering =================
let viewW=0,viewH=0,dpr=1;
function resize(){
  dpr=Math.min(2,window.devicePixelRatio||1);
  const r=cv.getBoundingClientRect();viewW=r.width;viewH=r.height;
  cv.width=Math.max(1,Math.round(r.width*dpr));cv.height=Math.max(1,Math.round(r.height*dpr));
  const m=mm.getBoundingClientRect();mm.width=Math.max(1,Math.round(m.width*dpr));mm.height=Math.max(1,Math.round(m.height*dpr));
  clampCam();
}
function clampCam(){
  const vw=viewW/cam.z,vh=viewH/cam.z;
  cam.x=Math.max(-40,Math.min(W*T-vw+40,cam.x));cam.y=Math.max(-40,Math.min(H*T-vh+40,cam.y));
  if(vw>W*T)cam.x=(W*T-vw)/2;if(vh>H*T)cam.y=(H*T-vh)/2;
}
function centerOn(tx,ty){cam.x=tx*T-viewW/cam.z/2;cam.y=ty*T-viewH/cam.z/2;clampCam()}
const toScreen=(x,y)=>({x:(x*T-cam.x)*cam.z,y:(y*T-cam.y)*cam.z});
const toWorld=(sx,sy)=>({x:(sx/cam.z+cam.x)/T,y:(sy/cam.z+cam.y)/T});

// getarnt und gerade nicht enttarnt (für Türme und Einheiten des Gegners)
const hidden=e=>UNITS[e.type]&&UNITS[e.type].stealth&&!(e.revealT>gameT);
function visibleEnt(e){
  if(e.owner===ME)return true;
  if(e.kind==='unit'){if(!vis[idx(e.x|0,e.y|0)])return false;
    // getarnte Kundschafter sieht man nur aus nächster Nähe oder kurz nach einem Kampf
    if(UNITS[e.type]&&UNITS[e.type].stealth&&!(e.revealT>gameT)){for(const o of ents)if(!o.dead&&o.owner===ME&&o.kind==='unit'&&Math.abs(o.x-e.x)<2.5&&Math.abs(o.y-e.y)<2.5)return true;return false}
    return true}
  if(e.kind==='bld')return e.seen;
  return !!exp[idx(e.x,e.y)];
}

// ================= sprites: trees, rocks, buildings (cached, drawn at 2x) =================
const SPR=new Map(),SS=2;
// Realismus-Farbkorrektur: entsättigt, leicht warm, mehr Kontrast, feine Materialkörnung
function grade(c,sat,grain,seed){const g=c.getContext('2d'),W2=c.width,H2=c.height;let im;try{im=g.getImageData(0,0,W2,H2)}catch(e){return}const d=im.data;let r=(seed||7)>>>0;
  for(let i=0;i<d.length;i+=4){if(d[i+3]===0)continue;r=(r*1664525+1013904223)>>>0;const n=((r>>>24)/255-.5)*grain;
    const R0=d[i],G0=d[i+1],B0=d[i+2],L=.3*R0+.59*G0+.11*B0;let R1=L+(R0-L)*sat,G1=L+(G0-L)*sat,B1=L+(B0-L)*sat;
    R1=(R1-128)*1.06+128+4+n;G1=(G1-128)*1.06+128+1+n;B1=(B1-128)*1.06+128-4+n;d[i]=R1<0?0:R1>255?255:R1;d[i+1]=G1<0?0:G1>255?255:G1;d[i+2]=B1<0?0:B1>255?255:B1}
  g.putImageData(im,0,0)}
function sprite(key,w,h,fn){
  let c=SPR.get(key);if(c)return c;
  c=document.createElement('canvas');c.width=w*SS;c.height=h*SS;const g=c.getContext('2d');g.scale(SS,SS);g.lineJoin='round';fn(g);
  if(key.startsWith('b|'))grade(c,.8,14,key.length*31);else if(key.startsWith('bush'))grade(c,.72,14,key.length*9);else if(key.startsWith('stone')||key.startsWith('gold'))grade(c,.85,16,key.length*5);else if(key.startsWith('tree'))grade(c,.82,12,key.length*17);
  c.lw=w;c.lh=h;SPR.set(key,c);return c;
}
function hex2rgb(h){if(h[0]!=='#')return[128,128,128];const n=parseInt(h.slice(1),16);return[n>>16,n>>8&255,n&255]}
function shade(hex,amt){const c=hex2rgb(hex);return `rgb(${Math.max(0,Math.min(255,c[0]+amt))},${Math.max(0,Math.min(255,c[1]+amt))},${Math.max(0,Math.min(255,c[2]+amt))})`}
function blob(g,x,y,r,light,mid,dark){const gr=g.createRadialGradient(x-r*.4,y-r*.45,r*.1,x,y,r);gr.addColorStop(0,light);gr.addColorStop(.55,mid);gr.addColorStop(1,dark);g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
const OUT='rgba(20,16,10,.22)';

const SHADOWS=new Map();
function shadowSprite(sp,key){let c=SHADOWS.get(key);if(c)return c;c=document.createElement('canvas');c.width=sp.width;c.height=sp.height;const g=c.getContext('2d');g.drawImage(sp,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#0a0f08';g.fillRect(0,0,c.width,c.height);SHADOWS.set(key,c);return c}
function treeSprite(v){
  const kind=v<.33?'pine':v<.42?'birch':'leaf',vi=(v*97|0)%6;
  return sprite('tree'+kind+vi,48,64,g=>{
    const r=mulberry32(vi*7+(kind==='pine'?1:kind==='birch'?2:3));
    g.fillStyle='rgba(10,20,8,.28)';g.beginPath();g.ellipse(30,56,15,6,-.2,0,7);g.fill();
    if(kind==='pine'){
      // Fichte: Stamm mit Rindenfurchen, viele hängende Astetagen mit gezackter Unterkante und Nadelstrichen, Licht von oben links
      const tg=g.createLinearGradient(22,0,27,0);tg.addColorStop(0,'#6a4a30');tg.addColorStop(1,'#33241a');g.fillStyle=tg;g.beginPath();g.moveTo(22,57);g.lineTo(23.4,10);g.lineTo(25,10);g.lineTo(27,57);g.closePath();g.fill();
      g.strokeStyle='rgba(20,12,6,.45)';g.lineWidth=.4;g.beginPath();for(let k=0;k<6;k++){const yy=46+r()*10;g.moveTo(22.6,yy);g.lineTo(26.4,yy+.6)}g.stroke();
      const cols=vi%2?['#58744a','#3a5636','#22341f','#16241a']:['#5f7a4c','#40603a','#273d24','#18281a'];
      const L=10;for(let k=0;k<L;k++){const y=6+k*4.1+r(),hw=2.2+k*1.55+(r()-.5)*1.4,dr=2.4+k*.35;
        for(const sd of [-1,1]){const tip=[24+sd*hw,y+dr+1.5],pts=[[24,y-1.2],[24+sd*hw*.55,y+dr*.3],tip];
          // gezackte Unterkante zurück zum Stamm
          const n=4;for(let q=1;q<=n;q++){const t=q/n,xx=24+sd*hw*(1-t),yy=y+dr+2.4-t*1.4+(q%2?1.4:0);pts.push([xx,yy])}
          g.fillStyle=cols[3];g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0]+sd*.6,p[1]+1):g.moveTo(p[0],p[1]+1));g.closePath();g.fill();
          g.fillStyle=sd<0?cols[k<3?0:1]:cols[2];g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();
          g.lineWidth=.55;for(let q=0;q<4+k;q++){const t=r(),xx=24+sd*hw*t,yy=y+dr*t*.8+r()*2;g.strokeStyle=sd<0&&r()<.6?'rgba(150,176,110,.55)':'rgba(10,20,10,.4)';g.beginPath();g.moveTo(xx,yy);g.lineTo(xx+sd*1.3,yy+1.8);g.stroke()}}}
      g.fillStyle=cols[1];g.beginPath();g.moveTo(24,2);g.lineTo(25.6,9);g.lineTo(22.4,9);g.closePath();g.fill();
    }else{
      const trunk=kind==='birch'?'#d9d4c4':'#5a3c24';
      g.fillStyle=trunk;g.beginPath();g.moveTo(21,56);g.lineTo(23,36);g.lineTo(27,36);g.lineTo(28,56);g.closePath();g.fill();
      if(kind==='birch'){g.fillStyle='#3a3a36';for(let i=0;i<4;i++)g.fillRect(22+r()*4,40+i*4,2,1)}
      else{g.fillStyle='rgba(0,0,0,.25)';g.fillRect(26,38,2,18)}
      const pal=kind==='birch'?['#a8bf66','#78963e','#4a6828']:vi===5?['#d2a64a','#a87a2e','#6e4a1c']:vi%2?['#7e9f52','#4f7836','#2b4620']:['#7aa04a','#4a7432','#284420'];
      const blobs=[];for(let i=0;i<6;i++)blobs.push([24+(r()-.5)*18,22+(r()-.5)*16,7+r()*5]);
      g.strokeStyle=trunk;g.lineCap='round';for(const [ex,ey,w] of [[15,24,1.6],[33,22,1.6],[24,16,1.4],[19,30,1.1],[30,31,1.1]]){g.lineWidth=w;g.beginPath();g.moveTo(24.5,38);g.quadraticCurveTo(24+(ex-24)*.3,32,ex,ey);g.stroke()}g.lineCap='butt';
      for(const [x,y,rr] of blobs){g.fillStyle=pal[2];g.beginPath();g.arc(x+1,y+1.5,rr+1.5,0,7);g.fill()}
      for(const [x,y,rr] of blobs.sort((a,b)=>a[1]-b[1]))blob(g,x,y,rr,pal[0],pal[1],pal[2]);
      // Laubstruktur: viele kleine Blattbüschel, oben links im Licht, unten rechts im Schatten
      for(let i=0;i<220;i++){const b=blobs[i%blobs.length],an=r()*6.283,d=Math.sqrt(r())*b[2],x=b[0]+Math.cos(an)*d,y=b[1]+Math.sin(an)*d,lt=(b[0]-x+b[1]-y)/(b[2]*2)+.5;
        g.fillStyle=lt>.75?pal[0]:lt>.4?pal[1]:pal[2];g.globalAlpha=.55+r()*.4;g.beginPath();g.ellipse(x,y,1.1+r()*1.1,.8+r()*.7,r()*3,0,7);g.fill()}
      g.globalAlpha=1;g.fillStyle='rgba(10,20,8,.16)';for(let i=0;i<8;i++){const b=blobs[i%blobs.length];g.beginPath();g.ellipse(b[0]+(r()-.3)*b[2],b[1]+(r()-.2)*b[2]*.8+1,1.6+r(),.7,0,0,7);g.fill()}
      g.fillStyle='rgba(255,255,220,.18)';for(let i=0;i<8;i++){g.beginPath();g.arc(18+r()*12,12+r()*12,1.5,0,7);g.fill()}
    }
  });
}
function stumpSprite(){return sprite('stump',32,32,g=>{g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(17,22,9,4,0,0,7);g.fill();
  g.fillStyle='#5a3c24';g.fillRect(11,15,10,7);g.fillStyle='#c8a46a';g.beginPath();g.ellipse(16,15,5,2.5,0,0,7);g.fill();g.strokeStyle='#8a6a40';g.beginPath();g.ellipse(16,15,2.5,1.2,0,0,7);g.stroke();
  g.fillStyle='#6e4a2b';g.fillRect(3,22,13,3);g.fillRect(5,19,12,3);g.fillStyle='#c8a46a';g.fillRect(15,22,2,3);g.fillRect(16,19,2,3)})}
function bushSprite(v){return sprite('bush'+(v*4|0),32,32,g=>{
  const r=mulberry32((v*4|0)+31);g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(18,24,13,4.5,0,0,7);g.fill();
  // Strauch aus vielen Blattbüscheln: dunkles Inneres, Lichtseite oben links, einzelne Zweige am Fuß
  g.strokeStyle='#3e2c1c';g.lineWidth=.8;g.beginPath();for(let k=0;k<4;k++){const bx=11+k*3.5;g.moveTo(bx,24);g.lineTo(bx+(r()-.5)*4,19)}g.stroke();
  const cl=[];for(let k=0;k<7;k++)cl.push([16+(r()-.5)*15,16+(r()-.5)*9,4+r()*3]);
  for(const [x,y,rr] of cl){g.fillStyle='#1f3416';g.beginPath();g.ellipse(x+.8,y+1,rr+1,rr*.8+1,0,0,7);g.fill()}
  for(let k=0;k<260;k++){const c=cl[k%cl.length],an=r()*6.283,d=Math.sqrt(r())*c[2],x=c[0]+Math.cos(an)*d,y=c[1]+Math.sin(an)*d*.8,lt=(c[0]-x+c[1]-y)/(c[2]*2)+.5;
    g.fillStyle=lt>.75?'#6e8c44':lt>.4?'#47652e':'#2a4120';g.globalAlpha=.6+r()*.4;g.beginPath();g.ellipse(x,y,1+r()*.9,.7+r()*.5,r()*3,0,7);g.fill()}
  g.globalAlpha=1;})}
function rockSprite(kind,v){return sprite(kind+(v*3|0),40,36,g=>{
  const r=mulberry32((v*3|0)+(kind==='gold'?11:5));const gold=kind==='gold';
  g.fillStyle='rgba(10,12,8,.32)';g.beginPath();g.ellipse(22,29,17,6,0,0,7);g.fill();
  // kantige Blöcke unterschiedlicher Größe, nach Bodenlinie sortiert
  const rocks=[];const n=4+(r()*3|0);for(let k=0;k<n;k++){const a=r()*Math.PI*2,d=r()*.8;rocks.push([20+Math.cos(a)*d*11,22+Math.sin(a)*d*6,k===0?9:4+r()*5])}
  rocks.sort((p,q)=>p[1]-q[1]);
  for(const [x,y,s] of rocks){
    const base=gold?[120,108,90]:[124,121,113],m=6+(r()*2|0),pts=[];
    for(let k=0;k<m;k++){const a=-Math.PI+(k+r()*.5)/m*Math.PI*2,rr=s*(.7+r()*.4);pts.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr*.62])}
    const top=[x-s*.15+(r()-.5)*s*.3,y-s*.55];
    const rgb=(mm)=>`rgb(${base.map(c=>Math.max(0,Math.min(255,c*mm|0))).join(',')})`;
    g.fillStyle=rgb(.42);g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]+1.3):g.moveTo(p[0],p[1]+1.3));g.closePath();g.fill();
    // Facetten: jede Kante zur Spitze, Helligkeit nach Ausrichtung zum Licht oben links
    for(let k=0;k<m;k++){const p1=pts[k],p2=pts[(k+1)%m],nx=(p1[0]+p2[0])/2-x,ny=(p1[1]+p2[1])/2-y,l=Math.hypot(nx,ny)||1,lit=(-nx/l*.6-ny/l*.8);
      g.fillStyle=rgb(.82+lit*.38+(r()-.5)*.08);g.beginPath();g.moveTo(top[0],top[1]);g.lineTo(p1[0],p1[1]);g.lineTo(p2[0],p2[1]);g.closePath();g.fill()}
    g.strokeStyle='rgba(255,250,235,.16)';g.lineWidth=.5;g.beginPath();for(let k=0;k<m;k++)if(pts[k][1]<y){g.moveTo(top[0],top[1]);g.lineTo(pts[k][0],pts[k][1])}g.stroke();
    g.strokeStyle='rgba(20,18,14,.4)';g.lineWidth=.6;{const sx=x+(r()-.5)*s*.6,sy=y-s*.2;g.beginPath();g.moveTo(sx,sy);g.lineTo(sx+(r()-.5)*s*.5,sy+s*.25);g.lineTo(sx+(r()-.5)*s*.6,sy+s*.45);g.stroke()}
    g.fillStyle='rgba(176,170,108,.5)';for(let k=0;k<2;k++){g.beginPath();g.arc(x+(r()-.5)*s,y-r()*s*.4,.5+r()*.7,0,7);g.fill()}
    g.fillStyle='rgba(72,92,46,.5)';g.beginPath();g.ellipse(x+(r()-.5)*s*.6,y+s*.4,1.5+r()*2,.8+r()*.6,0,0,7);g.fill();
    if(gold){g.strokeStyle='rgba(214,176,72,.85)';g.lineWidth=.9;for(let k=0;k<2;k++){let gx=x+(r()-.5)*s,gy=y+(r()-.7)*s*.6;g.beginPath();g.moveTo(gx,gy);for(let q=0;q<3;q++){gx+=(r()-.3)*3;gy+=(r()-.4)*2;g.lineTo(gx,gy)}g.stroke()}
      g.fillStyle='rgba(255,236,160,.85)';for(let k=0;k<3;k++)g.fillRect(x+(r()-.5)*s,y+(r()-.7)*s*.6,.9,.9)}
  }
  // Geröll und Grashalme am Fuß
  for(let k=0;k<7;k++){const sx=6+r()*30,sy=26+r()*6;g.fillStyle='rgba(140,134,122,.85)';g.beginPath();g.ellipse(sx,sy,.8+r()*.8,.6+r()*.4,0,0,7);g.fill()}
  g.lineCap='round';for(let k=0;k<14;k++){const gx=4+r()*34,gy=27+r()*5,h=2+r()*3;g.strokeStyle=r()<.6?'rgba(70,98,40,.85)':'rgba(120,130,64,.8)';g.lineWidth=.7;g.beginPath();g.moveTo(gx,gy);g.lineTo(gx+(r()-.5)*2,gy-h);g.stroke()}
})}

function drawRes(g,r){
  const x=r.x*T,y=r.y*T;
  if(r.type==='tree'){
    if(r.amount<r.max){const s=stumpSprite();g.drawImage(s,x,y,32,32);return}
    const s=treeSprite(r.v),t=performance.now()/1000,wind=WX.kind==='storm'?3:WX.kind==='rain'?1.6:1,hit=r.hitT>gameT?Math.sin(t*40)*.05:0;
    const sw=(Math.sin(t*1.3+r.x*.7+r.y*.4)*.025+Math.sin(t*2.9+r.x)*.01)*wind+hit;
    g.save();g.translate(x+16,y+28);g.transform(1,0,sw,1,0,0);g.drawImage(s,-24,-60,48,64);g.restore();return}
  if(r.type==='berry'){
    g.drawImage(bushSprite(r.v),x,y,32,32);
    const n=Math.ceil(r.amount/r.max*10);
    // Beeren in kleinen Dolden, teils im Laub verborgen, matt mit winzigem Glanzpunkt
    for(let i=0;i<n;i++){const a=i*2.4+r.v*6,rr=2+(i%3)*2.4,bx=x+16+Math.cos(a)*rr*1.25,by=y+15+Math.sin(a)*rr*.8;
      for(let k=0;k<3;k++){const ox=bx+(k-1)*1.3,oy=by+(k===1?-1:0);g.fillStyle='#4a1018';g.beginPath();g.arc(ox+.25,oy+.3,.95,0,7);g.fill();g.fillStyle=k===1?'#8a2230':'#741a26';g.beginPath();g.arc(ox,oy,.8,0,7);g.fill()}
      g.fillStyle='rgba(255,235,235,.4)';g.fillRect(bx-.5,by-1.4,.6,.5)}
    return}
  const f=.6+.4*r.amount/r.max,s=rockSprite(r.type,r.v);
  g.drawImage(s,x+16-20*f,y+30-32*f,40*f,36*f);
}

// ---------- buildings
const MAT=[ // Bauweise je Epoche (Epochen aus Bausteinen jenseits der zehnten nutzen die letzte)
  {wall:'logs',roof:'thatch'},{wall:'mud',roof:'thatch'},{wall:'mud',roof:'tile'},{wall:'timber',roof:'tile'},{wall:'timber',roof:'slate'},
  {wall:'stone',roof:'tile'},{wall:'plaster',roof:'slate'},{wall:'brick',roof:'metal'},{wall:'brick',roof:'tar'},{wall:'concrete',roof:'tar'}];
function wallFace(g,x0,y0,x1,y1,col,style){
  const gr=g.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,shade(col,10));gr.addColorStop(1,shade(col,-35));
  g.fillStyle=gr;g.fillRect(x0,y0,x1-x0,y1-y0);
  g.strokeStyle='rgba(0,0,0,.28)';g.lineWidth=.8;g.beginPath();
  if(style==='logs'){for(let y=y0+3;y<y1;y+=3.2){g.moveTo(x0,y);g.lineTo(x1,y)}}
  else if(style==='brick'||style==='mud'){let r=0;for(let y=y0+3;y<y1;y+=3,r++){g.moveTo(x0,y);g.lineTo(x1,y);for(let x=x0+(r%2?3:6);x<x1;x+=6){g.moveTo(x,y-3);g.lineTo(x,y)}}}
  else if(style==='plaster'){for(let x=x0+7;x<x1;x+=7){g.moveTo(x,y0+2);g.lineTo(x,y1)}g.moveTo(x0,y0+2.5);g.lineTo(x1,y0+2.5)}
  else if(style==='concrete'){for(let y=y0+6;y<y1;y+=6){g.moveTo(x0,y);g.lineTo(x1,y)}for(let x=x0+10;x<x1;x+=10){g.moveTo(x,y0);g.lineTo(x,y1)}}
  else if(style==='stone'){let r=0;for(let y=y0+4;y<y1;y+=4,r++){g.moveTo(x0,y);g.lineTo(x1,y);for(let x=x0+(r%2?4:8);x<x1;x+=8){g.moveTo(x,y-4);g.lineTo(x,y)}}}
  g.stroke();
  if(style==='timber'){// Fachwerk: Rähm, Ständer, Brustriegel und Streben, Gefache leicht unterschiedlich gekalkt
    const ym=y0+(y1-y0)*.52;for(let x=x0+1,k=0;x<x1-1;x+=9,k++){g.fillStyle=k%3===1?'rgba(120,100,70,.10)':'rgba(255,250,235,.06)';g.fillRect(x+.8,y0+1.6,Math.min(9,x1-x)-1.6,y1-y0-1.6)}
    g.strokeStyle='#4a3424';g.lineWidth=1.6;g.beginPath();g.moveTo(x0,y0+.8);g.lineTo(x1,y0+.8);g.moveTo(x0,y1-.8);g.lineTo(x1,y1-.8);for(let x=x0+1;x<=x1;x+=9){g.moveTo(x,y0);g.lineTo(x,y1)}g.stroke();
    g.lineWidth=1.1;g.beginPath();g.moveTo(x0,ym);g.lineTo(x1,ym);for(let x=x0+1,k=0;x+9<=x1+.5;x+=9,k++){if(k%2===0){g.moveTo(x,y1-1);g.lineTo(x+9,ym)}else{g.moveTo(x,ym);g.lineTo(x+9,y0+1.5)}}g.stroke();
    g.strokeStyle='rgba(255,220,170,.14)';g.lineWidth=.4;g.beginPath();for(let x=x0+.6;x<=x1;x+=9){g.moveTo(x,y0);g.lineTo(x,y1)}g.stroke()}
  // Materialdetail: einzelne Steine/Bohlen in leicht variierendem Ton, Holzmaserung, Sockelschmutz
  {let sd=((x0*31+y0*17+x1)|0)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
    if(style==='stone'||style==='brick'||style==='mud'){const bh=style==='stone'?4:3,bw=style==='stone'?8:6;let r=0;
      for(let y=y0;y<y1;y+=bh,r++)for(let x=x0-(r%2?bw/2:0);x<x1;x+=bw){const v=rn();if(v<.45)continue;g.fillStyle=v<.7?'rgba(0,0,0,.09)':'rgba(255,245,225,.09)';g.fillRect(Math.max(x0,x)+.4,y+.4,Math.min(bw,x1-x)-.8,bh-.8)}}
    if(style==='logs'||style==='timber'||style==='plank'){g.strokeStyle='rgba(40,25,12,.22)';g.lineWidth=.5;g.beginPath();for(let k=0;k<(x1-x0)/3;k++){const yy=y0+rn()*(y1-y0),xx=x0+rn()*(x1-x0);g.moveTo(xx,yy);g.quadraticCurveTo(xx+3,yy+(rn()-.5),xx+6+rn()*4,yy)}g.stroke()}
    const sg=g.createLinearGradient(0,y1-5,0,y1);sg.addColorStop(0,'rgba(60,45,25,0)');sg.addColorStop(1,'rgba(60,45,25,.35)');g.fillStyle=sg;g.fillRect(x0,y1-5,x1-x0,5)}
  g.strokeStyle='rgba(20,16,10,.16)';g.lineWidth=.8;g.strokeRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1);
}
function hipRoof(g,x0,y0,x1,y1,col,style,inset){
  const ym=(y0+y1)/2,i=inset!==undefined?inset:Math.min((x1-x0)*.3,(y1-y0)*.55);
  const c=hex2rgb(col),C=a=>`rgb(${Math.max(0,Math.min(255,c[0]+a))},${Math.max(0,Math.min(255,c[1]+a))},${Math.max(0,Math.min(255,c[2]+a))})`;
  g.fillStyle=C(22);g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1-i,ym);g.lineTo(x0+i,ym);g.closePath();g.fill();
  g.fillStyle=C(-8);g.beginPath();g.moveTo(x0,y1);g.lineTo(x1,y1);g.lineTo(x1-i,ym);g.lineTo(x0+i,ym);g.closePath();g.fill();
  g.fillStyle=C(34);g.beginPath();g.moveTo(x0,y0);g.lineTo(x0+i,ym);g.lineTo(x0,y1);g.closePath();g.fill();
  g.fillStyle=C(-34);g.beginPath();g.moveTo(x1,y0);g.lineTo(x1-i,ym);g.lineTo(x1,y1);g.closePath();g.fill();
  // texture rows
  g.save();g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1,y1);g.lineTo(x0,y1);g.closePath();g.clip();
  g.strokeStyle=style==='thatch'?'rgba(70,50,20,.35)':style==='metal'||style==='tar'?'rgba(255,255,255,.12)':'rgba(0,0,0,.22)';g.lineWidth=.8;g.beginPath();
  const step=style==='thatch'?2.2:style==='metal'?4:3;
  for(let y=y0+step;y<ym;y+=step){const t=(y-y0)/(ym-y0);g.moveTo(x0+i*t,y);g.lineTo(x1-i*t,y)}
  for(let y=ym+step;y<y1;y+=step){const t=(y1-y)/(y1-ym);g.moveTo(x0+i*t,y);g.lineTo(x1-i*t,y)}
  if(style==='tile'||style==='slate')for(let x=x0+4;x<x1;x+=4){g.moveTo(x,y0);g.lineTo(x,y1)}
  g.stroke();
  // einzelne Schindeln/Ziegel: versetzte Fugen, Farbvarianz, Verwitterung und Moos
  {let sd=((x0*7+y0*13)|0)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
    if(style!=='metal'&&style!=='tar'){const sw=style==='thatch'?2.4:3.6;g.strokeStyle='rgba(0,0,0,.18)';g.lineWidth=.6;g.beginPath();let row=0;
      for(let y=y0+step;y<y1;y+=step,row++)for(let x=x0+(row%2?sw/2:0);x<x1;x+=sw){g.moveTo(x,y-step+.4);g.lineTo(x,y-.2)}g.stroke();
      for(let k=0;k<(x1-x0)*(y1-y0)/14;k++){const px=x0+rn()*(x1-x0),py=y0+rn()*(y1-y0),v=rn();g.fillStyle=v<.5?'rgba(0,0,0,.10)':'rgba(255,240,210,.08)';g.fillRect(px,py,sw*.9,step*.8)}
      g.fillStyle=style==='thatch'?'rgba(60,70,30,.18)':'rgba(70,90,50,.22)';for(let k=0;k<3;k++){g.beginPath();g.ellipse(x0+rn()*(x1-x0),ym+rn()*(y1-ym),2+rn()*4,1+rn()*2,0,0,7);g.fill()}}
    // Regenspuren: dunkler zur Traufe hin
    const lg=g.createLinearGradient(0,ym,0,y1);lg.addColorStop(0,'rgba(0,0,0,0)');lg.addColorStop(1,'rgba(0,0,0,.18)');g.fillStyle=lg;g.fillRect(x0,ym,x1-x0,y1-ym)}
  g.restore();
  g.strokeStyle=C(50);g.lineWidth=1.4;g.beginPath();g.moveTo(x0+i,ym);g.lineTo(x1-i,ym);g.stroke();
  g.strokeStyle='rgba(20,16,10,.35)';g.lineWidth=.8;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1,y1);g.lineTo(x0,y1);g.closePath();g.stroke();
}
function bshadow(g,x0,y0,x1,y1,len){g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(x1,y0+2);g.lineTo(x1+len,y0+2+len*.55);g.lineTo(x1+len,y1+len*.55);g.lineTo(x0+len,y1+len*.55);g.lineTo(x0,y1);g.lineTo(x1,y1);g.closePath();g.fill()}
function door(g,cx,yb,w,h){// Bohlentür mit Steinsturz, Querbalken und Eisenbeschlag
  const top=yb-h+w/2;g.fillStyle='#8a8478';g.beginPath();g.arc(cx,top,w/2+1.4,Math.PI,0);g.lineTo(cx+w/2+1.4,top+1);g.lineTo(cx-w/2-1.4,top+1);g.fill();
  g.fillStyle='#4a3220';g.beginPath();g.moveTo(cx-w/2,yb);g.lineTo(cx-w/2,top);g.arc(cx,top,w/2,Math.PI,0);g.lineTo(cx+w/2,yb);g.closePath();g.fill();
  g.strokeStyle='rgba(20,12,6,.6)';g.lineWidth=.5;for(let k=-w/2+w/4;k<w/2;k+=w/4){g.beginPath();g.moveTo(cx+k,yb);g.lineTo(cx+k,top-Math.sqrt(Math.max(0,w*w/4-k*k))+.4);g.stroke()}
  g.fillStyle='#3a271a';g.fillRect(cx-w/2,yb-h*.3,w,1.1);g.fillRect(cx-w/2,top+1,w,1.1);
  g.fillStyle='#2a2a2a';g.fillRect(cx+w/4,yb-h*.5,1,1);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(cx-w/2-1,yb-.8,w+2,.8)}
function win(g,x,y,lit){// Fenster mit Holzrahmen, Sprossen, Sims und offenen Läden
  g.fillStyle='#4b5a3c';g.fillRect(x-2,y-.3,1.8,4.6);g.fillRect(x+4.2,y-.3,1.8,4.6);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x-2,y+1.4,1.8,.4);g.fillRect(x+4.2,y+1.4,1.8,.4);
  g.fillStyle='#3a2a1a';g.fillRect(x,y,4,4);g.fillStyle=lit?'#f4c86a':'#4f5f68';g.fillRect(x+.6,y+.6,2.8,2.8);
  if(!lit){g.fillStyle='rgba(220,235,245,.35)';g.fillRect(x+.6,y+.6,1.2,1)}g.fillStyle='#3a2a1a';g.fillRect(x+1.8,y,.5,4);g.fillRect(x,y+1.8,4,.5);
  g.fillStyle='#9a9286';g.fillRect(x-.6,y+4,5.2,.9);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x-.6,y+4.9,5.2,.6)}
function banner(g,x,y,pc,h){h=h||18;// Holzmast mit Lichtkante, Tuch mit Falten, Schattenseite und ausgefranster Kante
  g.strokeStyle='#3a2a1a';g.lineWidth=1.5;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h);g.stroke();g.strokeStyle='rgba(255,230,190,.25)';g.lineWidth=.45;g.beginPath();g.moveTo(x-.45,y);g.lineTo(x-.45,y-h);g.stroke();
  const t=y-h+.5,base=hex2rgb(pc[0]==='#'?pc:'#777777'),mix=(k,d)=>`rgb(${base.map(v=>Math.max(0,Math.min(255,Math.round(v*.78+118*.22+d)))).join(',')})`;
  const gr=g.createLinearGradient(x,0,x+11,0);gr.addColorStop(0,mix(0,8));gr.addColorStop(.3,mix(0,-22));gr.addColorStop(.55,mix(0,10));gr.addColorStop(.8,mix(0,-26));gr.addColorStop(1,mix(0,-6));
  g.fillStyle=gr;g.beginPath();g.moveTo(x+.6,t);g.quadraticCurveTo(x+5.5,t+1.6,x+10.5,t+.8);g.lineTo(x+9.2,t+4.4);g.lineTo(x+10.8,t+8.2);g.quadraticCurveTo(x+5.5,t+9.4,x+.6,t+8.8);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+.6,t+7.6,9.5,1.1);g.fillStyle='rgba(255,250,235,.16)';g.fillRect(x+.6,t+.2,9,.7);
  g.fillStyle='#8a7442';g.beginPath();g.arc(x,y-h-1,1.1,0,7);g.fill();g.fillStyle='rgba(255,240,200,.35)';g.fillRect(x-.6,y-h-1.7,.6,.5)}
function hall(g,x0,y0,x1,y1,wallH,mat,col,roof,lit,doorW){ // box building in oblique 3/4 view with a gable roof
  const d=Math.min(18,(x1-x0)*.34),R=d*.55+8,H=Math.max(wallH*1.35,(y1-y0)*.95-d*.25-R),yb=y1,xf=x1-d,c=hex2rgb(roof);
  const C=a=>`rgb(${Math.max(0,Math.min(255,c[0]+a))},${Math.max(0,Math.min(255,c[1]+a))},${Math.max(0,Math.min(255,c[2]+a))})`;
  // shadow toward bottom-right
  g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(xf,yb);g.lineTo(x1,yb-d*.5);g.lineTo(x1+14,yb-d*.5+6);g.lineTo(xf+14,yb+7);g.lineTo(x0+10,yb+7);g.lineTo(x0,yb);g.closePath();g.fill();
  // side wall (in shade)
  g.fillStyle=shade(col,-45);g.beginPath();g.moveTo(xf,yb);g.lineTo(x1,yb-d*.5);g.lineTo(x1,yb-d*.5-H);g.lineTo(xf,yb-H);g.closePath();g.fill();
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.7;g.beginPath();for(let k=3;k<H;k+=3.2){g.moveTo(xf,yb-k);g.lineTo(x1,yb-d*.5-k)}g.stroke();
  // front wall
  wallFace(g,x0,yb-H,xf,yb,col,mat.wall);
  // Bruchsteinsockel
  {const ph=Math.min(3.2,H*.14);g.fillStyle=shade('#8a8274',-6);g.fillRect(x0,yb-ph,xf-x0,ph);g.fillStyle='rgba(255,248,230,.18)';g.fillRect(x0,yb-ph,xf-x0,.5);g.fillStyle='rgba(30,24,16,.35)';for(let x=x0+2;x<xf;x+=3.5+((x*7)%3))g.fillRect(x,yb-ph,.5,ph);
   g.fillStyle=shade('#8a8274',-50);g.beginPath();g.moveTo(xf,yb);g.lineTo(x1,yb-d*.5);g.lineTo(x1,yb-d*.5-ph);g.lineTo(xf,yb-ph);g.closePath();g.fill()}
  // gable end on the side
  const rl={x:x0+d*.5,y:yb-H-d*.25-R},rr={x:x1-d*.5,y:yb-H-d*.25-R};
  g.fillStyle=shade(col,-30);g.beginPath();g.moveTo(xf,yb-H);g.lineTo(x1,yb-H-d*.5);g.lineTo(rr.x,rr.y);g.closePath();g.fill();
  if(mat.wall==='timber'){g.strokeStyle='#4a3424';g.lineWidth=1.2;g.beginPath();g.moveTo(xf,yb-H);g.lineTo(rr.x,rr.y);g.lineTo(x1,yb-H-d*.5);g.stroke()}
  // back roof slope (barely visible), then front slope
  g.fillStyle=C(-30);g.beginPath();g.moveTo(rl.x,rl.y);g.lineTo(rr.x,rr.y);g.lineTo(x1+1.5,yb-H-d*.5);g.lineTo(x0+d+1.5,yb-H-d*.5);g.closePath();g.fill();
  const fr=[[x0-2.5,yb-H+3],[xf+2.5,yb-H+3],[rr.x+1.5,rr.y],[rl.x-1.5,rl.y]];
  const gr=g.createLinearGradient(0,rl.y,0,yb-H+3);gr.addColorStop(0,C(28));gr.addColorStop(1,C(-12));
  g.fillStyle=gr;g.beginPath();fr.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();
  // roof texture rows parallel to the eave
  g.save();g.beginPath();fr.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.clip();
  g.strokeStyle=mat.roof==='thatch'?'rgba(80,58,20,.4)':mat.roof==='metal'||mat.roof==='tar'?'rgba(255,255,255,.14)':'rgba(0,0,0,.25)';g.lineWidth=.8;g.beginPath();
  const st=mat.roof==='thatch'?2:mat.roof==='metal'?4.5:3;
  for(let t=st;t<yb-H+3-rl.y;t+=st){const y=yb-H+3-t,f=t/(yb-H+3-rl.y);g.moveTo(x0-2.5+(rl.x-x0)*f,y);g.lineTo(xf+2.5+(rr.x-xf)*f,y)}
  if(mat.roof==='tile'||mat.roof==='slate'){for(let x=x0;x<xf;x+=4){g.moveTo(x,yb-H+3);g.lineTo(x+(rl.x-x0)*.9,rl.y)}}
  g.stroke();g.restore();
  g.strokeStyle=C(55);g.lineWidth=1.5;g.beginPath();g.moveTo(rl.x,rl.y);g.lineTo(rr.x,rr.y);g.stroke();
  g.strokeStyle=OUT;g.lineWidth=1;g.beginPath();fr.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.stroke();
  g.beginPath();g.moveTo(xf+2.5,yb-H+3);g.lineTo(x1+1.5,yb-H-d*.5+1);g.lineTo(rr.x+1.5,rr.y);g.stroke();
  // eave shadow on the wall
  g.fillStyle='rgba(0,0,0,.28)';g.fillRect(x0,yb-H+3,xf-x0,2.5);
  const n=Math.max(1,Math.floor((xf-x0)/13));for(let i=0;i<n;i++){const wx=x0+(i+.5)*(xf-x0)/n-2;if(Math.abs(wx+2-(x0+xf)/2)>(doorW||6))win(g,wx,yb-H*.62,lit)}
  door(g,(x0+xf)/2,yb,doorW||6,Math.min(H-4,10));
}
function roundTower(g,cx,yb,r,h,col,roofCol,ep,pc){
  g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.ellipse(cx+8,yb+2,r+4,r*.5,0,0,7);g.fill();
  const gr=g.createLinearGradient(cx-r,0,cx+r,0);gr.addColorStop(0,shade(col,25));gr.addColorStop(.5,shade(col,0));gr.addColorStop(1,shade(col,-45));
  g.fillStyle=gr;g.fillRect(cx-r,yb-h,r*2,h);g.beginPath();g.ellipse(cx,yb,r,r*.45,0,0,Math.PI);g.fill();
  g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.8;g.beginPath();for(let y=yb-h+4;y<yb;y+=4){g.moveTo(cx-r,y);g.lineTo(cx+r,y)}g.stroke();
  win(g,cx-2,yb-h*.55,true);
  g.fillStyle=shade(col,10);g.beginPath();g.ellipse(cx,yb-h,r+1.5,(r+1.5)*.45,0,0,7);g.fill();
  if(ep>=3){g.fillStyle=shade(col,-20);for(let a=0;a<6;a++){const ax=cx+Math.cos(Math.PI+a*Math.PI/5)*r;g.fillRect(ax-1.5,yb-h-4,3,4)}banner(g,cx,yb-h,pc,14)}
  else{g.fillStyle=roofCol;g.beginPath();g.moveTo(cx-r-3,yb-h);g.lineTo(cx,yb-h-r*1.6);g.lineTo(cx+r+3,yb-h);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.moveTo(cx,yb-h-r*1.6);g.lineTo(cx+r+3,yb-h);g.lineTo(cx+2,yb-h);g.closePath();g.fill();
    g.strokeStyle=OUT;g.lineWidth=1;g.beginPath();g.moveTo(cx-r-3,yb-h);g.lineTo(cx,yb-h-r*1.6);g.lineTo(cx+r+3,yb-h);g.stroke();banner(g,cx,yb-h-r*1.6+1,pc,10)}
}
function bldSprite(type,rep,owner){
  const ep=VIS(rep),D=BLD[type],S=D.size*T,mat=MAT[Math.min(rep,MAT.length-1)],col=WALL[rep]||'#999',roof=ROOF[rep]||'#777',pc=PCOL[owner];
  return sprite(`b|${type}|${rep}|${owner}`,S+24,S+44,g=>{
    const bx=4,by=36,x1=bx+S,y1=by+S,lit=ep>=2;
    if(type==='house'){
      // Hofstelle: festgetretener Vorplatz, Garten mit Flechtzaun, Holzstapel, Regentonne, Wäscheleine
      const hx1=x1-21,hyb=y1-7,dcx=(bx+3+hx1-Math.min(18,(hx1-bx-3)*.34))/2;let sd=(ep*977+owner*131)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
      g.fillStyle='rgba(112,92,62,.38)';g.beginPath();g.ellipse(dcx+2,hyb+3,14,4.5,0,0,7);g.fill();
      if(ep<=6){const gx0=hx1+1,gx1=x1-1,gy0=by+S*.52,gy1=y1-2;g.fillStyle='rgba(8,14,6,.25)';g.fillRect(gx0+2,gy0+2,gx1-gx0,gy1-gy0);
        g.fillStyle='#5a4630';g.fillRect(gx0,gy0,gx1-gx0,gy1-gy0);for(let y=gy0+2;y<gy1-1;y+=3){g.fillStyle='rgba(30,20,10,.35)';g.fillRect(gx0+1,y+1.2,gx1-gx0-2,.7);for(let x=gx0+2;x<gx1-1;x+=2.6){if(rn()<.3)continue;g.fillStyle=rn()<.5?'#5f7a36':'#728c40';g.beginPath();g.arc(x+(rn()-.5),y+.4,.6+rn()*.8,0,7);g.fill()}}
        g.strokeStyle='#6b5434';g.lineWidth=.9;g.beginPath();g.moveTo(gx0,gy0);g.lineTo(gx1,gy0);g.lineTo(gx1,gy1);g.lineTo(gx0,gy1);g.stroke();g.fillStyle='#4e3a24';for(let y=gy0;y<=gy1;y+=4){g.fillRect(gx1-.6,y-2.5,1.2,2.8)}for(let x=gx0;x<=gx1;x+=4){g.fillRect(x-.6,gy1-2.5,1.2,2.8)}}
      hall(g,bx+3,by,hx1,hyb,10,mat,col,roof,lit,6);
      if(ep>=2){const cx2=hx1-24;g.fillStyle=shade(col,-30);g.fillRect(cx2,by-8,5,12);g.fillStyle=shade(col,-55);g.fillRect(cx2+3.5,by-8,1.5,12);g.fillStyle='#2a2622';g.fillRect(cx2-.5,by-9,6,1.6);g.fillStyle='rgba(255,240,210,.18)';g.fillRect(cx2,by-7.4,1,10)}
      // Holzstapel an der Seitenwand
      {const wx=hx1-12,wy=hyb+1;g.fillStyle='rgba(8,14,6,.3)';g.fillRect(wx+2,wy-1,13,3);for(let r=0;r<3;r++)for(let k=0;k<5-r;k++){const lx=wx+1.5+k*2.4+r*1.2,ly=wy-1.4-r*2.1;g.fillStyle='#4a3420';g.beginPath();g.arc(lx,ly,1.25,0,7);g.fill();g.fillStyle=rn()<.5?'#b48e5c':'#a27c4c';g.beginPath();g.arc(lx,ly,.85,0,7);g.fill();g.fillStyle='rgba(90,60,30,.6)';g.fillRect(lx-.15,ly-.15,.3,.3)}}
      // Regentonne neben der Tür
      {const tx=bx+8,ty=hyb+1.5;g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(tx+2,ty+.5,3.4,1.3,0,0,7);g.fill();const bg=g.createLinearGradient(tx-2.4,0,tx+2.4,0);bg.addColorStop(0,'#86663e');bg.addColorStop(1,'#43311d');g.fillStyle=bg;g.fillRect(tx-2.4,ty-5,4.8,5);g.fillStyle='#2f2a24';g.fillRect(tx-2.4,ty-4.2,4.8,.5);g.fillRect(tx-2.4,ty-1.4,4.8,.5);g.fillStyle='#24323a';g.beginPath();g.ellipse(tx,ty-5,2.4,.9,0,0,7);g.fill();g.fillStyle='rgba(190,215,225,.35)';g.fillRect(tx-1,ty-5.3,1.2,.4)}
      // Wäscheleine, ein Tuch in Spielerfarbe
      if(ep>=1&&ep<=8){const l0=x1-17,l1=x1-3,ly=by+S*.46;g.strokeStyle='#4e3a24';g.lineWidth=.9;g.beginPath();g.moveTo(l0,ly+6);g.lineTo(l0,ly-3);g.moveTo(l1,ly+6);g.lineTo(l1,ly-3);g.stroke();g.strokeStyle='rgba(220,210,190,.7)';g.lineWidth=.35;g.beginPath();g.moveTo(l0,ly-2.6);g.quadraticCurveTo((l0+l1)/2,ly-1.4,l1,ly-2.6);g.stroke();
        g.fillStyle=pc;g.fillRect(l0+1.2,ly-2.3,3,3.6);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(l0+3.4,ly-2.3,.8,3.6);g.fillStyle='#d8d0bc';g.fillRect(l0+5,ly-2.1,2.6,2.8);g.fillStyle='rgba(0,0,0,.15)';g.fillRect(l0+7,ly-2.1,.6,2.8)}
    }else if(type==='tc'){
      // Schatten nur von Umfassung und Türmen, nicht als massiver Block
      g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(x1,by+5);g.lineTo(x1+7,by+9);g.lineTo(x1+7,y1+4);g.lineTo(bx+7,y1+4);g.lineTo(bx,y1);g.lineTo(x1,y1);g.closePath();g.fill();
      // enclosure: palisade (stone age) or wall
      if(ep===0){for(let x=bx;x<=x1;x+=3.2){for(const yy of [by+6,y1-1]){g.fillStyle='#6b4a2a';g.fillRect(x,yy-6,2.6,7);g.fillStyle='#8f6a40';g.beginPath();g.moveTo(x,yy-6);g.lineTo(x+1.3,yy-8);g.lineTo(x+2.6,yy-6);g.fill()}}
        for(let y=by+6;y<=y1;y+=3.2)for(const xx of [bx,x1-2.6]){g.fillStyle='#5e4026';g.fillRect(xx,y-6,2.6,7)}}
      else{// Mauerkrone aus Decksteinen mit Fugen, Flechten und Schattenkante zum Hof
        const crown=(x,y,w,h,hor)=>{g.fillStyle=shade(col,-22);g.fillRect(x,y,w,h);let sd=((x*13+y*7)|0)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
          g.fillStyle='rgba(30,24,16,.35)';if(hor){for(let k=x+2;k<x+w;k+=3+rn()*2.5)g.fillRect(k,y,.5,h)}else{for(let k=y+2;k<y+h;k+=3+rn()*2.5)g.fillRect(x,k,w,.5)}
          for(let k=0;k<(w*h)/10;k++){g.fillStyle=rn()<.6?'rgba(0,0,0,.08)':'rgba(255,245,225,.1)';g.fillRect(x+rn()*w,y+rn()*h,1.4,1)}
          g.fillStyle='rgba(255,246,226,.18)';hor?g.fillRect(x,y,w,.6):g.fillRect(x,y,.6,h);g.fillStyle='rgba(80,96,52,.25)';g.fillRect(x+rn()*(w-3),y+rn()*(h-2),3,1.5)};
        crown(bx,by+4,S,4,1);crown(bx,by+8,4,S-8,0);crown(x1-4,by+8,4,S-8,0);g.fillStyle='rgba(0,0,0,.22)';g.fillRect(bx+4,by+8,S-8,1.5);g.fillRect(bx+4,by+8,1.2,S-15);
        wallFace(g,bx,y1-7,x1,y1,col,ep>=3?'stone':mat.wall);for(let x=bx;x<x1;x+=5){g.fillStyle=shade(col,-5);g.fillRect(x,y1-10,3,3)}}
      // Hof: festgetretener Lehm mit Kies, Radspuren und ab der Eisenzeit Pflaster
      {const cx0=bx+(ep===0?3:4),cy0=by+(ep===0?7:8),cw=S-(ep===0?6:8),ch=S-(ep===0?14:15);let sd=(ep*389+7)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
        g.save();g.beginPath();g.rect(cx0,cy0,cw,ch);g.clip();g.fillStyle='#6f6048';g.fillRect(cx0,cy0,cw,ch);
        if(ep>=3){let r=0;for(let y=cy0;y<cy0+ch+2;y+=2.8,r++)for(let x=cx0-2+(r%2?2:0);x<cx0+cw+2;x+=4){g.fillStyle=['#8a8070','#7d7466','#958a78','#837a6a'][(rn()*4)|0];g.beginPath();g.ellipse(x+(rn()-.5),y,1.6+rn()*.4,1.1,0,0,7);g.fill();g.fillStyle='rgba(255,246,225,.1)';g.fillRect(x-.8,y-.8,1.2,.5)}}
        else{for(let k=0;k<cw*ch/9;k++){g.fillStyle=rn()<.5?'rgba(150,130,96,.45)':'rgba(70,58,40,.35)';g.fillRect(cx0+rn()*cw,cy0+rn()*ch,.8+rn(),.6+rn()*.6)}
          g.strokeStyle='rgba(60,46,30,.35)';g.lineWidth=1.1;g.beginPath();for(const o of [-3,3]){g.moveTo(cx0+cw/2+o,cy0+ch);g.quadraticCurveTo(cx0+cw/2+o+4,cy0+ch*.6,cx0+cw*.3+o,cy0+ch*.25)}g.stroke()}
        for(let k=0;k<10;k++){g.fillStyle=`rgba(${rn()<.5?'60,46,28':'50,60,34'},${.08+rn()*.1})`;g.beginPath();g.ellipse(cx0+rn()*cw,cy0+rn()*ch,2+rn()*6,1.5+rn()*3,0,0,7);g.fill()}
        const eg=g.createLinearGradient(0,cy0,0,cy0+6);eg.addColorStop(0,'rgba(0,0,0,.3)');eg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=eg;g.fillRect(cx0,cy0,cw,6);g.restore()}
      hall(g,bx+12,by+2,x1-12,y1-12,13,mat,col,roof,lit,9);
      if(ep>=1){roundTower(g,bx+8,y1-5,6,22+ep*3,col,roof,ep,pc);roundTower(g,x1-8,y1-5,6,22+ep*3,col,roof,ep,pc)}
      if(ep>=3){g.fillStyle=shade(roof,20);g.beginPath();g.arc((bx+x1)/2,by+12,9,Math.PI,0);g.fill();g.fillStyle=shade(roof,-20);g.beginPath();g.arc((bx+x1)/2,by+12,9,-Math.PI/2,0);g.lineTo((bx+x1)/2,by+12);g.fill()}
      banner(g,(bx+x1)/2,by+(ep>=3?3:8),pc,20);
    }else if(['barracks','range','stable','workshop'].includes(type)){
      // jedes Militärgebäude mit eigener Silhouette (Empire-Earth-Art), ab Industriezeitalter moderne Bauweise
      const modern=rep>=7,yard=by+S*.55,yy=by+S*.78;
      g.fillStyle=modern?'rgba(120,120,112,.55)':'rgba(120,98,66,.55)';g.fillRect(bx+2,yard,S-4,S*.42);
      const fence=()=>{g.strokeStyle=modern?'#8b8f90':'#6b4a2a';g.lineWidth=1.5;g.beginPath();g.moveTo(bx+2,y1-2);g.lineTo(x1-2,y1-2);g.moveTo(bx+2,yard);g.lineTo(bx+2,y1-2);g.moveTo(x1-2,yard);g.lineTo(x1-2,y1-2);g.stroke();
        for(let x=bx+2;x<=x1-2;x+=8){g.fillStyle=modern?'#6b6f70':'#4a3220';g.fillRect(x-1,y1-6,2,5)}};
      if(type==='barracks'){
        hall(g,bx+2,by-4,x1-26,by+S*.58,12,mat,col,roof,lit,8);
        if(modern){g.strokeStyle='#5d6266';g.lineWidth=1.2;g.beginPath();g.moveTo(x1-14,by+S*.55);g.lineTo(x1-14,by-26);g.moveTo(x1-20,by-6);g.lineTo(x1-14,by-26);g.lineTo(x1-8,by-6);g.stroke();g.fillStyle='#d33';g.beginPath();g.arc(x1-14,by-27,1.6,0,7);g.fill()}
        else if(ep>=2)roundTower(g,x1-14,by+S*.55,8,34+ep*4,col,roof,ep,pc);
        else{g.strokeStyle='#5a3f22';g.lineWidth=2;g.beginPath();for(const px of [x1-22,x1-8]){g.moveTo(px,by+S*.55);g.lineTo(px,by-8)}g.stroke();g.fillStyle='#7a5530';g.fillRect(x1-24,by-12,18,5);hipRoof(g,x1-25,by-22,x1-5,by-11,roof,mat.roof,4)}
        fence();
        if(modern){for(let i=0;i<5;i++){g.fillStyle=i%2?'#a89a72':'#b9ab82';g.beginPath();g.ellipse(bx+12+i*7,yy+6,4,2.6,0,0,7);g.fill()}}
        else{g.strokeStyle='#5a3f22';g.lineWidth=1.5;g.beginPath();g.moveTo(bx+10,yy+6);g.lineTo(bx+34,yy+6);g.stroke();
          for(let i=0;i<5;i++){g.strokeStyle=ep>=3?'#555':'#b9bec2';g.beginPath();g.moveTo(bx+12+i*5,yy+7);g.lineTo(bx+14+i*5,yy-8);g.stroke()}}
        g.fillStyle='#8a6a40';g.beginPath();g.arc(x1-24,yy+2,4,0,7);g.fill();g.fillStyle='#5a3f22';g.fillRect(x1-25,yy+2,2,8);g.fillRect(x1-29,yy+1,10,1.6);
        banner(g,bx+8,by+S*.5,pc,22);
      }else if(type==='range'){
        // offene Schießhalle: Dach auf Pfosten, Bahnen mit Zielscheiben
        const t0=by+2,t1=by+S*.5;g.fillStyle='rgba(0,0,0,.25)';g.fillRect(bx+6,t1-4,S-12,6);
        for(let x=bx+6;x<=x1-6;x+=(S-12)/4){g.fillStyle=modern?'#7c8184':'#5a3f22';g.fillRect(x-1.5,t0+8,3,t1-t0-8)}
        hipRoof(g,bx+2,t0-6,x1-2,t0+12,roof,mat.roof,6);
        g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1;g.beginPath();for(let i=1;i<4;i++){const lx=bx+2+i*(S-4)/4;g.moveTo(lx,t1+2);g.lineTo(lx,y1-4)}g.stroke();
        for(const tx of [bx+14,bx+S/2-6,bx+S/2+10,x1-14]){
          if(modern){g.fillStyle='#2b2b2b';g.beginPath();g.arc(tx,yy-6,2.6,0,7);g.fill();g.fillRect(tx-4,yy-3,8,10)}
          else{g.fillStyle='#5a3f22';g.fillRect(tx-1,yy,2,9);g.fillStyle='#a8925e';g.beginPath();g.ellipse(tx,yy,4.6,4.2,0,0,7);g.fill();g.strokeStyle='rgba(80,60,30,.6)';g.lineWidth=.6;g.beginPath();for(let k=-3;k<=3;k+=1.5){g.moveTo(tx-4,yy+k);g.lineTo(tx+4,yy+k)}g.stroke();g.fillStyle='#6e2a22';g.beginPath();g.arc(tx,yy,1.4,0,7);g.fill()}}
        fence();banner(g,x1-6,t0-4,pc,16);
      }else if(type==='stable'){
        // langer, niedriger Stall mit Boxen, davor Koppel mit Pferden (modern: Garage mit Fahrzeugen)
        hall(g,bx+2,by+6,x1-2,by+S*.58,10,mat,col,roof,lit,0);
        const fy=by+S*.58,n=4;for(let i=0;i<n;i++){const cx=bx+12+i*(S-36)/(n-1);
          if(modern){g.fillStyle='#6f7477';g.fillRect(cx-6,fy-13,12,13);g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=.6;g.beginPath();for(let k=fy-11;k<fy;k+=2){g.moveTo(cx-6,k);g.lineTo(cx+6,k)}g.stroke()}
          else{door(g,cx,fy,9,12);g.fillStyle='#6e4a2b';g.fillRect(cx-4.5,fy-6,9,1.2)}}
        fence();
        if(modern){for(const vx of [bx+22,x1-26]){g.fillStyle='#4e5a3c';g.fillRect(vx-9,yy-3,18,8);g.fillStyle='#3d4730';g.fillRect(vx-4,yy-7,10,5);g.fillStyle='#222';for(const wx of [vx-6,vx+6]){g.beginPath();g.arc(wx,yy+5,2.4,0,7);g.fill()}}}
        else{for(const [hx,hy,c] of [[x1-26,yy+2,'#6e4a2b'],[bx+24,yy+4,'#3e2a1a']]){g.fillStyle=c;g.beginPath();g.ellipse(hx,hy,7,3.5,0,0,7);g.fill();g.beginPath();g.ellipse(hx+8,hy-3,3,2.2,-.6,0,7);g.fill();g.fillRect(hx-5,hy+2,1.6,5);g.fillRect(hx+4,hy+2,1.6,5)}
          g.fillStyle='#d6b85a';g.fillRect(bx+40,yy-2,8,6);g.strokeStyle='#9a7f34';g.lineWidth=.8;g.strokeRect(bx+40,yy-2,8,6)}
        banner(g,x1-6,by+6,pc,16);
      }else{
        // Werkstatt: Halle mit Schornsteinen und Kran (modern: Fabrik mit Sheddach)
        hall(g,bx+2,by-4,x1-2,by+S*.58,12,mat,col,roof,lit,12);
        const chim=(cx,h)=>{g.fillStyle=modern?'#7a4436':shade(col,-30);g.fillRect(cx-3,by-4-h,6,h+10);g.fillStyle='#2a2a2a';g.fillRect(cx-3.5,by-6-h,7,2.5)};
        if(rep>=3)chim(bx+14,14+rep*2);if(modern){chim(bx+26,22+rep*2);
          g.fillStyle=shade(roof,-10);for(let i=0;i<4;i++){const sx=bx+34+i*12;g.beginPath();g.moveTo(sx,by+2);g.lineTo(sx+12,by-8);g.lineTo(sx+12,by+2);g.closePath();g.fill();g.fillStyle='#a9c4d2';g.fillRect(sx+10.5,by-7,1.5,8);g.fillStyle=shade(roof,-10)}}
        fence();
        g.strokeStyle=modern?'#c9a227':'#5a3f22';g.lineWidth=2;g.beginPath();g.moveTo(x1-26,y1-4);g.lineTo(x1-18,yy-18);g.lineTo(x1-10,y1-4);g.moveTo(x1-18,yy-18);g.lineTo(x1-38,yy-12);g.stroke();
        g.strokeStyle='#888';g.lineWidth=.8;g.beginPath();g.moveTo(x1-38,yy-12);g.lineTo(x1-38,yy-2);g.stroke();g.fillStyle='#7a5530';g.fillRect(x1-42,yy-2,8,5);
        if(modern){g.fillStyle='#5a6266';g.fillRect(bx+8,yy-2,20,10);g.fillStyle='#3a4044';g.fillRect(bx+10,yy-6,8,4)}
        else{for(let i=0;i<3;i++){g.fillStyle='#7a5530';g.fillRect(bx+8,yy-2+i*3,16,2.5)}g.strokeStyle='#4a3220';g.lineWidth=1.6;g.beginPath();g.arc(bx+34,yy+3,5,0,7);g.stroke()}
        banner(g,x1-6,by-2,pc,16);
      }
    }else if(type==='camp'){
      bshadow(g,bx+2,by+4,x1-2,y1-2,8);
      g.fillStyle='rgba(120,98,66,.5)';g.fillRect(bx+2,by+4,S-4,S-6);
      g.fillStyle='#4a3220';g.fillRect(bx+4,by+4,2,16);g.fillRect(x1-6,by+4,2,16);
      hipRoof(g,bx+1,by-2,x1-1,by+14,roof,mat.roof,0);
      for(let i=0;i<4;i++){g.fillStyle=i%2?'#7a5530':'#8f6a40';g.fillRect(bx+5,y1-14+i*2.6,18,2.4);g.fillStyle='#c8a46a';g.beginPath();g.arc(bx+23,y1-12.8+i*2.6,1.2,0,7);g.fill()}
      for(const [sx,sy] of [[x1-18,y1-10],[x1-12,y1-12],[x1-15,y1-15]])blob(g,sx,sy,3.5,'#c3c9ce','#9aa1a8','#6c737a');
      g.fillStyle='#8a6a40';g.beginPath();g.arc(x1-8,y1-7,3.5,0,7);g.fill();g.fillStyle='#e8c650';g.beginPath();g.arc(x1-8,y1-9,2,0,7);g.fill();
      g.fillStyle=pc;g.fillRect(bx+4,by+14,S-8,2);
    }else if(type==='tower'){
      roundTower(g,(bx+x1)/2,y1-6,S*.3,S*.78,ep>=3?'#9a9890':col,roof,ep,pc);
    }else if(type==='wonder'){
      bshadow(g,bx+2,by+4,x1-2,y1-2,14);
      const stone=ep>=2?'#d8cfb8':'#c9b07a';
      for(let i=0;i<4;i++){const m=i*8,h=6;const x0=bx+2+m,xx=x1-2-m,yb=y1-2-i*h*1.3;
        g.fillStyle=shade(stone,-30+i*6);g.fillRect(x0,yb-h,xx-x0,h);g.fillStyle=shade(stone,10+i*8);g.fillRect(x0,yb-h-(S-2*m)*.35,xx-x0,(S-2*m)*.35);
        g.strokeStyle=OUT;g.lineWidth=.8;g.strokeRect(x0+.5,yb-h-(S-2*m)*.35+.5,xx-x0-1,(S-2*m)*.35+h-1)}
      const cx=(bx+x1)/2,cy=y1-2-4*6*1.3-12;
      if(ep>=3){g.fillStyle='#e9be72';g.beginPath();g.arc(cx,cy,12,Math.PI,0);g.fill();g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.arc(cx,cy,12,-Math.PI/2,0);g.lineTo(cx,cy);g.fill()}
      else{g.fillStyle='#e9be72';g.beginPath();g.moveTo(cx-8,cy+4);g.lineTo(cx,cy-10);g.lineTo(cx+8,cy+4);g.closePath();g.fill()}
      banner(g,cx,cy-(ep>=3?10:9),pc,16);
    }else if(type==='farm'){
      // Acker: Erde mit Furchen, dichte Halme in leicht wechselnden Tönen, Feldrain
      let sd=(ep*97+7)>>>0;const rn=()=>((sd=(sd*1664525+1013904223)>>>0)/4294967296);
      g.fillStyle='#5e4a30';g.fillRect(bx+2,by+2,S-4,S-4);
      const rows=9,rh=(S-8)/rows;
      for(let i=0;i<rows;i++){const yy=by+4+i*rh;g.fillStyle='#6f5838';g.fillRect(bx+3,yy,S-6,rh*.45);g.fillStyle='#4a3a24';g.fillRect(bx+3,yy+rh*.55,S-6,rh*.3);
        for(let x=bx+4;x<x1-3;x+=1.6){const h=2.5+rn()*2.2,c=ep>=2?[[196,168,82],[178,150,70],[210,184,96]]:[[118,146,70],[100,130,60],[134,158,78]];const k=c[rn()*3|0];
          g.strokeStyle=`rgba(${k[0]},${k[1]},${k[2]},.9)`;g.lineWidth=.8;g.beginPath();g.moveTo(x,yy+rh*.5);g.lineTo(x+(rn()-.5),yy+rh*.5-h);g.stroke();
          if(ep>=2&&rn()<.5){g.fillStyle=`rgb(${k[0]+20},${k[1]+16},${k[2]})`;g.fillRect(x-.5,yy+rh*.5-h-1.2,1,1.6)}}}
      g.fillStyle='rgba(90,110,50,.5)';g.fillRect(bx+1,by+1,S-2,1.5);g.fillRect(bx+1,y1-2.5,S-2,1.5);g.fillRect(bx+1,by+1,1.5,S-2);g.fillRect(x1-2.5,by+1,1.5,S-2);
      for(const [px,py] of [[bx+2,by+2],[x1-4,by+2],[bx+2,y1-4],[x1-4,y1-4]]){g.fillStyle='#4a3220';g.fillRect(px,py-3,1.6,4)}
      g.fillStyle=pc;g.fillRect(bx+2,by-2,3,2);
    }else{ // building from an add-on module without own drawing
      hall(g,bx+3,by,x1-3,y1-2,12,mat,col,roof,lit,7);
      g.fillStyle='#f1e6cf';g.font='600 '+(S*.3|0)+'px "Alegreya SC",Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(D.name[0],(bx+x1)/2,by+S*.3);
      banner(g,x1-6,by,pc,14);
    }
  });
}
const FLAGB={tc:1,barracks:1,castle:1,fort:1,milcamp:1};
function drawFlag(g,b){// wehende Stoff-Fahne in Spielerfarbe, Wind wie bei den Bäumen
  const x=(b.x+b.size-.35)*T,y=b.y*T-8,h=26,w=16,c=PCOL[b.owner]||'#888';g.save();
  g.strokeStyle='#4a3a28';g.lineWidth=1.6;g.beginPath();g.moveTo(x,y+h);g.lineTo(x,y-h*.2);g.stroke();
  g.fillStyle='#b89a50';g.beginPath();g.arc(x,y-h*.2,1.6,0,7);g.fill();
  const t=gameT*4+b.id;g.beginPath();g.moveTo(x,y-h*.15);
  for(let i=1;i<=8;i++){const u=i/8;g.lineTo(x+u*w,y-h*.15+Math.sin(t-u*4)*u*2.5)}
  for(let i=8;i>=0;i--){const u=i/8;g.lineTo(x+u*w,y-h*.15+10+Math.sin(t-u*4)*u*2.5)}
  g.closePath();g.fillStyle=c;g.globalAlpha=.92;g.fill();
  g.globalAlpha=.22;g.fillStyle='#000';g.beginPath();for(let i=0;i<=8;i++){const u=i/8;g.lineTo(x+u*w,y-h*.15+10+Math.sin(t-u*4)*u*2.5-(Math.cos(t-u*4)>0?3:0))}g.lineTo(x,y-h*.15+10);g.fill();
  g.restore()}
// ================= Baustein-Gebäude im Stil der Kerngebäude (Schrägansicht, Material je Epoche, Kleinteile) =================
// Ersetzt die flachen Platzhalter der Bausteine: das Bild wird als Sprite gecacht, Bewegtes (Glut, Sägeblatt, Mühlflügel) kommt live darüber.
const BGFX={},BGFX_LIVE={};
const BG=(()=>{
  const crate=(g,x,y,w)=>{g.fillStyle='rgba(8,14,6,.3)';g.fillRect(x+2,y-1,w+2,2.4);g.fillStyle='#8a6a3e';g.fillRect(x,y-w,w,w);g.fillStyle='#64482a';g.fillRect(x+w,y-w-1,1.8,w+1);g.fillStyle='#a8865a';g.fillRect(x,y-w-1.4,w+1.8,1.4);
    g.strokeStyle='rgba(40,24,10,.45)';g.lineWidth=.5;g.beginPath();g.moveTo(x,y-w);g.lineTo(x+w,y);g.moveTo(x,y-w*.5);g.lineTo(x+w,y-w*.5);g.stroke()};
  const barrel=(g,x,y)=>{g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(x+1.5,y,3,1,0,0,7);g.fill();const bg=g.createLinearGradient(x-2.4,0,x+2.4,0);bg.addColorStop(0,'#8a6440');bg.addColorStop(1,'#4a3220');g.fillStyle=bg;g.beginPath();g.ellipse(x,y-3,2.4,3.4,0,0,7);g.fill();
    g.fillStyle='#3a3a3a';g.fillRect(x-2.3,y-5,4.6,.6);g.fillRect(x-2.3,y-1.6,4.6,.6);g.fillStyle='#9a7a50';g.beginPath();g.ellipse(x,y-6.2,2,.8,0,0,7);g.fill()};
  const sack=(g,x,y,c)=>{g.fillStyle='rgba(8,14,6,.25)';g.beginPath();g.ellipse(x+1,y,3,1,0,0,7);g.fill();g.fillStyle=c||'#c8b48a';g.beginPath();g.moveTo(x-2.6,y);g.quadraticCurveTo(x-3,y-4,x-1,y-5);g.lineTo(x+1,y-5);g.quadraticCurveTo(x+3,y-4,x+2.6,y);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+.6,y-4.6,1.8,4.4);g.strokeStyle='#6a5a3a';g.lineWidth=.5;g.beginPath();g.moveTo(x-1.2,y-4.4);g.lineTo(x+1.2,y-4.4);g.stroke()};
  const logs=(g,x,y,n,c)=>{for(let r=0;r<n;r++)for(let k=0;k<n+1-r;k++){const lx=x+k*2.6+r*1.3,ly=y-r*2.3;g.fillStyle='#4a3420';g.beginPath();g.arc(lx,ly,1.35,0,7);g.fill();g.fillStyle=c||((k+r)%2?'#b48e5c':'#a27c4c');g.beginPath();g.arc(lx-.2,ly-.2,.9,0,7);g.fill()}};
  const planks=(g,x,y,w,n)=>{g.fillStyle='rgba(8,14,6,.3)';g.fillRect(x+2,y-1,w,2.4);for(let k=0;k<n;k++){g.fillStyle=k%2?'#c49a62':'#b08850';g.fillRect(x+k*.5,y-1.4-k*1.4,w,1.3);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(x+k*.5+w-1.4,y-1.4-k*1.4,1.4,1.3)}};
  const blocks=(g,x,y,c)=>{for(let r=0;r<3;r++)for(let k=0;k<3-r;k++){const bx=x+k*6+r*3,by=y-r*4.2;g.fillStyle=shade(c,-10);g.fillRect(bx,by-4,5.4,4);g.fillStyle=shade(c,18);g.fillRect(bx,by-4.6,5.4,.8);g.fillStyle=shade(c,-40);g.fillRect(bx+5.4,by-4.4,.8,4.4)}};
  const chimney=(g,x,y,h,col,smoke)=>{g.fillStyle=shade(col,-10);g.fillRect(x,y-h,4.4,h);g.fillStyle=shade(col,-45);g.fillRect(x+3,y-h,1.4,h);g.fillStyle='#2a2622';g.fillRect(x-.5,y-h-1.2,5.4,1.6);
    if(smoke)for(let k=0;k<4;k++){const sg=g.createRadialGradient(x+2+k*2.4,y-h-4-k*4,0,x+2+k*2.4,y-h-4-k*4,2.4+k*1.2);sg.addColorStop(0,`rgba(200,196,188,${.4-k*.08})`);sg.addColorStop(1,'rgba(200,196,188,0)');g.fillStyle=sg;g.beginPath();g.arc(x+2+k*2.4,y-h-4-k*4,2.4+k*1.2,0,7);g.fill()}};
  const shed=(g,x0,y0,x1,y1,h,roof,post)=>{// offener Schuppen: Pfosten und Pultdach in Schrägansicht
    g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.moveTo(x0+4,y1+2);g.lineTo(x1+10,y1+2);g.lineTo(x1+10,y0+4);g.lineTo(x1,y0);g.lineTo(x1,y1);g.closePath();g.fill();
    g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x0,y0,x1-x0,y1-y0);
    for(const px of [x0+1,x1-3,(x0+x1)/2-1])for(const py of [y0+1,y1]){g.fillStyle=post||'#4a3220';g.fillRect(px,py-h,2.2,h);g.fillStyle='rgba(255,230,190,.18)';g.fillRect(px,py-h,.7,h)}
    const rg=g.createLinearGradient(0,y0-h-6,0,y1-h);rg.addColorStop(0,shade(roof,25));rg.addColorStop(1,shade(roof,-15));g.fillStyle=rg;g.beginPath();g.moveTo(x0-2,y1-h+2);g.lineTo(x1+2,y1-h+2);g.lineTo(x1+2,y0-h-4);g.lineTo(x0-2,y0-h-4);g.closePath();g.fill();
    g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=.6;g.beginPath();for(let k=y0-h-1;k<y1-h+2;k+=2.6){g.moveTo(x0-2,k);g.lineTo(x1+2,k)}g.stroke();g.fillStyle='rgba(0,0,0,.32)';g.fillRect(x0-2,y1-h+2,x1-x0+4,1.6);g.fillStyle=shade(roof,-40);g.beginPath();g.moveTo(x1+2,y1-h+2);g.lineTo(x1+5,y1-h);g.lineTo(x1+5,y0-h-6);g.lineTo(x1+2,y0-h-4);g.closePath();g.fill()};
  const ground=(g,x0,y0,x1,y1,c)=>{g.fillStyle=c||'rgba(112,92,62,.45)';g.beginPath();g.ellipse((x0+x1)/2,(y0+y1)/2,(x1-x0)/2,(y1-y0)/2,0,0,7);g.fill()};
  const sign=(g,x,y,pc,ic)=>{g.strokeStyle='#3a2a1a';g.lineWidth=.9;g.beginPath();g.moveTo(x,y);g.lineTo(x+6,y);g.stroke();g.strokeStyle='#5a5a5a';g.lineWidth=.3;g.beginPath();g.moveTo(x+2,y);g.lineTo(x+2,y+1.5);g.moveTo(x+5.5,y);g.lineTo(x+5.5,y+1.5);g.stroke();
    g.fillStyle='#6a4a2a';g.fillRect(x+1.2,y+1.5,5,4);g.fillStyle=pc;g.fillRect(x+1.6,y+1.9,4.2,.9);if(ic){g.fillStyle=ic;g.beginPath();g.arc(x+3.7,y+3.8,1.1,0,7);g.fill()}};
  return {crate,barrel,sack,logs,planks,blocks,chimney,shed,ground,sign};
})();
const BO=(s)=>({bx:4,by:40,x1:4+s,y1:40+s});
BGFX.bakery=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)];
  BG.ground(g,bx+2,y1-14,x1-2,y1+2);
  hall(g,bx+3,by+6,x1-20,y1-8,11,mat,a.wall,a.roof,ep>=2,6);BG.chimney(g,x1-34,by+14,10,'#8a7a68',true);
  // Backofen: gemauerte Kuppel mit Ofenloch, Holzstapel daneben
  const ox=x1-12,oy=y1-6;g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(ox+4,oy+1,10,3,0,0,7);g.fill();
  const og=g.createRadialGradient(ox-3,oy-9,1,ox,oy-4,10);og.addColorStop(0,'#c4865a');og.addColorStop(1,'#6a3e24');g.fillStyle=og;g.beginPath();g.ellipse(ox,oy,9,9,0,Math.PI,0);g.fill();g.fillRect(ox-9,oy,18,1.4);
  g.strokeStyle='rgba(40,20,10,.35)';g.lineWidth=.5;g.beginPath();for(let k=2;k<9;k+=2.4){g.moveTo(ox-Math.sqrt(81-k*k),oy-k);g.lineTo(ox+Math.sqrt(81-k*k),oy-k)}g.stroke();
  g.fillStyle='#1a100a';g.beginPath();g.ellipse(ox-1,oy,3,3.4,0,Math.PI,0);g.fill();BG.logs(g,ox-8,oy+8,2);
  BG.sack(g,bx+10,y1-1);BG.sack(g,bx+15,y1);BG.sack(g,bx+12.5,y1-4,'#d2c09a');
  g.fillStyle='#6a4a2a';g.fillRect(bx+20,y1-6,10,1.4);g.fillRect(bx+21,y1-4.6,1,4.6);g.fillRect(bx+28,y1-4.6,1,4.6);for(let k=0;k<3;k++){g.fillStyle='#b8823e';g.beginPath();g.ellipse(bx+22.5+k*2.6,y1-7.2,1.3,.9,0,0,7);g.fill()}
  BG.sign(g,bx+3,by+22,pc,'#c8913e')};
BGFX_LIVE.bakery=(g,b,a)=>{const ox=a.x+a.s-12,oy=a.y+a.s-6,gl=b.baking?.55+Math.sin(a.time*9)*.25:.12;g.fillStyle=`rgba(255,150,50,${gl.toFixed(2)})`;g.beginPath();g.ellipse(ox-1,oy,2.4,2.8,0,Math.PI,0);g.fill()};
BGFX.smith=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)];
  BG.ground(g,bx+4,y1-16,x1,y1+2,'rgba(70,62,52,.5)');
  hall(g,bx+3,by+4,x1-24,y1-12,11,mat,a.wall,a.roof,ep>=2,6);BG.chimney(g,bx+14,by+12,14,'#6a6058',true);
  // offene Esse unter dem Pultdach, Amboss, Wassertrog, Werkzeugwand
  BG.shed(g,x1-26,y1-22,x1-3,y1-4,13,a.roof);
  g.fillStyle='#5a5048';g.fillRect(x1-22,y1-12,9,7);g.fillStyle='#3a322c';g.fillRect(x1-22,y1-12.8,9,1.2);g.fillStyle='#1a1410';g.fillRect(x1-20,y1-11,5,2);
  g.fillStyle='#2e2e32';g.beginPath();g.moveTo(x1-11,y1-8);g.lineTo(x1-4,y1-8);g.lineTo(x1-5,y1-6.6);g.lineTo(x1-8,y1-6.6);g.lineTo(x1-8,y1-5);g.lineTo(x1-10,y1-5);g.lineTo(x1-10,y1-6.6);g.lineTo(x1-12.4,y1-7);g.closePath();g.fill();g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x1-11,y1-8,6,.5);
  g.fillStyle='#4a3420';g.fillRect(x1-10.5,y1-5,4,4.4);
  g.fillStyle='#5a4028';g.fillRect(bx+6,y1-6,11,4);g.fillStyle='#3a5a6a';g.fillRect(bx+7,y1-5.4,9,1.6);
  g.strokeStyle='#3a3a3a';g.lineWidth=.7;g.beginPath();for(let k=0;k<4;k++){g.moveTo(x1-25+k*2,y1-21);g.lineTo(x1-25+k*2,y1-16)}g.stroke();
  BG.sign(g,bx+2,by+20,pc,'#4a4a4e');BG.barrel(g,bx+22,y1-1)};
BGFX_LIVE.smith=(g,b,a)=>{const x1=a.x+a.s,y1=a.y+a.s,h=b.forging?.7+Math.sin(a.time*11)*.2:.18;g.fillStyle=`rgba(255,120,40,${h.toFixed(2)})`;g.fillRect(x1-20,y1-11,5,2);
  if(b.forging&&Math.sin(a.time*6)>.6){g.fillStyle='rgba(255,220,140,.9)';for(let k=0;k<3;k++)g.fillRect(x1-10+k*1.5,y1-10-k,.8,.8)}};
BGFX.sawmill=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s);
  BG.ground(g,bx+2,y1-24,x1,y1+2,'rgba(150,120,80,.4)');
  BG.logs(g,bx+4,y1-20,3,'#b48e5c');
  BG.shed(g,bx+16,y1-28,x1-4,y1-8,15,a.roof,ep>=7?'#5a5e62':null);
  // Sägebock mit eingespanntem Stamm, Sägemehl, Bretterstapel
  g.fillStyle='#4a3220';g.fillRect(bx+22,y1-15,24,2);g.fillRect(bx+23,y1-13,1.6,4);g.fillRect(bx+43,y1-13,1.6,4);
  g.fillStyle='#8a6a40';g.fillRect(bx+20,y1-18.4,28,3.2);g.fillStyle='#c4a070';g.beginPath();g.ellipse(bx+48,y1-16.8,1,1.6,0,0,7);g.fill();
  g.fillStyle='rgba(220,190,130,.6)';g.beginPath();g.ellipse(bx+34,y1-8,7,1.6,0,0,7);g.fill();
  BG.planks(g,bx+8,y1-1,16,5);BG.planks(g,x1-24,y1,18,4);BG.sign(g,bx+2,by+28,pc,'#b08850')};
BGFX_LIVE.sawmill=(g,b,a)=>{const cx=a.x+34,cy=a.y+a.s-14,r=a.time*(b.sawing?8:0);g.strokeStyle='#b8bcc0';g.lineWidth=1.2;g.beginPath();g.arc(cx,cy,4,r,r+5.6);g.stroke();g.fillStyle='#55585c';g.beginPath();g.arc(cx,cy,1,0,7);g.fill()};
BGFX.mason=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)];
  BG.ground(g,bx+2,y1-22,x1,y1+2,'rgba(170,164,150,.45)');
  hall(g,bx+3,by+4,bx+s*.55,y1-14,10,mat,a.wall,a.roof,ep>=2,6);
  BG.blocks(g,x1-24,y1-2,'#a9a69c');BG.blocks(g,bx+6,y1,'#b4ae9e');
  // Säulentrommel, Werkbank, Dreibein-Hebezeug
  g.fillStyle='#bab4a4';g.fillRect(x1-28,y1-20,6,6);g.fillStyle='#d2ccbc';g.beginPath();g.ellipse(x1-25,y1-20,3,1,0,0,7);g.fill();g.fillStyle='rgba(0,0,0,.2)';g.fillRect(x1-24,y1-20,2,6);
  g.strokeStyle='#4a3220';g.lineWidth=1.2;g.beginPath();g.moveTo(x1-14,y1-12);g.lineTo(x1-9,y1-34);g.lineTo(x1-4,y1-12);g.moveTo(x1-9,y1-34);g.lineTo(x1-7,y1-14);g.stroke();
  g.strokeStyle='#2a2018';g.lineWidth=.4;g.beginPath();g.moveTo(x1-9,y1-34);g.lineTo(x1-9,y1-22);g.stroke();g.fillStyle='#a9a69c';g.fillRect(x1-11.5,y1-22,5,3.6);
  g.fillStyle='rgba(220,216,206,.6)';for(let k=0;k<8;k++){g.beginPath();g.arc(bx+s*.5+k*2.6,y1-10+(k%3),.6,0,7);g.fill()}
  BG.sign(g,bx+2,by+20,pc,'#a9a69c')};
BGFX.mine=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),cx=bx+s*.42;
  // Felshügel aus Facetten, Stolleneingang mit Türstock, Gleis mit Lore, Abraumhalde
  g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(cx+8,y1,s*.48,7,0,0,7);g.fill();
  const P=[[bx,y1],[bx+6,y1-20],[bx+16,y1-34],[cx+4,y1-40],[x1-14,y1-30],[x1-4,y1-14],[x1,y1]];
  const fc=['#7e766a','#948a7c','#a49a8a','#8a8274','#6a6258','#5a544c'];
  for(let k=0;k<P.length-1;k++){g.fillStyle=fc[k];g.beginPath();g.moveTo(cx,y1-10);g.lineTo(P[k][0],P[k][1]);g.lineTo(P[k+1][0],P[k+1][1]);g.closePath();g.fill()}
  g.strokeStyle='rgba(30,26,20,.25)';g.lineWidth=.5;g.beginPath();for(const p of P){g.moveTo(cx,y1-10);g.lineTo(p[0],p[1])}g.stroke();
  g.fillStyle='rgba(90,110,60,.55)';for(const [gx,gy,r] of [[bx+12,y1-28,4],[cx+2,y1-37,3],[x1-12,y1-26,3.4]]){g.beginPath();g.ellipse(gx,gy,r,r*.5,0,0,7);g.fill()}
  g.fillStyle='#120e0a';g.beginPath();g.moveTo(cx-6,y1-1);g.lineTo(cx-6,y1-12);g.lineTo(cx+6,y1-12);g.lineTo(cx+6,y1-1);g.closePath();g.fill();
  g.fillStyle='#5a3f22';g.fillRect(cx-7.6,y1-13,2.2,12.4);g.fillRect(cx+5.4,y1-13,2.2,12.4);g.fillRect(cx-8.4,y1-14.6,16.8,2.4);g.fillStyle='rgba(255,230,190,.2)';g.fillRect(cx-8.4,y1-14.6,16.8,.6);
  g.strokeStyle='#4a4a4a';g.lineWidth=.6;g.beginPath();g.moveTo(cx-3,y1-1);g.lineTo(cx+8,y1+3);g.moveTo(cx+3,y1-1);g.lineTo(cx+14,y1+3);g.stroke();g.strokeStyle='#5a3f22';g.lineWidth=.8;g.beginPath();for(let k=0;k<4;k++){g.moveTo(cx-2+k*3.4,y1-.4+k*1.2);g.lineTo(cx+4+k*3.4,y1-.4+k*1.2)}g.stroke();
  g.fillStyle='#4a4038';g.fillRect(cx+9,y1-4,8,4);g.fillStyle='#1a1a1a';g.beginPath();g.arc(cx+10.5,y1+.2,1.1,0,7);g.arc(cx+15.5,y1+.2,1.1,0,7);g.fill();g.fillStyle='#8a5a3a';for(let k=0;k<3;k++){g.beginPath();g.arc(cx+11+k*2.4,y1-4.6,1.3,0,7);g.fill()}
  g.fillStyle='#7a6a58';g.beginPath();g.moveTo(x1-14,y1+2);g.quadraticCurveTo(x1-6,y1-8,x1+2,y1+2);g.fill();g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.moveTo(x1-6,y1-5);g.quadraticCurveTo(x1-2,y1-2,x1+2,y1+2);g.lineTo(x1-6,y1+2);g.fill();
  if(ep>=7){// Förderturm
    const fx=bx+8;g.strokeStyle='#3a3e42';g.lineWidth=1.4;g.beginPath();g.moveTo(fx,y1-2);g.lineTo(fx+5,y1-46);g.lineTo(fx+10,y1-2);g.moveTo(fx+5,y1-46);g.lineTo(fx+16,y1-8);g.stroke();g.lineWidth=.5;g.beginPath();for(let k=6;k<44;k+=6){g.moveTo(fx+k*.11,y1-2-k);g.lineTo(fx+10-(k+6)*.11,y1-8-k)}g.stroke();
    g.strokeStyle='#2a2e32';g.lineWidth=.8;g.beginPath();g.arc(fx+5,y1-46,3.4,0,7);g.stroke()}
  else{g.fillStyle='#e8c060';g.fillRect(cx+6.6,y1-11.6,1.6,2);g.fillStyle='rgba(255,200,90,.3)';g.beginPath();g.arc(cx+7.4,y1-10.6,2.4,0,7);g.fill()}
  a.banner(g,cx+2,y1-38,pc,12)};
BGFX.warehouse=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)];
  BG.ground(g,bx+2,y1-10,x1,y1+3);
  hall(g,bx+2,by+2,x1-2,y1-6,14,mat,a.wall,a.roof,false,12);
  // Ladeluke mit Seilwinde unter dem Giebel, Rampe, Fracht davor
  g.fillStyle='#3a2a1a';g.fillRect(bx+s*.35,by+16,6,5);g.strokeStyle='#2a2018';g.lineWidth=.9;g.beginPath();g.moveTo(bx+s*.35+3,by+12);g.lineTo(bx+s*.35+3,by+24);g.stroke();
  g.fillStyle='#7a5a36';g.beginPath();g.moveTo(bx+s*.3,y1-6);g.lineTo(bx+s*.5,y1-6);g.lineTo(bx+s*.54,y1-1);g.lineTo(bx+s*.26,y1-1);g.closePath();g.fill();
  BG.crate(g,bx+4,y1,5);BG.crate(g,bx+10,y1+1,4.5);BG.crate(g,bx+6.5,y1-5,4);BG.barrel(g,x1-14,y1);BG.barrel(g,x1-9,y1+1);BG.sack(g,bx+s*.6,y1+1);
  a.banner(g,x1-6,by+4,pc,14)};
BGFX.mill=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),cx=bx+s*.48;
  if(ep>=7){// Getreidesilos mit Elevatorturm
    for(const [sx,h] of [[bx+8,40],[bx+24,46],[bx+40,40]]){g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(sx+12,y1,9,3,0,0,7);g.fill();
      const sg=g.createLinearGradient(sx,0,sx+14,0);sg.addColorStop(0,'#d8dad6');sg.addColorStop(.6,'#b8bcbd');sg.addColorStop(1,'#80868a');g.fillStyle=sg;g.fillRect(sx,y1-h,14,h);g.beginPath();g.ellipse(sx+7,y1,7,2.4,0,0,Math.PI);g.fill();
      g.fillStyle='#9aa0a2';g.beginPath();g.moveTo(sx-.5,y1-h);g.lineTo(sx+7,y1-h-5);g.lineTo(sx+14.5,y1-h);g.closePath();g.fill();g.strokeStyle='rgba(0,0,0,.12)';g.lineWidth=.5;g.beginPath();for(let k=y1-h+5;k<y1;k+=5){g.moveTo(sx,k);g.lineTo(sx+14,k)}g.stroke()}
    g.fillStyle=pc;g.fillRect(bx+26,y1-30,10,3);return}
  // Turmwindmühle: verjüngter Turm aus Stein (früh Holzbock), drehbare Haube; Flügel werden live gezeichnet
  g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(cx+10,y1,16,5,0,0,7);g.fill();BG.ground(g,bx+2,y1-8,x1-2,y1+4);
  const tg=g.createLinearGradient(cx-10,0,cx+10,0);tg.addColorStop(0,ep>=3?'#cfc6b2':'#9a7a52');tg.addColorStop(.55,ep>=3?'#b0a690':'#7a5a36');tg.addColorStop(1,ep>=3?'#6e6656':'#4a3420');g.fillStyle=tg;
  g.beginPath();g.moveTo(cx-11,y1-2);g.lineTo(cx-7,y1-40);g.lineTo(cx+7,y1-40);g.lineTo(cx+11,y1-2);g.quadraticCurveTo(cx,y1+1.4,cx-11,y1-2);g.fill();
  g.strokeStyle=ep>=3?'rgba(40,34,24,.25)':'rgba(30,20,10,.35)';g.lineWidth=.5;g.beginPath();for(let k=4;k<38;k+=3.2){const w=11-k*.1;g.moveTo(cx-w,y1-2-k);g.lineTo(cx+w,y1-2-k)}g.stroke();
  g.fillStyle='#2a1e14';g.beginPath();g.moveTo(cx-2.6,y1-1);g.lineTo(cx-2.6,y1-8);g.quadraticCurveTo(cx,y1-10,cx+2.6,y1-8);g.lineTo(cx+2.6,y1-1);g.fill();
  for(const wy of [y1-20,y1-31]){g.fillStyle='#1e1812';g.fillRect(cx-1.2,wy,2.4,3.2)}
  g.fillStyle=a.roof;g.beginPath();g.moveTo(cx-9,y1-40);g.quadraticCurveTo(cx-6,y1-52,cx,y1-53);g.quadraticCurveTo(cx+6,y1-52,cx+9,y1-40);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.moveTo(cx+2,y1-52.6);g.quadraticCurveTo(cx+6,y1-52,cx+9,y1-40);g.lineTo(cx+2,y1-40);g.fill();
  g.fillStyle='#4a3220';g.fillRect(cx-9.4,y1-40.6,18.8,1.4);
  BG.sack(g,x1-12,y1);BG.sack(g,x1-7,y1+1);BG.sack(g,x1-9.5,y1-3.6);BG.planks(g,bx+4,y1+1,8,2)};
BGFX_LIVE.mill=(g,b,a)=>{if(a.ep>=7)return;const cx=a.x+a.s*.48,cy=a.y+a.s-46,r=a.time*(b.built?1.2:0)+b.id;
  g.save();g.translate(cx,cy);g.fillStyle='#3a2a1a';g.beginPath();g.arc(0,0,1.8,0,7);g.fill();
  for(let k=0;k<4;k++){const q=r+k*Math.PI/2;g.save();g.rotate(q);g.strokeStyle='#4a3220';g.lineWidth=1.2;g.beginPath();g.moveTo(0,0);g.lineTo(0,-22);g.stroke();
    g.fillStyle='rgba(232,224,204,.88)';g.fillRect(.8,-21,4.4,15);g.strokeStyle='rgba(74,50,32,.55)';g.lineWidth=.35;g.beginPath();for(let j=-19;j<-6;j+=2.6){g.moveTo(.8,j);g.lineTo(5.2,j)}g.moveTo(3,-21);g.lineTo(3,-6);g.stroke();g.restore()}
  g.restore()};
// Wehrbauten und Lager
const cren=(g,x0,x1,y,col)=>{g.fillStyle=col;for(let x=x0;x<x1-2;x+=4.4){g.fillRect(x,y-3,2.8,3)}g.fillStyle='rgba(255,250,235,.18)';for(let x=x0;x<x1-2;x+=4.4)g.fillRect(x,y-3,2.8,.6)};
function fortGfx(g,s,ep,pc,a,templar){const {bx,by,x1,y1}=BO(s),st=templar?'#b8b0a0':ep>=6?'#a8a296':'#958e80',sd=shade(st,-40);
  g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(bx+10,y1+2);g.lineTo(x1+14,y1+2);g.lineTo(x1+14,by+30);g.lineTo(x1,by+24);g.lineTo(x1,y1-4);g.closePath();g.fill();
  const tr=s>100?11:9,inX0=bx+tr+2,inX1=x1-tr-2,backY=by+s*.32,frontY=y1-6;
  // Hintertürme, Rückwand
  roundTower(g,inX0,backY,tr-1,s*.36,st,a.roof,ep,pc);roundTower(g,inX1,backY,tr-1,s*.36,st,a.roof,ep,pc);
  wallFace(g,inX0,backY-16,inX1,backY,shade(st,-6),'stone');cren(g,inX0,inX1,backY-16,shade(st,-6));
  // Hof
  g.fillStyle='#8a7a5e';g.fillRect(inX0,backY,inX1-inX0,frontY-backY-14);g.fillStyle='rgba(60,48,30,.25)';for(let k=0;k<20;k++){g.beginPath();g.ellipse(inX0+((k*37)%(inX1-inX0)),backY+4+((k*53)%(frontY-backY-20)),2,.8,0,0,7);g.fill()}
  // Bergfried
  const kx0=bx+s*.34,kx1=bx+s*.62,kb=backY+s*.22,kh=s*.62;g.fillStyle='rgba(8,14,6,.3)';g.fillRect(kx1,kb-kh+8,10,kh-8);
  g.fillStyle=sd;g.beginPath();g.moveTo(kx1,kb);g.lineTo(kx1+8,kb-5);g.lineTo(kx1+8,kb-kh-5);g.lineTo(kx1,kb-kh);g.closePath();g.fill();
  wallFace(g,kx0,kb-kh,kx1,kb,st,'stone');g.fillStyle=shade(st,8);g.beginPath();g.moveTo(kx0,kb-kh);g.lineTo(kx1,kb-kh);g.lineTo(kx1+8,kb-kh-5);g.lineTo(kx0+8,kb-kh-5);g.closePath();g.fill();
  cren(g,kx0,kx1,kb-kh,st);for(const wy of [kb-kh*.75,kb-kh*.45]){for(const wx of [kx0+(kx1-kx0)*.3,kx0+(kx1-kx0)*.65]){g.fillStyle='#16120e';g.fillRect(wx-1,wy,2,4.4);g.beginPath();g.arc(wx,wy,1,Math.PI,0);g.fill()}}
  if(templar){const fx=(kx0+kx1)/2;g.strokeStyle='#3a2a1a';g.lineWidth=1;g.beginPath();g.moveTo(fx,kb-kh-3);g.lineTo(fx,kb-kh-22);g.stroke();g.fillStyle='#f0ece0';g.fillRect(fx,kb-kh-22,10,7);g.fillStyle='#b8322c';g.fillRect(fx+4,kb-kh-22,2,7);g.fillRect(fx,kb-kh-19.4,10,1.8)}
  else banner(g,(kx0+kx1)/2,kb-kh-3,pc,18);
  // Seitenmauern (Wehrgang von oben, Außenseite im Schatten)
  for(const [wx,o] of [[inX0-4,-1],[inX1-3,1]]){g.fillStyle=shade(st,10);g.fillRect(wx,backY,7,frontY-backY-14);g.fillStyle=o>0?sd:shade(st,-20);g.fillRect(o>0?wx+7:wx-2.4,backY,2.4,frontY-backY-12);
    g.fillStyle=shade(st,-12);for(let yy=backY+2;yy<frontY-16;yy+=4.4)g.fillRect(o>0?wx+5:wx,yy,2,2.6)}
  // Frontmauer mit Torhaus
  wallFace(g,inX0,frontY-20,inX1,frontY,st,'stone');cren(g,inX0,inX1,frontY-20,st);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(inX0,frontY-2,inX1-inX0,2);
  const gx=(bx+x1)/2,gw=s*.16;wallFace(g,gx-gw,frontY-30,gx+gw,frontY+1,shade(st,6),'stone');cren(g,gx-gw,gx+gw,frontY-30,shade(st,6));
  g.fillStyle='#16120e';g.beginPath();g.moveTo(gx-gw*.45,frontY+1);g.lineTo(gx-gw*.45,frontY-10);g.arc(gx,frontY-10,gw*.45,Math.PI,0);g.lineTo(gx+gw*.45,frontY+1);g.closePath();g.fill();
  g.strokeStyle='rgba(70,64,56,.9)';g.lineWidth=.6;g.beginPath();for(let k=-gw*.4;k<gw*.45;k+=1.8){g.moveTo(gx+k,frontY-12);g.lineTo(gx+k,frontY-4)}for(let k=frontY-12;k<frontY-3;k+=2){g.moveTo(gx-gw*.45,k);g.lineTo(gx+gw*.45,k)}g.stroke();
  g.fillStyle=templar?'#f0ece0':pc;g.fillRect(gx-2.4,frontY-26,4.8,6);if(templar){g.fillStyle='#b8322c';g.fillRect(gx-.6,frontY-26,1.2,6);g.fillRect(gx-2.4,frontY-24,4.8,1.2)}
  roundTower(g,inX0,frontY+2,tr,s*.42,st,a.roof,ep,pc);roundTower(g,inX1,frontY+2,tr,s*.42,st,a.roof,ep,pc)}
BGFX.castle=(g,s,ep,pc,a)=>fortGfx(g,s,ep,pc,a,false);
BGFX.templar=(g,s,ep,pc,a)=>fortGfx(g,s,ep,pc,a,true);
const tent=(g,x,y,w,h,col,pc)=>{g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.moveTo(x-w/2,y);g.lineTo(x+w/2+6,y+1);g.lineTo(x+w/2+6,y-h*.4);g.lineTo(x+w/2,y);g.fill();
  const tg=g.createLinearGradient(x-w/2,0,x+w/2,0);tg.addColorStop(0,shade(col,20));tg.addColorStop(.5,col);tg.addColorStop(.5,shade(col,-30));tg.addColorStop(1,shade(col,-45));g.fillStyle=tg;
  g.beginPath();g.moveTo(x-w/2,y);g.lineTo(x,y-h);g.lineTo(x+w/2,y);g.closePath();g.fill();g.fillStyle='rgba(30,20,10,.55)';g.beginPath();g.moveTo(x-w*.12,y);g.lineTo(x,y-h*.55);g.lineTo(x+w*.12,y);g.fill();
  g.strokeStyle='rgba(40,30,20,.35)';g.lineWidth=.4;g.beginPath();g.moveTo(x-w/2,y);g.lineTo(x-w/2-3,y+1.5);g.moveTo(x+w/2,y);g.lineTo(x+w/2+3,y+1.5);g.stroke();
  g.strokeStyle='#3a2a1a';g.lineWidth=.7;g.beginPath();g.moveTo(x,y-h);g.lineTo(x,y-h-3);g.stroke();if(pc){g.fillStyle=pc;g.fillRect(x,y-h-3,3,1.8)}};
const palisade=(g,x0,y0,x1,y1,c)=>{const post=(px,py)=>{g.fillStyle=c||'#5a3f22';g.fillRect(px,py-7,2,7);g.fillStyle=shade(c||'#5a3f22',25);g.fillRect(px,py-7,.7,7);g.beginPath();g.moveTo(px,py-7);g.lineTo(px+1,py-9);g.lineTo(px+2,py-7);g.fill()};
  for(let x=x0;x<x1;x+=2.2)post(x,y0);for(let y=y0;y<y1;y+=2.4){post(x0,y);post(x1-2,y)}for(let x=x0;x<x1;x+=2.2)post(x,y1)};
const fire=(g,x,y)=>{g.fillStyle='#5a5048';for(let k=0;k<6;k++){const q=k/6*7;g.beginPath();g.arc(x+Math.cos(q)*3,y+Math.sin(q)*1.4,.9,0,7);g.fill()}g.fillStyle='rgba(255,140,40,.85)';g.beginPath();g.moveTo(x-2,y);g.quadraticCurveTo(x,y-6,x+2,y);g.fill();g.fillStyle='rgba(255,220,120,.9)';g.beginPath();g.moveTo(x-1,y);g.quadraticCurveTo(x,y-3.4,x+1,y);g.fill()};
const rack=(g,x,y)=>{g.strokeStyle='#4a3220';g.lineWidth=.9;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-7);g.moveTo(x+8,y);g.lineTo(x+8,y-7);g.moveTo(x-.5,y-6);g.lineTo(x+8.5,y-6);g.stroke();g.strokeStyle='#8a8e92';g.lineWidth=.5;g.beginPath();for(let k=1;k<8;k+=1.6){g.moveTo(x+k,y-.4);g.lineTo(x+k-.6,y-10)}g.stroke()};
BGFX.milcamp=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),m=ep>=7,cv=m?'#6a6e4a':'#d8ccaa';
  BG.ground(g,bx,by+10,x1,y1+2,'rgba(120,100,70,.45)');
  if(m){for(let x=bx+2;x<x1-2;x+=4){g.fillStyle='#8a7a58';g.beginPath();g.ellipse(x+2,y1,2.2,1.4,0,0,7);g.fill();g.fillStyle='#8a7a58';g.beginPath();g.ellipse(x+2,by+14,2.2,1.4,0,0,7);g.fill()}}
  else palisade(g,bx+2,by+14,x1-2,y1);
  tent(g,bx+s*.32,by+s*.62,22,16,cv,pc);tent(g,bx+s*.7,by+s*.5,16,12,shade(cv,-12));
  // Lazarettzelt mit rotem Kreuz (das Lager heilt)
  g.fillStyle='#f0ece0';g.fillRect(bx+s*.32-2.4,by+s*.62-12,4.8,4.8);g.fillStyle='#c33';g.fillRect(bx+s*.32-.6,by+s*.62-11.6,1.2,4);g.fillRect(bx+s*.32-2,by+s*.62-10.2,4,1.2);
  fire(g,bx+s*.62,y1-8);rack(g,bx+s*.12,y1-5);BG.barrel(g,x1-10,y1-4);BG.crate(g,x1-18,y1-3,4);
  a.banner(g,x1-8,by+20,pc,18)};
BGFX.fieldcamp=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),m=ep>=7;
  // Erdwall mit Graben, Palisade, Wachtplattform, Kommandozelt
  g.fillStyle='rgba(70,56,36,.55)';g.beginPath();g.ellipse((bx+x1)/2,(by+12+y1)/2+4,s*.52,s*.34,0,0,7);g.fill();g.fillStyle='#7a6a48';g.beginPath();g.ellipse((bx+x1)/2,(by+12+y1)/2+3,s*.46,s*.29,0,0,7);g.fill();
  g.fillStyle='#8a7a58';g.beginPath();g.ellipse((bx+x1)/2,(by+12+y1)/2+3,s*.38,s*.22,0,0,7);g.fill();
  if(!m)palisade(g,bx+8,by+20,x1-8,y1-6,'#6a4a2a');
  tent(g,bx+s*.45,by+s*.62,24,15,m?'#5e6a44':'#c8b88a',pc);tent(g,bx+s*.72,by+s*.72,12,9,m?'#56603e':'#b8a87a');
  const wx=bx+14,wy=by+30;g.strokeStyle='#4a3220';g.lineWidth=1.2;g.beginPath();g.moveTo(wx,wy);g.lineTo(wx+1,wy-20);g.moveTo(wx+8,wy);g.lineTo(wx+7,wy-20);g.moveTo(wx,wy);g.lineTo(wx+8,wy-12);g.stroke();
  g.fillStyle='#6a4a2a';g.fillRect(wx-2,wy-22,12,2.4);g.fillStyle='#8a6a40';g.beginPath();g.moveTo(wx-3,wy-22);g.lineTo(wx+4,wy-28);g.lineTo(wx+11,wy-22);g.fill();
  fire(g,bx+s*.3,y1-10);a.banner(g,bx+s*.45,by+s*.62-15,pc,12)};
BGFX.mercs=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s);
  BG.ground(g,bx+4,by+30,x1-4,y1+2,'rgba(120,100,70,.4)');
  tent(g,bx+s*.24,by+s*.55,26,18,'#8a3a2a');tent(g,bx+s*.55,by+s*.45,22,16,'#3a4a6a');tent(g,bx+s*.8,by+s*.6,20,14,'#6a6a3a');
  // Planwagen, Feuer mit Kessel, Waffengestell, Fässer
  const wx=bx+s*.5,wy=y1-6;g.fillStyle='#5a3f22';g.fillRect(wx-10,wy-6,20,4);g.fillStyle='#e0d6b8';g.beginPath();g.moveTo(wx-10,wy-6);g.quadraticCurveTo(wx,wy-18,wx+10,wy-6);g.fill();g.fillStyle='rgba(0,0,0,.15)';g.beginPath();g.moveTo(wx+2,wy-12);g.quadraticCurveTo(wx+8,wy-11,wx+10,wy-6);g.lineTo(wx+2,wy-6);g.fill();
  for(const cx of [wx-6,wx+6]){g.strokeStyle='#3a2a1a';g.lineWidth=1;g.beginPath();g.arc(cx,wy,3,0,7);g.stroke()}
  fire(g,bx+s*.22,y1-8);g.strokeStyle='#3a3a3a';g.lineWidth=.6;g.beginPath();g.moveTo(bx+s*.22-4,y1-8);g.lineTo(bx+s*.22,y1-15);g.lineTo(bx+s*.22+4,y1-8);g.stroke();g.fillStyle='#2a2a2a';g.beginPath();g.arc(bx+s*.22,y1-11,2,0,Math.PI);g.fill();
  rack(g,x1-20,y1-4);BG.barrel(g,x1-8,y1-2);BG.barrel(g,x1-4,y1-1);a.banner(g,bx+s*.55,by+s*.45-16,pc,16)};
BGFX.guild=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)],dark=shade(a.wall,-38);
  // schmales, dunkles Haus in einer Gasse: Fensterläden zu, Kapuzenschild, Mauer mit Pforte
  hall(g,bx+10,by+2,x1-8,y1-8,16,mat,dark,shade(a.roof,-25),false,5);
  g.fillStyle='#2a2018';for(const wx of [bx+16,bx+28]){g.fillRect(wx,by+s*.4,4,5)}
  wallFace(g,bx+2,y1-14,bx+12,y1,shade(a.wall,-20),'stone');g.fillStyle='#16120e';g.fillRect(bx+5,y1-8,4,8);
  BG.sign(g,x1-26,by+s*.36,'#222',null);g.fillStyle='#1a1a1a';g.beginPath();g.moveTo(x1-23.3,by+s*.36+5);g.quadraticCurveTo(x1-22.3,by+s*.36+1.6,x1-21.3,by+s*.36+5);g.fill();
  BG.barrel(g,x1-6,y1-1);g.fillStyle='rgba(20,16,12,.25)';g.beginPath();g.ellipse(bx+s*.5,y1+1,s*.4,3,0,0,7);g.fill()};
BGFX.lodge=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),col='#d6cfbe',sd=shade(col,-42),x0=bx+6,xf=x1-16,top=by+12,yb=y1-8;
  // kleiner klassizistischer Tempelbau mit Säulenvorhalle, Giebel mit Winkel und Zirkel
  g.fillStyle='rgba(8,14,6,.3)';g.fillRect(xf,yb-30,16,32);
  g.fillStyle=sd;g.beginPath();g.moveTo(xf,yb);g.lineTo(x1-4,yb-6);g.lineTo(x1-4,top-6);g.lineTo(xf,top);g.closePath();g.fill();
  g.fillStyle=shade(col,-10);g.fillRect(x0,top+8,xf-x0,yb-top-8);g.fillStyle='#b8b0a0';g.fillRect(x0-2,yb-3,xf-x0+4,3);g.fillRect(x0-1,yb-5,xf-x0+2,2);
  for(let k=0;k<5;k++){const cx=x0+3+k*(xf-x0-6)/4;const cg=g.createLinearGradient(cx-1.6,0,cx+1.6,0);cg.addColorStop(0,'#f0eadc');cg.addColorStop(1,'#a8a090');g.fillStyle=cg;g.fillRect(cx-1.6,top+8,3.2,yb-top-13);g.fillStyle='#e6dfd0';g.fillRect(cx-2.2,top+7,4.4,1.4)}
  g.fillStyle='rgba(30,26,20,.45)';g.fillRect(x0+1,top+9.4,xf-x0-2,yb-top-14);for(let k=0;k<5;k++){const cx=x0+3+k*(xf-x0-6)/4;g.fillStyle='#e6dfd0';g.fillRect(cx-1.6,top+9,3.2,yb-top-14)}
  g.fillStyle=col;g.fillRect(x0-2,top+3,xf-x0+4,5);g.fillStyle='#e8e2d4';g.beginPath();g.moveTo(x0-3,top+3);g.lineTo((x0+xf)/2,top-8);g.lineTo(xf+3,top+3);g.closePath();g.fill();
  g.fillStyle=shade(a.roof,-10);g.beginPath();g.moveTo((x0+xf)/2,top-8);g.lineTo(xf+3,top+3);g.lineTo(x1-1,top-3);g.lineTo((x0+xf)/2+12,top-14);g.closePath();g.fill();
  g.strokeStyle='#b8962e';g.lineWidth=.7;const ex=(x0+xf)/2,ey=top-1;g.beginPath();g.moveTo(ex-3,ey+2);g.lineTo(ex,ey-3);g.lineTo(ex+3,ey+2);g.moveTo(ex-3,ey-1.6);g.lineTo(ex,ey+2.4);g.lineTo(ex+3,ey-1.6);g.stroke();
  for(const cx of [x0-1,xf+1]){g.fillStyle='#8a8278';g.fillRect(cx-1,yb-6,2,6)}g.fillStyle=pc;g.fillRect(xf-6,yb-12,3,4)};
BGFX.depot=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),mat=MAT[Math.min(ep,MAT.length-1)];
  // umzäunter Lagerplatz: Schreibstube, Stapel aller Rohstoffe
  g.fillStyle='rgba(120,100,70,.45)';g.fillRect(bx+2,by+20,s-4,s-20);
  hall(g,bx+4,by+4,bx+s*.46,by+s*.5,9,mat,a.wall,a.roof,ep>=2,5);
  BG.logs(g,x1-26,by+s*.52,3);BG.blocks(g,x1-24,y1-4,'#a9a69c');
  for(let k=0;k<3;k++)for(let j=0;j<3-k;j++){g.fillStyle='#d8b44a';g.fillRect(bx+8+j*4.4+k*2.2,y1-6-k*2.2,4,2);g.fillStyle='#f4dc8a';g.fillRect(bx+8+j*4.4+k*2.2,y1-6-k*2.2,4,.6)}
  BG.sack(g,bx+s*.5,y1-2);BG.sack(g,bx+s*.5+5,y1-1);BG.sack(g,bx+s*.5+2.5,y1-5.4);
  g.strokeStyle='#6a4e30';g.lineWidth=.8;g.beginPath();g.moveTo(bx+2,y1+1);g.lineTo(x1-2,y1+1);g.lineTo(x1-2,by+20);g.stroke();g.fillStyle='#4e3a24';for(let x=bx+2;x<x1;x+=5)g.fillRect(x-.5,y1-2,1,3.4);for(let y=by+22;y<y1;y+=5)g.fillRect(x1-2.5,y-3,1,3.4);
  a.banner(g,x1-6,by+22,pc,14)};
// Epochenwunder: je Epoche ein eigenes Großbauwerk (Bild nach der Epoche, in der es begonnen wurde)
const BGFX_HEAD={monument:110,sniper:60};
BGFX.monument=(g,s,ep,pc,a)=>{const bx=4,by=110,x1=bx+s,y1=by+s,cx=bx+s/2,st='#b4aa94',lt=shade(st,22),dk=shade(st,-38);let sd=ep*71+3;const rn=()=>((sd=(sd*16807)%2147483647)/2147483647);
  const sh=(w,h)=>{g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.ellipse(cx+10,y1-4,w,h,0,0,7);g.fill()};
  const box=(x0,yb,w,h,d,c)=>{g.fillStyle=shade(c,-40);g.beginPath();g.moveTo(x0+w,yb);g.lineTo(x0+w+d,yb-d*.55);g.lineTo(x0+w+d,yb-h-d*.55);g.lineTo(x0+w,yb-h);g.closePath();g.fill();
    g.fillStyle=shade(c,14);g.beginPath();g.moveTo(x0,yb-h);g.lineTo(x0+w,yb-h);g.lineTo(x0+w+d,yb-h-d*.55);g.lineTo(x0+d,yb-h-d*.55);g.closePath();g.fill();
    const fg=g.createLinearGradient(0,yb-h,0,yb);fg.addColorStop(0,shade(c,6));fg.addColorStop(1,shade(c,-14));g.fillStyle=fg;g.fillRect(x0,yb-h,w,h)};
  const cols=(x0,x2,yb,h,n,c)=>{for(let k=0;k<n;k++){const px=x0+k*(x2-x0)/(n-1);const cg=g.createLinearGradient(px-1.8,0,px+1.8,0);cg.addColorStop(0,shade(c,25));cg.addColorStop(1,shade(c,-30));g.fillStyle=cg;g.fillRect(px-1.8,yb-h,3.6,h);g.fillStyle=shade(c,15);g.fillRect(px-2.4,yb-h-1,4.8,1.2);g.fillRect(px-2.4,yb-1.2,4.8,1.2)}};
  if(ep===0){// Stonehenge: Sarsenkreis mit Decksteinen, Trilithen innen
    sh(s*.46,s*.18);g.fillStyle='rgba(120,140,80,.35)';g.beginPath();g.ellipse(cx,y1-s*.3,s*.46,s*.22,0,0,7);g.fill();
    const N=14,ring=[];for(let i=0;i<N;i++){const an=i/N*Math.PI*2;ring.push([cx+Math.cos(an)*s*.38,y1-s*.3+Math.sin(an)*s*.17,an])}
    ring.sort((p,q)=>p[1]-q[1]);for(const [px,py,an] of ring){const h=17+rn()*3;g.fillStyle=Math.sin(an)<0?shade(st,-15):st;g.fillRect(px-3,py-h,6,h);g.fillStyle=lt;g.fillRect(px-3,py-h,2,h);g.fillStyle=dk;g.fillRect(px+2,py-h,1,h);
      if(rn()<.75){g.fillStyle=shade(st,8);g.fillRect(px-4.5,py-h-3,10,3)}}
    for(const [ox,oy] of [[-10,-4],[10,-4],[0,4]]){const px=cx+ox,py=y1-s*.3+oy;g.fillStyle=st;g.fillRect(px-6,py-24,4,24);g.fillRect(px+2,py-24,4,24);g.fillStyle=lt;g.fillRect(px-6,py-24,1.4,24);g.fillStyle=shade(st,6);g.fillRect(px-7,py-27,14,3)}}
  else if(ep===1){// Große Pyramide: Lichtseite und Schattenseite, Steinlagen, goldene Spitze
    sh(s*.6,s*.16);const top=[cx-4,by-40],L=[bx-6,y1-4],M=[cx+14,y1+4],R=[x1+10,y1-12];
    g.fillStyle='#d8c08a';g.beginPath();g.moveTo(...top);g.lineTo(...L);g.lineTo(...M);g.closePath();g.fill();g.fillStyle='#a88c5a';g.beginPath();g.moveTo(...top);g.lineTo(...M);g.lineTo(...R);g.closePath();g.fill();
    g.strokeStyle='rgba(90,70,40,.3)';g.lineWidth=.5;g.beginPath();for(let k=.05;k<1;k+=.045){const lx=top[0]+(L[0]-top[0])*k,ly=top[1]+(L[1]-top[1])*k,mx=top[0]+(M[0]-top[0])*k,my=top[1]+(M[1]-top[1])*k,rx=top[0]+(R[0]-top[0])*k,ry=top[1]+(R[1]-top[1])*k;g.moveTo(lx,ly);g.lineTo(mx,my);g.lineTo(rx,ry)}g.stroke();
    g.fillStyle='#e8c050';g.beginPath();g.moveTo(...top);g.lineTo(top[0]-4.2,top[1]+9);g.lineTo(top[0]+1.6,top[1]+10.4);g.closePath();g.fill();g.fillStyle='#b8902e';g.beginPath();g.moveTo(...top);g.lineTo(top[0]+1.6,top[1]+10.4);g.lineTo(top[0]+4.6,top[1]+8);g.closePath();g.fill()}
  else if(ep===2){// Hängende Gärten: Ziegelterrassen mit überhängendem Grün, Bäume, Wasserfall
    sh(s*.5,s*.18);for(let k=0;k<4;k++){const w=s*.9-k*s*.18,x0=cx-w/2-6,yb=y1-6-k*20;box(x0,yb,w,20,14,'#b89c72');
      for(let j=0;j<w;j+=3){g.fillStyle=rn()<.5?'#4f7a34':'#5e8a3c';g.beginPath();g.ellipse(x0+j,yb-19,2.4,1.6,0,0,7);g.fill();if(rn()<.5){g.strokeStyle='#4a6e2e';g.lineWidth=1;g.beginPath();g.moveTo(x0+j,yb-18);g.lineTo(x0+j+(rn()-.5),yb-12-rn()*6);g.stroke()}}
      for(let j=6;j<w-4;j+=10){g.fillStyle='#2a2018';g.fillRect(x0+j,yb-11,3,6)}}
    for(const [tx,ty] of [[cx-8,y1-86],[cx+6,y1-88]]){g.fillStyle='#5a3f22';g.fillRect(tx,ty,1.6,7);g.fillStyle='#4a7a34';g.beginPath();g.arc(tx+.8,ty-3,5,0,7);g.fill();g.fillStyle='#6a9a44';g.beginPath();g.arc(tx-.6,ty-4.6,2.6,0,7);g.fill()}
    g.strokeStyle='rgba(170,210,230,.75)';g.lineWidth=1.6;g.beginPath();g.moveTo(cx+18,y1-66);g.lineTo(cx+18,y1-4);g.stroke();g.fillStyle='rgba(120,170,200,.6)';g.beginPath();g.ellipse(cx+18,y1-3,6,2,0,0,7);g.fill()}
  else if(ep===3){// Kolosseum: elliptischer Bau mit drei Arkadengeschossen und Attika, Arena innen
    sh(s*.5,s*.2);const ex=cx,ey=y1-26,rx=s*.47,ry=s*.2,H=40;
    g.fillStyle=shade(st,-30);g.beginPath();g.ellipse(ex,ey-H,rx,ry,0,0,7);g.fill();g.fillStyle='#b89a6a';g.beginPath();g.ellipse(ex,ey-H+12,rx*.62,ry*.5,0,0,7);g.fill();
    g.fillStyle=shade(st,-10);g.beginPath();g.ellipse(ex,ey-H,rx*.72,ry*.66,0,Math.PI,0);g.fill();
    const fg=g.createLinearGradient(ex-rx,0,ex+rx,0);fg.addColorStop(0,lt);fg.addColorStop(.6,st);fg.addColorStop(1,dk);g.fillStyle=fg;g.beginPath();g.ellipse(ex,ey,rx,ry,0,0,Math.PI);g.lineTo(ex-rx,ey-H);g.ellipse(ex,ey-H,rx,ry,0,Math.PI,0,true);g.closePath();g.fill();
    for(let lv=0;lv<3;lv++){const yy=ey-6-lv*12;for(let k=-11;k<=11;k++){const an=k/12*Math.PI/2,px=ex+Math.sin(an)*rx*.97,py=yy+Math.cos(an)*ry*.97,w=3.4*Math.cos(an);if(lv===2&&k%2)continue;g.fillStyle='rgba(30,22,14,.7)';g.fillRect(px-w/2,py-7,w,7);g.beginPath();g.ellipse(px,py-7,w/2,1.4,0,Math.PI,0);g.fill()}
      g.strokeStyle='rgba(60,50,36,.4)';g.lineWidth=.6;g.beginPath();g.ellipse(ex,yy+1,rx,ry,0,0,Math.PI);g.stroke()}
    g.strokeStyle=lt;g.lineWidth=1;g.beginPath();g.ellipse(ex,ey-H,rx,ry,0,Math.PI,0);g.stroke()}
  else if(ep===4){// Kathedrale: Langhaus mit Strebepfeilern, Doppelturmfassade mit Spitzhelmen, Rosette
    sh(s*.5,s*.18);const nx0=cx-4,nx1=x1+2,yb=y1-10;box(nx0,yb,nx1-nx0-16,34,16,st);
    g.fillStyle=shade(a.roof,-10);g.beginPath();g.moveTo(nx0,yb-34);g.lineTo(nx1-16,yb-34);g.lineTo(nx1,yb-34-9);g.lineTo(nx1-8,yb-58);g.lineTo(nx0+8,yb-58);g.closePath();g.fill();g.fillStyle=shade(a.roof,18);g.beginPath();g.moveTo(nx0,yb-34);g.lineTo(nx1-16,yb-34);g.lineTo(nx1-24,yb-58+6);g.lineTo(nx0+8,yb-58);g.closePath();g.fill();
    for(let k=nx0+6;k<nx1-18;k+=8){g.fillStyle=dk;g.fillRect(k,yb-30,2.6,30);g.fillStyle='#2a3a5a';g.fillRect(k+3.6,yb-28,2.6,10);g.beginPath();g.arc(k+4.9,yb-28,1.3,Math.PI,0);g.fill()}
    const fx0=bx+8,fx1=cx+4;box(fx0,yb+4,fx1-fx0,46,12,lt);
    for(const tx of [fx0,fx1-14]){box(tx,yb+4-46,14,34,8,lt);g.fillStyle=shade(a.roof,-18);g.beginPath();g.moveTo(tx-1,yb-76);g.lineTo(tx+11,yb-112);g.lineTo(tx+15,yb-76);g.closePath();g.fill();g.fillStyle=shade(a.roof,15);g.beginPath();g.moveTo(tx-1,yb-76);g.lineTo(tx+11,yb-112);g.lineTo(tx+7,yb-76);g.closePath();g.fill();
      g.fillStyle='#1a1410';g.fillRect(tx+5,yb-66,3,10);g.beginPath();g.arc(tx+6.5,yb-66,1.5,Math.PI,0);g.fill()}
    const rx=(fx0+fx1)/2;g.fillStyle='#3a4a7a';g.beginPath();g.arc(rx,yb-26,7,0,7);g.fill();g.strokeStyle=lt;g.lineWidth=.6;g.beginPath();for(let k=0;k<8;k++){const q=k*Math.PI/4;g.moveTo(rx,yb-26);g.lineTo(rx+Math.cos(q)*7,yb-26+Math.sin(q)*7)}g.stroke();
    g.fillStyle='#1a1410';for(const dx of [-9,0,9]){g.beginPath();g.moveTo(rx+dx-3,yb+4);g.lineTo(rx+dx-3,yb-6);g.quadraticCurveTo(rx+dx,yb-11,rx+dx+3,yb-6);g.lineTo(rx+dx+3,yb+4);g.fill()}}
  else if(ep===5){// Leuchtturm von Alexandria: viereckiger Sockel, achteckige Mitte, runder Aufsatz mit Feuer
    sh(s*.36,s*.14);box(cx-26,y1-6,44,30,14,lt);for(let k=0;k<4;k++){g.fillStyle='#1a1410';g.fillRect(cx-22+k*10,y1-26,2.4,5)}
    box(cx-16,y1-36,26,54,9,st);for(let k=0;k<3;k++){g.fillStyle='#1a1410';g.fillRect(cx-6,y1-48-k*14,2.4,5)}
    box(cx-9,y1-90,14,26,6,lt);g.fillStyle=dk;g.fillRect(cx-11,y1-118,20,2.4);
    g.fillStyle='#d2c8b0';for(const px of [cx-9,cx-2,cx+5])g.fillRect(px,y1-130,2,12);g.fillStyle=shade(a.roof,0);g.beginPath();g.moveTo(cx-11,y1-130);g.lineTo(cx-1,y1-140);g.lineTo(cx+9,y1-130);g.fill()}
  else if(ep===6){// Börse: klassizistischer Bau mit Säulenportikus, Giebel mit Relief, Freitreppe
    sh(s*.5,s*.18);const x0=bx+8,xf=x1-20,yb=y1-8;box(x0,yb-10,xf-x0,44,16,'#d6cfbe');
    g.fillStyle='#c4bca8';for(let k=0;k<4;k++)g.fillRect(x0-4+k*2,yb-k*2.6,xf-x0+8-k*4,2.6);
    g.fillStyle='rgba(30,26,20,.45)';g.fillRect(x0+4,yb-48,xf-x0-8,38);cols(x0+6,xf-6,yb-10,36,8,'#e6dfd0');
    g.fillStyle='#e8e2d4';g.fillRect(x0-2,yb-54,xf-x0+4,6);g.beginPath();g.moveTo(x0-3,yb-54);g.lineTo((x0+xf)/2,yb-72);g.lineTo(xf+3,yb-54);g.closePath();g.fill();
    g.fillStyle='rgba(120,110,90,.4)';g.beginPath();g.moveTo(x0+12,yb-56);g.lineTo((x0+xf)/2,yb-68);g.lineTo(xf-12,yb-56);g.closePath();g.fill();g.fillStyle='#c8a240';g.beginPath();g.arc((x0+xf)/2,yb-60,2.4,0,7);g.fill()}
  else if(ep===7){// Eiffelturm: gebogene Fachwerkpfeiler, zwei Plattformen, Spitze
    sh(s*.44,s*.14);const ir='#6a5a48',ilt='#8a7a64',top=y1-200;
    const leg=(sx,dir)=>{g.strokeStyle=ir;g.lineWidth=5;g.beginPath();g.moveTo(sx,y1-4);g.quadraticCurveTo(cx+dir*14,y1-60,cx+dir*3,top+30);g.stroke();g.strokeStyle=ilt;g.lineWidth=1;g.beginPath();g.moveTo(sx-1,y1-5);g.quadraticCurveTo(cx+dir*13,y1-60,cx+dir*2.4,top+30);g.stroke()};
    leg(bx+4,-1);leg(x1-4,1);g.strokeStyle='rgba(106,90,72,.85)';g.lineWidth=.8;g.beginPath();for(let k=0;k<26;k++){const t1=k/26,t2=(k+1)/26,yy=y1-4-(y1-4-top-30)*t1,yy2=y1-4-(y1-4-top-30)*t2,w1=(s*.5-3)*(1-t1)**1.8+3,w2=(s*.5-3)*(1-t2)**1.8+3;g.moveTo(cx-w1,yy);g.lineTo(cx+w2,yy2);g.moveTo(cx+w1,yy);g.lineTo(cx-w2,yy2)}g.stroke();
    g.fillStyle=ir;g.beginPath();g.moveTo(bx+14,y1-30);g.quadraticCurveTo(cx,y1-50,x1-14,y1-30);g.lineTo(x1-16,y1-34);g.quadraticCurveTo(cx,y1-52,bx+16,y1-34);g.fill();
    g.fillRect(cx-s*.24,y1-44,s*.48,3);g.fillRect(cx-11,y1-110,22,2.6);g.fillRect(cx-5,top+28,10,2);
    g.strokeStyle=ir;g.lineWidth=1.4;g.beginPath();g.moveTo(cx,top+28);g.lineTo(cx,top);g.stroke()}
  else if(ep===8){// Pentagon: fünfeckiger Ringbau mit Flachdächern und Innenhof
    sh(s*.55,s*.2);const P=(r,dy)=>{const pts=[];for(let i=0;i<5;i++){const an=-Math.PI/2+i*Math.PI*2/5;pts.push([cx+Math.cos(an)*r,y1-s*.34+dy+Math.sin(an)*r*.48])}return pts};
    const path=pts=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()};
    const o=P(s*.52,0),o2=P(s*.52,-12),i1=P(s*.24,-12);
    for(let i=0;i<5;i++){const a1=o[i],a2=o[(i+1)%5];if(a1[1]+a2[1]<(y1-s*.34)*2-8)continue;g.fillStyle=(a2[0]>a1[0])?(a1[0]<cx?'#a8aaa2':'#8e908a'):'#7a7c76';g.beginPath();g.moveTo(...a1);g.lineTo(...a2);g.lineTo(a2[0],a2[1]-12);g.lineTo(a1[0],a1[1]-12);g.closePath();g.fill();
      g.fillStyle='rgba(30,36,40,.5)';const n=8;for(let k=1;k<n;k++){const t=k/n;g.fillRect(a1[0]+(a2[0]-a1[0])*t-.6,a1[1]+(a2[1]-a1[1])*t-9,1.2,5)}}
    g.fillStyle='#9a9c94';path(o2);g.fill();for(const r of [.43,.34]){g.strokeStyle='rgba(60,62,58,.45)';g.lineWidth=1;path(P(s*r,-12));g.stroke()}
    g.fillStyle='#6a8a4a';path(i1);g.fill();g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.moveTo(...i1[4]);g.lineTo(...i1[0]);g.lineTo(...i1[1]);g.lineTo(i1[1][0],i1[1][1]+4);g.lineTo(i1[0][0],i1[0][1]+4);g.lineTo(i1[4][0],i1[4][1]+4);g.fill()}
  else{// Raumstation: Startrampe mit Rakete, Kontrollzentrum, Parabolantenne
    sh(s*.5,s*.18);g.fillStyle='#8a8c88';g.fillRect(bx+4,y1-16,s-8,12);g.fillStyle='#a8aaa6';g.beginPath();g.moveTo(bx+4,y1-16);g.lineTo(x1-4,y1-16);g.lineTo(x1+6,y1-22);g.lineTo(bx+14,y1-22);g.fill();
    box(bx+8,y1-18,26,16,10,'#c8ccd0');g.fillStyle='#3a5a7a';g.fillRect(bx+10,y1-30,22,3);
    const rx=cx+14;g.strokeStyle='#b8402e';g.lineWidth=1.6;g.beginPath();g.moveTo(rx+12,y1-20);g.lineTo(rx+12,y1-150);g.stroke();g.lineWidth=.6;g.beginPath();for(let k=y1-24;k>y1-150;k-=6){g.moveTo(rx+12,k);g.lineTo(rx+8,k-3)}g.stroke();
    const rg=g.createLinearGradient(rx-5,0,rx+5,0);rg.addColorStop(0,'#f4f4f2');rg.addColorStop(.6,'#d8dadc');rg.addColorStop(1,'#9a9ea2');g.fillStyle=rg;g.fillRect(rx-5,y1-130,10,110);
    g.beginPath();g.moveTo(rx-5,y1-130);g.quadraticCurveTo(rx,y1-150,rx+5,y1-130);g.fill();g.fillStyle='#2a2a2e';g.fillRect(rx-5,y1-60,10,3);g.fillRect(rx-5,y1-100,10,2);g.fillStyle=pc;g.fillRect(rx-5,y1-84,10,6);
    for(const d of [-1,1]){g.fillStyle='#d8dadc';g.beginPath();g.moveTo(rx+d*5,y1-40);g.lineTo(rx+d*10,y1-22);g.lineTo(rx+d*5,y1-24);g.fill()}
    const ax=bx+s*.28,ay=y1-34;g.strokeStyle='#8a8e92';g.lineWidth=1.4;g.beginPath();g.moveTo(ax,y1-18);g.lineTo(ax,ay);g.stroke();g.fillStyle='#e0e2e4';g.beginPath();g.ellipse(ax-2,ay-6,9,6,-.6,0,Math.PI);g.fill();g.strokeStyle='#9a9ea2';g.lineWidth=.6;g.beginPath();g.moveTo(ax-2,ay-6);g.lineTo(ax+3,ay-14);g.stroke()}
  a.banner(g,x1-8,y1-8,pc,14)};
BGFX_LIVE.monument=(g,b,a)=>{const ep=b.mep??a.ep,cx=a.x+a.s/2;
  if(ep===5){const y=a.y+a.s-130+(-110+110),fl=.6+.4*Math.sin(a.time*6);g.fillStyle=`rgba(255,190,80,${fl.toFixed(2)})`;g.beginPath();g.arc(cx,a.y+a.s-124,4+fl*2,0,7);g.fill();const gl=g.createRadialGradient(cx,a.y+a.s-124,0,cx,a.y+a.s-124,18);gl.addColorStop(0,'rgba(255,210,120,.35)');gl.addColorStop(1,'rgba(255,210,120,0)');g.fillStyle=gl;g.beginPath();g.arc(cx,a.y+a.s-124,18,0,7);g.fill()}
  if(ep===9){const bl=Math.sin(a.time*3)>0;if(bl){g.fillStyle='rgba(255,80,60,.9)';g.beginPath();g.arc(cx+26,a.y+a.s-150,1.4,0,7);g.fill()}}};
// Industrie- und Militärbauten der Moderne
BGFX.factory=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),brick=ep<=7,wc=brick?'#8a4a34':'#9a9e9c',rc=brick?'#4a4e52':'#6a7074';
  g.fillStyle='rgba(90,88,82,.55)';g.fillRect(bx,y1-16,s,16);g.strokeStyle='#4a4038';g.lineWidth=.8;g.beginPath();g.moveTo(bx,y1-5);g.lineTo(x1,y1-5);g.moveTo(bx,y1-2);g.lineTo(x1,y1-2);g.stroke();g.fillStyle='#5a4a3a';for(let x=bx+1;x<x1;x+=3)g.fillRect(x,y1-5.6,1.2,4.2);
  // Halle mit Sheddach
  const x0=bx+4,xf=x1-22,yb=y1-14,H=30,d=16;g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(xf,yb);g.lineTo(xf+d+14,yb-d*.55+6);g.lineTo(xf+d+14,yb-H-d*.55+10);g.lineTo(xf+d,yb-H-d*.55);g.closePath();g.fill();
  g.fillStyle=shade(wc,-40);g.beginPath();g.moveTo(xf,yb);g.lineTo(xf+d,yb-d*.55);g.lineTo(xf+d,yb-H-d*.55);g.lineTo(xf,yb-H);g.closePath();g.fill();
  wallFace(g,x0,yb-H,xf,yb,wc,brick?'brick':'concrete');
  const n=Math.floor((xf-x0)/12);for(let k=0;k<n;k++){const sx=x0+k*(xf-x0)/n,w=(xf-x0)/n;g.fillStyle=shade(rc,10);g.beginPath();g.moveTo(sx,yb-H);g.lineTo(sx+d,yb-H-d*.55);g.lineTo(sx+d+w*.15,yb-H-d*.55-9);g.lineTo(sx+w*.15,yb-H-9);g.closePath();g.fill();
    g.fillStyle='#7a9aa8';g.beginPath();g.moveTo(sx+w*.15,yb-H-9);g.lineTo(sx+w*.15+d,yb-H-d*.55-9);g.lineTo(sx+w+d,yb-H-d*.55);g.lineTo(sx+w,yb-H);g.closePath();g.fill();g.fillStyle='rgba(255,255,255,.18)';g.fillRect(sx+w*.2,yb-H-8,w*.6,1.2);
    g.fillStyle='#2a3a44';g.fillRect(sx+w*.25,yb-H*.75,w*.5,H*.35);g.strokeStyle='rgba(200,200,200,.35)';g.lineWidth=.4;g.beginPath();g.moveTo(sx+w*.5,yb-H*.75);g.lineTo(sx+w*.5,yb-H*.4);g.moveTo(sx+w*.25,yb-H*.57);g.lineTo(sx+w*.75,yb-H*.57);g.stroke()}
  g.fillStyle='#3a3e42';g.fillRect((x0+xf)/2-9,yb-16,18,16);g.strokeStyle='rgba(120,120,120,.5)';g.lineWidth=.5;g.beginPath();for(let k=yb-15;k<yb;k+=2){g.moveTo((x0+xf)/2-9,k);g.lineTo((x0+xf)/2+9,k)}g.stroke();
  for(const cx of [xf+4,xf+12]){g.fillStyle='#6a3a2a';g.fillRect(cx,yb-H-38,5,38);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(cx+3.4,yb-H-38,1.6,38);g.fillStyle='#3a2a20';g.fillRect(cx-.6,yb-H-39,6.2,1.6);
    for(let k=0;k<4;k++){const sg=g.createRadialGradient(cx+3+k*3,yb-H-44-k*5,0,cx+3+k*3,yb-H-44-k*5,3+k*1.6);sg.addColorStop(0,`rgba(110,108,104,${.5-k*.1})`);sg.addColorStop(1,'rgba(110,108,104,0)');g.fillStyle=sg;g.beginPath();g.arc(cx+3+k*3,yb-H-44-k*5,3+k*1.6,0,7);g.fill()}}
  g.fillStyle=pc;g.fillRect(x0+4,yb-H+4,8,3);a.banner(g,x1-6,y1-14,pc,14)};
BGFX.airfield=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s);
  g.fillStyle='rgba(110,130,80,.5)';g.fillRect(bx,by+4,s,s-4);
  // Rollbahn mit Markierungen
  const ry=y1-30;g.fillStyle='#4a4c4e';g.fillRect(bx,ry,s,24);g.fillStyle='rgba(255,255,255,.08)';g.fillRect(bx,ry,s,1);g.fillStyle='#e8e8e2';for(let x=bx+14;x<x1-14;x+=12)g.fillRect(x,ry+11.4,6,1.2);for(const ex of [bx+3,x1-9])for(let k=0;k<5;k++)g.fillRect(ex,ry+3+k*4,6,1.4);
  g.fillStyle='#5a5c5e';g.fillRect(bx+s*.3,by+s*.45,12,ry-by-s*.45);
  // Rundbogenhangar mit offenem Tor
  const hx0=bx+6,hx1=bx+s*.56,hb=by+s*.5,hh=26;g.fillStyle='rgba(8,14,6,.32)';g.fillRect(hx1,hb-hh+6,18,hh);
  g.fillStyle='#6a7074';g.beginPath();g.moveTo(hx1,hb);g.lineTo(hx1+14,hb-8);g.lineTo(hx1+14,hb-8-hh*.4);g.quadraticCurveTo(hx1+14,hb-8-hh*1.05,hx1,hb-hh-2);g.closePath();g.fill();
  const hg=g.createLinearGradient(0,hb-hh-14,0,hb);hg.addColorStop(0,'#c8ccce');hg.addColorStop(1,'#80868a');g.fillStyle=hg;g.beginPath();g.moveTo(hx0,hb);g.lineTo(hx0,hb-hh*.4);g.quadraticCurveTo(hx0,hb-hh-4,(hx0+hx1)/2,hb-hh-2);g.quadraticCurveTo(hx1,hb-hh-4,hx1,hb-hh*.4);g.lineTo(hx1,hb);g.closePath();g.fill();
  g.strokeStyle='rgba(60,64,68,.35)';g.lineWidth=.5;g.beginPath();for(let k=hx0+3;k<hx1;k+=3){g.moveTo(k,hb);g.lineTo(k,hb-hh*.4-Math.sin((k-hx0)/(hx1-hx0)*Math.PI)*hh*.6)}g.stroke();
  g.fillStyle='#1e2226';g.fillRect(hx0+6,hb-16,hx1-hx0-12,16);g.fillStyle='#9aa0a4';g.beginPath();g.moveTo(hx0+12,hb-6);g.lineTo(hx1-12,hb-6);g.lineTo(hx1-16,hb-8);g.lineTo(hx0+16,hb-8);g.fill();g.fillRect((hx0+hx1)/2-1,hb-12,2,6);
  // Tower mit Glaskanzel, Tanks, Windsack
  const tx=x1-24,tb=by+s*.5;g.fillStyle='rgba(8,14,6,.3)';g.fillRect(tx+6,tb-2,12,3);g.fillStyle='#d8d6ce';g.fillRect(tx,tb-40,8,40);g.fillStyle='#a8a69e';g.fillRect(tx+6,tb-40,2,40);
  g.fillStyle='#3a4a54';g.beginPath();g.moveTo(tx-3,tb-40);g.lineTo(tx+11,tb-40);g.lineTo(tx+9,tb-48);g.lineTo(tx-1,tb-48);g.closePath();g.fill();g.fillStyle='rgba(160,200,220,.5)';g.fillRect(tx,tb-47,4,6);g.fillStyle='#5a5e62';g.fillRect(tx-2,tb-50,12,2);
  for(const fx of [x1-12,x1-6]){g.fillStyle='#c8ccce';g.beginPath();g.ellipse(fx,by+s*.42,3,1.2,0,0,7);g.fill();g.fillRect(fx-3,by+s*.42,6,7);g.fillStyle='rgba(0,0,0,.2)';g.fillRect(fx+1,by+s*.42,2,7)}
  g.strokeStyle='#3a3a3a';g.lineWidth=.6;g.beginPath();g.moveTo(bx+s*.66,ry-1);g.lineTo(bx+s*.66,ry-10);g.stroke();g.fillStyle='#e07a2a';g.beginPath();g.moveTo(bx+s*.66,ry-10);g.lineTo(bx+s*.66+6,ry-9);g.lineTo(bx+s*.66+6,ry-8);g.lineTo(bx+s*.66,ry-7.6);g.fill();
  a.banner(g,tx+4,tb-50,pc,12)};
BGFX.sniper=(g,s,ep,pc,a)=>{const {bx,by,x1,y1}=BO(s),cx=bx+s/2,c=ep>=8?'#9a9c96':'#8a8478';
  g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.ellipse(cx+8,y1-2,s*.5,4,0,0,7);g.fill();
  const tg=g.createLinearGradient(cx-8,0,cx+8,0);tg.addColorStop(0,shade(c,20));tg.addColorStop(.6,c);tg.addColorStop(1,shade(c,-40));g.fillStyle=tg;g.beginPath();g.moveTo(cx-9,y1-3);g.lineTo(cx-6,y1-60);g.lineTo(cx+6,y1-60);g.lineTo(cx+9,y1-3);g.closePath();g.fill();
  g.strokeStyle='rgba(40,36,30,.25)';g.lineWidth=.5;g.beginPath();for(let k=y1-8;k>y1-60;k-=4){g.moveTo(cx-9+(y1-3-k)*.05,k);g.lineTo(cx+9-(y1-3-k)*.05,k)}g.stroke();
  g.fillStyle='#1a1612';g.fillRect(cx-1,y1-30,2,4);g.fillRect(cx-1,y1-46,2,4);g.fillRect(cx-2.6,y1-10,5,7);
  g.fillStyle=shade(c,6);g.fillRect(cx-10,y1-64,20,4);g.fillStyle=shade(c,-30);g.fillRect(cx-10,y1-61,20,1.4);
  for(let k=0;k<5;k++){g.fillStyle=k%2?'#8a7a58':'#9a8a64';g.beginPath();g.ellipse(cx-8+k*4,y1-66,2.4,1.5,0,0,7);g.fill()}
  g.fillStyle='#3a3e3a';g.fillRect(cx-10,y1-78,20,2);g.strokeStyle='#4a4038';g.lineWidth=.8;g.beginPath();g.moveTo(cx-9,y1-76);g.lineTo(cx-9,y1-67);g.moveTo(cx+9,y1-76);g.lineTo(cx+9,y1-67);g.stroke();
  g.strokeStyle='#2a2a2a';g.lineWidth=.9;g.beginPath();g.moveTo(cx+2,y1-68);g.lineTo(cx+12,y1-70);g.stroke();g.fillStyle=pc;g.fillRect(cx-9,y1-60,4,3)};
function modDraw(g,b,a){const F=BGFX[b.type];
  if(F){const ep=b.type==='monument'&&b.mep!==undefined?b.mep:a.ep,hd=BGFX_HEAD[b.type]||40,c=sprite('b|'+b.type+'|'+ep+'|'+b.owner,a.s+28,a.s+hd+16,g2=>F(g2,a.s,ep,a.pc,a));g.drawImage(c,a.x-4,a.y-hd,c.lw,c.lh);if(BGFX_LIVE[b.type])BGFX_LIVE[b.type](g,b,a);return}
  BLD[b.type].draw(g,b,a)}
function drawBld(g,b){drawBld0(g,b);if(b.built&&b.hp<b.maxhp*.7)bldFire(g,b);if(aiS&&aiS.married&&b.type==='tc'){const x=(b.x+b.size/2)*T,y=b.y*T-30+Math.sin(gameT*3)*2;g.fillStyle='#e0546a';g.beginPath();g.moveTo(x,y+7);g.bezierCurveTo(x-10,y-1,x-5,y-8,x,y-3);g.bezierCurveTo(x+5,y-8,x+10,y-1,x,y+7);g.fill()}}
function drawBld0(g,b){
  const D=BLD[b.type],x=b.x*T,y=b.y*T,s=b.size*T,ep=players[b.owner].epoch,pc=PCOL[b.owner];
  if(D.draw){g.save();try{modDraw(g,b,{x,y,s,lift:Math.min(12,s*.18),ep,pc,wall:WALL[ep],roof:ROOF[ep],roofHi:ROOF_HI[ep],...DRAW_API})}catch(e){}g.restore();if(!b.built)drawProg(g,b,x,y,s);return}
  const spr=bldSprite(b.type,ep,b.owner);
  if(!b.built){
    // foundation, scaffolding and the building rising from the ground
    g.fillStyle='rgba(90,72,48,.75)';g.fillRect(x+2,y+2,s-4,s-4);
    g.save();const top=y-36+(spr.lh)*(1-b.prog*.999);g.beginPath();g.rect(x-8,top,s+24,y+s+12-top);g.clip();g.globalAlpha=.9;g.drawImage(spr,x-4,y-36,spr.lw,spr.lh);g.restore();
    g.strokeStyle='#a68a5c';g.lineWidth=1.5;
    for(let i=0;i<=b.size*2;i++){const px=x+2+i*(s-4)/(b.size*2);g.beginPath();g.moveTo(px,y+s-2);g.lineTo(px,y+4-10*(1-b.prog));g.stroke()}
    g.beginPath();for(let k=0;k<3;k++){const py=y+s-4-k*(s/3);g.moveTo(x+2,py);g.lineTo(x+s-2,py)}g.stroke();g.lineWidth=1;
    drawProg(g,b,x,y,s);return;
  }
  g.drawImage(spr,x-4,y-36,spr.lw,spr.lh);
  if(b.sabotUntil>gameT){const cx=x+s/2,cy=y-6+Math.sin(gameT*4)*1.5;g.fillStyle='rgba(30,20,20,.8)';g.beginPath();g.arc(cx,cy,7,0,7);g.fill();g.strokeStyle='#ff6a5a';g.lineWidth=2;g.beginPath();g.moveTo(cx-3.5,cy-3.5);g.lineTo(cx+3.5,cy+3.5);g.moveTo(cx+3.5,cy-3.5);g.lineTo(cx-3.5,cy+3.5);g.stroke();g.lineWidth=1}
}
// Rauch, Feuer und Explosionen: weiche Partikel statt flacher Kreise
const PUFF=k=>sprite('fx|'+k,64,64,g=>{const c={d:'38,34,30',l:'214,208,198',f:'255,170,70',w:'255,240,200',s:'140,120,90'}[k],gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${c},1)`);gr.addColorStop(.45,`rgba(${c},.55)`);gr.addColorStop(1,`rgba(${c},0)`);g.fillStyle=gr;g.fillRect(0,0,64,64)});
function puff(g,k,x,y,r,a){if(a<=.01||r<=0)return;g.globalAlpha=Math.min(1,a);g.drawImage(PUFF(k),x-r,y-r,r*2,r*2);g.globalAlpha=1}
let decals=[];
function flame(g,x,y,h,w,t,ph){ // züngelnde Flamme: viele schmale Zungen mit Farbverlauf von heller Glut zu dunklem Rot
  g.save();g.globalCompositeOperation='lighter';puff(g,'f',x,y-h*.25,w*2.8,.32+.1*Math.sin(t*9+ph));
  for(let i=0;i<6;i++){const o=(i/5-.5)*w*1.6,n=.55+.45*Math.abs(Math.sin(t*(6+i*1.3)+ph+i*2.3)),hh=h*n*(1-Math.abs(o)/(w*1.4)),ww=w*.42,sw=Math.sin(t*8+ph+i)*1.6;
    const gr=g.createLinearGradient(0,y,0,y-hh);gr.addColorStop(0,'rgba(255,215,120,.85)');gr.addColorStop(.35,'rgba(255,130,30,.7)');gr.addColorStop(1,'rgba(150,30,10,0)');g.fillStyle=gr;
    g.beginPath();g.moveTo(x+o-ww,y);g.bezierCurveTo(x+o-ww,y-hh*.45,x+o+sw*.5,y-hh*.6,x+o+sw,y-hh);g.bezierCurveTo(x+o+sw*.5+ww*.3,y-hh*.5,x+o+ww,y-hh*.35,x+o+ww,y);g.closePath();g.fill()}
  g.restore()}
function bldFire(g,b){
  const x=b.x*T,y=b.y*T,s=b.size*T,r=b.hp/b.maxhp,t=gameT,n=r<.5?(r<.25?3:2):0;
  // Brandspuren an der Wand
  if(r<.5){g.save();g.globalAlpha=.5*(1-r);for(let i=0;i<3;i++){const fx=x+s*(.2+.6*((b.id*.37+i*.29)%1)),fy=y+s*(.25+.4*((b.id*.53+i*.41)%1));puff(g,'d',fx,fy,s*.18,1)}g.restore()}
  for(let i=0;i<n;i++){const fx=x+s*(.22+.56*((b.id*.61+i*.37)%1)),fy=y+s*(.15+.35*((b.id*.23+i*.47)%1));flame(g,fx,fy,9+s*.1,3.2+s*.03,t,i*1.7+b.id)}
  if(!paused&&started&&SET.q>=2){const k=n||1;
    for(let i=0;i<k;i++)if(uiRand()<(n?.3:.12)){const fx=b.x+b.size*(.22+.56*((b.id*.61+i*.37)%1)),fy=b.y+b.size*(.15+.35*((b.id*.23+i*.47)%1))-.3;spawnVfx(fx,fy,'bsmoke',{vx:.25+uiRand()*.15,vy:-.55-uiRand()*.2,dk:n?1:0})}
    if(n&&uiRand()<.15)spawnVfx(b.x+b.size*(.3+.4*uiRand()),b.y+b.size*.3,'ember',{vx:(uiRand()-.3)*.6,vy:-1.2-uiRand()})}}
function drawProg(g,b,x,y,s){g.fillStyle='rgba(0,0,0,.6)';g.fillRect(x+4,y+s-8,s-8,5);g.fillStyle='#e9be72';g.fillRect(x+4,y+s-8,(s-8)*b.prog,5)}

// ---------- units (animated, drawn live)
const SKIN='#d6ab7f';
const DRAW_API={T,PCOL,PCOL_DK,SKIN,shade,blob,sprite,hall,hipRoof,bshadow,banner,wallFace,door,MAT,get time(){return gameT},epochOf:p=>players[p].epoch};
function legs(g,x,y,a,moving,anim,col){
  col='#2a241c';const ph=moving?Math.sin(gameT*13+anim)*3:0,px=-Math.sin(a),py=Math.cos(a),fx=Math.cos(a),fy=Math.sin(a);
  g.fillStyle=col;
  for(const s of [-1,1]){g.beginPath();g.ellipse(x+px*1.9*s+fx*ph*s,y+py*1.9*s+fy*ph*s*.6+2.4,1.4,1.8,0,0,7);g.fill()}
}
function humanoid(g,u,ep,pc,dk){
  // Fußvolk in aufrechter Seitenansicht wie in EE2: echte Proportionen, Beine und Arme mit Gangart, Tracht und Waffen je Epoche
  const UD=UNITS[u.type],re=players[u.owner].epoch,lk=LOOK(u.type),civ=!!(UD.civil||UD.heal),wk=lk==='worker',sol=!wk&&!civ,tint=UD.tint;let marked=false;
  const x=u.x*T,y=u.y*T,dir=Math.cos(u.ang)>=0?1:-1,mv=u.moving,p=gameT*12+u.anim,s=mv?Math.sin(p):0,Y=mv?-Math.abs(Math.cos(p))*.7:0;
  const sw=u.swing>0?Math.sin(u.swing/.25*Math.PI):0,aim=u.swing>0||(u.order&&u.order.t==='attack');
  const sk=['#d6ab7f','#c49a76','#a8785a','#8e6648'][u.id%4],hair=['#2a1d12','#3b2a1a','#5a3e26','#1e1a16','#7a6a58'][u.id%5];
  const cloth=wk?['#7a6a50','#6e604a','#66604e','#5a5446','#4f4a40'][Math.min(4,re>>1)]:civ?'#d8d2c2':['#7a5a3a','#7a6248','#8a3a2a','#6e3a30','#5a5a5e','#5a4a3a','#3e4660','#2e3448','#5e6450','#4e5440'][Math.min(9,re)];
  const trous=wk||re<=4?shade(cloth,-28):re>=8?shade(cloth,-12):'#d8d2c0',boot='#1e1812';
  g.save();g.translate(x,y+4);g.scale(dir,1);g.lineCap='round';g.lineJoin='round';
  const SH=[.3,-12.6+Y];
  const arm=(a1,a2,col)=>{const ex=SH[0]+Math.sin(a1)*3.3,ey=SH[1]+Math.cos(a1)*3.3,hx=ex+Math.sin(a2)*3,hy=ey+Math.cos(a2)*3;
    g.strokeStyle=col;g.lineWidth=1.7;g.beginPath();g.moveTo(SH[0],SH[1]);g.lineTo(ex,ey);g.lineTo(hx,hy);g.stroke();g.fillStyle=sk;g.beginPath();g.arc(hx,hy,.85,0,7);g.fill();return [hx,hy]};
  const leg=(ph,col)=>{const k=mv?Math.sin(ph):0,kx=k*1.7+.4,fx=k*3,fy=mv?-Math.max(0,Math.cos(ph))*1.1:0;
    g.strokeStyle=col;g.lineWidth=1.9;g.beginPath();g.moveTo(0,-6.6+Y);g.lineTo(kx,-3.4+Y*.5);g.lineTo(fx,fy-.6);g.stroke();
    g.strokeStyle=boot;g.lineWidth=1.8;g.beginPath();g.moveTo(fx-.2,fy-1.4);g.lineTo(fx,fy-.4);g.stroke();g.fillStyle=boot;g.beginPath();g.ellipse(fx+.6,fy-.4,1.4,.65,0,0,7);g.fill()};
  // Last auf dem Rücken
  if(wk&&u.carry>0){if(u.ct==='wood'){for(let k=0;k<3;k++){g.fillStyle=k%2?'#6a4a2a':'#7a5530';g.fillRect(-6,-15.2+Y+k*1.4,9,1.4)}g.fillStyle='#c8a46a';g.fillRect(2.6,-15.2+Y,.9,4.2)}
    else{g.fillStyle='#8a6a44';g.beginPath();g.ellipse(-3.2,-10.6+Y,2.6,3.3,0,0,7);g.fill();g.fillStyle=u.ct==='food'?'#a8323e':u.ct==='gold'?'#d8b44a':'#a8aeb2';g.beginPath();g.ellipse(-3.2,-13.4+Y,2,1,0,0,7);g.fill()}}
  if(tint&&lk!=='infantry'){g.fillStyle=tint;g.beginPath();g.ellipse(-2.8,-10.2+Y,1.8,3,0,0,7);g.fill();g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.4;g.stroke();marked=true}
  // hinteres Bein, hinterer Arm
  leg(p+Math.PI,shade(trous,-22));
  const bowAim=lk==='ranged'&&re>=1&&re<=4&&aim,gunAim=lk==='ranged'&&re>=5&&aim;
  const back=bowAim?arm(1.45,1.9,shade(cloth,-30)):gunAim?arm(.9,2.2,shade(cloth,-30)):arm(-s*.45,-s*.45+.25,shade(cloth,-30));
  // Rumpf: Tunika/Rock, nach unten ausgestellt, Licht von oben
  const hem=civ?-1.4:wk?-5.2:-5.8,tg=g.createLinearGradient(0,-13.5+Y,0,hem+Y);tg.addColorStop(0,shade(cloth,18));tg.addColorStop(1,shade(cloth,-26));
  leg(p,trous);
  g.fillStyle=tg;g.beginPath();g.moveTo(-1.9,-13.4+Y);g.quadraticCurveTo(.2,-14.1+Y,2.1,-13.4+Y);g.lineTo(2.6+(civ?.8:0),hem+Y);g.lineTo(-2.4-(civ?.8:0),hem+Y);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.16)';g.fillRect(-2.4,hem-1+Y,5,1);
  if(sol&&re===3){g.fillStyle='#7a7f84';g.fillRect(-1.9,-13.2+Y,4,5.4);g.strokeStyle='rgba(30,30,30,.35)';g.lineWidth=.35;g.beginPath();for(let k=-12.4;k<-8;k+=1.1){g.moveTo(-1.9,k+Y);g.lineTo(2.1,k+Y)}g.stroke()}
  if(sol&&re===2){g.fillStyle='#b08a48';g.fillRect(-1.9,-13.2+Y,4,5);g.fillStyle='rgba(255,240,200,.25)';g.fillRect(-1.6,-12.8+Y,1.2,4)}
  if(sol&&re===4){g.fillStyle='#e8e2d0';g.fillRect(-2,-13+Y,4.4,7.4);g.fillStyle=pc;g.fillRect(-.3,-12.6+Y,1,6.6);g.fillRect(-1.6,-10.8+Y,3.6,1)}
  // Spielerfarbe als Schärpe/Gurt, Gürtel
  if(!civ&&re!==4){g.strokeStyle=pc;g.globalAlpha=.85;g.lineWidth=1.2;g.beginPath();g.moveTo(-1.6,-13+Y);g.lineTo(2,-8.4+Y);g.stroke();g.globalAlpha=1}
  if(sol&&re>=5&&re<=7){g.strokeStyle='#e8e2d0';g.lineWidth=.7;g.beginPath();g.moveTo(1.9,-13+Y);g.lineTo(-1.8,-8.4+Y);g.stroke()}
  if(sol&&re===9){g.fillStyle='#2e3326';g.fillRect(-2,-12.8+Y,4.2,4.6);g.fillStyle='rgba(120,120,80,.45)';g.fillRect(-1.4,-12.2+Y,1.4,1.2)}
  g.fillStyle=civ?'#7a6a52':'#3a2a1a';g.fillRect(-2.2,-8.2+Y,4.6,.9);
  if(civ){g.fillStyle=pc;g.globalAlpha=.8;g.fillRect(-.3,-13+Y,.9,11);g.globalAlpha=1}
  if(UD.heal){g.fillStyle='#c33';g.fillRect(.4,-12.4+Y,1,3.4);g.fillRect(-.6,-11.2+Y,3,1)}
  // Kopf im Profil: Hals, Hinterkopf mit Haar, Nase, Auge
  const HX=.5,HY=-15.6+Y;g.fillStyle=sk;g.fillRect(-.3,-14.4+Y,1.4,1.4);g.beginPath();g.arc(HX,HY,2.05,0,7);g.fill();g.beginPath();g.moveTo(2.3,HY-.6);g.lineTo(3.1,HY+.4);g.lineTo(2.3,HY+.6);g.fill();
  g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.arc(HX,HY,2.05,Math.PI*.5,Math.PI*1.2);g.fill();
  g.fillStyle=hair;g.beginPath();g.arc(HX-.2,HY-.3,2.15,Math.PI*.75,Math.PI*1.85);g.fill();g.fillStyle='#120c08';g.fillRect(1.6,HY-.6,.6,.6);
  if(re<=1&&!wk&&!civ&&u.id%2){g.fillStyle=hair;g.beginPath();g.arc(1.2,HY+1.6,1.3,0,Math.PI);g.fill()}   // Bart
  // Kopfbedeckung
  const helm=(c)=>{g.fillStyle=c;g.beginPath();g.arc(HX,HY-.3,2.4,Math.PI,0);g.fill()};
  if(wk){if(re>=1){g.fillStyle='#b8984a';g.beginPath();g.ellipse(HX,HY-1.9,3.6,.9,0,0,7);g.fill();g.fillStyle='#c9a85a';g.beginPath();g.ellipse(HX,HY-2.5,1.9,1.3,0,Math.PI,0);g.fill();g.fillStyle='rgba(0,0,0,.2)';g.fillRect(HX-1.8,HY-2.2,3.6,.4)}}
  else if(civ){g.fillStyle=shade(cloth,-12);g.beginPath();g.arc(HX-.4,HY-.2,2.5,Math.PI*.6,Math.PI*2.05);g.fill()}
  else if(re===0){g.fillStyle='#6a4a2c';g.beginPath();g.ellipse(-.2,-13.2+Y,3.2,1.6,0,0,7);g.fill();g.fillStyle='#4a3420';g.beginPath();g.arc(-1.2,-13.4+Y,.6,0,7);g.arc(1,-12.9+Y,.5,0,7);g.fill()}
  else if(re===1){g.fillStyle='#8a6a40';g.fillRect(HX-2.1,HY-1.2,4.2,.8)}
  else if(re===2){helm('#b8904a');g.fillStyle='#9a7838';g.fillRect(HX+.6,HY-.6,1.4,2.4);g.fillStyle='#8a2a24';g.beginPath();g.moveTo(HX+1.8,HY-2.3);g.quadraticCurveTo(HX,HY-5,HX-3,HY-1.8);g.lineTo(HX-2,HY-1.4);g.quadraticCurveTo(HX,HY-3.6,HX+1.8,HY-2.3);g.fill()}
  else if(re===3){helm('#8d9298');g.fillStyle='#6a6e72';g.fillRect(HX-2.6,HY-.5,1.2,2.6);g.fillRect(HX+.8,HY-.4,1,2.2);g.fillStyle='rgba(255,255,255,.3)';g.fillRect(HX-1.2,HY-2.3,1.2,.6)}
  else if(re===4){g.fillStyle='#8d9298';g.fillRect(HX-2.2,HY-2.6,4.5,4.6);g.fillStyle='#1a1a1a';g.fillRect(HX+.4,HY-.8,1.9,.6);g.fillStyle='rgba(255,255,255,.28)';g.fillRect(HX-2,HY-2.4,1,4)}
  else if(re===5){g.fillStyle='#b9bfc4';g.beginPath();g.ellipse(HX,HY-1.3,3.4,.8,-.15,0,7);g.fill();g.beginPath();g.arc(HX,HY-1.5,1.9,Math.PI,0);g.fill();g.fillRect(HX-.3,HY-4.4,.6,1.6)}
  else if(re===6){g.fillStyle='#1d1d22';g.beginPath();g.moveTo(HX-3,HY-1.2);g.lineTo(HX-.4,HY-3.6);g.lineTo(HX+2.8,HY-1.4);g.lineTo(HX,HY-.8);g.closePath();g.fill();g.fillStyle='#d9b24a';g.fillRect(HX+1.2,HY-2.2,.6,.6)}
  else if(re===7){helm('#22242a');g.fillStyle='#c9a649';g.fillRect(HX-.3,HY-4.6,.7,2);g.fillRect(HX+1.2,HY-.6,1.6,.4)}
  else if(re===8){g.fillStyle='#4f5a3c';g.beginPath();g.arc(HX,HY-.6,2.5,Math.PI,0);g.fill();g.beginPath();g.moveTo(HX-2.8,HY-.6);g.lineTo(HX-3,HY+.6);g.lineTo(HX+2.8,HY-.4);g.fill()}
  else{g.fillStyle='#55603f';g.beginPath();g.arc(HX,HY-.5,2.6,Math.PI*.95,Math.PI*2.05);g.fill();g.fillStyle='#3a432c';g.fillRect(HX-1.4,HY-2.4,1.4,1)}
  // vorderer Arm mit Waffe/Werkzeug
  const fa=shade(cloth,-6);
  if(wk&&u.working){const w=Math.sin(gameT*10+u.anim),ang=-1.2+w*1.3;const h=arm(.6+w*.9,1.4+w*.9,fa);
    const ex=h[0]+Math.cos(ang)*7,ey=h[1]+Math.sin(ang)*7;g.strokeStyle='#6b4a2a';g.lineWidth=1.1;g.beginPath();g.moveTo(h[0]-Math.cos(ang)*1.5,h[1]-Math.sin(ang)*1.5);g.lineTo(ex,ey);g.stroke();
    g.fillStyle='#8a9096';g.beginPath();g.moveTo(ex,ey);g.lineTo(ex+Math.cos(ang+1.57)*2.6,ey+Math.sin(ang+1.57)*2.6);g.lineTo(ex+Math.cos(ang)*1.4+Math.cos(ang+1.57)*1.6,ey+Math.sin(ang)*1.4+Math.sin(ang+1.57)*1.6);g.closePath();g.fill()}
  else if(lk==='infantry'){
    const spear=u.type==='spear'||re===1,gun=re>=6&&!spear||re>=8;
    if(gun){const h=arm(aim?1:.25,aim?2:.1,fa);
      if(aim){const gx0=-2.6,gy0=-11.6+Y;g.strokeStyle='#5a3f22';g.lineWidth=1.5;g.beginPath();g.moveTo(gx0,gy0+.6);g.lineTo(h[0],h[1]);g.stroke();g.strokeStyle='#26282a';g.lineWidth=.9;g.beginPath();g.moveTo(h[0]-1,h[1]-.3);g.lineTo(h[0]+8,h[1]-.6);g.stroke();
        if(re<=7){g.strokeStyle='#b0b4b8';g.lineWidth=.45;g.beginPath();g.moveTo(h[0]+8,h[1]-.6);g.lineTo(h[0]+11,h[1]-.7);g.stroke()}
        if(u.swing>.12){g.fillStyle='rgba(255,210,120,.9)';g.beginPath();g.arc(h[0]+9,h[1]-.6,1.4,0,7);g.fill();const pg=g.createRadialGradient(h[0]+12,h[1]-2,0,h[0]+12,h[1]-2,4);pg.addColorStop(0,'rgba(225,222,214,.6)');pg.addColorStop(1,'rgba(225,222,214,0)');g.fillStyle=pg;g.beginPath();g.arc(h[0]+12,h[1]-2,4,0,7);g.fill()}}
      else{g.strokeStyle='#5a3f22';g.lineWidth=1.4;g.beginPath();g.moveTo(h[0]+.2,h[1]+1.5);g.lineTo(h[0]+.6,h[1]-3);g.stroke();g.strokeStyle='#26282a';g.lineWidth=.8;g.beginPath();g.moveTo(h[0]+.6,h[1]-3);g.lineTo(h[0]+1.2,h[1]-11);g.stroke();
        if(re<=7){g.strokeStyle='#b0b4b8';g.lineWidth=.45;g.beginPath();g.moveTo(h[0]+1.2,h[1]-11);g.lineTo(h[0]+1.4,h[1]-14);g.stroke()}}}
    else if(spear){const h=arm(.7,1.5,fa),th=sw*3,an=-.28;const L=re>=5?24:17;
      g.strokeStyle='#6b4a2a';g.lineWidth=.9;g.beginPath();g.moveTo(h[0]-Math.cos(an)*7+th,h[1]-Math.sin(an)*7);g.lineTo(h[0]+Math.cos(an)*(L-7)+th,h[1]+Math.sin(an)*(L-7));g.stroke();
      const tx=h[0]+Math.cos(an)*(L-7)+th,ty=h[1]+Math.sin(an)*(L-7);g.fillStyle='#a8acb0';g.beginPath();g.moveTo(tx+Math.cos(an)*2.6,ty+Math.sin(an)*2.6);g.lineTo(tx-.6,ty-.9);g.lineTo(tx+.6,ty+.9);g.closePath();g.fill();
      if(re<=2){marked=!!tint;g.fillStyle=tint||(re===0?'#7a6a58':'#6e5a40');g.beginPath();g.ellipse(2.4,-9.6+Y,1.6,3.6,0,0,7);g.fill()}}
    else{// Nahkampf: Keule (Steinzeit) bzw. Schwert mit Schild
      const ba=-1.15+sw*1.25,h=arm(.5-sw*.2+s*.1,1.3+sw*.6,fa);
      if(re===0){g.strokeStyle='#6b4a2a';g.lineWidth=1.6;g.beginPath();g.moveTo(h[0],h[1]);g.lineTo(h[0]+Math.cos(ba)*7,h[1]+Math.sin(ba)*7);g.stroke();g.fillStyle='#5a3d22';g.beginPath();g.arc(h[0]+Math.cos(ba)*7.4,h[1]+Math.sin(ba)*7.4,1.6,0,7);g.fill()}
      else{const bx=h[0]+Math.cos(ba)*8,by2=h[1]+Math.sin(ba)*8;g.strokeStyle='#c4c8cc';g.lineWidth=1.1;g.beginPath();g.moveTo(h[0]+Math.cos(ba)*1.2,h[1]+Math.sin(ba)*1.2);g.lineTo(bx,by2);g.stroke();
        g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=.35;g.beginPath();g.moveTo(h[0]+Math.cos(ba)*1.6,h[1]+Math.sin(ba)*1.6-.3);g.lineTo(bx,by2-.3);g.stroke();
        g.strokeStyle='#7a5a2a';g.lineWidth=.9;g.beginPath();g.moveTo(h[0]-Math.sin(ba)*1.6+Math.cos(ba)*1.1,h[1]+Math.cos(ba)*1.6+Math.sin(ba)*1.1);g.lineTo(h[0]+Math.sin(ba)*1.6+Math.cos(ba)*1.1,h[1]-Math.cos(ba)*1.6+Math.sin(ba)*1.1);g.stroke()}
      // Schild vor dem Körper (Dreiviertelansicht)
      const sx=2.6,sy=-9.6+Y;
      if(re===4){g.fillStyle='#e8e2d0';g.beginPath();g.moveTo(sx-2.4,sy-3.6);g.lineTo(sx+2.4,sy-3.6);g.quadraticCurveTo(sx+2.4,sy+1.6,sx,sy+4.6);g.quadraticCurveTo(sx-2.4,sy+1.6,sx-2.4,sy-3.6);g.fill();g.fillStyle=pc;g.fillRect(sx-.5,sy-3.4,1,7);g.fillRect(sx-2,sy-1.6,4,1)}
      else if(re>=1){const sg=g.createRadialGradient(sx-1,sy-1.4,.3,sx,sy,3.8);sg.addColorStop(0,tint?shade(tint,25):re===2?'#d0a858':'#8a6a44');sg.addColorStop(1,tint?shade(tint,-35):re===2?'#7a5a22':'#4a3420');marked=true;g.fillStyle=sg;g.beginPath();g.ellipse(sx,sy,re===3?2.6:3,re===3?4.4:3.6,0,0,7);g.fill();
        g.strokeStyle=pc;g.lineWidth=.7;g.globalAlpha=.85;g.stroke();g.globalAlpha=1;g.fillStyle='#9a9ea2';g.beginPath();g.arc(sx,sy,.8,0,7);g.fill()}}}
  else if(lk==='ranged'){
    if(re===0){const h=arm(2.6,2.9,fa),sp=gameT*(u.swing>0?20:5);g.strokeStyle='#8a6a40';g.lineWidth=.5;g.beginPath();g.moveTo(h[0],h[1]);g.lineTo(h[0]+Math.cos(sp)*4,h[1]-2+Math.sin(sp)*1.2);g.stroke();g.fillStyle='#8f8a80';g.beginPath();g.arc(h[0]+Math.cos(sp)*4,h[1]-2+Math.sin(sp)*1.2,.7,0,7);g.fill()}
    else if(re<=4){// Bogen mit Sehne, Köcher am Rücken
      g.fillStyle='#5b3f26';g.save();g.translate(-2.2,-12+Y);g.rotate(-.35);g.fillRect(-1,0,2,6);g.fillStyle='#d8d2c4';for(const o of [-.6,.6]){g.beginPath();g.moveTo(o,-2.4);g.lineTo(o-.5,0);g.lineTo(o+.5,0);g.fill()}g.restore();
      const h=bowAim?arm(1.5,1.55,fa):arm(.2-s*.3,.15-s*.3,fa),cx=h[0]-(bowAim?1.6:.6),R=6;
      g.strokeStyle='#5a3d22';g.lineWidth=1;g.beginPath();g.arc(cx,h[1],R,-1.15,1.15);g.stroke();
      const t1=[cx+Math.cos(-1.15)*R,h[1]+Math.sin(-1.15)*R],t2=[cx+Math.cos(1.15)*R,h[1]+Math.sin(1.15)*R],nx=bowAim?back[0]:t1[0]-.4;
      g.strokeStyle='rgba(230,222,200,.75)';g.lineWidth=.35;g.beginPath();g.moveTo(t1[0],t1[1]);g.lineTo(nx,bowAim?back[1]:h[1]);g.lineTo(t2[0],t2[1]);g.stroke();
      if(bowAim&&u.swing<=0){g.strokeStyle='#8a6a44';g.lineWidth=.5;g.beginPath();g.moveTo(back[0],back[1]);g.lineTo(h[0]+3,h[1]);g.stroke()}}
    else{const h=gunAim?arm(1.1,1.75,fa):arm(.25,.1,fa);
      if(gunAim){g.strokeStyle='#5a3f22';g.lineWidth=1.5;g.beginPath();g.moveTo(-2.4,-11+Y);g.lineTo(h[0],h[1]);g.stroke();g.strokeStyle='#26282a';g.lineWidth=.9;g.beginPath();g.moveTo(h[0]-1,h[1]-.2);g.lineTo(h[0]+(re>=8?7:9),h[1]-.5);g.stroke();
        if(u.swing>.12){g.fillStyle='rgba(255,210,120,.9)';g.beginPath();g.arc(h[0]+10,h[1]-.5,1.4,0,7);g.fill();const pg=g.createRadialGradient(h[0]+13,h[1]-2,0,h[0]+13,h[1]-2,4);pg.addColorStop(0,'rgba(225,222,214,.6)');pg.addColorStop(1,'rgba(225,222,214,0)');g.fillStyle=pg;g.beginPath();g.arc(h[0]+13,h[1]-2,4,0,7);g.fill()}}
      else{g.strokeStyle='#5a3f22';g.lineWidth=1.4;g.beginPath();g.moveTo(h[0]+.2,h[1]+1.5);g.lineTo(h[0]+.6,h[1]-3);g.stroke();g.strokeStyle='#26282a';g.lineWidth=.8;g.beginPath();g.moveTo(h[0]+.6,h[1]-3);g.lineTo(h[0]+1.2,h[1]-11);g.stroke()}}}
  else arm(s*.45,s*.45+.25,fa);
  if(tint&&!marked){g.fillStyle=tint;g.beginPath();g.arc(HX-1.4,HY-2.2,.9,0,7);g.fill()}   // Kokarde als Kennzeichen
  g.restore();g.lineCap='butt';g.lineJoin='miter';
}
// Epochentracht: jede der 10 Epochen bekommt eigene Kleidung und Kopfbedeckung über der Grundfigur
function epochDress(g,re,x,by,hx,hy,pc){
  if(re===0){// Fellumhang mit Flecken
    g.fillStyle='#8a6038';g.beginPath();g.ellipse(x,by-3,7,4,0,0,7);g.fill();g.fillStyle='#5a3a1e';for(const [dx,dy] of [[-3,-4],[2,-2],[4,-5]]){g.beginPath();g.arc(x+dx,by+dy,1,0,7);g.fill()}
    g.fillStyle='#3a2616';g.beginPath();g.arc(hx,hy-.6,4.1,Math.PI*.95,Math.PI*2.05);g.fill()}
  else if(re===1){g.fillStyle='#b5793a';g.fillRect(x-6,by+2,12,2.2)}// Kupfergürtel
  else if(re===2){g.fillStyle='#c79a3c';g.beginPath();g.arc(hx,hy-1,4.4,Math.PI,0);g.fill();g.fillStyle='#b8322c';g.fillRect(hx-.8,hy-8.5,1.6,4)}// Bronzehelm mit Busch
  else if(re===3){g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.6;for(let k=-4;k<=4;k+=2){g.beginPath();g.moveTo(x+k,by-5);g.lineTo(x+k,by+4);g.stroke()}g.lineWidth=1}// Schuppenpanzer
  else if(re===4){// Ritter: Topfhelm und Wappenrock mit Kreuz
    g.fillStyle='#f0ead8';g.fillRect(x-4,by-4,8,9);g.fillStyle=pc;g.fillRect(x-.9,by-3.5,1.8,8);g.fillRect(x-3.5,by-.5,7,1.8);
    g.fillStyle='#9aa3ab';g.fillRect(hx-4,hy-4.5,8,7.5);g.fillStyle='#1a1a1a';g.fillRect(hx-3,hy-1.5,6,1)}
  else if(re===5){// Renaissance: Morion mit Kamm, weiße Kreuzgurte
    g.strokeStyle='#eee6d2';g.lineWidth=1.2;g.beginPath();g.moveTo(x-5,by-5);g.lineTo(x+5,by+4);g.moveTo(x+5,by-5);g.lineTo(x-5,by+4);g.stroke();g.lineWidth=1;
    g.fillStyle='#b9bfc4';g.beginPath();g.ellipse(hx,hy-1.5,6,1.6,0,0,7);g.fill();g.beginPath();g.arc(hx,hy-2,3.4,Math.PI,0);g.fill();g.fillRect(hx-.6,hy-7,1.2,2.5)}
  else if(re===6){// Kolonialzeit: Dreispitz und Kreuzgurte
    g.strokeStyle='#eee6d2';g.lineWidth=1.2;g.beginPath();g.moveTo(x-5,by-5);g.lineTo(x+5,by+4);g.stroke();g.lineWidth=1;
    g.fillStyle='#1d1d22';g.beginPath();g.moveTo(hx-6,hy-1);g.lineTo(hx,hy-6);g.lineTo(hx+6,hy-1);g.lineTo(hx,hy+.5);g.closePath();g.fill();g.fillStyle='#d9b24a';g.fillRect(hx-.6,hy-4,1.2,1.2)}
  else if(re===7){// Industriezeit: Pickelhaube
    g.fillStyle='#222';g.beginPath();g.arc(hx,hy-1,4.3,Math.PI,0);g.fill();g.fillStyle='#c9a649';g.fillRect(hx-.7,hy-8,1.4,3.5);g.beginPath();g.arc(hx,hy-3,1,0,7);g.fill()}
  else if(re===8){// Weltkriege: Stahlhelm und Feldgrau
    g.fillStyle='rgba(90,100,80,.55)';g.beginPath();g.ellipse(x,by,6.4,7,0,0,7);g.fill();g.fillStyle=pc;g.fillRect(x-4,by-5,2.5,2.5);
    g.fillStyle='#4f5a3c';g.beginPath();g.ellipse(hx,hy-.5,5.6,2,0,0,7);g.fill();g.beginPath();g.arc(hx,hy-1,4.2,Math.PI,0);g.fill()}
  else {// Moderne: Tarnmuster, Gefechtshelm, Weste
    g.fillStyle='rgba(70,80,55,.6)';g.beginPath();g.ellipse(x,by,6.4,7,0,0,7);g.fill();
    for(const [dx,dy,c] of [[-3,-3,'#3a432c'],[2,1,'#7c7a55'],[-1,3,'#3a432c'],[3,-4,'#7c7a55']]){g.fillStyle=c;g.beginPath();g.ellipse(x+dx,by+dy,2,1.3,.5,0,7);g.fill()}
    g.fillStyle='#2e3326';g.fillRect(x-4,by-3,8,6);g.fillStyle=pc;g.fillRect(x-1.5,by-2,3,2);
    g.fillStyle='#55603f';g.beginPath();g.arc(hx,hy-.8,4.4,Math.PI*.95,Math.PI*2.05);g.fill()}
}
// Einheiten größer zeichnen (AoE-artige Figuren), schwere Typen etwas wuchtiger
function drawUnit(g,u){
  const UD=UNITS[u.type],k=(UD.scale||1.18)*Math.sqrt((UD.r||.3)/.3),x=u.x*T,y=u.y*T;
  if(!UD.naval){const rr=(UD.r||.3)*T*k;g.strokeStyle=PCOL[u.owner];if(UD.air)g.setLineDash([3,3]);g.globalAlpha=.55;g.lineWidth=1.6;g.beginPath();g.ellipse(x,y+rr*.75,rr*1.05,rr*.48,0,0,7);g.stroke();g.globalAlpha=1;g.setLineDash([]);
    if(u.moving&&SEASON!==3&&!UD.air){const ca=Math.cos(u.ang||0),sa=Math.sin(u.ang||0);for(let i=0;i<3;i++){const f=((gameT*2.2+i/3+(u.id%7)/7)%1),d=6+f*14;g.fillStyle=`rgba(150,125,90,${(.32*(1-f)).toFixed(2)})`;g.beginPath();g.arc(x-ca*d+(i-1)*2,y+rr*.7-sa*d*.5,2+f*4,0,7);g.fill()}}}
  g.save();g.translate(x,y);g.scale(k,k);g.translate(-x,-y);drawUnitRaw(g,u);g.restore();
  if(u.rank&&u.type!=='hero'){const xx=u.x*T+u.r*T*1.2,yy=u.y*T-u.r*T*2.6;g.fillStyle=u.rank===2?'#f2cf4f':'#c9ccd0';for(let i=0;i<u.rank;i++){g.beginPath();g.moveTo(xx-4,yy+i*3.5);g.lineTo(xx,yy+2.5+i*3.5);g.lineTo(xx+4,yy+i*3.5);g.lineTo(xx+4,yy+1.5+i*3.5);g.lineTo(xx,yy+4+i*3.5);g.lineTo(xx-4,yy+1.5+i*3.5);g.closePath();g.fill()}}
  if(u.form){const yy=u.y*T+u.r*T*1.6,xx=u.x*T;g.fillStyle=['','#6fa0d8','#e07a4a','#8fd06a'][u.form];if(u.form===1)g.fillRect(xx-5,yy,10,3);else if(u.form===2){g.beginPath();g.moveTo(xx-5,yy+3);g.lineTo(xx,yy-2);g.lineTo(xx+5,yy+3);g.closePath();g.fill()}else{for(let i=-1;i<=1;i++)g.fillRect(xx+i*4-1,yy,2,3)}}
}
function drawUnitRaw(g,u){
  const UD=UNITS[u.type];
  const x=u.x*T,y=u.y*T,pc=PCOL[u.owner],dk=PCOL_DK[u.owner],ep=VIS(players[u.owner].epoch),a=u.ang;
  if(!UD.noShadow){g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.ellipse(x+3,y+u.r*T*.7,u.r*T*1.1,u.r*T*.5,0,0,7);g.fill()}
  if(UD.draw){g.save();try{UD.draw(g,u,DRAW_API)}catch(e){}g.restore();return}
  if(LOOK(u.type)==='cavalry'){
    // Reiter in Seitenansicht wie in EE2: Pferd im Profil mit Gangart, Reiter aufrecht im Sattel, Blick in Laufrichtung
    const dir=Math.cos(a)>=0?1:-1,gal=u.moving?gameT*13+u.anim:0,bob=u.moving?Math.abs(Math.sin(gal))*1.1:0,sw=u.swing>0?Math.sin(u.swing/.25*Math.PI):0;
    const hc=['#6b4a30','#4a3324','#7d5a3a','#3a2c22','#8a7a66'][u.id%5],hd=shade(hc,-32),cha=ep===1;
    g.save();g.translate(x,y+u.r*T*.62);g.scale(dir,1);g.lineCap='round';g.lineJoin='round';
    const leg=(hx,hy,p,col,front)=>{const s=Math.sin(p),kx=hx+s*2.6*(front?1:-.6),ky=hy+5.2,fx=hx+s*4.2-(front?0:1),fy=-Math.max(0,Math.cos(p))*1.6*(u.moving?1:0);
      g.strokeStyle=col;g.lineWidth=2.6;g.beginPath();g.moveTo(hx,hy);g.lineTo(kx,ky);g.stroke();g.lineWidth=1.5;g.beginPath();g.moveTo(kx,ky);g.lineTo(fx,fy-1);g.stroke();
      g.fillStyle='#1a140e';g.fillRect(fx-1.1,fy-1.4,2.4,1.4)};
    const by=-11-bob;
    if(cha){// zweirädriger Streitwagen hinter dem Pferd: geflochtener Korb, großes Speichenrad, Deichsel
      g.strokeStyle='#3e2c1a';g.lineWidth=1.3;g.beginPath();g.moveTo(-13,-9);g.lineTo(3,by+1);g.stroke();
      const wg=g.createLinearGradient(0,-17,0,-8);wg.addColorStop(0,'#a2824f');wg.addColorStop(1,'#5a4026');g.fillStyle=wg;g.beginPath();g.moveTo(-22,-8);g.lineTo(-22,-15);g.quadraticCurveTo(-17,-18,-12,-14);g.lineTo(-12,-8);g.closePath();g.fill();
      g.strokeStyle='rgba(40,26,12,.45)';g.lineWidth=.45;g.beginPath();for(let k=-21;k<-12;k+=1.6){g.moveTo(k,-8.5);g.lineTo(k,-15.5)}g.stroke();
      g.strokeStyle='#4a2e1a';g.lineWidth=.9;g.beginPath();g.moveTo(-22,-15);g.quadraticCurveTo(-17,-18,-12,-14);g.stroke();
      const rot=u.moving?gameT*7:0;g.strokeStyle='#3a2a1a';g.lineWidth=1.4;g.beginPath();g.arc(-17,-5,5,0,7);g.stroke();
      g.lineWidth=.7;g.beginPath();for(let k=0;k<6;k++){const q=rot+k*Math.PI/3;g.moveTo(-17,-5);g.lineTo(-17+Math.cos(q)*4.6,-5+Math.sin(q)*4.6)}g.stroke();g.fillStyle='#2a1e12';g.beginPath();g.arc(-17,-5,1,0,7);g.fill();
      g.fillStyle=pc;g.globalAlpha=.75;g.fillRect(-21,-13,8,1.3);g.globalAlpha=1}
    // ferne Beine (dunkler), Schweif
    leg(5.5,by+2,gal+Math.PI,hd,true);leg(-6.5,by+2,gal,hd,false);
    g.strokeStyle='#22170f';g.lineWidth=2.4;g.beginPath();g.moveTo(-9.5,by-1.5);g.quadraticCurveTo(-13.5,by+1+Math.sin(gal)*.8,-12.5+Math.sin(gal*.5),by+8);g.stroke();
    g.strokeStyle='rgba(60,44,30,.6)';g.lineWidth=1;g.beginPath();g.moveTo(-10,by-1);g.quadraticCurveTo(-13,by+2,-11.5,by+7.5);g.stroke();
    // Rumpf mit Brust und Kruppe, Licht von oben links
    const bg=g.createLinearGradient(0,by-5,0,by+5);bg.addColorStop(0,shade(hc,22));bg.addColorStop(.55,hc);bg.addColorStop(1,shade(hc,-30));g.fillStyle=bg;
    g.beginPath();g.ellipse(0,by,9.4,4.4,0,0,7);g.fill();g.beginPath();g.ellipse(6,by+.3,4,4.4,0,0,7);g.fill();g.beginPath();g.ellipse(-6.4,by-.4,4.4,4.8,0,0,7);g.fill();
    // Hals und Kopf
    g.beginPath();g.moveTo(4.5,by-3);g.lineTo(9.5,by-10);g.quadraticCurveTo(12,by-11.5,13,by-9.5);g.lineTo(10,by+1.5);g.closePath();g.fill();
    g.fillStyle=shade(hc,-6);g.beginPath();g.moveTo(9.6,by-10.5);g.quadraticCurveTo(12,by-12.5,13.6,by-11);g.lineTo(17.2,by-6);g.quadraticCurveTo(17,by-4.4,15.4,by-4.8);g.lineTo(11.5,by-7.5);g.closePath();g.fill();
    g.fillStyle=hd;g.beginPath();g.moveTo(11,by-11.6);g.lineTo(11.3,by-14);g.lineTo(12.4,by-11.8);g.closePath();g.fill();
    g.fillStyle='#120c08';g.beginPath();g.arc(12.9,by-9.4,.55,0,7);g.fill();g.fillRect(16.2,by-5.9,.9,.9);
    g.strokeStyle='#1c130c';g.lineWidth=1.7;g.beginPath();g.moveTo(10.6,by-11);g.quadraticCurveTo(7.5,by-8.5,4.5,by-4);g.stroke();
    g.lineWidth=.6;for(let k=0;k<4;k++){g.beginPath();g.moveTo(9.6-k*1.4,by-10+k*1.6);g.lineTo(8.6-k*1.4+Math.sin(gal+k)*.4,by-8.4+k*1.6);g.stroke()}
    g.fillStyle='rgba(255,240,220,.1)';g.beginPath();g.ellipse(-1,by-3.2,7,1.2,0,0,7);g.fill();
    g.strokeStyle='rgba(0,0,0,.16)';g.lineWidth=.8;g.beginPath();g.arc(5.5,by+.5,3.6,-1.9,1.2);g.moveTo(-3.2,by-3);g.quadraticCurveTo(-6.5,by-1.5,-7.6,by+3.6);g.stroke();   // Schulter und Hinterhand
    g.fillStyle='rgba(0,0,0,.18)';g.beginPath();g.ellipse(0,by+3,7.5,1.3,0,0,7);g.fill();
    // nahe Beine
    leg(6.5,by+2.5,gal,hc,true);leg(-5.5,by+2.5,gal+Math.PI,hc,false);
    // Satteldecke in Spielerfarbe, Sattel, Zaumzeug
    const rX=cha?-17:-.5;
    if(!cha){g.fillStyle=dk;g.beginPath();g.moveTo(-4.6,by-4);g.lineTo(3.4,by-4);g.lineTo(3,by+2.2);g.lineTo(-4.2,by+2.2);g.closePath();g.fill();
      g.fillStyle=pc;g.globalAlpha=.85;g.fillRect(-4.2,by-3.4,7.2,4.6);g.globalAlpha=1;g.fillStyle='#2a1a10';g.beginPath();g.moveTo(-3.8,by-4);g.quadraticCurveTo(-.5,by-3,2.8,by-4.8);g.lineTo(2.8,by-3.2);g.lineTo(-3.8,by-2.8);g.closePath();g.fill()}
    g.strokeStyle='#24170e';g.lineWidth=.6;g.beginPath();g.moveTo(16.4,by-5.4);g.lineTo(cha?-14:3,by-(cha?7.5:9));g.stroke();
    // Reiter: Bein mit Stiefel, Rumpf mit Rüstung und Wappenrock, Kopf mit epochengerechtem Helm
    const ry=by-(cha?-1.5:4),cl=ep>=2&&ep<=5?'#7a7f84':ep>=6?'#4a4a3e':'#6a5236',sk=['#c49a76','#b88a66','#a8785a'][u.id%3];
    if(!cha){g.strokeStyle=ep>=6?'#3a3428':'#5a4630';g.lineWidth=2;g.beginPath();g.moveTo(rX,ry);g.lineTo(rX+2.2,ry+3.4);g.lineTo(rX+1.6,ry+6.6);g.stroke();g.fillStyle='#1e1610';g.fillRect(rX+.6,ry+6,2.6,1.4)}
    const tg=g.createLinearGradient(rX-3,0,rX+3,0);tg.addColorStop(0,shade(cl,22));tg.addColorStop(1,shade(cl,-28));g.fillStyle=tg;
    g.beginPath();g.moveTo(rX-2.6,ry+.5);g.lineTo(rX-2.2,ry-7);g.quadraticCurveTo(rX,ry-8.3,rX+2.2,ry-7);g.lineTo(rX+2.4,ry+.5);g.closePath();g.fill();
    g.fillStyle=pc;g.globalAlpha=.85;g.fillRect(rX-2.3,ry-3.2,4.6,3.4);g.globalAlpha=1;g.fillStyle='rgba(20,14,8,.5)';g.fillRect(rX-2.4,ry-3.6,4.8,.6);
    const tip=(UD.range||0)>1.5;
    g.strokeStyle=shade(cl,-10);g.lineWidth=1.4;g.beginPath();g.moveTo(rX+.5,ry-6);g.lineTo(rX+3.2+sw*1.5,ry-3.2);g.lineTo(rX+5+sw*2,ry-3.6);g.stroke();
    const hy=ry-10;g.fillStyle=sk;g.beginPath();g.arc(rX+.3,hy,2.3,0,7);g.fill();g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.arc(rX-.4,hy+.3,2,Math.PI*.6,Math.PI*1.5);g.fill();
    if(ep>=2&&ep<=5){g.fillStyle='#8d9298';g.beginPath();g.arc(rX+.3,hy-.4,2.5,Math.PI,0);g.fill();g.fillRect(rX-2.2,hy-.6,5,.9);g.fillStyle='#6a6e72';g.fillRect(rX+1.8,hy-.5,.7,2.2);
      if(u.type==='knight'){g.fillStyle=pc;g.beginPath();g.moveTo(rX,hy-2.8);g.quadraticCurveTo(rX-3,hy-4.5,rX-4.5,hy-2);g.lineTo(rX-.5,hy-2.4);g.closePath();g.fill()}}
    else if(ep>=6){g.fillStyle='#2a2620';g.beginPath();g.ellipse(rX+.3,hy-1.6,3.4,.9,0,0,7);g.fill();g.beginPath();g.ellipse(rX+.3,hy-2.4,2,1.4,0,Math.PI,0);g.fill()}
    else{g.fillStyle='#3a2a1c';g.beginPath();g.arc(rX+.1,hy-.6,2.3,Math.PI*.95,Math.PI*2.05);g.fill()}
    // Waffe: Lanze (vorgestreckt beim Angriff) oder Bogen/Flinte bei Schützen
    if(tip){if(ep>=5){g.strokeStyle='#2b2620';g.lineWidth=1.3;g.beginPath();g.moveTo(rX-1,ry-2);g.lineTo(rX+9+sw*2,ry-6);g.stroke()}
      else{g.strokeStyle='#5a3a1e';g.lineWidth=1;g.beginPath();g.arc(rX+5.6,ry-4.5,5,-1.2,1.2);g.stroke();g.strokeStyle='rgba(220,210,190,.6)';g.lineWidth=.4;g.beginPath();g.moveTo(rX+5.6+Math.cos(-1.2)*5,ry-4.5+Math.sin(-1.2)*5);g.lineTo(rX+5.6+Math.cos(1.2)*5-sw*2,ry-4.5+Math.sin(1.2)*5);g.stroke()}}
    else{const lx=sw*4,wc=ep>=3?'#3a3026':ep===2?'#b9a27a':'#6b4a2a';g.strokeStyle=wc;g.lineWidth=1.3;g.beginPath();g.moveTo(rX-6+lx,ry-1);g.lineTo(rX+17+lx,ry-8.5+sw*3);g.stroke();
      g.fillStyle='#9a9ea2';g.beginPath();g.moveTo(rX+17+lx,ry-8.5+sw*3);g.lineTo(rX+20+lx,ry-9.5+sw*3);g.lineTo(rX+16.6+lx,ry-7.4+sw*3);g.closePath();g.fill();
      if(ep===2||u.type==='knight'){g.fillStyle=pc;g.beginPath();g.moveTo(rX+14+lx,ry-7.6+sw*3);g.lineTo(rX+10+lx,ry-8+sw*3);g.lineTo(rX+12+lx,ry-5.6+sw*3);g.closePath();g.fill()}}
    g.restore();g.lineCap='butt';g.lineJoin='miter';
  }else if(LOOK(u.type)==='siege'){
    g.save();g.translate(x,y);g.rotate(a);
    const wheel=(wx,wy,r)=>{// Speichenrad mit Eisenreifen, dreht sich beim Fahren
      const rot=u.moving?gameT*6:0;g.fillStyle='#2e2418';g.beginPath();g.ellipse(wx,wy,r,r*.45,0,0,7);g.fill();g.strokeStyle='#55585a';g.lineWidth=1.1;g.stroke();
      g.strokeStyle='#6b4c2c';g.lineWidth=.8;for(let k=0;k<4;k++){const q=rot+k*Math.PI/4;g.beginPath();g.moveTo(wx-Math.cos(q)*r*.9,wy-Math.sin(q)*r*.4);g.lineTo(wx+Math.cos(q)*r*.9,wy+Math.sin(q)*r*.4);g.stroke()}
      g.fillStyle='#3d3f40';g.beginPath();g.arc(wx,wy,1,0,7);g.fill()};
    const re=players[u.owner].epoch;
    if(re>=9&&u.type!=='ram'&&u.type!=='bolt'){// Moderne: Kampfpanzer mit Ketten und Drehturm
      g.fillStyle='#262a20';g.fillRect(-15,-10,30,5);g.fillRect(-15,5,30,5);
      g.fillStyle='#3a3f30';const tk=(gameT*(u.moving?30:0))%4;for(let i=-15+tk;i<15;i+=4){g.fillRect(i,-10,1.4,5);g.fillRect(i,5,1.4,5)}
      const hg=g.createLinearGradient(0,-6,0,6);hg.addColorStop(0,'#7d8660');hg.addColorStop(1,'#4a5236');g.fillStyle=hg;g.fillRect(-13,-6,26,12);
      g.strokeStyle=OUT;g.lineWidth=1;g.strokeRect(-13,-6,26,12);g.fillStyle=pc;g.fillRect(-12,-5,4,10);
      const rec=u.swing>.15?-3:0;g.fillStyle='#565f40';g.beginPath();g.ellipse(-1,0,6.5,5.5,0,0,7);g.fill();g.stroke();
      g.fillStyle='#2e3326';g.fillRect(4+rec,-1.3,16,2.6);g.fillRect(18+rec,-1.8,3,3.6);
      if(u.swing>.18){g.fillStyle='#ffd27a';g.beginPath();g.arc(23,0,4.5,0,7);g.fill();g.fillStyle='rgba(210,210,210,.6)';g.beginPath();g.arc(28,0,6,0,7);g.fill()}
    }else{// Belagerungsgerät in Seitenansicht: Holz mit Maserung, Speichenräder mit Eisenreifen, Wimpel in Spielerfarbe
      const dir=Math.cos(a)>=0?1:-1,isRam=u.type==='ram',isBolt=u.type==='bolt',gun=ep>=3&&!isRam,sw=u.swing>0?Math.sin(u.swing/.25*Math.PI):0,rot=u.moving?gameT*5:0;
      g.rotate(-a);g.translate(0,u.r*T*.55);g.scale(dir,1);g.lineCap='round';g.lineJoin='round';
      const sWheel=(wx,wy,r)=>{g.strokeStyle='#2e2418';g.lineWidth=1.8;g.beginPath();g.arc(wx,wy,r,0,7);g.stroke();g.strokeStyle='#5a5d60';g.lineWidth=.6;g.beginPath();g.arc(wx,wy,r+.6,0,7);g.stroke();
        g.strokeStyle='#6b4c2c';g.lineWidth=.8;g.beginPath();for(let k=0;k<6;k++){const q=rot+k*Math.PI/3;g.moveTo(wx,wy);g.lineTo(wx+Math.cos(q)*r,wy+Math.sin(q)*r)}g.stroke();g.fillStyle='#3d3f40';g.beginPath();g.arc(wx,wy,1.1,0,7);g.fill()};
      const beam=(x0,y0,x1,y1,w,c)=>{g.strokeStyle=c||'#5e4226';g.lineWidth=w;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y1);g.stroke();g.strokeStyle='rgba(255,230,190,.16)';g.lineWidth=w*.3;g.beginPath();g.moveTo(x0,y0-w*.25);g.lineTo(x1,y1-w*.25);g.stroke()};
      const flag=(fx,fy,h)=>{g.strokeStyle='#3a2a1a';g.lineWidth=.7;g.beginPath();g.moveTo(fx,fy);g.lineTo(fx,fy-h);g.stroke();const wv=Math.sin(gameT*4+u.anim)*.8;
        g.fillStyle=pc;g.beginPath();g.moveTo(fx,fy-h);g.quadraticCurveTo(fx-3,fy-h+.6+wv,fx-6,fy-h+1.2);g.lineTo(fx,fy-h+3);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.moveTo(fx,fy-h+1.8);g.lineTo(fx-5,fy-h+1.6);g.lineTo(fx,fy-h+3);g.fill()};
      if(isRam){// Rammbock: fahrbares Schutzdach mit Fellbespannung, Stammramme mit Eisenkopf an Ketten
        sWheel(-8,-3.5,3.6);sWheel(8,-3.5,3.6);beam(-13,-6,13,-6,2.2);beam(-11,-6,-9,-16,1.6);beam(11,-6,9,-16,1.6);
        const lx=sw*5;g.strokeStyle='#3a3a3a';g.lineWidth=.5;g.beginPath();g.moveTo(-4,-17);g.lineTo(-5+lx,-10.5);g.moveTo(5,-17);g.lineTo(4+lx,-10.5);g.stroke();
        beam(-12+lx,-10,15+lx,-10,3.4,'#5a3f22');g.fillStyle='#4e5256';g.beginPath();g.moveTo(14+lx,-12.4);g.quadraticCurveTo(19+lx,-10,14+lx,-7.6);g.closePath();g.fill();g.fillStyle='rgba(255,255,255,.25)';g.fillRect(14.5+lx,-11.6,2,.7);
        const rg=g.createLinearGradient(0,-22,0,-12);rg.addColorStop(0,'#8a7052');rg.addColorStop(1,'#4a3a28');g.fillStyle=rg;g.beginPath();g.moveTo(-14,-12.5);g.lineTo(0,-22);g.lineTo(14,-12.5);g.lineTo(12,-11);g.lineTo(-12,-11);g.closePath();g.fill();
        g.strokeStyle='rgba(30,20,10,.4)';g.lineWidth=.5;g.beginPath();for(let k=-10;k<=10;k+=3.3){g.moveTo(k,-11.5);g.lineTo(k*.15,-21)}g.stroke();g.fillStyle='rgba(0,0,0,.2)';g.fillRect(-12,-11.6,24,1);flag(0,-22,6)}
      else if(gun){// Geschütz: Lafette mit Schwanz, großes Rad, Rohr aus Bronze oder Eisen, Rückstoß und Pulverdampf
        const bronze=ep<=4,rec=-sw*3,isB=isBolt;
        beam(-15,-1.2,2,-8.5,3,'#5a3f22');g.fillStyle='#3a2a1a';g.fillRect(-16,-2,2.4,2);
        g.save();g.translate(1+rec,-9.5);g.rotate(isB?-.05:-.16);const L=isB?13:18,R=isB?1.6:2.6;
        const bg=g.createLinearGradient(0,-R,0,R);bg.addColorStop(0,bronze?'#c09a5a':'#6a7076');bg.addColorStop(.45,bronze?'#8a6a3a':'#3a3e43');bg.addColorStop(1,bronze?'#4a3618':'#18191b');g.fillStyle=bg;
        if(isB){for(const o of [-2.2,0,2.2]){const og=g.createLinearGradient(0,o-.8,0,o+.8);og.addColorStop(0,bronze?'#c09a5a':'#6a7076');og.addColorStop(1,bronze?'#4a3618':'#18191b');g.fillStyle=og;g.fillRect(-4,o-.8,L,1.6)}g.fillStyle='#2a2a2a';g.fillRect(-4.5,-3.4,3,6.8)}
        else{g.beginPath();g.moveTo(-5,-R-.6);g.lineTo(L,-R*.75);g.lineTo(L,R*.75);g.lineTo(-5,R+.6);g.quadraticCurveTo(-7.5,0,-5,-R-.6);g.fill();g.fillStyle=bronze?'#6a4e26':'#26282a';g.fillRect(L-1.6,-R*.95,1.8,R*1.9);g.fillRect(3,-R*.95,1.2,R*1.9)}
        if(u.swing>.18){g.fillStyle='rgba(255,210,120,.9)';g.beginPath();g.ellipse(L+3,0,3,1.6,0,0,7);g.fill();for(let k=0;k<3;k++){const pg=g.createRadialGradient(L+6+k*4,-k*2,0,L+6+k*4,-k*2,4+k);pg.addColorStop(0,'rgba(225,222,214,.65)');pg.addColorStop(1,'rgba(225,222,214,0)');g.fillStyle=pg;g.beginPath();g.arc(L+6+k*4,-k*2,4+k,0,7);g.fill()}}
        g.restore();sWheel(0,-6,6);g.fillStyle=pc;g.globalAlpha=.85;g.fillRect(-11,-4.6,4,1.2);g.globalAlpha=1}
      else if(isBolt){// Balliste: Fahrgestell, Bock, Läufer mit Bogenarmen von der Seite, gespannte Sehne und Bolzen
        sWheel(-6,-3.5,3.6);sWheel(6,-3.5,3.6);beam(-11,-6,10,-6,2.4);beam(0,-6,0,-12,2);beam(-10,-12.5,11,-14.5,2.2);
        const pull=u.swing>0?0:3;g.strokeStyle='#4a3220';g.lineWidth=1.5;g.beginPath();g.moveTo(7,-14);g.quadraticCurveTo(5.5-pull*.3,-20,2,-22);g.moveTo(7,-14);g.quadraticCurveTo(5.5-pull*.3,-8,2,-6.5);g.stroke();
        g.strokeStyle='rgba(225,215,190,.8)';g.lineWidth=.5;g.beginPath();g.moveTo(2,-22);g.lineTo(-pull,-13.6);g.lineTo(2,-6.5);g.stroke();
        if(u.swing<=0){g.strokeStyle='#7a5a32';g.lineWidth=.9;g.beginPath();g.moveTo(-pull,-14.2);g.lineTo(13,-15.4);g.stroke();g.fillStyle='#5c6266';g.beginPath();g.moveTo(13,-16.2);g.lineTo(15.5,-15.6);g.lineTo(13,-14.6);g.fill()}
        flag(-9,-12.5,6)}
      else{// Katapult (Mange): Grundrahmen, Bock mit Prellbalken, Wurfarm mit Schale, Torsionsbündel
        sWheel(-8,-3,3.4);sWheel(8,-3,3.4);beam(-13,-5.5,13,-5.5,2.8);beam(-1,-5.5,1,-16,1.8);beam(4,-5.5,2,-16,1.8);beam(-.5,-15.5,4.5,-15.5,2);
        g.fillStyle='#3a2c1e';g.beginPath();g.ellipse(-4,-7.5,2.4,1.8,0,0,7);g.fill();g.strokeStyle='rgba(200,170,120,.35)';g.lineWidth=.4;g.beginPath();for(let k=-1.6;k<=1.6;k+=.8){g.moveTo(-4+k,-9);g.lineTo(-4+k*.6,-6)}g.stroke();
        const ang=Math.PI*.93-sw*1.25,ax=-4+Math.cos(ang)*15,ay=-7.5-Math.sin(ang)*15;beam(-4,-7.5,ax,ay,2,'#6b4c2c');
        g.fillStyle='#4a3220';g.beginPath();g.ellipse(ax,ay-.6,2.6,1.5,ang,0,7);g.fill();if(sw<.3){g.fillStyle='#8f8a80';g.beginPath();g.arc(ax,ay-1.6,1.8,0,7);g.fill()}
        flag(11,-5.5,10)}
      g.lineCap='butt';g.lineJoin='miter';
    }
    g.restore();
  }else{humanoid(g,u,ep,pc,dk);
  }
}
function hpBar(g,x,y,w,f){g.fillStyle='rgba(0,0,0,.7)';g.fillRect(x-1,y-1,w+2,5);g.fillStyle=f>.5?'#79c27c':f>.25?'#e8c650':'#e0604f';g.fillRect(x,y,w*f,3);g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x,y,w*f,1)}

// ---------- ambient visual effects (not part of the simulation)
let vfx=[];
function spawnVfx(x,y,k,o){if(vfx.length<400)vfx.push(Object.assign({x,y,k,t:0,vx:(Math.random()-.5)*.3,vy:-.2-Math.random()*.3},o||{}))}
const CLOUDS=[0,1,2,3,4].map(i=>({x:Math.random()*W,y:Math.random()*H,r:6+Math.random()*7,s:.25+Math.random()*.25}));

function render(){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#0b0f11';ctx.fillRect(0,0,cv.width,cv.height);
  if(!ents)return;
  const z=cam.z*dpr;ctx.setTransform(z,0,0,z,-cam.x*z,-cam.y*z);
  ctx.imageSmoothingEnabled=false;
  const vx0=cam.x,vy0=cam.y,vw=viewW/cam.z,vh=viewH/cam.z;
  ctx.drawImage(terrC,Math.max(0,vx0),Math.max(0,vy0),Math.min(vw,W*T),Math.min(vh,H*T),Math.max(0,vx0),Math.max(0,vy0),Math.min(vw,W*T),Math.min(vh,H*T));
  const tx0=Math.floor(vx0/T)-2,ty0=Math.floor(vy0/T)-2,tx1=Math.ceil((vx0+vw)/T)+2,ty1=Math.ceil((vy0+vh)/T)+2;
  const now=performance.now()/1000;
  {// Brandung: Spülsaum und auflaufende Welle wechseln sich langsam ab
    const sx=Math.max(0,vx0)/2,sy=Math.max(0,vy0)/2,sw=Math.min(vw,W*T)/2,sh=Math.min(vh,H*T)/2,dl=1-WX.night*.5;
    const p1=.55+.35*Math.sin(now*1.1),p2=Math.max(0,Math.sin(now*1.1-1.9))*.75;
    const sm=ctx.imageSmoothingEnabled;ctx.imageSmoothingEnabled=true;
    ctx.globalAlpha=p1*dl;ctx.drawImage(surfC[0],sx,sy,sw,sh,sx*2,sy*2,sw*2,sh*2);
    ctx.globalAlpha=p2*dl;ctx.drawImage(surfC[1],sx,sy,sw,sh,sx*2,sy*2,sw*2,sh*2);ctx.globalAlpha=1;ctx.imageSmoothingEnabled=sm}
  ctx.lineCap='round';
  const Wt=(x,y)=>!inb(x,y)||terr[idx(x,y)]===1;
  for(let ty=Math.max(0,ty0);ty<Math.min(H,ty1);ty++)for(let tx=Math.max(0,tx0);tx<Math.min(W,tx1);tx++){
    if(terr[idx(tx,ty)]!==1)continue;if(!(Wt(tx-1,ty)&&Wt(tx+1,ty)&&Wt(tx,ty-1)&&Wt(tx,ty+1)))continue;   // offene See: nichts auf Sand zeichnen
    const h=((tx*73856093)^(ty*19349663))>>>0,ph=(h%1000)/1000;
    {// flache Wellenkämme: kurze, leicht gebogene Lichtkanten mit Schattenkante, die ein- und ausblenden
      for(let k=0;k<2;k++){const hh=k?h>>11:h,pk=((hh%1000)/1000),life=(now*.35+pk)%1,fa=Math.sin(life*Math.PI);
        const cx=tx*T+((hh>>3)%T)+life*8,cy=ty*T+((hh>>7)%T),L=5+((hh>>5)%5);
        ctx.lineWidth=.9;ctx.strokeStyle=`rgba(14,34,48,${(.16*fa).toFixed(3)})`;ctx.beginPath();ctx.moveTo(cx-L,cy+1.4);ctx.quadraticCurveTo(cx,cy+.4,cx+L,cy+1.4);ctx.stroke();
        ctx.strokeStyle=`rgba(214,232,236,${(.22*fa*(1-WX.night*.6)).toFixed(3)})`;ctx.beginPath();ctx.moveTo(cx-L,cy+.4);ctx.quadraticCurveTo(cx,cy-.8,cx+L,cy+.4);ctx.stroke()}}
    const al=Math.pow(Math.max(0,Math.sin(now*1.3+ph*6.28)),6)*.45;if(al<.03)continue;
    const sx=tx*T+(h%23),sy=ty*T+((h>>5)%27);ctx.strokeStyle=`rgba(225,245,250,${al})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+5,sy-.6);ctx.stroke();
  }
  ctx.lineCap='butt';
  const list=[];
  for(const e of ents){
    if(e.dead)continue;const s=e.size||1;
    if(e.x+s<tx0||e.x>tx1||e.y+s<ty0||e.y>ty1)continue;
    if(!visibleEnt(e))continue;
    if(e.kind==='bld'&&e.type==='farm'){drawBld(ctx,e);continue}
    list.push(e);
  }
  list.sort((a,b)=>(a.kind==='unit'?a.y+(isAir(a)?999:0):a.y+a.size-.3)-(b.kind==='unit'?b.y+(isAir(b)?999:0):b.y+b.size-.3));
  // Handelsrouten: gestrichelte Linie vom Markt (und Lager, Mühle) zum Stadtzentrum, die der Träger abläuft
  ctx.setLineDash([6,6]);ctx.lineDashOffset=-performance.now()/60;ctx.lineWidth=1.6;
  for(const c of ents){if(c.dead||c.type!=='carrier'||c.owner!==ME)continue;const h=byId.get(c.home);if(!h||h.dead)continue;
    let tc=null,bd=1e9;for(const e of ents)if(e.type==='tc'&&e.owner===ME&&e.built&&!e.dead){const a=center(h),b2=center(e),d=Math.hypot(a.x-b2.x,a.y-b2.y);if(d<bd){bd=d;tc=e}}
    if(!tc)continue;const a=center(h),b2=center(tc);ctx.strokeStyle=h.type==='market'?'rgba(240,200,90,.55)':'rgba(230,220,190,.28)';
    ctx.beginPath();ctx.moveTo(a.x*T,a.y*T);ctx.lineTo(b2.x*T,b2.y*T);ctx.stroke()}
  ctx.setLineDash([]);ctx.lineWidth=1;
  // selection rings under units
  ctx.lineWidth=1.5;
  for(const e of sel){
    if(e.dead)continue;ctx.strokeStyle=e.owner===ME?'#9ef0a0':e.owner<0?'#f0d78a':'#ff8a7a';
    if(e.kind==='unit'){ctx.globalAlpha=.35;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(e.x*T,e.y*T+e.r*T*.6,e.r*T*1.35,e.r*T*.7,0,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1.5;ctx.stroke()}
    else{ctx.strokeRect(e.x*T+1,e.y*T+1,e.size*T-2,e.size*T-2);if(e.owner===ME&&e.built&&['camp','mill','mine'].includes(e.type)&&e.area!==null){ctx.save();ctx.setLineDash([8,6]);ctx.strokeStyle='rgba(233,190,114,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc((e.x+e.size/2)*T,(e.y+e.size/2)*T,10*T,0,7);ctx.stroke();ctx.restore()}}
  }
  ctx.lineWidth=1;
  // Gefallene: kippen um und verblassen (wie in AoE)
  corpses=corpses.filter(c=>gameT-c.dt0<12&&gameT>=c.dt0);
  for(const c of corpses){const age=gameT-c.dt0,k=Math.min(1,age/.35),x=c.x*T,y=c.y*T;
    ctx.save();ctx.globalAlpha=age<9?1:Math.max(0,(12-age)/3);ctx.translate(x,y+4);ctx.rotate(c.fall*k*Math.PI/2);ctx.translate(-x,-y-4);
    if(age>.35)ctx.filter='saturate(.55) brightness(.8)';drawUnit(ctx,c);ctx.restore()}
  decals=decals.filter(d=>gameT-d.t<25);for(const d of decals){const a=Math.min(1,(25-(gameT-d.t))/6)*.4;ctx.save();ctx.translate(d.x,d.y);ctx.scale(1,.55);puff(ctx,'d',0,0,d.r,a);ctx.restore()}
  // Sonnenschatten (wie in Empire Earth 2): Silhouetten wandern mit dem Sonnenstand über den Tag
  {const dp=(gameT%240)/120;if(dp<1&&WX.night<.9){const k=(dp-.5)*-2.2,sy=.38+.5*Math.abs(dp-.5),al=(.3*(1-WX.night)*(WX.kind==='sun'?1:.55)).toFixed(3);
    ctx.save();ctx.globalAlpha=+al;
    for(const e of list){let spr,bx,by,dx,dy,w,h;
      if(e.kind==='bld'&&e.built&&!BLD[e.type].draw&&!BLD[e.type].line){const sp=bldSprite(e.type,players[e.owner].epoch,e.owner);spr=shadowSprite(sp,'b'+e.type+players[e.owner].epoch+e.owner);bx=e.x*T+e.size*T/2;by=e.y*T+e.size*T-4;dx=e.x*T-4-bx;dy=e.y*T-36-by;w=sp.lw;h=sp.lh}
      else if(e.kind==='res'&&e.type==='tree'&&!(e.amount<e.max)){const sp=treeSprite(e.v);spr=shadowSprite(sp,'t'+e.v);bx=e.x*T+16;by=e.y*T+28;dx=-24;dy=-60;w=48;h=64}
      else continue;
      const z=cam.z*dpr;ctx.setTransform(z,0,0,z,(bx-cam.x)*z,(by-cam.y)*z);ctx.transform(1,0,k,sy,0,0);ctx.drawImage(spr,dx,dy,w,h)}
    ctx.restore()}}
  for(const e of list){if(e.kind==='res')drawRes(ctx,e);else if(e.kind==='bld'){drawBld(ctx,e);if(e.built&&FLAGB[e.type])drawFlag(ctx,e)}
    else if(e.hitT&&gameT-e.hitT<.1){ctx.save();ctx.filter='brightness(1.9)';drawUnit(ctx,e);ctx.restore()}else drawUnit(ctx,e)}
  // ambient particles: dust, wood chips, chimney smoke
  if(!paused&&started&&SET.q>=2){
    for(const e of list){
      if(e.kind==='unit'){if(e.moving&&!isAir(e)&&uiRand()<.04)spawnVfx(e.x,e.y+.25,'dust');
        if(e.working&&e.order.rt==='wood'){const tr=byId.get(e.order.target);if(tr)tr.hitT=gameT+.3}if(e.working&&e.order.rt==='wood'&&Math.random()<.05)spawnVfx(e.x+Math.cos(e.ang)*.4,e.y+Math.sin(e.ang)*.4-.2,'chip',{vx:(Math.random()-.5)*1.5,vy:-1.2})}
      else if(e.kind==='bld'&&e.built&&Math.random()<.03&&((e.type==='tc')||(e.type==='house'&&players[e.owner].epoch>=2)||(e.type==='workshop'&&players[e.owner].epoch>=3)))
        spawnVfx(e.x+e.size-.6,e.y-.4,'smoke2',{vx:.15+Math.random()*.1,vy:-.35});
    }
  }
  for(const v of vfx){
    const x=v.x*T,y=v.y*T,f=v.t;
    if(v.k==='dust'){ctx.fillStyle=`rgba(170,150,110,${.35*(1-f/.8)})`;ctx.beginPath();ctx.arc(x,y,2+f*6,0,7);ctx.fill()}
    else if(v.k==='chip'){ctx.fillStyle=`rgba(210,170,110,${1-f/.6})`;ctx.fillRect(x,y,2,1.5)}
    else if(v.k==='smoke2')puff(ctx,'l',x,y,4+f*5,.32*(1-f/3))
    else if(v.k==='bsmoke'){const a=(1-f/4)*Math.min(1,f*3);puff(ctx,v.dk?'d':'l',x,y,(5+f*7)*(v.big||1),(v.dk?.55:.3)*a)}
    else if(v.k==='trail')puff(ctx,'l',x,y,2+f*5,.4*(1-f))
    else if(v.k==='debris'){ctx.fillStyle=`rgba(52,42,32,${1-f/.9})`;ctx.fillRect(x-1,y-1,2.2,2.2)}
    else if(v.k==='ember'){ctx.fillStyle=`rgba(255,${170+((v.x*97)|0)%60},80,${1-f/1.2})`;ctx.fillRect(x,y,1.2,1.2)}
  }
  // hp bars
  for(const e of list){
    if(e.kind==='res')continue;
    const isSel=sel.includes(e);
    if(!isSel&&e.hp>=e.maxhp)continue;
    if(e.kind==='bld'&&!e.built&&!isSel)continue;
    if(e.kind==='unit')hpBar(ctx,e.x*T-10,e.y*T-e.r*T-12,20,e.hp/e.maxhp);
    else hpBar(ctx,e.x*T+4,e.y*T-8,e.size*T-8,e.hp/e.maxhp);
  }
  // rally point
  for(const e of sel)if(e.kind==='bld'&&e.rally&&e.owner===ME){const r=e.rally;ctx.strokeStyle='rgba(233,190,114,.5)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(e.x*T+e.size*T/2,e.y*T+e.size*T/2);ctx.lineTo(r.x*T,r.y*T);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e9be72';ctx.fillRect(r.x*T-1,r.y*T-14,2,14);ctx.beginPath();ctx.moveTo(r.x*T+1,r.y*T-14);ctx.lineTo(r.x*T+10,r.y*T-11);ctx.lineTo(r.x*T+1,r.y*T-8);ctx.fill()}
  // projectiles (arc above their ground shadow)
  for(const p of proj){
    if(!vis[idx(p.x|0,p.y|0)])continue;
    const tg=byId.get(p.tid),tc=p.ground?{x:p.tx,y:p.ty}:tg?center(tg):p,rem=Math.hypot(tc.x-p.x,tc.y-p.y),prog=Math.max(0,Math.min(1,1-rem/Math.max(.01,p.arc)));
    const lift=(p.k==='ball'?4*prog*(1-prog)*Math.min(p.arc,9)*T*.4:Math.sin(prog*Math.PI)*Math.min(p.arc,8)*T*.12);
    if(p.ground){ctx.strokeStyle='rgba(255,120,80,'+(.25+.5*prog)+')';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.tx*T,p.ty*T,.9*T*(1.3-prog*.3),.45*T*(1.3-prog*.3),0,0,7);ctx.stroke();ctx.lineWidth=1}
    ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(p.x*T,p.y*T,2.2,1,0,0,7);ctx.fill();
    const x=p.x*T,y=p.y*T-lift,px=p.sx??x,py=p.sy??y,dx=x-px,dy=y-py,dl=Math.hypot(dx,dy),ux=dl>.01?dx/dl:Math.cos(p.ang||0),uy=dl>.01?dy/dl:Math.sin(p.ang||0);p.sx=x;p.sy=y;
    if(p.k==='ball'){const r=p.ep>=3?2.6:3.6,gr=ctx.createRadialGradient(x-r*.4,y-r*.4,0,x,y,r);gr.addColorStop(0,p.ep>=3?'#6a6a68':'#a49c8e');gr.addColorStop(1,p.ep>=3?'#141414':'#4e483e');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,r,0,7);ctx.fill();
      if(p.ep>=3&&!paused&&uiRand()<.6)spawnVfx(p.x,p.y-lift/T,'trail',{vx:0,vy:-.1})}
    else if(p.ep>=3){const L=Math.min(14,dl*3+6),gr=ctx.createLinearGradient(x-ux*L,y-uy*L,x,y);gr.addColorStop(0,'rgba(255,220,150,0)');gr.addColorStop(1,'rgba(255,245,210,.95)');ctx.strokeStyle=gr;ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x-ux*L,y-uy*L);ctx.lineTo(x,y);ctx.stroke();ctx.lineWidth=1}
    else if(p.ep===0&&p.k==='arrow'&&byId.get(p.src)&&byId.get(p.src).kind==='unit'){const gr=ctx.createRadialGradient(x-.6,y-.6,0,x,y,2);gr.addColorStop(0,'#b4aea4');gr.addColorStop(1,'#5a554e');ctx.fillStyle=gr;ctx.beginPath();ctx.arc(x,y,1.8,0,7);ctx.fill()}
    else{ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(uy,ux));ctx.strokeStyle='#6b5434';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(0,0);ctx.stroke();
      ctx.fillStyle='#8a8e92';ctx.beginPath();ctx.moveTo(2.4,0);ctx.lineTo(-.6,-1.3);ctx.lineTo(-.6,1.3);ctx.fill();
      ctx.fillStyle='#d8d0c0';ctx.beginPath();ctx.moveTo(-9,0);ctx.lineTo(-6.5,-1.6);ctx.lineTo(-5.5,0);ctx.lineTo(-6.5,1.6);ctx.fill();ctx.restore();ctx.lineWidth=1}
  }
  // effects
  for(const f of fx){
    if(f.t<0)continue;const x=f.x*T,y=f.y*T;
    if(f.k==='hit'){puff(ctx,'s',x,y-2,3+f.t*12,.5*(1-f.t/.4))}
    else if(f.k==='ring3'){const k=Math.min(1,f.t/.5);ctx.strokeStyle=`rgba(230,40,30,${(1-k).toFixed(2)})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(x,y,3*T*k,3*T*k*.55,0,0,7);ctx.stroke();ctx.fillStyle=`rgba(230,40,30,${(.25*(1-k)).toFixed(2)})`;ctx.fill()}
    else if(f.k==='boom'){const k=f.t/.4;
      if(!f.dec){f.dec=1;decals.push({x,y,r:7+uiRand()*3,t:gameT});if(decals.length>60)decals.shift();
        if(SET.q>=2){for(let i=0;i<10;i++){const q=uiRand()*7,v=.6+uiRand()*1.4;spawnVfx(f.x,f.y-.1,'debris',{vx:Math.cos(q)*v,vy:-2-uiRand()*2})}for(let i=0;i<6;i++)spawnVfx(f.x+(uiRand()-.5)*.8,f.y-.2,'bsmoke',{vx:.2+(uiRand()-.5)*.4,vy:-.3-uiRand()*.3,dk:1,big:1.6})}}
      puff(ctx,'s',x,y-4,16+k*28,.75*(1-k));puff(ctx,'d',x,y-8-k*10,10+k*20,.5*Math.min(1,k*3)*(1-k*.5));
      ctx.save();ctx.globalCompositeOperation='lighter';puff(ctx,'f',x,y-8-k*8,14+k*20,1.2*(1-k));puff(ctx,'w',x,y-6,10+k*8,Math.max(0,1-k*2))
      ;ctx.restore()}
    else if(f.k==='smoke'){const k=f.t/1.6;puff(ctx,'d',x+k*10,y-f.t*18,9+f.t*16,.7*(1-k)*Math.min(1,f.t*4))}
    else if(f.k==='stuck'){ctx.save();ctx.translate(x,y);ctx.rotate(f.a);ctx.globalAlpha=Math.min(1,(4-f.t)*2);ctx.strokeStyle='#6b5434';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-6,-2.5);ctx.lineTo(0,0);ctx.stroke();ctx.fillStyle='#d8d0c0';ctx.beginPath();ctx.moveTo(-6,-2.5);ctx.lineTo(-4.6,-4);ctx.lineTo(-4.2,-2);ctx.fill();ctx.restore();ctx.lineWidth=1}
    else if(f.k==='die'){puff(ctx,'d',x,y+3,6+f.t*3,.35*(1-f.t/1.2))}
  }
  // drifting cloud shadows
  for(const c of CLOUDS){const cx=((c.x+now*c.s)%(W+30)-15)*T,cy=c.y*T,r=c.r*T;
    if(cx+r<vx0||cx-r>vx0+vw||cy+r<vy0||cy-r>vy0+vh)continue;
    const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,'rgba(10,20,30,.13)');gr.addColorStop(1,'rgba(10,20,30,0)');ctx.fillStyle=gr;ctx.fillRect(cx-r,cy-r,r*2,r*2)}
  // fog
  ctx.imageSmoothingEnabled=true;ctx.drawImage(fogC,0,0,W,H,0,0,W*T,H*T);
  XY.emit('draw',ctx,DRAW_API);// Bausteine zeichnen in Weltkoordinaten (z. B. Missionsziele)
  // placement ghost
  if(placing&&mouse.inside&&BLD[placing].line){
    const w=toWorld(mouse.x,mouse.y),tl=wallDrag?wallLine(wallDrag.x,wallDrag.y,Math.floor(w.x),Math.floor(w.y)):[[Math.floor(w.x),Math.floor(w.y)]];
    for(const [gx,gy] of tl){const ok=canPlace(ME,placing,gx,gy);ctx.fillStyle=ok?'rgba(120,230,130,.32)':'rgba(240,90,80,.36)';ctx.fillRect(gx*T,gy*T,T,T)}
    if(wallDrag){ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(tl.length+' Felder · '+tl.length*(BLD[placing].cost.stone||0)+' Stein',w.x*T+12,w.y*T-8)}
  }else if(placing&&mouse.inside){
    const d=BLD[placing],w=toWorld(mouse.x,mouse.y),gx=Math.floor(w.x-d.size/2+.5),gy=Math.floor(w.y-d.size/2+.5);
    const ok=canPlace(ME,placing,gx,gy);
    ctx.fillStyle=ok?'rgba(120,230,130,.28)':'rgba(240,90,80,.32)';ctx.fillRect(gx*T,gy*T,d.size*T,d.size*T);
    ctx.strokeStyle=ok?'#9ef0a0':'#ff8a7a';ctx.strokeRect(gx*T+.5,gy*T+.5,d.size*T-1,d.size*T-1);
    if(d.range){ctx.beginPath();ctx.arc((gx+d.size/2)*T,(gy+d.size/2)*T,d.range*T,0,7);ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([])}
  }
  // Wegpunkte (Shift-Befehle) und Goldstaub nach Forschungen
  ctx.save();ctx.setLineDash([6,5]);ctx.lineWidth=1.5;ctx.strokeStyle='rgba(158,240,160,.8)';
  for(const u of sel){if(u.kind!=='unit'||u.owner!==ME||!u.wq||!u.wq.length||!u.order||!(u.order.t==='move'||u.order.t==='amove'))continue;
    ctx.beginPath();ctx.moveTo(u.x*T,u.y*T);ctx.lineTo(u.order.x*T,u.order.y*T);for(const w of u.wq)ctx.lineTo(w.x*T,w.y*T);ctx.stroke();
    ctx.fillStyle='rgba(158,240,160,.9)';for(const w of [u.order,...u.wq]){ctx.beginPath();ctx.arc(w.x*T,w.y*T,3,0,7);ctx.fill()}}
  ctx.restore();
  ctx.font='bold 10px sans-serif';ctx.textAlign='center';for(const e of ents){if(e.dead||e.expT==null||e.kind!=='unit'||!visibleEnt(e))continue;const r=Math.max(0,Math.ceil(e.expT-gameT));ctx.fillStyle=r<20?'#ff8a7a':'#ffe08a';ctx.fillText('⏳'+r,e.x*T,e.y*T-26)}ctx.textAlign='left';
  for(const e of ents){if(!(e.glowT>gameT)||e.dead||!visibleEnt(e))continue;const c=center(e),k=(e.glowT-gameT)/3;ctx.fillStyle='rgba(255,215,90,'+(.85*k).toFixed(2)+')';
    for(let i=0;i<10;i++){const a=i*2.4+e.id,ph=((gameT*1.3+i*.13)%1);ctx.fillRect(c.x*T+Math.cos(a)*12-1,c.y*T-ph*30+Math.sin(a)*4-1,2.5,2.5)}}
  // command marker
  if(marker&&marker.t>0){ctx.strokeStyle=marker.c;ctx.lineWidth=2;const r=(1-marker.t)*10+4;ctx.beginPath();ctx.ellipse(marker.x*T,marker.y*T,r,r*.55,0,0,7);ctx.stroke();ctx.lineWidth=1}
  // box
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(SET.q>=1){// Farbstimmung: warmes Licht bei Tagesanbruch und Abend, Vignette
    const ph=gameT%120,edge=Math.max(0,1-Math.min(ph,120-ph)/15),day=1-WX.night;
    if(edge>0&&day>.2){ctx.fillStyle=`rgba(255,140,60,${(.08*edge*day).toFixed(3)})`;ctx.fillRect(0,0,viewW,viewH)}
    if(!window.__vig||window.__vig.w!==viewW||window.__vig.h!==viewH){const g=ctx.createRadialGradient(viewW/2,viewH/2,Math.min(viewW,viewH)*.45,viewW/2,viewH/2,Math.hypot(viewW,viewH)*.6);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(10,8,4,.32)');window.__vig={w:viewW,h:viewH,g}}
    ctx.fillStyle=window.__vig.g;ctx.fillRect(0,0,viewW,viewH)}
  if(WX.night>0){ctx.fillStyle=`rgba(0,0,0,${WX.night*.35})`;ctx.fillRect(0,0,viewW,viewH)}
  if(WX.kind==='storm'){const t=performance.now()/1000;ctx.fillStyle='rgba(40,50,60,.18)';ctx.fillRect(0,0,viewW,viewH);ctx.strokeStyle='rgba(200,210,220,.35)';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<120;i++){const x=((i*131.7+t*700)%(viewW+80))-40,y=((i*57.3+t*260)%(viewH+40))-20;ctx.moveTo(x,y);ctx.lineTo(x-18,y+6)}ctx.stroke();if(Math.sin(t*1.7)>.995){ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(0,0,viewW,viewH)}}
  else if(WX.kind!=='sun'){const t=performance.now()/1000,n=WX.kind==='rain'?140:90;ctx.fillStyle=ctx.strokeStyle=WX.kind==='rain'?'rgba(190,210,235,.45)':'rgba(245,248,255,.85)';ctx.lineWidth=1;
    if(WX.kind==='rain'){ctx.fillStyle='rgba(60,75,95,.12)';ctx.fillRect(0,0,viewW,viewH);ctx.beginPath()}
    for(let i=0;i<n;i++){const sp=WX.kind==='rain'?620:60,x=((i*97.3+t*(WX.kind==='rain'?120:25))%(viewW+40))-20,y=((i*61.7+t*sp)%(viewH+40))-20;
      if(WX.kind==='rain'){ctx.moveTo(x,y);ctx.lineTo(x-3,y+11)}else{ctx.fillRect(x+Math.sin(t+i)*6,y,2,2)}}
    if(WX.kind==='rain')ctx.stroke()}
  const vg=ctx.createRadialGradient(viewW/2,viewH/2,Math.min(viewW,viewH)*.45,viewW/2,viewH/2,Math.max(viewW,viewH)*.75);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.35)');ctx.fillStyle=vg;ctx.fillRect(0,0,viewW,viewH);
  if(drag&&drag.box){ctx.strokeStyle='#9ef0a0';ctx.fillStyle='rgba(158,240,160,.08)';const x=Math.min(drag.sx,mouse.x),y=Math.min(drag.sy,mouse.y),w=Math.abs(mouse.x-drag.sx),h=Math.abs(mouse.y-drag.sy);ctx.fillRect(x,y,w,h);ctx.strokeRect(x+.5,y+.5,w,h)}
  if(paused&&started&&!over){ctx.fillStyle='rgba(0,0,0,.4)';ctx.fillRect(0,0,viewW,viewH);ctx.fillStyle='#e9be72';ctx.font='600 32px "Alegreya SC",Georgia,serif';ctx.textAlign='center';ctx.fillText('Pause',viewW/2,viewH/2);ctx.textAlign='left'}
}
let marker=null;

function renderMini(){
  if(!ents)return;
  const w=mm.width,h=mm.height,sx=w/W,sy=h/H;
  mctx.imageSmoothingEnabled=false;mctx.drawImage(terrMini,0,0,w,h);
  for(const e of ents){
    if(e.dead||!visibleEnt(e))continue;
    if(e.kind==='res'){if(e.type==='tree')continue;mctx.fillStyle=RES_COL[e.rt];mctx.fillRect(e.x*sx,e.y*sy,sx,sy);continue}
    mctx.fillStyle=PCOL[e.owner];
    if(e.kind==='bld'){mctx.fillRect(e.x*sx,e.y*sy,e.size*sx,e.size*sy);mctx.strokeStyle='rgba(0,0,0,.55)';mctx.lineWidth=dpr*.8;mctx.strokeRect(e.x*sx,e.y*sy,e.size*sx,e.size*sy)}
    else mctx.fillRect(e.x*sx-1.5*dpr,e.y*sy-1.5*dpr,3*dpr,3*dpr);
  }
  // trees as dark specks
  mctx.fillStyle='rgba(20,50,25,.85)';
  for(const e of ents)if(e.kind==='res'&&e.type==='tree'&&exp[idx(e.x,e.y)])mctx.fillRect(e.x*sx,e.y*sy,sx,sy);
  mctx.imageSmoothingEnabled=true;mctx.drawImage(fogC,0,0,w,h);
  mctx.strokeStyle='#f1e6cf';mctx.lineWidth=dpr;mctx.strokeRect(cam.x/T*sx,cam.y/T*sy,viewW/cam.z/T*sx,viewH/cam.z/T*sy);
  if(ping&&pingT>0){mctx.strokeStyle='#ff6a5a';mctx.lineWidth=2*dpr;const r=(3-pingT)%1*14*dpr+4;mctx.beginPath();mctx.arc(ping.x*sx,ping.y*sy,r,0,7);mctx.stroke()}
}

// ================= UI =================
let uiDirty=true,uiKey='',uiT=0;
// ---- Klang: synthetische Platzhalter-Effekte (WebAudio), Ein/Aus über die Taste „Ton“
let SET={vol:.8,q:2,auto:1,vox:1};try{Object.assign(SET,JSON.parse(localStorage.getItem('empire-xy.set')||'{}'))}catch(e){}
let actx=null,soundOn=true;try{soundOn=localStorage.getItem('empire-xy.ton')!=='0'}catch(e){}
const sfxLast={};
const onScreen=u=>{const sx=(u.x*T-cam.x)*cam.z,sy=(u.y*T-cam.y)*cam.z;return sx>-40&&sy>-40&&sx<viewW+40&&sy<viewH+40};
function sfx(k){
  if(!soundOn)return;const now=performance.now();if(now-(sfxLast[k]||0)<({hit:90,shot:120,boom:150,chop:380,mine:420,sword:110,bell:400}[k]||60))return;sfxLast[k]=now;
  try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch(e){return}
  const tone=(type,f1,f2,a,d,v,dl)=>{const t=actx.currentTime+(dl||0),o=actx.createOscillator(),g=actx.createGain();o.connect(g);g.connect(actx.destination);
    o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+a+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Math.max(.0002,v*SET.vol),t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);o.start(t);o.stop(t+a+d+.05)};
  const P={click:['triangle',660,520,.005,.06,.05],good:['sine',523,784,.01,.35,.08],warn:['square',220,180,.01,.3,.04],
    hit:['square',140,70,.002,.08,.03],shot:['triangle',900,300,.002,.09,.025],boom:['sawtooth',90,30,.005,.35,.07],
    chop:['square',260,120,.001,.05,.025],mine:['triangle',1500,1100,.001,.07,.02],sword:['sawtooth',2200,1400,.001,.06,.018]}[k];
  if(P){tone(...P);if(k==='sword')tone('sine',3300,3000,.001,.12,.012);return}
  if(k==='bell'){tone('sine',880,878,.003,1.1,.06);tone('sine',1320,1318,.003,.7,.03);tone('sine',2200,2198,.002,.35,.015)}
  if(k==='epoch'){// kleine Fanfare: drei Töne und ein Schlussakkord
    [[392,0],[523,.16],[659,.32]].forEach(([f,d])=>tone('sawtooth',f,f,.01,.14,.035,d));[523,659,784].forEach(f=>tone('triangle',f,f,.02,.9,.04,.5))}
}
function toast(msg,kind){
  if(ME!==LOCAL)return;
  if(kind==='good')sfx(/Willkommen in der/.test(msg)?'epoch':'good');else if(kind==='warn')sfx('warn');
  const el=document.createElement('div');el.className='toast'+(kind?' '+kind:'');el.textContent=msg;
  const box=$('#toasts');box.appendChild(el);while(box.children.length>5)box.firstChild.remove();
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),700)},5200);
}
function costHTML(c){return Object.keys(c).map(k=>`<b><span class="dot" style="background:${RES_COL[k]}"></span>${c[k]}</b>`).join('')}
// Siedlerstimmen: kurze gesprochene Antworten beim Auswählen eigener Einheiten (Web Speech, sonst Murmelton)
const VOX={worker:['Ja?','Was gibt es zu tun?','Bereit zur Arbeit.','Jawohl.','Hier bin ich.','Wo soll ich hin?'],
  infantry:['Zu Befehl!','Bereit!','Für das Reich!','Schwert gezogen.','Jawohl, Herr!'],ranged:['Bogen gespannt.','Ziel erfasst?','Bereit!','Wir decken euch.'],
  cavalry:['Aufsitzen!','Die Pferde sind bereit.','Zu Befehl!','Reiter bereit!'],siege:['Geschütz bereit.','Wohin zielen wir?','Laden!'],naval:['Segel gesetzt.','Leinen los!','Aye!'],hero:['Ich führe euch!','Für Ruhm und Ehre!','Sprecht!']};
let voxT=0,voxV=null;
function voice(u){if(!soundOn||SET.vol<=0)return;const now=performance.now();if(now-voxT<700)return;voxT=now;
  const lk=UNITS[u.type]&&UNITS[u.type].hero?'hero':UNITS[u.type]&&UNITS[u.type].naval?'naval':LOOK(u.type);const L=VOX[lk]||VOX.worker,txt=L[(Math.random()*L.length)|0];
  const pitch={worker:1.1,infantry:.8,ranged:1,cavalry:.85,siege:.7,naval:.9,hero:.75}[lk]||1;
  try{const ss=window.speechSynthesis;if(ss&&window.SpeechSynthesisUtterance){if(!voxV){const vs=ss.getVoices();voxV=vs.find(v=>/^de/i.test(v.lang))||null}
    ss.cancel();const ut=new SpeechSynthesisUtterance(txt);ut.lang='de-DE';if(voxV)ut.voice=voxV;ut.pitch=pitch*(.9+Math.random()*.2);ut.rate=1.05;ut.volume=SET.vol;ss.speak(ut);return}}catch(e){}
  sfx('click')}
function select(list,add){
  if(add){for(const e of list)if(!sel.includes(e))sel.push(e)}else sel=list.slice();
  // only one non-unit or foreign thing at a time
  if(sel.length>1)sel=sel.filter(e=>e.kind==='unit'&&e.owner===ME).length?sel.filter(e=>e.kind==='unit'&&e.owner===ME):[sel[0]];
  if(!CMDX){const u=list.find(e=>e.kind==='unit'&&e.owner===ME&&!e.dead);if(u&&started&&SET.vox!==0)voice(u)}
  uiDirty=true;placing=null;aMode=false;
}
function selKey(){return sel.map(e=>e.id).join(',')+'|'+players[ME].epoch+'|'+(placing||'')+(aMode?'A':'')+'|'+(sel[0]&&sel[0].kind==='bld'?(sel[0].built?1:0):'')}

function campToggle(us){if(!us.length)return;const cx=us.reduce((a,u)=>a+u.x,0)/us.length,cy=us.reduce((a,u)=>a+u.y,0)/us.length;
  const ex=ents.find(e=>e.type==='fieldcamp'&&!e.dead&&e.owner===ME&&Math.hypot(e.x+1-cx,e.y+1-cy)<4);
  if(ex){ex.dead=true;ex.hp=0;toast('Feldlager abgebaut.');players[ME].res.wood+=40;return}
  if(!BLD.fieldcamp)return;if(!canAfford(ME,{wood:80})){toast('Feldlager kostet 80 Holz.','warn');return}pay(ME,{wood:80});const b=placeBld(ME,'fieldcamp',Math.round(cx-1),Math.round(cy-1),false);if(b)toast('Feldlager wird aufgeschlagen.','good')}
const BCATS=[{n:'Wirtschaft',i:'🌾'},{n:'Handwerk',i:'⚒'},{n:'Militär',i:'⚔'},{n:'Befestigung',i:'🏰'},{n:'Kultur',i:'⛪'}];
const BCAT_OF={house:0,farm:0,camp:0,mill:0,mine:0,warehouse:0,depot:0,market:0,dock:0,bridge:0,bakery:1,sawmill:1,mason:1,smith:1,barracks:2,range:2,stable:2,workshop:2,milcamp:2,mercs:2,fieldcamp:2,guild:2,wall:3,gate:3,tower:3,sniper:3,castle:3,temple:4,templar:4,lodge:4,monument:4,wonder:4,tc:4};
const bcatOf=t=>BLD[t].cat!=null?BLD[t].cat:BCAT_OF[t]!=null?BCAT_OF[t]:0;let buildCat=0;
function getCommands(){
  const cmds=[];if(!sel.length)return cmds;
  const pl=players[ME],first=sel[0];
  if(first.owner!==ME)return cmds;
  if(first.kind==='unit'){
    const workers=sel.filter(u=>u.type==='worker');
    if(workers.length){
      const cat=BCATS[buildCat],list=Object.keys(BLD).filter(t=>BLD[t].slot!=null&&bcatOf(t)===buildCat).sort((x,y)=>BLD[x].slot-BLD[y].slot);
      BCATS.forEach((c,i)=>{const n=Object.keys(BLD).filter(t=>BLD[t].slot!=null&&bcatOf(t)===i).length;if(n)cmds[i]={ui:true,label:c.i+' '+c.n,desc:'Baumenü: '+c.n+' ('+n+' Gebäude).',on:buildCat===i,cat:true,act:()=>{buildCat=i;uiDirty=true}}});
      list.forEach((t,k)=>{const d=BLD[t],locked=(d.minEpoch||0)>pl.epoch;const slot=k<8?5+k:7+k;
        cmds[slot]={ui:true,label:bname(d,pl.epoch),cost:d.cost,desc:d.desc,dis:locked||!canAfford(ME,d.cost),need:locked?'Benötigt '+EPOCHS[d.minEpoch]:null,short:!locked&&!canAfford(ME,d.cost),on:placing===t,act:()=>{placing=placing===t?null:t;uiDirty=true}}});
      cmds[14]={key:'stop',label:'Stopp',desc:'Aktuelle Tätigkeit abbrechen.',act:()=>{for(const u of sel)order(u,{t:'idle'})}};
    }else{
      cmds[0]={ui:true,label:'Angriff­bewegung',desc:'Zum Ziel marschieren und unterwegs jeden Feind angreifen. Danach Rechtsklick auf die Karte.',on:aMode,act:()=>{aMode=!aMode;uiDirty=true}};
      cmds[1]={key:'stop',label:'Stopp',desc:'Halten und Befehle verwerfen.',act:()=>{for(const u of sel)order(u,{t:'idle'})}};
      {const car=sel.filter(u=>u.cargo&&u.cargo.length);if(car.length)cmds[9]={key:'unload',label:'Absitzen',desc:'Alle Insassen steigen aus ('+car.reduce((a,c)=>a+c.cargo.length,0)+' Soldaten). Hubschrauber nur über Land.',act:()=>{let n=0;for(const c of car)n+=unload(c);if(n)toast(n+' Soldaten sitzen ab.','good');uiDirty=true}}}
      cmds[21]={key:'camp',label:'Feldlager',desc:'Schlägt in 10 Sekunden ein befestigtes Lager auf (L): +40 % Abwehr und Heilung im Umkreis von 4 Feldern. Steht schon eins hier, wird es abgebaut.',act:()=>{campToggle(sel.filter(u=>u.kind==='unit'&&u.owner===ME))}};
      {const cur=sel[0].form||0,nx=(cur+1)%4;cmds[8]={key:'form',label:'Formation: '+FORMS[cur],desc:'Wechselt die Formation (F): Schildwall +30 % Abwehr, halbes Tempo. Keil +30 % Angriff, −20 % Abwehr. Schützenlinie (nur Fernkämpfer) +40 % Reichweite, steht fest. Nächste: '+FORMS[nx]+'.',act:()=>{for(const u of sel){let f=nx;if(f===3&&uStat(u).range<2)f=0;u.form=f;if(f===3)order(u,{t:'idle'})}toast('Formation: '+FORMS[nx]+'.');uiDirty=true}}}
    }
    cmds[13]={ui:true,label:'Abwählen',desc:'Auswahl aufheben (Esc).',act:()=>select([])};
  }else if(first.kind==='bld'&&first.built){
    const D=BLD[first.type];
    if(D.cmds){try{D.cmds(first,API).forEach((c,i)=>{if(c)cmds[10+i]={key:'b'+i,...c,dis:c.dis||(c.cost&&!canAfford(ME,c.cost)),act:()=>{if(c.cost&&!canAfford(ME,c.cost)){toast('Nicht genug Rohstoffe.','warn');return}if(c.cost)pay(ME,c.cost);c.act();uiDirty=true}}})}catch(e){}}
    const tl=trainsOf(first.type).filter(k=>!UNITS[k].civ||UNITS[k].civ===pl.civ);let us=0;
    for(const ut of tl){const U=UNITS[ut],locked=(U.minEpoch||0)>pl.epoch,full=U.max&&countUnits(ME,ut)>=U.max;
      if(us===1&&first.type==='tc')us=2;if(us===4)us=5;
      cmds[us++]={key:'u:'+ut,label:uname(U,pl.epoch),cost:uCost(ME,ut),desc:U.desc+' ('+U.label+')',dis:locked||full||!canAfford(ME,uCost(ME,ut))||first.queue.length>=6,short:!locked&&!full&&!canAfford(ME,uCost(ME,ut)),need:locked?'Benötigt '+EPOCHS[U.minEpoch]:full?'Höchstens '+U.max+' gleichzeitig':null,act:()=>{if(!queueUnit(first,ut))toast('Nicht genug Rohstoffe.','warn');uiDirty=true}};
    }
    // research available in this building
    const free=[];for(let i=0;i<13;i++)if(!(i<us)&&i!==1&&i!==4)free.push(i);
    const techs=Object.keys(TECHS).filter(id=>TECHS[id].at===first.type&&['open','epoch','requires','running'].includes(techState(ME,id))).sort((a,b)=>(TECHS[a].epoch||0)-(TECHS[b].epoch||0));
    const seenLine=new Set();
    for(const id of techs){const t=TECHS[id],st=techState(ME,id);
      if(st==='requires')continue; // show the next step of each line only
      if(!free.length)break;const slot=free.shift();
      cmds[slot]={key:'t:'+id,label:t.name,cost:t.cost,desc:'Forschung: '+(t.desc||'')+' Dauer '+(t.time||30)+' s.',tech:true,
        dis:st!=='open'||!canAfford(ME,t.cost)||first.queue.length>=6,short:st==='open'&&!canAfford(ME,t.cost),
        need:st==='epoch'?'Benötigt '+EPOCHS[t.epoch]:st==='running'?'Wird bereits erforscht':null,
        act:()=>{if(!queueTech(first,id))toast('Nicht genug Rohstoffe.','warn');uiDirty=true}};
    }
    if(first.type==='tc'){
      if(pl.epoch<MAXEP()){const c=EPOCH_COST[pl.epoch+1];
        cmds[1]={key:'ep',label:EPOCHS[pl.epoch+1],cost:c,desc:'In die '+EPOCHS[pl.epoch+1]+' vorrücken. Alle Einheiten werden stärker und neue Gebäude freigeschaltet. Dauer '+EPOCH_TIME[pl.epoch+1]+' s.',dis:pl.advancing||!canAfford(ME,c),short:!canAfford(ME,c),need:pl.advancing?'Vorrücken läuft bereits':null,act:()=>{if(queueEpoch(first))toast('Vorrücken in die '+EPOCHS[pl.epoch+1]+' begonnen.');uiDirty=true}};
      }
    }
    if(tl.length)cmds[4]={ui:true,label:'Sammelpunkt',desc:'Rechtsklick auf die Karte setzt den Sammelpunkt für neue Einheiten. Rechtsklick auf Rohstoffe schickt neue Arbeiter direkt zum Sammeln.',act:()=>toast('Rechtsklick auf die Karte setzt den Sammelpunkt.')};
    cmds[13]={ui:true,label:'Abwählen',desc:'Auswahl aufheben (Esc).',act:()=>select([])};
  }else if(first.kind==='bld'){
    cmds[0]={key:'cancel',label:'Abbrechen',desc:'Bau abbrechen und Rohstoffe teilweise zurückerhalten.',act:()=>{refund(ME,mulCost(BLD[first.type].cost,.75*(1-first.prog)));kill(first,null);players[ME].st.lost--;select([])}};
  }
  return cmds;
}
function buildCmds(){
  const box=$('#cmds');box.innerHTML='';const cmds=getCommands();curCmds=cmds;
  const n=cmds.length?Math.max(10,Math.ceil(cmds.length/5)*5):0;
  for(let i=0;i<n;i++){
    const c=cmds[i];const b=document.createElement('button');b.className='cmd';
    if(!c){b.style.visibility='hidden';b.tabIndex=-1;box.appendChild(b);continue}
    b.innerHTML=`<kbd>${SLOTKEYS[i]||''}</kbd><span class="n">${c.label}</span><span class="c">${c.cost?costHTML(c.cost):''}</span>`;
    b.disabled=!!c.dis&&!c.short;if(c.short)b.classList.add('short');if(c.tech)b.classList.add('tech');if(c.cat)b.classList.add('cat');if(c.on)b.classList.add('on');
    b.addEventListener('click',()=>{if(c.need&&c.dis){toast(c.need,'warn');return}if(c.short&&c.dis){toast('Nicht genug Rohstoffe.','warn');return}sfx('click');runCmd(c)});
    b.addEventListener('pointerenter',ev=>showTip(c,b));b.addEventListener('pointerleave',hideTip);
    box.appendChild(b);c.el=b;
  }
}
let curCmds=[];
function refreshCmds(){for(const c of curCmds){if(!c||!c.el)continue;
  if(c.cost){const pl=players[ME];const sh=!canAfford(ME,c.cost);c.short=sh;c.el.classList.toggle('short',sh);}
}
  // recompute disabled states cheaply
  const fresh=getCommands();fresh.forEach((c,i)=>{const o=curCmds[i];if(c&&o&&o.el){o.dis=c.dis;o.short=c.short;o.el.disabled=!!c.dis&&!c.short;o.el.classList.toggle('short',!!c.short)}});
}
function showTip(c,el){
  const tip=$('#tip');
  let need=c.need?`<div class="need">${c.need}</div>`:'';
  if(c.cost&&!canAfford(ME,c.cost)){const miss=Object.keys(c.cost).filter(k=>players[ME].res[k]<c.cost[k]).map(k=>RES_DE[k]).join(', ');need+=`<div class="need">Fehlt: ${miss}</div>`}
  tip.innerHTML=`<h4>${c.label.replace('­','')}</h4>${c.cost?'<div class="c" style="display:flex;gap:8px;margin-bottom:4px">'+costHTML(c.cost)+'</div>':''}<div>${c.desc||''}</div>${need}`;
  tip.hidden=false;const r=el.getBoundingClientRect(),tr=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(window.innerWidth-tr.width-8,r.left+r.width/2-tr.width/2))+'px';tip.style.top=Math.max(8,r.top-tr.height-8)+'px';
}
function hideTip(){$('#tip').hidden=true}

// Einheitenkategorien für die Auswahl-Tabs
const CLS_DE={infantry:'Infanterie',ranged:'Fernkämpfer',cavalry:'Kavallerie',siege:'Belagerung',ship:'Schiffe',vehicle:'Fahrzeuge',aircraft:'Luftwaffe',healer:'Heiler'};
const UCATS=[['inf','Infanterie'],['cav','Kavallerie'],['veh','Fahrzeuge'],['air','Luftwaffe'],['sea','Schiffe'],['sie','Belagerung'],['civ','Zivil']];
const ucatOf=t=>{const D=UNITS[t]||{},c=CLS(t);if(D.air||c==='aircraft')return 'air';if(D.naval||c==='ship')return 'sea';if(c==='vehicle')return 'veh';if(c==='cavalry')return 'cav';if(c==='siege')return 'sie';if(t==='worker'||t==='caravan'||D.civil)return 'civ';return 'inf'};
function buildInfo(){
  const box=$('#info');const pl=players[ME];
  if(!sel.length){
    box.innerHTML=`<h2>${EPOCHS[pl.epoch]}</h2><div class="hint">Wähle Einheiten mit Linksklick oder Rahmen aus. Rechtsklick gibt Befehle. <kbd>H</kbd> springt zum Stadtzentrum, <kbd>.</kbd> wählt einen untätigen Arbeiter.</div>`;return}
  if(sel.length>1){
    const by={};for(const u of sel){const k=u.type;(by[k]=by[k]||[]).push(u)}
    const hp=sel.reduce((a,u)=>a+u.hp,0),mx=sel.reduce((a,u)=>a+u.maxhp,0);
    const nW=sel.filter(u=>u.type==='worker').length;
    const nc={};for(const u of sel){const c=ucatOf(u.type);nc[c]=(nc[c]||0)+1}
    box.innerHTML=`<h2>${sel.length} Einheiten</h2><div class="hp"><b style="width:${hp/mx*100}%"></b></div><div class="utabs">${UCATS.filter(([k])=>k!=='civ'||nc.civ).map(([k,n])=>`<button class="utab" data-c="${k}" ${nc[k]?'':'disabled'}>${n}<b>${nc[k]||0}</b></button>`).join('')}</div><div class="chips">${Object.keys(by).map(k=>`<button class="chip" data-t="${k}">${by[k].length}× ${uname(UNITS[k],pl.epoch)}</button>`).join('')}</div><div class="hint">${nW?'Bauen: Gebäude unten rechts wählen, dann auf die Karte klicken. ':''}Kategorie oder Typ anklicken, um nur diese Einheiten zu behalten.</div>`;
    box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>select(sel.filter(u=>u.type===c.dataset.t)));
    box.querySelectorAll('.utab').forEach(c=>c.onclick=()=>select(sel.filter(u=>ucatOf(u.type)===c.dataset.c)));
    return;
  }
  const e=sel[0];
  if(e.kind==='res'){box.innerHTML=`<h2>${{tree:'Baum',berry:'Beerenstrauch',stone:'Steinbruch',gold:'Goldader'}[e.type]}</h2><div class="sub">${RES_DE[e.rt]}</div><div class="stats"><span><em>Vorrat</em><span data-live="amt">${Math.ceil(e.amount)}</span></span></div>`;return}
  const own=e.owner===ME?'Dein Reich':'Feindliches Reich',ep=players[e.owner].epoch;
  if(e.kind==='unit'){
    const U=UNITS[e.type],s=uStat(e);
    const ordTxt={idle:'Untätig',guard:'Wache',move:'Unterwegs',amove:'Angriffsbewegung',attack:'Im Kampf',gather:'Sammelt '+(RES_DE[e.order.rt]||''),return:'Bringt Rohstoffe zurück',build:'Baut',board:'Steigt ein'}[e.order.t]||'';
    box.innerHTML=`<h2>${uname(U,ep)}</h2><div class="sub">${U.label} · ${own} · <span data-live="ord">${ordTxt}</span></div><div class="hp"><b data-live="hp" style="width:${e.hp/e.maxhp*100}%"></b></div>
    <div class="stats"><span><em>Leben</em><span data-live="hpt">${Math.ceil(e.hp)}/${e.maxhp}</span></span><span><em>Angriff</em>${s.atk.toFixed(0)}</span><span><em>Reichweite</em>${s.range<1?'Nahkampf':s.range}</span><span><em>Tempo</em>${s.speed.toFixed(1)}</span>${U.seats?`<span><em>Insassen</em>${(e.cargo||[]).length}/${U.seats}</span>`:''}${e.type==='worker'?`<span><em>Trägt</em><span data-live="carry">${Math.floor(e.carry)}</span></span>`:''}</div>
    ${e.type==='worker'&&e.owner===ME?`<div class="hint">Bauen: Gebäude unten rechts wählen, dann auf die Karte klicken.</div>`:''}
    ${U.bonus?`<div class="hint">Stark gegen ${Object.keys(U.bonus).map(k=>CLS_DE[k]||(UNITS[k]&&UNITS[k].label)||k).join(' und ')}.</div>`:''}`;
    return;
  }
  const D=BLD[e.type];
  let h=`<h2>${bname(D,ep)}</h2><div class="sub">${own}${e.built?'':' · im Bau'}</div><div class="hp"><b data-live="hp" style="width:${e.hp/e.maxhp*100}%"></b></div><div class="stats"><span><em>Leben</em><span data-live="hpt">${Math.ceil(e.hp)}/${e.maxhp}</span></span>${D.pop?`<span><em>Bevölkerung</em>+${D.pop}</span>`:''}${D.atk?`<span><em>Angriff</em>${(D.atk*(1+.14*ep)).toFixed(0)}</span><span><em>Reichweite</em>${D.range}</span>`:''}${!e.built?`<span><em>Fortschritt</em><span data-live="prog">${Math.floor(e.prog*100)}%</span></span>`:''}</div>`;
  if(e.owner===ME&&e.queue.length){h+=`<div class="queue" data-live="queue"></div>`}
  else if(e.owner===ME&&trainsOf(e.type).length)h+=`<div class="hint">Keine Ausbildung in Arbeit.</div>`;
  if(e.owner===ME&&e.built&&trainsOf(e.type).length)h+=`<label class="prio">Priorität <select id="prioSel"><option value="2"${e.prio===2?' selected':''}>Hoch (doppelt so schnell, doppelte Kosten)</option><option value="1"${!e.prio||e.prio===1?' selected':''}>Normal</option><option value=".5"${e.prio===.5?' selected':''}>Niedrig (halbe Rate)</option></select></label>`;
  box.innerHTML=h;const ps=box.querySelector('#prioSel');if(ps)ps.onchange=()=>{if(MP)sendCmd('prio',{b:e.id,v:+ps.value});else e.prio=+ps.value;toast('Priorität: '+ps.options[ps.selectedIndex].text.split(' ')[0]+'.')};
}
function refreshInfo(){
  const box=$('#info');if(sel.length!==1)return;const e=sel[0];
  const q=s=>box.querySelector(`[data-live="${s}"]`);
  let el;
  if((el=q('hp')))el.style.width=(e.hp/e.maxhp*100)+'%';
  if((el=q('hpt')))el.textContent=Math.ceil(e.hp)+'/'+e.maxhp;
  if((el=q('amt')))el.textContent=Math.ceil(e.amount);
  if((el=q('carry')))el.textContent=Math.floor(e.carry);
  if((el=q('prog')))el.textContent=Math.floor(e.prog*100)+'%';
  if((el=q('ord'))){const o=e.order;el.textContent={idle:'Untätig',guard:'Wache',move:'Unterwegs',amove:'Angriffsbewegung',attack:'Im Kampf',gather:'Sammelt '+(RES_DE[o.rt]||''),return:'Bringt Rohstoffe zurück',build:'Baut',board:'Steigt ein'}[o.t]||''}
  if(e.kind==='bld'&&e.owner===ME){
    el=q('queue');
    if(e.queue.length&&!el){buildInfo();return}
    if(!e.queue.length&&el){buildInfo();return}
    if(el){
      const sig=e.queue.map(x=>x.ep?'E':x.tech||x.u).join();
      if(el.dataset.sig!==sig){el.dataset.sig=sig;el.innerHTML=e.queue.map((x,i)=>`<button class="qi" data-i="${i}" title="Klicken zum Abbrechen">${x.ep?'Epoche':x.tech?TECHS[x.tech].name.slice(0,5):uname(UNITS[x.u],players[ME].epoch).slice(0,4)}<i></i></button>`).join('')+(e.queue[0].blocked?'<span class="hint">Bevölkerungslimit</span>':'');
        el.querySelectorAll('.qi').forEach(b=>b.onclick=()=>{if(MP)sendCmd('cq',{b:e.id,i:+b.dataset.i});else cancelQ(e,+b.dataset.i);uiDirty=true})}
      const bar=el.querySelector('.qi i');if(bar)bar.style.width=(e.queue[0].t/e.queue[0].total*100)+'%';
      const hint=el.querySelector('.hint');if(!!e.queue[0].blocked!==!!hint)el.dataset.sig='';
    }
  }
}
function updateTop(){
  const pl=players[ME];
  const rcap=resCap(pl);for(const r of RES){const el=$('#r-'+r),v=Math.floor(pl.res[r]);if(el.textContent!=v)el.textContent=v;el.parentNode.classList.toggle('full',pl.res[r]>=rcap);el.parentNode.title=el.parentNode.title.split(' (')[0]+' (Lager '+rcap+')';
    const ir=incomeRate(pl,r),ie=$('#i-'+r);if(ie){const t=ir>0?'+'+ir+'/min':'';if(ie.textContent!==t)ie.textContent=t}}
  const gd=pl.goods,ge=$('#r-goods');if(ge&&gd){const L=[['wheat','Weizen'],['flour','Mehl'],['planks','Bretter'],['blocks','Quader'],['ore','Erz'],['tools','Werkzeug'],['pearls','Perlen']].filter(([k])=>(gd[k]||0)>=1),on=L.length>0;ge.hidden=!on;if(on){const t=L.map(([k,n])=>n+' '+Math.floor(gd[k])).join(' · ');if(ge.textContent!==t){ge.textContent=t;ge.title='Waren aus deinen Produktionsketten. Werkzeug beschleunigt alle Arbeiter um '+Math.round(((pl.toolMul||1)-1)*100)+' %.'}}}
  const md=$('#r-mood');if(md){const m=Math.round(pl.mood??50),t=m+'';if(md.textContent!==t){md.textContent=t;md.style.color=m>=65?'var(--ok)':m<35?'var(--danger)':'';md.parentNode.title='Beliebtheit '+m+' von 100: '+(pl.moodWhy||'')+' Sammeltempo '+Math.round((pl.moodMul||1)*100)+' %.'}}
  const p=$('#r-pop'),pv=pl.pop+'/'+pl.cap+' Einwohner';if(p.textContent!==pv){p.textContent=pv;p.style.color=pl.pop>=pl.cap?'var(--danger)':pl.pop>=pl.cap*.9?'var(--warn,#d9a43a)':'';p.title='Einwohner / Wohnraum. Ab 90 % Belegung: Beliebtheit −5 und Produktion −15 %. Baue Wohnhäuser.'}
  const tc=ents.find(e=>e.owner===ME&&e.kind==='bld'&&e.queue.some(q=>q.ep));
  const en=pl.advancing&&tc?EPOCHS[pl.epoch]+' → '+EPOCHS[pl.epoch+1]:EPOCHS[pl.epoch];
  if($('#epochName').textContent!==en)$('#epochName').textContent=en;
  const q=tc&&tc.queue.find(q=>q.ep);$('#epochBar b').style.width=(q?q.t/q.total*100:(pl.epoch/Math.max(1,MAXEP())*100))+'%';
  // research progress HUD (all running techs of the player)
  const rq=[];for(const e of ents)if(e.owner===ME&&e.kind==='bld'&&!e.dead)e.queue.forEach((x,i)=>{if(x.tech)rq.push({id:x.tech,f:i===0?x.t/x.total:0,left:i===0?x.total-x.t:x.total+(i?1e9:0),wait:i>0})});
  const rh=$('#researchHud'),rsig=rq.map(r=>r.id).join();
  if(rh.dataset.sig!==rsig){rh.dataset.sig=rsig;rh.hidden=!rq.length;rh.innerHTML=rq.map(r=>`<div class="rq" data-id="${r.id}"><span>${TECHS[r.id].name}</span><em></em><i><b></b></i></div>`).join('')}
  rq.forEach((r,i)=>{const row=rh.children[i];if(!row)return;row.querySelector('b').style.width=(r.f*100)+'%';row.querySelector('em').textContent=r.wait?'wartet':Math.floor(r.f*100)+'% · '+Math.ceil(r.left)+' s'});
  if(!$('#techScreen').hidden)$('#techCols').querySelectorAll('.tk.running').forEach(btn=>{const r=rq.find(x=>x.id===btn.dataset.id);const st=btn.querySelector('.st');if(r&&st)st.textContent=r.wait?'Wartet in Warteschlange':'Wird erforscht: '+Math.floor(r.f*100)+'%';let bar=btn.querySelector('.pb');if(!bar){bar=document.createElement('i');bar.className='pb';bar.innerHTML='<b></b>';btn.appendChild(bar)}bar.firstChild.style.width=(r?r.f*100:0)+'%'});
  $('#clock').textContent=(players[ME].depotXfer>gameT?'⇄ ':'')+SEAS_I[SEASON]+' '+(WX.kind==='rain'?'🌧 ':WX.kind==='snow'?'❄ ':WX.kind==='storm'?'🌪 ':'')+(WX.night>.5?'🌙 ':'☀ ')+(timeLimit?fmtTime(gameT)+' / '+timeLimit+':00':fmtTime(gameT));$('#clock').title=SEAS[SEASON]+' ('+SEAS_D[SEASON]+', wechselt alle 3 Minuten). '+WXN[WX.kind]+(WX.night>.5?', Nacht: weniger Sicht, der Gegner greift eher an':'');
  const idle=ents.filter(e=>e.owner===ME&&e.type==='worker'&&e.order.t==='idle').length;$('#idleN').textContent=idle;
  const wb=$('#wonderBanner');const wt=players.find(p=>p.wonderT>0);
  const rc=players.find(p=>p.raceUntil>gameT);
  if(!wt&&rc){wb.hidden=false;wb.textContent=(rc.i===ME?'Dein Volk':CIVS[rc.civ].name)+' erreichte als Erste die '+EPOCHS[rc.raceEp]+': Vorsprung noch '+fmtTime(rc.raceUntil-gameT);}else
  if(wt){wb.hidden=false;wb.textContent=(wt.i===ME?'Dein Weltwunder':'Feindliches Weltwunder')+': '+fmtTime(wt.wonderT)}else wb.hidden=true;
}

// ================= input =================
const mouse={x:0,y:0,inside:false};let drag=null,placing=null,aMode=false,groups={},lastClick={t:0,id:0};
const keys=new Set();
function pickAt(wx,wy){
  let best=null,bd=1e9;
  for(const e of ents){if(e.dead||e.kind!=='unit'||!visibleEnt(e))continue;const d=isAir(e)&&e.airX!==undefined?Math.min(Math.hypot(e.airX/T-wx,e.airY/T-wy),Math.hypot(e.x-wx,e.y-wy)):Math.hypot(e.x-wx,e.y-wy);if(d<e.r+.25&&d<bd){bd=d;best=e}}
  if(best)return best;
  for(const e of ents){if(e.dead||e.kind==='unit'||!visibleEnt(e))continue;if(wx>=e.x&&wx<e.x+e.size&&wy>=e.y&&wy<e.y+e.size)return e}
  return null;
}
function rightCommand(wx,wy,tid){
  const mine=sel.filter(e=>e.owner===ME);if(!mine.length)return;
  if(MP&&!CMDX){const t=pickAt(wx,wy);sendCmd('rc',{x:wx,y:wy,t:t?t.id:0,sh:shiftHeld,am:aMode});
    marker={x:wx,y:wy,t:1,c:t&&t.owner>=0&&t.owner!==ME||aMode?'#ff8a7a':shiftHeld?'#9ef0a0':'#e9be72'};aMode=false;uiDirty=true;return}
  const t=CMDX?(tid&&alive(byId.get(tid))?byId.get(tid):null):pickAt(wx,wy);
  if(mine[0].kind==='bld'){
    const b=mine[0];if(!trainsOf(b.type).length)return;
    b.rally={x:wx,y:wy,id:t&&(t.kind==='res'||(t.kind==='bld'&&t.owner===ME&&(t.type==='farm'||!t.built)))?t.id:0};marker={x:wx,y:wy,t:1,c:'#e9be72'};return;
  }
  const units=mine.filter(e=>e.kind==='unit');if(!units.length)return;
  if(t&&t.kind==='bld'&&t.type==='market'&&t.owner===ME&&units.some(u=>u.type==='caravan')){for(const u of units)if(u.type==='caravan'){u.dest=t.id;u.leg=1;u.order={t:'idle'}}toast('Karawanenziel festgelegt.','good');marker={x:wx,y:wy,t:1,c:'#e9be72'};uiDirty=true;return}
  if(shiftHeld&&units.every(u=>u.order&&(u.order.t==='move'||u.order.t==='amove'))){for(const u of units)(u.wq=u.wq||[]).push({x:wx,y:wy,a:aMode});marker={x:wx,y:wy,t:1,c:'#9ef0a0'};aMode=false;uiDirty=true;return}
  for(const u of units)u.wq=[];
  if(t&&t.kind==='unit'&&t.owner===ME&&UNITS[t.type].seats&&units.some(u=>canBoard(u.type))){
    const free=UNITS[t.type].seats-(t.cargo||[]).length;let n=0;for(const u of units)if(canBoard(u.type)&&n<free){order(u,{t:'board',target:t.id});n++}
    toast(n?n+' Soldaten sitzen auf.':'Der Transporter ist voll.',n?'good':'warn');marker={x:wx,y:wy,t:1,c:'#9ef0a0'};uiDirty=true;return}
  if(t&&!(t.kind==='bld'&&t.type==='farm'&&units.every(u=>u.type!=='worker')&&t.owner===ME)){
    cmdTarget(units,t);marker={x:wx,y:wy,t:1,c:t.owner>=0&&t.owner!==ME?'#ff8a7a':'#e9be72'};
    // spread workers across multiple farms or trees
  }else{for(const u of units)u.wq=[];cmdMove(units,wx,wy,aMode);marker={x:wx,y:wy,t:1,c:aMode?'#ff8a7a':'#9ef0a0'}}
  aMode=false;uiDirty=true;
}
let wallDrag=null;
// tiles of a wall line: straight or diagonal steps from a to b
function wallLine(ax,ay,bx,by){const out=[],n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let i=0;i<=n;i++){const t=n?i/n:0;out.push([Math.round(ax+(bx-ax)*t),Math.round(ay+(by-ay)*t)])}
  // close diagonal gaps so units cannot slip through
  const res=[];for(let i=0;i<out.length;i++){if(i&&out[i][0]!==out[i-1][0]&&out[i][1]!==out[i-1][1])res.push([out[i][0],out[i-1][1]]);res.push(out[i])}return res}
function placeLine(tiles,keep){
  const d=BLD[placing];let n=0;const bs=[];
  if(MP&&!CMDX){const ok=tiles.filter(([gx,gy])=>canPlace(ME,placing,gx,gy));
    if(!ok.length){toast(d.water?'Brücken nur auf Wasser, ausgehend vom erkundeten Ufer.':'Hier kann keine Mauer gebaut werden.','warn');return}
    sendCmd('line',{b:placing,tiles:ok});if(!keep){placing=null;uiDirty=true}return}
  for(const [gx,gy] of tiles){if(!canPlace(ME,placing,gx,gy))continue;if(!canAfford(ME,d.cost)){toast('Nicht genug Rohstoffe für die ganze Mauer.','warn');break}
    pay(ME,d.cost);bs.push(placeBld(ME,placing,gx,gy,false));n++}
  if(!n)toast(d.water?'Brücken nur auf Wasser, ausgehend vom erkundeten Ufer.':'Hier kann keine Mauer gebaut werden.','warn');
  const ws=d.water?[]:sel.filter(u=>u.kind==='unit'&&u.type==='worker');
  ws.forEach((u,i)=>{const b=bs[Math.floor(i*bs.length/ws.length)];if(b)order(u,{t:'build',target:b.id})});
  if(!keep||!canAfford(ME,d.cost)){placing=null;uiDirty=true}
}
function tryPlace(wx,wy,keep){
  const d=BLD[placing],gx=CMDX?wx:Math.floor(wx-d.size/2+.5),gy=CMDX?wy:Math.floor(wy-d.size/2+.5);
  if(!canPlace(ME,placing,gx,gy)){toast('Hier kann nicht gebaut werden.','warn');return}
  if(!canAfford(ME,d.cost)){toast('Nicht genug Rohstoffe.','warn');placing=null;uiDirty=true;return}
  if(MP&&!CMDX){sendCmd('place',{b:placing,x:gx,y:gy});if(!keep){placing=null;uiDirty=true}return}
  pay(ME,d.cost);const b=placeBld(ME,placing,gx,gy,false);
  for(const u of sel)if(u.kind==='unit'&&u.type==='worker')order(u,{t:'build',target:b.id});
  if(!keep||!canAfford(ME,d.cost)){placing=null;uiDirty=true}
}

cv.addEventListener('contextmenu',e=>e.preventDefault());
let touch=null,touchHold=0;
cv.addEventListener('pointerdown',e=>{
  if(!started||over)return;
  cv.setPointerCapture(e.pointerId);
  const r=cv.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;mouse.inside=true;
  const w=toWorld(mouse.x,mouse.y);
  if(e.pointerType==='touch'){touch={sx:mouse.x,sy:mouse.y,cx:cam.x,cy:cam.y,moved:false,t:performance.now()};
    clearTimeout(touchHold);touchHold=setTimeout(()=>{if(touch&&!touch.moved){touch=null;drag={sx:mouse.x,sy:mouse.y,box:true,shift:false,touchBox:true};if(navigator.vibrate)try{navigator.vibrate(15)}catch(_){}}},380);
    return}
  if(e.button===1||(freeCam&&e.button===0)){drag={pan:true,sx:mouse.x,sy:mouse.y,cx:cam.x,cy:cam.y};return}
  if(freeCam)return;
  if(e.button===2){shiftHeld=e.shiftKey;if(placing){placing=null;wallDrag=null;uiDirty=true;return}rightCommand(w.x,w.y);return}
  if(e.button===0){
    if(placing&&BLD[placing].line){wallDrag={x:Math.floor(w.x),y:Math.floor(w.y)};return}
    if(placing){tryPlace(w.x,w.y,e.shiftKey);return}
    if(aMode){const u=sel.filter(x=>x.kind==='unit'&&x.owner===ME);if(u.length){const t=pickAt(w.x,w.y);if(MP)sendCmd('ac',{x:w.x,y:w.y,t:t&&t.owner>=0&&t.owner!==ME?t.id:0});else if(t&&t.owner>=0&&t.owner!==ME)cmdTarget(u,t);else cmdMove(u,w.x,w.y,true);marker={x:w.x,y:w.y,t:1,c:'#ff8a7a'}}aMode=false;uiDirty=true;return}
    drag={sx:mouse.x,sy:mouse.y,box:false,shift:e.shiftKey};
  }
});
cv.addEventListener('pointermove',e=>{
  const r=cv.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;mouse.inside=true;
  if(touch){const dx=mouse.x-touch.sx,dy=mouse.y-touch.sy;if(Math.hypot(dx,dy)>8){touch.moved=true;clearTimeout(touchHold)}if(touch.moved){cam.x=touch.cx-dx/cam.z;cam.y=touch.cy-dy/cam.z;clampCam()}return}
  if(drag&&drag.pan){cam.x=drag.cx-(mouse.x-drag.sx)/cam.z;cam.y=drag.cy-(mouse.y-drag.sy)/cam.z;clampCam();return}
  if(drag&&!drag.box&&Math.hypot(mouse.x-drag.sx,mouse.y-drag.sy)>6)drag.box=true;
});
cv.addEventListener('pointerleave',()=>{mouse.inside=false;$('#hoverTip').hidden=true});
// Schwebe-Info über Einheiten und Gebäuden: Name, Besitzer und Werte
let hoverLast=null;
setInterval(()=>{
  const tip=$('#hoverTip');if(!started||!mouse.inside||drag||placing||mouse.pointerType==='touch'){tip.hidden=true;return}
  const w=toWorld(mouse.x,mouse.y),e=pickAt(w.x,w.y);if(!e||e.kind==='res'){tip.hidden=true;hoverLast=null;return}
  const own=e.owner===ME?'Dein Reich':e.owner>=0?(MP?players[e.owner].name:'Gegner'):'',ep=e.owner>=0?players[e.owner].epoch:0;let h='';
  if(e.kind==='unit'){const st=uStat(e),U=UNITS[e.type];
    h=`<b>${uname(U,ep)}</b><span>${own}</span><br>Leben ${Math.ceil(e.hp)}/${e.maxhp||st.hp}`+(st.atk>0?` · Angriff ${Math.round(st.atk)}`:'')+(st.range>1.5?` · Reichweite ${Math.round(st.range)}`:'')+` · Tempo ${st.speed.toFixed(1)}`;}
  else{const D=BLD[e.type];h=`<b>${bname(D,ep)}</b><span>${own}${e.built?'':' · im Bau '+Math.round(e.prog*100)+' %'}</span><br>Leben ${Math.ceil(e.hp)}/${e.maxhp}`+(D.atk?` · Angriff ${D.atk}`:'')+(D.pop?` · Wohnraum +${D.pop}`:'');}
  if(h!==hoverLast){tip.innerHTML=h;hoverLast=h}
  tip.hidden=false;const r=cv.getBoundingClientRect();tip.style.left=Math.min(innerWidth-tip.offsetWidth-8,r.left+mouse.x+16)+'px';tip.style.top=Math.max(4,r.top+mouse.y-tip.offsetHeight-10)+'px';
},120);
cv.addEventListener('pointerup',e=>{
  const r=cv.getBoundingClientRect();mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;
  if(wallDrag&&placing){const w=toWorld(mouse.x,mouse.y);placeLine(wallLine(wallDrag.x,wallDrag.y,Math.floor(w.x),Math.floor(w.y)),e.shiftKey);wallDrag=null;return}
  clearTimeout(touchHold);
  if(touch){
    if(!touch.moved){
      const w=toWorld(mouse.x,mouse.y);
      if(placing){tryPlace(w.x,w.y,false)}
      else{const t=pickAt(w.x,w.y);
        const mine=sel.filter(x=>x.owner===ME);
        const now=performance.now();
        if(t&&t.kind==='unit'&&t.owner===ME&&now-lastClick.t<350&&lastClick.id===t.id){const a=toWorld(0,0),b=toWorld(viewW,viewH);select(ents.filter(u=>u.kind==='unit'&&u.owner===ME&&u.type===t.type&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y))}
        else if(t&&t.owner===ME&&!(mine.length&&mine[0].kind==='unit'&&mine.some(u=>u.type==='worker')&&t.kind==='bld'&&(!t.built||t.type==='farm')))select([t]);
        else if(mine.length)rightCommand(w.x,w.y);
        else select(t?[t]:[]);
        lastClick={t:now,id:t?t.id:0};}
    }
    touch=null;return}
  if(!drag)return;
  if(drag.pan){drag=null;return}
  const add=drag.shift;
  if(drag.box){
    const a=toWorld(Math.min(drag.sx,mouse.x),Math.min(drag.sy,mouse.y)),b=toWorld(Math.max(drag.sx,mouse.x),Math.max(drag.sy,mouse.y));
    const list=ents.filter(u=>u.kind==='unit'&&u.owner===ME&&!u.dead&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y);
    select(list,add);
  }else{
    const w=toWorld(mouse.x,mouse.y),t=pickAt(w.x,w.y);
    const now=performance.now();
    if(t&&t.kind==='unit'&&t.owner===ME&&now-lastClick.t<350&&lastClick.id===t.id){
      const a=toWorld(0,0),b=toWorld(viewW,viewH);
      select(ents.filter(u=>u.kind==='unit'&&u.owner===ME&&u.type===t.type&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y));
    }else if(t)select([t],add&&t.kind==='unit'&&t.owner===ME);
    else if(!add)select([]);
    lastClick={t:now,id:t?t.id:0};
  }
  drag=null;
});
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  // weiches Zoomen: Ziel setzen, die Kamera gleitet im Frame dorthin (Punkt unter der Maus bleibt stehen)
  zoomT=Math.max(.5,Math.min(1.8,(zoomT||cam.z)*(e.deltaY<0?1.12:1/1.12)));zoomAt={x:mouse.x,y:mouse.y};
},{passive:false});

// minimap
let mmDrag=false;
function mmPos(e){const r=mm.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}}
mm.addEventListener('contextmenu',e=>e.preventDefault());
mm.addEventListener('pointerdown',e=>{if(!started)return;const p=mmPos(e);if(e.button===2){rightCommand(p.x,p.y);return}mmDrag=true;mm.setPointerCapture(e.pointerId);centerOn(p.x,p.y)});
mm.addEventListener('pointermove',e=>{if(mmDrag){const p=mmPos(e);centerOn(p.x,p.y)}});
mm.addEventListener('pointerup',()=>{mmDrag=false});

window.addEventListener('keydown',e=>{
  if(!started||over)return;
  if(e.target.tagName==='INPUT')return;
  const k=e.key;
  if(k.startsWith('Arrow')){keys.add(k);e.preventDefault();return}
  if(k==='Escape'&&!$('#techScreen').hidden){toggleTech(false);return}
  if(k==='n'||k==='N'){toggleTech();return}
  if(k==='Escape'&&(!$('#diploPanel').hidden||!$('#savePanel').hidden)){$('#diploPanel').hidden=true;$('#savePanel').hidden=true;return}
  if(k==='Escape'){if(placing||aMode){placing=null;aMode=false;uiDirty=true}else select([]);return}
  if(k==='p'||k==='P'||k==='Pause'){togglePause();return}
  if(paused)return;
  if(e.ctrlKey&&/^[1-9]$/.test(k)){groups[k]=sel.filter(x=>x.kind==='unit'&&x.owner===ME);toast('Gruppe '+k+' gespeichert.');e.preventDefault();return}
  if(/^[1-9]$/.test(k)&&groups[k]){const g=groups[k].filter(alive);if(g.length){if(lastGroup===k&&performance.now()-lastGroupT<400)centerOn(g[0].x,g[0].y);select(g);lastGroup=k;lastGroupT=performance.now()}return}
  if(k==='h'||k==='H'){const tc=ents.find(x=>x.owner===ME&&x.type==='tc');if(tc){select([tc]);centerOn(tc.x+1.5,tc.y+1.5)}return}
  if(k==='.'||k===','){selectIdle();return}
  if(k===' '){if(sel[0]){const c=center(sel[0]);centerOn(c.x,c.y)}e.preventDefault();return}
  if(k==='z'||k==='Z'){toggleFreeCam();return}
  let up=k.toUpperCase();
  const i=SLOTKEYS.indexOf(up);
  if(i>=0&&curCmds[i]){const c=curCmds[i];if(c.need&&c.dis){toast(c.need,'warn');return}if(c.dis){toast('Nicht genug Rohstoffe.','warn');return}sfx('click');runCmd(c)}
});
let lastGroup=null,lastGroupT=0,idleIx=0,zoomT=0,zoomAt=null;const camV={x:0,y:0};
window.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>keys.clear());
function selectIdle(){
  const idle=ents.filter(e=>e.owner===ME&&e.type==='worker'&&e.order.t==='idle');
  if(!idle.length){toast('Keine untätigen Arbeiter.');return}
  const u=idle[idleIx++%idle.length];select([u]);centerOn(u.x,u.y);
}
$('#btnIdle').onclick=selectIdle;
// ---- technology tree overlay
function renderTechTree(){
  const pl=players[ME],cols=$('#techCols');
  const ST={running:'Wird erforscht',open:'Verfügbar',epoch:'Benötigt neue Epoche'};
  // only the next step of every research line, grouped by building
  const next={};
  for(const id in TECHS){const st=techState(ME,id);if(st==='done'||st==='requires'||st==='none')continue;const t=TECHS[id],ln=t.line||id;
    if(!next[ln]||(TECHS[next[ln]].epoch||0)>(t.epoch||0))next[ln]=id}
  const byAt={};for(const ln in next){const id=next[ln];(byAt[TECHS[id].at]=byAt[TECHS[id].at]||[]).push(id)}
  const lines=new Set(Object.values(TECHS).map(t=>t.line).filter(Boolean)),doneN=Object.keys(pl.techs).length;
  const have=t=>ents.some(e=>e.kind==='bld'&&e.owner===ME&&e.type===t&&e.built&&!e.dead);
  cols.innerHTML=Object.keys(byAt).map(at=>`<div class="tcol"><h3>${BLD[at]?(BLD[at].techTitle?BLD[at].techTitle+' · ':'')+BLD[at].name:at}<small>${have(at)?byAt[at].length+' offen':'nicht gebaut'}</small></h3>${byAt[at].map(id=>{const t=TECHS[id];let st=techState(ME,id);
    const all=Object.values(TECHS).filter(x=>t.line&&x.line===t.line).sort((a,b)=>(a.epoch||0)-(b.epoch||0)),stepN=all.indexOf(t)+1;
    const cls=st==='open'&&!have(at)?'nobld':st==='open'&&!canAfford(ME,t.cost||{})?'open short':st;
    const stTxt=st==='epoch'?'ab '+EPOCHS[t.epoch]:st==='running'?'läuft':!have(at)?'Gebäude fehlt':cls==='open short'?'zu teuer':'Verfügbar';
    return `<button class="tk ${cls}" data-id="${id}" ${st==='open'?'':'tabindex="-1"'}><b>${t.name}</b>${all.length?`<span class="lv">Stufe ${stepN}/${all.length}</span>`:''}<span class="ds">${t.desc||''}</span>${all.length>1?`<span class="pips">${all.map((x,i)=>`<i class="${i<stepN-1?'on':i===stepN-1?'cur':''}"></i>`).join('')}</span>`:''}<span class="c">${costHTML(t.cost||{})} · ${t.time||30} s</span><span class="st">${stTxt}</span></button>`}).join('')}</div>`).join('')
    +(Object.keys(byAt).length?'':'<p class="hint">Alles erforscht.</p>');
  $('#techScreen .hint').textContent='Hier siehst du nur, was du als Nächstes erforschen kannst. Ist eine Stufe fertig, erscheint die nächste. Bisher erforscht: '+doneN+'.';
  cols.querySelectorAll('.tk.open').forEach(b=>b.onclick=()=>{
    const id=b.dataset.id,t=TECHS[id];
    const bs=ents.filter(e=>e.kind==='bld'&&e.owner===ME&&e.type===t.at&&e.built&&!e.dead).sort((a,c)=>a.queue.length-c.queue.length);
    if(!bs.length){toast('Dafür brauchst du zuerst: '+(BLD[t.at]?BLD[t.at].name:t.at)+'.','warn');return}
    if(!canAfford(ME,t.cost)){toast('Nicht genug Rohstoffe.','warn');return}
    if(MP)sendCmd('tech',{id});else queueTech(bs[0],id);toast('Forschung gestartet: '+t.name+'.','good');renderTechTree();uiDirty=true;
  });
}
function toggleTech(show){const el=$('#techScreen');el.hidden=show===undefined?!el.hidden:!show;if(!el.hidden)renderTechTree()}
$('#btnTech').onclick=()=>{if(started&&!over)toggleTech()};
$('#techClose').onclick=()=>toggleTech(false);
$('#btnBuild').onclick=()=>{
  if(!started||over)return;
  if(sel.some(u=>u.type==='worker'&&u.owner===ME)){select(sel.filter(u=>u.type==='worker'));return}
  const ws=ents.filter(e=>e.owner===ME&&e.type==='worker'&&!e.dead);
  if(!ws.length){toast('Du hast keine Arbeiter. Bilde im Stadtzentrum welche aus.','warn');return}
  const u=ws.find(w=>w.order.t==='idle')||ws[0];select([u]);centerOn(u.x,u.y);
  toast('Wähle unten rechts ein Gebäude und tippe dann auf die Karte.');
};
function togglePause(){if(MP){if(XY.net)XY.net.pause(!paused);return}paused=!paused;$('#btnPause').textContent=paused?'Weiter':'Pause'}
$('#btnPause').onclick=()=>{if(started&&!over)togglePause()};
// Diplomatie (wie AoE2): Tribut in einer Wahl-Ressource oder Waffenstillstand gegen Gold
const RESN={food:'Nahrung',wood:'Holz',stone:'Stein',gold:'Gold'};
function diploRender(){
  if($('#diploPanel').hidden)return;const n=aiS.tributes||0,amt=Math.round(100*Math.pow(1.4,n)),pl=players[0];
  const peace=aiS.peaceUntil>gameT;
  $('#diploState').textContent=peace?'Waffenstillstand noch '+fmtTime(aiS.peaceUntil-gameT)+'.':aiS.attacking?'Der Gegner greift gerade an.':'Nächster Angriff frühestens in '+fmtTime(Math.max(0,aiS.nextAttack-gameT))+'.';
  $('#diploTrib').innerHTML=['food','wood','stone','gold'].map(r=>`<button class="tbtn" data-trib="${r}"${pl.res[r]<amt?' disabled':''}>${amt} ${RESN[r]}</button>`).join('');
  const pc=Math.round(400*Math.pow(1.6,aiS.peaces||0));$('#diploPeace').textContent='Waffenstillstand für '+pc+' Gold';$('#diploPeace').disabled=peace||pl.res.gold<pc;$('#diploWar').hidden=!peace;$('#diploPeace').hidden=peace;
  $('#diploMarry').textContent='Heiratsvertrag anbieten (1000 Gold, dauerhafter Frieden)';$('#diploMarry').hidden=!!aiS.married;$('#diploMarry').disabled=pl.res.gold<1000||pl.epoch<1;$('#diploWar').textContent=aiS.married?'Heiratsvertrag brechen (Beliebtheit fällt auf 0)':'Waffenstillstand brechen (Kriegserklärung)';
  $('#diploAlly').textContent=aiS.allied?'Bündnis aufkündigen':'Bündnis schließen (800 Gold: gemeinsame Sicht, keine Angriffe)';$('#diploAlly').disabled=!aiS.allied&&pl.res.gold<800;
  if(aiS.allied)$('#diploState').textContent='Verbündet: gemeinsame Sicht, kein Angriff aufeinander möglich.';else if(aiS.married)$('#diploState').textContent='Durch Heirat verbunden. Kein Krieg, solange der Vertrag hält.';
}
function payTribute(r){
  const pl=players[0],n=aiS.tributes||0,amt=Math.round(100*Math.pow(1.4,n));
  if(aiS.attacking){toast('Zu spät, die feindliche Armee ist schon unterwegs.','warn');return}
  if(pl.res[r]<amt)return;pl.res[r]-=amt;players[1].res[r]+=amt;aiS.tributes=n+1;aiS.nextAttack=Math.max(aiS.nextAttack,gameT)+60;
  toast('Tribut gezahlt ('+amt+' '+RESN[r]+'). Der Gegner hält eine Minute still.','good');sfx('good');diploRender();
}
$('#diploTrib').onclick=e=>{const b=e.target.closest('[data-trib]');if(b)payTribute(b.dataset.trib)};
$('#diploPeace').onclick=()=>{const pl=players[0],pc=Math.round(400*Math.pow(1.6,aiS.peaces||0));if(pl.res.gold<pc||aiS.peaceUntil>gameT)return;
  pl.res.gold-=pc;players[1].res.gold+=pc;aiS.peaces=(aiS.peaces||0)+1;aiS.peaceUntil=gameT+180;aiS.nextAttack=Math.max(aiS.nextAttack,aiS.peaceUntil);
  if(aiS.attacking){aiS.attacking=false;for(const e of ents)if(!e.dead&&e.owner===1&&isMil(e)){e.waveAt=null;order(e,{t:'idle'})}}
  toast('Waffenstillstand für drei Minuten geschlossen.','good');sfx('good');diploRender()};
$('#diploMarry').onclick=()=>{const pl=players[0];if(pl.res.gold<1000||aiS.married)return;pl.res.gold-=1000;players[1].res.gold+=500;aiS.married=true;aiS.peaceUntil=1e9;aiS.nextAttack=1e9;
  if(aiS.attacking){aiS.attacking=false;for(const e of ents)if(!e.dead&&e.owner===1&&isMil(e)){e.waveAt=null;order(e,{t:'idle'})}}
  toast('Hochzeit! Beide Häuser sind nun verbunden und führen keinen Krieg mehr gegeneinander.','good');sfx('epoch');diploRender()};
$('#diploAlly').onclick=()=>{const pl=players[0];if(aiS.allied){aiS.allied=false;players[0].ally=players[1].ally=undefined;aiS.peaceUntil=gameT+60;aiS.nextAttack=gameT+60;toast('Bündnis aufgekündigt. In einer Minute herrscht wieder Krieg.','warn');diploRender();return}
  if(pl.res.gold<800)return;pl.res.gold-=800;players[1].res.gold+=400;aiS.allied=true;players[0].ally=1;players[1].ally=0;aiS.peaceUntil=1e9;aiS.nextAttack=1e9;
  if(aiS.attacking){aiS.attacking=false}for(const e of ents)if(!e.dead&&e.kind==='unit'&&e.order&&e.order.t==='attack'){const t=ents.find(x=>x.id===e.order.target);if(t&&t.owner!==e.owner&&t.owner>=0){e.waveAt=null;order(e,{t:'idle'})}}
  toast('Bündnis geschlossen! Ihr teilt die Sicht und kämpft nicht mehr gegeneinander.','good');sfx('epoch');diploRender()};
$('#diploWar').onclick=()=>{if(!(aiS.peaceUntil>gameT))return;const wasM=aiS.married;aiS.married=false;aiS.peaceUntil=0;aiS.nextAttack=wasM?gameT:gameT+20;if(wasM){aiS.wave=(aiS.wave||4)+4;players[1].res.gold+=600;players[1].res.food+=600}
  for(const pl of players)if(pl.mood!=null&&pl.i===0)pl.mood=wasM?0:Math.max(0,pl.mood-10);
  toast('Du hast den Krieg erklärt. Der Gegner rüstet sich zum Gegenschlag.','warn');sfx('warn');diploRender()};
$('#btnTribute').onclick=()=>{if(!started||over)return;$('#savePanel').hidden=true;$('#diploPanel').hidden=!$('#diploPanel').hidden;diploRender()};
setInterval(diploRender,1000);
$('#btnSound').textContent=soundOn?'Ton an':'Ton aus';$('#btnSound').onclick=()=>{soundOn=!soundOn;try{localStorage.setItem('empire-xy.ton',soundOn?'1':'0')}catch(e){}$('#btnSound').textContent=soundOn?'Ton an':'Ton aus';sfx('click')};

// ================= Mehrspieler: Befehle im Gleichschritt (Lockstep) =================
// Im Mehrspieler ändert ein Klick den Spielstand nicht sofort. Er wird als Befehl an den Gastgeber geschickt,
// der ihn für einen bestimmten Takt einplant. Alle Rechner führen dieselben Befehle im selben Takt aus.
function runCmd(c){if(MP&&!c.ui&&!CMDX){sendCmd('cmd',{key:c.key});return}c.act()}
function sendCmd(k,a){if(!XY.net)return;XY.net.command({k,s:sel.filter(e=>e.owner===ME).map(e=>e.id),a:a||{}})}
const EXEC={
  cmd(a){const c=getCommands().find(c=>c&&c.key===a.key);if(c&&!c.ui&&!c.dis)c.act()},
  rc(a){shiftHeld=!!a.sh;aMode=!!a.am;rightCommand(+a.x,+a.y,a.t|0)},
  ac(a){const u=sel.filter(x=>x.kind==='unit');if(!u.length)return;const t=a.t&&alive(byId.get(a.t))?byId.get(a.t):null;
    if(t&&t.owner>=0&&t.owner!==ME)cmdTarget(u,t);else cmdMove(u,+a.x,+a.y,true)},
  place(a){if(!BLD[a.b])return;placing=a.b;tryPlace(a.x|0,a.y|0,true)},
  line(a){if(!BLD[a.b]||!BLD[a.b].line||!Array.isArray(a.tiles))return;placing=a.b;placeLine(a.tiles.slice(0,200).map(t=>[t[0]|0,t[1]|0]),true)},
  cq(a){const b=byId.get(a.b);if(alive(b)&&b.owner===ME)cancelQ(b,a.i|0)},
  prio(a){const b=byId.get(a.b);if(alive(b)&&b.owner===ME&&[2,1,.5].includes(a.v))b.prio=a.v},
  tech(a){const t=TECHS[a.id];if(!t)return;const bs=ents.filter(e=>e.kind==='bld'&&e.owner===ME&&e.type===t.at&&e.built&&!e.dead).sort((x,y)=>x.queue.length-y.queue.length);if(bs.length)queueTech(bs[0],a.id)},
  trib(a){const to=players[a.to],pl=players[ME],r=a.r,n=Math.min(a.n|0,500);if(!to||to===pl||to.defeated||!RES.includes(r)||n<=0||pl.res[r]<n)return;
    pl.res[r]-=n;to.res[r]+=n;if(to.i===LOCAL){ME=LOCAL;toast(pl.name+' schickt dir '+n+' '+RESN[r]+'.','good')}},
  leave(){players[ME].left=true}, // Spieler hat das Spiel verlassen: scheidet beim nächsten Prüfen aus
};
// führt einen Befehl von Spieler p aus (auf allen Rechnern im selben Takt, daher nur vom Spielstand abhängig)
function execCmd(p,c){
  if(!players[p]||players[p].defeated&&c.k!=='leave'||!EXEC[c.k])return;
  const sv={ME,sel,shiftHeld,aMode,placing,marker,buildCat};
  ME=p;CMDX=true;sel=(Array.isArray(c.s)?c.s:[]).map(id=>byId.get(id)).filter(e=>e&&!e.dead&&e.owner===p);
  const mr=Math.random;Math.random=rng;
  try{EXEC[c.k](c.a||{})}catch(err){console.warn('Befehl',c,err)}
  finally{Math.random=mr;ME=sv.ME;CMDX=false;sel=sv.sel.filter(e=>!e.dead);shiftHeld=sv.shiftHeld;aMode=sv.aMode;placing=sv.placing;if(p!==LOCAL)marker=sv.marker;buildCat=sv.buildCat;uiDirty=true}
}
// Prüfsumme des Spielstands, um auseinanderlaufende Spiele (Desync) zu erkennen
function stateHash(){let h=2166136261;const mix=v=>{h=Math.imul(h^(v|0),16777619)};
  mix(nextId);mix(Math.round(gameT*30));for(const pl of players){for(const r of RES)mix(Math.round(pl.res[r]*10));mix(pl.epoch)}
  for(const e of ents){if(e.dead)continue;mix(e.id);mix(Math.round(e.x*1000));mix(Math.round(e.y*1000));mix(Math.round(e.hp*100))}
  return h>>>0}
let spectating=false;
// Schnittstelle für den Baustein kern-multiplayer
XY.mp={
  DT,
  start(cfg){$('#startScreen').hidden=true;$('#endScreen').hidden=true;resize();spectating=false;newGame(1,cfg.seed,cfg);started=true;paused=false;over=false;$('#btnPause').textContent='Pause';mpUi()},
  step(){const mr=Math.random;Math.random=rng;try{step(DT)}finally{Math.random=mr}},
  exec:execCmd,hash:stateHash,cmd:(k,a)=>sendCmd(k,a),
  get running(){return started&&!over},get time(){return gameT},get me(){return LOCAL},
  get players(){return players||[]},PCOL,CIVS:()=>CIVS,
  setPaused(on){paused=!!on;$('#btnPause').textContent=paused?'Weiter':'Pause'},
  toast(m,k){toast(m,k)},
  quit(){MP=null;ME=LOCAL=0;started=false;over=false;paused=false;$('#endScreen').hidden=true;$('#startScreen').hidden=false;mpUi();showContinue()},
  end(text){if(started&&!over)endGame(false,text)},
};
function mpUi(){const mp=!!MP;$('#btnTribute').hidden=mp;$('#btnSave').hidden=mp;document.querySelectorAll('[data-speed]').forEach(b=>b.disabled=mp);if(mp){gameSpeed=1;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('on',b.dataset.speed==='1'))}}

// ================= main loop =================
let last=performance.now(),acc=0;
let gameSpeed=1;
document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{gameSpeed=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(x=>x.classList.toggle('on',x===b))});
window.__speed=()=>gameSpeed;
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(MP&&started&&(!over||spectating)){if(XY.net)XY.net.advance(dt)}
  else if(started&&!paused&&!over){
    acc+=dt*gameSpeed;let n=0,mx=5*Math.max(1,gameSpeed);while(acc>=DT&&n<mx){step(DT);acc-=DT;n++}if(n>=mx)acc=0;
  }
  if(started){
    // scrolling
    // weiches Scrollen: Kamera beschleunigt und bremst statt ruckartig zu springen
    let ix=0,iy=0;
    if(keys.has('ArrowLeft'))ix--;if(keys.has('ArrowRight'))ix++;if(keys.has('ArrowUp'))iy--;if(keys.has('ArrowDown'))iy++;
    if(mouse.inside&&!drag&&!touch&&matchMedia('(pointer:fine)').matches){const m=12;if(mouse.x<m)ix--;if(mouse.x>viewW-m)ix++;if(mouse.y<m)iy--;if(mouse.y>viewH-m)iy++}
    const il=Math.hypot(ix,iy)||1,top=760/cam.z,k=Math.min(1,dt*(ix||iy?9:12));
    camV.x+=(ix/il*top-camV.x)*k;camV.y+=(iy/il*top-camV.y)*k;cam.x+=camV.x*dt;cam.y+=camV.y*dt;
    if(zoomT&&Math.abs(zoomT-cam.z)>.0005){const a=zoomAt||{x:viewW/2,y:viewH/2},before=toWorld(a.x,a.y);cam.z+=(zoomT-cam.z)*Math.min(1,dt*14);cam.x=before.x*T-a.x/cam.z;cam.y=before.y*T-a.y/cam.z}
    clampCam();
    if(marker)marker.t-=dt*1.5;
    saveT+=dt;if(saveT>30&&!paused&&SET.auto){saveT=0;saveGame()}
    if(!paused){for(const v of vfx){v.t+=dt;v.x+=v.vx*dt;v.y+=v.vy*dt;if(v.k==='chip'||v.k==='debris')v.vy+=4*dt;else if(v.k==='bsmoke'){v.vx*=1-.2*dt;v.vy*=1-.15*dt}}vfx=vfx.filter(v=>v.t<(v.k==='smoke2'?3:v.k==='bsmoke'?4:v.k==='ember'?1.2:v.k==='debris'?.9:v.k==='trail'?1:v.k==='chip'?.6:.8))}
    const key=selKey();
    if(key!==uiKey||uiDirty){uiKey=key;uiDirty=false;buildInfo();buildCmds();hideTip()}
    uiT-=dt;if(uiT<=0){uiT=.2;refreshInfo();refreshCmds()}
    updateTop();
    cv.style.cursor=placing?'copy':aMode?'crosshair':'default';
  }
  render();renderMini();
  requestAnimationFrame(frame);
}

// ================= start screen =================
// ================= autosave =================
let curSeed=0,saveT=0;const SAVE_KEY='empire-xy.spielstand';
function saveGame(key){
  if(!started||over||!ents||MP)return false;key=typeof key==='string'?key:SAVE_KEY;
  try{
    const data={v:1,seed:curSeed,diff,epStart,epEnd,timeLimit,WX,gameT,nextId,bases,aiS,players,terr:Array.from(terr),exp:Array.from(exp),
      ents:ents.filter(e=>!e.dead),cam:{x:cam.x,y:cam.y,z:cam.z},saved:Date.now()};
    XY.emit('save',data);
    if(key==='__file'){return JSON.stringify(data)}
    localStorage.setItem(key,JSON.stringify(data));return true;
  }catch(e){return false}
}
function readSave(key){try{const d=JSON.parse(localStorage.getItem(key||SAVE_KEY));return d&&d.v===1?d:null}catch(e){return null}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch(e){}}
function loadGame(d){
  syncRegistry();rng=mulberry32(d.seed);curSeed=d.seed;diff=d.diff;epStart=d.epStart||0;epEnd=d.epEnd!==undefined?d.epEnd:99;timeLimit=d.timeLimit||0;if(d.WX)WX=d.WX;
  terr=Uint8Array.from(d.terr);exp=Uint8Array.from(d.exp);vis=new Uint8Array(W*H);block=new Int32Array(W*H);gate=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)if(terr[i]===1||terr[i]===3)block[i]=-1;
  ents=d.ents.filter(e=>e.kind==='res'?RESDEF[e.type]:e.kind==='unit'?UNITS[e.type]:BLD[e.type]);byId=new Map();
  for(const e of ents){byId.set(e.id,e);
    if(e.kind==='res')block[idx(e.x,e.y)]=e.id;
    else if(e.kind==='bld'&&!BLD[e.type].walk)for(let y=e.y;y<e.y+e.size;y++)for(let x=e.x;x<e.x+e.size;x++){block[idx(x,y)]=e.id;if(BLD[e.type].gate)gate[idx(x,y)]=e.owner+1}
    if(e.kind==='bld'&&BLD[e.type].water&&e.built)block[idx(e.x,e.y)]=0;
    if(e.kind==='unit')e.path=null;
    if(e.kind==='bld')e.queue=e.queue.filter(q=>q.ep||(q.tech&&TECHS[q.tech])||(q.u&&UNITS[q.u]));}
  nextId=d.nextId;bases=d.bases;aiS=d.aiS;players=d.players;gameT=d.gameT;
  proj=[];fx=[];sel=[];over=false;placing=null;aMode=false;groups={};
  renderTerrain();recalcPop();updateVis(true);
  if(d.cam){zoomT=0;cam.z=d.cam.z;cam.x=d.cam.x;cam.y=d.cam.y;clampCam()}
  XY.emit('load',API,d);
  toast('Spielstand geladen ('+fmtTime(gameT)+').','good');
}
function showContinue(){const d=readSave(),b=$('#continueBtn');b.hidden=!d;if(d)b.textContent='Weiterspielen ('+fmtTime(d.gameT)+', '+EPOCHS_NAME(d)+')';
  const ls=[1,2,3].map(i=>[i,readSave(slotKey(i))]);$('#loadRow').hidden=!ls.some(x=>x[1]);
  $('#loadSlots').innerHTML=ls.map(([i,d])=>`<button class="opt" data-load="${i}"${d?'':' disabled'}>Platz ${i}${d?' · '+fmtTime(d.gameT)+', '+EPOCHS_NAME(d):' · leer'}</button>`).join('')}
// Drei manuelle Speicherplätze neben dem Auto-Save
const slotKey=i=>SAVE_KEY+'.platz'+i;
function slotLabel(i){const d=readSave(slotKey(i));if(!d)return 'Platz '+i+': leer';const t=new Date(d.saved||0);return 'Platz '+i+': '+fmtTime(d.gameT)+', '+EPOCHS_NAME(d)+' · gespeichert '+t.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
function renderSaveSlots(){$('#saveSlots').innerHTML=[1,2,3].map(i=>`<button class="tbtn" data-slot="${i}">${slotLabel(i)}</button>`).join('')}
$('#btnSave').onclick=()=>{if(!started||over)return;const p=$('#savePanel');p.hidden=!p.hidden;$('#diploPanel').hidden=true;if(!p.hidden)renderSaveSlots()};
$('#saveSlots').onclick=e=>{const b=e.target.closest('[data-slot]');if(!b)return;
  if(saveGame(slotKey(+b.dataset.slot))){toast('Gespeichert auf Platz '+b.dataset.slot+'.','good');sfx('good')}else toast('Speichern nicht möglich, der Browser-Speicher ist voll oder gesperrt.','warn');renderSaveSlots()};
$('#loadSlots').onclick=e=>{const b=e.target.closest('[data-load]');if(!b)return;const d=readSave(slotKey(+b.dataset.load));if(!d)return;
  $('#startScreen').hidden=true;resize();try{loadGame(d);started=true;paused=false;$('#btnPause').textContent='Pause'}catch(err){toast('Dieser Spielstand konnte nicht geladen werden.','warn');$('#startScreen').hidden=false;showContinue()}};
$('#btnExport').onclick=()=>{const txt=saveGame('__file');if(!txt){toast('Speichern ist gerade nicht möglich.','warn');return}
  const fn='empire-xy-'+fmtTime(gameT).replace(':','-')+'.json';
  const dlP=window.claude&&window.claude.use?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
  dlP.then(dl=>{if(dl){dl.save({filename:fn,data:txt}).then(()=>toast('Spielstand als Datei gespeichert.','good'),e=>{if(!e||e.code!=='declined')toast('Die Datei konnte nicht gespeichert werden.','warn')});return}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/json'}));a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);toast('Spielstand als Datei gespeichert.','good')}catch(e){toast('Die Datei konnte nicht gespeichert werden.','warn')}})};
$('#btnImport').onclick=()=>$('#fileImport').click();
$('#fileImport').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{let d=null;try{d=JSON.parse(r.result)}catch(err){}
  if(!d||d.v!==1){toast('Das ist keine gültige Spielstand-Datei.','warn');return}
  $('#savePanel').hidden=true;$('#startScreen').hidden=true;resize();try{loadGame(d);started=true;paused=false;$('#btnPause').textContent='Pause';toast('Spielstand aus Datei geladen.','good')}catch(err){toast('Diese Datei konnte nicht geladen werden.','warn')}};r.readAsText(f);e.target.value=''};
const EPOCHS_NAME=d=>{if(!XY.epochs.length)XY.build();const e=XY.epochs[d.players[ME].epoch];return e?e.name:''};
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame()});
window.addEventListener('beforeunload',saveGame);
const CIVS={
  roemer:{name:'Römer',bonus:'+20 % Leben für Fußtruppen und Gebäude',apply:f=>{f.hp.infantry=(f.hp.infantry||0)+.2;f.bldHp+=.2}},
  mongolen:{name:'Mongolen',bonus:'+20 % Tempo für Reiter',apply:f=>{f.speed.cavalry=(f.speed.cavalry||0)+.2}},
  azteken:{name:'Azteken',bonus:'+20 % Nahrung beim Sammeln',apply:f=>{f.gather.food=(f.gather.food||0)+.2}},
  germanen:{name:'Germanen',bonus:'+20 % Holz beim Fällen',apply:f=>{f.gather.wood=(f.gather.wood||0)+.2}},
  aegypter:{name:'Ägypter',bonus:'+20 % Stein und Gold',apply:f=>{f.gather.stone=(f.gather.stone||0)+.2;f.gather.gold=(f.gather.gold||0)+.2}},
};
let chosenCiv='roemer';
let chosenDiff=1,seed=(Math.random()*99999)|0;
// Start- und Endepoche wählen
function fillEpochSelects(){
  if(!XY.epochs.length)XY.build();const names=XY.epochs.map(e=>e.name),a=$('#epStartSel'),b=$('#epEndSel');
  const opts=sel=>names.map((n,i)=>`<option value="${i}"${i===sel?' selected':''}>${n}</option>`).join('');
  let st=0,en=names.length-1;try{const v=JSON.parse(localStorage.getItem('empire-xy.epochen')||'null');if(v){st=Math.min(v[0],en);en=Math.min(v[1],names.length-1)}}catch(e){}
  a.innerHTML=opts(st);b.innerHTML=opts(en);
  const sync=()=>{let x=+a.value,y=+b.value;if(y<x){y=x;b.value=y}epStart=x;epEnd=y;
    $('#startScreen .ages').innerHTML=names.map((n,i)=>`<span${i<x||i>y?' class="off"':''}>${n}</span>`).join('');
    try{localStorage.setItem('empire-xy.epochen',JSON.stringify([x,y]))}catch(e){}};
  a.onchange=b.onchange=sync;sync();
}
fillEpochSelects();
$('#seedN').textContent=seed;
document.querySelectorAll('[data-diff]').forEach(b=>b.onclick=()=>{chosenDiff=+b.dataset.diff;document.querySelectorAll('[data-diff]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'))});
$('#reroll').onclick=()=>{seed=(Math.random()*99999)|0;$('#seedN').textContent=seed};
$('#continueBtn').onclick=()=>{
  const d=readSave();if(!d)return;$('#startScreen').hidden=true;resize();
  try{loadGame(d);started=true;paused=false;$('#btnPause').textContent='Pause'}catch(e){clearSave();toast('Der Spielstand konnte nicht geladen werden.','warn');$('#startScreen').hidden=false;showContinue()}
};
try{const v=localStorage.getItem('empire-xy.limit');if(v)$('#limitSel').value=v}catch(e){}
try{const v=localStorage.getItem('empire-xy.volk');if(v&&CIVS[v])chosenCiv=v}catch(e){}
$('#civSel').innerHTML=Object.entries(CIVS).map(([k,c])=>`<option value="${k}"${k===chosenCiv?' selected':''}>${c.name}: ${c.bonus}</option>`).join('');
$('#civSel').onchange=()=>{chosenCiv=$('#civSel').value;try{localStorage.setItem('empire-xy.volk',chosenCiv)}catch(e){}};
$('#limitSel').onchange=()=>{try{localStorage.setItem('empire-xy.limit',$('#limitSel').value)}catch(e){}};
// ===== Karteneditor =====
(function(){
  const cv=$('#edCanvas'),g=cv.getContext('2d'),S=720/W;let M=null,tool='grass',down=false;
  const TOOLS=[['grass','Gras'],['water','Wasser'],['mount','Gebirge'],['forest','Wald'],['desert','Wüste'],['stone','Stein'],['gold','Gold'],['berry','Beeren'],['erase','Radierer'],['s0','Start 1 (du)'],['s1','Start 2 (KI)']];
  const blank=()=>({v:1,w:W,h:H,terr:new Array(W*H).fill(0),res:[],starts:[[9,H-12],[W-12,9]]});
  function fromGame(){return blank()}
  function draw(){const C={0:'#5e8a3c',1:'#3d6e9c',2:'#c9b98a',3:'#7a746a',4:'#dcc48a'};
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){g.fillStyle=C[M.terr[y*W+x]]||C[0];g.fillRect(x*S,y*S,S,S)}
    for(const [t,x,y] of M.res){g.fillStyle={tree:'#24502a',stone:'#b8b8b0',gold:'#e9c54a',berry:'#c0405a'}[t]||'#fff';g.fillRect(x*S+1,y*S+1,S-2,S-2)}
    M.starts.forEach(([x,y],i)=>{g.fillStyle=i?'#d94a3a':'#3a7bd9';g.fillRect(x*S,y*S,4*S,4*S);g.fillStyle='#fff';g.font='bold 18px sans-serif';g.fillText(String(i+1),x*S+S*1.4,y*S+S*2.7)})}
  function paint(e){const r=cv.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*W),y=Math.floor((e.clientY-r.top)/r.height*H);if(x<0||y<0||x>=W||y>=H)return;
    const brush=['grass','water','mount','desert','erase'].includes(tool)?1:0;
    for(let oy=-brush;oy<=brush;oy++)for(let ox=-brush;ox<=brush;ox++){const xx=x+ox,yy=y+oy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const i=yy*W+xx;
      const T2={grass:0,water:1,mount:3,desert:4}[tool];
      if(T2!=null){M.terr[i]=T2;if(T2===1||T2===3)M.res=M.res.filter(r=>r[1]!==xx||r[2]!==yy)}
      if(tool==='erase'){M.res=M.res.filter(r=>r[1]!==xx||r[2]!==yy);M.terr[i]=0}}
    const RT={forest:'tree',stone:'stone',gold:'gold',berry:'berry'}[tool];
    if(RT&&M.terr[y*W+x]!==1&&M.terr[y*W+x]!==3&&!M.res.some(r=>r[1]===x&&r[2]===y))M.res.push([RT,x,y]);
    if(tool==='s0'||tool==='s1'){M.starts[tool==='s0'?0:1]=[Math.min(W-6,Math.max(2,x-1)),Math.min(H-6,Math.max(2,y-1))]}
    draw()}
  $('#edTools').innerHTML=TOOLS.map(([k,l])=>`<button class="tbtn" data-tool="${k}">${l}</button>`).join('');
  const mark=()=>$('#edTools').querySelectorAll('button').forEach(b=>b.style.outline=b.dataset.tool===tool?'2px solid #e9be72':'');
  $('#edTools').onclick=e=>{const b=e.target.closest('[data-tool]');if(b){tool=b.dataset.tool;mark()}};
  cv.addEventListener('pointerdown',e=>{down=true;cv.setPointerCapture(e.pointerId);paint(e)});cv.addEventListener('pointermove',e=>{if(down&&!['s0','s1'].includes(tool))paint(e)});cv.addEventListener('pointerup',()=>down=false);
  const custRow=()=>{$('#customRow').hidden=!CUSTOM_MAP;if(CUSTOM_MAP)$('#useCustom').checked=true};custRow();
  $('#editBtn').onclick=()=>{M=CUSTOM_MAP?JSON.parse(JSON.stringify(CUSTOM_MAP)):fromGame();$('#startScreen').hidden=true;$('#editScreen').hidden=false;$('#editScreen').style.display='flex';mark();draw()};
  $('#edNew').onclick=()=>{M=blank();draw()};
  $('#edDone').onclick=()=>{CUSTOM_MAP=M;try{localStorage.setItem('empire-xy.karte',JSON.stringify(M))}catch(e){}$('#editScreen').hidden=true;$('#editScreen').style.display='';$('#startScreen').hidden=false;custRow()};
  $('#edSave').onclick=()=>{const txt=JSON.stringify(M),fn='empire-xy-karte.json';const p=window.claude&&window.claude.use?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
    p.then(dl=>{if(dl){dl.save({filename:fn,data:txt}).catch(()=>{});return}const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'application/json'}));a.download=fn;document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),1000)})};
  $('#edLoad').onclick=()=>$('#edFile').click();
  $('#edFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(d&&d.terr&&d.terr.length===W*H&&d.starts){M=d;draw()}}catch(err){}};r.readAsText(f);e.target.value=''};
})();
let freeCam=false;
function toggleFreeCam(){freeCam=!freeCam;if(freeCam){select([]);placing=null;aMode=false}$('#camLbl').hidden=!freeCam;$('#btnCam').classList.toggle('on',freeCam);toast(freeCam?'Freie Kamera: ziehen zum Schwenken, Mausrad zum Zoomen, Z beendet.':'Freie Kamera aus.')}
$('#btnCam').onclick=()=>{if(started)toggleFreeCam()};
window.__freeCam=()=>freeCam;
$('#verLink').onclick=()=>{const c=$('#credits');c.hidden=false;const r=c.querySelector('.roll');r.style.animation='none';void r.offsetWidth;r.style.animation=''};
$('#credits').onclick=()=>{$('#credits').hidden=true};
// Handelsrouten-Übersicht
let tradeOpen=false;
$('#btnTrade').onclick=()=>{tradeOpen=!tradeOpen;$('#tradePanel').hidden=!tradeOpen;if(tradeOpen)drawTrade()};
$('#tradeClose').onclick=()=>{tradeOpen=false;$('#tradePanel').hidden=true};
function drawTrade(){if(!tradeOpen)return;const c=$('#tradeCv'),g=c.getContext('2d'),S=c.width;g.clearRect(0,0,S,S);g.drawImage($('#minimap'),0,0,S,S);
  const sc=S/W,routes=new Map();
  for(const u of ents){if(u.dead||u.type!=='caravan'||!u.home||!u.dest)continue;if(u.owner!==ME&&!visibleEnt(u))continue;const a=byId.get(u.home),b=byId.get(u.dest);if(!a||!b||a.dead||b.dead)continue;const k=a.id+'-'+b.id;if(!routes.has(k))routes.set(k,{a:center(a),b:center(b),o:u.owner,n:0});routes.get(k).n++}
  let i=0;for(const r of routes.values()){const col=r.o===0?'#5fb0ff':'#ff6a5a';g.strokeStyle=col;g.lineWidth=2+Math.min(3,r.n);g.setLineDash([8,6]);g.lineDashOffset=-(performance.now()/40)%14;
    g.beginPath();g.moveTo(r.a.x*sc,r.a.y*sc);g.lineTo(r.b.x*sc,r.b.y*sc);g.stroke();g.setLineDash([]);const an=Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x),bx=r.b.x*sc,by=r.b.y*sc;
    g.fillStyle=col;g.beginPath();g.moveTo(bx,by);g.lineTo(bx-12*Math.cos(an-.4),by-12*Math.sin(an-.4));g.lineTo(bx-12*Math.cos(an+.4),by-12*Math.sin(an+.4));g.fill();i++}
  $('#tradeInfo').textContent=i?i+' aktive Handelsroute'+(i>1?'n':'')+'. Blau: deine, Rot: gegnerische.':'Keine aktiven Handelsrouten. Karawanen per Rechtsklick auf einen zweiten Markt schicken.';
  requestAnimationFrame(drawTrade)}
$('#startBtn').onclick=()=>{timeLimit=+$('#limitSel').value;epStart=+$('#epStartSel').value;epEnd=+$('#epEndSel').value;chosenCiv=$('#civSel').value||chosenCiv;useCustomMap=!!(CUSTOM_MAP&&$('#useCustom').checked);
  $('#startScreen').hidden=true;resize();newGame(chosenDiff,seed);started=true;paused=false;$('#btnPause').textContent='Pause';
};
{// Einstellungen: im Spiel und im Hauptmenü erreichbar, gespeichert im Browser
  const sv=()=>{try{localStorage.setItem('empire-xy.set',JSON.stringify(SET))}catch(e){}};let wasP=false;
  const open=()=>{$('#setSound').checked=soundOn;$('#setVol').value=Math.round(SET.vol*100);$('#setVolN').textContent=Math.round(SET.vol*100)+' %';$('#setQ').value=SET.q;$('#setAuto').checked=!!SET.auto;$('#setVox').checked=SET.vox!==0;
    $('#setMenu').hidden=!started||over;wasP=paused;if(started)paused=true;$('#setPanel').hidden=false};
  const close=()=>{$('#setPanel').hidden=true;if(started)paused=wasP};
  $('#btnSet').onclick=open;$('#setBtn2').onclick=open;$('#setClose').onclick=close;
  $('#setSound').onchange=e=>{soundOn=e.target.checked;try{localStorage.setItem('empire-xy.ton',soundOn?'1':'0')}catch(_){}const b=$('#btnSound');if(b)b.textContent=soundOn?'Ton an':'Ton aus'};
  $('#setVol').oninput=e=>{SET.vol=e.target.value/100;$('#setVolN').textContent=e.target.value+' %';sv()};
  $('#setQ').onchange=e=>{SET.q=+e.target.value;sv()};$('#setAuto').onchange=e=>{SET.auto=e.target.checked?1:0;sv()};$('#setVox').onchange=e=>{SET.vox=e.target.checked?1:0;sv()};
  $('#setMenu').onclick=()=>{close();$('#btnMenu').click()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#setPanel').hidden)close();else if(e.key==='F10'){e.preventDefault();if($('#setPanel').hidden)open();else close()}});
}
$('#btnMenu').onclick=()=>{if(MP){if(XY.net)XY.net.leave();return}if(!started||over)return;saveGame();started=false;paused=true;['#endScreen','#credits','#tradePanel'].forEach(q=>{const e=$(q);if(e)e.hidden=true});showContinue();$('#startScreen').hidden=false;toast('Spiel gespeichert. Mit „Weiterspielen“ geht es weiter.','good')};
// Spielstart von außen (Kampagne): eigene Schwierigkeit, Karte, Epochen, Volk und Zeitlimit
XY.game={start(o){o=o||{};timeLimit=o.limit||0;useCustomMap=false;if(o.epStart!=null)epStart=o.epStart;if(o.epEnd!=null)epEnd=o.epEnd;if(o.civ&&CIVS[o.civ])chosenCiv=o.civ;
  $('#startScreen').hidden=true;$('#endScreen').hidden=true;over=false;resize();newGame(o.diff!=null?o.diff:chosenDiff,o.seed!=null?o.seed:(Math.random()*99999)|0);started=true;paused=false;$('#btnPause').textContent='Pause'},
  menu(){$('#againBtn').click()},get started(){return started&&!over}};
$('#againBtn').onclick=()=>{if(MP){if(XY.net)XY.net.leave();else XY.mp.quit();return}showContinue();$('#endScreen').hidden=true;started=false;over=false;seed=(Math.random()*99999)|0;$('#seedN').textContent=seed;$('#startScreen').hidden=false};
window.addEventListener('resize',resize);
resize();showContinue();requestAnimationFrame(frame);

// test hooks (headless checks)
function autoPlayer(){ // lets the player side be run by the same AI for soak tests
  const save=players;const swap=e=>{if(e.owner===0)e.owner=1;else if(e.owner===1)e.owner=0};
  for(const e of ents)swap(e);players=[save[1],save[0]];players[0].i=0;players[1].i=1;const b=bases;bases=[b[1],b[0]];
  const a=aiS;aiS=window.__ai0||(window.__ai0={t:0,nextAttack:DIFF[diff].firstAttack,wave:DIFF[diff].wave,attacking:false});
  try{aiThink()}finally{window.__ai0=aiS;aiS=a;for(const e of ents)swap(e);players=save;players[0].i=0;players[1].i=1;bases=b}
}
window.__rc=(x,y,sh)=>{shiftHeld=!!sh;rightCommand(x,y);shiftHeld=false};
window.__fx=(x,y,k)=>fx.push({x,y,t:0,k});window.__vfx=()=>vfx.reduce((m,v)=>(m[v.k]=(m[v.k]||0)+1,m),{});
window.__ex={start:(d,s)=>{newGame(d,s);started=true},step:n=>{for(let i=0;i<n&&!over;i++)step(DT)},select:a=>select(a),get:()=>({t:gameT,over,players,ents})};
window.__bldDraw=(t,g,x,y,ep,o)=>{const D=BLD[t],s=D.size*T;if(!D.draw){const c=bldSprite(t,ep,o);g.drawImage(c,x-4,y-36,c.lw,c.lh);return}modDraw(g,{type:t,owner:o,built:true,size:D.size,id:1},{x,y,s,lift:Math.min(12,s*.18),ep,pc:PCOL[o],wall:WALL[ep],roof:ROOF[ep],roofHi:ROOF_HI[ep],...DRAW_API})};window.__look=(x,y,z)=>{zoomT=0;cam.z=z;cam.x=x*T-viewW/(2*z);cam.y=y*T-viewH/(2*z)};window.__tree=v=>treeSprite(v);window.__unitDraw=(g,u)=>{g.save();UNITS[u.type].draw(g,u,DRAW_API);g.restore()};window.__rock=(k,v)=>rockSprite(k,v);window.__spawn=(p,t,x,y)=>spawnUnit(p,t,x,y);window.__reveal=()=>{exp.fill(1);vis.fill(1)};window.__place=(p,t,x,y)=>placeBld(p,t,x,y,true);window.__can=(p,t,x,y)=>canPlace(p,t,x,y);window.__water=(x,y)=>terr[idx(x|0,y|0)]===1;window.__cam=(x,y)=>{cam.x=x*T;cam.y=y*T};window.__move=(u,x,y)=>cmdMove([u],x,y,false);window.__limit=m=>{timeLimit=m};window.__placeU=(p,t,x,y)=>placeBld(p,t,x,y,false);
})();
