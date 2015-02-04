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
            Router.go("card");
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
        Router.go("profile");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.instructionsTemplate.helpers({
    backgroundImage: function() {
        var thisTdf = Tdfs.findOne({fileName: Session.get("currentTdfName")});
        if (!thisTdf) {
            return;
        }

        var currUnit;
        if (typeof thisTdf.tdfs.tutor.unit !== "undefined") {
            var unitIdx = Session.get("currentUnitNumber");
            currUnit = thisTdf.tdfs.tutor.unit[unitIdx];
        }

        var img = "";
        if (currUnit && currUnit.picture) {
            img = currUnit.picture;
        }

        return img;
    },

    instructions: function () {
        var thisTdf = Tdfs.findOne({fileName: Session.get("currentTdfName")});
        if (!thisTdf) {
            //Whoops - no TDF at all
            Router.go("profile");
            return;
        }

        var instructions;
        if (typeof thisTdf.tdfs.tutor.unit !== "undefined") {
            var unit = Session.get("currentUnitNumber");
            instructions = thisTdf.tdfs.tutor.unit[unit].unitinstructions;
        }
        else {
            instructions = "Please do your best to answer each question.";
        }
        return instructions;
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
