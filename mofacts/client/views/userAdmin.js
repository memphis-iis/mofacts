////////////////////////////////////////////////////////////////////////////
// Template helpers

Template.userAdmin.helpers({
    //None currently
});

////////////////////////////////////////////////////////////////////////////
// Template events

Template.userAdmin.events({
    // Admin/Teachers - save AWS profile data
    'click #passchg': function(event) {
        event.preventDefault();

        try {
            var userName = _.trim($("#passchg-user").val());
            var newPassword = _.trim($("#passchg-pwd1").val());
            var confirmPassword = _.trim($("#passchg-pwd2").val());

            if (!userName) throw "User name is required to change a password";
            if (!newPassword) throw "Please supply a password";
            if (!confirmPassword) throw "You must confirm the password";
            if (newPassword !== confirmPassword) throw "The passwords must match";
            if (newPassword.length < 6) throw "Please supply a password with at least 6 characters";

            Meteor.call("changeUserPassword", userName, newPassword, function(error, serverReturn) {
                if (!!error) {
                    console.log("Error saving changing password", error);
                    alert("Your changes were not saved! " + error);
                }
                else if (!!serverReturn) {
                    console.log("Server failure while updating password", serverReturn);
                    alert("The password was not changes! The server said: " + serverReturn);
                }
                else {
                    console.log("Password Changed");
                    //Clear any controls that shouldn't be kept around
                    $(".clearOnPwd").val("");
                    alert("Password Changed");
                }
            });
        }
        catch(e) {
            console.log("Failure changing password:", e);
            alert(e);
        }
    },
});
