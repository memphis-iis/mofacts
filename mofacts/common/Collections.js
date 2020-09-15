/* Collections - our data collections stored in MongoDB
 * */

Stimuli = new Meteor.Collection("stimuli");
StimSyllables = new Meteor.Collection("stimuli_syllables");
Tdfs = new Meteor.Collection("tdfs");
UserTimesLog = new Meteor.Collection("userTimesLog");
UserProfileData = new Mongo.Collection("userProfileData");
UserMetrics = new Mongo.Collection("userMetrics");
ScheduledTurkMessages = new Mongo.Collection("scheduledTurkMessages");
GoogleSpeechAPIKeys = new Mongo.Collection("googleSpeechAPIKeys");
Classes = new Mongo.Collection("classes");
ClozeEditHistory = new Mongo.Collection("clozeEditHistory");
ErrorReports = new Mongo.Collection("errorReports");
LoginTimes = new Mongo.Collection("loginTimes");
UtlQueryTimes = new Mongo.Collection("utlQueryTimes");