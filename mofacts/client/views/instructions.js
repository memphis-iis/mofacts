////////////////////////////////////////////////////////////////////////////
// Instruction timer and leaving this page - we don't want to leave a
// timer running!

var lockoutInterval = null;
var lockoutFreeTime = null;
var serverNotify = null;

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
    serverNotify = null;
}

function leavePage(dest) {
    clearLockoutInterval();
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

    console.log("LOCKOUT:", lockoutminutes);
    return lockoutminutes;
}

function lockoutKick() {
    if (!lockoutInterval && currLockOutMinutes() > 0) {
        console.log("interval kicked");
        startLockoutInterval();
    }
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

    if (Date.now() >= lockoutFreeTime) {
        //All done - clear out time remaining, hide the display, enable the
        //continue button, and stop the lockout timer
        $("#lockoutTimeRemaining").html("");
        $("#lockoutDisplay").hide();
        $("#continueButton").prop("disabled", false);
        clearLockoutInterval();
    }
    else {
        //Still locked

        //Figure out how to display time remaining
        var timeLeft = lockoutFreeTime - Date.now(); //Start in ms

        timeLeft = Math.floor(timeLeft / 1000);
        var secs = timeLeft % 60;
        timeLeft = Math.floor(timeLeft / 60);
        var mins = timeLeft % 60;
        timeLeft = Math.floor(timeLeft / 60);
        var hrs  = timeLeft % 24;
        timeLeft = Math.floor(timeLeft / 24);
        var days = timeLeft;

        var timeLeftDisplay = "Time Remaining: ";
        if (days > 0) {
            timeLeftDisplay += days.toString() + " days, ";
        }
        timeLeftDisplay += hrs.toString()  + " hours, " +
                           mins.toString() + " minutes, " +
                           secs.toString() + " seconds";

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
    }
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

    'click .homeLink' : function (event) {
        event.preventDefault();
        leavePage("/profile");
    }
});
