//////////////
//  EVENTS  //
//////////////

Template.signInTemplate.events({
    'click #signInButton' : function () {
        if (typeof console !== 'undefined' && Session.get("debugging")) {
            console.log("You are trying to sign in!");
        }
        UserPasswordCheck();
    },
    'click #signUpButton' : function () {
        Router.go("signup");
    },
    'focus #signInUsername' : function () {
        $("#invalidLogin").hide();
    },
    'focus #password' : function () {
        $("#invalidLogin").hide();
    },

    'keypress #password' : function (e) {

        var key=e.keyCode || e.which;
        if (key==13){
            UserPasswordCheck();
        }
    }
});

/////////////////
//  VARIABLES  //
/////////////////

/////////////////
//  FUNCTIONS  //
/////////////////

function UserPasswordCheck(){
    var newUsername = signInUsername.value;
    var newPassword = password.value;
    
    if (!!newUsername & newPassword === "") {
        newPassword = Helpers.blankPassword(newUsername);
    }

    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
            // console.log(error);
            $("#invalidLogin").show();
            return;
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
