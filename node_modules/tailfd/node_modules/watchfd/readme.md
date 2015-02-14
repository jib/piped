[![Build Status](https://secure.travis-ci.org/soldair/node-watchfd.png)](http://travis-ci.org/soldair/node-watchfd)

## watchfd

Watch events open,change,unlink on all files that are refrenced or become refrenced by path

provide events for any file descriptors that are referenced by a watched path, 
or were referenced by a watched path for as long as they are still changing.
active is defined by a timeout since last event. file descriptors that become inactive are removed.


## install

	npm install watchfd

## use

	var watchfd = require('watchfd').watch;
	watchfd('/some.log',function(cur,prev){
		console.log(prev.size,' changed to ',cur.size);
	});

### a use case

an issue with log/file forwarding utilities currently available in npm is that they only watch the file descriptor under the filename. when a log is rotated and a new log is created the server may not stop writing to the old file descriptor immediately. Any data written to that descriptor in this state ends up in /dev/null


### argument structure

watchfd.watch(filename, [options], listener)

- filename
  its really intended that this be a regular file or non existant. i dont know what would happen right now if its a directory.
- options. supported custom options are

	```js
	{
	"timeout": 60*60*1000, //defaults to one hour
	//how long an inactive file descriptor can remain inactive

	"timeoutInterval":60*5*1000 //every five minutes
	// how often to check for inactive file descriptors
	}

	//the options object is also passed directly to watch and watchFile so you may configure

	{
	"persistent":true, //defaults to true
	//persistent indicates whether the process should continue to run as long as files are being watched

	"interval":0, //defaults 0
	//interval indicates how often the target should be polled, in milliseconds. (On Linux systems with inotify, interval is ignored.) 
	}
	```

- callback
  this is bound to the change event of the watcher. its required

	```js
	callback(cur,prev)
	```

  cur and prev are instances of fs.Stats

- @returns
  an instance of Watcher

### Watcher methods

Watcher.pause()

- paused, changed and last state is kept for each file descriptor
  - stops file descriptors from timing out.
  - all events except error are paused.
  - unlink, open, change etc will be fired in the correct order after resume. 
    no events will be missed but change events will be combined


Watcher.resume()

- resumed
  - for each file descriptor pending events are fired in the corect order
    open,change,unlink
  - the change event has the stat from first change event while paused and the most recent so no change is missed.


Watcher.paused

 - is paused
 - readonly please.

### Watcher events

Watcher.on(event name,call back);

- change
		fs.Stats cur, fs.Stats prev
- open
		fs.Stats cur,{fd:file descriptor,stat:fs.Stats cur}
- unlink
                fs.Stats cur,{fd:file descriptor,stat:fs.Stats cur}
- timeout
                fs.Stats cur,{fd:file descriptor,stat:fs.Stats cur}

#### windows support problems

- It uses file inode as a unique id for each descriptor. I know there is a way to get a unique id for a file in windows i just don't know if that would be passed to stat as stat.ino. 
- I use watchFile which is not supported at all on windows but this would be easier to overcome considering i can use a configured polling interval as a stat polling fall back on windows. 
- I also don't know windows very well and don't know if windows has the problem this module solves...but i imagine it would

#### notes

I noticed distinct differences in watchFile vs watch api
fs.watchFile will issue events for a file that is currently referenced by a path
fs.watch will take a path but issue events whenever that file descriptor is changed even after it's unlinked

We should probably design servers to listen to SIGHUP and grab new file descriptors for all loggers but even if you used logrotate with copytruncate mode as to not change the file referenced by a path the chance that you will loose data is still there. I feel safer waiting for a file descriptor to be quiet so i know its out of use before i close it in a process that has the ability to read data out of it.
