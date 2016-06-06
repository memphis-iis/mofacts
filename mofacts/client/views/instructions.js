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

//Return current TDF unit's lockout minutes (or 0 if none-specified)
function currLockOutMinutes() {
    var deliveryParams = getCurrentDeliveryParams();
    var lockoutminutes = 0;

    if (deliveryParams && deliveryParams.lockoutminutes) {
        lockoutminutes = Helpers.intVal(deliveryParams.lockoutminutes);
    }

    console.log("LOCKOUT:", lockoutminutes, "DISPLAY:", displayify(getDisplayTimeouts()));
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

// Handy time display function
function secondsToDisplay(timeLeftInSecs) {
    var timeLeft = _.floatval(timeLeftInSecs);

    var secs = timeLeft % 60;
    timeLeft = Math.floor(timeLeft / 60);
    var mins = timeLeft % 60;
    timeLeft = Math.floor(timeLeft / 60);
    var hrs  = timeLeft % 24;
    timeLeft = Math.floor(timeLeft / 24);
    var days = timeLeft;

    var timeLeftDisplay = "";

    if (days > 0) {
        timeLeftDisplay += days.toString() + " days, ";
    }
    if (hrs > 0) {
        timeLeftDisplay += hrs.toString()  + " hours, ";
    }
    if (mins > 0) {
        timeLeftDisplay += mins.toString() + " minutes, ";
    }

    return timeLeftDisplay + secs.toString() + " seconds";
}

//Called intermittently to see if we are still locked out
function lockoutPeriodicCheck() {
    if (!lockoutFreeTime) {
        var lastTimestamp = Session.get("lastTimestamp");
        if (!lastTimestamp) {
            lastTimestamp = Date.now();
        }

        var lockoutMins = currLockOutMinutes();
        if (lockoutMins) {
            var lockoutMs = lockoutMins * (60 * 1000); //Minutes to millisecs
            lockoutFreeTime = lastTimestamp + lockoutMs;
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
        var timeLeftDisplay = "Time Remaining: " + secondsToDisplay(timeLeft);

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
                var turkemail = Helpers.trim(Helpers.firstElement(currUnit.turkemail));
                var subject = Helpers.trim(Helpers.firstElement(currUnit.turkemailsubject));

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
                $("#displayTimeoutMsg").text("You will be able to continue in: " + secondsToDisplay(dispLeft));
            }
            else {
                $("#displayTimeoutMsg").text(""); // Don't display 0 secs
            }
        }
        else if (elapsedSecs <= display.maxSecs) {
            // Between min and max
            $("#continueButton").prop("disabled", false);
            dispLeft = display.maxSecs - elapsedSecs;
            if (dispLeft >= 1.0) {
                $("#displayTimeoutMsg").text("Progress will continue in: " + secondsToDisplay(dispLeft));
            }
            else {
                $("#displayTimeoutMsg").text("");
            }
        }
        else if (display.maxSecs > 0.0) {
            // Past max and a max was specified - it's time to go
            $("#continueButton").prop("disabled", true);
            $("#displayTimeoutMsg").text("");
            userContinue();
        }
    }
    else {
        // No display handling - if lockout is fine then we can stop polling
        if (lockoutHandled) {
            clearLockoutInterval();
        }
    }
}

// Called when users continues to next screen
function userContinue() {
    //On resume, seeing an "instructions" log event is seen as a breaking point
    //in the TDF session (since it's supposed to be the beginning of a new unit).
    //As a result, we only want to log an instruction record ONCE PER UNIT. In
    //the unlikely event we've already logged an instruction record for the
    //current unit, we should log a duplicate instead
    var logAction = "instructions";
    var currUnit = Session.get("currentUnitNumber");
    var unitName = _.chain(getCurrentTdfFile().tdfs.tutor)
        .prop("unit")
        .prop(_.intval(currUnit))
        .prop("unitname").trim().value();

    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
    var expKey = userTimesExpKey(true);

    var entries = _.prop(userLog, expKey) || [];

    var dup = _.find(entries, function(rec){
        return (
            _.prop(rec, "action") === "instructions" &&
            _.prop(rec, "currentUnit") === currUnit
        );
    });
    if (!!dup) {
        console.log("Found dup instruction", dup);
        Meteor.call("debugLog", "Found dup instruction. User:", Meteor.userId(), "Entry:", dup);
        logAction = "instructions-dup";
    }

    //Record the fact that we just showed instruction. Also - we use a
    //call back to redirect to the card display screen to make sure that
    //everything has been properly logged on the server
    recordUserTime(logAction, {
        'currentUnit': currUnit,
        'unitname': unitName,
        'xcondition': Session.get("experimentXCond")
    }, function(error, result) {
        //We know they'll need to resume now
        Session.set("needResume", true);
        leavePage("/card");
    });
}

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.instructions.helpers({
    backgroundImage: function() {
        var currUnit = getCurrentTdfUnit();
        var img = "";

        if (currUnit && currUnit.picture) {
            img = currUnit.picture;
        }

        return img;
    },

    instructions: function () {
        var currUnit = getCurrentTdfUnit();
        var instructions = null;

        if (currUnit) {
            instructions = currUnit.unitinstructions;
        }

        return instructions || "Please do your best to answer each question.";
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
        userContinue();
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
