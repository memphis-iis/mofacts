/* client/lib/userTimeHelpers.js
 *
 * Client-side helper functions for working with the user time log
 * */

//Because the experiment key is used multiple places, we centralize it here.
//By default we assume that they just want the "raw" version suitable for
//using for a Meteor.call("userTime", ...) call. However, if fixForDirectAccess
//is true(-ish), we'll fix up the value we return
userTimesExpKey = function(fixForDirectAccess) {
    //Note: we use currentRootTdfName instead of currentTdfName so multiple
    //experimental conditions log to the same base TDF
    var expKey = Session.get("currentRootTdfName");
    if (!expKey) {
        expKey = "NO_CURRENT_EXP_KEY";
    }

    if (!!fixForDirectAccess) {
        expKey = expKey.replace(/\./g, "_");
    }

    return expKey;
};

//Helper to create a user time record - you should only need this if you
//want to call recordUserTimeMulti directly
createUserTimeRecord = function(action, extendedData) {
    var dataRec = _.extend({
        action: action,
        clientSideTimeStamp: Date.now()
    }, extendedData);

    if (Session.get("debugging")) {
        console.log("userTime", dataRec);
    }

    if (_.contains(["instructions", "instructions-dup", "schedule", "question", "answer", "[timeout]"], action)) {
        Session.set("lastTimestamp", dataRec.clientSideTimeStamp);
    }

    return dataRec;
};

//Call the server method, allowing multiple data recs.
//
//dataRecs should be EITHER a single record created with createUserTimeRecord
//*OR* an array of objects created with createUserTimeRecord
recordUserTimeMulti = function(dataRecs, callback) {
    var testName = userTimesExpKey();
    if (!!callback) {
        Meteor.call("userTime", testName, dataRecs, callback);
    }
    else {
        Meteor.call("userTime", testName, dataRecs);
    }
};

//Helper for calling server method - you can send multiple records at once
//by using the less-helpful recordUserTimeMulti
recordUserTime = function(action, extendedData, callback) {
    recordUserTimeMulti(createUserTimeRecord(action, extendedData), callback);
};

//Helper for question selection
recordUserTimeQuestion = function(extendedData) {
    var currCluster = getStimCluster(getCurrentClusterIndex());

    var dataRec = _.extend({
        clusterIndex:         currCluster.clusterIndex,
        shufIndex:            currCluster.shufIndex,
        questionIndex:        Session.get("questionIndex"),
        currentUnit:          Session.get("currentUnitNumber"),
        curSubTdfIndex:       Session.get("subTdfIndex"),
        originalQuestion:     Session.get("originalQuestion"),
        originalQuestion2:    Session.get("originalQuestion2"),
        selectedDisplay:      Session.get("currentDisplay"),
        selectedQuestion:     Session.get("currentQuestion"),
        selectedQuestionPart2:Session.get("currentQuestionPart2"),
        selectedAnswer:       Session.get("currentAnswer"),
        originalAnswer:       Session.get("originalAnswer"),
        showOverlearningText: Session.get("showOverlearningText"),
        testType:             Session.get("testType"),
    }, extendedData || {});

    recordUserTime("question", dataRec);
};
