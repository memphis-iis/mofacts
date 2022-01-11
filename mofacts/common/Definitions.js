export const curSemester = 'FA_2021';
export const ALL_TDFS = 'xml';
export const INVALID = 'invalid';
export const ENTER_KEY = 13;
export const KC_MULTIPLE = 10000;
export const STIM_PARAMETER = '0,.7';
export const DISABLED = 'disabled';
export const ENABLED = 'enabled';
export const MODEL_UNIT = 'model';
export const SCHEDULE_UNIT = 'schedule';
// Define an ordering for the fields and the column name we'll put in the
// output file. Note that these names must match the fields used in populate
// record.
export const outputFields = [
  'Anon Student Id', // username
  'Session ID', // not sure yet
  'Condition Namea', // new field? always == 'tdf file'************
  'Condition Typea', // selectedTdf
  'Condition Nameb', // new field? always == 'xcondition'************
  'Condition Typeb', // xcondition
  'Condition Namec', // new field? always == 'schedule condition" ***********
  'Condition Typec', // schedCondition
  'Condition Named', // new field? always == 'how answered'*******
  'Condition Typed', // howAnswered
  // "Condition Namee", //new field? always == 'button trial'***********
  // "Condition Typee", //wasButtonTrial
  'Level (Unit)', // unit
  'Level (Unitname)', // unitname
  'Problem Name', // questionValue
  'Step Name', // new field repeats questionValue
  'Time', // stimDisplayedTime
  'Selection',
  'Action',
  'Input', // userAnswer
  'Outcome', // answerCorrect recoded as CORRECT or INCORRECT
  'Student Response Type', // trialType
  'Student Response Subtype', // qtype
  'Tutor Response Type', // trialType
  'Tutor Response Subtype', // qtype
  'KC (Default)',
  'KC Category(Default)',
  'KC (Cluster)',
  'KC Category(Cluster)',
  'CF (Audio Input Enabled)',
  'CF (Audio Output Enabled)',
  'CF (Display Order)', // questionIndex
  'CF (Stim File Index)', // clusterIndex
  'CF (Set Shuffled Index)', // shufIndex
  'CF (Alternate Display Index)', // index of which alternate display used, if applicable
  'CF (Stimulus Version)', // whichStim
  'CF (Correct Answer)', // CF correctAnswer
  'CF (Correct Answer Syllables)', // CF syllable list for correct answer
  'CF (Correct Answer Syllables Count)', // CF syllable list length
  'CF (Display Syllable Indices)', // CF the list of indices displayed to the user for subcloze hints
  'CF (Overlearning)', // CF isOverlearning
  'CF (Response Time)', // answerGivenTime
  'CF (Start Latency)', // startLatency check first trial discrepancy********
  'CF (End Latency)', // endLatency
  'CF (Review Latency)', // reviewLatency
  'CF (Review Entry)', // forceCorrectFeedback
  'CF (Button Order)', // CF buttonOrder
  'CF (Note)', // CF note
  'Feedback Text',
  'dialogueHistory',
  'Entry_Point'
];
