var U   = require('util');
var FS  = require('fs');
var AP  = require('argparser');

// ********************************************
// Config parsing - reloaded when file changes
// ********************************************

var Configurator = (function ( config_file ) {

    // the config file used
    this.config_file    = config_file;

    // default settings
    this.default_config = {
        // TODO: support sockets/udp
        unix_socket:            '/tmp/piped.socket',
        udp_port:               1338,
        encoding:               'ascii',
        debug:                  true,
        trace:                  false,
        tcp_port:               1337,
        bind_address:           '127.0.0.1',
        admin_port:             1338,
        admin_bind_address:     '127.0.0.1',
        reconnect_interval:     1000,           // in ms
        servers:                [ //"tcp://localhost:10001",
                                  //"tcp://localhost:10002",
                                  //"/tmp/echo1.socket",
                                  "udp://localhost:10005",
                                ],
    };

    var self = this;

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

            // new values assigned, emit the on change event
            self.config = config;
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
