// Kern-Baustein: die fünf Epochen. Jede Epoche macht alle Einheiten stärker und ändert den Baustil.
EmpireXY.register({
  id:'kern-epochen',name:'Kern: Epochen',version:'1.0.0',core:true,
  description:'Steinzeit, Bronzezeit, Eisenzeit, Renaissance und Industriezeitalter.',
  epochs:[
    {name:'Steinzeit',roof:'#8d7944',roofHi:'#b39d5e',wall:'#6f5737'},
    {name:'Bronzezeit',cost:{food:400,wood:100},time:35,roof:'#a9653b',roofHi:'#c98456',wall:'#a08c6a'},
    {name:'Eisenzeit',cost:{food:700,gold:250},time:45,roof:'#59636d',roofHi:'#7a8691',wall:'#a6a092'},
    {name:'Renaissance',cost:{food:1000,gold:550,stone:200},time:55,roof:'#8e3c31',roofHi:'#b05345',wall:'#bfb196'},
    {name:'Industriezeitalter',cost:{food:1400,gold:900,stone:400},time:65,roof:'#3c4750',roofHi:'#5d6b76',wall:'#8a8d92'},
  ],
});
