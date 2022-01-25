import {meteorCallAsync} from '../..';
import {curSemester} from '../../../common/Definitions';

Session.set('courses', []);
Session.set('assignments', []);
Session.set('allTdfFilenamesAndDisplayNames', []);
Session.set('tdfsSelected', []);
Session.set('tdfsNotSelected', []);

let curCourseAssignment = {coursename: '', courseid: undefined, tdfs: []};
Template.tdfAssignmentEdit.onRendered(async function() {
  console.log('tdfAssignmentEdit rendered');
  const courses = await meteorCallAsync('getAllCoursesForInstructor', Meteor.userId());
  console.log('courses', courses);
  Session.set('courses', courses);

  const courseAssignments = await meteorCallAsync('getAllCourseAssignmentsForInstructor', Meteor.userId());
  const assignments = {};
  for (const courseAssignment of courseAssignments) {
    if (!assignments[courseAssignment.coursename]) assignments[courseAssignment.coursename] = new Set();
    assignments[courseAssignment.coursename].add(courseAssignment.filename);
  }
  for (const assignmentKey of Object.keys(assignments)) {
    assignments[assignmentKey] = Array.from(assignments[assignmentKey]);
  }
  Session.set('assignments', assignments);
  console.log('assignments', assignments);
  curCourseAssignment = {coursename: '', courseid: undefined, tdfs: []};

  const allTdfs = await meteorCallAsync('getAllTdfs');
  console.log('allTdfs', allTdfs);
  const allTdfObjects = allTdfs.map((tdf) => tdf.content);
  console.log('allTdfObjects',allTdfObjects);
  if (!Session.get('allTdfs')) Session.set('allTdfs', allTdfObjects);
  const allTdfDisplays = [];
  for (const i in allTdfObjects) {
    const tdf = allTdfObjects[i];
    allTdfDisplays.push({fileName: tdf.fileName, displayName: tdf.tdfs.tutor.setspec.lessonname});
  }
  console.log('allTdfDisplays', allTdfDisplays);
  Session.set('allTdfFilenamesAndDisplayNames', allTdfDisplays);

  Tracker.autorun(updateTdfsSelectedAndNotSelected);
});

Template.tdfAssignmentEdit.helpers({
  courses: () => Session.get('courses'),
  tdfsSelected: () => Session.get('tdfsSelected'),
  tdfsNotSelected: () => Session.get('tdfsNotSelected'),
});

Template.tdfAssignmentEdit.events({
  'change #class-select': function(event, template) {
    console.log('change class-select');
    const curCourseId = $(event.currentTarget).val();
    const curCourseName = $('#class-select option:selected').text();
    const assignments = Session.get('assignments');
    const tempTdfs = assignments[curCourseName] || [];
    curCourseAssignment = {coursename: curCourseName, courseid: curCourseId, tdfs: tempTdfs};
    console.log('curCourseAssignment', curCourseAssignment);
    updateTdfsSelectedAndNotSelected();
  },

  'click #selectTdf': function(event, template) {
    console.log('select tdf: ');
    const tdfsToBeSelected = getselectedItems('notSelectedTdfs').map((x) => x.fileName);
    curCourseAssignment.tdfs = curCourseAssignment.tdfs.concat(tdfsToBeSelected);
    console.log('curCourseAssignment', curCourseAssignment);
    updateTdfsSelectedAndNotSelected();
  },

  'click #unselectTdf': function(event, template) {
    console.log('unselect tdf: ');
    const tdfsToBeUnselected = getselectedItems('selectedTdfs').map((x) => x.fileName);
    curCourseAssignment.tdfs = curCourseAssignment.tdfs.filter((x) => tdfsToBeUnselected.indexOf(x) == -1);
    console.log('curCourseAssignment', curCourseAssignment);
    updateTdfsSelectedAndNotSelected();
  },

  'click #saveAssignment': function(event, template) {
    console.log('save assignment');
    if (!curCourseAssignment.coursename) {
      alert('Please select a class to assign Chapters to.');
    } else {
      const dbCurCourseAssignment = JSON.parse(JSON.stringify(curCourseAssignment));
      // dbCurCourseAssignment.tdfs = dbCurCourseAssignment.tdfs.map(x => x.fileName);
      Meteor.call('editCourseAssignments', dbCurCourseAssignment, function(err, res) {
        if (err ) {
          alert('Error saving class: ' + err);
        } else if (res == null) {
          alert('Error saving class (check server logs)');
        } else {
          alert('Saved class successfully!');
          console.log('curCourseAssignment:', curCourseAssignment);
          const assignments = Session.get('assignments');
          let hadAssignment = false;
          for (let i=0; i<assignments.length; i++) {
            if (assignments[i].coursename == curCourseAssignment.coursename) {
              assignments[i] = curCourseAssignment;
              hadAssignment = true;
              break;
            }
          }
          if (!hadAssignment) assignments[curCourseAssignment.coursename] = curCourseAssignment.tdfs;
          Session.set('assignments', assignments);
        }
      });
    }
  },
});

function getselectedItems(itemSelector) {
  const selectedItems = [];
  const selectedOptions = $('select#' + itemSelector + ' option:selected');
  selectedOptions.each(function(index) {
    const selectedValue = selectedOptions[index].value;
    const selectedDisplay = selectedOptions[index].text;
    const selectedItem = {fileName: selectedValue, displayName: selectedDisplay};
    console.log(selectedItem);
    selectedItems.push(selectedItem);
  });

  return selectedItems;
}

function updateTdfsSelectedAndNotSelected() {
  const allTdfDisplays = Session.get('allTdfFilenamesAndDisplayNames');
  const tdfsNotSelected = allTdfDisplays.filter((x) => curCourseAssignment.tdfs.indexOf(x.fileName) == -1);
  console.log('curCourseAssignment', curCourseAssignment);
  const tdfsSelected = curCourseAssignment.tdfs.map((x) =>
    allTdfDisplays.find((tdfDisplay) =>
      tdfDisplay.fileName == x));
  console.log('updateTdfsSelectedAndNotSelected', tdfsSelected, tdfsNotSelected, curCourseAssignment);
  Session.set('tdfsSelected', tdfsSelected);
  Session.set('tdfsNotSelected', tdfsNotSelected);
}
