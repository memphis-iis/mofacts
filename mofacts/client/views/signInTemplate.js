Template.signInTemplate.events({
    'click #signInButton' : function () {
        if (typeof console !== 'undefined') {
            console.log("You are trying to sign in!");
        }
        var newUsername = username.value;
        var newPassword = password.value;
        
        Meteor.loginWithPassword(newUsername, newPassword, function(error) {
            if (typeof error !== 'undefined') {
                console.log(error);
            } else {
                console.log(newUsername + " was logged in successfully!");
            }
        });

        

    },
    'click #signUpButton' : function () {
		Router.go("signup");
    }
});
