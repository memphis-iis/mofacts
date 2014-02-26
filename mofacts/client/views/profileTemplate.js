Template.profileTemplate.rendered = function () {
    

	//this is called whenever the template is rendered.
    var allStimuli = Stimuli.find({});
    var numFiles = allStimuli.count();
    console.log(numFiles);
    var counter = 0;
    allStimuli.forEach( function (stimuliObject) {
        $("#testContainingDiv").append(
            "<div class=\"col-xs-3 text-center\">" +
                "<button type=\"button\" name=\"" + stimuliObject.fileName + "\" class=\"btn btn-primary btn-block stimButton\">" + stimuliObject.fileName + "</button>" +
            "</div>"
        );
        counter++;
    });
}

function WritetoFile(content){
	console.log("You clicked on: " + content);
	
	//var fs = require('fs');
	
	//fs.writeFile("/tmp/test", content, function(err) {
	//    if(err) {
	//        console.log(err);
	//    } else {
	//        console.log("The file was saved!");
	//    }
	//}); 
}

Template.profileTemplate.username = function () {
    if (typeof Meteor.users.findOne({_id: Meteor.userId()}) === "undefined" ) {
        Router.go("signin");
        window.location.reload();
        return;
    }
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
    },
    'click .stimButton' : function (event) {
        Session.set("currentTest", event.target.name);
        WritetoFile(event.target.name);
        console.log("You clicked on: " + Session.get("currentTest"));
        Router.go("card");
    }

});