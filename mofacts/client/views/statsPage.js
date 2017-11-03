////////////////////////////////////////////////////////////////////////////
// TEMPLATE EVENTS


Template.statsPage.events({
    'click #continueButton' : function (event) {
        event.preventDefault();
        Router.go("/profile");
    }
});

////////////////////////////////////////////////////////////////////////////
// TEMPLATE HELPERS

Template.statsPage.helpers({
    username: function() {
        if (!haveMeteorUser()) {
            routeToSignin();
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
statsPageUpdate = function() {
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

    //Record this page being rendered in the user times log - and wait for
    //the log to complete. This should give us the best chance at rendering
    //the most complete page
    recordUserTime("stats page rendered",
        { target: "user screen" },
        function() {
            statsPageUpdateImpl();
            Router.go("/stats");
        }
    );
};

//Actual logic called by statsPageUpdate above after server-side
//user time log is finished
function statsPageUpdateImpl() {
    if (Session.get("debugging")) {
        console.log("Rendering stats for user");
    }

    var answerDetails = [];

    //Just use the user progress storage handled by card
    var currentUserProgress = getUserProgress();

    var total = currentUserProgress.progressDataArray.length;
    var correct = 0;

    _.each(currentUserProgress.progressDataArray, function(item) {
        var userResponse = _.trim(item.userAnswer).toLowerCase();
        var theAnswer    = _.trim(item.answer    ).toLowerCase();

        var isCorrect = null;
        if (typeof item.isCorrect !== "undefined") {
            isCorrect = (item.isCorrect === "false" ? false : !!item.isCorrect);
        }
        else {
            item.MISSING_IS_CORRECT = "Answer checked manually";
            console.log("Found an answer without isCorrect flag");
            isCorrect = (userResponse === theAnswer);
        }

        var state = "danger";
        if(isCorrect) {
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
        var expKey = userTimesExpKey(true);

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

    if (Session.get("debugging")) {
        console.log("Stats Rendering: ", Session.get("statsRendered"),
            Session.get("statsCorrect"),
            Session.get("statsTotal"),
            Session.get("statsPercentage")
        );
    }
}
