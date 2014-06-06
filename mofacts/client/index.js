Meteor.startup(function() {
    // don't do anything with the collections here, 
    // they most likely won't be on the client yet

    Session.set("debugging", true);
});
