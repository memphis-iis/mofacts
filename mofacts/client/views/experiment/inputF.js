import {DialogueUtils} from './dialogueUtils';

Template.inputF.rendered = function() {
  this.$('input').focus();
};

Template.inputF.helpers({
  'fontSizeClass': function() {
    return 'h' + Session.get('currentDeliveryParams').fontsize.toString(); // Bootstrap classes
  },

  'inDialogueLoop': function() {
    return DialogueUtils.isUserInDialogueLoop();
  },

  'dialogueIntroExit': function() {
    return DialogueUtils.isUserInDialogueIntroExit();
  },
});

Template.inputForceCorrect.rendered = function() {
  this.$('input').focus();
};

Template.inputForceCorrect.helpers({
  'fontSizeClass': function() {
    return 'h' + Session.get('currentDeliveryParams').fontsize.toString(); // Bootstrap classes
  },
});
