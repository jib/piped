// *********************************
// Libraries
// *********************************

var U               = require('util');
var Net             = require('net');
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
            stats = this.stats_object();
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
    })();

    return Base.create( ll );
};

// TCP & Socket - 'host' may just be a local socket
var LocalStreamListen = exports.LocalStreamListen = function(type, port, ip, func) {

    C._debug( U.format(
        "LocalStreamListen: Opening %s connection on %s:%s", type, ip, port ) );

    var ll = (function() {
        var obj = new _LocalListen();

        // is_stream == true means we can use pipes if the
        // receiving server is a stream as well.
        obj.ip          = ip;
        obj.port        = parseInt(port);
        obj.type        = type.toLowerCase();
        obj.is_stream   = true;

        // set up the handler
        obj.connection = Net.createServer();

        // simple diagnostic sub to show we're listening
        obj.connection.on( 'listening', obj.on_listen.bind(obj) );

        // when we get a connection, call the callback.
        obj.connection.on( 'connection', function( conn ) {

            // Keep track of stats.
            obj.incr_stats.bind(obj)();

            C._trace( obj.stats_object() );
        });

        // start listening
        obj.connection.listen( port, ip );

        return obj;
    })();
    return Base.create( ll );
};

/*




    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)


    this.connection.on( 'connection', function( conn ) {
        // bookkeeping
        this.incr_stats();

        if( Config.trace ) { U.log( "Remotes: " + U.inspect( State.current_servers ) ); }

        var idx;
        for( idx = 0; idx < State.current_servers.length; idx++ ) {
            var remote = State.current_servers[ idx ];

            // if( Config.trace ) { U.debug( U.inspect( remote ) ); }

            // bookkeeping
            remote.incr_stats( );

            // 2 streams, we can pipe that
            if( remote.is_stream ) {
                if( Config.trace ) {
                    U.debug( U.format( "Piping to %s", remote.name ) );
                }

                conn.pipe( remote.connection, { end: false } );

            // fallback to sending the data ourselves
            } else {
                if( Config.trace ) {
                    U.debug( U.format( "Manual send to %s", remote.name ) );
                }

                conn.on( 'data', function (data) {
                    remote.send( data );
                    remote.last_send = _now();
                });
            }
        }
    }.bind(this));

    if( Config.trace ) {
        U.debug( U.format( "Opening %s connection on %s:%s", type, ip, port ) );
    }

    this.connection.listen( port, ip );
}



/*


// XXX BASE OBJECT MUST COME BEFORE HIGHER LEVEL OBJECTS -
// INHERITANCE OF CLASSES/FEATURES DEPENDS ON IT!
function _LocalListen () {
    this.on_listen  = function () {

        //U.log( U.inspect( this ) );
        var addr = this.connection.address();

        // some sort of port is in use
        if( addr.address ) {
            U.debug( U.format( "%s Server started on %s:%s",
                this.type, addr.address, addr.port ) );

        // it's a local socket
        } else {
            U.debug( U.format( "Unix Socket Server started on %s", this.port ) );
        }
    };

    this.incr_stats = function () {
        Stats.connections[ this.type ]++;
        Stats.connections.total++;
        Stats.connections.last = _now();
    };

    // set by parent
    this.ip         = false;
    this.port       = false;
    this.connection = false;
    this.is_stream  = false;
}

// TCP & Socket - 'host' may just be a local socket
function LocalStreamListen (type, port, ip) {

    // is_stream == true means we can use pipes if the
    // receiving server is a stream as well.
    this.is_stream  = true;
    this.port       = port;
    this.ip         = ip;
    this.type       = type.toLowerCase();

    // set up the handler
    this.connection = Net.createServer();

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // simple diagnostic sub to show we're listening
    this.connection.on( 'listening', this.on_listen.bind(this) );

    this.connection.on( 'connection', function( conn ) {
        // bookkeeping
        this.incr_stats();

        if( Config.trace ) { U.log( "Remotes: " + U.inspect( State.current_servers ) ); }

        var idx;
        for( idx = 0; idx < State.current_servers.length; idx++ ) {
            var remote = State.current_servers[ idx ];

            // if( Config.trace ) { U.debug( U.inspect( remote ) ); }

            // bookkeeping
            remote.incr_stats( );

            // 2 streams, we can pipe that
            if( remote.is_stream ) {
                if( Config.trace ) {
                    U.debug( U.format( "Piping to %s", remote.name ) );
                }

                conn.pipe( remote.connection, { end: false } );

            // fallback to sending the data ourselves
            } else {
                if( Config.trace ) {
                    U.debug( U.format( "Manual send to %s", remote.name ) );
                }

                conn.on( 'data', function (data) {
                    remote.send( data );
                    remote.last_send = _now();
                });
            }
        }
    }.bind(this));

    if( Config.trace ) {
        U.debug( U.format( "Opening %s connection on %s:%s", type, ip, port ) );
    }

    this.connection.listen( port, ip );
}
LocalStreamListen.prototype               = new _LocalListen();
LocalStreamListen.prototype.constructor   = LocalStreamListen;

// UDP
function LocalUDPListen ( type, port, ip) {
    this.connection = Dgram.createSocket("udp4");
    this.port       = port;
    this.ip         = ip;
    this.type       = type;

    // scope issues? 'this' doesn't appear to be available
    // in the function, even though it should be in scope.
    // very confusing. This is why we have to .bind(this)
    // in the SUPERclass (not!!! the _Class)

    // simple diagnostic sub to show we're listening
    //this.connection.on( 'listening', function () { this.on_listen() }.bind(this) );
    this.connection.on( 'listening', this.on_listen.bind(this) );


    // It's coming in over UDP, so no chance to pipe
    this.connection.on( 'message', function (data, rinfo) {
        // bookkeeping
        this.incr_stats();

        var idx;
        for( idx = 0; idx < State.current_servers.length; idx++ ) {

            var remote = State.current_servers[ idx ];


            // bookkeeping
            remote.incr_stats();

            remote.send( data );
        }
    }.bind(this));

    if( Config.trace ) {
        U.debug( U.format( "Opening %s socket on %s:%s", type, ip, port ) );
    }

    this.connection.bind( port, ip );
    //this.on_listen = this.on_listen.bind(this);
}
LocalUDPListen.prototype               = new _LocalListen();
LocalUDPListen.prototype.constructor   = LocalUDPListen;

*/
