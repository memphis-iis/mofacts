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
 *
 *
 * A note concerning indexes
 * ***************************
 *
 * It can be confusing to keep track of what is 0-indexed and what is
 * 1-indexed in this system. The two main things to watch out for are
 * questionIndex and schedule item (question condition).
 *
 * questionIndex refers to the 0-based array of questions in the schedule
 * and is treated as a zero-based index while trials are being conducted
 * (see cardTemplate.js). However, when it is written to the userTimes log
 * as a field (for question/action/[timeout] actions) it is written as a
 * 1-based field.
 *
 * When a schedule is created from an assessment session, there is a condition
 * field written which corresponds the entry in the "initialpositions" section
 * of the assessment session. In the TDF, these positions are given by group
 * name and 1-based index (e.g. A_1, A_2, B_1). However, the condition in the
 * schedule item is written 0-based (e.g. A-0).
 * */

(function() { //Begin IIFE pattern

// Define an ordering for the fields and the column name we'll put in the
// output file. Note that these names must match the fields used in populate
// record.
var FIELDS = [
    "username",
    "selectedTdf",
    "unit",
    "unitname",
    "xcondition",
    "questionIndex",
    "clusterIndex",
    "whichStim",
    "questionValue",
    "correctAnswer",
    "stimDisplayedTime",
    "isOverlearning",
    "userAnswer",
    "schedCondition",
    "answerGivenTime",
    "startLatency",
    "endLatency",
    "howAnswered",
    "answerCorrect",
    "trialType",
    "qtype",
    "note",
];

//We don't rely on any other files in we're run as a script, so we have some
//helpers here

//Return a displayable string for given value (note we don't do anything fancy)
function disp(val) {
    if (!val && val !== false && val !== 0) {
        return "";
    }
    else {
        return ('' + val).trim();
    }
}

//String together all arguments using the disp function
function msg() {
    if (!arguments) {
        return "";
    }

    //Remember, arguments looks like an array, but it is NOT an array
    var all = [];
    for (var i = 0; i < arguments.length; ++i) {
        all.push(disp(arguments[i]));
    }

    return all.join(' ');
}

//Helper to parse a schedule condition - see note above about 0 and 1 based
//indexes for why we do some of our manipulation below
function parseSchedItemCondition(cond) {
    if (typeof cond === "undefined" || !cond)
        return "UNKNOWN";

    var fields = ('' + cond).trim().split('-');
    if (fields.length !== 2)
        return cond;

    var num = parseInt(fields[1]);
    if (isNaN(num))
        return cond;

    return fields[0] + "_" + (num + 1).toString();
}

//Create our output record
function populateRecord(username, lastexpcond, lastschedule, lastinstruct, lastq, lasta) {
    //Return the default value if the given value isn't "truthy" BUT numeric
    //zero (0) is considered "truthy".
    var d = function(val, defval) {
        if (!val && val !== 0) return defval;
        else                   return val;
    };

    //Get the "actual" schedule object out of the last sched entry
    var sched = !!lastschedule ? lastschedule.schedule : null;

    //We might append a warning message
    var note = "";
    if ( lasta.action !== "[timeout]" && d(lastq.clusterIndex, -1) !== d(lasta.index, -2) ) {
        note += msg(
            "QUESTION/ANSWER CLUSTER INDEX MISMATCH => q-clusterIndex:",
            lastq.clusterIndex,
            ", a-index:",
            disp(lasta.index),
            " "
        );
    }
    if ( sched && sched.q && d(lastq.questionIndex, -1) !== d(lasta.questionIndex, -2) ) {
        //Currently we have some legacy data in the user time log where not
        //every question/answer has a questionIndex for both question and
        //answer. If the data has been completely reset recently, then we
        //put this code back in.
        /*
        note += msg(
            "QUESTION/ANSWER Q-INDEX MISMATCH => q-questionIndex:",
            d(lastq.questionIndex, 'missing'),
            ", a-questionIndex:",
            d(lasta.questionIndex, 'missing'),
            " "
        );
        */
    }

    //Grab the latency number. Note that if we don't have them (they were added
    //later) then we calculate the latency numbers - note that some trials
    //(button trials) or timeouts might not have a first action timestamp, so
    //we use the client-side timestamp. That means for button trials,
    //startLatency = endLatency
    var firstAction = lasta.firstActionTimestamp || lasta.clientSideTimeStamp;

    var startLatency = lasta.startLatency || 0;
    if (!startLatency) {
        startLatency = firstAction - lastq.clientSideTimeStamp;
    }

    var endLatency = lasta.endLatency || 0;
    if (!endLatency) {
        endLatency = lasta.clientSideTimeStamp - lastq.clientSideTimeStamp;
    }

    //Figure out schedule item condition
    //See note above about indexes and 0 vs 1 based
    var schedCondition;
    if (sched && sched.q && sched.q.length) {
        var schedItemIndex = d(lastq.questionIndex, 0) - 1;
        if (schedItemIndex < sched.q.length) {
            schedCondition = parseSchedItemCondition(sched.q[schedItemIndex].condition);
        }
        else {
            note += msg(
                "SCHEDULE Q-INDEX MISMATCH => sched.q.length:",
                d(sched.q.length, 'missing'),
                ", lastq.questionIndex-1:",
                d(schedItemIndex, 'missing'),
                " "
            );
        }
    }
    else {
        schedCondition = "N/A";
    }

    //All done - put the record together
    return {
        //Unit is special: we take the larget from our various sources
        unit: Math.max(
            d(lastq.currentUnit,        -1),
            d(lastschedule.unitindex,   -1),
            d(lastinstruct.currentUnit, -1)
        ),

        username:          d(username                   ,''),
        selectedTdf:       d(lastexpcond.selectedTdf    ,''),
        unitname:          d(lastschedule.unitname      ,''),
        xcondition:        d(lastinstruct.xcondition    ,''),
        questionIndex:     d(lastq.questionIndex        ,-1),
        clusterIndex:      d(lastq.clusterIndex         ,-1),
        whichStim:         d(lastq.whichStim            ,-1),
        questionValue:     d(lastq.selectedQuestion     ,''),
        correctAnswer:     d(lastq.selectedAnswer       ,''),
        stimDisplayedTime: d(lastq.clientSideTimeStamp  ,0),
        isOverlearning:    d(lastq.showOverlearningText ,false),
        userAnswer:        d(lasta.answer               ,''),
        schedCondition:    d(schedCondition             ,''),
        answerGivenTime:   d(lasta.clientSideTimeStamp  ,0),
        startLatency:      d(startLatency               ,0),
        endLatency:        d(endLatency                 ,0),
        howAnswered:       d(lasta.guiSource            ,''),
        answerCorrect:     d(lasta.isCorrect            ,null),
        trialType:         d(lasta.ttype                ,''),
        qtype:             d(lasta.qtype                ,''),
        note:              d(note                       ,''),
    };
}

//Helper to transform our output record into a delimited record
function delimitedRecord(rec) {
    vals = new Array(FIELDS.length);
    for(var i = 0; i < FIELDS.length; ++i) {
        vals[i] = disp(rec[FIELDS[i]]);
    }
    return vals.join('\t');
}

//Iterate over a user times log cursor and call the callback function with a
//record populated with current information in log
function processUserLog(username, userTimesDoc, expName, callback) {
    var expKey = ('' + expName).replace(/\./g, "_");
    if (!(expKey in userTimesDoc)) {
        return;
    }

    var recs = userTimesDoc[expKey];
    if (!recs || !recs.length) {
        return;
    }

    //There can be duplicate records in the event of connection reset - the
    //client side libs will resend Meteor method calls if they never got an
    //ACK back. Since we grab a timestamp on the client, we can eliminate
    //these spurious dups. Just to be safe we track both timestamp and action
    var previousRecords = {};

    //Note our defaults in case there are errors
    var lastschedule = {};
    var lastexpcond = {selectedTdf: expName};
    var lastinstruct = {};
    var lastq = {};

    for(var i = 0; i < recs.length; ++i) {
        var rec = recs[i];
        if (!rec || !rec.action || !rec.clientSideTimeStamp) {
            continue;
        }

        var uniqifier = rec.action + ':' + rec.clientSideTimeStamp;
        if (uniqifier in previousRecords) {
            continue; //dup detected
        }
        previousRecords[uniqifier] = true;

        var act = ('' + rec.action).trim().toLowerCase();

        if (act === "expcondition" || act === "condition-notify") {
            lastexpcond = rec;
        }
        else if (act === "schedule") {
            lastschedule = rec;
        }
        else if (act === "instructions") {
            lastinstruct = rec;
            lastq = null;
        }
        else if (act === "question") {
            lastq = rec;
        }
        else if (act === "answer" || act === "[timeout]") {
            callback(populateRecord(username, lastexpcond, lastschedule, lastinstruct, lastq, rec));
        }
    }
}

//If running on the server in Meteor, support a function that returns an
//array of objects
if (typeof Meteor !== "undefined" && Meteor.isServer) {
    createExperimentExport = function(expName) {
        var results = [];

        UserTimesLog.find({}).forEach(function(entry) {
            var username = Meteor.users.findOne({_id: entry._id}).username;
            processUserLog(username, entry, expName, function(rec) {
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

        var header = {};
        FIELDS.forEach(function (f) {
            header[f] = f;
        });
        print(delimitedRecord(header));

        db.userTimesLog.find().forEach(function (entry) {
            var username = db.users.findOne({_id: entry._id}).username;
            processUserLog(username, entry, experiment, function(rec) {
                print(delimitedRecord(rec));
            });
        });
    })();
}

})(); //end IIFE
