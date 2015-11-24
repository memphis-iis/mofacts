//  card.js - the implementation behind card.html (and thus
//  the main GUI implementation for MoFaCTS).
//
//  There is quite a bit of logic in this file, but most of it is commented locally.
//  One note to keep in mind that much of the direct access to the TDF and Stim
//  files has been abstracted out to places like currentTestingHelpers.js
//
//  This is important because that abstract is used to do things like support
//  multiple deliveryParam (the x-condition logic) and centralize some of the
//  checked that we do to make sure everything is functioning correctly.
//
//
//  Timeout logic overview
//  ------------------------
//
//  Currently we use the appropriate deliveryparams section. For scheduled trials
//  we use the deliveryparams of the current unit. Note that "x-conditions" can be
//  used to select from multiple deliveryparams in any unit.
//
//  All timeouts are specified in milliseconds and should be at least one (1).
//
//  There are two settings that correspond to what most people think of as the
//  "trial timeout". That is the amount of time that may elapse from the beginning
//  of a trial before the user runs out of time to answer (see the function
//  setQuestionTimeout):
//
//      purestudy - The amount of time a "study" trial is displayed
//
//      drill     - The amount of time a user has to answer a drill or test trial
//
//  There are two "timeouts" that are used after the user has answered (see
//  the function handleUserInput):
//
//      reviewstudy    - If a user answers a drill trial incorrectly, the correct
//                       answer is displayed for this long
//
//      correctprompt  - If a user gets a drill trial correct, the amount of time
//                       the feedback message is shown
//
//  Note that if the trial is "test", feedback is show for neither correct nor
//  incorrect responses.
//
//  Some TDF's contain legacy timeouts. For instance, timeuntilstimulus and
//  timebeforefeedback are not currently implemented.


////////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

var engine = null; //The unit engine for display (i.e. model or schedule)
var buttonList = new Mongo.Collection(null); //local-only - no database

function clearButtonList() {
    //In theory, they could put something without temp defined and we would
    //keep it for the session. In truth, we just want a field to specify in
    //the query.
    buttonList.remove({'temp': 1});
}

var unitStartTimestamp = 0;
var trialTimestamp = 0;
var keypressTimestamp = 0;
var currentQuestionSound = null; //See later in this file for sound functions

//We need to track the name/ID for clear and reset. We need the function and
//delay used for reset
var timeoutName = null;
var timeoutFunc = null;
var timeoutDelay = null;

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

Template.card.events({

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
        leavePage(statsPageUpdate); //In statsPage.js
    },

    'click #overlearningButton' : function (event) {
        event.preventDefault();
        leavePage("/profile");
    },

    'click .multipleChoiceButton' : function (event) {
        event.preventDefault();
        handleUserInput(event, "buttonClick");
    },

    'click #continueStudy': function(event) {
        event.preventDefault();
        handleUserInput(event, "buttonClick");
    },

    'click .instructModalDismiss': function(event) {
        event.preventDefault();
        $("#finalInstructionsDlg").modal('hide');
        if (Session.get("loginMode") === "experiment") {
            //Experiment user - no where to go?
            leavePage(routeToSignin);
        }
        else {
            //"regular" logged-in user - go back to home page
            leavePage("/profile");
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers and meteor events

Template.card.rendered = function() {
    if(Session.get("debugging")) {
        console.log('cards template rendered');
    }

    //Reset resizing for card images (see also index.js)
    $("#cardQuestionImg").load(function(evt) {
        redoCardImage();
    });

    //Always hide the final instructions box
    $("#finalInstructionsDlg").modal('hide');

    //the card loads frequently, but we only want to set this the first time
    if(Session.get("needResume")) {
        Session.set("buttonTrial", false);
        clearButtonList();

        console.log("cards template rendered => Performing resume");
        Session.set("showOverlearningText", false);

        Session.set("needResume", false); //Turn this off to keep from re-resuming
        resumeFromUserTimesLog();
    }
};

Template.card.helpers({
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

    clozeCard: function() {
        return getQuestionType() === "cloze";
    },

    textOrClozeCard: function() {
        var qt = getQuestionType();
        return qt === "text" || qt === "cloze";
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

    trial: function() {
        var type = getTestType();
        return type === "d" || type === "s" || type === "t";
    },

    testordrill: function() {
        var type = getTestType();
        return type === "d" || type === "t";
    },

    fontSizeClass: function() {
        // Take advantage of Bootstrap h1-h5 classes
        return 'h' + getCurrentFontSize().toString();
    },

    skipstudy: function() {
        return getCurrentDeliveryParams().skipstudy;
    },

    buttonTrial: function() {
        return Session.get("buttonTrial");
    },

    buttonList: function() {
        return buttonList.find({}, {sort: {idx: 1}});
    },

    currentScore: function() {
        return Session.get("currentScore");
    },
});


////////////////////////////////////////////////////////////////////////////
// Implementation functions


function newQuestionHandler() {
    console.log("NQ handler", (Date.now() - unitStartTimestamp||1) / 1000.0);

    var textFocus = false; //We'll set to true if needed

    var unitNumber = getCurrentUnitNumber();
    var file = getCurrentTdfFile();
    var currUnit = file.tdfs.tutor.unit[unitNumber];

    if (getButtonTrial()) {
        Session.set("buttonTrial", true);
        $("#textEntryRow").hide();

        var cluster = getStimCluster(getCurrentClusterIndex());

        //are we using specified choice order for buttons?
        //Or do we get them from the cluster?
        var buttonOrder = [];
        try {
            if (file && file.tdfs.tutor.unit[unitNumber].buttonorder) {
                var btnOrderTxt = file.tdfs.tutor.unit[unitNumber].buttonorder;
                buttonOrder = (btnOrderTxt + '').split(",");
                if (!buttonOrder || !buttonOrder.length) {
                    buttonOrder = []; //Just use empty array
                }
            }
        }
        catch (e) {
            console.log("Error find button order (will use []): " + e);
        }

        var choicesArray = [];

        if (buttonOrder.length > 1) {
            //Top-level specification for buttons
            choicesArray = buttonOrder;
        }
        else {
            //TODO: currentScheduledQInfo won't work with model unit
            //Specified in the scheduled stim cluster
            var currentSchedQuest = currentScheduledQInfo();
            if (!!currentSchedQuest && typeof currentSchedQuest.whichStim !== "undefined") {
                _.each(getCurrentFalseResponses(currentSchedQuest.whichStim), function(ele) {
                    choicesArray.push(ele);
                });
            }

            if (choicesArray.length < 1) {
                //Whoops - they didn't specify any alternate choices
                console.log("A button trial requires some false responses");
                throw new Error("Bad TDF or Stim file");
            }

            //Currently we only show 5 option button trials - so we only
            //use 4 false responses
            if (choicesArray.length > 3) {
                if (buttonOrder[0] === "random") {
                    Helpers.shuffle(choicesArray);
                }
                choicesArray = choicesArray.splice(0, 5);
            }

            //Need to make sure they also have a correct option :)
            var correctAnswer = Answers.getDisplayAnswerText(Session.get("currentAnswer"));
            if (!!correctAnswer) {
                choicesArray.unshift(correctAnswer);
            }
            if (buttonOrder[0] === "random") {
                Helpers.shuffle(choicesArray);
            }
        }

        clearButtonList();
        Session.set("buttonTrial", true);

        _.each(choicesArray, function(val, idx) {
            buttonList.insert({
                temp: 1,         //Deleted when clearing
                idx: idx,        //Will be ordered by array index
                buttonName: val, //Currently, name and value are the same
                buttonValue: val
            });
        });
    }
    else {
        //Not a button trial
        clearButtonList();
        Session.set("buttonTrial", false);
        textFocus = true; //Need the text box focused
        $("#textEntryRow").show();
    }

    //If this is a study-trial and we are displaying a cloze, then we should
    //construct the question to display the actual information. Note that we
    //use a regex so that we can do a global(all matches) replace on 3 or
    //more underscores
    if (getTestType() === "s" && getQuestionType() === "cloze") {
        Session.set("currentQuestion", Answers.clozeStudy(
            Session.get("currentQuestion"),
            Session.get("currentAnswer")
        ));
    }

    setQuestionTimeout();

    if (Session.get("showOverlearningText")) {
        $("#overlearningRow").show();
    }

    //No user input (re-enabled below) and reset keypress timestamp.
    stopUserInput();
    keypressTimestamp = 0;
    trialTimestamp = Date.now();

    if(getQuestionType() === "sound") {
        //We don't allow user input until the sound is finished playing
        playCurrentQuestionSound(function() {
            allowUserInput(textFocus);
        });
    }
    else {
        //Not a sound - can unlock now for data entry now
        allowUserInput(textFocus);
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
        userAnswer = _.trim($('#userAnswer').val()).toLowerCase();
    }
    else if (source === "buttonClick") {
        userAnswer = e.currentTarget.name;
    }

    //Show user feedback and find out if they answered correctly
    //Note that userAnswerFeedback will display text and/or media - it is
    //our responsbility to decide when to hide it and move on
    var isCorrect = userAnswerFeedback(userAnswer, isTimeout);

    //Note that we must provide the client-side timestamp since we need it...
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

    //Figure out button trial entries
    var buttonEntries = "";
    var wasButtonTrial = !!Session.get("buttonTrial");
    if (wasButtonTrial) {
        buttonEntries = _.map(
            buttonList.find({}, {sort: {idx: 1}}).fetch(),
            function(val) { return val.buttonValue; }
        ).join(',');
    }

    //Note that we need to log from data in the cluster returned from
    //getStimCluster so that we honor cluster mapping
    var currCluster = getStimCluster(getCurrentClusterIndex());

    //Figure out the review latency we should log
    var reviewLatency = 0;
    if (getTestType() === "d" && !isCorrect) {
        reviewLatency = _.intval(getCurrentDeliveryParams().reviewstudy);
    }

    //Now actually log the answer they gave (or the timeout)
    recordUserTime(isTimeout ? "[timeout]" : "answer", {
        questionIndex: Session.get("questionIndex"),
        index: currCluster.clusterIndex,
        shufIndex: currCluster.shufIndex,
        ttype: getTestType(),
        qtype: findQTypeSimpified(),
        guiSource: source,
        answer: userAnswer,
        isCorrect: isCorrect,
        trialStartTimestamp: trialTimestamp,
        clientSideTimeStamp: timestamp,
        firstActionTimestamp: firstActionTimestamp,
        startLatency: startLatency,
        endLatency: endLatency,
        wasButtonTrial: wasButtonTrial,
        buttonOrder: buttonEntries,
        inferredReviewLatency: reviewLatency,
        displayedSystemResponse: $("#UserInteraction").text() || ""
    });

    //record progress in userProgress variable storage (note that this is
    //helpful and used on the stats page, but the user times log is the
    //"system of record"
    recordProgress(Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer, isCorrect);

    //timeout for adding a small delay so the User may read
    //the correctness of his/her answer
    $("#UserInteraction").show();

    //Figure out timeout and reviewLatency
    var deliveryParams = getCurrentDeliveryParams();
    var timeout = 0;
    var file = getCurrentTdfFile();

    if (getTestType() === "s") {
        //Just a study - note that the purestudy timeout is used for the QUESTION
        //timeout, not the display timeout after the ANSWER. However, we need a
        //timeout for our logic below so just use the minimum
        timeout = 1;
    }
    else if (getTestType() === "t") {
        //A test - we don't have timeouts since they don't get feedback about
        //how they did (that's what drills are for)
        timeout = 1;
    }
    else if (getTestType() === "d") {
        //Drill - the timeout depends on how they did
        if (isCorrect) {
            timeout = _.intval(deliveryParams.correctprompt);
        }
        else {
            timeout = _.intval(deliveryParams.reviewstudy);
        }
    }
    else {
        //We don't know what to do since this is an unsupported test type - fail
        failNoDeliveryParams("Unknown trial type was specified - no way to proceed");
        return;
    }

    //We need at least a timeout of 1ms
    if (timeout < 1) {
        failNoDeliveryParams("No correct timeout specified");
        return;
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

function getButtonTrial() {
    //Default to false
    var isButtonTrial = false;

    //TODO: this won't work for model units

    var progress = getUserProgress();
    if (progress && progress.currentSchedule) {
        //We are scheduled that means the schedule knows if we are a button trial
        //AND the current schedule question info may override that setting
        var questInfo = currentScheduledQInfo();
        if (questInfo && questInfo.forceButtonTrial) {
            isButtonTrial = true;  //Override for one q
        }
        else if (!!progress.currentSchedule.isButtonTrial) {
            isButtonTrial = true;  //Entire schedule is a button trial
        }
    }

    return isButtonTrial;
}

//Take care of user feedback - and return whether or not the user correctly
//answered the question
function userAnswerFeedback(userAnswer, isTimeout) {
    var isCorrect = null;

    //Nothing to evaluate - it was a study. To make things easier, we just
    //pretend they answered exactly correct
    if (getTestType() === "s") {
        isCorrect = true;
        isTimeout = false;
    }

    //Helpers for correctness logic below
    var isDrill = (getTestType() === "d");
    var handleAnswerState = function(goodNews, msg) {
        isCorrect = goodNews;
        if (isDrill) {
            showUserInteraction(goodNews, msg);
        }
    };

    var correctAndText;

    var setspec = null;
    if (!getButtonTrial()) {
        setspec = getCurrentTdfFile().tdfs.tutor.setspec[0];
    }

    //How was their answer?
    if (!!isTimeout) {
        //Timeout - doesn't matter what the answer says!
        correctAndText = Answers.answerIsCorrect("", Session.get("currentAnswer"), setspec);
        handleAnswerState(false, "Sorry - time ran out. " + correctAndText[1]);
    }
    else if (isCorrect) {
        //We've already marked this as a correct answer
        handleAnswerState(true, "Please study the answer");
    }
    else {
        correctAndText = Answers.answerIsCorrect(userAnswer, Session.get("currentAnswer"), setspec);
        handleAnswerState(correctAndText[0], correctAndText[1]);
    }

    //Give unit engine a chance to update any necessary stats
    engine.cardAnswered(isCorrect);

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

    if (Session.get("questionIndex") === undefined) {
        //At this point, a missing question index is assumed to mean "start
        //with the first question"
        Session.set("questionIndex", 0);
    }

    var questionIndex = Session.get("questionIndex");
    var unit = getCurrentUnitNumber();
    console.log("prepareCard for Schedule (Unit,QIdx)=", unit, questionIndex);

    if (!engine.unitFinished()) {
        //We have another card to show...
        var selReturn = engine.selectNextCard();
        engine.selectedCard(selReturn);
        engine.writeQuestionEntry();
        newQuestionHandler();
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

//TODO: this only works for schedules
//Return the current q info in the schedule - note that we don't check to make
//sure that the caller SHOULD be calling us
function currentScheduledQInfo() {
    //Note that scheduledCard increments questionIndex - so we subtract
    //one. Also note that this is whay scheduledCard doesn't call us
    return getSchedule().q[Session.get("questionIndex") - 1];
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

    // Note that we track the score in the user progress object, but we
    // copy it to the Session object for template updates
    scoring = getCurrentScoreValues();  // in format [correct, incorrect]
    var oldScore = _.intval(prog.currentScore);
    var newScore = oldScore + (isCorrect ? scoring[0] : -scoring[1]);
    prog.currentScore = newScore;
    Session.set("currentScore", prog.currentScore);
}

function failNoDeliveryParams(customMsg) {
    var errMsg;

    if (typeof customMsg !== "undefined") {
        errMsg = customMsg;
    }
    else {
        errMsg = "There were no available delivery params to check for timeout values. ";
        if (Session.get("isScheduledTest")) {
            errMsg += "The current unit is missing a delivery params section";
        }
        else {
            errMsg += "There is no top-level delivery params section for learning sessions";
        }
    }

    console.log(errMsg);
    alert(errMsg); //Note that we actually show an alert
    clearCardTimeout();
    clearPlayingSound();
    throw new Error("The current TDF is malformed");
}

function setQuestionTimeout() {
    clearCardTimeout(); //No previous timeout now

    var delayMs = 0;

    //If this is scheduled TDF and the current test is a study, use the timeout
    //for purestudy for the current unit. Otherwise use the top-level setspec
    //timeout in seconds

    var deliveryParams = getCurrentDeliveryParams();
    if (!deliveryParams) {
        failNoDeliveryParams();
        return;
    }

    console.log("setQuestionTimeout deliveryParams", JSON.stringify(deliveryParams));

    if (getTestType() === "s") {
        //Study
        delayMs = _.intval(deliveryParams.purestudy);
    }
    else {
        //Not study - must be drill or test
        delayMs = _.intval(deliveryParams.drill);
    }

    if (delayMs < 1) {
        failNoDeliveryParams("Could not find appropriate question timeout");
    }

    beginMainCardTimeout(delayMs, function() {
        stopUserInput();
        handleUserInput({}, "timeout");
    });
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

function allowUserInput(textFocus) {
    $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled", false);

    if (typeof textFocus !== "undefined" && !!textFocus) {
        try {
            $("#userAnswer").focus();
        }
        catch(e) {
            //Nothing to do
        }
    }
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

    var previousRecords = {};
    var records = [];

    for(var i = 0; i < entries.length; ++i) {
        var rec = entries[i];

        //Suppress duplicates like we do on the server side for file export
        var uniqifier = rec.action + ':' + rec.clientSideTimeStamp;
        if (uniqifier in previousRecords) {
            continue; //dup detected
        }
        previousRecords[uniqifier] = true;

        //We don't do much other than save the record
        records.push(rec);
    }

    return records;
}

//ONLY ONE RESUME CAN RUN AT A TIME - we set this at the beginng of resumeFromUserTimesLog
//and then unset it after a callback from the server succeeds. AS A RESULT, unhandled
//exception in resumeFromUserTimesLog will break our resume logic until the user has
//reloaded the page and started over. This is actually a good thing, since a broken resume
//should stop us cold.
var inResume = false;

//Re-initialize our User Progress and Card Probabilities internal storage
//from the user times log. Note that most of the logic will be in
//processUserTimesLog. This function just does some initial set up, insures
//that experimental conditions are correct, and uses processUserTimesLog as
//a callback. This callback pattern is important because it allows us to be
//sure our server-side call regarding experimental conditions has completed
//before continuing to resume the session
function resumeFromUserTimesLog() {
    if (inResume) {
        console.log("RESUME DENIED - already running in resume");
        return;
    }
    inResume = true;

    console.log("Resuming from previous User Times info (if any)");

    //Clear any previous permutation and/or timeout call
    clearCardTimeout();
    keypressTimestamp = 0;
    trialTimestamp = 0;
    unitStartTimestamp = Date.now();

    //Clear any previous session data about unit/question/answer
    Session.set("clusterMapping", undefined);
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

    var userTimesLog = getCurrentUserTimesLog();

    //We must always check for experiment condition
    if (needExpCondition) {
        console.log("Experimental condition is required: searching");
        var prevCondition = _.find(userTimesLog, function(entry) {
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

    //Now we can create our record for the server - note that we use an array
    //since we might add other records below
    var serverRecords = [createUserTimeRecord(conditionAction, conditionData)];

    //In addition to experimental condition, we allow a root TDF to specify
    //that the xcond parameter used for selecting from multiple deliveryParms's
    //is to be system assigned (as opposed to URL-specified)
    if (setspec.randomizedDelivery && setspec.randomizedDelivery.length) {
        console.log("xcond for delivery params is sys assigned: searching");
        var prevXCond = _.find(userTimesLog, function(entry) {
            return entry && entry.action && entry.action === "xcondassign";
        });

        var xcondAction, xcondValue;

        if (prevXCond) {
            //Found it!
            console.log("Found previous xcond for delivery");
            xcondAction = "xcondnotify";
            xcondValue = prevXCond.xcond;
        }
        else {
            //Not present - we need to select one
            console.log("NO previous xcond for delivery - selecting one");
            xcondAction = "xcondassign";
            var xcondCount = _.intval(_.first(setspec.randomizedDelivery));
            xcondValue = Math.floor(Math.random() * xcondCount);
        }

        console.log("Setting XCond from sys-selection", xcondValue);
        Session.set("experimentXCond", xcondValue);

        serverRecords.push(createUserTimeRecord(xcondAction, {'xcond':xcondValue}));
    }

    //Find previous cluster mapping (or create if it's missing)
    //Note that we need to wait until the exp condition is selected above so
    //that we go to the correct TDF
    var clusterMapping = _.find(userTimesLog, function(entry) {
        return entry && entry.action && entry.action === "cluster-mapping";
    });
    if (!clusterMapping) {
        //No cluster mapping! Need to create it and store for resume
        //We process each pair of shuffle/swap together and keep processing
        //until we have nothing left
        var setSpec = getCurrentTdfFile().tdfs.tutor.setspec[0];

        //Note our default of a single no-op to insure we at least build a
        //default cluster mapping
        var shuffles = setSpec.shuffleclusters || [""];
        var swaps = setSpec.swapclusters || [""];
        clusterMapping = [];

        while(shuffles.length > 0 || swaps.length > 0) {
            clusterMapping = createStimClusterMapping(
                getStimClusterCount(),
                shuffles.shift() || "",
                swaps.shift() || "",
                clusterMapping
            );
        }

        serverRecords.push(createUserTimeRecord("cluster-mapping", {
            clusterMapping: clusterMapping
        }));

        console.log("Cluster mapping created", clusterMapping);
    }
    else {
        //Found the cluster mapping record - extract the embedded mapping
        clusterMapping = clusterMapping.clusterMapping;
        console.log("Cluster mapping found", clusterMapping);
    }

    if (!clusterMapping || !clusterMapping.length || clusterMapping.length !== getStimClusterCount()) {
        console.log("Invalid cluster mapping", getStimClusterCount(), clusterMapping);
        throw "The cluster mapping is invalid - can not continue";
    }

    //Go ahead and save the cluster mapping we found/created
    Session.set("clusterMapping", clusterMapping);

    //Notice that no matter what, we log something about condition data
    //ALSO NOTICE that we'll be calling processUserTimesLog after the server
    //returns and we know we've logged what happened
    recordUserTimeMulti(serverRecords, function() {
        processUserTimesLog();
        inResume = false; //Can finally turn off resume protection
    });
}

//We process the user times log, assuming resumeFromUserTimesLog has properly
//set up the TDF/Stim session variables
function processUserTimesLog() {
    //Get TDF info
    var file = getCurrentTdfFile();
    var tutor = file.tdfs.tutor;

    //Don't assume a particular unit type
    Session.set("usingACTRModel", false);
    Session.set("isScheduledTest", false);

    var currentStimName = getCurrentStimName();

    //Before the below options, reset current test data
    initUserProgress({
        progressDataArray: [],
        currentSchedule: {}
    });

    //Default to first unit
    Session.set("currentUnitNumber", 0);

    //We'll be tracking the last question so that we can match with the answer
    var lastQuestionEntry = null;

    //prepareCard will handle whether or not new units see instructions, but
    //it will miss instructions for the very first unit. Note that we only need
    //to worry about this if we actually have units
    var needFirstUnitInstructions = tutor.unit && tutor.unit.length;

    //Helper to determine if a unit specified by index has the given field
    var unitHasOption = function(unitIdx, optionName) {
        return null !== _.chain(file.tdfs.tutor)
            .prop("unit").prop(unitIdx)
            .prop(optionName).first().value();
    };

    //At this point, our state is set as if they just started this learning
    //session for the first time. We need to loop thru the user times log
    //entries and update that state
    _.each(getCurrentUserTimesLog(), function(entry, index) {
        if (!entry.action) {
            console.log("Ignoring user times entry with no action");
            return;
        }

        //Only examine the messages that we care about
        var action = _.trim(entry.action).toLowerCase();

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

                //Now we need to select an engine
                var checkUnit = _.chain(file.tdfs.tutor).prop("unit").prop(instructUnit).value();
                if (unitHasOption(instructUnit, "assessmentsession")) {
                    engine = createScheduleUnit();
                }
                else if (unitHasOption(instructUnit, "learningsession")) {
                    engine = createModelUnit();
                }
                else {
                    engine = createEmptyUnit();
                }
            }
        }

        else if (action === "turk-approval" || action === "turk-bonus") {
            //Currently just walk on by (but we don't log an "ignored this" msg)
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
            //REMEMBER - the logged card had its mapped index logged as
            //clusterIndex, but we use the UN-mapped index right up until we
            //send the log or access a stimulus cluster. Luckily the unmapped
            //index should have been logged as shufIndex. Note that if there
            //isn't a shufIndex, we just use the clusterIndex
            var cardIndex = entry.shufIndex || entry.clusterIndex;

            Session.set("clusterIndex",         cardIndex);
            Session.set("questionIndex",        entry.questionIndex);
            Session.set("currentUnitNumber",    entry.currentUnit);
            Session.set("currentQuestion",      entry.selectedQuestion);
            Session.set("currentAnswer",        entry.selectedAnswer);
            Session.set("showOverlearningText", entry.showOverlearningText);
            Session.set("testType",             entry.testType);

            //Note that this will currently only do something for model units
            if (engine.unitType === "model") {
                engine.cardSelected(cardIndex);
                _.extend(getCardProbs().cards[cardIndex], entry.cardModelData);
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

            //Notify unit engine about card answer
            engine.cardAnswered(wasCorrect);

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
