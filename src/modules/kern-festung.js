// Kern-Baustein: Festungsbau im Stronghold-Stil. Mauern werden gezogen: Startpunkt klicken, Maus halten, loslassen.
// Bis zur Bronzezeit Holzpalisade, ab der Eisenzeit Steinmauer mit Zinnen, ab dem Industriezeitalter Beton.
EmpireXY.register({
  id:'kern-festung',name:'Kern: Festungsbau',version:'1.0.0',core:true,
  description:'Mauern zum Ziehen und Torhäuser, die mit jeder Epoche massiver werden.',
  buildings:{
    gate:{name:'Torhaus',size:1,hp:1100,cost:{stone:40,wood:20},time:14,sight:4,gate:true,slot:11,
      desc:'Tor in der Mauer: eigene Einheiten gehen durch, Feinde nicht. Zuerst das Tor setzen, dann die Mauer darüber ziehen.',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,wood=ep<3,conc=ep>=7,front=wood?'#6b4a2a':conc?'#a9adae':a.wall,h=wood?24:30,top=y+s-h-6;
        g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x+3,y+s-4,s,6);
        // Türme links und rechts
        for(const tx of [x-3,x+s-6]){g.fillStyle=a.shade(front,-20);g.fillRect(tx,top-4,9,h+6);g.fillStyle=a.shade(front,12);g.fillRect(tx,top-6,9,4);
          if(!wood&&!conc){g.fillStyle=a.shade(front,4);g.fillRect(tx,top-9,3,3);g.fillRect(tx+6,top-9,3,3)}}
        g.fillStyle=front;g.fillRect(x+4,top+2,s-8,h);
        // Torbogen
        const open=b.open>0;g.fillStyle=open?'#1b1610':'#4a3018';g.beginPath();g.moveTo(x+8,y+s-4);g.lineTo(x+8,top+14);g.arc(x+s/2,top+14,s/2-8,Math.PI,0);g.lineTo(x+s-8,y+s-4);g.fill();
        if(!open){g.strokeStyle='#2a1b0d';g.lineWidth=1;g.beginPath();for(let i=x+10;i<x+s-8;i+=3){g.moveTo(i,top+10);g.lineTo(i,y+s-4)}g.stroke()}
        g.fillStyle=pc;g.fillRect(x+s/2-1,top-14,2,10);g.beginPath();g.moveTo(x+s/2+1,top-14);g.lineTo(x+s/2+8,top-11);g.lineTo(x+s/2+1,top-8);g.fill();
      }},
    wall:{name:'Mauer',size:1,hp:600,cost:{stone:8},time:5,sight:2,line:true,slot:10,
      desc:'Ziehen zum Bauen: Startpunkt klicken, Maus halten und loslassen. Kostet pro Feld.',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,wood=ep<3,conc=ep>=7,h=wood?18:conc?16:22;
        const top=y+s-h-6;
        g.fillStyle='rgba(0,0,0,.28)';g.fillRect(x+3,y+s-4,s,6);
        if(wood){
          for(let i=0;i<5;i++){const px=x+1+i*6.2,ph=h+(i%2?2:0);
            const gr=g.createLinearGradient(px,0,px+6,0);gr.addColorStop(0,'#8a6236');gr.addColorStop(1,'#5b3d1f');
            g.fillStyle=gr;g.fillRect(px,y+s-ph-2,5.6,ph);
            g.fillStyle='#a77d4a';g.beginPath();g.moveTo(px,y+s-ph-2);g.lineTo(px+2.8,y+s-ph-7);g.lineTo(px+5.6,y+s-ph-2);g.fill()}
          g.fillStyle='#4a3218';g.fillRect(x,y+s-10,s,2.2);
        }else{
          const front=conc?'#a9adae':a.wall,topc=conc?'#c7cbcc':a.shade?a.shade(front,18):front;
          g.fillStyle=a.shade(front,-28);g.fillRect(x,top+6,s,h);
          g.fillStyle=front;g.fillRect(x,top+6,s,h-4);
          g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.7;g.beginPath();
          if(!conc)for(let r=0,yy=top+10;yy<top+h+4;yy+=4,r++){g.moveTo(x,yy);g.lineTo(x+s,yy);for(let xx=x+(r%2?4:8);xx<x+s;xx+=8){g.moveTo(xx,yy-4);g.lineTo(xx,yy)}}
          g.stroke();
          g.fillStyle=topc;g.fillRect(x,top,s,7);
          if(!conc){g.fillStyle=a.shade(front,8);for(let i=0;i<4;i++)g.fillRect(x+1+i*8,top-5,5,5)}
          else{g.fillStyle='#8b8f90';g.fillRect(x,top-2,s,2)}
          g.fillStyle=pc;g.fillRect(x+s/2-2,top+9,4,3);
        }
      }},
  },
  hooks:{
    // Tor öffnet sich, wenn eigene Einheiten in der Nähe sind
    tick(api,dt){for(const b of api.ents){if(b.type!=='gate'||b.dead)continue;b.open=api.ents.some(u=>u.kind==='unit'&&!u.dead&&u.owner===b.owner&&Math.abs(u.x-b.x-.5)<1.6&&Math.abs(u.y-b.y-.5)<1.6)?1:0}},
  },
});
// Burg und Mühle: Stronghold-Elemente
EmpireXY.register({
  id:'kern-burg',name:'Kern: Burg und Mühle',version:'1.0.0',core:true,
  description:'Burg als schwer befestigter Mittelpunkt ab dem Mittelalter, Mühle als erste Stufe der Nahrungskette.',
  buildings:{
    mill:{name:'Mühle',size:2,hp:450,cost:{wood:120,stone:20},time:20,sight:4,slot:12,farmBoost:1.35,ai:{minWorkers:12},
      desc:'Felder im Umkreis von 8 Feldern liefern 35 % mehr Nahrung. Ab dem Industriezeitalter eine Getreidefabrik.',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,modern=ep>=7,cx=x+s/2,base=y+s-4;
        g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(cx+8,base+2,s*.42,s*.16,0,0,7);g.fill();
        if(modern){g.fillStyle='#b8bcbd';g.fillRect(x+8,base-38,14,38);g.fillRect(x+26,base-44,14,44);g.fillStyle='#d3d6d7';g.beginPath();g.ellipse(x+15,base-38,7,3,0,0,7);g.ellipse(x+33,base-44,7,3,0,0,7);g.fill();
          g.fillStyle='#7a4436';g.fillRect(x+40,base-20,18,20);g.fillStyle=pc;g.fillRect(x+40,base-22,18,3);return}
        // Turm mit Kappe
        const tw=ep>=3?a.wall:'#8a6a40';g.fillStyle=a.shade(tw,-15);g.beginPath();g.moveTo(cx-12,base);g.lineTo(cx-8,base-36);g.lineTo(cx+8,base-36);g.lineTo(cx+12,base);g.closePath();g.fill();
        g.fillStyle=a.shade(tw,10);g.beginPath();g.moveTo(cx-12,base);g.lineTo(cx-8,base-36);g.lineTo(cx,base-36);g.lineTo(cx,base);g.closePath();g.fill();
        g.fillStyle=a.roof;g.beginPath();g.moveTo(cx-11,base-35);g.lineTo(cx,base-48);g.lineTo(cx+11,base-35);g.closePath();g.fill();
        g.fillStyle='#2b1d12';g.fillRect(cx-3,base-10,6,10);
        // Flügel, drehen sich langsam
        const t=a.time*1.2+b.id;g.save();g.translate(cx,base-36);g.strokeStyle='#5a3f22';g.lineWidth=1.6;
        for(let i=0;i<4;i++){const an=t+i*Math.PI/2;g.save();g.rotate(an);g.beginPath();g.moveTo(0,0);g.lineTo(0,-22);g.stroke();g.fillStyle='rgba(235,225,200,.85)';g.fillRect(1,-21,5,15);g.restore()}
        g.fillStyle='#3a2a1a';g.beginPath();g.arc(0,0,2,0,7);g.fill();g.restore();
        g.fillStyle=pc;g.fillRect(cx-6,base-30,12,2);
      }},
    castle:{name:'Burg',size:4,hp:5000,cost:{stone:650,wood:200},time:90,minEpoch:4,pop:15,atk:16,range:8,rate:1.4,sight:11,slot:15,ai:{minWorkers:24},
      desc:'Schwer befestigter Bergfried mit Ecktürmen. Schießt weit, +15 Bevölkerung. Ab der Weltkriegszeit eine Bunkerfestung.',
      draw(g,b,a){
        const {x,y,s,ep,pc}=a,modern=ep>=8,stone=modern?'#9c9f98':a.wall,dark=a.shade(stone,-30);
        g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x+10,y+s-4,s,10);
        // Ringmauer
        const wy=y+s*.35;g.fillStyle=dark;g.fillRect(x+4,wy,s-8,s*.6);g.fillStyle=stone;g.fillRect(x+4,y+s-16,s-8,12);
        if(!modern){g.fillStyle=a.shade(stone,12);for(let i=x+4;i<x+s-6;i+=7)g.fillRect(i,y+s-20,4,4)}
        g.fillStyle='#2b1d12';g.beginPath();g.moveTo(x+s/2-8,y+s-4);g.lineTo(x+s/2-8,y+s-12);g.arc(x+s/2,y+s-12,8,Math.PI,0);g.lineTo(x+s/2+8,y+s-4);g.fill();
        // Bergfried
        const kx=x+s*.28,kw=s*.44,ky=y-s*.15;g.fillStyle=a.shade(stone,-10);g.fillRect(kx,ky,kw,wy-ky+20);g.fillStyle=a.shade(stone,8);g.fillRect(kx,ky,kw*.5,wy-ky+20);
        g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.7;g.beginPath();for(let yy=ky+5;yy<wy+20;yy+=5){g.moveTo(kx,yy);g.lineTo(kx+kw,yy)}g.stroke();
        if(modern){g.fillStyle='#6f736c';g.fillRect(kx-2,ky-4,kw+4,5);g.fillStyle='#222';for(let i=0;i<3;i++)g.fillRect(kx+6+i*kw/3,ky+14,kw/5,3)}
        else{g.fillStyle=a.shade(stone,14);for(let i=kx;i<kx+kw-2;i+=6)g.fillRect(i,ky-5,4,5);for(let i=0;i<3;i++){g.fillStyle='#22180f';g.fillRect(kx+6+i*kw/3,ky+12,3,6)}}
        // Ecktürme
        for(const tx of [x+8,x+s-8]){const th=s*.55;g.fillStyle=a.shade(stone,-18);g.fillRect(tx-8,wy-th*.4,16,th);g.fillStyle=a.shade(stone,6);g.fillRect(tx-8,wy-th*.4,8,th);
          if(modern){g.fillStyle='#5d615a';g.fillRect(tx-9,wy-th*.4-3,18,4)}
          else{g.fillStyle=a.roof;g.beginPath();g.moveTo(tx-10,wy-th*.4);g.lineTo(tx,wy-th*.4-16);g.lineTo(tx+10,wy-th*.4);g.closePath();g.fill()}}
        // Fahne
        g.strokeStyle='#3a2a1a';g.lineWidth=1.6;g.beginPath();g.moveTo(kx+kw/2,ky-4);g.lineTo(kx+kw/2,ky-28);g.stroke();
        g.fillStyle=pc;g.beginPath();g.moveTo(kx+kw/2+1,ky-28);g.lineTo(kx+kw/2+16,ky-24);g.lineTo(kx+kw/2+1,ky-19);g.fill();
      }},
  },
});
