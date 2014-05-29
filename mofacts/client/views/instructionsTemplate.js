
//////////////
//  EVENTS  //
//////////////

Template.instructionsTemplate.events({
    'click #continueButton' : function () {
        Router.go("card");
    },
    'click .logoutLink' : function () {
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User: " + Meteor.user() +" \n" +
                            "\tError: " + error + "\n");
            } else {
                Router.go("signin");
            }
        });
    },
    'click .homeLink' : function () {
        Router.go("profile");
    }
});

/////////////////
//  VARIABLES  //
/////////////////

Template.instructionsTemplate.instructions = function () {
	var thisTdf = Tdfs.findOne({fileName: Session.get("currentTdfName")});
	if (thisTdf.tdfs.tutor.unit != undefined){
		var whichSchedule = Session.get("currentScheduleNumber");
		var instructions = thisTdf.tdfs.tutor.unit[whichSchedule].unitinstructions;
	}
	else {
		var instructions = "Please enter answer in text box provided below questions."
	}
	return instructions;
}

Template.instructionsTemplate.username = function () {

    if (typeof Meteor.user() === "undefined") {
        Router.go("signin");
        window.location.reload();
        //the reload is needed because for some reason the page contents show up as
        //empty unless we do the reload.
        return;
    } else {
        return Meteor.user().username;
    }
}

/////////////////
//  FUNCTIONS  //
/////////////////
