var U       = require('util');
var FS      = require('fs');
var Events  = require("events");

// git clone git://github.com/shinout/argparser.git
// npm install argparser
var AP      = require('argparser');

// ********************************************
// Config parsing - reloaded when file changes
// ********************************************

var Configurator = (function ( config_file, opts ) {

    // the config file used
    this.config_file    = config_file;

    // default settings
    this.default_config = {
        // TODO: support sockets/udp
        unix_socket:            false,          // like: '/tmp/piped.socket',
        udp_port:               false,          // like: 1337,
        encoding:               'ascii',
        debug:                  false,
        trace:                  false,
        tcp_port:               false,          // like: 1337,
        bind_address:           '127.0.0.1',
        admin_port:             1338,
        admin_bind_address:     '127.0.0.1',
        overflow_stream:        false,          // opened here based on vars below
        overflow_file_mode:     0600,
        overflow_file:          '/tmp/node/overflow',
        rescan_interval:        50,             // in ms
        reconnect_interval:     1000,           // in ms
        servers:                [ ],
    };

    var self = this;

    //U.log( opts );

    // make a quick hash, which will be used in the main loop for option dispatch
    self.opts = new AP().parse( opts ).getOptions();

    // anything that you put in YOUR config should be integrated now,
    // overriding any values that are part of the default
    this.update_config = function() {
        U.debug( "Reading config file " + self.config_file );

        // process the file and create a new config object, merging
        // the default + the file

        FS.readFile( self.config_file, function (err, data) {
            if (err) throw err;

            // 2 step declaration, as the variable must be IN the eval,
            // and not the result, ie new_config = eval( data ) does not
            // DTRT.
            var config      = {};
            var new_config;
            eval( 'new_config = ' + data );

            var idx;
            for( idx in self.default_config ) {

                // if specified, use the version from the file, otherwise, default
                config[idx] = new_config[idx] !== undefined
                                ? new_config[idx]
                                : self.default_config[idx];
            }

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

            // store config, emit the on change
            self.config = config;
            // and emit the onchange event.
            self.emit( 'configChanged', self.config );

        });
    };

    this.update_config();

    // If the file got changed, re-process
    FS.watchFile( self.config_file, function( curr, prev ) {
        if( curr.ino != prev.ino ) {
            self.update_config();
        }
    });
});

// make sure we can emit events
U.inherits( Configurator, process.EventEmitter );

// variable that's exported when doing 'require config'
exports.Configurator = Configurator;

// when the config changed, call the callback as specified in
// the calling code.
exports.config = function(file, opts, callbackFunc) {
    var obj = new Configurator(file, opts);
        obj.on('configChanged', function() {
        callbackFunc( obj );
    });
};
