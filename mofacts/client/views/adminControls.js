import { getCurrentTheme } from '../lib/currentTestingHelpers'
Template.adminControls.created = function() {
    Meteor.callAsync('getVerbosity', function(err, verbosity) {
        if (err) {
            console.log("Error getting verbosity: " + err);
        } else {
            console.log("Got verbosity: " + verbosity);
            $(`#verbosityRadio${verbosity}`).prop('checked', true);
        }
    });
    Meteor.callAsync('getTestLogin', function(err, testLoginsEnabled) {
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

        // Load custom help page status
        Meteor.callAsync('getCustomHelpPageStatus', function(err, status) {
            if (!err && status) {
                Session.set('customHelpPageEnabled', status.enabled);
                Session.set('customHelpPageUploadedAt', status.uploadedAt);
            }
        });
    };

Template.adminControls.helpers({
    'serverStatus': function() {
        Meteor.callAsync('getServerStatus', function(err, res) {
            Session.set('serverStatus', res);
        });
        return Session.get('serverStatus');
    },
    'testLoginsEnabled': function() {
        return DynamicSettings.findOne({key: 'testLoginsEnabled'}).value;
    },
    'currentTheme': function() {
        return Session.get('curTheme');
    },
    'customHelpPageEnabled': function() {
        return Session.get('customHelpPageEnabled') || false;
    },
    'customHelpPageUploadedAt': function() {
        return Session.get('customHelpPageUploadedAt');
    },
    'formatDate': function(date) {
        if (!date) return '';
        return new Date(date).toLocaleString();
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
    'click #themeInitButton': function(event) {
        Meteor.callAsync('toggleCustomTheme', function(err, res) {
            if (err) {
                alert("Error toggling custom theme: " + err);
            } else {
                console.log("Toggled custom theme: " + res);
                Session.set('curTheme', getCurrentTheme());
            }
        });
    },
    'click #themeResetButton': function(event) {
        Meteor.callAsync('initializeCustomTheme', function(err, res) {
            Session.set('curTheme', getCurrentTheme());
        });
    },
    'input .currentThemeProp': function(event) {
        //show unsaved change warning
        $('#unsavedThemeChanges').attr('hidden', false).removeAttr('hidden');
    },
    'input .currentThemePropColor': function(event) {
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;
        //change the corresponding currentThemeProp value. we need to find a input with the same data-id and change its value
        $(`.currentThemeProp[data-id=${data_id}]`).val(value);
        //show unsaved change warning
        $('#unsavedThemeChanges').attr('hidden', false).removeAttr('hidden');
    },
    'click #themeSaveButton': function(event) {
        //get all the currentThemeProp values and data-ids and put them in a json object [{data-id: value}]
        const themeProps = [];
        $('.currentThemeProp').each(function() {
            console.log("currentThemeProp: " + $(this).data('id'), $(this).val());
            themeProps.push({data_id: $(this).data('id'), value: $(this).val()});
        });
        console.log("themeProps: " + JSON.stringify(themeProps));
        //call the setCustomThemeProperty method for each themeProp
        themeProps.forEach(function(themeProp) {
            Meteor.callAsync('setCustomThemeProperty', themeProp.data_id, themeProp.value, function(err, res) {
                if (err) {
                    alert("Error setting custom theme property: " + err);
                } else {
                    console.log("Set custom theme property: " + res);   
                }
            });
        });
        Session.set('curTheme', getCurrentTheme());
    },
    'click #updateStimDisplayTypeMap': function(event) {
        Meteor.callAsync('updateStimDisplayTypeMap', function(err, res) {
            if (err) {
                alert("Error clearing stim display type map: " + err);
            } else {
                console.log("Cleared stim display type map: " + res);
            }
        });
    },
    'change #logoUpload': function(event) {
        const file = event.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file');
                return;
            }
            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('File size must be less than 2MB');
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const base64Data = e.target.result;
                Meteor.callAsync('setCustomThemeProperty', 'logo_url', base64Data, function(err, res) {
                    if (err) {
                        alert("Error uploading logo: " + err);
                    } else {
                        console.log("Logo uploaded successfully");
                        getCurrentTheme();
                    }
                });
            };
            reader.readAsDataURL(file);
        }
    },
    'click #clearLogo': function(event) {
        if (confirm('Are you sure you want to clear the logo?')) {
            Meteor.callAsync('setCustomThemeProperty', 'logo_url', '', function(err, res) {
                if (err) {
                    alert("Error clearing logo: " + err);
                } else {
                    console.log("Logo cleared successfully");
                    $('#logoUpload').val('');
                    getCurrentTheme();
                }
            });
        }
    },

    // Custom Help Page Upload
    'click #uploadHelpFileButton': function(event) {
        const fileInput = document.getElementById('helpFileUpload');
        const file = fileInput.files[0];
        const statusSpan = document.getElementById('helpFileUploadStatus');

        if (!file) {
            statusSpan.textContent = 'Please select a file first';
            statusSpan.className = 'text-danger';
            return;
        }

        // Validate file extension
        if (!file.name.endsWith('.md')) {
            statusSpan.textContent = 'Please select a markdown (.md) file';
            statusSpan.className = 'text-danger';
            return;
        }

        // Validate file size (1MB max)
        if (file.size > 1048576) {
            statusSpan.textContent = 'File size must be less than 1MB';
            statusSpan.className = 'text-danger';
            return;
        }

        statusSpan.textContent = 'Uploading...';
        statusSpan.className = 'text-info';

        // Read file as text
        const reader = new FileReader();
        reader.onload = function(e) {
            const markdownContent = e.target.result;

            Meteor.callAsync('setCustomHelpPage', markdownContent, function(err, res) {
                if (err) {
                    statusSpan.textContent = 'Error: ' + err.message;
                    statusSpan.className = 'text-danger';
                } else {
                    statusSpan.textContent = 'Custom help page uploaded successfully!';
                    statusSpan.className = 'text-success';
                    fileInput.value = '';

                    // Update session to show status
                    Meteor.callAsync('getCustomHelpPageStatus', function(err, status) {
                        if (!err && status) {
                            Session.set('customHelpPageEnabled', status.enabled);
                            Session.set('customHelpPageUploadedAt', status.uploadedAt);
                        }
                    });
                }
            });
        };

        reader.onerror = function() {
            statusSpan.textContent = 'Error reading file';
            statusSpan.className = 'text-danger';
        };

        reader.readAsText(file);
    },

    'click #removeHelpFileButton': function(event) {
        if (confirm('Are you sure you want to remove the custom help page and revert to the wiki?')) {
            const statusSpan = document.getElementById('helpFileUploadStatus');
            statusSpan.textContent = 'Removing...';
            statusSpan.className = 'text-info';

            Meteor.callAsync('removeCustomHelpPage', function(err, res) {
                if (err) {
                    statusSpan.textContent = 'Error: ' + err.message;
                    statusSpan.className = 'text-danger';
                } else {
                    statusSpan.textContent = 'Custom help page removed. Now using wiki.';
                    statusSpan.className = 'text-success';

                    // Update session
                    Session.set('customHelpPageEnabled', false);
                    Session.set('customHelpPageUploadedAt', null);
                }
            });
        }
    }
});
  