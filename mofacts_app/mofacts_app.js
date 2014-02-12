

if (Meteor.isClient) {
    Template.hello.greeting = function () {
        return "Welcome to mofacts_app.";
    };

    Template.hello.events({
        'click input' : function () {
            // template data, if any, is available in 'this'
            if (typeof console !== 'undefined')
                console.log("You pressed the button");
        }
    });

    Template.login.events({
        'click #signInButton' : function () {
            if (typeof console !== 'undefined') {
                console.log("You are trying to sign in!");
            }
        },
        'click #signUpButton' : function () {
            if (typeof console !== 'undefined') {
                console.log("You are trying to sign up!");
            }
        }
    });
}

if (Meteor.isServer) {
    Meteor.startup(function () {
        // code to run on server at startup
    });
}
