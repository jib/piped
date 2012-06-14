"use strict";


// To lint the JS code in this project, run:
//
//   jslint.js bin/piped.js lib/*.js --nomen --plusplus --white --node --continue --eqeq --vars --evil --forin --regexp
//
// Also see:
//
//   http://www.jslint.com/



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
    var usage = "\
Usage: node bin/piped.js [--config=/path/to/configfile] [--option=value, ...]\n\
\n\
Examples:\n\
    node bin/piped.js --config=/etc/piped/config.js --debug --trace\n\
\n\
    node bin/piped.js --servers='[\"tcp://foo:1234\"]' --admin_port=/tmp/admin.sock\n";

    return msg ? "ERROR: " + msg + "\n\n" + usage : usage;
}

// *********************************
// Main program
// *********************************

(function( opts ) {
    // Callback will be called when the config is ready to go.
    Configurator.Configurator( opts, function( config_object ) {

        // We only care about the config at this point, not the
        // default config or options passed in
        var config = config_object.config;

        /* Basic error checking */

        // Did you want usage info?
        if( config_object.opts.help || config_object.opts.h ) {
            process.stderr.write( _usage() );
            process.exit(0);
        }

        // No servers means fatality; where would we connect to?
        if( !config.servers[0].length) {
            throw( _usage("No server entries detected: " + U.inspect( config.servers )) );
        }

        // No ports means fatality: where would you connect to?
        if(!config.udp_port && !config.tcp_port && !config.unix_socket && !config.stdin) {
            throw( _usage("No listening sockets detected: " + U.inspect( config )) );
        }

        var BO = new Base.BaseObject();

        // This will now be available to any other object building
        // off of BaseObject; It's the FIRST thing we should set, so
        // all other code can access it.
        BO._set_config_object( config_object );

        // If you enabled trace, let's show you the config we're
        // running with
        C._trace( config_object );


        // We'll add all the listeners we have here.
        var state = BO.state_object();


        // *********************************
        // Admin Server
        // *********************************

        // You may have /explicitly/ disabled it. Fine, then we won't start it
        if( config.admin_port ) {
            state.listeners.admin = AdminServer.AdminServer( config.admin_port, config.admin_bind_address );
        }

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
                state.listeners.tcp = new LocalListen.Stream(
                    'tcp', config.tcp_port, config.bind_address, dispatcher.dispatch
                );
            }

            // *********************************
            // Unix socket
            // *********************************

            if( config.unix_socket ) {
                state.listeners.socket = new LocalListen.Stream(
                    'socket', config.unix_socket, false, dispatcher.dispatch
                );
            }

            // *********************************
            // UDP server
            // *********************************

            if( config.udp_port ) {
                state.listeners.udp = new LocalListen.UDP(
                    'udp', config.udp_port, config.bind_address, dispatcher.dispatch
                );
            }

            // *********************************
            // Stdin
            // *********************************

            if( config.stdin ) {
                state.listeners.stdin = new LocalListen.STDIN(
                    'stdin', dispatcher.dispatch );
            }

            // *********************************
            // Files to tail
            // *********************************

            if( config.files && config.files.length ) {
                var i;
                for( i=0; i < config.files.length; i++ ) {
                    state.listeners.files[i] = new LocalListen.File(
                        'file://' + config.files[i],
                        config.files[i],
                        dispatcher.dispatch
                    );
                }
            }
        });
    });
}( process.argv.slice(2) ) );
