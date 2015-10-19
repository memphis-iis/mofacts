/*jshint sub:true*/

/* userlog.js - Server-side utilities for working with the user times log
**/

//Write user log entries for the current user
writeUserLogEntries = function(experiment, objectsToLog) {
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

    UserTimesLog.update(
        {_id: Meteor.userId()},
        action,
        {upsert: true}
    );
};

//Return the current score for the current user on the specified experiment
currentScore = function(experiment) {
    var score = 0;
    var correct = 0;
    var incorrect = 0;
    var i, rec, action;

    var userLog = UserTimesLog.findOne({ _id: Meteor.userId() });
    var entries = [];
    if (userLog && userLog[experiment] && userLog[experiment].length) {
        entries = userLog[experiment];
    }

    var previousRecords = {};
    var records = [];
    var tdfId = null;

    for(i = 0; i < entries.length; ++i) {
        rec = entries[i];
        action = Helpers.trim(rec.action).toLowerCase();

        //Only need to keep this once - won't event
        if (!tdfId && action === "profile tdf selection" && typeof rec.tdfkey !== "undefined") {
            tdfId = rec.tdfkey;
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
        previousRecords[uniqifier] = true;

        //We don't do much other than save the record
        records.push(rec);
    }

    //Nothing to without a tdfId
    if (!tdfId) {
        return null;
    }

    var tdf = Tdfs.findOne({_id: tdfId});
    if (typeof tdf.tdfs.tutor.unit === "undefined") {
        return null; //No units available
    }

    for (i = 0; i < records.length; ++i) {
        rec = records[i];
        action = Helpers.trim(rec.action).toLowerCase();
        if (action === "question") {
            if (!!rec.selType) {
                var currUnit = tdf.tdfs.tutor.unit[rec.currentUnit];
                if (currUnit) {
                    correct = Helpers.intVal(parms.correctscore);
                    incorrect = Helpers.intVal(parms.incorrectscore);
                }
            }
        }
        else if (action === "answer" || action === "[timeout]") {
            var wasCorrect = false;
            if (action === "answer") {
                wasCorrect = typeof entry.isCorrect !== "undefined" ? entry.isCorrect : false;
            }
            score += (wasCorrect ? correct : -incorrect);
        }
    }

    return score;
};
