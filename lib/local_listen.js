"use strict";

// *********************************
// Libraries
// *********************************

var U               = require('util');
var Net             = require('net');
var Dgram           = require("dgram");
var Base            = require('./base');
var C               = require('./common');

// ****************************************
// Local listener object
// ****************************************

var _LocalListen = function() {
    var ll = (function() {
        var obj = Base.BaseObject();

        // 'obj' bound to 'this'
        obj.on_listen = function() {

            var addr = this.connection.address();

            // some sort of port is in use
            if( addr.address ) {
                C._debug( U.format( "%s Server started on %s:%s",
                    this.type, addr.address, addr.port ) );

            // it's a local socket
            } else {
                C._debug( U.format( "Unix Socket Server started on %s", this.port ) );
            }
        };

        obj.incr_stats = function() {
            var stats = this.stats_object();
            stats.connections[ this.type ]++;
            stats.connections.total++;
            stats.connections.last = C._now();
        };

        // set by parent
        obj.ip          = false;
        obj.port        = false;
        obj.type        = false;
        obj.connection  = false;
        obj.is_stream   = false;

        return obj;
    }());

    return Base.create( ll );
};

// TCP & Socket - 'host' may just be a local socket
var LocalStreamListen = exports.LocalStreamListen =
    function(type, port, ip, func, listen_func) {

    C._debug( U.format(
        "LocalStreamListen: Opening %s connection on %s:%s", type, ip, port ) );

    var ll = (function() {
        var obj = new _LocalListen();

        // is_stream == true means we can use pipes if the
        // receiving server is a stream as well.
        obj.ip          = ip;
        obj.port        = port; // might be a number or path to a socket
        obj.type        = type.toLowerCase();
        obj.is_stream   = true;

        // set up the handler
        obj.connection = Net.createServer();

        // simple diagnostic sub to show we're listening
        // optionally, a callback when listening
        obj.connection.on( 'listening', function() {
            obj.on_listen.bind(obj);
            if( listen_func ) { listen_func( obj ); }
        });

        // when we get a connection, call the callback.
        obj.connection.on( 'connection', function( conn ) {

            // Keep track of stats.
            obj.incr_stats.bind(obj)();

            // And call the callback
            func(obj, conn);
        });

        // start listening
        obj.connection.listen( port, ip );

        return obj;
    }());
    return Base.create( ll );
};

var LocalUPDListen = exports.LocalUDPListen =
    function( type, port, ip, func, listen_func ) {

    C._debug( U.format(
        "LocalUDPListen: Opening %s connection on %s:%s", type, ip, port ) );

    var ll = (function() {
        var obj = new _LocalListen();

        obj.connection  = Dgram.createSocket("udp4");
        obj.port        = port;
        obj.ip          = ip;
        obj.type        = type;

        // simple diagnostic sub to show we're listening
        obj.connection.on( 'listening', function() {
            obj.on_listen.bind(obj);
            if( listen_func ) { listen_func( obj ); }
        });

        // It's coming in over UDP, so no chance to pipe
        obj.connection.on( 'message', function (data, rinfo) {

            // Keep track of stats.
            obj.incr_stats.bind(obj)();

            // And call the callback
            func(obj, data);

            C._trace( rinfo );
        });

        // start listening
        obj.connection.bind( port, ip );

        return obj;
    }());
};

