const ArgParser= require('../ArgParser');
const test = require('./shinout.test');

var parser = new ArgParser();
parser.addValueOptions(['m', 'mmm', 'set-hoge']);
parser.addOptions(['h', 'hhh', 'non-val']);
parser.parse(['-h', 'aa', 'hoge', 'fuga', '--mmm', 'piyo']);
var options = parser.getOptions();
var args = parser.getArgs();

test('equal', options.h, true, 'invalid : options.h');
test('deepEqual', options['non-val'], false, 'invalid : options[non-val]');
test('deepEqual', options['non-option'], undefined, 'invalid : options[non-option]');
test('equal', args[0], 'aa', 'invalid : args[0]');
test('equal', args[1], 'hoge', 'invalid : args[1]');
test('equal', args[2], 'fuga', 'invalid : args[2]');

test('equal', parser.getOptions('hhh'), false, 'invalid : getOptions(hhh)');
test('equal', parser.getOptions('h'), true, 'invalid : getOptions(h)');
test('equal', parser.getOptions('h', 'hhh'), true, 'invalid : getOptions(h, hhh)');
test('equal', parser.getOptions('hhh', 'h'), true, 'invalid : getOptions(hhh, h)');
test('deepEqual', parser.getOptions('non-val'), false, 'invalid : getOptions(non-val)');
test('deepEqual', parser.getOptions('non-option'), undefined, 'invalid : getOptions(non-option)');
test('deepEqual', parser.getOptions('mmm'), 'piyo', 'invalid : getOptions(mmm)');
test('deepEqual', parser.getOptions('m'), false, 'invalid : getOptions(m)');
test('deepEqual', parser.getOptions('m', 'mmm'), 'piyo', 'invalid : getOptions(m, mmm)');
test('deepEqual', parser.getOptions('mmm', 'm'), 'piyo', 'invalid : getOptions(mmm, m)');

test('equal', parser.getArgs(0), 'aa', 'invalid : getArgs(0)');
test('equal', parser.getArgs(1), 'hoge', 'invalid : getArgs(1)');
test('equal', parser.getArgs(2), 'fuga', 'invalid : getArgs(2)');
test('result', 'simple option test');


parser.parse(['--set-hoge', 'foo', 'bar', '-m', '23', '-h']);
var options = parser.getOptions();
var args = parser.getArgs();
test('equal', options.h, true, 'invalid : options.h');
test('equal', options.m, '23', 'invalid : options.m');
test('equal', options['set-hoge'], 'foo', 'invalid : options[set-hoge]');
test('equal', args[0], 'bar', 'invalid : args[0]');
test('result', 'option with val test');


parser.parse(['--not-option', 'foo', 'bar', '-h']);
var options = parser.getOptions();
var args = parser.getArgs();
test('equal', options.h, true, 'invalid : options.h');
test('equal', options['not-option'], true, 'invalid : options[not-option]');
test('equal', args[0], 'foo', 'invalid : args[0]');
test('equal', args[1], 'bar', 'invalid : args[1]');
test('equal', parser.getInvalids()[0], 'not-option');

test('equal', parser.getInvalids(0), 'not-option', 'invalid : getInvalids(0)');
test('result', 'invalid option test');



parser.parse(['-this-is-not-option', 'foo', 'bar', '-h']);
var options = parser.getOptions();
var args = parser.getArgs();
test('equal', options.h, true, 'invalid : options.h');
test('equal', options['this-is-not-option'], null, 'invalid : options[this-is-not-option]');
test('equal', args[0], '-this-is-not-option', 'invalid : args[0]');
test('equal', args[1], 'foo', 'invalid : args[1]');
test('equal', args[2], 'bar', 'invalid : args[2]');
test('result', '-long-name test');


parser.parse();
test('ok', process.argv[0], 'process.argv[0] is deleted');
test('ok', process.argv[1], 'process.argv[1] is deleted');
test('result', 'argv test');

// getOptionString
var opts = {s: "shortval", looong: "longval", innt: 1, nullval: null, floaat: 0.222, falseval: false};
test('equal', ArgParser.getOptionString(opts), '-s shortval --looong longval --innt 1 --floaat 0.222');
test('result', 'getOptionString test');
