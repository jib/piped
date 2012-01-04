// jslint.js lib/piped.js --nomen --plusplus --white --node //

"use strict";

// *********************************
// Libraries
// *********************************

var Net     = require('net');
var U       = require('util');
var Dgram   = require("dgram");

// *********************************
// State / Config / Stats vars
// *********************************

// Global state
var Config = {
    // TODO: support sockets/udp
    unix_socket:            '/tmp/piped.socket',
    udp_port:               1336,
    encoding:               'ascii',
    debug:                  true,
    tcp_port:               1337,
    bind_address:           '127.0.0.1',
    admin_port:             1338,
    admin_bind_address:     '127.0.0.1',
    reconnect_interval:     1000,           // in ms
    servers:                [ //"tcp://localhost:10001",
                              //"tcp://localhost:10002",
                              //"/tmp/echo1.socket",
                              "udp://localhost:10005",
                            ],
};

// Statistics
var Stats = {
    connections: {
        tcp:    0,
        udp:    0,
        socket: 0,
    },
};

// so the indexed make more sense, use names.
var OBJECT      = 0;    // reference to object
var AVAILABLE   = 1;    // does it currently work?
var STRING      = 2;    // the connection string used
var State = {
    // will be 'server:port' => [ objects, available, index ]
    servers: [ ],
};

// ****************************************
// Remote server connection code
// ****************************************

function _connect_to_server( str, idx, reconnect ) {
    var pre   = reconnect ? "RE-" : "";

    U.debug( U.format( "%sConnecting to remote %s", pre, str ) );


    //function ___







    // *********************************
    // Interfaces REMOTES listen on
    // *********************************

    // mark the server as unavailable initially; on connect will set
    // it to available on success
    // only instantiate if this is the first time we add the server
    if( !reconnect ) {
        var container           = [ ];
        container[AVAILABLE]    = false;
        container[STRING]       = str;
        State.servers[idx]      = container;
    }

    var remote = (function( str ) {
        // socket
        var m = str.match(/^\/.+?/);
        if( m && m[0] ) {
            return Net.createConnection( str );
        }

        // udp or tcp server
        //                  type :// host : port
        var n = str.match(/^(\w+):\/\/(.+?):(\d+)$/);
        if( n && n[0] ) {

            // udp
            if( n[1] === 'udp' ) {
                container[AVAILABLE] = true;
                return Dgram.createSocket("udp4");

            // tcp
            } else if ( n[1] === 'tcp' ) {
                //                    port, host
                return Net.createConnection( n[3],n[2] );

            // garbage
            } else {
                throw( U.format( "Unknown server type '%s'", n[1] ) );
            }
        }

        // if we get here, we don't know the format
        throw( U.format( "Can not parse connection string '%s'", str ) );

    }( str ));


    // either way, store the new server object - make sure to store
    // in State, not data, so the variable gets updated
    State.servers[idx][OBJECT]   = remote;

    // we connected? -- this won't get triggered for UDP, so we
    // set it explicitly in the connection code
    remote.on( 'connect', function( listener ) {
        U.log( U.format( "Connected to %s", str ) );
        State.servers[idx][AVAILABLE] = true;
    });

    // Some error happened?
    remote.on( 'error', function (e) {
        U.error( U.format( "ERROR: %s: %s", str, e ) );

        // mark the server as no longer available
        State.servers[idx][AVAILABLE] = false;
    });
}

// ****************************************
// Find available servers
// ****************************************

function _available_server (servers) {
    // where to send it? scan the list for available servers

    // scan every time, so we don't send to a host that's been
    // down for a while, and immediately send to a recovered host.

    var idx;
    for( idx in servers ) {
        var server = servers[idx];
        var name   = servers[idx][STRING];

        //U.debug( U.inspect( server ) );

        // already marked as down
        if( server[AVAILABLE] === false ) {
            continue;

        // potential socket, but check if it's not been destroyed
        // this happens if the remote end disappears, which means
        // we should mark it for reconnect
        } else if ( server[OBJECT].destroyed ) {
            U.error( U.format( "Server %s unavailable - marking for reconnect", name ) );
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
    U.error( U.format( "No available servers" ) );

    return false;

}


// *********************************
// Setup code
// *********************************

/* is there really no better way to do closures? */
var ___ = (function () {

    // *********************************
    // Interfaces WE listen on
    // *********************************

    // simple diagnostic sub to show we're listening
    var _on_listen = function( type, server ) {
        var addr = server.address();

        U.debug( U.format( "DEBUG: %s Server started on %s:%s",
            type, addr.address, addr.port ) );
    }

    // *********************************
    // TCP server
    // *********************************

    var ____ = (function () {
        if( Config.tcp_port ) {

            // This server processes any incoming requests
            var tcp_server = Net.createServer( function (stream) {
                stream.setEncoding( Config.encoding );

                stream.on( 'data',      function (data) {
                    Stats.connections.tcp++;

                    var remote = _available_server( State.servers );

                    remote.write( data );

                    stream.write( U.format( "You sent %s\n", data ) );
                });
            });

            // log that we're listening
            tcp_server.on( 'listening', function () { _on_listen( 'TCP', tcp_server ) } );

            tcp_server.listen( Config.tcp_port, Config.bind_address );
        }
    }()); // tcp server


    // *********************************
    // Unix socket
    // *********************************

    var ____ = (function () {
        if( Config.unix_socket ) {
            var unix_socket = Net.createServer( function (stream) {
                stream.setEncoding( Config.encoding );

                stream.on( 'data',      function (data) {
                    Stats.connections.socket++;

                    var remote = _available_server( State.servers );

                    remote.write( data );

                    stream.write( U.format( "You sent %s\n", data ) );
                });
            });

            // log that we're listening
            unix_socket.on( 'listening', function () {
                U.debug( U.format( "DEBUG: Unix Socket Server started on %s", Config.unix_socket ) );
            });

            unix_socket.listen( Config.unix_socket );
        }
    }()); // unix socket


    // *********************************
    // UDP server
    // *********************************

    var ____ = (function () {
        if( Config.udp_port ) {
            var udp_server = Dgram.createSocket("udp4");

            // log that we're listening
            udp_server.on( "listening", function () { _on_listen( 'UDP', udp_server ) } );

            udp_server.on( "message",   function ( data, rinfo ) {
                Stats.connections.udp++;

                var remote = _available_server( State.servers );

                remote.write( data );
            });

            udp_server.bind( Config.udp_port, Config.bind_address );
        }
    }()); // udp server


    // *********************************
    // Admin server
    // *********************************

    var ____ = (function () {
        // This server processes any admin commands, change of config, stats
        var AdminServer = Net.createServer(function (stream) {
            stream.setEncoding('ascii');

            stream.write( U.inspect( State ) );
            stream.write( U.inspect( Stats ) );
            //stream.write( U.inspect( State.servers[0] ) );
            //stream.write( U.inspect( State.servers[1] ) );
            //stream.write( U.inspect( ) );
            //stream.write( U.inspect( ) );
        });

        AdminServer.listen( Config.admin_port, Config.admin_bind_address );

        if( Config.debug ) {
            U.debug( U.format( "Admin Server started on %s:%s",
                        Config.admin_bind_address, Config.admin_port ) );
        }
    }());

    // ****************************************
    // Connect to remote servers
    // ****************************************

    // initial connect
    var ____ = (function() {
        var idx;
        for( idx in Config.servers ) {
            var str = Config.servers[idx];
            _connect_to_server( str, idx );
        }
    }());

    // Reconnect if needed
    var ____ = (function() {
        var reconnectInt = setInterval( function () {

            //U.debug( U.inspect( State ) );
            var idx;
            for( idx in State.servers ) {

                // server currently unavailable
                if( State.servers[idx][AVAILABLE] === false ) {

                    // get the name
                    var name = State.servers[idx][STRING];

                    // and reconnect
                    _connect_to_server( name, idx, true );
                }
            }
        }, Config.reconnect_interval );
    }());

}());

