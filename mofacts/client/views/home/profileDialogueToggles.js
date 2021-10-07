import {ReactiveDict} from 'meteor/reactive-dict';

const _state = new ReactiveDict('dialogueSelectState');
const _availableDialogueTypes = ['simple', 'refutational', 'dialogue'];

const _randomizeSelectedDialogueType = () => {
  const rIdx = Math.floor(Math.random() * Math.floor(_availableDialogueTypes.length));
  _state.set('randomSelectedDialogueType', _availableDialogueTypes[rIdx]);
  _state.set('selectedDialogueType', _state.get('randomSelectedDialogueType'));
};

Template.profileDialogueToggles.created = function() {
  // _randomizeSelectedDialogueType();
  let feedbackTypeDefault = Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].deliveryparams.feedbackType || "simple";
  //If the user is allowed to choose a feedback type then default to the last type chosen by this user for this tdf. 
  if(Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].deliveryparams.allowFeedbackTypeSelect){
    _state.set('selectedDialogueType', Session.get('feedbackTypeFromHistory') || feedbackTypeDefault);
  }
  else{
    _state.set('selectedDialogueType', feedbackTypeDefault);
  }
};

Template.profileDialogueToggles.events({
  'click .dialogueSelectRadio': (event) => {
    _state.set('selectedDialogueType',
        event.currentTarget.getAttribute('data-dialogue-type'));
  },

});

Template.profileDialogueToggles.helpers({
  isChecked: (type) => {
    return type === _state.get('selectedDialogueType');
  },
});

export {_state as dialogueSelectState};
