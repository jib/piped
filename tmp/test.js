var util = require('util');

var str = "udp://0.0.0.0:3000";

var x = str.match(/^(\w+):\/\/(.+?):(\d+)$/);
if( x ) {
    util.log( x[1,2,3] );
}

/*
var ___ = function () {
    var i = 0;

    function inc_i () { i = i + 1 }
    function get_i () { return i }

    inc_i();
    inc_i();
    util.log( get_i() );
    return 42

}();

var ___ = function () {
    var i = 0;

    function inc_i () { i = i + 1 }
    function get_i () { return i }

    inc_i();
    inc_i();
    util.log( get_i() );
    return 42

}();



/*
var util = require('util');

var function (foo) {
  util.log( foo );
}( 42 )

bar( 62 );

/*
var util = require('util');

var c = {
    regexp: new RegExp( '^(\\\S+) (\\\S+) (\\\S+): (.+)$' ),
};

var i = "2011-12-23T21:17:25+00:00 logger-b013.krxd.net httpd.s_logger.pixel.gif: {....}";
var m = c['regexp'].exec( i );

util.log( util.inspect( c ) );
util.log( util.inspect( m ) );
*/
