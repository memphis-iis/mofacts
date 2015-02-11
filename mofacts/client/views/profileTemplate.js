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
                routeToSignin();
            }
        });
    },

    'click .homeLink' : function (event) {
        event.preventDefault();
        Router.go("/profile");
    },

    'click .stimButton' : function (event) {
        event.preventDefault();
        console.log(event);

        var target = $(event.target);
        var tdfkey = target.data("tdfkey");
        var lessonName = target.data("lessonname");
        var stimulusfile = target.data("stimulusfile");
        var tdffilename = target.data("tdffilename");

        console.log("Starting Lesson", lessonName, tdffilename, "Stim:", stimulusfile);

        //make sure session variables are cleared from previous tests
        sessionCleanUp();

        //Set the session variables we know
        //Note that we assume the root and current TDF names are the same.
        //The resume logic in the the card template will determine if the
        //current TDF should be changed due to an experimental condition
        Session.set("currentRootTdfName", tdffilename);
        Session.set("currentTdfName", tdffilename);
        Session.set("currentStimName", stimulusfile);

        //Get some basic info about the current user's environment
        var userAgent = "[Could not read user agent string]";
        var prefLang = "[N/A]";
        try {
            userAgent = Helpers.display(navigator.userAgent);
            prefLang = Helpers.display(navigator.language);
        }
        catch(err) {
            console.log("Error getting browser info", err);
        }

        //Save the test selection event
        recordUserTime("profile test selection", {
            target: lessonName,
            tdfkey: tdfkey,
            tdffilename: tdffilename,
            stimulusfile: stimulusfile,
            userAgent: userAgent,
            browserLanguage: prefLang
        });

        //Go directly to the card session - which will decide whether or
        //not to show instruction
        Session.set("needResume", true);
        Router.go("/card");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.profileTemplate.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },
});

Template.profileTemplate.rendered = function () {
    //this is called whenever the template is rendered.
    var allTdfs = Tdfs.find({});

    var addButton = function(btnObj) {
        $("#testButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    allTdfs.forEach( function (tdfObject) {
        var setspec = tdfObject.tdfs.tutor.setspec[0];
        if (!setspec) {
            console.log("Invalid TDF - it will never work", tdfObject);
            return;
        }

        var name = null;
        if (setspec.lessonname && setspec.lessonname.length) {
            name = setspec.lessonname[0];
        }
        if (!name) {
            console.log("Skipping TDF with no name", setspec);
            return;
        }

        var userselect = true;
        if (setspec.userselect && setspec.userselect.length) {
            userselect = setspec.userselect[0];
            if (userselect && userselect.toLowerCase() === "false") {
                //We require that they explicitly have the string "false"
                //to disable display
                userselect = false;
            }
        }
        if (!userselect) {
            console.log("Skipping due to userselect=false for ", name);
            return;
        }

        var stimulusFile = "";
        if (setspec.stimulusfile && setspec.stimulusfile.length) {
            stimulusFile = setspec.stimulusfile[0];
        }

        addButton(
            $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'></button>")
                .addClass("btn btn-primary btn-block stimButton")
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdfkey", tdfObject._id)
                .data("tdffilename", tdfObject.fileName)
                .html(name)
        );
    });
};
