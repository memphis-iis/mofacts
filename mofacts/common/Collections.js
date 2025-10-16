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
Stims = new Meteor.Collection('stim_files');
itemSourceSentences = new Meteor.Collection('item_source_sentences');
Sections = new Meteor.Collection('section');
SectionUserMap = new Meteor.Collection('section_user_map');
UserTimesLog = new Meteor.Collection('userTimesLog');
UserMetrics = new Meteor.Collection('userMetrics');
ElaboratedFeedbackCache = new Meteor.Collection('elaborated_feedback_cache');
DynamicSettings = new Meteor.Collection('dynaminc_settings');
ScheduledTurkMessages = new Mongo.Collection('scheduledTurkMessages');
ClozeEditHistory = new Mongo.Collection('clozeEditHistory');
ErrorReports = new Mongo.Collection('errorReports');
DynamicConfig = new Mongo.Collection('dynamicConfig');
ProbabilityEstimates = new Meteor.Collection('probabilityEstimates');
PasswordResetTokens = new Mongo.Collection('passwordResetTokens');
AuditLog = new Mongo.Collection('auditLog');

//Init DynamicAssets Collection
DynamicAssets = new FilesCollection({
  collectionName: 'Assets',
  storagePath: process.env.HOME + '/dynamic-assets',
  allowClientCode: false, // Security: Disallow file operations from client (use server methods)
  public: true, // Allow public read access to files (needed for image display)
  downloadRoute: '/cdn/storage', // Required route for public collections
  allowQueryStringCookies: true, // Allow authentication via query string for remote access
  onBeforeUpload(file) {
    // Security: Validate file uploads to prevent malicious content

    // 1. Authorization check - only authenticated admin/teacher can upload
    if (!this.userId) {
      return 'Must be logged in to upload files';
    }

    if (!Roles.userIsInRole(this.userId, ['admin', 'teacher'])) {
      return 'Only admins and teachers can upload files';
    }

    // 2. File size limit (100MB)
    if (file.size > 104857600) {
      return 'File size must be 100MB or less';
    }

    // 3. Filename validation - prevent path traversal
    const filename = file.name || '';
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return 'Invalid filename - path traversal not allowed';
    }

    // 4. Extension validation - only zip files
    if (!file.extension || !/^zip$/i.test(file.extension)) {
      return 'Only .zip files are allowed';
    }

    return true;
  }
});

ComponentStates.allow({
  update: function(userId, doc, fieldNames, modifier) {
    return userId === doc.userId;
  },
  insert: function(userId, doc) {
    return userId === doc.userId;
  }
});

GlobalExperimentStates.allow({
  update: function(userId, doc, fieldNames, modifier) {
    return userId === doc.userId;
  },
  insert: function(userId, doc) {
    return userId === doc.userId;
  }
});

DynamicSettings.allow({
  update: function(userId) {
    return Roles.userIsInRole(userId, ['admin']);
  }
});
