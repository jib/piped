"use strict";

var LocalListen     = require('../lib/local_listen');
var Base            = require('../lib/base');
var Dispatcher      = require('../lib/dispatcher');
var C               = require('../lib/common').common();
var TestLib         = require('./lib/test');
var U               = require('util');
var Events          = require('events');

TestLib.Test( function( test, testlib, config ) {

    // Dispatcher object
    var d           = Dispatcher.Dispatcher( );

    var endpoints   = {
        // name     is it a stream?
        tcp:        true,
        udp:        false,
        socket:     true,
    };

    // 'Remote' servers we're connecting to;
    var remotes = { };

    // XXX we know how dispatch() works, so we'll set up
    // the appropriate state for it here by poking inside
    // the object.
    // Every request will be sent to all of the below end
    // points

    // ************************************************
    // Remote servers
    // ************************************************
    (function(){

        var endpoint;
        for( endpoint in endpoints ) {
            var obj = { endpoint: endpoint };

            // These will be the 'remote' servers we connect to
            remotes[endpoint] = {
                name:       endpoint,
                connection: endpoint,
                is_stream:  endpoints[endpoint],
                incr_stats: function () {
                    // This gives no clue as to what the remote is
                    //C._trace( [ 'stats', this ] );
                },
                send:       function (conn) {
                    // update book keeping
                    conn._sent( this );
                }.bind(obj)
            };
        }
    }());

    // ************************************************
    // Set 'state' to the above server list
    // ************************************************
    (function(){
        var state = d.state_object();

        state.current_servers = [ ]

        var k;
        for( k in remotes ) {
            state.current_servers.push( remotes[k] );
        }

        d._set_state_object( state );

        //C._trace( ['State object saved:', d.state_object() ] );
    }());



    // ************************************************
    // Actual testing functions
    // ************************************************

    var local;
    for( local in remotes ) {
        test[ "test_"+ local +"_dispatch" ] = function( t ) {


            // Mock listener & connection
            // Also the 'object' we want to bind to all functions,
            // that way we can introspect better.
            var listener = {
                // for book keeping
                _stats:     0,          // incr_stats goes here
                _called:    [ ],        // endpoints that got called
                // object mocking
                type:       this.local,
                is_stream:  endpoints[this.local],
            };

            listener.incr_stats = function() { this._stats++ }.bind(listener);

            // the connection that the 'client' created
            var connection = {
                // for bookkeeping
                // This object will be available when doing remote.send()
                // So we'll abuse this function here to update the this._called
                // list above.
                _sent:  function(remote) {
                    this._called[ remote.endpoint ] = 1;
                }.bind( listener ),

                name:   this.local,
                pipe:   function( conn ) {  // 'conn' is the connection type
                    this._called[ conn ] = 1;
                }.bind( listener ),

                // 'on' is only called when the listener isn't a stream,
                // which is only for udp. that's useful, as there's no
                // other way to know that this is a UDP backend otherwise :(
                on:     function( type, callback ) {
                    this._called[ 'udp' ] = 1;
                }.bind( listener )
            }

            d.dispatch( listener, connection );

            // Give the dispatcher a second to do the callbacks
            setTimeout(function() {

                // let's see if our callbacks were all invoked as expected

                t.ok( listener._stats,  "Stats incremented for local " + this.type );

                var remote;
                for( remote in remotes ) {
                    t.ok( this._called[ remote ],
                                    "   Endpoint "+ remote +" got called" );
                }

                t.done();
            }.bind(listener), 500);

        }.bind( {local: local} ); // must bind local or it goes away
    }
    testlib.run();

})

