//TODO: we need handle empty data when charting

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
        }
        else if (corCount !== 0) {
            classData[i] /= corCount;
        }
        else if (classCount[i] === 0) {
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

// INPUT: studentID, a string representing the ID of the student to retrieve
//        the data from, tdfName, a string representing the name of the current
//        TDF (in Mongo-recognizable format), optionBool, which is false for
//        latency, true for correctness
// OUPUT: an array containing values with indices representing the 'opportunity'
//        number. The 0th slot is always initialized to "0".
generateStudentGraphData = function(studentID, tdfname, optionBool) {
    var userData = UserMetrics.find({'_id' : studentID}).fetch();
    var itemData = [];
    var itemCount = [];
    var corCount = 0;

    _.chain(userData).first().prop(tdfname).each(function(item) {
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
                }
                else {
                    itemData[i] += item.answerTimes[i];
                }
            }
        }
    });

    // Now we have the data, turn it into averages, replacing itemData's values with the averages
    for (var i = 0; i < itemData.length; i++) {
        if (optionBool && corCount !== 0) {
            itemData[i] /= itemCount[i];
        }
        else if (corCount !== 0) {
            itemData[i] /= corCount;
        }
        else {
            itemData[i] = 0;
        }
    }

    // Quick-and-dirty checking to make sure that the last element isn't because of 0 attempts made.
    if (_.last(itemCount) === 0) {
        itemData.pop();
    }
    return itemData;
};

// INPUT: studentID, an identifying ID for the student, tdfname, the
//        Mongo-friendly database name for the current TDF.
// OUTPUT: an array of objects, where each object represents an item the
//         student has attempted, containing that item's metrics for that
//         student.
generateStudentPerItemData = function(studentID, tdfname, currStim) {
    //Fetch the data from the db
    var userDataQuery = {};
    userDataQuery[tdfname] = {$exists: true};
    var userData = UserMetrics.find({'_id': studentID}, userDataQuery).fetch();

    var itemIDList = _.chain(userData).first().prop(tdfname).safekeys().value();
    var cluster = Stimuli.findOne({fileName: getCurrentStimName()}).stimuli.setspec.clusters[0].cluster;

    // Get current items for associating the names with the IDs
    var itemStats = [];
    _.chain(userData).first().prop(tdfname).each(function(item) {
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


Template.student.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

    //Returns the username for the graph legend
    selectedUsername: function () {
        if (!haveMeteorUser())
            return "";
        return (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currUsername') : Meteor.user().username;
    },

    //Data for the student latency
    studentDataLat: function () {
        if (!haveMeteorUser())
            return [];
        var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
        var studentDataLatVar = generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), false);
        return studentDataLatVar;
    },

    //data for the student correctness
    studentDataCor: function () {
        if (!haveMeteorUser())
            return [];
        var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
        var studentDataCorVar = generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), true);
        return studentDataCorVar;
    },

    //data for the class average latency
    classDataLat: function () {
        var classDataLatVar = generateClassGraphData(buildTdfDBName(getCurrentTdfName()), false);
        return classDataLatVar;
    },

    //data for class average correctness
    classDataCor: function () {
        var classDataCorVar = generateClassGraphData(buildTdfDBName(getCurrentTdfName()), true);
        return classDataCorVar;
    },

    itemData: function () {
        if (!haveMeteorUser())
            return [];
        var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
        return generateStudentPerItemData(user, buildTdfDBName(getCurrentTdfName()));
    }
});

Template.student.events({
    'click .switchButton': function (event) {
        event.preventDefault();
        drawChart();
        //TODO: switch to jQuery
        if (document.getElementById("reptitionLatency").style.display == "none") {
            document.getElementById("reptitionLatency").style.display="block";
            document.getElementById("reptitionLatencyTitle").style.display="block";
            document.getElementById("reptitionCorrectness").style.display="none";
            document.getElementById("reptitionCorrectnessTitle").style.display="none";
        }
        else {
            document.getElementById("reptitionLatency").style.display="none";
            document.getElementById("reptitionLatencyTitle").style.display="none";
            document.getElementById("reptitionCorrectness").style.display="block";
            document.getElementById("reptitionCorrectnessTitle").style.display="block";
        }
    },

    'click .logoutLink' : function (event) {
        event.preventDefault();
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User:", Meteor.user(), "Error:", error);
            }
            else {
                routeToSignin();
            }
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        Router.go("/profile");
    },

    'click .allItemsLink' : function (event) {
        event.preventDefault();
        Router.go("/allItems");
    },

    'click .allStudentsLink' : function (event) {
        event.preventDefault();
        Router.go("/allStudents");
    },

    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },
});

Template.student.rendered = function () {
    Tracker.autorun(function(){
        drawChart();
    });
};

var drawChart = function () {
    var i;

    // Find out the length of the array returned from the specified function.
    var studentDataLatLeng = Template.student.__helpers[" studentDataLat"]().length;

    // Auto populate an array from 0 to length of specified function.
    var studentDataLatRes = [];
    for (i = 0; i <= studentDataLatLeng; i++) {
        studentDataLatRes.push(i);
    }

    // Repeat above.
    var studentDataCorLeng = Template.student.__helpers[" studentDataCor"]().length;
    var studentDataCorRes = [];
    for (i = 0; i <= studentDataCorLeng; i++) {
        studentDataCorRes.push(i);
    }

    if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
        new Chartist.Line('#reptitionLatency', {
            labels: studentDataLatRes,
            series: [
                Template.student.__helpers[" studentDataLat"](),
                Template.student.__helpers[" classDataLat"]()
            ]
            }, {
            low: 0,
            fullWidth: true,
            height: 300,
            axisY: {
                onlyInteger: true,
                offset: 50
            },
            lineSmooth: false
        });

        new Chartist.Line('#reptitionCorrectness', {
            labels: studentDataCorRes,
            series: [
                Template.student.__helpers[" studentDataCor"](),
                Template.student.__helpers[" classDataCor"]()
            ]
        }, {
            high: 1,
            low: 0,
            fullWidth: true,
            height: 300,
            axisY: {
                onlyInteger: false,
                offset: 50
            },
            lineSmooth: false
        });
    }
    else {
        new Chartist.Line('#reptitionLatency', {
            labels: studentDataLatRes,
            series: [
                Template.student.__helpers[" studentDataLat"]()
            ]
        }, {
            low: 0,
            fullWidth: true,
            height: 300,
            axisY: {
                onlyInteger: true,
                offset: 50
            },
            lineSmooth: false
        });

        new Chartist.Line('#reptitionCorrectness', {
            labels: studentDataCorRes,
            series: [
                Template.student.__helpers[" studentDataCor"]()
            ]
        }, {
            low: 0,
            high: 1,
            fullWidth: true,
            height: 300,
            axisY: {
                onlyInteger: false,
                offset: 50
            },
            lineSmooth: false
        });
    }
};
