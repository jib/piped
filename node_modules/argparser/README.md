argparser v0.0.9
==================
[Node.js] parse commandline-args and options

Change Log

----------------
* [0.0.1]: Release
* [0.0.2]: modify getter methods
* [0.0.3]: enable method chaining
* [0.0.4]: copy process.argv
* [0.0.5]: get string expression of command with stringify()
* [0.0.6]: get option string from hash data with ArgParser.getOptionString(obj)
* [0.0.7]: exclude null or false in ArgParser.getOptionString(obj)
* [0.0.9]: set default values customizable

Overview
----------------
### Installation ###
    git clone git://github.com/shinout/argparser.git

    OR

    npm install argparser

### Usage ###
    const ArgParser = require('argparser');

    /* the simplest use */
    /* node hoge.js --long-var -s foo bar  */
    var parser = new ArgParser().parse();
    parser.getArgs(); // [foo, var]
    parser.getOptions(); // {long-var: true, s: true}
    parser.getOptions('long-var'); // true


    /* set options with value */
    /* node hoge.js piyo foo -h --var-with-val 392 bar  */
    var parser = new ArgParser();
    parser.addValueOptions(['var-with-val']);
    parser.parse();
    parser.getArgs(); // [piyo, foo, var]
    parser.getOptions(); // {h: true, var-with-val: 392}


    /* parse array */
    var parser = new ArgParser();
    parser.addValueOptions(['encoding', 'm', 'aaa']);
    parser.parse(['-m', 110, '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [index.html]
    parser.getOptions(); // {encoding: utf-8, m: 100, aaa: false}


    /* set non-value options */
    parser.addOptions(['-h', '-t']);
    parser.addValueOptions(['encoding', 'e', 'm']);
    parser.parse(['-h', 'hoge', '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [hoge, index.html]
    parser.getOptions(); // {h: true, encoding: utf-8, m: false}
    parser.getOptions('e'); // false
    parser.getOptions('encoding'); // utf-8
    parser.getOptions('encoding', 'e'); // utf-8
    parser.getOptions('e', 'encoding'); // utf-8
