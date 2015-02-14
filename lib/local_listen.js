"use strict";

// *********************************
// Libraries
// *********************************

var U               = require('util');
var Net             = require('net');
var Dgram           = require('dgram');
var FS              = require('fs');
var Tail            = require('tailfd');
var Base            = require('./base');
var C               = require('./common').common();

// ****************************************
// Local listener object
// ****************************************

var _LocalListen = function() {
    var ll = (function() {
        var obj     = Base.BaseObject();
        var statsd  = obj.statsd_object();

        // write optimized versions of the function
        obj.incr_stats = statsd
            ? (function() {
                var stats   = this.stats_object();
                var config  = this.config_object().config;
                var prefix  = config.statsd_prefix;
                var suffix  = config.statsd_suffix;

                // 'this' is bound by the caller of this function.
                return function() {
                    stats.connections[ this.type ]++;
                    stats.connections.total++;
                    stats.connections.last = C._now();
                    // this.type is always a single string (udp, tcp, etc)
                    // and so doesn't have to be cleaned up for stats purposes
                    statsd.send( prefix + 'local.' + this.type + suffix + ":1|c" );
                };
            }.bind(obj))()
            : function() {
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

            // Keep track of stats - XXX this is done in dispatcher now.
            //obj.incr_stats.bind(obj)();

            // And call the callback
            func(obj, conn);
        });

        // start listening
        obj.connection.listen( port, ip );

        return obj;
    }());
    return Base.create( ll );
};

// XXX this is hard to test automatically, as we can't write TO STDIN
// in node it seems. Done manual tests to ensure this works, but could
// really use some automation
// XXX There's a bug in apache that seems to let customlog processes stay
// alive even when you tell Apache to stop. The details of the bug are
// here: https://issues.apache.org/bugzilla/show_bug.cgi?id=24805
// I can confirm this with a simple perl script as well, so it's not
// piped specific: https://gist.github.com/2932003
// To verify, simply add a 'Custlomlog "|that_perl_script"' and start,
// then stop apache. You'll see the process has not gone away, and
// still responds to signals.
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

        obj.connection.resume();
        obj.connection.setEncoding( config.encoding );

        obj.connection.on( 'data', function(data) {
            // Keep track of stats - XXX this is done in dispatcher now.
            // obj.incr_stats.bind(obj)();
            func(obj, data);
        });

        // On Listen callback? use it now.
        if( listen_func ) { listen_func( obj ); }

        func( obj, process.stdin );

        return obj;
    }());
    return Base.create( ll );
};


// XXX watchfd & tailfd have 2 known issues:
// 1) Line 218 of watchfd needs to be changed to:
//  //issue timeout event for dead before arival inode
//  self.emit('timeout',stat, self.fds[inode].getData());
// Instead of:
//  this.emit('timeout',null, self.fds[inode].getData());
// Because:
// * this is not bound correctly, it needs to be self
// * the 'timeout' handler in tailfd expects a stat object, not null
// This issue is present at least in watchfd 0.04 and before.
//
// 2) The behaviour of tailfd appears to be like tail -F, despite
// it's manpage; on rotation of a logfile, it will miss several lines
// of output. A test with 100k requests spanned out over several mins
// with a rotation of interval of 1 minute show large chunks of sequential
// loglines are missing, to the order of 10% of the total amount of requests.
// I have not investigated deeper into the underlying cause of this dropping
// of lines.
var File = exports.File = function( type, file, func, listen_func ) {
    C._debug( U.format( "File: tailing %s", file ) );

    var ll = (function() {
        var obj         = new _LocalListen();
        var config      = obj.config_object().config;

        // Set set 'port' as it's used in the diagnostic.
        obj.port        = obj._file = file;
        obj.type        = type.toLowerCase();

        // This implementation gives us the files by line, not as a stream,
        // so we'll have to treat it like UDP
        obj.is_stream   = false;

        // If the file gets rotated, this magically starts watching /both/
        // files and will after a certain period of inactivity drop the old
        // FD. Read here: https://github.com/soldair/node-tailfd
        obj.connection  = Tail.tail( file, function(line, tail_info) {
            //C._trace( ['got line:', line, tail_info ] );

            // And call the callback
            // Add the newline, as the tail module will have removed it.
            func(this, line + "\n");
        }.bind(obj));


        // These are the events emitted; we could tap into them, but
        // it doesn't look like it'll be needed.
        // obj.connection.on( 'change', function(cur,prev) {
        //     C._trace( [ 'change', cur, prev ] );
        // });
        //
        // obj.connection.on( 'open', function(cur, opt) {
        //     C._trace( [ 'open', cur, opt ] );
        // });
        //
        // obj.connection.on( 'unlink', function(cur, opt) {
        //     C._trace( [ 'unlink', cur, opt ] );
        // });
        //
        // obj.connection.on( 'timeout', function(cur, opt) {
        //     C._trace( [ 'timeout', cur, opt ] );
        // });

        // Call the listen callback if specified
        if( listen_func ) { listen_func( obj ); }

        return obj;
    }());

    return Base.create( ll );
};

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

            // Keep track of stats - XXX this is done in dispatcher now.
            //this.incr_stats.bind(this)();

            // And call the callback
            func(this, data);
        }.bind(obj));

        // start listening
        obj.connection.bind( port, ip );

        return obj;
    }());
    return Base.create( ll );
};
