var LL              = require('../lib/local_listen');
var RS              = require('../lib/remote_send');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common');

var Dgram           = require("dgram");
var U               = require('util');
var Net             = require('net');

// **************************
// Individual test functions
// **************************

var _stream_test = function( type, port, host ) {

    // The listener
    var ll = new LL.LocalStreamListen( type, port, host,
        // on connect
        function( ll, conn ) {
            C._trace( ll );

            conn.on( 'data', function (data) {
                C._trace( [ U.format( "OK: %s:%s", type, port), data ] );
                OK++;
            });
        },
        // on listen
        function( ll ) {
            var sock = Net.createConnection( port, host );

            C._trace( [ "socket: ", sock  ]);

            sock.on( 'error', function(e) { C._trace( [ type, e ] ); FAIL++ } );
            sock.write( type );
        }
    );
};

var _udp_test = function( type, port, host ) {

    // The listener
    var ll = new LL.LocalUDPListen( type, port, host,
        // on data
        function( ll, data ) {
            C._trace( ll );
            C._trace( [ U.format( "OK: %s:%s", type, port), data ] );
            OK++;
        },
        // on listen
        function( ll ) {
            var sock = Dgram.createSocket("udp4");

            C._trace( [ "udp: ", sock  ]);
            sock.on( 'error', function(e) { C._trace( [ type, e ] ); FAIL++ } );

            var buf  = new Buffer( type );
            sock.send( buf, 0, buf.length, port, host );
        }
    );
};

// **************************
// Test configuration
// **************************

var TESTS       = {
    'unix': [ _stream_test, '/tmp/socket.piped' ],  // XXX relative to this file?
    'tcp':  [ _stream_test, 10001, 'localhost' ],
    'udp':  [ _udp_test,    10011, 'localhost' ],
}

var TestCount   = 3;    // XXX count the keys of TESTS
var OK          = 0;
var FAIL        = 0;
var BO          = new Base.BaseObject();

// **************************
// Main loop
// **************************

Configurator.config( null, ["--debug", "--trace"], function( config_object ) {
    BO._set_config_object( config_object );

    U.log( U.inspect( config_object ) );

    for( var type in TESTS ) {
        C._trace( [ type, TESTS[type] ] );

        // Run the individual test
        TESTS[type][0]( type, TESTS[type][1], TESTS[type][2] );
    }
});

// **************************
// Check if tests succeeded
// **************************

// Check if we're done, once a second.
var Checks = 0;
setInterval( function () {
    Checks++;
    if( OK + FAIL >= TestCount ) {
        U.log( U.format( "Test result\nOK: %s\nFAIL: %s\nTotal: %s\n",
                            OK, FAIL, OK + FAIL ) );
        // XXX exit here
    } else if ( Checks >= 5 ) {
        U.log( U.format( "Execution time expired" ) );
        // XXX exit here with error code
    }
}, 1000 );



