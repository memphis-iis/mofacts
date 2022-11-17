import {curSemester, STIM_PARAMETER, MODEL_UNIT, SCHEDULE_UNIT} from '../../../common/Definitions';
import {Tracker} from 'meteor/tracker';
import {DynamicTdfGenerator} from '../../../common/DynamicTdfGenerator';
import {rangeVal} from '../../lib/currentTestingHelpers';
import {meteorCallAsync} from '../..';

Template.contentGeneration.onRendered(async function() {
  
});

Template.contentGeneration.events({
  'click #submit-btn': function(event) {
    const inputText = $('#source-text').val();
    console.log('inputText: ' + inputText);
    const inputTextArray = inputText.split(/\s*###\s*/gm) //split input on ###, with optional whitespace
    const stringArrayJson = JSON.stringify(inputTextArray); 
    const compressionLevel = $('#compressionLevel').val();
    if(compressionLevel > .99 || compressionLevel < .01) {
      alert('Compression level must be between 0.01 and 0.99');
    } else {
      Meteor.call('generateContent', compressionLevel, stringArrayJson, inputText);
    }
  },
});

Template.contentGeneration.helpers({
  
});