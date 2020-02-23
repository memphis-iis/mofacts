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
            //Check to see if the user answer is an exact match for any other answers in the stim file,
            //If not we'll do an edit distance calculation to determine if they were close enough to the correct answer
            if(checkIfUserAnswerMatchesOtherAnswers(s1,fullAnswerText)){
              return 0;
            }else{
              var editDistScore = 1.0 - (
                  getEditDistance(s1, s2) /
                  Math.max(s1.length, s2.length)
              );
              if (editDistScore >= lfparameter) {
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
    answerIsCorrect: function(userInput, answer, originalAnswer, setspec) {
        //Note that a missing or invalid lfparameter will result in a null value
        var lfparameter = _.chain(setspec).prop("lfparameter").first().floatval().value();

        checkAnswer = function(userAnswer,correctAnswer, originalAnswer){
            let answerDisplay = originalAnswer || correctAnswer;
            if (answerIsBranched(correctAnswer)) {
                return matchBranching(correctAnswer, userAnswer, lfparameter);
            }
            else {
                var isCorrect, matchText;
    
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
                    }
                  else {
                    if(!getFeedbackForFalseResponse(userAnswer)){
                      matchText = isCorrect ? "Correct" :  "Incorrect. The correct answer is " + dispAnswer + ".";
                    } else {
                      matchText = isCorrect ? "Correct" : getFeedbackForFalseResponse(userAnswer);
                    }
                  }
                }
    
                return [isCorrect, matchText];
            }
        }

        let fullTextIsCorrect = checkAnswer(userInput,answer,originalAnswer);
        if(!fullTextIsCorrect[0] && !!originalAnswer){
            return checkAnswer(userInput,originalAnswer,originalAnswer);
        }else{
            return fullTextIsCorrect;
        }
    },
};
