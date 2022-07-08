// @ts-nocheck

/* Collections - our data collections stored in MongoDB
 */


StimSyllables = new Meteor.Collection('stimuli_syllables');
Tdfs = new Meteor.Collection('tdfs')
Assignments = new Meteor.Collection('assessments');
ComponentStates = new Meteor.Collection('component_state');
Courses = new Meteor.Collection('course');
GlobalExperimentStates = new Meteor.Collection('global_experiment_state');
Histories = new Meteor.Collection('history');
Items = new Meteor.Collection('stimuli');
itemSourceSentences = new Meteor.Collection('item_source_sentences');
Sections = new Meteor.Collection('section');
SectionUserMap = new Meteor.Collection('section_user_map');
ScheduledTurkMessages = new Mongo.Collection('scheduledTurkMessages');
GoogleSpeechAPIKeys = new Mongo.Collection('googleSpeechAPIKeys');
ClozeEditHistory = new Mongo.Collection('clozeEditHistory');
ErrorReports = new Mongo.Collection('errorReports');
LoginTimes = new Mongo.Collection('loginTimes');
UtlQueryTimes = new Mongo.Collection('utlQueryTimes');
DynamicConfig = new Mongo.Collection('dynamicConfig');
UserProfileData = new Mongo.Collection('userProfileData');

//Init DynamicAssets Collection
DynamicAssets = new FilesCollection({
    collectionName: 'Assets',
    storagePath: process.env.HOME + '/dynamic-assets',
    allowClientCode: true, // Disallow remove files from Client
    onBeforeUpload(file) {
      // Allow upload files under 10MB, and only in png/jpg/jpeg formats
      if (file.size <= 10485760 && /zip|png|gif|jpg|jpeg|bmp|wav|mp3|mp4|mov|mpg|mpeg|tif|webm|flac/i.test(file.extension)) {
        return true;
      }
      return 'Please upload image, audio, or video fi with size equal or less than 10MB';
    }
  });