/*
To lint the JS code in this project, run:

  jslint.js lib/piped.js lib/config.js --nomen --plusplus --white --node --continue --eqeq --vars

Also see:

  http://www.jslint.com/
*/

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
//
//  * On connection
//      * Loop over current delivery servers
//          * If tcp/socket to tcp/socket, set pipe
//          * else, write to socket manually
//
//  * Manage current servers
//      * On start up and periodically call _setup_current_servers
//          * Writes list of current servers to State
//
//  * Manage unavailable servers
//      * Set to 'unavailable' in _available_server call
//      * Periodic job calls _connect_to_server on unavailable servers
//
// ******************************************************************

// XXX NOTE TODO:
// To use U.inherits( ) everywhere, instead of using the X.prototype =
// declaration, we have to split out the methods defined in the constructor
// as X.prototype.method = function (...) { } and all variables in the
// constructor have to be assigned to this.XXXX to be accessible.
// U.inherits is superior, so this transition should be made.

// TODO:
// * Make pubsub work
// * Use file as input/output as well (works like a stream)
// * Implement roundrobin as delivery
// * Move _available_servers to a periodic loop instead.

// strict parsing
"use strict";

// *********************************
// Libraries
// *********************************

var Net             = require('net');
var U               = require('util');
var Dgram           = require("dgram");
var FS              = require("fs");
var Events          = require("events");
var Configurator    = require("./config");

// ****************************************
// Utility functions
// ****************************************

function _now ()         { return Math.round( new Date().getTime() / 1000 ); }
function _json_pp (data) { return JSON.stringify( data , null, 2 );          }

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
    all_servers:        { },
    // list of servers messages should be delivered to. Updated by
    // an event loop periodically
    current_servers:    [ ],

    // a list of all listeners currently open
    listeners:          { },
};

// Config will be filled by an event emitted by the configurator;
// see all the way at the bottom, where the 'setup' function is
// called.
var Config      = {};

// ****************************************
// Remote connection object
// ****************************************

// XXX BASE OBJECT MUST COME BEFORE HIGHER LEVEL OBJECTS -
// INHERITANCE OF CLASSES/FEATURES DEPENDS ON IT!
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
// make sure we can emit events
U.inherits( _RemoteConnect, Events.EventEmitter );

// UDP
function RemoteUDPConnect ( name, host, port ) {
    this.connection     = Dgram.createSocket("udp4");
    this.name           = name;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // invoked whenever we get data from a remote source
    this.send = function( data ) {
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
    this.send       = function( data ) { this.connection.write( data ); }.bind(this);

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


function OverflowStreamConnect ( name, file, mode, reconnect ) {
    // set to true, meaning we can use piping
    this.is_stream  = true;
    this.name       = name;

    this.connection = FS.createWriteStream(
                            file, { flags: 'a', mode: mode, encoding: Config.encoding } );

    // Ideally, we're being piped to. But if not, here's our
    // manual way of sending data
    this.send       = function( data ) { this.connection.write( data ); }.bind(this);

    this.connection.on( 'open', function () {
        var pre = reconnect ? "RE-" : "";

        U.log( pre + "Opening overflow file " + file );

        // watch the overflow file, in case it's rotated - note
        // we don't use watchFile, as that does 2 stats on every
        // change and sends us the callback.
        this.watcher = FS.watch( file, function( event ) {

            // don't care unless we're being rotate
            if( event !== 'rename' ) { return; }

            if( Config.trace ) { U.debug( "Overflow file rotation detected" ); }
            this.emit( 'overflowRotated', this );

        }.bind(this));

        // now it's available
        this.mark_available();

    }.bind(this));

    // Some error happened?
    this.connection.on( 'error', function (e) {

        // this can get very chatty, so hide it behind trace
        // always show initial connect though
        if( Config.trace || !reconnect) {
            U.error( U.format( "ERROR: %s: %s", this.name, e ) );
        }

        this.mark_unavailable();
    }.bind(this));
}
//U.inherits( OverflowStreamConnect, _RemoteConnect );
OverflowStreamConnect.prototype               = new _RemoteConnect();
OverflowStreamConnect.prototype.constructor   = OverflowStreamConnect;


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
        //                  type :// connection_string
        var m = str.match(/^(\w+):\/\/(.+)$/);

        if( m && m[0] ) {
            // it might be a host:port combo
            var conn  = m[2];
            var parts = conn.split(':', 2);
            var host  = parts[0];
            var port  = parts[1];

            switch( m[1] ) {
                case 'socket':
                    return new RemoteStreamConnect( str, conn, conn, reconnect );
                case 'tcp':
                    return new RemoteStreamConnect( str, host, port, reconnect );
                case 'udp':
                    return new RemoteUDPConnect( str, host, port, reconnect );
                case 'file':
                    throw( "TODO: No support for file:// yet" );
                default:
                    throw( U.format( "Unknown server type '%s'", m[1] ) );
            }
        } else {
            // if we get here, we don't know the format
            throw( U.format( "Can not parse connection string '%s'", str ) );
        }
    }( str ));

    return remote;
}

// ****************************************
// Local listener object
// ****************************************

// XXX BASE OBJECT MUST COME BEFORE HIGHER LEVEL OBJECTS -
// INHERITANCE OF CLASSES/FEATURES DEPENDS ON IT!
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

        if( Config.trace ) { U.log( "Remotes: " + U.inspect( State.current_servers ) ); }

        var idx;
        for( idx = 0; idx < State.current_servers.length; idx++ ) {
            var remote = State.current_servers[ idx ];

            // if( Config.trace ) { U.debug( U.inspect( remote ) ); }

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

        var idx;
        for( idx = 0; idx < State.current_servers.length; idx++ ) {

            var remote = State.current_servers[ idx ];


            // bookkeeping
            remote.incr_stats();

            remote.send( data );
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



// ****************************************
// Find available servers
// ****************************************

function _setup_current_servers ( cfg_servers, all_servers, overflow_stream ) {
    // where to send it? scan the list for available servers
    var rv   = [];

    // did we fail on any of the branches to find a working
    // server to send things too? This will be our marker
    // for adding the overflow log.
    var no_server = 0;

    //if( Config.trace ) { U.debug( "cfg_servers:" + U.inspect( cfg_servers ) ) };

    // list of list of servers
    var idx;
    for( idx = 0; idx < cfg_servers.length; idx++ ) {

        // list of servers
        var aref    = cfg_servers[ idx ];

        // flag will be set if we found a working server in this list.
        var added   = 0;

        var sub_idx;
        for( sub_idx = 0; sub_idx < aref.length; sub_idx++ ) {
            // look up the state of the named server
            var remote = all_servers[ aref[ sub_idx ] ];
            var name   = remote.name;

            //if( Config.trace ) { U.debug( U.format( "Attempting to use '%s'", name ) ); }

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
                //if( Config.trace ) { U.log("Using remote server " + U.inspect(remote) )}
                rv.push( remote );
                added++;
                break;
            }
        }

        if( !added ) {
            //if( Config.trace ) { U.log( "No available server in set " + aref ) }
            no_server++;
        }
    }


    if( no_server ) {
        // we failed on at least one chain
        Stats.connections.failed++;

        // do we have an overflow stream?
        if( overflow_stream ) {
            //if( Config.trace ) { U.log( "Adding overflow log to delivery chain" ) }
            rv.push( overflow_stream );

        } else {
            if( Config.trace ) {
                U.log( U.format(
                    "No overflow stream; dropping message to %s chain(s)", no_server
                ) );
            }
        }
    }

    //if( Config.trace ) { U.log( "New remote server list: " + U.inspect( rv ) ) }

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

    var out;
    try {
        switch(cmd) {
            // just in case /anything/ goes wrong.

            case "stats":
                var idx;
                var map = { };
                var cur = [ ];

                // Map state to something consumable by a client
                for( idx in State.all_servers ) {
                    map[ State.all_servers[idx].name ] = State.all_servers[idx].stats();
                }

                // List current active servers we are sending to
                for( idx = 0; idx < State.current_servers.length; idx++ ) {
                    cur.push( State.current_servers[idx].name );
                }

                if( Config.overflow_stream ) {
                    map[ Config.overflow_stream.name ] = Config.overflow_stream.stats();
                }

                // return that and stats back
                return _json_pp({ stats: Stats, active_servers: cur, all_servers: map });

            case "config":
                return _json_pp( Config );

            case "__state":
                return U.inspect( State.current_servers );

            case "ping":
                return "pong";


            case "__dump":
                U.debug( U.inspect( State ) );
                return "OK";

            default:
                out = "ADMIN ERROR: UNKNOWN COMMAND " +  cmd + "\n";
                U.debug( out );
                return out;
        }
    } catch(e) {
        out = "ADMIN ERROR on '" + cmd + "': " + U.inspect( e );

        U.log( out );
        return out;
    }
}

function _cli_options( opts ) {

    var cmd;
    var i;

    for( i = 0; i <  opts.length; i++ ) {
        cmd = opts[i];

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
        // Overflow file
        // *********************************

        if( Config.overflow_file ) {
            var overflow_stream = function () {

                var of = new OverflowStreamConnect (
                    'overflow:/' + Config.overflow_file,
                    Config.overflow_file,
                    Config.overflow_file.mode );

                // if it gets rotated, we reconnect
                of.on( 'overflowRotated', function( old_stream ) {
                    Config.overflow_stream = overflow_stream();

                    // and we clean up the old ones
                    if( Config.trace ) { U.debug("Cleaning up old stream and old watcher"); }

                    old_stream.connection.end();
                    old_stream.watcher.close();
                } );

                return of;
            };

            Config.overflow_stream = overflow_stream();
        }

        // *********************************
        // TCP server
        // *********************************

        if( Config.tcp_port ) {
            State.listeners.tcp =
                new LocalStreamListen( 'tcp', Config.tcp_port, Config.bind_address );
        }

        // *********************************
        // Unix socket
        // *********************************

        if( Config.unix_socket ) {
            State.listeners.socket =
                new LocalStreamListen( 'socket', Config.unix_socket );
        }


        // *********************************
        // UDP server
        // *********************************

        if( Config.udp_port ) {
            State.listeners.udp =
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
                //stream.write( U.inspect( ) );
                //stream.write( U.inspect( ) );
            });

            AdminServer.listen( Config.admin_port, Config.admin_bind_address );

            U.debug( U.format( "Admin Server started on %s:%s",
                        Config.admin_bind_address, Config.admin_port ) );

            State.listeners.admin = AdminServer;
        }());

        // ****************************************
        // CLI options?
        // ****************************************

        (function() {
            _cli_options( cfg_obj.opts );
        }());


        // ****************************************
        // Establish current server list
        // ****************************************

        // called after the initial connect, which then setups up a periodic
        // recall of the server list as well.
        var _cur_servers = (function() {
            var _cur_servers_interval   = false;

            var _cur_servers_func       = function() {
                State.current_servers = _setup_current_servers(
                    Config.servers, State.all_servers, Config.overflow_stream
                );
            };

            return function() {
                // set up the current server list initially
                _cur_servers_func();

                // now that we've been called for the first time, set up a
                // periodic even to recompute the current server list
                if( !_cur_servers_interval ) {
                    _cur_servers_interval =
                        setInterval( _cur_servers_func, Config.rescan_interval );
                }
            };
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
            for( idx = 0; idx < Config.servers.length; idx++ ) {

                var aref = Config.servers[idx];
                var sub_idx;
                for( sub_idx = 0; sub_idx < aref.length; sub_idx++ ) {
                    var name = aref[ sub_idx ];

                    // not yet connected
                    if( State.all_servers[name] === undefined ) {
                        State.all_servers[name] = _connect_to_server( name );
                    }
                }
            }

            // Now that remote are set up, set up the initial list of servers to
            // connect to. Note that connections may not be established yet, so it
            // will take a little time for the list be populated properly, especially
            // on an aggressive rescan interval
            _cur_servers();
        }());

        // Reconnect if needed
        (function() {
            var reconnect_interval = setInterval( function () {

                //U.debug( U.inspect( State.all_servers ) );

                var idx;
                for( idx in State.all_servers ) {

                    //U.debug( idx +" "+ U.inspect( State.all_servers[ idx ] ) +" "+ U.inspect( State.all_servers[ idx ].stats() ) );

                    // server currently unavailable
                    if( State.all_servers[idx].is_available === false ) {
                        //U.debug( U.inspect( State.all_servers[idx] ) );

                        // get the name
                        var name = State.all_servers[idx].name;

                        // and reconnect
                        State.all_servers[idx] = _connect_to_server( name, true );
                    }
                }
            }, Config.reconnect_interval );
        }());
    });

// first arg to the app is the config file, the rest are arguments
}( process.argv[2], process.argv.slice(3) ) );

// For running it from CLI node
//}( 'etc/config.js', process.argv.slice(3) ) );


