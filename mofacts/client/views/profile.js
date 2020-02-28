////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.profile.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },

    simulationChecked: function() {
        return Session.get("runSimulation");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.profile.events({
    'click .allStudentsLink' : function (event) {
        event.preventDefault();
        Router.go("/allStudents");
    },

    // Start a TDF
    'click .tdfButton' : function (event) {
        event.preventDefault();
        console.log(event);

        var target = $(event.currentTarget);
        selectTdf(
            target.data("tdfkey"),
            target.data("lessonname"),
            target.data("stimulusfile"),
            target.data("tdffilename"),
            target.data("ignoreOutOfGrammarResponses"),
            target.data("speechOutOfGrammarFeedback"),
            "User button click",
            target.data("isMultiTdf")
        );
    },

    'click #simulation': function(event, template) {
        var checked = template.$("#simulation").prop('checked');
        Session.set("runSimulation", checked);
        console.log("runSimulation", Session.get("runSimulation"));
    },

    'click #tdfPracticeBtn': function(event){
      var wasPracticeShown = $("#tdfPracticeBtn").attr('aria-expanded') == "false";
      if(wasPracticeShown){
        $("#tdfPracticeBtn").text("TDF Practice -");
      }else{
        $("#tdfPracticeBtn").text("TDF Practice +");
      }
    },

    'click #mechTurkButton': function(event){
      event.preventDefault();
      Router.go('/turkWorkflow');
    },

    'click #contentUploadButton': function(event){
      event.preventDefault();
      Router.go('/contentUpload');
    },

    'click #dataDownloadButton': function(event){
      event.preventDefault();
      Router.go('/dataDownload');
    },

    'click #userProfileEditButton': function(event){
      event.preventDefault();
      Router.go('/userProfileEdit');
    },

    'click #userAdminButton': function(event){
      event.preventDefault();
      Router.go('/userAdmin');
    },

    'click #classEditButton': function(event){
      event.preventDefault();
      Router.go('/classEdit');
    },

    'click #tdfAssignmentEditButton': function(event){
      event.preventDefault();
      Router.go('/tdfAssignmentEdit');
    },

    'click #instructorReportingButton': function(event){
      event.preventDefault();
      Router.go('/instructorReporting');
    },

    'click #contentGenerationButton': function(event){
      event.preventDefault();
      Router.go('/contentGeneration');
    },
});

var addButton = function(btnObj,audioInputEnabled,enableAudioPromptAndFeedback) {
  console.log("ADD BUTTON CALLED: " + JSON.stringify(btnObj));
  var container = "<div class='col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center'><br></div>";
  if(audioInputEnabled){
    container = $(container).prepend('<p style="display:inline-block" title="Speech Input available for this module"><i class="fa fa-microphone"></i></p>');
  }
  container = $(container).prepend('<p style="display:inline-block">&nbsp;&nbsp;&nbsp;</p>');
  if(enableAudioPromptAndFeedback){
    container = $(container).prepend('<p style="display:inline-block" title="Audio Output available for this module"><i class="fas fa-volume-up"></i></p>')
  }
  container = $(container).prepend(btnObj);
  $("#testButtonContainer").append(container);
};

//We'll use this in card.js if audio input is enabled and user has provided a
//speech API key
speechAPIKey = null;

Template.profile.rendered = function () {
    Session.set("showSpeechAPISetup",true);

    //this is called whenever the template is rendered.
    var allTdfs = Tdfs.find({});

    $("#expDataDownloadContainer").html("");

    //In experiment mode, they may be forced to a single tdf
    var experimentTarget = null;
    if (Session.get("loginMode") === "experiment") {
        experimentTarget = Session.get("experimentTarget");
        if (experimentTarget)
            experimentTarget = experimentTarget.toLowerCase();
    }

    //Will be populated if we find an experimental target to jump to
    var foundExpTarget = null;

    var isAdmin = Roles.userIsInRole(Meteor.user(), ["admin"]);

    //Check all the valid TDF's
    allTdfs.forEach( function (tdfObject) {
        let isMultiTdf = tdfObject.isMultiTdf;

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

        var ignoreOutOfGrammarResponses = _.chain(setspec).prop("speechIgnoreOutOfGrammarResponses").first().value();
        if(!ignoreOutOfGrammarResponses){
          ignoreOutOfGrammarResponses = false;
        }

        var speechOutOfGrammarFeedback = _.chain(setspec).prop("speechOutOfGrammarFeedback").first().value();
        if(!speechOutOfGrammarFeedback){
          speechOutOfGrammarFeedback = "Response not in answer set"
        }

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
                    ignoreOutOfGrammarResponses: ignoreOutOfGrammarResponses,
                    speechOutOfGrammarFeedback: speechOutOfGrammarFeedback,
                    how: "Auto-selected by experiment target " + experimentTarget,
                    isMultiTdf: isMultiTdf
                };
            }
        }

        // Show data download - note that this happens regardless of userselect
        if (Meteor.userId() === tdfObject.owner || isAdmin) {
            var disp = name;
            if (tdfObject.fileName != name) {
                disp += " (" + tdfObject.fileName + ")";
            }

            $("#expDataDownloadContainer").append(
                $("<div></div>").append(
                    $("<a class='exp-data-link' target='_blank'></a>")
                        .attr("href", "/experiment-data/" + tdfObject.fileName +"/datashop")
                        .text("Download: " + disp)
                )
            );
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

        var audioInputEnabled = _.chain(setspec).prop("audioInputEnabled").first().value();
        if(!audioInputEnabled){
          audioInputEnabled = false;
        }

        var enableAudioPromptAndFeedback = _.chain(setspec).prop("enableAudioPromptAndFeedback").first().value();
        if(!enableAudioPromptAndFeedback){
          enableAudioPromptAndFeedback = false;
        }

        addButton(
            $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'>")
                .addClass("btn btn-block btn-responsive tdfButton")
                .data("tdfkey", tdfObject._id)
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdffilename", tdfObject.fileName)
                .data("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses)
                .data("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback)
                .data("isMultiTdf",isMultiTdf)
                .html(name),audioInputEnabled,enableAudioPromptAndFeedback
        );
    });

    //Did we find something to auto-jump to?
    if (foundExpTarget) {
        selectTdf(
            foundExpTarget.tdfkey,
            foundExpTarget.lessonName,
            foundExpTarget.stimulusfile,
            foundExpTarget.tdffilename,
            foundExpTarget.ignoreOutOfGrammarResponses,
            foundExpTarget.speechOutOfGrammarFeedback,
            foundExpTarget.how,
            foundExpTarget.isMultiTdf
        );
    }
};

//Actual logic for selecting and starting a TDF
function selectTdf(tdfkey, lessonName, stimulusfile, tdffilename, ignoreOutOfGrammarResponses, speechOutOfGrammarFeedback,how,isMultiTdf) {
    console.log("Starting Lesson", lessonName, tdffilename, "Stim:", stimulusfile);

    var audioPromptFeedbackView = Session.get("audioPromptFeedbackView");

    //make sure session variables are cleared from previous tests
    sessionCleanUp();

    //Set the session variables we know
    //Note that we assume the root and current TDF names are the same.
    //The resume logic in the the card template will determine if the
    //current TDF should be changed due to an experimental condition
    Session.set("currentRootTdfName", tdffilename);
    Session.set("currentTdfName", tdffilename);
    Session.set("currentStimName", stimulusfile);
    Session.set("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses);
    Session.set("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback);

    //Record state to restore when we return to this page
    var audioPromptMode = getAudioPromptModeFromPage();
    Session.set("audioPromptMode",audioPromptMode);
    Session.set("audioPromptFeedbackView",audioPromptMode);
    var audioInputEnabled = getAudioInputFromPage();
    Session.set("audioEnabledView",audioInputEnabled);
    var audioPromptSpeakingRate = document.getElementById("audioPromptSpeakingRate").value;
    Session.set("audioPromptSpeakingRateView",audioPromptSpeakingRate);
    var audioInputSensitivity = document.getElementById("audioInputSensitivity").value;
    Session.set("audioInputSensitivityView",audioInputSensitivity);

    //Set values for card.js to use later, in experiment mode we'll default to the values in the tdf
    Session.set("audioPromptSpeakingRate",audioPromptSpeakingRate);
    Session.set("audioInputSensitivity",audioInputSensitivity);

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
        selectedHow: how,
        isMultiTdf: isMultiTdf
    });

    //Check to see if the user has turned on audio prompt.  If so and if the tdf has it enabled then turn on, otherwise we won't do anything
    var userAudioPromptFeedbackToggled = (audioPromptFeedbackView == "feedback") || (audioPromptFeedbackView == "all");
    var tdfAudioPromptFeedbackEnabled = getCurrentTdfFile().tdfs.tutor.setspec[0].enableAudioPromptAndFeedback;
    var audioPromptFeedbackEnabled = !Session.get("experimentTarget") ? (tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled) : tdfAudioPromptFeedbackEnabled;
    Session.set("enableAudioPromptAndFeedback",audioPromptFeedbackEnabled);

   //If we're in experiment mode and the tdf file defines whether audio input is enabled
   //forcibly use that, otherwise go with whatever the user set the audio input toggle to
   var userAudioToggled = audioInputEnabled;
   var tdfAudioEnabled = getCurrentTdfFile().tdfs.tutor.setspec[0].audioInputEnabled;
   var audioEnabled = !Session.get("experimentTarget") ? (tdfAudioEnabled && userAudioToggled) : tdfAudioEnabled;
   Session.set("audioEnabled", audioEnabled);

   var continueToCard = true;

   if(Session.get("audioEnabled"))
   {
     //Check if the tdf or user has a speech api key defined, if not show the modal form
     //for them to input one.  If so, actually continue initializing web audio
     //and going to the practice set
     Meteor.call('getUserSpeechAPIKey', function(error,key){
       speechAPIKey = key;
       var tdfKeyPresent = !!getCurrentTdfFile().tdfs.tutor.setspec[0].speechAPIKey && !!getCurrentTdfFile().tdfs.tutor.setspec[0].speechAPIKey[0];
       if(!speechAPIKey && !tdfKeyPresent)
       {
         console.log("speech api key not found, showing modal for user to input");
         $('#speechAPIModal').modal('show');
         continueToCard = false;
       }else {
         console.log("audio input enabled and key present, navigating to card and initializing audio input");
       }
     });
   }else {
     console.log("audio toggle not checked, navigating to card");
   }

   if(continueToCard){
     //Go directly to the card session - which will decide whether or
     //not to show instruction
     Session.set("needResume", true);
     if(isMultiTdf){
       Router.go("/multiTdfSelect");
     }else{
      Router.go("/card");
     }
   }
}
