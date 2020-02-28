// INPUT: an item from a Tdf, the name of that tdf (in Mongo-recognizable
//        format)
// OUTPUT: a ratio to 2 decimal places which is the average score of all
//         students who have attempted this item
function computeItemAverage(item, tdfname) {
    var userList = UserMetrics.find().fetch();
    //console.log(displayify(userList));
    var askCount = 0;
    var correctCount = 0;
    _.chain(userList).each( function(user) {
        var itemRef = _.chain(user).prop(tdfname).prop(item.toString()).value();
        askCount = _.chain(itemRef).prop("questionCount").intval().value();
        correctCount = _.chain(itemRef).prop("correctCount").intval().value();
        // if (item == '0') {
        //     console.log(correctCount);
        //     console.log(askCount);
        //     console.log(displayify(itemRef));
        // }
    });
    return correctCount/askCount;
}

Template.Items.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

    // Generate the necessary information from the stim cluster array. Each
    // object is sent to an array where the spacebars loop iterates over the
    // array populating the buttons.
    items: function(){
        var cluster = _.chain(Stimuli.findOne({fileName: getCurrentStimName()}))
            .prop("stimuli")
            .prop("setspec")
            .prop("clusters").first()
            .prop("cluster")
            .value();

        var buttons = [];
        _.each(cluster, function(item, itemId){
            item.score = computeItemAverage(itemId, buildTdfDBName(getCurrentTdfName()));

            item.itemId = itemId;
            item.buttonColor = determineButtonColor(item.score);
            item.display = item.display[0];
            item.response = item.response[0];
            if (isNaN(item.score)){
                item.clickable = false;
            }
            else {
                item.clickable = true;
            }

            buttons.push(item);
        });

        return buttons;
    }
});

Template.Items.events({
    'click .stimButton' : function (event) {
        var target = $(event.currentTarget);
        Session.set('currItem', event.target.id);
        event.preventDefault();
        Router.go('/itemStats');
    },

    //Used for switching between the prompts and the reponses
    'click .switchButton' : function (event) {
        event.preventDefault();
        if (document.getElementById("itemButtonContainer1").style.display == "none"){
            document.getElementById("itemButtonContainer1").style.display = "block";
            document.getElementById("itemButtonContainer2").style.display = "none";
        }
        else{
            document.getElementById("itemButtonContainer1").style.display = "none";
            document.getElementById("itemButtonContainer2").style.display = "block";
        }
    }
});
