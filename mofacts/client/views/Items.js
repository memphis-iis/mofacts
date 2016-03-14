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
				
				// Currently just randomly assigning the score to the item. In production, this or a similar variable will be assigned already.
				//item.score = Math.floor(Math.random()*100)/100;
				item.score = randomScore();
				//
				
				// For convenience only, assign an easy variable the button's color.
				var colorIndex = determineColorIndex(item.score);
				
        //Buttons that contain the name of the item which is named response inside of the cluster
        addButton(
            $("<button type='button' id='"+item.response[0]+"' name='"+item.response[0]+"'></button>")
                .addClass("btn btn-block stimButton")
								.css("background", colors[colorIndex])
						    //Retained for testing purposes.
                .html(item.response[0]+", "+Math.floor((100*item.score))+"%")
								//.html(item.response[0])
        );
    });

};

