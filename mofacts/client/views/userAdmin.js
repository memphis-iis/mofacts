Template.userAdmin.created = function(){
  Session.set("filter","@gmail.com");
}

Session.set("allUsers",undefined);

Template.userAdmin.rendered = function () {
    //Init the modal dialog
    $('#userAdminModal').modal({
        'backdrop': 'static',
        'keyboard': false,
        'show': false
    });

    Meteor.subscribe('allUsers',function(){
      Session.set("allUsers",Meteor.users.find({},{ fields: {username: 1}, sort: [['username', 'asc']] }).fetch());
    });
};

Template.userAdmin.helpers({
    userRoleEditList: function() {
        var userList = [];
        var allUsers = Session.get("allUsers") || [];
        allUsers.forEach(function(user) {
            var username = _.chain(user).prop("username").trim().value();

            // Only show users for admin work if the username is an email addr
            // (and yes, we're using a HUGE shortcut here - this check is only
            // for admin convenience, not security)
            if (username.indexOf(Session.get("filter")) > -1) {
                userList.push({
                    '_id': user._id,
                    'username': username,
                    'admin': Roles.userIsInRole(user, ['admin']),
                    'teacher': Roles.userIsInRole(user, ['teacher']),
                });
            }
        });
        return userList;
    }
});

Template.userAdmin.events({
    'change #filter': function(event){
      event.preventDefault();
      Session.set("filter",$("#filter").val());
    },

    'click #doUploadUsers': function(event) {
        event.preventDefault();
        doFileUpload("#upload-users", "USERS");
    },
    'change #upload-users': function(event) {
        var input = $(event.currentTarget);
        $("#users-file-info").html(input.val());
    },

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

function doFileUpload(fileElementSelector, fileDescrip) {
    var count = 0;

    _.each($(fileElementSelector).prop("files"), function(file) {
        count += 1;
        console.log("file:" + JSON.stringify(file));
        var name = file.name;
        var fileReader = new FileReader();

        fileReader.onload = function() {
            console.log("Upload attempted for", name);

            Meteor.call('saveUsersFile', name, fileReader.result, function(error, result) {
                console.log("result:" + JSON.stringify(result));
                if (!!error) {
                    console.log("Critical failure saving " + fileDescrip, error);
                    alert("There was a critical failure saving your " + fileDescrip + " file:" + error);
                }
                else if (result.length > 0) {
                    console.log(fileDescrip + " save failed", result);
                    alert("The " + fileDescrip + " file was not saved: " + JSON.stringify(result));
                }
                else {
                    console.log(fileDescrip + " Saved:", result);
                    alert("Your " + fileDescrip + " file was saved");
                    //Now we can clear the selected file
                    $(fileElementSelector).val('');
                    $(fileElementSelector).parent().find('.file-info').html('');
                }
            });
        };

        fileReader.readAsBinaryString(file);
    });

    console.log(fileDescrip, "at ele", fileElementSelector, "scheduled", count, "uploads");
}
