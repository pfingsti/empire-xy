// Kern-Baustein: Rohstoffe und Rohstoffquellen auf der Karte
EmpireXY.register({
  id:'kern-ressourcen',name:'Kern: Rohstoffe',version:'1.0.0',core:true,
  description:'Nahrung, Holz, Stein und Gold mit Bäumen, Beeren, Steinbrüchen und Goldadern.',
  resources:{
    food:{label:'Nahrung',color:'#e0814f'},
    wood:{label:'Holz',color:'#b2834f'},
    stone:{label:'Stein',color:'#aab3ba'},
    gold:{label:'Gold',color:'#e8c650'},
  },
  nodes:{
    tree:{rt:'wood',amt:120},
    berry:{rt:'food',amt:175},
    stone:{rt:'stone',amt:450},
    gold:{rt:'gold',amt:450},
  },
});
