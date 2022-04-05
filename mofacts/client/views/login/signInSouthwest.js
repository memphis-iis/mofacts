import {meteorCallAsync} from '../..';
import {blankPassword} from '../../lib/currentTestingHelpers';
import {sessionCleanUp} from '../../lib/sessionUtils';
import {displayify} from '../../../common/globalHelpers';

const localMongo = new Mongo.Collection(null); // local-only - no database
data = localMongo.findOne({})  || {}; data.teachers =  []; localMongo.update({},{$set:data});
data = localMongo.findOne({})  || {}; data.curTeacher =  {}; localMongo.update({},{$set:data});
data = localMongo.findOne({})  || {}; data.curClass =  {}; localMongo.update({},{$set:data});
data = localMongo.findOne({})  || {}; data.systemOverloaded =  false; localMongo.update({},{$set:data});
data = localMongo.findOne({})  || {}; data.systemDown =  undefined; localMongo.update({},{$set:data});
data = localMongo.findOne({})  || {}; data.classesByInstructorId =  {}; localMongo.update({},{$set:data});



function getUrlVars() {
  const vars = []; let hash;
  if (window.location.href.indexOf('?') > 0) {
    const hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for (let i = 0; i < hashes.length; i++) {
      hash = hashes[i].split('=');
      vars.push(hash[0]);
      vars[hash[0]] = hash[1];
    }
  }
  return vars;
}

function testLogin() {
  console.log('SW Login');

  const testUserName = _.trim($('#username').val()).toUpperCase();
  if (!testUserName) {
    console.log('No user name specified');
    alert('No user name specified');
    $('#signInButton').prop('disabled', false);
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
      console.log('SW user login errors:', errorText);
      alert('User login errors:', errorText);
      $('#signInButton').prop('disabled', false);
      return;
    }

    const newUserId = result;

    Meteor.call('addUserToTeachersClass', newUserId, localMongo.findOne({}).curTeacher._id, localMongo.findOne({}).curClass.sectionid,
        function(err, result) {
          if (err) {
            console.log('error adding user to teacher class: ' + err);
            alert(err);
            return;
          }
          console.log('addUserToTeachersClass result: ' + result);

          sessionCleanUp();

          // Note that we force Meteor to think we have a user name so that
          // it doesn't try it as an email - this let's you test email-like
          // users, which you can promote to admin or teacher
          Meteor.loginWithPassword({'username': testUserName}, testPassword, function(loginerror) {
            if (typeof loginerror !== 'undefined') {
              console.log('ERROR: The user was not logged in on TEST sign in?', testUserName, 'Error:', loginerror);
              alert('It appears that you couldn\'t be logged in as ' + testUserName);
              $('#signInButton').prop('disabled', false);
            } else {
              if (localMongo.findOne({}).debugging) {
                const currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                console.log(currentUser + ' was test logged in successfully! Current route is ',
                    Router.current().route.getName());
              }
              Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
              Meteor.call('updatePerformanceData', 'login', 'signinSouthwest.testLogin', Meteor.userId());
              Meteor.logoutOtherClients();
              Router.go('/profileSouthwest');
            }
          });
        });
  });
}

// eslint-disable-next-line no-undef
setTeacher = function(teacher) { // Shape: {_id:'{{this._id}}',username:'{{this.username}}'}
  console.log(teacher);
  data = localMongo.findOne({}) || {}; data.curTeacher =  teacher; localMongo.update({},{$set:data});
  $('#initialInstructorSelection').prop('hidden', 'true');
  const curClasses = localMongo.findOne({}).classesByInstructorId[teacher._id];
  console.log('setTeacher', localMongo.findOne({}).classesByInstructorId, teacher._id, teacher);

  if (curClasses == undefined) {
    $('#initialInstructorSelection').prop('hidden', '');
    alert('Your instructor hasn\'t set up their classes yet.  Please contact them and check back in at a later time.');
    data = localMongo.findOne({}) || {}; data.curTeacher =  {}; localMongo.update({},{$set:data});
  } else {
    data = localMongo.findOne({}) || {}; data.curTeacherClasses =  curClasses; localMongo.update({},{$set:data});
    $('#classSelection').prop('hidden', '');
  }
};

// eslint-disable-next-line no-undef
setClass = function(curClassID) {
  console.log(curClassID);
  $('#classSelection').prop('hidden', 'true');
  const allClasses = localMongo.findOne({}).curTeacherClasses;
  const curClass = allClasses.find((aClass) => aClass.sectionid == curClassID);
  data = localMongo.findOne({}) || {}; data.curClass =  curClass; localMongo.update({},{$set:data});
  data = localMongo.findOne({}) || {}; data.curSectionId = curClass.sectionid; localMongo.update({},{$set:data});
  
  $('.login').prop('hidden', '');
};

Template.signInSouthwest.onCreated(async function() {
  data = localMongo.findOne({}) || {}; data.loginMode =  'southwest'; localMongo.update({},{$set:data});
  Meteor.call('isSystemDown', function(err, systemDown) {
    console.log('SYSTEM_DOWN:', systemDown);
    data = localMongo.findOne({}) || {}; data.systemDown =  systemDown; localMongo.update({},{$set:data});
  });
  Meteor.call('isCurrentServerLoadTooHigh', function(err, res) {
    console.log('systemOverloaded?', res, err);
    data = localMongo.findOne({}) || {}; data.systemOverloaded =  (typeof(err) != 'undefined' || res); localMongo.update({},{$set:data});
  });
  Meteor.call('getAltServerUrl', function(err, res) {
    if (!(err || !res)) {
      console.log('altServerUrl: ' + res);
      data = localMongo.findOne({}) || {}; data.altServerUrl =  res; localMongo.update({},{$set:data});
    } else {
      console.log('can\'t get alt server url:', err, res);
    }
  });

  const southwestOnly=true;
  let verifiedTeachers = await meteorCallAsync('getAllTeachers', southwestOnly);
  console.log('verifiedTeachers', verifiedTeachers);

  // Hack to redirect rblaudow classes to ambanker
  const ambanker = verifiedTeachers.find((x) => x.username === 'ambanker@southwest.tn.edu');
  const rblaudow = verifiedTeachers.find((x) => x.username === 'rblaudow@southwest.tn.edu');
  if (ambanker && rblaudow) rblaudow._id = ambanker._id;

  console.log('got teachers');
  const urlVars = getUrlVars();
  if (!urlVars['showTestLogins']) {
    data = localMongo.findOne({}) || {}; data.showTestLogins =  false; localMongo.update({},{$set:data});
    const testLogins = [
      'olney@southwest.tn.edu',
      'pavlik@southwest.tn.edu',
      'rawhite@southwest.tn.edu',
      'jrhaner@southwest.tn.edu'
    ];
    verifiedTeachers = verifiedTeachers.filter((x) => testLogins.indexOf(x.username) == -1);
    console.log('verifiedTeachers2', verifiedTeachers);
  } else {
    data = localMongo.findOne({}) || {}; data.showTestLogins =  true; localMongo.update({},{$set:data});
  }
  if (urlVars['showDialogueHints']) {
    data = localMongo.findOne({}) || {}; data.showDialogueHints =  true; localMongo.update({},{$set:data});
  }
  data = localMongo.findOne({}) || {}; data.teachers =  verifiedTeachers; localMongo.update({},{$set:data});
});

Template.signInSouthwest.onRendered(async function() {
  const allCourseSections = await meteorCallAsync('getAllCourseSections');
  const classesByInstructorId = {};
  //  //sectionid, courseandsectionname
  for (const coursesection of allCourseSections) {
    if (!classesByInstructorId[coursesection.teacheruserid]) {
      classesByInstructorId[coursesection.teacheruserid] = [];
    }
    classesByInstructorId[coursesection.teacheruserid].push(coursesection);
  }
  data = localMongo.findOne({}) || {}; data.classesByInstructorId =  classesByInstructorId; localMongo.update({},{$set:data});

  window.onpopstate = function(event) {
    console.log('window popstate signin southwest');
    if (document.location.pathname == '/signInSouthwest') {
      data = localMongo.findOne({}) || {}; data.curTeacher =  {}; localMongo.update({},{$set:data});
      data = localMongo.findOne({}) || {}; data.curClass =  {}; localMongo.update({},{$set:data});
      $('#initialInstructorSelection').prop('hidden', '');
      $('#classSelection').prop('hidden', 'true');
      $('.login').prop('hidden', 'true');
    }
  };
});

Template.signInSouthwest.helpers({
  'altServerUrl': () => localMongo.findOne({}).altServerUrl,

  'readingServerStatus': function() {
    return localMongo.findOne({}).systemDown == undefined;
  },

  'systemDown': function() {
    return localMongo.findOne({}).systemDown && !localMongo.findOne({}).showTestLogins;
  },

  'systemOverloaded': () => localMongo.findOne({}).systemOverloaded && !localMongo.findOne({}).showTestLogins,

  'showTestLogins': () => localMongo.findOne({}).showTestLogins,

  'teachers': () => localMongo.findOne({}).teachers,

  'curTeacherClasses': () => localMongo.findOne({}).curTeacherClasses,

  'checkSectionExists': (sectionName) => sectionName != undefined && sectionName.length > 0,
});

Template.signInSouthwest.events({
  'click .saml-login': function(event) {
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
        Meteor.call('addUserToTeachersClass', Meteor.userId(), localMongo.findOne({}).curTeacher._id,
            localMongo.findOne({}).curClass.sectionid,
            function(err, result) {
              if (err) {
                console.log('error adding user to teacher class: ' + err);
              }
              console.log('addUserToTeachersClass result: ' + result);
              Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), navigator.userAgent);
              Meteor.call('updatePerformanceData', 'login', 'signinSouthwest.clickSamlLogin', Meteor.userId());
              Meteor.logoutOtherClients();
              Router.go('/profileSouthwest');
            });
      }
    });
  },

  'keypress .accept-enter-key': function(event) {
    const key = event.keyCode || event.which;
    if (key == 13) {
      event.preventDefault();
      $('#signInButton').prop('disabled', true);
      testLogin();
    }
  },

  'click #signInButton': function(event) {
    $('#signInButton').prop('disabled', true);
    event.preventDefault();
    testLogin();
  },
});