"use strict";

// *********************************
// Libraries
// *********************************

var U               = require('util');
var Base            = require('./base');
var C               = require('./common').common();
var RS              = require('./remote_send');

function _connect_to_server( str, is_reconnect, on_connect_func ) {
    // XXX doing this in one line is a 'strict' violation, because
    // you can't be sure 'this' is an object. But we know this is
    // going to be 'ok' because this function is only called in
    // this file, and in both cases the object is bind()ed to this.
    var config  = this.config_object().config;

    // only show reconnects with trace, but always show initial connects
    if( config.trace ) {
        var pre = is_reconnect ? "Re-" : "";
        C._trace( U.format( "%sConnecting to remote %s", pre, str ) );
    } else if ( !is_reconnect ) {
        C._log( "RemotePool: Connecting to remote " + str );
    }

    var remote = (function( str ) {

        // Plain old stdout?
        if( str.toLowerCase() === 'stdout' ) {
            return new RS.STDOUT( str, is_reconnect, on_connect_func );

        } else {
            //                  type :// connection_string
            // XXX jslint complains about: Insecure '.'.
            var m = str.match(/^(\w+):\/\/(.+)$/);

            if( m && m[0] ) {
                // it might be a host:port combo
                var conn  = m[2];
                var parts = conn.split(':', 2);
                var host  = parts[0].toLowerCase();
                var port  = parts[1].toLowerCase();

                switch( m[1].toLowerCase() ) {
                    case 'file':
                        return new RS.File(str, conn, conn, is_reconnect, on_connect_func);
                    case 'socket':
                        return new RS.Stream(str, conn, conn, is_reconnect, on_connect_func);
                    case 'tcp':
                        return new RS.Stream(str, port, host, is_reconnect, on_connect_func);
                    case 'udp':
                        return new RS.UDP(str, port, host, is_reconnect, on_connect_func);
                    default:
                        throw( U.format( "Unknown server type '%s'", m[1] ) );
                }
            } else {
                // if we get here, we don't know the format
                throw( U.format( "Can not parse connection string '%s'", str ) );
            }
        }
    }( str ));

    return remote;
}


var RemotePool = exports.RemotePool =
    function( servers, reconnect_interval, monitor_interval, statsd_interval ) {

    // Some basic properties, for later inspection
    var obj                 = new Base.BaseObject();
    var config              = obj.config_object().config;
    var statsd              = obj.statsd_object();
    obj.servers             = servers;
    obj.reconnect_interval  = reconnect_interval || config.reconnect_interval;
    obj.monitor_interval    = monitor_interval   || config.monitor_interval;
    obj.statsd_interval     = statsd_interval    || config.statsd_interval;

    // When the remote is connected, an event will be emitted. we'll use
    // that to signal the health monitoring to begin.
    obj.on_connect_func     = function( rs ) {

        // Install a periodic health check that updates the list of healthy
        // servers periodicaly. These are the servers that will be used from
        // the local listeners
        // We do that inside this function, so we don't get 'connection refused'
        // before the connection even happened.
        // XXX this still seems to fast on my laptop. Better way to do this so
        // the startup message doesn't say 'all unhealthy' followed by 'all is
        // well'?
        if( !this.periodic_monitor ) {
            C._trace( "Installing health checks" );

            this.periodic_monitor = setInterval( function() {
                this.state_object().current_servers = this.health_check();
            }.bind(this), this.monitor_interval );
        }

        // Install a periodic reconnect that tries to reestablish connections
        // that have been dropped, gone down or otherwise were in trouble.
        if( !this.periodic_reconnect ) {
            C._trace( "Installing reconnect monitor" );

            this.periodic_reconnect = setInterval(
                this.reconnect_to_servers.bind(this),
                this.reconnect_interval
            );
        }

        // If we have statsd enabled, install a periodic sending of stats
        // to statsd.
        if( statsd && !this.periodic_statsd ) {
            C._trace( "Installing statsd metrics" );

            this.periodic_statsd = setInterval(
                this.send_health_stats.bind(this),
                this.statsd_interval
            );
        }

    }.bind(obj);

    // Loop over the servers and establish an initial connection.
    obj.connect_to_servers = function (func) {
        var state = this.state_object();

        // This is a 2 layer nested array, of remotes to connect to.
        // May look something like this:
        // [ [ "tcp://localhost:10001", "socket:///tmp/echo1.socket" ],
        //   [ "tcp://localhost:10002", "udp://localhost:10005" ] ]

        var i, j;
        for( i = 0; i < this.servers.length; i++ ) {

            var ary = this.servers[i];

            for( j = 0; j < ary.length; j++ ) {
                var remote = _connect_to_server.bind(this)(
                    ary[j], false, this.on_connect_func
                );

                // Store the mapping between the two.
                state.all_servers[ remote.name ] = remote;
            }
        }

        // call the callback if one was provided
        if( func ) { func( this ); }

    }.bind(obj);

    // Maintain a list of known good current servers by doing a health check
    obj.health_check = function() {
        var state           = this.state_object();
        var healthy_remotes = [];
        var unhealthy_sets  = 0;
        var healthy_sets    = 0;

        // This is a 2 layer nested array, of remotes to connect to.
        // May look something like this:
        // [ [ "tcp://localhost:10001", "socket:///tmp/echo1.socket" ],
        //   [ "tcp://localhost:10002", "udp://localhost:10005" ] ]

        var i, j;
        for( i = 0; i < this.servers.length; i++ ) {

            var ary                     = this.servers[i];
            var healthy_remote_found    = 0;

            // The 'break' in the else below is making JSLint deem this
            // a 'strange loop'. However, since there's 2 conditionals
            // before this that may make it continue, the lint message
            // is incorrect. Unfortunately, I don't know how to rewrite
            // this so JSlint is less upset :(
            for( j = 0; j < ary.length; j++ ) {

                // Get the object represented by this connection string
                var remote  = state.all_servers[ ary[j] ];
                var name    = remote.name;

                // You're down. The reconnector will try to connect to
                // you on it's own. No action here.
                // You may have either been marked as unavailable at the
                // line below, or when one of the senders encountered an
                // error.
                if( remote.is_available === false ) {
                    continue;

                // potential socket, but check if it's not been destroyed.
                // this happens if the remote end disappears, which means
                // we should mark it for reconnect
                } else if ( remote.connection.destroyed ) {
                    C._debug( U.format(
                        "Server %s unavailable - marking for reconnect", name ) );

                    remote.mark_unavailable();
                    continue;

                // Everything seems fine, you are healthy.
                } else {
                    healthy_remotes.push( remote );

                    // this signals we found a node in the set that works.
                    healthy_remote_found++;

                    // and therefor, we dont need another at the momemt.
                    break;
                }
            }

            // Now, did we find at least one healthy server in this set?
            if( !healthy_remote_found ) {
                C._trace( [ "No available server found in this set", ary ] );
                unhealthy_sets++;
            } else{
                healthy_sets++;
            }
        }

        state.health_check.healthy_chains   = healthy_sets;
        state.health_check.unhealthy_chains = unhealthy_sets;


        // So, we don't have any servers in at least one set? That's not good.
        // XXX implement overflow here
        // XXX this will spam the stderr logs like crazy, find a cleaner way
        if( unhealthy_sets ) {
            C._error(
                "No healthy servers founds in "+ unhealthy_sets +" sets - dropping traffic"
            );
        }

        return healthy_remotes;

    }.bind(obj);

    obj.reconnect_to_servers = function() {
        var state = this.state_object();
        var up    = 0;
        var down  = 0;

        // XXX jslint: The body of a for in should be wrapped in an if statement to filter unwanted properties from the prototype. - find & fix
        var name;
        for( name in state.all_servers ) {
            var remote = state.all_servers[name];

            // If it's not currently available, try a reconnect
            if( remote.is_available === false ) {
                state.all_servers[name] = _connect_to_server.bind(this)( name, true );
                down++;
            } else {
                up++;
            }
        }

        // Update the state to the amount of up/down nodes we have.
        state.health_check.healthy_remotes   = up;
        state.health_check.unhealthy_remotes = down;

        // Diagnostic on progress
        if( down ) { C._trace( U.format( "Attempted to reconnect %s nodes", down ) ); }

    }.bind(obj);

    obj.send_health_stats = function() {
        var state   = this.state_object();
        var statsd  = this.statsd_object();
        var config  = this.config_object().config;

        var prefix  = config.statsd_prefix;
        var suffix  = config.statsd_suffix;

        // just to be completely safe - this should only be installed if statsd
        // is configured.
        if( statsd ) {

            // Number of up & down nodes sent as stats - set by obj.reconnect_to_servers
            statsd.send( U.format('%spool.remotes.healthy%s:%s|c\n',
                prefix, suffix, state.health_check.healthy_remotes ) );
            statsd.send( U.format('%spool.remotes.unhealthy%s:%s|c\n',
                prefix, suffix, state.health_check.unhealthy_remotes ) );

            // Number of healthy & unhealthy chains - obj.health_check
            statsd.send( U.format('%spool.chains.healthy%s:%s|c\n',
                prefix, suffix, state.health_check.healthy_chains ) );
            statsd.send( U.format('%spool.chains.unhealthy%s:%s|c\n',
                prefix, suffix, state.health_check.unhealthy_chains ) );
        }
    }.bind(obj);

    return obj;
};

