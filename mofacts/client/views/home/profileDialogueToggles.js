import {ReactiveDict} from 'meteor/reactive-dict';

Template.profileDialogueToggles.created = function() {
  // _randomizeSelectedDialogueType();
  let feedbackTypeDefault = Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].deliveryparams.feedbackType || "simple";
  //If the user is allowed to choose a feedback type then default to the last type chosen by this user for this tdf. 
  if(Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].deliveryparams.allowFeedbackTypeSelect){
    Session.set('selectedDialogueType', Session.get('feedbackTypeFromHistory') || feedbackTypeDefault);
  }
  else{
    Session.set('selectedDialogueType', feedbackTypeDefault);
  }
};

Template.profileDialogueToggles.events({

});

Template.profileDialogueToggles.helpers({
  isChecked: (type) => {
    return type === Session.get('selectedDialogueType');
  },
});
