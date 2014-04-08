//////////////
//  EVENTS  //
//////////////

Template.cardTemplate.events({

	'focus #userAnswer' : function() {
		if(Session.get("debugging")){
            var progress = UserProgress.find({_id: Meteor.userId()});
            progress.forEach(function (user) {
                console.log(user);
            });

        }
	},
	'keypress #userAnswer' : function (e) {

		var key=e.keyCode || e.which;
		if (key==13){

            //Gets User Response
			var userAnswer = document.getElementById('userAnswer').value.toLowerCase().trim();

            //Check Correctness
            var answer = document.getElementById('answer').textContent.toLowerCase().trim();
			var isCorrect = true;
            //---------

            //Timer
            var elapsed = new Date().getTime()-start;
            var elapsedOnRender = new Date().getTime()-startOnRender;

            //Display results
            if (userAnswer === ""){
                elapsed = 0;
            }

            console.log(
			"You answered " + userAnswer + " in " + elapsed + " Milliseconds. The page was rendered for " + elapsedOnRender + " Milliseconds"
			);
            //---------

            //Check Correctness
            if (userAnswer.localeCompare(answer)) {
                isCorrect = false;
            }
            //---------

            //Get question Number
            index = getIndex();
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
            Meteor.call("writing",index + ";" + QType + ";" + userAnswer +";"+ isCorrect + ";" + elapsedOnRender + 
                ";" + elapsed + "::" );

            //record progress in UserProgress collection.
            recordProgress(index, Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer);

            calculateCardProbabilities();

            //Reset timer for next question
            start = startTimer();

            //get a new card
            prepareCard();
            
			$("#userAnswer").val("");
		}else{
            start = startTimer();
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
    startOnRender = startTimer();
    start = 0;

    //document.getElementById("answer").blur();

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
        recordCurrentTestData();
        //if we are in a modeled drill/test
        initializeActRModel();
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
    var file = Tdfs.findOne({fileName: getCurrentTdfName()});
    if (file.tdfs.tutor.schedule != undefined) {
		Session.set("isScheduledTest", true);
        if (Session.get("scheduleIndex") === undefined) {
            Session.set("scheduleIndex", 0); //Session var should allow for continuation of abandoned tests, but will need to be reset for re-tests
        }
		sched = getCurrentScheduleNumber();
		console.log("current schedule number: " + sched);
		if (file.tdfs.tutor.schedule[sched] === undefined) { //check to see if we've iterated over all schedules
			Meteor.call("addtime");
			Router.go("stats");
		}
        if (Session.get("scheduleIndex") === file.tdfs.tutor.schedule[sched].q.length){
			Session.set("scheduleIndex", 0);
			Session.set("currentScheduleNumber", sched + 1);
			
		//	Router.go("instructions");
			prepareCard();
			
			/*
            Meteor.call("addtime");
            Router.go("stats"); //Send user to stats page after test finishes
            //Add the timestamp for the End of test
            */

        }  
		
		else {
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
	Session.set("currentQuestion", getStimQuestion(nextCardIndex));
	Session.set("currentAnswer", getStimAnswer(nextCardIndex));
}

function getQuestionType() {
    return Stimuli.findOne({fileName: getCurrentTestName()}).stimuli.setspec.groups[0].group[1].type[0];
}

//get the question at this index
function getStimQuestion(index) {
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    //console.log(file.stimuli.setspec)
    var questionName = file.stimuli.setspec.groups[0].group[1].name[0];
    return file.stimuli.setspec.clusters[0].cluster[index][questionName];
}

//get the answer at this index
function getStimAnswer(index) {
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var answerName = file.stimuli.setspec.groups[0].group[0].name[0];
    return file.stimuli.setspec.clusters[0].cluster[index][answerName];
}

function scheduledCard() {
    var index = Session.get("scheduleIndex");
    var file = Tdfs.findOne({fileName: getCurrentTdfName()});
	var set = file.tdfs.tutor.schedule[0].q[index];
    var setSplit = set.split(",");
	var which = setSplit[0];
    Session.set("currentQuestion", getStimQuestion(which));
    Session.set("currentAnswer", getStimAnswer(which));
    Session.set("scheduleIndex", index + 1);
}

function getCurrentTestName() {
    return Session.get("currentTest");
}

function getCurrentScheduleNumber() {
	return Session.get("currentScheduleNumber");
}

function getCurrentTdfName() {
	return Session.get("currentTdfName");
}

function getIndex(){
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var currentQ = Session.get("currentQuestion");

    for (var i = 0; i < file.stimuli.setspec.clusters[0].cluster.length; i++) {
       var tempQ = getStimQuestion(i);

        if(tempQ.toString() == currentQ.toString()){
            return i+1;
        }
    };
    
}

function recordProgress ( questionIndex, question, answer, userAnswer ) {

    if (Meteor.userId() !== null) {

        //add to the progressDataArray
        UserProgress.update(
            { _id: Meteor.userId() },
            { $push: 
                { progressDataArray :  
                    {
                          questionIndex: questionIndex
                        , question: question
                        , answer: answer
                        , userAnswer: userAnswer
                    }  
                }
            }
        );

    }  
}

function recordCurrentTestData() {

    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var currentTestMode;

    if (file.stimuli.setspec.schedule != undefined) {
        currentTestMode = "BASIC SCHEDULE";
    } else {
        currentTestMode = "RANDOM";
    }

    if (Meteor.userId() !== null) {

        //update the currentTest and mode
        UserProgress.update(
            { _id: Meteor.userId() }, //where _id === Meteor.userId()
            { $set: 
                {                  //set the current test and mode, and then clear the progress array.
                      currentStimuliTest: getCurrentTestName()
                    , currentTestMode: currentTestMode
                    , progressDataArray: []
                }
            }
        );
    }
}

function initializeActRModel() {
    //TODO: IWB - 4/8/2014 This is where the cardProbabilities collection will be initialized.
    cardProbabilities.insert({
                                  _id: Meteor.userId()
                                , probabilitiesArray: []
                            });
}

function calculateCardProbabilities() {

    //TODO: IWB - 03/30/2014: still need to get actual values for these variables.
    //TODO: IWB - 04/02/2014: may need an entire collection to keep track of these variables.

    // var questionSuccessCount = 0;
    // var questionFailureCount = 0;
    // var totalQuestionStudies = questionSuccessCount + questionFailureCount;
    // var trialsSinceLastSeen = 0;
    // var totalTrials = 0;

    // var x = -3.0 + (2.4 * questionSuccessCount) + (0.8 * questionFailureCount) + totalQuestionStudies - (0.3 * totalTrials);

    // var probability = 1.0/( 1.0 + Math.pow(Math.E, -x) );
}

function getNextCard() {

    //TODO: IWB - 3/30/2014: still need to get actual values for these variables.

    var numItemsPracticed = 0;

    if (numItemsPracticed === 0) {
        //introduce new card.  (#2 in the algorithm)
    } else {
        //var currentMaxProbabilityForSelection = 0;
        //var currentLowestProbability = 1; //maximum probability of 1 or 100%
        //var cardWithLowestProbability = null;
        //var cardToShowNext = null;
        //var numCardsChecked = 0;
        //var numCardsBelow85 = 0;

        // forEach( card ) {
        //     numCardsChecked++;
        //
        //     if (card.probability < currentLowestProbability) {
        //            cardWithLowestProbability = card;
        //            currentLowestProbability = card.probability;
        //     }
        //     
        //     if (card.probability < 0.85) {
        //         numCardsBelow85++;
        //         if (card.probability > currentMaxProbabilityForSelection) {
        //             if (card.trialsSinceLastSeen > 2) {
        //
        //                 (#3 in the algorithm)
        //
        //                 currentMaxProbabilityForSelection = card.probability;
        //                 cardToShowNext = card;
        //
        //             }
        //         }
        //     }
        //
        //     if(numCardsChecked === totalNumberOfCards) {
        //         if (cardToShowNext === null) {
        //
        //             (#5 in the algorithm)
        //
        //             cardToShowNext = cardWithLowestProbability;
        //             //display some help text about overlearning.
        //         }
        //     } else if (numCardsBelow85 === 0) {
        //          
        //          (#4 in the algorithm)
        //      
        //          //introduce a new card
        //     }
        // }

    }



}
