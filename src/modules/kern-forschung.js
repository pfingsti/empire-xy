// Kern-Baustein: Technologiebaum. Jede Forschungslinie hat eine Stufe pro Epoche; jede Stufe setzt die vorige voraus.
// effect: gather/atk/hp/speed = prozentuale Boni je Rohstoff bzw. Einheitentyp (0.15 = +15 %),
// range = zusätzliche Reichweite, carry = Traglast, build/bldHp/bldAtk = Boni für Gebäude.
(function(){
const LINES=[
  // [id, Gebäude, Namen pro Epoche, Effekt pro Stufe, Grundkosten, Beschreibung]
  ['nahrung','tc',['Steinsichel','Bronzesichel','Eisensense','Pflug','Mähdrescher'],{gather:{food:.15}},{food:60,wood:40},'Nahrung sammeln +15 %.'],
  ['holz','camp',['Steinaxt','Bronzeaxt','Eisenaxt','Säge','Dampfsäge'],{gather:{wood:.15}},{food:50,wood:60},'Holz sammeln +15 %.'],
  ['bergbau','camp',['Steinhacke','Bronzehacke','Eisenhacke','Grubenbau','Sprengstoff'],{gather:{stone:.15,gold:.15}},{food:60,wood:60},'Stein und Gold sammeln +15 %.'],
  ['tragen','camp',['Tragetuch','Tragekörbe','Packesel','Handkarren','Fuhrwerk'],{carry:3},{food:60,wood:50},'Arbeiter tragen 3 Rohstoffe mehr.'],
  ['wege','tc',['Trampelpfade','Rad','Pflasterstraßen','Postkutsche','Eisenbahn'],{speed:{worker:.08}},{food:70,wood:70},'Arbeiter laufen 8 % schneller.'],
  ['bauen','tc',['Lehmbau','Baukunst','Gewölbe','Statik','Stahlbeton'],{build:.15,bldHp:.1},{wood:80,stone:40},'Bauen +15 %, Gebäude halten 10 % mehr aus.'],
  ['nahkampf','barracks',['Feuerhärtung','Bronzeschmiede','Eisenschmiede','Stahlklingen','Bajonett'],{atk:{infantry:.12,cavalry:.12}},{food:80,gold:40},'Infanterie und Kavallerie: Angriff +12 %.'],
  ['ruestung','barracks',['Fellumhang','Lederpanzer','Kettenhemd','Plattenrüstung','Stahlhelm'],{hp:{infantry:.15}},{food:80,gold:40},'Infanterie: Leben +15 %.'],
  ['fernkampf','range',['Feuersteinspitzen','Befiederung','Langbogen','Gezogener Lauf','Zielfernrohr'],{atk:{ranged:.15},range:{ranged:.3}},{wood:80,gold:30},'Fernkampf: Angriff +15 %, Reichweite +0,3.'],
  ['reiterei','stable',['','Hufeisen','Pferdezucht','Kürass','Mechanisierung'],{speed:{cavalry:.08},hp:{cavalry:.12}},{food:90,gold:50},'Kavallerie: Tempo +8 %, Leben +12 %.'],
  ['belagerung','workshop',['','','Torsion','Ballistik','Sprenggranaten'],{atk:{siege:.2},range:{siege:.5}},{wood:150,gold:120},'Belagerung: Angriff +20 %, Reichweite +0,5.'],
  ['verteidigung','tower',['Wachfeuer','Zinnen','Pechnasen','Kanonentürme','Maschinengewehre'],{bldAtk:.2},{wood:60,stone:80},'Türme und Stadtzentren schießen 20 % stärker.'],
];
const techs={};
for(const [line,at,names,effect,cost,desc] of LINES){
  let prev=null;
  names.forEach((name,ep)=>{
    if(!name)return;
    const id=line+'_'+ep,m=1+ep*.9,c={};
    for(const k in cost)c[k]=Math.round(cost[k]*m/5)*5;
    techs[id]={name,at,epoch:ep,requires:prev?[prev]:[],cost:c,time:18+ep*7,effect,desc,line};
    prev=id;
  });
}
EmpireXY.register({
  id:'kern-forschung',name:'Kern: Forschung',version:'1.1.0',core:true,
  description:'Zwölf Forschungslinien mit je einer Stufe pro Epoche: Ernte, Tragen, Bauen, Waffen, Rüstung, Türme.',
  techs,
});
})();
