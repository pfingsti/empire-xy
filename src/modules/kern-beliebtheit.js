// Kern-Baustein: Beliebtheit (nach Stronghold, Caesar und Tropico).
// Volle Speicher, Märkte und Tempel machen das Volk zufrieden; Hunger, Enge und Krieg verärgern es.
// Die Beliebtheit (0–100) ändert das Sammeltempo aller Arbeiter zwischen 75 % und 125 %.
// Realistische Darstellung von Marktplatz und Tempel (gezeichnet einmal pro Epoche und Spieler, dann zwischengespeichert)
const BELIEB_GFX=(()=>{
  const rng=s=>()=>((s=(s*1664525+1013904223)>>>0)/4294967296);
  const quad=(g,p)=>{g.beginPath();p.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.closePath();g.fill()};
  // Quaderwerk: Steinlagen mit versetzten Fugen und Farbvarianz
  function ashlar(g,x0,y0,x1,y1,col,a,rn,bh){
    bh=bh||3.2;const gr=g.createLinearGradient(x0,y0,x1,y1);gr.addColorStop(0,a.shade(col,14));gr.addColorStop(1,a.shade(col,-30));g.fillStyle=gr;g.fillRect(x0,y0,x1-x0,y1-y0);
    let r=0;for(let y=y1;y>y0;y-=bh,r++){let x=x0-(r%2?2:0);while(x<x1){const w=3.5+rn()*4,v=rn();g.fillStyle=v<.5?`rgba(0,0,0,${.04+rn()*.1})`:`rgba(255,244,220,${.03+rn()*.08})`;
      g.fillRect(Math.max(x0,x),Math.max(y0,y-bh),Math.min(w,x1-Math.max(x0,x)),Math.min(bh,y-y0));g.fillStyle='rgba(30,24,16,.32)';if(x>x0)g.fillRect(x,Math.max(y0,y-bh),.5,Math.min(bh,y-y0));x+=w}
      g.fillStyle='rgba(30,24,16,.3)';g.fillRect(x0,y-.5,x1-x0,.5);g.fillStyle='rgba(255,244,220,.12)';g.fillRect(x0,y-bh,x1-x0,.4)}
    const sg=g.createLinearGradient(0,y1-6,0,y1);sg.addColorStop(0,'rgba(50,40,24,0)');sg.addColorStop(1,'rgba(50,40,24,.35)');g.fillStyle=sg;g.fillRect(x0,y1-6,x1-x0,6)}
  // Spitzbogenfenster mit Bleiverglasung und Steingewände
  function lancet(g,cx,yb,w,h,a,col){
    const arch=(x,y,ww,hh)=>{g.beginPath();g.moveTo(x-ww/2,y);g.lineTo(x-ww/2,y-hh+ww*.8);g.quadraticCurveTo(x-ww/2,y-hh,x,y-hh-ww*.15);g.quadraticCurveTo(x+ww/2,y-hh,x+ww/2,y-hh+ww*.8);g.lineTo(x+ww/2,y);g.closePath()};
    g.fillStyle=a.shade(col,22);arch(cx,yb+.6,w+2,h+1.6);g.fill();
    const gl=g.createLinearGradient(0,yb-h,0,yb);gl.addColorStop(0,'#3c4a5a');gl.addColorStop(1,'#232a33');g.fillStyle=gl;arch(cx,yb,w,h);g.fill();
    const cols=['rgba(150,60,50,.75)','rgba(70,100,150,.7)','rgba(190,150,70,.7)'];for(let k=0;k<4;k++){g.fillStyle=cols[(cx*3+k)%3|0];g.fillRect(cx-w/2+.5+(k%2)*(w/2-.5),yb-h+2+k*(h-3)/4,w/2-.5,1.2)}
    g.fillStyle='rgba(20,20,22,.7)';g.fillRect(cx-.25,yb-h+1,.5,h-1);g.fillRect(cx-w/2,yb-h*.45,w,.4);
    g.fillStyle='rgba(0,0,0,.35)';g.fillRect(cx-w/2-1,yb+.6,w+2,.7)}
  function market(g,S,ep,pc,a){
    const bx=4,by=36,x1=bx+S,y1=by+S,rn=rng(4711+ep*97),modern=ep>=7,cx=bx+S/2;
    // unregelmäßiger Platzrand (Superellipse mit Zittern)
    const pts=[];for(let k=0;k<28;k++){const t=k/28*Math.PI*2,c=Math.cos(t),s=Math.sin(t),j=S/2-3-rn()*3.5;
      pts.push([cx+Math.sign(c)*Math.pow(Math.abs(c),.45)*j,by+S/2+Math.sign(s)*Math.pow(Math.abs(s),.45)*j])}
    const path=()=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()};
    g.fillStyle='rgba(84,70,50,.45)';g.save();g.translate(cx,by+S/2);g.scale(1.04,1.04);g.translate(-cx,-by-S/2);path();g.fill();g.restore();
    g.save();path();g.clip();
    g.fillStyle=modern?'#5f5b54':'#544b3f';g.fillRect(bx,by,S,S);
    if(modern){for(let y=by;y<y1;y+=7)for(let x=bx+((y-by)/7%2?5:0)-5;x<x1;x+=10){const v=(rn()-.5)*16;g.fillStyle=a.shade('#8d8a82',v|0);g.fillRect(x+.6,y+.6,8.8,5.8);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(x+.6,y+.6,8.8,.8);
        if(rn()<.08){g.strokeStyle='rgba(30,30,30,.4)';g.lineWidth=.4;g.beginPath();g.moveTo(x+2,y+1);g.lineTo(x+5,y+3.5);g.lineTo(x+8,y+4);g.stroke()}}}
    else{const pal=['#8c8273','#978c7a','#81786a','#a09482','#776e61','#8a7f6b','#93876f'];let row=0;
      for(let y=by-1;y<y1+3;y+=2.8,row++)for(let x=bx-3+(row%2?2:0);x<x1+3;x+=4){const px=x+(rn()-.5)*1,py=y+(rn()-.5)*.6,rx=1.55+rn()*.45,ry=1.05+rn()*.25;
        g.fillStyle=pal[(rn()*pal.length)|0];g.beginPath();g.ellipse(px,py,rx,ry,(rn()-.5)*.4,0,7);g.fill();
        g.fillStyle='rgba(255,246,225,.12)';g.beginPath();g.ellipse(px-.4,py-.35,rx*.55,ry*.42,0,0,7);g.fill();
        g.fillStyle='rgba(0,0,0,.16)';g.beginPath();g.ellipse(px+.2,py+.55,rx*.85,ry*.45,0,0,Math.PI);g.fill()}}
    // Abnutzung: Schmutz, Feuchte, Moos in den Fugen zum Rand hin
    for(let k=0;k<26;k++){const px=bx+rn()*S,py=by+rn()*S;g.fillStyle=`rgba(${rn()<.5?'60,46,28':'40,44,30'},${.06+rn()*.1})`;g.beginPath();g.ellipse(px,py,3+rn()*8,2+rn()*4,rn()*3,0,7);g.fill()}
    const eg=g.createRadialGradient(cx,by+S/2,S*.3,cx,by+S/2,S*.62);eg.addColorStop(0,'rgba(60,70,36,0)');eg.addColorStop(1,'rgba(60,70,36,.45)');g.fillStyle=eg;g.fillRect(bx,by,S,S);
    g.restore();
    // Grasbüschel über dem Rand
    for(const [px,py] of pts){for(let k=0;k<3;k++){const gx=px+(rn()-.5)*5,gy=py+(rn()-.5)*3;g.strokeStyle=rn()<.5?'rgba(78,92,44,.85)':'rgba(104,112,58,.8)';g.lineWidth=.7;g.beginPath();g.moveTo(gx,gy);g.lineTo(gx+(rn()-.5)*2,gy-2-rn()*2);g.stroke()}}
    const items=[];
    // Gegenstände nach Bodenlinie sortiert zeichnen (hinten zuerst)
    const barrel=(x,y)=>{g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(x+3,y+1,4.5,1.8,0,0,7);g.fill();
      const bg=g.createLinearGradient(x-3,0,x+3,0);bg.addColorStop(0,'#8a6a44');bg.addColorStop(.45,'#6e5232');bg.addColorStop(1,'#43311d');g.fillStyle=bg;g.fillRect(x-3,y-7,6,7);g.beginPath();g.ellipse(x,y,3,1.2,0,0,Math.PI);g.fill();
      g.fillStyle='#2f2a24';g.fillRect(x-3,y-6,6,.7);g.fillRect(x-3,y-2,6,.7);g.fillStyle='#7b5e3c';g.beginPath();g.ellipse(x,y-7,3,1.2,0,0,7);g.fill();g.strokeStyle='rgba(40,28,16,.6)';g.lineWidth=.4;g.stroke()};
    const crate=(x,y,w)=>{w=w||6;g.fillStyle='rgba(8,14,6,.3)';quad(g,[[x+w,y-4],[x+w+4,y-2],[x+w+4,y+1.5],[x+2,y+1.5],[x,y]]);
      g.fillStyle='#9a7a4e';g.fillRect(x,y-7,w,3);g.fillStyle='#6f5434';g.fillRect(x,y-4,w,4);g.fillStyle='rgba(40,26,12,.55)';g.fillRect(x,y-2.2,w,.4);g.fillRect(x+.6,y-4,.5,4);g.fillRect(x+w-1.1,y-4,.5,4);g.fillStyle='rgba(60,40,20,.5)';g.fillRect(x,y-5.5,w,.4)};
    const sack=(x,y,c)=>{g.fillStyle='rgba(8,14,6,.28)';g.beginPath();g.ellipse(x+2,y+.5,4,1.5,0,0,7);g.fill();a.blob(g,x,y-2.5,3.2,a.shade(c,22),c,a.shade(c,-40));g.fillStyle=a.shade(c,-30);g.fillRect(x-.8,y-6.5,1.6,1.6);g.fillStyle=a.shade(c,10);g.beginPath();g.ellipse(x,y-7,1.4,.8,0,0,7);g.fill()};
    const wares=(sx,sy,w,kind)=>{
      if(kind===0){for(let k=0;k<3;k++){const px=sx+5+k*9,py=sy-8.2;g.fillStyle='#6e5230';g.beginPath();g.ellipse(px,py,4,2.3,0,0,7);g.fill();g.strokeStyle='rgba(40,26,12,.5)';g.lineWidth=.4;g.beginPath();g.ellipse(px,py+.3,4,2.1,0,0,Math.PI);g.stroke();
        const fc=[['#8e3226','#a8452e'],['#5f7032','#748540'],['#b39a6c','#c8b282']][k];for(let f=0;f<6;f++){const fx=px+(f%3-1)*2,fy=py-.6+(f>2?.9:-.3);g.fillStyle=fc[f%2];g.beginPath();g.arc(fx,fy,1.15,0,7);g.fill();g.fillStyle='rgba(255,240,220,.35)';g.fillRect(fx-.6,fy-.7,.6,.5)}}}
      else if(kind===1){for(let k=0;k<5;k++){const px=sx+4+k*5,py=sy-7;const jg=g.createLinearGradient(px-2,0,px+2,0);jg.addColorStop(0,'#b87048');jg.addColorStop(1,'#6e3a22');g.fillStyle=jg;g.beginPath();g.ellipse(px,py-1.6,2,2.5,0,0,7);g.fill();g.fillRect(px-.8,py-5.2,1.6,1.8);g.fillStyle='#5a2e1a';g.beginPath();g.ellipse(px,py-5.3,1,.4,0,0,7);g.fill();g.fillStyle='rgba(255,230,200,.3)';g.fillRect(px-1.3,py-2.8,.6,1.6)}}
      else if(kind===2){const cs=['#5e4462','#46596e','#8a6a3a','#743a2e','#5b6a44'];for(let k=0;k<5;k++){const py=sy-10+(k%2)*1.8,px=sx+2+k*5.2;g.fillStyle=cs[k];g.fillRect(px,py,4.6,3.6);g.fillStyle='rgba(255,240,220,.22)';g.fillRect(px,py,4.6,.9);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(px,py+2.8,4.6,.8)}}
      else{for(let k=0;k<4;k++){const px=sx+4+k*6.5,py=sy-8;if(k%2){g.fillStyle='#c9a85e';g.beginPath();g.ellipse(px,py,2.8,1.6,0,0,7);g.fill();g.fillStyle='#a8873e';g.fillRect(px-2.8,py,5.6,1.2);g.fillStyle='rgba(255,250,220,.3)';g.fillRect(px-1.5,py-1,2,.5)}
        else{g.fillStyle='#9a6a36';g.beginPath();g.ellipse(px,py,3,1.7,0,0,7);g.fill();g.strokeStyle='rgba(60,36,16,.6)';g.lineWidth=.4;g.beginPath();for(let q=-1;q<=1;q++){g.moveTo(px+q*1.2-.5,py-1);g.lineTo(px+q*1.2+.5,py+.8)}g.stroke();g.fillStyle='rgba(255,230,180,.25)';g.fillRect(px-1.6,py-1.2,2,.5)}}}};
    const stall=(sx,sy,w,dye,kind)=>{
      g.fillStyle='rgba(8,14,6,.32)';quad(g,[[sx+w+3,sy-24],[sx+w+12,sy-17],[sx+w+12,sy+5],[sx+8,sy+5],[sx,sy]]);
      const post=(x,y0,y1)=>{g.fillStyle='#4e3822';g.fillRect(x,y1,1.6,y0-y1);g.fillStyle='rgba(255,230,190,.2)';g.fillRect(x,y1,.5,y0-y1)};
      post(sx+1,sy-9,sy-27);post(sx+w-2.6,sy-9,sy-27);
      const tg=g.createLinearGradient(0,sy-11,0,sy-6);tg.addColorStop(0,'#7a5c3c');tg.addColorStop(1,'#8e6e48');g.fillStyle=tg;g.fillRect(sx,sy-11,w,5);
      g.fillStyle='rgba(40,26,12,.4)';g.fillRect(sx,sy-9.4,w,.4);g.fillRect(sx,sy-7.6,w,.4);
      wares(sx,sy,w,kind);
      const sh=g.createLinearGradient(0,sy-13,0,sy-7);sh.addColorStop(0,'rgba(0,0,0,.35)');sh.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=sh;g.fillRect(sx,sy-13,w,6);
      g.fillStyle='#5a4029';g.fillRect(sx,sy-6,w,6);g.fillStyle='rgba(30,18,8,.35)';for(let k=1;k<w;k+=6.5)g.fillRect(sx+k,sy-6,.4,6);g.fillRect(sx,sy-3.2,w,.4);g.fillStyle='rgba(255,230,190,.15)';g.fillRect(sx,sy-6,w,.6);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(sx,sy-.8,w,.8);
      post(sx-1,sy,sy-20);post(sx+w-.6,sy,sy-20);
      // Plane aus Leinen: Bahnen aus gefärbtem und ungefärbtem Tuch, durchhängende Vorderkante, Volant
      const L=sx-3,R=sx+w+3,bt=sy-28,ft=sy-20;
      g.save();g.beginPath();g.moveTo(L,bt);g.lineTo(R,bt);g.lineTo(R+1,ft);g.quadraticCurveTo((L+R)/2,ft+2.4,L-1,ft);g.closePath();g.clip();
      for(let x=L-1,k=0;x<R+1;x+=3.6,k++){g.fillStyle=k%2?'#b6aa8a':dye;g.fillRect(x,bt,3.6,ft-bt+3)}
      const ag=g.createLinearGradient(0,bt,0,ft+2);ag.addColorStop(0,'rgba(255,246,224,.22)');ag.addColorStop(.6,'rgba(0,0,0,0)');ag.addColorStop(1,'rgba(0,0,0,.22)');g.fillStyle=ag;g.fillRect(L-1,bt,R-L+2,ft-bt+3);
      for(let x=L+1.8;x<R;x+=3.6){g.fillStyle='rgba(0,0,0,.07)';g.fillRect(x,bt,.5,ft-bt+3)}
      for(let k=0;k<3;k++){g.fillStyle='rgba(70,52,30,.12)';g.beginPath();g.ellipse(L+rn()*(R-L),bt+rn()*(ft-bt),1.5+rn()*2,1+rn(),0,0,7);g.fill()}
      g.restore();
      g.fillStyle='rgba(255,250,235,.25)';g.fillRect(L,bt,R-L,.6);
      g.fillStyle=a.shade(dye,-28);for(let x=L-1;x<R+1;x+=3.6){const yy=ft+2.4*(1-Math.pow((x+1.8-(L+R)/2)/((R-L)/2),2));g.beginPath();g.moveTo(x,yy-.6);g.lineTo(x+3.6,yy-.6);g.arc(x+1.8,yy+.2,1.8,0,Math.PI);g.closePath();g.fill()}};
    const dyes=['#7e3a2c','#3f5670','#9a7a3a','#556240'];
    const yTop=by+33,yBot=by+S-9;
    items.push([by+21,()=>{barrel(cx-5,by+21);barrel(cx+1,by+22);crate(cx+5,by+23,6)}]);
    items.push([yTop,()=>{stall(bx+9,yTop,27,dyes[0],0);crate(bx+38,yTop+2,5);sack(bx+6,yTop+3,'#b4a07a')}]);
    items.push([yTop+.1,()=>{stall(x1-37,yTop,27,dyes[1],1);sack(x1-6,yTop+3,'#a89270');sack(x1-9,yTop+5,'#b8a682')}]);
    items.push([by+S/2+8,()=>{// Brunnen mit Steinkranz, Wasserspiegel, Winde und Schindeldach
      const wy=by+S/2+8,rw=8.5,rh=4.6,hw=4.5,top=wy-hw-17;
      g.fillStyle='rgba(8,14,6,.34)';quad(g,[[cx-rw,wy],[cx+rw+2,wy-hw-17],[cx+rw+14,wy-hw-9],[cx+rw+12,wy+4],[cx-rw+6,wy+4]]);
      const wg=g.createLinearGradient(cx-rw,0,cx+rw,0);wg.addColorStop(0,'#aaa08c');wg.addColorStop(.5,'#8b8170');wg.addColorStop(1,'#5a5348');g.fillStyle=wg;g.fillRect(cx-rw,wy-hw,rw*2,hw);g.beginPath();g.ellipse(cx,wy,rw,rh,0,0,Math.PI);g.fill();
      g.strokeStyle='rgba(30,24,16,.4)';g.lineWidth=.5;g.beginPath();g.ellipse(cx,wy-hw/2,rw,rh,0,.05,Math.PI-.05);g.stroke();for(let k=-3;k<=3;k++){const t=k/3.6;g.beginPath();g.moveTo(cx+t*rw,wy-hw+Math.sqrt(1-t*t)*rh+(k%2?0:hw/2));g.lineTo(cx+t*rw,wy-hw/2+Math.sqrt(1-t*t)*rh+(k%2?0:hw/2));g.stroke()}
      g.fillStyle='#b3a994';g.beginPath();g.ellipse(cx,wy-hw,rw,rh,0,0,7);g.fill();
      const wat=g.createRadialGradient(cx-1,wy-hw-1,.5,cx,wy-hw,rw-2);wat.addColorStop(0,'#3d5458');wat.addColorStop(1,'#1a2426');g.fillStyle=wat;g.beginPath();g.ellipse(cx,wy-hw+.3,rw-2.2,rh-1.5,0,0,7);g.fill();
      g.fillStyle='rgba(200,225,235,.35)';g.beginPath();g.ellipse(cx-2,wy-hw-.4,2,.6,0,0,7);g.fill();
      for(const s of [-1,1]){const px=cx+s*(rw-1.2);g.fillStyle='#4e3822';g.fillRect(px-.8,top,1.6,wy-hw-top+1);g.fillStyle='rgba(255,230,190,.2)';g.fillRect(px-.8,top,.5,wy-hw-top)}
      g.fillStyle='#5a4128';g.fillRect(cx-rw,top+3,rw*2,1.4);g.strokeStyle='#8a7a5a';g.lineWidth=.5;g.beginPath();g.moveTo(cx+2,top+4.4);g.lineTo(cx+2,wy-hw-5);g.stroke();
      g.fillStyle='#6a4a2a';g.fillRect(cx+.6,wy-hw-5.5,2.8,2.6);g.fillStyle='#2a2a2a';g.fillRect(cx+.6,wy-hw-5.5,2.8,.4);
      const rl=a.shade(a.roof,0);g.fillStyle=a.shade(a.roof,-30);quad(g,[[cx-rw-3,top+1],[cx,top-6],[cx+rw+3,top+1]]);
      const rg=g.createLinearGradient(0,top-6,0,top+3);rg.addColorStop(0,a.shade(a.roof,24));rg.addColorStop(1,a.shade(a.roof,-14));g.fillStyle=rg;quad(g,[[cx-rw-4,top+3],[cx+rw+4,top+3],[cx+rw+2,top-4],[cx-rw-2,top-4]]);
      g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=.5;g.beginPath();for(let y=top-2.2;y<top+3;y+=1.8){g.moveTo(cx-rw-3,y);g.lineTo(cx+rw+3,y)}g.stroke();g.fillStyle=a.shade(a.roof,40);g.fillRect(cx-rw-2,top-4.6,rw*2+4,.8);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(cx-rw-4,top+3,rw*2+8,.8)}]);
    items.push([by+S/2+12,()=>{// Handkarren mit Speichenrad
      const hx=bx+12,hy=by+S/2+12;g.fillStyle='rgba(8,14,6,.3)';quad(g,[[hx,hy],[hx+14,hy],[hx+18,hy+3],[hx+4,hy+3]]);
      g.fillStyle='#6a4e30';g.fillRect(hx,hy-7,12,4);g.fillStyle='#86663f';g.fillRect(hx,hy-8.5,12,1.6);g.strokeStyle='#4a3420';g.lineWidth=.8;g.beginPath();g.moveTo(hx+12,hy-5);g.lineTo(hx+19,hy-1);g.stroke();
      sack(hx+4,hy-7,'#b4a07a');sack(hx+8,hy-7.5,'#a89270');
      g.strokeStyle='#3e2c1a';g.lineWidth=1;g.beginPath();g.arc(hx+4,hy-2,3,0,7);g.stroke();g.lineWidth=.4;g.beginPath();for(let k=0;k<4;k++){const t=k*Math.PI/4;g.moveTo(hx+4-Math.cos(t)*3,hy-2-Math.sin(t)*3);g.lineTo(hx+4+Math.cos(t)*3,hy-2+Math.sin(t)*3)}g.stroke()}]);
    items.push([yBot,()=>{stall(bx+9,yBot,27,dyes[2],2);barrel(bx+5,yBot+3)}]);
    items.push([yBot+.1,()=>{stall(x1-37,yBot,27,dyes[3],3);crate(x1-9,yBot+3,6)}]);
    items.sort((p,q)=>p[0]-q[0]).forEach(i=>i[1]());
    a.banner(g,x1-5,by+S/2+4,pc,22);
  }
  function stones(g,S,a,rn){
    const bx=4,by=36,cx=bx+S/2,cy=by+S/2+8;
    g.fillStyle='rgba(104,90,64,.4)';g.beginPath();g.ellipse(cx,cy,S*.46,S*.3,0,0,7);g.fill();
    const list=[];for(let k=0;k<9;k++){const t=-Math.PI/2+k/9*Math.PI*2;list.push({x:cx+Math.cos(t)*S*.36,y:cy+Math.sin(t)*S*.22,h:13+rn()*9,w:5.5+rn()*2.5})}
    // Altarstein in der Mitte
    list.push({x:cx,y:cy+2,altar:1});
    for(const s of list)if(!s.altar){g.fillStyle='rgba(8,14,6,.3)';quad(g,[[s.x-s.w/2,s.y],[s.x+s.w/2,s.y],[s.x+s.w/2+s.h*.55,s.y+s.h*.22],[s.x-s.w/2+s.h*.55,s.y+s.h*.22]])}
    list.sort((p,q)=>p.y-q.y);
    for(const s of list){
      if(s.altar){g.fillStyle='rgba(8,14,6,.3)';g.beginPath();g.ellipse(s.x+4,s.y+2,9,3,0,0,7);g.fill();g.fillStyle='#6a665d';g.fillRect(s.x-8,s.y-3,16,3);g.beginPath();g.ellipse(s.x,s.y,8,2,0,0,Math.PI);g.fill();g.fillStyle='#8f8a7e';g.beginPath();g.ellipse(s.x,s.y-3,8,2.6,0,0,7);g.fill();g.fillStyle='rgba(120,40,30,.35)';g.beginPath();g.ellipse(s.x+1,s.y-3,2.5,.9,0,0,7);g.fill();continue}
      const p=[[s.x-s.w/2,s.y],[s.x-s.w/2+rn()*1.2,s.y-s.h*.7],[s.x-s.w/2+1+rn(),s.y-s.h],[s.x+(rn()-.3)*1.5,s.y-s.h-1.5],[s.x+s.w/2-rn(),s.y-s.h+1],[s.x+s.w/2-rn()*.8,s.y-s.h*.5],[s.x+s.w/2,s.y]];
      const tn=['#8f8a7f','#7f7b72','#968c7c','#77746c'][(rn()*4)|0],gr=g.createLinearGradient(s.x-s.w/2,s.y-s.h,s.x+s.w/2,s.y);gr.addColorStop(0,a.shade(tn,24));gr.addColorStop(.45,tn);gr.addColorStop(1,a.shade(tn,-42));g.fillStyle=gr;quad(g,p);
      g.fillStyle='rgba(255,250,235,.18)';g.fillRect(p[2][0],p[2][1],2.5,1);
      g.strokeStyle='rgba(30,28,24,.45)';g.lineWidth=.45;g.beginPath();g.moveTo(s.x-1,s.y-s.h*.8);g.lineTo(s.x+.6,s.y-s.h*.55);g.lineTo(s.x-.3,s.y-s.h*.35);g.stroke();
      for(let k=0;k<4;k++){g.fillStyle=k%3?'rgba(190,186,120,.6)':'rgba(186,124,60,.45)';g.beginPath();g.arc(s.x+(rn()-.5)*s.w*.7,s.y-rn()*s.h*.85,.5+rn()*.8,0,7);g.fill()}
      g.fillStyle='rgba(70,92,44,.6)';g.beginPath();g.ellipse(s.x,s.y-.6,s.w*.55,1.3,0,0,7);g.fill();
      for(let k=0;k<4;k++){const gx=s.x+(rn()-.5)*s.w*1.3;g.strokeStyle='rgba(88,100,50,.85)';g.lineWidth=.6;g.beginPath();g.moveTo(gx,s.y+.5);g.lineTo(gx+(rn()-.5)*1.5,s.y-2-rn()*2);g.stroke()}}
  }
  function classical(g,S,ep,pc,a,rn){
    const bx=4,by=36,x1=bx+S,yb=by+S-4,xL=bx+5,xR=x1-5,cx=(xL+xR)/2,mar=ep===1?'#c2ab83':'#d4ccba',roof='#94573a';
    g.fillStyle='rgba(8,14,6,.32)';quad(g,[[xR,yb-52],[xR+16,yb-44],[xR+16,yb+5],[xL+10,yb+5],[xL,yb]]);
    // Dach (nach hinten ansteigend) mit Mönch-Nonne-Ziegeln
    const ped=yb-11-27,apx=cx,apy=ped-11,back=13;
    g.fillStyle=a.shade(roof,18);quad(g,[[xL-1,ped],[apx,apy],[apx,apy-back],[xL-1,ped-back]]);
    g.fillStyle=a.shade(roof,-22);quad(g,[[xR+1,ped],[apx,apy],[apx,apy-back],[xR+1,ped-back]]);
    g.strokeStyle='rgba(40,18,8,.35)';g.lineWidth=.6;g.beginPath();for(let k=0;k<=back;k+=2.2){g.moveTo(xL-1,ped-k);g.lineTo(apx,apy-k);g.lineTo(xR+1,ped-k)}g.stroke();
    g.strokeStyle='rgba(255,220,190,.15)';g.beginPath();for(let k=1.1;k<=back;k+=2.2){g.moveTo(xL-1,ped-k);g.lineTo(apx,apy-k)}g.stroke();
    g.fillStyle=a.shade(roof,40);g.fillRect(apx-.6,apy-back,1.2,back);
    // Stufenunterbau
    for(let k=0;k<3;k++){const x0=bx+1+k*2,x9=x1-1-k*2,y=yb-k*3.5;g.fillStyle=a.shade(mar,-26);g.fillRect(x0,y-3.5,x9-x0,3.5);g.fillStyle=a.shade(mar,12);g.fillRect(x0,y-4.6,x9-x0,1.2)}
    const yt=yb-11;
    // Cella im Schatten hinter den Säulen
    g.fillStyle=a.shade(mar,-60);g.fillRect(xL+4,yt-26,xR-xL-8,26);g.fillStyle='#231a12';g.fillRect(cx-4,yt-15,8,15);g.fillStyle='rgba(255,200,120,.12)';g.fillRect(cx-3,yt-14,6,14);
    // Säulen mit Kanneluren, Basis und Kapitell
    const n=6;for(let i=0;i<n;i++){const px=xL+2+i*(xR-xL-4-4)/(n-1);const cg=g.createLinearGradient(px,0,px+4,0);cg.addColorStop(0,a.shade(mar,22));cg.addColorStop(.45,mar);cg.addColorStop(1,a.shade(mar,-48));
      g.fillStyle=cg;g.fillRect(px,yt-25,4,24);g.fillStyle='rgba(0,0,0,.14)';g.fillRect(px+1.3,yt-25,.4,24);g.fillRect(px+2.6,yt-25,.4,24);
      g.fillStyle=a.shade(mar,8);g.fillRect(px-.8,yt-1.5,5.6,1.5);g.fillRect(px-1,yt-27,6,2);g.fillStyle='rgba(0,0,0,.25)';g.fillRect(px-1,yt-25.2,6,.5);
      const dg=g.createLinearGradient(0,yt-8,0,yt);dg.addColorStop(0,'rgba(70,56,36,0)');dg.addColorStop(1,'rgba(70,56,36,.35)');g.fillStyle=dg;g.fillRect(px,yt-8,4,7)}
    // Gebälk mit Triglyphen
    g.fillStyle=a.shade(mar,6);g.fillRect(xL-1,ped,xR-xL+2,5);g.fillStyle=a.shade(mar,-30);g.fillRect(xL-1,ped+4,xR-xL+2,1);
    if(ep>=2){g.fillStyle=a.shade(mar,-34);for(let x=xL+1;x<xR-1;x+=5){g.fillRect(x,ped+.8,1.6,2.6)}}
    // Giebelfeld
    g.fillStyle=a.shade(mar,16);quad(g,[[xL-2,ped+.5],[apx,apy-.8],[xR+2,ped+.5]]);
    g.fillStyle=a.shade(mar,-18);quad(g,[[xL+3,ped-.6],[apx,apy+2.2],[xR-3,ped-.6]]);
    g.fillStyle='rgba(255,248,230,.25)';g.beginPath();g.moveTo(xL-2,ped+.5);g.lineTo(apx,apy-.8);g.lineTo(apx,apy+.4);g.lineTo(xL,ped+.5);g.closePath();g.fill();
    // Verwitterung: Regenspuren am Gebälk
    for(let k=0;k<5;k++){g.fillStyle='rgba(60,50,36,.14)';g.fillRect(xL+rn()*(xR-xL),ped+5,.8,3+rn()*6)}
    // Tuchbanner in Spielerfarbe zwischen den mittleren Säulen
    g.fillStyle=pc;g.fillRect(cx-2.2,yt-24,4.4,9);g.fillStyle='rgba(0,0,0,.28)';g.fillRect(cx+.8,yt-24,1.4,9);g.beginPath();g.moveTo(cx-2.2,yt-15);g.lineTo(cx,yt-13);g.lineTo(cx+2.2,yt-15);g.fill();
  }
  function church(g,S,ep,pc,a,rn){
    const bx=4,by=36,x1=bx+S,mat=a.MAT[Math.min(ep,a.MAT.length-1)],col=ep>=7?'#8a7e6c':a.wall,roof=a.roof;
    const nx0=bx+22,ny0=by+8,nx1=x1-1,ny1=by+S-4;
    a.hall(g,nx0,ny0,nx1,ny1,15,mat,col,roof,ep>=2,6);
    // Front der Halle neu verputzen: Quaderwerk, Strebepfeiler, Spitzbogenfenster
    const d=Math.min(18,(nx1-nx0)*.34),R=d*.55+8,H=Math.max(15*1.35,(ny1-ny0)*.95-d*.25-R),xf=nx1-d;
    ashlar(g,nx0,ny1-H+3,xf,ny1,col,a,rn);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(nx0,ny1-H+3,xf-nx0,2.2);
    const nw=2;for(let i=0;i<nw;i++){const wx=nx0+(i+.5)*(xf-nx0)/nw+2;lancet(g,wx,ny1-5,3.6,H-12,a,col)}
    for(const bxp of [xf-1.5,(nx0+xf)/2+1]){g.fillStyle=a.shade(col,10);g.fillRect(bxp-1.2,ny1-H*.7,2.4,H*.7);g.fillStyle=a.shade(col,-40);g.fillRect(bxp+.6,ny1-H*.7,.8,H*.7);g.fillStyle=a.shade(col,30);g.beginPath();g.moveTo(bxp-1.4,ny1-H*.7);g.lineTo(bxp+1.4,ny1-H*.7-2.5);g.lineTo(bxp+1.4,ny1-H*.7);g.fill()}
    // Turm mit Glockenstube und Helm
    const tx=bx+4,tw=17,dd=6,tb=by+S-2,th=ep>=9?44:52,tt=tb-th;
    g.fillStyle='rgba(8,14,6,.34)';quad(g,[[tx+tw,tb],[tx+tw+dd,tb-3],[tx+tw+dd+22,tb+9],[tx+tw+16,tb+12],[tx+4,tb+6]]);
    g.fillStyle=a.shade(col,-48);quad(g,[[tx+tw,tb],[tx+tw+dd,tb-3.5],[tx+tw+dd,tt-3.5],[tx+tw,tt]]);
    g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.5;g.beginPath();for(let y=tb-3.2;y>tt;y-=3.2){g.moveTo(tx+tw,y);g.lineTo(tx+tw+dd,y-3.5)}g.stroke();
    ashlar(g,tx,tt,tx+tw,tb,col,a,rn);
    g.fillStyle='rgba(255,246,226,.16)';for(let y=tb-3.2;y>tt;y-=6.4){g.fillRect(tx,y-3.2,3,3.2);g.fillRect(tx+tw-3,y-6.4,3,3.2)}
    // Gesimse
    for(const y of [tt+14,tt+.5]){g.fillStyle=a.shade(col,26);g.fillRect(tx-1,y-1.2,tw+2,1.6);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(tx-1,y+.4,tw+2,.7);g.fillStyle=a.shade(col,-30);quad(g,[[tx+tw+1,y-1.2],[tx+tw+dd+1,y-4.7],[tx+tw+dd+1,y-3.1],[tx+tw+1,y+.4]])}
    // Schallöffnungen mit Lamellen
    for(const ox of [tx+4.5,tx+tw-4.5]){g.fillStyle='#1c1814';g.beginPath();g.moveTo(ox-2,tt+12);g.lineTo(ox-2,tt+6);g.quadraticCurveTo(ox-2,tt+3.4,ox,tt+3);g.quadraticCurveTo(ox+2,tt+3.4,ox+2,tt+6);g.lineTo(ox+2,tt+12);g.closePath();g.fill();
      g.fillStyle='#4a3a2a';for(let y=tt+6.5;y<tt+12;y+=1.4)g.fillRect(ox-2,y,4,.5)}
    if(ep>=6){const cy=tt+20;g.fillStyle='#d8d0bc';g.beginPath();g.arc(tx+tw/2,cy,3.3,0,7);g.fill();g.strokeStyle='#3a3226';g.lineWidth=.5;g.stroke();g.strokeStyle='#2a2218';g.lineWidth=.6;g.beginPath();g.moveTo(tx+tw/2,cy);g.lineTo(tx+tw/2,cy-2.4);g.moveTo(tx+tw/2,cy);g.lineTo(tx+tw/2+1.6,cy+.6);g.stroke()}

    // Portal mit Gewände und Stufe
    {const pcx=tx+tw/2,pw=6.5,ph=13;g.fillStyle=a.shade(col,18);g.beginPath();g.moveTo(pcx-pw/2-1.8,tb);g.lineTo(pcx-pw/2-1.8,tb-ph+3);g.quadraticCurveTo(pcx-pw/2-1.8,tb-ph-2,pcx,tb-ph-3.5);g.quadraticCurveTo(pcx+pw/2+1.8,tb-ph-2,pcx+pw/2+1.8,tb-ph+3);g.lineTo(pcx+pw/2+1.8,tb);g.fill();
      g.fillStyle='#3e2a1a';g.beginPath();g.moveTo(pcx-pw/2,tb);g.lineTo(pcx-pw/2,tb-ph+3);g.quadraticCurveTo(pcx-pw/2,tb-ph,pcx,tb-ph-1.2);g.quadraticCurveTo(pcx+pw/2,tb-ph,pcx+pw/2,tb-ph+3);g.lineTo(pcx+pw/2,tb);g.fill();
      g.fillStyle='rgba(20,12,6,.6)';g.fillRect(pcx-.25,tb-ph,.5,ph);g.fillStyle='#2a2a2a';g.fillRect(pcx-pw/2,tb-ph*.55,pw,.6);g.fillRect(pcx-pw/2,tb-ph*.25,pw,.6);
      g.fillStyle=a.shade(col,6);g.fillRect(pcx-pw/2-3,tb,pw+6,1.6);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(pcx-pw/2-3,tb+1.6,pw+6,.7)}
    // Behang in Spielerfarbe unter der Glockenstube
    {const hx=tx+tw/2-2,hy=ep>=6?tt+25:tt+17;g.fillStyle=pc;g.fillRect(hx,hy,4,7);g.beginPath();g.moveTo(hx,hy+7);g.lineTo(hx+2,hy+9);g.lineTo(hx+4,hy+7);g.fill();g.fillStyle='rgba(0,0,0,.3)';g.fillRect(hx+2.8,hy,1.2,7);g.fillStyle='#b89a52';g.fillRect(hx-.5,hy-.3,5,.7)}
    if(ep>=9){g.fillStyle=a.shade(col,20);g.fillRect(tx-1,tt-3,tw+2,3);g.fillStyle=a.shade(col,-40);quad(g,[[tx+tw+1,tt-3],[tx+tw+dd+1,tt-6.5],[tx+tw+dd+1,tt-3.5],[tx+tw+1,tt]]);return}
    // Helm: Schiefer, ab Renaissance Kupfer mit Patina
    const sc=ep>=6?'#6f8c7c':'#4f545c',ax=tx+tw/2+2,ay=tt-26;
    g.fillStyle=a.shade(sc,-30);quad(g,[[tx+tw+1,tt],[tx+tw+dd+1,tt-3.5],[ax,ay]]);
    const sg=g.createLinearGradient(tx,0,tx+tw,0);sg.addColorStop(0,a.shade(sc,24));sg.addColorStop(1,a.shade(sc,-8));g.fillStyle=sg;quad(g,[[tx-1,tt],[tx+tw+1,tt],[ax,ay]]);
    g.save();g.beginPath();g.moveTo(tx-1,tt);g.lineTo(tx+tw+1,tt);g.lineTo(ax,ay);g.closePath();g.clip();g.strokeStyle='rgba(0,0,0,.2)';g.lineWidth=.45;g.beginPath();for(let y=tt-2;y>ay;y-=2){g.moveTo(tx-1,y);g.lineTo(tx+tw+1,y)}g.stroke();
      if(ep>=6){g.fillStyle='rgba(150,190,170,.22)';for(let k=0;k<6;k++)g.fillRect(tx+rn()*tw,tt-rn()*24,1,3+rn()*4)}g.restore();
    g.strokeStyle='rgba(255,255,255,.2)';g.lineWidth=.5;g.beginPath();g.moveTo(tx-1,tt);g.lineTo(ax,ay);g.stroke();
    g.fillStyle='#a88a46';g.beginPath();g.arc(ax,ay-.5,.9,0,7);g.fill();g.strokeStyle='#3a3226';g.lineWidth=.7;g.beginPath();g.moveTo(ax,ay-1);g.lineTo(ax,ay-7);g.moveTo(ax-1.8,ay-5);g.lineTo(ax+1.8,ay-5);g.stroke();
  }
  function temple(g,S,ep,pc,a){
    const rn=rng(1337+ep*131);
    if(ep===0)stones(g,S,a,rn);else if(ep<=3)classical(g,S,ep,pc,a,rn);else church(g,S,ep,pc,a,rn);
  }
  return {market,temple};
})();
EmpireXY.register({
  id:'kern-beliebtheit',name:'Kern: Beliebtheit',version:'1.0.0',core:true,
  description:'Zufriedenheit des Volkes mit Markt und Tempel, wirkt auf das Sammeltempo.',
  buildings:{
    market:{name:'Marktplatz',size:3,hp:900,cost:{wood:180,gold:40},time:30,minEpoch:1,sight:5,slot:17,mood:10,ai:{minWorkers:16},
      desc:'+10 Beliebtheit (höchstens zwei Märkte zählen).',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,c=a.sprite('b|market|'+ep+'|'+b.owner,s+24,s+44,g2=>BELIEB_GFX.market(g2,s,ep,pc,a));g.drawImage(c,x-4,y-36,c.lw,c.lh);
      }},
    temple:{name:'Tempel',names:['Ahnenstein','Schrein','Tempel','Tempel','Kloster','Kirche','Kathedrale','Kirche','Kapelle','Gemeindezentrum'],size:2,hp:800,cost:{stone:120,gold:60},time:30,sight:5,slot:18,mood:8,ai:{minWorkers:20},
      desc:'+8 Beliebtheit (höchstens zwei zählen).',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,c=a.sprite('b|temple|'+ep+'|'+b.owner,s+24,s+44,g2=>BELIEB_GFX.temple(g2,s,ep,pc,a));g.drawImage(c,x-4,y-36,c.lw,c.lh);
      }},
  },
  hooks:{
    tick(api,dt){
      for(const pl of api.players){
        pl.moodT=(pl.moodT||0)-dt;if(pl.moodT>0)continue;pl.moodT=1;
        let m=50;const why=[];
        const food=pl.res.food;if(food>=400){m+=12;why.push('volle Speicher +12')}else if(food>=150){m+=5;why.push('genug Nahrung +5')}else if(food<40){m-=18;why.push('Hunger −18')}
        if(pl.cap>0&&pl.pop>=pl.cap){m-=10;why.push('Wohnungsnot −10')}else if(pl.cap>0&&pl.pop>=pl.cap*.9){m-=5;why.push('enge Häuser −5')}
        pl.crowdMul=pl.cap>0&&pl.pop>=pl.cap*.9?.85:1;
        if(pl.eventMood){m+=pl.eventMood;why.push('Ereignis '+(pl.eventMood>0?'+':'−')+Math.abs(pl.eventMood))}
        if(pl.monMood){m+=pl.monMood;why.push('Epochenwunder +'+pl.monMood)}
        if(pl.heroDeadUntil>api.time){m-=15;why.push('Held gefallen −15')}
        const blds=api.ents.filter(e=>e.kind==='bld'&&e.owner===pl.i&&e.built&&!e.dead);
        if(blds.some(b=>b.type==='wonder')){m+=15;why.push('Weltwunder +15')}
        for(const t of ['market','temple']){const n=Math.min(2,blds.filter(b=>b.type===t).length);if(n){const v=n*(t==='market'?10:8);m+=v;why.push((t==='market'?'Märkte':'Tempel')+' +'+v)}}
        const lost=(pl.st&&pl.st.lost)||0,recent=lost-(pl.moodLost||0);pl.moodLost=lost;pl.moodWar=Math.max(0,(pl.moodWar||0)*.97+recent*2);
        if(pl.moodWar>1){const v=Math.min(20,Math.round(pl.moodWar));m-=v;why.push('Kriegsverluste −'+v)}
        m=Math.max(0,Math.min(100,m));pl.mood=(pl.mood??50)+(m-(pl.mood??50))*.15;
        pl.moodMul=(.75+pl.mood/200)*(pl.wonderGather||1)*(pl.monGather||1)*(pl.eventGather||1);pl.moodWhy=why.length?why.join(', ')+'.':'keine Einflüsse.';
      }
    },
  },
});
