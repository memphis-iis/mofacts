import {DialogueUtils} from './dialogueUtils';

// REMOVED: Focus is handled by allowUserInput() in card.js:3714 after fade-in completes
// Calling focus here causes race conditions:
// 1. Fires before opacity transition completes (input invisible to user)
// 2. Conflicts with dialogue mode focus in dialogueUtils.js:58
// 3. Causes double screen reader announcements for accessibility users
// Template.inputF.rendered = function() {
//   this.$('input').focus();
// };

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
    return params && params.fontsize ? 'h' + params.fontsize.toString() : 'h2'; // Bootstrap classes, default h2
  },

  'getFontSizeStyle': function() {
    const fontsize = Session.get('currentDeliveryParams') && Session.get('currentDeliveryParams').fontsize;
    if (fontsize) {
      return 'font-size: ' + fontsize + 'px;';
    }
    return '';
  },
});
