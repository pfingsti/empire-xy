// Kern-Baustein: Festungsbau im Stronghold-Stil. Mauern werden gezogen: Startpunkt klicken, Maus halten, loslassen.
// Bis zur Bronzezeit Holzpalisade, ab der Eisenzeit Steinmauer mit Zinnen, ab dem Industriezeitalter Beton.
EmpireXY.register({
  id:'kern-festung',name:'Kern: Festungsbau',version:'1.0.0',core:true,
  description:'Mauern zum Ziehen, die mit jeder Epoche massiver werden.',
  buildings:{
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
});
