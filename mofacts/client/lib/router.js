import {meteorCallAsync} from '..';
import {haveMeteorUser} from '../lib/currentTestingHelpers';
import {instructContinue, unitHasLockout} from '../views/experiment/instructions';
import {Cookie} from './cookies';
import {displayify} from '../../common/globalHelpers';

export {routeToSignin};
/* router.js - the routing logic we use for the application.

If you need to create a new route, note that you should specify a name and an
action (at a minimum). This is good practice, but it also works around a bug
in Chrome with certain versions of Iron Router (they routing engine we use).

IMPORTANT: If you are routing someone to the signin screen (i.e. they need to
log in) then you should call the routeToSignin function of calling Router.go
directly. This is important to make sure that both "normal" logins *and*
experimental participant (Mechanical Turk) logins function correctly.

The routes are self-explanatory, but "loginMode" requires a little explanation.
When a user enters the application via a URL of the form /experiment/{target}/{x}
they are placed in "experiment" mode. The following changes are made:

    * The session var "loginMode" is set to "experiment" (instead of "normal")
    * The session var "experimentTarget" is set to whatever is specified in
      {target} in the URL. This is required.
    * The session var "experimentXCond" is set to whatever is specified in {x}
      in the URL. This defaults to 0. The default value is used if the value
      given cannot be interpreted as an int.
    * The user is NOT shown the OAuth "Sign In With Google" screen. Instead a
      screen for user ID entry (which should be their Turk ID) is shown instead
    * The user isn't allowed to select a TDF - the TDF matching {target} is
      always chosen. (This is specified in the <experimentTarget> tag in the
      top TDF setspec section).

As an example, if a user navigates to
    https://mofacts.optimallearning.org/experiment/learning/1
then the following things will happen:

    * Session["loginMode"] == "experiment"
    * Session["experimentTarget"] == "learning"
    * Session["experimentXCond"] == "1"
    * The user is asked for an ID
    * After entering the ID, the user is taken to the TDF with
      <experimentTarget>learning</experimentTarget> in it's setspec

As an example of XCond defaults, the following URL's are ALL equivalent:

    * https://mofacts.optimallearning.org/experiment/learning/
    * https://mofacts.optimallearning.org/experiment/learning/0
    * https://mofacts.optimallearning.org/experiment/learning/abc

A major issue is that once a user enters in experiment mode, the routes (like
instructions and card) look the same. If the user uses the browser's refresh
function, our logic will take them to the "normal" sign in screen. Since we
allow login via Gmail account this could be confusing. As a result, we now use
a cookie scheme to insure experimental participants stay in experiment mode:

    * When a user first hits the URL /experiment/{target}/{x} we write cookies
      (with expiration set so that they outlast the current browser session)
    * Whenever routeToSignin is called, we check the cookies. If they are set
      then we reconstruct the experiment session variables as above.
    * If a user visits the root ("/") route, we reset all cookies back in order
      to allow "normal" login again.
*/

// Note that these three session variables aren't touched by the helpers in
// lib/sessionUtils.js. They are only set here in our client-side routing
Session.set('loginMode', 'normal');
Session.set('experimentTarget', '');
Session.set('experimentXCond', '');
Session.set('clusterMapping', '');



//Set Default Template
Router.configure({
  layoutTemplate: 'DefaultLayout'
});

function routeToSignin() {
  console.log('routeToSignin');
  // If the isExperiment cookie is set we always for experiment mode. This
  // handles an experimental participant refreshing the browser
  const expCookie = _.chain(Cookie.get('isExperiment')).trim().intval().value();
  if (expCookie) {
    Session.set('loginMode', 'experiment');
    Session.set('experimentTarget', Cookie.get('experimentTarget'));
    Session.set('experimentXCond', Cookie.get('experimentXCond'));
  }

  const loginMode = Session.get('loginMode');
  console.log('loginMode: ' + loginMode);

  if (loginMode === 'experiment') {
    console.log('loginMode === experiment');
    const routeParts = ['/experiment'];

    const target = Session.get('experimentTarget');
    if (target) {
      routeParts.push(target);
      const xcond = Session.get('experimentXCond');
      if (xcond) {
        routeParts.push(xcond);
      }
    }

    Router.go(routeParts.join('/'));
  } else if (loginMode === 'southwest') {
    console.log('southwest login, routing to southwest login');
    Router.go('/signInSouthwest');
  } else if (loginMode === 'password') {
    console.log('password login');
    Router.go('/signIn');
  } else { // Normal login mode
    console.log('else, signin');
    Router.go('/');
  }
}

Router.route('/experiment/:target?/:xcond?', {
  name: 'client.experiment',
  waitOn: function() {
    return Meteor.subscribe('tdfByExperimentTarget', this.params.target)
  },
  action: async function() {
    Session.set('curModule', 'experiment');
    // We set our session variable and also set a cookie (so that we still
    // know they're an experimental participant after browser refresh)
    const target = this.params.target || '';
    const xcond = this.params.xcond || '';

    Session.set('loginMode', 'experiment');
    Session.set('experimentTarget', target);
    Session.set('experimentXCond', xcond);

    Cookie.set('isExperiment', '1', 21); // 21 days
    Cookie.set('experimentTarget', target, 21);
    Cookie.set('experimentXCond', xcond, 21);

    const tdf = await meteorCallAsync('getTdfByExperimentTarget', target);
    if (tdf) {
      console.log('tdf found');
      const experimentPasswordRequired = tdf.content.tdfs.tutor.setspec.experimentPasswordRequired ?
          eval(tdf.content.tdfs.tutor.setspec.experimentPasswordRequired) : false;
      Session.set('experimentPasswordRequired', experimentPasswordRequired);
      console.log('experimentPasswordRequired:' + experimentPasswordRequired);

      console.log('EXPERIMENT target:', target, 'xcond', xcond);

      Session.set('clusterMapping', '');
      if(Meteor.userId()) Meteor.logout();
      this.render('signIn');
    }
  },
});

const defaultBehaviorRoutes = [
  'signIn',
  'signInSouthwest',
  'signUp',
  'tabwarning',
  'resetPassword',
  'setTheme',
];

const restrictedRoutes = [
  'multiTdfSelect',
  'turkWorkflow',
  'dataDownload',
  'userProfileEdit',
  'userAdmin',
  'contentGeneration',
  'tdfAssignmentEdit',
  'instructorReporting',
  'feedback',
  'experimentSettings',
  'classControlPanel',
  'contentControlPanel'
];

const getDefaultRouteAction = function(routeName) {
  return function() {
    Session.set('curModule', routeName.toLowerCase());
    console.log(routeName + ' ROUTE');
    this.render(routeName);
  };
};

const getRestrictedRouteAction = function(routeName) {
  return function() {
    if(Meteor.user()){
      Session.set('curModule', routeName.toLowerCase());
      console.log(routeName + ' ROUTE');
      this.render(routeName);
    } else {
      this.redirect('/');
    }
  };
};


// set up all routes with default behavior
for (const route of restrictedRoutes) {
  Router.route('/' + route, {
    name: 'client.' + route,
    action: getRestrictedRouteAction(route),
  });
}

for (const route of defaultBehaviorRoutes) {
  Router.route('/' + route, {
    name: 'client.' + route,
    action: getDefaultRouteAction(route),
  });
}

Router.route('/studentReporting', {
  name: 'client.studentReporting',
  waitOn: function() {
    return [Meteor.subscribe('allTdfs', 'all')];
  },
  action: function() {
    Session.set('curModule', routeName.toLowerCase());
    console.log(routeName + ' ROUTE');
    this.render(routeName);
  }
})

Router.route('/', {
  name: 'client.index',
  action: function() {
    if(Meteor.user() && Meteor.user().profile.loginMode != 'experiment'){
      this.redirect('/profile');
    } else {
      // If they are navigating to "/" then we clear the (possible) cookie
      // keeping them in experiment mode
      if(Meteor.user())
        Meteor.logout();
      Cookie.set('isExperiment', '0', 1); // 1 day
      Cookie.set('experimentTarget', '', 1);
      Cookie.set('experimentXCond', '', 1);
      Session.set('curModule', 'signinoauth');
      this.render('signIn');
    }
  },
});

Router.route('/FileManagement', {
  name: 'client.FileManagement',
  waitOn: function() {
    return Meteor.subscribe('ownedFiles');
  },
  action: function() {
    if(this.ready()){
      if(Meteor.user()) {
        this.render('FileManagement');
      } else {
        this.redirect('/');
      }
    }
  }
})

Router.route('/contentUpload', {
  name: 'client.contentUpload',
  waitOn: function() {
    return [Meteor.subscribe('ownedFiles'), Meteor.subscribe('files.assets.all')];
  },
  action: function() {
    if(Meteor.user()){
      this.render('contentUpload');
    } else {
      this.redirect('/');
    }
  }
})

Router.route('/adminControls', {
  name: 'client.adminControls',
  waitOn: function() {
    return Meteor.subscribe('settings');
  },
  action: function() {
    if(Meteor.user() && Roles.userIsInRole(Meteor.user(), ['admin'])){
      this.render('adminControls');
    } else {
      this.redirect('/');
    }
  }
})

Router.route('/profile', {
  name: 'client.profile',
  waitOn: function() {
    let assignedTdfs = Meteor.user()?.profile?.assignedTdfs || 'undefined';
    let curCourseId = Meteor.user()?.profile?.curClass?.courseId || 'undefined'
    let allSubscriptions = [
      Meteor.subscribe('allUserExperimentState', assignedTdfs)];
    if (curCourseId == 'undefined' || curCourseId == undefined)
      console.log('no assignments found')
    else
      allSubscriptions.push(Meteor.subscribe('Assignments', curCourseId));
    if (Roles.userIsInRole(Meteor.user(), ['admin']))
      allSubscriptions.push(Meteor.subscribe('allUsers'));
    if (assignedTdfs === 'undefined' || assignedTdfs === 'all' || assignedTdfs.length == 0)
      allSubscriptions.push(Meteor.subscribe('allTdfs'));
    else 
      allSubscriptions.push(Meteor.subscribe('currentTdf', assignedTdfs));
    return allSubscriptions;
  },
  action: function() {
    if (Meteor.user()) {
      const loginMode = Meteor.user().profile.loginMode;
      console.log('loginMode: ' + loginMode);

      if (loginMode === 'southwest') {
        console.log('southwest login, routing to southwest profile');
        Session.set('curModule', 'profileSouthwest');
        this.render('/profile');
      } else if (loginMode === 'experiment') {
        Meteor.logout();
        Cookie.set('isExperiment', '0', 1); // 1 day
        Cookie.set('experimentTarget', '', 1);
        Cookie.set('experimentXCond', '', 1);
        Session.set('curModule', 'signinoauth');
        this.redirect('/signIn');
      } else { // Normal login mode
        console.log('else, progress');
        Session.set('curModule', 'profile');
        this.render('profile');
      }
    } else {
      this.redirect('/');
    }
  },
});

Router.route('/classEdit',{
  action: async function(){
  if(Meteor.user()){
    teacherSelected = Meteor.user().username;
    let verifiedTeachers = await meteorCallAsync('getAllTeachers');
    console.log('verifiedTeachers', verifiedTeachers);
  
    // Hack to redirect rblaudow classes to ambanker
    const ambanker = verifiedTeachers.find((x) => x.username === 'ambanker@southwest.tn.edu');
    const rblaudow = verifiedTeachers.find((x) => x.username === 'rblaudow@southwest.tn.edu');
    if (ambanker && rblaudow) rblaudow._id = ambanker._id;
  
    //Get teacher info
    const teacher = verifiedTeachers.find((x) => x.username === teacherSelected);
    console.log('got teachers', teacher);

    Session.set('teachers', verifiedTeachers);    
    
    console.log(teacher);
    Session.set('curTeacher', teacher);
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
    const curClasses = Session.get('classesByInstructorId')[teacher._id];
    console.log('setTeacher', Session.get('classesByInstructorId'), teacher._id, teacher);
    Session.set('curTeacherClasses', curClasses);
    $('#classSelection').prop('hidden', '');
    this.render('classEdit');
  } else {
    this.redirect('/');
  }
}});
//Setup profile routes for direct teacher links
Router.route('/classes/:_teacher', {
  action: async function(){
    teacherSelected = this.params._teacher;
    let southwestOnly = false;
    let loginMode = Session.get('loginMode');
    if(teacherSelected.match(/southwest[.]tn[.]edu/i)){
      loginMode = 'southwest'
      let southwestOnly=true;
    }
    console.log('loginMode: ' + loginMode);
    let verifiedTeachers = await meteorCallAsync('getAllTeachers', southwestOnly);
    console.log('verifiedTeachers', verifiedTeachers);
  
    // Hack to redirect rblaudow classes to ambanker
    const ambanker = verifiedTeachers.find((x) => x.username === 'ambanker@southwest.tn.edu');
    const rblaudow = verifiedTeachers.find((x) => x.username === 'rblaudow@southwest.tn.edu');
    if (ambanker && rblaudow) rblaudow._id = ambanker._id;
  
    //Get teacher info
    const teacher = verifiedTeachers.find((x) => x.username === teacherSelected);
    console.log('got teachers', teacher);

    Session.set('teachers', verifiedTeachers);    
    
    console.log('teacher', teacher);
    Session.set('curTeacher', teacher);
    const allCourseSections = await meteorCallAsync('getAllCourseSections');
    console.log('allCourseSections', allCourseSections);
    const sectionsByInstructorId = [];
    const classesByInstructorId = [];
    //  //sectionid, courseandsectionname
    if(teacher){
      for (const coursesection of allCourseSections) {
        if(coursesection.teacherUserId === teacher._id){
          classesByInstructorId.push(coursesection);
          for(const sectionIndex in coursesection.sections){
            section = coursesection;
            section.sectionid = coursesection.sectionId[sectionIndex];
            section.sectionname = coursesection.sections[sectionIndex];
            sectionsByInstructorId.push(section);
          }
        }
      }
    }  else {
      console.log('teacher not found');
      alert('Your instructor hasn\'t set up their classes yet.  Please contact them and check back in at a later time.')
      Router.go('/');
    }
    Session.set('classesByInstructorId', classesByInstructorId);
    Session.set('sectionsByInstructorId', sectionsByInstructorId);
    const curClasses = Session.get('classesByInstructorId');
    console.log('setTeacher', Session.get('classesByInstructorId'), teacher._id, teacher);
    console.log('setClasses', curClasses);
    console.log('setSections', Session.get('sectionsByInstructorId'));
    if (curClasses == undefined) {
      $('#initialInstructorSelection').prop('hidden', '');
      alert('Your instructor hasn\'t set up their classes yet.  Please contact them and check back in at a later time.');
      Session.set('curTeacher', {});
    } else {
      Session.set('curTeacherClasses', curClasses);
      $('#classSelection').prop('hidden', '');
    }
    if (loginMode === 'southwest') {
      console.log('southwest login, routing to southwest profile');
      Session.set('curModule', 'profileSouthwest');
      this.render('/signInSouthwest');
    } else { // Normal login mode
      console.log('else, progress');
      Session.set('curModule', 'profile');
      this.render('signIn');
    }
  },
});


//Setup profile routes for direct class links
Router.route('/classes/:_teacher/:_class', {
  action: async function(){
    teacherSelected = this.params._teacher;
    curClassID = this.params._class;
    let southwestOnly = false;
    let loginMode = Session.get('loginMode');
    if(teacherSelected.match(/southwest[.]tn[.]edu/i)){
      loginMode = 'southwest'
      let southwestOnly=true;
    } else {
      let loginMode = "";
    }
    console.log('loginMode: ' + loginMode);
    let verifiedTeachers = await meteorCallAsync('getAllTeachers', southwestOnly);
    console.log('verifiedTeachers', verifiedTeachers);

    
  
    // Hack to redirect rblaudow classes to ambanker
    const ambanker = verifiedTeachers.find((x) => x.username === 'ambanker@southwest.tn.edu');
    const rblaudow = verifiedTeachers.find((x) => x.username === 'rblaudow@southwest.tn.edu');
    if (ambanker && rblaudow) rblaudow._id = ambanker._id;
  
    //Get teacher info
    const teacher = verifiedTeachers.find((x) => x.username === teacherSelected);
    console.log('got teachers', teacher);

    Session.set('teachers', verifiedTeachers);    
    
    Session.set('curTeacher', teacher);
    const allCourseSections = await meteorCallAsync('getAllCourseSections');
    const classesByInstructorId = {};
    //  //sectionid, courseandsectionname
    for (const coursesection of allCourseSections) {
      if (!classesByInstructorId[coursesection.teacherUserId]) {
        classesByInstructorId[coursesection.teacherUserId] = [];
      }
      classesByInstructorId[coursesection.teacherUserId].push(coursesection);
    }
    Session.set('classesByInstructorId', classesByInstructorId);
    const curClasses = Session.get('classesByInstructorId')[teacher._id];
    console.log('curClasses', curClasses);
    console.log('setTeacher', Session.get('classesByInstructorId'), teacher._id, teacher);
    if (curClasses == undefined) {
      $('#initialInstructorSelection').prop('hidden', '');
      alert('Your instructor hasn\'t set up their classes yet.  Please contact them and check back in at a later time.');
      Session.set('curTeacher', {});
    } else {
      Session.set('curTeacherClasses', curClasses);
      console.log(curClassID);
      const allClasses = Session.get('curTeacherClasses');
      const curClass = allClasses.find((aClass) => aClass.sectionId == curClassID);
      Session.set('curClass', curClass);
      Session.set('curSectionId', curClass.sectionId)
      $('.login').prop('hidden', '');
    }
    if (loginMode === 'southwest') {
      console.log('southwest login, routing to southwest profile');
      Session.set('curModule', 'profileSouthwest');
      this.render('/signInSouthwest');
    } else { // Normal login mode
      console.log('else, progress');
      Session.set('curModule', 'profile');
      this.render('signIn');
    }
  },
});

Router.route('/card', {
  name: 'client.card',
  waitOn: function() {
    return [ 
      Meteor.subscribe('assets', Session.get('currentTdfFile').ownerId, Session.get('currentStimuliSetId')),
      Meteor.subscribe('userComponentStates', Session.get('currentTdfId')),
      Meteor.subscribe('currentTdf', Session.get('currentTdfId')),
    ]
  },
  action: function() {
    if (Meteor.user()) {
      Session.set('curModule', 'card');
      this.render('card');
    } else {
      this.redirect('/');
    }
  },
});

// We track the start time for instructions, which means we need to track
// them here at the instruction route level
Session.set('instructionClientStart', 0);
Router.route('/instructions', {
  name: 'client.instructions',
  waitOn: function() {
    return [ 
      Meteor.subscribe('assets', Session.get('currentTdfFile').ownerId, Session.get('currentStimuliSetId')),
      Meteor.subscribe('userComponentStates', Session.get('currentTdfId')),
      Meteor.subscribe('currentTdf', Session.get('currentTdfId')),
    ]
  },
  action: function() {
    Session.set('instructionClientStart', Date.now());
    Session.set('curModule', 'instructions');
    Session.set('fromInstructions', true);
    this.render('instructions');
  },
  onBeforeAction: function() {
    if (!haveMeteorUser()) {
      console.log('No one logged in - allowing template to handle');
    } else {
      const unit = Session.get('currentTdfUnit');
      const lockout = unitHasLockout() > 0;
      const txt = unit.unitinstructions ? unit.unitinstructions.trim() : undefined;
      const pic = unit.picture ? unit.picture.trim() : undefined;
      const instructionsq = unit.unitinstructionsquestion ? unit.unitinstructionsquestion.trim() : undefined;
      if (!txt && !pic && !instructionsq && !lockout) {
        console.log('Instructions empty: skipping', displayify(unit));
        instructContinue();
      } else {
        this.next();
      }
    }
  },
});
