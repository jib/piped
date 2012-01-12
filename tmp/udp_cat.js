var dgram   = require('dgram');
var util    = require('util');
var port    = process.argv[2];
var data    = new Buffer( process.argv[3] );

var client = dgram.createSocket('udp4');

util.log( util.inspect( client ) );

client.send( data, 0, data.length, port, 'localhost' );

/*
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


/*
dgram.createSocket(type, [callback]) #
Creates a datagram socket of the specified types. Valid types are udp4 and udp6.

Takes an optional callback which is added as a listener for message events.

Call socket.bind if you want to receive datagrams. socket.bind() will bind to the "all interfaces" address on a random port (it does the right thing for both udp4 and udp6 sockets). You can then retrieve the address and port with socket.address().address and socket.address().port.

dgram.send(buf, offset, length, port, address, [callback])
*/
