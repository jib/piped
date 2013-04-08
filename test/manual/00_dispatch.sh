#!/bin/sh

echo "***FIRST*** Start these servers manually:"
echo "  nc -kl 10001"
echo "  rm -rf /tmp/remote.socket; nc -klU /tmp/remote.socket"
echo "  nc -klu 10001"

echo
echo

echo "***NEXT*** Start piped manually:"
echo "  node bin/piped.js test/manual/config.js"

echo
echo

echo "***AUTOMATED TESTS WILL NOW START***"


echo "tcp:11000"         | nc localhost 11000
echo "udp:11000"         | nc -u -w1 localhost 11000
echo "/tmp/piped.socket" | nc -U /tmp/piped.socket

echo
echo
echo "Now check the output of the netcat terminals for 3 outputs"
