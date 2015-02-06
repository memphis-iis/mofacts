/* client/lib/helpers.js
 *
 * Client-side helper functions
 * */

//Helper for calling server method

recordUserTime = function(action, extendedData, callback) {
    var testName = Session.get("currentStimName");
    if (!testName) {
        testName = "NO_CURRENT_TEST";
    }

    var dataRec = _.extend({
        action: action,
        clientSideTimeStamp: Date.now()
    }, extendedData);

    if (Session.get("debugging")) {
        console.log("userTime", testName, action, dataRec);
    }

    if (!!callback) {
        Meteor.call("userTime", testName, dataRec, callback);
    }
    else {
        Meteor.call("userTime", testName, dataRec);
    }
};

//Helper for question selection
recordUserTimeQuestion = function(extendedData) {
    var dataRec = _.extend({
        clusterIndex:         Session.get("clusterIndex"),
        questionIndex:        Session.get("questionIndex"),
        currentUnit:          Session.get("currentUnitNumber"),
        selectedQuestion:     Session.get("currentQuestion"),
        selectedAnswer:       Session.get("currentAnswer"),
        showOverlearningText: Session.get("showOverlearningText"),
        testType:             Session.get("testType"),
    }, extendedData || {});

    recordUserTime("question", dataRec);
};

//UI helpers (for the HTML template)

UI.registerHelper('equals', function (arg1, arg2, options) {
    return (arg1 === arg2);
});

UI.registerHelper('currentQuestion', function () {
    return Session.get("currentQuestion");
});

UI.registerHelper('currentAnswer', function () {
    return Session.get("currentAnswer");
});
