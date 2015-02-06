////////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

var currentQuestionSound = null;

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
        statsPageTemplateUpdate(); //In statsPageTemplate.js
        leavePage("stats");
    },

    'click #overlearningButton' : function (event) {
        event.preventDefault();
        leavePage("profile");
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

    invokeAfterLoad: function() {
        if(Session.get("debugging")) {
            console.log('invokeAfterLoad init');
        }

        //the card loads frequently, but we only want to set this the first time
        if(Session.get("needResume")) {
            console.log("invokeAfterLoad => Performing resume");
            Session.set("showOverlearningText", false);
            resumeFromUserTimesLog();
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
        var file = getCurrentTdfFile();
        var currUnit = file.tdfs.tutor.unit[unitNumber];
        var schedule = getSchedule();

        if (schedule && schedule.isButtonTrial) {
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

    if(AllowTimeouts) {
        timeoutCount++;
        var length = getUserProgress().progressDataArray.length;
        timeoutfunction(length);
    }

    if(getQuestionType() === "sound"){
        playCurrentQuestionSound();
    }

    if (Session.get("showOverlearningText")) {
        $("#overlearningRow").show();
    }

    //All ready - time to allow them to enter data
    allowUserInput();
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
function playCurrentQuestionSound() {
    //We currently only play one sound at a time
    clearPlayingSound();

    //Reset sound and play it
    currentQuestionSound = new Howl({
        urls: [
            Session.get("currentQuestion") + '.mp3',
            Session.get("currentQuestion") + '.wav'
        ],

        onplay: function() {
            currentQuestionSound.isCurrentlyPlaying = true;
        },

        onend: function() {
            currentQuestionSound.isCurrentlyPlaying = false;
        },
    });

    //In case our caller checks before the sound has a chance to load, we
    //mark the howler instance as playing
    currentQuestionSound.isCurrentlyPlaying = true;
    currentQuestionSound.play();
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

    //Timer stats
    var nowTime = getCurrentTimer();
    var elapsed = nowTime - start;
    var elapsedOnRender = nowTime - startOnRender;

    //Reset elapsed for blank answer or button click?
    if (userAnswer === "" || source === "buttonClick"){
        elapsed = 0;
    }

    //Show user feedback and find out if they answered correctly
    //Note that userAnswerFeedback will display text and/or media - it is
    //our responsbility to decide when to hide it and move on
    var isCorrect = userAnswerFeedback(answer, userAnswer);

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

    //record progress in userProgress variable storage (note that this is
    //helpful and used on the stats page, but the user times log is the
    //"system of record"
    recordProgress(index, Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer, isCorrect);

    if (Session.get("usingACTRModel")) {
        getCardProbs().numQuestionsAnswered += 1;
        calculateCardProbabilities();
    }

    //Reset timer for next question
    start = getCurrentTimer();

    //timeout for adding a small delay so the User may read
    //the correctness of his/her answer
    $("#UserInteraction").show();

    //Figure out timeout
    var timeout = 0;
    if (!isCorrect && getTestType() === "d" && Session.get("isScheduledTest")) {
        //They got the answer wrong on a drill in a scheduled test, so we need
        //to check the unit for review study time.
        try {
            var file = getCurrentTdfFile();
            var unit = file.tdfs.tutor.unit[getCurrentUnitNumber()];
            timeout = Helpers.intVal(unit.deliveryparams[0].reviewstudy[0]);
        }
        catch(err) {
            if (Session.get("debugging")) {
                console.log("Issue finding unit/deliveryparams/reviewstudy", err);
            }
        }
    }

    //If not timeout, default to 2 seconds so they can read the message
    if (!timeout || timeout < 1) {
        //Default to 2 seconds and add a second if sound is playing
        timeout = 2000;
        if (currentQuestionSound && currentQuestionSound.isCurrentlyPlaying) {
            timeout += 1000;
        }
    }

    clearCardTimeout();
    timeoutName = Meteor.setTimeout(function() {
        prepareCard();
        $("#userAnswer").val("");
        hideUserInteraction();
    }, timeout);
}

//Take care of user feedback - and return whether or not the user correctly
//answered the question
function userAnswerFeedback(answer, userAnswer) {
    //Nothing to evaluate
    if (getTestType() === "s") {
        return null;
    }

    var isCorrect = null;

    answer = Helpers.trim(answer.toLowerCase());
    userAnswer = Helpers.trim(userAnswer.toLowerCase());

    var isDrill = (getTestType() === "d");
    var isSound = (getQuestionType() === "sound");

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
    if (userAnswer.localeCompare(answer) === 0) {
        //Right
        handleAnswerState(true, "Correct - Great Job!");
    }
    else if (!isButtonTrial) {
        //Not exact, but if they are entering text, they might be close enough
        var editDistScore = 1.0 - (
            getEditDistance(userAnswer, answer) /
            Math.max(userAnswer.length, answer.length)
        );
        if(editDistScore > 0.75) {
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
        var cp = getCardProbs();
        if (isCorrect) cp.questionSuccessCount += 1;
        else           cp.questionFailureCount += 1;
    }

    //If they are incorrect on a drill, we might need to do extra work for
    //their review period
    if (isDrill && !isCorrect) {
        //Cheat and inject a review message
        $("#UserInteraction").append($("<p>&nbsp;</p><p class='text-danger'>Please Review</p>"));
        //If necessary, replay the sound
        if (isSound) {
            playCurrentQuestionSound();
        }
    }

    return isCorrect;
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
            var newUnit = unit + 1;
            Session.set("currentUnitNumber", newUnit);

            if (newUnit < file.tdfs.tutor.unit.length) {
                //Just hit a new unit - we need to restart with instructions
                console.log("UNIT FINISHED: show instructions for next unit", newUnit);
                leavePage("instructions");
            }
            else {
                //We have run out of units
                console.log("UNIT FINISHED: No More Units");
                statsPageTemplateUpdate(); //In statsPageTemplate.js
                leavePage("stats");
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
    Session.set("currentQuestion", getStimQuestion(nextCardIndex, 1));
    Session.set("currentAnswer", getStimAnswer(nextCardIndex, 1));

    recordUserTimeQuestion({
        selType: "random"
    });

    newQuestionHandler();
}

function getStimCluster(index) {
    var file = Stimuli.findOne({fileName: getCurrentStimName()});
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

function getCurrentStimName() {
    return Session.get("currentStimName");
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

function recordProgress(questionIndex, question, answer, userAnswer, isCorrect) {
    var uid = Meteor.userId();
    if (!uid) {
        return;
    }

    var prog = getUserProgress();
    prog.progressDataArray.push({
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
            statsPageTemplateUpdate(); //In statsPageTemplate.js
            leavePage("stats");
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

function timeoutfunction(index) {
    var progress = getUserProgress();

    var length = 0;
    if (progress.progressDataArray && progress.progressDataArray.length) {
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
                ttype: getTestType(),
                guiSource: "[timeout]",
                answer: "[timeout]",
                delay: delay,
                elapsed: elapsed,
                elapsedOnRender: elapsedOnRender,
                isCorrect: false,
            });

            if (getTestType() === "d") {
                showUserInteraction(false, "Timed out! The correct answer is: " + Session.get("currentAnswer"));
            }

            recordProgress(getCurrentClusterIndex(), Session.get("currentQuestion"), Session.get("currentAnswer"), "[TIMEOUT]", false);

            if (Session.get("usingACTRModel")) {
                var currIndex = getCurrentClusterIndex();
                var cardProbs = getCardProbs();
                cardProbs.numQuestionsAnswered += 1;
                cardProbs.cards[currIndex].questionFailureCount += 1;
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



//Re-initialize our User Progress and Card Probabilities internal storage
//from the user times log.
function resumeFromUserTimesLog() {
    console.log("Resuming from previous User Times info (if any)");

    //Clear any previous permutation and/or timeout call
    clearCardTimeout();
    clearCardPermuted();

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

    //Before the below options, reset current test data
    initUserProgress({
        currentStimuliTest: getCurrentStimName(),
        currentTestMode: (tutor.unit && tutor.unit.length ? "SCHEDULED" : "RANDOM"),
        progressDataArray: [],
        currentSchedule: {}
    });

    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });

    var currentStimName = Session.get("currentStimName");
    if (!currentStimName) {
        currentStimName = "NO_CURRENT_STIMULUS_FILE";
    }
    var expKey = currentStimName.replace(/\./g, "_");

    var entries = [];
    if (userLog && userLog[expKey] && userLog[expKey].length) {
        entries = userLog[expKey];
    }

    //We'll be tracking the last question so that we can match with the answer
    var lastQuestionEntry = null;

    //prepareCard will handle whether or not new units see instructions, but
    //it will miss instructions for the very first unit. Note that we only need
    //to worry about this if we actually have units
    var needFirstUnitInstructions = tutor.unit && tutor.unit.length;

    //TODO: when we add func to select a "sub-tdf" we'll need a user times
    //      entry (and logic for reading it back)

    //At this point, our state is set as if they just started this learning
    //session for the first time. We need to loop thru the user times log
    //entries and update that state
    _.each(entries, function(entry, index) {
        if (!entry.action) {
            console.log("Ignoring user times entry with no action");
            return;
        }

        //Only examine the messages that we care about
        var action = Helpers.trim(entry.action).toLowerCase();

        if (action === "instructions") {
            //They've been shown instructions for this unit
            needFirstUnitInstructions = false;
            var instructUnit = entry.currentUnit;
            if (!!instructUnit || instructUnit === 0) {
                Session.set("currentUnitNumber", instructUnit);
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
                statsPageTemplateUpdate(); //In statsPageTemplate.js
                leavePage("stats");
                return;
            }

            //Update what we know about the session
            getUserProgress().currentSchedule = schedule;
            Session.set("currentUnitNumber", unit);
            Session.set("isScheduledTest", true);
            Session.set("questionIndex", 0);
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
                getCurrentClusterIndex(),
                Session.get("currentQuestion"),
                Session.get("currentAnswer"),
                entry.answer,
                wasCorrect
            );

            //If we are an ACT-R model, finish up calculations
            if (Session.get("usingACTRModel")) {
                var cardProbs = getCardProbs();
                if (wasCorrect) cardProbs.questionSuccessCount += 1;
                else            cardProbs.questionFailureCount += 1;
                cardProbs.numQuestionsAnswered += 1;
                calculateCardProbabilities();
            }

            //We know the last question no longer applies
            lastQuestionEntry = null;
        }

        else {
            console.log("Ignoring user times log entry with action", action);
        }
    });

    //If we make it here, then we know we won't need a resume until something
    //else happens
    Session.set("needResume", false);

    if (needFirstUnitInstructions) {
        //They haven't seen our first instruction yet
        console.log("RESUME FINISHED: displaying initial instructions");
        leavePage("instructions");
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
