Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
	Session.setDefault("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].word[0]);
	Session.setDefault("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].answer[0]);
	
}