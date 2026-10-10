// Kern-Baustein: Söldner vom Marktplatz (nur Gold, 120 s Dienstzeit) und Katapult Stufe 2.
(function(){
const N=n=>Array(10).fill(n),DUR=120;
const desc=' Nur gegen Gold. Verlässt die Armee nach 120 Sekunden.';
EmpireXY.register({
  id:'kern-soeldner',name:'Kern: Söldner und Katapult Stufe 2',version:'1.0.0',core:true,
  description:'Söldner im Marktplatz ab Epoche 4, Forschung für Flächenschaden der Katapulte.',
  units:{
    merc_sword:{label:'Söldner-Schwertkämpfer',from:'market',look:'infantry',cls:'infantry',names:N('Söldner-Schwertkämpfer'),hp:140,atk:16,range:.5,rate:1,speed:1.5,sight:6,cost:{gold:180},time:4,r:.32,pop:1,minEpoch:3,ai:false,bonus:{cavalry:1.5},desc:'Teuer und stark.'+desc},
    merc_bow:{label:'Söldner-Bogenschütze',from:'market',look:'ranged',cls:'ranged',names:N('Söldner-Bogenschütze'),hp:70,atk:10,range:5.5,rate:1.4,speed:1.5,sight:8,cost:{gold:120},time:4,r:.3,pop:1,minEpoch:3,ai:false,desc:'Treffsicherer Fernkämpfer.'+desc},
    merc_cav:{label:'Söldner-Kavallerie',from:'market',look:'cavalry',cls:'cavalry',names:N('Söldner-Reiter'),hp:150,atk:13,range:.6,rate:1.2,speed:2.6,sight:7,cost:{gold:160},time:4,r:.4,pop:1,minEpoch:3,ai:false,desc:'Schnelle Reiter.'+desc},
  },
  techs:{
    siege_2:{name:'Katapult Stufe 2',at:'smith',epoch:3,requires:[],cost:{wood:250,gold:200},time:40,effect:{},line:'nahkampf',
      desc:'Katapulte richten Flächenschaden an: 50 % Schaden an allen Feinden im Umkreis von 3 Feldern um den Einschlag.'},
  },
  hooks:{
    tick(api){for(const u of api.ents){if(u.dead||u.kind!=='unit'||!/^merc_/.test(u.type))continue;if(u.expT==null)u.expT=api.time+DUR;
      else if(api.time>=u.expT){api.kill(u);if(u.owner===0)api.toast('Ein Söldner hat seinen Dienst beendet und zieht ab.')}}},
  },
});
})();
