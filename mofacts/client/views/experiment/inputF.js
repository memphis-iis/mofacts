import {DialogueUtils} from './dialogueUtils';

Template.inputF.rendered = function() {
  this.$('input').focus();
};

Template.inputF.helpers({
  'fontSizeClass': function() {
    return 'h' + Session.get('currentDeliveryParams').fontsize.toString(); // Bootstrap classes
  },

  'getFontSizeStyle': function() {
    const fontsize = Session.get('currentDeliveryParams') && Session.get('currentDeliveryParams').fontsize;
    if (fontsize) {
      return 'font-size: ' + fontsize + 'px;';
    }
    return '';
  },

  'inDialogueLoop': function() {
    return DialogueUtils.isUserInDialogueLoop();
  },

  'dialogueIntroExit': function() {
    return DialogueUtils.isUserInDialogueIntroExit();
  },
  'UISettings': function() {
    return Session.get('curTdfUISettings');
  }
});

Template.inputForceCorrect.rendered = function() {
  this.$('input').focus();
};

Template.inputForceCorrect.helpers({
  'fontSizeClass': function() {
    return 'h' + Session.get('currentDeliveryParams').fontsize.toString(); // Bootstrap classes
  },

  'getFontSizeStyle': function() {
    const fontsize = Session.get('currentDeliveryParams') && Session.get('currentDeliveryParams').fontsize;
    if (fontsize) {
      return 'font-size: ' + fontsize + 'px;';
    }
    return '';
  },
});
