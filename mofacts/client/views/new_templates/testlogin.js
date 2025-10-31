import {meteorCallAsync} from '../..';
import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {displayify} from '../../../common/globalHelpers';
import {selectTdf} from '../home/profile'
import {routeToSignin} from '../../lib/router';


Template.testLogin.onRendered(async function() {
  if (Session.get('loginMode') !== 'experiment') {
    console.log('password signin, setting login mode');
    Session.set('loginMode', 'password');
    
    let verifiedTeachers = await meteorCallAsync('getAllTeachers');
    console.log('verifiedTeachers', verifiedTeachers);
  
    console.log('got teachers');
    Session.set('teachers', verifiedTeachers);
  }
  if(Meteor.userId() && Meteor.user().loginParams && Meteor.user().loginParams.loginMode !== 'experiment'){
    console.log("already logged in")
    Router.go("/profile");
  }

  //check for username as a url parameter, if so prefill #signInUsername and activate testLogin function
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    if(username){
        $('#signInUsername').val(username);
        alert("You are being logged in as " + username);
        testLogin();
    }

});


// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.testLogin.events({
  'click #testSignInButton': function(event) {
    $('#testSignInButton').prop('disabled', true);
    event.preventDefault();
    testLogin();
  },
});

// //////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.testLogin.helpers({
  isExperiment: function() {
    return Session.get('loginMode') === 'experiment';
  },

  experimentPasswordRequired: function() {
    return Session.get('experimentPasswordRequired');
  },

  isNormal: function() {
    return Session.get('loginMode') !== 'experiment';
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
async function signinNotify(landingPage = '/profile') {
  const curClass = Session.get('curClass');
  const curTeacher = Session.get('curTeacher');
  if(curTeacher && curClass){
    Meteor.callAsync('addUserToTeachersClass', Meteor.userId(), curTeacher._id, curClass.sectionId,
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
    Meteor.callAsync('debugLog', 'Sign in was successful');
    Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
  }
  Meteor.logoutOtherClients();
  if(landingPage)
    Router.go(landingPage);
}



async function testLogin() {
  console.log('TEST Login');

  const testUserName = _.trim($('#signInUsername').val()).toUpperCase();
  if (!testUserName) {
    console.log('No TEST user name specified');
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
          console.log('ERROR: The user was not logged in on TEST sign in?', testUserName, 'Error:', error);
          alert('It appears that you couldn\'t be logged in as ' + testUserName);
          $('#testSignInButton').prop('disabled', false);
        } else {
          if (Session.get('debugging')) {
            const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
            console.log(currentUser + ' was test logged in successfully! Current route is ', Router.current().route.getName());
            Meteor.callAsync('debugLog', 'TEST Sign in was successful - YOU SHOULD NOT SEE THIS IN PRODUCTION');
          }
          Meteor.callAsync('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
          await meteorCallAsync('setUserLoginData', 'direct', Session.get('loginMode'));
          Meteor.logoutOtherClients();
          Router.go('/profile');
        }
      });
    } catch (error) {
      const errorText = displayify([error]);
      console.log('Experiment user login errors:', errorText);
      alert('Experiment user login errors:', errorText);
      $('#testSignInButton').prop('disabled', false);
    }
  })();
}



setTeacher = function(teacher) { // Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  //route to the teacher's login page
  Router.go('/classes/' + teacher.username);
};