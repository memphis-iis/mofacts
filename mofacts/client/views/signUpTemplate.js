////////////////////////////////////////////////////////////////////////////
// Template event

Template.signUpTemplate.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        Router.go('signin');
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
        
        if (formPassword1 === "" && formPassword2 === "") {
            //Maybe they WANT an empty password?
            if (confirm("Are you sure that you want to use an empty password")) {
                formPassword1 = Helpers.blankPassword(formUsername);
                formPassword2 = "" + formPassword1;
            }
            else {
                checks.push("#passwordTooShort");
            }
        }
        else {
            //"Regular" password checks
            if (formPassword1.length < 6) {
                checks.push("#passwordTooShort");
            }

            if(formPassword1 !== formPassword2) {
                checks.push("#passwordMustMatch");
            }
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
            var newUserName = Meteor.user().username;
            if(newUserID !== null) {
                UserProgress.insert({
                    _id: newUserID,
                    username: newUserName,
                    currentStimuliTest: "NEW USER",
                    currentTestMode: "NEW USER",
                    progressDataArray: []
                },
                function (error, id) { //callback function
                    if (typeof error !== "undefined") {
                        console.log("Error setting up user progress for user:", formUserName, error);
                    }
                    else {
                        Router.go("profile");
                    }
                });
            }
            else {
                console.log("ERROR: The user was not logged in upon account creation!\n"+
                        "\t[Username:" + formUsername + "]" +
                        "\t" + error);
            }
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
        if(len > 1 && len < 6) {
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
