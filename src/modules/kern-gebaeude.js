// Kern-Baustein: Gebäude. "slot" ist das Befehlsfeld (0 = Q, 1 = W, ...); ohne slot wird eins vergeben.
EmpireXY.register({
  id:'kern-gebaeude',name:'Kern: Gebäude',version:'1.0.0',core:true,
  description:'Stadtzentrum, Wohnhaus, Feld, Lager, Kaserne, Schießplatz, Stallung, Werkstatt, Wachturm und Weltwunder.',
  buildings:{
    house:{name:'Wohnhaus',size:2,hp:350,cost:{wood:50},time:14,pop:6,sight:4,slot:0,desc:'+6 Bevölkerung.'},
    farm:{name:'Feld',size:2,hp:200,cost:{wood:60},time:10,walk:true,sight:2,slot:1,desc:'Unerschöpfliche Nahrung für einen Arbeiter.'},
    camp:{name:'Lager',size:2,hp:500,cost:{wood:100},time:18,drop:true,sight:5,slot:2,desc:'Abgabestelle für alle Rohstoffe. Nahe an Wald und Minen bauen.'},
    barracks:{name:'Kaserne',size:3,hp:900,cost:{wood:150},time:28,sight:5,slot:3,desc:'Bildet Infanterie aus.'},
    range:{name:'Schießplatz',size:3,hp:800,cost:{wood:160},time:28,sight:5,slot:4,desc:'Bildet Fernkämpfer aus.'},
    stable:{name:'Stallung',size:3,hp:900,cost:{wood:175,gold:25},time:30,minEpoch:1,sight:5,slot:5,desc:'Bildet Kavallerie aus.'},
    workshop:{name:'Werkstatt',size:3,hp:900,cost:{wood:200,gold:75},time:35,minEpoch:3,sight:5,slot:6,desc:'Baut Belagerungswaffen.'},
    tower:{name:'Wachturm',size:2,hp:750,cost:{wood:50,stone:125},time:30,atk:9,range:7,rate:1.5,sight:9,slot:7,desc:'Beschießt Feinde in Reichweite.'},
    tc:{name:'Stadtzentrum',size:3,hp:1700,cost:{wood:275,stone:150},time:60,pop:10,drop:true,atk:6,range:6,rate:2,sight:9,slot:8,desc:'Bildet Arbeiter aus, nimmt alle Rohstoffe an, rückt in die nächste Epoche vor.'},
    wonder:{name:'Weltwunder',size:4,hp:4500,cost:{wood:1000,stone:1000,gold:1000},time:150,minEpoch:5,sight:6,slot:9,desc:'Steht es nach Fertigstellung 3 Minuten, gewinnst du.'},
  },
});
