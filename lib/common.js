"use strict";

var U       = require('util');
var Base    = require('./base');

// ****************************************
// Utility functions - no use of vars
// ****************************************

exports.common = function() {
    var obj     = new Base.BaseObject();

    obj._now        = function () {
                        return Math.round( new Date().getTime() / 1000 );
                    };

    obj._json_pp    = function(data) {
                        return JSON.stringify( data , null, 2 );
                    };

    obj._error      = function(data) {
                        U.error( U.inspect( data, false, 5 ) );
                    };

    obj._log        = function(data) {
                        process.stderr.write( U.inspect( data, false, 5 ) + "\n" );
                    };

    // If debug or trace aren't enabled, create an optimized version
    // of the function so it performs better
    obj._debug      = function(data) {
                        // config is loaded, check if we have debug
                        // and then REDEFINE the function with an
                        // optimized version.
                        if( obj.config_object().config ) {
                            if( obj.config_object().config.debug ) {
                                this._debug = function(data) {
                                     process.stderr.write(
                                        "DEBUG: " + U.inspect( data, false, 5 ) + "\n" );
                                }
                                // And also call the function, as you wanted
                                // the data printed
                                this._debug( data );

                            // Debug isn't enabled, insert empty function
                            } else {
                                this._debug = function(){};
                            }
                        }
                    }.bind(obj);

    obj._trace      = function(data) {
                        // config is loaded, check if we have debug
                        // and then REDEFINE the function with an
                        // optimized version.
                        if( obj.config_object().config ) {
                            if( obj.config_object().config.trace ) {
                                this._trace = function(data) {
                                    process.stderr.write(
                                        "TRACE: " + U.inspect( data, false, 5 ) + "\n" );
                                }
                                // And also call the function, as you wanted
                                // the data printed
                                this._trace( data );

                            // Trace isn't enabled, insert empty function
                            } else {
                                this._trace = function(){};
                            }
                        }
                    }.bind(obj);
    return obj;
}
