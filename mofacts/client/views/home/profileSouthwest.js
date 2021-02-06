import { haveMeteorUser } from '../../lib/currentTestingHelpers';
import { selectTdf } from './profile';

Template.profileSouthwest.helpers({
    username: function () {
        if (!haveMeteorUser()) {
            routeToSignin();
        }
        else {
            return Meteor.user().username;
        }
    },
});

Template.profileSouthwest.events({
    // Start a TDF
    'click .tdfButton' : function (event) {
        event.preventDefault();
        console.log(event);

        var target = $(event.currentTarget);
        selectTdf(
            target.data("currentTdfId"),
            target.data("lessonname"),
            target.data("currentStimuliSetId"),
            target.data("ignoreOutOfGrammarResponses"),
            target.data("speechOutOfGrammarFeedback"),
            "User button click",
            target.data("isMultiTdf"),
            true
        );
    },
});

var addButton = function(btnObj,audioInputEnabled,enableAudioPromptAndFeedback) {
  console.log("ADD BUTTON CALLED: " + JSON.stringify(btnObj));
  var container = "<div class='col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center'><br></div>";
  if(audioInputEnabled){
    container = $(container).prepend('<p style="display:inline-block" title="Speech Input available for this module"><i class="fa fa-microphone"></i></p>');
  }
  container = $(container).prepend('<p style="display:inline-block">&nbsp;&nbsp;&nbsp;</p>');
  if(enableAudioPromptAndFeedback){
    container = $(container).prepend('<p style="display:inline-block" title="Audio Output available for this module"><i class="fas fa-volume-up"></i></p>')
  }
  container = $(container).prepend(btnObj);
  $("#testButtonContainer").append(container);
};

Template.profileSouthwest.rendered = async function () {
    Session.set("showSpeechAPISetup",false);
    $("#expDataDownloadContainer").html("");
    const allTdfs = await meteorCallAsync("getAllTdfs");
    Session.set("allTdfs",allTdfs);

    Meteor.call('getTdfsAssignedToStudent',Meteor.userId(),function(err,result){
      console.log("err: " + err + ", res: " + result);
      var assignedTdfs = result;
      console.log("assignedTdfs: " + JSON.stringify(assignedTdfs));
      //Check all the valid TDF's
      assignedTdfs.forEach( function (tdf) {
          let TDFId = tdf.TDFId;
          console.log("assignedTdfs",tdf);
          let tdfObject = tdf.content;
          let isMultiTdf = tdfObject.isMultiTdf;

          //Make sure we have a valid TDF (with a setspec)
          const setspec = tdfObject.tdfs.tutor.setspec[0];

          if (!setspec) {
              console.log("Invalid TDF - it will never work", tdfObject);
              return;
          }

          var name = _.chain(setspec).prop("lessonname").first().value();
          if (!name) {
              console.log("Skipping TDF with no name", setspec);
              return;
          }

          var currentStimuliSetId = tdf.currentStimuliSetId;

          var ignoreOutOfGrammarResponses = (_.chain(setspec).prop("speechIgnoreOutOfGrammarResponses").first().value() || "").toLowerCase()  == "true";
          var speechOutOfGrammarFeedback = _.chain(setspec).prop("speechOutOfGrammarFeedback").first().value();
          if(!speechOutOfGrammarFeedback){
            speechOutOfGrammarFeedback = "Response not in answer set"
          }

          var audioInputEnabled = _.chain(setspec).prop("audioInputEnabled").first().value() == "true";
          var enableAudioPromptAndFeedback = _.chain(setspec).prop("enableAudioPromptAndFeedback").first().value() == "true";

          var audioInputSpeechAPIKeyAvailable = !!_.chain(setspec).prop("speechAPIKey").first().value();

          //Only display the audio input available if enabled in tdf and tdf has key for it
          audioInputEnabled = audioInputEnabled && audioInputSpeechAPIKeyAvailable;
          var audioPromptTTSAPIKeyAvailable = !!_.chain(setspec).prop("textToSpeechAPIKey").first().value();

          //Only display the audio output available if enabled in tdf and tdf has key for it
          var audioOutputEnabled = enableAudioPromptAndFeedback && audioPromptTTSAPIKeyAvailable;

          addButton(
              $("<button type='button' id='"+TDFId+"' name='"+name+"'>")
                  .addClass("btn btn-block btn-responsive tdfButton")
                  .data("tdfid", TDFId)
                  .data("lessonname", name)
                  .data("currentStimuliSetId", currentStimuliSetId)
                  .data("ignoreOutOfGrammarResponses",ignoreOutOfGrammarResponses)
                  .data("speechOutOfGrammarFeedback",speechOutOfGrammarFeedback)
                  .data("isMultiTdf",isMultiTdf)
                  .html(name),audioInputEnabled,audioOutputEnabled
          );
      });
    });
};

//We'll use this in card.js if audio input is enabled and user has provided a
//speech API key
speechAPIKey = null;
