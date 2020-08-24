/* answerAssess.js
 *
 * Provide support assessing user answers
 *
 * Note that this module makes no assumptions about session variables.
 *
 * This functionality is separated out mainly to support "branched" answers.
 * They are semi-colon delimited branches which each consist of a regex for
 * matching the answer and a customized response:
 *
 *     regex~message;regex~message;regex~message
 *
 * The first branch is assumed to be the "correct answer" match, while the
 * rest are matches for potential incorrect answers.
 * */


function capFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

//Return true if the answer is a "branched answer"
function answerIsBranched(answer) {
    return _.trim(answer).indexOf(';') >= 0;
}

checkIfUserAnswerMatchesOtherAnswers = function(userAnswer,correctAnswer){
  otherQuestionAnswers = getAllCurrentStimAnswers().filter(x => x !== correctAnswer);
  for(var i=0;i<otherQuestionAnswers.length;i++){
    var stimStr = otherQuestionAnswers[i];
    //split on ; and take first value because the first value is the correct branch in an answer
    var checks = _.trim(_.trim(stimStr).split(';')[0]).split('|');
    for(var j=0; j < checks.length; j++) {
        if (checks[j].length < 1)
            continue;  //No blank checks
        checks[j] = _.trim(checks[j]).toLowerCase();
        if(userAnswer.localeCompare(checks[j]) === 0){
          return true;
        }
    }
  }
  return false;
}

function simpleStringMatch(userAnswer, correctAnswer, lfparameter, fullAnswerStr) {
    var s1 = _.trim(userAnswer).toLowerCase();
    var s2 = _.trim(correctAnswer).toLowerCase();
    var fullAnswerText = _.trim(fullAnswerStr).toLowerCase();

    if (s1.localeCompare(s2) === 0) {
        //Exact match!
        return 1;
    }
    else {
        //See if they were close enough
        if (!!lfparameter) {
            let checkOtherAnswers = getCurrentDeliveryParams().checkOtherAnswers;
            //Check to see if the user answer is an exact match for any other answers in the stim file,
            //If not we'll do an edit distance calculation to determine if they were close enough to the correct answer
            if(checkOtherAnswers && checkIfUserAnswerMatchesOtherAnswers(s1,fullAnswerText)){
              return 0;
            }else{
              let editDistance = getEditDistance(s1, s2)
              var editDistScore = 1.0 - (
                  editDistance /
                  Math.max(s1.length, s2.length)
              );
              if (editDistScore >= lfparameter || editDistance <= 1) {
                  return 2;  //Close enough
              }
              else {
                  return 0;  //No match
              }
            }
        }
        else {
            //Nope - must compare exactly
            return 0;
        }
    }
}

// Perform string comparison - possibly with edit distance considered.
// We return a "truthy" value if there is a match and 0 other wise. If the
// match was exact, we return 1. If we matched on edit distance, we return 2.
// We also support a |-only regex(-ish) format (which is also honored by our
// regex search)
function stringMatch(stimStr, userAnswer, lfparameter) {
    if (/^[\|A-Za-z0-9 \.\%]+$/i.test(stimStr)) {
        // They have the regex matching our special condition - check it manually
        var checks = _.trim(stimStr).split('|');
        for(var i = 0; i < checks.length; ++i) {
            if (checks[i].length < 1)
                continue;  //No blank checks
            var matched = simpleStringMatch(userAnswer, checks[i], lfparameter, stimStr);
            if (matched !== 0) {
                return matched; //Match!
            }
        }
        return 0; //Nothing found
    }
    else {
        return simpleStringMatch(userAnswer, stimStr, lfparameter, stimStr);
    }
}

// We perform regex matching, which is special in Mofacts. If the regex is
// "complicated", then we just match. However, if the regex is nothing but
// pipe-delimited (disjunction) strings that contain only letters, numbers,
// or underscores, then we manually match the pipe-delimited strings using
// the current levenshtein distance.
// ALSO notice that we use the same return values as stringMatch: 0 for no
// match, 1 for exact match, 2 for edit distance match
function regExMatch(regExStr, userAnswer, lfparameter,fullAnswer) {
    if (lfparameter && /^[\|A-Za-z0-9 ]+$/i.test(regExStr)) {
        // They have an edit distance parameter and the regex matching our
        // special condition - check it manually
        var checks = _.trim(regExStr).split('|');
        for(var i = 0; i < checks.length; ++i) {
            if (checks[i].length < 1)
                continue;  //No blank checks
            var matched = simpleStringMatch(userAnswer, checks[i], lfparameter, fullAnswer);
            if (matched !== 0) {
                return matched; //Match!
            }
        }
        return 0; //Nothing found
    }
    else {
        // Just use the regex as given
        return (new RegExp(regExStr)).test(userAnswer) ? 1 : 0;
    }
}

//Return [isCorrect, matchText] where isCorrect is true if the user-supplied
//answer matches the first branch and matchText is the text response from a
//matching branch
function matchBranching(answer, userAnswer, lfparameter) {
    var isCorrect = false;
    var matchText = "";
    var userAnswerCheck = _.trim(userAnswer).toLowerCase();

    var branches = _.trim(answer).split(';');
    for(var i = 0; i < branches.length; ++i) {
        var flds = _.trim(branches[i]).split('~');
        if (flds.length != 2)
            continue;

        flds[0] = _.trim(flds[0]).toLowerCase();
        var matched = regExMatch(flds[0], userAnswerCheck, lfparameter,answer);
        if (matched !== 0) {
            matchText = _.trim(flds[1]);
            if (matched === 2) {
                matchText = matchText + " (you were close enough)";
            }
            isCorrect = (i === 0);
            break;
        }
    }

    return [isCorrect, matchText];
}

//Return the text of the "correct" (the first) branch
function _branchingCorrectText(answer) {
    var result = "";

    var branches = _.trim(answer).split(';');
    if (branches.length > 0) {
        var flds = branches[0].split('~');
        if (flds.length == 2) {
            result = flds[0];
        }
    }

    result = result.split('|');
    return result[0];
}

Answers = {
    branchingCorrectText: _branchingCorrectText,

    //Given the "raw" answer text from a cluster (in the response tag), return
    //an answer suitable for display (including on a button). Note that this
    //may be an empty string (for instance, if it's a branched answer)
    getDisplayAnswerText: function(answer) {
        return answerIsBranched(answer) ? _branchingCorrectText(answer) : answer;
    },

    //Returns the close study question. For a branched response, we take the
    //correct text - but for a "normal" response, we construct the study by
    //"filling in the blanks"
    clozeStudy: function(question, answer) {
        var result = question; //Always succeed

        if (answerIsBranched(answer)) {
            //Branched = use first entry's text
            answer = _branchingCorrectText(answer);
        }

        //Fill in the blank
        result = question.replace(/___+/g, answer);
        return result;
    },

    //Return [isCorrect, matchText] if userInput correctly matches answer -
    //taking into account both branching answers and edit distance
    answerIsCorrect: function(userInput, answer, originalAnswer, setspec,callback) {
        //Note that a missing or invalid lfparameter will result in a null value
        var lfparameter = _.chain(setspec).prop("lfparameter").first().floatval().value();
        let feedbackType = getCurrentDeliveryParams().feedbackType;

        checkAnswer = function(userAnswer,correctAnswer, originalAnswer){
            let answerDisplay = originalAnswer || correctAnswer;
            let isCorrect, matchText;
            if (answerIsBranched(correctAnswer)) {
                [isCorrect,matchText] = matchBranching(correctAnswer, userAnswer, lfparameter);
            }
            else {    
                var dispAnswer = _.trim(answerDisplay);
                if (dispAnswer.indexOf("|") >= 0) {
                    // Take first answer if it's a bar-delimited string
                    dispAnswer = _.trim(dispAnswer.split("|")[0]);
                }
    
                var match = stringMatch(correctAnswer, userAnswer, lfparameter);
    
                if (match === 0) {
                    isCorrect = false;
                    matchText = "";
                }
                else if (match === 1) {
                    isCorrect = true;
                    matchText = "Correct.";
                }
                else if (match === 2) {
                    isCorrect = true;
                    matchText = "Close enough to the correct answer '"+ dispAnswer + "'.";
                }
                else {
                    console.log("MATCH ERROR: something fails in our comparison");
                    isCorrect = false;
                    matchText = "";
                }
    
                if (!matchText) {
                    if (userAnswer === "") {
                        matchText = "The correct answer is " + dispAnswer + ".";
                    }else{
                      matchText = isCorrect ? "Correct" :  "Incorrect. The correct answer is " + dispAnswer + ".";
                  }
                }
            }
            return {isCorrect, matchText};
        }

        let fullTextIsCorrect = checkAnswer(userInput,answer,originalAnswer);

        //Try again with original answer in case we did a syllable answer and they input the full response
        if(!fullTextIsCorrect.isCorrect && !!originalAnswer){
            fullTextIsCorrect = checkAnswer(userInput,originalAnswer,originalAnswer);
        }

        if(!fullTextIsCorrect.isCorrect){
            switch(feedbackType){
                case "refutational":
                    let answerToCheck = originalAnswer || answer;
                    Meteor.call('getSimpleFeedbackForAnswer',userInput,answerToCheck,function(err,res){
                        console.log("simpleFeedback, err: " + JSON.stringify(err) + ", res: " + JSON.stringify(res));
                        if(typeof(err) != "undefined"){
                            console.log("error with refutational feedback, meteor call: ",err);
                            console.log(res);
                            callback(fullTextIsCorrect);
                        }else if(res.tag != 0){
                            console.log("error with refutational feedback, feedback call: " + res.name);
                            console.log(res);
                            callback(fullTextIsCorrect);
                        }else if(res.tag == 0){
                            let refutationalFeedback = res.fields[0].feedback;
                            
                            if(typeof(refutationalFeedback) != "undefined" && refutationalFeedback != null){
                                fullTextIsCorrect.matchText = refutationalFeedback;
                            }
                            callback(fullTextIsCorrect);
                        }  
                    });
                break;
                case "dialogue":
                    Session.set("clozeQuestionParts",undefined);
                    Session.set("dialogueLoopStage","intro");
                    dialogueCurrentDisplaySaver = JSON.parse(JSON.stringify(Session.get("currentDisplay")));
                    let clozeItem = Session.get("originalQuestion") || Session.get("currentDisplay").clozeText;
                    let clozeAnswer = Session.get("originalAnswer") || Session.get("currentAnswer");
                    dialogueContext = {
                        "ClozeItem": clozeItem,
                        "ClozeAnswer": clozeAnswer
                    };

                    let transitionStatement = dialogueTransitionStatements[Math.floor(Math.random() * dialogueTransitionStatements.length)] + dialogueTransitionInstructions;
                    updateDialogueDisplay(transitionStatement);

                    dialogueCallbackSaver = callback.bind(null,fullTextIsCorrect);
                    //wait for user to hit enter to make sure they read the transition statement
                break;
                default:
                    callback(fullTextIsCorrect)
            }
            
        }else{
            callback(fullTextIsCorrect);
        }
    },
};

dialogueUserPrompts = [];
dialogueUserAnswers = [];
dialogueContext = undefined;
dialogueCurrentDisplaySaver = undefined;
dialogueCallbackSaver = undefined;

let dialogueTransitionStatements = [
    "That wasn’t right, so to help you build the knowledge let’s chat about it for a little.",
    "That wasn’t the answer we are looking for. To help you construct the understanding, let’s have a short discussion.",
    "Sorry, but that wasn’t quite right. Let’s talk through this item.",
    "Incorrect. Lets help you build that knowledge with a brief discussion.",
    "The right answer is different. To get you started learning it, let’s chat.",
    "Your answer was incorrect. Let’s talk about this some more.",
    "Not quite. I’m going to ask you some follow up questions."
]          

let dialogueTransitionInstructions = "  Press the button to continue.";

let endDialogueNotice = " Press the button to continue practice.";

function updateDialogueDisplay(newDisplay){
    //set prompt and feedback here
    let displayWrapper = { 'text': newDisplay }
    Session.set("currentDisplay",displayWrapper);
    Tracker.afterFlush(function(){
        console.log("dialogue after flush");
        $("#dialogueUserAnswer").focus();
    });
}

dialogueLoop = function(err,res){
    console.log("dialogue loop");
    if(typeof(err) != "undefined"){
        console.log("error with dialogue loop, meteor call: ",err);
        console.log(res);
        callback(fullTextIsCorrect);
    }else if(res.tag != 0){
        console.log("error with dialog loop, dialogue call: " + res.name);
        console.log(res);
        callback(fullTextIsCorrect);
    }else if(res.tag == 0){
        let result = res.fields[0];
        let newDisplay = result.Display;
        
        if(result.Finished){
            newDisplay = result.Display + endDialogueNotice;
            Session.set("dialogueLoopStage","exit");
        }
        updateDialogueDisplay(newDisplay);
        dialogueContext = result;
        dialogueUserPrompts.push(newDisplay);
        //wait for user input
    }
    Meteor.setTimeout(() => {
        enterKeyLock = false; 
        console.log("releasing enterKeyLock in dialogueLoop");
    }, 2000); 
}

dialogueContinue = function(){
    console.log("dialogueContinue");
    let dialogueLoopStage = Session.get("dialogueLoopStage");

    switch(dialogueLoopStage){
        case "intro":
            //Enter dialogue loop
            Session.set("dialogueLoopStage","insideLoop");
            Meteor.call('getDialogFeedbackForAnswer',dialogueContext,dialogueLoop);
        break;
        case "exit":
            //Exit dialogue loop
            console.log("dialogue loop finished, restoring state");
            Session.set("dialogueLoopStage",undefined);
            //restore session state
            Session.set("currentDisplay",dialogueCurrentDisplaySaver);
            console.log("finished, exiting dialogue loop");
            dialogueContext.UserPrompts = JSON.parse(JSON.stringify(dialogueUserPrompts));
            dialogueContext.UserAnswers = JSON.parse(JSON.stringify(dialogueUserAnswers));
            dialogueUserPrompts = [];
            dialogueUserAnswers = [];
            Session.set("dialogueHistory",dialogueContext);
            dialogueCallbackSaver();
        default:
            enterKeyLock = false;
            console.log("releasing enterKeyLock in dialogueContinue");
    }
}