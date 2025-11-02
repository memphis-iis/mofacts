import {meteorCallAsync, clientConsole} from '../..';
import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {displayify} from '../../../common/globalHelpers';
import {selectTdf} from '../home/profile'
import {routeToSignin} from '../../lib/router';
import {ServiceConfiguration} from 'meteor/service-configuration';


Template.signIn.onRendered(async function() {
  // CRITICAL: Subscribe to OAuth service configuration for Google/Microsoft login
  this.subscribe('meteor.loginServiceConfiguration');

  if (Session.get('loginMode') !== 'experiment') {
    clientConsole(2, 'password signin, setting login mode');
    Session.set('loginMode', 'password');

    let verifiedTeachers = await meteorCallAsync('getAllTeachers');
    clientConsole(2, 'verifiedTeachers', verifiedTeachers);

    clientConsole(2, 'got teachers');
    Session.set('teachers', verifiedTeachers);
  }
  // CRITICAL: Check loginParams exists before accessing loginMode
  if(Meteor.userId() && Meteor.user().loginParams && Meteor.user().loginParams.loginMode !== 'experiment'){
    clientConsole(2, "already logged in")
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
  clientConsole(2, "teacher:", curTeacher?._id || 'none');
  if (curTeacher?._id){
    $('#initialInstructorSelection').prop('hidden', 'true');
    $('#classSelection').prop('hidden', 'false');
    $('.login').prop('hidden', 'true');
    //start bootstrap modal
    $('#classSelect').removeAttr('hidden');
  }

  // Trigger fade-in now that page is ready (prevents layout shift)
  const container = document.querySelector('.container.page-loading');
  if (container) {
    container.classList.remove('page-loading');
    container.classList.add('page-loaded');
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
    clientConsole(2, 'class select');
    //route to /classes/teacher._username/section._id
    Router.go('/classes/' + Session.get('curTeacher').username + '/' + event.target.value);
    //hide ClassSelectModal
    $('#classSelectModal').modal('hide');
  },
  'change #institutionSelect': function(event) {
    event.preventDefault();
    clientConsole(2, 'institution select');
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
    clientConsole(2, 'teacher select' + teacher);
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
  'click #signInWithMicrosoftSSO': async function(event) {
    //login with the Accounts service microsoft
    event.preventDefault();
    clientConsole(2, '[MS-LOGIN] Microsoft Login Button Clicked');
    clientConsole(2, '[MS-LOGIN] Current loginMode:', Session.get('loginMode'));
    clientConsole(2, '[MS-LOGIN] Current user:', Meteor.userId());

    // Check if OAuth service configuration is ready
    const msConfig = ServiceConfiguration.configurations.findOne({service: 'microsoft'});
    if (!msConfig) {
      clientConsole(1, '[MS-LOGIN] ERROR: OAuth service configuration not ready yet!');
      alert('OAuth configuration is still loading. Please wait a moment and try again.');
      return;
    }
    clientConsole(2, '[MS-LOGIN] OAuth config found:', !!msConfig);

    //set the login mode to microsoft
    Session.set('loginMode', 'microsoft');

    // METEOR 3 FIX: Use promisified version instead of callback
    const loginWithMicrosoftAsync = Meteor.promisify(Meteor.loginWithMicrosoft);

    try {
      clientConsole(2, '[MS-LOGIN] Initiating Meteor.loginWithMicrosoft...');
      await loginWithMicrosoftAsync({
        loginStyle: 'popup',
        requestOfflineToken: true,
        requestPermissions: ['User.Read'],
      });

      clientConsole(2, '[MS-LOGIN] Login successful!');
      clientConsole(2, '[MS-LOGIN] User after login:', Meteor.userId());

      //if we are not in a class and we log in, we need to disable embedded API keys.
      if(!Session.get('curClass')){
        Session.set('useEmbeddedAPIKeys', false);
      }

      // Set loginParams on server
      clientConsole(2, '[MS-LOGIN] Calling setUserLoginData...');
      try {
        await meteorCallAsync('setUserLoginData', `direct`, Session.get('loginMode'));
        clientConsole(2, '[MS-LOGIN] setUserLoginData completed on server');
      } catch (error) {
        clientConsole(1, '[MS-LOGIN] setUserLoginData failed:', error);
        alert('Failed to save login data: ' + error.message);
        Meteor.logout();
        return;
      }

      // Wait for loginParams to sync to client
      clientConsole(2, '[MS-LOGIN] Waiting for loginParams to sync to client...');
      const loginParamsFound = await new Promise((resolve) => {
        const checkLoginParams = Tracker.autorun((computation) => {
          const user = Meteor.user();
          if (user && user.loginParams) {
            clientConsole(2, '[MS-LOGIN] loginParams synced to client:', user.loginParams);
            computation.stop();
            resolve(true);
          }
        });
        // Timeout after 10 seconds
        setTimeout(() => {
          checkLoginParams.stop();
          clientConsole(1, '[MS-LOGIN] TIMEOUT waiting for loginParams!');
          resolve(false);
        }, 10000);
      });

      if (!loginParamsFound) {
        clientConsole(1, '[MS-LOGIN] WARNING: loginParams never synced, but continuing anyway');
      }

      clientConsole(2, '[MS-LOGIN] Calling logUserAgentAndLoginTime...');
      Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);

      clientConsole(2, '[MS-LOGIN] Logging out other clients...');
      Meteor.logoutOtherClients();

      // Route to /profile like password login does
      clientConsole(2, '[MS-LOGIN] Routing to /profile');
      Router.go('/profile');

    } catch (error) {
      clientConsole(1, '[MS-LOGIN] Login Error:', error);
      clientConsole(1, '[MS-LOGIN] Error details:', JSON.stringify(error, null, 2));
      alert('Microsoft login failed: ' + error.message);
      $('#signInButton').prop('disabled', false);
    }
  },
  'click #courseLink': function(event) {
    event.preventDefault();
    const sectionId = event.target.getAttribute('section-id');
    clientConsole(2, sectionId);
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
  'click #signInButtonOAuth': async function(event) {
    event.preventDefault();
    $('#signInButton').prop('disabled', true);
    clientConsole(2, '[GOOGLE-LOGIN] Google Login Button Clicked');
    clientConsole(2, '[GOOGLE-LOGIN] Current loginMode:', Session.get('loginMode'));
    clientConsole(2, '[GOOGLE-LOGIN] Current user:', Meteor.userId());

    // Check if OAuth service configuration is ready
    const googleConfig = ServiceConfiguration.configurations.findOne({service: 'google'});
    if (!googleConfig) {
      clientConsole(1, '[GOOGLE-LOGIN] ERROR: OAuth service configuration not ready yet!');
      alert('OAuth configuration is still loading. Please wait a moment and try again.');
      $('#signInButton').prop('disabled', false);
      return;
    }
    clientConsole(2, '[GOOGLE-LOGIN] OAuth config found:', !!googleConfig);

    // Set the login mode to google
    Session.set('loginMode', 'google');

    const options = {
      requestOfflineToken: true,
      requestPermissions: ['email', 'profile'],
      loginStyle: 'popup',
    };

    // METEOR 3 FIX: Use promisified version instead of callback
    const loginWithGoogleAsync = Meteor.promisify(Meteor.loginWithGoogle);

    try {
      clientConsole(2, '[GOOGLE-LOGIN] Initiating Meteor.loginWithGoogle...');
      await loginWithGoogleAsync(options);

      clientConsole(2, '[GOOGLE-LOGIN] Login successful!');
      clientConsole(2, '[GOOGLE-LOGIN] User after login:', Meteor.userId());

      if(!Session.get('curClass')){
        //If we are not in a class and we log in, we need to disable embedded API keys.
        Session.set('useEmbeddedAPIKeys', false);
      }

      // Set loginParams on server
      clientConsole(2, '[GOOGLE-LOGIN] Calling setUserLoginData...');
      try {
        await meteorCallAsync('setUserLoginData', `direct`, Session.get('loginMode'));
        clientConsole(2, '[GOOGLE-LOGIN] setUserLoginData completed on server');
      } catch (error) {
        clientConsole(1, '[GOOGLE-LOGIN] setUserLoginData failed:', error);
        alert('Failed to save login data: ' + error.message);
        Meteor.logout();
        $('#signInButton').prop('disabled', false);
        return;
      }

      // Wait for loginParams to sync to client
      clientConsole(2, '[GOOGLE-LOGIN] Waiting for loginParams to sync to client...');
      const loginParamsFound = await new Promise((resolve) => {
        const checkLoginParams = Tracker.autorun((computation) => {
          const user = Meteor.user();
          if (user && user.loginParams) {
            clientConsole(2, '[GOOGLE-LOGIN] loginParams synced to client:', user.loginParams);
            computation.stop();
            resolve(true);
          }
        });
        // Timeout after 10 seconds
        setTimeout(() => {
          checkLoginParams.stop();
          clientConsole(1, '[GOOGLE-LOGIN] TIMEOUT waiting for loginParams!');
          resolve(false);
        }, 10000);
      });

      if (!loginParamsFound) {
        clientConsole(1, '[GOOGLE-LOGIN] WARNING: loginParams never synced, but continuing anyway');
      }

      if (Session.get('debugging')) {
        const currentUser = Meteor.users.findOne({_id: Meteor.userId()});
        const username = currentUser?.username || Meteor.userId();
        clientConsole(2, '[GOOGLE-LOGIN] ' + username + ' was logged in successfully! Current route is ', Router.current().route.getName());
        Meteor.callAsync('debugLog', 'Sign in was successful');
      }

      clientConsole(2, '[GOOGLE-LOGIN] Calling logUserAgentAndLoginTime...');
      Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);

      clientConsole(2, '[GOOGLE-LOGIN] Logging out other clients...');
      Meteor.logoutOtherClients();

      // Route to /profile like password login does
      clientConsole(2, '[GOOGLE-LOGIN] Routing to /profile');
      Router.go('/profile');

    } catch (error) {
      clientConsole(1, '[GOOGLE-LOGIN] Login Error:', error);
      clientConsole(1, '[GOOGLE-LOGIN] Error details:', JSON.stringify(error, null, 2));
      alert('Google login failed: ' + error.message);
      $('#signInButton').prop('disabled', false);
    }
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

  'oauthConfigReady': function() {
    // Check if OAuth service configurations are loaded
    const googleConfig = ServiceConfiguration.configurations.findOne({service: 'google'});
    const msConfig = ServiceConfiguration.configurations.findOne({service: 'microsoft'});
    return !!(googleConfig && msConfig);
  },

});

// //////////////////////////////////////////////////////////////////////////
// Implementation functions

// Called after we have signed in
async function signInNotify(landingPage = '/profile') {
  const curClass = Session.get('curClass');
  const curTeacher = Session.get('curTeacher');
  if(curTeacher && curClass){
    try {
      const result = await Meteor.callAsync('addUserToTeachersClass', Meteor.userId(), curTeacher._id, curClass.sectionId);
      clientConsole(2, 'addUserToTeachersClass result: ' + result);
      let sectionName = "";
      if(curClass.sectionName){
        sectionName = "/" + curClass.sectionName;
      }
      const asignedTDFIds = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), curClass.sectionId)
      const entryPoint = `${curTeacher.username}/${curClass.courseName + sectionName}`
      await meteorCallAsync('setUserLoginData', entryPoint, Session.get('loginMode'), curTeacher, curClass, asignedTDFIds);
    } catch (err) {
      clientConsole(1, 'error adding user to teacher class: ' + err);
      alert(err);
      return;
    }
  }
  if (Session.get('debugging')) {
    const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
    clientConsole(2, currentUser + ' was logged in successfully! Current route is ', Router.current().route.getName());
    Meteor.callAsync('debugLog', 'Sign in was successful');
    Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
  }
  Meteor.logoutOtherClients();
  if(landingPage)
    Router.go(landingPage);
}

async function userPasswordCheck() {
  // Hide previous errors
  $('.errcheck').hide();

  //Clear Impersonations
  Meteor.callAsync('clearImpersonation');
  
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
      clientConsole(2, 'username:' + newUsername + ',password:' + newPassword);

      // METEOR 3 FIX: Use promisified version instead of callback
      const loginWithPasswordAsync = Meteor.promisify(Meteor.loginWithPassword);

      try {
        await loginWithPasswordAsync(newUsername, newPassword);

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

        try {
          await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
          clientConsole(2, '[EXPERIMENT-LOGIN] setUserLoginData completed');
        } catch (error) {
          clientConsole(1, '[EXPERIMENT-LOGIN] setUserLoginData failed:', error);
          alert('Failed to save login data: ' + error.message);
          $('#signInButton').prop('disabled', false);
          return;
        }

        signInNotify(false);
      } catch (error) {
        clientConsole(1, 'ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
        alert('It appears that you couldn\'t be logged in as ' + newUsername);
        $('#signInButton').prop('disabled', false);
      }

      return;
    } else {
      // Experimental ID's are assumed to be upper case
      newUsername = newUsername.toUpperCase();

      // Experiment mode - we create a user if one isn't already there. We
      // Call sign up - specifying that a duplicate user is OK
      (async () => {
        try {
          await Meteor.callAsync('signUpUser', newUsername, newPassword, true);

          // Everything was OK if we make it here - now we init the session,
          // login, and proceed to the profile screen

          sessionCleanUp();

        Meteor.loginWithPassword(newUsername, newPassword, async function(error) {
          if (typeof error !== 'undefined') {
            clientConsole(1, 'ERROR: The user was not logged in on experiment sign in?', newUsername, 'Error:', error);
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

            try {
              await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
              clientConsole(2, '[EXPERIMENT-LOGIN-2] setUserLoginData completed');
            } catch (error) {
              clientConsole(1, '[EXPERIMENT-LOGIN-2] setUserLoginData failed:', error);
              alert('Failed to save login data: ' + error.message);
              $('#signInButton').prop('disabled', false);
              return;
            }

            signInNotify(false);
          }
        });
        } catch (error) {
          const errorMsgs = [error];
          clientConsole(1, 'Experiment user login errors:', displayify(errorMsgs));
          $('#serverErrors')
              .html(errorMsgs.join('<br>'))
              .show();
          $('#signInButton').prop('disabled', false);
          return;
        }
      })();

      // No more processing
      return;
    }
  }

  // If we're here, we're NOT in experimental mode
  // METEOR 3 FIX: Use promisified version instead of callback
  const loginWithPasswordAsync = Meteor.promisify(Meteor.loginWithPassword);

  try {
    await loginWithPasswordAsync(newUsername, newPassword);

    if(!Session.get('curClass')){
      //If we are not in a class and we log in, we need to disable embedded API keys.
      Session.set('useEmbeddedAPIKeys', false);
    }

    if (newPassword === blankPassword(newUsername)) {
      // So now we know it's NOT experiment mode and they've logged in
      // with a blank password. Currently this is someone who's
      // managed to figure out to use the "normal" login flow. Tell
      // them the "correct" way to use the system.
      clientConsole(2, 'Detected non-experimental login for turk ID', newUsername);
      alert('This login page is not for Mechanical Turk workers. Please use the link provided with your HIT');
      $('#signInButton').prop('disabled', false);
      return;
    }

    // Set loginParams BEFORE routing to ensure data is ready
    try {
      await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
      clientConsole(2, '[PASSWORD-LOGIN] setUserLoginData completed');
    } catch (error) {
      clientConsole(1, '[PASSWORD-LOGIN] setUserLoginData failed:', error);
      alert('Failed to save login data: ' + error.message);
      $('#signInButton').prop('disabled', false);
      return;
    }

    signInNotify();
  } catch (error) {
    clientConsole(1, 'Login error: ' + error);
    $('#invalidLogin').show();
    alert('Your username or password was incorrect. Please try again.');
    $('#signInButton').prop('disabled', false);
  }
}


function testUserEnabled() {
  return _.chain(Meteor.settings).prop('public').prop('testLogin').value();
}

async function testLogin() {
  clientConsole(2, 'TEST Login');

  // Just a sanity check
  if (!testUserEnabled()) {
    clientConsole(1, 'TEST Login REJECTED');
    $('#testSignInButton').prop('disabled', false);
    return;
  }

  const testUserName = _.trim($('#signInUsername').val()).toUpperCase();
  if (!testUserName) {
    clientConsole(1, 'No TEST user name specified');
    alert('No TEST user name specified');
    $('#testSignInButton').prop('disabled', false);
    return;
  }

  const testPassword = blankPassword(testUserName);

  (async () => {
    try {
      await Meteor.callAsync('signUpUser', testUserName, testPassword, true);

      Meteor.callAsync('clearImpersonation');
      sessionCleanUp();

    // Note that we force Meteor to think we have a user name so that
    // it doesn't try it as an email - this let's you test email-like
    // users, which you can promote to admin or teacher
    Meteor.loginWithPassword({'username': testUserName}, testPassword, async function(error) {
      if (typeof error !== 'undefined') {
        clientConsole(1, 'ERROR: The user was not logged in on TEST sign in?', testUserName, 'Error:', error);
        alert('It appears that you couldn\'t be logged in as ' + testUserName);
        $('#testSignInButton').prop('disabled', false);
      } else {
        if (Session.get('debugging')) {
          const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
          clientConsole(2, currentUser + ' was test logged in successfully! Current route is ', Router.current().route.getName());
          Meteor.callAsync('debugLog', 'TEST Sign in was successful - YOU SHOULD NOT SEE THIS IN PRODUCTION');
        }
        Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
        const curClass = Session.get('curClass');
        const curTeacher = Session.get('curTeacher');
        if(curTeacher && curClass){
          try {
            const result = await Meteor.callAsync('addUserToTeachersClass', Meteor.userId(), curTeacher._id, curClass.sectionId);
            clientConsole(2, 'addUserToTeachersClass result: ' + result);
            let sectionName = "";
            if(curClass.sectionName){
              sectionName = "/" + curClass.sectionName;
            }
            const asignedTDFIds = await meteorCallAsync('getTdfsAssignedToStudent', Meteor.userId(), curClass.sectionId)
            const entryPoint = `${curTeacher.username}/${curClass.courseName + sectionName}`
            await meteorCallAsync('setUserLoginData', entryPoint, Session.get('loginMode'), curTeacher, curClass, asignedTDFIds);
          } catch (err) {
            clientConsole(1, 'error adding user to teacher class: ' + err);
            alert(err);
            return;
          }
        } else {
          await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
        }
        Meteor.logoutOtherClients();
        Router.go('/profile');
      }
    });
    } catch (error) {
      const errorMsgs = [error];
      const errorText = displayify(errorMsgs);
      clientConsole(1, 'Experiment user login errors:', errorText);
      alert('Experiment user login errors:', errorText);
      $('#testSignInButton').prop('disabled', false);
    }
  })();
}



setTeacher = function(teacher) { // Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  //route to the teacher's login page
  Router.go('/classes/' + teacher.username);
};