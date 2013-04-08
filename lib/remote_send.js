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
// Remote send object
// ****************************************

var _RemoteSend = function() {
    var rs = (function() {
        var obj     = Base.BaseObject();
        var statsd  = obj.statsd_object();

        obj.state_changed   = C._now();
        obj.state_changes   = 0;
        obj.last_sent       = false;
        obj.messages        = 0;
        obj.is_available    = false;

        // write optimized versions of the function
        obj.incr_stats = statsd
            ? (function() {
                var stats   = this.stats_object();
                var config  = this.config_object().config;
                var prefix  = config.statsd_prefix;
                var suffix  = config.statsd_suffix;

                // 'this' is bound by the caller of this function.
                return function() {
                    this.last_sent = C._now();
                    this.messages++;
                    statsd.send( prefix + 'remote.' + this.name + suffix + ":1|c\n" );
                };
            }.bind(obj))()
            : function() {
                this.last_sent = C._now();
                this.messages++;
            };

        // needs to be filled in by parent
        //obj.name           = false;
        //obj.send           = false;
        //obj.connection     = false;
        //obj.is_stream      = false;

        obj.mark_available = function () {
            C._trace( "HEALTHY: " + this.name );

            // mark the server as available
            this.is_available    = true;
            this.state_changed   = C._now();
            this.state_changes++;
        };

        obj.mark_unavailable   = function () {
            C._trace( "UNHEALTHY: " + this.name );

            // mark the server as no longer available
            this.is_available    = false;
            this.state_changed   = C._now();
            this.state_changes++;
        };

        obj.stats = function () {
            return {
                available:      this.is_available,
                last_sent:      this.last_sent,
                messages:       this.messages,
                state_changes:  this.state_changes,
                state_changed:  (C._now() - this.state_changed),
                // If nothing was ever sent, the idle time == uptime
                idle:           (this.last_sent ? (C._now() - this.last_sent) : this.stats_object().uptime),
            };
        };

        return obj;
    }());
    return Base.create( rs );
};

// TCP & Socket
var Stream = exports.Stream = function(name, port, host, reconnect, on_connect_func) {
    var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;

        //C._trace( ['Stream:', name, port, host ] );

        // set to true, meaning we can use piping
        obj.is_stream       = true;
        obj.name            = name;

        // what to call when connected
        obj.on_connect      = on_connect_func || function () {};

        // host might just be a unix socket, it works transparently
        obj.connection = Net.createConnection( port, host );

        // Ideally, we're being piped to. But if not, here's our
        // manual way of sending data
        obj.send = function( data ) {
            //C._trace( ['Stream send:', data] );
            var rv = this.connection.write( data, config.encoding );

            //C._trace( ["Buffer flushed?", rv, this.connection.bufferSize ] );
            //this.connection.end();

        }.bind(obj);

        // we connected? -- this won't get triggered for UDP, so we
        // set it explicitly in the TCP/socket connection code
        obj.connection.on( 'connect', function( listener ) {
            C._debug( U.format( "Connected to %s", this.name ) );

            // server is now ready for use
            this.mark_available.bind(this)();

            // and hit the callback
            this.on_connect( this );

        }.bind(obj));

        // Some error happened?
        obj.connection.on( 'error', function (e) {

            // this can get very chatty, so hide it behind trace
            // always show initial connect though
            if( config.trace || !reconnect) {
                U.error( U.format( "ERROR: %s: %s", this.name, e ) );
            }
        }.bind(obj));

        return obj;
    }());
    return Base.create( rs );
};

// UDP
var UDP = exports.UDP = function(name, port, host, reconnect, on_connect_func) {
    var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;

        // if set to true, we can use piping - UDP doesn't support that.
        obj.is_stream       = false;
        obj.name            = name;
        obj.connection      = Dgram.createSocket("udp4");

        // what to call when connected, which in our case means, at the
        // end of this function because udp doesn't 'connect'
        obj.on_connect      = on_connect_func || function () {};

        // UDP sockets are always available, mark them available by default
        // we'll use the callback to find out what's going on
        obj.mark_available();

        // The actual sending function; obj.send() may break up a buffer
        // into multiple chunks to fit the sending window, so leave that
        // as the public interface, while this sends an individual buffer
        obj._send_buffer = function( buf ) {
            var len = buf.length;

            // XXX using a stringified host means a DNS lookup,
            // this delays message sending until next tick. I
            // don't think this is a big problem (yet), but good
            // to be aware of.
            this.connection.send( buf, 0, len, port, host, function( err, bytes ) {

                // in case anything goes wrong - note since it's
                // UDP, we don't know if the message arrived, just
                // that it was *sent*.
                if( err ) {
                    U.error( U.format(
                        "%s: Failed sending %s bytes", err, bytes
                    ) );
                    this.mark_unavailable();
                }
            }.bind(this));
        }.bind(obj);

        // invoked whenever we get data from a remote source
        obj.send = function( data ) {
            //C._trace( ['UDP send:', data] );

            // Make sure we're operating on a buffer, so we
            // can slice it accordingly if needed.
            var buf = new Buffer( data );
            var len = buf.length;

            // The size of the data we can push off to a UDP
            // socket depends on the MTU size; anything that's
            // too large will be silently dropped. Obviously,
            // that sucks: http://xrl.us/bm9q4g
            // The minimum size that all agents are supposed to
            // support is 68 according to this wikipedia entry:
            //   http://en.wikipedia.org/wiki/Maximum_transmission_unit
            //
            // Now that's damn small, so we have it configurable
            // and we'll split data up in smaller chunks based on
            // that settings.
            var max_size = config.udp_max_size;

            // array to hold all the (possibly sliced) buffers we'll
            // be sending off;
            var buffers  = [ ];

            // have to split the payload
            if( len > max_size ) {
                var i           = 0;

                // The amount of buffers we'll be sending;
                // XXX Important to use '10' as the base: http://xrl.us/JSRadix
                var buf_count   = parseInt( len / max_size, 10 );

                C._trace( U.format(
                    "Packet too large for UDP (%s), breaking up in %s slices of %s",
                    len, buf_count + 1, max_size
                ) );

                for( i = 0; i <= buf_count; i++ ) {

                    // start offset
                    var start = i * max_size;

                    // end offset - every slice is max_size large, except
                    // for possible the last one, which is whatever is left.
                    var end   = i == buf_count ? len % max_size : max_size;

                    // and send of the slice
                    this._send_buffer( buf.slice( start, start + end ) );
                }

            // The buffer is actually smaller than the max_size, we can just
            // send this one as is;
            } else {
                this._send_buffer( buf );
            }
        }.bind(obj);

        // and hit the callback
        obj.on_connect( obj );


        return obj;
    }());
    return Base.create( rs );
};


// XXX logrotion
var File = exports.File = function(name, port, host, reconnect, on_connect_func) {
    var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;

        // set to true, meaning we can use piping
        obj.is_stream       = true;
        obj.name            = name;

        // what to call when connected
        obj.on_connect      = on_connect_func || function () {};

        // If we're not being piped to, this
        obj.send            = function( data ) {
            var rv = this.connection.write( data, config.encoding );
        }.bind(obj);

        // This is a WritableStream, like Stream above.
        obj.connection = FS.createWriteStream( port,
                { flags: 'a', encoding: config.encoding, mode: config.file_mode } );

        obj.connection.on( 'open', function( fd ) {
            C._debug( U.format( "Connected to %s", this.name ) );

            // it's opened, hooray
            this.mark_available.bind(this)();

            // Store the fd for later use.
            this._fd = fd;

            // and hit the callback
            this.on_connect( this );

        }.bind(obj));

        // Some error happened?
        obj.connection.on( 'error', function (e) {

            // this can get very chatty, so hide it behind trace
            // always show initial connect though
            if( config.trace || !reconnect) {
                U.error( U.format( "ERROR: %s: %s", this.name, e ) );
            }
        }.bind(obj));


        return obj;
    }());
    return Base.create( rs );
};

// XXX this is hard to test automatically, as we can't read FROM STDOUT
// in node it seems. Done manual tests to ensure this works, but could
// really use some automation
var STDOUT = exports.STDOUT = function(name, reconnect, on_connect_func) {
   var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;


        // set to true, meaning we can use piping
        obj.is_stream   = true;
        obj.name        = name;

        // what to call when connected
        obj.on_connect  = on_connect_func || function () {};

        obj.connection  = process.stdout;

        // Ideally, we're being piped to. But if not, here's our
        // manual way of sending data
        obj.send = function( data ) {
            //C._trace( ['Stream send:', data] );
            var rv = this.connection.write( data, config.encoding );

            //C._trace( ["Buffer flushed?", rv ] );

            //this.connection.end();

        }.bind(obj);

        // Some error happened?
        obj.connection.on( 'error', function (e) {

            // this can get very chatty, so hide it behind trace
            // always show initial connect though
            if( config.trace || !reconnect) {
                U.error( U.format( "ERROR: %s: %s", this.name, e ) );
            }
        }.bind(obj));


        // server is now ready for use
        obj.mark_available.bind(obj)();

        // and hit the callback
        obj.on_connect( obj );

        return obj;
    }());
    return Base.create( rs );
};
