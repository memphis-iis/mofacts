Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
	Session.setDefault("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].word[0]);
	Session.setDefault("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[Math.floor((Math.random() * 17))].answer[0]);
	
	function handleKeyPress(e){
		 var key=e.keyCode || e.which;
		  if (key==13){
			  //searching();
			  console.log('You Clicked "Enter"');
		  }
		}
	
}