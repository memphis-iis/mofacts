Meteor.startup(function() {
	Meteor.call("getStimuli",
		function (err, result) {
			Session.setDefault('stimuli', result);
			Session.setDefault('currentQuestion', Session.get('stimuli').setspec.clusters[0].cluster[0].word[0]);
			Session.setDefault('currentAnswer', Session.get('stimuli').setspec.clusters[0].cluster[0].answer[0]);
		}
	);
});
