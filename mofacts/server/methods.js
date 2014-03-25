var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var filename, name, timestamp;
var filepath = '/home/kdogfour/mofacts/mofacts/.meteor/'

Meteor.startup(function () {
	Stimuli.remove({});
	var files = fs.readdirSync('./assets/app/stims/');
	console.log(files);
	var stims = _(files).reject( function(fileName) {
		return fileName.indexOf('.xml') < 0;
	});

	for(var i = 0; i < stims.length; i++){
		var fileName = stims[i];
		var json = getStimJSON('stims/' + fileName);
		Stimuli.insert({fileName: fileName, stimuli: json});
	}

		Meteor.methods({

		//Added addition stuff to Log
		writing: function(stuff){
			fs.appendFile(filepath + name + "_" + filename +".txt", stuff, function (err) {
  				if (err) throw err;
			});
			Meteor.call("addtime");
		}
	});

		Meteor.methods({

		//Added addition stuff to Log
		addtime: function(){
			Meteor.call("timestamp");
			fs.appendFile(filepath + name + "_" + filename +".txt", timestamp  + '\n', function (err) {
  				if (err) throw err;
			});
			
		}
	});

		Meteor.methods({

		//Saves test name to Server side
		naming: function(name){
			name = name.split(".",1);
			filename = name;
		}
	});

		Meteor.methods({

		//Saves username to Server side
		user: function(names){
			name = names;

		}
	});

		Meteor.methods({

		//Saves timestamp to Server side
		timestamp: function(){
			var time = Date.now();
			timestamp = time;
		}
	});

	buildSchedule();
});

function getStimJSON(fileName) {
	var future = new Future();
	Assets.getText(fileName, function(err, data){
		if (err) throw err;
		var json = XML2JS.parse(data);
		future.return(json);
	});
	return future.wait();
}


function buildSchedule() {
        	
}

