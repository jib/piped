"use strict";

var Configurator    = require('../../lib/configurator');
var Base            = require('../../lib/base');
var C               = require('../../lib/common');

var Test = exports.Test = function( test_count, func ) {
    new Configurator.Configurator( null, ["--debug", "--trace"],  function( cfg ) {
        var obj = Base.BaseObject();

        // populate the configuration
        obj._set_config_object( cfg );

        obj.ok          = 0;
        obj.fail        = 0;
        obj.test_count  = test_count;

        // dump config for verification
        C._trace( cfg );

        func( obj, cfg );
    });
};
