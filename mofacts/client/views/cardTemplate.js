//TODO: we should be going back to instructions for each unit - and we
//      should be able to handle instruction-only units

//TODO: levenshtein distance for fill-in-the-blank still missing


////////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

var permuted = [];

function clearCardPermuted() {
    permuted = [];
}

var timeoutName = null;
var timeoutCount = -1;

//Note that this isn't just a convenience function - it should be called
//before we route to other templates so that the timeout doesn't fire over
//and over
function clearCardTimeout() {
    if (!!timeoutName) {
        try {
            Meteor.clearTimeout(timeoutName);
        }
        catch(e) {
            console.log("Error clearing meteor timeout", e, timeoutName);
        }
    }
    timeoutName = null;
}

////////////////////////////////////////////////////////////////////////////
// Events

Template.cardTemplate.events({

    'focus #userAnswer' : function() {
        if(Session.get("debugging")){
            //var probabilities = CardProbabilities.find({_id: Meteor.userId()});
            //probabilities.forEach( function (prob) {
            //    console.log(prob);
            //});
        }
    },

    'keypress #userAnswer' : function (e) {
        handleUserInput( e , "keypress");
    },

    'click .logoutLink' : function (event) {
        Meteor.logout( function (error) {
            event.preventDefault();
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User:" + Meteor.user() +" ERROR:" + error);
            }
            else {
                clearCardTimeout();
                Router.go("/signin");
            }
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        clearCardTimeout();
        Router.go("/profile");
    },

    'click .statsPageLink' : function (event) {
        event.preventDefault();
        clearCardTimeout();
        statsPageTemplateUpdate(); //In statsPageTemplate.js
        Router.go("/stats");
    },

    'click #overlearningButton' : function (event) {
        event.preventDefault();
        clearCardTimeout();
        Router.go("/profile");
    },

    'click .multipleChoiceButton' : function (event) {
        event.preventDefault();
        handleUserInput( event , "buttonClick");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers and meteor events

Template.cardTemplate.rendered = function() {
    newQuestionHandler();
};

Template.cardTemplate.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            clearCardTimeout();
            Router.go("signin");
        }
        else {
            return Meteor.user().username;
        }
    },

    textCard: function() {
        return getQuestionType() === "text";
    },

    audioCard: function() {
        return getQuestionType() === "sound";
    },

    imageCard: function() {
        return getQuestionType() === "image";
    },

    test: function() {
        return getTestType() === "t";
    },

    study: function() {
        return getTestType() === "s";
    },

    drill: function() {
        return getTestType() === "d";
    },

    invokeAfterLoad: function() {
        if(Session.get("debugging")) {
            console.log('card loaded');
        }

        //the card loads frequently, but we only want to set this the first time
        if(typeof Session.get("currentQuestion") === "undefined") {
            console.log("invokeAfterLoad => Performing init");
            //Clear anby previous permutation and/or timeout call
            clearCardTimeout();
            clearCardPermuted();

            var file = getCurrentTdfFile();

            //check if tutor.setspec.isModeled is defined in the tdf
            if (typeof file.tdfs.tutor.setspec[0].isModeled !== "undefined") {
                //if it is defined and is set to true, use the ACT-R Model methods.
                if (file.tdfs.tutor.setspec[0].isModeled == "true") {
                    Session.set("usingACTRModel",true);
                    initializeActRModel();
                } else {
                    Session.set("usingACTRModel",false);
                }
            }

            //Before the below options, reset current test data
            resetCurrentTestData();

            prepareCard();
            Session.set("showOverlearningText", false);
        }
    },
});


////////////////////////////////////////////////////////////////////////////
// Implementation functions

function newQuestionHandler() {
    console.log("NQ handler");
    $("#userAnswer").focus();

    if ( Session.get("isScheduledTest") ) {
        var unitNumber = getCurrentUnitNumber();
        //question index = session's questionIndex -1 because it has already been incremented for the next card at this point.
        var questionIndex = Session.get("questionIndex") - 1;

        var file = getCurrentTdfFile();

        console.log(file + "is a scheduled test");

        var currUnit = file.tdfs.tutor.unit[unitNumber];

        if (currUnit.buttontrial && currUnit.buttontrial.length && currUnit.buttontrial[0] === "true") {
            $("#textEntryRow").hide();
            $("#multipleChoiceInnerContainer").remove();

            $("#multipleChoiceContainer").append(
                "<div id=\"multipleChoiceInnerContainer\"></div>"
            );

            var cluster = getStimCluster(getCurrentClusterIndex());

            //are we using specified choice order for buttons?
            //Or do we get them from the cluster?
            var buttonOrder = getCurrentTdfButtonOrder();
            var choicesArray = [];

            if (buttonOrder.length > 0) {
                //Top-level specification for buttons
                choicesArray = buttonOrder;
            }
            else {
                //Get from cluster
                if (cluster.falseResponse && cluster.falseResponse.length) {
                    _.each(cluster.falseResponse, function(ele) {
                        choicesArray.push(ele);
                    });
                }

                if (choicesArray.length < 1) {
                    //Whoops - they didn't specify any alternate choices
                    console.log("A button trial requires some false responses");
                    currUnit.buttontrial = false;
                    newQuestionHandler(); //RECURSE
                    return;
                }

                //Currently we only show 5 option button trials - so we only
                //use 4 false responses
                if (choicesArray.length > 3) {
                    Helpers.shuffle(choicesArray);
                    choicesArray = choicesArray.splice(0, 5);
                }

                //Need to make sure they also have a correct option :)
                choicesArray.push(Session.get("currentAnswer"));
                Helpers.shuffle(choicesArray);
            }

            //insert all of the multiple choice buttons with the appropriate values.
            _.each(choicesArray, function(value, idx) {
                $("#multipleChoiceInnerContainer").append(
                    "<div class=\"col-lg-9\">" +
                    "<button type=\"button\" name=\"" + value + "\" class=\"btn btn-primary btn-block multipleChoiceButton\">" +
                    value +
                    "</button>" +
                    "</div>"
                );
            });
        }
        else {
            //Not a button trial
            $("#textEntryRow").show();
            $("#multipleChoiceInnerContainer").remove();
        }
    }

    startOnRender = getCurrentTimer();
    start = startOnRender; //Will be reset if they are typing, but not for button trials

    //for debugging, allow one to turn on or off the timeout code.

    var AllowTimeouts = true;

    if(AllowTimeouts){
        timeoutCount++;
        var counter = UserProgress.find(
            { _id: Meteor.userId() },
            {progressDataArray: 1});

        counter.forEach(function (Object){
            length = Object.progressDataArray.length;
        });

        timeoutfunction(length);
    }

    if(getQuestionType() === "sound"){
        var sound = new Howl({
            urls: [Session.get("currentQuestion") + '.mp3', Session.get("currentQuestion") + '.wav']
        }).play();
    }

    if (Session.get("showOverlearningText")) {
        $("#overlearningRow").show();
    }

    //All ready - time to allow them to enter data
    allowUserInput();
}

function handleUserInput( e , source ) {
    var key;
    if (source === "keypress") {
        key = e.keyCode || e.which;
    }
    else if (source === "buttonClick") {
        //to save space we will just go ahead and act like it was a key press.
        key = 13;
    }

    //If we haven't seen the correct keypress, then we want to start the timer
    //and leave
    if (key != 13) {
        start = getCurrentTimer();
        return;
    }

    //Stop current timeout and stop user input
    stopUserInput();
    clearCardTimeout();

    var userAnswer;
    if (source === "keypress") {
        userAnswer = Helpers.trim($('#userAnswer').val()).toLowerCase();
    }
    else if ( source === "buttonClick") {
        userAnswer = e.target.name;
    }

    //Check Correctness
    var answer = Helpers.trim(Session.get("currentAnswer").toLowerCase());
    var isCorrect = true;

    //Timer stats
    var nowTime = getCurrentTimer();
    var elapsed = nowTime - start;
    var elapsedOnRender = nowTime - startOnRender;

    //Reset elapsed for blank answer or button click?
    if (userAnswer === "" || source === "buttonClick"){
        elapsed = 0;
    }

    //Display Correctness
    if ( getTestType() !== "s" ) {
        userAnswer = Helpers.trim(userAnswer.toLowerCase());
        answer = Helpers.trim(answer.toLowerCase());

        if (userAnswer.localeCompare(answer)) {
            isCorrect = false;
            if (getTestType() === "d") {
                showUserInteraction(false, "You are Incorrect. The correct answer is : " + answer);
            }
            if (Session.get("usingACTRModel")) {
                incrementCurentQuestionsFailed();
            }
        }
        else {
            if (getTestType() === "d") {
                showUserInteraction(true, "Correct - Great Job!");
            }
            if (Session.get("usingACTRModel")) {
                incrementCurrentQuestionSuccess();
            }
        }
    }
    //---------

    //Get question Number
    var index = getCurrentClusterIndex();

    recordUserTime("answer", {
        index: index,
        ttype: getTestType(),
        qtype: findQTypeSimpified(),
        guiSource: source,
        answer: userAnswer,
        isCorrect: isCorrect,
        elapsedOnRender: elapsedOnRender,
        elapsed: elapsed
    });

    //record progress in UserProgress collection.
    recordProgress(index, Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer);

    if (Session.get("usingACTRModel")) {
        incrementNumQuestionsAnswered();
        console.log("handle user input called");
        calculateCardProbabilities();
    }

    //Reset timer for next question
    start = getCurrentTimer();

    //Whether timed or not, same logic for below
    var setup = function() {
        prepareCard();
        $("#userAnswer").val("");
        hideUserInteraction();
    };

    //timeout for adding a small delay so the User may read
    //the correctness of his/her answer
    $("#UserInteraction").show();
    Meteor.setTimeout(setup, 2000);

    //For debugging sometimes, you want to hide the user interaction and
    //skip the timeout
    //$("#UserInteraction").hide();
    //setup();
}




function getCurrentTimer() {
    return new Date().getTime();
}

function prepareCard() {
    var file = getCurrentTdfFile();

    if (Session.get("usingACTRModel")) {
        //ACT-R model
        getNextCardActRModel();
    }
    else if (file.tdfs.tutor.unit && file.tdfs.tutor.unit.length) {
        //Scheduled (see assessment session)
        Session.set("isScheduledTest", true);
        if (Session.get("questionIndex") === undefined) {
            Session.set("questionIndex", 0); //Session var should allow for continuation of abandoned tests, but will need to be reset for re-tests
        }

        var unit = getCurrentUnitNumber();
        if (typeof file.tdfs.tutor.unit[unit] === "undefined") { //check to see if we've iterated over all units
            clearCardTimeout();
            statsPageTemplateUpdate(); //In statsPageTemplate.js
            Router.go("stats");
            return;
        }

        var schedule = getSchedule();

        //If we're using permutations, permute the specified groups/items
        //Note that permuted is defined at the top of this file
        if (Session.get("questionIndex") === 0 &&  schedule.permute){
            permuted = permute(schedule.permute);
        }

        if (Session.get("questionIndex") >= schedule.q.length){
            //if we are at the end of this unit
            Session.set("questionIndex", 0);
            Session.set("currentUnitNumber", unit + 1);
            prepareCard();
        }
        else {
            scheduledCard();
        }
    }
    else {
        //Shrug - must just be random selection
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
    Session.set("clusterIndex", nextCardIndex);
    Session.set("testType", "d"); //No test type given
    Session.set("currentQuestion", getStimQuestion(nextCardIndex, 1));
    Session.set("currentAnswer", getStimAnswer(nextCardIndex, 1));

    recordUserTimeQuestion({
        selType: "random"
    });

    newQuestionHandler();
}

function getStimCluster(index) {
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    return file.stimuli.setspec.clusters[0].cluster[index];
}

//Return the current question type
function getQuestionType() {
    var type = "text"; //Default type

    //If we get called too soon, we just use the first cluster
    var clusterIndex = getCurrentClusterIndex();
    if (!clusterIndex && clusterIndex !== 0)
        clusterIndex = 0;

    var cluster = getStimCluster(clusterIndex);
    if (cluster.displayType && cluster.displayType.length) {
        type = cluster.displayType[0];
    }

    return ("" + type).toLowerCase();
}

//get the question at this index
function getStimQuestion(index, whichQuestion) {
    return getStimCluster(index).display[whichQuestion];
}

//get the answer at this index
function getStimAnswer(index, whichAnswer) {
    return getStimCluster(index).response[whichAnswer];
}

function scheduledCard() {
    var unit = getCurrentUnitNumber();
    var questionIndex = Session.get("questionIndex");
    console.log("scheduledCard => unit:" + unit + ",questionIndex:" + questionIndex);

    //If we're using permutations, get index by perm array value (get
    //the permuted item) - otherwise just use the index we have
    var dispQuestionIndex;
    if (permuted.length > 0){
        dispQuestionIndex = permuted[questionIndex];
    }
    else {
        dispQuestionIndex = questionIndex;
    }

    var questInfo = getSchedule().q[dispQuestionIndex];
    var clusterIndex = questInfo.clusterIndex;
    var whichStim = questInfo.whichStim;
    console.log("scheduledCard => clusterIndex:" + clusterIndex + ",whichStim:" + whichStim);

    //get the type of test (drill, test, study)
    Session.set("clusterIndex", clusterIndex);
    Session.set("testType", questInfo.testType);
    Session.set("currentQuestion", getStimQuestion(clusterIndex, whichStim));
    Session.set("currentAnswer", getStimAnswer(clusterIndex, whichStim));

    //Note we increment the session's question index number - NOT the
    //permuted index
    Session.set("questionIndex", questionIndex + 1);

    recordUserTimeQuestion({
        selType: "schedule"
    });

    newQuestionHandler();
}

function getCurrentTestName() {
    return Session.get("currentTest");
}

function getCurrentUnitNumber() {
    return Session.get("currentUnitNumber");
}

function getCurrentTdfName() {
    return Session.get("currentTdfName");
}

function getCurrentTdfFile() {
    return Tdfs.findOne({fileName: getCurrentTdfName()});
}

//Return the current button order as an array
function getCurrentTdfButtonOrder() {
    //Our default value
    var btnOrder = [];

    try {
        var file = getCurrentTdfFile();
        if (file && file.tdfs.tutor.setspec[0].buttonorder) {
            var btnOrderTxt = file.tdfs.tutor.setspec[0].buttonorder;
            btnOrder = (btnOrderTxt + '').split(",");
            if (!btnOrder || !btnOrder.length) {
                btnOrder = []; //Just use empty array
            }
        }
    }
    catch(e) {
        console.log("Error find button order (will use []): " + e);
    }

    return btnOrder;
}

function getCurrentClusterIndex() {
    return Session.get("clusterIndex");
}

function recordProgress(questionIndex, question, answer, userAnswer) {
    var uid = Meteor.userId();
    if (!uid) {
        return;
    }

    UserProgress.update( { _id: uid }, {
        $push: {
            progressDataArray : {
                questionIndex: questionIndex,
                question: question,
                answer: answer,
                userAnswer: userAnswer
            }
        }
    });
}

function resetCurrentTestData() {
    var file = getCurrentTdfFile();
    var tutor = file.tdfs.tutor;
    var currentTestMode;

    if (tutor.unit && tutor.unit.length) {
        currentTestMode = "SCHEDULED";
    }
    else {
        currentTestMode = "RANDOM";
    }

    if (Meteor.userId() !== null) {
        //update the currentTest and mode:
        //set the current test and mode, and clear the progress array.
        UserProgress.update(
            { _id: Meteor.userId() },
            {
                $set: {
                    currentStimuliTest: getCurrentTestName(),
                    currentTestMode: currentTestMode,
                    progressDataArray: [],
                    currentSchedule: {}
                }
            }
        );
    }
}

//Return the schedule for the current unit of the current lesson -
//If it diesn't exist, then create and store it in User Progress
function getSchedule() {
    //Retrieve current schedule
    var progress = UserProgress.findOne({_id: Meteor.userId()});

    var unit = getCurrentUnitNumber();
    var schedule = null;
    if (progress.currentSchedule && progress.currentSchedule.unitNumber == unit) {
        schedule = progress.currentSchedule;
    }

    //Lazy create save if we don't have a correct schedule
    if (schedule === null) {
        console.log("CREATING SCHEDULE, showing progress");
        console.log(progress);

        var stims = Stimuli.findOne({fileName: getCurrentTestName()});
        var clusters = stims.stimuli.setspec.clusters[0].cluster;

        var file = getCurrentTdfFile();
        var setSpec = file.tdfs.tutor.setspec[0];
        var currUnit = file.tdfs.tutor.unit[unit];

        schedule = AssessmentSession.createSchedule(setSpec, clusters, unit, currUnit);
        if (!schedule) {
            //There was an error creating the schedule - there's really nothing
            //left to do since the experiment is broken
            recordUserTime("FAILURE to create schedule", {
                unitname: Helpers.display(currUnit.unitname),
                unitindex: unit
            });
            alert("There is an issue with either the TDF or the Stimulus file - experiment cannot continue");
            clearCardTimeout();
            statsPageTemplateUpdate(); //In statsPageTemplate.js
            Router.go("stats");
            return;
        }

        //We save the current schedule and also log it to the UserTime collection
        UserProgress.update(
            { _id: Meteor.userId() },
            { $set: { currentSchedule: schedule } }
        );

        recordUserTime("schedule", {
            unitname: Helpers.display(currUnit.unitname),
            unitindex: unit,
            schedule: schedule
        });
    }

    //Now they can have the schedule
    return schedule;
}

function initializeActRModel() {
    var file = Stimuli.findOne({fileName: getCurrentTestName()});
    var numQuestions = file.stimuli.setspec.clusters[0].cluster.length;

    var initCardsArray = [];
    for (var i = 0; i < numQuestions; ++i) {
        initCardsArray.push({
            question: getStimQuestion(i, 0),
            answer: getStimAnswer(i, 0),
            questionSuccessCount: 0,
            questionFailureCount: 0,
            trialsSinceLastSeen: 0,
            probability: 0.0,
            hasBeenIntroduced: false
        });
    }

    //update the cards array to be empty
    CardProbabilities.update(
        { _id: Meteor.userId() },
        { $set: {
            numQuestionsAnswered: 0,
            numQuestionsIntroduced: 0,
            cardsArray: initCardsArray
        }},
        { upsert: true }
    );

    //has to be done once ahead of time to give valid values for the beginning of the test.
    console.log("init called");
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
    incModifier.$inc["cardsArray." + (getCurrentClusterIndex()) + ".questionSuccessCount"] = 1;
    CardProbabilities.update({ _id: Meteor.userId() }, incModifier);
}

function incrementCurentQuestionsFailed() {
    var incModifier = {$inc: {}};
    incModifier.$inc["cardsArray." + (getCurrentClusterIndex()) + ".questionFailureCount"] = 1;
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
    Session.set("clusterIndex", index);
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
    }
    return counter;
}

function calculateCardProbabilities() {
    var cardProbs = CardProbabilities.findOne({ _id: Meteor.userId() });
    var setModifiers = [];
    var incModifiers = [];

    for(var i = 0; i < cardProbs.cardsArray.length; ++i) {

        var questionSuccessCount = cardProbs.cardsArray[i].questionSuccessCount;
        var questionFailureCount = cardProbs.cardsArray[i].questionFailureCount;
        var totalQuestionStudies = questionSuccessCount + questionFailureCount;
        var trialsSinceLastSeen = cardProbs.cardsArray[i].trialsSinceLastSeen;
        var totalTrials = cardProbs.numQuestionsAnswered;
        var trialsSinceLastSeenOverTotalTrials;

        if (totalTrials !== 0) { // can't divide by 0
            trialsSinceLastSeenOverTotalTrials = trialsSinceLastSeen/totalTrials;
        } else {
            trialsSinceLastSeenOverTotalTrials = 0;
        }

        var x = -3.0 + (2.4 * questionSuccessCount) + (0.8 * questionFailureCount) + totalQuestionStudies - (0.3 * trialsSinceLastSeenOverTotalTrials);
        var probability = 1.0/( 1.0 + Math.pow(Math.E, -x) );

        //set probability
        var setModifier = {$set: {}};
        setModifier.$set["cardsArray." + i + ".probability"] = probability;
        setModifiers.push(setModifier);

        //increment trialsSinceLastSeen
        var incModifier = {$inc: {}};
        incModifier.$inc["cardsArray." + i + ".trialsSinceLastSeen"] = 1;
        incModifiers.push(incModifier);
    }

    Meteor.call("updateCardProbs", setModifiers, incModifiers);
}

function getNextCardActRModel() {
    Session.set("testType", "d");

    var cardProbs = CardProbabilities.findOne({ _id: Meteor.userId() });
    var numItemsPracticed = cardProbs.numQuestionsAnswered;
    var cardsArray = cardProbs.cardsArray;

    var indexForNewCard;
    var showOverlearningText = false;

    if (numItemsPracticed === 0) {
        //introduce new card.  (#2 in the algorithm)
        indexForNewCard = getIndexForNewCardToIntroduce(cardsArray);
        if (indexForNewCard === -1) {
            if (Session.get("debugging")) {
                console.log("ERROR: All cards have been introduced, but numQuestionsAnswered === 0");
            }
            return; //DOH!
        }
    }
    else {
        indexForNewCard = selectHighestProbabilityAlreadyIntroducedCardLessThan85(cardsArray);
        if (indexForNewCard === -1) {
            //numbers 4 and 5 in the algorithm.
            if (getNumCardsBelow85(cardsArray) === 0 && getNumQuestionsIntroduced() === cardsArray.length) {
                //number 5 in the algorithm.
                indexForNewCard = selectLowestProbabilityCardIndex(cardsArray);
                showOverlearningText = true;
            }
            else {
                //number 4 in the algorithm.
                indexForNewCard = getIndexForNewCardToIntroduce(cardsArray);
                if (indexForNewCard === -1) {
                    //if we have introduced all of the cards.
                    indexForNewCard = selectLowestProbabilityCardIndex(cardsArray);
                }
            }
        }
    }

    setNextCardInfo(indexForNewCard);
    Session.set("showOverlearningText", showOverlearningText);

    //Include the current probability data for the chosen question
    //Note that we don't log question or answer in the card info (it's dup info)
    var cardModelData = {};
    if (indexForNewCard >= 0) {
        cardModelData = cardsArray[indexForNewCard];
    }
    cardModelData = _.omit(cardModelData, ["question", "answer"]);


    recordUserTimeQuestion({
        selType: "model",
        cardModelData: cardModelData,
    });

    newQuestionHandler();
}

function getIndexForNewCardToIntroduce( cardsArray ) {
    var indexToReturn = -1;

    for(var i = 0; i < cardsArray.length; ++i) {
        if (cardsArray[i].hasBeenIntroduced === false) {
            indexToReturn = i;
        }
    }

    if (Session.get("debugging")) {
        if (indexToReturn === -1) {
            console.log("All cards have been introduced!");
        }
        else {
            console.log("about to introduce " + indexToReturn);
        }
    }

    if (indexToReturn !== -1) {
        // we introduced a new card.
        incrementNumQuestionsIntroduced();
    }

    return indexToReturn;
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
    }

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
    }

    if (Session.get("debugging")) {
        console.log("indexToReturn: " + indexToReturn);
    }

    return indexToReturn;
}

function timeoutfunction(index) {
    var progress = UserProgress.findOne(
        { _id: Meteor.userId() },
        { progressDataArray: 1 }
    );

    var length = 0;
    if (progress && progress.progressDataArray && progress.progressDataArray.length) {
        length = progress.progressDataArray.length;
    }

    var file = getCurrentTdfFile();
    var tis = file.tdfs.tutor.setspec[0].timeoutInSeconds[0];
    var delay = tis * 1000; //Need delay is milliseconds

    clearCardTimeout(); //No previous timeout now

    timeoutName = Meteor.setTimeout(function() {
        if(index === length && timeoutCount > 0) {
            console.log("TIMEOUT "+timeoutCount+": " + index +"|"+length);
            stopUserInput();

            var nowTime = getCurrentTimer();
            var elapsed = nowTime - start;
            var elapsedOnRender = nowTime - startOnRender;

            recordUserTime("[TIMEOUT]", {
                index: getCurrentClusterIndex(),
                qtype: findQTypeSimpified(),
                delay: delay,
                elapsed: elapsed,
                elapsedOnRender: elapsedOnRender
            });

            if (getTestType() === "d") {
                showUserInteraction(false, "Timed out! The correct answer is: " + Session.get("currentAnswer"));
            }

            recordProgress(getCurrentClusterIndex(), Session.get("currentQuestion"), Session.get("currentAnswer"), "[TIMEOUT]");

            if (Session.get("usingACTRModel")) {
                incrementCurentQuestionsFailed();
                incrementNumQuestionsAnswered();
                console.log("timeout called");
                calculateCardProbabilities();
            }

            var clearInfo = function() {
                hideUserInteraction();
                prepareCard();
            };

            Meteor.setTimeout(clearInfo, 2000);
        }
        else{
            //Do Nothing
        }

    }, delay);
}

function findQTypeSimpified() {
    var QType = getQuestionType();

    if      (QType == "text")  QType = "T";    //T for Text
    else if (QType == "image") QType = "I";    //I for Image
    else if (QType == "sound") QType = "A";    //A for Audio
    else                       QType = "NA";   //NA for Not Applicable

    return QType;
}

function getTestType(){
    return Helpers.trim(Session.get("testType")).toLowerCase();
}

//NOTE - permuted array is a SHALLOW COPY - which is different from
//shuffle in Helpers
function permute (perms) {
    var final_perm = [];
    var groups = perms.split("|");
    for(var i = 0; i < groups.length; i++) {
        var indexSets = groups[i].split(",");
        permutedArray = Helpers.shuffle(indexSets);
        for(var j = 0; j < permutedArray.length; j++) {
            final_perm.push(permutedArray[j]);
        }
    }
    return final_perm;
}


function showUserInteraction(isGoodNews, news) {
    $("#UserInteraction")
        .removeClass("alert-success alert-danger")
        .addClass("text-align alert")
        .addClass(isGoodNews ? "alert-success" : "alert-danger")
        .text(news)
        .show();
}

function hideUserInteraction() {
    $("#UserInteraction")
        .removeClass("text-align alert alert-success alert-danger")
        .html("")
        .hide();
}

function stopUserInput() {
    $("#userAnswer, #multipleChoiceContainer button").prop("disabled", true);
}

function allowUserInput() {
    $("#userAnswer, #multipleChoiceContainer button").prop("disabled", false);
}
