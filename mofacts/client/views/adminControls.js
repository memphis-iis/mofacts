import { getCurrentTheme } from '../lib/currentTestingHelpers'
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

Template.adminControls.rendered = function() {
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
    };

Template.adminControls.helpers({
    'serverStatus': function() {
        Meteor.call('getServerStatus', function(err, res) {
            Session.set('serverStatus', res);
        });
        return Session.get('serverStatus');
    },
    'testLoginsEnabled': function() {
        return DynamicSettings.findOne({key: 'testLoginsEnabled'}).value;
    },
    'currentTheme': function() {
        return Session.get('curTheme');
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
    },
    'click #themeInitButton': function(event) {
        Meteor.call('toggleCustomTheme', function(err, res) {
            if (err) {
                alert("Error toggling custom theme: " + err);
            } else {
                console.log("Toggled custom theme: " + res);
                Session.set('curTheme', getCurrentTheme());
            }
        });
    },
    'click #themeResetButton': function(event) {
        Meteor.call('initializeCustomTheme', function(err, res) {
            Session.set('curTheme', getCurrentTheme());
        });
    },
    'keypress #currentThemeProp': function(event) {
        if (event.keyCode === 13) {
            const data_id = event.currentTarget.getAttribute('data-id');
            const value = event.currentTarget.value;
            Meteor.call('setCustomThemeProperty', data_id, value, function(err, res) {
                if (err) {
                    alert("Error setting custom theme property: " + err);
                } else {
                    console.log("Set custom theme property: " + res);
                    Session.set('curTheme', getCurrentTheme());
                }
            });
        }
    }
});
  