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

        Meteor.call("signUpUser", formUsername, formPassword1, function(error, result) {
            var errorMsgs = [];

            if (typeof error !== "undefined") {
                errorMsgs.push(error);
            }

            if (!!result && result.length) {
                _.each(result, function(msg) {
                    errorMsgs.push(msg);
                });
            }

            //If there was a call failure or server returned error message,
            //then we can't proceed
            if (errorMsgs.length > 0) {
                var serverErrors = $("#serverErrors")
                    .html(errorMsgs.join("<br>"))
                    .show();
                return;
            }

            //Everything was OK if we make it here - now we init the session,
            //login, and proceed to the pofile screen

            sessionCleanUp();

            Meteor.loginWithPassword(formUsername, formPassword1, function(error) {
                if (typeof error !== 'undefined') {
                    //This means that we have an issue of some kind - but there's
                    //nothing that we can do? We'll just fall thru for now since
                    //we don't have a good way to fix this
                    console.log("ERROR: The user was not logged in on account creation?", formUsername);
                    alert("It appears that you couldn't be logged in as " + formUserName);
                }
                else {
                    if (Session.get("debugging")) {
                        var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
                        console.log(currentUser + " was logged in successfully!");
                        Meteor.call("debugLog", "Sign in was successful");
                    }
                    Router.go("/profile");
                }
            });
        });
    },

    'blur #signUpUsername' : function (event) {
        if(signUpUsername.value.length < 6) {
            $("#usernameTooShort").show();
        }
        else {
            $("#usernameTooShort").hide();
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
