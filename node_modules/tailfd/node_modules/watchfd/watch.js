var util = require('util'),
events = require('events'),
fs = require('fs');


//
//watching is accomplished at the file descriptor level.
//watching a "filename" means you get events on deleted files where applications are still writing to open descriptors they are holding.
//a big thing to note is that if a file is moved and another process starts to write to it these change events will be buffered
//
module.exports = function(filename,options,listener){
  return new Watcher(filename,options,listener);
};

module.exports.watch = module.exports;

function Watcher(filename,options,listener){
  events.EventEmitter.call(this);

  var self = this,
  args = this._normalizeArguments(arguments);
  
  // treat missing listener exactly like node does in fs.watchFile
  if(typeof args.listener != 'function') {
    throw new Error('watch requires a listener function');
  }
  
  this.options = args.options||{};
  this.file = args.file;
  this.fds = {};
  
  //
  //if im watching a file descriptor thats deleted and inactive.
  //
  this.options.timeout = this.options.timeout || 60*60*1000;
  
  //
  //this is the interval that the watcher uses to enforce options.timeout.
  //
  this.options.timeoutInterval = this.options.timeoutInterval || 60*5*1000;
  if(this.options.timeout < this.options.timeoutInterval) this.options.timeoutInterval = this.options.timeout;

  this.on('change',args.listener);
  
  fs.stat(this.file,function(err,stat) {
    if(err) {
      
      if(err.code != 'ENOENT') {
        
        //next tick so we have a chance to bind error
        process.nextTick(function(){
          //for all other errors we cannot continue.
          self.emit('error',err);
        });
        return;
        
      } else {
        self.emit('noent');
      }
      
    } else {
      
      self._observeInode(stat);
      
    }
    
    self._watchFile();
    self._startTimeout();
  });
}

util.inherits(Watcher,events.EventEmitter);

//
// define class members
//
var WatcherMethods = {
  //public api methods
   
  close:function(){
    for(var inode in this.fds) {
      if(this.fds.hasOwnProperty(inode)) {
        this._closeFd(inode);
      }
    }
    fs.unwatchFile(this.file);
    clearTimeout(this._timeoutInterval);
    this.emit('close');
  },
  //  
  // ## pause and resume. 
  // 
  // - paused, changed and last state is kept for each file descriptor
  //   - stop file descriptors from timing out.
  //   - all events except error
  //   - unlink, open
  //   - change
  // - resumed, the state events are isued then change
  //   - opens and unlinks are issued for each file descriptor
  //   - change event for change if any
  //
  paused:false,
  resume:function() {
    var self = this;
    this.emit = this._emit;
    this.paused = false;
    Object.keys(this._pausedEvents||{}).forEach(function(key,k){
      var events = self._pausedEvents[key];
      if(!events) return;
      if(events.open) self.emit.apply(self,events.open);
      if(events.change) self.emit.apply(self,events.change);
      if(events.unlink) self.emit.apply(self,events.unlink);
    });

    delete this._emit;
    delete this._pausedEvents;
  },
  pause:function(){
    var self = this;

    if(this.paused) return;
    this._pausedEvents = {};

    this.paused = true;
    //jack emit
    this._emit = this.emit;
    this.emit = function(ev,cur,prev) {

      if(ev == 'error') return this._emit.apply(this,arguments);
      if(ev == 'open' || ev == 'unlink') {
        if(prev.stat) prev = prev.stat;
        cur = prev;
      }

      if(!cur) return;

      if(!self._pausedEvents[cur.ino]) {
        self._pausedEvents[cur.ino]= {};
        self._pausedEvents[cur.ino]._first = cur;
      }

      self._pausedEvents[cur.ino][ev] = arguments;
      if(ev == 'change') {
        //set previous stat to be the first stat after pause
        self._pausedEvents[cur.ino][ev][2] = self._pausedEvents[cur.ino]._first;
      }
    };
  },
  //------ protected methods -------
  //
  //this is the path to the last stat i got from the filename im trying to watch.
  //used to differentiate "inactive" descriptors from the one currently residing at that file location.
  //
  _fileStat:null,
  //
  // the interval used to cleanup inactive file descriptors that no longer refrenced by this.file
  //
  _timeoutInterval:null,
  //
  // watchFile watches the stat at path
  // i am using watchFile to determine if the file i was originally told to watch is replaced etc.
  //
  _watchFile:function(){
    var self = this,lastInode = null;
    //NOTE for windows i could poll with fs.stat at options.interval
    fs.watchFile(this.file,this.options,function(cur,prev){
      
      if(!cur.ino && prev.ino) cur.ino = prev.ino;

      //i need to know what fd is the active fd inter the file path
      self._fileStat = cur;
      if(!cur.ino && pre.ino || cur.nlink === 0) {
        //no hardlinks left to this file. 
        //or no inode. its unlinked for sure.
        self.emit('unlink',self.fds[cur.ino].fd,self.fds[cur.ino].getData());

      } else if(!self.fds[cur.ino]){

        self._observeInode(cur);

      } else if(cur.size === prev.size){

        //sometimes the watch event fires after an unlink with nlink still equal to 1
        //i stat to first see if its not there
        //by the time stat is done checking the file could have been replaced by a new file
        //so i validate the inode also.
        
        fs.stat(self.file,function(err,stat){
          var deleted = false;
          if(err && err.code === 'ENOENT'){
            deleted = true;
          } else if(!err) {
            if(stat.ino !== cur.ino || cur.nlink === 0) {
              deleted = true;
            }
          }

          if(deleted) {
            self.emit('unlink',self.fds[cur.ino].fd,self.fds[cur.ino].getData());
          }
        });
          
      }
      
    });
  },
  //
  // manage open file descriptors to deleted/moved log files.
  //
  _startTimeout:function(){
    //timeouts are not subject to stacking and stuff with process overload
    var self = this;
    self._timeoutInterval = setTimeout(function fn(){
      self._timeoutInterval = setTimeout(fn,self.options.timeoutInterval);

      if(self.paused) {
        return;
      }

      if(!self._fileStat) {
        return;
      }

      for(var inode in self.fds){
        if(self.fds.hasOwnProperty(inode) && self.fds[inode]) {
          // if im not the current file descriptor refrenced by path 
          if(inode+'' !== self._fileStat.ino+''){
            var fdState = self.fds[inode],
                mtime = Date.parse(fdState.stat.mtime);
            
            // i want to wait at least timeout from the time i start watching the fd
            if(mtime < fdState.created){
              mtime = fdState.created;
            }
            
            var sinceChange = Date.now()-mtime;

            if(sinceChange > self.options.timeoutInterval){

                self._closeFd(inode);
                self.emit('timeout',fdState.fd,fdState.getData());
                
            }

          }
          
        }
      }
      
    },self.options.timeoutInterval);
  },
  //
  // start file descriptor based watcher
  //
  _observeInode:function(stat,cb) {
    var self = this;
    
    //prevent assigning multiple watch watchers
    if(self.fds[stat.ino]) {
      return;
    }
    
    var fdState = self.fds[stat.ino] = new WatcherFd(stat),
        inode = stat.ino;

    fs.open(this.file,'r',function(err,fd){
      if(err || !self.fds[inode]){
        
        //file must not exist now. it was deleted pretty quickly.. =/
        // or i was ended while i was setting up
        self._closeFd(stat.ino);
       
      } else {
        
        fdState.fd = fd;
        self.emit('open',fdState.fd,fdState.getData());
        
        fdState.watcher = fs.watch(self.file,function(event,filename) {
          fdState.created = Date.now();//time of last event
          fs.fstat(fd,function(err,stat){

            // ended. while i was setting up
            if(!self.fds[inode]) return; 

            if(!self.fds[stat.ino]){
              //between the first change event. and getting the fd. the file was replaced by another

              //recreate fdState
              fdState = new WatcherFd(stat);
              fdState.fd = fd;
              fdState.created = Date.now();

              //the watcher is already aware of this fd. no need to recreate it.
              fdState.watcher = self.fds[inode].watcher;

              //issue timeout event for dead before new inode
              this.emit('timeout',null, self.fds[inode].getData());
              //clean unknown inode
              delete self.fds[inode];

              self.fds[stat.ino] = fdState;
            }
            var prev = fdState.stat;
            fdState.stat = stat;
            self._observeChange(stat,prev);
          });
        });
        // observe change that told us about the fd
        process.nextTick(function() {
          self._observeChange(stat,stat);
        });
      }
    });
  },
  //
  // clean up 
  //
  _closeFd:function(inode){
    if(this.fds[inode]) {
      this.fds[inode].close();
      delete this.fds[inode];
    }
  },
  //
  // change dispatcher - sends WatcherFd data with each change event.
  //
  _observeChange:function(stat,prev) {
    //should always be set.
    if(!this.fds[stat.ino]) return;

    this.emit('change',stat,prev,this.fds[stat.ino].getData());
    
  },
  //
  // format arguments for easy reading / access
  //
  _normalizeArguments:function(args){
    if(typeof args[1] == 'function'){
      args[2] = args[1];
      args[1] = {};
    }
    return {file:args[0],options:args[1],listener:args[2]};
  }
};

extend(Watcher.prototype,WatcherMethods);

function WatcherFd(stat,timeout){
  this.stat = stat;
  this.timeout = timeout || this.timeout;
  this.created = Date.now();
}

WatcherFd.prototype = {
  fd:null,
  stat:null,
  state:null,
  watcher:null,
  created:null,
  getData:function() {
    return {fd:this.fd,stat:this.stat};
  },
  close:function() {
    if(this.fd) fs.close(this.fd);
    if(this.watcher) this.watcher.close();
    clearTimeout(this.timer);
  }
};

//---
function extend(o,o2){
  for( var i in o2 ) {
    if(o2.hasOwnProperty(i)) o[i] = o2[i];
  }
}
