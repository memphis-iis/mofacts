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
                }
                else {
                    itemData[i] += itemCurrUser.answerTimes[i];
                }
            }
        }
    });

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

var drawChart = function () {
    var i;

    // Auto populate an array from 0 to length of specified function.
    var itemDataLatLeng = Template.itemStats.__helpers[" itemDataLat"]().length;
    var itemDataLatRes = [];
    for (i = 0; i <= itemDataLatLeng; i++) {
        itemDataLatRes.push(i);
    }

    // Repeat above.
    var itemDataCorLeng = Template.itemStats.__helpers[" itemDataCor"]().length;
    var itemDataCorRes = [];
    for (i = 0; i <= itemDataCorLeng; i++) {
        itemDataCorRes.push(i);
    }

    new Chartist.Line('#reptitionLatency', {
        labels: itemDataLatRes,
        series: [
            Template.itemStats.__helpers[" itemDataLat"]()
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
        labels: itemDataCorRes,
        series: [
            Template.itemStats.__helpers[" itemDataCor"]()
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
};
