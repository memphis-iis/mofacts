import {curSemester, STIM_PARAMETER, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {Tracker} from 'meteor/tracker';
import {DynamicTdfGenerator} from '../../../common/DynamicTdfGenerator';
import {rangeVal} from '../../lib/currentTestingHelpers';
import {meteorCallAsync} from '../..';

Template.contentGeneration.onRendered(async function() {
  if(Meteor.user() && Meteor.user().emails && Meteor.user().emails[0].address) {
    $('#sendToEmail').val(Meteor.user().emails[0].address)
  }
});

Template.contentGeneration.events({
  'click #submit-btn': function(event) {
    const inputText = $('#source-text').val();
    console.log('inputText: ' + inputText);
    const inputTextArray = inputText.split(/\s*###\s*/gm) //split input on ###, with optional whitespace
    const stringArrayJson = JSON.stringify(inputTextArray); 
    const compressionLevel = $('#compressionLevel').val();
    const userEmail = $('#sendToEmail').val();
    if(compressionLevel > .99 || compressionLevel < .01) {
      alert('Compression level must be between 0.01 and 0.99');
    } else {
      Meteor.call('generateContent', compressionLevel, stringArrayJson, inputText, userEmail);
      alert(`Content generation has begun. An email will be sent too ${userEmail} with your file when it is complete.`);
    }
  },
});

Template.contentGeneration.helpers({
});