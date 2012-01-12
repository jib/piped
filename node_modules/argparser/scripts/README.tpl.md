argparser v${version}
==================
[Node.js] ${description}

${changelog}

----------------
<< for (var i in changeLogs) { >>
* [${i}]: ${changeLogs[i]}
<< } >>

${overview}
----------------
### ${install} ###
    git clone git://github.com/shinout/argparser.git

    ${_OR}

    npm install argparser

### ${usage} ###
    const ArgParser = require('argparser');

    /* ${simplest_use} */
    /* node hoge.js --long-var -s foo bar  */
    var parser = new ArgParser().parse();
    parser.getArgs(); // [foo, var]
    parser.getOptions(); // {long-var: true, s: true}
    parser.getOptions('long-var'); // true


    /* ${with_value} */
    /* node hoge.js piyo foo -h --var-with-val 392 bar  */
    var parser = new ArgParser();
    parser.addValueOptions(['var-with-val']);
    parser.parse();
    parser.getArgs(); // [piyo, foo, var]
    parser.getOptions(); // {h: true, var-with-val: 392}


    /* ${parse_array} */
    var parser = new ArgParser();
    parser.addValueOptions(['encoding', 'm', 'aaa']);
    parser.parse(['-m', 110, '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [index.html]
    parser.getOptions(); // {encoding: utf-8, m: 100, aaa: false}


    /* ${non_val} */
    parser.addOptions(['-h', '-t']);
    parser.addValueOptions(['encoding', 'e', 'm']);
    parser.parse(['-h', 'hoge', '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [hoge, index.html]
    parser.getOptions(); // {h: true, encoding: utf-8, m: false}
    parser.getOptions('e'); // false
    parser.getOptions('encoding'); // utf-8
    parser.getOptions('encoding', 'e'); // utf-8
    parser.getOptions('e', 'encoding'); // utf-8

