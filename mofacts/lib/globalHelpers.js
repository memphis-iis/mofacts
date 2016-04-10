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

// MoFaCTs-4882's Additions

// Moved function from within the file to here to modularize code.
// This function determines a score's correctness. Since it operates off colors.length, it is size-agnostic provided colors is sorted from 0->bad, ..., n->good
//INPUT: score, a float between 0 and 1
//OUTPUT: an integer, which corresponds here to the index in the color array indicating score's correctness
determineColorIndex = function(score) {
		if (score == 1) {
				return colors.length-1;
		} else {
				return Math.floor(score/(1/colors.length));
		}
}

// Moved this function out to accommodate the NaN situations
//INPUT: a score, a float between 0 and 1
//OUTPUT: a hex color code corresponding to the item's desired color.
determineButtonColor = function(score) {
		return (isNaN(score)) ? "#b0b09b" : colors[determineColorIndex(score)];
}

// Simple function to randomly assign a value between 0 and 1, to 2 digits. E.g. .42, 1.00, .28
randomScore = function() {
		return Math.floor(Math.random()*100)/100;
}

// Moved from client view to here for code separation purposes.
//INPUT: user, which is an object containing an _id which corresponds to a doc in UserMetrics, and the name of the relevant Tdf (in Mongo-recognizable format)
//OUTPUT: a ratio which is the user's average score across all items for the client's current system.
computeUserScore = function(user, tdfname) {
		var indivUserQuery = {};
		indivUserQuery['_id'] = user._id;
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
		var askCount = 0;
		var correctCount = 0;
		_.chain(userList).each( function(user) {
				askCount = askCount + _.chain(user).prop(tdfname).prop(item).prop('questionCount').intval().value();
				correctCount = correctCount + _.chain(user).prop(tdfname).prop(item).prop('correctAnswerCount').intval().value();
		});
		return correctCount/askCount;
}

// Simple function to generate the numbers from 1..end
generateNaturals = function(end) {
		var returnArray = [];
		for (var i=0; i<end; i++) {
				returnArray[i]=i;
		}
		return returnArray;
}

//INPUT: itemID, an integer which represents the index of the item in the cluster
//       tdfname, a string representing the Mongo-friendly current TDF
//       optionBool, a boolean, where true is for correctness data, false is for latency data
//OUTPUT: an array containing average values for each "opportunity", where the opportunity is the index in the array
generateItemGraphData = function(itemID, tdfname, optionBool) {
		var itemQuery = {};
		var itemData = []; //either correctness or latency, hence 'data'
		var itemCount = [];
		itemQuery[tdfname+"."+itemID] = {$exists: true};
		var scoreArray = UserMetrics.find(itemQuery).fetch();
		_.chain(scoreArray).each(function (user) {
				var itemCurrUser = _.chain(user).prop(tdfname).prop(itemID).value();
				for (var i=0; i<_.chain(itemCurrUser).prop('questionCount').intval().value(); i++) {
						if (itemCount.length <= i) {
								itemCount.push(0);
								itemData.push(0);
						}
						itemCount[i]++;
						if (!(_.isUndefined(itemCurrUser.answerCorrect)) && itemCurrUser.answerCorrect[i]) {
								if (optionBool) {
										itemData[i]++;
								} else {
										itemData[i] += itemCurrUser.answerTimes[i];
								}
						}
				}
		});
		///console.log(itemData);
		///console.log(itemCount);
		for (var i=0; i<itemData.length; i++) {
				itemData[i] /= itemCount[i];
		}
		if (_.last(itemCount) === 0) {
				itemData.pop();
		}
		return itemData;
}

generateClassGraphData = function(tdfname, optionBool) {
		var userDataQuery = {};
		var userData = [];
		userDataQuery[tdfname] = {$exists: true};
		userData = UserMetrics.find(userDataQuery).fetch();
		var classData = [];
		var classCount = [];
		_.chain(userData).each(function(user) {
				_.chain(user).prop(tdfname).each(function(item) {
						for (var i=0; i<_.chain(item).prop('questionCount').intval().value(); i++) {
								if (classCount.length <= 1) {
										classCount.push(0);
										classData.push(0);
								}
								classCount[i]++;
								if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
										if (optionBool) {
												classData[i]++;
										} else {
												classData[i] += item.answerTimes[i];
										}
								}
						}
				});
		});
		for (var i=0; i<classData.length; i++) {
				classData[i] /= classCount[i];
		}
		if (_.last(classData) === 0) {
				classData.pop();
		}
		return classData;
};

//INPUT: studentID, a string representing the ID of the student to retrieve the data from, tdfName, a string representing the name of the current TDF (in Mongo-recognizable format), optionBool, which is false for latency, true for correctness
//OUPUT: an array containing values with indices representing the 'opportunity' number. The 0th slot is always initialized to "0".
// TODO: make this more functional, maps, filter, etc.
generateStudentGraphData = function(studentID, tdfname, optionBool) {
		var userData = UserMetrics.find({'_id' : studentID}).fetch();
		var itemData = [];
		var itemCount = [];
		///console.log(_.chain(userData[0]).prop(tdfname).value());
		_.chain(userData[0]).prop(tdfname).each( function(item) {
				//Each item in the TDF
				for (var i=0; i<_.chain(item).prop('questionCount').intval().value(); i++) {
						if (itemCount.length <= i) {
								itemCount.push(0);
								itemData.push(0);
						}
						itemCount[i]++;
						if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
								if (optionBool) {
										itemData[i]++;
								} else {
										itemData[i] += item.answerTimes[i];

								}
						}
				}

		});
		///console.log(displayify(itemData));
		///console.log(displayify(itemCount));
		// Now we have the data, turn it into averages, replacing itemData's values with the averages
		for (var i=0; i<itemData.length; i++) {
				itemData[i] /= itemCount[i];
		}
		// Quick-and-dirty checking to make sure that the last element isn't just 0.
		if (_.last(itemCount) === 0) {
				itemData.pop();
		}
		// if (itemData[itemData.length-1] == 0) {
		// 		itemData.pop();
		// }
		///console.log(displayify(itemData));
		return itemData;
}

findKey = function(obj, value) {
  var key;

  _.each(obj, function (v, k) {
    if (v === value) {
      key = k;
    }
  });

  return key;
}

//INPUT: studentID, an identifying ID for the student, tdfname, the Mongo-friendly database name for the current TDF.
generateStudentPerItemData = function(studentID, tdfname) {
		//Fetch the data from the db
		var userDataQuery = {};
		userDataQuery[tdfname] = {$exists: true};
		var userData = UserMetrics.find({'_id': studentID}, userDataQuery).fetch();
		///console.log(userData);
		///console.log(userData[0][tdfname]);
		var itemStats = [];
		var corCount;
		var corTime ;
		var totCount;
		var itemToPush;
		var itemIDList = _.keys(userData[0][tdfname]);
		_.chain(userData[0]).prop(tdfname).each(function(item) {
				///console.log(displayify(item));
				corCount = 0;
				totCount = 0;
				corTime = 0;
				//Iterate over the item's correctness data
				for (var i=0; i<_.chain(item).prop('questionCount').intval().value(); i++) {
						totCount++;
						if (!(_.isUndefined(item.answerCorrect)) && item.answerCorrect[i]) {
								corCount++;
								corTime += item.answerTimes[i];
						}
				}
				// TODO Figure out how to associate ID to the item.
				itemToPush = {};
				itemToPush['correctRatio'] = corCount/totCount;
				itemToPush['avgLatency'] = corTime/totCount;
				itemStats.push(itemToPush);
		});
		// Poor, hack-y way to associate the ID of the item to the object in the array.
		for (var i=0; i<itemStats.length; i++) {
				itemStats[i]['itemID'] = itemIDList[i];
		}
		///console.log(itemStats);
		return itemStats;
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
