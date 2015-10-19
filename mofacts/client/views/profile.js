////////////////////////////////////////////////////////////////////////////
// Template storage

var turkExperimentLog = new Mongo.Collection(null); //local-only - no database;

function clearTurkExpLog() {
    turkExperimentLog.remove({'temp': 1});
}

// We are expecting the format supplied by the server method turkUserLogStatus
function populateTurkExpLog(serverData) {
    _.each(serverData, function(val, idx) {
        console.log(val);
        turkExperimentLog.insert({
            temp: 1,
            idx: idx,
            userid: val.userid,
            turk_username: val.username,
            turkpay: val.turkpay,
            turkpayDetails: val.turkpayDetails,
            turkbonus: val.turkbonus,
            turkbonusDetails: val.turkbonusDetails
        });
    });
}

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.profile.events({
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

    'click .stimButton' : function (event) {
        event.preventDefault();
        console.log(event);

        var target = $(event.target);
        selectTdf(
            target.data("tdfkey"),
            target.data("lessonname"),
            target.data("stimulusfile"),
            target.data("tdffilename"),
            "User button click"
        );
    },

    'click #saveProfile': function(event) {
        event.preventDefault();
        console.log(event);

        var data = {
            aws_id: $("#profileAWSID").val(),
            aws_secret_key: $("#profileAWSSecret").val(),
            use_sandbox: $("#profileUseSandbox").prop("checked")
        };

        $('#turkModal').modal('show');

        Meteor.call("saveUserProfileData", data, function(error, serverReturn) {
            $('#turkModal').modal('hide');

            if (!!error) {
                console.log("Error saving user profile", error);
                alert("Your changes were not saved! " + error);
            }
            else if (!serverReturn || !serverReturn.result) {
                console.log("Server failure while saving profile", serverReturn);
                alert("Your changes were not saved! The server said: " + JSON.stringify(serverReturn, null, 2));
            }
            else {
                console.log("Profile saved:", serverReturn);
                //Clear any controls that shouldn't be kept around
                $(".clearOnSave").val("");
                alert("Your profile changes have been saved: save details follow\n\n" + JSON.stringify(serverReturn, null, 2));
            }
        });
    },

    'click #turk-show-assign': function(event) {
        event.preventDefault();
        var assignid = $("#turk-assignid").val();
        $("#turk-assign-results").text("Working on " + assignid);
        $('#turkModal').modal('show');
        Meteor.call("turkGetAssignment", assignid, function(error, result){
            $('#turkModal').modal('hide');
            var disp;
            if (typeof error !== "undefined") {
                disp = "Failed to handle turk approval. Error:" + error;
            }
            else {
                disp = "Server returned:" + JSON.stringify(result, null, 2);
            }
            $("#turk-assign-results").text(disp);
        });
    },

    'click #turk-send-msg': function(event) {
        event.preventDefault();
        var workerid = $("#turk-workerid").val();
        var msgtext = $("#turk-msg").val();
        console.log("Sending to", workerid, "Msg:", msgtext);
        $('#turkModal').modal('show');
        Meteor.call("turkSendMessage", workerid, msgtext, function(error, result){
            $('#turkModal').modal('hide');
            var disp;
            if (typeof error !== "undefined") {
                disp = "Failed to handle turk approval. Error:" + error;
            }
            else {
                disp = "Server returned:" + JSON.stringify(result, null, 2);
            }
            console.log(disp);
            alert(disp);
        });
    },

    'click .btn-log-select': function(event) {
        event.preventDefault();

        var target = $(event.target);
        var exp = target.data("tdffilename");

        $("#turkExpTitle").text("Viewing data for " + exp);
        clearTurkExpLog();

        $('#turkModal').modal('show');
        Meteor.call("turkUserLogStatus", exp, function(error, result){
            $('#turkModal').modal('hide');

            if (typeof error !== "undefined") {
                var disp = "Failed to retrieve log entries. Error:" + error;
                console.log(disp);
                alert(disp);
                return;
            }

            populateTurkExpLog(result);
        });
    },

    'click .btn-pay-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var target = $(event.target);
        var idx = Helpers.intVal(target.data("idx"));

        var disp;
        try {
            var data = turkExperimentLog.findOne({'idx': idx}, {sort: {'idx': 1}});
            console.log(data);
            disp = JSON.stringify(data.turkpayDetails, null, 2);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    },

    'click .btn-bonus-detail': function(event) {
        event.preventDefault();

        $("#detailsModal").modal('hide');

        var target = $(event.target);
        var idx = Helpers.intVal(target.data("idx"));

        var disp;
        try {
            var data = turkExperimentLog.findOne({'idx': idx}, {sort: {'idx': 1}});
            console.log(data);
            disp = JSON.stringify(data.turkbonusDetails, null, 2);
        }
        catch(e) {
            disp = "Error finding details to display: " + e;
        }

        $("#detailsModalListing").text(disp);
        $("#detailsModal").modal('show');
    }
});


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
    Session.set("needResume", true);
    Router.go("/card");
}

////////////////////////////////////////////////////////////////////////////
// Template helpers

function getProfileField(field) {
    var prof =  UserProfileData.findOne({_id:Meteor.userId()});
    if (!prof || typeof prof[field] === undefined)
        return null;
    return prof[field];
}

Template.profile.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

    use_sandbox: function() {
        return getProfileField('use_sandbox') ? "checked" : false;
    },
    have_aws_id: function() {
        return getProfileField('have_aws_id');
    },
    have_aws_secret: function() {
        return getProfileField('have_aws_secret');
    },

    turkExperimentLog: function() {
        return turkExperimentLog.find({}, {sort: {idx: 1}});
    },
});

Template.profile.rendered = function () {
    //Init the modal dialogs
    $('#turkModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });

    $('#detailsModal').modal({
        'show': false
    });

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

        var stimulusFile = "";
        if (setspec.stimulusfile && setspec.stimulusfile.length) {
            stimulusFile = setspec.stimulusfile[0];
        }

        //Check to see if we have found a selected experiment target
        if (experimentTarget && !foundExpTarget) {
            var tdfExperimentTarget = "";
            if (setspec.experimentTarget && setspec.experimentTarget.length) {
                tdfExperimentTarget = setspec.experimentTarget[0];
            }

            if (tdfExperimentTarget && experimentTarget == tdfExperimentTarget.toLowerCase()) {
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

        addButton(
            $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'></button>")
                .addClass("btn btn-block stimButton")
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdfkey", tdfObject._id)
                .data("tdffilename", tdfObject.fileName)
                .html(name)
        );

        $("#expDataDownloadContainer").append(
            $("<div></div>").append(
                $("<a class='exp-data-link' target='_blank'></a>")
                    .attr("href", "/experiment-data/" + tdfObject.fileName +"/datashop")
                    .text("Download: " + name + " (DataShop format)")
            )
        );

        $("#turkLogSelectContainer").append(
            $("<button type='button' id='turk_"+tdfObject._id+"' name=turk_'"+name+"'></button>")
                .addClass("btn btn-fix btn-sm btn-success btn-log-select")
                .css('margin', '3px')
                .data("tdffilename", tdfObject.fileName)
                .html(name)
        );
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
