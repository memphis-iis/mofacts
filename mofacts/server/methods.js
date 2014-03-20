var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");

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
			fs.appendFile('log.txt', stuff, function (err) {
  				if (err) throw err;
			});
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

