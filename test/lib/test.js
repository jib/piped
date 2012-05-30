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
        obj.time_out    = time_out   || 5;
        obj.test_count  = test_count || 'no_plan';
        obj.no_plan     = obj.test_count == 'no_plan' ? "UNKNOWN" : false;

        if( obj.no_plan ) {
            C._log( 'You are using "no_plan" - that is good for development, but ' +
                    'you will want to switch to a test count before commiting: '   +
                    'now you will have to wait until the test timeout' );
        }

        C._log( U.format( "TEST: Expecting %s tests (timeout: %s secs)",
            obj.no_plan || obj.test_count, obj.time_out ) );

        // **************************
        // Check if tests succeeded
        // **************************

        // Check if we're done, once a second.
        var Checks = 0;
        setInterval( function () {
            obj.checks++;

            var timed_out = obj.checks >= obj.time_out;

            // If we've run for too long, or ran all the tests, time to
            // come up with a verdict
            if( timed_out || (obj.ok + obj.fail >= obj.test_count) ) {
                U.log( U.format( "Test result\nOK: %s\nFAIL: %s\nTotal: %s\n",
                                    obj.ok, obj.fail, obj.ok + obj.fail ) );
                if( timed_out ) {
                    U.log( U.format(
                        "Execution time (%s sec) expired. Missing %s test results",
                        obj.time_out, obj.no_plan || (obj.test_count - obj.ok - obj.fail)
                    ) );
                }

                // exit with the amount of failed tests, or 255 if we exceeded
                // the time out. Unless you were using 'no_plan', and we will
                // just exit with the failure count, which may have been 0,
                // at which point the run succeeded
                var my_exit = timed_out ? (obj.no_plan ? obj.fail : 255  ) :
                              obj.fail  ? obj.fail :
                              0;

                process.exit( my_exit );
            }
        }, 1000 );

        // dump config for verification
        C._trace( cfg );

        func( obj, cfg );
    });
};
