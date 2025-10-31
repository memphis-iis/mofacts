Template.userAdmin.created = function() {
  Session.set('filter', '@gmail.com');
};

Session.set('allUsers', undefined);

Template.userAdmin.rendered = function() {
  // Init the modal dialog
  $('#userAdminModal').modal({
    'backdrop': 'static',
    'keyboard': false,
    'show': false,
  });

  Meteor.subscribe('allUsers', function() {
    Session.set('allUsers', Meteor.users.find({}, {fields: {username: 1, roles:1}, sort: [['username', 'asc']]}).fetch());
  });
};

Template.userAdmin.helpers({
  userRoleEditList: function() {
    const allUsers = Session.get('allUsers') || [];
    filter = Session.get('filter');
    //filter out users that don't match the filter 
    userList = allUsers.filter(function(user) {
      if(user.username){
        return user.username.indexOf(filter) !== -1;
      } else {
        return false;
      }
    });
    //iterate through the list. if roles contains teacher, set .teacher to true. if roles contains admin, set .admin to true
    userList.forEach(function(user) {
      user.teacher = false;
      user.admin = false;
      if(user.roles){
        if(user.roles.indexOf('teacher') !== -1){
          user.teacher = true;
        }
        if(user.roles.indexOf('admin') !== -1){
          user.admin = true;
        }
      }
    });
    console.log('userRoleEditList:' + JSON.stringify(userList));
    return userList;
  },
});

Template.userAdmin.events({
  'change #filter': function(event) {
    event.preventDefault();
    Session.set('filter', $('#filter').val());
  },

  'click #doUploadUsers': function(event) {
    event.preventDefault();
    doFileUpload('#upload-users', 'USERS');
  },
  'change #upload-users': function(event) {
    const input = $(event.currentTarget);
    $('#users-file-info').html(input.val());
  },

  'click #resetAllSecretKeys': function(event) {
    event.preventDefault();
    Meteor.callAsync('resetAllSecretKeys');
  },

  // Need admin and teacher buttons
  'click .btn-user-change': function(event) {
    event.preventDefault();

    const btnTarget = $(event.currentTarget);
    const userId = _.trim(btnTarget.data('userid'));
    const roleAction = _.trim(btnTarget.data('roleaction'));
    const roleName = _.trim(btnTarget.data('rolename'));



    Meteor.callAsync('userAdminRoleChange', userId, roleAction, roleName, function(error, result) {
      $('#userAdminModal').modal('hide');

      let disp;
      if (typeof error !== 'undefined') {
        disp = 'Failed to handle request. Error:' + error;
      } else {
        disp = 'Action completed successfully';
      }
      console.log(disp);
      alert(disp);
    });
  },

  //Impersonation 
  'click .btn-impersonate' : function(event){
    const btnTarget = $(event.currentTarget);
    const newUserId = _.trim(btnTarget.data('userid'));
    Meteor.callAsync('impersonate', newUserId, function(error, result) {
      if (error) {
        console.log('Impersonation failed:', error);
        alert('Impersonation failed:' + error);
      } else {
        console.log('Impersonation successful:', result._id);
        Meteor.userId = function() { return result._id };
        Meteor.user = function() { return result };
        Router.go('/');
      }
    });
  }

});

function doFileUpload(fileElementSelector, fileDescrip) {
  let count = 0;

  _.each($(fileElementSelector).prop('files'), function(file) {
    count += 1;
    console.log('file:' + JSON.stringify(file));
    const name = file.name;
    const fileReader = new FileReader();

    fileReader.onload = function() {
      console.log('Upload attempted for', name);

      Meteor.callAsync('insertNewUsers', name, fileReader.result, function(error, result) {
        console.log('result:' + JSON.stringify(result));
        if (error) {
          console.log('Critical failure saving ' + fileDescrip, error);
          alert('There was a critical failure saving your ' + fileDescrip + ' file:' + error);
        } else if (result.length > 0) {
          console.log(fileDescrip + ' save failed', result);
          alert('The ' + fileDescrip + ' file was not saved: ' + JSON.stringify(result));
        } else {
          console.log(fileDescrip + ' Saved:', result);
          alert('Your ' + fileDescrip + ' file was saved');
          // Now we can clear the selected file
          $(fileElementSelector).val('');
          $(fileElementSelector).parent().find('.file-info').html('');
          const newAllUsers = Meteor.users.find({}, {fields: {username: 1}, sort: [['username', 'asc']]}).fetch();
          console.log('newAllUsers:', newAllUsers, JSON.parse(JSON.stringify(Session.get('allUsers'))));
          Session.set('allUsers', newAllUsers);
        }
      });
    };

    fileReader.readAsBinaryString(file);
  });

  console.log(fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
}
