/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
Template.inputF.rendered = function() {
    this.$('input').focus();
};

Template.inputF.helpers({
    'fontSizeClass': function() {
        return 'h' + getCurrentFontSize().toString();  //Bootstrap classes
    },

    'inDialogueLoop': function(){
      return typeof(Session.get("dialogueLoopStage")) != "undefined";
    },
    
    'dialogueIntroExit': function(){
        return Session.get("dialogueLoopStage") == "intro" || Session.get("dialogueLoopStage") == "exit";
    }
});

Template.inputForceCorrect.rendered = function() {
    this.$('input').focus();
};

Template.inputForceCorrect.helpers({
    'fontSizeClass': function() {
        return 'h' + getCurrentFontSize().toString();  //Bootstrap classes
    },
});
