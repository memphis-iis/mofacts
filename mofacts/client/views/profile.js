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
            "User button click"
        );
    },

    'click #simulation': function(event, template) {
        var checked = template.$("#simulation").prop('checked');
        Session.set("runSimulation", checked);
        console.log("runSimulation", Session.get("runSimulation"));
    }
});

Template.profile.rendered = function () {
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



    // The following is to initialize Web Audio
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

    // //Go directly to the card session - which will decide whether or
    // //not to show instruction
    // Session.set("needResume", true);
    // Router.go("/card");
}

//START SPEECH RECOGNITION CODE

recorder = null;
callbackManager = null;
audioContext = null;

function startUserMedia(stream) {
  var input = audioContext.createMediaStreamSource(stream);
  // Firefox hack https://support.mozilla.org/en-US/questions/984179
  window.firefox_audio_hack = input;
  var audioRecorderConfig = {errorCallback: function(x) {console.log("Error from recorder: " + x);}};
  recorder = new Recorder(input, audioRecorderConfig);
  // If a recognizer is ready, we pass it to the recorder
  //recorder.consumers = [processData];
  //if (recognizer) recorder.consumers = [recognizer];
  //isRecorderReady = true;
  console.log("Audio recorder ready");

  //Go directly to the card session - which will decide whether or
  //not to show instruction
  Session.set("needResume", true);
  Router.go("/card");
};

processData = function(data){
  console.log("looking for user answer");
  // import Speech from '@google-cloud/speech';
  // import fs from 'fs';
  var userAnswer = document.getElementById("userAnswer");

  // let blob = new Blob(data,{type:'audio/x-mpeg-3'});
  // source = URL.createObjectURL(blob);
  // console.log("url:" + source);

  // const config = {
  //   encoding: 'LINEAR16',
  //   sampleRateHertz: 16000,
  //   languageCode: 'en-US'
  // };
  //
  // // Detects speech in the audio file
  // speechClient.recognize(request)
  //   .then((results) => {
  //     const transcription = results[0].results[0].alternatives[0].transcript;
  //     console.log(`Transcription: ${transcription}`);
  //   })
  //   .catch((err) => {
  //     console.error('ERROR:', err);
  //   });

  recorder.stop();
  recorder.exportWAV();
  userAnswer.value = "test";
  console.log(data);
};

//END SPEECH RECOGNITION CODE
