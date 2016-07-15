Template.userAdmin.rendered = function () {
    //Init the modal dialog
    $('#userAdminModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });
};

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
        var roleAction = _.trim(btnTarget.data("roleaction"));
        var roleName = _.trim(btnTarget.data("rolename"));
        console.log("Action requested:", roleAction, "to", roleName, "for", userId);

        if (!userId || !roleAction || !roleName) {
            console.log("Invalid parameters found!");
            return;
        }

        $('#userAdminModal').modal('show');

        Meteor.call("userAdminRoleChange", userId, roleAction, roleName, function(error, result) {
            $('#userAdminModal').modal('hide');

            var disp;
            if (typeof error !== "undefined") {
                disp = "Failed to handle request. Error:" + error;
            }
            else {
                disp = "Server returned:" + JSON.stringify(result, null, 2);
            }
            console.log(disp);
            alert(disp);
        });
    }
});
