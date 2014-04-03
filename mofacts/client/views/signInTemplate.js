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
    
    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
       if (typeof error !== 'undefined') {
            // console.log(error);
            $("#invalidLogin").show();
            return;
        } else {
            $("#invalidLogin").hide();
            var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
            if(typeof console !== "undefined" && Session.get("debugging")) {
                console.log(currentUser + " was logged in successfully!");
                Meteor.call("Userlog", currentUser);
            }
            Router.go("profile");
        }
    });
}