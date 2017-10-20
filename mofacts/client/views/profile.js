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

    'click .allItemsLink' : function (event) {
        event.preventDefault();
        Router.go("/allItems");
    },

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
            target.data("enableAudioPromptAndFeedback"),
            "User button click"
        );
    },

    'click #simulation': function(event, template) {
        var checked = template.$("#simulation").prop('checked');
        Session.set("runSimulation", checked);
        console.log("runSimulation", Session.get("runSimulation"));
    },

    'click #setupApiKey' : function(e){
      e.preventDefault();
      $('#speechApiModal').modal('show');//{backdrop: "static"}
      Meteor.call('getUserSpeechAPIKey', function(error,key){
        console.log("key: " + key);
        $('#speechApiKey').val(key);
      });
    },

    'click #speechApiSubmit' : function(e){
      var key = $('#speechApiKey').val();
      console.log("speech api key: " + key);
      Meteor.call("saveUserSpeechAPIKey", key, function(error, serverReturn) {
          $('#speechApiModal').modal('hide');

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
    }
});

Template.profile.rendered = function () {
    $('#speechApiModal').on('shown.bs.modal', function () {
      $('#speechApiKey').focus();
    })

    //Set up input sensitivity range to display/hide when audio input is enabled/disabled
    var audioToggle = document.getElementById('audioToggle');

    var showHideAudioEnabledGroup = function()
    {
      if(audioToggle.checked){
        $('#audioEnabledGroup').removeClass('invisible');
      }else{
        $('#audioEnabledGroup').addClass('invisible');
      }
    };
    $('#audioToggle').change(showHideAudioEnabledGroup);
    //Restore toggle state
    audioToggle.checked = Session.get("audioToggled");
    showHideAudioEnabledGroup();

    //this is called whenever the template is rendered.
    var allTdfs = Tdfs.find({});

    $("#expDataDownloadContainer").html("");

    var addButton = function(btnObj) {
        $("#testButtonContainer").append(
            $("<div class='col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center'><br></div>").prepend(
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

        var enableAudioPromptAndFeedback = _.chain(setspec).prop("enableAudioPromptAndFeedback").first().value();
        if(!enableAudioPromptAndFeedback){
          enableAudioPromptAndFeedback = false;
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
                    enableAudioPromptAndFeedback: enableAudioPromptAndFeedback,
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

        addButton(
            $("<button type='button' id='"+tdfObject._id+"' name='"+name+"'></button>")
                .addClass("btn btn-block btn-responsive stimButton")
                .data("lessonname", name)
                .data("stimulusfile", stimulusFile)
                .data("tdfkey", tdfObject._id)
                .data("tdffilename", tdfObject.fileName)
                .data("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses)
                .data("enableAudioPromptAndFeedback",enableAudioPromptAndFeedback)
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
            foundExpTarget.ignoreOutOfGrammarResponses,
            foundExpTarget.enableAudioPromptAndFeedback,
            foundExpTarget.how
        );
    }
};

//Actual logic for selecting and starting a TDF
function selectTdf(tdfkey, lessonName, stimulusfile, tdffilename, ignoreOutOfGrammarResponses, enableAudioPromptAndFeedback,how) {
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
    Session.set("enableAudioPromptAndFeedback",enableAudioPromptAndFeedback);

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

   //Record state to restore when we return to this page
   Session.set("audioToggled",document.getElementById('audioToggle').checked);

   //If user has enabled audio input, initialize web audio (this takes a bit)
   if(document.getElementById('audioToggle').checked)
   {
     //Check if the user has a speech api key defined, if not show the modal form
     //for them to input one.  If so, actually continue initializing web audio
     //and going to the practice set
     Meteor.call('getUserSpeechAPIKey', function(error,key){
       console.log("key: " + key);
       speechAPIKey = key;
       if(!speechAPIKey)
       {
         console.log("speech api key not found, showing modal for user to input");
         $('#speechApiModal').modal('show');
       }else {
         console.log("audio toggle checked, initializing audio");
         try {
           window.AudioContext = window.AudioContext || window.webkitAudioContext;
           window.AudioContext.sampleRate = 16000;
           navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
           window.URL = window.URL || window.webkitURL;
           audioContext = new AudioContext();
         } catch (e) {
           console.log("Error initializing Web Audio browser");
         }
         if (navigator.getUserMedia) navigator.getUserMedia({audio: true}, startUserMedia, function(e) {
                                         console.log("No live audio input in this browser");
                                     });
         else console.log("No web audio support in this browser");
       }
     });
   }else {
     console.log("audio toggle not checked");
     //Go directly to the card session - which will decide whether or
     //not to show instruction
     Session.set("needResume", true);
     Router.go("/card");
   }
}

//START SPEECH RECOGNITION CODE

speechAPIKey = null;

processLINEAR16 = function(data){
  resetMainCardTimeout(); //Give ourselves a bit more time for the speech api to return results
  recorder.clear();
  var userAnswer = $("#forceCorrectionEntry").is(":visible") ? document.getElementById('userForceCorrect') : document.getElementById('userAnswer');

  if(userAnswer){
    userAnswer.value = "waiting for transcription";
    var sampleRate = Session.get("sampleRate");
    var setSpec = getCurrentTdfFile().tdfs.tutor.setspec[0];
    var speechRecognitionLanguage = setSpec.speechRecognitionLanguage;
    if(!speechRecognitionLanguage){
      speechRecognitionLanguage = "en-US";
    }else{
      speechRecognitionLanguage = speechRecognitionLanguage[0];
    }

    var speechURL = "https://speech.googleapis.com/v1/speech:recognize?key=" + speechAPIKey;
    var request = {
      "config": {
        "encoding": "LINEAR16",
        "sampleRateHertz": sampleRate,
        "languageCode" : speechRecognitionLanguage,
        "maxAlternatives" : 1,
        "profanityFilter" : false,
        "speechContexts" : [
          {
            "phrases" : getAllStimAnswers(true),
          }
        ]
      },
      "audio": {
        "content": data
      }
    }

    console.log("Request:" + JSON.stringify(request));

    //Make the actual call to the google speech api with the audio data for transcription
    HTTP.call("POST",speechURL,{"data":request}, function(err,response){
        console.log(JSON.stringify(response));
        var transcript = '';
        var ignoreOutOfGrammarResponses = Session.get("ignoreOutOfGrammarResponses");
        var ignoredOrSilent = false;
        if(!!response['data']['results'])
        {
          transcript = response['data']['results'][0]['alternatives'][0]['transcript'];
          console.log("transcript: " + transcript);
          if(ignoreOutOfGrammarResponses)
          {
            grammar = getAllStimAnswers(false);
            //Answer not in grammar, ignore and reset/re-record
            if(grammar.indexOf(transcript) == -1)
            {
              console.log("ANSWER OUT OF GRAMMAR, IGNORING");
              transcript = "";
              ignoredOrSilent = true;
            }
          }
        }else{
          console.log("NO TRANSCRIPT/SILENCE");
          ignoredOrSilent = true;
        }

        userAnswer.value = transcript;
        if(ignoredOrSilent){
          //Reset recording var so we can try again since we didn't get anything good
          Session.set('recording',true);
          recorder.record();
        }else{
          //Only simulate enter key press if we picked up transcribable/in grammar
          //audio for better UX
          simulateUserAnswerEnterKeyPress();
        }
      });
  }else{
    console.log("processwav userAnswer not defined");
  }
}

recorder = null;
callbackManager = null;
audioContext = null;

function startUserMedia(stream) {
  console.log("START USER MEDIA");
  var input = audioContext.createMediaStreamSource(stream);
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  //Capture the sampling rate for later use in google speech api as input
  Session.set("sampleRate", input.context.sampleRate);
  var audioRecorderConfig = {errorCallback: function(x) {console.log("Error from recorder: " + x);}};
  recorder = new Recorder(input, audioRecorderConfig);

  //Set up the process callback so that when we detect speech end we have the
  //function to process the audio data
  recorder.setProcessCallback(processLINEAR16);

  //Set up options for voice activity detection code (vad.js)
  var energyOffsetExp = 60 - ((document.getElementById("voiceSensitivityRange").value) * 60 / 100);
  var energyOffset = parseFloat("1e+" + energyOffsetExp);
  var options = {
    source: input,
    energy_offset: energyOffset,
    voice_stop: function() {
      if(!Session.get('recording')){
        console.log("NOT RECORDING, VOICE STOP");
        return;
      }
      console.log("VOICE STOP");
      recorder.stop();
      Session.set('recording',false);
      recorder.exportToProcessCallback();
    },
    voice_start: function() {
      if(!Session.get('recording')){
        console.log("NOT RECORDING, VOICE START");
        return;
      }
      console.log("VOICE START");
      if(resetMainCardTimeout){
        if(Session.get('recording')){
          console.log("voice_start resetMainCardTimeout");
          resetMainCardTimeout();
        }else {
          console.log("NOT RECORDING");
        }
      }else{
        console.log("RESETMAINCARDTIMEOUT NOT DEFINED");
      }
      //For multiple transcriptions:
      //recorder.record();
      //Session.set('recording',true);
    }
  }

  var vad = new VAD(options);

  console.log("Audio recorder ready");

  //After web audio is initialized we then go to the practice set the user chose
  //synchronously
  Session.set("needResume", true);
  Router.go("/card");
};

//END SPEECH RECOGNITION CODE
