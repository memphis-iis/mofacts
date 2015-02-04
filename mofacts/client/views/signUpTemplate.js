////////////////////////////////////////////////////////////////////////////
// Template event

Template.signUpTemplate.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        routeToSignin();
    },

    'click #signUpButton' : function (event) {
        event.preventDefault();

        var formUsername = signUpUsername.value;
        var formPassword1 = password1.value;
        var formPassword2 = password2.value;

        //Hide previous errors
        $(".errcheck").hide();

        var checks = [];

        if(formUsername.length < 6) {
            checks.push("#usernameTooShort");
        }

        if(typeof Meteor.users.findOne({username: formUsername}) !== "undefined") {
            checks.push("#usernameAlreadyInUse");
        }

        //"Regular" password checks
        if (formPassword1.length < 6) {
            checks.push("#passwordTooShort");
        }

        if(formPassword1 !== formPassword2) {
            checks.push("#passwordMustMatch");
        }

        //Show any and all errors
        if (checks.length > 0) {
            _.each(checks, function(ele) {
                $(ele).show();
            });
            return;
        }

        Accounts.createUser({username: formUsername, password: formPassword1}, function (error) {
            if(typeof error !== "undefined") {
                console.log("Error creating the user account for user:", formUserName, error);
                alert("Unfortunately, a user account for " + formUserName + " could not be created: " + error);
                return;
            }

            //Clean up and init the session
            sessionCleanUp();

            var newUserID = Meteor.userId();
            if(newUserID === null) {
                //This means that we have an issue of some kind - but there's
                //nothing that we can do? We'll just fall thru for now since
                //we don't have a good way to fix this
                console.log("ERROR: The user was not logged in on account creation?", formUsername);
                alert("It appears that you couldn't be logged in as " + formUserName);
            }

            Router.go("profile");
        });
    },

    'blur #signUpUsername' : function (event) {
        if(signUpUsername.value.length < 6) {
            $("#usernameTooShort").show();
        }
        else {
            $("#usernameTooShort").hide();
        }

        var userWithGivenUsername = Meteor.users.findOne({username: signUpUsername.value});
        if(userWithGivenUsername) {
            $("#usernameAlreadyInUse").show();
        }
        else {
            $("#usernameAlreadyInUse").hide();
        }
    },

    'blur #password1' : function () {
        var len = password1.value.length;
        if(len < 6) {
            $("#passwordTooShort").show();
        }
        else {
            $("#passwordTooShort").hide();
        }
    },

    'blur #password2' : function () {
        if(password1.value !== password2.value) {
            $("#passwordMustMatch").show();
        }
        else {
            $("#passwordMustMatch").hide();
        }
    }
});
