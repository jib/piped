// jslint.js lib/piped.js --nomen --plusplus --white --node //

"use strict";

// *********************************
// Libraries
// *********************************

var Net     = require('net');
var U       = require('util');
var Dgram   = require("dgram");

// ****************************************
// Utility functions
// ****************************************

function _now ()         { return Math.round( new Date().getTime() / 1000 ) }
function _json_pp (data) { return JSON.stringify( data , null, "  " )       }

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
    servers:                [ "tcp://localhost:10001",
                              //"tcp://localhost:10002",
                              //"/tmp/echo1.socket",
                              "udp://localhost:10005",
                            ],
};

// Statistics
var Stats = {
    connections: {
        admin:  0,
        tcp:    0,
        udp:    0,
        socket: 0,
        total:  0,
        last:   0,
    },
    start_time: _now(),
    uptime: 0,
};

var State = {
    // will be 'server:port' => server object (see ___remote_*_connect)
    servers:    { },
};


// ****************************************
// Remote server connection code
// ****************************************

// UDP related code

function ___remote_udp_connect ( name, host, port ) {
    var remote = Dgram.createSocket("udp4");

    var obj = {
        connection: remote,
        name:       name,
        // UDP sockets are always available, mark them available by default
        // we'll use the callback to find out what's going on
        available:  true,
        changed:    _now(),
        changes:    0,
        last_sent:  false,
        write:      function (data) {
                        var buf = new Buffer( data );
                        remote.send( buf, 0, buf.length, port, host,
                        function ( err, bytes ) { U.log( bytes ) } )
                    },
    };

    return obj;
}

// socket & tcp related code
function ___remote_net_connect ( name, host, port ) {

    // host might just be a unix socket, it works transparently
    var remote = Net.createConnection( port, host );

    var obj = {
        connection:         remote,
        available:          false,
        name:               name,
        last_state_changed: _now(),
        changes:            0,
        last_sent:          false,
        write:              function (data) { remote.write( data ) },
    };

    // we connected? -- this won't get triggered for UDP, so we
    // set it explicitly in the connection code
    remote.on( 'connect', function( listener ) {
        U.log( U.format( "Connected to %s", name ) );

        obj.available = true;
        obj.changed   = _now();
        obj.changes++;
    });

    // Some error happened?
    remote.on( 'error', function (e) {
        U.error( U.format( "ERROR: %s: %s", str, e ) );

        // mark the server as no longer available
        obj.available = false;
        obj.changed   = _now();
        obj.changes++;
    });

    return obj;
}


function _connect_to_server( str, reconnect ) {
    var pre   = reconnect ? "RE-" : "";

    U.debug( U.format( "%sConnecting to remote %s", pre, str ) );

    // *********************************
    // Interfaces REMOTES listen on
    // *********************************

    var remote = (function( str ) {
        // socket
        var m = str.match(/^\/.+?/);
        if( m && m[0] ) {
            return ___remote_net_connect( str, str )
        }

        // udp or tcp server
        //                  type :// host : port
        var n = str.match(/^(\w+):\/\/(.+?):(\d+)$/);
        if( n && n[0] ) {

            // tcp
            if ( n[1] === 'tcp' ) {
                return ___remote_net_connect( str, n[2], n[3] );
            // udp
            } else if( n[1] === 'udp' ) {
                return ___remote_udp_connect( str, n[2], n[3] );

            // garbage
            } else {
                throw( U.format( "Unknown server type '%s'", n[1] ) );
            }
        }

        // if we get here, we don't know the format
        throw( U.format( "Can not parse connection string '%s'", str ) );

    }( str ));

    return remote;
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
        var remote = servers[idx];
        var name   = remote.name

        U.debug( U.inspect( remote ) );

        // already marked as down
        if( remote.available === false ) {
            continue;

        // potential socket, but check if it's not been destroyed
        // this happens if the remote end disappears, which means
        // we should mark it for reconnect
        } else if ( remote.connection.destroyed ) {
            U.error( U.format( "Server %s unavailable - marking for reconnect", name ) );
            remote.available = false;
            remote.changed   = _now();
            remote.changes++;

            continue;

        } else {
            // XXX can we detect a write failure? returning false
            // here means it was queued in user memory, not that
            // the socket has gone away.

            return remote;
        }
    }

    // if we got here, we couldn't send the message
    U.error( U.format( "No available servers" ) );

    return false;

}

// *********************************
// Send data to remote server
// *********************************

function ___remote_send (data, type, stream) {
    Stats.connections[type]++;
    Stats.connections.total++;
    Stats.connections.last = _now();

    var remote = _available_server( State.servers );

    remote.write( data );
    remote.last_send = _now();


    if( stream !== undefined ) {
        stream.write( U.format( "You sent %s\n", data ) );
    }
}

// *********************************
// Admin commands
// *********************************

function ___admin_command( cmd) {

    if( Config.debug ) {
        U.debug( "Got admin command: " + cmd );
    }

    // Recompute uptime
    Stats.uptime = _now() - Stats.start_time;

    switch(cmd) {
        case "stats":
            var idx;
            var map = { };

            // Map state to something consumable by a client
            for( idx in State.servers ) {
                map[ State.servers[idx].name ] = {
                    available:      State.servers[idx].available,
                    total_changes:  State.servers[idx].changes,
                    last_changed:   (_now() - State.servers[idx].changed),
                }
            }

            // return that and stats back
            return _json_pp( { stats: Stats, servers: map } );

        case "ping":
            return "pong";

        case "logrotate":
            return "TODO";

        default:
            return "ERROR\n";
    }
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

            /*
            // This server processes any incoming requests
            var tcp_server = Net.createServer( function (stream) {
                stream.setEncoding( Config.encoding );

                stream.on( 'data',
                           function (data) { ___remote_send( data, 'tcp', stream ) } );
            });

            // log that we're listening
            tcp_server.on( 'listening', function () { _on_listen( 'TCP', tcp_server ) } );
            */

            var tcp_server = Net.createServer( function (stream) {
                var remote = _available_server( State.servers );
                stream.pipe( remote.connection );
            });

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

                stream.on( 'data',
                           function (data) { ___remote_send( data, 'socket', stream ) } );
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

            udp_server.on( "message",
                           function( data, rinfo ) { ___remote_send( data, 'udp' ) } );

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

            stream.on( 'data', function (data) {
                Stats.connections.admin++;

                var cmd = data.trim();

                stream.write( ___admin_command( cmd ) );
            });

            //stream.write( U.inspect( State ) );
            //stream.write( U.inspect( Stats ) );
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
            var name = Config.servers[idx];

            // not yet connected
            if( State.servers[name] == undefined ) {

                State.servers[name] = _connect_to_server( name );
            }
        }
    }());

    // Reconnect if needed
    var ____ = (function() {
        var reconnectInt = setInterval( function () {

            //U.debug( U.inspect( State ) );
            var idx;
            for( idx in State.servers ) {

                // server currently unavailable
                if( State.servers[idx].available === false ) {

                    // get the name
                    var name = State.servers[idx].string;

                    // and reconnect
                    State.servers.name = _connect_to_server( name, true );
                }
            }
        }, Config.reconnect_interval );
    }());

}());

