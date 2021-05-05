import { haveMeteorUser } from '../../lib/currentTestingHelpers';
import { updateExperimentState } from './card';
////////////////////////////////////////////////////////////////////////////
// Instruction timer and leaving this page - we don't want to leave a
// timer running!

var lockoutInterval = null;
var lockoutFreeTime = null;
var lockoutHandled = false;
var serverNotify = null;
// Will get set on first periodic check and cleared when we leave the page
var displayTimeStart = null;

function startLockoutInterval() {
    clearLockoutInterval();
    //See below for lockoutPeriodicCheck - notice that we also do an immediate
    //check and then start the interval
    lockoutPeriodicCheck();
    lockoutInterval = Meteor.setInterval(lockoutPeriodicCheck, 250);
}

function clearLockoutInterval() {
    if (!!lockoutInterval) {
        Meteor.clearInterval(lockoutInterval);
    }
    lockoutInterval = null;
    lockoutFreeTime = null;
    lockoutHandled = false;
    serverNotify = null;
}

function leavePage(dest) {
    clearLockoutInterval();
    displayTimeStart = null;
    if (typeof dest === "function") {
        dest();
    }
    else {
        Router.go(dest);
    }
}

////////////////////////////////////////////////////////////////////////////
// Utility functions used below

// Added because the LOCKOUT call overwhelms the console - so we throttle to one
// call every 1000ms (1 second)
var logLockout = _.throttle(
    function (lockoutminutes) {
        console.log("LOCKOUT:", lockoutminutes, "min");
    },
    250
);

//Return current TDF unit's lockout minutes (or 0 if none-specified)
function currLockOutMinutes() {
    var lockoutminutes = _.chain(Session.get("currentDeliveryParams")).prop("lockoutminutes").intval().value();
    logLockout(lockoutminutes);
    return lockoutminutes;
}

function lockoutKick() {
    var display = getDisplayTimeouts();
    var doDisplay = (display.minSecs > 0 || display.maxSecs > 0);
    var doLockout = (!lockoutInterval && currLockOutMinutes() > 0);
    if (doDisplay || doLockout) {
        console.log("interval kicked");
        startLockoutInterval();
    }
}

// Min and Max display seconds: if these are enabled, they determine
// potential messages, the continue button functionality, and may even move
// the screen forward. HOWEVER, the lockout functionality currently overrides
// this functionality (i.e. we don't check this stuff while we are locked out)
function getDisplayTimeouts() {
    let unit = Session.get("currentTdfUnit");
    return {
        'minSecs': _.chain(unit).prop("instructionminseconds").first().intval(0).value(),
        'maxSecs': _.chain(unit).prop("instructionmaxseconds").first().intval(0).value()
    };
}

function setDispTimeoutText(txt) {
    var msg = _.trim(txt || "");
    if (msg.length > 0) {
        msg = " (" + msg + ")";
    }
    $("#displayTimeoutMsg").text(msg);
}

// Called intermittently to see if we are still locked out
function lockoutPeriodicCheck() {
    if (!lockoutFreeTime) {
        var unitStartTimestamp = Session.get("currentUnitStartTime");
        var lockoutMins = currLockOutMinutes();
        if (lockoutMins) {
            lockoutFreeTime = unitStartTimestamp + lockoutMins * (60 * 1000); //Minutes to millisecs
        }
    }

    // Lockout handling
    if (Date.now() >= lockoutFreeTime) {
        //All done - clear out time remaining, hide the display, enable the
        //continue button, and stop the lockout timer
        if (!lockoutHandled) {
            $("#lockoutTimeRemaining").html("");
            $("#lockoutDisplay").hide();
            $("#continueButton").prop("disabled", false);
            // Since the interval will continue to fire, we need to know we've
            // done this
            lockoutHandled = true;
        }
    }
    else {
        //Still locked - handle and then bail

        //Figure out how to display time remaining
        timeLeft = Math.floor((lockoutFreeTime - Date.now()) / 1000.0);
        var timeLeftDisplay = "Time Remaining: " + Date.secsIntervalString(timeLeft);

        //Insure they can see the lockout message, update the time remaining
        //message, and disable the continue button
        $("#lockoutDisplay").show();
        $("#lockoutTimeRemaining").text(timeLeftDisplay);
        $("#continueButton").prop("disabled", true);

        //Make sure that the server knows a lockout has been detected - but
        //we only need to call it once
        if (serverNotify === null) {
            serverNotify = function() {
                if (Session.get("loginMode") !== "experiment") {
                    return; //Nothing to do
                }

                //We're in experiment mode and locked out - if they should get a Turk email,
                //now is the time to let the server know we've shown a lockout msg
                let currUnit = Session.get("currentTdfUnit");
                var turkemail = _.trim(_.safefirst(currUnit.turkemail));
                var subject = _.trim(_.safefirst(currUnit.turkemailsubject));

                if (!turkemail) {
                    return; //No message to show
                }

                var experimentId = Session.get("currentRootTdfId");

                Meteor.call("turkScheduleLockoutMessage", experimentId, lockoutFreeTime + 1, subject, turkemail, function(error, result) {
                    if (typeof error !== "undefined") {
                        console.log("Server schedule failed. Error:", error);
                    }
                    else {
                        console.log("Server accepted lockout msg schedule", lockoutFreeTime + 1, turkemail);
                    }
                });
            };
            serverNotify();
        }
        //IMPORTANT: we're leaving
        return;
    }

    // Lockout logic has been handled - if we're here then we're unlocked
    // Get the display min/max handling
    var display = getDisplayTimeouts();
    if (display.minSecs > 0 || display.maxSecs > 0) {
        if (!displayTimeStart) {
            displayTimeStart = Date.now();  //Start tracking time
        }

        var elapsedSecs = Math.floor((1.0 + Date.now() - displayTimeStart) / 1000.0);
        var dispLeft;

        if (elapsedSecs <= display.minSecs) {
            // Haven't reached min yet
            $("#continueButton").prop("disabled", true);
            dispLeft = display.minSecs - elapsedSecs;
            if (dispLeft >= 1.0) {
                setDispTimeoutText("You can continue in: " + Date.secsIntervalString(dispLeft));
            }
            else {
                setDispTimeoutText(""); // Don't display 0 secs
            }
        }
        else if (elapsedSecs <= display.maxSecs) {
            // Between min and max
            $("#continueButton").prop("disabled", false);
            dispLeft = display.maxSecs - elapsedSecs;
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
            instructContinue();
        }
        else {
            // Past max and no valid maximum - they get a continue button
            $("#continueButton").prop("disabled", false);
            setDispTimeoutText("You can continue whenever you want");
        }
    }
    else {
        // No display handling - if lockout is fine then we can stop polling
        $("#continueButton").prop("disabled", false);
        setDispTimeoutText("");
        if (lockoutHandled) {
            clearLockoutInterval();
        }
    }
}

//Get units left to display/execute - note that the current unit isn't
//counted. Ex: if you have three units (0, 1, 2) and unit 1 is the current
//unit, then you have 1 unit remaining. If there are no units or there is
//we return 0
function getUnitsRemaining() {
    var unitsLeft = 0;

    var thisTdf = Session.get("currentTdfFile");
    if (!!thisTdf) {
        var unitCount = 0;
        if (typeof thisTdf.tdfs.tutor.unit !== "undefined" && thisTdf.tdfs.tutor.unit.length) {
            unitCount = thisTdf.tdfs.tutor.unit.length;
        }
        if (unitCount > 0) {
            var unitIdx = Session.get("currentUnitNumber") || 0;
            unitsLeft = (unitCount - unitIdx) - 1;
            if (unitsLeft < 0) {
                unitsLeft = 0;
            }
        }
    }

    return unitsLeft;
};

// Called when users continues to next screen.
// SUPER-IMPORTANT: note that this can be called outside this template, so it
// must only reference visible from anywhere on the client AND we take great
// pains to not modify anything reactive until this function has returned
instructContinue = function () {
    let curUnit = Session.get("currentTdfUnit");

    let feedbackText = curUnit.unitinstructions && curUnit.unitinstructions.length > 0 ? curUnit.unitinstructions[0].trim() : "";
    if (feedbackText.length < 1) feedbackText = curUnit.picture ? curUnit.picture.trim() : "";

    // Record the fact that we just showed instruction. Also - we use a call
    // back to redirect to the card display screen to make sure that everything
    // has been properly logged on the server. We do all this in an async
    // timeout because we don't know if we've been called from a reactive func
    // and we don't want to trigger any re-calculations
    Meteor.setTimeout(async function(){
        // Get the start time for instructions (set in router.js). IMPORTANT: we
        // wait until here to do this in case instructContinue was called from a
        // reactive function
        let instructionClientStart = _.intval(Session.get("instructionClientStart"));
        let instructLatency = Date.now() - instructionClientStart;
        Session.set("instructionClientStart", 0);

        let newExperimentState = {
            instructionClientStart: instructionClientStart,
            feedbackText: feedbackText,
            lastAction: "instructions",
            lastActionTimeStamp: Date.now()
        }
        let curTdf = Session.get("currentTdfFile");
        let curUnitNum = Session.get("currentUnitNumber");
        let unitName = curTdf.tdfs.tutor.unit[curUnitNum].unitname[0].trim();

        // var instructRecord = {
        //     'itemId': null,
        //     'KCId': null,
        //     'userId': Meteor.userId(),
        //     'TDFId': Session.get("currentTdfId"),
        //     'eventStartTime': Date.now(),
        //     'outcome': null,
        //     'typeOfResponse': null,
        //     'responseValue': null,
        //     'displayedStimulus': null,
        //     'dynamicTagFields': null,
        
        //     'Anon_Student_Id':_.trim(Meteor.user().username),
        //     'Session_ID': (new Date(_.intval(instructionClientStart))).toUTCString().substr(0, 16) + " " + tdfName, //hack
        
        //     'Condition_Namea':'tdf file', 
        //     'Condition_Typea':Session.get("currentTdfName"),
        //     'Condition_Nameb':'xcondition',
        //     'Condition_Typeb':Session.get("experimentXCond"),
        //     'Condition_Namec':'N/A',//schedCondition
        //     'Condition_Typec':'schedule condition',
        //     'Condition_Named':'how answered',
        //     'Condition_Typed':'N/A',
        
        //     'feedbackDuration':null,
        //     'stimulusDuration':null,
        //     'responseDuration':responseDuration,
        //     'probabilityEstimate':probabilityEstimate,
            
        //     'Level_Unit': Session.get("currentUnitNumber"),
        //     'Level_Unitname':unitName,
        //     'Problem_Name': 'Instructions',
        //     'Step_Name': '',//this is no longer a valid field as we don't restore state one step at a time
        //     'Time': instructionClientStart,
        //     'Input': '',
        //     'Student_Response_Type': "HINT_REQUEST", // where is ttype set?
        //     'Student_Response_Subtype': '',
        //     'Tutor_Response_Type': "HINT_MSG", // where is ttype set?
        //     'Tutor_Response_Subtype': '',
          
        //     "KC_Default": '',
        //     "KC_Category_Default": '',
        //     "KC_Cluster": '',
        //     "KC_Category_Cluster": '',
        //     "CF_GUI_Source":'',
        //     "CF_Audio_Input_Enabled":Session.get('audioEnabled'),
        //     "CF_Audio_Output_Enabled":Session.get('enableAudioPromptAndFeedback'),
        //     "CF_Display_Order": -1,
        //     "CF_Stim_File_Index": -1,
        //     "CF_Set_Shuffled_Index": -1,
        //     "CF_Alternate_Display_Index": null,
        //     "CF_Stimulus_Version": -1,
        
        //     "CF_Correct_Answer": '',
        //     "CF_Correct_Answer_Syllables": null, 
        //     "CF_Correct_Answer_Syllables_Count": null,
        //     "CF_Display Syllable_Indices": null, 
        //     "CF_Overlearning": false,
        //     "CF_Response_Time": 0,
        //     "CF_Start_Latency": 0,
        //     "CF_End_Latency": 0,
        //     "CF_Review_Latency": instructLatency,
        //     "CF_Review_Entry":null,
        //     "CF_Button_Order": '',
        //     "CF_Note": '',
        //     "Feedback_Text": _.trim(feedbackText) || "",
        
        //     //'ttype': _.trim(testType),
        //     'dialogueHistory':undefined //We'll fill this in later
        // };

        const res = await updateExperimentState(newExperimentState, "instructions.instructContinue");
        console.log("instructions,new experiment state:",newExperimentState);
        console.log("instructContinue",res);
        Session.set("inResume", true);
        leavePage("/card");
        enterKeyLock = false;
        console.log("releasing enterKeyLock in instructContinue");
    }, 1);
};


Template.instructions.helpers({
     isExperiment: function() {
        return Session.get("loginMode") === "experiment";
    },

    isNormal: function() {
        return Session.get("loginMode") !== "experiment";
    },

    backgroundImage: function() {
        var currUnit = Session.get("currentTdfUnit");
        var img = "";

        if (currUnit && currUnit.picture) {
            img = currUnit.picture;
        }

        return img;
    },

    instructions: function () {
        return _.chain(Session.get("currentTdfUnit")).prop("unitinstructions").trim().value();
    },

    islockout: function() {
        return currLockOutMinutes() > 0;
    },

    lockoutminutes: function() {
        return currLockOutMinutes();
    },

    username: function () {
        if (!haveMeteorUser()) {
            leavePage(routeToSignin);
        }
        else {
            return Meteor.user().username;
        }
    },

    allowcontinue: function() {
        //If we're in experiment mode, they can only continue if there are
        //units left.
        if (Session.get("loginMode") === "experiment") {
            return getUnitsRemaining() > 0;
        }
        else {
            return true;
        }
    }
});

Template.instructions.rendered = function() {
    //Make sure lockout interval timer is running
    lockoutKick();
};

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructions.events({
    'click #continueButton' : function (event) {
        event.preventDefault();
        instructContinue();
    }
});
