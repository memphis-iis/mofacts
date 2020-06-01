/* experiment_times.js
 *
 * This script exports all user trial information in the DataShop tab-delimited
 * format a given experiment in.
 *
 * To use in Meteor, call createExperimentExport to get back a (fairly large)
 * array you can use to send a file to the client
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
 * (see card.js). However, when it is written to the userTimes log
 * as a field (for question/action/[timeout] actions) it is written as a
 * 1-based field.
 *
 * When a schedule is created from an assessment session, there is a condition
 * field written which corresponds the entry in the "initialpositions" section
 * of the assessment session. In the TDF, these positions are given by group
 * name and 1-based index (e.g. A_1, A_2, B_1). However, the condition in the
 * schedule item is written 0-based (e.g. A-0).
 * */

(function () { //Begin IIFE pattern

    // Define an ordering for the fields and the column name we'll put in the
    // output file. Note that these names must match the fields used in populate
    // record.
    var FIELDSDS = [
        //Needed*******************
        //Session ID

        //Not needed***************
        //Time Zone == UTC
        //Tutor Response Type
        //Tutor Response Subtype
        //Problem View

        "Anon Student Id", //username
        "Session ID", //not sure yet
        "Condition Namea", //new field? always == 'tdf file'************
        "Condition Typea", //selectedTdf
        "Condition Nameb", //new field? always == 'xcondition'************
        "Condition Typeb", //xcondition
        "Condition Namec", //new field? always == 'schedule condition" ***********
        "Condition Typec", //schedCondition
        "Condition Named", //new field? always == 'how answered'*******
        "Condition Typed", //howAnswered
        // "Condition Namee", //new field? always == 'button trial'***********
        // "Condition Typee", //wasButtonTrial
        "Level (Unit)", //unit
        "Level (Unitname)", //unitname
        "Problem Name", //questionValue
        "Step Name", //new field repeats questionValue
        "Time", //stimDisplayedTime
        "Selection",
        "Action",
        "Input", //userAnswer
        "Outcome", //answerCorrect recoded as CORRECT or INCORRECT
        "Student Response Type", //trialType
        "Student Response Subtype", //qtype
        "Tutor Response Type", //trialType
        "Tutor Response Subtype", //qtype
        "KC(Default)",
        "KC Category(Default)",
        "KC(Cluster)",
        "KC Category(Cluster)",
        "CF (GUI Source)",
        "CF (Audio Input Enabled)",
        "CF (Audio Output Enabled)",
        "CF (Display Order)", //questionIndex
        "CF (Stim File Index)", //clusterIndex
        "CF (Set Shuffled Index)", //shufIndex
        "CF (Stimulus Version)", //whichStim
        "CF (Correct Answer)", //CF correctAnswer
        "CF (Correct Answer Syllables)", // CF syllable list for correct answer
        "CF (Correct Answer Syllables Count)", // CF syllable list length
        "CF (Display Syllable Indices)", //CF the list of indices displayed to the user for subcloze hints
        "CF (Overlearning)", //CF isOverlearning
        "CF (Response Time)", //answerGivenTime
        "CF (Start Latency)", //startLatency check first trial discrepancy********
        "CF (End Latency)", //endLatency
        "CF (Review Latency)", //reviewLatency
        "CF (Review Entry)", //forceCorrectFeedback
        "CF (Button Order)", //CF buttonOrder
        "CF (Note)", //CF note
        "Feedback Text"
    ];


    //String together all arguments using the disp function
    function msg() {
        if (!arguments) {
            return "";
        }

        //Remember, arguments looks like an array, but it is NOT an array
        var all = [];
        for (var i = 0; i < arguments.length; ++i) {
            all.push(_.display(arguments[i]));
        }

        return all.join(' ');
    }

    //Helper to parse a schedule condition - see note above about 0 and 1 based
    //indexes for why we do some of our manipulation below
    function parseSchedItemCondition(cond) {
        if (typeof cond === "undefined" || !cond)
            return "UNKNOWN";

        var fields = _.trim('' + cond).split('-');
        if (fields.length !== 2)
            return cond;

        var num = parseInt(fields[1]);
        if (isNaN(num))
            return cond;

        return fields[0] + "_" + (num + 1).toString();
    }

    //Create our output record
    function populateRecord(state, username, lastexpcond, lastxcond, lastschedule, lastinstruct, lastq, lasta, nextq) {
        // Return the default value if the given value isn't "truthy" BUT numeric
        // zero (0) is considered "truthy". Note that the default value is always
        // the last argument
        var d = function () {
            var lastIndex = arguments.length - 1;
            for (var i = 0; i < lastIndex; ++i) {
                var val = arguments[i];
                if (!!val || val === 0) {
                    return val;
                }
            }
            return arguments[lastIndex]; //Default value
        };

        //Get the "actual" schedule object out of the last sched entry
        var sched = !!lastschedule ? lastschedule.schedule : null;

        //Either there was a system assigned xcond, a URL assigned xcond
        //(recorded in lastinstruct), or none at all
        var xcond = lastxcond !== null ? lastxcond : lastinstruct.xcondition;
        //Empty string becomes 0
        xcond = _.trim(d(xcond, '0')) || '0';

        //We might append a warning message
        var note = "";
        if (lasta.action !== "[timeout]" && d(lastq.clusterIndex, -1) !== d(lasta.index, -2)) {
            note += msg(
                    "QUESTION/ANSWER CLUSTER INDEX MISMATCH => q-clusterIndex:",
                    lastq.clusterIndex,
                    ", a-index:",
                    _.display(lasta.index),
                    " "
                    );
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

        // We attempt to get the "real" review latency, but we'll take the
        // pre-timeout "inferred" latency instead. Note that we will also guess
        // at inferred latency below if neither value is specified
        var reviewLatency = _.chain(lasta).prop("reviewLatency").intval().value();
        if (reviewLatency <= 0) {
            reviewLatency = _.chain(lasta).prop("inferredReviewLatency").intval().value();
        }

        // We change the latency numbers based on the ttype
        var ttype = lasta.ttype;
        if (ttype === "t") {
            //Test - no review latency
            reviewLatency = -1;
        }
        else if (ttype === "d") {
            //Dril - everything is fine, but what if inferredReviewLatency missing?
            if (!lasta.isCorrect && !reviewLatency) {
                // need to infer review latency
                if (nextq && nextq.clientSideTimeStamp) {
                    reviewLatency = nextq.clientSideTimeStamp - lasta.clientSideTimeStamp;
                }
                else {
                    reviewLatency = 1; //Nothing we can do about this one
                }
            }
        }
        else if (ttype === "s") {
            // Study - we ONLY have review latency, but it is in endLatency
            reviewLatency = endLatency;
            endLatency = -1;
            startLatency = -1;
        }

        //Figure out schedule item condition
        //See note above about indexes and 0 vs 1 based
        var schedCondition;
        if (sched && sched.q && sched.q.length) {
            var schedItemIndex = d(lastq.questionIndex, 0) - 1;
            if (schedItemIndex >= 0 && schedItemIndex < sched.q.length) {
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

        var tdfName = d(lastexpcond.selectedTdf, lastexpcond.currentTdfName, '');

        var unitNum = Math.max(d(lastq.currentUnit, -1), d(lastschedule.unitindex, -1), d(lastinstruct.currentUnit, -1));

        //We used to use the last schedule for unit name, but we don't always have
        //a schedule for the current unit (i.e. model-based units). Luckily we
        //now store the unit name in the instruction log entry
        // We have 3 sources for unit name: last instructions, last schedule,
        // and directly looking it up
        var unitName = _.trim(d(
            _.prop(lastinstruct, 'unitname'),
            _.prop(lastschedule, 'unitname'),
            ''
        ));
        if (!unitName) {
            serverConsole("Forced to lookup up unit name:", unitName);
            var tdf = Tdfs.findOne({'fileName': tdfName});
            unitName = _.chain(Tdfs.findOne({'fileName': tdfName}))
                .prop('tdfs')
                .prop('tutor')
                .prop('unit')
                .prop(_.intval(unitNum, -1))
                .prop('unitname')
                .trim()
                .value();
            // Cheat - store it in the instruction for the next Q/A pair
            // This should be OK because instructions are cleared if they don't
            // match the current unit index
            lastinstruct.currentUnit = unitNum;
            lastinstruct.unitname = unitName;
        }

        //used a lot below
        var isStudy = lasta.ttype === "s";

        if (isStudy) {
            outcome = "STUDY";
        }
        else {
            outcome = !!lasta.isCorrect ? "CORRECT" : "INCORRECT";
        }

        var temp = _.trim(d(lastq.selectedAnswer, '')).split('~');
        var corans = temp[0];

        //Track previous step names in the cross-call state so that we can
        //uniqify it (by user) by prepending a count
        if (typeof state.stepNameSeen === "undefined") {
            state.stepNameSeen = {};
        }
        var stepName = _.trim(d(lastq.selectedQuestion, ''));
        var stepCount = (state.stepNameSeen[stepName] || 0) + 1;
        state.stepNameSeen[stepName] = stepCount;
        stepName = stepCount + " " + stepName;

        var whichStim = d(lastq.whichStim, -1);
        if (whichStim < 0) {
            // For models, even if the q record is broken we might be able
            // to find whichStim
            whichStim = _.chain(lastq)
                .prop('currentCardInfo')
                .prop('whichStim').intval(-1)
                .value();
        }

        let currentAnswerSyllablesArray = "";
        let currentAnswerSyllableIndices = "";
        if(typeof(lasta.currentAnswerSyllables) !== "undefined"){
            currentAnswerSyllablesArray = lasta.currentAnswerSyllables.syllables;
            currentAnswerSyllableIndices = lasta.currentAnswerSyllables.displaySyllableIndices;
            currentAnswerSyllableCount = lasta.currentAnswerSyllables.count;
        }

        return {
            "Anon Student Id": d(username, ''),
            "Session ID": (new Date(d(lastq.clientSideTimeStamp, 0))).toUTCString().substr(0, 16) + " " + tdfName, //hack
            "Condition Namea": tdfName,
            "Condition Typea": 'tdf file',
            "Condition Nameb": xcond,
            "Condition Typeb": 'xcondition',
            "Condition Namec": d(schedCondition, ''),
            "Condition Typec": 'schedule condition',
            "Condition Named": d(lasta.guiSource, ''),
            "Condition Typed": 'how answered',
            "Condition Namee": d(lasta.wasButtonTrial, false),
            "Condition Typee": 'button trial',
            "Level (Unit)": unitNum,
            "Level (Unitname)": d(unitName, ''),
            "Problem Name": d(lastq.selectedQuestion, ''),
            "Step Name": stepName,
            "Time": d(lastq.clientSideTimeStamp, 0),
            "Selection": '',
            "Action": '',
            "Input": d(lasta.answer, ''),
            "Outcome": d(outcome, null), //answerCorrect recoded as CORRECT or INCORRECT
            "Student Response Type": isStudy ? "HINT_REQUEST" : "ATTEMPT", // where is ttype set?
            "Student Response Subtype": d(lasta.qtype, ''),
            "Tutor Response Type": isStudy ? "HINT_MSG" : "RESULT", // where is ttype set?
            "Tutor Response Subtype": '',
            "KC(Default)": d(lastq.clusterIndex, -1) + "-" + d(lastq.whichStim, -1) + " " + d(lastq.selectedQuestion, ''),
            "KC Category(Default)": '',
            "KC(Cluster)": d(lastq.clusterIndex + " " + lastq.selectedQuestion.replace(/___+/g, corans), ''),
            "KC Category(Cluster)": '',
            "CF (GUI Source)":d(lasta.guiSource,''),
            "CF (Audio Input Enabled)":lasta.audioInputEnabled,
            "CF (Audio Output Enabled)":lasta.audioOutputEnabled,
            "CF (Display Order)": d(lastq.questionIndex, -1),
            "CF (Stim File Index)": d(lastq.clusterIndex, -1),
            "CF (Set Shuffled Index)": d(lastq.shufIndex, d(lastq.clusterIndex, -1)), //why?
            "CF (Stimulus Version)": whichStim,
            "CF (Correct Answer)": corans,
            "CF (Correct Answer Syllables)": currentAnswerSyllablesArray, 
            "CF (Correct Answer Syllables Count)": currentAnswerSyllableCount,
            "CF (Display Syllable Indices)": currentAnswerSyllableIndices, 
            "CF (Overlearning)": d(lastq.showOverlearningText, false),
            "CF (Response Time)": d(lasta.clientSideTimeStamp, 0),
            "CF (Start Latency)": d(startLatency, 0),
            "CF (End Latency)": d(endLatency, 0),
            "CF (Review Latency)": d(reviewLatency, 0),
            "CF (Review Entry)": d(lasta.forceCorrectFeedback, ''),
            "CF (Button Order)": d(lasta.buttonOrder, ''),
            "CF (Note)": d(note, ''),
            "Feedback Text": d(lasta.displayedSystemResponse, ''),
        };
    }

    function populateInstructionRecord(state, username, lastexpcond, lastxcond, lastinstruct) {
        var instructBegin = _.chain(lastinstruct).prop("instructionClientStart").intval().value();
        var instructEnd = _.chain(lastinstruct).prop("clientSideTimeStamp").intval().value();
        var instructLatency = "";
        if (instructBegin > 0 && instructEnd > 0 && instructBegin <= instructEnd) {
            instructLatency = instructEnd - instructBegin;
        }

        var tdfName = _.trim(lastexpcond.selectedTdf) || _.trim(lastexpcond.currentTdfName);

        return {
            "Anon Student Id": _.trim(username),
            "Session ID": (new Date(_.intval(lastinstruct.clientSideTimeStamp))).toUTCString().substr(0, 16) + " " + tdfName, //hack
            "Condition Namea": tdfName,
            "Condition Typea": 'tdf file',
            "Condition Nameb": _.trim(_.intval(lastxcond !== null ? lastxcond : lastinstruct.xcondition)),
            "Condition Typeb": 'xcondition',
            "Condition Namec": 'N/A',
            "Condition Typec": 'schedule condition',
            "Condition Named": 'N/A',
            "Condition Typed": 'how answered',
            "Condition Namee": false,
            "Condition Typee": 'button trial',
            "Level (Unit)": _.intval(lastinstruct.currentUnit, -1),
            "Level (Unitname)": _.trim(lastinstruct.unitname),
            "Problem Name": 'Instructions',
            "Step Name": '',
            "Time": _.intval(lastinstruct.clientSideTimeStamp),
            "Selection": '',
            "Action": '',
            "Input": '',
            "Outcome": '', //answerCorrect recoded as CORRECT or INCORRECT
            "Student Response Type": "HINT_REQUEST", // or should be "ATTEMPT"?
            "Student Response Subtype": '',
            "Tutor Response Type": "HINT_MSG", // or should be "RESULT"?
            "Tutor Response Subtype": '',
            "KC(Default)": '',
            "KC Category(Default)": '',
            "KC(Cluster)": '',
            "KC Category(Cluster)": '',
            "CF (Display Order)": -1,
            "CF (Stim File Index)": -1,
            "CF (Set Shuffled Index)": -1,
            "CF (Stimulus Version)": -1,
            "CF (Correct Answer)": '',
            "CF (Overlearning)": false,
            "CF (Response Time)": 0,
            "CF (Start Latency)": 0,
            "CF (End Latency)": 0,
            "CF (Review Latency)": instructLatency,
            "CF (Button Order)": '',
            "CF (Note)": '',
            "Feedback Text": _.chain(lastinstruct).prop("feedbackText").trim().value()
        };
    }

    //Helper to transform our output record into a delimited record
    function delimitedRecord(rec) {
        var vals = new Array(FIELDSDS.length);
        for (var i = 0; i < FIELDSDS.length; ++i) {
            vals[i] = _.trim(rec[FIELDSDS[i]])
                .replace(/\s+/gm, ' ')   //Norm ws and remove non-space ws
                .slice(0, 255)           //Respect len limits for data shop
                .replace(/\s+$/gm, '');  //Might have revealed embedded space at end
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
        var lastxcond = null;

        //We let populate record maintain any state it needs between calls
        //You should note that state is PER USER
        state = {};

        var populated = null;

        for (var i = 0; i < recs.length; ++i) {
            var rec = recs[i];
            if (!rec || !rec.action || !rec.clientSideTimeStamp) {
                continue;
            }

            var uniqifier = rec.action + ':' + rec.clientSideTimeStamp;
            if (uniqifier in previousRecords) {
                continue; //dup detected
            }
            previousRecords[uniqifier] = true;

            var act = _.trim('' + rec.action).toLowerCase();

            if (act === "expcondition" || act === "condition-notify") {
                lastexpcond = rec;
            }
            else if (act === "xcondassign" || act === "xcondnotify") {
                lastxcond = rec.xcond;
            }
            else if (act === "schedule") {
                lastschedule = rec;
            }
            else if (act === "instructions") {
                lastinstruct = rec;
                lastq = null;

                // We now create a record from instruction display
                populated = null;
                try {
                    populated = populateInstructionRecord(state, username, lastexpcond, lastxcond, lastinstruct);
                }
                catch (e) {
                    serverConsole("There was an error populating the Instruction record - it will be skipped", e, e.stack);
                    serverConsole(
                        username,
                        JSON.stringify(lastexpcond),
                        JSON.stringify(lastinstruct),
                        JSON.stringify(rec)
                    );
                }
                if (populated) {
                    callback(populated);
                }
            }
            else if (act === "question") {
                lastq = rec;
            }
            else if (act === "answer" || act === "[timeout]") {
                //They might need the following question for inference
                var nextq = null;
                for (var j = i + 1; j < recs.length; ++j) {
                    if (_.trim('' + recs[j].action).toLowerCase() === "question") {
                        nextq = recs[j];
                        break;
                    }
                }

                // The last question's unit determines the unit for this answer:
                // Make sure that the schedule and instructions that we have
                // match the current unit.
                var questionUnit = _.chain(lastq).prop("currentUnit").intval(-1).value();

                var scheduleUnit = _.chain(lastschedule).prop("unitindex").intval(-1).value();
                if (scheduleUnit != questionUnit) {
                    lastschedule = {};
                }

                var instructUnit = _.chain(lastinstruct).prop("currentUnit").intval(-1).value();
                if (instructUnit != questionUnit) {
                    lastinstruct = {};
                }

                //FINALLY have enough to populate the record
                populated = null;
                try {
                    populated = populateRecord(state, username, lastexpcond, lastxcond, lastschedule, lastinstruct, lastq, rec, nextq);
                }
                catch (e) {
                    serverConsole("There was an error populating the record - it will be skipped", e, e.stack);
                    serverConsole(
                        username,
                        JSON.stringify(lastexpcond),
                        JSON.stringify(lastschedule),
                        JSON.stringify(lastinstruct),
                        JSON.stringify(lastq),
                        JSON.stringify(rec)
                    );
                }
                if (populated) {
                    callback(populated);
                }
            }
        }
    }

    // Exported main function: call recordAcceptor with each record generated
    // for expName in datashop format. We do NOT terminate our records.
    // We return the number of records written
    createExperimentExport = function (expName, format, recordAcceptor) {
        var header = {};
        var expNames = [];
        
        if (_.isString(expName)) {
            expNames.push(expName);
        } else {
            expNames = expName;
        }

        // We currently just ignore format

        FIELDSDS.forEach(function (f) {
            var prefix = f.substr(0, 14);

            var t;
            if (prefix === 'Condition Name') {
                t = 'Condition Name';
            }
            else if (prefix === 'Condition Type') {
                t = 'Condition Type';
            }
            else {
                t = f;
            }

            header[f] = t;
        });

        recordAcceptor(delimitedRecord(header));
        var recordCount = 1;

        UserTimesLog.find({}).forEach(function (entry) {
            var userRec = Meteor.users.findOne({_id: entry._id});
            if (!userRec || !userRec.username) {
                serverConsole("Skipping output for ", entry._id);
                return;
            }

            var username = userRec.username;

            expNames.forEach(function(expName) {
                processUserLog(username, entry, expName, function (rec) {
                    recordCount++;
                    recordAcceptor(delimitedRecord(rec));
                });
            });
        });

        return recordCount;
    };
})(); //end IIFE
