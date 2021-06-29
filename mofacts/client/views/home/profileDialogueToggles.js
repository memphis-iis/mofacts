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
  _state.set('selectedDialogueType', 'simple');
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
