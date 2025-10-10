import {DialogueUtils} from './dialogueUtils';

Template.inputF.rendered = function() {
  this.$('input').focus();
};

Template.inputF.helpers({
  'fontSizeClass': function() {
    const params = Session.get('currentDeliveryParams');
    return params ? 'h' + params.fontsize.toString() : 'h2'; // Bootstrap classes, default h2
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
    const params = Session.get('currentDeliveryParams');
    return params ? 'h' + params.fontsize.toString() : 'h2'; // Bootstrap classes, default h2
  },

  'getFontSizeStyle': function() {
    const fontsize = Session.get('currentDeliveryParams') && Session.get('currentDeliveryParams').fontsize;
    if (fontsize) {
      return 'font-size: ' + fontsize + 'px;';
    }
    return '';
  },
});
