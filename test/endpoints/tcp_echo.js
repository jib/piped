// or run: nc -kl 10001

var net  = require('net');
var util = require('util');

var port = process.argv[2];

util.log( port );

var server = net.createServer(function (stream) {
    stream.setEncoding('ascii');
    stream.on( 'data', function( data ) {
        process.stdout.write( data );
        stream.write( util.format( "Echo server %s\r\n", port ) );
        stream.write( data );
    });
});

server.listen( port, "127.0.0.1");


