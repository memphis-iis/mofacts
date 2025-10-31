// Set up input sensitivity range to display/hide when audio input is enabled/disabled

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

function setAudioPromptQuestionVolumeOnPage(audioVolume) {
  //Google's TTS API uses decibles to alter audio, the range is -96 to 16. 0 is 
  document.getElementById('audioPromptQuestionVolume').value = audioVolume;
}

function setAudioPromptFeedbackVolumeOnPage(audioVolume) {
  document.getElementById('audioPromptFeedbackVolume').value = audioVolume;

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
  const audioPromptFeedbackGroup = $('.audioPromptFeedbackGroup');
  const audioPromptQuestionGroup = $('.audioPromptQuestionGroup');
  switch (audioPromptMode) {
    case 'feedback':
      audioPromptFeedbackGroup.show();
      audioPromptFeedbackGroup.addClass('flow');
      audioPromptQuestionGroup.removeClass('flow');
      audioPromptQuestionGroup.hide();
      break;
    case 'question':
      audioPromptQuestionGroup.show();
      audioPromptQuestionGroup.addClass('flow');
      audioPromptFeedbackGroup.removeClass('flow');
      audioPromptFeedbackGroup.hide();
      break;
    case 'all':
      audioPromptFeedbackGroup.show();
      audioPromptFeedbackGroup.addClass('flow');
      audioPromptQuestionGroup.show();
      audioPromptQuestionGroup.addClass('flow');
      break;
    case 'silent':
    default:
      audioPromptFeedbackGroup.removeClass('flow');
      audioPromptFeedbackGroup.hide();
      audioPromptQuestionGroup.removeClass('flow');
      audioPromptQuestionGroup.hide();
      break;
  }
}

Template.profileAudioToggles.rendered = function() {
  $('#speechAPIModal').on('shown.bs.modal', function() {
    $('#speechAPIKey').focus();
  });

  $('#audioModal').on('shown.bs.modal', function() {
    const audioInputEnabled = Meteor.user().audioInputMode
    const audioPromptMode = Meteor.user().audioPromptMode || 'silent';
    setAudioInputOnPage(audioInputEnabled);
    setAudioPromptModeOnPage(audioPromptMode);
    showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);
    setAudioPromptQuestionVolumeOnPage(Session.get('audioPromptQuestionVolume'));
    setAudioPromptFeedbackVolumeOnPage(Session.get('audioPromptFeedbackVolume'));
    showHideAudioInputGroup(audioInputEnabled);
    showHideAudioEnabledGroup(audioPromptMode != 'silent' || audioInputEnabled);
    const showHeadphonesSuggestedDiv = audioPromptMode != 'silent' && audioInputEnabled;
    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);
  });

  checkAndSetSpeechAPIKeyIsSetup();

  // Note: TTS warmup on hot code reload is now handled in index.js Meteor.startup
  // This ensures it runs even if the user is already in a practice session

  $('#audioInputSensitivity').change(function() {
    $('#audioInputSensitivityLabel').text(document.getElementById('audioInputSensitivity').value);
  });

  disableUnsupportedFeatures(Session.get('isSafari'));

  // Restore range/label values from prior page loads
  const audioInputSensitivityView = Session.get('audioInputSensitivityView');
  if (audioInputSensitivityView) {
    document.getElementById('audioInputSensitivity').value = audioInputSensitivityView;
  }

  const audioPromptFeedbackSpeakingRateView = Session.get('audioPromptFeedbackSpeakingRateView');
  if (audioPromptFeedbackSpeakingRateView) {
    document.getElementById('audioPromptFeedbackSpeakingRate').value = audioPromptFeedbackSpeakingRateView;
  }

  const audioPromptQuestionSpeakingRateView = Session.get('audioPromptQuestionSpeakingRateView');
  if (audioPromptQuestionSpeakingRateView) {
    document.getElementById('audioPromptQuestionSpeakingRate').value = audioPromptQuestionSpeakingRateView;
  }

  const audioPromptVoiceView = Session.get('audioPromptVoiceView');
  if (audioPromptVoiceView) {
    document.getElementById('audioPromptVoice').value = audioPromptVoiceView;
  }

  const audioPromptFeedbackVoiceView = Session.get('audioPromptFeedbackVoiceView');
  if (audioPromptFeedbackVoiceView) {
    document.getElementById('audioPromptFeedbackVoice').value = audioPromptFeedbackVoiceView;
  }
};

Template.profileAudioToggles.events({
  'click #audioPromptQuestionOn': function(event) {
    updateAudioPromptMode(event);
  },

  'click #audioPromptFeedbackOn': function(event) {
    updateAudioPromptMode(event);
  },

  'click #audioInputOn': async function(event) {
    console.log('audio input mode: ' + event.currentTarget.id);
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

    //save the audio input mode to the user profile in mongodb
    try {
      await Meteor.callAsync('saveAudioInputMode', audioInputEnabled);
    } catch (error) {
      console.log('Error saving audio input mode', error);
    }
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

  'change #audioPromptQuestionVolume': function(event) {
    Session.set('audioPromptQuestionVolume', event.currentTarget.value);
  },

  'change #audioPromptFeedbackVolume': function(event) {
    Session.set('audioPromptFeedbackVolume', event.currentTarget.value)
  },

  'click #audioPromptVoiceTest': function(event) {
    const voice = document.getElementById('audioPromptVoice').value;
    const audioObj = new Audio(`https://cloud.google.com/text-to-speech/docs/audio/${voice}.wav`);
    audioObj.play();
  },

  'click #audioPromptFeedbackVoiceTest': function(event) {
    const voice = document.getElementById('audioPromptFeedbackVoice').value;
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
  console.log('audio prompt mode: ' + e.currentTarget.id);
  const audioPromptMode = getAudioPromptModeFromPage();
  Session.set('audioPromptFeedbackView', audioPromptMode);
  //if toggle is on, show the warning, else hide it
  if (e.currentTarget.checked){
    $('.audioEnabledGroup').show();
    $('#audio-modal-dialog').addClass('modal-expanded');
    console.log('showing audio enabled group');

    // FIX: Warm up Google TTS API when user enables audio prompts
    // This eliminates the 8-9 second cold start delay on first trial
    warmupGoogleTTS();
  } else if(audioPromptMode == 'silent' && !getAudioInputFromPage()){
    $('.audioEnabledGroup').hide();
    $('#audio-modal-dialog').removeClass('modal-expanded');
    console.log('hiding audio enabled group');
  }
  showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);
  //save the audio prompt mode to the user profile in mongodb
  try {
    await Meteor.callAsync('saveAudioPromptMode', audioPromptMode);
  } catch (error) {
    console.log('Error saving audio prompt mode', error);
  }
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
