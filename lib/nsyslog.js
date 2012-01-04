// jslint.js lib/nsyslog.js --nomen --plusplus --white --node //

"use strict";

var net  = require('net');
var util = require('util');

// *********************************
// State / Config / Stats vars
// *********************************

// Statistics
var Stats = {
    connections: 0,
};

// Global state
var Config = {
    // TODO: support sockets/udp
    //unix_socket:          false,
    //udp_port:             false,
    regex:                  new RegExp( '^(\\S+) (\\S+) (\\S+): (.+)$' ),
    debug:                  true,
    tcp_port:               1337,
    bind_address:           '127.0.0.1',
    admin_port:             1338,
    admin_bind_address:     '127.0.0.1',
    reconnect_interval:     1000,           // in ms
    servers:                [ "localhost:10001",
                              "localhost:10002",
                            ],
};

// so the indexed make more sense, use names.
var OBJECT      = 0;    // reference to object
var AVAILABLE   = 1;    // does it currently work?
var STRING      = 2;    // the connection string used
var State = {
    // will be 'server:port' => [ objects, available, index ]
    servers: [ ],
};

// *********************************
// TCP servers
// *********************************

// This server processes any incoming requests
var Server = net.createServer(function (stream) {
    stream.setEncoding('ascii');

    stream.on( 'data', function (data) {
        Stats.connections++;

        var s = _process( data );

        stream.write( util.format( "You sent %s\n", s ) );

    });
});

// This server processes any admin commands, change of config, stats
var AdminServer = net.createServer(function (stream) {
    stream.setEncoding('ascii');

    stream.write( util.inspect( State ) );
    stream.write( util.inspect( State['servers'][0] ) );
    stream.write( util.inspect( State['servers'][1] ) );
    //stream.write( util.inspect( ) );
    //stream.write( util.inspect( ) );
});

// *********************************
// Start up tcp/management servers
// *********************************

Server.listen(      Config['tcp_port'],     Config['bind_address'] );
AdminServer.listen( Config['admin_port'],   Config['admin_bind_address'] );

if( Config['debug'] ) {
    util.debug( util.format( "Server started on %s:%s",
                Config['bind_address'], Config['tcp_port'] ) );
    util.debug( util.format( "Admin Server started on %s:%s",
                Config['admin_bind_address'], Config['admin_port'] ) );
}

// ****************************************
// Connect / reconnect to remote servers
// ****************************************

// initial connect
for( var idx in Config['servers'] ) {
    var str = Config['servers'][idx];
    _connect_to_server( str, idx );
}

// Reconnect if needed
var reconnectInt = setInterval( function () {

    //util.debug( util.inspect( State ) );

    for( var idx in State['servers'] ) {

        // server currently unavailable
        if( State['servers'][idx][AVAILABLE] === false ) {

            // get the name
            var name = State['servers'][idx][STRING];

            // and reconnect
            _connect_to_server( name, idx, true );
        }
    }
}, Config['reconnect_interval'] );

// connection function
function _connect_to_server( str, idx, reconnect ) {
    var parts = str.split(':');

    var pre   = reconnect ? "RE-" : "";

    util.debug( util.format( "%sConnecting to remote %s", pre, str ) );

    //                                 port,     host
    var server = net.createConnection( parts[1], parts[0] );

    // mark the server as unavailable initially; on connect will set
    // it to available on success
    // only instantiate if this is the first time we add the server
    if( !reconnect ) {
        var data                = [ ]
        data[AVAILABLE]         = false;
        data[STRING]            = str;
        State['servers'][idx]   = data;
    }

    // either way, store the new server object - make sure to store
    // in State, not data, so the variable gets updated
    State['servers'][idx][OBJECT]   = server;

    // we connected?
    server.on( 'connect', function( listener ) {
        util.log( util.format( "Connected to %s", str ) );
        State['servers'][idx][AVAILABLE] = true;
    });

    // Some error happened?
    server.on( 'error', function (e) {
        util.error( util.format( "ERROR: %s: %s", str, e ) );

        // mark the server as no longer available
        State['servers'][idx][AVAILABLE] = false;
    });
}

// ****************************************
// Find available servers
// ****************************************

function _writable_server (servers) {
    // where to send it? scan the list for available servers

    // scan every time, so we don't send to a host that's been
    // down for a while, and immediately send to a recovered host.

    for( var idx in servers ) {
        server = servers[idx];
        name   = servers[idx][STRING];

        //util.debug( util.inspect( server ) );

        // already marked as down
        if( server[AVAILABLE] === false ) {
            continue;

        // potential socket, but check if it's not been destroyed
        // this happens if the remote end disappears, which means
        // we should mark it for reconnect
        } else if ( server[OBJECT].destroyed ) {
            util.error( util.format( "Server %s unavailable - marking for reconnect", name ) );
            server[AVAILABLE] = false;
            continue;

        } else {
            // XXX can we detect a write failure? returning false
            // here means it was queued in user memory, not that
            // the socket has gone away.

            return server[OBJECT];
        }
    }

    // if we got here, we couldn't send the message
    util.error( util.format( "No available servers for: %s", s ) );

    return false;

}


// ****************************************
// Process the incoming data
// ****************************************

function _process(input) {
    var s       = input.trim();
    var match   = Config['regex'].exec( s );
    var server  = _writable_server( State['servers'] );

    // test regexes here: http://www.regular-expressions.info/javascriptexample.html
    if( !match || !match[0] ) {
        util.error( util.format( "ERROR: corrupted log string: %s", s ) );
        return false;
    }
    var date    = match[1];
    var host    = match[2];
    var tag     = match[3];
    var data    = match[4];

    // eval must be wrapped with ( ) so parser doesn't hit any snags
    // see here for details: http://www.json.org/js.html
    var json    = eval( '(' + data + ')' );

    util.log( util.inspect( json ) );
    return json;
}

