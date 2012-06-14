"use strict";

var U   = require('util');
var FS  = require('fs');
var OS  = require('os');

// ********************************************
// Config parsing - read on startup only
// ********************************************

var Configurator = exports.Configurator = function(opts, callback_func) {
    var self = this;

    // default settings
    self.default_config = {
        /* statsd settings */
        statsd_port:            false,
        statsd_host:            'localhost',
        statsd_prefix:          'piped.',
        statsd_suffix:          '.' + OS.hostname().split(".")[0],
        statsd_interval:        1000,
        /* listeners */
        bind_address:           '127.0.0.1',
        tcp_port:               29029,          // like: 1337,
        udp_port:               29029,          // like: 1337,
        udp_max_size:           512,            // max message size: http://xrl.us/bm9q4g
        stdin:                  false,          // listen on stdin?
        unix_socket:            false,          // like: '/tmp/piped.socket',
        files:                  [ ],
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
            var val =  kv[1] == "false"      ? false                 :
                       kv[1] === undefined   ? true                  :
                       kv[1] == "true"       ? true                  :
                       // Important to use '10' as the base: http://xrl.us/JSRadix
                       kv[1].match(/^\d+$/)  ? parseInt( kv[1], 10 ) :
                       // It looks like JSON, let's parse it
                       kv[1].match(/^[\[{]/) ? JSON.parse( kv[1] )   :
                       kv[1];

            map[ key ] = val;
        }

        return map;
    };

    // Parse any options provided
    self.opts = self._opts_to_hash( opts );

    // the config file used, if provided.
    self.file_config = (function(config_file) {
        var file_config = {};

        // If you provided a config file, we'll parse it and get some
        // options from there. otherwise, an empty hash it is.
        if( config_file ) {

            // process the file and create a new config object, merging
            // the default + the file + any cli options
            U.debug( "Reading config file " + config_file );

            var content = FS.readFileSync( config_file, 'utf8' );

            // 2 step declaration, as the variable must be IN the eval, and
            // not the result, ie file_config = eval( data ) does not DTRT.

            eval( 'file_config = ' + content );
        }

        return file_config;
    }( self.opts.config ));

    // Integrate all the config options and do a sanity check/clean up
    self.config = (function() {
        var config = {};
        var i;

        for( i in self.default_config ) {
            if( self.default_config.hasOwnProperty(i) ) {

                // if specified, use the cli option, otherwise use the version
                // from the file, otherwise, default
                config[i]   = self.opts[i]        !== undefined ? self.opts[i]        :
                              self.file_config[i] !== undefined ? self.file_config[i] :
                              self.default_config[i];
            }
        }

        // polish away the difference between a single
        // list of servers and multiple lists of servers
        // (for fanout purposes) by rewriting the single
        // list to a nested list with one entry. ie:
        // [ foo, bar ] becomes [ [ foo, bar ] ]
        if( !U.isArray( config.servers[0] ) ) {
            config.servers = [ config.servers ];
        }

        return config;
    }());

    // Now that the config is setup, call the callback
    callback_func( self );
};

