////////////////////////////////////////////////////////////////////////////
// Template Events

Template.profileTemplate.events({
    'click .logoutLink' : function (event) {
        event.preventDefault();
        Meteor.logout( function (error) {
            if (typeof error !== "undefined") {
                //something happened during logout
                console.log("User:", Meteor.user(), "Error:", error);
            }
            else {
                Router.go("signin");
            }
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        Router.go("profile");
    },

    'click .stimButton' : function (event) {
        event.preventDefault();
        console.log(event);

        Session.set("currentTest", getStimNameFromTdf(event.target.name));

        //Save the test selection event
        recordUserTime("profile test selection", {
            target: event.target.name
        });

        //Display Current Test in Console Log
        console.log("You clicked on: " + Session.get("currentTest"));

        //make sure session variables are cleared from previous tests
        sessionCleanUp();
        //Go directly to the card session - which will decide whether or
        //not to show instruction
        Session.set("needResume", true);
        Router.go("card");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.profileTemplate.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            Router.go("signin");
        }
        else {
            return Meteor.user().username;
        }
    },
});

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
};

////////////////////////////////////////////////////////////////////////////
// Implementation functions

function getStimNameFromTdf(lessonName){ //Find stimulus file name associated w/ TDF
    var newTdf = Tdfs.findOne({'tdfs.tutor.setspec.0.lessonname.0' : lessonName});
    Session.set("currentTdfName", newTdf.fileName);
    setUnitNumber(newTdf.fileName);
    var stimFileName = newTdf.tdfs.tutor.setspec[0].stimulusfile[0];
    return stimFileName;
}

function setUnitNumber(tdfName){ //sets the number of units in the current session
    var newTdf = Tdfs.findOne({fileName: tdfName});
    if (typeof newTdf.tdfs.tutor.unit !== "undefined"){
        console.log("unit length is: " + newTdf.tdfs.tutor.unit.length);
    }
}
