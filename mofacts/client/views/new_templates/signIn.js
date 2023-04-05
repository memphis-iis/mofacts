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
    
    //get institutions
    const institutions = [
      {name: 'None', route: ''},
      {name: 'Soutwest', route: 'signInSouthwest'}
    ]
    Session.set('institutions', institutions);
    console.log('institutions', institutions);

    let verifiedTeachers = await meteorCallAsync('getAllTeachers');
    console.log('verifiedTeachers', verifiedTeachers);
  
    console.log('got teachers');
    Session.set('teachers', verifiedTeachers);
  }
  if(Meteor.userId() && Meteor.user().profile.loginMode !== 'experiment'){
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
    setTeacher(event.target.value);
  },
  'change #classSelect': function(event) {
    event.preventDefault();
    setClass(event.target.value);
  },
  'click #signInWithSSOModalButton': function(event) {
    event.preventDefault();
    console.log('saml login');
    const provider = event.target.getAttribute('data-provider');
    console.log('provider: ' + JSON.stringify(provider));
    Meteor.loginWithSaml({
      provider,
    }, function(data, data2) {
      console.log('callback');
      // handle errors and result
      console.log('data: ' + JSON.stringify(data));
      console.log('data2: ' + JSON.stringify(data2));
      if (!!data && !!data.error) {
        alert('Problem logging in: ' + data.error);
      } else {
        Meteor.call('addUserToTeachersClass', Meteor.userId(), Session.get('curTeacher')._id, Session.get('curClass').sectionId, async function(err, result) {
          if (err) {
            console.log('error adding user to teacher class: ' + err);
          }
          console.log('addUserToTeachersClass result: ' + result);
          let sectionName = "";
          if(Session.get('curClass').sectionName){
            sectionName = "/" + Session.get('curClass').sectionName;
          }
          const entryPoint = `${Session.get('curTeacher').username}/${Session.get('curClass').courseName + sectionName}`
          await meteorCallAsync('setUserLoginData', entryPoint, 'southwest', Session.get('curTeacher'), Session.get('curClass'));
          Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
          Meteor.call('updatePerformanceData', 'login', 'signinSouthwest.clickSamlLogin', Meteor.userId());
          Meteor.logoutOtherClients();
          Router.go('/profile');
        });
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
    Session.set('curSectionId', sectionId)
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

    Meteor.loginWithGoogle(options, async function(err) {
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
      await meteorCallAsync('setUserLoginData', `direct`, Session.get('loginMode'));
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

  'curTeacherSections': () => Session.get('sectionsByInstructorId'),
  
  'checkSectionExists': (sectionName) => sectionName != undefined && sectionName.length > 0,

  'institutions': () => Session.get('institutions'),
  
});

// //////////////////////////////////////////////////////////////////////////
// Implementation functions

// Called after we have signed in
function signinNotify(landingPage = '/profile') {
  if(Session.get('curTeacher') && Session.get('curClass')){
    Meteor.call('addUserToTeachersClass', Meteor.userId(), Session.get('curTeacher')._id, Session.get('curClass').sectionId,
    async function(err, result) {
      if (err) {
        console.log('error adding user to teacher class: ' + err);
        alert(err);
        return;
      }
      console.log('addUserToTeachersClass result: ' + result);
      let sectionName = "";
      if(Session.get('curClass').sectionName){
        sectionName = "/" + Session.get('curClass').sectionName;
      }
      const entryPoint = `${Session.get('curTeacher').username}/${Session.get('curClass').courseName + sectionName}`
      await meteorCallAsync('setUserLoginData', entryPoint, Session.get('loginMode'), Session.get('curTeacher'), Session.get('curClass'));

    });
  }
  if (Session.get('debugging')) {
    const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
    console.log(currentUser + ' was logged in successfully! Current route is ', Router.current().route.getName());
    Meteor.call('debugLog', 'Sign in was successful');
    Meteor.call('updatePerformanceData', 'login', 'signin.signinNotify', Meteor.userId());
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
          signinNotify(false);
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
            signinNotify(false);
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
      signinNotify();
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
        Meteor.call('updatePerformanceData', 'login', 'signinOauth.testLogin', Meteor.userId());
        await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
        Meteor.logoutOtherClients();
        Router.go('/profile');
      }
    });
  });
}

setClass = function(curClassID) {
  console.log(curClassID);
  $('#classSelection').prop('hidden', 'true');
  const allClasses = Session.get('sectionsByInstructorId');
  const curClass = allClasses.find((aClass) => aClass.sectionid == curClassID);
  Session.set('curClass', curClass);
  Session.set('curSectionId', curClass.sectionid)
  console.log("Class/Section Set", curClass, curClass.sectionid);
  $('.login').prop('hidden', '');
};

setTeacher = function(teacher) { // Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  console.log(teacher);
  Session.set('curTeacher', teacher);
  $('#initialInstructorSelection').prop('hidden', 'true');
  const curClasses = Session.get('classesByInstructorId')[teacher._id];
  console.log('setTeacher', Session.get('classesByInstructorId'), teacher._id, teacher);

  if (curClasses == undefined) {
    $('#initialInstructorSelection').prop('hidden', '');
    alert('Your instructor hasn\'t set up their classes yet.  Please contact them and check back in at a later time.');
    Session.set('curTeacher', {});
  } else {
    Session.set('curTeacherClasses', curClasses);
    $('#classSelection').prop('hidden', '');
  }
};