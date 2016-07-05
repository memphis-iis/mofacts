//INPUT: itemID, an integer which represents the index of the item in the cluster
//       tdfname, a string representing the Mongo-friendly current TDF
//       optionBool, a boolean, where true is for correctness data, false is for latency data
//OUTPUT: an array containing average values for each "opportunity", where the
//        opportunity is the index in the array
function generateItemGraphData(itemID, tdfname, optionBool) {
    var itemQuery = {};
    var itemData = []; //either correctness or latency, hence 'data'
    var itemCount = [];
    var corCount = 0;

    itemQuery[tdfname+"."+itemID] = {$exists: true};
    UserMetrics.find(itemQuery).forEach(function (user) {
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
                }
                else {
                    itemData[i] += itemCurrUser.answerTimes[i];
                }
            }
        }
    });

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
    if (_.last(itemCount) === 0) {
        itemData.pop();
    }
    return itemData;
}

Template.itemStats.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
   },

   itemDataLat: function () {
        var itemDataLatVar = generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), false);
        return itemDataLatVar;
    },

    itemDataCor: function () {
        var itemDataCorVar = generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), true);
        return itemDataCorVar;
    },
});

Template.itemStats.events({
    'click .switchButton': function (event) {
        event.preventDefault();
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

    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },

    'click .allItemsLink' : function (event) {
        event.preventDefault();
        Router.go("/allItems");
    }
});

Template.itemStats.rendered = function () {
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

var drawChart = function () {
    var i;

    // Get our series and populate a range array for chart labeling

    var latencySeries = safeSeries(Template.itemStats.__helpers[" itemDataLat"]());
    var correctSeries = safeSeries(Template.itemStats.__helpers[" itemDataCor"]());

    var itemDataLatRes = _.range(1, latencySeries.length+1);  // from 1 to len
    var itemDataCorRes = _.range(1, correctSeries.length+1);  // from 1 to len

    // Now actually create the charts - but only if we can find the proper
    // elements and there is data to display
    var drawCondLine = function(targetSelector, labels, series, dataDescrip, chartConfig) {
        var target = $(targetSelector).get(0);
        if (!target) {
            return;
        }
        if (series.length < 1) {
            $(target)
                .removeClass("show-axis")
                .html("<div class='nodata'>No " + dataDescrip + " data available</div>");
        }
        else {
            $(target).addClass("show-axis");
            // Note that we provide some default values that can be overridden
            var chartData = {
                'labels': labels,
                'series': [series]
            };

            var fullConfig = _.extend({
                low: 0,
                fullWidth: true,
                height: 300,
                lineSmooth: false
            }, chartConfig);

            new Chartist.Line(target, chartData, fullConfig);
        }
    };

    drawCondLine('#reptitionLatency', itemDataLatRes, latencySeries, "latency", {
        axisY: {
            onlyInteger: true
        }
    });

    drawCondLine('#reptitionCorrectness', itemDataCorRes, correctSeries, "correctness", {
        high: 1,
        axisY: {
            onlyInteger: false
        }
    });
};
