////////////////////////////////////////////////////////////////////////////
// Template Events

Template.signInTemplate.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        UserPasswordCheck();
    },

    'click #signUpButton' : function (event) {
        event.preventDefault();
        Router.go("/signup");
    },

    'focus #signInUsername' : function (event) {
        $("#invalidLogin").hide();
    },

    'focus #password' : function () {
        $("#invalidLogin").hide();
    },

    'keypress .accept-enter-key' : function (event) {
        var key = event.keyCode || event.which;
        if (key == 13) {
            event.preventDefault();
            UserPasswordCheck();
        }
    }
});

////////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.signInTemplate.helpers({
    isExperiment: function() {
        return Session.get("loginMode") === "experiment";
    },

    isNormal: function() {
        return Session.get("loginMode") !== "experiment";
    }
});

////////////////////////////////////////////////////////////////////////////
// Implementation functions

//Called after we have signed in
function signinNotify() {
    if (Session.get("debugging")) {
        var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
        console.log(currentUser + " was logged in successfully!");
        Meteor.call("debugLog", "Sign in was successful");
    }
    Router.go("/profile");
}

function UserPasswordCheck() {
    //Hide previous errors
    $(".errcheck").hide();

    var experiment = Session.get("loginMode") === "experiment";
    var newUsername = signInUsername.value;
    var newPassword = (experiment ? "" : password.value);

    if (!!newUsername & newPassword === "") {
        newPassword = Helpers.blankPassword(newUsername);
    }

    if (experiment) {
        //Experiment mode - we create a user if one isn't already there. We
        //Call sign up - specifying that a duplicate user is OK
        Meteor.call("signUpUser", newUsername, newPassword, true, function(error, result) {
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
                $("#serverErrors")
                    .html(errorMsgs.join("<br>"))
                    .show();
                return;
            }

            //Everything was OK if we make it here - now we init the session,
            //login, and proceed to the pofile screen

            sessionCleanUp();

            Meteor.loginWithPassword(newUsername, newPassword, function(error) {
                if (typeof error !== 'undefined') {
                    console.log("ERROR: The user was not logged in on experiment sign in?", newUsername);
                    alert("It appears that you couldn't be logged in as " + newUsername);
                }
                else {
                    signinNotify();
                }
            });

            //No more processing
            return;
        });
    }

    //If we're here, either we're in experimental mode and we know the user
    //exists **OR** it's a "normal" login
    Meteor.loginWithPassword(newUsername, newPassword, function(error) {
        if (typeof error !== 'undefined') {
            console.log("Login error: " + error);
            $("#invalidLogin").show();
            $("#serverErrors").html(error).show();
        }
        else {
            signinNotify();
        }
    });
}
