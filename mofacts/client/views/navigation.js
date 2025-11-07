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

// Handle navbar rendering and logo loading to prevent FOUC
Template.nav.onRendered(function() {
  const container = this.find('.container-fluid.page-loading');
  if (!container) return;

  const logoImg = this.find('img[alt="Logo"]');

  if (logoImg && logoImg.src) {
    // Wait for logo to load before showing navbar
    if (logoImg.complete) {
      // Image already loaded (cached)
      container.classList.remove('page-loading');
      container.classList.add('page-loaded');
    } else {
      // Wait for image to load
      logoImg.onload = function() {
        container.classList.remove('page-loading');
        container.classList.add('page-loaded');
      };
      // Handle error case - still show navbar even if logo fails
      logoImg.onerror = function() {
        container.classList.remove('page-loading');
        container.classList.add('page-loaded');
      };
    }
  } else {
    // No logo - show immediately
    container.classList.remove('page-loading');
    container.classList.add('page-loaded');
  }
});

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
  },

  'isExperiment': function() {
    // Check if user is in experiment mode (locked-down mode for research studies)
    // In experiment mode, navbar should not be clickable to prevent navigation
    return Session.get('loginMode') === 'experiment';
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