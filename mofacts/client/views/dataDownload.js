import { ReactiveVar } from 'meteor/reactive-var'

Template.dataDownload.helpers({
  'teachers': function() {
    return Session.get('allUsersWithTeacherRole');
  },
  'selectedTeacherId': function() {
    return Template.instance().selectedTeacherId.get();
  },
  'dataDownloads': function() {
    var dataDownloads = [];
    
    dataDownloads = Tdfs.find({}).map(function(tdfObject) {
      tdfObject.disp = name;
      
      if (tdfObject.fileName != name) {
        tdfObject.disp += " (" + tdfObject.fileName + ")";
      }

      return tdfObject;
    }).filter(function(tdfObject) {
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
        return true;
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
  }  
});

Template.dataDownload.events({
  'change #teacherSelect': function(event, instance) {
    if (event.currentTarget.value) {
      instance.selectedTeacherId.set(event.currentTarget.value);
    } else {
      instance.selectedTeacherId.set("");
    }
  }
});

Template.dataDownload.onCreated(function() {
  this.selectedTeacherId = new ReactiveVar(null);
  
  Meteor.subscribe('allUsersWithTeacherRole', function() {
    var users = Meteor.users.find({}).fetch();
    Session.set("allUsersWithTeacherRole", users);
  });

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

function isAdmin() {
  return Roles.userIsInRole(Meteor.user(), ['admin']);
}
