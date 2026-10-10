// Kern-Baustein: Arbeitsbereiche. Lager, Mühle und Mine schicken untätige Arbeiter im Umkreis automatisch an die Arbeit.
(function(){
const R=10,RN={wood:'Holz',stone:'Stein',gold:'Gold',food:'Nahrung'},CYC=['wood','stone','gold','food',null];
const DEF={camp:'wood',mill:'food',mine:'stone'};
const cmd=(b,api)=>{const cur=b.area===undefined?DEF[b.type]:b.area;const nx=CYC[(CYC.indexOf(cur)+1)%CYC.length];
  return [{label:'Arbeitsbereich: '+(cur?RN[cur]:'aus'),desc:'Untätige Arbeiter im Umkreis von '+R+' Feldern sammeln hier automatisch '+(cur?RN[cur]:'nichts')+'. Klick wechselt zu: '+(nx?RN[nx]:'aus')+'.',act:()=>{b.area=nx;api.toast('Arbeitsbereich: '+(nx?RN[nx]:'aus')+'.')}}]};
EmpireXY.register({
  id:'kern-arbeitsbereiche',name:'Kern: Arbeitsbereiche',version:'1.0.0',core:true,
  description:'Lager (Holz), Mühle (Nahrung) und Mine (Stein) beschäftigen untätige Arbeiter im Umkreis automatisch.',
  buildings:{camp:{cmds:cmd},mill:{cmds:cmd},mine:{cmds:cmd}},
  hooks:{
    tick(api,dt){if((api._abT=(api._abT||0)+dt)<1)return;api._abT=0;
      const hubs=api.ents.filter(b=>b.kind==='bld'&&b.built&&!b.dead&&DEF[b.type]&&(b.area===undefined?DEF[b.type]:b.area));
      if(!hubs.length)return;
      for(const u of api.ents){if(u.dead||u.type!=='worker'||!u.order||u.order.t!=='idle'){if(u.type==='worker')u.idleT=0;continue}
        u.idleT=(u.idleT||0)+1;if(u.idleT<3)continue;
        let best=null,bd=R;for(const b of hubs){if(b.owner!==u.owner)continue;const c=api.center(b),d=Math.hypot(c.x-u.x,c.y-u.y);if(d<bd){bd=d;best=b}}
        if(!best)continue;const rt=best.area===undefined?DEF[best.type]:best.area,c=api.center(best);
        let r=null;if(rt==='food')r=api.ents.find(f=>f.type==='farm'&&f.owner===u.owner&&f.built&&!f.dead&&Math.hypot(f.x-c.x,f.y-c.y)<R);
        if(!r)r=api.nearestRes(rt,c.x,c.y,R,u.owner);
        if(r){api.order(u,{t:'gather',target:r.id,rt});u.idleT=0}}
    },
  },
});
})();
