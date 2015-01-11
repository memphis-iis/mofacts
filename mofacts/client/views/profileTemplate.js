
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
        Meteor.call("userTime", Session.get("currentTest"), {
            event: "profile test selection",
            target: event.target.name
        });
        //---------

        //Display Current Test in Console Log
        console.log("You clicked on: " + Session.get("currentTest"));

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
    setUnitNumber(newTdf.fileName); 
    var stimFileName = newTdf.tdfs.tutor.setspec[0].stimulusfile[0];
    return stimFileName;
}

function setUnitNumber(tdfName){ //sets the number of units in the current session
    var newTdf = Tdfs.findOne({fileName: tdfName});
    if (newTdf.tdfs.tutor.unit != undefined){
        console.log("unit length is: " + newTdf.tdfs.tutor.unit.length);
    }
}

/* All of our currently known session variables:
 * clusterIndex
 * currentAnswer
 * currentQuestion
 * currentTdfName
 * currentTest
 * currentUnitNumber
 * debugging
 * isScheduledTest
 * questionIndex
 * showOverlearningText
 * testType
 * usingACTRModel
 * */
function cleanUp() {
    //Note that we assume that currentTest and currentTdfName are
    //already set (because getStimNameFromTdf should have already been
    //called).  We also ignore debugging (for obvious reasons)
    
    Session.set("clusterIndex", undefined);
    Session.set("currentAnswer", undefined);
    Session.set("currentQuestion", undefined);
    Session.set("currentUnitNumber", 0);
    Session.set("isScheduledTest", undefined);
    Session.set("questionIndex", undefined);
    Session.set("showOverlearningText", undefined);
    Session.set("testType", undefined);
    Session.set("usingACTRModel", undefined);
}
