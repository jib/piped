var C               = require('../lib/common').common();
var TestLib         = require('./lib/test');
var U               = require('util');
var Base            = require('../lib/base');

TestLib.Test( function( test, testlib, config ) {

    test.testBase = function( t ) {
        var obj = Base.BaseObject();

        // base
        t.ok( obj,              "Object creted" );
        t.equal( typeof(obj), 'object',
                                "   It's an object" );

        // config
        var cfg = obj.config_object();
        t.equal( typeof( cfg ), 'object',
                                "Config object" );
        t.deepEqual( cfg, config,
                                "   Same as the global config" );


        // state
        var state = obj.state_object();
        t.equal( typeof( state ), 'object',
                                "State object" );
        t.ok(state.listeners,   "   .listeners" );
        t.ok(state.all_servers, "   .all-servers" );
        t.ok(state.current_servers,
                                "   .current_servers" );

        // stats
        var stats = obj.stats_object();
        t.equal( typeof( stats ), 'object',
                                "Stats object" );
        t.ok(stats.connections, "   .connections" );
        // uptime is 0 until stats get updated.
        t.ok(stats.uptime === 0,"   .uptime" );
        t.ok(stats.start_time > 1000,
                                "   .start_time" );

        t.done();
    }

    testlib.run();
});
