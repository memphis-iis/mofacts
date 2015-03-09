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

//Return true if the answer is a "branched answer"
function answerIsBranched(answer) {
    return Helpers.trim(answer).indexOf(';') >= 0;
}

//Return [isCorrect, matchText] where isCorrect is true if the user-supplied
//answer matches the first branch and matchText is the text response from a
//matching branch
function matchBranching(answer, userAnswer) {
    var isCorrect = false;
    var matchText = "";

    var branches = Helpers.trim(answer).split(';');
    for(var i = 0; i < branches.length; ++i) {
        var flds = branches[i].split('~');
        if (flds.length != 2)
            continue;

        if ( (new RegExp(flds[0])).test(userAnswer) ) {
            matchText = Helpers.trim(flds[1]);
            isCorrect = (i === 0);
            break;
        }
    }

    return [isCorrect, matchText];
}

Answers = {
    //Given the "raw" answer text from a cluster (in the response tag), return
    //an answer suitable for display (including on a button). Note that this
    //may be an empty string (for instance, if it's a branched answer)
    getDisplayAnswerText: function(answer) {
        return answerIsBranched(answer) ? "" : answer;
    },

    //Returns the close study question. For a branched response, we take the
    //correct text - but for a "normal" response, we construct the study by
    //"filling in the blanks"
    clozeStudy: function(question, answer) {
        var result = question; //Always succeed

        if (answerIsBranched(answer)) {
            //Branched = use first entry's text
            var branches = Helpers.trim(answer).split(';');
            if (branches.length > 0) {
                var flds = branches[0].split('~');
                if (flds.length == 2) {
                    result = flds[1];
                }
            }
        }
        else {
            //Fill in the blank
            result = question.replace(/___+/g, answer);
        }

        return result;
    },

    //Return [isCorrect, matchText] if userInput correctly matches answer -
    //taking into account both branching answers and edit distance
    answerIsCorrect: function(userInput, answer, setspec) {
        if (answerIsBranched(answer)) {
            return matchBranching(answer, userInput);
        }
        else {
            answer = Helpers.trim(answer).toLowerCase();
            userInput = Helpers.trim(userInput).toLowerCase();

            var isCorrect = false;
            var matchText = "";

            if (userInput.localeCompare(answer) === 0) {
                //Exact match!
                isCorrect = true;
                matchText = "Correct - Great Job!";
            }
            else {
                //See if they were close enough
                var lfparameter = null;
                if (setspec && setspec.lfparameter && setspec.lfparameter.length)
                    lfparameter = parseFloat(setspec.lfparameter[0]);

                if (!!lfparameter) {
                    var editDistScore = 1.0 - (
                        getEditDistance(userInput, answer) /
                        Math.max(userInput.length, answer.length)
                    );
                    if (Session.get("debugging")) {
                        console.log("Edit Dist Score", editDistScore, "lfparameter", lfparameter);
                    }

                    if (editDistScore >= lfparameter) {
                        isCorrect = true;
                        matchText = "Close enough - good job!";
                    }
                }
            }

            if (!matchText) {
                matchText = isCorrect ? "Correct" : "Incorrect - the answer is " + answer;
            }

            return [isCorrect, matchText];
        }
    },
};
