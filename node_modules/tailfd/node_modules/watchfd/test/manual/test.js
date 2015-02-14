var w = require('../../watch.js');
var watcher = w.watch('taco.log',{timeout:5000,timeoutInterval:1000},function(cur,prev){
  console.log('CHANGE ','ino: '+cur.ino+', size: '+prev.size+' -> '+cur.size);
});

watcher.on('open',function(fd,data){
  console.log('OPEN ','ino: '+data.stat.ino+', size:'+data.stat.size);
});

watcher.on('unlink',function(fd,data){
  console.log('UNLINK ','ino: '+data.stat.ino+', size:'+data.stat.size);
});

watcher.on('timeout',function(fd,data){
  console.log('TIMEOUT ','ino: '+data.stat.ino+', size:'+data.stat.size);  
});

var fs = require('fs');

setInterval(function(){
  var ws = fs.createWriteStream('taco.log');
  ws.write('party!'+"\n");
},5000);

setInterval(function(){
  fs.unlink('taco.log');
  console.log(Object.keys(watcher.fds).length,' fds being watched');
},10000);



