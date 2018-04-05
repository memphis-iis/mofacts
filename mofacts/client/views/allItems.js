////////////////////////////////////////////////////////////////////////////
// Local collection for buttons

var progressButtons = new Mongo.Collection(null);

////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.allItems.helpers({
    'username': function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

    'progressButtons': function() {
        return progressButtons.find({'temp': 1}, {'sort': {'name': 1}});
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.allItems.events({
    // Start a TDF
    'click .stimButton' : function (event) {
        event.preventDefault();
        var target = $(event.currentTarget);
        selectTdf(
            target.data("tdfkey"),
            target.data("lessonname"),
            target.data("stimulusfile"),
            target.data("tdffilename"),
            "User button click"
        );
    }
});

//Same logic used in the profile template, except when the button is clicked,
//it passes all of the information to the next items page

Template.allItems.rendered = function () {
    //this is called whenever the template is rendered.

    progressButtons.remove({'temp': 1});

    //In experiment mode, they may be forced to a single tdf
    var experimentTarget = null;
    if (Session.get("loginMode") === "experiment") {
        experimentTarget = Session.get("experimentTarget");
        if (experimentTarget)
            experimentTarget = experimentTarget.toLowerCase();
    }

    //Will be populated if we find an experimental target to jump to
    var foundExpTarget = null;

    //Display different for admins/teachers
    var isAdmin = Roles.userIsInRole(Meteor.user(), ["admin", "teacher"]);

    //Check all the valid TDF's
    Tdfs.find({}).forEach( function (tdfObject) {
        //Make sure we have a valid TDF (with a setspec)

        var setspec = _.chain(tdfObject)
            .prop("tdfs")
            .prop("tutor")
            .prop("setspec").first()
            .value();

        if (!setspec) {
            console.log("Invalid TDF - it will never work", tdfObject);
            return;
        }

        var name = _.chain(setspec).prop("lessonname").first().value();
        if (!name) {
            console.log("Skipping TDF with no name", setspec);
            return;
        }

        var stimulusFile = _.chain(setspec).prop("stimulusfile").first().value();

        //Check to see if we have found a selected experiment target
        if (experimentTarget && !foundExpTarget) {
            var tdfExperimentTarget = _.chain(setspec)
                .prop("experimentTarget").first().trim()
                .value().toLowerCase();

            if (tdfExperimentTarget && experimentTarget == tdfExperimentTarget) {
                foundExpTarget = {
                    tdfkey: tdfObject._id,
                    lessonName: name,
                    stimulusfile: stimulusFile,
                    tdffilename: tdfObject.fileName,
                    how: "Auto-selected by experiment target " + experimentTarget
                };
            }
        }

        if (isAdmin) {
            //Admins see all TDF's, but we hide "root" TDF's
            var conditionCount = _.chain(setspec).prop("condition").prop("length").intval().value();
            if (conditionCount > 0) {
                console.log("Skipping due to condition.length > 0 (root TDF) for", name);
                return;
            }
        }
        else {
            //Non-admins (and non-teachers) can only see progress for user
            //selectable TDF's (TDF's they could have clicked on)
            //Note that we defer checking for userselect in case something above
            //(e.g. experimentTarget) auto-selects the TDF
            var userselectText = _.chain(setspec)
                .prop("userselect").first().trim()
                .value().toLowerCase();

            var userselect = true;
            if (userselectText === "false")
                userselect = false;

            if (!userselect) {
                console.log("Skipping due to userselect=false for", name);
                return;
            }
        }

        progressButtons.insert({
            'temp': 1,
            'name': name,
            'lessonname': name,
            'stimulusfile': stimulusFile,
            'tdfkey': tdfObject._id,
            'tdffilename': tdfObject.fileName
        });
    });

    //Did we find something to auto-jump to?
    if (foundExpTarget) {
        selectTdf(
            foundExpTarget.tdfkey,
            foundExpTarget.lessonName,
            foundExpTarget.stimulusfile,
            foundExpTarget.tdffilename,
            foundExpTarget.how
        );
    }
};



//Actual logic for selecting and starting a TDF
function selectTdf(tdfkey, lessonName, stimulusfile, tdffilename, how) {
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
        userAgent = _.display(navigator.userAgent);
        prefLang = _.display(navigator.language);
    }
    catch(err) {
        console.log("Error getting browser info", err);
    }

    //Save the test selection event
    recordUserTime("profile tdf selection", {
        target: lessonName,
        tdfkey: tdfkey,
        tdffilename: tdffilename,
        stimulusfile: stimulusfile,
        userAgent: userAgent,
        browserLanguage: prefLang,
        selectedHow: how
    });

    Router.go("/choose");
}
