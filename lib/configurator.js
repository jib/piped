"use strict";

var U   = require('util');
var FS  = require('fs');
var OS  = require('os');

// ********************************************
// Config parsing - read on startup only
// ********************************************

var Configurator = exports.Configurator = function(config_file, opts, callback_func) {
    var self = this;

    // the config file used
    self.config_file    = config_file;

    // default settings
    self.default_config = {
        /* statsd settings */
        statsd_port:            false,
        statsd_host:            'localhost',
        statsd_prefix:          'piped.',
        statsd_suffix:          '.' + OS.hostname().split(".")[0],
        /* listeners */
        bind_address:           '127.0.0.1',
        tcp_port:               29029,          // like: 1337,
        udp_port:               29029,          // like: 1337,
        udp_max_size:           512,            // max message size: http://xrl.us/bm9q4g
        stdin:                  false,          // listen on stdin?
        unix_socket:            false,          // like: '/tmp/piped.socket',
        /* admin server */
        admin_port:             29030,          // Can be a unix socket too
        admin_bind_address:     '127.0.0.1',
        /* run time settings */
        monitor_interval:       50,             // in ms
        reconnect_interval:     1000,           // in ms
        no_duplicates:          true,
        encoding:               'ascii',
        debug:                  false,
        trace:                  false,
        /* File settings / Overflow - currently not supported
        file_mode:              "0600",
        overflow_stream:        false,          // opened here based on vars below
        overflow_file_mode:     "0600",
        overflow_file:          '/tmp/node/overflow',
        */
        servers:                [ ],
    };

    // make a quick hash, which will be used in the main loop for option dispatch
    // tried to use argparser (via npm install argparser), but it requires you to
    // define all options up front, including their type, etc. Too cumbersome.
    // Alias the function, so we can test it;
    self._opts_to_hash = function ( opts ) {
        var map = {};
        var idx = 0;
        for( idx = 0; idx < opts.length; idx++ ) {
            var str = opts[idx];
            var kv  = str.split("=");

            // string the leading dash(es) off the key
            var key = kv[0].replace( /^-+/, "" );
            var val =  kv[1] == "false"     ? false             :
                       kv[1] === undefined  ? true              :
                       kv[1] == "true"      ? true              :
                       kv[1].match(/^\d+$/) ? parseInt( kv[1] ) : // XXX: jslint Missing radix parameter.
                       kv[1];

            map[ key ] = val;
        }
        return map;
    };

    self.opts = self._opts_to_hash( opts );

    self._process_config = function( file_config ) {
        var config = {};
        var idx;

        // XXX jslint: The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype.
        for( idx in self.default_config ) {

            // if specified, use the cli option, otherwise use the version
            // from the file, otherwise, default
            config[idx] = self.opts[idx]   !== undefined ? self.opts[idx]    :
                          file_config[idx] !== undefined ? file_config[idx]  :
                          self.default_config[idx];
        }

        return config;
    };

    // For testing purposes, we can pass in a NULL config and we'll not
    // try to open the file. Won't work for production as it won't start
    // any backend.
    if( config_file === null ) {
        self.config = self._process_config( {} );
        callback_func( self );

    } else {
        (function(config_file, opts) {

            // this will hold the fully integrated config that we'll return.
            var config = {};

            // process the file and create a new config object, merging
            // the default + the file + any cli options
            U.debug( "Reading config file " + config_file );

            FS.readFile( config_file, function (err, data) {

                // for some reason, we can't read the config file. Bail.
                if (err) { throw "ERROR: Could not open "+ config_file +":\n"+ err; }

                // 2 step declaration, as the variable must be IN the eval,
                // and not the result, ie file_config = eval( data ) does not
                // DTRT.
                var file_config;
                eval( 'file_config = ' + data );

                config = self._process_config( file_config );

                //U.log( U.inspect( config ) );

                // polish away the difference between a single
                // list of servers and multiple lists of servers
                // (for fanout purposes) by rewriting the single
                // list to a nested list with one entry. ie:
                // [ foo, bar ] becomes [ [ foo, bar ] ]
                if( !U.isArray( config.servers[0] ) ) {
                    config.servers = [ config.servers ];
                }

                // No servers means fatality; where would we connect to?
                if( !config.servers[0].length) {
                    throw( "No server entries detected: " + U.inspect( config.servers ) );
                }

                // No ports means fatality: where would you connect to?
                if( !config.udp_port && !config.tcp_port && !config.unix_socket ) {
                    throw( "No listening sockets detected: " + U.inspect( config ) );
                }

                // because we're about to call the callback, we have to
                // set self.config here, rather that return it from the
                // function.
                self.config = config;

                callback_func( self );

            });
        }(self.config_file, self.opts));
    }
};

