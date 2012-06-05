// or run: nc -U -kl 10001

var dgram   = require('dgram');
var util    = require('util');

var port = process.argv[2];

util.log( port );


var udp_server = dgram.createSocket("udp4");

// log that we're listening
udp_server.on( "listening", function () { util.debug( port ) } );

udp_server.on( "message",   function ( data, rinfo ) { process.stdout.write( data ); });

udp_server.bind( port );

