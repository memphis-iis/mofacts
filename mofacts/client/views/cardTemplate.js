//////////////
//  EVENTS  //
//////////////

var timeoutName;
var timeoutCount = -1;
var permuted = [];

Template.cardTemplate.events({

	'focus #userAnswer' : function() {
		if(Session.get("debugging")){
            // var progress = UserProgress.find({_id: Meteor.userId()});
            // progress.forEach(function (user) {
            //     console.log(user);
            // });

            var probabilities = CardProbabilities.find({_id: Meteor.userId()});
            probabilities.forEach( function (prob) {
                console.log(prob);
            });
        }
	},
	'keypress #userAnswer' : function (e) {
        handleUserInput( e , "keypress");
        
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
    },

    'click .statsPageLink' : function () {
        Router.go("stats");
    },

    'click #overlearningButton' : function () {
        Router.go("profile");
    },
    'click .multipleChoiceButton' : function (event) {
        handleUserInput( event , "buttonClick");
    }
});

Template.cardTemplate.rendered = function() {


    if ( Session.get("isScheduledTest") ) {

        var scheduleNumber = getCurrentScheduleNumber();
        //question index = sheduleIndex -1 because it has already been incremented for the next card at this point.
        var questionIndex = Session.get("scheduleIndex") - 1;

        var file = Tdfs.findOne({fileName: getCurrentTdfName()});

        console.log(file);

        if (file.tdfs.tutor.schedule[scheduleNumber].q[questionIndex].choices != undefined) {
            //check if the schedule's question tags have choices tags

            $("#textEntryRow").hide();
            $("#multipleChoiceInnerContainer").remove();

            $("#multipleChoiceContainer").append(
                "<div id=\"multipleChoiceInnerContainer\"></div>"
            );

            var allChoices = file.tdfs.tutor.schedule[scheduleNumber].q[questionIndex].choices[0];
            var choicesArray = allChoices.split(",");

            for (var i = 0; i < choicesArray.length; ++i) {
                var buttonParts = choicesArray[i].split(":");
                var label = buttonParts[0];
                var value = buttonParts[1];

                //insert the real answer for this dummy value from the tdf.
                if(value == "the_answer") {
                    value = Session.get("currentAnswer");
                }

                //insert all of the multiple choice buttons with the appropriate values.
                $("#multipleChoiceInnerContainer").append(
                    "<div class=\"col-lg-6\">" +
                        "<button type=\"button\" name=\"" + value + "\" class=\"btn btn-primary btn-block multipleChoiceButton\">" +
                            label + ": " + value + 
                        "</button>" +
                    "</div>"
                );
            }
        }
    }

    startOnRender = startTimer();
    start = 0;

    //for debugging, allow one to turn on or off the timeout code.
    //Note to Future Self : Look up clearTimeout(timeoutObject);

    //console.log("Index: " + getIndex());

    var AllowTimeouts = true;

    if(AllowTimeouts){
        timeoutCount++;
        var counter = UserProgress.find(
            { _id: Meteor.userId() },
            {progressDataArray: 1});

        counter.forEach(function (Object){
            length = Object.progressDataArray.length;
        });

        timeoutfunction(length, timeoutCount);
    }

    if(getQuestionType() === "sound"){
        console.log("Sound")
        document.getElementById('audio').play();
    }


    if (Session.get("showOverlearningText") == true) {
        $("#overlearningRow").show();
    }

}

/////////////////
//  VARIABLES  //
/////////////////

Template.cardTemplate.invokeAfterLoad = function() {
	
    if(Session.get("debugging")) {
        console.log('card loaded');
    }

    var file = Tdfs.findOne({fileName: getCurrentTdfName()});
   
    //the card loads frequently, but we only want to set this the first time
    if(Session.get("currentQuestion") == undefined){

        //check if tutor.setspec.isModeled is defined in the tdf
        if (file.tdfs.tutor.setspec[0].isModeled != undefined) {
            //if it is defined and is set to true, use the ACT-R Model methods.
            if (file.tdfs.tutor.setspec[0].isModeled == "true") {
                Session.set("usingACTRModel",true);
                initializeActRModel();
            } else {
                Session.set("usingACTRModel",false);
            }
        }
        
        
        prepareCard();
        recordCurrentTestData();
        Session.set("showOverlearningText", false);
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

//determine the type of question to display
Template.cardTemplate.test = function() {
    return getTestType() === "t";
}

Template.cardTemplate.study = function() {
    return getTestType() === "s";
}

Template.cardTemplate.drill = function() {
    return getTestType() === "d";
}

/////////////////
//  FUNCTIONS  //
/////////////////

function handleUserInput( e , source ) {


    //for debugging, allow one to turn on or off the UserInteraction code.
    var AllowUserInteraction = true;

    if ( source === "keypress") {
        var key=e.keyCode || e.which;
    } else if ( source === "buttonClick") {
        //to save space we will just go ahead and act like it was a key press.
        var key = 13;
    }
    
    if (key==13){

        //Gets User Response
        clearTimeout(timeoutName);

        var userAnswer;
        if ( source === "keypress") {
            userAnswer = document.getElementById('userAnswer').value.toLowerCase().trim();
        } else if ( source === "buttonClick") {
            userAnswer = e.target.name;
        }

        //Check Correctness
        var answer = Session.get("currentAnswer")[0].toLowerCase().trim();
        var isCorrect = true;
        //---------

        //Timer
        var elapsed = new Date().getTime()-start

        var elapsedOnRender = new Date().getTime()-startOnRender;

        //Display results
        if (userAnswer === "" || source === "buttonClick"){
            elapsed = 0;
        }

        console.log(
        "You answered " + userAnswer + " in " + elapsed + " Milliseconds. The page was rendered for " + elapsedOnRender + " Milliseconds"
        );
        //---------

        //Display Correctness
        if ( getTestType() !== "s" ) {
            userAnswer = userAnswer.toLowerCase().trim();
            answer = answer.toLowerCase().trim();

            if (userAnswer.localeCompare(answer)) {
                isCorrect = false;
                if (Session.get("isModeled")) {
                    incrementCurentQuestionsFailed();
                }
                if (getTestType() === "d") {
                    $("#UserInteraction").append("<font color= \"black\"> You are Incorrect." + " The correct answer is : " + answer +"</font>");
                }
            } else {
                if (Session.get("isModeled")) {
                    incrementCurrentQuestionSuccess();
                }
                if (getTestType() === "d") {
                    $("#UserInteraction").append("<font color= \"black\">You are Correct. " + "Great Job</font>");
                }
            }
        }
        //---------

        //Get question Number
        index = getIndex();

        //Get whether text, audio or picture
        QType = findQTypeSimpified();
        if(source === "buttonClick"){
            //Assuming a multiple choice question if a button is clicked for an answer
            //add "Mc" to the log to differentiate normal questions from multiple choices ones in the log
            QType = "Mc"+QType;
        }

        //Gets the types type; study, drill, or test
        var TType = getTestType();

        //Write to Log
        Meteor.call("writing",index + ";" + TType + ";" + QType + ";" + userAnswer +";"+ isCorrect + ";" + elapsedOnRender + 
            ";" + elapsed + "::" );

        //record progress in UserProgress collection.
        recordProgress(index, Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer);

        if (Session.get("isModeled")) {
            incrementNumQuestionsAnswered();
            calculateCardProbabilities();
        }

        //Reset timer for next question
        start = startTimer();

        //timeout for adding a small delay so the User may read the correctness of his/her anwser
        //Reveals Answer
        if(AllowUserInteraction){
            $("#UserInteraction").show();

            Meteor.setTimeout(function(){

                //get a new card
                prepareCard();

                $("#userAnswer").val("");
            },1000);
            //---------------

        }else{
            prepareCard();

            $("#userAnswer").val("");
        }   
    }else{
        start = startTimer();
    }
}




function startTimer() {
    var start = new Date().getTime();
    return start
}

function prepareCard() {

    var file = Tdfs.findOne({fileName: getCurrentTdfName()});

    
    if (Session.get("usingACTRModel")) {
        getNextCardActRModel();
        return;
    }
    

    if (file.tdfs.tutor.schedule != undefined) {
		Session.set("isScheduledTest", true);
        if (Session.get("scheduleIndex") === undefined) {
            Session.set("scheduleIndex", 0); //Session var should allow for continuation of abandoned tests, but will need to be reset for re-tests
            //Session.set("currentScheduleNumber",0);
        }
		sched = getCurrentScheduleNumber();
		if (Session.get("scheduleIndex") === 0 &&  file.tdfs.tutor.schedule[sched].permute[0] !== undefined){
		    permuted = permute(file.tdfs.tutor.schedule[sched].permute[0]); //If we're using permutations, permute the specified groups/items

		}
		console.log("current schedule number: " + sched);
		if (file.tdfs.tutor.schedule[sched] === undefined) { //check to see if we've iterated over all schedules
			Router.go("stats");
		}
        if (Session.get("scheduleIndex") === file.tdfs.tutor.schedule[sched].q.length){
            //if we are at the end of this schedule
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
        Session.set("isScheduledTest", false);
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
    console.log("scheduleIndex...");

    var questionIndex = Session.get("scheduleIndex");
    var scheduleIndex = getCurrentScheduleNumber();
	var questionNumber;
	if (permuted.length > 0){ //If we're using permutations, get index by perm array value (get the permuted item)
		questionNumber = permuted[questionIndex];
	}
	else {
		questionNumber = questionIndex;
	}
    var file = Tdfs.findOne({fileName: getCurrentTdfName()});
	var info = file.tdfs.tutor.schedule[scheduleIndex].q[questionNumber].info[0]; //get the text out of the object with [0]

    var splitInfo = info.split(",");
	
    //get the type of test (drill, test, study)
    Session.set("testType", splitInfo[1]);
    Session.set("currentQuestion", getStimQuestion(splitInfo[0]));
    Session.set("currentAnswer", getStimAnswer(splitInfo[0]));
    Session.set("scheduleIndex", questionIndex + 1);

    console.log("...scheduleIndex");
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
            return i;
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
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var numQuestions = file.stimuli.setspec.clusters[0].cluster.length;

    //update the cards array to be empty
    CardProbabilities.update(
        { _id: Meteor.userId() },
        { $set: 
            {
                  numQuestionsAnswered: 0
                , numQuestionsIntroduced: 0
                , cardsArray: [] 
            }
        }
    );
    //load all of the cards into the cards array.
    for (var i = 0; i < numQuestions; ++i) {
        CardProbabilities.update(
            { _id: Meteor.userId() },
            { $push:
                { cardsArray :
                    {
                          question: getStimQuestion(i)
                        , answer: getStimAnswer(i)
                        , questionSuccessCount: 0
                        , questionFailureCount: 0
                        , trialsSinceLastSeen: 0
                        , probability: 0
                        , hasBeenIntroduced: false
                    }  
                }
            }
        );
    };

    //has to be done once ahead of time to give valid values for the beginning of the test.
    calculateCardProbabilities();
}

function incrementNumQuestionsAnswered() {
    CardProbabilities.update(
        { _id: Meteor.userId() },
        { $inc: { numQuestionsAnswered: 1 } }
    );
}

function incrementCurrentQuestionSuccess() {
    var incModifier = {$inc: {}};
    incModifier.$inc["cardsArray." + (getIndex()) + ".questionSuccessCount"] = 1;
    CardProbabilities.update({ _id: Meteor.userId() }, incModifier);
}

function incrementCurentQuestionsFailed() {
    var incModifier = {$inc: {}};
    incModifier.$inc["cardsArray." + (getIndex()) + ".questionFailureCount"] = 1;
    CardProbabilities.update({ _id: Meteor.userId() }, incModifier);
}

function resetTrialsSinceLastSeen( index ) {
    var setModifier = {$set: {}};
    setModifier.$set["cardsArray." + index + ".trialsSinceLastSeen"] = 0;
    CardProbabilities.update({ _id: Meteor.userId() }, setModifier);
}

function setHasBeenIntroducedFlag( index ) {
    var setModifier = {$set: {}};
    setModifier.$set["cardsArray." + index + ".hasBeenIntroduced"] = true;
    CardProbabilities.update({ _id: Meteor.userId() }, setModifier);
}

function setNextCardInfo( index ) {
    var cardProbs = CardProbabilities.findOne({ _id: Meteor.userId() });
    Session.set("currentQuestion", cardProbs.cardsArray[index].question);
    Session.set("currentAnswer", cardProbs.cardsArray[index].answer);
    resetTrialsSinceLastSeen(index);
    setHasBeenIntroducedFlag(index);
}

function incrementNumQuestionsIntroduced() {
    CardProbabilities.update(
        {_id: Meteor.userId()},
        { $inc: { numQuestionsIntroduced: 1 } }
    );
}

function getNumQuestionsIntroduced() {
    var cardProbs = CardProbabilities.findOne({ _id: Meteor.userId()});
    console.log(cardProbs);
    return cardProbs.numQuestionsIntroduced;
}

function getNumCardsBelow85( cardsArray ) {
    var counter = 0;
    for (var i = 0; i < cardsArray.length; ++i) {
        if (cardsArray[i].probability < 0.85) {
            ++counter;
        }
    };
    return counter;
}

function calculateCardProbabilities() {

    if (Session.get("debugging")) {
        console.log("calculating card probabilities...");
    }
    //TODO: IWB - 03/30/2014: still need to get actual values for these variables.
    //TODO: IWB - 04/02/2014: may need an entire collection to keep track of these variables.

    var cardProbs = CardProbabilities.findOne({ _id: Meteor.userId() });

    for(var i = 0; i < cardProbs.cardsArray.length; ++i) {

        var questionSuccessCount = cardProbs.cardsArray[i].questionSuccessCount;
        var questionFailureCount = cardProbs.cardsArray[i].questionFailureCount;
        var totalQuestionStudies = questionSuccessCount + questionFailureCount;
        var trialsSinceLastSeen = cardProbs.cardsArray[i].trialsSinceLastSeen;
        var totalTrials = cardProbs.numQuestionsAnswered;
        var trialsSinceLastSeenOverTotalTrials;

        if (totalTrials !== 0) { // can't devide by 0
            trialsSinceLastSeenOverTotalTrials = trialsSinceLastSeen/totalTrials;
        } else {
            trialsSinceLastSeenOverTotalTrials = 0;
        }

        var x = -3.0 + (2.4 * questionSuccessCount) + (0.8 * questionFailureCount) + totalQuestionStudies - (0.3 * trialsSinceLastSeenOverTotalTrials);
        var probability = 1.0/( 1.0 + Math.pow(Math.E, -x) );

        //set probability
        var setModifier = {$set: {}};
        setModifier.$set["cardsArray." + i + ".probability"] = probability;
        CardProbabilities.update({ _id: Meteor.userId() }, setModifier);
        
        //increment trialsSinceLastSeen
        var incModifier = {$inc: {}};
        incModifier.$inc["cardsArray." + i + ".trialsSinceLastSeen"] = 1;
        CardProbabilities.update({ _id: Meteor.userId() }, incModifier);
    }

    if (Session.get("debugging")) {
        console.log("...done calculating card probabilities.");
    }
}

function getNextCardActRModel() {

    if (Session.get("debugging")) {    
        console.log("getting next card...");
    }
    Session.set("testType", "t");

    var numItemsPracticed = CardProbabilities.findOne({ _id: Meteor.userId() }).numQuestionsAnswered;
    var cardsArray = CardProbabilities.findOne({ _id: Meteor.userId() }).cardsArray;

    if (numItemsPracticed === 0) {
        //introduce new card.  (#2 in the algorithm)
        var indexForNewCard = getIndexForNewCardToIntroduce( cardsArray );

        if (indexForNewCard === -1) {
            if (Session.get("debugging")) {
                console.log("ERROR: All cards have been introduced, but numQuestionsAnswered === 0");
            }
        } else {
            introduceNextCard(indexForNewCard);
        }

        if (Session.get("debugging")) {    
            console.log("...got next card #2");
        }
        
        return;
    } else {
        
        var nextCardIndex = selectHighestProbabilityAlreadyIntroducedCardLessThan85(cardsArray);

        if ( nextCardIndex !== -1) {
            //number 3 in the algorithm
            setNextCardInfo(nextCardIndex);

            if (Session.get("debugging")) {    
                console.log("...got next card #3");
            }

        } else {
            //numbers 4 and 5 in the algorithm.

            if (getNumCardsBelow85(cardsArray) === 0 && getNumQuestionsIntroduced() === cardsArray.length) {
                //number 5 in the algorithm.
                var indexForNewCard = selectLowestProbabilityCardIndex(cardsArray);
                introduceNextCard( indexForNewCard );

                Session.set("showOverlearningText", true);

                if (Session.get("debugging")) {    
                    console.log("...got next card #5");
                }

            } else {
                //number 4 in the algorithm.
                var indexForNewCard = getIndexForNewCardToIntroduce(cardsArray);

                if (indexForNewCard === -1) {
                    //if we have introduced all of the cards.
                    indexForNewCard = selectLowestProbabilityCardIndex(cardsArray);
                    introduceNextCard( indexForNewCard );
                } else {
                    introduceNextCard(indexForNewCard);
                }

                if (Session.get("debugging")) {    
                    console.log("...got next card #4");
                }
                
            }
        } 

    }
}

function getIndexForNewCardToIntroduce( cardsArray ) {

    if (Session.get("debugging")) {
        console.log("getting index for new card to introduce.");
    }

    var indexToReturn = -1;

    for(var i = 0; i < cardsArray.length; ++i) {
        if (cardsArray[i].hasBeenIntroduced === false) {
            indexToReturn = i;
        }
    }

    if (Session.get("debugging")) {
        var message = "";
        if (indexToReturn === -1) {
            message = "All cards have been introduced!";
        } else {
            message = "about to introduce " + indexToReturn;
        }
        console.log(message);
    }

    if (indexToReturn !== -1) {
        // we introduced a new card.
        incrementNumQuestionsIntroduced();
    }

    return indexToReturn;
}

function introduceNextCard( index ) {
    if (Session.get("debugging")) {
        console.log("introducing next Card with index: " + index);
    }
    setNextCardInfo(index);
}

function selectHighestProbabilityAlreadyIntroducedCardLessThan85 ( cardsArray ) {
    if (Session.get("debugging")) {
        console.log("selectHighestProbabilityAlreadyIntroducedCardLessThan85");
    }
    var currentMaxProbabilityLessThan85 = 0;
    var indexToReturn = -1;

    for (var i = 0; i < cardsArray.length; ++i) {

        if (cardsArray[i].hasBeenIntroduced === true && cardsArray[i].trialsSinceLastSeen > 2) {

            if (cardsArray[i].probability > currentMaxProbabilityLessThan85 && cardsArray[i].probability < 0.85) {
                currentMaxProbabilityLessThan85 = cardsArray[i].probability;
                indexToReturn = i;
            }      
        }
    };

    if (Session.get("debugging")) {
        var message;
        if (indexToReturn === -1) {
            message = "no cards less than .85 already introduced.";
        } else {
            message = "indexToReturn: " + indexToReturn;
        }
        console.log(message);
    }

    return indexToReturn;
}

function selectLowestProbabilityCardIndex( cardsArray ) {

    if (Session.get("debugging")) {
        console.log("selectLowestProbabilityCard");
    }

    var currentMinProbability = 1;
    var indexToReturn = 0;

    for (var i = 0; i < cardsArray.length; ++i) {
        if (cardsArray[i].probability < currentMinProbability  && cardsArray[i].trialsSinceLastSeen > 2) {
            currentMinProbability = cardsArray[i].probability;
            indexToReturn = i;
        }
    };

    if (Session.get("debugging")) {
        console.log("indexToReturn: " + indexToReturn);
    }

    return indexToReturn;
}

function timeoutfunction(index, timeoutNum){

    var counter = UserProgress.find(
        { _id: Meteor.userId() },
        {progressDataArray: 1});

    counter.forEach(function (Object){
        length = Object.progressDataArray.length;
    });

    //needs to be in tdf someday
    //the timeout in Seconds is multipled by 1000 to conver to milliseconds
    
    var file = Tdfs.findOne({fileName: getCurrentTdfName()});
    var tis = file.tdfs.tutor.setspec[0].timeoutInSeconds[0];
    
    var delay = tis * 1000;

    timeoutName = Meteor.setTimeout(function(){

            if(index === length && timeoutNum > 0){
                console.log("TIMEOUT "+timeoutCount+": " + index +"|"+length);

                Meteor.call("writing",getIndex() + ";" + 
                    findQTypeSimpified() + ";" + "[TIMEOUT]" +";"+ "false" + ";" + delay + 
                    ";" + 0 + "::" );

                recordProgress(getIndex(), Session.get("currentQuestion"), Session.get("currentAnswer"), "[TIMEOUT]");

                if (Session.get("isModeled")) {
                    incrementCurentQuestionsFailed();
                    incrementNumQuestionsAnswered();
                    calculateCardProbabilities();
                }
                

                prepareCard();
            }else{
                //Do Nothing
            }

            
    }, delay);
}

function findQTypeSimpified(){

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

    return QType;
}

function getTestType(){
    return Session.get("testType");
}

function permute (perms) {
    var final_perm = []
    var groups = perms.split("|");
    for(i=0; i < groups.length; i++){

        var indexSets = groups[i].split(",");
        permutedArray = shuffle(indexSets);
        for(j=0; j < permutedArray.length; j++){
            final_perm.push(permutedArray[j]);
          
        }
    }
    return final_perm;
}

function shuffle(array) {
  var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

  while (0 !== currentIndex) {

    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
