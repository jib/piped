"use strict";


var LL              = require('../lib/local_listen');
var RS              = require('../lib/remote_send');
var C               = require('../lib/common').common();
var TestLib         = require('./lib/test');

var U               = require('util');
var FS              = require('fs');


TestLib.Test( function( test, testlib, config ) {

    var _stream_test = function( t, type, port, host ) {
        // The listener
        new LL.Stream( type, port, host,
            // on connect
            function( ll, conn ) {
                conn.on( 'data', function (data) {

                    t.equal( type, data,
                        U.format( "Received data on %s:%s - %s", type, port, data ) );
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
        _stream_test( t, 'tcp', 10001, 'localhost' );
    };

    test.testUDP = function ( t ) {
        var type = 'udp';
        var port = 10001;
        var host = 'localhost';

        // The listener
        new LL.UDP( type, port, host,
            // on data
            function( ll, data ) {
                t.equal( type, data,
                    U.format( "Received data on %s:%s - %s", type, port, data ) );
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

    test.testFile = function( t ) {
        var type = 'file';

        // XXX relative to this file?
        var file    = '/tmp/piped.test.' + C._now();

        // Make sure this is a /dynamic/ string; tailfd doesn't notice
        // the change in file otherwise.
        var content = C._now() + "\n";

        // First, make sure the file exists and can be opened for appending.
        var fd = FS.openSync( file, 'a' );

        var ll = new LL.File( type, file,
            // on data
            function( ll, data ) {
                t.equal( data, content,
                    U.format( "Received data from %s://%s:", type, file, content ) );

                // And clean up after ourselves
                FS.unlinkSync( file );

                t.done();
            },
            // on listen
            function( ll ) {

                // Give the tail code a moment to open the file and set up
                // all the handlers.
                setTimeout( function() {

                    // And now write some content, which should be picked up
                    // Note here: https://github.com/joyent/node/blob/v0.10.33/lib/fs.js#L527
                    // and here: https://github.com/joyent/node/blob/master/lib/fs.js#L551
                    // that the proper API when passing content as a string is:
                    //   fs.writeSync(fd, string[, position[, encoding]]);
                    // rather than
                    //   fs.writeSync(fd, buffer, offset, length[, position]);
                    FS.writeSync( fd, content );
                }, 500 );
            }
        );
    };

    // run the tests
    testlib.run();
});




