// Kern-Baustein: Träger (nach Die Siedler und den Handelskarren aus Age of Empires).
// Jedes Lager, jede Mühle und jeder Marktplatz bekommt einen Träger, der von selbst zwischen
// seinem Gebäude und dem nächsten Stadtzentrum pendelt. Jede volle Runde bringt Rohstoffe.
(function(){
const GOODS={camp:{wood:5,stone:2},mill:{food:7},market:{gold:5}};
EmpireXY.register({
  id:'kern-traeger',name:'Kern: Träger',version:'1.0.0',core:true,
  description:'Träger pendeln zwischen Lager, Mühle oder Markt und dem Stadtzentrum und bringen Waren. Je weiter der Weg, desto mehr.',
  units:{
    carrier:{label:'Träger',cls:'civil',civil:true,look:'worker',ai:false,names:['Träger','Lastenträger','Eselstreiber','Ochsenkarren','Fuhrmann','Fuhrwerk','Planwagen','Lastkarren','Lastwagen','Transporter'],
      hp:30,atk:0,range:.5,rate:9,speed:1.6,sight:4,cost:{},time:1,r:.25,pop:0,tint:'#c8a46a',
      desc:'Pendelt von selbst und bringt Waren ins Stadtzentrum. Wird nicht ausgebildet.'},
  },
  hooks:{
    tick(api,dt){
      const ents=api.ents;
      for(const b of ents){
        if(b.kind!=='bld'||!b.built||b.dead||!GOODS[b.type])continue;
        if(b.carrier){const c=ents.find(e=>e.id===b.carrier);if(c&&!c.dead)continue}
        b.carrierT=(b.carrierT||0)+dt;if(b.carrierT<4)continue;b.carrierT=0;
        const p=api.center(b),u=api.spawnUnit(b.owner,'carrier',p.x+b.size/2+.3,p.y+b.size/2+.3);if(u){u.home=b.id;u.leg=0;b.carrier=u.id}
      }
      for(const u of ents){
        if(u.type!=='carrier'||u.dead||u.order.t!=='idle')continue;
        const home=ents.find(e=>e.id===u.home&&!e.dead);if(!home){u.hp=0;api.damage(u,1,null);continue}
        let tc=null,bd=1e9;for(const e of ents)if(e.kind==='bld'&&e.type==='tc'&&e.built&&!e.dead&&e.owner===u.owner){const a=api.center(home),c=api.center(e),d=Math.hypot(a.x-c.x,a.y-c.y);if(d<bd){bd=d;tc=e}}
        if(!tc)continue;
        if(u.leg===1){// am Stadtzentrum angekommen: Waren abliefern, Menge wächst mit der Strecke
          const g=GOODS[home.type],pl=api.players[u.owner],k=Math.min(3,.6+bd/12)*(pl.moodMul||1);
          for(const r in g){const v=Math.round(g[r]*k);pl.res[r]+=v;pl.carried=(pl.carried||0)+v}if(pl.st)pl.st.gathered=(pl.st.gathered||0)+1;
        }
        u.leg=u.leg?0:1;const t=u.leg?api.center(tc):api.center(home);
        api.order(u,{t:'move',x:t.x+(Math.random()-.5),y:t.y+(home.size||2)/2+1});
      }
    },
  },
});
})();
