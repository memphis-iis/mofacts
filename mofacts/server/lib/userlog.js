/*jshint sub:true*/

/* userlog.js - Server-side utilities for working with the user times log
**/

//Write user log entries - if userId is not specified we use the current user
writeUserLogEntries = function(experiment, objectsToLog, userId) {
    if (!userId) {
        userId = Meteor.userId();
    }
    if (!userId) {
        throw new Meteor.Error("No valid user ID found for User Log Entry");
    }

    var objType = typeof objectsToLog;
    var valsToPush = [];

    if (typeof objectsToLog === "undefined") {
        //Nothing passed to us: use an empty object, which will
        //contain only the current time
        valsToPush.push({});
    }
    else if (typeof objectsToLog.length === "undefined") {
        //Not an array - they passed a single object
        valsToPush.push(objectsToLog);
    }
    else {
        //Grab the entire array
        for (i = 0; i < objectsToLog.length; i++) {
            valsToPush.push(objectsToLog[i]);
        }
    }

    //Every object we log gets a server side time stamp
    for (i = 0; i < valsToPush.length; i++) {
        valsToPush[i]["serverSideTimeStamp"] = Date.now();
    }

    //Create action object: should look like:
    // { $push: { <experiment_key>: { $each: <objectsToLog in array> } } }
    var action = {$push: {}};
    var experiment_key = (experiment + "").replace(/\./g, "_");
    var allVals = {$each: valsToPush};
    action["$push"][experiment_key] = allVals;

    UserTimesLog.update( {_id: userId}, action, {upsert: true} );
    logUserMetrics(userId, experiment_key, valsToPush);
};

//Utility - update server-side metrics when we see an answer
function logUserMetrics(userId, experimentKey, valsToCheck) {
    //Gather the answers we should use to check
    var i;
    var answers = [];
    for (i = 0; i < valsToCheck.length; i++) {
        var recAction = _.prop(valsToCheck[i], "action");
        if (recAction == "answer" || recAction == "[timeout]") {
            answers.push(valsToCheck[i]);
        }
    }

    //Leave if nothing to do
    if (answers.length < 1) {
        return;
    }

    //Insure record matching ID is present while working around MongoDB 2.4 bug
    try {
        UserMetrics.update({_id: userId}, {'$set': {'preUpdate': true}}, {upsert: true});
    }
    catch(e) {
        console.log("Ignoring user metric upsert ", e);
    }

    var makeKey = function(idx, fieldName) {
        return experimentKey + '.' + idx + '.' + fieldName;
    };

    for(i = 0; i < answers.length; ++i) {
        var answer = answers[i];
        var ttype = _.trim(_.prop(answer, "ttype"));
        var idx = _.intval(_.prop(answer, "shufIndex"));

        var action;
        if (ttype == 's') {
            //Study
            var reviewTime = _.intval(_.prop(answer, "inferredReviewLatency"));
            action = [{ '$push': {}, '$inc': {} }];
            action[0]['$push'][makeKey(idx, 'studyTimes')] = reviewTime;
            action[0]['$inc' ][makeKey(idx, 'studyCount')] = 1;
        }
        else {
            var isCorrect = !!_.prop(answer, "isCorrect");
            var answerTime = _.intval(_.prop(answer, "endLatency"));
            action = [{'$push': {}, '$inc': {}}];
            action[0]['$push'][makeKey(idx, 'answerTimes')] = answerTime;
            action[0]['$push'][makeKey(idx, 'answerCorrect')] = isCorrect;
            action[0]['$inc' ][makeKey(idx, 'questionCount')] = 1;
            action[0]['$inc' ][makeKey(idx, 'correctAnswerCount')] = (isCorrect ? 1 : 0);
        }

        for (var j = 0; j < action.length; ++j) {
            UserMetrics.update({_id: userId}, action[j]);
        }
    }
}

//Given a user ID (_id) and an experiment, return the corresponding tdfId (_id)
userLogGetTdfId = function(userid, experiment) {
    var userLog = UserTimesLog.findOne({ _id: userid });
    var entries = [];
    if (userLog && userLog[experiment] && userLog[experiment].length) {
        entries = userLog[experiment];
    }

    var filename = null;
    for(i = 0; i < entries.length; ++i) {
        rec = entries[i];
        action = Helpers.trim(rec.action).toLowerCase();

        //Only need to see the tdf select event once to get the key
        if (action === "expcondition" || action === "condition-notify") {
            filename = Helpers.display(rec.currentTdfName);
            if (!!filename) {
                break;
            }
        }
    }

    if (!!filename) {
        var tdf = Tdfs.findOne({'fileName': filename});
        if (tdf) {
            return tdf._id;
        }
    }

    return null; //Whoops
};

//Return the current score for the current user on the specified experiment
userLogCurrentScore = function(experiment) {
    var i, rec, action;

    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
    var entries = [];
    if (userLog && userLog[experiment] && userLog[experiment].length) {
        entries = userLog[experiment];
    }

    var previousRecords = {};
    var records = [];
    var tdf = null;

    for(i = 0; i < entries.length; ++i) {
        rec = entries[i];
        action = Helpers.trim(rec.action).toLowerCase();

        //We will need the tdf
        if (!tdf && (action === "expcondition" || action === "condition-notify")) {
            tdf = Tdfs.findOne({'fileName': rec.currentTdfName});
            continue;
        }

        //We are only going to need q&a's
        if (action != "answer" && action != "question" && action === "[timeout]") {
            continue;
        }

        //Suppress duplicates like we do on the server side for file export
        var uniqifier = rec.action + ':' + rec.clientSideTimeStamp;
        if (uniqifier in previousRecords) {
            continue; //dup detected
        }

        //We don't do much other than save the record
        previousRecords[uniqifier] = true;
        records.push(rec);
    }

    //Nothing to do without a tdf
    if (!tdf || typeof tdf.tdfs.tutor.unit === "undefined") {
        return null; //No units available
    }

    //Helper for our param extraction below: we expect val to a single valued
    //array with a numeric parameter. If not we return def
    function getNumVal(val, def) {
        val = Helpers.firstElement(val);
        if (!!val || val === 0 || val === "0") return Helpers.intVal(val);
        else                                   return def;
    }

    //A tiny stripped down version of the logic for delivery params - we just
    //need to get scoring. See the full details in the function
    //getCurrentDeliveryParams in client/lib/currentTestingHelpers.js
    var correct = 0;
    var incorrect = 0;
    var setScoring = function(unitIdx) {
        correct = 1; incorrect = 0; // Set system default values

        var unit = null;
        if (!!unitIdx || unitIdx === 0) {
            unit = tdf.tdfs.tutor.unit[Helpers.intVal(unitIdx)] || null;
        }
        var deliveryparams = !!unit ? unit.deliveryparams : null;
        if (!deliveryparams && typeof tdf.tdfs.tutor.deliveryparams !== "undefined") {
            deliveryparams = tdf.tdfs.tutor.deliveryparams;
        }
        if (!deliveryparams) {
            return; //Could not get params - leave and use default values
        }

        correct = getNumVal(deliveryparams.correctprompt, 1);
        incorrect = getNumVal(deliveryparams.incorrectprompt, 0);
    };

    var score = 0;
    for (i = 0; i < records.length; ++i) {
        rec = records[i];
        action = Helpers.trim(rec.action).toLowerCase();
        if (action === "question") {
            if (!!rec.selType) {
                setScoring(rec.currentUnit);
            }
        }
        else if (action === "answer" || action === "[timeout]") {
            var wasCorrect = false;
            if (action === "answer") {
                wasCorrect = typeof rec.isCorrect !== "undefined" ? rec.isCorrect : false;
            }
            score += (wasCorrect ? correct : -incorrect);
        }
    }

    return score;
};
