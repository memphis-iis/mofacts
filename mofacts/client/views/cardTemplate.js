Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
	randomCard();
}

function randomCard() {
	Session.setDefault("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].word[0]);
	Session.setDefault("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].answer[0]);

}

Template.cardTemplate.events({
	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){
			console.log("You Clicked 'Enter'");
		}
	}
});

Template.cardTemplate.username = function () {
	return Meteor.user().username;
}
