var util = require('util');
var fs   = require('fs');


var file = '/tmp/node/test'
var s1 = fs.createWriteStream( file );

s1.on( 'error', function(e) { util.log( e ) } );
s1.on( 'open', function () {

    util.log( file );
    fs.watch( file, function( event ) {
        util.log( event );
        var s2 = fs.createWriteStream( '/tmp/node/test' );
        s2.on( 'error', function(e) { util.log( e ) } );
        s2.on( 'open', function() {
            s1.end();
            util.log( "s2 " + util.inspect( s2 ) ) } );
            fs.watch( file, function( event ) {
                util.log( 's2' );
            });
        util.log( "s1 " + util.inspect( s1 ) );
    });
    util.log( "s1 " + util.inspect( s1 ) );

    //fs.renameSync( '/tmp/node/test', '/tmp/node/test.off' );
});








/*
var str = "udp://0.0.0.0:3000";

var fail = 0;

if( !fail++ ) { util.log( 1 ) }
if( !fail++ ) { util.log( 2 ) }

/*
fs.watch( '/tmp/node/test', function( event ) {
    util.log( util.inspect( event ) );
});

/*
function O (a) {
    this.foo = a;
}
O.prototype = new _X( true );
O.prototype.constructor = O;

function P (a) {
    this.foo = a;
}
P.prototype = new _X( false );
P.prototype.constructor = P;



function _X ( available ) {
    this.available = available;
}


var o = new O(42);
var p = new P(42);

util.log( o.foo )
util.log( o.available )

util.log( p.foo )
util.log( p.available )


/*
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
