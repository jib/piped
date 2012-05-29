"use strict";

var LL              = require('../lib/local_listen');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common').common();
var RP              = require('../lib/remote_pool');
var Test            = require('./lib/test');

var U               = require('util');
var Net             = require('net');

var TestCount       = 4         // Amount of nodes being connected
                      +5;


Test.Test( TestCount, function( test, config ) {

    // We're setting up some 'remotes' inside the test case for the RemotePool
    // to connect to.
    var listeners   = [];
    var remotes     = [ [], [] ];
    var node_count  = 4;
    var i           = 0;
    var base_port   = 10001;

    for( i = 0; i < node_count; i++ ) {
        var my_port = base_port + i;

        // start a listener
        listeners.push( new LL.Stream( 'tcp', my_port, undefined, function(){} ) );

        // alternatingly put them in remotes[0] or remotes[1]
        remotes[ i % 2].push( U.format( "tcp://localhost:%s", my_port ) );
    }

    //C._trace( remotes );

    new RP.RemotePool( remotes ).connect_to_servers( function(rp) {
        C._trace( test.state_object() );



        // 1: Make sure all above hosts are connected
        // 2: Make sure that if tcp1 goes away, it's flagged and tcp2 takes over
        // 3: If tcp2 goes away, we fail over to overflow/flag it
        // 4: if tcp1/2 come back, that's flagged and we resume sending
    });


});

