Template.profileTemplate.rendered = function () {
	//this is called whenever the template is rendered.
    var allStimuli = Stimuli.find({});
    var numFiles = allStimuli.count();
    console.log(numFiles);
    allStimuli.forEach( function (stimuliObject) {
        $("#startingDiv").append(
            "<div class=\"col-xs-1 well text-center\">" +
                stimuliObject.fileName +
            "</div>"
        );
    });
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