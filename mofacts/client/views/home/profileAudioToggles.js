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

  'click #audioInputOn': function(event) {
    console.log('audio input mode: ' + event.currentTarget.id);
    const audioInputEnabled = getAudioInputFromPage();

    const showHeadphonesSuggestedDiv = (getAudioPromptModeFromPage() != 'silent') && audioInputEnabled;

    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);
    showHideAudioInputGroup(audioInputEnabled)
    showHideAudioEnabledGroup(audioInputEnabled || (getAudioPromptModeFromPage() != 'silent'));
    //save the audio input mode to the user profile in mongodb
    Meteor.call('saveAudioInputMode', audioInputEnabled, function(error) {
      if (error) {
        console.log('Error saving audio input mode', error);
      }
    });
  },

  'click #setupAPIKey': function(e) {
    //hide the modal
    $('speechAPIModal').modal('hide');
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

function checkAndSetSpeechAPIKeyIsSetup() {
  Meteor.call('isUserSpeechAPIKeySetup', function(err, data) {
    if (err) {
      console.log('Error getting whether speech api key is setup');
    } else {
      Session.set('speechAPIKeyIsSetup', data);
    }
  });
}

function updateAudioPromptMode(e){
  console.log('audio prompt mode: ' + e.currentTarget.id);
  const audioPromptMode = getAudioPromptModeFromPage();
  Session.set('audioPromptFeedbackView', audioPromptMode);
  //if toggle is on, show the warning, else hide it
  if (e.currentTarget.checked){
    $('.audioEnabledGroup').show();
    $('#audio-modal-dialog').addClass('modal-expanded');
    console.log('showing audio enabled group');
  } else if(audioPromptMode == 'silent' && !getAudioInputFromPage()){
    $('.audioEnabledGroup').hide();
    $('#audio-modal-dialog').removeClass('modal-expanded');
    console.log('hiding audio enabled group');
  }
  showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);
  //save the audio prompt mode to the user profile in mongodb
  Meteor.call('saveAudioPromptMode', audioPromptMode, function(error) {
    if (error) {
      console.log('Error saving audio prompt mode', error);
    }
  });
}
