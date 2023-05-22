export {getAudioPromptModeFromPage, getAudioInputFromPage};
// Set up input sensitivity range to display/hide when audio input is enabled/disabled

const showHideAudioEnabledGroup = function(show) {
  if (show) {
    $('.audioEnabledGroup').removeClass('invisible');
    $('.audioEnabledGroup').addClass('flow');
  } else {
    $('.audioEnabledGroup').addClass('invisible');
    $('.audioEnabledGroup').removeClass('flow');
  }
};

function getAudioPromptModeFromPage() {
  if ($('#audioPromptFeedbackOn').checked && $('#audioPromptQuestionOn').checked) {
    return 'all';
  } else if ($('#audioPromptFeedbackOn').checked){
    return 'feedback';
  } else if ($('#audioPromptQuestionOn').checked) {
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
  return $('#audioInputOn').checked;
}

function setAudioInputOnPage(audioInputEnabled) {
  if (audioInputEnabled) {
    $('#audioInputOn').checked = true;
  } else {
    $('#audioInputOn').checked = false;
  }
}

function showHideheadphonesSuggestedDiv(show) {
  if (show) {
    $('#headphonesSuggestedDiv').removeClass('invisible');
  } else {
    $('#headphonesSuggestedDiv').addClass('invisible');
  }
}

function showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode) {
  switch (audioPromptMode) {
    case 'feedback':
      $('.audioPromptFeedbackGroup').addClass('flow');
      $('.audioPromptFeedbackGroup').removeClass('invisible');
      $('.audioPromptQuestionGroup').addClass('invisible');
      $('.audioPromptQuestionGroup').removeClass('flow');
      break;
    case 'question':
      $('.audioPromptQuestionGroup').addClass('flow');
      $('.audioPromptQuestionGroup').removeClass('invisible');
      $('.audioPromptFeedbackGroup').addClass('invisible');
      $('.audioPromptFeedbackGroup').removeClass('flow');
      break;
    case 'all':
      $('.audioPromptFeedbackGroup').addClass('flow');
      $('.audioPromptFeedbackGroup').removeClass('invisible');
      $('.audioPromptQuestionGroup').addClass('flow');
      $('.audioPromptQuestionGroup').removeClass('invisible');
      break;
    case 'silent':
    default:
      $('.audioPromptFeedbackGroup').addClass('invisible');
      $('.audioPromptFeedbackGroup').removeClass('flow');
      $('.audioPromptQuestionGroup').addClass('invisible');
      $('.audioPromptQuestionGroup').removeClass('flow');
      break;
  }
}

Template.profileAudioToggles.rendered = function() {
  $('#speechAPIModal').on('shown.bs.modal', function() {
    $('#speechAPIKey').focus();
  });

  checkAndSetSpeechAPIKeyIsSetup();

  $('#audioInputSensitivity').change(function() {
    $('#audioInputSensitivityLabel').text(document.getElementById('audioInputSensitivity').value);
  });

  disableUnsupportedFeatures(Session.get('isSafari'));
  // Restore toggle values from prior page loads
  setAudioInputOnPage(Session.get('audioEnabledView'));
  const audioPromptMode = Session.get('audioPromptFeedbackView');
  setAudioPromptModeOnPage(audioPromptMode);
  showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);
  setAudioPromptQuestionVolumeOnPage(Session.get('audioPromptQuestionVolume'));
  setAudioPromptFeedbackVolumeOnPage(Session.get('audioPromptFeedbackVolume'));
  showHideAudioEnabledGroup();

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
    console.log('audio prompt mode: ' + event.currentTarget.id);
    const audioPromptMode = getAudioPromptModeFromPage();
    Session.set('audioPromptFeedbackView', audioPromptMode);
    //if toggle is on, show the warning, else hide it
    if(event.currentTarget.checked){
      $('.audioEnabledGroup').show();
      console.log('showing audio enabled group');
    }else{
      $('.audioEnabledGroup').hide();
      console.log('hiding audio enabled group');
    }
  },

  'click .audioInputRadio': function(event) {
    console.log('audio input mode: ' + event.currentTarget.id);
    const audioInputEnabled = getAudioInputFromPage();

    const showHeadphonesSuggestedDiv = (getAudioPromptModeFromPage() != 'silent') && audioInputEnabled;

    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);

    showHideAudioEnabledGroup(audioInputEnabled);
  },

  'click #setupAPIKey': function(e) {
    e.preventDefault();
    $('#speechAPIModal').modal('show');// {backdrop: "static"}
    Meteor.call('getUserSpeechAPIKey', function(error, key) {
      $('#speechAPIKey').val(key);
    });
  },

  'click #speechAPISubmit': function(e) {
    const key = $('#speechAPIKey').val();
    Meteor.call('saveUserSpeechAPIKey', key, function(error, serverReturn) {
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();

      $('#speechAPIModal').modal('hide');

      if (error) {
        console.log('Error saving speech api key', error);
        alert('Your changes were not saved! ' + error);
      } else {
        console.log('Profile saved:', serverReturn);
        // Clear any controls that shouldn't be kept around
        $('.clearOnSave').val('');
        alert('Your profile changes have been saved');
      }
    });
  },

  'click #speechAPIDelete': function(e) {
    Meteor.call('deleteUserSpeechAPIKey', function(error) {
      // Make sure to update our reactive session variable so the api key is
      // setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();
      $('#speechAPIModal').modal('hide');
      if (error) {
        console.log('Error deleting speech api key', error);
        alert('Your changes were not saved! ' + error);
      } else {
        console.log('User speech api key deleted');
        alert('Your profile changes have been saved');
      }
    });
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
    return Session.get('showSpeechAPISetup');
  },

  speechAPIKeyIsSetup: function() {
    return Session.get('speechAPIKeyIsSetup');
  },
});

function checkAndSetSpeechAPIKeyIsSetup() {
  Meteor.call('isUserSpeechAPIKeySetup', function(err, data) {
    if (err) {
      console.log('Error getting whether speech api key is setup');
    } else {
      Session.set('speechAPIKeyIsSetup', data);
    }
  });
}
