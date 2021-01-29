import { ReactiveVar } from 'meteor/reactive-var'

Template.dataDownload.onCreated(async function() {
  this.selectedTeacherId = new ReactiveVar(null);
  this.selectedClassId = new ReactiveVar(null);
});

Template.dataDownload.onRendered(async function() {
  const allCourses = await meteorCallAsync("getAllCourses");
  let classesByInstructorId = {};
  for(let course of allCourses){
    if(!classesByInstructorId[course.teacheruserid]){
      classesByInstructorId[course.teacheruserid] = [];
    }
    classesByInstructorId[course.teacheruserid].push(course);
  }
  Session.set("classesByInstructorId",classesByInstructorId);
  const allTeachers = await meteorCallAsync("getAllTeachers");
  Session.set("allUsersWithTeacherRole", allTeachers);

  if (isAdmin()) {
    var clozeEdits = [];

    Meteor.call('getClozeEditAuthors', function(err, res) {
      if (!!err) {
        console.log('error getting cloze edit authors: ' + JSON.stringify(err));
      } else {
        var authors = res;

        _.each(_.keys(authors), function(authorId) {
          var clozeEdit = {};
          
          clozeEdit.authorId = authorId;
          clozeEdit.disp = authors[authorId];

          clozeEdits.push(clozeEdit);
        });
      }

      Session.set("clozeEdits", clozeEdits);
    });
  }
});

Template.dataDownload.helpers({
  'teachers': function() {
    return Session.get('allUsersWithTeacherRole');
  },
  'classes': function() {
    var uid = "";

    if (isAdmin() && !_.isEmpty(Template.instance().selectedTeacherId.get())) {
      uid = Template.instance().selectedTeacherId.get();
    }else if (isTeacher()) {
      uid = Meteor.userId();
    }
    
    return Session.get("classesByInstructorId")[uid];
  },
  'selectedTeacherId': function() {
    return Template.instance().selectedTeacherId.get();
  },
  'selectedClassId': function() {
    return Template.instance().selectedClassId.get();
  },
  'dataDownloads': function() {
    var dataDownloads = [];
    var classTdfNames = [];

    if (!_.isEmpty(Template.instance().selectedClassId.get())) {
      var uid = "";

      if (isAdmin() && !_.isEmpty(Template.instance().selectedTeacherId.get())) {
        uid = Template.instance().selectedTeacherId.get();
      }
    
      if (isTeacher() && !isAdmin()) {
        uid = Meteor.userId();
      }

      var classes = Session.get("classesByInstructorId")[uid];

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

    dataDownloads = Session.get("allTdfs").map(function(tdfObject) {
      tdfObject.disp = name;
      
      if (tdfObject.fileName != name) {
        tdfObject.disp += " (" + tdfObject.fileName + ")";
      }

      return tdfObject;
    }).filter(function(tdfObject) {
      if (!_.isEmpty(Template.instance().selectedClassId.get())) {
        if (!_.contains(classTdfNames, tdfObject.fileName)) {
          return false; // If a class is selected, reject any TDF data that does not belong to the selected class
        }
      }

      if (isAdmin()) {
        if (_.isEmpty(Template.instance().selectedTeacherId.get())) {
          return true; // If no teacher is selected, view all available TDF data downloads
        } 

        if (Template.instance().selectedTeacherId.get() == tdfObject.owner) {
          return true; // If a teacher is selected, only return TDF data downloads where selected teacher is owner
        }

        return false;
      } 

      if (Meteor.userId() == tdfObject.owner) {
        return true; // If user is not admin role, return only TDF data downloads where current user is owner
      }

      return false;
    });

    return dataDownloads;
  },
  'userClozeEdits': function() {
    return Session.get('clozeEdits');;
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
    var showClasses = false;

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
  }
});

Template.dataDownload.events({
  'change #teacherSelect': function(event, instance) {
    if (event.currentTarget.value) {
      instance.selectedTeacherId.set(event.currentTarget.value);
    } else {
      instance.selectedTeacherId.set("");
      instance.selectedClassId.set(""); // Reset the class filter so there is no option/value mismatch when returning to previously selected teacher
    }
  },
  'change #classSelect': function(event, instance) {
    if (event.currentTarget.value) {
      instance.selectedClassId.set(event.currentTarget.value);
    } else {
      instance.selectedClassId.set("");
    }
  }
});

function isTeacher() {
  return Roles.userIsInRole(Meteor.user(), 'teacher');
}

function isAdmin() {
  return Roles.userIsInRole(Meteor.user(), 'admin');
}
