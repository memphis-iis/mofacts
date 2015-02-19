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

//Return currently references TDF unit
function currTdfUnit() {
    var thisTdf = Tdfs.findOne({fileName: Session.get("currentTdfName")});
    if (!thisTdf) {
        return null;
    }

    var currUnit = null;
    if (typeof thisTdf.tdfs.tutor.unit !== "undefined") {
        var unitIdx = Session.get("currentUnitNumber");
        currUnit = thisTdf.tdfs.tutor.unit[unitIdx];
    }

    return currUnit || null;
}

//Return current TDF unit's lockout minutes (or 0 if none-specified)
function currLockOutMinutes() {
    var currUnit = currTdfUnit();
    var lockoutminutes = 0;

    if (currUnit && currUnit.lockoutminutes) {
        lockoutminutes = Helpers.intVal(currUnit.lockoutminutes);
    }

    return lockoutminutes;
}

//Called intermittently to see if we are still locked out
function lockoutPeriodicCheck() {
    if (!lockoutFreeTime) {
        //TODO: figure out time to free the lockout
    }

    if (Date.now() >= lockoutFreeTime) {
        //TODO: blank time remaining
        //TODO: enable continue button
        clearLockoutInterval();
    }
    else {
        //TODO: update time remaining
        //TODO: insure continue button disabled
    }
}

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructionsTemplate.events({
    'click #continueButton' : function (event) {
        event.preventDefault();

        //Record the fact that we just showed instruction. Also - we use a
        //call back to redirect to the card display screen to make sure that
        //everything has been properly logged on the server
        recordUserTime("instructions", {
            currentUnit: Session.get("currentUnitNumber")
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

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.instructionsTemplate.helpers({
    backgroundImage: function() {
        var currUnit = currTdfUnit();
        var img = "";

        if (currUnit && currUnit.picture) {
            img = currUnit.picture;
        }

        return img;
    },

    instructions: function () {
        var currUnit = currTdfUnit();
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
});

Template.instructionsTemplate.rendered = function() {
    if (currLockOutMinutes() > 0) {
        startLockoutInterval();
    }
};
