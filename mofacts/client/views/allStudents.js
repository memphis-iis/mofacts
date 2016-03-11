////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.allStudents.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    }
});

Template.allStudents.helpers({
		usersList: function() {
				return Meteor.users.find();
		}
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.allStudents.events({
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


    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },

    'click .studentButton' : function (event) {
        event.preventDefault();      
        Router.go('/student');  
    }
});

Template.allStudents.rendered = function () {
 
    var allUsers = Meteor.users.find().fetch();

    var colors = ["#ff3337", "#ff7733",         //Colors used to randomly generate tile colors. Will be changed to colors representing metrics later on
                  "#ff9933", "#33ff96",
                  "#33acff", "#336dff",
                  "#ff8d33", "#5a33ff"];

    var addButton = function(btnObj) {
        $("#studentButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    allUsers.forEach( function (user) {

        function random(min, max) {
            return Math.floor(Math.random() * (max-min)) + min; //Used to randomly generate numbers for color selection. Will be removed later
        }

        addButton(
            $("<button type='button' id='"+user._id+"' name='"+user.username+"'></button>")
                .addClass("btn btn-block studentButton")
                .data("studentkey", user._id)
                .css("background", colors[random(0,7)])
                .html(user.username)
        );
    });
};