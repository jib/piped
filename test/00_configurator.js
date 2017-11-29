var TestLib         = require('./lib/test');

TestLib.Test( function( test, testlib, config ) {

    test.testBasicSettings = function( t ) {
        t.equal( config.config_file, null,
                                        "No config file is set (testing only!)" );

        // default config
        t.ok( config.default_config,    "There is a default config" );
        t.equal( typeof( config.default_config ), 'object',
                                        "   And it's a hash" );
        t.ok( Object.keys(config.default_config).length > 3,
                                        "   With keys" );

        // parsed config
        t.ok( config.config,            "There is a parsed config" );
        t.equal( typeof( config.config ), 'object',
                                        "   And it's a hash" );
        t.ok( Object.keys(config.config).length > 3,
                                        "   With keys" );

        // cli options
        t.ok( config.opts,              "Options were set" );
        t.equal( typeof( config.opts ), 'object',
                                        "   And it's a hash" );

        t.ok( Object.keys(config.opts ).length > 1,
                                        "   With keys" );

        t.done();
    };

    test.testOptsToHash = function( t ) {
        var hash = config._opts_to_hash([
                        '--int=42',
                        '--string=string',
                        '--true',
                        '--explicit_true=true',
                        '--false=false',
                        '-single-dash=single-dash',
                        '--json_hash={"foo":42}',
                        '--json_array=["42"]',
                    ]);

        // the above options should produce this hash
        var expect = {
            'int':              42,
            'single-dash':      'single-dash',
            'string':           'string',
            'true':             true,
            'explicit_true':    true,
            'false':            false,
            'json_hash':        {foo: 42},
            'json_array':       ['42'],
        };

        t.deepEqual( hash, expect,  "Parsed hash options correctly" );
        t.done();
    };

    testlib.run();

});
