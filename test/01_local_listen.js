var LL              = require('../lib/local_listen');
var Configurator    = require('../lib/configurator');
var Base            = require('../lib//base');
var C               = require('../lib/common');
var U               = require('util');

var BO = new Base.BaseObject();

Configurator.config( null, ["--debug", "--trace"], function( config_object ) {
    BO._set_config_object( config_object );

    U.log( U.inspect( config_object ) );

    var tcp = new LL.LocalStreamListen( 'tcp', 10001, undefined, function (ll,conn) {
        conn.on( 'data', function (data) {
            C._trace( [ "tcp:10001", data ] );
        });
    });
});


