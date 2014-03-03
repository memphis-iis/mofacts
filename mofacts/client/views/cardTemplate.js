Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
	randomCard();
}

function randomCard() {
	var nextCardIndex = Math.floor((Math.random() * 17));
	Session.setDefault("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[nextCardIndex].word[0]);
	Session.setDefault("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[nextCardIndex].answer[0]);
}

Template.cardTemplate.events({
	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){
			console.log("You Clicked 'Enter'");
		}
	},
	'click .logoutLink' : function () {
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User: " + Meteor.user() +" \n" +
                            "\tError: " + error + "\n");
            } else {
                Router.go("signin");
            }
        });
    },
    'click .homeLink' : function () {
        Router.go("profile");
    }
});

Template.cardTemplate.username = function () {
	return Meteor.user().username;
}
