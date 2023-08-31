import { meteorCallAsync } from "../index";

Template.adminControls.created = function() {
    Meteor.call('getVerbosity', function(err, verbosity) {
        if (err) {
            console.log("Error getting verbosity: " + err);
        } else {
            console.log("Got verbosity: " + verbosity);
            $(`#verbosityRadio${verbosity}`).prop('checked', true);
        }
    });
    Meteor.call('getTestLogin', function(err, testLoginsEnabled) {
        if (err) {
            console.log("Error getting testLoginsEnabled: " + err);
        } else {
            console.log("Got testLoginsEnabled: " + testLoginsEnabled);
            $(`#testLoginsCheckbox`).prop('checked', testLoginsEnabled);
        }
    });
};

Template.adminControls.helpers({
    'serverStatus': function() {
        Meteor.call('getServerStatus', function(err, res) {
            Session.set('serverStatus', res);
        });
        return Session.get('serverStatus');
    }
});

Template.adminControls.events({
    'click .serverVerbosityRadio': function(event) {
        console.log("verbosityRadio clicked");
        const name = event.currentTarget.getAttribute('id');
        const start = name.length - 1;
        const verbosity = name.slice(start, name.length)
        Meteor.call('setVerbosity', verbosity);
    },
    'click .clientVerbosityRadio': function(event) {
        console.log("verbosityRadio clicked");
        let _id = DynamicSettings.findOne({key: 'clientVerbosityLevel'})._id;
        const name = event.currentTarget.getAttribute('id');
        const start = name.length - 1;
        const verbosity = _.intval(name.slice(start, name.length))
        DynamicSettings.update({_id: _id}, {$set: {value: verbosity}});
    },
    'click #testLoginsCheckbox': function(event) {
        console.log("testLoginsCheckbox clicked");
        let _id = DynamicSettings.findOne({key: 'testLoginsEnabled'})._id;
        const testLoginsEnabled = $('#testLoginsCheckbox').prop('checked');
        DynamicSettings.update({_id: _id}, {$set: {value: testLoginsEnabled}});  
    }
});
  