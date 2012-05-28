"use strict";

var LL              = require('../lib/local_listen');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common');
var RP              = require('../lib/remote_pool');
var Test            = require('./lib/test');

var U               = require('util');
var Net             = require('net');

Test.Test( 1, function( test, config ) {

    // We're setting up some 'remotes' inside the test case for the RemotePool
    // to connect to.
    var tcp1 = new LL.LocalStreamListen( 'tcp', 10001, undefined, function(){} );
    var tcp2 = new LL.LocalStreamListen( 'tcp', 10002, undefined, function(){} );
    var tcp3 = new LL.LocalStreamListen( 'tcp', 10003, undefined, function(){} );
    var tcp4 = new LL.LocalStreamListen( 'tcp', 10004, undefined, function(){} );

    // These are the connection strings matching the 'remotes' above.
    var servers = [ [ "tcp://localhost:10001", "tcp://localhost:10002" ],
                    [ "tcp://localhost:10003", "tcp://localhost:10004" ],
                  ];

    new RP.RemotePool( servers ).connect_to_servers( function(rp) {
        C._trace( test.state_object() );

        // XXX look up how to 'sleep' so we can do the following tests:
        // 1: Make sure all above hosts are connected
        // 2: Make sure that if tcp1 goes away, it's flagged and tcp2 takes over
        // 3: If tcp2 goes away, we fail over to overflow/flag it
        // 4: if tcp1/2 come back, that's flagged and we resume sending
    });


});

