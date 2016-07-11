Template.signInOauth.events({
    'click #signInButton' : function (event) {
        event.preventDefault();
        console.log("Google Login Proceeding");
        Meteor.loginWithGoogle(
            { requestPermissions: ['email', 'profile'] },
            onSignInResult
        );
    },
});

function onSignInResult(err) {
    if(err) {
        //error handling
        console.log("Could not log in with Google", err);
        throw new Meteor.Error(Accounts.LoginCancelledError.numericError, 'Error');
    }

    //Made it!
    if (Session.get("debugging")) {
        var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
        console.log(currentUser + " was logged in successfully! Current route is ", Router.current().route.getName());
        Meteor.call("debugLog", "Sign in was successful");
    }

    Router.go("/profile");
}
