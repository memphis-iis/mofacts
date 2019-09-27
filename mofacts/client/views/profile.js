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
    },

    speechAPIKeyIsSetup: function(){
      return Session.get("speechAPIKeyIsSetup");
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.profile.events({
    'click .allStudentsLink' : function (event) {
        event.preventDefault();
        Router.go("/allStudents");
    },

    'click .adminLink' : function (event) {
        event.preventDefault();
        Router.go("/admin");
    },

    // Start a TDF
    'click .stimButton' : function (event) {
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
            "User button click"
        );
    },

    'click .audioPromptRadio': function(event){
      console.log("audio prompt mode: " + event.currentTarget.id);
      var audioPromptMode = "silent";

      switch(event.currentTarget.id){
        case "audioPromptOff":
          audioPromptMode = "silent";
          break;
        case "audioPromptFeedbackOnly":
          audioPromptMode = "feedback";
          break;
        case "audioPromptAll":
          audioPromptMode = "all";
          break;
      }

      Session.set("audioPromptMode",audioPromptMode);
      Session.set("audioPromptFeedbackView",audioPromptMode);

      showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
    },

    'click #simulation': function(event, template) {
        var checked = template.$("#simulation").prop('checked');
        Session.set("runSimulation", checked);
        console.log("runSimulation", Session.get("runSimulation"));
    },

    'click #setupAPIKey' : function(e){
      e.preventDefault();
      $('#speechAPIModal').modal('show');//{backdrop: "static"}
      Meteor.call('getUserSpeechAPIKey', function(error,key){
        $('#speechAPIKey').val(key);
      });
    },

    'click #speechAPISubmit' : function(e){
      var key = $('#speechAPIKey').val();
      Meteor.call("saveUserSpeechAPIKey", key, function(error, serverReturn) {
          //Make sure to update our reactive session variable so the api key is
          //setup indicator updates
          checkAndSetSpeechAPIKeyIsSetup();

          $('#speechAPIModal').modal('hide');

          if (!!error) {
              console.log("Error saving speech api key", error);
              alert("Your changes were not saved! " + error);
          }
          else {
              console.log("Profile saved:", serverReturn);
              //Clear any controls that shouldn't be kept around
              $(".clearOnSave").val("");
              alert("Your profile changes have been saved");
          }
      });
    },

    'click #speechAPIDelete' : function(e){
      Meteor.call("deleteUserSpeechAPIKey",function(error){
        //Make sure to update our reactive session variable so the api key is
        //setup indicator updates
        checkAndSetSpeechAPIKeyIsSetup();
        $('#speechAPIModal').modal('hide');
        if(!!error){
          console.log("Error deleting speech api key", error);
          alert("Your changes were not saved! " + error);
        }else{
          console.log("User speech api key deleted");
          alert("Your profile changes have been saved");
        }
      })
    }
});

Template.profile.rendered = function () {
    $('#speechAPIModal').on('shown.bs.modal', function () {
      $('#speechAPIKey').focus();
    })

    checkAndSetSpeechAPIKeyIsSetup();

    //Set up input sensitivity range to display/hide when audio input is enabled/disabled
    var audioToggle = document.getElementById('audioToggle');

    var showHideAudioEnabledGroup = function()
    {
      if(audioToggle.checked){
          $('.audioEnabledGroup').removeClass('invisible');
          $('.audioEnabledGroup').addClass('flow');
      }else{
        $('.audioEnabledGroup').addClass('invisible');
        $('.audioEnabledGroup').removeClass('flow');
      }
    };
    $('#audioToggle').change(showHideAudioEnabledGroup);

    $('#audioInputSensitivity').change(function() {
        $('#audioInputSensitivityLabel').text(document.getElementById("audioInputSensitivity").value);
    });

    $('#audioPromptSpeakingRate').change(function() {
        $('#audioPromptSpeakingRateLabel').text("Audio prompt speaking rate: " + document.getElementById("audioPromptSpeakingRate").value);
    });

    //Restore toggle values from prior page loads
    audioToggle.checked = Session.get("audioEnabledView");
    var audioPromptMode = Session.get("audioPromptFeedbackView");
    switch(audioPromptMode){
      case "silent":
        $("#audioPromptOff")[0].checked = true;
        break;
      case "feedback":
        $("#audioPromptFeedbackOnly")[0].checked = true;
        break;
      case "all":
        $("#audioPromptAll")[0].checked = true;
        break;
    }
    showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
    showHideAudioEnabledGroup();

    //Restore range/label values from prior page loads
    var audioInputSensitivityView = Session.get("audioInputSensitivityView");
    if(!!audioInputSensitivityView){
      document.getElementById("audioInputSensitivity").value = audioInputSensitivityView;
    }

    var audioPromptSpeakingRateView = Session.get("audioPromptSpeakingRateView");
    if(!!audioPromptSpeakingRateView){
      document.getElementById("audioPromptSpeakingRate").value = audioPromptSpeakingRateView;
      document.getElementById("audioPromptSpeakingRateLabel").innerHTML = audioPromptSpeakingRateView;
    }

    //this is called whenever the template is rendered.
    var allTdfs = Tdfs.find({});

    $("#expDataDownloadContainer").html("");

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
                    how: "Auto-selected by experiment target " + experimentTarget
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
                .addClass("btn btn-block btn-responsive stimButton")
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdfkey", tdfObject._id)
                .data("tdffilename", tdfObject.fileName)
                .data("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses)
                .data("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback)
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
            foundExpTarget.how
        );
    }
};

showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode = function(audioPromptMode){
  var showHideAudioPromptFeedbackGroup = function(show)
  {
    if(show){
        $('.audioPromptFeedbackGroup').removeClass('invisible');
        $('.audioPromptFeedbackGroup').addClass('flow');
    }else{
      $('.audioPromptFeedbackGroup').addClass('invisible');
      $('.audioPromptFeedbackGroup').removeClass('flow');
    }
  };

  switch(audioPromptMode){
    case "silent":
      showHideAudioPromptFeedbackGroup(false);
      break;
    case "feedback":
      showHideAudioPromptFeedbackGroup(true);
      break;
    case "all":
      showHideAudioPromptFeedbackGroup(true);
      break;
    default:
      showHideAudioPromptFeedbackGroup(false);
      break;
  }
}

//Actual logic for selecting and starting a TDF
function selectTdf(tdfkey, lessonName, stimulusfile, tdffilename, ignoreOutOfGrammarResponses, speechOutOfGrammarFeedback,how) {
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
    Session.set("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses);
    Session.set("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback);

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

    //Check to see if the user has turned on audio prompt.  If so and if the tdf has it enabled then turn on, otherwise we won't do anything
    var userAudioPromptFeedbackToggled = (Session.get("audioPromptFeedbackView") == "feedback") || (Session.get("audioPromptFeedbackView") == "all");
    var tdfAudioPromptFeedbackEnabled = getCurrentTdfFile().tdfs.tutor.setspec[0].enableAudioPromptAndFeedback;
    var audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled;
    Session.set("enableAudioPromptAndFeedback",audioPromptFeedbackEnabled);

    if(Session.get("enableAudioPromptAndFeedback")){
         var userAudioPromptSpeakingRate = document.getElementById("audioPromptSpeakingRate").value;
         Session.set("audioPromptSpeakingRate",userAudioPromptSpeakingRate);
    }

   //If we're in experiment mode and the tdf file defines whether audio input is enabled
   //forcibly use that, otherwise go with whatever the user set the audio input toggle to
   var userAudioToggled = document.getElementById('audioToggle').checked;
   var tdfAudioEnabled = getCurrentTdfFile().tdfs.tutor.setspec[0].audioInputEnabled;
   var audioEnabled = tdfAudioEnabled && userAudioToggled;
   Session.set("audioEnabled", audioEnabled);

   var continueToCard = true;

   if(Session.get("audioEnabled"))
   {
     var userAudioInputSensitivity = document.getElementById("audioInputSensitivity").value;
     var audioInputSensitivity = userAudioInputSensitivity;
     Session.set("audioInputSensitivity",audioInputSensitivity);

     //Check if the tdf or user has a speech api key defined, if not show the modal form
     //for them to input one.  If so, actually continue initializing web audio
     //and going to the practice set
     Meteor.call('getUserSpeechAPIKey', function(error,key){
       speechAPIKey = key;
       var tdfKeyPresent = getCurrentTdfFile().tdfs.tutor.setspec[0].speechAPIKey && getCurrentTdfFile().tdfs.tutor.setspec[0].speechAPIKey != "";
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

   //Record state to restore when we return to this page
   Session.set("audioEnabledView",document.getElementById('audioToggle').checked);
   Session.set("audioPromptSpeakingRateView",document.getElementById("audioPromptSpeakingRate").value);
   Session.set("audioInputSensitivityView",document.getElementById("audioInputSensitivity").value);

   if(continueToCard){
     //Go directly to the card session - which will decide whether or
     //not to show instruction
     Session.set("needResume", true);
     Router.go("/card");
   }
}

//We'll use this in card.js if audio input is enabled and user has provided a
//speech API key
speechAPIKey = null;

checkAndSetSpeechAPIKeyIsSetup = function(){
  Meteor.call('isUserSpeechAPIKeySetup', function(err,data){
    if(err){
      console.log("Error getting whether speech api key is setup");
    }else {
      Session.set('speechAPIKeyIsSetup',data);
    }
  })
}
