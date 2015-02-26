/* experiment_times.js
 *
 * This script exports all user trial information in a tabular format for
 * a given experiment. It is written so that it can be used from within
 * a Meteor application (on the server-side) or via the Mongo command
 * shell.
 *
 * To use in Meteor, call createExperimentExport to get back a (fairly large)
 * array you can use to send a file to the client
 *
 * To use in the Mongo console, run:
 *     mongo --quiet MoFaCT --eval "experiment='Music2.xml'" experiment_times.js
 * where MoFaCT is the database name on the local server
 *
 * Note that unlike other Meteor code, we don't assume that we have access to
 * the underscore library (since we might run as a Mongo script)
 * */

//Get our default output record
function populateRecord(username, lastinstruct, lastq, lasta) {
    var rec = {
        //TODO: default vals
    };

    //TODO: actual values

    return rec;
}

//Iterate over a user times log cursor and call the callback function with a
//record populated via populate record
function processUserLog(userTimesDoc, expName, callback) {
    var expKey = ('' + expName).replace(/\./g, "_");
    if (!(expKey in userTimesDoc)) {
        return;
    }

    var recs = userTimesDoc[expKey];
    if (!recs || !recs.length) {
        return;
    }

    var username = ""; //TODO: get user name from userTimesDoc._id

    var lastinstruct, lastq;

    for(var i = 0; i < recs.length; ++i) {
        var rec = recs[i];
        if (!rec || !rec.action) {
            continue;
        }

        var act = ('' + rec.action).trim().toLowerCase();

        if (act === "instruction") {
            lastinstruct = rec;
            lastq = null;
        }
        else if (act === "question") {
            lastq = rec;
        }
        else if (act === "answer" || act === "[timeout]") {
            callback(populateRecord(username, lastinstruct, lastq, rec));
        }
    }
}

//If running on the server in Meteor, support a function that returns an
//array of objects
if (typeof Meteor !== "undefined" && Meteor.isServer) {
    createExperimentExport = function(expName) {
        var results = [];

        UserTimesLog.find({}).forEach(function(entry) {
            processUserLog(entry, expName, function(rec) {
                results.push(rec);
            });
        });

        return results;
    };
}

//If not running under Meteor and we have the mongo console print function,
//We run directly!
if (typeof Meteor === "undefined" && typeof print !== "undefined") {
    (function() {
        if (typeof experiment === "undefined") {
            print("You must specify an experiment when running this as a mongo script");
            return;
        }

        db.userTimesLog.find().forEach(function (entry) {
            //TODO: we need a formatter to create the file format for us instead of just print json
            processUserLog(entry, experiment, function(rec) {
                printjsononeline(rec);
            });
        });
    })();
}
