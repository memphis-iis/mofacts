import {Roles} from 'meteor/alanning:roles';

// Default theme fallback
function getDefaultTheme() {
  return {
    themeName: 'MoFaCTS',
    properties: {
      themeName: 'MoFaCTS',
      navbar_alignment: 'left',
      logo_url: '/images/brain-logo.png'
    }
  };
}

// Provide reactive access to current theme
// Queries DynamicSettings directly to avoid race condition with Session
Template.nav.helpers({
  'currentTheme': function() {
    // Try to get theme from DynamicSettings (reactive)
    const themeSetting = DynamicSettings.findOne({key: 'customTheme'});

    if (themeSetting && themeSetting.value && themeSetting.value.enabled !== false) {
      return themeSetting.value;
    }

    // Fallback to default theme
    return getDefaultTheme();
  }
});

// Simple navigation with just logo click handler
Template.nav.events({
  'click .home-link'(event) {
    event.preventDefault();
    // Route to home page
    Router.go('/home');
  }
});