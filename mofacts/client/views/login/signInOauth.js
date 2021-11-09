import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {routeToSignin} from '../../lib/router';
import {displayify} from '../../../common/globalHelpers';

function testUserEnabled() {
  return _.chain(Meteor.settings).prop('public').prop('testLogin').value();
}

function testLogin() {
  console.log('TEST Login');

  // Just a sanity check
  if (!testUserEnabled()) {
    console.log('TEST Login REJECTED');
    $('#testSignInButton').prop('disabled', false);
    return;
  }

  const testUserName = _.trim($('#testUsername').val()).toUpperCase();
  if (!testUserName) {
    console.log('No TEST user name specified');
    alert('No TEST user name specified');
    $('#testSignInButton').prop('disabled', false);
    return;
  }

  const testPassword = blankPassword(testUserName);

  Meteor.call('signUpUser', testUserName, testPassword, true, function(error, result) {
    const errorMsgs = [];

    if (typeof error !== 'undefined') {
      errorMsgs.push(error);
    }

    // If there was a call failure or server returned error message,
    // then we can't proceed
    if (errorMsgs.length > 0) {
      const errorText = displayify(errorMsgs);
      console.log('Experiment user login errors:', errorText);
      alert('Experiment user login errors:', errorText);
      $('#testSignInButton').prop('disabled', false);
      return;
    }

    Meteor.call('clearImpersonation');
    sessionCleanUp();

    // Note that we force Meteor to think we have a user name so that
    // it doesn't try it as an email - this let's you test email-like
    // users, which you can promote to admin or teacher
    Meteor.loginWithPassword({'username': testUserName}, testPassword, function(error) {
      if (typeof error !== 'undefined') {
        console.log('ERROR: The user was not logged in on TEST sign in?', testUserName, 'Error:', error);
        alert('It appears that you couldn\'t be logged in as ' + testUserName);
        $('#testSignInButton').prop('disabled', false);
      } else {
        if (Session.get('debugging')) {
          const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
          console.log(currentUser + ' was test logged in successfully! Current route is ', Router.current().route.getName());
          Meteor.call('debugLog', 'TEST Sign in was successful - YOU SHOULD NOT SEE THIS IN PRODUCTION');
        }
        Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
        Meteor.call('updatePerformanceData', 'login', 'signinOauth.testLogin', Meteor.userId());
        Meteor.logoutOtherClients();
        Router.go('/profile');
        Accounts.config({
          loginExpirationInDays: 0.5
        });
      }
    });
  });
}

function waitOnConfig() {
  const loginMode = Session.get('loginMode');
  if (loginMode === 'southwest' || loginMode === 'password' || loginMode === 'experiment') {
    console.log('wrong login page rendered, redirecting:');
    routeToSignin();
    return;
  }

  if (!Accounts.loginServicesConfigured()) {
    console.log('+++++ Config not loaded! Waiting... +++++');
    $('#signInButtonOAuth').hide();
    setTimeout(waitOnConfig, 250);
  } else {
    console.log('Config loaded, good to go');
    $('#signInButtonOAuth').show();
  }
}

Template.signInOauth.helpers({
  'showTestLogin': function() {
    return testUserEnabled();
  },
});

Template.signInOauth.onRendered(waitOnConfig);

Template.signInOauth.events({
  'click #signInButtonOAuth': function(event) {
    $('#signInButton').prop('disabled', true);
    event.preventDefault();
    console.log('Google Login Proceeding');

    const options = {
      requestOfflineToken: true,
      requestPermissions: ['email', 'profile'],
      loginStyle: 'redirect',
    };

    Meteor.loginWithGoogle(options, function(err) {
      if (err) {
        $('#signInButton').prop('disabled', false);
        // error handling
        console.log('Could not log in with Google', err);
        throw new Meteor.Error(Accounts.LoginCancelledError.numericError, 'Error');
      }

      // Made it!
      if (Session.get('debugging')) {
        const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
        console.log(currentUser + ' was logged in successfully! Current route is ', Router.current().route.getName());
        Meteor.call('debugLog', 'Sign in was successful');
      }
      Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
      Meteor.call('updatePerformanceData', 'login', 'signinOauth.clickSigninButton', Meteor.userId());
      Meteor.logoutOtherClients();
      Router.go('/profile');
    });
  },

  'keypress .accept-enter-key': function(event) {
    const key = event.keyCode || event.which;
    if (key == 13) {
      event.preventDefault();
      $('#testSignInButton').prop('disabled', true);
      testLogin();
    }
  },

  'click #testSignInButton': function(event) {
    $('#testSignInButton').prop('disabled', true);
    event.preventDefault();
    testLogin();
  },
});
