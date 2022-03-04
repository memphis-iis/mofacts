import {ReactiveDict} from 'meteor/reactive-dict';
import {meteorCallAsync} from '../..';
import {INVALID} from '../../../common/Definitions';

const _state = new ReactiveDict('instructorReportingState');

let curTdf = INVALID;

navigateToStudentReporting = async function(studentUsername) {
  console.log('navigateToStudentReporting:', studentUsername);
  Session.set('studentUsername', studentUsername);
  Session.set('instructorSelectedTdf', curTdf);

  if (studentUsername.indexOf('@') == -1) studentUsername = studentUsername.toUpperCase();
  const userIdRet = await meteorCallAsync('getUserIdforUsername', studentUsername);
  console.log('student,', studentUsername, userIdRet);
  Session.set('curStudentID', userIdRet);
  Session.set('curStudentPerformance', Session.get('studentPerformanceForClassAndTdfIdMap')[userIdRet]);
  Router.go('/studentReporting');
};

function setCurClassStudents(curClassId, currentTdf) {
  console.log('setCurClassStudents', curClassId, currentTdf);
  if (_.isEmpty(Session.get('studentPerformanceForClassAndTdfIdMap')) ||
        _.isEmpty(Session.get('studentPerformanceForClassAndTdfIdMap')[curClassId]) ||
        _.isEmpty(Session.get('studentPerformanceForClassAndTdfIdMap')[curClassId][currentTdf])) {
    console.log('curClassStudentPerformance:is empty');
    Session.set('curClassStudentPerformance', [{percentCorrect: 'No attempts for this tdf'}]);
  } else {
    const curClassStudentPerformance = Session.get('studentPerformanceForClassAndTdfIdMap')[curClassId][currentTdf];
    Session.set('curClassStudentPerformance', Object.values(curClassStudentPerformance));// PER STUDENT
    console.log('curClassStudentPerformance:', Object.values(curClassStudentPerformance));
  }

  if (_.isEmpty(Session.get('studentPerformanceForClass')) ||
        _.isEmpty(Session.get('studentPerformanceForClass')[curClassId]) ||
        _.isEmpty(Session.get('studentPerformanceForClass')[curClassId][currentTdf])) {
    console.log('studentPerformanceForClass:is empty');
    Session.set('curClassPerformance', {});// AGGREGATED BY CLASS
  } else {
    const curClassPerformance = Session.get('studentPerformanceForClass')[curClassId][currentTdf];
    Session.set('curClassPerformance', curClassPerformance);// AGGREGATED BY CLASS
    console.log('curClassPerformance:', curClassPerformance);
  }
}

function fetchAndSetPracticeTimeIntervalsMap(date, tdfId) {
  console.log('fetch', Session.get('curClassStudentPerformance'));
  const userIds = Session.get('curClassStudentPerformance').map( (x) => x.userId );
  Meteor.call('getPracticeTimeIntervalsMap', userIds, tdfId, date, function(err, res) {
    if (err) {
      throw new Error('Error fetching practice time intervals ->' + err);
    } else {
      console.log('getPracticeTimeIntervalsMap', res);
      _state.set('practiceTimeIntervalsMap', res);
    }
  });
}

function generateUserMetThresholdMap(threshold) {
  const practiceTimeIntervalsMap = _state.get('practiceTimeIntervalsMap');
  const userMetThresholdMap = {};

  const userIds = Session.get('curClassStudentPerformance').map((x) => x.userId );

  Object.entries(practiceTimeIntervalsMap).forEach(([userId, duration]) => {
    duration = duration / (60 * 1000); // convert back from ms to min for display
    if (duration < threshold) {
      userMetThresholdMap[userId] = 'NO - ' + duration.toFixed(1);
    } else {
      userMetThresholdMap[userId] = 'YES - ' + duration.toFixed(1);
    }
  });


  userIds.forEach((uid) => {
    let hideAllUsers = true;
    if (!userMetThresholdMap[uid] && userMetThresholdMap[uid] != 0) {
      userMetThresholdMap[uid] = 'NO ATTEMPT BEFORE DEADLINE';
      $('#' + uid).hide()
    }
    else{
      hideAllUsers = false;
      $('#' + uid).show()
    }
    if(hideAllUsers){
      $('#classReportingTotal').hide();
    }
    else{
      $('#classReportingTotal').show();
    }
  });

  console.log('generateUserMetThresholdMap:', threshold, userMetThresholdMap);
  _state.set('userMetThresholdMap', userMetThresholdMap);
}

async function hideUsersByDate(date, tdfId){
  let hideAllUsers = true;
  const userIds = Session.get('curClassStudentPerformance').map( (x) => x.userId );
  usersToShow = await meteorCallAsync('getUsersByUnitUpdateDate', userIds, tdfId, date)
  for(user of userIds){
    if (usersToShow[user]) {
      hideAllUsers = false;
      $('#' + user).show()
    }
    else{
      $('#' + user).hide()
    }
  }
  if(hideAllUsers){
    $('#classReportingTotal').hide();
  }
  else{
    $('#classReportingTotal').show();
  }
}

Template.instructorReporting.helpers({
  INVALID: INVALID,
  curClassStudentPerformance: () => Session.get('curClassStudentPerformance'),
  curInstructorReportingTdfs: () => Session.get('curInstructorReportingTdfs'),
  classes: () => Session.get('classes'),
  curClassPerformance: () => Session.get('curClassPerformance'),
  performanceLoading: () => Session.get('performanceLoading'),
  replaceSpacesWithUnderscores: (string) => string.replace(' ', '_'),
  getUserMetThresholdStatus: (userId) => {
    console.log('getUserMetThresholdStatus:', userId);
    if (_state.get('userMetThresholdMap')) {
      return _state.get('userMetThresholdMap')[userId];
    } else {
      return 'Not set';
    }
  },
});

Template.instructorReporting.events({
  'change #class-select': function(event) {
    Session.set('curClassStudentPerformance', []);
    Session.set('curClassPerformance', undefined);
    const curClassId = parseInt($(event.currentTarget).val());
    const curClass = Session.get('classes').find((x) => x.courseId == curClassId);
    Session.set('curClass', curClass);
    const curClassTdfs = Session.get('instructorReportingTdfs')[curClassId];
    console.log('change class-select, curClass: ', curClass, curClassTdfs);
    Session.set('curInstructorReportingTdfs', curClassTdfs);

    curTdf = INVALID;
    $('#tdf-select').val(INVALID);
    $('#tdf-select').prop('disabled', false);
    $('#practice-deadline-date').prop('disabled', true);
    $('#practice-time-select').prop('disabled', true);
    _state.set('userMetThresholdMap', undefined);
  },

  'change #tdf-select': function(event) {
    curTdf = parseInt($(event.currentTarget).val());
    _state.set('currentTdf', curTdf);
    console.log('tdf change: ', curTdf, Session.get('curClass').courseId);
    if (Session.get('curClass')) {
      setCurClassStudents(Session.get('curClass').courseId, curTdf);
    } else {
      alert('Please select a class');
    }
    _state.set('userMetThresholdMap', undefined);
    $('#practice-deadline-date').prop('disabled', false);
  },

  'change #practice-deadline-date': async (event) => {
    const date = event.currentTarget.value;
    const dateInt = new Date(date).getTime();
    console.log('practice deadline:', dateInt);
    if(dateInt && !isNaN(dateInt)){
      fetchAndSetPracticeTimeIntervalsMap(dateInt, _state.get('currentTdf'));
      hideUsersByDate(dateInt, _state.get('currentTdf'));
      _state.set('userMetThresholdMap', undefined);
      $('#practice-time-select').val(INVALID);
      $('#practice-time-select').prop('disabled', false);
    }
  },

  'change #practice-time-select': (event) => {
    const threshold = event.currentTarget.value;
    generateUserMetThresholdMap(threshold);
  },
});

Template.instructorReporting.onRendered(async function() {
  console.log('instructorReporting rendered', Meteor.userId());
  Session.set('curClass', undefined);
  Session.set('curStudentID', undefined);
  Session.set('studentUsername', undefined);
  Session.set('curStudentPerformance', undefined);
  Session.set('instructorSelectedTdf', undefined);
  Session.set('instructorReportingTdfs', []);
  Session.set('classes', []);
  Session.set('curClassStudentPerformance', []);
  Session.set('curClassPerformance', undefined);
  Session.set('curInstructorReportingTdfs', []);

  Session.set('performanceLoading', true);

  const studentPerformance = await meteorCallAsync('getStudentPerformanceForClassAndTdfId', Meteor.userId());
  const [studentPerformanceForClass, studentPerformanceForClassAndTdfIdMap] = studentPerformance;
  Session.set('studentPerformanceForClass', studentPerformanceForClass);
  Session.set('studentPerformanceForClassAndTdfIdMap', studentPerformanceForClassAndTdfIdMap);

  const instructorReportingTdfs = await meteorCallAsync('getTdfAssignmentsByCourseIdMap', Meteor.userId());
  Session.set('instructorReportingTdfs', instructorReportingTdfs);

  const courses = await meteorCallAsync('getAllCoursesForInstructor', Meteor.userId());
  Session.set('classes', courses);

  Session.set('performanceLoading', false);

  console.log('instructorReporting rendered:', studentPerformance, instructorReportingTdfs, courses);
});
