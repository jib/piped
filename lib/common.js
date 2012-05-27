"use strict";

var U       = require('util');
var Base    = require('./base');

// ****************************************
// Utility functions - no use of vars
// ****************************************

var _BO = new Base.BaseObject();

exports._now        = function _now() {
                        return Math.round( new Date().getTime() / 1000 );
                    };

exports._json_pp    = function _json_pp(data) {
                        return JSON.stringify( data , null, 2 );
                    };

exports._log        = function _log(data) {
                        U.log( U.inspect( data, false, 5 ) );
                    };

exports._debug      = function _debug(data) {
                        //U.debug( U.inspect( _BO.config_object() ) );
                        if( _BO.config_object().config.debug ) {
                            U.debug( U.inspect( data, false, 5 ) );
                        }
                    };

exports._trace      = function _trace(data) {
                        //U.debug( U.inspect( _BO.config_object() ) );
                        if( _BO.config_object().config.trace ) {
                            U.debug( U.inspect( data, false, 5 ) );
                        }
                    };


