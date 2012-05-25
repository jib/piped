"use strict";

var U = require('util');

/* Using techniques described here:
  http://pivotallabs.com/users/pjaros/blog/articles/1368-javascript-constructors-prototypes-and-the-new-keyword
*/

// This creates an object which inherits from another object.
var create = exports.create = function(parent) {
  var F = function() {};
  F.prototype = parent;
  return new F();
};

// These will be filled from the main program as needed.
var _State  = { };
var _Config = { };

exports.BaseObject = function() {
    var _obj = (function(){
        var obj = {};

        // Singletons - any change to this will be reflected in all
        // objects built on top
        obj.config  = _Config;
        obj.state   = _State;

        return obj;
    }());
    return create( _obj );
};
