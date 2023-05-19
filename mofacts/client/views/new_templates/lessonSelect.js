import {ReactiveVar} from 'meteor/reactive-var';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {getExperimentState, updateExperimentState} from '../experiment/card';
import {DISABLED, ENABLED, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {routeToSignin} from '../../lib/router';
import {checkUserSession} from '../../index'

export {selectTdf};


Template.lessonSelect.created = function() {
    this.showTdfs = new ReactiveVar(false);
    this.enabledTdfs = new ReactiveVar([]);
    this.recentTdfs = new ReactiveVar([]);
    this.filteredTdfs = new ReactiveVar(false);
    this.disabledTdfs = new ReactiveVar([]);
    this.tdfsToDisable = new ReactiveVar([]);
    this.tdfsToEnable = new ReactiveVar([]);
    this.showTdfAdminInfo = new ReactiveVar([]);
    this.tdfOwnersMap = new ReactiveVar({});
    this.tdfTags = new ReactiveVar([]);
    this.searching = new ReactiveVar(false);
  };

Template.lessonSelect.events({
  'keyup #practiceTDFSearch': function(event, instance) {
    const search = event.target.value;
    if(search.length > 0){
      instance.searching.set(true);
    } else {
      instance.searching.set(false);
    }
    const enabledTdfs = instance.enabledTdfs.get();
    filteredTdfs = enabledTdfs.filter((tdf) => {
      return tdf.tdfs.tutor.setspec.lessonname.toLowerCase().includes(search.toLowerCase());
    });
    //also search tags
    filteredTdfs = filteredTdfs.concat(enabledTdfs.filter((tdf) => {
      //these are arrays, so we need to check if any of the tags match the search, note that the field may be undefined
      return tdf.tdfs.tutor.setspec.tags && tdf.tdfs.tutor.setspec.tags.some((tag) => {
        return tag.toLowerCase().includes(search.toLowerCase());
      });
    }));
    instance.filteredTdfs.set(filteredTdfs);
  },
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
});
Template.lessonSelect.helpers({
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
      console.log('enabledTdfs', Template.instance().enabledTdfs.get());
      return Template.instance().enabledTdfs.get();
    },
    recentTdfs: () => {
      return Template.instance().recentTdfs.get();
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
    searching: () => {
      return Template.instance().searching.get();
    }
  });

  Template.lessonSelect.rendered = async function() {
    sessionCleanUp();
    await checkUserSession()
    Session.set('showSpeechAPISetup', true);
    let allTdfs = Tdfs.find().fetch();
  
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
    const courseTdfs = Assignments.find({courseId: courseId}).fetch()
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
      //get all recent tdfs for user
      const recentTdfs = await meteorCallAsync('getUserRecentTDFs', Meteor.userId());
      
      //match them with enabled tdfs where recentTdfs._id = enabledTdfs.tdfid
      const enabledRecentTdfs = [];
      recentTdfs.forEach((recentTdf) => {
        enabledTdfs.forEach((enabledTdf) => {
          if (recentTdf._id === enabledTdf.tdfid) {
            //if match and enabledRecentTdfs does not already contain the tdf, add it
            if (!enabledRecentTdfs.includes(enabledTdf)) {
              enabledRecentTdfs.push(enabledTdf);
            }
          }
        });
      });
      this.recentTdfs.set(enabledRecentTdfs);
      console.log('recentTdfs', enabledRecentTdfs);
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
    const tdfResponse = Tdfs.findOne({_id: currentTdfId});
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
      updateExperimentState(newExperimentState, 'profile.selectTdf');
  
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
  