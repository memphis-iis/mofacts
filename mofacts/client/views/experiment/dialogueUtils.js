import { speakMessageIfAudioPromptFeedbackEnabled, startRecording, stopRecording, clearScrollList, scrollList } from './card.js';
export { dialogueLoop, dialogueContinue, initiateDialogue };
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
  };

dialogueUserAnswers = [];
dialogueContext = undefined;
let dialogueUserPrompts = [];
let dialogueCurrentDisplaySaver = undefined;
let dialogueCallbackSaver = undefined;
let endDialogueNotice = " Press the button to continue practice.";

let dialogueTransitionInstructions = "  Press the button to continue.";
let dialogueTransitionStatements = [
    "That wasn’t right, so to help you build the knowledge let’s chat about it for a little.",
    "That wasn’t the answer we are looking for. To help you construct the understanding, let’s have a short discussion.",
    "Sorry, but that wasn’t quite right. Let’s talk through this item.",
    "Incorrect. Lets help you build that knowledge with a brief discussion.",
    "The right answer is different. To get you started learning it, let’s chat.",
    "Your answer was incorrect. Let’s talk about this some more.",
    "Not quite. I’m going to ask you some follow up questions."
]          

function updateDialogueDisplay(newDisplay){
    Session.set("displayReady",false);
    //set prompt and feedback here
    let displayWrapper = { 'text': newDisplay }
    Session.set("currentDisplay",displayWrapper);
    $("#dialogueUserAnswer").prop("disabled",false);

    if(dialogueContext.LastQuestion){//previous context exists
        let historyPrompt = dialogueContext.LastQuestion.Text;
        let historyUserAnswer = dialogueContext.LastStudentAnswer;
        let currCount = Session.get("scrollListCount") || 0;
    
        scrollList.insert({
            'temp': 1,                       // Deleted when clearing
            'justAdded': 0,          // All 1's set to 0 on next question
            'idx': currCount,                // Our ordering field
            'answer': historyUserAnswer,
            'question': historyPrompt,
            'userCorrect': true
        }, function(err, newId) {
            if (!!err) {
                console.log("ERROR inserting scroll list member:", displayify(err));
            }
            Session.set("scrollListCount", currCount + 1);
        });
    }

    $("#dialogueUserAnswer").val("");
    Session.set("displayReady",true);
    Tracker.afterFlush(function(){
        console.log("dialogue after flush");
        $("#dialogueUserAnswer").focus();
    });
}

function dialogueLoop(err,res){
    console.log("dialogue loop");
    stopRecording();
    console.log("dialogueLoop-res",res);
    if(typeof(err) != "undefined"){
        console.log("error with dialogue loop, meteor call: ",err);
        console.log(res);
    }else if(res.tag != 0){
        console.log("error with dialog loop, dialogue call: " + res.name);
        console.log(res);
    }else if(res.tag == 0){
        let result = res.fields[0];
        let newDisplay = result.Display;
        
        if(result.Finished){
            newDisplay = result.Display + endDialogueNotice;
            Session.set("dialogueLoopStage","exit");
            trialEndTimestamp = Date.now();
        }else{
            startRecording();
        }
        updateDialogueDisplay(newDisplay);
        speakMessageIfAudioPromptFeedbackEnabled(newDisplay, false, "dialogue");
        dialogueContext = result;
        dialogueUserPrompts.push(newDisplay);
        //wait for user input
    }
    Meteor.setTimeout(() => {
        enterKeyLock = false; 
        console.log("releasing enterKeyLock in dialogueLoop");
    }, 2000); 
}

function dialogueContinue(){
    console.log("dialogueContinue");
    let dialogueLoopStage = Session.get("dialogueLoopStage");
    switch(dialogueLoopStage){
        case "intro":
            //Enter dialogue loop
            Session.set("displayReady",false); //This will get flipped back after we update the display inside dialogueLoop
            Session.set("dialogueLoopStage","insideLoop");
            Meteor.call('getDialogFeedbackForAnswer',dialogueContext,dialogueLoop);
        break;
        case "exit":
            //Exit dialogue loop
            console.log("dialogue loop finished, restoring state");
            Session.set("displayReady",false);
            Session.set("dialogueLoopStage",undefined);
            //restore session state
            Session.set("currentDisplay",dialogueCurrentDisplaySaver);
            console.log("finished, exiting dialogue loop");
            dialogueContext.UserPrompts = JSON.parse(JSON.stringify(dialogueUserPrompts));
            dialogueContext.UserAnswers = JSON.parse(JSON.stringify(dialogueUserAnswers));
            dialogueUserPrompts = [];
            dialogueUserAnswers = [];
            clearScrollList();
            Session.set("dialogueHistory",dialogueContext);
            dialogueCallbackSaver();
        default:
            enterKeyLock = false;
            console.log("releasing enterKeyLock in dialogueContinue");
    }
}

async function initiateDialogue(incorrectUserAnswer,callback,lookupFailCallback){
  dialogueContext = undefined;
  let clozeQuestionParts = Session.get("clozeQuestionParts");
  Session.set("clozeQuestionParts",undefined);
  Session.set("dialogueLoopStage","intro");
  dialogueCurrentDisplaySaver = JSON.parse(JSON.stringify(Session.get("currentDisplay")));
  let clozeItem = Session.get("originalQuestion") || Session.get("currentDisplay").clozeText;
  let clozeAnswer = Session.get("originalAnswer") || Session.get("currentAnswer");
  
  dialogueCallbackSaver = callback;
  //wait for user to hit enter to make sure they read the transition statement
  //execution thread continues at keypress #dialogueUserAnswer in card.js
  console.log("starting dialogue loop:",clozeAnswer, incorrectUserAnswer, clozeItem);
  Meteor.call('initializeTutorialDialogue',clozeAnswer, incorrectUserAnswer, clozeItem, (err,res)=>{
      if(err){
        console.log("ERROR initializing tutorial dialogue:",err);
      }else{
        if(res.tag != 0){
            console.log("cache miss, showing normal feedback:");
            Session.set("dialogueHistory",res);
            dialogueCallbackSaver = undefined;
            dialogueContext = undefined;
            console.log("dialogueHistory",Session.get("dialogueHistory"));
            Session.set("dialogueLoopStage",undefined);
            let buttonEntries = JSON.parse(JSON.stringify(Session.get("buttonEntriesTemp") || ""));
            Session.set("buttonEntriesTemp",undefined);
            for(let button of buttonEntries){
                buttonList.insert(button);
            }
            Session.set("clozeQuestionParts",clozeQuestionParts);
            lookupFailCallback();
        }else{
            dialogueContext = res.fields[0];
            if(!dialogueContext){
                console.log("ERROR getting context during dialogue initialization");
            }else{
                let transitionStatement = dialogueTransitionStatements[Math.floor(Math.random() * dialogueTransitionStatements.length)] + dialogueTransitionInstructions;
                updateDialogueDisplay(transitionStatement);
                speakMessageIfAudioPromptFeedbackEnabled(transitionStatement, false, "dialogue");
            }
        }
      }
  });
}
