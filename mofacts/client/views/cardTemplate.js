//////////////
//  EVENTS  //
//////////////

Template.cardTemplate.events({
	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){
			console.log("You Clicked 'Enter'");
            //get a new card
            randomCard();
            //TODO: Log the results
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

/////////////////
//  VARIABLES  //
/////////////////

Template.cardTemplate.invokeAfterLoad = function() {
	console.log('card loaded');
    //the card loads frequently, but we only want to set this the first time
    if(Session.get("currentQuestion") == undefined){
        randomCard();
    }
}

Template.cardTemplate.username = function () {
	if (typeof Meteor.user() === "undefined") {
        Router.go("signin");
        window.location.reload();
        //the reload is needed because for some reason the page contents show up as
        //empty unless we do the reload.
        return;
    } else {
    	return Meteor.user().username;
    }
}

/////////////////
//  FUNCTIONS  //
/////////////////

function randomCard() {
	var nextCardIndex = Math.floor((Math.random() * 17));
	Session.set("currentQuestion", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[nextCardIndex].word[0]);
	Session.set("currentAnswer", Stimuli.findOne({fileName: "EEGstims.xml"}).stimuli.setspec.clusters[0].cluster[nextCardIndex].answer[0]);
}

function scheduledCard(index) {
      	
}
