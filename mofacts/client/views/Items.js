Template.Items.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    }
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

	cluster = Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster;

	var addButton = function(btnObj) {
        $("#itemButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    cluster.forEach( function(item){
    	addButton(
            $("<button type='button' id='"+item.response[0]+"' name='"+item.response[0]+"'></button>")
                .addClass("btn btn-block stimButton")
                .html(item.response[0])
        );
    });



};