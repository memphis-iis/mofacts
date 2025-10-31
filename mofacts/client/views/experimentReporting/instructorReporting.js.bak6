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

async function updateTables(tdfId, date){
  const dateInt = date || false;
  const [historiesMet, historiesNotMet] = await meteorCallAsync('getClassPerformanceByTDF', Session.get('curClass')._id, curTdf, dateInt);
  console.log('updateTables', historiesMet, historiesNotMet);
  Session.set('curClassStudentPerformance', historiesMet)
  Session.set('curClassStudentPerformanceAfterFilter', historiesNotMet);
}

Template.instructorReporting.helpers({
  INVALID: INVALID,
  curClassStudentPerformance: () => Session.get('curClassStudentPerformance'),
  curClassStudentPerformanceAfterFilter: () => Session.get('curClassStudentPerformanceAfterFilter'),
  curInstructorReportingTdfs: () => Session.get('curInstructorReportingTdfs'),
  classes: () => Session.get('classes'),
  curClassPerformance: () => Session.get('curClassPerformance'),
  performanceLoading: () => Session.get('performanceLoading'),
  replaceSpacesWithUnderscores: (string) => string.replace(' ', '_'),
  selectedTdfDueDate: () => Session.get('selectedTdfDueDate'),
  dueDateFilter: () => Session.get('dueDateFilter'),
});

Template.instructorReporting.events({
  'change #class-select': function(event) {
    Session.set('curClassStudentPerformance', []);
    Session.set('curClassPerformance', []);
    const curClassId = $(event.currentTarget).val();
    const curClass = Session.get('classes').find((x) => x._id == curClassId);
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

  'change #tdf-select': async function(event) {
    curTdf = $(event.currentTarget).val();
    _state.set('currentTdf', curTdf);
    console.log('tdf change: ', curTdf, Session.get('curClass')._id);
    updateTables(curTdf);
    if (Session.get('curClass')) {
      tdfData = Session.get('allTdfs').find((x) => x._id == curTdf);
      tdfDate = tdfData.content.tdfs.tutor.setspec.duedate;
      Session.set('selectedTdfDueDate', tdfDate);
      
    } else {
      Session.set('selectedTdfDueDate', undefined);
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
      updateTables(_state.get('currentTdf'), dateInt);
    }
  },
  'change #due-date-filter': async function(event) {
    if(event.target.checked){
      $('#practice-deadline-date').prop('disabled', true);
      curTdfDueDate= Session.get('selectedTdfDueDate');
      console.log('due date filter: ', curTdfDueDate);
      $('#practice-deadline-date').val(curTdfDueDate);
      Session.set('dueDateFilter', true);
      const date = $('#practice-deadline-date').val();
      const dateInt = new Date(date).getTime();
      console.log('practice deadline:', dateInt);
      if(dateInt && !isNaN(dateInt)){
        updateTables(_state.get('currentTdf'),dateInt);
      }
    } else {
      $('#practice-deadline-date').prop('disabled', false);
      $('#practice-deadline-date').val('');
      Session.set('dueDateFilter', false);
      updateTables(curTdf, false);
    }
  },
  'click #add-exception': async function(event) {
    date = $('#exception-date').val();
    dateInt = new Date(date).getTime();
    const userId = $(event.currentTarget).attr('data-userid');
    updateTables(curTdf, dateInt);
    curTdf = _state.get('currentTdf');
    classId = Session.get('curClass')._id;
    console.log('add exception: ', userId, curTdf, classId);
    await meteorCallAsync('addUserDueDateException', userId, curTdf, classId, dateInt);
    alert('Exception added');
    date = Session.get('selectedTdfDueDate');
    dateInt = new Date(date).getTime();
    updateTables(curTdf, dateInt);
  },

  'click #remove-exception': async function(event) {
    const userId = $(event.currentTarget).attr('data-userid');
    curTdf = _state.get('currentTdf');
    classId = Session.get('curClass')._id;
    console.log('remove exception: ', userId, curTdf, classId);
    await meteorCallAsync('removeUserDueDateException', userId, curTdf, classId);
    alert('Exception removed');
    date = Session.get('selectedTdfDueDate');
    dateInt = new Date(date).getTime();
    updateTables(curTdf, dateInt);
  }

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
  Session.set('dueDateFilter', false);

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