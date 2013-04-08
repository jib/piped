// TODO: come up with defaults & documentation here
{   debug:  true,
    trace:  false,
    tcp_port: 11000,
    udp_port: 11000,
    unix_socket: '/tmp/piped.socket',
    servers: [
        [ "tcp://localhost:10001" ],
        [ "udp://localhost:10001" ],
        [ "socket:///tmp/remote.socket" ],
    ],
};
