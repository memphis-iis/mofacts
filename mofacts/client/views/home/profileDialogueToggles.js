import { ReactiveDict } from 'meteor/reactive-dict';

const _state = new ReactiveDict('dialogueSelectState');
const _availableDialogueTypes = ["simple", "refutational", "dialogue"];

const _randomizeSelectedDialogueType = async () => {
  const rIdx = Math.floor(Math.random() * Math.floor(_availableDialogueTypes.length));
  _state.set("randomSelectedDialogueType", _availableDialogueTypes[rIdx]);
  let selectedDialogueType = _state.get("randomSelectedDialogueType");
  _state.set("selectedDialogueType", selectedDialogueType);
  await Meteor.call('setUserDialogueTypeState',Meteor.userId(),selectedDialogueType);
}

Template.profileDialogueToggles.rendered = async function() {
  let dialogueTypeState = Meteor.user().dialogueTypeState;
  if(dialogueTypeState){
    console.log("profileDialogueToggles,state exists:",dialogueTypeState);
    _state.set("randomSelectedDialogueType", dialogueTypeState);
    _state.set("selectedDialogueType", dialogueTypeState);
  }else{
    console.log("profileDialogueToggles,state doesn't exist:",dialogueTypeState);
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