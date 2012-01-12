function ArgParser() {
  this.valopts    = {s: [], l: []};
  this.opts = {s: [], l: []};
  this.options    = {}; // in future, this will be [Getter/Setter]
  this.args       = []; // in future, this will be [Getter/Setter]
  this.invalids   = []; // in future, this will be [Getter/Setter]
  this.defaults = {
    opts   : false,
    valopts: false 
  };
}

/* getters ( in future, these will be deprecated... ) */
ArgParser.prototype.getOptions  = function() {
  if (arguments.length == 0) {
    return this.options;
  }
  var ret = null;
  const that = this;
  Array.prototype.forEach.call(arguments, function(arg) {
    ret = ret || that.options[arg];
  });
  return ret;
}

ArgParser.prototype.getArgs = function(n) {
  return (n == null) ? this.args: this.args[n];
}

ArgParser.prototype.stringifyOptions = function() {
  var that = this;
  return ['opts', 'valopts'].map(function(opts) {
    return Object.keys(that[opts]).map(function(sl) {
      return that[opts][sl]
      .filter(function(k) {
        return (that.options[k] !== false);
      })
      .map(function(k) {
        return (( (sl == 's') ? '-'+k : '--'+k ) + ( (opts == 'opts') ? '' : (' ' + that.options[k]))).replace(/ +$/, '');
      }).join(' ');
    }).join(' ').replace(/ +$/, '');
  }).join(' ').replace(/ +$/, '');
}

ArgParser.prototype.stringify = function() {
  return this.stringifyOptions() + ' ' + this.args.join(' ');
}

ArgParser.prototype.getInvalids = function(n) {
  return (n == null) ? this.invalids : this.invalids[n];
}


ArgParser.prototype.addValueOptions = function(arr) {
  arr.forEach(function(opt) {
    this.valopts[(opt.length == 1) ? 's' : 'l'].push(opt);
  }, this);
  return this;
}

ArgParser.prototype.addOptions = function(arr) {
  arr.forEach(function(opt) {
    this.opts[(opt.length == 1) ? 's' : 'l'].push(opt);
  }, this);
  return this;
}

ArgParser.prototype.parse = function(arr) {
  /* clear past data */
  this.options  = {};
  this.args     = [];
  this.invalids = [];

  /* check arguments */
  if (! (arr instanceof Array)) {
    arr = [];
    process.argv.forEach(function(v, k) {
      if (k >= 2) arr.push(v);
    });
  }

  /* set default values */
  var that = this; // for shortcut access to this
  ['opts', 'valopts'].forEach(function(opts) {
    ['s', 'l'].forEach(function(sl) {
      that[opts][sl].forEach(function(opt) {
        that.options[opt] = that.defaults[opts];
      });
    });
  });


  /* parse arguments */
  var vopt;
  arr.forEach(function(val) {
    /* if option with value is set */
    if (vopt) {
      that.options[vopt] = val;
      vopt = null;
      return;
    }

    /* short option parsing */
    if (val.match(/^-[a-zA-Z0-9_]$/)) {
      var optname = val.charAt(1);
      if (that.valopts.s.indexOf(optname) >= 0) {
        vopt = optname;
        return;
      }
      else if (that.opts.s.indexOf(optname) >= 0) {
        that.options[optname] = true;
        return;
      }
      else { // invalid option
        that.options[optname] = true;
        that.invalids.push(optname);
        return;
      }
    }

    /* long option parsing */
    if (val.match(/^--[a-zA-Z0-9_-]+$/)) {
      var optname = val.slice(2);
      if (that.valopts.l.indexOf(optname) >= 0) {
        vopt = optname;
        return;
      }
      else if (that.opts.l.indexOf(optname) >= 0) {
        that.options[optname] = true;
        return;
      }
      else {
        that.options[optname] = true;
        that.invalids.push(optname);
        return;
      }
    }

    /* arguments */
    that.args.push(val);
  });
  return this;
}

ArgParser.getOptionString = function(obj) { 
  var ret = [];
  Object.keys(obj).forEach(function(opt) {
    if (obj[opt] === null || obj[opt] === false) return;
    ret.push( ((opt.length == 1) ? '-' : '--') + opt + ' ' + obj[opt]);
  });
  return ret.join(' ');
};

/* version */
ArgParser.version = '0.0.9';

module.exports = ArgParser;
