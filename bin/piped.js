"use strict";

/*
To lint the JS code in this project, run:

  jslint.js lib/piped.js lib/configurator.js --nomen --plusplus --white --node --continue --eqeq --vars

Also see:

  http://www.jslint.com/
*/


// *********************************
// Libraries
// *********************************

var U               = require('util');
var Base            = require('../lib/base');
var C               = require('../lib/common').common();
var Configurator    = require('../lib/configurator');
var LocalListen     = require('../lib/local_listen');
var RemoteSend      = require('../lib/remote_send');
var RemotePool      = require('../lib/remote_pool');
var AdminServer     = require('../lib/admin_server');
var Dispatcher      = require('../lib/dispatcher');

// *********************************
// Utility functions
// *********************************

function _usage( msg ) {
    var usage = "\n\
Usage: node bin/piped.js /path/to/configfile [--option=value, ...]\n\
    ";

    return "ERROR: " + msg + usage;
}

// *********************************
// Utility functions
// *********************************




// *********************************
// Main program
// *********************************

(function( config_file, opts ) {
    if( config_file === undefined ) {
        // I don't know what to do with out a config file.
        throw _usage( "Missing config file" );
    }

    // Callback will be called when the config is ready to go.
    Configurator.Configurator( config_file, opts, function( config_object ) {

        var BO = new Base.BaseObject();

        // This will now be available to any other object building
        // off of BaseObject; It's the FIRST thing we should set, so
        // all other code can access it.
        BO._set_config_object( config_object );

        // If you enabled trace, let's show you the config we're
        // running with
        C._trace( config_object );

        // We only care about the config at this point, not the
        // default config or options passed in
        var config = config_object.config;

        // *********************************
        // Admin Server
        // *********************************
        AdminServer.AdminServer( config.admin_port, config.admin_bind_address );


        // *********************************
        // Statsd backend?
        // *********************************

        if( config.statsd_port ) {
            var statsd = RemoteSend.UDP(
                            'statsd', config.statsd_port, config.statsd_host );

            BO._set_statsd_object( statsd );

            C._debug( U.format( 'Using statsd backend udp://%s:%s',
                config.statsd_host, config.statsd_port ) );
        }

        // *********************************
        // Remote connections
        // *********************************
        RemotePool.RemotePool(config.servers).connect_to_servers(function(remote_pool) {

            // LocalListeners expect to be provided a callback function on
            // what to do with the incoming data/connection they receive.
            // We use a dispatcher class for that, and we'll hand a dispatch
            // function as the callback
            var dispatcher = Dispatcher.Dispatcher( );

            // Remotes are now established. Time to listen locally to start
            // accepting traffic.

            // *********************************
            // TCP server
            // *********************************

            if( config.tcp_port ) {
                new LocalListen.Stream(
                    'tcp', config.tcp_port, config.bind_address, dispatcher.dispatch
                );
            }

            // *********************************
            // Unix socket
            // *********************************

            if( config.unix_socket ) {
                new LocalListen.Stream(
                    'socket', config.unix_socket, false, dispatcher.dispatch
                );
            }

            // *********************************
            // UDP server
            // *********************************

            if( config.udp_port ) {
                new LocalListen.UDP(
                    'udp', config.udp_port, config.bind_address, dispatcher.dispatch
                );
            }

            // *********************************
            // Stdin
            // *********************************

            if( config.stdin ) {
                new LocalListen.STDIN( 'stdin', dispatcher.dispatch );
            }

        });
    });
// first arg to the app is the config file, the rest are arguments
}( process.argv[2], process.argv.slice(3) ) );
