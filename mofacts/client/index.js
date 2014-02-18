
Meteor.startup(function() {
	Meteor.call("getStimuli",
		function (err, result) {
			Session.setDefault('stimuli', result);
			//console.log(Session.get('stimuli').setspec.clusters[0].cluster[0].word[0]);
		}
	);
	
	Session.setDefault('currentTemplate', 'signUpTemplate');
});