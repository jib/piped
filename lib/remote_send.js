// *********************************
// Libraries
// *********************************

var U               = require('util');
var Net             = require('net');
var Dgram           = require("dgram");
var Events          = require("events");
var Base            = require('./base');
var C               = require('./common');

// ****************************************
// Remote send object
// ****************************************

var _RemoteSend = function() {
    var rs = (function() {
        var obj = Base.BaseObject();

        obj.state_changed   = C._now();
        obj.state_changes   = 0;
        obj.last_sent       = false;
        obj.messages        = 0;
        obj.is_available    = false;

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

        obj.incr_stats = function () {
            this.last_sent = C._now();
            this.messages++;
        };

        obj.stats = function () {
            return {
                available:      this.is_available,
                last_sent:      this.last_sent,
                messages:       this.messages,
                state_changes:  this.state_changes,
                state_changed:  (C._now() - this.state_changed),
                // If nothing was ever sent, the idle time == uptime
                idle:           (this.last_sent ? (C._now() - this.last_sent) : Stats.uptime),
            };
        };

        return obj;
    })();
    return Base.create( rs );
}
// make sure we can emit events
U.inherits( _RemoteSend, Events.EventEmitter );

// TCP & Socket
var RemoteStreamSend = exports.RemoteStreamSend = function(name, port, host, reconnect) {
    var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;

        // set to true, meaning we can use piping
        obj.is_stream       = true;
        obj.name            = name;

        // host might just be a unix socket, it works transparently
        obj.connection = Net.createConnection( port, host );

        // Ideally, we're being piped to. But if not, here's our
        // manual way of sending data
        obj.send = function( data ) { this.connection.write( data ); }.bind(obj);

        // we connected? -- this won't get triggered for UDP, so we
        // set it explicitly in the TCP/socket connection code
        obj.connection.on( 'connect', function( listener ) {
            U.log( U.format( "Connected to %s", obj.name ) );

            // server is now ready for use
            obj.mark_available.bind(obj)();
        });

        // Some error happened?
        obj.connection.on( 'error', function (e) {

            // this can get very chatty, so hide it behind trace
            // always show initial connect though
            if( config.trace || !reconnect) {
                U.error( U.format( "ERROR: %s: %s", obj.name, e ) );
            }
        });

        return obj;
    })();
    return Base.create( rs );
};

// UDP
var RemoteUPDSend = exports.RemoteUDPSend = function( name, port, host, reconnect ) {
    var rs = (function() {
        var obj     = new _RemoteSend();
        var config  = obj.config_object().config;

        // if set to true, we can use piping - UDP doesn't support that.
        obj.is_stream       = false;
        obj.name            = name;
        obj.connection      = Dgram.createSocket("udp4");

        // UDP sockets are always available, mark them available by default
        // we'll use the callback to find out what's going on
        obj.mark_available();

        // invoked whenever we get data from a remote source
        obj.send = function( data ) {

            var buf = new Buffer( data );

            // if encoding is ascii, we're getting an extra
            // char (\n) at the end of data. Dgram adds one
            // more \r\n when sending it on. So, we should
            // remove the newline character from the end of
            // the string before sending it on:
            var len = config.encoding === 'ascii'
                        ? buf.length - 1
                        : buf.length;

            // XXX using a stringified host means a DNS lookup,
            // this delays message sending until next tick. I
            // don't think this is a big problem (yet), but good
            // to be aware of.
            obj.connection.send( buf, 0, len, port, host, function ( err, bytes ) {

                // in case anything goes wrong - note since it's
                // UDP, we don't know if the message arrived, just
                // that it was *sent*.
                if( err ) {
                    U.error( U.format(
                        "%s: Failed sending %s bytes", err, bytes
                    ) );
                    obj.mark_unavailable();
                }
            });
        };
        return obj;
    })();
    return Base.create( rs );
};
