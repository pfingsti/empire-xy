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
const PCOL=['#4a8ae8','#d4473c'];
const PCOL_DK=['#2b5aa8','#8f2a23'];
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

function genMap(){
  terr.fill(0);block.fill(0);
  const lake=makeNoise(10),forest=makeNoise(6),det=makeNoise(3);
  bases=[{x:9,y:H-12},{x:W-12,y:9}];
  const nearBase=(x,y,r)=>bases.some(b=>Math.hypot(x-b.x-1.5,y-b.y-1.5)<r);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const n=lake(x,y)*.8+det(x,y)*.2;
    if(n>.665&&!nearBase(x,y,15))terr[idx(x,y)]=1;
  }
  // guaranteed land bridge between the two capitals
  const c0={x:bases[0].x+1.5,y:bases[0].y+1.5},c1={x:bases[1].x+1.5,y:bases[1].y+1.5};
  for(let s=0;s<=1;s+=.004){const px=c0.x+(c1.x-c0.x)*s,py=c0.y+(c1.y-c0.y)*s+Math.sin(s*9)*4;
    for(let oy=-2;oy<=2;oy++)for(let ox=-2;ox<=2;ox++){const x=Math.round(px+ox),y=Math.round(py+oy);if(inb(x,y))terr[idx(x,y)]=0}}
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
  bases.forEach((b,i)=>{const s=i===0?1:-1,cx=b.x+1.5,cy=b.y+1.5;
    for(const [t,ox,oy,n] of offs)if(n)cluster(t,cx+ox*s,cy+oy*s,n);
    cluster('tree',cx+9*s,cy+7*s,10);
  });
  for(let k=0;k<6;k++){
    let x,y,tries=0;
    do{x=6+rng()*(W-12);y=6+rng()*(H-12);tries++}while(tries<50&&(nearBase(x,y,16)||nearBase(W-1-x,H-1-y,16)));
    const t=k%2?'stone':'gold';cluster(t,x,y,5);cluster(t,W-1-x,H-1-y,5);
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
      const sand=sstep(.12,.4,w+(b-.5)*.12);
      if(sand>0)c=mixC(c,mixC(SA,SB,b),sand);
      const wa=sstep(.46,.53,w+(f-.5)*.04);
      if(wa>0){const dp=sstep(.35,.95,samp(deep,fx,fy));let wc=mixC(WS,WD,dp);wc=mixC(wc,[wc[0]+20,wc[1]+24,wc[2]+26],(b-.5)*.7);
        const foam=Math.max(0,1-Math.abs(w-.56)/.05)*.45;wc=mixC(wc,[226,238,232],foam);c=mixC(c,wc,wa)}
      const o=(py*RW+px)*4;D[o]=c[0];D[o+1]=c[1];D[o+2]=c[2];D[o+3]=255;
    }
  }
  hg.putImageData(img,0,0);
  g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(half,0,0,PW,PH);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=((Math.min(RH-1,((y+.5)*T/HS)|0))*RW+Math.min(RW-1,((x+.5)*T/HS)|0))*4,o=(y*W+x)*4;mimg.data[o]=D[p];mimg.data[o+1]=D[p+1];mimg.data[o+2]=D[p+2];mimg.data[o+3]=255}
  mi.putImageData(mimg,0,0);
  // fine grain
  const gr=document.createElement('canvas');gr.width=gr.height=96;const gg=gr.getContext('2d');
  for(let i=0;i<1600;i++){gg.fillStyle=rng()<.5?'rgba(255,255,230,.07)':'rgba(0,0,0,.08)';gg.fillRect(rng()*96|0,rng()*96|0,1,1)}
  g.fillStyle=g.createPattern(gr,'repeat');g.fillRect(0,0,PW,PH);
  // decor: grass blades, flowers, pebbles
  const isGrass=(x,y)=>{const tx=x/T|0,ty=y/T|0;return inb(tx,ty)&&terr[idx(tx,ty)]===0&&samp(water,x/T-.5,y/T-.5)<.08&&samp(worn,x/T-.5,y/T-.5)<.6};
  g.lineCap='round';
  for(let i=0;i<W*H*9;i++){
    const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;
    const l=3+rng()*4,lean=(rng()-.5)*3;
    g.strokeStyle=rng()<.55?`rgba(${150+rng()*40|0},${185+rng()*30|0},${90+rng()*20|0},.45)`:'rgba(28,52,22,.35)';
    g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+lean*.3,y-l*.6,x+lean,y-l);g.stroke();
  }
  const FLOW=['#f3e27a','#f4f1e6','#c9a2e0','#e88a7a'];
  for(let i=0;i<W*H*.6;i++){const x=rng()*PW,y=rng()*PH;if(!isGrass(x,y))continue;const c=FLOW[rng()*4|0];
    for(let k=0;k<3;k++){g.fillStyle=c;g.beginPath();g.arc(x+(rng()-.5)*8,y+(rng()-.5)*6,1.3,0,7);g.fill()}}
  for(let i=0;i<W*H*.8;i++){const x=rng()*PW,y=rng()*PH,tx=x/T|0,ty=y/T|0;if(!inb(tx,ty)||terr[idx(tx,ty)]===1)continue;
    if(terr[idx(tx,ty)]===2||samp(worn,x/T-.5,y/T-.5)>.5){g.fillStyle='rgba(90,80,64,.55)';g.beginPath();g.ellipse(x,y,1.6+rng()*1.4,1.1+rng(),0,0,7);g.fill();g.fillStyle='rgba(230,220,200,.35)';g.fillRect(x-1,y-1,1,1)}}
  g.lineCap='butt';
  // water: soft highlight ripples
  for(let i=0;i<W*H*2;i++){const x=rng()*PW,y=rng()*PH;if(samp(water,x/T-.5,y/T-.5)<.75)continue;
    g.strokeStyle='rgba(200,235,240,.16)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+5,y-2,x+10,y);g.stroke()}
}

function newPlayer(i,ai){return{i,ai,techs:{},fx:{gather:{},atk:{},hp:{},speed:{},range:{},carry:0,build:0,bldHp:0,bldAtk:0},res:{food:200,wood:200,stone:150,gold:100},epoch:0,pop:0,cap:0,advancing:false,wonderT:-1,defeated:false,
  st:{trained:0,lost:0,killed:0,gathered:0,built:0}}}

function newGame(d,seed){
  syncRegistry();
  rng=mulberry32(seed);diff=d;curSeed=seed;
  ents=[];corpses=[];byId=new Map();nextId=1;block=new Int32Array(W*H);gate=new Uint8Array(W*H);terr=new Uint8Array(W*H);vis=new Uint8Array(W*H);exp=new Uint8Array(W*H);
  proj=[];fx=[];sel=[];gameT=0;over=false;placing=null;aMode=false;groups={};
  players=[newPlayer(0,false),newPlayer(1,true)];
  genMap();renderTerrain();
  bases.forEach((b,p)=>{
    const tc=placeBld(p,'tc',b.x,b.y,true);
    for(let k=0;k<4;k++){const s=freeAround(tc);if(s)spawnUnit(p,'worker',s.x+.5,s.y+.5)}
    const s=freeAround(tc);if(s)spawnUnit(p,'infantry',s.x+.5,s.y+.5);
  });
  epStart=Math.min(epStart,MAXEP());
  if(epStart>0)for(const pl of players){pl.epoch=epStart;for(const k in pl.res)pl.res[k]=Math.round(pl.res[k]*(1+epStart*.7))}
  aiS={t:0,nextAttack:DIFF[d].firstAttack,wave:DIFF[d].wave,attacking:false,lastDef:0};WX={kind:'sun',until:150,speed:1,night:0};
  // Völker mit eigenen Boni (wie in Age of Empires 2); der Gegner zieht ein zufälliges anderes Volk
  players[0].civ=chosenCiv;const others=Object.keys(CIVS).filter(k=>k!==chosenCiv);players[1].civ=others[(rng()*others.length)|0];
  for(const pl of players)CIVS[pl.civ].apply(pl.fx);
  recalcPop();updateVis(true);
  XY.emit('start',API);
  const tc=ents.find(e=>e.type==='tc'&&e.owner===0);centerOn(tc.x+1.5,tc.y+1.5);
  select([tc]);
  toast('Dein Volk erwacht in der Steinzeit. Sammle Nahrung und Holz.', 'good');
  toast('Du führst die '+CIVS[players[0].civ].name+' ('+CIVS[players[0].civ].bonus+'). Gegner: '+CIVS[players[1].civ].name+'.');
}

// ================= entities =================
// Wetter und Tageszeit: Sonne, Regen (−20 % Tempo), Schnee (−10 %); ein Tag dauert 8 Minuten, nachts sinkt die Sicht
let WX={kind:'sun',until:150,speed:1,night:0};
const WXN={sun:'Sonnenschein',rain:'Regen: alle Truppen 20 % langsamer',snow:'Schneefall: alle Truppen 10 % langsamer'};
function weatherTick(){
  const ph=(gameT/480)%1;WX.night=Math.max(0,Math.min(1,(Math.cos(ph*Math.PI*2)*-1-.35)*1.6));// 0 Tag … 1 tiefe Nacht
  if(gameT>=WX.until){const r=rng(),ep=players[0].epoch,old=WX.kind;WX.kind=r<.55?'sun':r<.82||ep>6?'rain':'snow';WX.until=gameT+90+rng()*150;
    WX.speed=WX.kind==='rain'?.8:WX.kind==='snow'?.9:1;if(started&&old!==WX.kind)toast(WXN[WX.kind]+'.')}
}
function uStat(u){const d=UNITS[u.type],pl=players[u.owner],f=pl.fx,t=CLS(u.type),e=pl.epoch,m=1+.17*e;return{hp:Math.round(d.hp*m*(1+(f.hp[t]||0))),atk:d.atk*m*(1+(f.atk[t]||0)),range:d.range+(f.range[t]||0),rate:d.rate,speed:d.speed*(1+.03*e)*(1+(f.speed[t]||0))*(d.naval?1:WX.speed),sight:Math.max(2,d.sight-WX.night*2)}}
function spawnUnit(p,type,x,y){
  const d=UNITS[type];
  const u=addEnt({kind:'unit',type,owner:p,x,y,r:d.r,hp:0,cd:0,ang:p?Math.PI*.75:-Math.PI*.25,order:{t:'idle'},path:null,pathCD:0,carry:0,ct:null,scan:rng()*.5,anim:rng()*6});
  u.hp=uStat(u).hp;u.maxhp=u.hp;return u;
}
function placeBld(p,type,x,y,done){
  const d=BLD[type];
  const b=addEnt({kind:'bld',type,owner:p,x,y,size:d.size,built:!!done,prog:done?1:0,hp:done?Math.round(d.hp*(1+players[p].fx.bldHp)):1,maxhp:Math.round(d.hp*(1+players[p].fx.bldHp)),queue:[],rally:null,cd:0,seen:p===0});
  if(!d.walk)for(let yy=y;yy<y+d.size;yy++)for(let xx=x;xx<x+d.size;xx++){block[idx(xx,yy)]=b.id;if(d.gate)gate[idx(xx,yy)]=p+1}
  // push units out of the footprint
  for(const u of ents)if(u.kind==='unit'&&!d.walk&&u.x>=x&&u.x<x+d.size&&u.y>=y&&u.y<y+d.size){const s=freeAround(b);if(s){u.x=s.x+.5;u.y=s.y+.5;u.path=null}}
  return b;
}
function canPlace(p,type,x,y){
  const d=BLD[type];
  if(x<1||y<1||x+d.size>W-1||y+d.size>H-1)return false;
  if(d.water){const i=idx(x,y);if(terr[i]!==1||block[i]!==-1||(p===0&&!exp[i]))return false;for(const e of ents)if(e.type==='bridge'&&!e.dead&&e.x===x&&e.y===y)return false;return true}
  for(let yy=y;yy<y+d.size;yy++)for(let xx=x;xx<x+d.size;xx++){
    const i=idx(xx,yy);if(block[i]!==0||terr[i]===1)return false;
    if(p===0&&!exp[i])return false;
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
function income(pl,r,v){(pl.inc=pl.inc||[]).push([gameT,r,v])}
function incomeRate(pl,r){if(!pl.inc)return 0;while(pl.inc.length&&pl.inc[0][0]<gameT-60)pl.inc.shift();let s=0;for(const x of pl.inc)if(x[1]===r)s+=x[2];return Math.round(s*60/Math.min(60,Math.max(10,gameT)))}
function refund(p,c){for(const k in c)players[p].res[k]+=c[k]}
function costOf(type){return UNITS[type]?UNITS[type].cost:BLD[type].cost}

function recalcPop(){
  for(const pl of players){pl.pop=0;pl.cap=0}
  for(const e of ents){if(e.dead)continue;
    if(e.kind==='unit')players[e.owner].pop+=UNITS[e.type].pop;
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
let passOwner=-1,passNaval=false;
const pass=(x,y)=>{if(!inb(x,y))return false;const i=idx(x,y),b=block[i];if(passNaval)return terr[i]===1;return b===0||(b>0&&gate[i]===passOwner+1&&passOwner>=0)};
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
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;
  const gx=Math.floor(tx),gy=Math.floor(ty);const ok=pass(gx,gy);
  u.path=smoothPath(u,findPath(Math.floor(u.x),Math.floor(u.y),(x,y)=>ok?(x===gx&&y===gy):Math.abs(x-gx)<=1&&Math.abs(y-gy)<=1,gx,gy));
  u.goal=ok?{x:tx,y:ty}:null;
}
function pathToEnt(u,t){
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;
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
function cmdMove(units,wx,wy,amove){
  const n=units.length,cols=Math.ceil(Math.sqrt(n));let k=0;
  const sorted=[...units].sort((a,b)=>Math.hypot(a.x-wx,a.y-wy)-Math.hypot(b.x-wx,b.y-wy));
  for(const u of sorted){
    let tx=wx,ty=wy;
    if(n>1){const cx=k%cols-(cols-1)/2,cy=Math.floor(k/cols)-(Math.ceil(n/cols)-1)/2;tx=wx+cx*.8;ty=wy+cy*.8;passNaval=!!UNITS[u.type].naval;if(!pass(Math.floor(tx),Math.floor(ty))){tx=wx;ty=wy}}
    k++;
    order(u,{t:amove?'amove':'move',x:tx,y:ty});pathToPoint(u,tx,ty);
  }
}
function cmdTarget(units,t,force){
  let moved=[];
  for(const u of units){
    if(t.kind==='res'){if(u.type==='worker')order(u,{t:'gather',target:t.id,rt:t.rt});else moved.push(u)}
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
function enemyNear(u,radius,wantBld){
  let best=null,bd=radius;
  for(const e of ents){
    if(e.dead||e.owner<0||e.owner===u.owner||e.kind==='unit'&&hidden(e)&&Math.hypot(e.x-u.x,e.y-u.y)>2.5)continue;
    if(e.kind==='res')continue;
    if(e.kind==='bld'&&!wantBld)continue;
    if(u.owner===0&&e.kind==='unit'&&!vis[idx(e.x|0,e.y|0)])continue;
    let d=distEnt(u,e);if(e.kind==='bld')d+=2;else if(e.type==='worker')d+=1;
    if(d<bd){bd=d;best=e}
  }
  return best;
}

// ================= combat =================
function damage(t,dmg,src){
  if(t.dead)return;
  t.hp-=dmg;t.hitT=gameT;t.revealT=gameT+6;if(src)src.revealT=gameT+6;if(visibleEnt(t))sfx(dmg>20?'boom':src&&src.kind==='unit'&&uStat(src).range<1.5&&!['siege'].includes(CLS(src.type))?'sword':'hit');
  fx.push({x:center(t).x+(rng()-.5)*.4,y:center(t).y+(rng()-.5)*.4,t:0,k:'hit'});
  if(t.owner===0&&gameT-lastAlarm>20&&src){lastAlarm=gameT;toast('Wir werden angegriffen!','warn');ping=center(t);pingT=3}
  if(t.kind==='unit'&&src&&!src.dead&&src.owner!==t.owner){
    if(isMil(t)&&!UNITS[t.type].stealth&&(t.order.t==='idle'||(t.order.t==='amove')))order(t,{t:'attack',target:src.id,resume:t.order.t==='amove'?t.order:null});
    else if(t.type==='worker'&&t.owner===1)aiS.alarm={x:t.x,y:t.y,time:gameT};
  }
  if(t.kind==='bld'&&t.owner===1&&src)aiS.alarm={x:src.x,y:src.y,time:gameT};
  if(t.hp<=0)kill(t,src);
}
let lastAlarm=-99,ping=null,pingT=0;
let corpses=[];
function kill(e,src){
  e.dead=true;
  if(e.kind==='unit'&&!(UNITS[e.type]&&UNITS[e.type].naval)&&visibleEnt(e)){corpses.push(Object.assign({},e,{moving:false,swing:0,working:false,carry:0,dt0:gameT,fall:Math.random()<.5?1:-1}));if(corpses.length>60)corpses.shift()}
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
    if(u.cd<=0){
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
  passOwner=u.owner;passNaval=!!UNITS[u.type].naval;
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
      if(follow(u,dt)){u.path=null;u.order={t:'idle'};u.scan=.2}
      break;}
    case 'amove':{
      if(u.scan<=0){u.scan=.4;const e=enemyNear(u,st.sight,true);if(e){order(u,{t:'attack',target:e.id,resume:{t:'amove',x:o.x,y:o.y}});break}}
      if(!u.path){if(u.pathCD<=0){pathToPoint(u,o.x,o.y);u.pathCD=.8}else u.pathCD-=dt}
      if(u.path&&follow(u,dt)){u.path=null;if(Math.hypot(o.x-u.x,o.y-u.y)<1.5)u.order={t:'idle'}}
      break;}
    case 'attack':{
      const t=byId.get(o.target);
      if(!alive(t)||(u.owner===0&&t.kind==='unit'&&!vis[idx(t.x|0,t.y|0)])){
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
      if(u.carry>=10+players[u.owner].fx.carry){order(u,{t:'return',resume:o});break}
      if(distEnt(u,r)<=.5){
        u.path=null;const c=center(r);u.ang=Math.atan2(c.y-u.y,c.x-u.x);
        const rate={wood:.85,food:r.kind==='bld'?.6:.95,stone:.65,gold:.65}[o.rt]*(players[u.owner].moodMul||1)*(players[u.owner].toolMul||1)*(r.kind==='bld'?farmBoost(r):1)*(1+.06*players[u.owner].epoch)*(1+(players[u.owner].fx.gather[o.rt]||0))*(u.owner===1?DIFF[diff].gather:1);
        const amt=Math.min(rate*dt,r.kind==='res'?r.amount:99);
        u.carry+=amt;u.ct=o.rt;u.working=true;if(u.owner===0&&visibleEnt(u)&&onScreen(u))sfx(o.rt==='wood'?'chop':o.rt==='food'?'':'mine');
        if(r.kind==='res'){r.amount-=amt;if(r.amount<=0.001)kill(r)}
      }else approach(u,r,dt);
      break;}
    case 'return':{
      let d=o.drop?byId.get(o.drop):null;
      if(!alive(d)||!d.built){d=nearestDrop(u.owner,u.x,u.y);if(!d){order(u,{t:'idle'});break}o.drop=d.id;u.path=null}
      if(distEnt(u,d)<=.5){
        const pl=players[u.owner];pl.res[u.ct]+=u.carry;pl.st.gathered+=u.carry;income(pl,u.ct,u.carry);u.carry=0;
        if(o.resume){const r=o.resume;order(u,r)}else order(u,{t:'idle'});
      }else approach(u,d,dt);
      break;}
    case 'build':{
      const b=byId.get(o.target);
      if(!alive(b)){order(u,{t:'idle'});findMoreWork(u);break}
      if(b.built&&b.hp>=b.maxhp){
        if(b.type==='farm'&&!farmTaken(b,u)){order(u,{t:'gather',target:b.id,rt:'food'});break}
        if(BLD[b.type].drop&&u.owner===1){order(u,{t:'idle'});break}
        order(u,{t:'idle'});findMoreWork(u);break}
      if(distEnt(u,b)<=.5){
        u.path=null;const c=center(b);u.ang=Math.atan2(c.y-u.y,c.x-u.x);u.working=true;
        const D=BLD[b.type];
        if(!b.built){
          const inc=dt/D.time*(u.owner===1?DIFF[diff].gather:1)*(1+players[u.owner].fx.build);b.prog=Math.min(1,b.prog+inc);b.hp=Math.min(b.maxhp,b.hp+b.maxhp*inc);
          if(b.prog>=1){b.built=true;players[b.owner].st.built++;recalcPop();if(b.owner===0){toast(D.name+' fertiggestellt.');sfx('bell')}
            if(b.type==='wonder'){players[b.owner].wonderT=180;toast((b.owner===0?'Dein':'Das feindliche')+' Weltwunder steht! 3 Minuten bis zum Sieg.',b.owner===0?'good':'warn')}}
        }else{b.hp=Math.min(b.maxhp,b.hp+b.maxhp*dt/D.time*.6)}
      }else approach(u,b,dt);
      break;}
  }
  u.working=(o.t==='gather'||o.t==='build')&&!u.moving&&!u.path;
  // stuck detection: units that make no progress briefly pass through others
  u.chk=(u.chk||0)-dt;u.ghost=Math.max(0,(u.ghost||0)-dt);
  if(u.chk<=0){u.chk=.8;if(u.moving&&u.lx!==undefined&&Math.hypot(u.x-u.lx,u.y-u.ly)<.25)u.ghost=1.2;u.lx=u.x;u.ly=u.y}
}
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
      let best=null,bd=D.range;
      for(const e of ents){if(e.kind!=='unit'||e.dead||e.owner===b.owner||hidden(e))continue;const c=center(b),d=Math.hypot(e.x-c.x,e.y-c.y)-b.size/2;if(d<bd){bd=d;best=e}}
      if(best){b.cd=D.rate;const c=center(b);proj.push({x:c.x,y:c.y-.6,tid:best.id,dmg:D.atk*(1+.14*pl.epoch)*(1+pl.fx.bldAtk),src:b.id,k:'arrow',ep:pl.epoch,sp:14,arc:bd})}
    }
  }
  const q=b.queue[0];if(!q)return;const sdt=(b.sabotUntil>gameT?dt*.5:dt)*(players[b.owner].crowdMul||1);// sabotiert: halbe Produktion
  if(q.tech){
    q.t+=sdt;
    if(q.t>=q.total){b.queue.shift();applyTech(pl,q.tech);
      if(b.owner===0)toast('Forschung abgeschlossen: '+TECHS[q.tech].name+'.','good');uiDirty=true}
    return;
  }
  if(q.ep){
    q.t+=sdt;
    if(q.t>=q.total){b.queue.shift();pl.advancing=false;pl.epoch++;
      for(const u of ents)if(u.kind==='unit'&&u.owner===b.owner&&!u.dead){const f=u.hp/u.maxhp;u.maxhp=uStat(u).hp;u.hp=Math.max(1,Math.round(u.maxhp*f))}
      if(b.owner===0)toast('Willkommen in der '+EPOCHS[pl.epoch]+'! Neue Einheiten und Gebäude sind verfügbar.','good');
      else toast('Der Gegner hat die '+EPOCHS[pl.epoch]+' erreicht.','warn');
      uiDirty=true;
    }
    return;
  }
  const U=UNITS[q.u];
  if(!q.started){if(pl.pop+U.pop>pl.cap){q.blocked=true;if(b.owner===0&&gameT-(b.popWarn||-99)>15){b.popWarn=gameT;toast('Bevölkerungslimit erreicht. Baue Wohnhäuser.','warn')}return}q.started=true;q.blocked=false;recalcPop()}
  q.t+=sdt;
  if(q.t>=q.total){
    b.queue.shift();
    const s=freeAround(b,b.rally?{x:b.rally.x,y:b.rally.y}:null,!!U.naval);
    if(!s){q.t=q.total;b.queue.unshift(q);return}
    const u=spawnUnit(b.owner,q.u,s.x+.5,s.y+.5);pl.st.trained++;recalcPop();
    if(b.rally){
      const t=b.rally.id?byId.get(b.rally.id):null;
      if(t&&alive(t))cmdTarget([u],t);else cmdMove([u],b.rally.x,b.rally.y,false);
    }else if(b.owner===0&&u.type==='worker'){
      // auto-gather nearest food so the economy keeps running
      const r=nearestRes('food',u.x,u.y,8,0)||nearestRes('wood',u.x,u.y,12,0);if(r)order(u,{t:'gather',target:r.id,rt:r.rt||'food'});
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
        if(e.dead||e.owner<0||e.owner===p.owner||e.kind==='res')continue;
        let dd;if(e.kind==='unit')dd=Math.hypot(e.x-p.tx,e.y-p.ty)-e.r;else{const cx=Math.max(e.x,Math.min(p.tx,e.x+e.size)),cy=Math.max(e.y,Math.min(p.ty,e.y+e.size));dd=Math.hypot(cx-p.tx,cy-p.ty)}
        if(dd<.9)damage(e,hitDmg(p.ut,p.atk,e)*(1-.5*Math.max(0,dd)/.9),src);
      }
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
  fx=fx.filter(f=>f.t<(f.k==='smoke'?1.6:f.k==='die'?1.2:f.k==='stuck'?4:.4));
}

// ================= separation =================
function separate(){
  const grid=new Map();
  for(const u of ents){if(u.kind!=='unit'||u.dead)continue;const k=(u.x|0)+(u.y|0)*W;let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(u)}
  for(const u of ents){if(u.kind!=='unit'||u.dead)continue;
    const gx=u.x|0,gy=u.y|0;
    for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const a=grid.get(gx+ox+(gy+oy)*W);if(!a)continue;
      for(const v of a){if(v===u||v.id<u.id||!!UNITS[u.type].naval!==!!UNITS[v.type].naval)continue;
        const dx=v.x-u.x,dy=v.y-u.y,d=Math.hypot(dx,dy)||.01,m=u.r+v.r-.04;
        if(d<m){const push=(m-d)*.5,nx=dx/d,ny=dy/d;
          if(u.ghost||v.ghost)continue;
          const wu=u.working?0.15:1,wv=v.working?0.15:1;
          tryNudge(u,-nx*push*wu,-ny*push*wu);tryNudge(v,nx*push*wv,ny*push*wv)}}}
  }
}
function tryNudge(u,dx,dy){const nx=u.x+dx,ny=u.y+dy;passOwner=u.owner;passNaval=!!UNITS[u.type].naval;if(pass(nx|0,ny|0)){u.x=nx;u.y=ny}}

// ================= visibility =================
let visT=0;
function updateVis(force){
  vis.fill(0);
  for(const e of ents){if(e.dead||e.owner!==0)continue;
    const s=e.kind==='unit'?uStat(e).sight:(e.built?BLD[e.type].sight:2),c=center(e),r2=s*s;
    const x0=Math.max(0,Math.floor(c.x-s)),x1=Math.min(W-1,Math.ceil(c.x+s)),y0=Math.max(0,Math.floor(c.y-s)),y1=Math.min(H-1,Math.ceil(c.y+s));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=x+.5-c.x,dy=y+.5-c.y;if(dx*dx+dy*dy<=r2){vis[idx(x,y)]=1;exp[idx(x,y)]=1}}
  }
  for(const e of ents)if(e.kind==='bld'&&e.owner===1&&!e.dead){for(let y=e.y;y<e.y+e.size&&!e.seen;y++)for(let x=e.x;x<e.x+e.size;x++)if(vis[idx(x,y)]){e.seen=true;break}}
  const d=fogImg.data;
  for(let i=0;i<W*H;i++){d[i*4]=8;d[i*4+1]=12;d[i*4+2]=14;d[i*4+3]=vis[i]?0:exp[i]?140:255}
  fogX.putImageData(fogImg,0,0);
}

// ================= AI =================
function aiThink(){
  const P=1,pl=players[P],D=DIFF[diff];
  const mine=ents.filter(e=>!e.dead&&e.owner===P);
  const workers=mine.filter(e=>e.kind==='unit'&&e.type==='worker');
  const army=mine.filter(e=>isMil(e)&&!(UNITS[e.type]&&UNITS[e.type].naval));
  const ships=mine.filter(e=>e.kind==='unit'&&UNITS[e.type]&&UNITS[e.type].naval);
  const blds=mine.filter(e=>e.kind==='bld');
  const tcs=blds.filter(b=>b.type==='tc');
  const count=t=>blds.filter(b=>b.type===t).length;
  const home=tcs[0]?center(tcs[0]):(workers[0]?{x:workers[0].x,y:workers[0].y}:{x:bases[1].x,y:bases[1].y});
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
    for(const t in BLD)if(BLD[t].ai&&!prodWant.some(w=>w[0]===t))prodWant.push([t,BLD[t].ai.minWorkers||15,BLD[t].minEpoch||0]);
    for(const [t,minW,minE] of prodWant){
      have[t]=(have[t]||0)+1;
      if((minE||0)>ep||workers.length<minW)continue;
      if(count(t)>=have[t])continue;
      if(!spare(BLD[t].cost))break;
      if(t==='camp'){const r=nearestRes('wood',home.x,home.y,30,P)||nearestRes('gold',home.x,home.y,30,P);if(r&&build('camp',{x:r.x,y:r.y},2,6))break;continue}
      if(t==='dock'){if(!BLD.dock)continue;const wt=nearWater(home,28);if(wt&&build('dock',wt,0,6))break;continue}
      if(t==='tower'){if(build('tower',{x:home.x+(bases[0].x-home.x)*.15,y:home.y+(bases[0].y-home.y)*.15},2,8))break;continue}
      if(build(t,home,5,15))break;
    }
    if(BLD.dock&&ep>=1&&workers.length>=11&&!count('dock')&&gameT>(aiS.dockTry||0)&&spare(BLD.dock.cost)){aiS.dockTry=gameT+60;const wt=nearWater(home,28);if(wt)build('dock',wt,0,6)}
    if(BLD.wonder&&ep>=BLD.wonder.minEpoch&&diff===2&&!count('wonder')&&canAfford(P,mulCost(BLD.wonder.cost,1.2)))build('wonder',home,6,16);
  }
  // --- Mauerabschnitt mit Tor Richtung Gegner (wie die AoE2-KI)
  if(BLD.wall&&BLD.gate&&!aiS.walled&&ep>=2&&workers.length>=16&&tcs.length&&pl.res.stone>=260){
    aiS.walled=true;const dx=bases[0].x-home.x,dy=bases[0].y-home.y,dl=Math.hypot(dx,dy)||1,ux=dx/dl,uy=dy/dl;
    const mx=home.x+ux*11,my=home.y+uy*11,bs=[];
    for(let k=-5;k<=5;k++){const x=Math.round(mx-uy*k),y=Math.round(my+ux*k),t=k===0?'gate':'wall';
      if(canPlace(P,t,x,y)&&canAfford(P,BLD[t].cost)){pay(P,BLD[t].cost);bs.push(placeBld(P,t,x,y,false))}}
    const ws=workers.filter(w=>w.order.t!=='build').slice(0,3);
    ws.forEach((w,i)=>{const b=bs[Math.floor(i*bs.length/ws.length)];if(b)order(w,{t:'build',target:b.id})});
  }
  // --- Schiffe: Gewässer bei der Heimat sichern
  for(const sh of ships)if(sh.order.t==='idle'){let best=null,bd=40;
    for(const e of ents)if(!e.dead&&e.owner===0&&((e.kind==='unit'&&UNITS[e.type]&&UNITS[e.type].naval)||e.type==='dock')){const c=center(e),d=Math.hypot(c.x-sh.x,c.y-sh.y);if(d<bd){bd=d;best=c}}
    if(best)order(sh,{t:'amove',x:best.x,y:best.y})}
  // --- farms when berries run low
  const berries=nearestRes('food',home.x,home.y,12,P);
  const farms=blds.filter(b=>b.type==='farm');
  const foodW=workers.filter(w=>w.order.rt==='food').length;
  // --- assign idle workers
  const desired={food:.4,wood:.3,gold:.18+.03*ep,stone:.1+.02*ep};
  if(saving){const e=EPOCH_COST[ep+1];for(const k in e)if(pl.res[k]<e[k])desired[k]+=.12}
  if(ep>=4&&diff===2&&pl.res.stone<1000){desired.stone+=.08;desired.gold+=.05}
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
    if(gameT<90&&diff<2)continue;
    if(spare(uCost(P,tr)))queueUnit(b,tr);
  }
  // --- defend
  const threat=ents.find(e=>!e.dead&&e.owner===0&&e.kind==='unit'&&blds.some(b=>Math.hypot(e.x-b.x-b.size/2,e.y-b.y-b.size/2)<12));
  if(threat){
    for(const a of army)if(a.order.t!=='attack'||!a.order.forced)if(!aiS.attacking||Math.hypot(a.x-home.x,a.y-home.y)<25)order(a,{t:'attack',target:threat.id,forced:true});
    if(army.length<3&&tcs.length)for(const w of workers)if(Math.hypot(w.x-threat.x,w.y-threat.y)<5&&threat.type==='worker')order(w,{t:'attack',target:threat.id,forced:true});
  }
  // --- Verwundete (unter 30 % Leben) ziehen sich nach Hause zurück, Heiler und Burg pflegen sie dort
  for(const a of army){if(a.retreat){if(a.hp>a.maxhp*.75||Math.hypot(a.x-home.x,a.y-home.y)<6&&a.hp>a.maxhp*.6)a.retreat=false;else continue}
    if(a.hp<a.maxhp*.3&&Math.hypot(a.x-home.x,a.y-home.y)>10&&diff>0){a.retreat=true;a.waveAt=null;cmdMove([a],home.x+(rng()-.5)*4,home.y+4+(rng()-.5)*3,false)}}
  // Rückzügler heilen langsam in der Heimat
  for(const a of army)if(a.retreat&&Math.hypot(a.x-home.x,a.y-home.y)<7)a.hp=Math.min(a.maxhp,a.hp+a.maxhp*.02*DIFF[diff].think);
  // --- attack waves
  if(aiS.attacking){
    const out=army.filter(a=>a.waveAt||a.order.t==='amove'||a.order.t==='attack');
    if(out.length<Math.max(2,aiS.sent*.25)){aiS.attacking=false;aiS.nextAttack=gameT+70;for(const a of army)cmdMove([a],home.x+(rng()-.5)*6,home.y+6+(rng()-.5)*4,false)}
    else for(const a of army)if(a.retreat)continue;else if(a.waveAt&&gameT>=a.waveAt.t){order(a,{t:'amove',x:a.waveAt.x+(rng()-.5)*2,y:a.waveAt.y+(rng()-.5)*2});a.waveAt=null}
    else if(!a.waveAt&&(a.order.t==='idle'||a.order.t==='guard')){const t=playerTarget(a);if(t){const c=center(t);order(a,{t:'amove',x:c.x,y:c.y})}}
  }else if(gameT>=aiS.nextAttack-(WX.night>.6&&!(aiS.peaceUntil>gameT)?40:0)&&army.length>=aiS.wave&&!(aiS.peaceUntil>gameT)){
    const t=playerTarget(army[0]);
    if(t){aiS.attacking=true;aiS.sent=army.length;aiS.wave+=D.waveGrow;const c=center(t);
      // Formation: erst am Sammelpunkt aufstellen (Nahkampf vorn, Fernkampf hinten), dann losmarschieren
      const dx=c.x-home.x,dy=c.y-home.y,dl=Math.hypot(dx,dy)||1,ux=dx/dl,uy=dy/dl,sx0=home.x+ux*10,sy0=home.y+uy*10;
      const ranged=a=>(UNITS[a.type]&&UNITS[a.type].range>1.5);
      const rows=[army.filter(a=>!ranged(a)),army.filter(ranged)];
      rows.forEach((row,ri)=>row.forEach((a,k)=>{const off=(k-(row.length-1)/2)*.9,back=ri*1.6;
        // jede dritte Einheit eines großen Heeres sammelt sich seitlich versetzt und fällt von der Flanke ein
        const fl=army.length>=6&&k%3===2,side=fl?(k%2?1:-1)*9:0,fwd=fl?6:0;
        a.waveAt={x:c.x,y:c.y,t:gameT+14};cmdMove([a],sx0-uy*(off+side)-ux*(back-fwd),sy0+ux*(off+side)-uy*(back-fwd),false)}));
      toast('Feindliche Armee sammelt sich!','warn');ping={x:army[0].x,y:army[0].y};pingT=3}
  }else{
    // rally idle army in front of home
    const rx=home.x+(bases[0].x-home.x)*.12,ry=home.y+(bases[0].y-home.y)*.12;
    for(const a of army)if(a.order.t==='idle'&&Math.hypot(a.x-rx,a.y-ry)>6)cmdMove([a],rx+(rng()-.5)*4,ry+(rng()-.5)*4,false);
  }
}
function mulCost(c,m){const r={};for(const k in c)r[k]=c[k]*m;return r}
function playerTarget(from){
  let best=null,bd=1e9;
  for(const e of ents)if(!e.dead&&e.owner===0&&e.kind==='bld'){const c=center(e),d=Math.hypot(c.x-from.x,c.y-from.y)+(e.type==='tc'?-6:0)+(e.type==='farm'?8:0)+(['camp','mill','mine','market','dock'].includes(e.type)?-8:0)+(['tower','castle','wall','gate'].includes(e.type)?10:0);if(d<bd){bd=d;best=e}}
  if(!best)for(const e of ents)if(!e.dead&&e.owner===0&&e.kind==='unit'){const d=Math.hypot(e.x-from.x,e.y-from.y);if(d<bd){bd=d;best=e}}
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
  spawnUnit,placeBld,toast,damage,order,applyTech,techState,center,distEnt,alive,isMil,uStat,
  heal(e,amt){e.hp=Math.min(e.maxhp,e.hp+amt)},
  revealAll(){exp.fill(1)},
  fx(x,y,k){fx.push({x,y,t:0,k:k||'hit'})},
};
// ================= main step =================
let aiTimer=0,popT=0;
function step(dt){
  gameT+=dt;
  for(const e of ents){if(e.dead)continue;if(e.kind==='unit')updUnit(e,dt);else if(e.kind==='bld')updBld(e,dt)}
  separate();updProj(dt);
  if(ents.some(e=>e.dead)){ents=ents.filter(e=>{if(e.dead){byId.delete(e.id);return false}return true});const before=sel.length;sel=sel.filter(e=>!e.dead);if(sel.length!==before)uiDirty=true}
  aiTimer-=dt;if(aiTimer<=0){aiTimer=DIFF[diff].think;aiThink();if(window.__autoplayer)autoPlayer()}
  visT-=dt;if(visT<=0){visT=.2;updateVis()}
  popT-=dt;if(popT<=0){popT=1;recalcPop();checkEnd()}
  pingT-=dt;weatherTick();
  // Brückenstücke bauen sich vom Ufer oder vom letzten fertigen Stück aus selbst
  for(const b of ents){if(b.dead||b.built||!BLD[b.type]||!BLD[b.type].water)continue;
    let ok=false;for(const [ox,oy] of [[1,0],[-1,0],[0,1],[0,-1]]){const xx=b.x+ox,yy=b.y+oy;if(!inb(xx,yy))continue;const j=idx(xx,yy);if(terr[j]!==1){ok=true;break}
      for(const o of ents)if(o.type==='bridge'&&o.built&&!o.dead&&o.x===xx&&o.y===yy){ok=true;break}if(ok)break}
    if(!ok)continue;const inc=dt/BLD[b.type].time*(1+players[b.owner].fx.build);b.prog=Math.min(1,b.prog+inc);b.hp=Math.min(b.maxhp,b.hp+b.maxhp*inc);
    if(b.prog>=1){b.built=true;block[idx(b.x,b.y)]=0;players[b.owner].st.built++}}
  XY.emit('tick',API,dt);
  if(timeLimit&&!over){const left=timeLimit*60-gameT;
    if(left<=60&&left+dt>60)toast('Noch eine Minute bis zum Zeitlimit!','warn');
    if(left<=0){const a=score(players[0]),b=score(players[1]);endGame(a>=b,'Zeitlimit erreicht. Punkte: Du '+a+', Gegner '+b+'.')}}
  for(const pl of players)if(pl.wonderT>0){pl.wonderT-=dt;if(pl.wonderT<=0){endGame(pl.i===0,'Das Weltwunder hat drei Minuten überdauert.')}}
}
function score(pl){let s=pl.epoch*200+pl.st.killed*8+pl.st.gathered/20+Object.keys(pl.techs).length*30;
  for(const e of ents)if(!e.dead&&e.owner===pl.i)s+=e.kind==='bld'?(e.type==='wonder'?500:25):(isMil(e)?6:2);return Math.round(s)}
function checkEnd(){
  if(over)return;
  for(const pl of players){
    const mine=ents.filter(e=>!e.dead&&e.owner===pl.i);
    const hasTC=mine.some(e=>e.type==='tc'),units=mine.filter(e=>e.kind==='unit');
    const dead=(!hasTC&&!units.some(u=>u.type==='worker')&&!units.some(isMil))||(!mine.some(e=>e.kind==='bld'&&e.type!=='farm')&&!units.length);
    if(dead){endGame(pl.i===1,pl.i===1?'Das feindliche Reich ist gefallen.':'Dein Reich ist untergegangen.');return}
  }
}
function endGame(win,text){
  if(over)return;over=true;clearSave();
  $('#endTitle').textContent=win?'Sieg':'Niederlage';
  $('#endText').textContent=text+' Spielzeit '+fmtTime(gameT)+', erreichte Epoche: '+EPOCHS[players[0].epoch]+'.';
  const rows=[['Ausgebildet','trained'],['Gefallen / zerstört','lost'],['Besiegte Feinde','killed'],['Gesammelte Rohstoffe','gathered'],['Gebäude errichtet','built']];
  const val=(pl,k)=>k==='techs'?Object.keys(pl.techs).length:k==='epoch'?EPOCHS[pl.epoch]:k==='score'?score(pl):Math.round(pl.st[k]||0);
  rows.push(['Erforschte Techniken','techs'],['Erreichte Epoche','epoch'],['Punkte','score']);
  $('#endStats').innerHTML='<span class="h"></span><span class="h">Du</span><span class="h">Gegner</span>'+rows.map(([l,k])=>`<span>${l}</span><span>${val(players[0],k)}</span><span>${val(players[1],k)}</span>`).join('');
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
  if(e.owner===0)return true;
  if(e.kind==='unit'){if(!vis[idx(e.x|0,e.y|0)])return false;
    // getarnte Kundschafter sieht man nur aus nächster Nähe oder kurz nach einem Kampf
    if(UNITS[e.type]&&UNITS[e.type].stealth&&!(e.revealT>gameT)){for(const o of ents)if(!o.dead&&o.owner===0&&o.kind==='unit'&&Math.abs(o.x-e.x)<2.5&&Math.abs(o.y-e.y)<2.5)return true;return false}
    return true}
  if(e.kind==='bld')return e.seen;
  return !!exp[idx(e.x,e.y)];
}

// ================= sprites: trees, rocks, buildings (cached, drawn at 2x) =================
const SPR=new Map(),SS=2;
function sprite(key,w,h,fn){
  let c=SPR.get(key);if(c)return c;
  c=document.createElement('canvas');c.width=w*SS;c.height=h*SS;const g=c.getContext('2d');g.scale(SS,SS);g.lineJoin='round';fn(g);
  c.lw=w;c.lh=h;SPR.set(key,c);return c;
}
function hex2rgb(h){if(h[0]!=='#')return[128,128,128];const n=parseInt(h.slice(1),16);return[n>>16,n>>8&255,n&255]}
function shade(hex,amt){const c=hex2rgb(hex);return `rgb(${Math.max(0,Math.min(255,c[0]+amt))},${Math.max(0,Math.min(255,c[1]+amt))},${Math.max(0,Math.min(255,c[2]+amt))})`}
function blob(g,x,y,r,light,mid,dark){const gr=g.createRadialGradient(x-r*.4,y-r*.45,r*.1,x,y,r);gr.addColorStop(0,light);gr.addColorStop(.55,mid);gr.addColorStop(1,dark);g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
const OUT='rgba(20,16,10,.55)';

function treeSprite(v){
  const kind=v<.33?'pine':v<.42?'birch':'leaf',vi=(v*97|0)%6;
  return sprite('tree'+kind+vi,48,64,g=>{
    const r=mulberry32(vi*7+(kind==='pine'?1:kind==='birch'?2:3));
    g.fillStyle='rgba(10,20,8,.28)';g.beginPath();g.ellipse(30,56,15,6,-.2,0,7);g.fill();
    if(kind==='pine'){
      g.fillStyle='#4b3220';g.fillRect(22,46,5,10);
      const tiers=[[24,8,10],[24,20,14],[24,33,17]];
      const cols=vi%2?['#3f7a4a','#2a5c38','#1a3d26']:['#4a8350','#2f6340','#1d4229'];
      for(const [cx,ty,hw] of tiers){
        g.fillStyle=cols[2];g.beginPath();g.moveTo(cx,ty-1);g.lineTo(cx+hw+1,ty+16);g.lineTo(cx-hw-1,ty+16);g.closePath();g.fill();
        g.fillStyle=cols[1];g.beginPath();g.moveTo(cx,ty);g.lineTo(cx+hw,ty+15);g.lineTo(cx-hw,ty+15);g.closePath();g.fill();
        g.fillStyle=cols[0];g.beginPath();g.moveTo(cx,ty);g.lineTo(cx-hw,ty+15);g.lineTo(cx-1,ty+13);g.closePath();g.fill();
      }
    }else{
      const trunk=kind==='birch'?'#d9d4c4':'#5a3c24';
      g.fillStyle=trunk;g.beginPath();g.moveTo(21,56);g.lineTo(23,36);g.lineTo(27,36);g.lineTo(28,56);g.closePath();g.fill();
      if(kind==='birch'){g.fillStyle='#3a3a36';for(let i=0;i<4;i++)g.fillRect(22+r()*4,40+i*4,2,1)}
      else{g.fillStyle='rgba(0,0,0,.25)';g.fillRect(26,38,2,18)}
      const pal=kind==='birch'?['#b7cf6a','#86a845','#54772c']:vi===5?['#d2a64a','#a87a2e','#6e4a1c']:vi%2?['#8cbc58','#5a8f38','#335e24']:['#7fb24e','#4f8432','#2c5420'];
      const blobs=[];for(let i=0;i<6;i++)blobs.push([24+(r()-.5)*18,22+(r()-.5)*16,7+r()*5]);
      for(const [x,y,rr] of blobs){g.fillStyle=pal[2];g.beginPath();g.arc(x+1,y+1.5,rr+1.5,0,7);g.fill()}
      for(const [x,y,rr] of blobs.sort((a,b)=>a[1]-b[1]))blob(g,x,y,rr,pal[0],pal[1],pal[2]);
      g.fillStyle='rgba(255,255,220,.18)';for(let i=0;i<8;i++){g.beginPath();g.arc(18+r()*12,12+r()*12,1.5,0,7);g.fill()}
    }
  });
}
function stumpSprite(){return sprite('stump',32,32,g=>{g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(17,22,9,4,0,0,7);g.fill();
  g.fillStyle='#5a3c24';g.fillRect(11,15,10,7);g.fillStyle='#c8a46a';g.beginPath();g.ellipse(16,15,5,2.5,0,0,7);g.fill();g.strokeStyle='#8a6a40';g.beginPath();g.ellipse(16,15,2.5,1.2,0,0,7);g.stroke();
  g.fillStyle='#6e4a2b';g.fillRect(3,22,13,3);g.fillRect(5,19,12,3);g.fillStyle='#c8a46a';g.fillRect(15,22,2,3);g.fillRect(16,19,2,3)})}
function bushSprite(v){return sprite('bush'+(v*4|0),32,32,g=>{
  g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.ellipse(17,24,13,5,0,0,7);g.fill();
  for(const [x,y,r] of [[10,17,7],[22,16,7],[16,11,7],[16,19,7]])blob(g,x,y,r,'#5f9a3e','#3d7029','#244a19');})}
function rockSprite(kind,v){return sprite(kind+(v*3|0),40,36,g=>{
  const r=mulberry32((v*3|0)+(kind==='gold'?11:5));const gold=kind==='gold';
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(21,28,16,6,0,0,7);g.fill();
  const rocks=[[12,22,8],[26,21,9],[19,15,8],[30,26,6],[9,27,5]];
  for(const [x,y,s] of rocks){
    const top=gold?'#a59b86':'#b9c0c6',side=gold?'#7a7060':'#8a9299',dark=gold?'#544c40':'#5f666c';
    const pts=[[x-s,y+s*.4],[x-s*.7,y-s*.6],[x+s*.1,y-s*.95],[x+s*.9,y-s*.35],[x+s,y+s*.45],[x+s*.2,y+s*.75]];
    g.fillStyle=dark;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]+1):g.moveTo(p[0],p[1]+1));g.closePath();g.fill();
    g.fillStyle=side;g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath();g.fill();
    g.fillStyle=top;g.beginPath();g.moveTo(pts[1][0],pts[1][1]);g.lineTo(pts[2][0],pts[2][1]);g.lineTo(pts[3][0],pts[3][1]);g.lineTo(x+s*.1,y+s*.05);g.lineTo(x-s*.5,y+s*.1);g.closePath();g.fill();
    g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.8;g.beginPath();g.moveTo(x+s*.1,y+s*.05);g.lineTo(x+s*.2,y+s*.75);g.stroke();
    if(gold){for(let k=0;k<3;k++){const gx=x+(r()-.5)*s*1.2,gy=y+(r()-.6)*s*.9;g.fillStyle='#f6d35a';g.beginPath();g.arc(gx,gy,1.4+r()*1.4,0,7);g.fill();g.fillStyle='#fff6c8';g.fillRect(gx-.5,gy-.8,1,1)}}
    else{g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x-s*.3,y-s*.5,2,1)}
  }})}

function drawRes(g,r){
  const x=r.x*T,y=r.y*T;
  if(r.type==='tree'){
    if(r.amount<r.max){const s=stumpSprite();g.drawImage(s,x,y,32,32);return}
    const s=treeSprite(r.v);g.drawImage(s,x+16-24,y+28-60,48,64);return}
  if(r.type==='berry'){
    g.drawImage(bushSprite(r.v),x,y,32,32);
    const n=Math.ceil(r.amount/r.max*10);
    for(let i=0;i<n;i++){const a=i*2.4+r.v*6,rr=2.5+(i%3)*2.6,bx=x+16+Math.cos(a)*rr*1.2,by=y+15+Math.sin(a)*rr*.85;
      g.fillStyle='#8e1d2c';g.beginPath();g.arc(bx+.4,by+.4,2.1,0,7);g.fill();g.fillStyle='#d8344a';g.beginPath();g.arc(bx,by,1.8,0,7);g.fill();g.fillStyle='rgba(255,255,255,.7)';g.fillRect(bx-1,by-1,1,1)}
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
  if(style==='timber'){g.strokeStyle='#4a3424';g.lineWidth=1.6;g.beginPath();g.moveTo(x0,y0+.8);g.lineTo(x1,y0+.8);for(let x=x0+1;x<=x1;x+=9){g.moveTo(x,y0);g.lineTo(x,y1)}g.stroke()}
  g.strokeStyle=OUT;g.lineWidth=1;g.strokeRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1);
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
  g.stroke();g.restore();
  g.strokeStyle=C(50);g.lineWidth=1.4;g.beginPath();g.moveTo(x0+i,ym);g.lineTo(x1-i,ym);g.stroke();
  g.strokeStyle=OUT;g.lineWidth=1;g.beginPath();g.moveTo(x0,y0);g.lineTo(x1,y0);g.lineTo(x1,y1);g.lineTo(x0,y1);g.closePath();g.stroke();
}
function bshadow(g,x0,y0,x1,y1,len){g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.moveTo(x1,y0+2);g.lineTo(x1+len,y0+2+len*.55);g.lineTo(x1+len,y1+len*.55);g.lineTo(x0+len,y1+len*.55);g.lineTo(x0,y1);g.lineTo(x1,y1);g.closePath();g.fill()}
function door(g,cx,yb,w,h){g.fillStyle='#2b1d12';g.beginPath();g.moveTo(cx-w/2,yb);g.lineTo(cx-w/2,yb-h+w/2);g.arc(cx,yb-h+w/2,w/2,Math.PI,0);g.lineTo(cx+w/2,yb);g.closePath();g.fill();g.fillStyle='rgba(255,210,140,.12)';g.fillRect(cx-w/2+1,yb-2,w-2,2)}
function win(g,x,y,lit){g.fillStyle='#22180f';g.fillRect(x,y,4,4);g.fillStyle=lit?'#f4c86a':'#5d6f7a';g.fillRect(x+.6,y+.6,2.8,2.8);g.fillStyle='rgba(0,0,0,.4)';g.fillRect(x+1.8,y,.6,4)}
function banner(g,x,y,pc,h){h=h||18;g.strokeStyle='#3a2a1a';g.lineWidth=1.6;g.beginPath();g.moveTo(x,y);g.lineTo(x,y-h);g.stroke();
  g.fillStyle=pc;g.beginPath();g.moveTo(x+.5,y-h);g.lineTo(x+11,y-h+2);g.lineTo(x+9,y-h+5);g.lineTo(x+11,y-h+8);g.lineTo(x+.5,y-h+9);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.25)';g.fillRect(x+.5,y-h,10,1.5);g.fillStyle='#e9be72';g.beginPath();g.arc(x,y-h-1,1.4,0,7);g.fill()}
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
      hall(g,bx+3,by-2,x1-3,y1-2,10,mat,col,roof,lit,6);
      if(ep>=2){g.fillStyle=shade(col,-40);g.fillRect(x1-14,by-6,5,10);g.fillStyle='#2a2a2a';g.fillRect(x1-14,by-7,5,2)}
      g.fillStyle=pc;g.fillRect(bx+5,y1-3,5,2);
    }else if(type==='tc'){
      bshadow(g,bx,by+4,x1,y1,12);
      // enclosure: palisade (stone age) or wall
      if(ep===0){for(let x=bx;x<=x1;x+=3.2){for(const yy of [by+6,y1-1]){g.fillStyle='#6b4a2a';g.fillRect(x,yy-6,2.6,7);g.fillStyle='#8f6a40';g.beginPath();g.moveTo(x,yy-6);g.lineTo(x+1.3,yy-8);g.lineTo(x+2.6,yy-6);g.fill()}}
        for(let y=by+6;y<=y1;y+=3.2)for(const xx of [bx,x1-2.6]){g.fillStyle='#5e4026';g.fillRect(xx,y-6,2.6,7)}}
      else{g.fillStyle=shade(col,-25);g.fillRect(bx,by+4,S,4);g.fillRect(bx,by+4,4,S-4);g.fillRect(x1-4,by+4,4,S-4);
        wallFace(g,bx,y1-7,x1,y1,col,ep>=3?'stone':mat.wall);for(let x=bx;x<x1;x+=5){g.fillStyle=shade(col,-5);g.fillRect(x,y1-10,3,3)}}
      g.fillStyle='rgba(120,100,70,.5)';g.fillRect(bx+5,by+9,S-10,S-17);
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
          else{g.fillStyle='#5a3f22';g.fillRect(tx-1,yy,2,9);g.fillStyle='#e6d7a8';g.beginPath();g.arc(tx,yy,6,0,7);g.fill();g.fillStyle='#b8322c';g.beginPath();g.arc(tx,yy,4,0,7);g.fill();g.fillStyle='#e6d7a8';g.beginPath();g.arc(tx,yy,2,0,7);g.fill()}}
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
      g.fillStyle='#6d5532';g.fillRect(bx+2,by+2,S-4,S-4);
      for(let i=0;i<7;i++){const yy=by+6+i*(S-10)/6.2;g.fillStyle='#5a4428';g.fillRect(bx+4,yy+2,S-8,2);
        for(let x=bx+6;x<x1-5;x+=4){g.fillStyle=ep>=2?'#d8b84e':'#8fb04a';g.beginPath();g.ellipse(x,yy,1.6,2.6,0,0,7);g.fill()}}
      for(const [px,py] of [[bx+2,by+2],[x1-4,by+2],[bx+2,y1-4],[x1-4,y1-4]]){g.fillStyle='#4a3220';g.fillRect(px,py-3,2,5)}
      g.strokeStyle=pc;g.lineWidth=1;g.strokeRect(bx+2.5,by+2.5,S-5,S-5);
    }else{ // building from an add-on module without own drawing
      hall(g,bx+3,by,x1-3,y1-2,12,mat,col,roof,lit,7);
      g.fillStyle='#f1e6cf';g.font='600 '+(S*.3|0)+'px "Alegreya SC",Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(D.name[0],(bx+x1)/2,by+S*.3);
      banner(g,x1-6,by,pc,14);
    }
  });
}
function drawBld(g,b){
  const D=BLD[b.type],x=b.x*T,y=b.y*T,s=b.size*T,ep=players[b.owner].epoch,pc=PCOL[b.owner];
  if(D.draw){g.save();try{D.draw(g,b,{x,y,s,lift:Math.min(12,s*.18),ep,pc,wall:WALL[ep],roof:ROOF[ep],roofHi:ROOF_HI[ep],...DRAW_API})}catch(e){}g.restore();if(!b.built)drawProg(g,b,x,y,s);return}
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
  if(b.hp<b.maxhp*.5){const n=b.hp<b.maxhp*.25?2:1;for(let i=0;i<n;i++){const fx=x+s*(.3+.4*i),fy=y+s*.35;const f=Math.sin(gameT*12+i*2)*1.5;
    g.fillStyle='rgba(255,140,40,.85)';g.beginPath();g.moveTo(fx-4,fy+4);g.quadraticCurveTo(fx+f,fy-10,fx+4,fy+4);g.fill();g.fillStyle='rgba(255,230,120,.9)';g.beginPath();g.moveTo(fx-2,fy+4);g.quadraticCurveTo(fx+f*.5,fy-4,fx+2,fy+4);g.fill()}}
}
function drawProg(g,b,x,y,s){g.fillStyle='rgba(0,0,0,.6)';g.fillRect(x+4,y+s-8,s-8,5);g.fillStyle='#e9be72';g.fillRect(x+4,y+s-8,(s-8)*b.prog,5)}

// ---------- units (animated, drawn live)
const SKIN='#d6ab7f';
const DRAW_API={T,PCOL,PCOL_DK,SKIN,shade,blob,get time(){return gameT},epochOf:p=>players[p].epoch};
function legs(g,x,y,a,moving,anim,col){
  const ph=moving?Math.sin(gameT*13+anim)*3:0,px=-Math.sin(a),py=Math.cos(a),fx=Math.cos(a),fy=Math.sin(a);
  g.fillStyle=col;
  for(const s of [-1,1]){g.beginPath();g.ellipse(x+px*2.6*s+fx*ph*s,y+py*2.6*s+fy*ph*s*.6+3,2,2.4,0,0,7);g.fill()}
}
function humanoid(g,u,ep,pc,dk){
  const x=u.x*T,y=u.y*T,a=u.ang,ca=Math.cos(a),sa=Math.sin(a),bob=u.moving?Math.abs(Math.sin(gameT*13+u.anim))*1.4:0;
  legs(g,x,y,a,u.moving,u.anim,'#2c2219');
  const by=y-bob;
  // carried load on the back
  if(LOOK(u.type)==='worker'&&u.carry>0){const lx=x-ca*5,ly=by-sa*5-2;
    if(u.ct==='wood'){g.fillStyle='#7a5530';g.fillRect(lx-5,ly-2,10,2.5);g.fillRect(lx-4,ly-4.5,9,2.5);g.fillStyle='#c8a46a';g.fillRect(lx+4,ly-2,1.5,2.5)}
    else{g.fillStyle='#8a6a40';g.beginPath();g.arc(lx,ly,4,0,7);g.fill();g.fillStyle=u.ct==='food'?'#d8344a':u.ct==='gold'?'#f6d35a':'#b9c0c6';g.beginPath();g.arc(lx,ly-1.5,2.6,0,7);g.fill()}}
  // body
  const gr=g.createLinearGradient(x-6,by-7,x+6,by+6);gr.addColorStop(0,shade(pc,40));gr.addColorStop(.6,pc);gr.addColorStop(1,dk);
  g.fillStyle=gr;g.beginPath();g.ellipse(x,by,6.4,7,0,0,7);g.fill();
  g.strokeStyle=OUT;g.lineWidth=1;g.stroke();
  if(LOOK(u.type)==='worker'){g.fillStyle='#8a6a40';g.fillRect(x-6,by+1,12,2)}
  else if(ep>=1&&ep<=3){g.fillStyle=ep===1?'#b08d57':'#a7adb3';g.beginPath();g.ellipse(x,by-1,5,4,0,0,7);g.fill()}
  // arms
  g.fillStyle=SKIN;for(const s of [-1,1]){g.beginPath();g.arc(x-sa*6*s+ca*1.5,by+ca*6*s*.5+1,1.9,0,7);g.fill()}
  // head + headgear
  const hx=x+ca*1.2,hy=by-7.5;
  g.fillStyle=SKIN;g.beginPath();g.arc(hx,hy,3.8,0,7);g.fill();g.strokeStyle=OUT;g.stroke();
  if(LOOK(u.type)==='worker'){g.fillStyle=ep>=3?'#4a4036':'#5a3d22';g.beginPath();g.arc(hx,hy-1,3.9,Math.PI*1.05,Math.PI*1.95);g.fill();if(ep>=1){g.fillStyle='#c9a649';g.beginPath();g.ellipse(hx,hy-2.2,5.5,1.6,0,0,7);g.fill()}}
  else if(ep===0){g.fillStyle='#3a2616';g.beginPath();g.arc(hx,hy-.8,4,Math.PI,0);g.fill()}
  else{const hc=ep===1?'#c08a3e':ep===2?'#9aa3ab':ep===3?'#2b2f3a':'#4f5a3c';g.fillStyle=hc;g.beginPath();g.arc(hx,hy-.6,4.3,Math.PI,0);g.fill();
    if(ep===3){g.fillRect(hx-5,hy-1.2,10,1.4);g.fillStyle=pc;g.fillRect(hx-1,hy-6,2,2.5)}if(ep===2){g.fillStyle='rgba(255,255,255,.35)';g.fillRect(hx-2,hy-4,1.5,1.5)}}
  if(LOOK(u.type)!=='worker'&&!UNITS[u.type].civil)epochDress(g,players[u.owner].epoch,x,by,hx,hy,pc);
  // equipment
  const sw=u.swing>0?Math.sin(u.swing/.25*Math.PI):0;
  g.lineCap='round';
  if(LOOK(u.type)==='worker'&&u.working){const w=Math.sin(gameT*10+u.anim)*.9,aa=a+w-.4,ex=x+Math.cos(aa)*12,ey=by+Math.sin(aa)*10;
    g.strokeStyle='#6b4a2a';g.lineWidth=1.8;g.beginPath();g.moveTo(x+ca*3,by);g.lineTo(ex,ey);g.stroke();
    g.fillStyle='#9aa1a8';g.beginPath();g.moveTo(ex,ey);g.lineTo(ex+Math.cos(aa+1.6)*4,ey+Math.sin(aa+1.6)*4);g.lineTo(ex+Math.cos(aa)*2,ey+Math.sin(aa)*2);g.fill()}
  else if(LOOK(u.type)==='infantry'){
    const aa=a+sw*.9-.2,hx2=x+Math.cos(a+.9)*5,hy2=by+Math.sin(a+.9)*4;
    if(ep===0){g.strokeStyle='#6b4a2a';g.lineWidth=3;g.beginPath();g.moveTo(hx2,hy2);g.lineTo(hx2+Math.cos(aa)*11,hy2+Math.sin(aa)*9-3);g.stroke();g.fillStyle='#5a3d22';g.beginPath();g.arc(hx2+Math.cos(aa)*11,hy2+Math.sin(aa)*9-3,2.4,0,7);g.fill()}
    else if(ep<=2){g.strokeStyle=ep===1?'#6b4a2a':'#c9ccd0';g.lineWidth=ep===1?1.5:2.2;g.beginPath();g.moveTo(hx2-Math.cos(aa)*3,hy2-Math.sin(aa)*3);g.lineTo(hx2+Math.cos(aa)*(ep===1?16:11),hy2+Math.sin(aa)*(ep===1?13:9)-3);g.stroke();
      if(ep===1){g.fillStyle='#c9ccd0';const tx=hx2+Math.cos(aa)*16,ty=hy2+Math.sin(aa)*13-3;g.beginPath();g.arc(tx,ty,1.6,0,7);g.fill()}
      const sx=x+Math.cos(a-1.1)*6,sy=by+Math.sin(a-1.1)*5;g.fillStyle=shade(pc,-30);g.beginPath();g.ellipse(sx,sy,3.8,5,a,0,7);g.fill();g.strokeStyle='#d9c79f';g.lineWidth=1;g.stroke();g.fillStyle='#e9be72';g.beginPath();g.arc(sx,sy,1.2,0,7);g.fill()}
    else{g.strokeStyle='#3a2a1a';g.lineWidth=2.4;g.beginPath();g.moveTo(x-ca*3,by-sa*3);g.lineTo(x+ca*13,by+sa*10-2);g.stroke();g.strokeStyle='#cfd3d6';g.lineWidth=1;g.beginPath();g.moveTo(x+ca*13,by+sa*10-2);g.lineTo(x+ca*17,by+sa*13-2);g.stroke()}
  }else if(LOOK(u.type)==='ranged'){
    if(ep===0){g.strokeStyle='#8a6a40';g.lineWidth=1;const sp=gameT*(u.swing>0?20:4);g.beginPath();g.moveTo(x+ca*4,by);g.lineTo(x+ca*4+Math.cos(sp)*6,by+Math.sin(sp)*4);g.stroke()}
    else if(ep<=2){g.strokeStyle='#5a3d22';g.lineWidth=1.8;g.beginPath();g.arc(x+ca*4,by+sa*3-1,9,a-1.15,a+1.15);g.stroke();
      g.strokeStyle='rgba(240,230,210,.8)';g.lineWidth=.7;g.beginPath();const pull=u.swing>0?0:3;g.moveTo(x+ca*4+Math.cos(a-1.15)*9,by+sa*3-1+Math.sin(a-1.15)*9);g.lineTo(x+ca*(4-pull),by+sa*(3-pull)-1);g.lineTo(x+ca*4+Math.cos(a+1.15)*9,by+sa*3-1+Math.sin(a+1.15)*9);g.stroke();
      g.fillStyle='#6b4a2a';g.fillRect(x-ca*5-2,by-sa*5-6,3,7)}
    else{g.strokeStyle='#2b2b2b';g.lineWidth=2.4;g.beginPath();g.moveTo(x-ca*2,by-sa*2);g.lineTo(x+ca*15,by+sa*11-2);g.stroke();g.strokeStyle='#6b4a2a';g.lineWidth=3;g.beginPath();g.moveTo(x-ca*3,by-sa*3);g.lineTo(x+ca*3,by+sa*2);g.stroke();
      if(u.swing>.12){g.fillStyle='#ffd27a';g.beginPath();g.arc(x+ca*17,by+sa*13-2,3.5,0,7);g.fill();g.fillStyle='rgba(220,220,220,.5)';g.beginPath();g.arc(x+ca*20,by+sa*15-4,4,0,7);g.fill()}}
  }
  g.lineCap='butt';
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
  const UD=UNITS[u.type],k=(UD.scale||1.32)*Math.sqrt((UD.r||.3)/.3),x=u.x*T,y=u.y*T;
  g.save();g.translate(x,y);g.scale(k,k);g.translate(-x,-y);drawUnitRaw(g,u);g.restore();
}
function drawUnitRaw(g,u){
  const UD=UNITS[u.type];
  const x=u.x*T,y=u.y*T,pc=PCOL[u.owner],dk=PCOL_DK[u.owner],ep=VIS(players[u.owner].epoch),a=u.ang;
  g.fillStyle='rgba(8,14,6,.32)';g.beginPath();g.ellipse(x+3,y+u.r*T*.7,u.r*T*1.1,u.r*T*.5,0,0,7);g.fill();
  if(UD.draw){g.save();try{UD.draw(g,u,DRAW_API)}catch(e){}g.restore();return}
  if(LOOK(u.type)==='cavalry'){
    const ph=u.moving?Math.sin(gameT*16+u.anim):0;
    g.save();g.translate(x,y);g.rotate(a);
    if(ep===1){g.fillStyle='#3a2a1a';g.fillRect(-19,-9,4,18);g.fillStyle='#7a5530';g.fillRect(-17,-7,8,14);g.strokeStyle=pc;g.lineWidth=1.5;g.strokeRect(-17,-7,8,14);g.fillStyle='#3a2a1a';g.beginPath();g.ellipse(-17,-9,3,1.5,0,0,7);g.ellipse(-17,9,3,1.5,0,0,7);g.fill()}
    g.fillStyle='#3a2716';for(const [lx,ly] of [[6,-3],[6,3],[-6,-3],[-6,3]]){g.beginPath();g.ellipse(lx+(lx>0?ph:-ph)*2.5,ly*1.3,2.2,1.4,0,0,7);g.fill()}
    blob(g,0,0,1,'#9a6c42','#7a5232','#4e331e');g.fillStyle='#7a5232';g.beginPath();g.ellipse(0,0,11,5.5,0,0,7);g.fill();
    g.fillStyle='rgba(255,255,255,.12)';g.beginPath();g.ellipse(-1,-2,8,2,0,0,7);g.fill();
    g.fillStyle='#6a4529';g.beginPath();g.ellipse(11,0,5.5,3.2,0,0,7);g.fill();g.fillStyle='#2a1c10';g.fillRect(6,-1,4,2);g.fillRect(-13,-.8,4,1.6);
    g.strokeStyle=OUT;g.lineWidth=1;g.beginPath();g.ellipse(0,0,11,5.5,0,0,7);g.stroke();
    g.fillStyle=pc;g.fillRect(-4,-5.5,7,11);
    g.restore();
    const rx=x-Math.cos(a)*1,ry=y-Math.sin(a)*1-5-(u.moving?Math.abs(ph)*1.2:0);
    const gr=g.createLinearGradient(rx-5,ry-5,rx+5,ry+5);gr.addColorStop(0,shade(pc,40));gr.addColorStop(1,dk);
    g.fillStyle=gr;g.beginPath();g.ellipse(rx,ry,5,5.5,0,0,7);g.fill();g.strokeStyle=OUT;g.stroke();
    g.fillStyle=ep>=2&&ep<4?'#a7adb3':ep>=4?'#4f5a3c':SKIN;g.beginPath();g.arc(rx,ry-5.5,3.2,0,7);g.fill();g.stroke();
    g.lineCap='round';g.strokeStyle=ep>=3?'#2b2b2b':ep===2?'#b9a27a':'#6b4a2a';g.lineWidth=1.6;g.beginPath();g.moveTo(rx-Math.cos(a)*4,ry-Math.sin(a)*4);g.lineTo(rx+Math.cos(a)*16,ry+Math.sin(a)*13-3);g.stroke();g.lineCap='butt';
    if(ep===2){g.fillStyle=pc;g.beginPath();g.moveTo(rx+Math.cos(a)*14,ry+Math.sin(a)*11-3);g.lineTo(rx+Math.cos(a)*10,ry+Math.sin(a)*8-7);g.lineTo(rx+Math.cos(a)*10,ry+Math.sin(a)*8-2);g.fill()}
  }else if(LOOK(u.type)==='siege'){
    g.save();g.translate(x,y);g.rotate(a);
    const wheel=(wx,wy,r)=>{g.fillStyle='#3a2a1a';g.beginPath();g.ellipse(wx,wy,r,r*.45,0,0,7);g.fill();g.strokeStyle='#7a5530';g.lineWidth=1;g.stroke()};
    const re=players[u.owner].epoch;
    if(re>=9&&u.type!=='ram'&&u.type!=='bolt'){// Moderne: Kampfpanzer mit Ketten und Drehturm
      g.fillStyle='#262a20';g.fillRect(-15,-10,30,5);g.fillRect(-15,5,30,5);
      g.fillStyle='#3a3f30';const tk=(gameT*(u.moving?30:0))%4;for(let i=-15+tk;i<15;i+=4){g.fillRect(i,-10,1.4,5);g.fillRect(i,5,1.4,5)}
      const hg=g.createLinearGradient(0,-6,0,6);hg.addColorStop(0,'#7d8660');hg.addColorStop(1,'#4a5236');g.fillStyle=hg;g.fillRect(-13,-6,26,12);
      g.strokeStyle=OUT;g.lineWidth=1;g.strokeRect(-13,-6,26,12);g.fillStyle=pc;g.fillRect(-12,-5,4,10);
      const rec=u.swing>.15?-3:0;g.fillStyle='#565f40';g.beginPath();g.ellipse(-1,0,6.5,5.5,0,0,7);g.fill();g.stroke();
      g.fillStyle='#2e3326';g.fillRect(4+rec,-1.3,16,2.6);g.fillRect(18+rec,-1.8,3,3.6);
      if(u.swing>.18){g.fillStyle='#ffd27a';g.beginPath();g.arc(23,0,4.5,0,7);g.fill();g.fillStyle='rgba(210,210,210,.6)';g.beginPath();g.arc(28,0,6,0,7);g.fill()}
    }else if(ep>=3){
      g.fillStyle='#5a3f22';g.beginPath();g.moveTo(-14,-3);g.lineTo(2,-4);g.lineTo(2,4);g.lineTo(-14,3);g.closePath();g.fill();
      if(re>=7&&re<=8){g.fillStyle='#4a5236';g.beginPath();g.moveTo(-18,-6);g.lineTo(-2,-2);g.lineTo(-2,2);g.lineTo(-18,6);g.lineTo(-16,0);g.closePath();g.fill();g.fillStyle='#5d6748';g.fillRect(1,-8,2.5,16)}
      wheel(-1,-7,5);wheel(-1,7,5);
      const bl=ep>=4?20:17,br=ep>=4?3.8:3.2,rec=u.swing>.15?-3:0;
      const gr=g.createLinearGradient(0,-br,0,br);gr.addColorStop(0,ep>=4?'#7c8a6a':'#5b6066');gr.addColorStop(.5,ep>=4?'#56623f':'#3a3e43');gr.addColorStop(1,'#1c1e20');
      g.fillStyle=gr;g.fillRect(-6+rec,-br,bl,br*2);g.fillStyle='#1c1e20';g.fillRect(bl-7+rec,-br-.8,2,br*2+1.6);
      if(u.swing>.18){g.fillStyle='#ffd27a';g.beginPath();g.arc(bl-3,0,5,0,7);g.fill();g.fillStyle='rgba(210,210,210,.6)';g.beginPath();g.arc(bl+3,0,6,0,7);g.fill()}
    }else{
      g.fillStyle='#6e4a2b';g.fillRect(-12,-7,22,14);g.fillStyle='#8a6440';g.fillRect(-12,-7,22,3);g.strokeStyle=OUT;g.strokeRect(-12,-7,22,14);
      wheel(-8,-8,4);wheel(-8,8,4);wheel(6,-8,4);wheel(6,8,4);
      g.fillStyle='#5a3f22';g.fillRect(-2,-6,3,12);
      const sw=u.swing>0?Math.sin(u.swing/.25*Math.PI)*1.6:0,ang=Math.PI*.9-sw;
      g.strokeStyle='#4a3220';g.lineWidth=2.6;g.beginPath();g.moveTo(-.5,0);g.lineTo(-.5+Math.cos(ang)*14,Math.sin(ang)*14*.3);g.stroke();
      g.fillStyle='#8f8a80';g.beginPath();g.arc(-.5+Math.cos(ang)*14,Math.sin(ang)*14*.3,3,0,7);g.fill();
      g.fillStyle=pc;g.fillRect(4,-6.5,4,13);
    }
    g.restore();
  }else{humanoid(g,u,ep,pc,dk);
    // Kennzeichen der Untertypen: Schild in Ausrüstungsfarbe, Heilerkreuz
    const bx=u.x*T,by=u.y*T;
    if(UD.tint){g.fillStyle=UD.tint;g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=.8;g.beginPath();g.ellipse(bx-Math.sin(a)*5,by-3+Math.cos(a)*3,2.6,3.6,0,0,7);g.fill();g.stroke()}
    if(UD.heal){g.fillStyle='#fff';g.fillRect(bx-1,by-16,2,6);g.fillRect(bx-3,by-14,6,2);g.fillStyle='#d33';g.fillRect(bx-.6,by-15.6,1.2,5.2);g.fillRect(bx-2.6,by-13.6,5.2,1.2)}
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
  ctx.lineCap='round';
  for(let ty=Math.max(0,ty0);ty<Math.min(H,ty1);ty++)for(let tx=Math.max(0,tx0);tx<Math.min(W,tx1);tx++){
    if(terr[idx(tx,ty)]!==1)continue;const h=((tx*73856093)^(ty*19349663))>>>0,ph=(h%1000)/1000;
    const al=Math.pow(Math.max(0,Math.sin(now*1.3+ph*6.28)),6)*.55;if(al<.03)continue;
    const sx=tx*T+(h%23),sy=ty*T+((h>>5)%27);ctx.strokeStyle=`rgba(225,245,250,${al})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+6,sy-1);ctx.stroke();
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
  list.sort((a,b)=>(a.kind==='unit'?a.y:a.y+a.size-.3)-(b.kind==='unit'?b.y:b.y+b.size-.3));
  // Handelsrouten: gestrichelte Linie vom Markt (und Lager, Mühle) zum Stadtzentrum, die der Träger abläuft
  ctx.setLineDash([6,6]);ctx.lineDashOffset=-performance.now()/60;ctx.lineWidth=1.6;
  for(const c of ents){if(c.dead||c.type!=='carrier'||c.owner!==0)continue;const h=byId.get(c.home);if(!h||h.dead)continue;
    let tc=null,bd=1e9;for(const e of ents)if(e.type==='tc'&&e.owner===0&&e.built&&!e.dead){const a=center(h),b2=center(e),d=Math.hypot(a.x-b2.x,a.y-b2.y);if(d<bd){bd=d;tc=e}}
    if(!tc)continue;const a=center(h),b2=center(tc);ctx.strokeStyle=h.type==='market'?'rgba(240,200,90,.55)':'rgba(230,220,190,.28)';
    ctx.beginPath();ctx.moveTo(a.x*T,a.y*T);ctx.lineTo(b2.x*T,b2.y*T);ctx.stroke()}
  ctx.setLineDash([]);ctx.lineWidth=1;
  // selection rings under units
  ctx.lineWidth=1.5;
  for(const e of sel){
    if(e.dead)continue;ctx.strokeStyle=e.owner===0?'#9ef0a0':e.owner<0?'#f0d78a':'#ff8a7a';
    if(e.kind==='unit'){ctx.globalAlpha=.35;ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(e.x*T,e.y*T+e.r*T*.6,e.r*T*1.35,e.r*T*.7,0,0,7);ctx.stroke();ctx.globalAlpha=1;ctx.lineWidth=1.5;ctx.stroke()}
    else{ctx.strokeRect(e.x*T+1,e.y*T+1,e.size*T-2,e.size*T-2)}
  }
  ctx.lineWidth=1;
  // Gefallene: kippen um und verblassen (wie in AoE)
  corpses=corpses.filter(c=>gameT-c.dt0<12&&gameT>=c.dt0);
  for(const c of corpses){const age=gameT-c.dt0,k=Math.min(1,age/.35),x=c.x*T,y=c.y*T;
    ctx.save();ctx.globalAlpha=age<9?1:Math.max(0,(12-age)/3);ctx.translate(x,y+4);ctx.rotate(c.fall*k*Math.PI/2);ctx.translate(-x,-y-4);
    if(age>.35)ctx.filter='saturate(.55) brightness(.8)';drawUnit(ctx,c);ctx.restore()}
  for(const e of list){if(e.kind==='res')drawRes(ctx,e);else if(e.kind==='bld')drawBld(ctx,e);
    else if(e.hitT&&gameT-e.hitT<.1){ctx.save();ctx.filter='brightness(1.9)';drawUnit(ctx,e);ctx.restore()}else drawUnit(ctx,e)}
  // ambient particles: dust, wood chips, chimney smoke
  if(!paused&&started){
    for(const e of list){
      if(e.kind==='unit'){if(e.moving&&Math.random()<.04)spawnVfx(e.x,e.y+.25,'dust');
        if(e.working&&e.order.rt==='wood'&&Math.random()<.05)spawnVfx(e.x+Math.cos(e.ang)*.4,e.y+Math.sin(e.ang)*.4-.2,'chip',{vx:(Math.random()-.5)*1.5,vy:-1.2})}
      else if(e.kind==='bld'&&e.built&&Math.random()<.03&&((e.type==='tc')||(e.type==='house'&&players[e.owner].epoch>=2)||(e.type==='workshop'&&players[e.owner].epoch>=3)))
        spawnVfx(e.x+e.size-.6,e.y-.4,'smoke2',{vx:.15+Math.random()*.1,vy:-.35});
    }
  }
  for(const v of vfx){
    const x=v.x*T,y=v.y*T,f=v.t;
    if(v.k==='dust'){ctx.fillStyle=`rgba(170,150,110,${.35*(1-f/.8)})`;ctx.beginPath();ctx.arc(x,y,2+f*6,0,7);ctx.fill()}
    else if(v.k==='chip'){ctx.fillStyle=`rgba(210,170,110,${1-f/.6})`;ctx.fillRect(x,y,2,1.5)}
    else if(v.k==='smoke2'){ctx.fillStyle=`rgba(200,200,200,${.3*(1-f/3)})`;ctx.beginPath();ctx.arc(x,y,3+f*4,0,7);ctx.fill()}
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
  for(const e of sel)if(e.kind==='bld'&&e.rally&&e.owner===0){const r=e.rally;ctx.strokeStyle='rgba(233,190,114,.5)';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(e.x*T+e.size*T/2,e.y*T+e.size*T/2);ctx.lineTo(r.x*T,r.y*T);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e9be72';ctx.fillRect(r.x*T-1,r.y*T-14,2,14);ctx.beginPath();ctx.moveTo(r.x*T+1,r.y*T-14);ctx.lineTo(r.x*T+10,r.y*T-11);ctx.lineTo(r.x*T+1,r.y*T-8);ctx.fill()}
  // projectiles (arc above their ground shadow)
  for(const p of proj){
    if(!vis[idx(p.x|0,p.y|0)])continue;
    const tg=byId.get(p.tid),tc=p.ground?{x:p.tx,y:p.ty}:tg?center(tg):p,rem=Math.hypot(tc.x-p.x,tc.y-p.y),prog=Math.max(0,Math.min(1,1-rem/Math.max(.01,p.arc)));
    const lift=Math.sin(prog*Math.PI)*Math.min(p.arc,8)*T*(p.k==='ball'?.22:.12);
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(p.x*T,p.y*T,2.5,1.2,0,0,7);ctx.fill();
    const x=p.x*T,y=p.y*T-lift+4;
    if(p.k==='ball'){ctx.fillStyle=p.ep>=3?'#222':'#6b6b6b';ctx.beginPath();ctx.arc(x,y-6,p.ep>=3?3:4,0,7);ctx.fill()}
    else if(p.ep>=3){ctx.fillStyle='#ffe2a0';ctx.fillRect(x-1.5,y-1.5-4,3,3)}
    else if(p.ep===0&&p.k==='arrow'&&byId.get(p.src)&&byId.get(p.src).kind==='unit'){ctx.fillStyle='#8d939a';ctx.beginPath();ctx.arc(x,y-4,2,0,7);ctx.fill()}
    else{ctx.strokeStyle='#e8dcc0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-Math.cos(p.ang)*7,y-4-Math.sin(p.ang)*7);ctx.lineTo(x,y-4);ctx.stroke();ctx.lineWidth=1}
  }
  // effects
  for(const f of fx){
    if(f.t<0)continue;const x=f.x*T,y=f.y*T;
    if(f.k==='hit'){ctx.fillStyle=`rgba(255,230,180,${1-f.t/.4})`;ctx.beginPath();ctx.arc(x,y,2+f.t*10,0,7);ctx.fill()}
    else if(f.k==='boom'){ctx.fillStyle=`rgba(255,160,60,${1-f.t/.4})`;ctx.beginPath();ctx.arc(x,y,4+f.t*30,0,7);ctx.fill()}
    else if(f.k==='smoke'){ctx.fillStyle=`rgba(60,60,60,${.6*(1-f.t/1.6)})`;ctx.beginPath();ctx.arc(x,y-f.t*14,6+f.t*10,0,7);ctx.fill()}
    else if(f.k==='stuck'){ctx.strokeStyle=`rgba(230,220,190,${1-f.t/4})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(f.a)*5,y-Math.sin(f.a)*5-3);ctx.stroke();ctx.lineWidth=1}
    else if(f.k==='die'){ctx.fillStyle=`rgba(90,20,20,${.6*(1-f.t/1.2)})`;ctx.beginPath();ctx.ellipse(x,y+3,8,4,0,0,7);ctx.fill()}
  }
  // drifting cloud shadows
  for(const c of CLOUDS){const cx=((c.x+now*c.s)%(W+30)-15)*T,cy=c.y*T,r=c.r*T;
    if(cx+r<vx0||cx-r>vx0+vw||cy+r<vy0||cy-r>vy0+vh)continue;
    const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,'rgba(10,20,30,.13)');gr.addColorStop(1,'rgba(10,20,30,0)');ctx.fillStyle=gr;ctx.fillRect(cx-r,cy-r,r*2,r*2)}
  // fog
  ctx.imageSmoothingEnabled=true;ctx.drawImage(fogC,0,0,W,H,0,0,W*T,H*T);
  // placement ghost
  if(placing&&mouse.inside&&BLD[placing].line){
    const w=toWorld(mouse.x,mouse.y),tl=wallDrag?wallLine(wallDrag.x,wallDrag.y,Math.floor(w.x),Math.floor(w.y)):[[Math.floor(w.x),Math.floor(w.y)]];
    for(const [gx,gy] of tl){const ok=canPlace(0,placing,gx,gy);ctx.fillStyle=ok?'rgba(120,230,130,.32)':'rgba(240,90,80,.36)';ctx.fillRect(gx*T,gy*T,T,T)}
    if(wallDrag){ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.fillText(tl.length+' Felder · '+tl.length*(BLD[placing].cost.stone||0)+' Stein',w.x*T+12,w.y*T-8)}
  }else if(placing&&mouse.inside){
    const d=BLD[placing],w=toWorld(mouse.x,mouse.y),gx=Math.floor(w.x-d.size/2+.5),gy=Math.floor(w.y-d.size/2+.5);
    const ok=canPlace(0,placing,gx,gy);
    ctx.fillStyle=ok?'rgba(120,230,130,.28)':'rgba(240,90,80,.32)';ctx.fillRect(gx*T,gy*T,d.size*T,d.size*T);
    ctx.strokeStyle=ok?'#9ef0a0':'#ff8a7a';ctx.strokeRect(gx*T+.5,gy*T+.5,d.size*T-1,d.size*T-1);
    if(d.range){ctx.beginPath();ctx.arc((gx+d.size/2)*T,(gy+d.size/2)*T,d.range*T,0,7);ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([])}
  }
  // command marker
  if(marker&&marker.t>0){ctx.strokeStyle=marker.c;ctx.lineWidth=2;const r=(1-marker.t)*10+4;ctx.beginPath();ctx.ellipse(marker.x*T,marker.y*T,r,r*.55,0,0,7);ctx.stroke();ctx.lineWidth=1}
  // box
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(WX.night>0){ctx.fillStyle=`rgba(10,18,48,${WX.night*.42})`;ctx.fillRect(0,0,viewW,viewH)}
  if(WX.kind!=='sun'){const t=performance.now()/1000,n=WX.kind==='rain'?140:90;ctx.fillStyle=ctx.strokeStyle=WX.kind==='rain'?'rgba(190,210,235,.45)':'rgba(245,248,255,.85)';ctx.lineWidth=1;
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
let actx=null,soundOn=true;try{soundOn=localStorage.getItem('empire-xy.ton')!=='0'}catch(e){}
const sfxLast={};
const onScreen=u=>{const sx=(u.x*T-cam.x)*cam.z,sy=(u.y*T-cam.y)*cam.z;return sx>-40&&sy>-40&&sx<viewW+40&&sy<viewH+40};
function sfx(k){
  if(!soundOn)return;const now=performance.now();if(now-(sfxLast[k]||0)<({hit:90,shot:120,boom:150,chop:380,mine:420,sword:110,bell:400}[k]||60))return;sfxLast[k]=now;
  try{if(!actx)actx=new (window.AudioContext||window.webkitAudioContext)();if(actx.state==='suspended')actx.resume();}catch(e){return}
  const tone=(type,f1,f2,a,d,v,dl)=>{const t=actx.currentTime+(dl||0),o=actx.createOscillator(),g=actx.createGain();o.connect(g);g.connect(actx.destination);
    o.type=type;o.frequency.setValueAtTime(f1,t);o.frequency.exponentialRampToValueAtTime(f2,t+a+d);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);o.start(t);o.stop(t+a+d+.05)};
  const P={click:['triangle',660,520,.005,.06,.05],good:['sine',523,784,.01,.35,.08],warn:['square',220,180,.01,.3,.04],
    hit:['square',140,70,.002,.08,.03],shot:['triangle',900,300,.002,.09,.025],boom:['sawtooth',90,30,.005,.35,.07],
    chop:['square',260,120,.001,.05,.025],mine:['triangle',1500,1100,.001,.07,.02],sword:['sawtooth',2200,1400,.001,.06,.018]}[k];
  if(P){tone(...P);if(k==='sword')tone('sine',3300,3000,.001,.12,.012);return}
  if(k==='bell'){tone('sine',880,878,.003,1.1,.06);tone('sine',1320,1318,.003,.7,.03);tone('sine',2200,2198,.002,.35,.015)}
  if(k==='epoch'){// kleine Fanfare: drei Töne und ein Schlussakkord
    [[392,0],[523,.16],[659,.32]].forEach(([f,d])=>tone('sawtooth',f,f,.01,.14,.035,d));[523,659,784].forEach(f=>tone('triangle',f,f,.02,.9,.04,.5))}
}
function toast(msg,kind){
  if(kind==='good')sfx(/Willkommen in der/.test(msg)?'epoch':'good');else if(kind==='warn')sfx('warn');
  const el=document.createElement('div');el.className='toast'+(kind?' '+kind:'');el.textContent=msg;
  const box=$('#toasts');box.appendChild(el);while(box.children.length>5)box.firstChild.remove();
  setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),700)},5200);
}
function costHTML(c){return Object.keys(c).map(k=>`<b><span class="dot" style="background:${RES_COL[k]}"></span>${c[k]}</b>`).join('')}
function select(list,add){
  if(add){for(const e of list)if(!sel.includes(e))sel.push(e)}else sel=list.slice();
  // only one non-unit or foreign thing at a time
  if(sel.length>1)sel=sel.filter(e=>e.kind==='unit'&&e.owner===0).length?sel.filter(e=>e.kind==='unit'&&e.owner===0):[sel[0]];
  uiDirty=true;placing=null;aMode=false;
}
function selKey(){return sel.map(e=>e.id).join(',')+'|'+players[0].epoch+'|'+(placing||'')+(aMode?'A':'')+'|'+(sel[0]&&sel[0].kind==='bld'?(sel[0].built?1:0):'')}

function getCommands(){
  const cmds=[];if(!sel.length)return cmds;
  const pl=players[0],first=sel[0];
  if(first.owner!==0)return cmds;
  if(first.kind==='unit'){
    const workers=sel.filter(u=>u.type==='worker');
    if(workers.length){
      for(const t in BLD){const d=BLD[t],locked=(d.minEpoch||0)>pl.epoch;
        cmds[d.slot]={label:bname(d,pl.epoch),cost:d.cost,desc:d.desc,dis:locked||!canAfford(0,d.cost),need:locked?'Benötigt '+EPOCHS[d.minEpoch]:null,short:!locked&&!canAfford(0,d.cost),on:placing===t,act:()=>{placing=placing===t?null:t;uiDirty=true}}}
      cmds[14]={label:'Stopp',desc:'Aktuelle Tätigkeit abbrechen.',act:()=>{for(const u of sel)order(u,{t:'idle'})}};
    }else{
      cmds[0]={label:'Angriff­bewegung',desc:'Zum Ziel marschieren und unterwegs jeden Feind angreifen. Danach Rechtsklick auf die Karte.',on:aMode,act:()=>{aMode=!aMode;uiDirty=true}};
      cmds[1]={label:'Stopp',desc:'Halten und Befehle verwerfen.',act:()=>{for(const u of sel)order(u,{t:'idle'})}};
    }
    cmds[13]={label:'Abwählen',desc:'Auswahl aufheben (Esc).',act:()=>select([])};
  }else if(first.kind==='bld'&&first.built){
    const D=BLD[first.type];
    const tl=trainsOf(first.type);let us=0;
    for(const ut of tl){const U=UNITS[ut],locked=(U.minEpoch||0)>pl.epoch,full=U.max&&countUnits(0,ut)>=U.max;
      if(us===1&&first.type==='tc')us=2;if(us===4)us=5;
      cmds[us++]={label:uname(U,pl.epoch),cost:uCost(0,ut),desc:U.desc+' ('+U.label+')',dis:locked||full||!canAfford(0,uCost(0,ut))||first.queue.length>=6,short:!locked&&!full&&!canAfford(0,uCost(0,ut)),need:locked?'Benötigt '+EPOCHS[U.minEpoch]:full?'Höchstens '+U.max+' gleichzeitig':null,act:()=>{if(!queueUnit(first,ut))toast('Nicht genug Rohstoffe.','warn');uiDirty=true}};
    }
    // research available in this building
    const free=[];for(let i=0;i<13;i++)if(!(i<us)&&i!==1&&i!==4)free.push(i);
    const techs=Object.keys(TECHS).filter(id=>TECHS[id].at===first.type&&['open','epoch','requires','running'].includes(techState(0,id))).sort((a,b)=>(TECHS[a].epoch||0)-(TECHS[b].epoch||0));
    const seenLine=new Set();
    for(const id of techs){const t=TECHS[id],st=techState(0,id);
      if(st==='requires')continue; // show the next step of each line only
      if(!free.length)break;const slot=free.shift();
      cmds[slot]={label:t.name,cost:t.cost,desc:'Forschung: '+(t.desc||'')+' Dauer '+(t.time||30)+' s.',tech:true,
        dis:st!=='open'||!canAfford(0,t.cost)||first.queue.length>=6,short:st==='open'&&!canAfford(0,t.cost),
        need:st==='epoch'?'Benötigt '+EPOCHS[t.epoch]:st==='running'?'Wird bereits erforscht':null,
        act:()=>{if(!queueTech(first,id))toast('Nicht genug Rohstoffe.','warn');uiDirty=true}};
    }
    if(first.type==='tc'){
      if(pl.epoch<MAXEP()){const c=EPOCH_COST[pl.epoch+1];
        cmds[1]={label:EPOCHS[pl.epoch+1],cost:c,desc:'In die '+EPOCHS[pl.epoch+1]+' vorrücken. Alle Einheiten werden stärker und neue Gebäude freigeschaltet. Dauer '+EPOCH_TIME[pl.epoch+1]+' s.',dis:pl.advancing||!canAfford(0,c),short:!canAfford(0,c),need:pl.advancing?'Vorrücken läuft bereits':null,act:()=>{if(queueEpoch(first))toast('Vorrücken in die '+EPOCHS[pl.epoch+1]+' begonnen.');uiDirty=true}};
      }
    }
    if(tl.length)cmds[4]={label:'Sammelpunkt',desc:'Rechtsklick auf die Karte setzt den Sammelpunkt für neue Einheiten. Rechtsklick auf Rohstoffe schickt neue Arbeiter direkt zum Sammeln.',act:()=>toast('Rechtsklick auf die Karte setzt den Sammelpunkt.')};
    cmds[13]={label:'Abwählen',desc:'Auswahl aufheben (Esc).',act:()=>select([])};
  }else if(first.kind==='bld'){
    cmds[0]={label:'Abbrechen',desc:'Bau abbrechen und Rohstoffe teilweise zurückerhalten.',act:()=>{refund(0,mulCost(BLD[first.type].cost,.75*(1-first.prog)));kill(first,null);players[0].st.lost--;select([])}};
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
    b.disabled=!!c.dis&&!c.short;if(c.short)b.classList.add('short');if(c.tech)b.classList.add('tech');if(c.on)b.classList.add('on');
    b.addEventListener('click',()=>{if(c.need&&c.dis){toast(c.need,'warn');return}if(c.short&&c.dis){toast('Nicht genug Rohstoffe.','warn');return}sfx('click');c.act()});
    b.addEventListener('pointerenter',ev=>showTip(c,b));b.addEventListener('pointerleave',hideTip);
    box.appendChild(b);c.el=b;
  }
}
let curCmds=[];
function refreshCmds(){for(const c of curCmds){if(!c||!c.el)continue;
  if(c.cost){const pl=players[0];const sh=!canAfford(0,c.cost);c.short=sh;c.el.classList.toggle('short',sh);}
}
  // recompute disabled states cheaply
  const fresh=getCommands();fresh.forEach((c,i)=>{const o=curCmds[i];if(c&&o&&o.el){o.dis=c.dis;o.short=c.short;o.el.disabled=!!c.dis&&!c.short;o.el.classList.toggle('short',!!c.short)}});
}
function showTip(c,el){
  const tip=$('#tip');
  let need=c.need?`<div class="need">${c.need}</div>`:'';
  if(c.cost&&!canAfford(0,c.cost)){const miss=Object.keys(c.cost).filter(k=>players[0].res[k]<c.cost[k]).map(k=>RES_DE[k]).join(', ');need+=`<div class="need">Fehlt: ${miss}</div>`}
  tip.innerHTML=`<h4>${c.label.replace('­','')}</h4>${c.cost?'<div class="c" style="display:flex;gap:8px;margin-bottom:4px">'+costHTML(c.cost)+'</div>':''}<div>${c.desc||''}</div>${need}`;
  tip.hidden=false;const r=el.getBoundingClientRect(),tr=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(window.innerWidth-tr.width-8,r.left+r.width/2-tr.width/2))+'px';tip.style.top=Math.max(8,r.top-tr.height-8)+'px';
}
function hideTip(){$('#tip').hidden=true}

function buildInfo(){
  const box=$('#info');const pl=players[0];
  if(!sel.length){
    box.innerHTML=`<h2>${EPOCHS[pl.epoch]}</h2><div class="hint">Wähle Einheiten mit Linksklick oder Rahmen aus. Rechtsklick gibt Befehle. <kbd>H</kbd> springt zum Stadtzentrum, <kbd>.</kbd> wählt einen untätigen Arbeiter.</div>`;return}
  if(sel.length>1){
    const by={};for(const u of sel){const k=u.type;(by[k]=by[k]||[]).push(u)}
    const hp=sel.reduce((a,u)=>a+u.hp,0),mx=sel.reduce((a,u)=>a+u.maxhp,0);
    const nW=sel.filter(u=>u.type==='worker').length;
    box.innerHTML=`<h2>${sel.length} Einheiten</h2><div class="hp"><b style="width:${hp/mx*100}%"></b></div><div class="chips">${Object.keys(by).map(k=>`<button class="chip" data-t="${k}">${by[k].length}× ${uname(UNITS[k],pl.epoch)}</button>`).join('')}</div><div class="hint">${nW?'Bauen: Gebäude unten rechts wählen, dann auf die Karte klicken. ':''}Typ anklicken, um nur diese Einheiten zu behalten.</div>`;
    box.querySelectorAll('.chip').forEach(c=>c.onclick=()=>select(sel.filter(u=>u.type===c.dataset.t)));
    return;
  }
  const e=sel[0];
  if(e.kind==='res'){box.innerHTML=`<h2>${{tree:'Baum',berry:'Beerenstrauch',stone:'Steinbruch',gold:'Goldader'}[e.type]}</h2><div class="sub">${RES_DE[e.rt]}</div><div class="stats"><span><em>Vorrat</em><span data-live="amt">${Math.ceil(e.amount)}</span></span></div>`;return}
  const own=e.owner===0?'Dein Reich':'Feindliches Reich',ep=players[e.owner].epoch;
  if(e.kind==='unit'){
    const U=UNITS[e.type],s=uStat(e);
    const ordTxt={idle:'Untätig',guard:'Wache',move:'Unterwegs',amove:'Angriffsbewegung',attack:'Im Kampf',gather:'Sammelt '+(RES_DE[e.order.rt]||''),return:'Bringt Rohstoffe zurück',build:'Baut'}[e.order.t]||'';
    box.innerHTML=`<h2>${uname(U,ep)}</h2><div class="sub">${U.label} · ${own} · <span data-live="ord">${ordTxt}</span></div><div class="hp"><b data-live="hp" style="width:${e.hp/e.maxhp*100}%"></b></div>
    <div class="stats"><span><em>Leben</em><span data-live="hpt">${Math.ceil(e.hp)}/${e.maxhp}</span></span><span><em>Angriff</em>${s.atk.toFixed(0)}</span><span><em>Reichweite</em>${s.range<1?'Nahkampf':s.range}</span><span><em>Tempo</em>${s.speed.toFixed(1)}</span>${e.type==='worker'?`<span><em>Trägt</em><span data-live="carry">${Math.floor(e.carry)}</span></span>`:''}</div>
    ${e.type==='worker'&&e.owner===0?`<div class="hint">Bauen: Gebäude unten rechts wählen, dann auf die Karte klicken.</div>`:''}
    ${U.bonus?`<div class="hint">Stark gegen ${Object.keys(U.bonus).map(k=>UNITS[k].label).join(' und ')}.</div>`:''}`;
    return;
  }
  const D=BLD[e.type];
  let h=`<h2>${bname(D,ep)}</h2><div class="sub">${own}${e.built?'':' · im Bau'}</div><div class="hp"><b data-live="hp" style="width:${e.hp/e.maxhp*100}%"></b></div><div class="stats"><span><em>Leben</em><span data-live="hpt">${Math.ceil(e.hp)}/${e.maxhp}</span></span>${D.pop?`<span><em>Bevölkerung</em>+${D.pop}</span>`:''}${D.atk?`<span><em>Angriff</em>${(D.atk*(1+.14*ep)).toFixed(0)}</span><span><em>Reichweite</em>${D.range}</span>`:''}${!e.built?`<span><em>Fortschritt</em><span data-live="prog">${Math.floor(e.prog*100)}%</span></span>`:''}</div>`;
  if(e.owner===0&&e.queue.length){h+=`<div class="queue" data-live="queue"></div>`}
  else if(e.owner===0&&trainsOf(e.type).length)h+=`<div class="hint">Keine Ausbildung in Arbeit.</div>`;
  box.innerHTML=h;
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
  if((el=q('ord'))){const o=e.order;el.textContent={idle:'Untätig',guard:'Wache',move:'Unterwegs',amove:'Angriffsbewegung',attack:'Im Kampf',gather:'Sammelt '+(RES_DE[o.rt]||''),return:'Bringt Rohstoffe zurück',build:'Baut'}[o.t]||''}
  if(e.kind==='bld'&&e.owner===0){
    el=q('queue');
    if(e.queue.length&&!el){buildInfo();return}
    if(!e.queue.length&&el){buildInfo();return}
    if(el){
      const sig=e.queue.map(x=>x.ep?'E':x.tech||x.u).join();
      if(el.dataset.sig!==sig){el.dataset.sig=sig;el.innerHTML=e.queue.map((x,i)=>`<button class="qi" data-i="${i}" title="Klicken zum Abbrechen">${x.ep?'Epoche':x.tech?TECHS[x.tech].name.slice(0,5):uname(UNITS[x.u],players[0].epoch).slice(0,4)}<i></i></button>`).join('')+(e.queue[0].blocked?'<span class="hint">Bevölkerungslimit</span>':'');
        el.querySelectorAll('.qi').forEach(b=>b.onclick=()=>{cancelQ(e,+b.dataset.i);uiDirty=true})}
      const bar=el.querySelector('.qi i');if(bar)bar.style.width=(e.queue[0].t/e.queue[0].total*100)+'%';
      const hint=el.querySelector('.hint');if(!!e.queue[0].blocked!==!!hint)el.dataset.sig='';
    }
  }
}
function updateTop(){
  const pl=players[0];
  for(const r of RES){const el=$('#r-'+r),v=Math.floor(pl.res[r]);if(el.textContent!=v)el.textContent=v;
    const ir=incomeRate(pl,r),ie=$('#i-'+r);if(ie){const t=ir>0?'+'+ir+'/min':'';if(ie.textContent!==t)ie.textContent=t}}
  const gd=pl.goods,ge=$('#r-goods');if(ge&&gd){const L=[['wheat','Weizen'],['flour','Mehl'],['planks','Bretter'],['blocks','Quader'],['ore','Erz'],['tools','Werkzeug']].filter(([k])=>(gd[k]||0)>=1),on=L.length>0;ge.hidden=!on;if(on){const t=L.map(([k,n])=>n+' '+Math.floor(gd[k])).join(' · ');if(ge.textContent!==t){ge.textContent=t;ge.title='Waren aus deinen Produktionsketten. Werkzeug beschleunigt alle Arbeiter um '+Math.round(((pl.toolMul||1)-1)*100)+' %.'}}}
  const md=$('#r-mood');if(md){const m=Math.round(pl.mood??50),t=m+'';if(md.textContent!==t){md.textContent=t;md.style.color=m>=65?'var(--ok)':m<35?'var(--danger)':'';md.parentNode.title='Beliebtheit '+m+' von 100: '+(pl.moodWhy||'')+' Sammeltempo '+Math.round((pl.moodMul||1)*100)+' %.'}}
  const p=$('#r-pop'),pv=pl.pop+'/'+pl.cap+' Einwohner';if(p.textContent!==pv){p.textContent=pv;p.style.color=pl.pop>=pl.cap?'var(--danger)':pl.pop>=pl.cap*.9?'var(--warn,#d9a43a)':'';p.title='Einwohner / Wohnraum. Ab 90 % Belegung: Beliebtheit −5 und Produktion −15 %. Baue Wohnhäuser.'}
  const tc=ents.find(e=>e.owner===0&&e.kind==='bld'&&e.queue.some(q=>q.ep));
  const en=pl.advancing&&tc?EPOCHS[pl.epoch]+' → '+EPOCHS[pl.epoch+1]:EPOCHS[pl.epoch];
  if($('#epochName').textContent!==en)$('#epochName').textContent=en;
  const q=tc&&tc.queue.find(q=>q.ep);$('#epochBar b').style.width=(q?q.t/q.total*100:(pl.epoch/Math.max(1,MAXEP())*100))+'%';
  // research progress HUD (all running techs of the player)
  const rq=[];for(const e of ents)if(e.owner===0&&e.kind==='bld'&&!e.dead)e.queue.forEach((x,i)=>{if(x.tech)rq.push({id:x.tech,f:i===0?x.t/x.total:0,left:i===0?x.total-x.t:x.total+(i?1e9:0),wait:i>0})});
  const rh=$('#researchHud'),rsig=rq.map(r=>r.id).join();
  if(rh.dataset.sig!==rsig){rh.dataset.sig=rsig;rh.hidden=!rq.length;rh.innerHTML=rq.map(r=>`<div class="rq" data-id="${r.id}"><span>${TECHS[r.id].name}</span><em></em><i><b></b></i></div>`).join('')}
  rq.forEach((r,i)=>{const row=rh.children[i];if(!row)return;row.querySelector('b').style.width=(r.f*100)+'%';row.querySelector('em').textContent=r.wait?'wartet':Math.floor(r.f*100)+'% · '+Math.ceil(r.left)+' s'});
  if(!$('#techScreen').hidden)$('#techCols').querySelectorAll('.tk.running').forEach(btn=>{const r=rq.find(x=>x.id===btn.dataset.id);const st=btn.querySelector('.st');if(r&&st)st.textContent=r.wait?'Wartet in Warteschlange':'Wird erforscht: '+Math.floor(r.f*100)+'%';let bar=btn.querySelector('.pb');if(!bar){bar=document.createElement('i');bar.className='pb';bar.innerHTML='<b></b>';btn.appendChild(bar)}bar.firstChild.style.width=(r?r.f*100:0)+'%'});
  $('#clock').textContent=(WX.kind==='rain'?'🌧 ':WX.kind==='snow'?'❄ ':WX.night>.5?'☾ ':'☀ ')+(timeLimit?fmtTime(gameT)+' / '+timeLimit+':00':fmtTime(gameT));$('#clock').title=WXN[WX.kind]+(WX.night>.5?', Nacht: weniger Sicht, der Gegner greift eher an':'');
  const idle=ents.filter(e=>e.owner===0&&e.type==='worker'&&e.order.t==='idle').length;$('#idleN').textContent=idle;
  const wb=$('#wonderBanner');const wt=players.find(p=>p.wonderT>0);
  if(wt){wb.hidden=false;wb.textContent=(wt.i===0?'Dein Weltwunder':'Feindliches Weltwunder')+': '+fmtTime(wt.wonderT)}else wb.hidden=true;
}

// ================= input =================
const mouse={x:0,y:0,inside:false};let drag=null,placing=null,aMode=false,groups={},lastClick={t:0,id:0};
const keys=new Set();
function pickAt(wx,wy){
  let best=null,bd=1e9;
  for(const e of ents){if(e.dead||e.kind!=='unit'||!visibleEnt(e))continue;const d=Math.hypot(e.x-wx,e.y-wy);if(d<e.r+.25&&d<bd){bd=d;best=e}}
  if(best)return best;
  for(const e of ents){if(e.dead||e.kind==='unit'||!visibleEnt(e))continue;if(wx>=e.x&&wx<e.x+e.size&&wy>=e.y&&wy<e.y+e.size)return e}
  return null;
}
function rightCommand(wx,wy){
  const mine=sel.filter(e=>e.owner===0);if(!mine.length)return;
  const t=pickAt(wx,wy);
  if(mine[0].kind==='bld'){
    const b=mine[0];if(!trainsOf(b.type).length)return;
    b.rally={x:wx,y:wy,id:t&&(t.kind==='res'||(t.kind==='bld'&&t.owner===0&&(t.type==='farm'||!t.built)))?t.id:0};marker={x:wx,y:wy,t:1,c:'#e9be72'};return;
  }
  const units=mine.filter(e=>e.kind==='unit');if(!units.length)return;
  if(t&&!(t.kind==='bld'&&t.type==='farm'&&units.every(u=>u.type!=='worker')&&t.owner===0)){
    cmdTarget(units,t);marker={x:wx,y:wy,t:1,c:t.owner===1?'#ff8a7a':'#e9be72'};
    // spread workers across multiple farms or trees
  }else{cmdMove(units,wx,wy,aMode);marker={x:wx,y:wy,t:1,c:aMode?'#ff8a7a':'#9ef0a0'}}
  aMode=false;uiDirty=true;
}
let wallDrag=null;
// tiles of a wall line: straight or diagonal steps from a to b
function wallLine(ax,ay,bx,by){const out=[],n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let i=0;i<=n;i++){const t=n?i/n:0;out.push([Math.round(ax+(bx-ax)*t),Math.round(ay+(by-ay)*t)])}
  // close diagonal gaps so units cannot slip through
  const res=[];for(let i=0;i<out.length;i++){if(i&&out[i][0]!==out[i-1][0]&&out[i][1]!==out[i-1][1])res.push([out[i][0],out[i-1][1]]);res.push(out[i])}return res}
function placeLine(tiles,keep){
  const d=BLD[placing];let n=0;const bs=[];
  for(const [gx,gy] of tiles){if(!canPlace(0,placing,gx,gy))continue;if(!canAfford(0,d.cost)){toast('Nicht genug Rohstoffe für die ganze Mauer.','warn');break}
    pay(0,d.cost);bs.push(placeBld(0,placing,gx,gy,false));n++}
  if(!n)toast(d.water?'Brücken nur auf Wasser, ausgehend vom erkundeten Ufer.':'Hier kann keine Mauer gebaut werden.','warn');
  const ws=d.water?[]:sel.filter(u=>u.kind==='unit'&&u.type==='worker');
  ws.forEach((u,i)=>{const b=bs[Math.floor(i*bs.length/ws.length)];if(b)order(u,{t:'build',target:b.id})});
  if(!keep||!canAfford(0,d.cost)){placing=null;uiDirty=true}
}
function tryPlace(wx,wy,keep){
  const d=BLD[placing],gx=Math.floor(wx-d.size/2+.5),gy=Math.floor(wy-d.size/2+.5);
  if(!canPlace(0,placing,gx,gy)){toast('Hier kann nicht gebaut werden.','warn');return}
  if(!canAfford(0,d.cost)){toast('Nicht genug Rohstoffe.','warn');placing=null;uiDirty=true;return}
  pay(0,d.cost);const b=placeBld(0,placing,gx,gy,false);
  for(const u of sel)if(u.kind==='unit'&&u.type==='worker')order(u,{t:'build',target:b.id});
  if(!keep||!canAfford(0,d.cost)){placing=null;uiDirty=true}
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
  if(e.button===1){drag={pan:true,sx:mouse.x,sy:mouse.y,cx:cam.x,cy:cam.y};return}
  if(e.button===2){if(placing){placing=null;wallDrag=null;uiDirty=true;return}rightCommand(w.x,w.y);return}
  if(e.button===0){
    if(placing&&BLD[placing].line){wallDrag={x:Math.floor(w.x),y:Math.floor(w.y)};return}
    if(placing){tryPlace(w.x,w.y,e.shiftKey);return}
    if(aMode){const u=sel.filter(x=>x.kind==='unit'&&x.owner===0);if(u.length){const t=pickAt(w.x,w.y);if(t&&t.owner===1)cmdTarget(u,t);else cmdMove(u,w.x,w.y,true);marker={x:w.x,y:w.y,t:1,c:'#ff8a7a'}}aMode=false;uiDirty=true;return}
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
  const own=e.owner===0?'Dein Reich':e.owner===1?'Gegner':'',ep=e.owner>=0?players[e.owner].epoch:0;let h='';
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
        const mine=sel.filter(x=>x.owner===0);
        const now=performance.now();
        if(t&&t.kind==='unit'&&t.owner===0&&now-lastClick.t<350&&lastClick.id===t.id){const a=toWorld(0,0),b=toWorld(viewW,viewH);select(ents.filter(u=>u.kind==='unit'&&u.owner===0&&u.type===t.type&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y))}
        else if(t&&t.owner===0&&!(mine.length&&mine[0].kind==='unit'&&mine.some(u=>u.type==='worker')&&t.kind==='bld'&&(!t.built||t.type==='farm')))select([t]);
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
    const list=ents.filter(u=>u.kind==='unit'&&u.owner===0&&!u.dead&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y);
    select(list,add);
  }else{
    const w=toWorld(mouse.x,mouse.y),t=pickAt(w.x,w.y);
    const now=performance.now();
    if(t&&t.kind==='unit'&&t.owner===0&&now-lastClick.t<350&&lastClick.id===t.id){
      const a=toWorld(0,0),b=toWorld(viewW,viewH);
      select(ents.filter(u=>u.kind==='unit'&&u.owner===0&&u.type===t.type&&u.x>=a.x&&u.x<=b.x&&u.y>=a.y&&u.y<=b.y));
    }else if(t)select([t],add&&t.kind==='unit'&&t.owner===0);
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
  if(e.ctrlKey&&/^[1-9]$/.test(k)){groups[k]=sel.filter(x=>x.kind==='unit'&&x.owner===0);toast('Gruppe '+k+' gespeichert.');e.preventDefault();return}
  if(/^[1-9]$/.test(k)&&groups[k]){const g=groups[k].filter(alive);if(g.length){if(lastGroup===k&&performance.now()-lastGroupT<400)centerOn(g[0].x,g[0].y);select(g);lastGroup=k;lastGroupT=performance.now()}return}
  if(k==='h'||k==='H'){const tc=ents.find(x=>x.owner===0&&x.type==='tc');if(tc){select([tc]);centerOn(tc.x+1.5,tc.y+1.5)}return}
  if(k==='.'||k===','){selectIdle();return}
  if(k===' '){if(sel[0]){const c=center(sel[0]);centerOn(c.x,c.y)}e.preventDefault();return}
  let up=k.toUpperCase();if(up==='Z')up='Y';
  const i=SLOTKEYS.indexOf(up);
  if(i>=0&&curCmds[i]){const c=curCmds[i];if(c.need&&c.dis){toast(c.need,'warn');return}if(c.dis){toast('Nicht genug Rohstoffe.','warn');return}sfx('click');c.act()}
});
let lastGroup=null,lastGroupT=0,idleIx=0,zoomT=0,zoomAt=null;const camV={x:0,y:0};
window.addEventListener('keyup',e=>keys.delete(e.key));
window.addEventListener('blur',()=>keys.clear());
function selectIdle(){
  const idle=ents.filter(e=>e.owner===0&&e.type==='worker'&&e.order.t==='idle');
  if(!idle.length){toast('Keine untätigen Arbeiter.');return}
  const u=idle[idleIx++%idle.length];select([u]);centerOn(u.x,u.y);
}
$('#btnIdle').onclick=selectIdle;
// ---- technology tree overlay
function renderTechTree(){
  const pl=players[0],cols=$('#techCols');
  const ST={running:'Wird erforscht',open:'Verfügbar',epoch:'Benötigt neue Epoche'};
  // only the next step of every research line, grouped by building
  const next={};
  for(const id in TECHS){const st=techState(0,id);if(st==='done'||st==='requires'||st==='none')continue;const t=TECHS[id],ln=t.line||id;
    if(!next[ln]||(TECHS[next[ln]].epoch||0)>(t.epoch||0))next[ln]=id}
  const byAt={};for(const ln in next){const id=next[ln];(byAt[TECHS[id].at]=byAt[TECHS[id].at]||[]).push(id)}
  const lines=new Set(Object.values(TECHS).map(t=>t.line).filter(Boolean)),doneN=Object.keys(pl.techs).length;
  const have=t=>ents.some(e=>e.kind==='bld'&&e.owner===0&&e.type===t&&e.built&&!e.dead);
  cols.innerHTML=Object.keys(byAt).map(at=>`<div class="tcol"><h3>${BLD[at]?BLD[at].name:at}<small>${have(at)?byAt[at].length+' offen':'nicht gebaut'}</small></h3>${byAt[at].map(id=>{const t=TECHS[id];let st=techState(0,id);
    const all=Object.values(TECHS).filter(x=>t.line&&x.line===t.line).sort((a,b)=>(a.epoch||0)-(b.epoch||0)),stepN=all.indexOf(t)+1;
    const cls=st==='open'&&!have(at)?'nobld':st==='open'&&!canAfford(0,t.cost||{})?'open short':st;
    const stTxt=st==='epoch'?'ab '+EPOCHS[t.epoch]:st==='running'?'läuft':!have(at)?'Gebäude fehlt':cls==='open short'?'zu teuer':'Verfügbar';
    return `<button class="tk ${cls}" data-id="${id}" ${st==='open'?'':'tabindex="-1"'}><b>${t.name}</b>${all.length?`<span class="lv">Stufe ${stepN}/${all.length}</span>`:''}<span class="ds">${t.desc||''}</span>${all.length>1?`<span class="pips">${all.map((x,i)=>`<i class="${i<stepN-1?'on':i===stepN-1?'cur':''}"></i>`).join('')}</span>`:''}<span class="c">${costHTML(t.cost||{})} · ${t.time||30} s</span><span class="st">${stTxt}</span></button>`}).join('')}</div>`).join('')
    +(Object.keys(byAt).length?'':'<p class="hint">Alles erforscht.</p>');
  $('#techScreen .hint').textContent='Hier siehst du nur, was du als Nächstes erforschen kannst. Ist eine Stufe fertig, erscheint die nächste. Bisher erforscht: '+doneN+'.';
  cols.querySelectorAll('.tk.open').forEach(b=>b.onclick=()=>{
    const id=b.dataset.id,t=TECHS[id];
    const bs=ents.filter(e=>e.kind==='bld'&&e.owner===0&&e.type===t.at&&e.built&&!e.dead).sort((a,c)=>a.queue.length-c.queue.length);
    if(!bs.length){toast('Dafür brauchst du zuerst: '+(BLD[t.at]?BLD[t.at].name:t.at)+'.','warn');return}
    if(!canAfford(0,t.cost)){toast('Nicht genug Rohstoffe.','warn');return}
    queueTech(bs[0],id);toast('Forschung gestartet: '+t.name+'.','good');renderTechTree();uiDirty=true;
  });
}
function toggleTech(show){const el=$('#techScreen');el.hidden=show===undefined?!el.hidden:!show;if(!el.hidden)renderTechTree()}
$('#btnTech').onclick=()=>{if(started&&!over)toggleTech()};
$('#techClose').onclick=()=>toggleTech(false);
$('#btnBuild').onclick=()=>{
  if(!started||over)return;
  if(sel.some(u=>u.type==='worker'&&u.owner===0)){select(sel.filter(u=>u.type==='worker'));return}
  const ws=ents.filter(e=>e.owner===0&&e.type==='worker'&&!e.dead);
  if(!ws.length){toast('Du hast keine Arbeiter. Bilde im Stadtzentrum welche aus.','warn');return}
  const u=ws.find(w=>w.order.t==='idle')||ws[0];select([u]);centerOn(u.x,u.y);
  toast('Wähle unten rechts ein Gebäude und tippe dann auf die Karte.');
};
function togglePause(){paused=!paused;$('#btnPause').textContent=paused?'Weiter':'Pause'}
$('#btnPause').onclick=()=>{if(started&&!over)togglePause()};
// Diplomatie (wie AoE2): Tribut in einer Wahl-Ressource oder Waffenstillstand gegen Gold
const RESN={food:'Nahrung',wood:'Holz',stone:'Stein',gold:'Gold'};
function diploRender(){
  if($('#diploPanel').hidden)return;const n=aiS.tributes||0,amt=Math.round(100*Math.pow(1.4,n)),pl=players[0];
  const peace=aiS.peaceUntil>gameT;
  $('#diploState').textContent=peace?'Waffenstillstand noch '+fmtTime(aiS.peaceUntil-gameT)+'.':aiS.attacking?'Der Gegner greift gerade an.':'Nächster Angriff frühestens in '+fmtTime(Math.max(0,aiS.nextAttack-gameT))+'.';
  $('#diploTrib').innerHTML=['food','wood','stone','gold'].map(r=>`<button class="tbtn" data-trib="${r}"${pl.res[r]<amt?' disabled':''}>${amt} ${RESN[r]}</button>`).join('');
  const pc=Math.round(400*Math.pow(1.6,aiS.peaces||0));$('#diploPeace').textContent='Waffenstillstand für '+pc+' Gold';$('#diploPeace').disabled=peace||pl.res.gold<pc;$('#diploWar').hidden=!peace;$('#diploPeace').hidden=peace;
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
$('#diploWar').onclick=()=>{if(!(aiS.peaceUntil>gameT))return;aiS.peaceUntil=0;aiS.nextAttack=gameT+20;
  for(const pl of players)if(pl.mood!=null&&pl.i===0)pl.mood=Math.max(0,pl.mood-10);
  toast('Du hast den Krieg erklärt. Der Gegner rüstet sich zum Gegenschlag.','warn');sfx('warn');diploRender()};
$('#btnTribute').onclick=()=>{if(!started||over)return;$('#savePanel').hidden=true;$('#diploPanel').hidden=!$('#diploPanel').hidden;diploRender()};
setInterval(diploRender,1000);
$('#btnSound').textContent=soundOn?'Ton an':'Ton aus';$('#btnSound').onclick=()=>{soundOn=!soundOn;try{localStorage.setItem('empire-xy.ton',soundOn?'1':'0')}catch(e){}$('#btnSound').textContent=soundOn?'Ton an':'Ton aus';sfx('click')};

// ================= main loop =================
let last=performance.now(),acc=0;
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(started&&!paused&&!over){
    acc+=dt;let n=0;while(acc>=DT&&n<5){step(DT);acc-=DT;n++}if(n>=5)acc=0;
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
    saveT+=dt;if(saveT>30&&!paused){saveT=0;saveGame()}
    if(!paused){for(const v of vfx){v.t+=dt;v.x+=v.vx*dt;v.y+=v.vy*dt;if(v.k==='chip')v.vy+=4*dt}vfx=vfx.filter(v=>v.t<(v.k==='smoke2'?3:v.k==='chip'?.6:.8))}
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
  if(!started||over||!ents)return false;key=typeof key==='string'?key:SAVE_KEY;
  try{
    const data={v:1,seed:curSeed,diff,epStart,epEnd,timeLimit,WX,gameT,nextId,bases,aiS,players,terr:Array.from(terr),exp:Array.from(exp),
      ents:ents.filter(e=>!e.dead),cam:{x:cam.x,y:cam.y,z:cam.z},saved:Date.now()};
    localStorage.setItem(key,JSON.stringify(data));return true;
  }catch(e){return false}
}
function readSave(key){try{const d=JSON.parse(localStorage.getItem(key||SAVE_KEY));return d&&d.v===1?d:null}catch(e){return null}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY)}catch(e){}}
function loadGame(d){
  syncRegistry();rng=mulberry32(d.seed);curSeed=d.seed;diff=d.diff;epStart=d.epStart||0;epEnd=d.epEnd!==undefined?d.epEnd:99;timeLimit=d.timeLimit||0;if(d.WX)WX=d.WX;
  terr=Uint8Array.from(d.terr);exp=Uint8Array.from(d.exp);vis=new Uint8Array(W*H);block=new Int32Array(W*H);gate=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++)if(terr[i]===1)block[i]=-1;
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
const EPOCHS_NAME=d=>{if(!XY.epochs.length)XY.build();const e=XY.epochs[d.players[0].epoch];return e?e.name:''};
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
$('#startBtn').onclick=()=>{timeLimit=+$('#limitSel').value;
  $('#startScreen').hidden=true;resize();newGame(chosenDiff,seed);started=true;paused=false;$('#btnPause').textContent='Pause';
};
$('#againBtn').onclick=()=>{showContinue();$('#endScreen').hidden=true;started=false;over=false;seed=(Math.random()*99999)|0;$('#seedN').textContent=seed;$('#startScreen').hidden=false};
window.addEventListener('resize',resize);
resize();showContinue();requestAnimationFrame(frame);

// test hooks (headless checks)
function autoPlayer(){ // lets the player side be run by the same AI for soak tests
  const save=players;const swap=e=>{if(e.owner===0)e.owner=1;else if(e.owner===1)e.owner=0};
  for(const e of ents)swap(e);players=[save[1],save[0]];players[0].i=0;players[1].i=1;const b=bases;bases=[b[1],b[0]];
  const a=aiS;aiS=window.__ai0||(window.__ai0={t:0,nextAttack:DIFF[diff].firstAttack,wave:DIFF[diff].wave,attacking:false});
  try{aiThink()}finally{window.__ai0=aiS;aiS=a;for(const e of ents)swap(e);players=save;players[0].i=0;players[1].i=1;bases=b}
}
window.__ex={start:(d,s)=>{newGame(d,s);started=true},step:n=>{for(let i=0;i<n&&!over;i++)step(DT)},get:()=>({t:gameT,over,players,ents})};
window.__spawn=(p,t,x,y)=>spawnUnit(p,t,x,y);window.__place=(p,t,x,y)=>placeBld(p,t,x,y,true);window.__can=(p,t,x,y)=>canPlace(p,t,x,y);window.__water=(x,y)=>terr[idx(x|0,y|0)]===1;window.__cam=(x,y)=>{cam.x=x*T;cam.y=y*T};window.__move=(u,x,y)=>cmdMove([u],x,y,false);window.__limit=m=>{timeLimit=m};window.__placeU=(p,t,x,y)=>placeBld(p,t,x,y,false);
})();
