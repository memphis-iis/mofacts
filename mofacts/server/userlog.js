import { getTdfByFileName } from './methods';
export { userLogGetTdfId };
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

    //TODO: it might be handy to log this, but it's a LOT - only enable for
    //debug situations
    //serverConsole('writeUserLogEntries', experiment, userId, "Push Count = ", valsToPush.length);

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
        serverConsole("Ignoring user metric upsert ", e);
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
async function userLogGetTdfId(userid, experiment) {
    var userLog = UserTimesLog.findOne({ _id: userid });
    var entries = [];
    if (userLog && userLog[experiment] && userLog[experiment].length) {
        entries = userLog[experiment];
    }

    var filename = null;
    for(i = 0; i < entries.length; ++i) {
        rec = entries[i];
        action = _.trim(rec.action).toLowerCase();

        //Only need to see the tdf select event once to get the key
        if (action === "expcondition" || action === "condition-notify") {
            filename = _.display(rec.currentTdfName);
            if (!!filename) {
                break;
            }
        }
    }

    if (!!filename) {
        const tdf = await getTdfByFileName(filename);
        if (tdf) {
            return tdf._id;
        }
    }

    return null; //Whoops
};
