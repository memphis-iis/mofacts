//////////////////////////////////////////////////////////////////////////
// Helpful utility functions for Meteor users

//Fairly safe function for insuring we have a valid, logged in Meteor user
haveMeteorUser = function() {
    return (!!Meteor.userId() && !!Meteor.user() && !!Meteor.user().username);
};
