var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");
var filename, name;


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

		writing: function(stuff){
			fs.appendFile(name + "_" + filename +".txt", stuff, function (err) {
  				if (err) throw err;
			});
		}
	});

		Meteor.methods({

		naming: function(name){
			name = name.split(".",1);
			filename = name;
		}
	});

		Meteor.methods({

		user: function(names){
			name = names;

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

