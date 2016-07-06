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
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function(searchString, position) {
        var subjectString = this.toString();
        if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
            position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
    };
}


Date.secsIntervalString = function(elapsedSecs) {
    var timeLeft = _.floatval(elapsedSecs);

    var secs = _.intval(timeLeft % 60);
    timeLeft = Math.floor(timeLeft / 60);
    var mins = _.intval(timeLeft % 60);
    timeLeft = Math.floor(timeLeft / 60);
    var hrs  = _.intval(timeLeft % 24);
    timeLeft = Math.floor(timeLeft / 24);
    var days = _.intval(timeLeft);

    var timeLeftDisplay = "";

    if (days > 0) {
        timeLeftDisplay += days.toString() + " days, ";
    }
    if (hrs > 0) {
        timeLeftDisplay += hrs.toString()  + " hr, ";
    }
    if (mins > 0) {
        timeLeftDisplay += mins.toString() + " min, ";
    }

    return timeLeftDisplay + secs.toString() + " sec";
};

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
        safekeys: function(obj) {
            if (_.isString(obj) || !_.isObject(obj)) {
                return [];
            }
            return _.keys(obj);
        },

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
    // Strings and numbers are simple
    if (typeof obj === "string" || typeof obj === "number") {
        return obj;
    }

    // Array: return with displayify run on each member
    if (_.isArray(obj)) {
        var dispArr = [];
        for (var i = 0; i < obj.length; ++i) {
            dispArr.push(displayify(obj[i])); //Recursion!
        }
        var spacing = (dispArr.length <= 3 || _.isNumber(obj[0])) ? 0 : 2;
        return JSON.stringify(dispArr, null, spacing);
    }

    // Object - perform some special formatting on a copy
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

// Simple function for taking the filename of the given Tdf and converting it to the format Mongo recognizes.
buildTdfDBName = function (tdfname) {
    return tdfname.replace(".", "_");
};
