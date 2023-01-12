Template.adminControls.created = function() {
    Meteor.call('getVerbosity', function(err, verbosity) {
        if (err) {
            console.log("Error getting verbosity: " + err);
        } else {
            console.log("Got verbosity: " + verbosity);
            $(`#verbosityRadio${verbosity}`).prop('checked', true);
        }
    });
};

Template.adminControls.helpers({
    
});

Template.adminControls.events({
    'click .verbosityRadio': function(event) {
        console.log("verbosityRadio clicked");
        const name = event.currentTarget.getAttribute('id');
        const start = name.length - 1;
        const verbosity = name.slice(start, name.length)
        Meteor.call('setVerbosity', verbosity);
    }
});
  