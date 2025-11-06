import {Roles} from 'meteor/alanning:roles';

// Provide reactive access to current theme
Template.nav.helpers({
  'currentTheme': function() {
    return Session.get('curTheme');
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