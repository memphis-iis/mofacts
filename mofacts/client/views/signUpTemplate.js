//////////////
//  EVENTS  //
//////////////

Template.signUpTemplate.events({
    'click #signInButton' : function () {
		Router.go('signin');
    },
    'click #signUpButton' : function () {
        var formUsername = signUpUsername.value;
        var formPassword1 = password1.value;
        var formPassword2 = password2.value;

        if(formUsername.length < 6) {
            $("#usernameTooShort").show();
            return;
        } else {
            $("#usernameTooShort").hide();
        }
        
        if(typeof Meteor.users.findOne({username: formUsername}) !== "undefined") {
            $("#usernameAlreadyInUse").show();
            return;
        } else {
            $("#usernameAlreadyInUse").hide();
        }

        if (formPassword1.length < 6) {
             $("#passwordTooShort").show();
             return;
        } else {
            $("#passwordTooShort").hide();
        }

        if(formPassword1 !== formPassword2) {
            $("#passwordMustMatch").show();
            return;
        } else {
            $("#passwordMustMatch").hide();
        }

        Accounts.createUser({username: formUsername, password: formPassword1}, function (error) {
            if(typeof error !== "undefined") {
                console.log("ERROR: There was an error creating the user account!\n" +
                            "\t[Username: " + formUsername + "]\n" +
                            "\t" + error);
            } else {
                var newUserID = Meteor.userId();
                if(newUserID !== null) {
                    UserProgress.insert({
                          userID: newUserID
                        , currentStimuliTest: ""
                        , timeStarted: ""
                        , progressDataArray: [
                                                {
                                                    question: ""
                                                  , correctAnswer: ""
                                                  , userAnswer: ""
                                                  , timeSpentTyping: ""
                                                }
                                             ]
                    }, function (error, id) { //callback function
                        if (typeof error !== "undefined") {
                            console.log("ERROR: The user was not logged in upon account creation!\n"+
                                    "\t[Username:" + formUsername + "]" +
                                    "\t" + error);
                        } else {
                            Router.go("profile");
                        }
                    });
                } else {
                    console.log("ERROR: The user was not logged in upon account creation!\n"+
                            "\t[Username:" + formUsername + "]" +
                            "\t" + error);
                }
            }
        });
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

/////////////////
//  VARIABLES  //
/////////////////

/////////////////
//  FUNCTIONS  //
/////////////////
