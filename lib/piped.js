// jslint.js lib/piped.js --nomen --plusplus --white --node //

// ******************************************************************
// Pipe or Send?
// ******************************************************************
//
// Stream objects (tcp/socket) can be piped to other stream objects,
// using the builtin .pipe() method. If it's not a stream object on
// input OR output, we have to do writes ourselves. This is true
// whenever an UDP socket is involved. See below diagram:
//
// Input   Output      Pipe?
//
// Socket  Socket      V
// Socket  TCP         V
// Socket  UDP         -
// TCP     Socket      V
// TCP     TCP         V
// TCP     UDP         -
// UDP     Socket      -
// UDP     TCP         -
// UDP     UDP         -
//
// ******************************************************************

// ******************************************************************
// Module flow
// ******************************************************************
//  * Parse config file using Configurator
//      * Then call the setup code, which will:
//        (note this code is at the BOTTOM of this file).
//
//  * Set up remote connections
//      * for all servers call _connect_to_server:
//          * For UDP, call:           RemoteUPDConnect
//          * For TCP or Socket, call: RemoteStreamConnect
//
//  * Set up Management Server
//      * Callback to ___admin_command
//
//  * Set up Listeners
//      * For UDP, call:            LocalUDPListen
//      * For TCP & Socket, call:   LocalStreamListen
//      *
//      * On connection call _available_server
//          * If tcp/socket to tcp/socket, set pipe
//          * else, write to socket manually
//
//  * Manage unavailable servers
//      * Set to 'unavailable' in _available_server call
//      * Periodic job calls _connect_to_server on unavailable servers
//
// ******************************************************************

// strict parsing
"use strict";

// *********************************
// Libraries
// *********************************

var Net             = require('net');
var U               = require('util');
var Dgram           = require("dgram");
var FS              = require("fs");
var Configurator    = require("./config");

// ****************************************
// Utility functions
// ****************************************

function _now ()         { return Math.round( new Date().getTime() / 1000 ) }
function _json_pp (data) { return JSON.stringify( data , null, 2 )          }

// *********************************
// State / Stats / Config vars
// *********************************

// Statistics
var Stats = {
    connections: {
        admin:  0,
        tcp:    0,
        udp:    0,
        socket: 0,
        total:  0,
        last:   0,
        idle:   0,
        failed: 0,
    },
    start_time: _now(),
    uptime: 0,
};

// Global state
var State = {
    // will be 'server:port' => server object (see ___remote_*_connect)
    servers:    { },
};

// Config will be filled by an event emitted by the configurator;
// see all the way at the bottom, where the 'setup' function is
// called.
var Config      = {};

// ****************************************
// Remote connection object
// ****************************************

// UDP
function RemoteUDPConnect ( name, host, port ) {
    this.connection     = Dgram.createSocket("udp4");
    this.name           = name;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // invoked whenever we get data from a remote source
    this.send       = function( data ) {
                        var buf = new Buffer( data );

                        // if encoding is ascii, we're getting an extra
                        // char (\n) at the end of data. Dgram adds one
                        // more \r\n when sending it on. So, we should
                        // remove the newline character from the end of
                        // the string before sending it on:
                        var len = Config.encoding === 'ascii'
                                    ? buf.length - 1
                                    : buf.length;

                        // XXX using a stringified host means a DNS lookup,
                        // this delays message sending until next tick. I
                        // don't think this is a big problem (yet), but good
                        // to be aware of.
                        this.connection.send( buf, 0, len, port, host,

                            // in case anything goes wrong - note since it's
                            // UDP, we don't know if the message arrived, just
                            // that it was *sent*.
                            function ( err, bytes ) {
                                if( err ) {
                                    U.error( U.format(
                                        "%s: Failed sending %s bytes", err, bytes
                                    ) );
                                    this.mark_unavailable();
                                }
                            }.bind(this));
                      }.bind(this);

    // UDP sockets are always available, mark them available by default
    // we'll use the callback to find out what's going on
    this.mark_available();
}
RemoteUDPConnect.prototype              = new _RemoteConnect();
RemoteUDPConnect.prototype.constructor  = RemoteUDPConnect;


// TCP & Socket
function RemoteStreamConnect ( name, host, port, reconnect ) {
    // host might just be a unix socket, it works transparently
    this.connection = Net.createConnection( port, host );

    // set to true, meaning we can use piping
    this.is_stream      = true;
    this.name           = name;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // Ideally, we're being piped to. But if not, here's our
    // manual way of sending data
    this.send       = function( data ) { this.connection.write( data ) }.bind(this);

    // we connected? -- this won't get triggered for UDP, so we
    // set it explicitly in the TCP connection code
    this.connection.on( 'connect', function( listener ) {
        U.log( U.format( "Connected to %s", this.name ) );

        // server is now ready for use
        this.mark_available();
    }.bind(this));

    // Some error happened?
    this.connection.on( 'error', function (e) {

        // this can get very chatty, so hide it behind trace
        // always show initial connect though
        if( Config.trace || !reconnect) {
            U.error( U.format( "ERROR: %s: %s", this.name, e ) );
        }

        // mark the server as no longer available
        // XXX do not mark it unavailable again, it resets the state_changed
        // variable. Instead, when instantiating the object, always set
        // is_available to false.
        //this.mark_unavailable();

    }.bind(this));
}
RemoteStreamConnect.prototype               = new _RemoteConnect();
RemoteStreamConnect.prototype.constructor   = RemoteStreamConnect;

// Base object
function _RemoteConnect () {
    this.state_changed  = _now();
    this.state_changes  = 0;
    this.last_sent      = false;
    this.messages       = 0;
    this.is_available   = false;


    // needs to be filled in by parent
    //this.name           = false;
    //this.send           = false;
    //this.connection     = false;
    //this.is_stream      = false;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    this.mark_available     = function () {
        if( Config.trace ) { U.debug( "HEALTHY: " + this.name ); }

        // mark the server as available
        this.is_available    = true;
        this.state_changed   = _now();
        this.state_changes++;
    };

    this.mark_unavailable   = function () {
        if( Config.trace ) { U.debug( "UNHEALTHY: " + this.name ); }

        // mark the server as no longer available
        this.is_available    = false;
        this.state_changed   = _now();
        this.state_changes++;
    };

    this.incr_stats = function () {
        this.last_sent   = _now();
        this.messages++;
    };

    this.stats = function () {
        return {
            available:      this.is_available,
            last_sent:      this.last_sent,
            messages:       this.messages,
            state_changes:  this.state_changes,
            state_changed:  (_now() - this.state_changed),
            // If nothing was ever sent, the idle time == uptime
            idle:           (this.last_sent ? (_now() - this.last_sent) : Stats.uptime),
        };
    };

}



// ****************************************
// Remote connection code
// ****************************************

function _connect_to_server( str, reconnect ) {
    var pre   = reconnect ? "RE-" : "";

    // only show reconnects with trace, but always show initial connects
    if( Config.trace || !reconnect) {
        U.debug( U.format( "%sConnecting to remote %s", pre, str ) );
    }

    // *********************************
    // Interfaces REMOTES listen on
    // *********************************

    var remote = (function( str ) {
        // socket
        var m = str.match(/^\/.+?/);
        if( m && m[0] ) {
            return new RemoteStreamConnect( str, str, str, reconnect )
        }

        // udp or tcp server
        //                  type :// host : port
        var n = str.match(/^(\w+):\/\/(.+?):(\d+)$/);
        if( n && n[0] ) {

            // tcp
            if ( n[1] === 'tcp' ) {
                return new RemoteStreamConnect( str, n[2], n[3], reconnect );
            // udp
            } else if( n[1] === 'udp' ) {
                return new RemoteUDPConnect( str, n[2], n[3], reconnect );

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
// Local listener object
// ****************************************

// TCP & Socket - 'host' may just be a local socket
function LocalStreamListen (type, port, ip) {

    // is_stream == true means we can use pipes if the
    // receiving server is a stream as well.
    this.is_stream  = true;
    this.port       = port;
    this.ip         = ip;
    this.type       = type.toLowerCase();

    // set up the handler
    this.connection = Net.createServer();

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // simple diagnostic sub to show we're listening
    this.connection.on( 'listening', this.on_listen.bind(this) );

    this.connection.on( 'connection', function( conn ) {
        // bookkeeping
        this.incr_stats();

        var remotes = _available_server( Config.servers, State.servers );

        var idx;
        for( idx in remotes ) {

            var remote = remotes[ idx ];

            //if( Config.trace ) {U.debug( U.inspect( remote ) ); }

            // might not have a server
            if( remote ) {

                // bookkeeping
                remote.incr_stats( );

                // 2 streams, we can pipe that
                if( remote.is_stream ) {
                    if( Config.trace ) {
                        U.debug( U.format( "Piping to %s", remote.name ) );
                    }

                    conn.pipe( remote.connection, { end: false } );

                // fallback to sending the data ourselves
                } else {
                    if( Config.trace ) {
                        U.debug( U.format( "Manual send to %s", remote.name ) );
                    }

                    conn.on( 'data', function (data) {
                        remote.send( data );
                        remote.last_send = _now();
                    });
                }
            }
        }
    }.bind(this));

    if( Config.trace ) {
        U.debug( U.format( "Opening %s connection on %s:%s", type, ip, port ) );
    }

    this.connection.listen( port, ip );
}
LocalStreamListen.prototype               = new _LocalListen();
LocalStreamListen.prototype.constructor   = LocalStreamListen;

// UDP
function LocalUDPListen ( type, port, ip) {
    this.connection = Dgram.createSocket("udp4");
    this.port       = port;
    this.ip         = ip;
    this.type       = type;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // simple diagnostic sub to show we're listening
    //this.connection.on( 'listening', function () { this.on_listen() }.bind(this) );
    this.connection.on( 'listening', this.on_listen.bind(this) );


    // It's coming in over UDP, so no chance to pipe
    this.connection.on( 'message', function (data, rinfo) {
        // bookkeeping
        this.incr_stats();

        var remotes = _available_server( Config.servers, State.servers );

        //U.log( U.inspect( remotes ) );

        var idx;
        for( idx in remotes ) {

            var remote = remotes[ idx ];

            // might not have a remote server
            if( remote ) {

                // bookkeeping
                remote.incr_stats();

                remote.send( data );
            }
        }
    }.bind(this));

    if( Config.trace ) {
        U.debug( U.format( "Opening %s socket on %s:%s", type, ip, port ) );
    }

    this.connection.bind( port, ip );
    //this.on_listen = this.on_listen.bind(this);
}
LocalUDPListen.prototype               = new _LocalListen();
LocalUDPListen.prototype.constructor   = LocalUDPListen;

function _LocalListen () {
    this.on_listen  = function () {

        //U.log( U.inspect( this ) );
        var addr = this.connection.address();

        // some sort of port is in use
        if( addr.address ) {
            U.debug( U.format( "%s Server started on %s:%s",
                this.type, addr.address, addr.port ) );

        // it's a local socket
        } else {
            U.debug( U.format( "Unix Socket Server started on %s", this.port ) );
        }
    };

    this.incr_stats = function () {
        Stats.connections[ this.type ]++;
        Stats.connections.total++;
        Stats.connections.last = _now();
    };

    // set by parent
    this.ip         = false;
    this.port       = false;
    this.connection = false;
    this.is_stream  = false;
}

// ****************************************
// Find available servers
// ****************************************

function _available_server ( cfg_servers, servers) {
    // where to send it? scan the list for available servers

    // scan every time, so we don't send to a host that's been
    // down for a while, and immediately send to a recovered host.

    // we need to return 1 host in EVERY possible fanout group
    var rv = [];
    var idx;

    U.debug( "cfg_servers:" + U.inspect( cfg_servers ) );

    // list of list of servers
    for( idx in cfg_servers ) {

        // list of servers
        var aref = cfg_servers[ idx ];

        var sub_idx;
        for( sub_idx in aref ) {
            // look up the state of the named server
            var remote = servers[ aref[ sub_idx ] ];
            var name   = remote.name

            if( Config.trace ) {
                U.debug( U.format( "Attempting to use '%s'", name ) );
            }

            // already marked as down
            if( remote.is_available === false ) {
                continue;

            // potential socket, but check if it's not been destroyed
            // this happens if the remote end disappears, which means
            // we should mark it for reconnect
            } else if ( remote.connection.destroyed ) {
                U.error( U.format( "Server %s unavailable - marking for reconnect", name ) );
                remote.mark_unavailable();
                continue;

            } else {
                // XXX can we detect a write failure? returning false
                // here means it was queued in user memory, not that
                // the socket has gone away.
                rv.push( remote );
                break;
            }

            // if we got here, we couldn't send the message
            U.error( U.format( "No available servers in set " + aref ) );
            Stats.connections.failed++;
        }
    }

    return rv;
}

// *********************************
// Admin commands
// *********************************

function ___admin_command( cmd) {

    if( Config.debug ) {
        U.debug( "Got admin command: " + cmd );
    }

    // Recompute uptime
    Stats.uptime            = process.uptime();

    // Recompute idle time - if we don't have a last item, idle time == uptime
    Stats.connections.idle  = Stats.connections.last
                                ? _now() - Stats.connections.last
                                : Stats.uptime;

    switch(cmd) {
        case "stats":
            var idx;
            var map = { };

            // Map state to something consumable by a client
            for( idx in State.servers ) {
                map[ State.servers[idx].name ] = State.servers[idx].stats();
            }

            // return that and stats back
            return _json_pp( { stats: Stats, servers: map } );

        case "config":
            return _json_pp( Config );

        case "ping":
            return "pong";

        case "logrotate":
            return "TODO";

        case "dump":
            U.debug( U.inspect( State ) );


        default:
            return "ERROR\n";
    }
}

function _cli_options( opts ) {

    var cmd;
    for( cmd in opts ) {

        switch(cmd) {
            case 'dump':
                U.debug( "Config:\n" + U.inspect( Config ) + "\n" );
                break;
            default:
                break;
        }
    }
}

// *********************************
// Setup code
// *********************************

(function( config_file, opts ) {

    // Callback will be called when the config is ready to go.
    Configurator.config( config_file, opts, function( cfg_obj ) {

        // make sure the global is set as well
        // and use the parsed version of the opts
        Config = cfg_obj.config;

        // *********************************
        // TCP server
        // *********************************

        if( Config.tcp_port ) {
            new LocalStreamListen( 'tcp', Config.tcp_port, Config.bind_address );
        }

        // *********************************
        // Unix socket
        // *********************************

        if( Config.unix_socket ) {
            new LocalStreamListen( 'socket', Config.unix_socket );
        }


        // *********************************
        // UDP server
        // *********************************

        if( Config.udp_port ) {
            new LocalUDPListen( 'udp', Config.udp_port, Config.bind_address );
        }

        // *********************************
        // Admin server
        // *********************************

        (function () {
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

            U.debug( U.format( "Admin Server started on %s:%s",
                        Config.admin_bind_address, Config.admin_port ) );
        }());

        // ****************************************
        // CLI options?
        // ****************************************

        (function() {
            _cli_options( cfg_obj.opts );
        }());

        // ****************************************
        // Connect to remote servers
        // ****************************************

        // initial connect
        (function() {

            //if( Config.trace ) { U.debug( U.inspect( Config.servers ) ); }

            // Config.servers is layed out as follows:
            // [ [ server1, server2 ],
            //   [ server3, server4 ],
            //   ... ]
            var idx;
            for( idx in Config.servers ) {

                var aref = Config.servers[idx];

                var sub_idx;
                for( sub_idx in aref ) {
                    var name = aref[ sub_idx ];

                    // not yet connected
                    if( State.servers[name] == undefined ) {
                        State.servers[name] = _connect_to_server( name );
                    }
                }
            }
        }());

        // Reconnect if needed
        (function() {
            var reconnectInt = setInterval( function () {

                //U.debug( U.inspect( State.servers ) );

                var idx;
                for( idx in State.servers ) {

                    //U.debug( idx +" "+ U.inspect( State.servers[ idx ] ) +" "+ U.inspect( State.servers[ idx ].stats() ) );

                    // server currently unavailable
                    if( State.servers[idx].is_available === false ) {
                        //U.debug( U.inspect( State.servers[idx] ) );

                        // get the name
                        var name = State.servers[idx].name;

                        // and reconnect
                        State.servers[idx] = _connect_to_server( name, true );
                    }
                }
            }, Config.reconnect_interval );
        }());
    });

// first arg to the app is the config file, the rest are arguments
}( process.argv[2], process.argv.slice(3) ) );


