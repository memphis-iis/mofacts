Template.userAdmin.created = function() {
  Session.set('filter', '@gmail.com');
};

Template.userAdmin.rendered = function() {
  Meteor.subscribe('allUsers');
};

Template.userAdmin.helpers({
  userRoleEditList: function() {
    // Reactively get users from Meteor.users collection (not Session)
    const allUsers = Meteor.users.find({}, {sort: {username: 1}}).fetch();
    const filter = Session.get('filter');

    //filter out users that don't match the filter
    let userList = allUsers.filter(function(user) {
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
        // Handle both old array format and new object format with groups
        let rolesArray = [];
        if(Array.isArray(user.roles)){
          // Old format: roles = ['admin', 'teacher']
          rolesArray = user.roles;
        } else if(typeof user.roles === 'object' && user.roles.__global_roles__){
          // New format: roles = { __global_roles__: ['admin', 'teacher'] }
          rolesArray = user.roles.__global_roles__;
        }

        if(rolesArray.indexOf('teacher') !== -1){
          user.teacher = true;
        }
        if(rolesArray.indexOf('admin') !== -1){
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
  'click .btn-user-change': async function(event) {
    event.preventDefault();

    const btnTarget = $(event.currentTarget);
    const userId = _.trim(btnTarget.data('userid'));
    const roleAction = _.trim(btnTarget.data('roleaction'));
    const roleName = _.trim(btnTarget.data('rolename'));

    console.log('Requesting role change:', {userId, roleAction, roleName});

    try {
      const result = await Meteor.callAsync('userAdminRoleChange', userId, roleAction, roleName);
      console.log('Server response:', result);

      // Check the user's roles after the update
      const updatedUser = Meteor.users.findOne({_id: userId});
      console.log('Updated user roles:', updatedUser?.roles);

      console.log('Action completed successfully');
    } catch (error) {
      const disp = 'Failed to handle request. Error:' + error;
      console.log(disp);
      alert(disp);
    }
  },

  //Impersonation
  'click .btn-impersonate' : async function(event){
    const btnTarget = $(event.currentTarget);
    const newUserId = _.trim(btnTarget.data('userid'));
    try {
      const result = await Meteor.callAsync('impersonate', newUserId);
      console.log('Impersonation successful:', result._id);
      Meteor.userId = function() { return result._id };
      Meteor.user = function() { return result };
      Router.go('/');
    } catch (error) {
      console.log('Impersonation failed:', error);
      alert('Impersonation failed:' + error);
    }
  }

});

async function doFileUpload(fileElementSelector, fileDescrip) {
  let count = 0;

  _.each($(fileElementSelector).prop('files'), function(file) {
    count += 1;
    console.log('file:' + JSON.stringify(file));
    const name = file.name;
    const fileReader = new FileReader();

    fileReader.onload = async function() {
      console.log('Upload attempted for', name);

      try {
        const result = await Meteor.callAsync('insertNewUsers', name, fileReader.result);
        console.log('result:' + JSON.stringify(result));
        if (result.length > 0) {
          console.log(fileDescrip + ' save failed', result);
          alert('The ' + fileDescrip + ' file was not saved: ' + JSON.stringify(result));
        } else {
          console.log(fileDescrip + ' Saved:', result);
          alert('Your ' + fileDescrip + ' file was saved');
          // Now we can clear the selected file
          $(fileElementSelector).val('');
          $(fileElementSelector).parent().find('.file-info').html('');
          // No need to manually refresh - Meteor reactivity handles it automatically!
        }
      } catch (error) {
        console.log('Critical failure saving ' + fileDescrip, error);
        alert('There was a critical failure saving your ' + fileDescrip + ' file:' + error);
      }
    };

    fileReader.readAsBinaryString(file);
  });

  console.log(fileDescrip, 'at ele', fileElementSelector, 'scheduled', count, 'uploads');
}
