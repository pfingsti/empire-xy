// Kern-Baustein: zusätzliche Einheiten für jede Gattung, damit Armeen gemischt und glaubwürdig wirken.
// cls = Gattung (für Konter und Forschung), look = welche Grafikvorlage benutzt wird, tint = Farbe der Ausrüstung.
EmpireXY.register({
  id:'kern-einheiten-plus',name:'Kern: Weitere Einheiten',version:'1.0.0',core:true,
  description:'Speerträger, schwere Infanterie, Plänkler, Elite-Schützen, Späher, berittene Schützen, schwere Reiterei, Rammen, Geschütze und Heiler.',
  units:{
    spear:{label:'Lanzenträger',cls:'infantry',from:'barracks',names:['Speerwerfer','Speerträger','Phalangit','Lanzenträger','Hellebardier','Pikenier','Grenadier','Pionier','Flammenwerfer','Panzerjäger'],
      hp:60,atk:5,range:.7,rate:1.1,speed:1.55,sight:6,cost:{food:35,wood:25},time:10,r:.29,pop:1,bonus:{cavalry:2.6},tint:'#7b6a4c',desc:'Billig und gegen Reiter sehr stark, sonst schwach.'},
    heavy:{label:'Schwere Infanterie',cls:'infantry',from:'barracks',minEpoch:3,names:['','','','Legionär','Ritter zu Fuß','Landsknecht','Grenadiergarde','Gardesoldat','Stoßtrupp','Spezialeinheit'],
      hp:120,atk:10,range:.5,rate:1.2,speed:1.25,sight:6,cost:{food:70,gold:45},time:16,r:.33,pop:1,bonus:{infantry:1.3},tint:'#c7c9cc',desc:'Langsam, schwer gepanzert. Hält jede Linie.'},
    skirm:{label:'Plänkler',cls:'ranged',from:'range',minEpoch:1,names:['','Wurfspeerwerfer','Peltast','Plänkler','Armbrust-Plänkler','Jäger','Tirailleur','Scharfschützentrupp','Späher-Schütze','Aufklärer'],
      hp:40,atk:4,range:4.5,rate:1.5,speed:1.6,sight:7,cost:{food:30,wood:30},time:10,r:.27,pop:1,proj:1,bonus:{ranged:2.2},tint:'#5b7a3c',desc:'Billiger Fernkämpfer gegen gegnerische Schützen.'},
    marks:{label:'Elite-Schützen',cls:'ranged',from:'range',minEpoch:4,names:['','','','','Langbogenschütze','Elite-Arkebusier','Rotröcke','Gebirgsjäger','Präzisionsschütze','Scharfschütze'],
      hp:50,atk:11,range:6.5,rate:2.2,speed:1.35,sight:8,cost:{food:50,wood:40,gold:40},time:15,r:.27,pop:1,proj:1,bonus:{infantry:1.5},tint:'#8e2f2a',desc:'Große Reichweite, hoher Schaden.'},
    scout:{label:'Späher',cls:'cavalry',from:'stable',minEpoch:1,names:['','Späher','Kundschafter','Leichter Reiter','Husar','Ulan','Chasseur','Kradmelder','Spähwagen','Aufklärungsfahrzeug'],
      hp:70,atk:5,range:.5,rate:1.1,speed:3.2,sight:10,cost:{food:70},time:12,r:.36,pop:1,bonus:{siege:2,ranged:1.4},desc:'Sehr schnell, sieht weit. Ideal zum Erkunden und Jagen von Belagerung.'},
    harcher:{label:'Berittene Schützen',cls:'cavalry',look:'cavalry',from:'stable',minEpoch:3,names:['','','','Berittener Bogner','Steppenreiter','Berittener Arkebusier','Dragoner-Schütze','Karabinierreiter','Panzerspähwagen','Schützenpanzer'],
      hp:85,atk:6,range:4,rate:1.8,speed:2.6,sight:8,cost:{food:60,wood:40,gold:40},time:16,r:.37,pop:1,proj:1,bonus:{infantry:1.3},desc:'Schnell und schießt aus der Bewegung.'},
    knight:{label:'Schwere Reiterei',cls:'cavalry',from:'stable',minEpoch:4,names:['','','','','Ritter','Kürassier','Garde-Kürassier','Ulanen-Garde','Sturmpanzer','Kampfpanzer'],
      hp:180,atk:13,range:.5,rate:1.4,speed:2.3,sight:7,cost:{food:90,gold:80},time:20,r:.4,pop:2,bonus:{ranged:1.8,infantry:1.2},desc:'Teuer, aber mit Wucht durch jede Linie.'},
    ram:{label:'Rammbock',cls:'siege',from:'workshop',minEpoch:3,names:['','','','Rammbock','Belagerungsramme','Sturmbock','Mineur','Sprengtrupp','Pionierpanzer','Abrissfahrzeug'],
      hp:220,atk:28,range:.6,rate:3,speed:1.1,sight:5,cost:{wood:140,gold:40},time:18,r:.42,pop:2,vsUnit:.1,vsBld:4,desc:'Zerstört Mauern und Tore, wehrlos gegen Einheiten.'},
    bolt:{label:'Geschütz',cls:'siege',from:'workshop',minEpoch:3,names:['','','','Balliste','Skorpion','Orgelgeschütz','Kartätsche','Maschinenkanone','Flak','Raketenwerfer'],
      hp:110,atk:14,range:6.5,rate:2.6,speed:1.15,sight:8,cost:{wood:120,gold:70},time:18,r:.4,pop:2,proj:1,bonus:{infantry:1.6,ranged:1.4},desc:'Durchschlagende Bolzen gegen Fußtruppen.'},
    healer:{label:'Heiler',cls:'healer',look:'worker',from:'tc',minEpoch:1,ai:false,names:['','Schamane','Priesterin','Heiler','Mönch','Feldscher','Wundarzt','Sanitäter','Feldarzt','Notarzt'],
      hp:40,atk:1,range:.5,rate:3,speed:1.6,sight:7,cost:{food:60,gold:60},time:14,r:.27,pop:1,heal:4,desc:'Heilt verbündete Einheiten im Umkreis von 4 Feldern.'},
  },
  hooks:{
    tick(api,dt){
      for(const h of api.ents){
        if(h.dead||h.kind!=='unit'||h.type!=='healer')continue;
        let n=0;for(const e of api.ents)if(n<3&&e.kind==='unit'&&!e.dead&&e.owner===h.owner&&e!==h&&e.hp<e.maxhp&&Math.hypot(e.x-h.x,e.y-h.y)<4){api.heal(e,4*dt);n++}
      }
    },
  },
});
