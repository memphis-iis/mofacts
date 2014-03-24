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

        Session.set("currentTest", event.target.name);

        //Client side time
        var time = new Date();

        //Saves User, Test, and Time to Server side and Log
        Meteor.call("user", Meteor.user().username);
        Meteor.call("naming", event.target.name);
        Meteor.call("writing",'\n' + Meteor.user().username + "::" + event.target.name + "::" +  time.getTime() + '\n');
        //---------

        //Display Current Test in Console Log
        console.log("You clicked on: " + Session.get("currentTest"));

        //make sure session variables are cleared from previous tests
        cleanUp();
        Router.go("card");
    }
});

/////////////////
//  VARIABLES  //
/////////////////

Template.profileTemplate.rendered = function () {
	//this is called whenever the template is rendered.
    var allStimuli = Stimuli.find({});
    allStimuli.forEach( function (stimuliObject) {

        console.log("rendered: " + stimuliObject.fileName);
        var name = stimuliObject.fileName;

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

function cleanUp() {
    Session.set("currentQuestion", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("scheduleIndex", undefined);
}