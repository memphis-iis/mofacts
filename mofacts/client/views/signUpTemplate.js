Template.signUpTemplate.events({
    'click #signInButton' : function () {
		Router.go('signin');
        //IWB 2/14/2014 - switch the template to the signInTemplate.
    },
    'click #signUpButton' : function () {
        var newUsername = username.value;
        var newPassword1 = password1.value;
        var newPassword2 = password2.value;

        if (newUsername === "") {
            $(".badUsername").show();
            //IWB 2/14/2014 - we need to let them know that their username has certain
            //requirements (which will have to be changed above).
            //for now we can just log it, but later we will need to put this on the page.
            console.log("Username must be at least 6 characters long.");
            return;
        }
        
        //IWB 2/14/2014 - we need to check if the newUsername is already in use.
        //this requires that the DB already exists.

        if (newPassword1 !== newPassword2) {
            //IWB 2/14/2014 - we need to let them know that their passwords must be the same.
            //for now we can just log it, but later we will need to put this on the page.
            console.log("Please make sure the passwords you typed in are the same.");
            return;
        }

        if (newPassword1 === "") {
            //IWB 2/14/2014 - we need to let them know that their password has certain
            //requirements (which will have to be changed above).
            //for now we can just log it, but later we will need to put this on the page.
            console.log("Please type in a password in both password fields.");
            return;
        }

        //IWB 2/14/2014 - once the above checks have been completed, we can add the user to the DB.
        Accounts.createUser({username: newUsername, password: newPassword1});

        var currentUser = Meteor.users.findOne({_id: Meteor.userId()}).username;
        console.log( currentUser + " is logged in!");

    }
});
