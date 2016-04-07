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
				var target = $(event.currentTarget);
				Session.set('currItem', target.data("itemkey"));
        event.preventDefault();
        Router.go('/itemStats');
    },

    'click .switchButton' : function (event) {
        event.preventDefault();
        if (document.getElementById("itemButtonContainer1").style.display == "none"){
            document.getElementById("itemButtonContainer1").style.display = "block";
            document.getElementById("itemButtonContainer2").style.display = "none";
        }else{
            document.getElementById("itemButtonContainer1").style.display = "none";
            document.getElementById("itemButtonContainer2").style.display = "block";
        }
                
    }

});


Template.Items.rendered = function() {

    //Finds all of the items inside of the cluster: used for displaying on tiles
	var cluster = Stimuli.findOne({fileName: getCurrentStimName()})
        .stimuli.setspec.clusters[0].cluster;

    var addButton1 = function(btnObj) {
        $("#itemButtonContainer1").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };
    var addButton2 = function(btnObj) {
        $("#itemButtonContainer2").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        ).hide();
    };


    cluster.forEach( function(item){    
                
				// Computes the item's average across the system
				var itemId = _.indexOf(cluster, item);
				item.score = computeItemAverage(itemId, buildTdfDBName(getCurrentTdfName()));
				//
				
				// For convenience only, assign an easy variable the button's color.
				var buttonColor = determineButtonColor(item.score);
				
				
        //Buttons that contain the name of the item which is named response inside of the cluster
        

        addButton1(

            $("<button type='button' id='"+item.display[0]+"' name='"+item.display[0]+"'></button>")
                .addClass("btn btn-block stimButton")
						    .data("itemkey", itemId)
								.css("background", buttonColor)
						    //Retained for testing purposes.
                .html(item.display[0]+", "+Math.floor((100*item.score))+"%")
								//.html(item.response[0])
        );

        //disables buttons in first container
        if (isNaN(item.score)){
            document.getElementById(item.display[0]).disabled = true;
        }else{
            document.getElementById(item.display[0]).disabled = false;
        }

        //changed button ID to ItemId to avoid overlap to disable buttons
        addButton2(
            $("<button type='button' id='"+itemId+"' name='"+itemId+"'></button>")
                .addClass("btn btn-block stimButton")
                            .data("itemkey", itemId)
                                .css("background", buttonColor)
                            //Retained for testing purposes.
                .html(item.response[0]+", "+Math.floor((100*item.score))+"%")
                                //.html(item.response[0])
        );

        //disables buttons in the second container
        if (isNaN(item.score)){
            document.getElementById(itemId).disabled = true;
        }else{
            document.getElementById(itemId).disabled = false;
        }
        
    });

};

