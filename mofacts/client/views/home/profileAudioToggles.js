// Set up input sensitivity range to display/hide when audio input is enabled/disabled

// Default audio settings
const DEFAULT_AUDIO_SETTINGS = {
  audioPromptMode: 'silent',
  audioPromptQuestionVolume: 0,
  audioPromptQuestionSpeakingRate: 1,
  audioPromptVoice: 'en-US-Standard-A',
  audioPromptFeedbackVolume: 0,
  audioPromptFeedbackSpeakingRate: 1,
  audioPromptFeedbackVoice: 'en-US-Standard-A',
  audioInputMode: false,
  audioInputSensitivity: 60,
};

// Get user's audio settings with fallbacks to defaults
function getUserAudioSettings() {
  const user = Meteor.user();
  if (!user) return DEFAULT_AUDIO_SETTINGS;

  // audioSettings should always exist (initialized by server publication)
  // Merge with defaults to handle any missing fields
  return { ...DEFAULT_AUDIO_SETTINGS, ...(user.audioSettings || {}) };
}

// Save a single audio setting to database (updates entire audioSettings object)
async function saveAudioSettingToDatabase(settingKey, settingValue) {
  try {
    // Get current settings
    const currentSettings = getUserAudioSettings();

    // Update the specific setting
    currentSettings[settingKey] = settingValue;

    // Save entire settings object
    await Meteor.callAsync('saveAudioSettings', currentSettings);
  } catch (error) {
    console.error('Error saving audio setting:', error);
    alert('Failed to save audio settings: ' + error.message);
  }
}

const showHideAudioEnabledGroup = function(show) {
  if (show) {
    $('.audioEnabledGroup').show();
    $('.audioEnabledGroup').addClass('flow');
  } else {
    $('.audioEnabledGroup').hide();
    $('.audioEnabledGroup').removeClass('flow');
  }
};

const showHideAudioInputGroup = function(show) {
  if (show) {
    $('.audioInputGroup').show();
    $('.audioInputGroup').addClass('flow');
  } else {
    $('.audioInputGroup').hide();
    $('.audioInputGroup').removeClass('flow');
  }
};

function getAudioPromptModeFromPage() {
  if ($('#audioPromptFeedbackOn')[0].checked && $('#audioPromptQuestionOn')[0].checked) {
    return 'all';
  } else if ($('#audioPromptFeedbackOn')[0].checked){
    return 'feedback';
  } else if ($('#audioPromptQuestionOn')[0].checked) {
    return 'question';
  } else {
    return 'silent';
  }
}

function setAudioPromptVolumeOnPage(audioVolume) {
  //Google's TTS API uses decibels to alter audio, the range is -96 to 16. 0 is default
  document.getElementById('audioPromptVolume').value = audioVolume;
}

function disableUnsupportedFeatures(isSafari){
  if(isSafari){
    $('#audioInputOn').prop( "disabled", true );
    $('#audioInputTitle').text($('#audioInputTitle').text() + "(Not available for safari)");
  }
}

function setAudioPromptModeOnPage(audioPromptMode) {
  switch (audioPromptMode) {
    case 'all':
      $('#audioPromptFeedbackOn')[0].checked = true;
      $('#audioPromptQuestionOn')[0].checked = true;
      break;
    case 'feedback':
      $('#audioPromptFeedbackOn')[0].checked = true;
      $('#audioPromptQuestionOn')[0].checked = false;
      break;
    case 'question':
      $('#audioPromptFeedbackOn')[0].checked = false;
      $('#audioPromptQuestionOn')[0].checked = true;
      break;
    default:
      $('#audioPromptFeedbackOn')[0].checked = false;
      $('#audioPromptQuestionOn')[0].checked = false;
      break;
  }
}

function getAudioInputFromPage() {
  return $('#audioInputOn')[0].checked;
}

function setAudioInputOnPage(audioInputEnabled) {
  if (audioInputEnabled) {
    $('#audioInputOn')[0].checked = true;
  } else {
    $('#audioInputOn')[0].checked = false;
  }
}

function showHideheadphonesSuggestedDiv(show) {
  if (show) {
    $('#headphonesSuggestedDiv').show();
    //change the modal height to accomodate the new content
    $('.modal-dialog').addClass('modal-expanded');
  } else {
    $('#headphonesSuggestedDiv').hide();
    $('.modal-dialog').removeClass('modal-expanded');
  }
}

function showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode) {
  const audioPromptSharedGroup = $('.audioPromptSharedGroup');

  // Show shared controls if any audio mode is enabled
  if (audioPromptMode !== 'silent') {
    audioPromptSharedGroup.show();
    audioPromptSharedGroup.addClass('flow');
  } else {
    audioPromptSharedGroup.removeClass('flow');
    audioPromptSharedGroup.hide();
  }
}

Template.profileAudioToggles.rendered = function() {
  $('#speechAPIModal').on('shown.bs.modal', function() {
    $('#speechAPIKey').focus();
  });

  $('#audioModal').on('shown.bs.modal', function() {
    // Load settings from unified audioSettings object
    const settings = getUserAudioSettings();

    // Set toggle states
    setAudioInputOnPage(settings.audioInputMode);
    setAudioPromptModeOnPage(settings.audioPromptMode);
    showHideAudioPromptGroupDependingOnAudioPromptMode(settings.audioPromptMode);

    // Set all control values (use first available value for shared controls)
    const volume = settings.audioPromptQuestionVolume || settings.audioPromptFeedbackVolume || 0;
    const speakingRate = settings.audioPromptQuestionSpeakingRate || settings.audioPromptFeedbackSpeakingRate || 1;
    const voice = settings.audioPromptVoice || settings.audioPromptFeedbackVoice || 'en-US-Standard-A';

    setAudioPromptVolumeOnPage(volume);
    document.getElementById('audioPromptSpeakingRate').value = speakingRate;
    document.getElementById('audioPromptVoice').value = voice;
    document.getElementById('audioInputSensitivity').value = settings.audioInputSensitivity;

    // Update Session variables for backward compatibility (set both to same values)
    Session.set('audioPromptQuestionVolume', volume);
    Session.set('audioPromptFeedbackVolume', volume);
    Session.set('audioPromptQuestionSpeakingRate', speakingRate);
    Session.set('audioPromptFeedbackSpeakingRate', speakingRate);
    Session.set('audioPromptVoice', voice);
    Session.set('audioPromptFeedbackVoice', voice);
    Session.set('audioInputSensitivity', settings.audioInputSensitivity);

    // Show/hide appropriate groups
    showHideAudioInputGroup(settings.audioInputMode);
    showHideAudioEnabledGroup(settings.audioPromptMode != 'silent' || settings.audioInputMode);
    const showHeadphonesSuggestedDiv = settings.audioPromptMode != 'silent' && settings.audioInputMode;
    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);
  });

  checkAndSetSpeechAPIKeyIsSetup();

  // Note: TTS warmup on hot code reload is now handled in index.js Meteor.startup
  // This ensures it runs even if the user is already in a practice session

  $('#audioInputSensitivity').change(function() {
    $('#audioInputSensitivityLabel').text(document.getElementById('audioInputSensitivity').value);
  });

  disableUnsupportedFeatures(Session.get('isSafari'));

  // Settings are now loaded from database when modal opens (see $('#audioModal').on('shown.bs.modal') above)
  // No need to restore from Session variables here
};

Template.profileAudioToggles.events({
  'click #audioPromptQuestionOn': function(event) {
    updateAudioPromptMode(event);
  },

  'click #audioPromptFeedbackOn': function(event) {
    updateAudioPromptMode(event);
  },

  'click #audioInputOn': async function(event) {
    const audioInputEnabled = getAudioInputFromPage();

    const showHeadphonesSuggestedDiv = (getAudioPromptModeFromPage() != 'silent') && audioInputEnabled;

    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);
    showHideAudioInputGroup(audioInputEnabled)
    showHideAudioEnabledGroup(audioInputEnabled || (getAudioPromptModeFromPage() != 'silent'));

    // FIX: Warm up Google Speech Recognition API when user enables audio input
    // This eliminates the cold start delay on first trial
    if (audioInputEnabled) {
      warmupGoogleSpeechRecognition();
    }

    //save the audio input mode to the user profile using unified settings
    await saveAudioSettingToDatabase('audioInputMode', audioInputEnabled);
  },

  'click #setupAPIKey': async function(e) {
    //hide the modal
    $('speechAPIModal').modal('hide');
    e.preventDefault();
    $('#speechAPIModal').modal('show');// {backdrop: "static"}
    try {
      const key = await Meteor.callAsync('getUserSpeechAPIKey');
      $('#speechAPIKey').val(key);
    } catch (error) {
      console.log('Error getting user speech API key', error);
    }
  },

  'click #speechAPISubmit': async function(e) {
    const key = $('#speechAPIKey').val();
    try {
      const serverReturn = await Meteor.callAsync('saveUserSpeechAPIKey', key);
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();

      $('#speechAPIModal').modal('hide');

      console.log('Profile saved:', serverReturn);
      // Clear any controls that shouldn't be kept around
      $('.clearOnSave').val('');
      alert('Your profile changes have been saved');
    } catch (error) {
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();

      $('#speechAPIModal').modal('hide');

      console.log('Error saving speech api key', error);
      alert('Your changes were not saved! ' + error);
    }
  },

  'click #speechAPIDelete': async function(e) {
    try {
      await Meteor.callAsync('deleteUserSpeechAPIKey');
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();
      $('#speechAPIModal').modal('hide');
      console.log('User speech api key deleted');
      alert('Your profile changes have been saved');
    } catch (error) {
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();
      $('#speechAPIModal').modal('hide');
      console.log('Error deleting speech api key', error);
      alert('Your changes were not saved! ' + error);
    }
  },

  'change #audioPromptVolume': async function(event) {
    const value = parseFloat(event.currentTarget.value);
    // Set both session variables to the same value for backward compatibility
    Session.set('audioPromptQuestionVolume', value);
    Session.set('audioPromptFeedbackVolume', value);

    // Save both to database
    const currentSettings = getUserAudioSettings();
    currentSettings.audioPromptQuestionVolume = value;
    currentSettings.audioPromptFeedbackVolume = value;
    await Meteor.callAsync('saveAudioSettings', currentSettings);
  },

  'change #audioPromptSpeakingRate': async function(event) {
    const value = parseFloat(event.currentTarget.value);
    // Set both session variables to the same value for backward compatibility
    Session.set('audioPromptQuestionSpeakingRate', value);
    Session.set('audioPromptFeedbackSpeakingRate', value);
    Session.set('audioPromptQuestionSpeakingRateView', value);
    Session.set('audioPromptFeedbackSpeakingRateView', value);

    // Save both to database
    const currentSettings = getUserAudioSettings();
    currentSettings.audioPromptQuestionSpeakingRate = value;
    currentSettings.audioPromptFeedbackSpeakingRate = value;
    await Meteor.callAsync('saveAudioSettings', currentSettings);
  },

  'change #audioPromptVoice': async function(event) {
    const value = event.currentTarget.value;
    // Set both voice variables to the same value for simplicity
    Session.set('audioPromptVoice', value);
    Session.set('audioPromptVoiceView', value);
    Session.set('audioPromptFeedbackVoice', value);
    Session.set('audioPromptFeedbackVoiceView', value);

    // Save both to database for backward compatibility
    const currentSettings = getUserAudioSettings();
    currentSettings.audioPromptVoice = value;
    currentSettings.audioPromptFeedbackVoice = value;
    await Meteor.callAsync('saveAudioSettings', currentSettings);
  },

  'change #audioInputSensitivity': async function(event) {
    const value = parseInt(event.currentTarget.value);
    Session.set('audioInputSensitivity', value);
    Session.set('audioInputSensitivityView', value);
    await saveAudioSettingToDatabase('audioInputSensitivity', value);
  },

  'click #audioPromptVoiceTest': function(event) {
    event.preventDefault();
    const voice = document.getElementById('audioPromptVoice').value;
    const audioObj = new Audio(`https://cloud.google.com/text-to-speech/docs/audio/${voice}.wav`);
    audioObj.play();
  }
});

Template.profileAudioToggles.helpers({
  showSpeechAPISetup: function() {
    //check if Session variable useEmbeddedAPIKey is set
    if(Session.get('useEmbeddedAPIKeys')){
      return false;
    } else {
      return Session.get('showSpeechAPISetup');
    }
  },

  speechAPIKeyIsSetup: function() {
    return Session.get('speechAPIKeyIsSetup');
  },
});

async function checkAndSetSpeechAPIKeyIsSetup() {
  try {
    const data = await Meteor.callAsync('isUserSpeechAPIKeySetup');
    Session.set('speechAPIKeyIsSetup', data);
  } catch (err) {
    console.log('Error getting whether speech api key is setup');
  }
}

async function updateAudioPromptMode(e){
  const audioPromptMode = getAudioPromptModeFromPage();

  Session.set('audioPromptFeedbackView', audioPromptMode);
  //if toggle is on, show the warning, else hide it
  if (e.currentTarget.checked){
    $('.audioEnabledGroup').show();
    $('#audio-modal-dialog').addClass('modal-expanded');

    // FIX: Warm up Google TTS API when user enables audio prompts
    // This eliminates the 8-9 second cold start delay on first trial
    warmupGoogleTTS();
  } else if(audioPromptMode == 'silent' && !getAudioInputFromPage()){
    $('.audioEnabledGroup').hide();
    $('#audio-modal-dialog').removeClass('modal-expanded');
  }
  showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);

  //save the audio prompt mode to the user profile using unified settings
  await saveAudioSettingToDatabase('audioPromptMode', audioPromptMode);
}

export async function warmupGoogleTTS() {
  console.log('[TTS] 🔥 Warming up Google TTS API...');
  const startTime = performance.now();

  // Set flag immediately to prevent duplicate warmups
  Session.set('ttsWarmedUp', true);

  // Get voice from TDF if available, otherwise use default
  const tdfFile = Session.get('currentTdfFile');
  const voice = tdfFile?.tdfs?.tutor?.setspec?.audioPromptFeedbackVoice || 'en-US-Standard-A';

  // Make a dummy TTS request to establish the Meteor method connection
  // Use valid text instead of "." - Google TTS rejects punctuation-only input
  // Server will handle key lookup (user personal key or TDF key fallback)
  try {
    await Meteor.callAsync('makeGoogleTTSApiCall',
      Session.get('currentTdfId'),
      'warmup', // Valid word for synthesis
      1.0, // Default rate
      0.0, // Volume 0 (silent warmup)
      voice
    );
    const elapsed = performance.now() - startTime;
    console.log(`[TTS] 🔥 Warm-up complete (${elapsed.toFixed(0)}ms) - first trial TTS should be fast`);
  } catch (err) {
    const elapsed = performance.now() - startTime;
    console.log(`[TTS] 🔥 Warm-up failed (${elapsed.toFixed(0)}ms):`, err);
    Session.set('ttsWarmedUp', false); // Allow retry on failure
  }
}

export async function warmupGoogleSpeechRecognition() {
  // Check if already warmed up
  if (Session.get('srWarmedUp')) {
    console.log('[SR] Already warmed up, skipping');
    return;
  }

  console.log('[SR] 🔥 Warming up Google Speech Recognition API...');
  const startTime = performance.now();

  // Set flag immediately to prevent duplicate warmups
  Session.set('srWarmedUp', true);

  // Create minimal silent audio data (LINEAR16 format, 16kHz, 100ms of silence)
  // 16kHz * 100ms = 1600 samples, each sample is 2 bytes (16-bit) = 3200 bytes
  const silentAudioBytes = new Uint8Array(3200).fill(0);
  const base64Audio = btoa(String.fromCharCode.apply(null, silentAudioBytes));

  // Build minimal request matching production format
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,  // Using 16kHz (Google recommended)
      languageCode: 'en-US',
      maxAlternatives: 1,
      profanityFilter: false,
      enableAutomaticPunctuation: false,
      model: 'command_and_search',
      useEnhanced: true,
      speechContexts: [{
        phrases: ['warmup'],  // Minimal phrase hint
        boost: 5
      }]
    },
    audio: {
      content: base64Audio
    }
  };

  // Make warmup call
  try {
    await Meteor.callAsync('makeGoogleSpeechAPICall',
      Session.get('currentTdfId'),
      '', // Empty key - server will fetch TDF or user key
      request,
      ['warmup'] // Minimal answer grammar
    );
    const elapsed = performance.now() - startTime;
    console.log(`[SR] 🔥 Warm-up complete (${elapsed.toFixed(0)}ms) - first trial SR should be fast`);
  } catch (err) {
    const elapsed = performance.now() - startTime;
    console.log(`[SR] 🔥 Warm-up failed (${elapsed.toFixed(0)}ms):`, err);
    Session.set('srWarmedUp', false); // Allow retry on failure
  }
}
