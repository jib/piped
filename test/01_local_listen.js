"use strict";


var LL              = require('../lib/local_listen');
var RS              = require('../lib/remote_send');
var Base            = require('../lib//base');
var C               = require('../lib/common').common();
var TestLib         = require('./lib/test');

var Dgram           = require("dgram");
var U               = require('util');
var Net             = require('net');



TestLib.Test( function( test, testlib, config ) {

    var _stream_test = function( t, type, port, host ) {
        // The listener
        var ll = new LL.Stream( type, port, host,
            // on connect
            function( ll, conn ) {
                conn.on( 'data', function (data) {

                    t.ok( true, U.format( "Received data on %s:%s - %s",
                            type, port, data ) );
                    t.done();
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
                var rs  = new RS.Stream( type, port, host );
                rs.send( type );
            }
        );
    };

    test.testSocket = function( t ) {
        // XXX relative to this file?
        _stream_test( t, 'unix', '/tmp/socket.piped' );
    };

    test.testTCP = function( t ) {
        _stream_test( t, 'tpc', 10001, 'localhost' );
    };

    test.testUDP = function ( t ) {
        var type = 'udp';
        var port = 10001;
        var host = 'localhost';

        // The listener
        var ll = new LL.UDP( type, port, host,
            // on data
            function( ll, data ) {
                t.ok( true, U.format( "Received data on %s:%s - %s", type, port, data ) );
                t.done();
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

                var rs = RS.UDP( type, port, host );
                rs.send( type );
            }
        );
    };

    // run the tests
    testlib.run();
});




