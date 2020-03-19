import { ReactiveVar } from 'meteor/reactive-var'

/**
 * Set up state variables for profile page
 */
Template.profile.created = function() {
  this.showTdfs = new ReactiveVar(false);
  this.enabledTdfs = new ReactiveVar([]);
  this.disabledTdfs = new ReactiveVar([]);
  this.tdfsToDisable = new ReactiveVar([]);
  this.tdfsToEnable = new ReactiveVar([]);
  this.showTdfAdminInfo = new ReactiveVar([]);
  this.tdfOwnersMap = new ReactiveVar({});
}

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

    showTdfs: () => {
      return Template.instance().showTdfs.get();
    },

    enabledTdfs: () => {
      return Template.instance().enabledTdfs.get();
    },

    disabledTdfs: () => {
      return Template.instance().disabledTdfs.get();
    },

    showTdfAdminInfo: () => {
      return Template.instance().showTdfAdminInfo.get();
    },

    tdfOwnersMap: ownerId => {
      return Template.instance().tdfOwnersMap.get()[ownerId];
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

    'click #tdfPracticeBtn': function(event, instance) {
      let showTdfs = instance.showTdfs.get();
      instance.showTdfs.set(!showTdfs);
    },

    'click #select-disable': (event, instance) => {
      let checked = event.target.checked;
      let tdfId = event.target.getAttribute('uid');
      let tdfsToDisable = instance.tdfsToDisable.get();

      if (!checked && tdfsToDisable.includes(tdfId)) {
        tdfsToDisable = tdfsToDisable.filter(x => x.uid != tdfId);
      } else {
        tdfsToDisable.push(tdfId);
      }

      instance.tdfsToDisable.set(tdfsToDisable);
    },

    'click #select-enable': (event, instance) => {
      let checked = event.target.checked;
      let tdfId = event.target.getAttribute('uid');
      let tdfsToEnable = instance.tdfsToEnable.get();

      if (!checked && tdfsToEnable.includes(tdfId)) {
        tdfsToEnable = tdfsToEnable.filter(x => x.uid != tdfId);
      } else {
        tdfsToEnable.push(tdfId);
      }

      instance.tdfsToEnable.set(tdfsToEnable);
    },

    'click #disable-tdfs-btn': (event, instance) => {
      toggleTdfPresence(instance, 'disable');
    },

    'click #enable-tdfs-btn': (event, instance) => {
      toggleTdfPresence(instance, 'enable');
    },

    'click #tdf-admin-info': (event, instance) => {
      let checked = event.target.checked;
      instance.showTdfAdminInfo.set(checked);
    }
});

function toggleTdfPresence(instance, mode) {
  const DISABLE = 'disable';

  let tdfsToChange = [];
  if (mode === DISABLE) {
    tdfsToChange = instance.tdfsToDisable.get();
  } else {
    tdfsToChange = instance.tdfsToEnable.get();      
  }

  Meteor.call('toggleTdfPresence', tdfsToChange, mode, () =>{
    let remainingTdfs = [];
    let tdfsToUpdate = []; 
    let tdfsInOtherModeState = []
    if (mode === DISABLE) {
      tdfsInOtherModeState = instance.enabledTdfs.get();
    } else {
      tdfsInOtherModeState = instance.disabledTdfs.get();
    }

    tdfsInOtherModeState.forEach(tdf => {
      if (!tdfsToChange.includes(tdf._id)) {
        remainingTdfs.push(tdf);
      } else {
        tdfsToUpdate.push(tdf);
      }
    });

    let changedTdfs = [];
    if (mode === DISABLE) {
      instance.enabledTdfs.set(remainingTdfs);
      changedTdfs = instance.disabledTdfs.get();
      let newlyChangedTdfs = changedTdfs.concat(tdfsToUpdate);
      instance.disabledTdfs.set(newlyChangedTdfs);
      instance.tdfsToDisable.set([]);
    } else {
      instance.disabledTdfs.set(remainingTdfs);
      changedTdfs = instance.enabledTdfs.get();
      let newlyChangedTdfs = changedTdfs.concat(tdfsToUpdate);
      instance.enabledTdfs.set(newlyChangedTdfs)
      instance.tdfsToEnable.set([]);
    }
  });
}

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

    let enabledTdfs = [];
    let disabledTdfs = [];
    let tdfOwnerIds = [];

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

        tdfObject.name = name;
        tdfObject.stimulusFile = stimulusFile;
        tdfObject.ignoreOutOfGrammarResponses = ignoreOutOfGrammarResponses;
        tdfObject.speechOutOfGrammarFeedback = speechOutOfGrammarFeedback;
        tdfObject.audioInputEnabled = audioInputEnabled;
        tdfObject.enableAudioPromptAndFeedback = enableAudioPromptAndFeedback;


        if (!!tdfObject.disabled) {
          disabledTdfs.push(tdfObject);
        } else {
          enabledTdfs.push(tdfObject);
        }

        if (isAdmin) {
          if (!tdfOwnerIds.includes(tdfObject.owner)) {
            tdfOwnerIds.push(tdfObject.owner);
          }
        }

        Template.instance().disabledTdfs.set(disabledTdfs);
        Template.instance().enabledTdfs.set(enabledTdfs);
    });

    if (isAdmin) {
      const temp = Template.instance();
      Meteor.call('getTdfOwnersMap', tdfOwnerIds, function(err, res) {
        if (err) {
          console.log(err);
        } else {
          temp.tdfOwnersMap.set(res);
          console.log(temp.tdfOwnersMap.get());
        }
      });
    }

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

  //Go directly to the card session - which will decide whether or
  //not to show instruction
  if(continueToCard){
    Session.set("needResume", true);
    if(isMultiTdf){
      navigateForMultiTdf();
    }else{
      Router.go("/card");
    }
  }
}

navigateForMultiTdf = function(){
  function getUnitType(curUnit){
    let unitType = "other";
    if(!!curUnit.assessmentsession){
      unitType = "assessmentsession";
    }else if(!!curUnit.learningsession){
      unitType = "learningsession";
    }
    return unitType;
  }

  const userTimesLog = getCurrentUserTimesLog();
  let lastUnitCompleted = -1;
  let lastUnitStarted = -1;
  let unitLocked = false;
  userTimesLog.forEach(function(entry){
    if(!!entry.currentUnit){
      if(entry.action === "instructions"){
        lastUnitStarted = entry.currentUnit;
      }else if(entry.action === "unit-end"){
        lastUnitCompleted = entry.currentUnit;
      }
    }
  });

  //If we haven't finished the unit yet, we may want to lock into the current unit
  //so the user can't mess up the data
  if(lastUnitStarted > lastUnitCompleted){
    const curUnit = getCurrentTdfFile().tdfs.tutor.unit[lastUnitStarted];
    const curUnitType = getUnitType(curUnit);
    //We always want to lock users in to an assessment session
    if(curUnitType === "assessmentsession"){
      unitLocked = true;
    }else if(curUnitType === "learningsession"){
      if(!!curUnit.displayMinSeconds || !!curUnit.displayMaxSeconds){
        unitLocked = true;
      }
    }
  }
  //Only show selection if we're in a unit where it doesn't matter (infinite learning sessions)
  if(unitLocked){
    Router.go("/card");
  }else{
    Router.go("/multiTdfSelect");
  }
}