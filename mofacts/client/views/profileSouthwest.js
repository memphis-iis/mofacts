////////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.profileSouthwest.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },
});

////////////////////////////////////////////////////////////////////////////
// Template Events

Template.profileSouthwest.events({
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
            Session.get("audioPromptFeedbackView"),
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

      Session.set("audioPromptFeedbackView",audioPromptMode);

      showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
    },
});

Template.profileSouthwest.rendered = function () {
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

    $('#audioPromptSpeakingRate').change(function() {
        $('#audioPromptSpeakingRateLabel').text("Audio prompt speaking rate: " + document.getElementById("audioPromptSpeakingRate").value);
    });

    $('#audioInputSensitivity').change(function() {
        $('#audioInputSensitivityLabel').text(document.getElementById("audioInputSensitivity").value);
    });

    $('#audioPromptSpeakingRate').change(function() {
        $('#audioPromptSpeakingRateLabel').text(document.getElementById("audioPromptSpeakingRate").value);
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



    Meteor.call('getTdfsAssignedToStudent',Meteor.user().username.toLowerCase(),function(err,result){
      console.log("err: " + err + ", res: " + result);
      var assignedTdfs = result;
      var allTdfs = Tdfs.find();
      console.log("assignedTdfs: " + JSON.stringify(assignedTdfs));
      //Check all the valid TDF's
      allTdfs.forEach( function (tdfObject) {
        console.log("tdfObject fileName: " + JSON.stringify(tdfObject.fileName));
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

          //Make sure we only present the tdfs assigned to the classes the user is in
          if(assignedTdfs.findIndex(x => x.fileName == tdfObject.fileName) == -1){
            console.log("tdf filename not in assignedTdfs: " + tdfObject.fileName);
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

          var audioInputEnabled = _.chain(setspec).prop("audioInputEnabled").first().value();
          if(!audioInputEnabled){
            audioInputEnabled = false;
          }

          var audioInputSpeechAPIKeyAvailable = !!_.chain(setspec).prop("speechAPIKey").first().value();

          //Only display the audio input available if enabled in tdf and tdf has key for it
          audioInputEnabled = audioInputEnabled && audioInputSpeechAPIKeyAvailable;

          var enableAudioPromptAndFeedback = _.chain(setspec).prop("enableAudioPromptAndFeedback").first().value();
          if(!enableAudioPromptAndFeedback){
            enableAudioPromptAndFeedback = false;
          }

          var audioPromptTTSAPIKeyAvailable = !!_.chain(setspec).prop("textToSpeechAPIKey").first().value();

          //Only display the audio output available if enabled in tdf and tdf has key for it
          var audioOutputEnabled = enableAudioPromptAndFeedback && audioPromptTTSAPIKeyAvailable;

          addButton(
              $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'>")
                  .addClass("btn btn-block btn-responsive stimButton")
                  .data("lessonname", name)
                  .data("stimulusfile", stimulusFile)
                  .data("tdfkey", tdfObject._id)
                  .data("tdffilename", tdfObject.fileName)
                  .data("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses)
                  .data("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback)
                  .html(name),audioInputEnabled,audioOutputEnabled
          );
      });
    });
};

//Actual logic for selecting and starting a TDF
function selectTdf(tdfkey, lessonName, stimulusfile, tdffilename, ignoreOutOfGrammarResponses, speechOutOfGrammarFeedback,audioPromptMode,how) {
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
    Session.set("audioPromptFeedbackView",audioPromptMode);
    Session.set("audioPromptMode",audioPromptMode);

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

    //Check to see if the user has turned on audio prompt.  If so and if the tdf has it enabled and there's a tts key in the tdf then turn on, otherwise we won't do anything
    var userAudioPromptFeedbackToggled = (Session.get("audioPromptFeedbackView") == "feedback") || (Session.get("audioPromptFeedbackView") == "all");
    var tdfAudioPromptFeedbackEnabled = getCurrentTdfFile().tdfs.tutor.setspec[0].enableAudioPromptAndFeedback;
    var audioPromptTTSAPIKeyAvailable = !!getCurrentTdfFile().tdfs.tutor.setspec[0].textToSpeechAPIKey;
    var audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled && audioPromptTTSAPIKeyAvailable;
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

   if(Session.get("audioEnabled"))
   {
     var userAudioInputSensitivity = document.getElementById("audioInputSensitivity").value;
     Session.set("audioInputSensitivity",userAudioInputSensitivity);
   }

   //Record state to restore when we return to this page
   Session.set("audioEnabledView",document.getElementById('audioToggle').checked);
   Session.set("audioPromptSpeakingRateView",document.getElementById("audioPromptSpeakingRate").value);
   Session.set("audioInputSensitivityView",document.getElementById("audioInputSensitivity").value);

   //Go directly to the card session - which will decide whether or
   //not to show instruction
   Session.set("needResume", true);
   Router.go("/card");
}

//We'll use this in card.js if audio input is enabled and user has provided a
//speech API key
speechAPIKey = null;
