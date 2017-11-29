PipeD
=====

A highly performant network daemon that runs on the [Node.js][node] platform
that translates, fans out and/or consolidates any incoming data stream to any
outgoing data stream with failover support.

The incoming streams can consist of one or more of `UDP, TCP, Unix Socket,
File or STDIN` and the outgoing streams can consist of one or more of `UDP,
TCP, Unix Socket or STDOUT`.

Here's a quick graphical overview:

![overview](https://github.com/jib/piped/raw/master/docs/media/overview.jpg)

Concepts
--------

* *remotes*
  `PipeD` will send your data to one or more remote endpoints. It can
  do a `one to one`, `many to one`, and `many to many` mapping (which
  allows for both fan out and consolidation). It also monitors the
  health of the remotes, failing over to a backup remote as needed.

* *listeners*
  `PipeD` can listen for input in any way that you can do cross process
  communication in your favourite Unix environment. Any input point is
  called a `listener`

* *chains*
  A list of failover remotes is considered a chain. The idea is that at
  least one node in the chain should be available for delivery, or the
  chain is marked as sick. This is usually a state you don't want to be
  in, as you'd be losing (one of) your remote streams.

Documentation
-------------

All configuration options to `PipeD` are documented in [etc/config.js.example](https://github.com/jib/piped/blob/master/etc/config.js.example)

This file holds all options, their documentation, applications defaults
and examples on how to use them. See the Examples section below for some
graphical examples as well.

Examples
--------

The easiest way to show how `PipeD` works is through some examples:


![fanout](https://github.com/jib/piped/raw/master/docs/media/fanout.jpg)

The picture above shows a very simple fanout situation; the `access.log`
is tailed, and for every line, a copy of that line is sent to both the
`stats server`, as well as the `db server`

Here's what that configuration would look like for `PipeD`:

```javascript
{   // Tail these files, and process each line
    files: [
        '/var/log/access.log',
    ],
    // Send a copy to both servers
    servers: [
        [ 'tcp://stats-server.example.com:12345' ],
        [ 'tcp://db-inserter.example.com:23456' ],
    ],
}
```


![failover](https://github.com/jib/piped/raw/master/docs/media/failover.jpg)

The picture above shows the most basic failover scenario; if the host `syslog1`
is unavailable, send the line to `syslog2` instead. If `syslog1` becomes available
again, switch traffic back there.

In addition, the picture shows that rather than tailing a log file like in the
example above, we can also directly listen on `stdin`, and hook into [Apache Customlog](http://httpd.apache.org/docs/2.0/mod/mod_log_config.html) functionality.

Here's what that configuration would like for `PipeD`:

```javascript
{   // Listen on stdin
    stdin: true,
    // Send a copy to at least one of these servers
    servers: [
        'tcp://syslog1.example.com:12345',
        'tcp://syslog2.example.com:12345',
    ],
}
```

For more examples for configuring listeners & remotes, please take a look at the
[etc/config.js.example](https://github.com/jib/piped/blob/master/etc/config.js.example)
file shipped in this repository.

This file also holds all the configuration options for `PipeD`, their documentation
and defaults.

Debugging
---------

There are additional config variables available for debugging:

* `debug` - log common operations to stderr
* `trace` - log extensive information about all operations to stderr

For more information, check the [etc/config.js.example](https://github.com/jib/piped/blob/master/etc/config.js.example) file.

Installation and Configuration
------------------------------

 * Install node.js
 * Clone the project
 * Run `npm install` from the repository root
 * Create a config file `from etc/config.js.example` and put it somewhere
 * Start the Daemon:

    node bin/piped.js --config=/path/to/config

 (optional: all config values can be passed on the command line as well)

Tests
-----

`PipeD` comes with a test harness to exercise it's core features. To run
the test suite, run the following command from the repository root:

  $ ./run_tests.sh


Admin Interface
---------------

`PipeD` exposes an Admin interface (by default on port 29030) that you
can telnet to to inspect the health of the system.

Here is a list of supported commands:

* *help* Returns a list of supported commands

* *ping* Returns 'pong' - useful for basic monitoring/health checks

* *config* Returns a `JSON` representation of the config this instance is using

* *stats* Returns a `JSON` representation of the send/receive statistics and the
state of the listeners, chains and remotes.

Statsd Integration
------------------

`PipeD` integrates with [StatsD](https://github.com/etsy/statsd) for usage
statistics. Simply configure the `StatsD` endpoint in your config and watch
the stats on listeners, chains and remotes stream in.

Inspiration
-----------

At [Krux][krux] we deal with a large amount of inbound analytics data (well
north of 15k/second) on our beacon nodes. We store this data locally on disk
for later batch processing, but we also want to move this data off the host
asap for real time processing of certain bits of data.

Originally, we had used [rsyslog](http://www.rsyslog.com/) as the mechanism
to move files off the host, but found it had a number of short comings that
greatly reduced it's usefulness to us:

* *High CPU overhead* At several thousand requests per second, even a basic
`forward everything` rule in rsyslog was eating up significant amounts of
CPU, leaving less for the actual processes we wanted to run

* *Flaky failover* When the primary delivery node for rsyslog disappeared,
it would often mark the node as sick, but not failover to the fallback host,
causing it to overflow it's internal buffer, then disk, and eventually block
outgoing traffic.

* *Input conversion* As we started to use more piping techniques, not all
inputs were in a format that rsyslog could easily consume, or would require
us to run multiple rsyslog instances to watch all the inputs.

`PipeD` aims to address all the issues above while being small, flexible,
fast and lightweight.

As a comparison, on a test using a [c1.medium](http://aws.amazon.com/ec2/#instance),
`PipeD` was able to handle 85k messages/second over `TCP` or [UDP][udp] with a
single remote endpoint, where rsyslog would run out of CPU at 10k/second.

Interesting detail to the `PipeD` benchmark is that the bottlenecks were the
`cat` and `nc` process that are taking up the majority of the CPU for the
benchmark.


Contribute
---------------------

You're interested in contributing to PipeD? *AWESOME*. Here are the basic steps:

fork PipeD from here: http://github.com/jib/piped

1. Clone your fork
2. Hack away
3. If you are adding new functionality, document it in the README
4. If necessary, rebase your commits into logical chunks, without errors
5. Push the branch up to GitHub
6. Send a pull request to the jib/piped project.

We'll do our best to get your changes in!


[krux]: http://www.krux.com
[node]: http://nodejs.org
[udp]: http://en.wikipedia.org/wiki/User_Datagram_Protocol
