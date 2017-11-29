"use strict";


var AdminServer     = require('../lib/admin_server');
var TestLib         = require('./lib/test');


TestLib.Test( function( test, testlib, config ) {
    var run_cmd = AdminServer.___admin_command.bind( testlib );

    test.testCommands = function( t ) {

        var map = {
            help:   new RegExp('Try any of'),
            ping:   new RegExp('pong'),
            config: new RegExp('servers'),
            __dump: new RegExp('OK'),
            stats:  new RegExp('uptime'),
            foo:    new RegExp('ADMIN ERROR: UNKNOWN COMMAND'),
        };

        var cmd;
        for( cmd in map ) {
            var out = run_cmd(cmd);

            t.ok( out,          "Got output from command: " + cmd );
            t.ok( map[cmd].test( out ),
                                "   Matches '"+ map[cmd].source +"'" );

            //testlib.diag( out );
        }

        t.done();
    };

    testlib.run();
});
