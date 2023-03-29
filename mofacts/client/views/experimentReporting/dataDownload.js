import {ReactiveVar} from 'meteor/reactive-var';
import {meteorCallAsync} from '../..';

const date = new Date();
const today = String(date.getDate() + '_' + String(date.getMonth() + 1) + '_' + date.getFullYear());
const sitePath = Meteor.isDevelopment? window.location.origin : `https://${window.location.hostname}`;

Template.dataDownload.onCreated(async function() {
  this.selectedTeacherId = new ReactiveVar(null);
  this.selectedClassId = new ReactiveVar(null);
});

Template.dataDownload.onRendered(async function() {
  const allCourses = await meteorCallAsync('getAllCourses');
  const classesByInstructorId = {};
  for (const course of allCourses) {
    if (!classesByInstructorId[course.teacheruserid]) {
      classesByInstructorId[course.teacheruserid] = [];
    }
    classesByInstructorId[course.teacheruserid].push(course);
  }
  Session.set('classesByInstructorId', classesByInstructorId);
  const allTeachers = await meteorCallAsync('getAllTeachers');
  Session.set('allUsersWithTeacherRole', allTeachers);
});

Template.dataDownload.helpers({
  'teachers': function() {
    return Session.get('allUsersWithTeacherRole');
  },
  'classes': function() {
    let uid = '';

    if (isAdmin() && !_.isEmpty(Template.instance().selectedTeacherId.get())) {
      uid = Template.instance().selectedTeacherId.get();
    } else if (isTeacher()) {
      uid = Meteor.userId();
    }

    return Session.get('classesByInstructorId')[uid];
  },
  'selectedTeacherId': function() {
    return Template.instance().selectedTeacherId.get();
  },
  'selectedClassId': function() {
    return Template.instance().selectedClassId.get();
  },
  'dataDownloads': function() {
    let dataDownloads = [];
    const classTdfNames = [];

    if (!_.isEmpty(Template.instance().selectedClassId.get())) {
      let uid = '';

      if (isAdmin() && !_.isEmpty(Template.instance().selectedTeacherId.get())) {
        uid = Template.instance().selectedTeacherId.get();
      }

      if (isTeacher() && !isAdmin()) {
        uid = Meteor.userId();
      }

      const classes = Session.get('classesByInstructorId')[uid];

      classes.forEach(function(classObject) {
        if (classObject.courseId == Template.instance().selectedClassId.get()) {
          if (classObject.tdfs) {
            classObject.tdfs.forEach(function(tdf) {
              classTdfNames.push(tdf.fileName);
            });
          }
        }
      });
    }

    dataDownloads = Session.get('allTdfs').map(function(tdf) {
      const name = tdf.content.tdfs.tutor.setspec.lessonname ? tdf.content.tdfs.tutor.setspec.lessonname : 'NO NAME';
      tdf.disp = name;

      return tdf;
    }).filter(function(tdf) {
      if (!_.isEmpty(Template.instance().selectedClassId.get())) {
        if (!_.contains(classTdfNames, tdf.fileName)) {
          return false; // If a class is selected, reject any TDF data that does not belong to the selected class
        }
      }

      if (isAdmin()) {
        if (_.isEmpty(Template.instance().selectedTeacherId.get())) {
          return true; // If no teacher is selected, view all available TDF data downloads
        }

        if (Template.instance().selectedTeacherId.get() == tdf.ownerId) {
          return true; // If a teacher is selected, only return TDF data downloads where selected teacher is owner
        }

        return false;
      }

      if (Meteor.userId() == tdf.ownerId) {
        return true; // If user is not admin role, return only TDF data downloads where current user is owner
      }

      return false;
    });

    return dataDownloads;
  },
  'isTeacherSelected': function() {
    return !_.isEmpty(Template.instance().selectedTeacherId.get());
  },
  'isClassSelected': function() {
    return !_.isEmpty(Template.instance().selectedClassId.get());
  },
  'currentUser': function() {
    return Meteor.userId();
  },
  'showClasses': function() {
    let showClasses = false;

    if (isAdmin() && !_.isEmpty(Template.instance().selectedTeacherId.get())) {
      showClasses = true;
    }

    if (isTeacher() && !isAdmin()) {
      showClasses = true;
    }

    return showClasses;
  },
  'user': function() {
    return Meteor.user() ? Meteor.user().username : false;
  },
  'fileAccessors': function() {
    return Session.get('fileAccessors');
  },
  'accessableFiles': function() {
    Meteor.call('getAccessableTDFSForUser', Meteor.userId(), function(err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log(result)
        const dataDownloads = result.TDFs?.map(function(tdf) {
          const name = tdf.content.tdfs.tutor.setspec.lessonname ? tdf.content.tdfs.tutor.setspec.lessonname : 'NO NAME';
          tdf.disp = name;
    
          return tdf;
        })
        Session.set('accessableFiles', dataDownloads);
      }
    });
    return Session.get('accessableFiles') || [];
  },
});

Template.dataDownload.events({
  'change #teacherSelect': function(event, instance) {
    if (event.currentTarget.value) {
      instance.selectedTeacherId.set(event.currentTarget.value);
    } else {
      instance.selectedTeacherId.set('');
      instance.selectedClassId.set(''); // Reset the class filter so there is no option/value mismatch when returning to previously selected teacher
    }
  },
  'change #classSelect': function(event, instance) {
    if (event.currentTarget.value) {
      instance.selectedClassId.set(event.currentTarget.value);
    } else {
      instance.selectedClassId.set('');
    }
  },
  'click #dataDownloadLink': function(event) {
    event.preventDefault();
    let fileName = event.currentTarget.getAttribute('data-fileName');
    const path = `${sitePath}/data-by-file/${fileName}`
    makeDataDownloadAPICall(path);
  },

  'click #teacherDataDownloadLink': function(event) {
    event.preventDefault();
    let teacherID = event.currentTarget.getAttribute('data-teacherID');
    const path = `${sitePath}/data-by-teacher/${teacherID}`
    makeDataDownloadAPICall(path);
  },
  
  'click #userDataDownloadLink': function(event) {
    event.preventDefault();
    const path = `${sitePath}/data-by-teacher/${Meteor.userId()}`
    makeDataDownloadAPICall(path);
  },

  'click #downloadDataByClass': function(event){
    event.preventDefault();
    let classId = event.currentTarget.getAttribute('data-classId');
    const path = `${sitePath}/data-by-class/${classId}`
    makeDataDownloadAPICall(path);
  },

  'click #TransferOwnershipButton': function(event) {
    let fileId = event.currentTarget.getAttribute('data-fileId');
    Session.set('transferOwnershipFileId', fileId);
  },

  'click #AssignAccessorsButton': function(event) {
    let fileId = event.currentTarget.getAttribute('data-fileId');
    Meteor.call('getAccessorsTDFID', fileId, function(err, res){
      if(err){
        console.log(err)
      }
      else{
        Session.set('fileAccessors', res);
      }
    })
    Session.set('AssignAccessorsFileId', fileId);
  },

  'click #transferOwnershipSaveButton': function(event, instance) {
    alert('Transfer ownership save button clicked');
    const TDFId = Session.get('transferOwnershipFileId');
    const newOwnerUserName = $('#transferOwnershipDataList').val();
    const newOwnerId = $('#ownersDataList [value="' + newOwnerUserName + '"]').attr('data-teacherid');
    Meteor.call('transferDataOwnership', TDFId, newOwnerId, Meteor.userId(), function(err, res){
      if(err){
        console.log(err)
      }
      else{
        console.log(res)
      }
    })
  },

  'click #addAcessor': function(event, instance) {
    const newAccessorUserName = $('#assignAccessorDataList').val();
    const newAccessorId = $('#accessorsDataList [value="' + newAccessorUserName + '"]').attr('data-teacherid');
    $('#assignAccessorDataList').val('');
    let accessors = Session.get('fileAccessors') || [];
    let removedAccessors = Session.get('removedAccessors') || [];
    removedAccessors = removedAccessors.filter(function(accessor) {
      return accessor !== newAccessorId;
    });
    accessors.push({name: newAccessorUserName, userId: newAccessorId});
    Session.set('removedAccessors', removedAccessors);
    Session.set('fileAccessors', accessors);
  },

  'click #removeAcessor': function(event, instance) {
    const accessorID = event.currentTarget.getAttribute('data-teacherid');
    let accessors = Session.get('fileAccessors') || [];
    let removedAccessors = Session.get('removedAccessors') || [];
    accessors = accessors.filter(function(accessor) {
      return accessor.userId !== accessorID;
    });
    removedAccessors.push(accessorID);
    Session.set('removedAccessors', removedAccessors);
    Session.set('fileAccessors', accessors);
    },

  'click #assignAccessorsSaveButton': function(event) {
    const fileId = Session.get('AssignAccessorsFileId');
    const accessors = Session.get('fileAccessors');
    const removedAccessors = Session.get('removedAccessors');
    Meteor.call('assignAccessors', fileId, accessors, removedAccessors, function(err, res){
      if(err){
        console.log(err)  
      } else {
        console.log(res)
        alert('Accessors Assigned Successfully');
        Session.set('fileAccessors', []);
        Session.set('removedAccessors', []);
      }
    });
  }
});

function makeDataDownloadAPICall(path){
  //in order to securely get the current user's secret
  Meteor.call('getUIDAndSecretForCurrentUser', function(err, res){
    if(err){
      console.log(err)
    }
    else{
      HTTP.call('GET', path, {'headers': {'x-user-id': res[0], 'x-auth-token': res[1]}}, function(err, response) {
        if (response.statusCode != 200) {
          console.error(response);
        } else if(err) {
          console.error(err)
        }
        else {
          createData(response)
        }
      });
    }
  })
}

function createData(result){
  const blob = new Blob([result.content], {type : result.headers['content-type']});
  let  a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  a.href = window.URL.createObjectURL(blob);
  a.download = result.headers['file-name']
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blob);
}

function isTeacher() {
  return Roles.userIsInRole(Meteor.user(), 'teacher');
}

function isAdmin() {
  return Roles.userIsInRole(Meteor.user(), 'admin');
}