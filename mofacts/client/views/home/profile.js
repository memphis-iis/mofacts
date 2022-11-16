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
  this.filteredTdfs = new ReactiveVar(false);
  this.disabledTdfs = new ReactiveVar([]);
  this.tdfsToDisable = new ReactiveVar([]);
  this.tdfsToEnable = new ReactiveVar([]);
  this.showTdfAdminInfo = new ReactiveVar([]);
  this.tdfOwnersMap = new ReactiveVar({});
  this.tdfTags = new ReactiveVar([]);
};

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

  class: function(){
    thisClass = Meteor.user().profile.class;
    console.log('class: ', thisClass);
    if(thisClass.courseName){
      return thisClass;
    } else {
      return false;
    }
  },

  simulationChecked: function() {
    return Session.get('runSimulation');
  },

  showTdfs: () => {
    return Template.instance().showTdfs.get();
  },

  enabledTdfs: () => {
    //if filteredTdfs is false, return enabledTdfs, else return filteredTdfs
    const filteredTdfs = Template.instance().filteredTdfs.get();
    if (filteredTdfs) {
      return filteredTdfs;
    }
    return Template.instance().enabledTdfs.get();
  },

  tdfTags: () => {
    return Template.instance().tdfTags.get();
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
    Session.set('runSimulation', checked);
    console.log('runSimulation', Session.get('runSimulation'));
  },

  'click #mechTurkButton': function(event) {
    event.preventDefault();
    Router.go('/turkWorkflow');
  },

  'click #contentUploadButton': function(event) {
    event.preventDefault();
    Router.go('/contentUpload');
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
  //if practiceTDFSearch is changed, filter enabled tdfs reactive var and set filteredtdfs reactive var to the filtered list
  'keyup #practiceTDFSearch': function(event, instance) {
    const search = event.target.value;
    const enabledTdfs = instance.enabledTdfs.get();
    //filter tdf based off of tdf.tdfs.setspec.tags array
    const filteredTdfs = enabledTdfs.filter((tdf) => {
      //check if tdf.tdfs.setspec.tags array exists and is not empty
      //print tdf.tdfs
      if (tdf.tdfs.tutor.setspec.tags && tdf.tdfs.tutor.setspec.tags.length > 0) {
        //check if search string is in any of the tags
        return tdf.tdfs.tutor.setspec.tags.some((tag) => tag.includes(search));
      } else {
        return false;
      }
    });
    //if search is empty, set filteredtdfs to false
    if (search === '') {
      instance.filteredTdfs.set(false);
    } else {
      instance.filteredTdfs.set(filteredTdfs);
    }
  },
  //if tdf-tag-search is clicked, change #practiceTDFSearch input value to the value of the tag
  'click .tdf-tag': function(event) {
    const search = $(event.target).attr('data-tag');
    $('#practiceTDFSearch').val(search);
    $('#practiceTDFSearch').trigger('keyup');
  }
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
Session.set('speechAPIKey', null);

Template.profile.rendered = async function() {
  sessionCleanUp();
  Session.set('showSpeechAPISetup', true);
  let allTdfs;
  if(Meteor.user().profile.loginMode === 'southwest') {
    const curSectionId = Meteor.user().profile.curClass.sectionId;
    allTdfs = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), curSectionId);
  } else {
    allTdfs = await meteorCallAsync('getAllTdfs');
  }
  console.log('allTdfs', allTdfs, typeof(allTdfs));
  Session.set('allTdfs', allTdfs);

  $('#expDataDownloadContainer').html('');

  // In experiment mode, they may be forced to a single tdf
  let experimentTarget = null;

  // Will be populated if we find an experimental target to jump to
  let foundExpTarget = null;
  const enabledTdfs = [];
  const tdfTags = [];
  const disabledTdfs = [];
  const tdfOwnerIds = [];
  const isAdmin = Roles.userIsInRole(Meteor.user(), ['admin']);

  //Get all course tdfs
  const courseId = Meteor.user().profile.curClass ? Meteor.user().profile.curClass.courseId : null;
  const courseTdfs = await meteorCallAsync('getTdfsAssignedToCourseId', courseId);
  console.log('courseTdfs', courseTdfs, courseId);

  // Check all the valid TDF's
  for (const tdf of allTdfs) {
    const TDFId = tdf._id;
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

    //Get Class TDFS
    
    tdfIsAssigned = courseTdfs.filter(e => e.TDFId === TDFId);
    console.log("courseTdfs", courseTdfs);
    console.log("tdfIsAssigned", tdfIsAssigned);
    if(courseTdfs.length > 0){
      if(tdfIsAssigned.length > 0) {
        tdfObject.isAssigned = true;
      } else {
        tdfObject.isAssigned = false;
      }
    } else {
      tdfObject.isAssigned = true;
    }
    
    //Get exceptions
    // const exception = await meteorCallAsync('checkForUserException', Meteor.userId(), TDFId);
    var exceptionDate = false;
    //if (exception) {
    //   var exceptionRaw = new Date(exception);
    //  var exceptionDate = exceptionRaw.getTime();
    //  tdfObject.exceptionDate = exceptionDate;
    // }
    // const curDate = new Date().getTime();
    tdfObject.dueDate = setspec.duedate ? setspec.duedate : false;
    // tdfObject.exceptionDate = exceptionDate || false;

    tdfObject.isOverDue = false;
    //if(tdfObject.dueDate) {
    //  console.log("dueDate", tdfObject.dueDate, curDate, exceptionDate);
    //  if(tdfObject.dueDate < curDate) {
    //   tdfObject.isOverDue = true;
    //  } 
    // } 
    // if(!tdfObject.isOverDue && exceptionDate){
    //  if(exceptionDate < curDate) {
    //    tdfObject.isOverDue = true;
    //  }
    // }

    //check if the tdf.setspec.tags array exists, if so, add it to tdfTags  var for filtering as object {tag: tag, count: count}
    if (setspec.tags) {
      for (const tag of setspec.tags) {
        const tagIndex = tdfTags.findIndex((e) => e.tag === tag);
        if (tagIndex > -1) {
          tdfTags[tagIndex].count++;
        } else {
          tdfTags.push({tag: tag, count: 1});
        }
      }
    }
    //sort tdfTags by natural alphabetical order
    tdfTags.sort((a, b) => a.tag.localeCompare(b.tag, 'en', {numeric: true, sensitivity: 'base'}));
    this.tdfTags.set(tdfTags);


    if ((tdf.visibility == 'profileOnly' || tdf.visibility == 'enabled') && tdfObject.isAssigned) {
      enabledTdfs.push(tdfObject);
    } else {
      disabledTdfs.push(tdfObject);
    }

    if (isAdmin) {
      if (!tdfOwnerIds.includes(tdf.ownerId)) {
        tdfOwnerIds.push(tdf.ownerId);
      }
    }

    if(enabledTdfs){
      enabledTdfs.sort((a, b) => a.name.localeCompare(b.name, 'en', {numeric: true, sensitivity: 'base'}));
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
async function selectTdf(currentTdfId, lessonName, currentStimuliSetId, ignoreOutOfGrammarResponses, 
  speechOutOfGrammarFeedback, how, isMultiTdf, fromSouthwest, setspec, isExperiment = false) {
  console.log('Starting Lesson', lessonName, currentTdfId,
      'currentStimuliSetId:', currentStimuliSetId, 'isMultiTdf:', isMultiTdf);

  const audioPromptFeedbackView = Session.get('audioPromptFeedbackView');

  // make sure session variables are cleared from previous tests
  sessionCleanUp();

  // Set the session variables we know
  // Note that we assume the root and current TDF names are the same.
  // The resume logic in the the card template will determine if the
  // current TDF should be changed due to an experimental condition
  Session.set('currentRootTdfId', currentTdfId);
  Session.set('currentTdfId', currentTdfId);
  const tdfResponse = await meteorCallAsync('getTdfById', currentTdfId);
  const curTdfContent = tdfResponse.content;
  const curTdfTips = tdfResponse.content.tdfs.tutor.setspec.tips;
  Session.set('currentTdfFile', curTdfContent);
  Session.set('currentTdfName', curTdfContent.fileName);
  Session.set('currentStimuliSetId', currentStimuliSetId);
  Session.set('ignoreOutOfGrammarResponses', ignoreOutOfGrammarResponses);
  Session.set('speechOutOfGrammarFeedback', speechOutOfGrammarFeedback);
  Session.set('curTdfTips', curTdfTips)

  // Record state to restore when we return to this page
  let audioPromptMode;
  let audioInputEnabled;
  let audioPromptFeedbackSpeakingRate;
  let audioPromptQuestionSpeakingRate;
  let audioPromptVoice;
  let audioInputSensitivity;
  let audioPromptQuestionVolume
  let audioPromptFeedbackVolume
  let feedbackType
  let audioPromptFeedbackVoice
  if(isExperiment) {
    audioPromptMode = setspec.audioPromptMode || 'silent';
    audioInputEnabled = setspec.audioInputEnabled || false;
    audioPromptFeedbackSpeakingRate = setspec.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = setspec.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = setspec.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = setspec.audioInputSensitivity || 20;
    audioPromptQuestionVolume = setspec.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = setspec.audioPromptFeedbackVolume || 0;
    feedbackType = setspec.feedbackType;
    audioPromptFeedbackVoice = setspec.audioPromptFeedbackVoice || 'en-US-Standard-A';
  }
  else {
    audioPromptMode = getAudioPromptModeFromPage();
    audioInputEnabled = getAudioInputFromPage();
    audioPromptFeedbackSpeakingRate = document.getElementById('audioPromptFeedbackSpeakingRate').value;
    audioPromptQuestionSpeakingRate = document.getElementById('audioPromptQuestionSpeakingRate').value;
    audioPromptVoice = document.getElementById('audioPromptVoice').value;
    audioInputSensitivity = document.getElementById('audioInputSensitivity').value;
    audioPromptQuestionVolume = document.getElementById('audioPromptQuestionVolume').value;
    audioPromptFeedbackVolume = document.getElementById('audioPromptFeedbackVolume').value;
    feedbackType = await meteorCallAsync('getUserLastFeedbackTypeFromHistory', currentTdfId);
    audioPromptFeedbackVoice = document.getElementById('audioPromptFeedbackVoice').value;
    if(feedbackType)
      Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype)
    else
      Session.set('feedbackTypeFromHistory', null);
  }
  Session.set('audioPromptMode', audioPromptMode);
  Session.set('audioPromptFeedbackView', audioPromptMode);
  Session.set('audioEnabledView', audioInputEnabled);
  Session.set('audioPromptFeedbackSpeakingRateView', audioPromptFeedbackSpeakingRate);
  Session.set('audioPromptQuestionSpeakingRateView', audioPromptQuestionSpeakingRate);
  Session.set('audioPromptVoiceView', audioPromptVoice)
  Session.set('audioInputSensitivityView', audioInputSensitivity);
  Session.set('audioPromptQuestionVolume', audioPromptQuestionVolume);
  Session.set('audioPromptFeedbackVolume', audioPromptFeedbackVolume);
  Session.set('audioPromptFeedbackVoiceView', audioPromptFeedbackVoice)
  if(feedbackType)
    Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype)
  else
    Session.set('feedbackTypeFromHistory', null);

  // Set values for card.js to use later, in experiment mode we'll default to the values in the tdf
  Session.set('audioPromptFeedbackSpeakingRate', audioPromptFeedbackSpeakingRate);
  Session.set('audioPromptQuestionSpeakingRate', audioPromptQuestionSpeakingRate);
  Session.set('audioPromptVoice', audioPromptVoice);
  Session.set('audioPromptFeedbackVoice', audioPromptFeedbackVoice);
  Session.set('audioInputSensitivity', audioInputSensitivity);

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
  if (Session.get('experimentTarget')) {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled;
  } else if (fromSouthwest) {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled &&
        userAudioPromptFeedbackToggled && audioPromptTTSAPIKeyAvailable;
  } else {
    audioPromptFeedbackEnabled = tdfAudioPromptFeedbackEnabled && userAudioPromptFeedbackToggled;
  }
  Session.set('enableAudioPromptAndFeedback', audioPromptFeedbackEnabled);

  // If we're in experiment mode and the tdf file defines whether audio input is enabled
  // forcibly use that, otherwise go with whatever the user set the audio input toggle to
  const userAudioToggled = audioInputEnabled;
  const tdfAudioEnabled = curTdfContent.tdfs.tutor.setspec.audioInputEnabled ?
      curTdfContent.tdfs.tutor.setspec.audioInputEnabled == 'true' : false;
  const audioEnabled = !Session.get('experimentTarget') ? (tdfAudioEnabled && userAudioToggled) : tdfAudioEnabled;
  Session.set('audioEnabled', audioEnabled);

  let continueToCard = true;

  if (Session.get('audioEnabled')) {
    // Check if the tdf or user has a speech api key defined, if not show the modal form
    // for them to input one.  If so, actually continue initializing web audio
    // and going to the practice set
    Meteor.call('getUserSpeechAPIKey', function(error, key) {
      Session.set('speechAPIKey', key);
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

    Session.set('inResume', true);
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
