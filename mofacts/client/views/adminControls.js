// PHASE 1.5: Removed unused getCurrentTheme import - now uses reactive subscription

Template.adminControls.onCreated(async function() {
    // Subscribe to DynamicSettings collection to get client verbosity level
    this.subscribe('settings');

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

    // Initialize clientVerbosityLevel if it doesn't exist (server-side)
    try {
        await Meteor.callAsync('ensureClientVerbositySetting');
    } catch (err) {
        console.log("Error initializing client verbosity setting:", err);
    }
});

Template.adminControls.onRendered(function() {
    // Reactively check the client verbosity radio button when data is ready
    this.autorun(() => {
        const settingDoc = DynamicSettings.findOne({key: 'clientVerbosityLevel'});
        if (settingDoc && settingDoc.value !== undefined) {
            const clientVerbosityLevel = settingDoc.value.toString();
            const radioId = `clientVerbosityRadio${clientVerbosityLevel}`;
            console.log("Setting client verbosity radio:", radioId);
            const radioElement = document.getElementById(radioId);
            if (radioElement) {
                radioElement.checked = true;
            }
        }
    });
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
        const settingDoc = DynamicSettings.findOne({key: 'testLoginsEnabled'});
        return settingDoc ? settingDoc.value : false;
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
    'click .clientVerbosityRadio': async function(event) {
        console.log("clientVerbosityRadio clicked");
        const name = event.currentTarget.getAttribute('id');
        const start = name.length - 1;
        const verbosity = name.slice(start, name.length);

        try {
            await Meteor.callAsync('setClientVerbosity', verbosity);
            console.log(`Client verbosity set to ${verbosity}`);
        } catch (err) {
            console.error("Error setting client verbosity:", err);
            alert(`Error: ${err.message}`);
            // Revert radio button on error
            const currentDoc = DynamicSettings.findOne({key: 'clientVerbosityLevel'});
            if (currentDoc) {
                const currentValue = currentDoc.value.toString();
                const radioId = `clientVerbosityRadio${currentValue}`;
                const radioElement = document.getElementById(radioId);
                if (radioElement) {
                    radioElement.checked = true;
                }
            }
        }
    },
    'click #testLoginsCheckbox': function(event) {
        console.log("testLoginsCheckbox clicked");
        const settingDoc = DynamicSettings.findOne({key: 'testLoginsEnabled'});
        const testLoginsEnabled = $('#testLoginsCheckbox').prop('checked');
        if (settingDoc) {
            DynamicSettings.update({_id: settingDoc._id}, {$set: {value: testLoginsEnabled}});
        } else {
            // If setting doesn't exist, it will be created by a server method if needed
            console.warn("testLoginsEnabled setting not found in database");
        }
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
  