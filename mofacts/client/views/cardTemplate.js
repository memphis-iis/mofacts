//////////////
//  EVENTS  //
//////////////

Template.cardTemplate.events({

	'focus #answer' : function() {
		start = startTimer()
	},

	'keypress #answer' : function (e) {
		
		var key=e.keyCode || e.which;
		if (key==13){

            //Gets User Response
			var result = document.getElementById('answer').value;

            //Check Correctness
            var answer = document.getElementById('testAnswer').textContent;
			var isCorrect = true;
            //---------

            //Timer
            var elapsed = new Date().getTime()-start;
            var elapsedOnRender = new Date().getTime()-startOnRender;

            //Display results
			var message = "You answered " + result + " in " + elapsed + " Milliseconds"
			console.log(message);

            //Check Correctness
            answer = answer.split(":");
            answer = answer[1].split("  ");
            answer = answer[1];

            if (result.localeCompare(answer)){
                isCorrect = false;
            }

            console.log(answer + "|" + result + "    " + isCorrect);
            //---------

            //Get question Number
            
            index = getIndex();
            
            if(index === "undefined"){
                index = "NA";
            }

            console.log(index);

            //Get whether text, audio or picture
            var QType = getQuestionType();
            if (QType == "text"){
                QType = "T";    //T for Text
            } else if (QType == "image"){
                QType = "I";    //I for Image
            } else if (QType == "sound"){
                QType = "A";    //A for Audio
            } else {
                QType = "NA";   //NA for Not Applicable
            }

            //Write to Log
            Meteor.call("writing",index + ";" + QType + ";" + result +";"+ isCorrect + ";" + elapsedOnRender + 
                ";" + elapsed + "::" );

            //Reset timer for next question
            start = startTimer();

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

Template.cardTemplate.rendered = function() {
    startOnRender = startTimer()

    document.getElementById("answer").blur();

    if(getQuestionType() === "sound"){
        console.log("Sound")
        document.getElementById('audio').play();
    }
}

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

function startTimer() {
    var start = new Date().getTime();
    return start
}

function prepareCard() {
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    if (file.stimuli.setspec.schedule != undefined) {
        if (Session.get("scheduleIndex") === undefined) {
            Session.set("scheduleIndex", 0); //Session var should allow for continuation of abandoned tests, but will need to be reset for re-tests
        }
        if (Session.get("scheduleIndex") === file.stimuli.setspec.schedule[0].q.length){
            alert("End of test.  Thank you.");

            //Add the timestamp for the End of test
            Meteor.call("addtime");

            Router.go("profile"); //Send user to profile after test finishes
        } else {
            scheduledCard();  
        }      
    } else {
        randomCard();    
    }
}

function randomCard() {
    //get the file from the collection
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    //get the cluster size (avoids out of bounds error)
    var size = file.stimuli.setspec.clusters[0].cluster.length;
    //get a valid index
	var nextCardIndex = Math.floor((Math.random() * size));
    //set the question and answer
	Session.set("currentQuestion", file.stimuli.setspec.clusters[0].cluster[nextCardIndex].word[0]);
	Session.set("currentAnswer", file.stimuli.setspec.clusters[0].cluster[nextCardIndex].answer[0]);
}

function getQuestionType() {
    console.log(getCurrentTestName());
    return Stimuli.findOne({fileName: getCurrentTestName()}).stimuli.setspec.groups[0].group[0].type[0];
}

function scheduledCard() {
    var index = Session.get("scheduleIndex");
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var which = file.stimuli.setspec.schedule[0].q[index];
    Session.set("currentQuestion", file.stimuli.setspec.clusters[0].cluster[which].word[0]);
    Session.set("currentAnswer", file.stimuli.setspec.clusters[0].cluster[which].answer[0]);
    Session.set("scheduleIndex", index + 1);
}

function getCurrentTestName() {
    return Session.get("currentTest");
}

function getIndex(){
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var ses = Session.get("currentQuestion");

    for (var i = 0; i < file.stimuli.setspec.clusters[0].cluster.length; i++) {
       var temp = file.stimuli.setspec.clusters[0].cluster[i].word[0];

       if(temp == ses){
        return i+1;
       }
    };
    
}

function recordProgress ( question, answer, userAnswer, timeSpentTyping ) {
    //TODO: Here we will insert records into the userProgress Collection.
}
