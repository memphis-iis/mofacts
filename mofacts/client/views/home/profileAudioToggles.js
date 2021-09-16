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

function setAudioPromptModeOnPage(audioPromptMode) {
  switch (audioPromptMode) {
    case 'all':
      $('#audioPromptFeedbackOn')[0].checked = true;
      $('#audioPromptQuestionOn')[0].checked = true;
      break;
    case 'feedback':
      $('#audioPromptFeedbackOn')[0].checked = true;
      $('#audioPromptQuestionOff')[0].checked = true;
      break;
    case 'question':
      $('#audioPromptFeedbackOff')[0].checked = true;
      $('#audioPromptQuestionOn')[0].checked = true;
      break;
    default:
      $('#audioPromptFeedbackOff')[0].checked = true;
      $('#audioPromptQuestionOff')[0].checked = true;
      break;
  }
}

function getAudioInputFromPage() {
  return !$('#audioInputOff')[0].checked;
}

function setAudioInputOnPage(audioInputEnabled) {
  if (audioInputEnabled) {
    $('#audioInputOn')[0].checked = true;
  } else {
    $('#audioInputOff')[0].checked = true;
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
};

Template.profileAudioToggles.events({
  'click .audioPromptRadio': function(event) {
    console.log('audio prompt mode: ' + event.currentTarget.id);
    const audioPromptMode = getAudioPromptModeFromPage();

    const showHeadphonesSuggestedDiv = (audioPromptMode != 'silent') && getAudioInputFromPage();

    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);

    Session.set('audioPromptFeedbackView', audioPromptMode);

    showHideAudioPromptGroupDependingOnAudioPromptMode(audioPromptMode);
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
