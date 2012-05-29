"use strict";

var U       = require('util');
var Base    = require('./base');

// ****************************************
// Utility functions - no use of vars
// ****************************************

exports.common = function() {
    var obj     = new Base.BaseObject();

    obj._now        = function _now() {
                        return Math.round( new Date().getTime() / 1000 );
                    };

    obj._json_pp    = function _json_pp(data) {
                        return JSON.stringify( data , null, 2 );
                    };

    obj._error      = function _error(data) {
                        U.error( U.inspect( data, false, 5 ) );
                    };

    obj._log        = function _log(data) {
                        U.log( U.inspect( data, false, 5 ) );
                    };

    obj._debug      = function _debug(data) {
                        //U.debug( U.inspect( _BO.config_object() ) );
                        if( obj.config_object().config.debug ) {
                            U.debug( U.inspect( data, false, 5 ) );
                        }
                    };

    obj._trace      = function _trace(data) {
                        //U.debug( U.inspect( _BO.config_object() ) );
                        if( obj.config_object().config.trace ) {
                            U.debug( U.inspect( data, false, 5 ) );
                        }
                    };
    return obj;
}
