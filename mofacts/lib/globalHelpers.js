//////////////////////////////////////////////////////////////////////////
// Global variable helpers
//
// Note that we put in this in the lib directory to insure it is loaded
// before code in other dirs, but currently we only defined these functions
// on the client

//Poly-fills for missing functionality
if (!Date.now) {
    Date.now = function now() {
        return new Date().getTime();
    };
}

//Helper function for underscore that accesses a property by name but
//returns null either the object is "falsey" or the property is missing
// Given o = {a: {z: [1,2,3]}} then
// _.chain(o).prop('a').prop('z').value == [1,2,3]
// _.chain(o).prop('a').prop('z').first().intval().value == 1
// _.chain(o).prop('a').prop('z').first().floatval().value == 1.0
// _.chain(o).prop('a').prop('z').first().prop('nope') == null
// _.chain(o).prop('bad start').prop('z') == null
if (_ && _.mixin) {
    _.mixin({
        prop: function(obj, propname) {
            if (_.isArray(obj) && _.isNumber(propname)) {
                return obj[propname];
            }
            else if ((!obj && obj !== "") || !propname || !_.has(obj, propname)) {
                return null;
            }
            else {
                return obj[propname];
            }
        },

        intval: function(src, defaultVal) {
            if (!src && src !== false && src !== 0) {
                src = "";
            }
            else {
                src = ("" + src).replace(/^\s+|\s+$/gm, '');
            }

            var val = parseInt(src);
            defaultVal = defaultVal || 0;
            return isNaN(val) ? defaultVal : val;
        },

        floatval: function(src, defaultVal) {
            if (!src && src !== false) {
                src = "";
            }
            else {
                src = ("" + src).replace(/^\s+|\s+$/gm, '');
            }

            var val = parseFloat(src);
            defaultVal = defaultVal || 0.0;
            return isFinite(val) ? val : defaultVal;
        },

        trim: function(s) {
            if (!s && s !== 0 && s !== false)
                return "";

            var ss = "" + s;
            if (!ss || !ss.length || ss.length < 1) {
                return "";
            }

            if (ss.trim) {
                return ss.trim();
            }
            else {
                return ss.replace(/^\s+|\s+$/gm, '');
            }
        },

        sum: function(lst) {
            return _.reduce(
                lst,
                function(memo, num){ return memo + (isFinite(num) ? num : 0.0); },
                0
            );
        },
    });
}

// User progress data - Note that this is only used on the client, but we want
// to make sure that it is always available (and thus is in the lib folder)

if (typeof Meteor !== "undefined" && Meteor.isClient) {
    //Initialize user progress storage, with optional initial data
    initUserProgress = function(overrideData) {
        var initVals = {
            currentTestMode: "NONE",
            currentScore: 0,
            progressDataArray: []
        };

        if (!!overrideData) {
            initVals = _.extend(initVals, overrideData);

        }
        userProgress = initVals;
    };

    //Provide access to user progress. Note that this function provides
    //an always-created object with lazy init.
    getUserProgress = function() {
        if (!userProgress) {
            initUserProgress();
        }
        return userProgress;
    };
}

// Useful function for display and debugging objects: returns an OK JSON
// pretty-print textual representation of the object
//Helpful wrapper around JSON.stringify, including timestamp field expansion
displayify = function(obj) {
    if (typeof obj === "string" || typeof obj === "number") {
        return obj;
    }
    var dispObj = _.extend({}, obj);

    try {
        for (var prop in dispObj) {
            if (prop.toLowerCase().endsWith('timestamp')) {
                var ts = _.intval(_.prop(obj, prop));
                if (ts > 0) {
                    dispObj[prop] = " " + new Date(ts) + " (converted from " + ts + ")";
                }
            }
        }
    }
    catch(e) {
        console.log("Object displayify error", e);
    }

    return JSON.stringify(dispObj, null, 2);
};


// MoFaCTs-4882's Additions
// TODO: look to move these into their module
// TODO: good opportunity to clean up our global modules


// Moved this function out to accommodate the NaN situations
//INPUT: a score, a float between 0 and 1
//OUTPUT: a hex color code corresponding to the item's desired color.
determineButtonColor = function(score) {
    // The colors used to gradient the buttons based on correctness scores.
    // They need to be sorted with the most wrong color first, and the most
    // right color last. The current schema is bad=red, good=blue. Also notice
    // that we return a special color if score is NaN.
    var colors = [
        "#800000", "#990000", "#b10000", "#cc0000", "#e60000", "#ff0000", "#ff1a1a", "#ff3333", "#ff4d4d", "#ff6666",
        "#6666ff", "#4d4dff", "#3333ff", "#1a1aff", "#0000ff", "#0000e6", "#0000cc", "#0000b3", "#000099", "#000080"
    ];

    if (isNaN(score)) {
        return "#b0b09b";
    }

    var colorIndex;
    if (score == 1) {
        colorIndex = colors.length - 1;
    }
    else {
        colorIndex = Math.floor(score / (1.0 / colors.length));
    }

    return colors[colorIndex];
};

// Simple function to randomly assign a value between 0 and 1, to 2 digits. E.g. .42, 1.00, .28
randomScore = function() {
    return Math.floor(Math.random()*100)/100;
};

// Moved from client view to here for code separation purposes.
//INPUT: user, which is an object containing an _id which corresponds to a doc in UserMetrics, and the name of the relevant Tdf (in Mongo-recognizable format)
//OUTPUT: a ratio which is the user's average score across all items for the client's current system.
computeUserScore = function(user, tdfname) {
    var indivUserQuery = {'_id': user._id};
    // We use findOne because there should only ever be one user with any given id.
    var indivUser = UserMetrics.findOne(indivUserQuery);
    var askCount = 0;
    var correctCount = 0;
    _.chain(indivUser).prop(tdfname).each( function (item) {
            askCount = askCount + _.chain(item).prop('questionCount').intval().value();
            correctCount = correctCount + _.chain(item).prop('correctAnswerCount').intval().value();
    });
    return correctCount/askCount;
};

// Simple function for taking the filename of the given Tdf and converting it to the format Mongo recognizes.
buildTdfDBName = function (tdfname) {
    return tdfname.replace(".", "_");
};

// INPUT: an item from a Tdf, the name of that tdf (in Mongo-recognizable format)
// OUTPUT: a ratio to 2 decimal places which is the average score of all students who have attempted this item
computeItemAverage = function(item, tdfname) {
    var userList = UserMetrics.find().fetch();
    //console.log(displayify(userList));
    var askCount = 0;
    var correctCount = 0;
    _.chain(userList).each( function(user) {
        var itemRef = _.chain(user).prop(tdfname).prop(item.toString()).value();
        askCount += _.intval(itemRef.questionCount || 0);
        correctCount += _.intval(itemRef.correctAnswerCount || 0);
        if (item == '0') {
            console.log(correctCount);
            console.log(askCount);
            console.log(displayify(_.chain(user).prop(tdfname).prop(item.toString()).value()));
        }
    });
    return correctCount/askCount;
};

// Simple function to generate the numbers from 1..end
generateNaturals = function(end) {
    var returnArray = [];
    for (var i = 0; i < end; i++) {
        returnArray[i] = i;
    }
    return returnArray;
};

//INPUT: itemID, an integer which represents the index of the item in the cluster
//       tdfname, a string representing the Mongo-friendly current TDF
//       optionBool, a boolean, where true is for correctness data, false is for latency data
//OUTPUT: an array containing average values for each "opportunity", where the opportunity is the index in the array
generateItemGraphData = function(itemID, tdfname, optionBool) {
    var itemQuery = {};
    var itemData = []; //either correctness or latency, hence 'data'
    var itemCount = [];
    var corCount = 0;
    itemQuery[tdfname+"."+itemID] = {$exists: true};
    var scoreArray = UserMetrics.find(itemQuery).fetch();
    _.chain(scoreArray).each(function (user) {
        var itemCurrUser = _.chain(user).prop(tdfname).prop(itemID).value();
        var questionCount = _.intval(itemCurrUser.questionCount || 0);
        for (var i = 0; i < questionCount; i++) {
            if (itemCount.length <= i) {
                itemCount.push(0);
                itemData.push(0);
            }
            itemCount[i]++;
            if (!(_.isUndefined(itemCurrUser.answerCorrect)) && itemCurrUser.answerCorrect[i]) {
                corCount++;
                if (optionBool) {
                    itemData[i]++;
                } else {
                    itemData[i] += itemCurrUser.answerTimes[i];
                }
            }
        }
    });

    for (var i = 0; i < itemData.length; i++) {
        if (optionBool && corCount !== 0) {
            itemData[i] /= itemCount[i];
        } else if (corCount !== 0) {
            itemData[i] /= corCount;
        } else {
            itemData[i] = 0;
        }
    }
    if (_.last(itemCount) === 0) {
            itemData.pop();
    }
    return itemData;
};

generateClassGraphData = function(tdfname, optionBool) {
    var userDataQuery = {};
    var userData = [];
    userDataQuery[tdfname] = {$exists: true};
    userData = UserMetrics.find(userDataQuery).fetch();
    var classData = [];
    var classCount = [];
    var corCount = 0;
    _.chain(userData).each(function(user) {
        _.chain(user).prop(tdfname).each(function(item) {
            for (var i=0; i<_.chain(item).prop('questionCount').intval().value(); i++) {
                if (classCount.length <= i) {
                    //console.log("Increasing data array size by 1 from "+classCount.length);
                    classCount.push(0);
                    classData.push(0);
                }
                classCount[i]++;
                if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
                    corCount++;
                    if (optionBool) {
                        classData[i]++;
                    } else {
                        classData[i] += item.answerTimes[i];
                    }
                }
            }
        });
    });

    //We now have the raw data, and here we convert the classData to the averages.
    for (var i=0; i<classData.length; i++) {
        if (optionBool && corCount !== 0) {
            //console.log("Count: "+classCount[i]);
            classData[i] /= classCount[i];
        } else if (corCount !== 0) {
            classData[i] /= corCount;
        } else if (classCount[i] === 0) {
            classData[i] = 0;
        }
    }
    if (_.last(classCount) === 0) {
        //console.log("Last datapoint had 0 attempts, we're removing it.")
        classData.pop();
    }
    //console.log(classData);
    return classData;
};

//INPUT: studentID, a string representing the ID of the student to retrieve the data from, tdfName, a string representing the name of the current TDF (in Mongo-recognizable format), optionBool, which is false for latency, true for correctness
//OUPUT: an array containing values with indices representing the 'opportunity' number. The 0th slot is always initialized to "0".
generateStudentGraphData = function(studentID, tdfname, optionBool) {
    var userData = UserMetrics.find({'_id' : studentID}).fetch();
    var itemData = [];
    var itemCount = [];
    var corCount = 0;

    _.chain(userData[0]).prop(tdfname).each(function(item) {
        //Each item in the TDF
        var questionCount = _.intval(item.questionCount || 0);
        for (var i = 0; i < questionCount; i++) {
            if (itemCount.length <= i) {
                itemCount.push(0);
                itemData.push(0);
            }
            itemCount[i]++;
            if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
                corCount++;
                if (optionBool) {
                    itemData[i]++;
                } else {
                    itemData[i] += item.answerTimes[i];
                }
            }
        }
    });

    // Now we have the data, turn it into averages, replacing itemData's values with the averages
    for (var i = 0; i < itemData.length; i++) {
        if (optionBool && corCount !== 0) {
            itemData[i] /= itemCount[i];
        } else if (corCount !== 0) {
            itemData[i] /= corCount;
        } else {
            itemData[i] = 0;
        }
    }

    // Quick-and-dirty checking to make sure that the last element isn't because of 0 attempts made.
    if (_.last(itemCount) === 0) {
        itemData.pop();
    }
    return itemData;
};

findKey = function(obj, value) {
    var key;

    _.each(obj, function (v, k) {
        if (v === value) {
            key = k;
        }
    });

    return key;
};

//INPUT: studentID, an identifying ID for the student, tdfname, the Mongo-friendly database name for the current TDF.
//OUTPUT: an array of objects, where each object represents an item the student has attempted, containing that item's metrics for that student.
//generateStudentPerItemData = function(studentID, tdfname) {
generateStudentPerItemData = function(studentID, tdfname, currStim) {
    //Fetch the data from the db
    var userDataQuery = {};
    userDataQuery[tdfname] = {$exists: true};
    var userData = UserMetrics.find({'_id': studentID}, userDataQuery).fetch();

    var itemIDList = _.keys(userData[0][tdfname]);
    var cluster = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters[0].cluster;

    // Get current items for associating the names with the IDs
    var itemStats = [];
    _.chain(userData[0]).prop(tdfname).each(function(item) {
        var corCount = 0;
        var totCount = 0;
        var corTime = 0;
        //Iterate over the item's correctness data
        var questionCount = _.intval(item.questionCount || 0);
        for (var i = 0; i < questionCount; i++) {
            totCount++;
            if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
                corCount++;
                corTime += item.answerTimes[i];
            }
        }

        var newIndex = itemStats.length;
        var itemID = itemIDList[newIndex];
        itemStats.push({
            'correctRatio': Math.round((corCount/totCount) * 100) / 100,
            'avgLatency': _.isNaN(corTime/corCount) ? 0 : corTime/corCount,
            'itemID': itemID,
            'name': _.first(cluster[itemID].display),
        });
    });

    return itemStats;
};
