import {meteorCallAsync} from '../..';
import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {displayify} from '../../../common/globalHelpers';
import {routeToSignin} from '../../lib/router';


Template.signIn.onCreated(async function() {
  Session.set('loginMode', 'password');
 
  let verifiedTeachers = await meteorCallAsync('getAllTeachers');
  console.log('verifiedTeachers', verifiedTeachers);

  console.log('got teachers');
  Session.set('showTestLogins', true);
  Session.set('teachers', verifiedTeachers);
});

Template.signIn.onRendered(async function() {
  if (Session.get('loginMode') !== 'experiment') {
    console.log('password signin, setting login mode');
    Session.set('loginMode', 'password');
  }
  if(Meteor.userId()){
    console.log("already logged in")
    Router.go("/profile");
  }
  const allCourseSections = await meteorCallAsync('getAllCourseSections');
  const classesByInstructorId = {};
  //  //sectionid, courseandsectionname
  for (const coursesection of allCourseSections) {
    if (!classesByInstructorId[coursesection.teacheruserid]) {
      classesByInstructorId[coursesection.teacheruserid] = [];
    }
    classesByInstructorId[coursesection.teacheruserid].push(coursesection);
  }
  Session.set('classesByInstructorId', classesByInstructorId);
  curTeacher = Session.get('curTeacher');
  console.log("teacher:", curTeacher._id);
  if (curTeacher._id){
    $('#initialInstructorSelection').prop('hidden', 'true');
    $('#classSelection').prop('hidden', 'false');
    $('.login').prop('hidden', 'true');
  }

});


// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.signIn.events({
  'click #signInButton': function(event) {
    event.preventDefault();
    $('#signInButton').prop('disabled', true);
    userPasswordCheck();
  },

  'click #signUpButton': function(event) {
    event.preventDefault();
    Router.go('/signup');
  },

  'focus #signInUsername': function(event) {
    $('#invalidLogin').hide();
  },

  'focus #password': function() {
    $('#invalidLogin').hide();
  },

  'keypress .accept-enter-key': function(event) {
    const key = event.keyCode || event.which;
    if (key == 13) {
      event.preventDefault();
      $('#signInButton').prop('disabled', true);
      userPasswordCheck();
    }
  },
  'click #signInButtonOAuth': function(event) {
    $('#signInButton').prop('disabled', true);
    event.preventDefault();
    console.log('Google Login Proceeding');

    const options = {
      requestOfflineToken: true,
      requestPermissions: ['email', 'profile'],
      loginStyle: 'popup',
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
      Meteor.call('setUserEntryPoint', `direct`);
      Meteor.logoutOtherClients();
      Router.go('/profile');
    });
  },

  'keypress .accept-enter-key-testlogin': function(event) {
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

// //////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.signIn.helpers({
  isExperiment: function() {
    return Session.get('loginMode') === 'experiment';
  },

  experimentPasswordRequired: function() {
    return Session.get('experimentPasswordRequired');
  },

  isNormal: function() {
    return Session.get('loginMode') !== 'experiment';
  },
  'showTestLogin': function() {
    return testUserEnabled();
  },
  'teachers': () => Session.get('teachers'),

  'curTeacherClasses': () => Session.get('curTeacherClasses'),
  
  'checkSectionExists': (sectionName) => sectionName != undefined && sectionName.length > 0,
});

// //////////////////////////////////////////////////////////////////////////
// Implementation functions

// Called after we have signed in
function signinNotify() {
  if (Session.get('debugging')) {
    const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
    console.log(currentUser + ' was logged in successfully! Current route is ', Router.current().route.getName());
    Meteor.call('debugLog', 'Sign in was successful');
    Meteor.call('updatePerformanceData', 'login', 'signin.signinNotify', Meteor.userId());
    Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
  }
  Meteor.logoutOtherClients();
  Router.go('/profile');
}

function userPasswordCheck() {
  // Hide previous errors
  $('.errcheck').hide();

  //Clear Impersonations
  Meteor.call('clearImpersonation');
  
  const experiment = Session.get('loginMode') === 'experiment';
  const experimentPasswordRequired = Session.get('experimentPasswordRequired');
  let newUsername = _.trim($('#signInUsername').val());
  let newPassword = _.trim(experiment && !experimentPasswordRequired ? '' : $('#password').val());

  if (!!newUsername & newPassword === '') {
    newPassword = blankPassword(newUsername);
  }

  if (experiment) {
    if (experimentPasswordRequired) {
      sessionCleanUp();
      Session.set('experimentPasswordRequired', true);
      console.log('username:' + newUsername + ',password:' + newPassword);
      Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
          console.log('ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
          alert('It appears that you couldn\'t be logged in as ' + newUsername);
          $('#signInButton').prop('disabled', false);
        } else {
          signinNotify();
          Meteor.call('setUserEntryPoint', `direct`);
        }
      });

      return;
    } else {
      // Experimental ID's are assumed to be upper case
      newUsername = newUsername.toUpperCase();

      // Experiment mode - we create a user if one isn't already there. We
      // Call sign up - specifying that a duplicate user is OK
      Meteor.call('signUpUser', newUsername, newPassword, true, function(error, result) {
        const errorMsgs = [];

        if (typeof error !== 'undefined') {
          errorMsgs.push(error);
        }

        // If there was a call failure or server returned error message,
        // then we can't proceed
        if (errorMsgs.length > 0) {
          console.log('Experiment user login errors:', displayify(errorMsgs));
          $('#serverErrors')
              .html(errorMsgs.join('<br>'))
              .show();
          $('#signInButton').prop('disabled', false);
          return;
        }

        // Everything was OK if we make it here - now we init the session,
        // login, and proceed to the profile screen

        sessionCleanUp();

        Meteor.loginWithPassword(newUsername, newPassword, function(error) {
          if (typeof error !== 'undefined') {
            console.log('ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
            alert('It appears that you couldn\'t be logged in as ' + newUsername);
            $('#signInButton').prop('disabled', false);
          } else {
            signinNotify();
            Meteor.call('setUserEntryPoint', `direct`);
          }
        });
      });

      // No more processing
      return;
    }
  }

  // If we're here, we're NOT in experimental mode
  Meteor.loginWithPassword(newUsername, newPassword, function(error) {
    if (typeof error !== 'undefined') {
      console.log('Login error: ' + error);
      $('#invalidLogin').show();
      $('#serverErrors').html(error).show();
      $('#signInButton').prop('disabled', false);
    } else {
      if (newPassword === blankPassword(newUsername)) {
        // So now we know it's NOT experiment mode and they've logged in
        // with a blank password. Currently this is someone who's
        // managed to figure out to use the "normal" login flow. Tell
        // them the "correct" way to use the system.
        console.log('Detected non-experimental login for turk ID', newUsername);
        alert('This login page is not for Mechanical Turk workers. Please use the link provided with your HIT');
        $('#signInButton').prop('disabled', false);
        return;
      }
      signinNotify();
      Meteor.call('setUserEntryPoint', `direct`);
    }
  });
}


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
        Meteor.call('setUserEntryPoint', `direct`);
        Meteor.logoutOtherClients();
        Router.go('/profile');
      }
    });
  });
}

setClass = function(curClassID) {
  console.log(curClassID);
  $('#classSelection').prop('hidden', 'true');
  const allClasses = Session.get('curTeacherClasses');
  const curClass = allClasses.find((aClass) => aClass.sectionid == curClassID);
  Session.set('curClass', curClass);
  Session.set('curSectionId', curClass.sectionid)
  $('.login').prop('hidden', '');
};
