#!/bin/sh

#set -x

### Turn on verbosity
TEST_VERBOSE=1;
export TEST_VERBOSE;

OK=0;
for test in `ls -1 test/*js`
do
    ### run the test
    echo "#\n# Running: node $test\n#"
    node $test;

    ### If the command exited with an error code, add it here
    ### Syntax: http://tldp.org/LDP/abs/html/dblparens.html#CVARS
    ((OK += $?));
done

### Basic diagnostic
if [ "$OK" != "0" ]; then
    echo "TEST SUITE FAILED ($OK ERRORS)";
else
    echo "All tests successful";
fi

### exit code will be amount of failed tests
exit $OK;
