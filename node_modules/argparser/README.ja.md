argparser v0.0.9
==================
[Node.js] コマンドライン引数、オプション解析

変更履歴

----------------
* [0.0.1]: リリース
* [0.0.2]: getterメソッドを改良
* [0.0.3]: メソッドチェーンに対応
* [0.0.4]: process.argvのreferenceでなくcopyを利用するようにした
* [0.0.5]: stringify()でコマンドの文字列に戻す作業
* [0.0.6]: ArgParser.getOptionString(obj) でハッシュからオプション文字列を取得
* [0.0.7]: ArgParser.getOptionString(obj)でnullとfalseの場合はオプションに含めないようにした
* [0.0.9]: defaultの値をfalse固定からカスタマイズできるようにした

概要
----------------
### インストール方法 ###
    git clone git://github.com/shinout/argparser.git

    または

    npm install argparser

### 使い方 ###
    const ArgParser = require('argparser');

    /* シンプルな使い方 */
    /* node hoge.js --long-var -s foo bar  */
    var parser = new ArgParser().parse();
    parser.getArgs(); // [foo, var]
    parser.getOptions(); // {long-var: true, s: true}
    parser.getOptions('long-var'); // true


    /* 引数つきオプションを指定 */
    /* node hoge.js piyo foo -h --var-with-val 392 bar  */
    var parser = new ArgParser();
    parser.addValueOptions(['var-with-val']);
    parser.parse();
    parser.getArgs(); // [piyo, foo, var]
    parser.getOptions(); // {h: true, var-with-val: 392}


    /* 配列を与えて解析 */
    var parser = new ArgParser();
    parser.addValueOptions(['encoding', 'm', 'aaa']);
    parser.parse(['-m', 110, '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [index.html]
    parser.getOptions(); // {encoding: utf-8, m: 100, aaa: false}


    /* 引数なしオプションを指定 */
    parser.addOptions(['-h', '-t']);
    parser.addValueOptions(['encoding', 'e', 'm']);
    parser.parse(['-h', 'hoge', '--encoding', 'utf-8', 'index.html']);
    parser.getArgs(); // [hoge, index.html]
    parser.getOptions(); // {h: true, encoding: utf-8, m: false}
    parser.getOptions('e'); // false
    parser.getOptions('encoding'); // utf-8
    parser.getOptions('encoding', 'e'); // utf-8
    parser.getOptions('e', 'encoding'); // utf-8
