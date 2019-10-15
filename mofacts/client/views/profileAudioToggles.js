//Set up input sensitivity range to display/hide when audio input is enabled/disabled
var showHideAudioEnabledGroup = function(show)
{
  if(show){
      $('.audioEnabledGroup').removeClass('invisible');
      $('.audioEnabledGroup').addClass('flow');
  }else{
    $('.audioEnabledGroup').addClass('invisible');
    $('.audioEnabledGroup').removeClass('flow');
  }
};

getAudioPromptModeFromPage = function(){
  if($("#audioPromptOff")[0].checked){
    return "silent";
  }else if ($("#audioPromptFeedbackOnly")[0].checked) {
    return "feedback";
  }else if($("#audioPromptAll")[0].checked){
    return "all";
  }else{
    return "silent";
  }
}

setAudioPromptModeOnPage = function(audioPromptMode){
  switch(audioPromptMode){
    case "silent":
      $("#audioPromptOff")[0].checked = true;
      break;
    case "feedback":
      $("#audioPromptFeedbackOnly")[0].checked = true;
      break;
    case "all":
      $("#audioPromptAll")[0].checked = true;
      break;
  }
}

getAudioInputFromPage = function(){
  return !$("#audioInputOff")[0].checked;
}

setAudioInputOnPage = function(audioInputEnabled){
  if(audioInputEnabled){
    $("#audioInputOn")[0].checked = true;
  }else{
    $("#audioInputOff")[0].checked = true;
  }
}

Template.profileAudioToggles.rendered = function(){
    $('#speechAPIModal').on('shown.bs.modal', function () {
      $('#speechAPIKey').focus();
    })

    checkAndSetSpeechAPIKeyIsSetup();

    $('#audioPromptSpeakingRate').change(function() {
        $('#audioPromptSpeakingRateLabel').text("Audio prompt speaking rate: " + document.getElementById("audioPromptSpeakingRate").value);
    });

    $('#audioInputSensitivity').change(function() {
        $('#audioInputSensitivityLabel').text(document.getElementById("audioInputSensitivity").value);
    });

    $('#audioPromptSpeakingRate').change(function() {
        $('#audioPromptSpeakingRateLabel').text(document.getElementById("audioPromptSpeakingRate").value);
    });

    //Restore toggle values from prior page loads
    setAudioInputOnPage(Session.get("audioEnabledView"));
    var audioPromptMode = Session.get("audioPromptFeedbackView");
    setAudioPromptModeOnPage(audioPromptMode);
    showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
    showHideAudioEnabledGroup();

    //Restore range/label values from prior page loads
    var audioInputSensitivityView = Session.get("audioInputSensitivityView");
    if(!!audioInputSensitivityView){
      document.getElementById("audioInputSensitivity").value = audioInputSensitivityView;
    }

    var audioPromptSpeakingRateView = Session.get("audioPromptSpeakingRateView");
    if(!!audioPromptSpeakingRateView){
      document.getElementById("audioPromptSpeakingRate").value = audioPromptSpeakingRateView;
      document.getElementById("audioPromptSpeakingRateLabel").innerHTML = audioPromptSpeakingRateView;
    }
}

Template.profileAudioToggles.events({
  'click .audioPromptRadio': function(event){
    console.log("audio prompt mode: " + event.currentTarget.id);
    var audioPromptMode = getAudioPromptModeFromPage();

    Session.set("audioPromptFeedbackView",audioPromptMode);

    showHideAudioPromptFeedbackGroupDependingOnAudioPromptMode(audioPromptMode);
  },

  'click .audioInputRadio': function(event){
    var audioInputEnabled = getAudioInputFromPage();
    showHideAudioEnabledGroup(audioInputEnabled);
  },

  'click #setupAPIKey' : function(e){
    e.preventDefault();
    $('#speechAPIModal').modal('show');//{backdrop: "static"}
    Meteor.call('getUserSpeechAPIKey', function(error,key){
      $('#speechAPIKey').val(key);
    });
  },

  'click #speechAPISubmit' : function(e){
    var key = $('#speechAPIKey').val();
    Meteor.call("saveUserSpeechAPIKey", key, function(error, serverReturn) {
        //Make sure to update our reactive session variable so the api key is
        //setup indicator updates
        checkAndSetSpeechAPIKeyIsSetup();

        $('#speechAPIModal').modal('hide');

        if (!!error) {
            console.log("Error saving speech api key", error);
            alert("Your changes were not saved! " + error);
        }
        else {
            console.log("Profile saved:", serverReturn);
            //Clear any controls that shouldn't be kept around
            $(".clearOnSave").val("");
            alert("Your profile changes have been saved");
        }
    });
  },

  'click #speechAPIDelete' : function(e){
    Meteor.call("deleteUserSpeechAPIKey",function(error){
      //Make sure to update our reactive session variable so the api key is
      //setup indicator updates
      checkAndSetSpeechAPIKeyIsSetup();
      $('#speechAPIModal').modal('hide');
      if(!!error){
        console.log("Error deleting speech api key", error);
        alert("Your changes were not saved! " + error);
      }else{
        console.log("User speech api key deleted");
        alert("Your profile changes have been saved");
      }
    })
  }
});

Template.profileAudioToggles.helpers({
  showSpeechAPISetup: function(){
    return Session.get("showSpeechAPISetup");
  },

  speechAPIKeyIsSetup: function(){
    return Session.get("speechAPIKeyIsSetup");
  }
})

checkAndSetSpeechAPIKeyIsSetup = function(){
  Meteor.call('isUserSpeechAPIKeySetup', function(err,data){
    if(err){
      console.log("Error getting whether speech api key is setup");
    }else {
      Session.set('speechAPIKeyIsSetup',data);
    }
  })
}
