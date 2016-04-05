Template.student.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },
		studentDataLat: function () {
				var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;
				con
				return generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), false);
				
		},
		studentDataCor: function () {
				var user = (Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]))? Session.get('currStudent') : Meteor.user()._id;				
				return generateStudentGraphData(user, buildTdfDBName(getCurrentTdfName()), true);
		},
		classDataLat: function () {
				return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), false);
		},
		classDataCor: function() {
				return generateClassGraphData(buildTdfDBName(getCurrentTdfName()), true);
		}
});

Template.student.events({
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

    //This is where the meterics and graphs for the individual student will be housed later

});
