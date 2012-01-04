var net  = require('net');
var util = require('util');

var port = process.argv[2];

util.log( port );

var server = net.createServer(function (stream) {
    stream.setEncoding('ascii');
    stream.on( 'data', function( data ) {
        s = data.trim();
        util.log( s );
        stream.write( util.format( "Echo server %s\r\n", port ) );
        stream.write( s );
    });
});

server.listen( port, "127.0.0.1");


