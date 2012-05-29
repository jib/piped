"use strict";

var Configurator    = require('../../lib/configurator');
var Base            = require('../../lib/base');
var C               = require('../../lib/common').common();
var U               = require('util');


var Test = exports.Test = function( test_count, func, time_out ) {
    new Configurator.Configurator( null, ["--debug", "--trace"],  function( cfg ) {
        var obj = Base.BaseObject();

        // populate the configuration
        obj._set_config_object( cfg );

        obj.ok          = 0;
        obj.fail        = 0;
        obj.checks      = 0;
        obj.time_out    = time_out || 5;
        obj.test_count  = test_count;

        // **************************
        // Check if tests succeeded
        // **************************

        // Check if we're done, once a second.
        var Checks = 0;
        setInterval( function () {
            obj.checks++;
            if( obj.ok + obj.fail >= obj.test_count ) {
                U.log( U.format( "Test result\nOK: %s\nFAIL: %s\nTotal: %s\n",
                                    obj.ok, obj.fail, obj.ok + obj.fail ) );

                // exit with the amount of failed tests
                process.exit( obj.fail ? obj.fail : 0 );

            } else if ( obj.checks >= obj.time_out ) {
                U.log( U.format( "Execution time expired" ) );

                // exit 255 if we're running over execution time
                process.exit( 255 );
            }
        }, 1000 );

        // dump config for verification
        C._trace( cfg );

        func( obj, cfg );
    });
};
