"use strict";


var LL              = require('../lib/local_listen');
var RS              = require('../lib/remote_send');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common');
var Test            = require('./lib/test');

var Dgram           = require("dgram");
var U               = require('util');
var Net             = require('net');

var OK          = 0;
var FAIL        = 0;
var BO          = new Base.BaseObject();

// **************************
// Individual test functions
// **************************

var _stream_test = function( test, type, port, host ) {

    // The listener
    var ll = new LL.LocalStreamListen( type, port, host,
        // on connect
        function( ll, conn ) {
            C._trace( ll );

            conn.on( 'data', function (data) {
                C._trace( [ U.format( "OK: %s:%s", type, port), data ] );
                test.ok++;
            });
        },
        // on listen
        function( ll ) {

            /* This is the manual way of connecting, but prefer to use
               our own code for it, so both ends get testsed
            var sock = Net.createConnection( port, host );
            C._trace( [ "socket: ", sock  ]);
            sock.on( 'error', function(e) { C._trace( [ type, e ] ); FAIL++ } );
            sock.write( type );
            */

            // Connect using our remote code
            var rs  = new RS.RemoteStreamSend( type, port, host );
            rs.send( type );
        }
    );
};

var _udp_test = function( test, type, port, host ) {

    // The listener
    var ll = new LL.LocalUDPListen( type, port, host,
        // on data
        function( ll, data ) {
            C._trace( ll );
            C._trace( [ U.format( "OK: %s:%s", type, port), data ] );
            test.ok++;
        },
        // on listen
        function( ll ) {

            /* This is the manual way of connecting, but prefer to use
               our own code for it, so both ends get testsed
            C._trace( [ "udp: ", sock  ]);

            var sock = Dgram.createSocket("udp4");
            sock.on( 'error', function(e) { C._trace( [ type, e ] ); FAIL++ } );

            var buf  = new Buffer( type );
            sock.send( buf, 0, buf.length, port, host );
            */

            var rs = RS.RemoteUDPSend( type, port, host );
            rs.send( type );
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
};

var TestCount   = Object.keys(TESTS).length;    // XXX count the keys of TESTS

// **************************
// Main loop
// **************************

Test.Test( TestCount, function( test, config ) {

    // XXX jslint says: The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype. -- look this one up & fix it.
    var type;
    for( type in TESTS ) {
        C._trace( [ type, TESTS[type] ] );

        // Run the individual test
        TESTS[type][0]( test, type, TESTS[type][1], TESTS[type][2] );
    }
});




