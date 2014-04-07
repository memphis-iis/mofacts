
//////////////
//  EVENTS  //
//////////////

Template.profileTemplate.events({
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
    },
    'click .stimButton' : function (event) {
        console.log(event);

        Session.set("currentTest", getStimNameFromTdf(event.target.name));
		

        //Get Test Type
            //Whether it is a practice, drill, etc

        //Saves User, Test, and Time to Server side and Log
        Meteor.call("user", Meteor.user().username);
        Meteor.call("naming", event.target.name);
        Meteor.call("timestamp");
        Meteor.call("writing", Meteor.user().username + "::" + event.target.name + "::");
        //---------

        //Display Current Test in Console Log
        console.log("You clicked on: " + Session.get("currentTest"));

        initializeProgressRecord();

        //make sure session variables are cleared from previous tests
        cleanUp();
        Router.go("instructions");
    }
});

/////////////////
//  VARIABLES  //
/////////////////

Template.profileTemplate.rendered = function () {
	//this is called whenever the template is rendered.
	var allTdfs = Tdfs.find({});
	
    allTdfs.forEach( function (tdfObject) {

        console.log("rendered: " + tdfObject.tdfs.tutor.setspec[0].stimulusfile[0]);
        
      	var name = tdfObject.tdfs.tutor.setspec[0].lessonname[0];

        if (typeof name !== "undefined") {

            $("#testContainingDiv").append(
                "<div class=\"col-sm-3 col-md-3 col-lg-3 text-center\">" +
                    "<button type=\"button\" name=\"" + name + "\" class=\"btn btn-primary btn-block stimButton\">" + 
                        "" + name + "" + 
                    "</button>" +
                    "</br>" +
                "</div>"
            );

        }

    });
}

Template.profileTemplate.username = function () {

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

function getStimNameFromTdf(lessonName){ //Find stimulus file name associated w/ TDF
	var newTdf = Tdfs.findOne({'tdfs.tutor.setspec.0.lessonname.0' : lessonName});
	Session.set("currentTdfName", newTdf.fileName);
	setScheduleNumber(newTdf.fileName); //set the number of schedules to loop over
	var stimFileName = newTdf.tdfs.tutor.setspec[0].stimulusfile[0];
	return stimFileName;
}

function setScheduleNumber(tdfName){ //sets the number of schedules in the current session
	var newTdf = Tdfs.findOne({fileName: tdfName});
	console.log("schedule length is: " + newTdf.tdfs.tutor.schedule.length);
	Session.set("currentScheduleNumber", 0);
	Session.set("scheduleNumber", newTdf.tdfs.tutor.schedule.length);
}

function cleanUp() {
    Session.set("currentQuestion", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("scheduleIndex", undefined);
	Session.set("currentScheduleNumber", 0);
}

function initializeProgressRecord () {
    // TODO: Here we will initialize the userProgress Collection
    // with data about the current Test.
}