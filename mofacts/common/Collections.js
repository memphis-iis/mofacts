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
  onBeforeUpload(file) {
    // Security: Validate file uploads to prevent malicious content
    // Note: This callback is synchronous - async checks moved to onInitiateUpload

    // 1. Basic authentication check
    if (!this.userId) {
      return 'Must be logged in to upload files';
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
  },
  async onInitiateUpload(fileData) {
    // Security: Authorization check using async Roles API (Meteor 3.x compatible)
    // This callback executes on server right after onBeforeUpload returns true

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'Must be logged in to upload files');
    }

    // METEOR 3 FIX: Use Roles.userIsInRoleAsync() instead of synchronous version
    const isAuthorized = await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher']);
    if (!isAuthorized) {
      throw new Meteor.Error('not-authorized', 'Only admins and teachers can upload files');
    }

    return true;
  }
});

ComponentStates.allow({
  update: function(userId, doc, fieldNames, modifier) {
    if (!userId || !doc.userId) {
      console.log('[ComponentStates] Update denied: missing userId', {userId, docUserId: doc.userId});
      return false;
    }
    return userId === doc.userId;
  },
  insert: function(userId, doc) {
    if (!userId || !doc.userId) {
      console.log('[ComponentStates] Insert denied: missing userId', {userId, docUserId: doc.userId});
      return false;
    }
    const allowed = userId === doc.userId;
    console.log('[ComponentStates] Insert attempt:', {userId, docUserId: doc.userId, allowed});
    return allowed;
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
    // Note: Using synchronous Roles.userIsInRole() because allow/deny rules cannot be async
    return Roles.userIsInRole(userId, ['admin']);
  }
});
