import Promise from 'bluebird';
import {dialogueContinue} from './views/experiment/dialogueUtils.js';
import {haveMeteorUser} from './lib/currentTestingHelpers';
import {ENTER_KEY} from '../common/Definitions.js';
import {sessionCleanUp} from './lib/sessionUtils.js';
import {restartMainCardTimeoutIfNecessary} from './views/experiment/card.js';
import {instructContinue} from './views/experiment/instructions.js';
import {routeToSignin} from './lib/router.js';
export {redoCardImage, meteorCallAsync};

const meteorCallAsync = Promise.promisify(Meteor.call);

// function meteorCallAsync(funcName, ...rest) {
//   const promisedMeteorCall = Promise.promisify(Meteor.call);
//   return promisedMeteorCall.apply(null, [funcName, rest]);
// }
Session.set('enterKeyLock', false);

// This will be setup for window resize, but is made global so that the
// card template page can hook it up as well
function redoCardImage() {
  // Note that just in case we can't get the height on the window we punt
  // with a default that is reasonable a lot of the time
  const wid = $(window).width() || 640;
  const hgt = $(window).height() || 480;
  let heightStr;
  let widthStr;

  if (wid > hgt) {
    // Landscape - assume that we want the image to fit entirely along
    // with the answer box on a fairly sane screen
    heightStr = _.display(Math.floor(hgt * 0.45)) + 'px';
    widthStr = 'auto';
  } else {
    // Portrait - set the image to be the width of the screen. They'll
    // probably need to scroll for tall images
    heightStr = 'auto';
    widthStr = '90%';
  }

  $('#cardQuestionImg').css('height', heightStr).css('width', widthStr);
}

Meteor.startup(function() {
  console.logs = [];
  console.defaultLog = console.log.bind(console);
  console.log = function(...args) {
    const convertedArgs = [];
    for (const index in args) {
      if (typeof(args[index]) != 'object') {
        convertedArgs.push(args[index]);
      } else {
        try {
          convertedArgs.push(JSON.stringify(args[index]));
        } catch (e) {
          convertedArgs.push(e);
        }
      }
    }
    console.logs.unshift(convertedArgs);
    console.logs = console.logs.slice(0, 2000);
    console.defaultLog.apply(null, args);
  };
  Session.set('debugging', true);
  sessionCleanUp();

  // Include any special jQuery handling we need
  $(window).on('resize', function() {
    redoCardImage();
  });
});

Template.body.onRendered(function() {
  $('#errorReportingModal').on('hidden.bs.modal', function() {
    console.log('error reporting modal hidden');
    restartMainCardTimeoutIfNecessary();
  });

  // Global handler for continue buttons
  $(window).keypress(function(e) {
    const key = e.keyCode || e.which;
    if (key == ENTER_KEY && e.target.tagName != 'INPUT') {
      window.keypressEvent = e;
      const curPage = document.location.pathname;
      console.log('global enter key, curPage: ' + curPage);
      console.log(e);

      if (!Session.get('enterKeyLock')) {
        Session.set('enterKeyLock', true);
        console.log('grabbed enterKeyLock on global enter handler');
        switch (curPage) {
          case '/instructions':
            e.preventDefault();
            instructContinue();
            break;
          case '/card':
            // TODO: add in code for enter key progressing skipstudy/continueStudy button
            dialogueContinue();
            break;
        }
      }
    }
  });
});

Template.body.events({
  'click #homeButton': function(event) {
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    Router.go('/profile');
  },

  'click #progressButton': function(event) {
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    // Clear out studentUsername in case we are a teacher/admin who previously
    // navigated to this page for a particular student and want to see our own progress
    Session.set('studentUsername', null);
    Session.set('curStudentID', undefined);
    Session.set('curStudentPerformance', undefined);
    Session.set('curClass', undefined);
    Session.set('instructorSelectedTdf', undefined);
    Session.set('curClassPerformance', undefined);
    Router.go('/studentReporting');
  },

  'click #errorReportButton': function(event) {
    event.preventDefault();
    Session.set('pausedLocks', Session.get('pausedLocks')+1);
    Session.set('errorReportStart', new Date());
    $('#errorReportingModal').modal('show');
  },

  'click #errorReportingSaveButton': function(event) {
    event.preventDefault();
    console.log('save error reporting button pressed');
    const errorDescription = $('#errorDescription').val();
    const curUser = Meteor.userId();
    const curPage = document.location.pathname;
    const sessionVars = Session.all();
    const userAgent = navigator.userAgent;
    const logs = console.logs;
    Meteor.call('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars, userAgent, logs);
    $('#errorReportingModal').modal('hide');
    $('#errorDescription').val('');
  },

  'click #logoutButton': function(event) {
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    Meteor.logout( function(error) {
      if (typeof error !== 'undefined') {
        // something happened during logout
        console.log('User:', Meteor.user(), 'Error:', error);
      } else {
        sessionCleanUp();
        routeToSignin();
      }
    });
  },
});

// Global template helpers
Template.registerHelper('isLoggedIn', function() {
  return haveMeteorUser();
});

Template.registerHelper('showPerformanceDetails', function() {
  return (Session.get('curModule') == 'card' || Session.get('curModule') == 'instructions') && Session.get('scoringEnabled');
});

Template.registerHelper('currentScore', function() {
  return Session.get('currentScore');
});

Template.registerHelper('isNormal', function() {
  return Session.get('loginMode') !== 'experiment';
});

Template.registerHelper('curStudentPerformance', function() {
  return Session.get('curStudentPerformance');
});
