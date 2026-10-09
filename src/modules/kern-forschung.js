// Kern-Baustein: Technologiebaum. Jede Forschungslinie hat eine Stufe pro Epoche; jede Stufe setzt die vorige voraus.
// effect: gather/atk/hp/speed = prozentuale Boni je Rohstoff bzw. Einheitentyp (0.15 = +15 %),
// range = zusätzliche Reichweite, carry = Traglast, build/bldHp/bldAtk = Boni für Gebäude.
(function(){
const LINES=[
  // [id, Gebäude, Namen pro Epoche, Effekt pro Stufe, Grundkosten, Beschreibung]
  ['nahrung','tc',['Steinsichel','Grabstock','Bronzesichel','Eisensense','Dreifelderwirtschaft','Pflug','Plantagen','Mähdrescher','Kunstdünger','Gentechnik'],{gather:{food:.15}},{food:60,wood:40},'Nahrung sammeln +15 %.'],
  ['holz','camp',['Steinaxt','Kupferaxt','Bronzeaxt','Eisenaxt','Zweimannsäge','Sägemühle','Holzhandel','Dampfsäge','Motorsäge','Harvester'],{gather:{wood:.15}},{food:50,wood:60},'Holz sammeln +15 %.'],
  ['bergbau','camp',['Steinhacke','Kupferhacke','Bronzehacke','Eisenhacke','Stollenbau','Grubenbau','Schwarzpulver','Sprengstoff','Pressluftbohrer','Tagebau'],{gather:{stone:.15,gold:.15}},{food:60,wood:60},'Stein und Gold sammeln +15 %.'],
  ['tragen','camp',['Tragetuch','Tragekörbe','Packesel','Ochsenkarren','Schubkarre','Handkarren','Planwagen','Fuhrwerk','Lastwagen','Logistik'],{carry:3},{food:60,wood:50},'Arbeiter tragen 3 Rohstoffe mehr.'],
  ['wege','tc',['Trampelpfade','Rad','Knüppelwege','Pflasterstraßen','Handelswege','Postkutsche','Kanäle','Eisenbahn','Autobahn','Navigation'],{speed:{worker:.08}},{food:70,wood:70},'Arbeiter laufen 8 % schneller.'],
  ['bauen','tc',['Lehmbau','Ziegelbrand','Baukunst','Gewölbe','Fachwerk','Statik','Festungsbau','Stahlbau','Stahlbeton','Fertigbau'],{build:.15,bldHp:.1},{wood:80,stone:40},'Bauen +15 %, Gebäude halten 10 % mehr aus.'],
  ['nahkampf','barracks',['Feuerhärtung','Kupferschmiede','Bronzeschmiede','Eisenschmiede','Damaszener Stahl','Stahlklingen','Bajonett','Repetiergewehr','Sturmgewehr','Präzisionswaffen'],{atk:{infantry:.12,cavalry:.12}},{food:80,gold:40},'Infanterie und Kavallerie: Angriff +12 %.'],
  ['ruestung','barracks',['Fellumhang','Lederpanzer','Bronzeschild','Kettenhemd','Plattenrüstung','Brustpanzer','Uniform','Stahlhelm','Splitterschutz','Kevlar'],{hp:{infantry:.15}},{food:80,gold:40},'Infanterie: Leben +15 %.'],
  ['fernkampf','range',['Feuersteinspitzen','Befiederung','Kompositbogen','Armbrust','Langbogen','Luntenschloss','Gezogener Lauf','Zielfernrohr','Maschinengewehr','Lenkraketen'],{atk:{ranged:.15},range:{ranged:.3}},{wood:80,gold:30},'Fernkampf: Angriff +15 %, Reichweite +0,3.'],
  ['reiterei','stable',['','Zaumzeug','Hufeisen','Steigbügel','Pferdezucht','Kürass','Kavalleriesäbel','Mechanisierung','Panzerung','Verbundpanzer'],{speed:{cavalry:.08},hp:{cavalry:.12}},{food:90,gold:50},'Kavallerie: Tempo +8 %, Leben +12 %.'],
  ['belagerung','workshop',['','','','Torsion','Gegengewicht','Gussrohre','Ballistik','Sprenggranaten','Feuerleitung','Präzisionsmunition'],{atk:{siege:.2},range:{siege:.5}},{wood:150,gold:120},'Belagerung: Angriff +20 %, Reichweite +0,5.'],
  ['verteidigung','tower',['Wachfeuer','Palisaden','Zinnen','Pechnasen','Schießscharten','Bastionen','Kanonentürme','Maschinengewehre','Bunker','Flugabwehr'],{bldAtk:.2},{wood:60,stone:80},'Türme und Stadtzentren schießen 20 % stärker.'],
];
const techs={};
for(const [line,at,names,effect,cost,desc] of LINES){
  let prev=null;
  names.forEach((name,ep)=>{
    if(!name)return;
    const id=line+'_'+ep,m=1+ep*.55,c={};
    for(const k in cost)c[k]=Math.round(cost[k]*m/5)*5;
    techs[id]={name,at,epoch:ep,requires:prev?[prev]:[],cost:c,time:18+ep*5,effect,desc,line};
    prev=id;
  });
}
EmpireXY.register({
  id:'kern-forschung',name:'Kern: Forschung',version:'1.1.0',core:true,
  description:'Zwölf Forschungslinien mit je einer Stufe in jeder der zehn Epochen: Ernte, Tragen, Bauen, Waffen, Rüstung, Türme.',
  techs,
});
})();
