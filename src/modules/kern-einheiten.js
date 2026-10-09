// Kern-Baustein: Einheiten. "from" sagt, in welchem Gebäude die Einheit ausgebildet wird.
// "names" enthält pro Epoche einen Namen, Werte steigen pro Epoche um 30 %.
EmpireXY.register({
  id:'kern-einheiten',name:'Kern: Einheiten',version:'1.0.0',core:true,
  description:'Arbeiter, Infanterie, Fernkampf, Kavallerie und Belagerung mit Konterprinzip.',
  units:{
    worker:{label:'Arbeiter',from:'tc',names:['Sammlerin','Bäuerin','Leibeigener','Siedler','Arbeiter'],hp:45,atk:3,range:.5,rate:1.3,speed:1.75,sight:5,cost:{food:50},time:10,r:.27,pop:1,desc:'Sammelt Rohstoffe und errichtet Gebäude.'},
    infantry:{label:'Infanterie',from:'barracks',names:['Keulenkrieger','Speerträger','Schwertkämpfer','Musketier','Füsilier'],hp:72,atk:7,range:.5,rate:1.1,speed:1.5,sight:6,cost:{food:55,wood:25},time:12,r:.3,pop:1,bonus:{cavalry:1.8},desc:'Robuste Nahkämpfer. Stark gegen Kavallerie.'},
    ranged:{label:'Fernkampf',from:'range',names:['Steinschleuderer','Bogenschütze','Armbrustschütze','Arkebusier','Scharfschütze'],hp:42,atk:6,range:5,rate:1.7,speed:1.45,sight:7,cost:{food:30,wood:45},time:12,r:.27,pop:1,bonus:{infantry:1.6},proj:1,desc:'Schießt aus der Distanz. Stark gegen Infanterie.'},
    cavalry:{label:'Kavallerie',from:'stable',names:['','Streitwagen','Ritter','Kürassier','Dragoner'],minEpoch:1,hp:115,atk:9,range:.5,rate:1.3,speed:2.6,sight:7,cost:{food:70,gold:45},time:15,r:.38,pop:1,bonus:{ranged:1.8,siege:2.5},desc:'Schnelle Reiter. Stark gegen Fernkämpfer und Belagerung.'},
    siege:{label:'Belagerung',from:'workshop',names:['','','Katapult','Kanone','Haubitze'],minEpoch:2,hp:130,atk:30,range:7,rate:3.5,speed:1.0,sight:8,cost:{wood:150,gold:90},time:22,r:.4,pop:2,proj:2,vsUnit:.45,vsBld:3.2,desc:'Langsam, aber verheerend gegen Gebäude.'},
  },
});
