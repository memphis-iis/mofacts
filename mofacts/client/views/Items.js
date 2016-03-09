Template.Items.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

});

Template.Items.events({
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


Template.Items.rendered = function() {

	var cluster = Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster;

    var colors = ["#ff3337", "#ff7733", 
                  "#ff9933", "#33ff96",
                  "#33acff", "#336dff",
                  "#ff8d33", "#5a33ff"];

    var addButton = function(btnObj) {
        $("#itemButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    cluster.forEach( function(item){    

        function random(min, max) {
            return Math.floor(Math.random() * (max-min)) + min;
        }

        addButton(
            $("<button type='button' id='"+item.response[0]+"' name='"+item.response[0]+"'></button>")
                .addClass("btn btn-block stimButton").css("background", colors[random(0,7)])
                .html(item.response[0])

        );
    });

};

