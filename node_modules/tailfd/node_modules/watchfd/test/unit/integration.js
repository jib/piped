var ExpectEvent = require(__dirname+'/../lib/expectevent.js').ExpectEvent,
    test = require('tap').test,
    assert = require('assert'),
    fs = require('fs'),
    watchfd = require(__dirname+'/../../watch.js'),
    logFile = 'test1'+Date.now()+Math.random()+'.log';



test('test that the stuff works =)',function(t){
  
  var changesObservedThroughDefaultListener = 0,
  watcher = watchfd.watch(logFile,{timeout:1000,timeoutInterval:200},function(cur,prev){
    /*dont need to watch change here*/
    changesObservedThroughDefaultListener++;
  }),
  expect = new ExpectEvent(watcher);

      
  watcher.on('error',function(err){
    throw err;
  });
  
  //
  // enforce some max execution time for watcher test
  //
  
  expect.expect('close',function(err,data){
    if(err) {
      watcher.close();
      fs.unlink(logFile);
      throw err;
    }
  },20000);

  // file not exists event should be triggered
  expect.expect('noent',function(err,data){
    if(err) throw err;
  },1000);

  //cleanup
  var cleanup = function(){
    fs.unlink(logFile);
    if(!changesObservedThroughDefaultListener){
      assert.ok(changesObservedThroughDefaultListener,"this test should have triggered the default change handler numerous times");
    }
  };
  
  process.on('exit',cleanup);

  // file descriptors for unlinked events tests
  var fd1 = null,
      fd2 = null;
  
  var q = {
    //
    "trigger open. expect that it is fired within six seconds":function(){
      expect.expect('open',function(err,stat){

        if(err) throw err;
        done();
      },6000);
      
      fs.open(logFile,'a+',function(err,fd){

        assert.ifError(err);
        
        fd1 = fd;
        
        var buf = new Buffer('party rockin');
        
        // watchFile does not seem to hit imediately for regular empty files.
        fs.write(fd1,buf,0,buf.length,null,function(err,bytesWritten){
          assert.ifError(err);
        });
      });
    },
    //
    "trigger change expect that it is fired within one second":function(){
      expect.expect('change',function(err,data){
        if(err) throw err;
        //must have file descriptor with change events
        assert.ok(data[3].fd,'must have fd with change events');

        done();
      },1000);
      
      var buf = new Buffer('party floppin');
      
      fs.write(fd1,buf,0,buf.length,null,function(err,bytesWritten){
        assert.ifError(err,'can write to file');
      });
    },
    //
    "unlink and wait for unlink":function(){
      expect.expect('unlink',function(err,data){
        if(err) throw err;
        done();
      },10000);   
      
      fs.unlink(logFile,function(err){
        assert.ifError(err,'got an error cleaning up files');
      });
    },
    //
    "create again wait for open":function(){
      expect.expect('open',function(err,data){
        if(err) throw err;
        done();
      },10000);
      
      fs.open(logFile,'w+',function(err,fd){
        assert.ifError(err,'error opening test file for writing');
        fd2 = fd;
        
        var buf = new Buffer('new party');
        
        fs.write(fd2,buf,0,buf.length,null,function(err,bytesWritten){
          assert.ifError(err,'should have written byte to the test file');
        });
      });
    },
    //
    "write data to unlinked fd and wait for change":function(){
      expect.expect('change',function(err,data){
        if(err) throw err;
        done();
      },1000);
      
      var buf = new Buffer('party unlinked');
      
      fs.write(fd1,buf,0,buf.length,null,function(err,bytesWritten){
        assert.ifError(err,'should not hav error writing test log file');
      });
    },
    //
    "wait for timeout on fd1":function(){
      
      expect.expect('timeout',function(err,data){
        if(err) throw err;
        assert.equal(Object.keys(watcher.fds).length,1,'should only have one fd if fd1 timed out');
        
        done();
      },2000);
    },
    "pause and get no events":function(){
      expect.expect('change',function(err,data){
        if(!err) throw new Error('expected to get an error. events should not have fired!');
        done();
      },1000);//same wait as the other change listener

      watcher.pause();

      var buf = new Buffer('paused party');
      
      fs.write(fd2,buf,0,buf.length,null,function(err,bytesWritten){
        assert.ifError(err,'should have written bytes to the test file');
      });
    },
    "resume and get events":function(){
      expect.expect('change',function(err,data){
        console.log("in resume and get results handler!");
        if(err) throw err;
        done();
      },1000);//expect it quickly

      watcher.resume();
    }
  },
  lastStart = Date.now(),
  done = function(){
    var keys = Object.keys(q),
        testKey = keys.shift(),
        test = q[testKey];
    
    if(test) {
      delete q[testKey];
      
      var elapsed = Date.now()-lastStart;
      console.log("\telapsed: ",elapsed,'ms');
      console.log('starting test : ',testKey);
      lastStart = Date.now();
      test();
    } else complete();
  },
  complete = function(){
    watcher.close();
    cleanup();
    t.end();
  };
  done();
  
});


