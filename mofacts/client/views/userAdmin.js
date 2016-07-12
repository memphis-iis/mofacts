Template.userAdmin.helpers({
    userRoleEditList: function() {
        var userList = [];
        Meteor.users.find(
            {},
            { fields: {username: 1}, sort: [['username', 'asc']] }
        ).forEach(function(user) {
            userList.push({
                '_id': user._id,
                'username': user.username,
                'admin': Roles.userIsInRole(user, ['admin']),
                'teacher': Roles.userIsInRole(user, ['teacher']),
            });
        });
        return userList;
    }
});

Template.userAdmin.events({
    // Need admin and teacher buttons
    'click .btn-user-change': function(event) {
        event.preventDefault();

        var btnTarget = $(event.currentTarget);
        var userId = _.trim(btnTarget.data("userid"));
        var roleName = _.trim(btnTarget.data("rolename"));
        var roleAction = _.trim(btnTarget.data("roleaction"));
        console.log("Action requested:", roleAction, "to", roleName, "for", userId);

        if (!userId || !roleName || !roleAction) {
            console.log("Invalid parameters found!");
            return;
        }

        //TODO: show modal
        //TODO: call server-side method
    }
});
