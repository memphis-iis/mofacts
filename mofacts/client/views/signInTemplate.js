////////////////////////////////////////////////////////////////////////////
// Template Events

Template.signInTemplate.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        if (typeof console !== 'undefined' && Session.get("debugging")) {
            console.log("You are trying to sign in!");
        }
        UserPasswordCheck();
    },
    
    'click #signUpButton' : function (event) {
        event.preventDefault();
        Router.go("signup");
    },
    
    'focus #signInUsername' : function (event) {
        $("#invalidLogin").hide();
    },
    
    'focus #password' : function () {
        $("#invalidLogin").hide();
    },

    'keypress #password' : function (e) {
        var key=e.keyCode || e.which;
        if (key == 13) {
            UserPasswordCheck();
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Implementation functions

function UserPasswordCheck() {
    var newUsername = signInUsername.value;
    var newPassword = password.value;
    
    if (!!newUsername & newPassword === "") {
        newPassword = Helpers.blankPassword(newUsername);
    }

    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
            console.log("Login error: " + error);
            $("#invalidLogin").show();
        }
        else {
            $("#invalidLogin").hide();
            if (Session.get("debugging")) {
                var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                console.log(currentUser + " was logged in successfully!");
                Meteor.call("debugLog", "Sign in was successful");
            }
            Router.go("profile");
        }
    });
}
