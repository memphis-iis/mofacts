/* Collections - our data collections stored in MongoDB
 * */

Stimuli = new Meteor.Collection("stimuli");
Tdfs = new Meteor.Collection("tdfs");
UserTimesLog = new Meteor.Collection("userTimesLog");
UserProfileData = new Mongo.Collection("userProfileData");
UserMetrics = new Mongo.Collection("userMetrics");
ScheduledTurkMessages = new Mongo.Collection("scheduledTurkMessages");
GoogleSpeechAPIKeys = new Mongo.Collection("googleSpeechAPIKeys");
Classes = new Mongo.Collection("classes");
ClozeEditHistory = new Mongo.Collection("clozeEditHistory");
