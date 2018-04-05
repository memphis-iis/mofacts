Template.choose.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    }
});

Template.choose.events({
    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },

    'click .studentButton' : function (event) {
    	event.preventDefault();
    	Router.go("/allStudents");
    },

    'click .itemsButton' : function (event) {
    	event.preventDefault();
    	Router.go("/Items");
   }

});
