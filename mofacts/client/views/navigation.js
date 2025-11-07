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
// Wait for theme data first, then handle logo loading
Template.nav.onRendered(function() {
  const template = this;

  // Use autorun to wait for theme data to be ready
  this.autorun(() => {
    // Don't proceed until theme is loaded
    if (!Session.get('themeReady')) return;

    // Use Tracker.afterFlush to ensure DOM is fully rendered after themeReady changes
    Tracker.afterFlush(() => {
      const container = template.find('.container-fluid.page-loading');
      if (!container) {
        console.log('navbar: container not found');
        return;
      }

      const logoImg = template.find('img[alt="Logo"]');

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
        console.log('navbar: no logo found, showing immediately');
        container.classList.remove('page-loading');
        container.classList.add('page-loaded');
      }
    });
  });
});

// Provide reactive access to theme ready state
// Note: currentTheme helper is provided globally in index.js and uses Session
Template.nav.helpers({
  'themeReady': function() {
    // Wait for theme subscription to be ready before rendering navbar
    // This prevents layout shift from default to actual theme values
    return Session.get('themeReady') === true;
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