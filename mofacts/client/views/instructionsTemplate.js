//TODO: user times log for instruction display (both before and after)
//TODO: should be able to show pictures AND instructions
//TODO: should handle proper unit for instruction display

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.instructionsTemplate.events({
    'click #continueButton' : function (event) {
        event.preventDefault();
        Router.go("card");
    },
    
    'click .logoutLink' : function (event) {
        event.preventDefault();
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User: " + Meteor.user() +" \n" +
                            "\tError: " + error + "\n");
            } else {
                Router.go("signin");
            }
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
            instructions = "Please enter answer in text box provided below questions.";
        }
        return instructions;
    },

    username: function () {
        if (!haveMeteorUser()) {
            Router.go("signin");
        }
        else {
            return Meteor.user().username;
        }
    },
});
