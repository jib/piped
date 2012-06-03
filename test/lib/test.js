"use strict";

var Configurator    = require('../../lib/configurator');
var Base            = require('../../lib/base');
var C               = require('../../lib/common').common();
var nodeunit        = require('../../node_modules/nodeunit/lib/core');
var U               = require('util');


// We use this wrappper to make sure a config is bootstrapped.
// nodeunit's setup/teardown are called before/after each
// individual test, not once per porgram, so we can't use that.

// Unfortunately, nodeunit thinks you can run it external to the
// file and that all test functions are magically present after
// compilation. We build test functions that reference data
// obtained through config/startup/whatever. So we do some
// black magic here, following the reporter interface for nodeunit:
// https://github.com/caolan/nodeunit/blob/master/lib/reporters/minimal.js

exports.Test = function( callback ) {
    new Configurator.Configurator( null, ["--debug", "--trace"],  function( cfg ) {
        var obj     = Base.BaseObject();

        obj._set_config_object( cfg );

        // We don't use the module runner anymore, so opts are no longer
        // necessary. we hook directly into nodeutil's individusal testrun
        // obj.opts = {
        //     done: function (assertions) {
        //         C._trace( ["done", assertions] );
        //     },
        //     moduleDone: function (name, assertions) {
        //         C._trace( ["moduleDone", name, assertions ] );
        //     },
        //     testDone: function (name, assertions) {
        //         C._trace( ["testDone", name, assertions] );
        //     },
        // };

        obj.diag = function( str ) {
            process.stdout.write( "# " + str + "\n" );
        }

        var test = { };

        // Find all the test functions, and dispatch them (serially).
        // Then, when we're done, tally the results.
        obj.run = function( cb ) {

            var funcs           = Object.keys(this);
            obj._ok             = 0;
            obj._fail           = 0;
            obj._done           = 0;
            obj._tests          = 0;
            obj._expected_tests = funcs.length;

            // We're looping over all the tests. When we've run all the
            // test functions (kept track of by a counter), we'll wrap up.
            var i;
            for( i = 0; i < funcs.length; i++ ) {
                var name = funcs[i];
                var func = this[name];

                //C._trace( ["Running test:", name ] );
                if( typeof func === 'function' ) {

                    // Use nodeunit to actually run the test. It gives us access
                    // to all the .ok() .isEqual() etc stuff, and calls us back
                    // with a list of assertions and we can inspect those.
                    nodeunit.runTest( name, func, {}, function(empty,assertions){
                        //C._trace( ["Ran test:", assertions ] );

                        // Bookkeeping.
                        obj._done++;
                        obj._fail   += assertions.failures();
                        obj._ok     += assertions.passes();

                        //obj._tests  += assertions.passes() + assertions.failures();

                        // Test header
                        obj.diag( U.format(
                            "Test: %s - OK: %s - Fail: %s",
                            name, assertions.passes(), assertions.failures()
                        ));

                        // Print out the "OK" or "NOT OK" lines.
                        var j;
                        for( j = 0; j < assertions.length; j++ ) {
                            obj._tests++;

                            var a = assertions[j];

                            //C._trace( a );
                            if( a.error ) {
                                process.stdout.write( U.format(
                                    "NOT OK %s: %s (%s)\n",
                                    obj._tests, a.message, a.error.name
                                ));

                                // Extended diagnostics
                                if( a.error.actual ) {
                                    obj.diag( U.format(
                                        "Got: '%s'\n# Expected: '%s'",
                                        a.error.actual, a.error.expected
                                    ));
                                }

                            } else {
                                process.stdout.write( U.format( "OK %s: %s\n",
                                    obj._tests, a.message
                                ));
                            }
                        }
                    });
                }
            }

            // The way we know the test is done is if every test function
            // we expected to run has had .done() called on it. When that
            // happens, we'll print a final diagnostic and exit 0 if all
            // went well, and 1 if it did not.
            setInterval( function() {
                //C._trace( ["Interval:", obj._done, obj._expected_tests ] );
                if( obj._done >= obj._expected_tests ) {
                    obj.diag( U.format(
                        "Ran %s tests in %s groups. OK: %s - Fail: %s",
                        obj._tests, obj._done, obj._ok, obj._fail
                    ));

                    process.exit( obj._fail ? 1 : 0 );
                }
            }, 500 );

        // bind 'test' so the user can invoke 'obj.run()' to kick off the
        // tests and doesn't need to remember to pass 'test' as a param
        }.bind(test);

        // 'test' is an empty object, which we use to attached test functions
        // too. obj is the BaseObject and cfg is the configuration object.
        callback( test, obj, cfg );
    });
};
