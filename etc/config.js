// TODO: come up with defaults & documentation here
{   debug:  true,
    trace:  true,
    tcp_port: 1337,
    servers: [
        [ "tcp://localhost:10001", "socket:///tmp/echo1.socket" ],
        [ "tcp://localhost:10002", "udp://localhost:10005" ],
    ],
};
