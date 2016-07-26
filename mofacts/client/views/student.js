generateClassGraphData = function(tdfname, optionBool) {
    var userDataQuery = {};
    userDataQuery[tdfname] = {$exists: true};
    var classData = [];
    var classCount = [];
    var corCount = 0;
    UserMetrics.find(userDataQuery).forEach(function(user) {
        _.chain(user).prop(tdfname).each(function(item) {
            for (var i=0; i<_.chain(item).prop('questionCount').intval().value(); i++) {
                while (classCount.length <= i) {
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
        if (optionBool && classCount[i] !== 0) {
            classData[i] /= classCount[i];
        }
        else if (!optionBool && corCount !== 0) {
            classData[i] /= corCount;
        }
        else if (classCount[i] === 0) {
            classData[i] = 0;
        }
    }
    if (_.last(classCount) === 0) {
        classData.pop();
    }

    return classData;
};

// INPUT: studentID, a string representing the ID of the student to retrieve
//        the data from, tdfName, a string representing the name of the current
//        TDF (in Mongo-recognizable format), optionBool, which is false for
//        latency, true for correctness
// OUPUT: an array containing values with indices representing the 'opportunity'
//        number. The 0th slot is always initialized to "0".
generateStudentGraphData = function(studentID, tdfname, optionBool) {
    var userData = UserMetrics.findOne({'_id' : studentID});
    var itemData = [];
    var itemCount = [];
    var corCount = 0;

    _.chain(userData).prop(tdfname).each(function(item, itemIndex) {
        //Each item in the TDF
        var questionCount = _.intval(item.questionCount || 0);
        for (var i = 0; i < questionCount; i++) {
            while (itemCount.length <= i) {
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
        if (optionBool && itemCount[i] !== 0) {
            itemData[i] /= itemCount[i];
        }
        else if (!optionBool && corCount !== 0) {
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
    //TODO: Session.get("currentStimName") is undefined
    //      this is because the TDF selection logic doesn't know which condition
    //      to use to get the correct stimulus file.
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
            'correctRatio': (corCount/totCount).toFixed(2),
            'avgLatency': (_.isNaN(corTime/corCount) ? 0 : corTime/corCount).toFixed(1),
            'repetitions': totCount,
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
        return generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), false);
    },

    //data for the student correctness
    studentDataCor: function () {
        if (!haveMeteorUser())
            return [];
        var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
        return generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), true);
    },

    //data for the class average latency
    classDataLat: function () {
        return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), false);
    },

    //data for class average correctness
    classDataCor: function () {
        return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), true);
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
        // Swap between latency and correctness
        $(".toggled").toggleClass("displayed");
        drawChart();
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

// in-place modify the series AND return it
// Note that due to irregularities in Chartist, we insure we have at least
// 2 "points" - even if they won't be displayed. (But keep in mind that we
// don't want to show spurious data if our series is empty.)
function safeSeries(series) {
    if (!series || series.length < 1)
        return series;

    while (series.length < 2) {
        series.push(null);  // null are missing points
    }
    return series;
}

// Return true if none of the series has data
function seriesEmpty(seriesArray) {
    for(var i = 0; i < seriesArray.length; ++i) {
        if (seriesArray[i].length > 0) {
            return false;
        }
    }
    return true;
}

var drawChart = function () {
    var i;

    // Get our series and populate a range array for chart labeling
    // Note that due to irregularities in Chartist, we insure we have at least
    // 2 "points" - even if they won't be displayed. (But keep in mind that we
    // don't want to show spurious data if our series is empty.)

    var latencySeries = [safeSeries(Template.student.__helpers[" studentDataLat"]())];
    var studentDataLatRes = _.range(1, latencySeries[0].length+1);

    var correctSeries = [safeSeries(Template.student.__helpers[" studentDataCor"]())];
    var studentDataCorLeng = correctSeries[0].length;
    var studentDataCorRes = _.range(1, correctSeries[0].length+1);

    // Include extra series in "admin mode"

    if (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
        latencySeries.push(safeSeries(Template.student.__helpers[" classDataLat"]()));
        correctSeries.push(safeSeries(Template.student.__helpers[" classDataCor"]()));
    }

    // Now actually create the charts - but only if we can find the proper
    // elements and there is data to display
    var drawCondLine = function(targetSelector, isEmpty, dataDescrip, chartData, chartConfig) {
        var target = $(targetSelector).get(0);
        if (!target) {
            return;
        }
        if (isEmpty) {
            $(target)
                .removeClass("show-axis")
                .html("<div class='nodata'>No " + dataDescrip + " data available</div>");
        }
        else {
            $(target).addClass("show-axis");
            // Note that we provide some default values that can be overridden
            new Chartist.Line(target, chartData, _.extend({
                low: 0,
                fullWidth: true,
                height: 300,
                lineSmooth: false
            }, chartConfig));
        }
    };

    var latencyEmpty = seriesEmpty(latencySeries);
    var correctEmpty = seriesEmpty(correctSeries);

    //Don't show the legend if there's no data
    if (latencyEmpty && correctEmpty) {
        $(".legend").hide();
    }
    else {
        $(".legend").show();
    }

    drawCondLine('#reptitionLatency', latencyEmpty, 'latency', {
        labels: studentDataLatRes,
        series: latencySeries
    }, {
        axisY: {
            onlyInteger: true
        }
    });

    drawCondLine('#reptitionCorrectness', correctEmpty, 'correctness', {
        labels: studentDataCorRes,
        series: correctSeries
    }, {
        high: 1,
        axisY: {
            onlyInteger: false
        },
    });
};
