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
        if (!Meteor.userId()) {
            Router.go("signin");
            window.location.reload(); //TODO: can we remove this?
            return;
        }
        else {
            return Meteor.user().username;
        }
    },
});
