import {meteorCallAsync} from '../..';
import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {displayify} from '../../../common/globalHelpers';
import {selectTdf} from '../home/profile'
import {routeToSignin} from '../../lib/router';


Template.signIn.onRendered(async function() {
  if (Session.get('loginMode') !== 'experiment') {
    console.log('password signin, setting login mode');
    Session.set('loginMode', 'password');

    let verifiedTeachers = await meteorCallAsync('getAllTeachers');
    console.log('verifiedTeachers', verifiedTeachers);

    console.log('got teachers');
    Session.set('teachers', verifiedTeachers);
  }
  // CRITICAL: Check loginParams exists before accessing loginMode
  if(Meteor.userId() && Meteor.user().loginParams && Meteor.user().loginParams.loginMode !== 'experiment'){
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
  console.log("teacher:", curTeacher?._id || 'none');
  if (curTeacher?._id){
    $('#initialInstructorSelection').prop('hidden', 'true');
    $('#classSelection').prop('hidden', 'false');
    $('.login').prop('hidden', 'true');
    //start bootstrap modal
    $('#classSelect').removeAttr('hidden');
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

  'keypress #signInUsername': function(event) {
    const key = event.keyCode || event.which;
    if (key == 13) { //enter key
      event.preventDefault();
      $('#signInButton').prop('disabled', true);
      userPasswordCheck();
    }
  },

  'click #signUpButton': function(event) {
    Meteor.logout();
    event.preventDefault();
    Router.go('/signup');
  },
  'change #classSelect': function(event) {
    event.preventDefault();
    console.log('class select');
    //route to /classes/teacher._username/section._id
    Router.go('/classes/' + Session.get('curTeacher').username + '/' + event.target.value);
    //hide ClassSelectModal
    $('#classSelectModal').modal('hide');
  },
  'change #institutionSelect': function(event) {
    event.preventDefault();
    console.log('institution select');
    //if the value is not empty, route to the institution's signin page, else show teacher selection
    if(event.target.value){
      Router.go('/' + event.target.value);
    } else {
      document.getElementById('teacherSelect').hidden = false;
    }
  },
  
  'change #teacherSelect': function(event) {
    event.preventDefault();
    //get the teacher's information fron allTeachers in format {_id:'{{this._id}}',username:'{{this.username}}
    const teacher = Session.get('teachers').find(teacher => teacher._id === event.target.value);
    setTeacher(teacher);
    console.log('teacher select' + teacher);
    //show class selection
    $('#classSelect').removeAttr('hidden');
    //hide teacher selection
    $('#teacherSelect').prop('hidden', 'true');
  },

  'click #cancelClassSelect': function(event) {
    event.preventDefault();
    //set curTeacher and curClass session variables to null
    Session.set('curTeacher', null);
    Session.set('curClass', null);
    //set the useEmbeddedAPIKeys session variable to false
    Session.set('useEmbeddedAPIKeys', false);
  },
  'click #classSelectButton': function(event) {
    event.preventDefault();
    //set the curClass and curTeacher session variables to null
    Session.set('curTeacher', null);
    Session.set('curClass', null);
    //set the useEmbeddedAPIKeys session variable to false
    Session.set('useEmbeddedAPIKeys', false);
  },
  'click #signInWithMicrosoftSSO': function(event) {
    //login with the Accounts service microsoft
    event.preventDefault();
    console.log('[MS-LOGIN] Microsoft Login Button Clicked');
    console.log('[MS-LOGIN] Current loginMode:', Session.get('loginMode'));
    console.log('[MS-LOGIN] Current user:', Meteor.userId());

    //set the login mode to microsoft
    Session.set('loginMode', 'microsoft');

    console.log('[MS-LOGIN] Initiating Meteor.loginWithMicrosoft...');
    Meteor.loginWithMicrosoft({
      loginStyle: 'popup',
      requestOfflineToken: true,
      requestPermissions: ['User.Read', 'offline_access', 'openid', 'profile', 'email'],
    }, async function(err) {
      console.log('[MS-LOGIN] Callback invoked!');
      console.log('[MS-LOGIN] Error:', err);
      console.log('[MS-LOGIN] User after login:', Meteor.userId());
      console.log('[MS-LOGIN] User object:', Meteor.user());

      //if we are not in a class and we log in, we need to disable embedded API keys.
      if(!Session.get('curClass')){
        Session.set('useEmbeddedAPIKeys', false);
      }
      if (err) {
        // error handling
        console.error('[MS-LOGIN] Login Error:', err);
        console.error('[MS-LOGIN] Error details:', JSON.stringify(err, null, 2));
        $('#signInButton').prop('disabled', false);
        return;
      } else {
        console.log('[MS-LOGIN] Login successful!');

        // CRITICAL: Initialize loginParams just like Google login does
        console.log('[MS-LOGIN] Calling setUserLoginData...');
        await meteorCallAsync('setUserLoginData', `direct`, Session.get('loginMode'));

        console.log('[MS-LOGIN] Calling logUserAgentAndLoginTime...');
        Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);

        console.log('[MS-LOGIN] Logging out other clients...');
        Meteor.logoutOtherClients();

        console.log('[MS-LOGIN] Routing to /profile');
        Router.go('/profile');
      }
    });
  },
  'click #courseLink': function(event) {
    event.preventDefault();
    const sectionId = event.target.getAttribute('section-id');
    console.log(sectionId);
    $('#classSelection').prop('hidden', 'true');
    const allClasses = Session.get('curTeacherClasses');
    const curClass = allClasses.find((aClass) => aClass.sectionId.includes(sectionId));
    Session.set('curClass', curClass);
    Session.set('curSectionId', sectionId);
    $('.login').prop('hidden', '');
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
      Meteor.logout();
      event.preventDefault();
      $('#signInButton').prop('disabled', true);
      userPasswordCheck();
    }
  },
  'click #signInButtonOAuth': function(event) {
    Meteor.logout();
    $('#signInButton').prop('disabled', true);
    event.preventDefault();
    console.log('Google Login Proceeding');

    const options = {
      requestOfflineToken: true,
      requestPermissions: ['email', 'profile'],
      loginStyle: 'popup',
    };

    Meteor.loginWithGoogle(options, async function(err) {
      if(!Session.get('curClass')){
        //If we are not in a class and we log in, we need to disable embedded API keys.
        Session.set('useEmbeddedAPIKeys', false);
      }
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
      await meteorCallAsync('setUserLoginData', `direct`, Session.get('loginMode'));
      Meteor.logoutOtherClients();
      Router.go('/profile');
    });
  },
  'click #experimentSignin': function(event) {
    event.preventDefault();
    userPasswordCheck();
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

 experimentLoginText: function() {
    return Session.get('loginPrompt');
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

  'curTeacherSections': () => Session.get('sectionsByInstructorId'),
  
  'checkSectionExists': (sectionName) => sectionName != undefined && sectionName.length > 0,

  'institutions': () => Session.get('institutions'),
  
});

// //////////////////////////////////////////////////////////////////////////
// Implementation functions

// Called after we have signed in
function signInNotify(landingPage = '/profile') {
  const curClass = Session.get('curClass');
  const curTeacher = Session.get('curTeacher');
  if(curTeacher && curClass){
    Meteor.call('addUserToTeachersClass', Meteor.userId(), curTeacher._id, curClass.sectionId,
    async function(err, result) {
      if (err) {
        console.log('error adding user to teacher class: ' + err);
        alert(err);
        return;
      }
      console.log('addUserToTeachersClass result: ' + result);
      let sectionName = "";
      if(curClass.sectionName){
        sectionName = "/" + curClass.sectionName;
      }
      const asignedTDFIds = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), curClass.sectionId)
      const entryPoint = `${curTeacher.username}/${curClass.courseName + sectionName}`
      await meteorCallAsync('setUserLoginData', entryPoint, Session.get('loginMode'), curTeacher, curClass, asignedTDFIds);

    });
  }
  if (Session.get('debugging')) {
    const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
    console.log(currentUser + ' was logged in successfully! Current route is ', Router.current().route.getName());
    Meteor.call('debugLog', 'Sign in was successful');
    Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
  }
  Meteor.logoutOtherClients();
  if(landingPage)
    Router.go(landingPage);
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
      Meteor.loginWithPassword(newUsername, newPassword, async function(error) {
        if (typeof error !== 'undefined') {
          console.log('ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
          alert('It appears that you couldn\'t be logged in as ' + newUsername);
          $('#signInButton').prop('disabled', false);
        } else {
          let experimentTarget = Session.get('experimentTarget');
          if (experimentTarget) experimentTarget = experimentTarget.toLowerCase();
          let foundExpTarget = await meteorCallAsync('getTdfByExperimentTarget', experimentTarget);
          const setspec = foundExpTarget.content.tdfs.tutor.setspec ? foundExpTarget.content.tdfs.tutor.setspec : null;
          const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
          setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
          const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
          setspec.speechOutOfGrammarFeedback : 'Response not in answer set';

          if (foundExpTarget) {
            selectTdf(
                foundExpTarget._id,
                setspec.lessonname,
                foundExpTarget.stimuliSetId,
                ignoreOutOfGrammarResponses,
                speechOutOfGrammarFeedback,
                'Auto-selected by experiment target ' + experimentTarget,
                foundExpTarget.content.isMultiTdf,
                false,
                setspec,
                true
            );
          }
          signInNotify(false);
          await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
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

        Meteor.loginWithPassword(newUsername, newPassword, async function(error) {
          if (typeof error !== 'undefined') {
            console.log('ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
            alert('It appears that you couldn\'t be logged in as ' + newUsername);
            $('#signInButton').prop('disabled', false);
          } else {
            let experimentTarget = Session.get('experimentTarget');
            if (experimentTarget) experimentTarget = experimentTarget.toLowerCase();
            let foundExpTarget = await meteorCallAsync('getTdfByExperimentTarget', experimentTarget);
            const setspec = foundExpTarget.content.tdfs.tutor.setspec ? foundExpTarget.content.tdfs.tutor.setspec : null;
            const ignoreOutOfGrammarResponses = setspec.speechIgnoreOutOfGrammarResponses ?
            setspec.speechIgnoreOutOfGrammarResponses.toLowerCase() == 'true' : false;
            const speechOutOfGrammarFeedback = setspec.speechOutOfGrammarFeedback ?
            setspec.speechOutOfGrammarFeedback : 'Response not in answer set';

            if (foundExpTarget) {
              selectTdf(
                  foundExpTarget._id,
                  setspec.lessonname,
                  foundExpTarget.stimuliSetId,
                  ignoreOutOfGrammarResponses,
                  speechOutOfGrammarFeedback,
                  'Auto-selected by experiment target ' + experimentTarget,
                  foundExpTarget.content.isMultiTdf,
                  false,
                  setspec,
                  true
              );
            }
            signInNotify(false);
            await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
          }
        });
      });

      // No more processing
      return;
    }
  }

  // If we're here, we're NOT in experimental mode
  Meteor.loginWithPassword(newUsername, newPassword, async function(error) {
    if(!Session.get('curClass')){
      //If we are not in a class and we log in, we need to disable embedded API keys.
      Session.set('useEmbeddedAPIKeys', false);
    }
    if (typeof error !== 'undefined') {
      console.log('Login error: ' + error);
      $('#invalidLogin').show();
      alert('Your username or password was incorrect. Please try again.');
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
      signInNotify();
      await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
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

  const testUserName = _.trim($('#signInUsername').val()).toUpperCase();
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
    Meteor.loginWithPassword({'username': testUserName}, testPassword, async function(error) {
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
        const curClass = Session.get('curClass');
        const curTeacher = Session.get('curTeacher');
        if(curTeacher && curClass){
          Meteor.call('addUserToTeachersClass', Meteor.userId(), curTeacher._id, curClass.sectionId,
          async function(err, result) {
            if (err) {
              console.log('error adding user to teacher class: ' + err);
              alert(err);
              return;
            }
            console.log('addUserToTeachersClass result: ' + result);
            let sectionName = "";
            if(curClass.sectionName){
              sectionName = "/" + curClass.sectionName;
            }
            const asignedTDFIds = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), curClass.sectionId)
            const entryPoint = `${curTeacher.username}/${curClass.courseName + sectionName}`
            await meteorCallAsync('setUserLoginData', entryPoint, Session.get('loginMode'), curTeacher, curClass, asignedTDFIds);
      
          });
        } else {
          await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
        }
        Meteor.logoutOtherClients();
        Router.go('/profile');
      }
    });
  });
}



setTeacher = function(teacher) { // Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  //route to the teacher's login page
  Router.go('/classes/' + teacher.username);
};