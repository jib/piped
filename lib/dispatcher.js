"use strict";

// *********************************
// Libraries
// *********************************

var U               = require('util');
var Base            = require('./base');
var C               = require('./common');

var Dispatcher = exports.Dispatcher = function() {
    var obj      = Base.BaseObject();

    obj.dispatch = function( listener, conn ) {
        var state = this.state_object();

        // First, some bookkeeping; the listener got called,
        // so we're increasing it's stats
        listener.incr_stats();

        // Now, loop through all the remote servers we're supposed
        // to deliver this message to
        var i;
        for( i = 0; i < state.current_servers.length; i++ ) {
            var remote = state.current_servers[ i ];

            // Increment the remote stats, as we're using its connection
            remote.incr_stats();

            // There's 2 options; either both the listener & the remote
            // are streams, at which point we can pipe them, or they're
            // not, at which point we invoke it's 'send' method.

            // They're both streams, hooray; faster & easier
            if( listener.is_stream && remote.is_stream ) {
                C._trace( "Piping to " + remote.name );

                // if the listener is a stream 'conn' is an actual connection
                conn.pipe( remote.connection, { end: false } );

            // If the listener is a stream, then the remote apparently
            // isn't one. So grab the data off the connection and send
            // it to the remote.
            } else if ( listener.is_stream ) {
                C._trace( "Manual send from stream to " + remote.name );

                conn.on( 'data', function (data) {
                    remote.send( data );
                    remote.last_send = C._now();
                });

            // The local listener isn't a stream, so 'conn' is not a
            // connection, but it's the actual data. Ok, send that on
            // to the remote instead
            } else {
                C._trace( "Manual send from non-stream to " + remote.name );
                remote.send( conn );
            }
        }

    }.bind(obj);

    return obj;
}
