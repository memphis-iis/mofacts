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
				return generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), false);
		},
		itemDataCor: function () {
				return generateItemGraphData(Session.get('currItem'), buildTdfDBName(getCurrentTdfName()), true);
		},	

});

Template.itemStats.events({
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

    //This file will later house the logic for the graphs and metrics for the item

});
