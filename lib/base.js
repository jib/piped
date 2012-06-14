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


// *********************************
// State / Stats / Config vars
// *********************************

// Statistics
var _Stats = {
    connections: {
        admin:  0,
        tcp:    0,
        udp:    0,
        socket: 0,
        file:   0,
        total:  0,
        last:   0,
        idle:   0,
        failed: 0,
    },
    // Inlined so common.js can use base.js
    start_time: Math.round( new Date().getTime() / 1000 ),
    uptime: 0,
};

// Global state - Used mostly by RemotePool
var _State = {
    // will be 'server:port' => server object
    all_servers:        { },
    // list of servers messages should be delivered to. Updated by
    // an event loop periodically
    current_servers:    [ ],
    // a list of all listeners currently open
    listeners:          {
        files:  [],
    },
    // State on healthy/unhealthy nodes & chains
    health_check:       {
        healthy_remotes:    0,
        unhealthy_remotes:  0,
        healthy_chains:     0,
        unhealthy_chains:   0,
    },
};

// These will be filled from the main program as needed.
var _Config = {};

// This is an optional Statsd remote, which may or may not be configured
var _Statsd = false;

exports.BaseObject = function() {
    var _obj = (function(){
        var obj = {};

        // Singletons - any change to this will be reflected in all
        // objects built on top
        obj.config_object  = function() { return _Config; };
        obj.state_object   = function() { return _State;  };
        obj.stats_object   = function() { return _Stats;  };
        obj.statsd_object  = function() { return _Statsd; };

        // provide setters in case this needs to change.
        // re-assigning the obj.config/.state doesn't appear
        // to carry accross base objects
        obj._set_state_object   = function( new_state )  { _State  = new_state;  };
        obj._set_stats_object   = function( new_stats )  { _Stats  = new_stats;  };
        obj._set_statsd_object  = function( new_statsd ) { _Statsd = new_statsd; };
        obj._set_config_object  = function( new_cfg )    { _Config = new_cfg;    };

        // Quick and dirty way to dump state/config
        obj.___dump = function() {
            U.log( "Dump: " +  U.inspect( [ _State, _Config ] ) );
        };

        return obj;
    }());
    return create( _obj );
};
