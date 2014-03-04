//////////////
//  EVENTS  //
//////////////

Template.cardTemplate.events({
	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){
			console.log("You Clicked 'Enter'");
            //get a new card
            prepareCard();
            //TODO: Log the results
			$("#answer").val("");
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
        prepareCard();
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

//determine the type of question to display
Template.cardTemplate.textCard = function() {
    return getQuestionType() === "text";
}

Template.cardTemplate.audioCard = function() {
    return getQuestionType() === "sound";
}

Template.cardTemplate.imageCard = function() {
    return getQuestionType() === "image";
}

/////////////////
//  FUNCTIONS  //
/////////////////

function prepareCard() {
    var file = Stimuli.findOne({fileName: getFileName()});
    if (file.stimuli.setspec.schedule != undefined) {
        if (Session.get("scheduleIndex") === undefined) {
            Session.set("scheduleIndex", 0); //Session var should allow for continuation of abandoned tests, but will need to be reset for re-tests
        }
        if (Session.get("scheduleIndex") === file.stimuli.setspec.schedule[0].q.length){
            alert("End of test.  Thank you.");
            cleanUp();
            Router.go("profile"); //Send user to profile after test finishes
        } else {
            scheduledCard();  
        }      
    } else {
        randomCard();    
    }
}

function cleanUp() {
    Session.set("currentQuestion", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("scheduleIndex", undefined);
}

function randomCard() {
    //get the file from the collection
    var file = Stimuli.findOne({fileName: getFileName()});
    //get the cluster size (avoids out of bounds error)
    var size = file.stimuli.setspec.clusters[0].cluster.length;
    //get a valid index
	var nextCardIndex = Math.floor((Math.random() * size));
    //set the question and answer
	Session.set("currentQuestion", file.stimuli.setspec.clusters[0].cluster[nextCardIndex].word[0]);
	Session.set("currentAnswer", file.stimuli.setspec.clusters[0].cluster[nextCardIndex].answer[0]);
}

function getQuestionType() {
    return Stimuli.findOne({fileName: getFileName()}).stimuli.setspec.groups[0].group[0].type[0];
}

function scheduledCard() {
    var index = Session.get("scheduleIndex");
    var file = Stimuli.findOne({fileName: getFileName()});
    var which = file.stimuli.setspec.schedule[0].q[index];
    Session.set("currentQuestion", file.stimuli.setspec.clusters[0].cluster[which].word[0]);
    Session.set("currentAnswer", file.stimuli.setspec.clusters[0].cluster[which].answer[0]);
    Session.set("scheduleIndex", index + 1);
}

function getFileName() {
    return Session.get("currentTest");
}
