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
                formPassword1 = Helpers.blankPassword(formUserName);
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

        Accounts.createUser({username: formUsername, password: newPass}, function (error) {
            if(typeof error !== "undefined") {
                console.log("ERROR: There was an error creating the user account!\n" +
                            "\t[Username: " + formUsername + "]\n" +
                            "\t" + error);
            } else {
                var newUserID = Meteor.userId();
                var newUserName = Meteor.user().username;
                if(newUserID !== null) {
                    UserProgress.insert(
                        {
                              _id: newUserID
                            , username: newUserName
                            , currentStimuliTest: "NEW USER"
                            , currentTestMode: "NEW USER"
                            , progressDataArray: []
                        },
                        function (error, id) { //callback function
                            if (typeof error !== "undefined") {
                                console.log("ERROR: The user was not logged in upon account creation!\n"+
                                        "\t[Username:" + formUsername + "]" +
                                        "\t" + error);
                            } else {

                                CardProbabilities.insert(
                                    {
                                          _id: Meteor.userId()
                                        , numQuestionsAnswered: 0
                                        , cardsArray: []
                                    },
                                    function (error, id) {
                                        if (typeof error !== "undefined") {
                                            console.log("ERROR: The user was not logged in upon account creation!\n"+
                                                    "\t[Username:" + formUsername + "]" +
                                                    "\t" + error);
                                        } else {
                                            Router.go("profile");
                                        }
                                    }
                                );
                            }
                        }
                    );
                } else {
                    console.log("ERROR: The user was not logged in upon account creation!\n"+
                            "\t[Username:" + formUsername + "]" +
                            "\t" + error);
                }
            }

            //TODO: switching to role-based - also... on error?
            UserAccounts.insert({
                id: newUserID
            });
            if (formPassword1 == null) {
                OpenAccounts.insert({
                    id: newUserID,
                    username: formUsername
                });
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
