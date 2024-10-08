/* eslint-disable no-useless-escape */
import {getAllCurrentStimAnswers} from '../../lib/currentTestingHelpers';
import {doubleMetaphone} from 'double-metaphone'
import { meteorCallAsync } from '../../index';

export {Answers};

/*
Copyright (c) 2011 Andrei Mackenzie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/


// Compute the edit distance between the two given strings
function getEditDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  // increment along the first column of each row
  let i;
  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  // increment each column in the first row
  let j;
  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) == a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(matrix[i-1][j-1] + 1, // substitution
            Math.min(matrix[i][j-1] + 1, // insertion
                matrix[i-1][j] + 1)); // deletion
      }
    }
  }

  return matrix[b.length][a.length];
}

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
// Return true if the answer is a "branched answer"
function answerIsBranched(answer) {
  return _.trim(answer).indexOf(';') >= 0;
}

function checkIfUserAnswerMatchesOtherAnswers(userAnswer, correctAnswer) {
  const otherQuestionAnswers = getAllCurrentStimAnswers().filter((x) => x !== correctAnswer);
  for (let i=0; i<otherQuestionAnswers.length; i++) {
    const stimStr = otherQuestionAnswers[i];
    // split on ; and take first value because the first value is the correct branch in an answer
    const checks = _.trim(_.trim(stimStr).split(';')[0]).split('|');
    for (let j=0; j < checks.length; j++) {
      if (checks[j].length < 1) {
        continue;
      } // No blank checks
      checks[j] = _.trim(checks[j]).toLowerCase();
      if (userAnswer.localeCompare(checks[j]) === 0) {
        return true;
      }
    }
  }
  return false;
}

async function simpleStringMatch(userAnswer, correctAnswer, lfparameter, fullAnswerStr) {
  const s1 = _.trim(userAnswer).toLowerCase();
  const s2 = _.trim(correctAnswer).toLowerCase();
  const fullAnswerText = _.trim(fullAnswerStr).toLowerCase();
  const deliveryParams = Session.get('currentDeliveryParams');
  const useSpellingCorrection = deliveryParams.useSpellingCorrection || false;
  const allowPhoneticMatching = deliveryParams.allowPhoneticMatching || false;

  if (s1.localeCompare(s2) === 0) {
    // Exact match!
    return 1;
  } 
  else {
    // See if they were close enough
    if (lfparameter || useSpellingCorrection) {
      const checkOtherAnswers = deliveryParams.checkOtherAnswers;
      // Check to see if the user answer is an exact match for any other answers in the stim file,
      // If not we'll do an edit distance calculation to determine if they were close enough to the correct answer
      let matchOther;
      if (checkOtherAnswers) {
        matchOther = checkIfUserAnswerMatchesOtherAnswers(s1, fullAnswerText);
      }
      if (checkOtherAnswers && matchOther) {
        return 0;
      } 
    }
    if(useSpellingCorrection) {
      let editDistance = deliveryParams.editDistance ? deliveryParams.editDistance : 1;
      const results = await meteorCallAsync('getSymSpellCorrection', s1, s2, editDistance);
      if(results) {
        return 2; //Close enough
      } 
      else if(allowPhoneticMatching) {//enable phonetic encoding
        const metaphone1 = doubleMetaphone(s1);
        const metaphone2 = doubleMetaphone(s2);
        if(compareMetaphones(metaphone1, metaphone2))
          return 3; //Metaphone match
      } 
      else {
        return 0; //No match
      }
    }
    if (lfparameter) {
      const editDistance = getEditDistance(s1, s2);
      const editDistScore = 1.0 - (
        editDistance /
                Math.max(s1.length, s2.length)
      );
      if (editDistScore >= lfparameter) {
        return 2; // Close enough
      } 
      else if(allowPhoneticMatching) {//enable phonetic encoding
        const metaphone1 = doubleMetaphone(s1);
        const metaphone2 = doubleMetaphone(s2);
        if(compareMetaphones(metaphone1, metaphone2))
          return 3; // Metaphone match
      } 
      else {
      return 0; // No match
      }
    } 
    else {
      // Nope - must compare exactly
      return 0;
    }
  }
}

//compares metaphones generated by doubleMetaphone. 
//If m1 or m2 have one metaphone in common return true. 
function compareMetaphones(m1, m2){
  return m2.includes(m1[0]) || m2.includes(m1[1])
}

// Perform string comparison - possibly with edit distance considered.
// We return a "truthy" value if there is a match and 0 other wise. If the
// match was exact, we return 1. If we matched on edit distance, we return 2.
// We also support a |-only regex(-ish) format (which is also honored by our
// regex search)
async function stringMatch(stimStr, userAnswer, lfparameter, userInput) {
  if (userInput === '' || userAnswer === ''){
    //user didnt enter a response.
    return 0;
  } else if (/^[\|A-Za-z0-9 \.\%]+$/i.test(stimStr)) {
    // They have the regex matching our special condition - check it manually
    const checks = _.trim(stimStr).split('|');
    for (let i = 0; i < checks.length; ++i) {
      if (checks[i].length < 1) {
        continue;
      } // No blank checks
      const matched = await simpleStringMatch(userAnswer, checks[i], lfparameter, stimStr);
      if (matched !== 0) {
        return matched; // Match!
      }
    }
    return 0; // Nothing found
  } else {
    return await simpleStringMatch(userAnswer, stimStr, lfparameter, stimStr);
  }
}

// We perform regex matching, which is special in Mofacts. If the regex is
// "complicated", then we just match. However, if the regex is nothing but
// pipe-delimited (disjunction) strings that contain only letters, numbers,
// or underscores, then we manually match the pipe-delimited strings using
// the current levenshtein distance.
// ALSO notice that we use the same return values as stringMatch: 0 for no
// match, 1 for exact match, 2 for edit distance match
async function regExMatch(regExStr, userAnswer, lfparameter, fullAnswer) {
  if (lfparameter && /^[\|A-Za-z0-9 ]+$/i.test(regExStr)) {
    // They have an edit distance parameter and the regex matching our
    // special condition - check it manually
    const checks = _.trim(regExStr).split('|');
    for (let i = 0; i < checks.length; ++i) {
      if (checks[i].length < 1) {
        continue;
      } // No blank checks
      const matched = await simpleStringMatch(userAnswer, checks[i], lfparameter, fullAnswer);
      if (matched !== 0) {
        return matched; // Match!
      }
    }
    return 0; // Nothing found
  } else {
    // Just use the regex as given
    return (new RegExp(regExStr)).test(userAnswer) ? 1 : 0;
  }
}

// Return [isCorrect, matchText] where isCorrect is true if the user-supplied
// answer matches the first branch and matchText is the text response from a
// matching branch
async function matchBranching(answer, userAnswer, lfparameter) {
  let isCorrect = false;
  let matchText = '';
  const userAnswerCheck = _.trim(userAnswer).toLowerCase();

  const branches = _.trim(answer).split(';');
  for (let i = 0; i < branches.length; ++i) {
    const flds = _.trim(branches[i]).split('~');
    if (flds.length != 2) {
      continue;
    }

    flds[0] = _.trim(flds[0]).toLowerCase();
    const matched = await regExMatch(flds[0], userAnswerCheck, lfparameter, answer);
    if (matched !== 0) {
      matchText = _.trim(flds[1]);
      if (matched === 2) {
        matchText = matchText + ' (you were close enough)';
      }
      isCorrect = (i === 0);
      break;
    }
  }

  return [isCorrect, matchText];
}

// Return the text of the "correct" (the first) branch
function _branchingCorrectText(answer) {
  let result = '';

  const branches = _.trim(answer).split(';');
  if (branches.length > 0) {
    const flds = branches[0].split('~');
    if (flds.length == 2) {
      result = flds[0];
    }
  }

  result = result.split('|');
  return result[0];
}

async function checkAnswer(userAnswer, correctAnswer, originalAnswer, lfparameter, userInput) {
  const answerDisplay = originalAnswer;
  let match = 0;
  let isCorrect; let matchText;
  if (answerIsBranched(correctAnswer)) {
    [isCorrect, matchText] = await matchBranching(correctAnswer, userAnswer, lfparameter);
  } else {
    let dispAnswer = _.trim(answerDisplay);
    if (dispAnswer.indexOf('|') >= 0) {
      // Take first answer if it's a bar-delimited string
      dispAnswer = _.trim(dispAnswer.split('|')[0]);
    }

    //check for answer repetition 
    let answerWordsCount = correctAnswer.split(" ").length;
    let userAnswerWords = userAnswer.split(" ");
    let userFirstAnswer =  userAnswerWords.slice(0,answerWordsCount).join(" ");
    let userSecondAnswer = userAnswerWords.slice(answerWordsCount).join(" ");
    match = await stringMatch(originalAnswer, userAnswer, lfparameter, userInput);
    if(match == 0){
      match = await stringMatch(originalAnswer, userFirstAnswer, lfparameter, userInput);
    }
    if(match == 0){
      match = await stringMatch(originalAnswer, userSecondAnswer, lfparameter, userInput);
    }
    if (match === 0) {
      isCorrect = false;
      matchText = '';
    } else if (match === 1) {
      isCorrect = true;
      matchText = 'Correct.';
    } else if (match === 2) {
      isCorrect = true;
      matchText = 'Close enough to the correct answer \''+ dispAnswer + '\'.';
    } else if (match === 3) {
      isCorrect = true;
      matchText = 'That sounds like the answer but you\'re writing it the wrong way, the correct answer is \''+ dispAnswer + '\'.';
    } else {
      console.log('MATCH ERROR: something fails in our comparison');
      isCorrect = false;
      matchText = '';
    }
    
    if (!matchText) {
      if (userAnswer === '' || userInput === '') {
        matchText = 'The correct answer is ' + dispAnswer + '.';
      } else {
        matchText = isCorrect ? 'Correct' : 'Incorrect. The correct answer is ' + dispAnswer + '.';
      }
    }
  }
  return {isCorrect, matchText};
}

const Answers = {
  branchingCorrectText: _branchingCorrectText,

  // Given the "raw" answer text from a cluster (in the response tag), return
  // an answer suitable for display (including on a button). Note that this
  // may be an empty string (for instance, if it's a branched answer)
  getDisplayAnswerText: function(answer) {
    return answerIsBranched(answer) ? _branchingCorrectText(answer) : answer;
  },

  // Returns the close study question. For a branched response, we take the
  // correct text - but for a "normal" response, we construct the study by
  // "filling in the blanks"
  clozeStudy: function(question, answer) {
    let result = question; // Always succeed

    if (answerIsBranched(answer)) {
      // Branched = use first entry's text
      answer = _branchingCorrectText(answer);
    }

    // Fill in the blank
    result = question.replace(/___+/g, answer);
    return result;
  },

  // Return [isCorrect, matchText] if userInput correctly matches answer -
  // taking into account both branching answers and edit distance
  answerIsCorrect: async function(userInput, answer, originalAnswer, displayedAnswer, setspec) {
    // Note that a missing or invalid lfparameter will result in a null value
    const lfparameter = parseFloat(setspec ? setspec.lfparameter || 0 : 0);
    const deliveryParams = Session.get('currentDeliveryParams');
    const feedbackType = deliveryParams.feedbackType;

    let fullTextIsCorrect = await checkAnswer(userInput, answer, originalAnswer, lfparameter, undefined);

    // Try again with original answer in case we did a syllable answer and they input the full response
    if (!fullTextIsCorrect.isCorrect && !!originalAnswer) {
      let userInputWithAddedSylls = displayedAnswer + userInput;
      fullTextIsCorrect = await checkAnswer(userInputWithAddedSylls, originalAnswer, originalAnswer, lfparameter, userInput);
      if ((!fullTextIsCorrect.isCorrect && !!originalAnswer) || fullTextIsCorrect.matchText.split(' ')[0] == 'Close') {
        let userInputWithDelimitingSpace = displayedAnswer + ' ' + userInput;
        fullTextIsCorrect = await checkAnswer(userInputWithDelimitingSpace, originalAnswer, originalAnswer, lfparameter, userInput);
      }
    }

    if (!fullTextIsCorrect.isCorrect) {
      const answerToCheck = originalAnswer || answer;
      switch (feedbackType) {
        case 'refutational':
          Meteor.call('getSimpleFeedbackForAnswer', userInput, answerToCheck, function(err, res) {
            console.log('simpleFeedback, err: ', err, ', res: ', res);
            if (typeof(err) == 'undefined' && res != 'default feedback') {
              fullTextIsCorrect.matchText = res;
            }
            return fullTextIsCorrect;
          });
          break;
        case 'dialogue':
        default:
          return fullTextIsCorrect;
      }
    } else {
      return fullTextIsCorrect;
    }
  },
};
