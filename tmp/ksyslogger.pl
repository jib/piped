#!/usr/bin/perl

use strict;
use warnings;
use sigtrap handler => \&sig_pipe, 'PIPE';

use Getopt::Long;
use IO::Socket;
use Time::HiRes     qw[usleep];
use Sys::Syslog     qw[:standard :macros];
use Sys::Hostname   qw[hostname];
use File::Basename  qw[basename];

$|++;

### XXX this needs to support facilities, which work like this:
### send(1, "<190>Oct 14 00:47:59 ubuntu: tes"..., 33, MSG_NOSIGNAL) = 33
### The <190> is facility.prio encoded.
### see here for how to do it:
### http://bazaar.launchpad.net/~ubuntu-branches/ubuntu/lucid/util-linux/lucid/view/head:/misc-utils/logger.c
### And Sys::Syslog supports it too, which we should probably use:
### http://search.cpan.org/~saper/Sys-Syslog-0.29/Syslog.pm


### defaults
my $help        = 0;
my $max_wait    = 5;
my $port        = 514;
my $host        = 'localhost';
my $sleep       = 10;
my $me          = basename( $0 );
my $tag         = '<none>';
my $hostname    = hostname();

my %opts    = (
    help            => \$help,
    "micro-sleep=i" => \$sleep,
    "max-wait=i"    => \$max_wait,
    "port=i"        => \$port,
    "host=s"        => \$host,
    "tag=s"         => \$tag,
);


GetOptions( %opts ) or die usage( $me, %opts );
die usage( $me, %opts ) if $help;

### addresss to connect to
my $addr = "$host:$port";

### get a socket
my $io;
$io = get_socket( $addr, $sleep ) while not $io;

### Syslog for error reporting
#openlog( $me, LOG_LOCAL0 );

my $prefix = "$hostname $tag: ";
while( <STDIN> ) {
    print ".";

    ### this raises SIGPIPE on dead socket
    ### XXX we seem to miss the first failure in syslog,
    ### only gets logged at the 2nd one =/
    $io->send( $prefix . $_ ) or get_socket( $addr, $sleep );
}

### probably wont get here
#closelog();

{   ### when it is safe to reconnect again
    my $next_time = time();
    my $wait      = 0;

    sub get_socket {
        my $peeraddr    = shift or return;
        my $micro_sleep = shift || 0;
        my $time        = time();

        ### safety net, due to early pointer declaration
        $next_time  ||= time();
        $wait       ||= 0;

        ### try to reconnect?
        if( time() - $next_time >= 0 ) {

            ### let's get a new connection going
            my $new_io = eval { IO::Socket::INET->new( PeerAddr => $peeraddr ) };
    
            ### Good, got it         
            if( $new_io ) {

                ### reset the values
                $next_time  = time();
                $wait       = 0;
                $io         = $new_io;
                
                ### log the reconnect
                print( "($$) Remote connection $addr restored" ); 

                ### short circuit
                return $io;
            } else {

                ### back off for a while, but no more than $max_wait
                $wait = $wait > $max_wait   ? $max_wait     :
                        $wait               ? $wait * 1.5   :
                        1;

                ### if we went over max wait, set it to that
                $wait = $max_wait if $wait > $max_wait;
                
                ### set the next time it's safe to connect again.
                $next_time += $wait;
                
                ### log the problem
                print( "($$) Remote connection $addr unavailable. Retry in $wait" );
            }
        }

        ### this blocks, but just so we don't peg the CPU
        ### in MICROSECONDS
        usleep( $micro_sleep ) if $micro_sleep;
        return;
    }
}

sub usage {
    my $me    = shift;
    my %args  = @_;
    my $usage = qq|Usage: $me [--OPTS]\n|;

    for my $key ( sort keys %args ) {
        $usage .= sprintf( "    %-15s # Default: %s\n", $key, ${$args{$key}} );
    }
    return $usage;
}
