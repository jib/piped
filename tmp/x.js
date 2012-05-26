"use strict";

var U       = require('util');
var Base    = require('../lib/base.js');

var b = new Base.BaseObject();

U.log( U.inspect( b.config ) );
U.log( U.inspect( b.state ) );

/* Using techniques described here:
  http://pivotallabs.com/users/pjaros/blog/articles/1368-javascript-constructors-prototypes-and-the-new-keyword
*/

/*
function create(parent) {
  var F = function() {};
  F.prototype = parent;
  return new F();
}

var _State = { c: 0 };

var _MO = function () {
    var _mo = (function(){
        var obj = {};

        obj.x = function() { return "x"; };
        obj.z = function() { return "z"; };
        obj.state = _State;

        return obj;
    }());
    return create( _mo );
};

var SO = function() {
    var _so = (function() {
        var obj = new _MO();

        obj.c = 0;
        obj.y = function() { return "y"; };
        obj.z = function() { return "override: z"; };

        return obj;
    }());
    return create( _so );
};

// var mo = new _MO();
// U.debug( mo.x() );
// //U.debug( so.y() );
// U.debug( mo.z() );

var so = new SO();
// U.debug( so.x() );
// U.debug( so.y() );
// U.debug( so.z() );
so.c++; so.c++;
so.state.c++;
U.debug( so.c );
U.debug( so.state.c );

var so2 = new SO();
// U.debug( so.x() );
// U.debug( so.y() );
// U.debug( so.z() );
U.debug( so2.c );
U.debug( so2.state.c );

*/
