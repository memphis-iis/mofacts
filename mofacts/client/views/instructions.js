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
    var lockoutminutes = _.chain(getCurrentDeliveryParams()).prop("lockoutminutes").intval().value();
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
    var unit = getCurrentTdfUnit();
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
        if (!unitStartTimestamp) {
            unitStartTimestamp = Date.now();
        }

        var lockoutMins = currLockOutMinutes();
        if (lockoutMins) {
            var lockoutMs = lockoutMins * (60 * 1000); //Minutes to millisecs
            lockoutFreeTime = unitStartTimestamp + lockoutMs;
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
                var currUnit = getCurrentTdfUnit();
                var turkemail = _.trim(_.safefirst(currUnit.turkemail));
                var subject = _.trim(_.safefirst(currUnit.turkemailsubject));

                if (!turkemail) {
                    return; //No message to show
                }

                var experiment = userTimesExpKey(true);

                Meteor.call("turkScheduleLockoutMessage", experiment, lockoutFreeTime + 1, subject, turkemail, function(error, result) {
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

// Called when users continues to next screen.
// SUPER-IMPORTANT: note that this can be called outside this template, so it
// must only reference visible from anywhere on the client AND we take great
// pains to not modify anything reactive until this function has returned
instructContinue = function () {
    //On resume, seeing an "instructions" log event is seen as a breaking point
    //in the TDF session (since it's supposed to be the beginning of a new unit).
    //As a result, we only want to log an instruction record ONCE PER UNIT. In
    //the unlikely event we've already logged an instruction record for the
    //current unit, we should log a duplicate instead
    var logAction = "instructions";
    var currUnit = Session.get("currentUnitNumber");
    var unit = _.chain(getCurrentTdfFile())
        .prop("tdfs")
        .prop("tutor")
        .prop("unit").prop(_.intval(currUnit))
        .value();

    var unitName = _.chain(unit).prop("unitname").trim().value();
    var feedbackText = _.chain(unit).prop("unitinstructions").trim().value();
    if (feedbackText.length < 1) {
        feedbackText = _.chain(unit).prop("picture").trim().value();
    }

    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
    var expKey = userTimesExpKey(true);

    var entries = _.prop(userLog, expKey) || [];

    var dup = _.find(entries, function(rec){
        return (
            _.prop(rec, "action") === "instructions" &&
            _.prop(rec, "currentUnit") === currUnit
        );
    });

    // Record the fact that we just showed instruction. Also - we use a call
    // back to redirect to the card display screen to make sure that everything
    // has been properly logged on the server. We do all this in an async
    // timeout because we don't know if we've been called from a reactive func
    // and we don't want to trigger any re-calculations
    Meteor.setTimeout(function(){
        // Get the start time for instructions (set in router.js). IMPORTANT: we
        // wait until here to do this in case instructContinue was called from a
        // reactive function
        var instructStart = _.intval(Session.get("instructionClientStart"));
        Session.set("instructionClientStart", 0);

        if (!!dup) {
            console.log("Found dup instruction", dup);
            Meteor.call("debugLog", "Found dup instruction. Entry:", displayify(dup));
            logAction = "instructions-dup";
        }

        recordUserTime(logAction, {
            'currentUnit': currUnit,
            'unitname': unitName,
            'xcondition': Session.get("experimentXCond"),
            'instructionClientStart': instructStart,
            'feedbackText': feedbackText
        }, function(error, result) {
            //We know they'll need to resume now
            Session.set("needResume", true);
            leavePage("/card");
        });
    }, 1);
};

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.instructions.helpers({
     isExperiment: function() {
        return Session.get("loginMode") === "experiment";
    },

    isNormal: function() {
        return Session.get("loginMode") !== "experiment";
    },

    backgroundImage: function() {
        var currUnit = getCurrentTdfUnit();
        var img = "";

        if (currUnit && currUnit.picture) {
            img = currUnit.picture;
        }

        return img;
    },

    instructions: function () {
        return _.chain(getCurrentTdfUnit()).prop("unitinstructions").trim().value();
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
    },

    'click .logoutLink' : function (event) {
        event.preventDefault();
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User:", Meteor.user(), "Error:", error);
            }
            leavePage(routeToSignin); //Not much else to do now
        });
    },

    'click .allItemsLink' : function (event) {
        event.preventDefault();
        Router.go("/allItems");
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        leavePage("/profile");
    }
});
