// TODO: come up with defaults & documentation here
{   debug:  true,
    trace:  false,
    tcp_port: 11000,
    udp_port: 11000,
    servers: [
        [ "tcp://localhost:10001", "tcp://localhost:10002" ],
    ],
    // Monitor OFTEN so we can see the fail overs
    monitor_interval: 2, // in ms
    max_buffer_size:  5, // in bytes, trigger failover
};
