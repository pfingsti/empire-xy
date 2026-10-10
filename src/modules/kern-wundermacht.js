// Kern-Baustein: Wundermächte (nach Black & White und Empire Earth). Jedes fertige Weltwunder wirkt je nach Epoche.
EmpireXY.register({
  id:'kern-wundermacht',name:'Kern: Wundermächte',version:'1.0.0',core:true,
  description:'Fertige Weltwunder geben ihrem Reich eine dauerhafte Macht.',
  hooks:{
    tick(api,dt){
      for(const pl of api.players)pl.wonderGather=1;
      for(const w of api.ents){
        if(w.type!=='wonder'||!w.built||w.dead)continue;
        if(w.wep===undefined){w.wep=api.players[w.owner].epoch;if(w.owner===api.me)api.toast('Die Macht deines Weltwunders erwacht.','good')}
        const pl=api.players[w.owner],ep=w.wep;
        if(ep<=5){for(const u of api.ents)if(u.kind==='unit'&&!u.dead&&u.owner===w.owner&&u.hp<u.maxhp)api.heal(u,2*dt)}
        else if(ep===6)pl.wonderGather=1.15;
        else if(ep===7){for(const b of api.ents)if(b.kind==='bld'&&b.built&&!b.dead&&b.owner===w.owner&&b.hp<b.maxhp)api.heal(b,6*dt)}
        else if(ep===8){for(const u of api.ents)if(u.kind==='unit'&&!u.dead&&u.owner!==w.owner&&api.ents.some(b=>b.kind==='bld'&&b.owner===w.owner&&!b.dead&&Math.hypot(b.x-u.x,b.y-u.y)<8)){u.hp-=1.5*dt;if(u.hp<=0)api.damage(u,1,null)}}
        else if(w.owner===api.me&&!w.revealed){w.revealed=1;api.revealAll()}
      }
    },
  },
});
