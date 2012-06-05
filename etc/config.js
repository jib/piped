// TODO: come up with defaults & documentation here
{   debug:  true,
    trace:  false,
    tcp_port: 1337,
    udp_port: 1337,
    unix_socket: '/tmp/piped.socket',
    servers: [
//         [ "tcp://localhost:10001", "socket:///tmp/echo1.socket" ],
//         [ "tcp://localhost:10002", "udp://localhost:10005" ],
//        [ "tcp://localhost:10001" ],
        [ "tcp://localhost:10001" ],
        [ "udp://localhost:10001" ],
        [ "socket:///tmp/remote.socket" ],
    ],
};
