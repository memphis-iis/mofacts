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
    Session.set('curClassStudentPerformanceAfter', [{percentCorrect: 'No attempts for this tdf'}]);
  } else {
    const curClassStudentPerformance = Session.get('studentPerformanceForClassAndTdfIdMap')[curClassId][currentTdf];
    const curClassStudentPerformanceAfter = Session.get('studentPerformanceForClassAndTdfIdMapAfter')[curClassId][currentTdf];
    Session.set('curClassStudentPerformance', Object.values(curClassStudentPerformance));// PER STUDENT
    Session.set('curClassStudentPerformanceAfter', Object.values(curClassStudentPerformanceAfter));// PER STUDENT
    console.log('curClassStudentPerformance:', Object.values(curClassStudentPerformance));
    console.log('curClassStudentPerformanceAfter:', Object.values(curClassStudentPerformanceAfter));
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

async function fetchAndSetPracticeTimeIntervalsMap(date) {
  console.log('fetch', Session.get('curClassStudentPerformance',Session.get('curClassStudentPerformanceAfter')));
  const [studentPerformanceForClass, studentPerformanceForClassAndTdfIdMap] = await meteorCallAsync('getStudentPerformanceForClassAndTdfId', Meteor.userId(), date);
  const [studentPerformanceForClassAfter, studentPerformanceForClassAndTdfIdMapAfter] = await meteorCallAsync('getStudentPerformanceForClassAndTdfId', Meteor.userId(), date, true);
  Session.set('studentPerformanceForClass', studentPerformanceForClass);
  Session.set('studentPerformanceForClassAndTdfIdMap', studentPerformanceForClassAndTdfIdMap);
  Session.set('studentPerformanceForClassAfter', studentPerformanceForClassAfter);
  Session.set('studentPerformanceForClassAndTdfIdMapAfter', studentPerformanceForClassAndTdfIdMapAfter);
  setCurClassStudents(Session.get('curClass').courseId, _state.get('currentTdf'));
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
  curClassStudentPerformanceAfter: () => Session.get('curClassStudentPerformanceAfter'),
  curInstructorReportingTdfs: () => Session.get('curInstructorReportingTdfs'),
  classes: () => Session.get('classes'),
  curClassPerformance: () => Session.get('curClassPerformance'),
  performanceLoading: () => Session.get('performanceLoading'),
  replaceSpacesWithUnderscores: (string) => string.replace(' ', '_')
});

Template.instructorReporting.events({
  'change #class-select': function(event) {
    Session.set('curClassStudentPerformance', []);
    Session.set('curClassStudentPerformanceAfter', []);
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
    _state.set('userMetThresholdMap', undefined);
  },

  'change #tdf-select': function(event) {
    curTdf = parseInt($(event.currentTarget).val());
    console.log(curTdf,Session.get('allTdfs'));
    curTdfData = Session.get('allTdfs').find((x) => x.TDFId == curTdf)  ;
    console.log('change tdf-select, curTdf: ', curTdf, curTdfData);
    if(curTdfData){
      curDueDate = curTdfData.content.tdfs.tutor.setspec.duedate;
      if(curDueDate){
        $('#practice-deadline-date').val(curDueDate);
      }
    }
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
      await fetchAndSetPracticeTimeIntervalsMap(dateInt, _state.get('currentTdf'));
      //hideUsersByDate(dateInt, _state.get('currentTdf'));
      _state.set('userMetThresholdMap', undefined);
    }
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
  Session.set('curClassStudentPerformanceAfter', []);
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
