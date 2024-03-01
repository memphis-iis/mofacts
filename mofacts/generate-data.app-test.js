// This file will be auto-imported in the app-test context,
// ensuring the method is always available

import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
//import * as data from './example.json';

const testTdf  = require("./testTdf.json");
const testStim = require("./testStim.json");

function makeId(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

const createTDF = (userId) => {
    const Tdf = testTdf;
    Tdf.tutor.setspec.lessonName = makeId(5);
    Tdf.tutor.setspec.name = makeId(5);
    Tdf.tutor.setspec.experimentTarget = makeId(5);

    return Tdf;
};

resetDatabase = () => {
    // Clear the database
    StimSyllables.remove({});
    Tdfs.remove({});
    Assignments.remove({});
    ComponentStates.remove({});
    Courses.remove({});
    GlobalExperimentStates.remove({});
    Histories.remove({});
    Items.remove({});
    Stims.remove({});
    itemSourceSentences.remove({});
    Sections.remove({});
    SectionUserMap.remove({});
    UserTimesLog.remove({});
    UserMetrics.remove({});
    ElaboratedFeedbackCache.remove({});
    DynamicSettings.remove({});
    ScheduledTurkMessages.remove({});
    GoogleSpeechAPIKeys.remove({});
    ClozeEditHistory.remove({});
    ErrorReports.remove({});
    LoginTimes.remove({});
    UtlQueryTimes.remove({});
    DynamicConfig.remove({});
    UserProfileData.remove({});
    ProbabilityEstimates.remove({});
};

// Remember to double check this is a test-only file before
// adding a method like this!
Meteor.methods({
    generateFixtures() {
        resetDatabase();

        Meteor.call('combineConetenFile', createTDF(), testStim);
    },
});