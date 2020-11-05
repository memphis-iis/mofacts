export const DialogueUtils = {
  isUserInDialogueLoop: function() {
    return Session.get("dialogueLoopStage") != undefined;
  },

  setDialogueUserAnswerValue: function(val) {
    $('#dialogueUserAnswer').val(val);
  },

  getDialogueUserAnswerValue: function() {
    return $('#dialogueUserAnswer').val();
  }
}