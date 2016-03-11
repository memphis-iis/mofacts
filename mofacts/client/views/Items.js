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
    },

    'click .stimButton' : function (event) {
        event.preventDefault();
        Router.go('/itemStats');
    }

});


Template.Items.rendered = function() {

    //Finds all of the items inside of the cluster: used for displaying on tiles
	var cluster = Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster;

    var colors = ["#ff3337", "#ff9933",     //Same as allStudents: Used for coloring of tiles
                  "#ff7733", "#ff8d33",     //Changed by Nick, ordered the colors according to coolness
                  "#33ff96", "#33acff",
                  "#5a33ff", "#336dff"];
		
    var addButton = function(btnObj) {
        $("#itemButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    cluster.forEach( function(item){    
		
        function random(min, max) {
            return Math.floor(Math.random() * (max-min)) + min; //function to be removed later
        }
				// This function determines how to colorize the button, choosing currently from a hardcoded list of colors
				function determineColor(score) {
						return Math.floor(score/(1/colors.length));
				}
				// Currently just randomly assigning the score to the item. In production, this or a similar variable will be assigned already.
				item.score = Math.floor(Math.random()*100)/100;
				//
				
				// For convenience only, assign an easy variable the button's color.
				colorIndex = determineColor(item.score);
        //Buttons that contain the name of the item which is named response inside of the cluster
        addButton(
            $("<button type='button' id='"+item.response[0]+"' name='"+item.response[0]+"'></button>")
                .addClass("btn btn-block stimButton")
								.css("background", colors[colorIndex])
						    //Retained for testing purposes.
                //.html(item.response[0]+", "+Math.floor((100*item.score))+"%")
								.html(item.response[0])

        );
    });

};

