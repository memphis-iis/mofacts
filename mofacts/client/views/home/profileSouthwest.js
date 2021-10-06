import {meteorCallAsync} from '../..';
import {haveMeteorUser} from '../../lib/currentTestingHelpers';
import {selectTdf} from './profile';
import {routeToSignin} from '../../lib/router';

Template.profileSouthwest.helpers({
  username: function() {
    if (!haveMeteorUser()) {
      routeToSignin();
    } else {
      return Meteor.user().username;
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
  let container = '<div class=\'col-xs-12 col-sm-12 col-md-3 col-lg-3 text-center\'><br></div>';
  if (audioInputEnabled) {
    const audioHtml = '<p style="display:inline-block" title="Speech Input available for this module"> \
                       <i class="fa fa-microphone"></i></p>';
    container = $(container).prepend(audioHtml);
  }
  container = $(container).prepend('<p style="display:inline-block">&nbsp;&nbsp;&nbsp;</p>');
  if (enableAudioPromptAndFeedback) {
    const audioHtml = '<p style="display:inline-block" title="Audio Output available for this module"> \
                       <i class="fas fa-volume-up"></i></p>';
    container = $(container).prepend(audioHtml);
  }
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

  Meteor.call('getTdfsAssignedToStudent', Meteor.userId(), function(err, result) {
    console.log('err: ' + err + ', res: ' + result);
    const assignedTdfs = result;
    console.log('assignedTdfs: ', assignedTdfs);
    // Check all the valid TDF's
    assignedTdfs.forEach( function(tdf) {
      const TDFId = tdf.TDFId;
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

      const audioInputSpeechAPIKeyAvailable = !!setspec.speechAPIKey;

      // Only display the audio input available if enabled in tdf and tdf has key for it
      audioInputEnabled = audioInputEnabled && audioInputSpeechAPIKeyAvailable;
      const audioPromptTTSAPIKeyAvailable = !!setspec.textToSpeechAPIKey;

      // Only display the audio output available if enabled in tdf and tdf has key for it
      const audioOutputEnabled = enableAudioPromptAndFeedback && audioPromptTTSAPIKeyAvailable;

      addButton(
          $('<button type=\'button\' id=\''+TDFId+'\' name=\''+name+'\'>')
              .addClass('btn btn-block btn-responsive tdfButton')
              .data('tdfid', TDFId)
              .data('lessonname', name)
              .data('currentStimuliSetId', currentStimuliSetId)
              .data('ignoreOutOfGrammarResponses', ignoreOutOfGrammarResponses)
              .data('speechOutOfGrammarFeedback', speechOutOfGrammarFeedback)
              .data('isMultiTdf', isMultiTdf)
              .html(name), audioInputEnabled, audioOutputEnabled,
      );
    });
  });
};

// We'll use this in card.js if audio input is enabled and user has provided a
// speech API key
Session.set('speechAPIKey', null);
