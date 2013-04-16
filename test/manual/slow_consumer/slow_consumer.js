"use strict";

var U       = require('util');
var LL      = require('../../../lib/local_listen');
var C       = require('../../../lib/common').common();
var sleep   = require('sleep');

// On connection, dispatch to our callback
(function( opts ) {
    var port    = opts[0] || 10001;
    var delay   = opts[1] || 1000;  // in milliseconds

    C._log( "Binding to port " + port + " - Delay in processing: " + delay + "ms" );

    var ll      = new LL.Stream( 'admin', port, 'localhost', function(ll, conn) {

        // These are line based commands
        conn.setEncoding('ascii');

        // Dispatch the command
        conn.on( 'data', function (data) {
            sleep.usleep( delay * 1000 );
            C._log('.');
            //C._log(data);
        });
    });

    return ll;

}( process.argv.slice(2) ) );
