"use strict";

// *********************************
// Libraries
// *********************************

var U               = require('util');
var Net             = require('net');
var Dgram           = require('dgram');
var FS              = require('fs');
var Base            = require('./base');
var C               = require('./common').common();

// ****************************************
// Local listener object
// ****************************************

var _LocalListen = function() {
    var ll = (function() {
        var obj = Base.BaseObject();

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
var Stream = exports.Stream = function(type, port, ip, func, listen_func) {

    C._debug( U.format(
        "Stream: Opening %s connection on %s:%s", type, ip || 'localhost', port ) );

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
            if( listen_func ) { listen_func( obj ); }
        });

        // when we get a connection, call the callback.
        obj.connection.on( 'connection', function( conn ) {
            //C._trace( ['Stream on connection:', obj, conn, func ] );

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

var STDIN = exports.STDIN = function( type, func, listen_func ) {

    C._debug( U.format( "Stream: Opening connection", type ) );

    var ll = (function() {
        var obj     = new _LocalListen();
        var config  = obj.config_object().config;

        // is_stream == true means we can use pipes if the
        // receiving server is a stream as well.
        obj.ip          = 'localhost';
        obj.port        = 'stdin';
        obj.type        = type.toLowerCase();

        // it's a Readable Stream, BUT it doesn't have an 'on connect'
        // or similar callback, it just has the data event. that means
        // we don't have a signal to set up the callback.
        obj.is_stream   = false;

        // To adhere to our interface standardization
        obj.connection  = process.stdin;

        process.stdin.resume();
        process.stdin.setEncoding( config.encoding );

        process.stdin.on( 'data', function(data) {
            obj.incr_stats.bind(obj)();
            func(obj, data);
        });

        // On Listen callback? use it now.
        if( listen_func ) { listen_func( obj ); }

        func( obj, process.stdin );

        return obj;
    }());
    return Base.create( ll );
};

// Work in progress...
// var File = exports.File = function( type, file, dummy, func, listen_func ) {
//
//     C._debug( U.format(
//         "File: Opening connection to %s", file ) );
//
//     var ll = (function() {
//         var obj         = new _LocalListen();
//         var config      = obj.config_object().config;
//
//         // Set set 'port' as it's used in the diagnostic.
//         obj.port        = obj._file = file;
//
//         obj._read_file  = function(length, offset ) {
//             var buffer;
//             // Errors happen here; bad argument
//             FS.readFile( this.connection, buffer, 0, length || 1024, offset || 0,
//                 function( err, bytes, data ) {
//                     C._trace( [err, bytes, data] );
//             });
//         }.bind(obj);
//
//         // strange, but 'filename' doesn't appear to be passed in the callback.
//         // let's just bind obj, and we'll access the property instead.
//         obj._watcher_cb  = function( event, filename ) {
//             if( event == 'rename') {
//                 //C._trace( [ 'rename event', event, this.port, filename ] );
//                 C._trace( "Logrotation detected - Waiting for SIGHUP" );
//
//                 // that, then close this one.
//                 // C._trace( "Reopening " + this._file );
//                 //this._open_file( this._file );
//
//             } else if( event == 'change' ) {
//                 C._trace( [ 'modify event', event, this.port, filename ] );
//
//                 obj._read_file();
//
//
//             }
//         }.bind(obj)
//
//         obj._open_file  = function(filename) {
//             FS.open( filename, 'r', function(err, fd) {
//
//                 // Do we even have such a file?
//                 if( err ) {
//                     C._error( U.format( "Error reading %s: %s", file, err ) );
//
//                     // XXX requeue?
//
//                 // We have a file. Excellent. We'll watch it.
//                 } else {
//
//                     // do we already have a connection? Close it
//                     if( this.connection ) {
//                         FS.close( this.connection );
//                     }
//                     this.connection = fd;
//
//                     // do we already have a watcher? Close it
//                     if( this.watcher ) {
//                         this.watcher.close();
//                     }
//
//                     this.watcher = FS.watch( file, this._watcher_cb );
//                 }
//             }.bind(obj));
//         }.bind(obj);
//
//         // Ready to open the file and go from there
//         obj._open_file( file );
//         return obj;
//     }());
//
//     return Base.create( ll );
// }

// XXX OSX nc seems to keep the connection open after sending a
// packet unless you provide '-w 1' (meaning timeout out after 1
// second after sending. nc's on ubuntu don't have this problem.
// I'm not sure there's anything we can do on the piped end to
// clear out the connection more aggressively. Closing the open
// connection on our side effectively closes the port on our side,
// meaning no more traffic will be accepted. That's obviously not
// the right way to go.
var UDP = exports.UDP = function( type, port, ip, func, listen_func ) {

    C._debug( U.format(
        "UDP: Opening %s connection on %s:%s", type, ip, port ) );

    var ll = (function() {
        var obj     = new _LocalListen();
        var config  = obj.config_object().config;

        obj.connection          = Dgram.createSocket("udp4");
        obj.port                = port;
        obj.ip                  = ip;
        obj.type                = type;

        // simple diagnostic sub to show we're listening
        obj.connection.on( 'listening', function() {

            if( listen_func ) { listen_func( obj ); }
        });

        // It's coming in over UDP, so no chance to pipe
        obj.connection.on( 'message', function (data, rinfo) {

            // Keep track of stats.
            this.incr_stats.bind(this)();

            // And call the callback
            func(this, data);
        }.bind(obj));

        // start listening
        obj.connection.bind( port, ip );

        return obj;
    }());
    return Base.create( ll );
};

