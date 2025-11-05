import { getCurrentTheme } from '../lib/currentTestingHelpers'

Template.theme.onCreated(async function() {
    // Load custom help page status
    try {
        const status = await Meteor.callAsync('getCustomHelpPageStatus');
        if (status) {
            Session.set('customHelpPageEnabled', status.enabled);
            Session.set('customHelpPageUploadedAt', status.uploadedAt);
        }
    } catch (err) {
        console.log("Error getting custom help page status:", err);
    }
});

Template.theme.helpers({
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
    },
    'getContrastInfo': function(fgProp, bgProp) {
        const theme = Session.get('curTheme');
        if (!theme || !theme.properties) return null;

        const fg = theme.properties[fgProp];
        const bg = theme.properties[bgProp];

        if (!fg || !bg) return null;

        const ratio = calculateContrastRatio(fg, bg);
        const level = ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : 'Fail';
        const badgeClass = ratio >= 7 ? 'success' : ratio >= 4.5 ? 'warning' : 'danger';

        return {
            ratio: ratio.toFixed(1),
            level: level,
            badgeClass: badgeClass,
            passes: ratio >= 4.5
        };
    }
});

// Contrast calculation helper functions
function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Handle short form (e.g., #fff)
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

function relativeLuminance(rgb) {
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function calculateContrastRatio(fgHex, bgHex) {
    try {
        const fgRgb = hexToRgb(fgHex);
        const bgRgb = hexToRgb(bgHex);

        const fgLum = relativeLuminance(fgRgb);
        const bgLum = relativeLuminance(bgRgb);

        const lighter = Math.max(fgLum, bgLum);
        const darker = Math.min(fgLum, bgLum);

        return (lighter + 0.05) / (darker + 0.05);
    } catch (e) {
        return 0;
    }
}

Template.theme.events({
    'click #themeResetButton': async function(event) {
        try {
            await Meteor.callAsync('initializeCustomTheme');
            Session.set('curTheme', getCurrentTheme());
        } catch (err) {
            console.log("Error initializing custom theme:", err);
        }
    },
    'input .currentThemeProp': function(event) {
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;

        // Update session to trigger reactive contrast recalculation
        const theme = Session.get('curTheme');
        if (theme && theme.properties) {
            theme.properties[data_id] = value;
            Session.set('curTheme', theme);
        }

        //show unsaved change warning
        $('#unsavedThemeChanges').attr('hidden', false).removeAttr('hidden');
    },
    'input .currentThemePropColor': function(event) {
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;
        //change the corresponding currentThemeProp value. we need to find a input with the same data-id and change its value
        $(`.currentThemeProp[data-id=${data_id}]`).val(value);

        // Update session to trigger reactive contrast recalculation
        const theme = Session.get('curTheme');
        if (theme && theme.properties) {
            theme.properties[data_id] = value;
            Session.set('curTheme', theme);
        }

        //show unsaved change warning
        $('#unsavedThemeChanges').attr('hidden', false).removeAttr('hidden');
    },
    'click #themeSaveButton': async function(event) {
        //get all the currentThemeProp values and data-ids and put them in a json object [{data-id: value}]
        const themeProps = [];
        $('.currentThemeProp').each(function() {
            console.log("currentThemeProp: " + $(this).data('id'), $(this).val());
            themeProps.push({data_id: $(this).data('id'), value: $(this).val()});
        });
        console.log("themeProps: " + JSON.stringify(themeProps));
        //call the setCustomThemeProperty method for each themeProp
        for (const themeProp of themeProps) {
            try {
                const res = await Meteor.callAsync('setCustomThemeProperty', themeProp.data_id, themeProp.value);
                console.log("Set custom theme property: " + res);
            } catch (err) {
                alert("Error setting custom theme property: " + err);
            }
        }
        Session.set('curTheme', getCurrentTheme());
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
            reader.onload = async function(e) {
                const base64Data = e.target.result;
                try {
                    await Meteor.callAsync('setCustomThemeProperty', 'logo_url', base64Data);
                    console.log("Logo uploaded successfully");
                    getCurrentTheme();
                } catch (err) {
                    alert("Error uploading logo: " + err);
                }
            };
            reader.readAsDataURL(file);
        }
    },
    'click #clearLogo': async function(event) {
        if (confirm('Are you sure you want to clear the logo?')) {
            try {
                await Meteor.callAsync('setCustomThemeProperty', 'logo_url', '');
                console.log("Logo cleared successfully");
                $('#logoUpload').val('');
                getCurrentTheme();
            } catch (err) {
                alert("Error clearing logo: " + err);
            }
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
        reader.onload = async function(e) {
            const markdownContent = e.target.result;

            try {
                await Meteor.callAsync('setCustomHelpPage', markdownContent);
                statusSpan.textContent = 'Custom help page uploaded successfully!';
                statusSpan.className = 'text-success';
                fileInput.value = '';

                // Update session to show status
                try {
                    const status = await Meteor.callAsync('getCustomHelpPageStatus');
                    if (status) {
                        Session.set('customHelpPageEnabled', status.enabled);
                        Session.set('customHelpPageUploadedAt', status.uploadedAt);
                    }
                } catch (err) {
                    console.log("Error getting help page status:", err);
                }
            } catch (err) {
                statusSpan.textContent = 'Error: ' + err.message;
                statusSpan.className = 'text-danger';
            }
        };

        reader.onerror = function() {
            statusSpan.textContent = 'Error reading file';
            statusSpan.className = 'text-danger';
        };

        reader.readAsText(file);
    },

    'click #removeHelpFileButton': async function(event) {
        if (confirm('Are you sure you want to remove the custom help page and revert to the wiki?')) {
            const statusSpan = document.getElementById('helpFileUploadStatus');
            statusSpan.textContent = 'Removing...';
            statusSpan.className = 'text-info';

            try {
                await Meteor.callAsync('removeCustomHelpPage');
                statusSpan.textContent = 'Custom help page removed. Now using wiki.';
                statusSpan.className = 'text-success';

                // Update session
                Session.set('customHelpPageEnabled', false);
                Session.set('customHelpPageUploadedAt', null);
            } catch (err) {
                statusSpan.textContent = 'Error: ' + err.message;
                statusSpan.className = 'text-danger';
            }
        }
    }
});
