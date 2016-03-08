////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.allItems.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.allItems.events({
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

    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },

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

Template.allItems.rendered = function () {
    //this is called whenever the template is rendered.
    var allTdfs = Tdfs.find({});

    $("#expDataDownloadContainer").html("");

    var addButton = function(btnObj) {
        $("#testButtonContainer").append(
            $("<div class='col-sm-3 col-md-3 col-lg-3 text-center'><br></div>").prepend(
                btnObj
            )
        );
    };

    //In experiment mode, they may be forced to a single tdf
    var experimentTarget = null;
    if (Session.get("loginMode") === "experiment") {
        experimentTarget = Session.get("experimentTarget");
        if (experimentTarget)
            experimentTarget = experimentTarget.toLowerCase();
    }

    //Will be populated if we find an experimental target to jump to
    var foundExpTarget = null;

    //Check all the valid TDF's
    allTdfs.forEach( function (tdfObject) {
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

        //Note that we defer checking for userselect in case something above
        //(e.g. experimentTarget) auto-selects the TDF
        var userselectText = _.chain(setspec)
            .prop("userselect").first().trim()
            .value().toLowerCase();

        var userselect = true;
        if (userselectText === "false")
            userselect = false;

        if (!userselect) {
            console.log("Skipping due to userselect=false for ", name);
            return;
        }

        addButton(
            $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'></button>")
                .addClass("btn btn-block stimButton")
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdfkey", tdfObject._id)
                .data("tdffilename", tdfObject.fileName)
                .html(name)
        );

        if (Meteor.userId() === tdfObject.owner) {
            $("#expDataDownloadContainer").append(
                $("<div></div>").append(
                    $("<a class='exp-data-link' target='_blank'></a>")
                        .attr("href", "/experiment-data/" + tdfObject.fileName +"/datashop")
                        .text("Download: " + name + " (DataShop format)")
                )
            );
        }
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
    recordUserTime("profile tdf selection", {
        target: lessonName,
        tdfkey: tdfkey,
        tdffilename: tdffilename,
        stimulusfile: stimulusfile,
        userAgent: userAgent,
        browserLanguage: prefLang,
        selectedHow: how
    });

    //Go directly to the card session - which will decide whether or
    //not to show instruction
    Router.go("/Items");
}
