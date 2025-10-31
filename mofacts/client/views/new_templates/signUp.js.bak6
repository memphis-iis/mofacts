import {sessionCleanUp} from '../../lib/sessionUtils';
import {meteorCallAsync} from '../..';
import {routeToSignin} from '../../lib/router';

Template.signUp.events({
  'click #backkTosignInButton': function(event) {
    Meteor.logout();
    event.preventDefault();
    routeToSignin();
  },

  'click #signUpButton': function(event) {
    Meteor.logout();
    event.preventDefault();

    const formUsername = _.trim($('#signUpUsername').val());
    const formPassword1 = _.trim($('#password1').val());
    const formPassword2 = _.trim($('#password2').val());

    // Hide previous errors
    $('.errcheck').hide();

    const checks = [];

    if (formUsername.length < 6) {
      checks.push('#usernameTooShort');
    }

    // "Regular" password checks
    if (formPassword1.length < 6) {
      checks.push('#passwordTooShort');
    }

    if (formPassword1 !== formPassword2) {
      checks.push('#passwordMustMatch');
    }

    // Show any and all errors
    if (checks.length > 0) {
      _.each(checks, function(ele) {
        $(ele).show();
      });
      return;
    }

    (async () => {
      try {
        await Meteor.callAsync('signUpUser', formUsername, formPassword1);

        // Everything was OK if we make it here - now we init the session,
        // login, and proceed to the pofile screen

        sessionCleanUp();

        alert('Your account has been created! You will now be logged in.')

        Meteor.loginWithPassword(formUsername, formPassword1, async function(error) {
          if (typeof error !== 'undefined') {
            // This means that we have an issue of some kind - but there's
            // nothing that we can do? We'll just fall thru for now since
            // we don't have a good way to fix this
            console.log('ERROR: The user was not logged in on account creation?', formUsername);
            alert('It appears that you couldn\'t be logged in as ' + formUsername);
          } else {
            if (Session.get('debugging')) {
              const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
              console.log(currentUser + ' was logged in successfully!');
              Meteor.callAsync('debugLog', 'Sign in was successful');
            }
            await meteorCallAsync('setUserLoginData', `direct`, 'password');
            Meteor.logoutOtherClients();
          }
        });
      } catch (error) {
        $('#serverErrors')
            .html(error.toString())
            .show();
      }
    })();
  },

  'blur #signUpUsername': function(event) {
    if ($('#signUpUsername').val().length < 6) {
      $('#usernameTooShort').show();
    } else {
      $('#usernameTooShort').hide();
    }
  },

  'blur #password1': function() {
    const len = $('#password1').val().length;
    if (len < 6) {
      $('#passwordTooShort').show();
    } else {
      $('#passwordTooShort').hide();
    }
  },

  'blur #password2': function() {
    if ($('#password1').val() !== $('#password2').val()) {
      $('#passwordMustMatch').show();
    } else {
      $('#passwordMustMatch').hide();
    }
  },
});

Template.signUp.onRendered(function() {
  //check if the user is already logged in
  if (Meteor.userId()) {
    Router.go('/profile');
  }
});
