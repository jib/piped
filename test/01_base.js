var C               = require('../lib/common').common();
var TestLib         = require('./lib/test');
var Base            = require('../lib/base');

TestLib.Test( function( test, testlib, config ) {
    var obj = Base.BaseObject();

    test.testBase = function( t ) {
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
    };

    test.testCommon = function( t ) {

        // Timestamp
        t.ok( C._now() > 500,   "Common._now" );
        t.ok( C._now() >= obj.stats_object().start_time,
                                "   Is newer than start up time" );

        // Serialize
        t.equal( C._json_pp( {} ), '{}',
                                "Serialization" );

        // logging functions
        t.ok( true,             "Logging functions" );
        t.ok( C._log,           "   .log" );
        t.ok( C._debug,         "   .debug" );
        t.ok( C._trace,         "   .trace" );
        t.ok( C._error,         "   .error" );

        t.done();
    };

    testlib.run();
});
