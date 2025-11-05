import { getCurrentTheme } from '../lib/currentTestingHelpers'

Template.adminControls.onCreated(async function() {
    try {
        const verbosity = await Meteor.callAsync('getVerbosity');
        console.log("Got verbosity: " + verbosity);
        $(`#verbosityRadio${verbosity}`).prop('checked', true);
    } catch (err) {
        console.log("Error getting verbosity: " + err);
    }

    try {
        const testLoginsEnabled = await Meteor.callAsync('getTestLogin');
        console.log("Got testLoginsEnabled: " + testLoginsEnabled);
        $(`#testLoginsCheckbox`).prop('checked', testLoginsEnabled);
    } catch (err) {
        console.log("Error getting testLoginsEnabled: " + err);
    }

    try {
        const serverStatus = await Meteor.callAsync('getServerStatus');
        console.log("Got server status:", serverStatus);
        Session.set('serverStatus', serverStatus);
    } catch (err) {
        console.log("Error getting server status:", err);
    }
});

Template.adminControls.onRendered(async function() {
        //get client verbosity level
        clientVerbosityLevel = DynamicSettings.findOne({key: 'clientVerbosityLevel'}).value.toString();
        //if client verbosity level is not set, set it to 0
        if (clientVerbosityLevel === undefined) {
            clientVerbosityLevel = "0"
            console.log("clientVerbosityLevel not set, setting to 0");
            DynamicSettings.insert({key: 'clientVerbosityLevel', value: clientVerbosityLevel});
        }
        //set the name of the radio button to be checked
        const name = `clientVerbosityRadio${clientVerbosityLevel}`;
        console.log("clientVerbosityLevel: " + name);
        //check the radio button
        document.getElementById(name).checked = true;
    });

Template.adminControls.helpers({
    'serverStatus': function() {
        return Session.get('serverStatus') || {
            diskSpacePercent: 'Loading...',
            remainingSpace: 'Loading...',
            diskSpace: 'Loading...',
            diskSpaceUsed: 'Loading...'
        };
    },
    'testLoginsEnabled': function() {
        return DynamicSettings.findOne({key: 'testLoginsEnabled'}).value;
    }
});

Template.adminControls.events({
    'click .serverVerbosityRadio': function(event) {
        console.log("verbosityRadio clicked");
        const name = event.currentTarget.getAttribute('id');
        const start = name.length - 1;
        const verbosity = name.slice(start, name.length)
        Meteor.callAsync('setVerbosity', verbosity);
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
    },
    'click #updateStimDisplayTypeMap': async function(event) {
        try {
            const res = await Meteor.callAsync('updateStimDisplayTypeMap');
            console.log("Cleared stim display type map: " + res);
        } catch (err) {
            alert("Error clearing stim display type map: " + err);
        }
    }
});
  