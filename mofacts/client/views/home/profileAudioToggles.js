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
  if ($('#audioPromptOff')[0].checked) {
    return 'silent';
  } else if ($('#audioPromptFeedbackOnly')[0].checked) {
    return 'feedback';
  } else if ($('#audioPromptAll')[0].checked) {
    return 'all';
  } else {
    return 'silent';
  }
}

function setAudioPromptModeOnPage(audioPromptMode) {
  switch (audioPromptMode) {
    case 'silent':
      $('#audioPromptOff')[0].checked = true;
      break;
    case 'feedback':
      $('#audioPromptFeedbackOnly')[0].checked = true;
      break;
    case 'all':
      $('#audioPromptAll')[0].checked = true;
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

function showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode) {
  switch (audioPromptMode) {
    case 'feedback':
    case 'all':
      $('.audioPromptFeedbackGroup').addClass('flow');
      $('.audioPromptFeedbackGroup').removeClass('invisible');
      break;
    case 'silent':
    default:
      $('.audioPromptFeedbackGroup').addClass('invisible');
      $('.audioPromptFeedbackGroup').removeClass('flow');
      break;
  }
}

Template.profileAudioToggles.rendered = function() {
  $('#speechAPIModal').on('shown.bs.modal', function() {
    $('#speechAPIKey').focus();
  });

  checkAndSetSpeechAPIKeyIsSetup();

  $('#audioPromptSpeakingRate').change(function() {
    $('#audioPromptSpeakingRateLabel').text('Audio prompt speaking rate: ' + document.getElementById('audioPromptSpeakingRate').value);
  });

  $('#audioInputSensitivity').change(function() {
    $('#audioInputSensitivityLabel').text(document.getElementById('audioInputSensitivity').value);
  });

  $('#audioPromptSpeakingRate').change(function() {
    $('#audioPromptSpeakingRateLabel').text(document.getElementById('audioPromptSpeakingRate').value);
  });

  // Restore toggle values from prior page loads
  setAudioInputOnPage(Session.get('audioEnabledView'));
  const audioPromptMode = Session.get('audioPromptFeedbackView');
  setAudioPromptModeOnPage(audioPromptMode);
  showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
  showHideAudioEnabledGroup();

  // Restore range/label values from prior page loads
  const audioInputSensitivityView = Session.get('audioInputSensitivityView');
  if (audioInputSensitivityView) {
    document.getElementById('audioInputSensitivity').value = audioInputSensitivityView;
  }

  const audioPromptSpeakingRateView = Session.get('audioPromptSpeakingRateView');
  if (audioPromptSpeakingRateView) {
    document.getElementById('audioPromptSpeakingRate').value = audioPromptSpeakingRateView;
    document.getElementById('audioPromptSpeakingRateLabel').innerHTML = audioPromptSpeakingRateView;
  }
};

Template.profileAudioToggles.events({
  'click .audioPromptRadio': function(event) {
    console.log('audio prompt mode: ' + event.currentTarget.id);
    const audioPromptMode = getAudioPromptModeFromPage();

    const showHeadphonesSuggestedDiv = (audioPromptMode != 'silent') && getAudioInputFromPage();

    showHideheadphonesSuggestedDiv(showHeadphonesSuggestedDiv);

    Session.set('audioPromptFeedbackView', audioPromptMode);

    showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
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
