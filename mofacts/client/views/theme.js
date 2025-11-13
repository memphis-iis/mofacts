import { getCurrentTheme } from '../lib/currentTestingHelpers'

const DEFAULT_THEME_ID = 'mofacts-default';

function getThemeLibrary() {
    const library = DynamicSettings.findOne({key: 'themeLibrary'});
    return library?.value || [];
}

function getActiveThemeId() {
    const theme = Session.get('curTheme');
    return theme?.activeThemeId;
}

function isThemeActive(themeId) {
    const activeId = getActiveThemeId();
    return Boolean(activeId && themeId === activeId);
}

async function downloadThemeJson(themeId, filenameFallback = 'theme.json') {
    try {
        const json = await Meteor.callAsync('exportThemeFile', themeId);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filenameFallback;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Error exporting theme: ' + (err?.message || err));
    }
}

Template.theme.onCreated(async function() {
    this.subscribe('themeLibrary');
});

Template.theme.helpers({
    'currentTheme': function() {
        return Session.get('curTheme');
    },
    'availableThemes': function() {
        return getThemeLibrary();
    },
    'hasThemeLibrary': function() {
        return getThemeLibrary().length > 0;
    },
    'isThemeActive': function(themeId) {
        return isThemeActive(themeId);
    },
    'themePillModifier': function(themeId) {
        return isThemeActive(themeId) ? 'border-primary bg-light shadow-sm' : 'border-light';
    },
    'themeOrigin': function(origin) {
        return origin === 'system' ? 'System default' : 'Custom';
    },
    'isSystemTheme': function(origin) {
        return origin === 'system';
    },
    'themeActivationAttrs': function(themeId) {
        return isThemeActive(themeId)
            ? { disabled: true, 'aria-disabled': true }
            : {};
    },
    'customHelpPageEnabled': function() {
        const theme = Session.get('curTheme');
        const help = theme?.help;
        if (!help || help.enabled === false) {
            return false;
        }
        return Boolean(help.markdown?.length || help.url?.length);
    },
    'customHelpPageUploadedAt': function() {
        const theme = Session.get('curTheme');
        return theme?.help?.uploadedAt || null;
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
    },
    'navbarAlignmentAttrs': function(value) {
        const theme = Session.get('curTheme');
        const currentAlignment = theme?.properties?.navbar_alignment;
        return currentAlignment === value ? { selected: true } : {};
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
    'click .set-active-theme': async function(event) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        if (!themeId) {
            return;
        }
        try {
            await Meteor.callAsync('setActiveTheme', themeId);
        } catch (err) {
            alert('Error activating theme: ' + (err?.message || err));
        }
    },
    'click .duplicate-theme': async function(event) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const themeName = event.currentTarget.getAttribute('data-name') || 'New Theme';
        const proposedName = `${themeName} Copy`;
        const newName = prompt('Name for duplicated theme', proposedName);
        if (!newName) {
            return;
        }
        try {
            await Meteor.callAsync('duplicateTheme', {
                sourceThemeId: themeId,
                name: newName
            });
        } catch (err) {
            alert('Error duplicating theme: ' + (err?.message || err));
        }
    },
    'click .rename-theme': async function(event) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const currentName = event.currentTarget.getAttribute('data-name') || 'this theme';
        if (!themeId) {
            return;
        }
        const newName = prompt('Enter new theme name', currentName);
        if (!newName || newName === currentName) {
            return;
        }
        try {
            await Meteor.callAsync('renameTheme', {
                themeId: themeId,
                newName: newName
            });
        } catch (err) {
            alert('Error renaming theme: ' + (err?.message || err));
        }
    },
    'click .delete-theme': async function(event) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const themeName = event.currentTarget.getAttribute('data-name') || 'this theme';
        if (!themeId) {
            return;
        }
        if (!confirm(`Delete ${themeName}? This cannot be undone.`)) {
            return;
        }
        try {
            await Meteor.callAsync('deleteTheme', themeId);
        } catch (err) {
            alert('Error deleting theme: ' + (err?.message || err));
        }
    },
    'click .export-theme': async function(event) {
        event.preventDefault();
        const themeId = event.currentTarget.getAttribute('data-id');
        const filename = event.currentTarget.getAttribute('data-filename') || `${themeId}.json`;
        if (!themeId) {
            return;
        }
        await downloadThemeJson(themeId, filename);
    },
    'click #exportActiveTheme': async function() {
        const activeId = getActiveThemeId();
        if (!activeId) {
            alert('No active theme selected.');
            return;
        }
        const theme = Session.get('curTheme');
        const filename = (theme?.properties?.themeName || activeId) + '.json';
        await downloadThemeJson(activeId, filename);
    },
    'click #themeImportButton': async function(event, template) {
        event.preventDefault();
        const fileInput = template.find('#themeImportInput');
        const file = fileInput?.files?.[0];
        if (!file) {
            alert('Select a theme JSON file to import.');
            return;
        }
        if (file.size > 1024 * 1024) {
            alert('Theme files must be smaller than 1MB.');
            return;
        }
        try {
            const text = await file.text();
            await Meteor.callAsync('importThemeFile', text, true);
            fileInput.value = '';
        } catch (err) {
            alert('Error importing theme: ' + (err?.message || err));
        }
    },
    'click #themeResetButton': async function(event) {
        try {
            await Meteor.callAsync('initializeCustomTheme', 'MoFaCTS');
            // PHASE 1.5: No need to call getCurrentTheme() - reactive subscription handles it
            // The Tracker.autorun in getCurrentTheme will detect the theme change automatically
        } catch (err) {
            console.log("Error initializing custom theme:", err);
        }
    },
    'input .currentThemeProp': function(event) {
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;

        // Update session to trigger reactive updates - create new object for reactivity
        const theme = Session.get('curTheme');
        if (theme && theme.properties) {
            const updatedTheme = {
                ...theme,
                properties: {
                    ...theme.properties,
                    [data_id]: value
                }
            };
            Session.set('curTheme', updatedTheme);
        }

        // Apply CSS variable immediately for instant preview
        const propConverted = '--' + data_id.replace(/_/g, '-');
        document.documentElement.style.setProperty(propConverted, value);

        // Auto-save with debounce (wait 1 second after user stops typing)
        clearTimeout(window.themeSaveTimeout);
        window.themeSaveTimeout = setTimeout(async () => {
            try {
                await Meteor.callAsync('setCustomThemeProperty', data_id, value);
                console.log(`Auto-saved ${data_id}: ${value}`);
            } catch (err) {
                console.error(`Error auto-saving ${data_id}:`, err);
                alert(`Error saving ${data_id}: ${err}`);
            }
        }, 1000);
    },
    'input .currentThemePropColor': function(event) {
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;
        //change the corresponding currentThemeProp value. we need to find a input with the same data-id and change its value
        $(`.currentThemeProp[data-id=${data_id}]`).val(value);

        // Update session to trigger reactive updates - create new object for reactivity
        const theme = Session.get('curTheme');
        if (theme && theme.properties) {
            const updatedTheme = {
                ...theme,
                properties: {
                    ...theme.properties,
                    [data_id]: value
                }
            };
            Session.set('curTheme', updatedTheme);
        }

        // Apply CSS variable immediately for instant visual feedback
        const propConverted = '--' + data_id.replace(/_/g, '-');
        document.documentElement.style.setProperty(propConverted, value);

        // Auto-save immediately for color picker (no debounce needed)
        (async () => {
            try {
                await Meteor.callAsync('setCustomThemeProperty', data_id, value);
                console.log(`Auto-saved ${data_id}: ${value}`);
            } catch (err) {
                console.error(`Error auto-saving ${data_id}:`, err);
                alert(`Error saving ${data_id}: ${err}`);
            }
        })();
    },
    'change .currentThemeProp': function(event) {
        // Handle change events for select dropdowns and other elements that don't fire input events
        const data_id = event.currentTarget.getAttribute('data-id');
        const value = event.currentTarget.value;

        // Update session to trigger reactive updates - create new object for reactivity
        const theme = Session.get('curTheme');
        if (theme && theme.properties) {
            const updatedTheme = {
                ...theme,
                properties: {
                    ...theme.properties,
                    [data_id]: value
                }
            };
            Session.set('curTheme', updatedTheme);
        }

        // Apply CSS variable immediately for instant visual feedback
        const propConverted = '--' + data_id.replace(/_/g, '-');
        document.documentElement.style.setProperty(propConverted, value);

        // Auto-save immediately for dropdowns
        (async () => {
            try {
                await Meteor.callAsync('setCustomThemeProperty', data_id, value);
                console.log(`Auto-saved ${data_id}: ${value}`);
            } catch (err) {
                console.error(`Error auto-saving ${data_id}:`, err);
                alert(`Error saving ${data_id}: ${err}`);
            }
        })();
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

                // Create image to generate favicons
                const img = new Image();
                img.onload = async function() {
                    try {
                        // Upload the logo
                        await Meteor.callAsync('setCustomThemeProperty', 'logo_url', base64Data);

                        // Auto-generate 32x32 favicon from logo
                        const canvas32 = document.createElement('canvas');
                        canvas32.width = 32;
                        canvas32.height = 32;
                        const ctx32 = canvas32.getContext('2d');
                        ctx32.imageSmoothingEnabled = true;
                        ctx32.imageSmoothingQuality = 'high';
                        ctx32.drawImage(img, 0, 0, 32, 32);
                        const favicon32Data = canvas32.toDataURL('image/png');

                        // Auto-generate 16x16 favicon from logo
                        const canvas16 = document.createElement('canvas');
                        canvas16.width = 16;
                        canvas16.height = 16;
                        const ctx16 = canvas16.getContext('2d');
                        ctx16.imageSmoothingEnabled = true;
                        ctx16.imageSmoothingQuality = 'high';
                        ctx16.drawImage(img, 0, 0, 16, 16);
                        const favicon16Data = canvas16.toDataURL('image/png');

                        // Upload both auto-generated favicons
                        await Meteor.callAsync('setCustomThemeProperty', 'favicon_32_url', favicon32Data);
                        await Meteor.callAsync('setCustomThemeProperty', 'favicon_16_url', favicon16Data);

                        console.log("Logo uploaded successfully with auto-generated favicons");
                        // PHASE 1.5: No need to call getCurrentTheme() - reactive subscription handles it
                    } catch (err) {
                        alert("Error uploading logo: " + err);
                    }
                };
                img.src = base64Data;
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
                // PHASE 1.5: No need to call getCurrentTheme() - reactive subscription handles it
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
            } catch (err) {
                statusSpan.textContent = 'Error: ' + err.message;
                statusSpan.className = 'text-danger';
            }
        }
    }
});
