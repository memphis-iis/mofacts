var Future = Npm.require("fibers/future");

Meteor.methods({
	getStimuli: function () {
		var future = new Future();
		Assets.getText('EEGstims.xml', function(err, data){
			if (err) throw err;
			var json = XML2JS.parse(data);
			future.return(json);
		});
		return future.wait();
	}
});