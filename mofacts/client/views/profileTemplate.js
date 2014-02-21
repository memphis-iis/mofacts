Template.profileTemplate.rendered = function () {
	//this is called whenever the template is rendered.
	for(var i = 1; i <= 12; i++) {
		$("#startingDiv").append(
			"<div>" + 
				"<div class=\"col-xs-1 well text-center\">" +
					"deck#" + i + 
				"</div>" +
			"</div>"
		);
	}
}

Template.profileTemplate.username = function () {
	return Meteor.users.findOne({_id: Meteor.userId()}).username;
}

Template.profileTemplate.events({
    'click .logoutLink' : function () {
    	Meteor.logout(function(error) {
    		if (typeof error !== "undefined") {
    			//something happened during logout
    			console.log("Error: Could not sign out of account! \n" +
    						"\tUser: " + Meteor.user() +" \n");
    		} else {
    			Router.go("signin");
    		}
    	});
    },
    'click .homeLink' : function () {
    	Router.go("profile");
    }
});