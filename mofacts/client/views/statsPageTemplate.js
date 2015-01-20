////////////////////////////////////////////////////////////////////////////
// TEMPLATE EVENTS


Template.statsPageTemplate.events({
    'click #continueButton' : function () {
        Router.go("profile");
    },

    'click .logoutLink' : function () {
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                console.log("Error Logging out [" + Meteor.user() + "] " + error);
            }
            Router.go("signin");
        });
    },

    'click .homeLink' : function () {
        Router.go("profile");
    }
});

////////////////////////////////////////////////////////////////////////////
// TEMPLATE HELPERS

Template.statsPageTemplate.helpers({
    username: function() {
        if (!haveMeteorUser()) {
            Router.go("signin");
        }
        else {
            return Meteor.user().username;
        }
    },

    statsRendered:      function() { return Session.get("statsRendered"); },
    statsCorrect:       function() { return Session.get("statsCorrect"); },
    statsTotal:         function() { return Session.get("statsTotal"); },
    statsPercentage:    function() { return Session.get("statsPercentage"); },
    statsAnswerDetails: function() { return Session.get("statsAnswerDetails"); },
});


////////////////////////////////////////////////////////////////////////////
// IMPLEMENTATION FUNCTIONS

//Calculates the stats displayed by this page
statsPageTemplateUpdate = function() {
    //Set up the stats variables used in the HTML template
    Session.set("statsRendered", false);
    Session.set("statsCorrect", undefined);
    Session.set("statsTotal", undefined);
    Session.set("statsPercentage", undefined);

    //Must have a user to continue
    if (!haveMeteorUser()) {
        return;
    }

    var currentTest = Session.get("currentTest");
    if (!currentTest) {
        currentTest = "UnknownExperiment";
    }
    Meteor.call("userTime", currentTest, {
        action: "stats page rendered",
        target: "user screen"
    });

    if (Session.get("debugging")) {
        console.log("Rendering stats for user");
    }

    var answerDetails = [];

    var currentUserProgress = UserProgress.findOne(
        { _id: Meteor.userId() },
        { progressDataArray: 1 }
    );

    if (currentUserProgress) {
        var total = currentUserProgress.progressDataArray.length;
        var correct = 0;

        _.each(currentUserProgress.progressDataArray, function(item) {
            var userResponse = Helpers.trim(item.userAnswer).toLowerCase();
            var theAnswer    = Helpers.trim(item.answer    ).toLowerCase();

            var state = "danger";
            if(userResponse === theAnswer) {
                correct++;
                state = "success";
            }

            answerDetails.push({
                correctAnswer: theAnswer,
                userAnswer: userResponse,
                answerState: state,
            });
        });

        var percentage = 0.0;
        if (total > 0) {
            percentage =  Math.round( (correct / total) * 100.0) ;
        }

        Session.set("statsRendered", true);
        Session.set("statsCorrect", correct);
        Session.set("statsTotal", total);
        Session.set("statsPercentage", percentage);
        Session.set("statsAnswerDetails", answerDetails);
    }

    if (Session.get("debugging")) {
        console.log("Stats Rendering: ", Session.get("statsRendered"),
            Session.get("statsCorrect"),
            Session.get("statsTotal"),
            Session.get("statsPercentage")
        );
    }
};
