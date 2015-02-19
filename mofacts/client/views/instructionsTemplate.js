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
            Router.go("/card");
        });
    },

    'click .logoutLink' : function (event) {
        event.preventDefault();
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User:", Meteor.user(), "Error:", error);
            }
            routeToSignin(); //Not much else to do now
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        Router.go("/profile");
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
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },
});
