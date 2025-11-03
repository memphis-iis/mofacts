import {Roles} from 'meteor/alanning:roles';
import {ReactiveVar} from 'meteor/reactive-var';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {getExperimentState, updateExperimentState} from '../experiment/card';
import {DISABLED, ENABLED, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {meteorCallAsync} from '../..';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {routeToSignin} from '../../lib/router';
import {checkUserSession} from '../../index';

export {selectTdf};

Template.learningDashboard.created = function() {
  this.allTdfsList = new ReactiveVar([]);
  this.filteredTdfsList = new ReactiveVar(false);
  this.searching = new ReactiveVar(false);
  this.isLoading = new ReactiveVar(true);
};

Template.learningDashboard.helpers({
  isLoading: () => {
    return Template.instance().isLoading.get();
  },

  audioWarmupInProgress: () => {
    return Session.get('audioWarmupInProgress');
  },

  hasTdfs: () => {
    const allTdfs = Template.instance().allTdfsList.get();
    const filtered = Template.instance().filteredTdfsList.get();
    const list = filtered || allTdfs;
    return list && list.length > 0;
  },

  allTdfsList: () => {
    const filtered = Template.instance().filteredTdfsList.get();
    if (filtered) {
      return filtered;
    }
    return Template.instance().allTdfsList.get();
  },
});

Template.learningDashboard.events({
  'keyup #learningDashboardSearch': function(event, instance) {
    const search = event.target.value;
    if (search.length > 0) {
      instance.searching.set(true);
    } else {
      instance.searching.set(false);
      instance.filteredTdfsList.set(false);
      return;
    }

    const allTdfs = instance.allTdfsList.get();
    let filteredTdfs = allTdfs.filter((tdf) => {
      return tdf.displayName.toLowerCase().includes(search.toLowerCase());
    });

    // Also search tags
    const tagFiltered = allTdfs.filter((tdf) => {
      return tdf.tags && tdf.tags.some((tag) => {
        return tag.toLowerCase().includes(search.toLowerCase());
      });
    });

    // Merge and deduplicate
    filteredTdfs = [...new Set([...filteredTdfs, ...tagFiltered])];

    instance.filteredTdfsList.set(filteredTdfs);
  },

  'click .continue-lesson': async function(event) {
    event.preventDefault();
    const target = $(event.currentTarget);
    const tdfId = target.data('tdfid');
    const lessonName = target.data('lessonname');

    // Get TDF info from Tdfs collection
    const tdf = Tdfs.findOne({_id: tdfId});
    if (tdf) {
      const setspec = tdf.content.tdfs.tutor.setspec;
      await selectTdf(
        tdfId,
        lessonName,
        tdf.stimuliSetId,
        setspec.speechIgnoreOutOfGrammarResponses === 'true',
        setspec.speechOutOfGrammarFeedback || 'Response not in answer set',
        'Continue from Learning Dashboard',
        tdf.content.isMultiTdf,
        false,
      );
    }
  },

  'click .start-lesson': async function(event) {
    event.preventDefault();
    const target = $(event.currentTarget);
    await selectTdf(
      target.data('tdfid'),
      target.data('lessonname'),
      target.data('currentstimulisetid'),
      target.data('ignoreoutofgrammarresponses'),
      target.data('speechoutofgrammarfeedback'),
      'Start from Learning Dashboard',
      target.data('ismultitdf'),
      false,
    );
  },
});

Template.learningDashboard.rendered = async function() {
  // sessionCleanUp() removed - it's already called in selectTdf() at the right time
  // Calling it here causes problems because rendered() can fire multiple times
  // due to reactivity, clearing session variables while card.js is using them
  await checkUserSession();
  Session.set('showSpeechAPISetup', true);

  const studentID = Session.get('curStudentID') || Meteor.userId();

  // Get all TDFs the user can access
  let allTdfs = Tdfs.find().fetch();
  Session.set('allTdfs', allTdfs);

  // Get list of attempted TDF IDs
  const tdfsAttempted = await meteorCallAsync('getTdfIDsAndDisplaysAttemptedByUserId', studentID);
  const attemptedTdfIds = new Set(tdfsAttempted.map(t => t.TDFId));

  // Fetch all stats in parallel for performance (don't wait for each one sequentially)
  const statsPromises = tdfsAttempted.map(async (tdf) => {
    const stats = await meteorCallAsync('getSimpleTdfStats', studentID, tdf.TDFId);
    return {TDFId: tdf.TDFId, stats};
  });
  const statsResults = await Promise.all(statsPromises);

  // Build a map of TDFId -> stats for fast lookup
  const statsMap = new Map();
  for (const result of statsResults) {
    if (result.stats && result.stats.totalTrials > 0) {
      statsMap.set(result.TDFId, result.stats);
    }
  }

  // Process all TDFs to build used/unused lists
  const isAdmin = (Meteor.user() && Meteor.user().roles && (['admin']).some(role => Meteor.user().roles.includes(role)));
  const courseId = Meteor.user().loginParams.curClass ? Meteor.user().loginParams.curClass.courseId : null;
  const courseTdfs = Assignments.find({courseId: courseId}).fetch();

  // Filter by section if curClass is set
  if (Session.get('curClass') && Session.get('curClass').sectionId) {
    const sectionId = Session.get('curClass').sectionId;
    const sectionTdfs = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), sectionId);
    allTdfs = allTdfs.filter((tdf) => {
      return sectionTdfs.includes(tdf._id);
    });
  }

  const allTdfObjects = [];

  // FIRST PASS: Extract audio features from TDF and create base objects
  for (const tdf of allTdfs) {
    const TDFId = tdf._id;
    const tdfObject = tdf.content;
    const isMultiTdf = tdfObject.isMultiTdf;
    const currentStimuliSetId = tdf.stimuliSetId;

    // Make sure we have a valid TDF (with a setspec)
    const setspec = tdfObject.tdfs.tutor.setspec ? tdfObject.tdfs.tutor.setspec : null;

    if (!setspec) {
      continue;
    }

    const name = setspec.lessonname;
    const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
      setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
    const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
      setspec.speechOutOfGrammarFeedback : 'Response not in answer set';

    // Extract audio features from TDF setspec
    const audioInputEnabled = setspec.audioInputEnabled ? setspec.audioInputEnabled == 'true' : false;
    const enableAudioPromptAndFeedback = setspec.enableAudioPromptAndFeedback ?
      setspec.enableAudioPromptAndFeedback == 'true' : false;

    // Debug: Log what we're extracting
    if (audioInputEnabled || enableAudioPromptAndFeedback) {
      console.log(`[Dashboard] TDF: ${name}`);
      console.log(`  - setspec.audioInputEnabled: "${setspec.audioInputEnabled}"`);
      console.log(`  - audioInputEnabled (parsed): ${audioInputEnabled}`);
      console.log(`  - setspec.enableAudioPromptAndFeedback: "${setspec.enableAudioPromptAndFeedback}"`);
      console.log(`  - enableAudioPromptAndFeedback (parsed): ${enableAudioPromptAndFeedback}`);
      console.log(`  - hasBeenAttempted: ${attemptedTdfIds.has(TDFId)}`);
    }

    // Check if this TDF is assigned to the user
    const tdfIsAssigned = courseTdfs.filter(e => e.TDFId === TDFId);
    const isAssigned = courseTdfs.length > 0 ? tdfIsAssigned.length > 0 : true;

    // Show TDF ONLY if userselect is explicitly 'true'
    const shouldShow = (setspec.userselect === 'true');

    // Check if this TDF has been attempted
    const hasBeenAttempted = attemptedTdfIds.has(TDFId);

    if (shouldShow && (tdf.visibility == 'profileOnly' || tdf.visibility == 'enabled') && isAssigned) {
      // Build base object with TDF properties (features from TDF)
      const tdfData = {
        TDFId: TDFId,
        displayName: name,
        currentStimuliSetId: currentStimuliSetId,
        ignoreOutOfGrammarResponses: ignoreOutOfGrammarResponses,
        speechOutOfGrammarFeedback: speechOutOfGrammarFeedback,
        audioInputEnabled: audioInputEnabled,
        enableAudioPromptAndFeedback: enableAudioPromptAndFeedback,
        isMultiTdf: isMultiTdf,
        tags: setspec.tags || [],
        isUsed: false,  // Default to false, will update in second pass if practiced
        hasBeenAttempted: hasBeenAttempted
      };

      allTdfObjects.push(tdfData);
    }
  }

  // SECOND PASS: Add stats to practiced lessons (lookup from map - already fetched in parallel)
  for (const tdfData of allTdfObjects) {
    const stats = statsMap.get(tdfData.TDFId);
    if (stats) {
      // Add stats properties directly to existing object
      tdfData.totalTrials = stats.totalTrials;
      tdfData.overallAccuracy = stats.overallAccuracy;
      tdfData.last10Accuracy = stats.last10Accuracy;
      tdfData.totalTimeMinutes = stats.totalTimeMinutes;
      tdfData.itemsPracticed = stats.itemsPracticed;
      tdfData.lastPracticeDate = stats.lastPracticeDate;
      tdfData.totalSessions = stats.totalSessions;
      tdfData.isUsed = true;

      if (tdfData.audioInputEnabled || tdfData.enableAudioPromptAndFeedback) {
        console.log(`[Dashboard] After adding stats for ${tdfData.displayName}:`, {
          audioInputEnabled: tdfData.audioInputEnabled,
          enableAudioPromptAndFeedback: tdfData.enableAudioPromptAndFeedback,
          isUsed: tdfData.isUsed
        });
      }
    }
  }

  // Separate into used and unused for sorting
  const usedTdfs = allTdfObjects.filter(t => t.isUsed);
  const unusedTdfs = allTdfObjects.filter(t => !t.isUsed);

  // Sort used TDFs by lastPracticeDate (most recent first)
  usedTdfs.sort((a, b) => {
    const dateA = new Date(a.lastPracticeDate || 0);
    const dateB = new Date(b.lastPracticeDate || 0);
    return dateB - dateA;
  });

  // Sort unused TDFs alphabetically by name
  unusedTdfs.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en', {numeric: true, sensitivity: 'base'}));

  // Combine: used first (sorted by recent), then unused (sorted alphabetically)
  const combinedTdfs = [...usedTdfs, ...unusedTdfs];

  this.allTdfsList.set(combinedTdfs);
  this.isLoading.set(false);

  // Ensure body styles from offcanvas are cleared before fade-in
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';

  // Trigger fade-in with stable layout (page-container prevents reflow)
  const container = document.getElementById('learningDashboardContainer');
  if (container) {
    container.classList.remove('page-loading');
    container.classList.add('page-loaded');
  }
};

// Helper function to check if audio input mode is enabled
function checkAudioInputMode() {
  // SR should only be enabled if BOTH user has it toggled on AND TDF supports it
  const userAudioToggled = Meteor.user()?.audioInputMode || false;
  const tdfAudioEnabled = Session.get('currentTdfFile')?.tdfs?.tutor?.setspec?.audioInputEnabled === 'true';
  return userAudioToggled && tdfAudioEnabled;
}

// Scenario 2: Warmup audio if TDF has embedded keys (before navigating to card)
async function checkAndWarmupAudioIfNeeded() {
  const currentTdfFile = Session.get('currentTdfFile');
  if (!currentTdfFile) {
    console.log('[Audio] No currentTdfFile, skipping Scenario 2 warmup');
    return;
  }

  const user = Meteor.user();
  if (!user) {
    console.log('[Audio] No user, skipping Scenario 2 warmup');
    return;
  }

  console.log('[Audio] Checking Scenario 2 warmup needs...');
  const promises = [];

  // Check TTS warmup (Scenario 2: TDF has embedded key)
  if (currentTdfFile.tdfs?.tutor?.setspec?.textToSpeechAPIKey) {
    const audioPromptMode = user.audioSettings?.audioPromptMode;
    if (audioPromptMode && audioPromptMode !== 'silent' && !Session.get('ttsWarmedUp')) {
      console.log('[TTS] TDF has embedded key, warming up before first trial (Scenario 2)');

      // Set flag immediately to prevent duplicate warmups
      Session.set('ttsWarmedUp', true);

      // Make async warmup call
      const startTime = performance.now();
      const ttsPromise = Meteor.callAsync('makeGoogleTTSApiCall',
        Session.get('currentTdfId'),
        'warmup',
        1.0,
        0.0,
        'en-US-Standard-A'  // voice parameter
      ).then(result => {
        const duration = performance.now() - startTime;
        console.log(`[TTS] ✅ Warmup complete in ${duration.toFixed(0)}ms`);
        return result;
      }).catch(error => {
        console.log('[TTS] Warmup failed:', error);
        // Don't re-throw - let Promise.allSettled handle it
        throw error;
      });
      promises.push(ttsPromise);
    }
  }

  // Check SR warmup (Scenario 2: TDF has embedded key)
  if (currentTdfFile.tdfs?.tutor?.setspec?.speechAPIKey) {
    if (checkAudioInputMode() && !Session.get('srWarmedUp')) {
      console.log('[SR] TDF has embedded key, warming up before first trial (Scenario 2)');

      // Set flag immediately to prevent duplicate warmups
      Session.set('srWarmedUp', true);

      // Create minimal silent audio data (LINEAR16 format, 16kHz, 100ms of silence)
      const silentAudioBytes = new Uint8Array(3200).fill(0);
      const base64Audio = btoa(String.fromCharCode.apply(null, silentAudioBytes));

      // Build minimal request matching production format
      const request = {
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode: 'en-US',
          maxAlternatives: 1,
          profanityFilter: false,
          enableAutomaticPunctuation: false,
          model: 'command_and_search',
          useEnhanced: true,
          speechContexts: [{
            phrases: ['warmup'],
            boost: 5
          }]
        },
        audio: {
          content: base64Audio
        }
      };

      // Make async warmup call
      const startTime = performance.now();
      const srPromise = Meteor.callAsync('makeGoogleSpeechAPICall',
        Session.get('currentTdfId'),
        '', // Empty key - server will fetch TDF or user key
        request,
        ['warmup'] // Minimal answer grammar
      ).then(result => {
        const duration = performance.now() - startTime;
        console.log(`[SR] ✅ Warmup complete in ${duration.toFixed(0)}ms`);
        return result;
      }).catch(error => {
        console.log('[SR] Warmup failed:', error);
        Session.set('srWarmedUp', false); // Allow retry on failure
        throw error;
      });
      promises.push(srPromise);

      // Also initialize the audio recorder in parallel with SR warmup
      // This saves ~2 seconds on trial 1 load
      const recorderPromise = new Promise(async (resolve, reject) => {
        try {
          console.log('[SR] Initializing audio recorder during warmup...');
          const startTime = performance.now();

          // Create AudioContext if not already created
          if (!window.audioRecorderContext) {
            window.AudioContext = window.webkitAudioContext || window.AudioContext;
            const audioContextConfig = {sampleRate: 16000};
            window.audioRecorderContext = new AudioContext(audioContextConfig);
          }

          // Initialize media devices polyfill
          if (navigator.mediaDevices === undefined) {
            navigator.mediaDevices = {};
          }
          if (navigator.mediaDevices.getUserMedia === undefined) {
            navigator.mediaDevices.getUserMedia = function(constraints) {
              const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia ||
                navigator.msGetUserMedia || navigator.getUserMedia;
              if (!getUserMedia) {
                return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
              }
              return new Promise(function(resolve, reject) {
                getUserMedia.call(navigator, constraints, resolve, reject);
              });
            };
          }

          // Request microphone access
          const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});

          // Store stream globally for card.js to use
          window.preInitializedAudioStream = stream;
          Session.set('audioRecorderInitialized', true);

          const duration = performance.now() - startTime;
          console.log(`[SR] ✅ Audio recorder initialized in ${duration.toFixed(0)}ms`);
          resolve(stream);
        } catch (error) {
          console.log('[SR] Audio recorder initialization failed:', error);
          Session.set('audioRecorderInitialized', false);
          reject(error);
        }
      });
      promises.push(recorderPromise);
    }
  }

  // Wait for all warmups to complete (or fail)
  if (promises.length > 0) {
    console.log(`[Audio] Starting Scenario 2 warmup with ${promises.length} API(s), showing spinner...`);
    Session.set('audioWarmupInProgress', true);
    try {
      // Use allSettled to wait for ALL promises to complete, even if some fail
      const results = await Promise.allSettled(promises);

      // Log results
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      console.log(`[Audio] Scenario 2 warmup complete: ${succeeded} succeeded, ${failed} failed`);

      if (failed > 0) {
        console.log('[Audio] Some warmups failed, but continuing to card page');
      }
    } catch (err) {
      // This should never happen with allSettled, but just in case
      console.log('[Audio] Unexpected warmup error:', err);
    } finally {
      Session.set('audioWarmupInProgress', false);
    }
  } else {
    console.log('[Audio] No warmup needed');
  }
}

// Actual logic for selecting and starting a TDF
async function selectTdf(currentTdfId, lessonName, currentStimuliSetId, ignoreOutOfGrammarResponses,
  speechOutOfGrammarFeedback, how, isMultiTdf, fromSouthwest, setspec, isExperiment = false) {

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
  Session.set('curTdfTips', curTdfTips);

  // Record state to restore when we return to this page
  let audioPromptMode;
  let audioInputEnabled;
  let audioPromptFeedbackSpeakingRate;
  let audioPromptQuestionSpeakingRate;
  let audioPromptVoice;
  let audioInputSensitivity;
  let audioPromptQuestionVolume;
  let audioPromptFeedbackVolume;
  let feedbackType;
  let audioPromptFeedbackVoice;

  if (isExperiment) {
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
  } else {
    const user = Meteor.user();

    // Load from user's audioSettings if available, otherwise use defaults
    const audioSettings = user?.audioSettings || {};
    console.log('[Dashboard] audioSettings:', audioSettings);
    audioPromptMode = audioSettings.audioPromptMode || 'silent';
    audioInputEnabled = audioSettings.audioInputMode || false;
    console.log('[Dashboard] audioPromptMode:', audioPromptMode, 'audioInputEnabled:', audioInputEnabled);
    audioPromptFeedbackSpeakingRate = audioSettings.audioPromptFeedbackSpeakingRate || 1;
    audioPromptQuestionSpeakingRate = audioSettings.audioPromptQuestionSpeakingRate || 1;
    audioPromptVoice = audioSettings.audioPromptVoice || 'en-US-Standard-A';
    audioInputSensitivity = audioSettings.audioInputSensitivity || 60;
    audioPromptQuestionVolume = audioSettings.audioPromptQuestionVolume || 0;
    audioPromptFeedbackVolume = audioSettings.audioPromptFeedbackVolume || 0;
    audioPromptFeedbackVoice = audioSettings.audioPromptFeedbackVoice || 'en-US-Standard-A';

    feedbackType = GlobalExperimentStates.findOne({userId: Meteor.userId(), TDFId: currentTdfId})?.experimentState?.feedbackType || null;
    if (feedbackType)
      Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype);
    else
      Session.set('feedbackTypeFromHistory', null);
  }

  Session.set('audioPromptMode', audioPromptMode);
  Session.set('audioPromptFeedbackView', audioPromptMode);
  Session.set('audioEnabledView', audioInputEnabled);
  Session.set('audioPromptFeedbackSpeakingRateView', audioPromptFeedbackSpeakingRate);
  Session.set('audioPromptQuestionSpeakingRateView', audioPromptQuestionSpeakingRate);
  Session.set('audioPromptVoiceView', audioPromptVoice);
  Session.set('audioInputSensitivityView', audioInputSensitivity);
  Session.set('audioPromptQuestionVolume', audioPromptQuestionVolume);
  Session.set('audioPromptFeedbackVolume', audioPromptFeedbackVolume);
  Session.set('audioPromptFeedbackVoiceView', audioPromptFeedbackVoice);

  if (feedbackType)
    Session.set('feedbackTypeFromHistory', feedbackType.feedbacktype);
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
    // Silently handle browser info error
  }

  // Check to see if the user has turned on audio prompt.
  // If so and if the tdf has it enabled then turn on, otherwise we won't do anything
  const userAudioPromptFeedbackToggled = (audioPromptFeedbackView == 'feedback') || (audioPromptFeedbackView == 'all') || (audioPromptFeedbackView == 'question');
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

  if (audioEnabled) {
    // Check if the tdf or user has a speech api key defined, if not show the modal form
    // for them to input one.  If so, actually continue initializing web audio
    // and going to the practice set
    (async () => {
      try {
        const key = await Meteor.callAsync('getUserSpeechAPIKey');
        Session.set('speechAPIKey', key);
        const tdfKeyPresent = !!curTdfContent.tdfs.tutor.setspec.speechAPIKey &&
          !!curTdfContent.tdfs.tutor.setspec.speechAPIKey;
        if (!key && !tdfKeyPresent) {
          $('#speechAPIModal').modal('show');
          continueToCard = false;
        }
      } catch (error) {
        console.log('Error getting user speech API key:', error);
      }
    })();
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

    // Scenario 2: Warmup audio if TDF has embedded keys (before navigating to card)
    console.log('[Audio] ===== BEFORE warmup await =====');
    await checkAndWarmupAudioIfNeeded();
    console.log('[Audio] ===== AFTER warmup await - now navigating =====');

    if (isMultiTdf) {
      await navigateForMultiTdf();
    } else {
      console.log('[Audio] ===== Calling Router.go(/card) =====');
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
    const curUnit = experimentState.currentTdfUnit;
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
  // Scenario 2: Warmup audio if TDF has embedded keys (before navigating)
  await checkAndWarmupAudioIfNeeded();

  // Only show selection if we're in a unit where it doesn't matter (infinite learning sessions)
  if (unitLocked) {
    Router.go('/card');
  } else {
    Router.go('/multiTdfSelect');
  }
}
