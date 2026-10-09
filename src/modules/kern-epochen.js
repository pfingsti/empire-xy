// Kern-Baustein: die zehn Epochen. Jede Epoche macht alle Einheiten stärker und ändert den Baustil.
// tier = Grafikstufe für Gebäude und Ausrüstung (0 Holz/Fell … 4 Stahl/Beton).
EmpireXY.register({
  id:'kern-epochen',name:'Kern: Epochen',version:'2.0.0',core:true,
  description:'Zehn Epochen von der Steinzeit bis zur Moderne.',
  epochs:[
    {name:'Steinzeit',tier:0,roof:'#8d7944',roofHi:'#b39d5e',wall:'#6f5737'},
    {name:'Kupferzeit',tier:1,cost:{food:300,wood:80},time:30,roof:'#9a6f3e',roofHi:'#bf905a',wall:'#9c7f5c'},
    {name:'Bronzezeit',tier:1,cost:{food:450,wood:120,gold:60},time:35,roof:'#a9653b',roofHi:'#c98456',wall:'#a08c6a'},
    {name:'Eisenzeit',tier:2,cost:{food:600,wood:150,gold:180},time:40,roof:'#6e5a46',roofHi:'#8f7a63',wall:'#a69a86'},
    {name:'Mittelalter',tier:2,cost:{food:800,gold:300,stone:100},time:45,roof:'#59636d',roofHi:'#7a8691',wall:'#a6a092'},
    {name:'Renaissance',tier:3,cost:{food:1000,gold:500,stone:200},time:50,roof:'#8e3c31',roofHi:'#b05345',wall:'#bfb196'},
    {name:'Kolonialzeit',tier:3,cost:{food:1200,wood:300,gold:650,stone:250},time:55,roof:'#3f5a74',roofHi:'#5d7c98',wall:'#d2c7ad'},
    {name:'Industriezeitalter',tier:4,cost:{food:1400,gold:850,stone:350},time:60,roof:'#3c4750',roofHi:'#5d6b76',wall:'#8a5a46'},
    {name:'Weltkriegszeit',tier:4,cost:{food:1700,gold:1050,stone:450},time:65,roof:'#4a5240',roofHi:'#68715a',wall:'#8d8b80'},
    {name:'Moderne',tier:4,cost:{food:2000,gold:1300,stone:550},time:70,roof:'#2f3a3f',roofHi:'#4f6670',wall:'#b4b8bb'},
  ],
});
