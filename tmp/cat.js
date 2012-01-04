var net     = require('net');
var util    = require('util');
var port    = process.argv[2];

var net = require('net');
var client = net.connect(port, function() { //'connect' listener
  console.log('***client connected');
  client.write( util.format( "%s\n\n", process.argv[3] ) );
});
client.on('data', function(data) {
  console.log(data.toString());
  client.end();
});
client.on('end', function() {
  console.log('***client disconnected');
});

