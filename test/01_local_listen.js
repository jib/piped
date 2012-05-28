var LL              = require('../lib/local_listen');
var RS              = require('../lib/remote_send');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common');
var U               = require('util');
var Net             = require('net');


var BO = new Base.BaseObject();

var TESTS       = {
    'tcp':  [ 10001, 'localhost' ],
    'unix': [ '/tmp/socket.piped' ],
}

var TestCount   = 2;    // XXX count the keys of TESTS
var OK          = 0;
var FAIL        = 0;

Configurator.config( null, ["--debug", "--trace"], function( config_object ) {
    BO._set_config_object( config_object );

    U.log( U.inspect( config_object ) );

    for( var type in TESTS ) {
        C._trace( [ type, TESTS[type] ] );

        // Run the individual test
        _test( type, TESTS[type][0], TESTS[type][1] );
    }
});

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


function _test( type, port, host ) {

    // The listener
    var ll = new LL.LocalStreamListen( type, port, host,
        // on connect
        function( ll, conn ) {
            C._trace( ll );

            conn.on( 'data', function (data) {
                C._trace( [ "tcp:10001", data ] );
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
