import Promise from 'bluebird';
import {dialogueContinue} from './views/experiment/dialogueUtils.js';
import {haveMeteorUser} from './lib/currentTestingHelpers';
import {ENTER_KEY} from '../common/Definitions.js';
import {sessionCleanUp} from './lib/sessionUtils.js';
import {restartMainCardTimeoutIfNecessary} from './views/experiment/card.js';
import {instructContinue} from './views/experiment/instructions.js';
import {routeToSignin} from './lib/router.js';
import { init } from "meteor/simonsimcity:client-session-timeout";

// This redirects to the SSL version of the page if we're not on it
const forceSSL = Meteor.settings.public.forceSSL || false;
console.log('forceSSL', forceSSL);
if (location.protocol !== 'https:' && forceSSL) {
  location.href = location.href.replace(/^http:/, 'https:');
}

try{
  //Prevents new tab
  const channel = new BroadcastChannel('tab');

  channel.postMessage('another-tab');
  // note that listener is added after posting the message

  channel.addEventListener('message', (msg) => {
    if (msg.data === 'another-tab') {
      Router.go('/tabwarning');
    }
  });
}
catch{
  //IE + Safari 3.1 - 15.3 support
  localStorage.openpages = Date.now();
  window.addEventListener('storage', function (e) {
    if(e.key == 'openpages') {
      Router.go('/tabwarning');
    }
  }, false);
}

if((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1 ) {
  Session.set('isOpera', true)
} else if(navigator.userAgent.indexOf("Edg") != -1 ) {
  Session.set('isEdge', true)
} else if(navigator.userAgent.indexOf("Chrome") != -1 ) {
  Session.set('isChrome', true)
} else if(navigator.userAgent.indexOf("Safari") != -1) {
  Session.set('isSafari', true)
} else if(navigator.userAgent.indexOf("Firefox") != -1 ) {
  Session.set('isFirefox', true)
} else if((navigator.userAgent.indexOf("MSIE") != -1 ) || (!!document.documentMode == true )) {
  Session.set('isIE', true)
}

//Set checks if user is inactive
const options = {
  expiryTime: 30 * 60 * 60 * 1000 // 30 mins
};
init(options);
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
    console.logs = console.logs.concat(convertedArgs);
    console.logs = console.logs.slice(0, 100000);
    console.defaultLog.apply(null, args);
  };
  Session.set('debugging', true);
  sessionCleanUp();

  // Include any special jQuery handling we need
  $(window).on('resize', function() {
    redoCardImage();
  });
});

Template.DefaultLayout.onRendered(function() {
  $('#errorReportingModal').on('hidden.bs.modal', function() {
    console.log('error reporting modal hidden');
    restartMainCardTimeoutIfNecessary();
  });

  $('#helpModal').on('hidden.bs.modal', function() {
    if (window.currentAudioObj) {
      window.currentAudioObj.play();
    }
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

Template.DefaultLayout.events({
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
  'click #helpButton': function(event) {
    event.preventDefault();
    Session.set('pausedLocks', Session.get('pausedLocks')+1);
    Session.set('errorReportStart', new Date());
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
  },
  'click #helpCloseButton': function(event) {
    event.preventDefault();
    $('#errorReportingModal').modal('hide');
  },

  'click #errorReportButton': function(event) {
    event.preventDefault();
    Session.set('pausedLocks', Session.get('pausedLocks')+1);
    Session.set('errorReportStart', new Date());
    //set the modalTemplate session variable to the reportError template
    templateObject = {
      template: 'errorReportModal',
      title: 'Report an Error',
    }
    Session.set('modalTemplate', templateObject);
    console.log("modalTemplate: " + Session.get('modalTemplate'));
  },

  'click #resetFeedbackSettingsButton': function(event) {
    event.preventDefault();
    Session.set('pausedLocks', Session.get('pausedLocks')+1);
    Session.set('displayFeedback', true);
    Session.set('resetFeedbackSettingsFromIndex', true);
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
    const currentExperimentState = Session.get('currentExperimentState');
    Meteor.call('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars,
        userAgent, logs, currentExperimentState);
    $('#errorReportingModal').modal('hide');
    $('#errorDescription').val('');
  },

  'click #logoutButton': function(event) {
    Meteor.call('clearImpersonation',Meteor.userId());
    Meteor.call('clearLoginData');
    Session.set('curUnitInstructionsSeen', undefined);
    Session.set('curSectionId', undefined);
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    Meteor.logout( function(error) {
      if (typeof error !== 'undefined') {
        // something happened during logout
        console.log('User:', Meteor.user(), 'Error:', error);
      } else {
        Session.set('curTeacher', undefined);
        Session.set('curClass', undefined);
        sessionCleanUp();
        routeToSignin();
      }
    });
  },
  'click #wikiButton': function(event) {
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    //open the wiki in a new tab
    window.open('https://github.com/memphis-iis/mofacts-ies/wiki', '_blank');
  },
});
// Global template helpers
Template.registerHelper('modalTemplate', function() {
  modalTemplate = Session.get('modalTemplate');
  console.log('modalTemplate: ' + JSON.stringify(modalTemplate));
  return modalTemplate.template;
});
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
Template.registerHelper('showFeedbackResetButton', function() {
  return Session.get('curModule') == 'card' && Session.get('currentTdfFile').tdfs.tutor.unit[Session.get('currentUnitNumber')].deliveryparams.allowFeedbackTypeSelect
});
Template.registerHelper('isInTrial', function() {
  return Session.get('curModule') == 'card'
});
Template.registerHelper('isInSession', function() {
  return (Session.get('curModule') == 'profile');
});
Template.registerHelper('curTdfTips', function() {
  if(Session.get('curTdfTips'))
    return Session.get('curTdfTips');
});
Template.registerHelper('and',(a,b)=>{
  return a && b;
});
Template.registerHelper('or',(a,b)=>{
  return a || b;
});

