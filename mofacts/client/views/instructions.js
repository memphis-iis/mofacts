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

function checkTurkActive() {
    //Turk display can only be active if we're in experiment mode
    if (Session.get("loginMode") !== "experiment") {
        return false; //Must be an experiment
    }

    if (!!Session.get("turkApprovalSent")) {
        return false; //Already done
    }

    //At this point, we should display turk stuff if it's in the TDF
    var currUnit = getCurrentTdfUnit();
    var turkpay = Helpers.trim(Helpers.firstElement(currUnit.turkpay)).toLowerCase();
    return (turkpay === "true");
}

function checkTurkBonus() {
    //Turk display can only be active if we're in experiment mode
    if (Session.get("loginMode") !== "experiment") {
        return false; //Must be an experiment
    }

    if (!!Session.get("turkBonusSent")) {
        return false; //Already done
    }

    //At this point, we should display turk stuff if it's in the TDF
    var currUnit = getCurrentTdfUnit();
    var turkbonus = Helpers.floatVal(Helpers.firstElement(currUnit.turkbonus));
    return (turkbonus > 0.000001);
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

        //If there isn't anything pending for mechanical turk, we will continue
        //as if they clicked on the button. Note that this auto-continue ONLY
        //happens for units with a lockout time
        if (!checkTurkActive() && !checkTurkBonus()) {
            Meteor.setInterval(
                function(){ $("#continueButton").click(); },
                1
            );
        }
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

                //At this point, we should display turk stuff if it's in the TDF
                var currUnit = getCurrentTdfUnit();
                var turkemail = Helpers.trim(Helpers.firstElement(currUnit.turkemail));
                var subject = Helpers.trim(Helpers.firstElement(currUnit.turkemailsubject));

                if (!turkemail) {
                    return; //No message
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
        //units left. Otherwise they can always go UNLESS we are displaying
        //a Turk screen
        if (Session.get("loginMode") === "experiment") {
            return getUnitsRemaining() > 0;
        }
        else {
            return true;
        }
    },

    //Note that the current template won't display continue or lockout stuff
    //if turkActive or turkBonus returns true

    turkActive: function() {
        return checkTurkActive();
    },

    turkBonus: function() {
        return checkTurkBonus();
    }
});


Template.instructions.rendered = function() {
    //Make sure lockout interval timer is running
    lockoutKick();

    //Init the modal dialog
    $('#turkModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });
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

        var currUnit = getCurrentTdfUnit();

        //Actually approve - note that we currently just use the default
        //message the server offers
        $('#turkModal').modal('show');
        Meteor.call("turkPay", userTimesExpKey(true), null, function(error, result){
            $('#turkModal').modal('hide');

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
            //(If there was an error, it will need to be examined in the log
            //and manually handled)
            Session.set("turkApprovalSent", true);
            lockoutKick();
        });
    },

    'click #turkBonusButton': function(event) {
        event.preventDefault();

        var experiment = userTimesExpKey(true);

        var tdfid = null;
        var unitidx = null;
        var currUnit = getCurrentTdfUnit();
        if (!!currUnit) {
            tdfid = getCurrentTdfFile()._id;
            unitidx = getCurrentUnitNumber();
        }

        console.log("About to request bonus for ", experiment, tdfid, unitidx);

        $('#turkModal').modal('show');
        Meteor.call("turkBonus", experiment, tdfid, unitidx, function(error, result){
            $('#turkModal').modal('hide');

            if (typeof error !== "undefined") {
                //something happened - hopefully things will be updated reactively
                console.log("Failed to handle turk bonus. Error:", error);
            }
            else if (result !== null) {
                //Server returned an error
                console.log("Server error on turk bous. Msg:", result);
            }
            else {
                console.log("Server turk bonus appeared to work");
            }

            //No matter what, we should now be Turk approved
            //(If there was an error, it will need to be examined in the log
            //and manually handled)
            Session.set("turkBonusSent", true);
            lockoutKick();
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
