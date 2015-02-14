//
// TODO make this a module.
// expectevent module. allows you to expect an event in a test
// if you pass an emitter i will proxy emit to log all events and handle wait timeouts.
//

exports.ExpectEvent = ExpectEvent;


function ExpectEvent(emitter,options){
  var self = this;

  //
  // hijack emit for watching
  //
  if(emitter && emitter.emit) {
    this.emitter = emitter;
    
    var e = emitter.emit;
    emitter.emit = function(ev){
      //pass all args except event name again to log.
      var args = Array.prototype.slice.call(arguments);
      self.log(ev,args);
      return e.apply(emitter,arguments);
    };
    
    //
    // add un expect handle to emitter just in case an edge case needs to turn it off from the inside
    //
    emitter.unexpectevent = function(){
       emitter.emit = e;
    };
  }

  options = options ||{};
  
  this.maxLogEntries = options.maxLogEntries||this.maxLogEntries;
}

ExpectEvent.prototype = {
  counter:0,
  maxLogEntries:1000,
  eventLog:[],
  expected:{},
  emitter:null,
  log:function(name,args){
    this.eventLog.push(Array.prototype.slice.call(args).unshift(name));
    if(this.eventLog.length > this.maxLogEntries) this.eventLog.shift();
    
    for(var i=0,k = Object.keys(this.expected),j=k.length;i<j;++i) {
      if(this.expected[k[i]].name == name) {
        
        this.expected[k[i]].cb(this.expected[k[i]],args);
        clearTimeout(this.expected[k[i]].timer);
        delete this.expected[k[i]];
        
      }
    }
  },
  expect:function(name,cb,timeout){
    this.counter++;
    //local ref to counter
    var self = this,
        c = this.counter,
        failed = false;
    
    //
    //activate timer so we dont wait forever for the event
    //
    var timer = setTimeout(function(){
      
      var err = new Error('event '+name+' not fired before timeout of '+timeout+' ms');
      console.log('delete expected callback ',c);
      delete self.expected[c];
      cb(err,false);

    },timeout);

    //
    // add expect event watcher on to the watchers list
    //
    this.expected[this.counter] = {
      name:name,
      cb:function(arr,eventArgs){
        console.log('expect callback ',c,' called');
        //just in case its called after it fails. shouldnt happen but who knows.
        if(failed) {
          console.error('expectEvent warning> callback called after failed. there is probably a bug.');
          return;
        }
        
        clearTimeout(arr[1]);
        cb(false,eventArgs);
      },
      timer:timer
    };

  },
  getLog:function(){
    return this.eventLog;
  },
  flushLog:function(){
    this.eventLog = [];
  }
};
