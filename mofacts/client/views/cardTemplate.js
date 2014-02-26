Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
	randomCard();
}

function randomCard() {
	Session.setDefault("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].word[0]);
	Session.setDefault("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].answer[0]);

}

function startTimer() {
	var start = new Date().getTime();
	return start
}

Template.cardTemplate.events({

	'focus #answer' : function() {
		start = startTimer()
	},

	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){
			var result = document.getElementById('answer').value;
			var elapsed = new Date().getTime()-start;

			console.log("You answered " + result + " in " + elapsed + " Milliseconds");
		}
	}
});
