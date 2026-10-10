// Kern-Baustein: Volksereignisse (nach Tropico, Banished und Stronghold). Alle 3 bis 5 Minuten trifft dein Volk
// ein Ereignis, und du entscheidest in einem Fenster, wie du reagierst. Die Uhr läuft dabei weiter.
(function(){
let box=null;
function show(api,ev){
  if(!box){box=document.createElement('div');box.id='eventBox';
    box.style.cssText='position:fixed;left:50%;top:22%;transform:translateX(-50%);z-index:40;max-width:420px;width:calc(100% - 32px);background:#1b2420;border:1px solid #c9a86a;border-radius:8px;padding:16px 18px;color:#efe6d2;font:14px/1.45 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)';
    document.body.appendChild(box)}
  box.innerHTML='<h3 style="margin:0 0 6px;font-family:Georgia,serif;color:#e9be72">'+ev.title+'</h3><p style="margin:0 0 12px">'+ev.text+'</p><div style="display:flex;gap:8px;flex-wrap:wrap"></div>';
  const row=box.lastChild;
  for(const c of ev.choices){const b=document.createElement('button');b.className='tbtn';b.textContent=c[0];b.title=c[2]||'';
    b.onclick=()=>{box.hidden=true;c[1]();api.toast(c[3]||'Entschieden.','good')};row.appendChild(b)}
  box.hidden=false;api.toast(ev.title+': Entscheidung nötig.','warn');
}
const mine=(api,pred)=>api.ents.filter(e=>e.kind==='unit'&&!e.dead&&e.owner===0&&pred(e));
const EVENTS=[
  api=>({title:'Pest',text:'Eine Seuche breitet sich in der Stadt aus. Mit Quarantäne verlierst du wenige Leute, aber das Sammeln stockt 60 Sekunden. Ignorierst du sie, sterben viele Arbeiter.',
    choices:[['Quarantäne',()=>{const w=mine(api,e=>e.type==='worker');for(const e of w.slice(0,Math.ceil(w.length*.05)))api.damage(e,9999,null);api.players[0].eventGather=.7;api.players[0].eventUntil=api.time+60},'',
      'Quarantäne verhängt. Sammeln 60 Sekunden lang −30 %.'],
      ['Ignorieren',()=>{const w=mine(api,e=>e.type==='worker');for(const e of w.slice(0,Math.ceil(w.length*.2)))api.damage(e,9999,null);api.players[0].eventMood=-10;api.players[0].eventUntil=api.time+90},'','Die Pest wütet. Ein Fünftel der Arbeiter ist tot.']]}),
  api=>({title:'Einwanderungswelle',text:'Siedler aus fernen Ländern bitten um Aufnahme. Für 150 Gold nimmst du fünf neue Arbeiter auf (auch über dem Wohnraum).',
    choices:[['Aufnehmen (150 Gold)',()=>{const pl=api.players[0];if(pl.res.gold<150){api.toast('Nicht genug Gold.','warn');return}pl.res.gold-=150;
      const tc=api.ents.find(e=>e.kind==='bld'&&e.type==='tc'&&e.owner===0&&!e.dead);if(tc){const c=api.center(tc);for(let i=0;i<5;i++)api.spawnUnit(0,'worker',c.x-1+i*.5,c.y+tc.size/2+.8)}},'','Fünf Siedler sind angekommen.'],
      ['Abweisen',()=>{},'','Die Siedler ziehen weiter.']]}),
  api=>({title:'Aufstand',text:'Unzufriedene Bürger greifen zu den Waffen. Gibst du nach, kostet es Vorräte. Schlägst du ihn nieder, laufen einige Arbeiter zum Feind über und die Stimmung sinkt.',
    choices:[['Nachgeben',()=>{const pl=api.players[0];pl.res.food=Math.max(0,pl.res.food-150);pl.res.gold=Math.max(0,pl.res.gold-100);pl.eventMood=8;pl.eventUntil=api.time+90},'','Die Aufständischen sind besänftigt. Beliebtheit steigt.'],
      ['Niederschlagen',()=>{const w=mine(api,e=>e.type==='worker');for(const e of w.slice(0,3)){e.owner=1;api.order(e,{t:'idle'})}api.players[0].eventMood=-12;api.players[0].eventUntil=api.time+90},'','Drei Aufrührer sind übergelaufen. Bekämpfe sie!']]}),
];
EmpireXY.register({
  id:'kern-ereignisse',name:'Kern: Volksereignisse',version:'1.0.0',core:true,
  description:'Pest, Einwanderung und Aufstand mit Entscheidungen alle 3 bis 5 Minuten.',
  hooks:{
    tick(api,dt){
      if(api.mp)return; // Ereignisse mit Entscheidungsfenster nur im Einzelspiel
      const pl=api.players[0];if(!pl||pl.defeated)return;
      if(pl.eventUntil&&api.time>pl.eventUntil){pl.eventUntil=0;pl.eventGather=1;pl.eventMood=0}
      if(pl.nextEvent===undefined)pl.nextEvent=api.time+180+Math.random()*120;
      if(api.time<pl.nextEvent)return;pl.nextEvent=api.time+180+Math.random()*120;
      if(mine(api,e=>e.type==='worker').length<6||(box&&!box.hidden))return;
      show(api,EVENTS[Math.floor(Math.random()*EVENTS.length)](api));
    },
  },
});
})();
