import {ReactiveVar} from 'meteor/reactive-var';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {getExperimentState, updateExperimentStateSync} from '../experiment/card';
import {DISABLED, ENABLED, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {routeToSignin} from '../../lib/router';
import {getAudioPromptModeFromPage, getAudioInputFromPage} from './profileAudioToggles';

export {selectTdf};

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
};
const localMongo = new Mongo.Collection(null); // local-only - no database

// //////////////////////////////////////////////////////////////////////////
// Template storage and helpers

Template.profile.helpers({
  username: function() {
    if (!haveMeteorUser()) {
      routeToSignin();
    } else {
      return Meteor.user().username;
    }
  },

  simulationChecked: function() {
    return localMongo.findOne({}).runSimulation;
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

  tdfOwnersMap: (ownerId) => {
    return Template.instance().tdfOwnersMap.get()[ownerId];
  },
  isImpersonating: function(){
    return Meteor.user() && Meteor.user().profile ? Meteor.user().profile.impersonating : false;
  },
});

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.profile.events({
  // Start a TDF
  'click .tdfButton': function(event) {
    event.preventDefault();
    console.log(event);

    const target = $(event.currentTarget);
    selectTdf(
        target.data('tdfid'),
        target.data('lessonname'),
        target.data('currentstimulisetid'),
        target.data('ignoreoutofgrammarresponses'),
        target.data('speechoutofgrammarfeedback'),
        'User button click',
        target.data('ismultitdf'),
        false,
    );
  },

  'click #simulation': function(event, template) {
    const checked = template.$('#simulation').prop('checked');
    data = localMongo.findOne({}) || {}; data.runSimulation =  checked; localMongo.update({},{$set:data});
    console.log('runSimulation', localMongo.findOne({}).runSimulation);
  },

  'click #mechTurkButton': function(event) {
    event.preventDefault();
    Router.go('/turkWorkflow');
  },

  'click #contentUploadButton': function(event) {
    event.preventDefault();
    Router.go('/contentUpload');
  },
  'click #assetUploadButton': function(event) {
    event.preventDefault();
    Router.go('/assetUpload');
  },

  'click #dataDownloadButton': function(event) {
    event.preventDefault();
    Router.go('/dataDownload');
  },

  'click #userProfileEditButton': function(event) {
    event.preventDefault();
    Router.go('/userProfileEdit');
  },

  'click #userAdminButton': function(event) {
    event.preventDefault();
    Router.go('/userAdmin');
  },

  'click #classEditButton': function(event) {
    event.preventDefault();
    Router.go('/classEdit');
  },

  'click #tdfAssignmentEditButton': function(event) {
    event.preventDefault();
    Router.go('/tdfAssignmentEdit');
  },

  'click #instructorReportingButton': function(event) {
    event.preventDefault();
    Router.go('/instructorReporting');
  },

  'click #contentGenerationButton': function(event) {
    event.preventDefault();
    Router.go('/contentGeneration');
  },
  'click #contentGenerationButton': function(event) {
    event.preventDefault();
    Router.go('/contentGeneration');
  },

  'click #tdfPracticeBtn': function(event, instance) {
    const showTdfs = instance.showTdfs.get();
    instance.showTdfs.set(!showTdfs);
  },
  'click #wikiButton': function(event, instance) {
    window.location.href="https://github.com/memphis-iis/mofacts-ies/wiki";
  },

  'click #select-disable': (event, instance) => {
    const checked = event.target.checked;
    const tdfId = event.target.getAttribute('uid');
    let tdfsToDisable = instance.tdfsToDisable.get();

    if (!checked && tdfsToDisable.includes(tdfId)) {
      tdfsToDisable = tdfsToDisable.filter((x) => x.uid != tdfId);
    } else {
      tdfsToDisable.push(tdfId);
    }

    instance.tdfsToDisable.set(tdfsToDisable);
  },

  'click #select-enable': (event, instance) => {
    const checked = event.target.checked;
    const tdfId = event.target.getAttribute('uid');
    let tdfsToEnable = instance.tdfsToEnable.get();

    if (!checked && tdfsToEnable.includes(tdfId)) {
      tdfsToEnable = tdfsToEnable.filter((x) => x.uid != tdfId);
    } else {
      tdfsToEnable.push(tdfId);
    }

    instance.tdfsToEnable.set(tdfsToEnable);
  },

  'click #disable-tdfs-btn': (event, instance) => {
    toggleTdfPresence(instance, DISABLED);
  },

  'click #enable-tdfs-btn': (event, instance) => {
    toggleTdfPresence(instance, ENABLED);
  },

  'click #tdf-admin-info': (event, instance) => {
    const checked = event.target.checked;
    instance.showTdfAdminInfo.set(checked);
  },
});

function toggleTdfPresence(instance, mode) {
  let tdfsToChange = [];
  if (mode === DISABLED) {
    tdfsToChange = instance.tdfsToDisable.get();
  } else {
    tdfsToChange = instance.tdfsToEnable.get();
  }
  const en1 = instance.enabledTdfs.get();
  const dis1 = instance.disabledTdfs.get();


  console.log('toggleTdfPresence, mode: ', mode, tdfsToChange, en1, dis1, instance);

  Meteor.call('toggleTdfPresence', tdfsToChange, mode, () =>{
    const remainingTdfs = [];
    const tdfsToUpdate = [];
    let tdfsInOtherModeState = [];
    if (mode === DISABLED) {
      tdfsInOtherModeState = instance.enabledTdfs.get();
    } else {
      tdfsInOtherModeState = instance.disabledTdfs.get();
    }

    tdfsInOtherModeState.forEach((tdf) => {
      if (!tdfsToChange.includes(tdf._id)) {
        remainingTdfs.push(tdf);
      } else {
        tdfsToUpdate.push(tdf);
      }
    });

    let changedTdfs = [];
    if (mode === DISABLED) {
      instance.enabledTdfs.set(remainingTdfs);
      changedTdfs = instance.disabledTdfs.get();
      const newlyChangedTdfs = changedTdfs.concat(tdfsToUpdate);
      instance.disabledTdfs.set(newlyChangedTdfs);
      instance.tdfsToDisable.set([]);
    } else {
      instance.disabledTdfs.set(remainingTdfs);
      changedTdfs = instance.enabledTdfs.get();
      const newlyChangedTdfs = changedTdfs.concat(tdfsToUpdate);
      instance.enabledTdfs.set(newlyChangedTdfs);
      instance.tdfsToEnable.set([]);
    }
  });
}

// We'll use this in card.js if audio input is enabled and user has provided a
// speech API key
data = localMongo.findOne({})  || {}; data.speechAPIKey =  null; localMongo.update({},{$set:data});

Template.profile.rendered = async function() {
  sessionCleanUp();
  data = localMongo.findOne({})  || {}; data.showSpeechAPISetup =  true; localMongo.update({},{$set:data});
  const allTdfs = await meteorCallAsync('getAllTdfs');
  console.log('allTdfs', allTdfs, typeof(allTdfs));
  data = localMongo.findOne({})  || {}; data.allTdfs =  allTdfs; localMongo.update({},{$set:data});

  $('#expDataDownloadContainer').html('');

  // In experiment mode, they may be forced to a single tdf
  let experimentTarget = null;
  if (Session.get('loginMode') === 'experiment') {
    experimentTarget = Session.get('experimentTarget');
    if (experimentTarget) experimentTarget = experimentTarget.toLowerCase();
  }

  // Will be populated if we find an experimental target to jump to
  let foundExpTarget = null;
  const enabledTdfs = [];
  const disabledTdfs = [];
  const tdfOwnerIds = [];
  const isAdmin = Roles.userIsInRole(Meteor.user(), ['admin']);

  // Check all the valid TDF's
  for (const tdf of allTdfs) {
    const TDFId = tdf.TDFId;
    const tdfObject = tdf.content;
    const isMultiTdf = tdfObject.isMultiTdf;
    const currentStimuliSetId = tdf.stimuliSetId;

    // Make sure we have a valid TDF (with a setspec)
    const setspec = tdfObject.tdfs.tutor.setspec ? tdfObject.tdfs.tutor.setspec : null;

    if (!setspec) {
      console.log('Invalid TDF - it will never work', tdfObject);
      continue;
    }

    const name = setspec.lessonname;
    const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
        setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
    const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
        setspec.speechOutOfGrammarFeedback : 'Response not in answer set';

    // Check to see if we have found a selected experiment target
    if (experimentTarget && !foundExpTarget) {
      const tdfExperimentTarget = _.trim(setspec.experimentTarget).toLowerCase();
      if (tdfExperimentTarget && experimentTarget == tdfExperimentTarget) {
        foundExpTarget = {
          tdfid: TDFId,
          lessonName: name,
          currentStimuliSetId: currentStimuliSetId,
          ignoreOutOfGrammarResponses: ignoreOutOfGrammarResponses,
          speechOutOfGrammarFeedback: speechOutOfGrammarFeedback,
          how: 'Auto-selected by experiment target ' + experimentTarget,
          isMultiTdf: isMultiTdf,
        };
      }
    }

    // Show data download - note that this happens regardless of userselect
    if (Meteor.userId() === tdf.ownerId || isAdmin) {
      let disp = name;
      if (tdfObject.fileName != name) {
        disp += ' (' + tdfObject.fileName + ')';
      }

      $('#expDataDownloadContainer').append(
          $('<div></div>').append(
              $('<a class=\'exp-data-link\' target=\'_blank\'></a>')
                  .attr('href', '/experiment-data/' + tdfObject.fileName +'/datashop')
                  .text('Download: ' + disp),
          ),
      );
    }

    // Note that we defer checking for userselect in case something above
    // (e.g. experimentTarget) auto-selects the TDF
    if (setspec.userselect) {
      if (setspec.userselect == 'false') continue;
    }

    const audioInputEnabled = setspec.audioInputEnabled ? setspec.audioInputEnabled == 'true' : false;
    const enableAudioPromptAndFeedback = setspec.enableAudioPromptAndFeedback ?
        setspec.enableAudioPromptAndFeedback == 'true' : false;

    tdfObject.name = name;
    tdfObject.tdfid = TDFId;
    tdfObject.currentStimuliSetId = currentStimuliSetId;
    tdfObject.ignoreOutOfGrammarResponses = ignoreOutOfGrammarResponses;
    tdfObject.speechOutOfGrammarFeedback = speechOutOfGrammarFeedback;
    tdfObject.audioInputEnabled = audioInputEnabled;
    tdfObject.enableAudioPromptAndFeedback = enableAudioPromptAndFeedback;

    if (tdf.visibility == 'profileOnly' || tdf.visibility == 'enabled') {
      enabledTdfs.push(tdfObject);
    } else {
      disabledTdfs.push(tdfObject);
    }

    if (isAdmin) {
      if (!tdfOwnerIds.includes(tdf.ownerId)) {
        tdfOwnerIds.push(tdf.ownerId);
      }
    }

    this.disabledTdfs.set(disabledTdfs);
    this.enabledTdfs.set(enabledTdfs);
  }

  if (isAdmin) {
    const templateInstance = this;
    Meteor.call('getTdfOwnersMap', tdfOwnerIds, function(err, res) {
      if (err) {
        console.log(err);
      } else {
        templateInstance.tdfOwnersMap.set(res);
        console.log(templateInstance.tdfOwnersMap.get());
      }
    });
  }

  // Did we find something to auto-jump to?
  if (foundExpTarget) {
    selectTdf(
        foundExpTarget.tdfid,
        foundExpTarget.lessonName,
        foundExpTarget.currentStimuliSetId,
        foundExpTarget.ignoreOutOfGrammarResponses,
        foundExpTarget.speechOutOfGrammarFeedback,
        foundExpTarget.how,
        foundExpTarget.isMultiTdf,
        false,
    );
  }
};

// Actual logic for selecting and starting a TDF
// eslint-disable-next-line max-len
async function selectTdf(currentTdfId, lessonName, currentStimuliSetId, ignoreOutOfGrammarResponses, speechOutOfGrammarFeedback, how, isMultiTdf, fromSouthwest) {

  // make sure session variables are cleared from previous tests
  sessionCleanUp();

  // Set the session variables we know
  // Note that we assume the root and current TDF names are the same.
  // The resume logic in the the card template will determine if the
  // current TDF should be changed due to an experimental condition
  data = localMongo.findOne({}) || {}; data.currentRootTdfId =  currentTdfId; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.currentTdfId =  currentTdfId; localMongo.update({},{$set:data});
  const tdfResponse = await meteorCallAsync('getTdfById', currentTdfId);
  const curTdfContent = tdfResponse.content;
  data = localMongo.findOne({}) || {}; data.currentTdfFile =  curTdfContent; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.currentTdfName =  curTdfContent.fileName; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.currentStimuliSetId =  currentStimuliSetId; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.ignoreOutOfGrammarResponses =  ignoreOutOfGrammarResponses; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.speechOutOfGrammarFeedback =  speechOutOfGrammarFeedback; localMongo.update({},{$set:data});

  // Record state to restore when we return to this page
  const audioPromptMode = getAudioPromptModeFromPage();
  data = localMongo.findOne({}) || {}; data.audioPromptMode =  audioPromptMode; localMongo.update({},{$set:data});
  const audioPromptFeedbackView = audioPromptMode;
  data = localMongo.findOne({}) || {}; data.audioPromptFeedbackView =  audioPromptMode; localMongo.update({},{$set:data});
  const audioInputEnabled = getAudioInputFromPage();
  data = localMongo.findOne({}) || {}; data.audioEnabledView =  audioInputEnabled; localMongo.update({},{$set:data});
  const audioPromptFeedbackSpeakingRate = document.getElementById('audioPromptFeedbackSpeakingRate').value;
  data = localMongo.findOne({}) || {}; data.audioPromptFeedbackSpeakingRateView =  audioPromptFeedbackSpeakingRate; localMongo.update({},{$set:data});
  const audioPromptQuestionSpeakingRate = document.getElementById('audioPromptQuestionSpeakingRate').value;
  data = localMongo.findOne({}) || {}; data.audioPromptQuestionSpeakingRateView =  audioPromptQuestionSpeakingRate; localMongo.update({},{$set:data});
  const audioInputSensitivity = document.getElementById('audioInputSensitivity').value;
  data = localMongo.findOne({}) || {}; data.audioInputSensitivityView =  audioInputSensitivity; localMongo.update({},{$set:data});
  const audioPromptQuestionVolume = document.getElementById('audioPromptQuestionVolume').value;
  data = localMongo.findOne({}) || {}; data.audioPromptQuestionVolume =  audioPromptQuestionVolume; localMongo.update({},{$set:data});
  const audioPromptFeedbackVolume = document.getElementById('audioPromptFeedbackVolume').value;
  data = localMongo.findOne({}) || {}; data.audioPromptFeedbackVolume =  audioPromptFeedbackVolume; localMongo.update({},{$set:data});
  const feedbackType = await meteorCallAsync('getUserLastFeedbackTypeFromHistory', currentTdfId);
  if(feedbackType){
    data = localMongo.findOne({}) || {}; data.feedbackTypeFromHistory =  feedbackType.feedbacktype; localMongo.update({},{$set:data});
  }else{
    data = localMongo.findOne({}) || {}; data.feedbackTypeFromHistory =  null; localMongo.update({},{$set:data});
  }
  // Set values for card.js to use later, in experiment mode we'll default to the values in the tdf
  data = localMongo.findOne({}) || {}; data.audioPromptFeedbackSpeakingRate =  audioPromptFeedbackSpeakingRate; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.audioPromptQuestionSpeakingRate =  audioPromptQuestionSpeakingRate; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.audioInputSensitivity =  audioInputSensitivity; localMongo.update({},{$set:data});

  // Get some basic info about the current user's environment
  let userAgent = '[Could not read user agent string]';
  let prefLang = '[N/A]';
  try {
    userAgent = _.display(navigator.userAgent);
    prefLang = _.display(navigator.language);
  } catch (err) {
    console.log('Error getting browser info', err);
  }

  // Check to see if the user has turned on audio prompt.
  // If so and if the tdf has it enabled then turn on, otherwise we won't do anything
  const userAudioPromptFeedbackToggled = (audioPromptFeedbackView == 'feedback') || (audioPromptFeedbackView == 'all') || (audioPromptFeedbackView == 'question');
  console.log(curTdfContent);
  const tdfAudioPromptFeedbackEnabled = !!curTdfContent.tdfs.tutor.setspec.enableAudioPromptAndFeedback &&
      curTdfContent.tdfs.tutor.setspec.enableAudioPromptAndFeedback == 'true';
  const audioPromptTTSAPIKeyAvailable = !!curTdfContent.tdfs.tutor.setspec.textToSpeechAPIKey &&
      !!curTdfContent.tdfs.tutor.setspec.textToSpeechAPIKey;
  let audioPromptFeedbackEnabled = undefined;
  if (typeof localMongo.findOne({}).experimentTarget !== 'undefined') {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled;
  } else if (fromSouthwest) {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled &&
        userAudioPromptFeedbackToggled && audioPromptTTSAPIKeyAvailable;
  } else {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled;
  }
  data = localMongo.findOne({}) || {}; data.enableAudioPromptAndFeedback =  audioPromptFeedbackEnabled; localMongo.update({},{$set:data});

  // If we're in experiment mode and the tdf file defines whether audio input is enabled
  // forcibly use that, otherwise go with whatever the user set the audio input toggle to
  const userAudioToggled = audioInputEnabled;
  const tdfAudioEnabled = curTdfContent.tdfs.tutor.setspec.audioInputEnabled ?
      curTdfContent.tdfs.tutor.setspec.audioInputEnabled == 'true' : false;
  const audioEnabled = !localMongo.findOne({}).experimentTarget ? (tdfAudioEnabled && userAudioToggled) : tdfAudioEnabled;
  data = localMongo.findOne({}) || {}; data.audioEnabled =  audioEnabled; localMongo.update({},{$set:data});

  let continueToCard = true;

  if (localMongo.findOne({}).audioEnabled) {
    // Check if the tdf or user has a speech api key defined, if not show the modal form
    // for them to input one.  If so, actually continue initializing web audio
    // and going to the practice set
    Meteor.call('getUserSpeechAPIKey', function(error, key) {
      data = localMongo.findOne({}) || {}; data.speechAPIKey =  key; localMongo.update({},{$set:data});
      const tdfKeyPresent = !!curTdfContent.tdfs.tutor.setspec.speechAPIKey &&
          !!curTdfContent.tdfs.tutor.setspec.speechAPIKey;
      if (!key && !tdfKeyPresent) {
        console.log('speech api key not found, showing modal for user to input');
        $('#speechAPIModal').modal('show');
        continueToCard = false;
      } else {
        console.log('audio input enabled and key present, navigating to card and initializing audio input');
      }
    });
  } else {
    console.log('audio toggle not checked, navigating to card');
  }

  // Go directly to the card session - which will decide whether or
  // not to show instruction
  if (continueToCard) {
    const newExperimentState = {
      userAgent: userAgent,
      browserLanguage: prefLang,
      selectedHow: how,
      isMultiTdf: isMultiTdf,
      currentTdfId,
      currentTdfName: curTdfContent.fileName,
      currentStimuliSetId: currentStimuliSetId,
    };
    updateExperimentStateSync(newExperimentState, 'profile.selectTdf');

    data = localMongo.findOne({}) || {}; data.inResume =  true; localMongo.update({},{$set:data});
    if (isMultiTdf) {
      navigateForMultiTdf();
    } else {
      Router.go('/card');
    }
  }
}

async function navigateForMultiTdf() {
  function getUnitType(curUnit) {
    let unitType = 'other';
    if (curUnit.assessmentsession) {
      unitType = SCHEDULE_UNIT;
    } else if (curUnit.learningsession) {
      unitType = MODEL_UNIT;
    }
    return unitType;
  }

  const experimentState = await getExperimentState();
  const lastUnitCompleted = experimentState.lastUnitCompleted || -1;
  const lastUnitStarted = experimentState.lastUnitStarted || -1;
  let unitLocked = false;

  // If we haven't finished the unit yet, we may want to lock into the current unit
  // so the user can't mess up the data
  if (lastUnitStarted > lastUnitCompleted) {
    const curUnit = experimentState.currentTdfUnit; // Session.get("currentTdfUnit");
    const curUnitType = getUnitType(curUnit);
    // We always want to lock users in to an assessment session
    if (curUnitType === SCHEDULE_UNIT) {
      unitLocked = true;
    } else if (curUnitType === MODEL_UNIT) {
      if (!!curUnit.displayMinSeconds || !!curUnit.displayMaxSeconds) {
        unitLocked = true;
      }
    }
  }
  // Only show selection if we're in a unit where it doesn't matter (infinite learning sessions)
  if (unitLocked) {
    Router.go('/card');
  } else {
    Router.go('/multiTdfSelect');
  }
}