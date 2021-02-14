import { ReactiveDict } from 'meteor/reactive-dict';

const _state = new ReactiveDict('dialogueSelectState');
const _availableDialogueTypes = ["simple", "refutational", "dialogue"];

const _randomizeSelectedDialogueType = () => {
  const rIdx = Math.floor(Math.random() * Math.floor(_availableDialogueTypes.length));
  _state.set("randomSelectedDialogueType", _availableDialogueTypes[rIdx]);
  let selectedDialogueType = _state.get("randomSelectedDialogueType");
  _state.set("selectedDialogueType", selectedDialogueType);
  Meteor.call('setUserDialogueTypeState',Meteor.userId(),selectedDialogueType);
}

Template.profileDialogueToggles.rendered = function() {
  let dialogueToggleState = Meteor.user().dialogueToggleState;
  if(dialogueToggleState){
    _state.set("randomSelectedDialogueType", dialogueToggleState);
    _state.set("selectedDialogueType", dialogueToggleState);
  }else{
    _randomizeSelectedDialogueType();
  }
}

Template.profileDialogueToggles.events({
  'click .dialogueSelectRadio': event => {
    let selectedDialogueType = event.currentTarget.getAttribute("data-dialogue-type");
    _state.set("selectedDialogueType", selectedDialogueType);
    Meteor.call('setUserDialogueTypeState',Meteor.userId(),selectedDialogueType);
  }
});

Template.profileDialogueToggles.helpers({
  isChecked: type => {
    return type === _state.get("randomSelectedDialogueType");
  }
});

exports.dialogueSelectState = _state;