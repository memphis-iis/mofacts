import Promise from 'bluebird';
import {dialogueContinue} from './views/experiment/dialogueUtils.js';
import {haveMeteorUser} from './lib/currentTestingHelpers';
import {ENTER_KEY} from '../common/Definitions.js';
import {sessionCleanUp} from './lib/sessionUtils.js';
import {restartMainCardTimeoutIfNecessary} from './views/experiment/card.js';
import {instructContinue} from './views/experiment/instructions.js';
import {routeToSignin} from './lib/router.js';
import { init } from "meteor/simonsimcity:client-session-timeout";

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
data = localMongo.findOne({}) || {}; data.enterKeyLock =  false; localMongo.update({},{$set:data});

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
  const localMongo = new Mongo.Collection(null); // local-only - no database
  var localMongoObserver = new PersistentMinimongo2(localMongo, 'MoFACTs');
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
  data={debugging: true};localMongo.upsert(data);
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

      if (!localMongo.findOne({}).enterKeyLock) {
        data = localMongo.findOne({}) || {}; data.enterKeyLock =  true; localMongo.update({},{$set:data});
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
    if(localMongo.findOne({}).loginMode == 'southwest'){
      Router.go('/profileSouthwest')
    } else {
      Router.go('/profile');
    }
  },

  'click #progressButton': function(event) {
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    // Clear out studentUsername in case we are a teacher/admin who previously
    // navigated to this page for a particular student and want to see our own progress
    data = localMongo.findOne({}) || {}; data.studentUsername =  null; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.curStudentID =  undefined; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.curStudentPerformance =  undefined; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.curClass =  undefined; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.instructorSelectedTdf =  undefined; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.curClassPerformance =  undefined; localMongo.update({},{$set:data});
    Router.go('/studentReporting');
  },

  'click #errorReportButton': function(event) {
    event.preventDefault();
    data = localMongo.findOne({}) || {}; data.pausedLocks =  localMongo.findOne({}).pausedLocks+1; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.errorReportStart =  new Date(); localMongo.update({},{$set:data});
    $('#errorReportingModal').modal('show');
  },

  'click #resetFeedbackSettingsButton': function(event) {
    event.preventDefault();
    data = localMongo.findOne({}) || {}; data.pausedLocks =  localMongo.findOne({}).pausedLocks+1; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.displayFeedback =  true; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.resetFeedbackSettingsFromIndex =  true; localMongo.update({},{$set:data});
  }, 
  'click #wikiButton': function(event) {
    window.open(
      'https://github.com/memphis-iis/mofacts-ies/wiki',
      '_blank'
    );
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
    const currentExperimentState = localMongo.findOne({}).currentExperimentState
    Meteor.call('sendUserErrorReport', curUser, errorDescription, curPage, sessionVars,
        userAgent, logs, currentExperimentState);
    $('#errorReportingModal').modal('hide');
    $('#errorDescription').val('');
  },

  'click #logoutButton': function(event) {
    Meteor.call('clearImpersonation',Meteor.userId());
    data = localMongo.findOne({}) || {}; data.curUnitInstructionsSeen =  undefined; localMongo.update({},{$set:data});
    data = localMongo.findOne({}) || {}; data.curSectionId =  undefined; localMongo.update({},{$set:data});
    event.preventDefault();
    if (window.currentAudioObj) {
      window.currentAudioObj.pause();
    }
    Meteor.logout( function(error) {
      if (typeof error !== 'undefined') {
        // something happened during logout
        console.log('User:', Meteor.user(), 'Error:', error);
      } else {
        data = localMongo.findOne({}) || {}; data.curTeacher =  undefined; localMongo.update({},{$set:data});
        data = localMongo.findOne({}) || {}; data.curClass =  undefined; localMongo.update({},{$set:data});
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
  return (localMongo.findOne({}).curModule == 'card' || localMongo.findOne({}).curModule == 'instructions') && localMongo.findOne({}).scoringEnabled
});

Template.registerHelper('currentScore', function() {
  return localMongo.findOne({}).currentScore
});

Template.registerHelper('isNormal', function() {
  return localMongo.findOne({}).loginMode !== 'experiment';
});

Template.registerHelper('curStudentPerformance', function() {
  return localMongo.findOne({}).curStudentPerformance;
});

Template.registerHelper('showFeedbackResetButton', function() {
  return localMongo.findOne({}).curModule == 'card' && localMongo.findOne({}).currentTdfFile.tdfs.tutor.unit[localMongo.findOne({}).currentUnitNumber].deliveryparams.allowFeedbackTypeSelect;
});
Template.registerHelper('isInSession', function() {
  return (localMongo.findOne({}).curModule == 'profile');
})
Template.registerHelper('and',(a,b)=>{
  return a && b;
});
Template.registerHelper('or',(a,b)=>{
  return a || b;
});
