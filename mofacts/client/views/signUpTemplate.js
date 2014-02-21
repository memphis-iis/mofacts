Template.signUpTemplate.events({
    'click #signInButton' : function () {
		Router.go('signin');
    },
    'click #signUpButton' : function () {
        var newUsername = signUpUsername.value;
        var newPassword1 = password1.value;
        var newPassword2 = password2.value;

        if(newUsername.length < 6) {
            $("#usernameTooShort").show();
            return;
        } else {
            $("#usernameTooShort").hide();
        }
        
        var userWithGivenUsername = Meteor.users.findOne({username: newUsername});
        if(typeof userWithGivenUsername !== "undefined") {
            $("#usernameAlreadyInUse").show();
            return;
        } else {
            $("#usernameAlreadyInUse").hide();
        }

        if (newPassword1.length < 6) {
             $("#passwordTooShort").show();
             return;
        } else {
            $("#passwordTooShort").hide();
        }

        if(newPassword1 !== newPassword2) {
            $("#passwordMustMatch").show();
            return;
        } else {
            $("#passwordMustMatch").hide();
        }

        Accounts.createUser({username: newUsername, password: newPassword1});

        var currentUser = Meteor.users.findOne({_id: Meteor.userId()});

        if (currentUser !== "undefined") {
            console.log( currentUser.username + " is logged in!");
            Router.go("profile");
        } else {
            //there was an issue with the account creation or the login thereafter.
        }
    },
    'blur #signUpUsername' : function () {
        if(signUpUsername.value.length < 6) {
            $("#usernameTooShort").show();
        } else {
            $("#usernameTooShort").hide();
        }

        var userWithGivenUsername = Meteor.users.findOne({username: signUpUsername.value});
        if(typeof userWithGivenUsername !== "undefined") {
            $("#usernameAlreadyInUse").show();
        } else {
            $("#usernameAlreadyInUse").hide();
        }
    },
    'blur #password1' : function () {
        if(password1.value.length < 6) {
            $("#passwordTooShort").show();
        } else {
            $("#passwordTooShort").hide();
        }
    },
    'blur #password2' : function () {
        if(password1.value !== password2.value) {
            $("#passwordMustMatch").show();
        } else {
            $("#passwordMustMatch").hide();
        }
    }
});
