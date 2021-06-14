// @ts-nocheck

/* Collections - our data collections stored in MongoDB
 */


StimSyllables = new Meteor.Collection('stimuli_syllables');

ScheduledTurkMessages = new Mongo.Collection('scheduledTurkMessages');
GoogleSpeechAPIKeys = new Mongo.Collection('googleSpeechAPIKeys');
ClozeEditHistory = new Mongo.Collection('clozeEditHistory');
ErrorReports = new Mongo.Collection('errorReports');
LoginTimes = new Mongo.Collection('loginTimes');
UtlQueryTimes = new Mongo.Collection('utlQueryTimes');
DynamicConfig = new Mongo.Collection('dynamicConfig');
UserProfileData = new Mongo.Collection('userProfileData');
