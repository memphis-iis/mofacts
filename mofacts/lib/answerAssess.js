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
    return Helpers.trim(answer).indexOf(';') >= 0;
}

// Perform string comparison - possibly with edit distance considered.
// We return a "truthy" value if there is a match and 0 other wise. If the
// match was exact, we return 1. If we matched on edit distance, we return 2
function stringMatch(s1, s2, lfparameter) {
    s1 = Helpers.trim(s1).toLowerCase();
    s2 = Helpers.trim(s2).toLowerCase();

    if (s1.localeCompare(s2) === 0) {
        //Exact match!
        return 1;
    }
    else {
        //See if they were close enough
        if (!!lfparameter) {
            var editDistScore = 1.0 - (
                getEditDistance(s1, s2) /
                Math.max(s1.length, s2.length)
            );
            if (editDistScore >= lfparameter) {
                return 2;
            }
            else {
                return 0;
            }
        }
    }
}

// We perform regex matching, which is special in Mofacts. If the regex is
// "complicated", then we just match. However, if the regex is nothing but
// pipe-delimited (disjunction) strings that contain only letters, numbers,
// or underscores, then we manually match the pipe-delimited strings using
// the current levenshtein distance.
// ALSO notice that we use the same return values as stringMatch: 0 for no
// match, 1 for exact match, 2 for edit distance match
function regExMatch(regExStr, userAnswer, lfparameter) {
    if (lfparameter && /^[\|A-Za-z0-9]+$/i.test(regExStr)) {
        // They have an edit distance parameter and the regex matching our
        // special condition - check it manually
        var checks = Helpers.trim(regExStr).split('|');
        for(var i = 0; i < checks.length; ++i) {
            if (checks[i].length < 1)
                continue;  //No blank checks
            var matched = stringMatch(userAnswer, checks[i], lfparameter);
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

    var branches = Helpers.trim(answer).split(';');
    for(var i = 0; i < branches.length; ++i) {
        var flds = Helpers.trim(branches[i]).split('~');
        if (flds.length != 2)
            continue;

        flds[0] = Helpers.trim(flds[0]).toLowerCase();
        var matched = regExMatch(flds[0], userAnswer, lfparameter);
        if (matched !== 0) {
            matchText = Helpers.trim(flds[1]);
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
function branchingCorrectText(answer) {
    var result = "";

    var branches = Helpers.trim(answer).split(';');
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
    //Given the "raw" answer text from a cluster (in the response tag), return
    //an answer suitable for display (including on a button). Note that this
    //may be an empty string (for instance, if it's a branched answer)
    getDisplayAnswerText: function(answer) {
        return answerIsBranched(answer) ? branchingCorrectText(answer) : answer;
    },

    //Returns the close study question. For a branched response, we take the
    //correct text - but for a "normal" response, we construct the study by
    //"filling in the blanks"
    clozeStudy: function(question, answer) {
        var result = question; //Always succeed

        if (answerIsBranched(answer)) {
            //Branched = use first entry's text
            answer = branchingCorrectText(answer);
        }

        //Fill in the blank
        result = question.replace(/___+/g, answer);
        return result;
    },

    //Return [isCorrect, matchText] if userInput correctly matches answer -
    //taking into account both branching answers and edit distance
    answerIsCorrect: function(userInput, answer, setspec) {
        //Note that a missing or invalid lfparameter will result in a null value
        var lfparameter = _.chain(setspec).prop("lfparameter").first().floatval().value();

        if (answerIsBranched(answer)) {
            return matchBranching(answer, userInput, lfparameter);
        }
        else {
            var isCorrect, matchText;
            var match = stringMatch(userInput, answer, lfparameter);

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
                matchText = "Close enough to the correct answer '"+ answer + "'.";
            }
            else {
                console.log("MATCH ERROR: something fails in our comparison");
                isCorrect = false;
                matchText = "";
            }

            if (!matchText) {
                if (userInput === "") {
                    matchText = "The correct answer is " + answer + ".";
                }
                else {
                    matchText = isCorrect ? "Correct" :  "Incorrect. The correct answer is " + answer + ".";
                }
            }

            return [isCorrect, matchText];
        }
    },
};
