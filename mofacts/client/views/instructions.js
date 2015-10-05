////////////////////////////////////////////////////////////////////////////
// Instruction timer and leaving this page - we don't want to leave a
// timer running!

var lockoutInterval = null;
var lockoutFreeTime = null;

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
        //units left. Otherwise they can always go
        if (Session.get("loginMode") === "experiment") {
            return getUnitsRemaining() > 0;
        }
        else {
            return true;
        }
    },

    turkActive: function() {
        //TODO: first check that current unit has turk stuff at all *AND* that
        //      we are in experiment mode (so we know the Turk ID)
        //TODO: return correct value and make sure it's reactive so that we
        //      don't have to try and pay them twice
        return true;
    }
});

Template.instructions.rendered = function() {
    if (currLockOutMinutes() > 0) {
        startLockoutInterval();
    }
};

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructions.events({
    'click #continueButton' : function (event) {
        event.preventDefault();

        //Record the fact that we just showed instruction. Also - we use a
        //call back to redirect to the card display screen to make sure that
        //everything has been properly logged on the server
        recordUserTime("instructions", {
            currentUnit: Session.get("currentUnitNumber"),
            xcondition: Session.get("experimentXCond")
        }, function(error, result) {
            //We know they'll need to resume now
            Session.set("needResume", true);
            leavePage("/card");
        });
    },

    'click #turkButton': function(event) {
        event.preventDefault();
        var turkMsg = "Testing for now"; //TODO: need a good message
        var result = Meteor.call("turkPay", userTimesExpKey(true), turkMsg, function(error, result){
            if (typeof error !== "undefined") {
                //something happened - hopefully things will be updated reactively
                console.log("Failed to handle turk approval. Error:", error);
            }
            else if (result !== null) {
                //Server returned an error
                console.log("Server error on turk approval. Msg:", result);
            }
            else {
                console.log("Server turk approval appeared to work");
            }

            //No matter what, we should now be Turk approved
            //TODO: update the correct Session variable
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
