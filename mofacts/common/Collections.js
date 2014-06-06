/* Collections - our data collections stored in MongoDB
 * */

Stimuli = new Meteor.Collection("stimuli");
Tdfs = new Meteor.Collection("tdfs");
stimTdfPair = new Meteor.Collection("tdfValue");
Paused = new Meteor.Collection("paused");
UserProgress = new Meteor.Collection("userProgress");
CardProbabilities = new Meteor.Collection("CardProbabilities");

UserTimesLog = new Meteor.Collection("userTimesLog");
