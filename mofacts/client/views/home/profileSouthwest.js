import {meteorCallAsync} from '../..';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {selectTdf} from './profile';
import {routeToSignin} from '../../lib/router';
import { Route53RecoveryCluster } from '../../../node_modules/aws-sdk/index';

Template.profileSouthwest.helpers({
  username: function() {
    if (!haveMeteorUser()) {
      routeToSignin();
    } else {
      return Meteor.user().username;
    }
  },
  class: function(){
    thisClass = Meteor.user().profile.curClass;
    if(thisClass.coursename){
      return thisClass;
    } else {
      return false;
    }
  },
});

Template.profileSouthwest.events({
  // Start a TDF
  'click .tdfButton': function(event) {
    event.preventDefault();
    console.log(event);

    const target = $(event.currentTarget);
    selectTdf(
        target.data('tdfid'),
        target.data('lessonname'),
        target.data('currentStimuliSetId'),
        target.data('ignoreoutofgrammarresponses'),
        target.data('speechoutofgrammarfeedback'),
        'User button click',
        target.data('isMultiTdf'),
        true,
    );
  },
});

const addButton = function(btnObj, audioInputEnabled, enableAudioPromptAndFeedback) {
  console.log('ADD BUTTON CALLED: ' + JSON.stringify(btnObj));
  let container = '<div class=\'col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center\'><br></div>'
  container = $(container).prepend(btnObj);
  $('#testButtonContainer').append(container);
};

Template.profileSouthwest.rendered = async function() {
  Session.set('currentExperimentState', undefined);
  Session.set('subTdfIndex', undefined);
  Session.set('showSpeechAPISetup', false);
  $('#expDataDownloadContainer').html('');
  const allTdfs = await meteorCallAsync('getAllTdfs');
  Session.set('allTdfs', allTdfs);
  const curSectionId = Meteor.user().profile.curClass.sectionId;
  Meteor.call('getTdfsAssignedToStudent', Meteor.userId(), curSectionId, async function(err, result) {
    console.log('err: ' + err + ', res: ' + result);
    const assignedTdfs = result;
    console.log('assignedTdfs: ', assignedTdfs);
    // Check all the valid TDF's
    assignedTdfs.forEach( function(tdf) {
      const TDFId = tdf._id;
      console.log('assignedTdfs', tdf);
      const tdfObject = tdf.content;
      const isMultiTdf = tdfObject.isMultiTdf;

      // Make sure we have a valid TDF (with a setspec)
      const setspec = tdfObject.tdfs.tutor.setspec;

      if (!setspec) {
        console.log('Invalid TDF - it will never work', tdfObject);
        return;
      }

      const name = setspec.lessonname;
      if (!name) {
        console.log('Skipping TDF with no name', setspec);
        return;
      }

      const currentStimuliSetId = tdf.stimuliSetId;

      const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses == 'true';
      let speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback;
      if (!speechOutOfGrammarFeedback) {
        speechOutOfGrammarFeedback = 'Response not in answer set';
      }

      let audioInputEnabled = setspec.audioInputEnabled == 'true';
      const enableAudioPromptAndFeedback = setspec.enableAudioPromptAndFeedback == 'true';

      //If the tdf has a due date, display
      if(setspec.duedate){
        innerBtnHtml += "<small>Due: " + setspec.duedate + "</small><br>";
      }

      //If the tdf is overdue, disable
      const exception = getTDFExceptionStatus(Meteor.userId(), TDFId);
      var exceptionDate = false;
      if (exception) {
        var exceptionRaw = new Date(exception);
        var exceptionDate = exceptionRaw.getTime();
      }
      const curDate = new Date().getTime();
      dueDate = setspec.duedate ? setspec.duedate : false;
  
      isOverDue = false;
      if(dueDate) {
        console.log("dueDate", dueDate, curDate, exceptionDate);
        if(dueDate < curDate) {
         isOverDue = true;
        } 
      } 
      if(isOverDue && exceptionDate){
        if(exceptionDate < curDate) {
          isOverDue = true;
        }
      }


      const audioInputSpeechAPIKeyAvailable = !!setspec.speechAPIKey;

      // Only display the audio input available if enabled in tdf and tdf has key for it
      audioInputEnabled = audioInputEnabled && audioInputSpeechAPIKeyAvailable;
      const audioPromptTTSAPIKeyAvailable = !!setspec.textToSpeechAPIKey;

      // Only display the audio output available if enabled in tdf and tdf has key for it
      const audioOutputEnabled = enableAudioPromptAndFeedback && audioPromptTTSAPIKeyAvailable;


      //Display inner html for audio icons
      let audioHtml = "";
      if (audioInputEnabled) {
        audioHtml += '<span><i class="fa fa-microphone"></i>&nbsp;</span>';
      }
      if (enableAudioPromptAndFeedback) {
        audioHtml += '<span class="glyphicon glyphicon-headphones">&nbsp;</span>';
      }
      innerBtnHtml = name + "<br>" + audioHtml;

      addButton(
          $('<button type=\'button\' id=\''+TDFId+'\' name=\''+name+'\'>')
              .addClass('btn btn-block btn-responsive tdfButton')
              .attr('data-tdfid', TDFId)
              .attr('data-lessonname', name)
              .attr('data-currentStimuliSetId', currentStimuliSetId)
              .attr('data-ignoreOutOfGrammarResponses', ignoreOutOfGrammarResponses)
              .attr('data-speechOutOfGrammarFeedback', speechOutOfGrammarFeedback)
              .attr('data-isMultiTdf', isMultiTdf)
              .attr('disabled', isOverDue)
              .html(innerBtnHtml), audioInputEnabled, audioOutputEnabled,
      );
    });
  });
};

// We'll use this in card.js if audio input is enabled and user has provided a
// speech API key
Session.set('speechAPIKey', null);

async function getTDFExceptionStatus(userId, tdfId) {
  const exception =  meteorCallAsync('checkForUserException', userId, tdfId, function (err, result) {
    var exceptionDate = false;
    if (result) {
      var exceptionRaw = new Date(result);
      var exceptionDate = exceptionRaw.getTime();
    }
    return exceptionDate;
  });
}