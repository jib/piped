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
var Base            = require('./base');
var C               = require('./common');
var Configurator    = require('./configurator');
var LocalListen     = require('./local_listen');
var RemoteSend      = require('./remote_send');
var RemotePool      = require('./remote_pool');
var AdminServer     = require('./admin_server');

// *********************************
// Utility functions
// *********************************

function _usage( msg ) {
    var usage = "\n\
Usage: node lib/piped.js /path/to/config file [--option=value, ...]\n\
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
    var BO = new Base.BaseObject();

    if( config_file === undefined ) {
        // I don't know what to do with out a config file.
        throw _usage( "Missing config file" );
    }

    // Callback will be called when the config is ready to go.
    Configurator.Configurator( config_file, opts, function( config_object ) {

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
        // Remote connections
        // *********************************
        RemotePool.RemotePool(config.servers).connect_to_servers(function(remote_pool){

            C._trace( remote_pool );
        });

    });

// first arg to the app is the config file, the rest are arguments
}( process.argv[2], process.argv.slice(3) ) );


/*

        // *********************************
        // TCP server
        // *********************************

        if( config.tcp_port ) {
            var tcp = new LL.LocalStreamListen(
                        'tcp', config.tcp_port, config.bind_address );

            C._trace( tcp.is_stream );
        }

        var rs = new RS.RemoteStreamSend(
                    "tcp://localhost:10001", "localhost", 10001 );

*/
