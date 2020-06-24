Template.dialogueLoop.helpers({
    'fontSizeClass': function() {
        return 'h' + getCurrentFontSize().toString();  //Bootstrap classes
    },

    'dialogueIntroExit': function(){
        return Session.get("dialogueLoopStage") == "intro" || Session.get("dialogueLoopStage") == "exit";
    }
});