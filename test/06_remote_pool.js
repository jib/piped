"use strict";

var LL              = require('../lib/local_listen');
var RP              = require('../lib/remote_pool');
var TestLib         = require('./lib/test');
var U               = require('util');


TestLib.Test( function( test, testlib, config ) {

    // We're setting up some 'remotes' inside the test case for the RemotePool
    // to connect to.
    var listeners   = [];
    var remotes     = [ [], [] ];
    var node_count  = 4;
    var i           = 0;
    var base_port   = 10001;
    var start_delay = 500;  // Miliseconds to wait until tests run

    for( i = 0; i < node_count; i++ ) {
        var my_port = base_port + i;

        // start a listener
        listeners.push( new LL.Stream( 'tcp', my_port, undefined, function(){} ) );

        // alternatingly put them in remotes[0] or remotes[1]
        remotes[ i % 2].push( U.format( "tcp://localhost:%s", my_port ) );
    }

    //C._trace( remotes );

    new RP.RemotePool( remotes ).connect_to_servers( function(rp) {

        // Let's give the remote connection code a bit of time to
        // get started, before we start polling things. We could
        // do this through callbacks, but it's a specialized case
        // for testing, so we'll just do it like this for now:
        setTimeout( function() {
            var state = testlib.state_object();

            // 1: Make sure all above hosts are connected
            // 2: Make sure that if tcp1 goes away, it's flagged and tcp2 takes over
            // 3: If tcp2 goes away, we fail over to overflow/flag it
            // 4: if tcp1/2 come back, that's flagged and we resume sending
            test.RemotesAvailable = function(t) {

                var name;
                for( name in state.all_servers ) {
                    var rs = state.all_servers[name];

                    // Node up?
                    t.ok( rs.is_available(), "Remote is available: " + name );
                }

                //C._trace( state );

                // the current server list, as represented in names
                var _cur_servers = function() {
                    var cs = [];

                    var i;
                    for( i = 0; i < state.current_servers.length; i++ ) {
                        cs.push( state.current_servers[i].name );
                    }

                    return cs;
                };

                // The current server list should be the first 2 entries
                // of each of the remotes hash
                t.deepEqual( _cur_servers(), [ remotes[0][0], remotes[1][0] ],
                    "Current server list are the first 2 remotes"
                );

                // Test sick/healthy changes
                (function(){
                    var cs = _cur_servers();

                    // Now, mark the current servers sick
                    var i;
                    for( i = 0; i < cs.length; i++ ) {
                        state.all_servers[ cs[i] ].mark_as_down();
                    }

                    // Now, the current server list should be refreshed,
                    // and we should get different servers in there
                    setTimeout( function() {
                        var new_cs = _cur_servers();
                        t.deepEqual( new_cs, [ remotes[0][1], remotes[1][1] ],
                            "Current server list updated with healthy servers" );

                        // Now, mark the old current servers healthy again
                        var i;
                        for( i = 0; i < cs.length; i++ ) {
                            state.all_servers[ cs[i] ].mark_as_up();
                        }

                        setTimeout( function() {
                            // The current server list should be the first 2 entries
                            // of each of the remotes hash again
                            t.deepEqual( cs, [ remotes[0][0], remotes[1][0] ],
                                "Current server list are the first 2 remotes again" );

                            // Done with this test set.
                            t.done();
                        }, 500 );
                    }, 500 );
                }());
            };

            // and run the tests
            testlib.run();

        }, start_delay );
    });
});
