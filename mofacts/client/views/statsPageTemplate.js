////////////////////////////////////////////////////////////////////////////
// TEMPLATE EVENTS


Template.statsPageTemplate.events({
    'click #continueButton' : function (event) {
        event.preventDefault();
        Router.go("profile");
    },

    'click .logoutLink' : function (event) {
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                console.log("Error Logging out [" + Meteor.user() + "] " + error);
            }
            event.preventDefault();
            Router.go("signin");
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
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

    statsRendered:        function() { return Session.get("statsRendered"); },
    statsCorrect:         function() { return Session.get("statsCorrect"); },
    statsTotal:           function() { return Session.get("statsTotal"); },
    statsPercentage:      function() { return Session.get("statsPercentage"); },
    statsAnswerDetails:   function() { return Session.get("statsAnswerDetails"); },
    statsUserTimeLogView: function() { return Session.get("statsUserTimeLogView"); },
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
    Session.set("statsUserTimeLogView", undefined);

    //Must have a user to continue
    if (!haveMeteorUser()) {
        return;
    }
    
    recordUserTime("stats page rendered", {
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
            //TODO: we shouldn't be comparing here - we should be using a field
            //      from the data structure set when the comparison is made
            
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
        
        //Simple debugging view of user time log in reverse order
        var userTimeLogView = [];
        if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
            var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
            
            var currentTest = Session.get("currentTest");
            if (!currentTest) {
                currentTest = "NO_CURRENT_TEST";
            }
            var expKey = currentTest.replace(/\./g, "_");
            
            var statFormatDate = function(ts) {
                if (!ts) return "";
                else     return new Date(ts).toLocaleString();
            };
            var drift = function(cli, srv) {
                if (!cli || !srv) return "";
                else              return Math.abs(cli - srv).toFixed(0) + " ms";
            };
            
            if (userLog && userLog[expKey] && userLog[expKey].length) {
                userTimeLogView = _.map(userLog[expKey], function(entry) {
                    var cliTS = entry.clientSideTimeStamp;
                    var srvTS = entry.serverSideTimeStamp;
                    return {
                        action: entry.action,
                        serverDate: statFormatDate(srvTS),
                        clientDate: statFormatDate(cliTS),
                        timeDrift: drift(cliTS, srvTS),
                        data: JSON.stringify(entry)
                    };
                });
                userTimeLogView.reverse();
            }
        }

        Session.set("statsRendered", true);
        Session.set("statsCorrect", correct);
        Session.set("statsTotal", total);
        Session.set("statsPercentage", percentage);
        Session.set("statsAnswerDetails", answerDetails);
        Session.set("statsUserTimeLogView", userTimeLogView);
    }

    if (Session.get("debugging")) {
        console.log("Stats Rendering: ", Session.get("statsRendered"),
            Session.get("statsCorrect"),
            Session.get("statsTotal"),
            Session.get("statsPercentage")
        );
    }
};

