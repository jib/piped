// *********************************
// Libraries
// *********************************

var U               = require('util');
var Base            = require('./base');
var C               = require('./common').common();
var Configurator    = require('./configurator');
var LL              = require('./local_listen');


// *********************************
// Admin commands
// *********************************

var ___admin_command = exports.___admin_command = function( cmd ) {
    C._debug( "Got admin command: " + cmd );

    var stats   = this.stats_object();
    var state   = this.state_object();
    var config  = this.config_object();

    // Recompute uptime
    stats.uptime            = process.uptime();

    // Recompute idle time - if we don't have a last item, idle time == uptime
    stats.connections.idle  = stats.connections.last
                                ? C._now() - stats.connections.last
                                : stats.uptime;

    // just in case /anything/ goes wrong, wrap this in a try/catch.
    try {
        switch(cmd) {

            case "stats":
                var idx;
                var map = { };
                var cur = [ ];

                // Map state to something consumable by a client
                for( idx in state.all_servers ) {
                    map[ state.all_servers[idx].name ] = state.all_servers[idx].stats();
                }

                // List current active servers we are sending to
                for( idx = 0; idx < state.current_servers.length; idx++ ) {
                    cur.push( state.current_servers[idx].name );
                }

                if( config.overflow_stream ) {
                    map[ config.overflow_stream.name ] = config.overflow_stream.stats();
                }

                // return that and stats back
                return C._json_pp(
                    { stats: stats, active_servers: cur, all_servers: map });

            case "config":
                return C._json_pp( config );

            case "ping":
                return "pong";


            case "__dump":
                C._debug( state );
                return "OK";

            case "help":
                return "Try any of: config, ping, stats, help\n"

            default:
                var out = "ADMIN ERROR: UNKNOWN COMMAND " +  cmd + "\n";
                C._debug( out );
                return out;
        }
    } catch(e) {
        var out = "ADMIN ERROR on '" + cmd + "': " + U.inspect( e );
        C._log( out );
        return out;
    }
}


// ****************************************
// Admin Server object
// ****************************************

var AdminServer = exports.AdminServer = function( port, address ) {

    // This could be a unix socket; if it has ANY non digits, it's
    // basically a socket. LL.Stream will do the right thing, but
    // we want to get a pretty diagnostic too.
    if( port.match(/\D/) ) {
        C._debug( "Starting admin server on socket://" + port );
    } else {
        C._debug( U.format( "Starting admin server on tcp://%s:%s", address, port ) );
    }

    // On connection, dispatch to our callback
    new LL.Stream( 'admin', port, address, function(ll, conn) {

        // These are line based commands
        conn.setEncoding('ascii');

        // Dispatch the command
        conn.on( 'data', function (data) {
            var cmd     = data.trim();

            conn.write( ___admin_command.bind( ll )( cmd ) );
        });
    });
}

