// Kern-Baustein: Spionage (nach Commandos, Age of Empires 3 und Stronghold).
// Späher sind getarnt: man sieht sie nur aus nächster Nähe oder kurz nach einem Kampf.
// Bleibt ein Späher drei Sekunden still an einem feindlichen Gebäude, sabotiert er es: 60 Sekunden halbe Produktion.
(function(){
const TARGETS=['tc','barracks','range','stable','workshop','dock','castle','market','mill','smith','bakery','sawmill'];
EmpireXY.register({
  id:'kern-spionage',name:'Kern: Spionage',version:'1.0.0',core:true,
  description:'Getarnte Späher sabotieren feindliche Gebäude (60 Sekunden halbe Produktion).',
  hooks:{
    tick(api,dt){
      const now=api.time;
      for(const u of api.ents){
        if(u.dead||u.kind!=='unit'||u.type!=='scout')continue;
        if(u.order.t!=='idle'){u.sabT=0;
        }else{
          let tgt=null;for(const b of api.ents)if(!b.dead&&b.kind==='bld'&&b.built&&b.owner!==u.owner&&b.owner>=0&&TARGETS.includes(b.type)){const c=api.center(b);if(Math.hypot(c.x-u.x,c.y-u.y)<b.size/2+1.8){tgt=b;break}}
          if(tgt&&!(tgt.sabotUntil>now)&&!(u.sabCD>now)){u.sabT=(u.sabT||0)+dt;
            if(u.sabT>=3){u.sabT=0;u.sabCD=now+45;tgt.sabotUntil=now+60;
              if(u.owner===api.me)api.toast('Sabotage geglückt: Das feindliche Gebäude arbeitet 60 Sekunden nur halb so schnell.','good');
              else if(tgt.owner===api.me)api.toast('Sabotage! Ein feindlicher Späher hat ein Gebäude lahmgelegt.','warn')}}
          else u.sabT=0;
        }
        // Die KI schickt ihre Späher ab und zu auf Sabotage-Mission
        if(api.players[u.owner].ai&&u.order.t==='idle'&&!(u.missionT>now)){u.missionT=now+70;
          const opts=api.ents.filter(b=>!b.dead&&b.kind==='bld'&&b.owner!==u.owner&&b.owner>=0&&b.built&&TARGETS.includes(b.type));
          if(opts.length){const b=opts[(Math.random()*opts.length)|0],c=api.center(b);api.order(u,{t:'move',x:c.x+b.size/2+.6,y:c.y})}}
      }
    },
  },
});
})();
