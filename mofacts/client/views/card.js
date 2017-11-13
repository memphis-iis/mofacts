/*
card.js - the implementation behind card.html (and thus
the main GUI implementation for MoFaCTS).

There is quite a bit of logic in this file, but most of it is commented locally.
One note to keep in mind that much of the direct access to the TDF and Stim
files has been abstracted out to places like currentTestingHelpers.js

This is important because that abstraction is used to do things like support
multiple deliveryParam (the x-condition logic) and centralize some of the
checks that we do to make sure everything is functioning correctly.


Timeout logic overview
------------------------

Currently we use the appropriate deliveryparams section. For scheduled trials
we use the deliveryparams of the current unit. Note that "x-conditions" can be
used to select from multiple deliveryparams in any unit.

All timeouts are specified in milliseconds and should be at least one (1).

There are two settings that correspond to what most people think of as the
"trial timeout". That is the amount of time that may elapse from the beginning
of a trial before the user runs out of time to answer (see the function
startQuestionTimeout):

purestudy - The amount of time a "study" trial is displayed

drill     - The amount of time a user has to answer a drill or test trial

There are two "timeouts" that are used after the user has answered (see
the function handleUserInput):

reviewstudy   - If a user answers a drill trial incorrectly, the correct
                answer is displayed for this long

correctprompt - If a user gets a drill trial correct, the amount of time
                the feedback message is shown

Note that if the trial is "test", feedback is show for neither correct nor
incorrect responses.

Some TDF's contain legacy timeouts. For instance, timeuntilstimulus and
timebeforefeedback are not currently implemented.


Simulation Overview
----------------------

If the current user is an admin or teacher, they may check the "Simulate if
TDF param present?" checkbox on the profile screen (located above the buttons
for the various user-visible TDF's). Doing so sets the runSimulation session
variable.

For each question displayed here, if the runSimulation session variable is
true, if the user is an admin or teacher, and if the TDF has the appropriate
parameters set then a simulation timeout will be set. When that timeout fires,
the system will simulate an answer. This behavior is controlled by the two TDF
parameters (which should be in the top-level setspec):

    * simTimeout - (integer) the number of milliseconds to wait before the
      answer is given.
    * simCorrectProb - (float) probability (0.0 < p <= 1.0) that the correct
      answer is given.

Then no simulation will take place if either parameter is:

    * Missing
    * Invalid (not interpretable as a number)
    * Less than or equal to zero


History Scrolling Overview
----------------------------

We provide scrollable history for units (it is turned off by default). To
turn it on, you need to set <showhistory>true</showhistory> in the
<deliveryparams> section of the unit where you want it on.
*/

////////////////////////////////////////////////////////////////////////////
// Global variables and helper functions for them

var engine = null; //The unit engine for display (i.e. model or schedule)
var buttonList = new Mongo.Collection(null); //local-only - no database
var scrollList = new Mongo.Collection(null); //local-only - no database
Session.set("scrollListCount", 0);

function clearButtonList() {
    //In theory, they could put something without temp defined and we would
    //keep it for the session. In truth, we just want a field to specify in
    //the query.
    buttonList.remove({'temp': 1});
    buttonList.remove({'temp': 2});  // Also delete the temp record
}

function clearScrollList() {
    scrollList.remove({'temp': 1});
    Session.set("scrollListCount", 0);
}

// IMPORTANT: this function assumes that the current state reflects a properly
// set up Session for the current question/answer information
function writeCurrentToScrollList(userAnswer, isTimeout, simCorrect, justAdded) {
    // We only store scroll history if it has been turned on in the TDF
    var params = getCurrentDeliveryParams();
    if (!params.showhistory) {
        return;
    }

    var isCorrect = null;
    var historyUserAnswer = "";
    var historyCorrectMsg = "";

    var correctAndText;

    var setspec = null;
    if (!getButtonTrial()) {
        setspec = getCurrentTdfFile().tdfs.tutor.setspec[0];
    }

    var trueAnswer = Answers.getDisplayAnswerText(Session.get("currentAnswer"));

    if (getTestType() === "s") {
        //Study trial
        isCorrect = true;
        historyUserAnswer = "You answered " + _.trim(userAnswer) + ".";
        historyCorrectMsg = trueAnswer;
    }
    else if (!!isTimeout) {
        //Timeout
        correctAndText = Answers.answerIsCorrect("", Session.get("currentAnswer"), setspec);
        isCorrect = false;
        historyUserAnswer = "You didn't answer in time.";
        historyCorrectMsg = correctAndText[1];
    }
    else if (typeof simCorrect === "boolean") {
        //Simulation! We know what they did
        isCorrect = simCorrect;
        historyUserAnswer = "Simulated answer where correct==" + simCorrect;
        historyCorrectMsg = Answers.getDisplayAnswerText(Session.get("currentAnswer"));
    }
    else {
        //"Regular" answers
        correctAndText = Answers.answerIsCorrect(userAnswer, Session.get("currentAnswer"), setspec);
        isCorrect = correctAndText[0];
        historyUserAnswer = "You answered " + _.trim(userAnswer) + ".";
        historyCorrectMsg = correctAndText[1];
    }

    var currCount = _.intval(Session.get("scrollListCount"));

    scrollList.insert({
        'temp': 1,                       // Deleted when clearing
        'justAdded': justAdded,          // All 1's set to 0 on next question
        'idx': currCount,                // Our ordering field
        'userAnswer': historyUserAnswer,
        'answer': trueAnswer,
        'shownToUser': historyCorrectMsg,
        'question': Session.get("currentQuestion"),
        'userCorrect': isCorrect
    }, function(err, newId) {
        if (!!err) {
            console.log("ERROR inserting scroll list member:", displayify(err));
        }
        Session.set("scrollListCount", currCount + 1);
    });
}

function scrollElementIntoView(selector, scrollType) {
    Meteor.setTimeout(function(){
        Tracker.afterFlush(function(){
            if (selector === null) {
                window.scrollTo(0, !!scrollType ? 0 : document.body.scrollHeight);
            }
            else {
                $(selector).get(0).scrollIntoView(!!scrollType ? true : false);
            }
            console.log("Scrolled for", selector, scrollType);
        });
    }, 1);
}

var timeoutsSeen = 0;  // Reset to zero on resume or non-timeout
var unitStartTimestamp = 0;
var trialTimestamp = 0;
var keypressTimestamp = 0;
var currentQuestionSound = null; //See later in this file for sound functions

//We need to track the name/ID for clear and reset. We need the function and
//delay used for reset
var timeoutName = null;
var timeoutFunc = null;
var timeoutDelay = null;
var varLenTimeoutName = null;
var simTimeoutName = null;

// Helper - return elapsed seconds since unit started. Note that this is
// technically seconds since unit RESUME began (when we set unitStartTimestamp)
function elapsedSecs() {
    if (!unitStartTimestamp) {
        return 0.0;
    }
    return (Date.now() - unitStartTimestamp) / 1000.0;
}

//Note that this isn't just a convenience function - it should be called
//before we route to other templates so that the timeout doesn't fire over
//and over
function clearCardTimeout() {
    var safeClear = function(clearFunc, clearParm) {
        try {
            if (!!clearParm) {
                clearFunc(clearParm);
            }
        }
        catch(e) {
            console.log("Error clearing meteor timeout/interval", e);
        }
    };
    safeClear(Meteor.clearTimeout, timeoutName);
    safeClear(Meteor.clearTimeout, simTimeoutName);
    safeClear(Meteor.clearInterval, varLenTimeoutName);

    timeoutName = null;
    timeoutFunc = null;
    timeoutDelay = null;
    simTimeoutName = null;
    varLenTimeoutName = null;
}

//Start a timeout count
//Note we reverse the params for Meteor.setTimeout - makes calling code much cleaner
function beginMainCardTimeout(delay, func) {
    clearCardTimeout();
    timeoutFunc = func;
    timeoutDelay = delay;
    timeoutName = Meteor.setTimeout(timeoutFunc, timeoutDelay);
    varLenTimeoutName = Meteor.setInterval(varLenDisplayTimeout, 400);
}

//Reset the previously set timeout counter
resetMainCardTimeout = function() {
    console.log("RESETTING MAIN CARD TIMEOUT");
    var savedFunc = timeoutFunc;
    var savedDelay = timeoutDelay;
    clearCardTimeout();
    beginMainCardTimeout(savedDelay, savedFunc);
}

//Set a special timeout to handle simulation if necessary
function checkSimulation() {
    if (!Session.get("runSimulation") ||
        !Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))
    {
        return;
    }

    var setspec = _.chain(getCurrentTdfFile())
        .prop("tdfs")
        .prop("tutor")
        .prop("setspec").first()
        .value();

    var simTimeout = _.chain(setspec).prop("simTimeout").intval(0).value();
    var simCorrectProb = _.chain(setspec).prop("simCorrectProb").floatval(0.0).value();

    if (simTimeout <= 0 || simCorrectProb <= 0.0) {
        return;
    }

    // If we we are here, then we should set a timeout to sim a correct answer
    var correct = Math.random() <= simCorrectProb;
    console.log("SIM: will simulate response with correct=", correct, "in", simTimeout);
    simTimeoutName = Meteor.setTimeout(function() {
        console.log("SIM: Fired!");
        simTimeoutName = null;
        handleUserInput({}, 'simulation', correct);
    }, simTimeout);
}

// Min and Max display seconds: if these are enabled, they determine
// potential messages, the continue button functionality, and may even move
// the screen forward.  This is nearly identical to the function of the same
// name in instructions.js (where we use two similar parameters)
function getDisplayTimeouts() {
    var session = _.chain(getCurrentTdfUnit()).prop("learningsession").first().value();
    return {
        'minSecs': _.chain(session).prop("displayminseconds").first().intval(0).value(),
        'maxSecs': _.chain(session).prop("displaymaxseconds").first().intval(0).value()
    };
}

function setDispTimeoutText(txt) {
    var msg = _.trim(txt || "");
    if (msg.length > 0) {
        msg = " (" + msg + ")";
    }
    $("#displayTimeoutMsg").text(msg);
}

function varLenDisplayTimeout() {
    if (!unitStartTimestamp) {
        return;
    }

    var display = getDisplayTimeouts();
    if (!(display.minSecs > 0.0 || display.maxSecs > 0.0)) {
        // No variable display parameters - we can stop the interval
        $("#continueButton").prop("disabled", false);
        setDispTimeoutText("");
        Meteor.clearInterval(varLenTimeoutName);
        varLenTimeoutName = null;
        return;
    }

    var elapsed = elapsedSecs();
    if (elapsed <= display.minSecs) {
        // Haven't reached min yet
        $("#continueButton").prop("disabled", true);
        dispLeft = display.minSecs - elapsed;
        if (dispLeft >= 1.0) {
            setDispTimeoutText("You can continue in: " + Date.secsIntervalString(dispLeft));
        }
        else {
            setDispTimeoutText(""); // Don't display 0 secs
        }
    }
    else if (elapsed <= display.maxSecs) {
        // Between min and max
        $("#continueButton").prop("disabled", false);
        dispLeft = display.maxSecs - elapsed;
        if (dispLeft >= 1.0) {
            setDispTimeoutText("Time remaining: " + Date.secsIntervalString(dispLeft));
        }
        else {
            setDispTimeoutText("");
        }
    }
    else if (display.maxSecs > 0.0) {
        // Past max and a max was specified - it's time to go
        $("#continueButton").prop("disabled", true);
        setDispTimeoutText("");
        unitIsFinished('DisplaMaxSecs exceeded');
    }
    else {
        // Past max and no valid maximum - they get a continue button
        $("#continueButton").prop("disabled", false);
        setDispTimeoutText("You can continue whenever you want");
    }
}

////////////////////////////////////////////////////////////////////////////
// Events

//Catch page navigation events (like pressing back button) so we can call our cleanup method
window.onpopstate = function(event){
  //console.log("back button pressed?" + document.location.pathname);
  leavePage(document.location.pathname);
}

//Clean up things if we navigate away from this page
function leavePage(dest) {
    //console.log("leave page, going to: " + dest);

    if(window.speechSynthesis.speaking){
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
    }
    if(window.audioContext && !(dest == "/card" || dest == "/instructions" || dest == "/voice")){
      console.log("closing audio context");
      stopRecording();
      window.audioContext.close();
    }else{
      console.log("NOT closing audio context");
    }
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
        handleUserInput(e , "keypress");
    },

    'keypress #userForceCorrect': function(e) {
        var key = e.keyCode || e.which;
        if (key == 13) {
            // Enter key - see if gave us the correct answer
            var entry = _.trim($("#userForceCorrect").val()).toLowerCase();
            var answer = Answers.getDisplayAnswerText(Session.get("currentAnswer")).toLowerCase();
            if (entry === answer) {
                var savedFunc = timeoutFunc;
                clearCardTimeout();
                savedFunc();
            }
            else {
                $("#userForceCorrect").val("");
                $("#forceCorrectGuidance").text("Incorrect - please enter '" + answer + "'");
                speakMessageIfAudioPromptFeedbackEnabled("Incorrect - please enter '" + answer + "'");
                startRecording();
            }
        }
        else {
            // "Normal" keypress - reset the timeout period
            resetMainCardTimeout();
        }
    },

    'click .statsPageLink' : function (event) {
        event.preventDefault();
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
    },

    'click #continueButton' : function (event) {
        event.preventDefault();
        unitIsFinished('Continue Button Pressed');
    },
});

////////////////////////////////////////////////////////////////////////////
// Template helpers and meteor events

Template.card.rendered = function() {
    var audioInputEnabled = Session.get("audioEnabled");
    //If user has enabled audio input initialize web audio (this takes a bit)
    //(this will eventually call cardStart after we redirect through the voice
    //interstitial and get back here again)
    if(audioInputEnabled && !Session.get("VADInitialized")){
      try {
        window.AudioContext = window.webkitAudioContext || window.AudioContext;
        window.URL = window.URL || window.webkitURL;
        audioContext = new AudioContext();

        // Older browsers might not implement mediaDevices at all, so we set an empty object first
        if (navigator.mediaDevices === undefined) {
          console.log("media devices undefined");
          navigator.mediaDevices = {};
        }

        // Some browsers partially implement mediaDevices. We can't just assign an object
        // with getUserMedia as it would overwrite existing properties.
        // Here, we will just add the getUserMedia property if it's missing.
        if (navigator.mediaDevices.getUserMedia === undefined) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            // First get ahold of the legacy getUserMedia, if present
            var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia || navigator.getUserMedia;

            // Some browsers just don't implement it - return a rejected promise with an error
            // to keep a consistent interface
            if (!getUserMedia) {
              return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
            }

            // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
            return new Promise(function(resolve, reject) {
              getUserMedia.call(navigator, constraints, resolve, reject);
            });
          }
        }

        navigator.mediaDevices.getUserMedia({ audio: true, video: false})
        .then(startUserMedia)
        .catch(function(err) {
          console.log("Error getting user media: " + err.name + ": " + err.message);
        });

      } catch (e) {
        console.log("Error initializing Web Audio browser");
      }
    }else{
      cardStart();
    }
};


Template.card.helpers({
    'isExperiment': function() {
        return Session.get("loginMode") === "experiment";
    },

    'isNormal': function() {
        return Session.get("loginMode") !== "experiment";
    },

    'username': function () {
        if (!haveMeteorUser()) {
            leavePage(routeToSignin);
        }
        else {
            return Meteor.user().username;
        }
    },

    'currentQuestion': function() {
        return Session.get("currentQuestion");
    },

    'displayAnswer': function() {
        return Answers.getDisplayAnswerText(Session.get("currentAnswer"));
    },

    'rawAnswer': function() {
        return Session.get("currentAnswer");
    },

    'currentProgress': function() {
        return Session.get("questionIndex");
    },

    'textCard': function() {
        return getQuestionType() === "text";
    },

    'audioCard': function() {
        return getQuestionType() === "sound";
    },

    'imageCard': function() {
        return getQuestionType() === "image";
    },

    'videoCard': function() {
        return getQuestionType() === "video";
    },

    'clozeCard': function() {
        return getQuestionType() === "cloze";
    },

    'textOrClozeCard': function() {
        var qt = getQuestionType();
        return qt === "text" || qt === "cloze";
    },

    'test': function() {
        return getTestType() === "t";
    },

    'study': function() {
        return getTestType() === "s";
    },

    'drill': function() {
        return getTestType() === "d";
    },

    'trial': function() {
        var type = getTestType();
        return type === "d" || type === "s" || type === "t";
    },

    'testordrill': function() {
        var type = getTestType();
        return type === "d" || type === "t";
    },

    'fontSizeClass': function() {
        // Take advantage of Bootstrap h1-h5 classes
        return 'h' + getCurrentFontSize().toString();
    },

    'skipstudy': function() {
        return getCurrentDeliveryParams().skipstudy;
    },

    'buttonTrial': function() {
        return Session.get("buttonTrial");
    },

    'buttonList': function() {
        return buttonList.find({'temp': 1}, {sort: {idx: 1}});
    },

    'haveScrollList': function() {
        return _.intval(Session.get("scrollListCount")) > 0;
    },

    'scrollList': function() {
        return scrollList.find({'temp': 1, 'justAdded': 0}, {sort: {idx: 1}});
    },

    'currentScore': function() {
        return Session.get("currentScore");
    },

    'haveDispTimeout': function() {
        var disp = getDisplayTimeouts();
        return (disp.minSecs > 0 || disp.maxSecs > 0);
    },

    'inResume': function() {
        return Session.get("inResume");
    },

    'audioEnabled' : function(){
      return Session.get("audioEnabled");
    }
});


////////////////////////////////////////////////////////////////////////////
// Implementation functions

cardStart = function(){
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
}

function nextChar(c) {
    return String.fromCharCode(c.charCodeAt(0) + 1);
}

function newQuestionHandler() {
    console.log("newQuestionHandler - Secs since unit start:", elapsedSecs());

    var textFocus = false; //We'll set to true if needed

    var unitNumber = getCurrentUnitNumber();
    var file = getCurrentTdfFile();
    var currUnit = file.tdfs.tutor.unit[unitNumber];

    // Whatever happens next, no scolling history is "justAdded"
    scrollList.update(
        {'justAdded': 1},           // Query
        {'$set': {'justAdded': 0}}, // Operation
        {'multi': true},            // Options
        function(err, numrecs) {    // Callback
            if (!!err) {
                console.log("UDPATE ERROR:", displayify(err));
            }
        }
    );

    // Change buttonTrial to neither true nor false to try and stop a spurious
    // "update miss" in our templating
    Session.set("buttonTrial", null);

    // Buttons are determined by 3 options: buttonorder, wrongButtonOptions,
    // wrongButtonCount:
    //
    // 1. buttonorder - can be "fixed" or "random" with a default of fixed.
    //
    // 2. wrongButtonOptions - the list of button labels to use. If empty the
    //    button labels will be taken from the current stim cluster.
    //
    // 3. wrongButtonCount - The number of WRONG buttons to display (so final
    //    button is wrongButtonCount + 1 for the correct answer). This is ONLY
    //    used if buttonorder is random.
    //
    // For fixed order, we just use the button labels we find per #2 above. For
    // random order, we take wrongButtonOptions random buttons from the wrong button
    // labels, add in the correct answer, and shuffle the order of buttons.
    // IMPORTANT: the above implies that the correct answer must be in the button label
    // list if you use fixed button order and wrongButtonOptions. See the Music
    // TDF for an example.
    if (!getButtonTrial()) {
        //Not a button trial
        clearButtonList();
        Session.set("buttonTrial", false);
        textFocus = true; //Need the text box focused
        $("#textEntryRow").show();
    }
    else {
        // Is a button trial - we need to figure out what to show
        Session.set("buttonTrial", true);
        $("#textEntryRow").hide();

        var cluster = getStimCluster(getCurrentClusterIndex());
        var currentQuest = engine.findCurrentCardInfo();

        var buttonChoices = [];

        var buttonOrder = _.chain(currUnit).prop("buttonorder").first().trim().value().toLowerCase();
        if (buttonOrder !== "random") {
            //Only choices are random or fixed, and we def to fixed
            buttonOrder = "fixed";
        }

        var wrongButtonOptions = _.chain(currUnit).prop("wrongButtonOptions").first().trim().value();
        var optionsFromStim = null;
        if (wrongButtonOptions) {
            buttonChoices = wrongButtonOptions.split(",");
            optionsFromStim = false;
        }
        if (!buttonChoices || buttonChoices.length < 1) {
            buttonChoices = [];
            if (!!currentQuest && typeof currentQuest.whichStim !== "undefined") {
                _.each(getCurrentFalseResponses(currentQuest.whichStim), function(ele) {
                    buttonChoices.push(ele);
                });
                optionsFromStim = true;
            }
        }
        if (!buttonChoices || buttonChoices.length < 1) {
            //Whoops - they didn't specify any alternate choices
            console.log("A button trial requires some false responses");
            throw new Error("Bad TDF or Stim file - no answers found");
        }
        if (optionsFromStim === null) {
            console.log("A button trial requires correct configuration");
            throw new Error("Bad TDF or Stim file - could not determine answer location");
        }

        var wrongButtonCount = _.chain(currUnit).prop("wrongButtonOptions").first().intval().value();
        if (wrongButtonCount < 1) {
            wrongButtonCount = buttonChoices.length;
        }

        var correctAnswer = Answers.getDisplayAnswerText(Session.get("currentAnswer"));

        if (buttonOrder === "fixed") {
            // the buttonChoices array should be correct UNLESS they didn't use
            // wrongButtonOptions for this unit. In that case we are using the
            // answers from the stim file, so we need to add the correct answer
            if (optionsFromStim) {
                // Correct answer goes first
                buttonChoices.unshift(correctAnswer);
            }
        }
        else if (buttonOrder === "random") {
            // Randomized buttons: remove the correct answer, shuffle, keep only
            // wrongButtonCount options, add the correct answer back in, and
            // reshuffle
            var shuffled = _.reject(buttonChoices, function(one) {
                return one === correctAnswer;
            });
            Helpers.shuffle(shuffled);
            if (shuffled.length > wrongButtonCount) {
                shuffled = shuffled.splice(0, wrongButtonCount);
            }
            shuffled.push(correctAnswer);
            Helpers.shuffle(shuffled);
            buttonChoices = shuffled;
        }
        else {
            throw new Error("Unknown buttonorder option " + buttonOrder);
        }

        clearButtonList();
        Session.set("buttonTrial", true);
        var curChar = 'a'

        _.each(buttonChoices, function(val, idx) {
            buttonList.insert({
                temp: 1,         //Deleted when clearing
                idx: idx,        //Will be ordered by array index
                verbalChoice: curChar,
                buttonName: val, //Currently, name and value are the same
                buttonValue: val
            });
            curChar = nextChar(curChar);
        });
        // Insert a record that we'll never show
        buttonList.insert({temp: 2, uniq: Date.now()});
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

    startQuestionTimeout(textFocus);
    checkSimulation();

    if (Session.get("showOverlearningText")) {
        $("#overlearningRow").show();
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
            Session.get("currentQuestion") + '.ogg',
            Session.get("currentQuestion") + '.mp3',
            Session.get("currentQuestion") + '.wav',
        ],

        onplay: function() {
            if (currentQuestionSound) {
                currentQuestionSound.isCurrentlyPlaying = true;
            }
            console.log("Sound played");
        },

        onend: function() {
            if (currentQuestionSound) {
                currentQuestionSound.isCurrentlyPlaying = false;
            }
            if (!!onEndCallback) {
                onEndCallback();
            }
            console.log("Sound completed");
        },
    });

    //In case our caller checks before the sound has a chance to load, we
    //mark the howler instance as playing
    currentQuestionSound.isCurrentlyPlaying = true;
    currentQuestionSound.play();
}

function handleUserInput(e, source, simAnswerCorrect) {
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
    else if (source === "buttonClick" || source === "simulation") {
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
    else if (source === "simulation") {
        userAnswer = simAnswerCorrect ? "SIM: Correct Answer" : "SIM: Wrong Answer";
    }

    //Show user feedback and find out if they answered correctly
    //Note that userAnswerFeedback will display text and/or media - it is
    //our responsbility to decide when to hide it and move on
    var isCorrect = userAnswerFeedback(userAnswer, isTimeout, simAnswerCorrect);

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

    //Set up to log the answer they gave. We'll call the function below at the
    //appropriate time
    var reviewBegin = Date.now();
    var answerLogAction = isTimeout ? "[timeout]" : "answer";
    var answerLogRecord = {
        'questionIndex': _.intval(Session.get("questionIndex"), -1),
        'index': _.intval(currCluster.clusterIndex, -1),
        'shufIndex': _.intval(currCluster.shufIndex, -1),
        'ttype': _.trim(getTestType()),
        'qtype':  _.trim(findQTypeSimpified()),
        'guiSource':  _.trim(source),
        'answer':  _.trim(userAnswer),
        'isCorrect': isCorrect,
        'trialStartTimestamp': trialTimestamp,
        'clientSideTimeStamp': timestamp,
        'firstActionTimestamp': firstActionTimestamp,
        'startLatency': startLatency,
        'endLatency': endLatency,
        'wasButtonTrial': wasButtonTrial,
        'buttonOrder': buttonEntries,
        'reviewLatency': 0,
        'inferredReviewLatency': reviewLatency,
        'wasSim': (source === "simulation") ? 1 : 0,
        'displayedSystemResponse': $("#UserInteraction").text() || "",
        'forceCorrectFeedback': ""
    };
    var writeAnswerLog = function() {
        var realReviewLatency = Date.now() - reviewBegin;
        if (realReviewLatency > 0) {
            answerLogRecord.reviewLatency = realReviewLatency;
        }
        //TODO: need a column for this in experiment_times
        answerLogRecord.forceCorrectFeedback = _.trim($("#userForceCorrect").val());
        recordUserTime(answerLogAction, answerLogRecord);
    };

    // Special: count the number of timeouts in a row. If autostopTimeoutThreshold
    // is specified and we have seen that many (or more) timeouts in a row, then
    // we leave the page. Note that autostopTimeoutThreshold defaults to 0 so that
    // this feature MUST be turned on in the TDF.
    if (!isTimeout) {
        timeoutsSeen = 0;  // Reset count
    }
    else {
        // Anothing timeout!
        timeoutsSeen++;

        // Figure out threshold (with default of 0)
        // Also note: threshold < 1 means no autostop at all
        var threshold = _.chain(getCurrentDeliveryParams())
            .prop("autostopTimeoutThreshold")
            .intval(0).value();

        if (threshold > 0 && timeoutsSeen >= threshold) {
            console.log("Hit timeout threshold", threshold, "Quitting");
            leavePage("/profile");
            return;  // We are totally done
        }
    }

    //record progress in userProgress variable storage (note that this is
    //helpful and used on the stats page, but the user times log is the
    //"system of record"
    recordProgress(Session.get("currentQuestion"), Session.get("currentAnswer"), userAnswer, isCorrect);

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
            writeAnswerLog();
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
    //Default to value given in the unit
    var isButtonTrial = "true" === _.chain(getCurrentTdfUnit())
        .prop("buttontrial").first()
        .trim().value().toLowerCase();

    var progress = getUserProgress();

    if (_.prop(engine.findCurrentCardInfo(), 'forceButtonTrial')) {
        //Did this question specifically override button trial?
        isButtonTrial = true;
    }
    else {
        // An entire schedule can override a button trial
        var schedButtonTrial = _.chain(progress)
            .prop("currentSchedule")
            .prop("isButtonTrial").value();
        if (!!schedButtonTrial) {
            isButtonTrial = true;  //Entire schedule is a button trial
        }
    }

    return isButtonTrial;
}

//Take care of user feedback - and return whether or not the user correctly
//answered the question. simCorrect will usually be undefined/null BUT if
//it is true or false we know this is part of a simulation call
function userAnswerFeedback(userAnswer, isTimeout, simCorrect) {
    var isCorrect = null;
    //Nothing to evaluate for a study - just pretend they answered correctly
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

    // How was their answer? (And note we only need to update historyUserAnswer
    // if it's not a "standard" )
    if (!!isTimeout) {
        //Timeout - doesn't matter what the answer says!
        correctAndText = Answers.answerIsCorrect("", Session.get("currentAnswer"), setspec);
        handleAnswerState(false, "Sorry - time ran out. " + correctAndText[1]);
    }
    else if (isCorrect) {
        //We've already marked this as a correct answer
        handleAnswerState(true, "Please study the answer");
    }
    else if (typeof simCorrect === "boolean") {
        //Simulation! We know what they did
        handleAnswerState(simCorrect, "Simulation");
    }
    else {
        correctAndText = Answers.answerIsCorrect(userAnswer, Session.get("currentAnswer"), setspec);
        handleAnswerState(correctAndText[0], correctAndText[1]);
    }

    //Make sure to record what they just did (and set justAdded)
    writeCurrentToScrollList(userAnswer, isTimeout, simCorrect, 1);

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
    if (Session.get("questionIndex") === undefined) {
        // At this point, a missing question index is assumed to mean "start
        // with the first question"
        Session.set("questionIndex", 0);
    }

    if (engine.unitFinished()) {
        unitIsFinished('Unit Engine');
    }
    else {
        // Not finished - we have another card to show...
        // Before we change anything, if we are showing an image we will change
        // it to a 1x1 pixel (so the old image doesn't stick around if there is
        // lag while loading the new image)
        $('#cardQuestionImg').attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
        // Actual next card logic
        var selReturn = engine.selectNextCard();
        engine.cardSelected(selReturn);
        engine.writeQuestionEntry(selReturn);
        newQuestionHandler();
    }
}

// Called when the current unit is done. This should be either unit-defined (see
// prepareCard) or user-initiated (see the continue button event and the var
// len display timeout function)
function unitIsFinished(reason) {
    clearCardTimeout();

    var file = getCurrentTdfFile();
    var unit = getCurrentUnitNumber();

    Session.set("questionIndex", 0);
    Session.set("clusterIndex", undefined);
    var newUnit = unit + 1;
    Session.set("currentUnitNumber", newUnit);
    Session.set("currentUnitStartTime", Date.now());

    var leaveTarget;
    if (newUnit < file.tdfs.tutor.unit.length) {
        //Just hit a new unit - we need to restart with instructions
        console.log("UNIT FINISHED: show instructions for next unit", newUnit);
        leaveTarget = "/instructions";
    }
    else {
        //We have run out of units - return home for now
        console.log("UNIT FINISHED: No More Units");
        leaveTarget = "/profile";
    }

    recordUserTime("unit-end", {
        'reason': reason,
        'currentUnit': newUnit - 1,  // Remember we just finished a unit
    }, function(error, result) {
        leavePage(leaveTarget);
    });
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
        errMsg = "The current unit is missing a delivery params section";
    }

    console.log(errMsg);
    alert(errMsg); //Note that we actually show an alert
    clearCardTimeout();
    clearPlayingSound();
    throw new Error("The current TDF is malformed");
}

function startQuestionTimeout(textFocus) {
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

    console.log("startQuestionTimeout deliveryParams", JSON.stringify(deliveryParams));

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

    var beginQuestionAndInitiateUserInput = function(){
      keypressTimestamp = 0;
      trialTimestamp = Date.now();

      var questionType = getQuestionType();

      if(questionType === "sound") {
          //We don't allow user input until the sound is finished playing
          playCurrentQuestionSound(function() {
              allowUserInput(textFocus);
          });
      }
      else {
          //console.log("current question: " + Session.get("currentQuestion"));
          //Only speak the prompt if the question type makes sense
          if(questionType === "text" || questionType === "cloze"){
            speakMessageIfAudioPromptFeedbackEnabled(Session.get("currentQuestion"),true);
          }
          //Not a sound - can unlock now for data entry now
          allowUserInput(textFocus);
      }

      beginMainCardTimeout(delayMs, function() {
          stopUserInput();
          handleUserInput({}, "timeout");
      });
    }

    //No user input (re-enabled below) and reset keypress timestamp.
    stopUserInput();

    var currentQuestionPart2 = Session.get("currentQuestionPart2");
    if(!!currentQuestionPart2){
      console.log("two part question detected, delaying for <initialview> ms then continuing with question");
      var initialviewTimeDelay = deliveryParams.initialview;
      setTimeout(function(){
        console.log("after timeout");
        Session.set("currentQuestion",currentQuestionPart2);
        Session.set("currentQuestionPart2",undefined);
        redoCardImage();
        beginQuestionAndInitiateUserInput();
      },initialviewTimeDelay);
    }else{
      console.log("one part question detected, continuing with question");
      beginQuestionAndInitiateUserInput();
    }
}

function showUserInteraction(isGoodNews, news) {
    // We know we always do this regardless of settings
    $("#UserInteraction")
        .removeClass("alert-success alert-danger")
        .addClass("text-align alert")
        .addClass(isGoodNews ? "alert-success" : "alert-danger")
        .text(news)
        .show();

    speakMessageIfAudioPromptFeedbackEnabled(news);

    // forceCorrection is now part of user interaction - we always clear the
    // textbox, but only show it if:
    // * They got the answer wrong somehow
    // * forceCorrection is true in the current delivery params
    // * we are NOT in a sim
    var doForceCorrect = !isGoodNews && getCurrentDeliveryParams().forceCorrection && !Session.get("runSimulation");
    Tracker.afterFlush(function() {
        if (doForceCorrect) {
            $("#forceCorrectionEntry").show();
            $("#forceCorrectGuidance").text("Please enter the correct answer to continue");
            speakMessageIfAudioPromptFeedbackEnabled("Please enter the correct answer to continue");
            $("#userForceCorrect").val("").focus();
            startRecording();
        }
        else {
            $("#forceCorrectGuidance").text("");
            $("#userForceCorrect").val("");
        }
    });

    // When all done, we set up to scroll to the bottom of the display
    scrollElementIntoView(null, false);
}

function hideUserInteraction() {
    $("#UserInteraction")
        .removeClass("text-align alert alert-success alert-danger")
        .html("")
        .hide();

    // forceCorrection is now part of user interaction
    $("#userForceCorrect").val("");    // text box - see inputF.html
    $("#forceCorrectionEntry").hide();  // Container

    // Scroll to ensure correct view in on screen
    scrollElementIntoView("#stimulusTarget", true);
}

// BEGIN WEB AUDIO section

//Audio prompt/feedback (web audio speech synthesis)
function speakMessageIfAudioPromptFeedbackEnabled(msg,resetTimeout){
  var savedFunc = timeoutFunc;
  var savedDelay = timeoutDelay;
  if(resetTimeout){
    console.log("RESETTING TIMEOUT WHILE READING");
    clearCardTimeout();
  }
  var enableAudioPromptAndFeedback = Session.get("enableAudioPromptAndFeedback");
  if(enableAudioPromptAndFeedback){
    var synth = window.speechSynthesis;
    //Replace underscores with blank so that we don't get awkward UNDERSCORE UNDERSCORE
    //UNDERSCORE...speech from literal reading of text
    msg = msg.replace(/_+/g,'blank');
    var message = new SpeechSynthesisUtterance(msg);
    message.rate = Session.get("audioPromptSpeakingRate");
    synth.speak(message);
    console.log("providing audio feedback");
  }else{
    console.log("audio feedback disabled");
  }
  if(resetTimeout){
    console.log("RESTARTING TIMEOUT AFTER READING");
    beginMainCardTimeout(savedDelay, savedFunc);
  }
}

//Speech recognition function to process audio data
processLINEAR16 = function(data){
  resetMainCardTimeout(); //Give ourselves a bit more time for the speech api to return results
  recorder.clear();
  var userAnswer = $("#forceCorrectionEntry").is(":visible") ? document.getElementById('userForceCorrect') : document.getElementById('userAnswer');

  if(userAnswer || getButtonTrial()){
    var sampleRate = Session.get("sampleRate");
    var setSpec = getCurrentTdfFile().tdfs.tutor.setspec[0];
    var speechRecognitionLanguage = setSpec.speechRecognitionLanguage;
    if(!speechRecognitionLanguage){
      console.log("no speechRecognitionLanguage in set spec, defaulting to en-US");
      speechRecognitionLanguage = "en-US";
    }else{
      speechRecognitionLanguage = speechRecognitionLanguage[0];
    }

    var phraseHints = [];
    if(getButtonTrial()){
      var curChar = 'a';
      phraseHints.push(curChar);
      for(i=1;i<26;i++){
        curChar = nextChar(curChar);
        phraseHints.push(curChar);
      }
    }else{
      userAnswer.value = "waiting for transcription";
      phraseHints = getAllStimAnswers(true);
    }

    var request = {
      "config": {
        "encoding": "LINEAR16",
        "sampleRateHertz": sampleRate,
        "languageCode" : speechRecognitionLanguage,
        "maxAlternatives" : 1,
        "profanityFilter" : false,
        "speechContexts" : [
          {
            "phrases" : phraseHints,
          }
        ]
      },
      "audio": {
        "content": data
      }
    }

    console.log("Request:" + JSON.stringify(request));

    var tdfSpeechAPIKey = getCurrentTdfFile().tdfs.tutor.setspec[0].speechAPIKey;
    var answerGrammar;
    if(getButtonTrial()){
      answerGrammar = phraseHints;
    }else{
      answerGrammar = getAllStimAnswers(false);
    }

    //Make the actual call to the google speech api with the audio data for transcription
    if(tdfSpeechAPIKey && tdfSpeechAPIKey != ""){
      console.log("tdf key detected");
      makeGoogleSpeechAPICall(request, tdfSpeechAPIKey,answerGrammar);
    //If we don't have a tdf provided speech api key load up the user key
    //NOTE: we shouldn't be able to get here if there is no user key
    }else{
      console.log("no tdf key, using user provided key");
      makeGoogleSpeechAPICall(request,speechAPIKey,answerGrammar);
    }
  }else{
    console.log("processwav userAnswer not defined");
  }
}

makeGoogleSpeechAPICall = function(request,speechAPIKey,answerGrammar){
  var speechURL = "https://speech.googleapis.com/v1/speech:recognize?key=" + speechAPIKey;
  HTTP.call("POST",speechURL,{"data":request}, function(err,response){
      console.log(JSON.stringify(response));
      var transcript = '';
      var ignoreOutOfGrammarResponses = Session.get("ignoreOutOfGrammarResponses");
      var speechOutOfGrammarFeedback = Session.get("speechOutOfGrammarFeedback");
      var ignoredOrSilent = false;
      if(!!response['data']['results'])
      {
        transcript = response['data']['results'][0]['alternatives'][0]['transcript'].toLowerCase();
        console.log("transcript: " + transcript);
        if(ignoreOutOfGrammarResponses)
        {
          //Answer not in grammar, ignore and reset/re-record
          if(answerGrammar.indexOf(transcript) == -1)
          {
            console.log("ANSWER OUT OF GRAMMAR, IGNORING");
            transcript = speechOutOfGrammarFeedback;
            ignoredOrSilent = true;
          }
        }
      }else{
        console.log("NO TRANSCRIPT/SILENCE");
        transcript = "Silence detected";
        ignoredOrSilent = true;
      }

      if(getButtonTrial()){
        console.log("button trial, setting user answer to verbalChoice");
        userAnswer = $("[verbalChoice='" + transcript + "']");
        if(!userAnswer){
          console.log("Choice couldn't be found");
          ignoredOrSilent = true;
        }
      }else{
        userAnswer = $("#forceCorrectionEntry").is(":visible") ? document.getElementById('userForceCorrect') : document.getElementById('userAnswer');
        console.log("regular trial, transcribing user response to user answer box");
        userAnswer.value = transcript;
      }
      if(ignoredOrSilent){
        //Reset recording var so we can try again since we didn't get anything good
        Session.set('recording',true);
        recorder.record();
        //If answer is out of grammar or we pick up silence wait 5 seconds for
        //user to read feedback then clear the answer value
        if(!getButtonTrial()){
          setTimeout(function(){
            userAnswer.value = "";
          }, 5000);
        }
      }else{
        //Only simulate enter key press if we picked up transcribable/in grammar
        //audio for better UX
        if(getButtonTrial()){
            console.log("Simulating click on user's answer choice button");
            userAnswer.click();
        }else{
            simulateUserAnswerEnterKeyPress();
        }
      }
    });
}

recorder = null;
callbackManager = null;
audioContext = null;

function startUserMedia(stream) {
  console.log("START USER MEDIA");
  var input = audioContext.createMediaStreamSource(stream);
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  //Capture the sampling rate for later use in google speech api as input
  Session.set("sampleRate", input.context.sampleRate);
  var audioRecorderConfig = {errorCallback: function(x) {console.log("Error from recorder: " + x);}};
  recorder = new Recorder(input, audioRecorderConfig);

  //Set up the process callback so that when we detect speech end we have the
  //function to process the audio data
  recorder.setProcessCallback(processLINEAR16);

  //Set up options for voice activity detection code (vad.js)
  var energyOffsetExp = 60 - Session.get("audioInputSensitivity");
  var energyOffset = parseFloat("1e+" + energyOffsetExp);
  var options = {
    source: input,
    energy_offset: energyOffset,
    voice_stop: function() {
      //This will hopefully only be fired once while we're still on the voice.html interstitial,
      //once VAD.js loads we should navigate back to card to start the practice set
      if(!Session.get("VADInitialized")){
        console.log("VAD previously not initialized, now initialized");
        Session.set("VADInitialized",true);
        $("#voiceDetected").value = "Voice detected, refreshing now...";
        Session.set("needResume", true);
        Router.go("/card");
        return;
      }
      if(!Session.get('recording')){
        console.log("NOT RECORDING, VOICE STOP");
        return;
      }
      console.log("VOICE STOP");
      recorder.stop();
      Session.set('recording',false);
      recorder.exportToProcessCallback();
    },
    voice_start: function() {
      if(!Session.get('recording')){
        console.log("NOT RECORDING, VOICE START");
        return;
      }
      console.log("VOICE START");
      if(resetMainCardTimeout){
        if(Session.get('recording')){
          console.log("voice_start resetMainCardTimeout");
          resetMainCardTimeout();
        }else {
          console.log("NOT RECORDING");
        }
      }else{
        console.log("RESETMAINCARDTIMEOUT NOT DEFINED");
      }
      //For multiple transcriptions:
      //recorder.record();
      //Session.set('recording',true);
    }
  }
  var vad = new VAD(options);
  Session.set("VADInitialized",false);

  console.log("Audio recorder ready");

  //Navigate to the voice interstitial which gives VAD.js time to load so we're
  //ready to transcribe when we finally come back to the practice set
  Router.go("/voice");
};

// END WEB AUDIO SECTION

simulateUserAnswerEnterKeyPress = function(){
    //Simulate enter key press on the correct input box if the user is being
    //forced to enter the correct answer in userForceCorrect
    var $textBox = $("#forceCorrectionEntry").is(":visible") ? $("#userForceCorrect") : $("#userAnswer");

    var press = jQuery.Event("keypress");
    press.altGraphKey = false;
    press.altKey = false;
    press.bubbles = true;
    press.cancelBubble = false;
    press.cancelable = true;
    press.charCode = 13;
    press.clipboardData = undefined;
    press.ctrlKey = false;
    press.currentTarget = $textBox[0];
    press.defaultPrevented = false;
    press.detail = 0;
    press.eventPhase = 2;
    press.keyCode = 13;
    press.keyIdentifier = "";
    press.keyLocation = 0;
    press.layerX = 0;
    press.layerY = 0;
    press.metaKey = false;
    press.pageX = 0;
    press.pageY = 0;
    press.returnValue = true;
    press.shiftKey = false;
    press.srcElement = $textBox[0];
    press.target = $textBox[0];
    press.type = "keypress";
    press.view = Window;
    press.which = 13;

    $textBox.trigger(press);
    console.log("SIMULATED ENTER KEY PRESS");
}

function startRecording(){
  if (recorder){
    Session.set('recording',true);
    recorder.record();
    console.log("RECORDING START");
  }else{
    console.log("NO RECORDER");
  }
}

function stopRecording(){
  if(recorder && Session.get('recording'))
  {
    recorder.stop();
    Session.set('recording',false);

    recorder.clear();
    console.log("RECORDING END");
  }
}

function stopUserInput() {
    console.log("stop user input");
    stopRecording();


    //Handle this being called before the page finishes loading by setting up
    //polling check to recheck until page has loaded, then disable
    var count = 0;
    if($("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled") == undefined){
      var intervalVar;
      intervalVar = setInterval(function(){
        count += 1;
        if($("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled") != undefined || count > 20){
          console.log("finally loaded");
          $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled",true);
          clearInterval(intervalVar);
        }
      },500);
    }else{
        $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled", true);
    }
}

function allowUserInput(textFocus) {
    console.log("allow user input");
    var enableUserInput = function(){
      $("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled", false);
      startRecording();

      if (typeof textFocus !== "undefined" && !!textFocus) {
          try {
              $("#userAnswer").focus();
          }
          catch(e) {
              //Nothing to do
          }
      }

      // Force scrolling to bottom of screen for the input
      scrollElementIntoView(null, false);
    }

    //Handle this being called before the page finishes loading by setting up a
    //polling check to recheck until page has loaded, then enable
    var count = 0;
    if($("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled") == undefined){
      var intervalVar;
      intervalVar = setInterval(function(){
        count += 1;
        if($("#continueStudy, #userAnswer, #multipleChoiceContainer button").prop("disabled") != undefined || count > 20){
          console.log("finally loaded");
          enableUserInput();
          clearInterval(intervalVar);
        }
      },500);
    }else{
      enableUserInput();
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
Session.set('inResume', false);

//Re-initialize our User Progress and Card Probabilities internal storage
//from the user times log. Note that most of the logic will be in
//processUserTimesLog. This function just does some initial set up, insures
//that experimental conditions are correct, and uses processUserTimesLog as
//a callback. This callback pattern is important because it allows us to be
//sure our server-side call regarding experimental conditions has completed
//before continuing to resume the session
function resumeFromUserTimesLog() {
    if (Session.get('inResume')) {
        console.log("RESUME DENIED - already running in resume");
        return;
    }
    Session.set('inResume', true);

    console.log("Resuming from previous User Times info (if any)");

    //Clear any previous permutation and/or timeout call
    timeoutsSeen = 0;
    clearCardTimeout();
    keypressTimestamp = 0;
    trialTimestamp = 0;
    unitStartTimestamp = Date.now();
    clearScrollList();

    //Clear any previous session data about unit/question/answer
    Session.set("clusterMapping", undefined);
    Session.set("currentUnitNumber", undefined);
    Session.set("questionIndex", undefined);
    Session.set("clusterIndex", undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentQuestionPart2", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("testType", undefined);
    Session.set("lastTimestamp", 0);

    //Disallow continuing (it will be turned on somewhere else)
    setDispTimeoutText("");
    $("#continueButton").prop("disabled", true);

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
            conditionData.note = "Selected from " + _.display(setspec.condition.length) + " conditions";
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
        Session.set('inResume', false);
    });
}

//We process the user times log, assuming resumeFromUserTimesLog has properly
//set up the TDF/Stim session variables
function processUserTimesLog() {
    //Get TDF info
    var file = getCurrentTdfFile();
    var tutor = file.tdfs.tutor;
    var currentStimName = getCurrentStimName();

    //Before the below options, reset current test data
    initUserProgress({
        progressDataArray: [],
        currentSchedule: {}
    });

    //Default to first unit
    Session.set("currentUnitNumber", 0);
    Session.set("currentUnitStartTime", Date.now());

    //We'll be tracking the last question so that we can match with the answer
    var lastQuestionEntry = null;

    //prepareCard will handle whether or not new units see instructions, but
    //it will miss instructions for the very first unit.
    var needFirstUnitInstructions = tutor.unit && tutor.unit.length;

    //Helper to determine if a unit specified by index has the given field
    var unitHasOption = function(unitIdx, optionName) {
        var unitSection = _.chain(file.tdfs.tutor)
            .prop("unit").prop(unitIdx)
            .prop(optionName).first().value();
        console.log("UNIT CHECK", unitIdx, optionName, !!unitSection);
        return !!unitSection;
    };

    //It's possible that they clicked Continue on a final unit, so we need to
    //know to act as if we're done
    var moduleCompleted = false;

    //Reset current engine
    var resetEngine = function(currUnit) {
        if (unitHasOption(currUnit, "assessmentsession")) {
            engine = createScheduleUnit();
        }
        else if (unitHasOption(currUnit, "learningsession")) {
            engine = createModelUnit();
        }
        else {
            engine = createEmptyUnit();
        }
    };

    //The last unit we captured start time for - this way we always get the
    //earliest time for our unit start
    var startTimeMinUnit = -1;

    //At this point, our state is set as if they just started this learning
    //session for the first time. We need to loop thru the user times log
    //entries and update that state
    _.each(getCurrentUserTimesLog(), function(entry, index, currentList) {
        // IMPORTANT: this won't really work since we're in a tight loop. If we really
        // want to get this to work, we would need asynch loop processing (see
        // http://stackoverflow.com/questions/9772400/javascript-async-loop-processing
        // if you're unfamiliar). As a result, we just have a loading message
        // IMPORTANT: remember that you will need to integrate with
        // Meteor's handling of the event loop (so base your async loop on
        // Meteor.setTimeout or something)
        // var progress = (index + 1.0) / currentList.length;
        // progress = _.intval(progress * 100);
        // $('#resumeMsg').text(progress + "% Complete");
        // $('.progress-bar').css('width', progress+'%').attr('aria-valuenow', progress);

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

                clearScrollList();

                resetEngine(instructUnit);
            }
        }

        else if (action === "unit-end") {
            //Logged completion of unit - if this is the final unit we also
            //know that the TDF is completed
            var finishedUnit = _.intval(entry.currentUnit, -1);
            var checkUnit = _.intval(Session.get("currentUnitNumber"), -2);
            if (finishedUnit >= 0 && checkUnit === finishedUnit) {
                //Correctly matches current unit - reset
                needFirstUnitInstructions = false;
                lastQuestionEntry = null;

                Session.set("questionIndex", 0);
                Session.set("clusterIndex", undefined);
                Session.set("currentQuestion", undefined);
                Session.set("currentAnswer", undefined);
                Session.set("testType", undefined);

                clearScrollList();

                if (finishedUnit === file.tdfs.tutor.unit.length - 1) {
                    //Completed
                    moduleCompleted = true;
                }
                else {
                    //Moving to next unit
                    checkUnit += 1;
                    Session.set("currentUnitNumber", checkUnit);
                    resetEngine(checkUnit);
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
                    unitname: _.display(currUnit.unitname),
                    unitindex: unit
                });
                alert("There is an issue with either the TDF or the Stimulus file - experiment cannot continue");
                clearCardTimeout();
                leavePage("/profile");
                return;
            }

            //Update what we know about the session
            //Note that the schedule unit engine will see and use this
            getUserProgress().currentSchedule = schedule;
            Session.set("currentUnitNumber", unit);
            Session.set("questionIndex", 0);

            //Blank out things that should restart with a schedule
            Session.set("clusterIndex", undefined);
            Session.set("currentQuestion", undefined);
            Session.set("currentAnswer", undefined);
            Session.set("testType", undefined);
            clearScrollList();
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
            Session.set("currentQuestionPart2", entry.selectedQuestionPart2);
            Session.set("currentAnswer",        entry.selectedAnswer);
            Session.set("showOverlearningText", entry.showOverlearningText);
            Session.set("testType",             entry.testType);

            // Notify the current engine about the card selection (and note that
            // the engine knows that this is a resume because we're passing the
            // log entry back to it). The entry should include the original
            // selection value to pass in, but if it doesn't we default to
            // cardIndex (which should work for all units except the model)
            engine.cardSelected(entry.selectVal || cardIndex, entry);
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

            var simCorrect = null;
            if (_.chain(entry).prop("wasSim").intval() > 0) {
                simCorrect = wasCorrect;
            }
            writeCurrentToScrollList(entry.answer, action === "[timeout]", simCorrect, 0);

            //Notify unit engine about card answer
            engine.cardAnswered(wasCorrect, entry);

            //We know the last question no longer applies
            lastQuestionEntry = null;
        }

        else {
            recordTimestamp = false; //Don't use the timestamp for this one
            //console.log("Ignoring user times log entry with action", action);
        }

        if (recordTimestamp && entry.clientSideTimeStamp) {
            Session.set("lastTimestamp", entry.clientSideTimeStamp);

            if (Session.get("currentUnitNumber") > startTimeMinUnit) {
                Session.set("currentUnitStartTime", Session.get("lastTimestamp"));
                startTimeMinUnit = Session.get("currentUnitNumber");
            }
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
    else if (moduleCompleted) {
        //They are DONE!
        console.log("TDF already completed - leaving for profile page.");
        if (Session.get("loginMode") === "experiment") {
            // Experiment users don't *have* a normal page
            leavePage(routeToSignin);
        }
        else {
            // "Normal" user - they just go back to their root page
            leavePage("/profile");
        }
    }
    else {
        // If we get this far and the unit engine thinks the unit is finished,
        // we might need to stick with the instructions *IF AND ONLY IF* the
        // lockout period hasn't finished (which prepareCard won't handle)
        if (engine.unitFinished()) {
            var lockoutMins = _.chain(getCurrentDeliveryParams()).prop("lockoutminutes").intval().value();
            if (lockoutMins > 0) {
                var unitStartTimestamp = _.intval(Session.get("currentUnitStartTime"));
                if (unitStartTimestamp < 1) {
                    unitStartTimestamp = Date.now();
                }
                var lockoutFreeTime = unitStartTimestamp + (lockoutMins * (60 * 1000)); // minutes to ms
                if (Date.now() < lockoutFreeTime) {
                    console.log("RESUME FINISHED: showing lockout instructions");
                    leavePage("/instructions");
                    return;
                }
            }
        }

        // Stil here...
        // We have an answer (or no questions at all) - run next question logic
        // Note that this will also handle new units, instructions, and whether
        // or not they are completed
        console.log("RESUME FINISHED: next-question logic to commence");
        prepareCard();
    }
}
