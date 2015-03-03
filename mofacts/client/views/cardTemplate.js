//TODO: if our admin/teacher-only stats page were cleaned up, then it would
//      be nice to support a unit that displayed that kind of information

//TODO: document all deliveryparams fields for a unit and how we handle them,
//      which will include the function getCurrentDeliveryParams


////////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

var permuted = [];
var trialTimestamp = 0;
var keypressTimestamp = 0;
var currentQuestionSound = null; //See later in this file for sound functions

//We need to track the name/ID for clear and reset. We need the function and
//delay used for reset
var timeoutName = null;
var timeoutFunc = null;
var timeoutDelay = null;

function clearCardPermuted() {
    permuted = [];
}

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
    timeoutFunc = null;
    timeoutDelay = null;
}

//Start a timeout count
//Note we reverse the params for Meteor.setTimeout - makes calling code much cleaner
function beginMainCardTimeout(delay, func) {
    clearCardTimeout();
    timeoutFunc = func;
    timeoutDelay = delay;
    timeoutName = Meteor.setTimeout(timeoutFunc, timeoutDelay);
}

//Reset the previously set timeout counter
function resetMainCardTimeout() {
    var savedFunc = timeoutFunc;
    var savedDelay = timeoutDelay;
    clearCardTimeout();
    beginMainCardTimeout(savedDelay, savedFunc);
}

////////////////////////////////////////////////////////////////////////////
// Events

function leavePage(dest) {
    clearCardTimeout();
    clearPlayingSound();
    if (typeof dest === "function") {
        dest();
    }
    else {
        Router.go(dest);
    }
}

Template.cardTemplate.events({

    'focus #userAnswer' : function() {
        //Not much right now
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
                leavePage(routeToSignin);
            }
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        leavePage("/profile");
    },

    'click .statsPageLink' : function (event) {
        event.preventDefault();
        clearCardTimeout();
        leavePage(statsPageTemplateUpdate); //In statsPageTemplate.js
    },

    'click #overlearningButton' : function (event) {
        event.preventDefault();
        leavePage("/profile");
    },

    'click .multipleChoiceButton' : function (event) {
        event.preventDefault();
        handleUserInput( event , "buttonClick");
    },

    'click #continueStudy': function(event) {
        event.preventDefault();
        handleUserInput( event , "buttonClick");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers and meteor events

Template.cardTemplate.rendered = function() {
    if(Session.get("debugging")) {
        console.log('cards template rendered');
    }

    //the card loads frequently, but we only want to set this the first time
    if(Session.get("needResume")) {
        console.log("cards template rendered => Performing resume");
        Session.set("showOverlearningText", false);
        resumeFromUserTimesLog();
    }
};

Template.cardTemplate.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            clearCardTimeout();
            routeToSignin();
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

    skipstudy: function() {
        return getCurrentDeliveryParams().skipstudy;
    },
});


////////////////////////////////////////////////////////////////////////////
// Implementation functions

function newQuestionHandler() {
    console.log("NQ handler");

    if ( Session.get("isScheduledTest") ) {
        var unitNumber = getCurrentUnitNumber();
        var file = getCurrentTdfFile();
        var currUnit = file.tdfs.tutor.unit[unitNumber];
        var schedule = getSchedule();

        //Always clear the multiple choice container
        $("#multipleChoiceContainer").html("");

        if (schedule && schedule.isButtonTrial) {
            $("#textEntryRow").hide();

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
                $("#multipleChoiceContainer").append($(
                    "<div>" +
                    "<button type='button' name='" + value + "' class='btn btn-primary btn-block multipleChoiceButton'>" +
                    value +
                    "</button>" +
                    "</div>"
                ));
            });
        }
        else {
            //Not a button trial
            $("#textEntryRow").show();
        }
    }

    setQuestionTimeout();

    if (Session.get("showOverlearningText")) {
        $("#overlearningRow").show();
    }

    //No user input (re-enabled below) and reset keypress timestamp.
    stopUserInput();
    keypressTimestamp = 0;
    trialTimestamp = Date.now();

    if(getQuestionType() === "sound"){
        //We don't allow user input until the sound is finished playing
        playCurrentQuestionSound(function() {
            allowUserInput();
        });
    }
    else {
        //Not a sound - can unlock now for data entry now
        allowUserInput();
    }
}

//Stop previous sound
function clearPlayingSound() {
    if (!!currentQuestionSound) {
        try {
            currentQuestionSound.stop();
        }
        catch(e) {
        }
        currentQuestionSound = null;
    }
}

//Play a sound matching the current question
function playCurrentQuestionSound(onEndCallback) {
    //We currently only play one sound at a time
    clearPlayingSound();

    //Reset sound and play it
    currentQuestionSound = new Howl({
        urls: [
            Session.get("currentQuestion") + '.mp3',
            Session.get("currentQuestion") + '.wav'
        ],

        onplay: function() {
            if (currentQuestionSound) {
                currentQuestionSound.isCurrentlyPlaying = true;
            }
        },

        onend: function() {
            if (currentQuestionSound) {
                currentQuestionSound.isCurrentlyPlaying = false;
            }
            if (!!onEndCallback) {
                onEndCallback();
            }
        },
    });

    //In case our caller checks before the sound has a chance to load, we
    //mark the howler instance as playing
    currentQuestionSound.isCurrentlyPlaying = true;
    currentQuestionSound.play();
}

function handleUserInput(e , source) {
    var isTimeout = false;
    var key;
    if (source === "timeout") {
        key = 13;
        isTimeout = true;
    }
    else if (source === "keypress") {
        key = e.keyCode || e.which;
        //Do we need to capture the first keypress timestamp?
        if (!keypressTimestamp) {
            keypressTimestamp = Date.now();
        }
    }
    else if (source === "buttonClick") {
        //to save space we will just go ahead and act like it was a key press.
        key = 13;
    }

    //If we haven't seen the correct keypress, then we want to reset our
    //timeout and leave
    if (key != 13) {
        resetMainCardTimeout();
        return;
    }

    //Stop current timeout and stop user input
    stopUserInput();
    clearCardTimeout();

    var userAnswer;
    if (isTimeout) {
        userAnswer = "[timeout]";
    }
    else if (source === "keypress") {
        userAnswer = Helpers.trim($('#userAnswer').val()).toLowerCase();
    }
    else if (source === "buttonClick") {
        userAnswer = e.target.name;
    }

    //Check Correctness
    var answer = Helpers.trim(Session.get("currentAnswer").toLowerCase());

    //Show user feedback and find out if they answered correctly
    //Note that userAnswerFeedback will display text and/or media - it is
    //our responsbility to decide when to hide it and move on
    var isCorrect = userAnswerFeedback(answer, userAnswer, isTimeout);

    //Note that actually provide the client-side timestamp since we need it
    //Pretty much everywhere else relies on recordUserTime to provide it.
    //We also get the timestamp of the first keypress for the current trial.
    //Of course for things like a button trial, we won't have it
    var timestamp = Date.now();
    var firstActionTimestamp = keypressTimestamp || timestamp;

    //Note that if something messed up and we can't calculate start/end
    //latency, we'll punt and the output script (experiment_times.js) will
    //need to construct the times
    var startLatency, endLatency;
    if (trialTimestamp) {
        startLatency = firstActionTimestamp - trialTimestamp;
        endLatency = timestamp - trialTimestamp;
    }
    else {
        console.log("Missing trial start timestamp: will need to construct from question/answer gap?");
    }

    recordUserTime(isTimeout ? "[timeout]" : "answer", {
        questionIndex: Session.get("questionIndex"),
        index: getCurrentClusterIndex(),
        ttype: getTestType(),
        qtype: findQTypeSimpified(),
        guiSource: source,
        answer: userAnswer,
        isCorrect: isCorrect,
        trialStartTimestamp: trialTimestamp,
        clientSideTimeStamp: timestamp,
        firstActionTimestamp: firstActionTimestamp,
        startLatency: startLatency,
        endLatency: endLatency
    });

    //record progress in userProgress variable storage (note that this is
    //helpful and used on the stats page, but the user times log is the
    //"system of record"
    recordProgress(Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer, isCorrect);

    //timeout for adding a small delay so the User may read
    //the correctness of his/her answer
    $("#UserInteraction").show();

    //Figure out timeout
    var deliveryParams = getCurrentDeliveryParams();
    var timeout = 0;

    if (getTestType() === "s") {
        //Just a study - note that the purestudy timeout is used for the
        //QUESTION timeout, not the display timeout after the ANSWER
        timeout = 1;
    }
    else if (!isCorrect && getTestType() === "d" && Session.get("isScheduledTest")) {
        //Got a drill wrong on a scheduled test - should use review timeout
        timeout = Helpers.intVal(deliveryParams.reviewstudy) || 0;
    }
    else if (isCorrect) {
        //Correct! should use a correct timeout
        //Special default for correct - we use 1ms instead of 0 to avoid
        //the generic fallback to 2 seconds below
        timeout = Helpers.intVal(deliveryParams.correctprompt) || 1;
    }
    else {
        //Not a study, not correct, either a test or not scheduled or both.
        //we'll force ourselves to punt below with default values
        timeout = 0;
    }

    //If not timeout, default to 2 seconds so they can read the message
    if (!timeout || timeout < 1) {
        //Default to 2 seconds and add a second if sound is playing
        timeout = 2000;
        if (currentQuestionSound && currentQuestionSound.isCurrentlyPlaying) {
            timeout += 1000;
        }
        console.log("NO CORRECT TIMEOUT SPECIFIED! Using", timeout);
    }

    //Stop previous timeout
    clearCardTimeout();

    //Create the action we're about to call
    var resetAfterTimeout = function() {
        beginMainCardTimeout(timeout, function() {
            prepareCard();
            $("#userAnswer").val("");
            hideUserInteraction();
        });
    };

    //If incorrect answer for a drill on a sound, we need to replay the sound.
    //Otherwise, we can just use our reset logic directly
    if (getQuestionType() === "sound" && !isCorrect && getTestType() === "d") {
        playCurrentQuestionSound(resetAfterTimeout);
    }
    else {
        resetAfterTimeout();
    }
}

//Take care of user feedback - and return whether or not the user correctly
//answered the question
function userAnswerFeedback(answer, userAnswer, isTimeout) {
    //Nothing to evaluate - it was a study. To make things easier, we just
    //pretend they answered exactly correct
    if (getTestType() === "s") {
        userAnswer = answer;
        isTimeout = false;
    }

    var isCorrect = null;

    answer = Helpers.trim(answer.toLowerCase());
    userAnswer = Helpers.trim(userAnswer.toLowerCase());

    var isDrill = (getTestType() === "d");

    //We know if it's a button trial from the schedule
    var isButtonTrial = false;
    var progress = getUserProgress();
    if (progress && progress.currentSchedule) {
        isButtonTrial = !!progress.currentSchedule.isButtonTrial;
    }

    //Helper for correctness logic below
    var handleAnswerState = function(goodNews, msg) {
        isCorrect = goodNews;
        if (isDrill) {
            showUserInteraction(goodNews, msg);
        }
    };

    //How was their answer?
    if (!!isTimeout) {
        //Timeout - doesn't matter what the answer says!
        handleAnswerState(false, "Sorry - time ran out. The correct answer is: " + answer);
    }
    else if (userAnswer.localeCompare(answer) === 0) {
        //Right
        handleAnswerState(true, "Correct - Great Job!");
    }
    else if (!isButtonTrial) {
        var file = getCurrentTdfFile();
        var spec = file.tdfs.tutor.setspec[0];

        var lfparameter = null;
        if (spec && spec.lfparameter && spec.lfparameter.length)
            lfparameter = parseFloat(spec.lfparameter[0]);

        //Not exact, but if they are entering text, they might be close enough
        var editDistScore = 1.0 - (
            getEditDistance(userAnswer, answer) /
            Math.max(userAnswer.length, answer.length)
        );
        if (Session.get("debugging")) {
            console.log("Edit Dist Score", editDistScore, "lfparameter", lfparameter);
        }

        if(!!lfparameter && editDistScore > lfparameter) {
            handleAnswerState(true, "Close enough - Great Job!");
        }
        else {
            handleAnswerState(false, "You are Incorrect. The correct answer is : " + answer);
        }
    }
    else {
        //Wrong
        handleAnswerState(false, "You are Incorrect. The correct answer is : " + answer);
    }

    //Update any model parameters based on their answer's correctness
    if (Session.get("usingACTRModel")) {
        modelCardAnswered(isCorrect);
    }

    //If they are incorrect on a drill, we might need to do extra work for
    //their review period
    if (isDrill && !isCorrect) {
        //Cheat and inject a review message
        $("#UserInteraction").append(
            $("<p class='text-danger'></p>").html("") //No review message currently
        );
    }

    return isCorrect;
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
            //At this point, a missing question index is assumed to mean "start
            //with the first question"
            Session.set("questionIndex", 0);
        }

        var questionIndex = Session.get("questionIndex");
        var unit = getCurrentUnitNumber();
        console.log("prepareCard for Schedule (Unit,QIdx)=", unit, questionIndex);

        //Grab the schedule - but only if we need it
        var schedule = null;
        if (unit < file.tdfs.tutor.unit.length) {
            schedule = getSchedule();
            //If we're using permutations, permute the specified groups/items
            //Note that permuted is defined at the top of this file
            if (questionIndex === 0 &&  schedule.permute) {
                permuted = permute(schedule.permute);
            }
        }

        if (schedule && questionIndex < schedule.q.length) {
            //Just another card
            scheduledCard();
        }
        else {
            //We just finished a unit
            clearCardTimeout();

            Session.set("questionIndex", 0);
            Session.set("clusterIndex", undefined);
            var newUnit = unit + 1;
            Session.set("currentUnitNumber", newUnit);

            if (newUnit < file.tdfs.tutor.unit.length) {
                //Just hit a new unit - we need to restart with instructions
                console.log("UNIT FINISHED: show instructions for next unit", newUnit);
                leavePage("/instructions");
            }
            else {
                //We have run out of units - return home for now
                console.log("UNIT FINISHED: No More Units");
                leavePage("/profile");
            }

            return;
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
    var file = Stimuli.findOne({fileName: getCurrentStimName()});
    //get the cluster size (avoids out of bounds error)
    var size = file.stimuli.setspec.clusters[0].cluster.length;

    //get a valid index
    var nextCardIndex = Math.floor((Math.random() * size));
    //set the question and answer
    Session.set("clusterIndex", nextCardIndex);
    Session.set("testType", "d"); //No test type given
    Session.set("currentQuestion", getStimQuestion(nextCardIndex, 0));
    Session.set("currentAnswer", getStimAnswer(nextCardIndex, 0));

    recordUserTimeQuestion({
        selType: "random"
    });

    newQuestionHandler();
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
        selType: "schedule",
        whichStim: whichStim
    });

    newQuestionHandler();
}

function recordProgress(question, answer, userAnswer, isCorrect) {
    var uid = Meteor.userId();
    if (!uid) {
        return;
    }

    var questionIndex = Session.get("questionIndex");
    if (!questionIndex && questionIndex !== 0) {
        questionIndex = null;
    }

    var prog = getUserProgress();
    prog.progressDataArray.push({
        clusterIndex: getCurrentClusterIndex(),
        questionIndex: questionIndex,
        question: question,
        answer: answer,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
    });
}

//Return the schedule for the current unit of the current lesson -
//If it diesn't exist, then create and store it in User Progress
function getSchedule() {
    //Retrieve current schedule
    var progress = getUserProgress();

    var unit = getCurrentUnitNumber();
    var schedule = null;
    if (progress.currentSchedule && progress.currentSchedule.unitNumber == unit) {
        schedule = progress.currentSchedule;
    }

    //Lazy create save if we don't have a correct schedule
    if (schedule === null) {
        console.log("CREATING SCHEDULE, showing progress");
        console.log(progress);

        var stims = Stimuli.findOne({fileName: getCurrentStimName()});
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
            leavePage("/profile");
            return;
        }

        //We save the current schedule and also log it to the UserTime collection
        progress.currentSchedule = schedule;

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
    var file = Stimuli.findOne({fileName: getCurrentStimName()});
    var numQuestions = file.stimuli.setspec.clusters[0].cluster.length;

    var initCards = [];
    for (var i = 0; i < numQuestions; ++i) {
        initCards.push({
            question: getStimQuestion(i, 0),
            answer: getStimAnswer(i, 0),
            questionSuccessCount: 0,
            questionFailureCount: 0,
            trialsSinceLastSeen: 0,
            probability: 0.0,
            hasBeenIntroduced: false
        });
    }

    //Re-init the card probabilities
    initCardProbs({ cards: initCards });

    //has to be done once ahead of time to give valid values for the beginning of the test.
    calculateCardProbabilities();
}

function getNumCardsBelow85(cards) {
    var counter = 0;
    _.each(cards, function(card) {
        if (card.probability < 0.85) {
            ++counter;
        }
    });
    return counter;
}

function calculateCardProbabilities() {
    var cardProbs = getCardProbs();
    var totalTrials = cardProbs.numQuestionsAnswered;
    var cards = cardProbs.cards;

    _.each(cards, function(card) {
        var questionSuccessCount = card.questionSuccessCount;
        var questionFailureCount = card.questionFailureCount;
        var totalQuestionStudies = questionSuccessCount + questionFailureCount;
        var trialsSinceLastSeen = card.trialsSinceLastSeen;

        var trialsSinceLastSeenOverTotalTrials = 0.0;
        if (totalTrials !== 0) {
            trialsSinceLastSeenOverTotalTrials = trialsSinceLastSeen / totalTrials;
        }

        var x = -3.0 +
                 (2.4 * questionSuccessCount) +
                 (0.8 * questionFailureCount) +
                 (1.0 * totalQuestionStudies) +
                -(0.3 * trialsSinceLastSeenOverTotalTrials);

        var probability = 1.0 / (1.0 + Math.exp(-x));

        card.probability = probability;
    });
}

function getNextCardActRModel() {
    Session.set("testType", "d");

    var cardProbs = getCardProbs();
    var numItemsPracticed = cardProbs.numQuestionsAnswered;
    var cards = cardProbs.cards;

    var indexForNewCard;
    var showOverlearningText = false;

    if (numItemsPracticed === 0) {
        //introduce new card.  (#2 in the algorithm)
        indexForNewCard = getIndexForNewCardToIntroduce(cards);
        if (indexForNewCard === -1) {
            if (Session.get("debugging")) {
                console.log("ERROR: All cards have been introduced, but numQuestionsAnswered === 0");
            }
            return; //DOH!
        }
    }
    else {
        indexForNewCard = selectHighestProbabilityAlreadyIntroducedCardLessThan85(cards);
        if (indexForNewCard === -1) {
            //numbers 4 and 5 in the algorithm.
            var numIntroduced = cardProbs.numQuestionsIntroduced;
            if (getNumCardsBelow85(cards) === 0 && numIntroduced === cards.length) {
                //number 5 in the algorithm.
                indexForNewCard = selectLowestProbabilityCardIndex(cards);
                showOverlearningText = true;
            }
            else {
                //number 4 in the algorithm.
                indexForNewCard = getIndexForNewCardToIntroduce(cards);
                if (indexForNewCard === -1) {
                    //if we have introduced all of the cards.
                    indexForNewCard = selectLowestProbabilityCardIndex(cards);
                }
            }
        }
    }

    //Found! Update everything and grab a reference to the card
    modelCardSelected(indexForNewCard);
    var card = cards[indexForNewCard];

    //Save the card selection
    Session.set("clusterIndex", indexForNewCard);
    Session.set("currentQuestion", card.question);
    Session.set("currentAnswer", card.answer);
    Session.set("showOverlearningText", showOverlearningText);

    //Record the question and fire the new qustion handler
    //Note that we include the current card data but we DON'T log question or
    //answer in the card info (it's dup info)
    recordUserTimeQuestion({
        selType: "model",
        cardModelData: _.omit(card, ["question", "answer"]),
    });

    newQuestionHandler();
}

//Called when a new card is selected to update stats
function modelCardSelected(indexForNewCard) {
    var cardProbs = getCardProbs();
    cardProbs.numQuestionsIntroduced += 1;

    var cards = cardProbs.cards;
    //It has now been officially one more trial since all the other cards
    //have been seen
    _.each(cards, function(card, index) {
        if (index != indexForNewCard) {
            card.trialsSinceLastSeen += 1;
        }
    });

    //Now card has been introduced/seen
    var card = cards[indexForNewCard];
    card.trialsSinceLastSeen = 0;
    card.hasBeenIntroduced = true;
}

//Called when a card is answered to update stats
function modelCardAnswered(wasCorrect) {
    var cardProbs = getCardProbs();
    cardProbs.numQuestionsAnswered += 1;

    var card = null;
    try {
        card = cardProbs.cards[Session.get("clusterIndex")];
    }
    catch(err) {
        console.log("Error getting card for update", err);
    }

    if (card) {
        if (wasCorrect) card.questionSuccessCount += 1;
        else            card.questionFailureCount += 1;
    }

    calculateCardProbabilities();
}

function getIndexForNewCardToIntroduce(cards) {
    var indexToReturn = -1;

    _.each(cards, function(card, index) {
        if (!card.hasBeenIntroduced) {
            indexToReturn = index;
        }
    });

    return indexToReturn;
}


function selectHighestProbabilityAlreadyIntroducedCardLessThan85(cards) {
    var currentMaxProbabilityLessThan85 = 0;
    var indexToReturn = -1;

    _.each(cards, function(card, index) {
        if (card.hasBeenIntroduced && card.trialsSinceLastSeen > 2) {
            if (card.probability > currentMaxProbabilityLessThan85 && card.probability < 0.85) {
                currentMaxProbabilityLessThan85 = card.probability;
                indexToReturn = index;
            }
        }
    });

    return indexToReturn;
}

function selectLowestProbabilityCardIndex(cards) {
    var currentMinProbability = 1;
    var indexToReturn = 0;

    _.each(cards, function(card, index) {
        if (card.probability < currentMinProbability  && card.trialsSinceLastSeen > 2) {
            currentMinProbability = card.probability;
            indexToReturn = index;
        }
    });

    return indexToReturn;
}

function setQuestionTimeout() {
    clearCardTimeout(); //No previous timeout now

    var file = getCurrentTdfFile();

    var delayMs = 1; //default just in case

    //If this is scheduled TDF and the current test is a study, use the timeout
    //for purestudy for the current unit. Otherwise use the top-level setspec
    //timeout in seconds
    if (getTestType() === "s" && Session.get("isScheduledTest")) {
        var unit = file.tdfs.tutor.unit[getCurrentUnitNumber()];
        delayMs = Helpers.intVal(getCurrentDeliveryParams().purestudy);
    }
    else {
        var tis = Helpers.intVal(file.tdfs.tutor.setspec[0].timeoutInSeconds[0]);
        delayMs = tis * 1000; //Need delay is milliseconds
    }

    beginMainCardTimeout(delayMs, function() {
        stopUserInput();
        handleUserInput({}, "timeout");
    });
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
    $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled", true);
}

function allowUserInput() {
    $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled", false);
}


////////////////////////////////////////////////////////////////////////////
// BEGIN Resume Logic

//Helper for getting the relevant user times log
function getCurrentUserTimesLog() {
    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
    var expKey = userTimesExpKey(true);

    var entries = [];
    if (userLog && userLog[expKey] && userLog[expKey].length) {
        entries = userLog[expKey];
    }

    return entries;
}

//Re-initialize our User Progress and Card Probabilities internal storage
//from the user times log. Note that most of the logic will be in
//processUserTimesLog. This function just does some initial set up, insures
//that experimental conditions are correct, and uses processUserTimesLog as
//a callback. This callback pattern is important because it allows us to be
//sure our server-side call regarding experimental conditions has completed
//before continuing to resume the session
function resumeFromUserTimesLog() {
    console.log("Resuming from previous User Times info (if any)");

    //Clear any previous permutation and/or timeout call
    clearCardTimeout();
    clearCardPermuted();
    keypressTimestamp = 0;
    trialTimestamp = 0;

    //Clear any previous session data about unit/question/answer
    Session.set("currentUnitNumber", undefined);
    Session.set("questionIndex", undefined);
    Session.set("clusterIndex", undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("testType", undefined);
    Session.set("lastTimestamp", 0);

    //So here's the place where we'll use the ROOT tdf instead of just the
    //current TDF. It's how we'll find out if we need to perform experimental
    //condition selection. It will be our responsibility to update
    //currentTdfName and currentStimName based on experimental conditions
    //(if necessary)
    var rootTDF = Tdfs.findOne({fileName: Session.get("currentRootTdfName")});
    if (!rootTDF) {
        console.log("PANIC: Unable to load the root TDF for learning", Session.get("currentRootTdfName"));
        alert("Unfortunately, something is broken and this lesson cannot continue");
        leavePage("/profile");
        return;
    }

    var setspec = rootTDF.tdfs.tutor.setspec[0];
    var needExpCondition = (setspec.condition && setspec.condition.length);
    var conditionAction;
    var conditionData = {};

    if (needExpCondition) {
        //Find the correct exp condition
        console.log("Experimental condition is required: searching");
        var prevCondition = _.find(getCurrentUserTimesLog(), function(entry) {
            return entry && entry.action && entry.action === "expcondition";
        });

        var subTdf = null;

        if (prevCondition) {
            //Use previous condition and log a notification that we did so
            console.log("Found previous experimental condition: using that");
            subTdf = prevCondition.selectedTdf;
            conditionAction = "condition-notify";
            conditionData.note = "Using previous condition: " + subTdf;
        }
        else {
            //Select condition and save it
            console.log("No previous experimental condition: Selecting from " + setspec.condition.length);
            subTdf = _.sample(setspec.condition);
            conditionAction = "expcondition";
            conditionData.note = "Selected from " + Helpers.display(setspec.condition.length) + " conditions";
        }

        if (!subTdf) {
            console.log("No experimental condition could be selected!");
            alert("Unfortunately, something is broken and this lesson cannot continue");
            leavePage("/profile");
            return;
        }

        conditionData.selectedTdf = subTdf;
        console.log("Exp Condition", conditionData.selectedTdf, conditionData.note);

        //Now we have a different current TDF (but root stays the same)
        Session.set("currentTdfName", subTdf);

        //Also need to read new stimulus file (and note that we allow an exception
        //to kill us if the current tdf is broken and has no stimulus file)
        Session.set("currentStimName", getCurrentTdfFile().tdfs.tutor.setspec[0].stimulusfile[0]);
    }
    else {
        //Just notify that we're skipping
        console.log("No Experimental condition is required: continuing");
        conditionAction = "condition-notify";
        conditionData.note = "No exp condition necessary";
    }

    //Add some session data to the log message we're sending
    conditionData = _.extend(conditionData, {
        currentRootTdfName: Session.get("currentRootTdfName"),
        currentTdfName: Session.get("currentTdfName"),
        currentStimName: Session.get("currentStimName")
    });

    //Notice that no matter what, we log something about condition data
    //ALSO NOTICE that we'll be calling processUserTimesLog after the server
    //returns and we know we've logged what happened
    recordUserTime(conditionAction, conditionData, processUserTimesLog);
}

//We process the user times log, assuming resumeFromUserTimesLog has properly
//set up the TDF/Stim session variables
function processUserTimesLog() {
    //Get TDF info
    var file = getCurrentTdfFile();
    var tutor = file.tdfs.tutor;
    var stims = null; //LAZY READ - see below

    //Assume not modeled and and not using card probs
    Session.set("usingACTRModel",false);
    initCardProbs(); //Blank out since not using ACT-R model

    //check if tutor.setspec.isModeled is defined in the tdf
    if (typeof tutor.setspec[0].isModeled !== "undefined") {
        //if it is defined and is set to true, use the ACT-R Model methods.
        if (tutor.setspec[0].isModeled == "true") {
            Session.set("usingACTRModel",true);
            console.log("INIT ACT-R Model for resume");
            initializeActRModel(); //Will handle card probs for us
        }
    }

    var currentStimName = getCurrentStimName();

    //Before the below options, reset current test data
    initUserProgress({
        currentTestMode: (tutor.unit && tutor.unit.length ? "SCHEDULED" : "RANDOM"),
        progressDataArray: [],
        currentSchedule: {}
    });

    //If we are scheduled, then default the current unit number
    if (getUserProgress().currentTestMode === "SCHEDULED") {
        Session.set("currentUnitNumber", 0);
    }

    //We'll be tracking the last question so that we can match with the answer
    var lastQuestionEntry = null;

    //prepareCard will handle whether or not new units see instructions, but
    //it will miss instructions for the very first unit. Note that we only need
    //to worry about this if we actually have units
    var needFirstUnitInstructions = tutor.unit && tutor.unit.length;

    //At this point, our state is set as if they just started this learning
    //session for the first time. We need to loop thru the user times log
    //entries and update that state
    _.each(getCurrentUserTimesLog(), function(entry, index) {
        if (!entry.action) {
            console.log("Ignoring user times entry with no action");
            return;
        }

        //Only examine the messages that we care about
        var action = Helpers.trim(entry.action).toLowerCase();

        //Generally we use the last timestamp for our major actions. This will
        //currently only be set to false in the default/fall-thru else block
        var recordTimestamp = true;

        if (action === "instructions") {
            //They've been shown instructions for this unit
            needFirstUnitInstructions = false;
            var instructUnit = entry.currentUnit;
            if (!!instructUnit || instructUnit === 0) {
                Session.set("currentUnitNumber", instructUnit);
                Session.set("questionIndex", 0);
                Session.set("clusterIndex", undefined);
                Session.set("currentQuestion", undefined);
                Session.set("currentAnswer", undefined);
                Session.set("testType", undefined);
            }
        }

        else if (action === "schedule") {
            //Read in the previously created schedule
            lastQuestionEntry = null; //Kills the last question
            needFirstUnitInstructions = false;

            var unit = entry.unitindex;
            if (!unit && unit !== 0) {
                //If we don't know the unit, then we can't proceed
                console.log("Schedule Entry is missing unitindex", unit);
                return;
            }

            if (!stims) {
                stims = Stimuli.findOne({fileName: currentStimName});
            }

            var clusters = stims.stimuli.setspec.clusters[0].cluster;
            var setSpec = file.tdfs.tutor.setspec[0];
            var currUnit = file.tdfs.tutor.unit[unit];
            var schedule = entry.schedule;

            if (!schedule) {
                //There was an error creating the schedule - there's really nothing
                //left to do since the experiment is broken
                recordUserTime("FAILURE to read schedule from user time log", {
                    unitname: Helpers.display(currUnit.unitname),
                    unitindex: unit
                });
                alert("There is an issue with either the TDF or the Stimulus file - experiment cannot continue");
                clearCardTimeout();
                leavePage("/profile");
                return;
            }

            //Update what we know about the session
            getUserProgress().currentSchedule = schedule;
            Session.set("currentUnitNumber", unit);
            Session.set("isScheduledTest", true);
            Session.set("questionIndex", 0);

            //Blank out things that should restart with a schedule
            Session.set("clusterIndex", undefined);
            Session.set("currentQuestion", undefined);
            Session.set("currentAnswer", undefined);
            Session.set("testType", undefined);
        }

        else if (action === "question") {
            //Read in previously asked question
            lastQuestionEntry = entry; //Always save the last question
            needFirstUnitInstructions = false;

            if (!entry.selType) {
                console.log("Ignoring user times entry question with no selType", entry);
                return;
            }

            //Restore the session variables we save with each question
            Session.set("clusterIndex",         entry.clusterIndex);
            Session.set("questionIndex",        entry.questionIndex);
            Session.set("currentUnitNumber",    entry.currentUnit);
            Session.set("currentQuestion",      entry.selectedQuestion);
            Session.set("currentAnswer",        entry.selectedAnswer);
            Session.set("showOverlearningText", entry.showOverlearningText);
            Session.set("testType",             entry.testType);

            var selType = Helpers.trim(entry.selType).toLowerCase();
            if (selType == "random") {
                //Currently nothing else needed
            }
            else if (selType == "schedule") {
                //Currently nothing else needed
            }
            else if (selType == "model") {
                //Perform the stats update on card selection and then override
                //with the saved data from the original question
                var cardIndex = entry.clusterIndex;
                if ((!cardIndex && cardIndex !== 0) || !entry.cardModelData) {
                    console.log("Missing cardIndex or cardModelData - model may not resume correctly", entry);
                }
                modelCardSelected(cardIndex);
                _.extend(getCardProbs().cards[cardIndex], entry.cardModelData);
            }
            else {
                console.log("Ignoring user times log entry for question with selType", selType);
            }
        }

        else if (action === "answer" || action === "[timeout]") {
            //Read in the previously recorded answer (even if it was a timeout)
            needCurrentInstruction = false; //Answer means they got past the instructions
            needFirstUnitInstructions = false;
            if (lastQuestionEntry === null) {
                console.log("Ignore answer for no question", entry);
                return;
            }

            //Did they get it right or wrong?
            var wasCorrect;
            if (action === "answer") {
                wasCorrect = typeof entry.isCorrect !== "undefined" ? entry.isCorrect : null;
                if (wasCorrect === null) {
                    console.log("Missing isCorrect on an answer - assuming false", entry);
                    wasCorrect = false;
                }
            }
            else {
                wasCorrect = false; //timeout is never correct
            }

            //Test type is always recorded with an answer, so we just reset it
            var testType = entry.ttype;
            Session.set("testType", testType);

            //The session variables should be set up correctly from the question
            recordProgress(
                Session.get("currentQuestion"),
                Session.get("currentAnswer"),
                entry.answer,
                wasCorrect
            );

            //If we are an ACT-R model, finish up calculations
            if (Session.get("usingACTRModel")) {
                modelCardAnswered(wasCorrect);
            }

            //We know the last question no longer applies
            lastQuestionEntry = null;
        }

        else {
            recordTimestamp = false; //Don't use the timestamp for this one
            console.log("Ignoring user times log entry with action", action);
        }

        if (recordTimestamp && entry.clientSideTimeStamp) {
            Session.set("lastTimestamp", entry.clientSideTimeStamp);
        }
    });

    //If we make it here, then we know we won't need a resume until something
    //else happens
    Session.set("needResume", false);

    if (needFirstUnitInstructions) {
        //They haven't seen our first instruction yet
        console.log("RESUME FINISHED: displaying initial instructions");
        leavePage("/instructions");
    }
    else if (!!lastQuestionEntry) {
        //Question outstanding: force question display and let them give an answer
        console.log("RESUME FINISHED: displaying current question");
        newQuestionHandler();
    }
    else {
        //We have an answer (or no questions at all) - run next question logic
        //Note that this will also handle new units, instructions, and whether
        //or not they are completed
        console.log("RESUME FINISHED: next-question logic to commence");
        prepareCard();
    }
}
