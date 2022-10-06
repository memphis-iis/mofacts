import { Route53RecoveryCluster } from "../../../node_modules/aws-sdk/index";

Template.resetPassword.onRendered(function() {
  if (Session.get('loginMode') !== 'experiment') {
    console.log('password signin, setting login mode');
    Session.set('loginMode', 'password');
  }
});

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.resetPassword.events({
  'click #sendSecret': function(event) {
      event.preventDefault();
      email = $('#email').val();
      Meteor.call('sendPasswordResetEmail', email, function(err, res){
          alert('If you have an account, an email was sent to you.');
      });
      $('#verifySecret').show();
      $('#sendPasswordEmail').hide();
  },
  'click #verifySecretButton': function(event) {
    event.preventDefault();
    email = $('#email').val();
    secret = $('#secret').val();
    Meteor.call('checkPasswordResetSecret', email, secret, function(err, res){
        if(res == true){
            $('#verifySecret').hide();
            $('#resetPasswordForm').show();
        } else {
            alert('Your secret is incorrect.');
            Router.go('/resetPassword');
        }
    });

},
  'click #resetPasswordButton': function(event) {
    event.preventDefault();
    secret = $('#secret').val();
    resetPassword = $('#password').val();
    resetPasswordVerify = $('#passwordVerfiy').val();
    email = $('#email').val();
    if(resetPassword !== resetPasswordVerify){
        alert("Passwords do not match.")
    } else {
        if(resetPassword.length > 5){
            Meteor.call('resetPasswordWithSecret', email, secret, resetPassword);
            Router.go('/signin');
        }else{
            alert("Password must be at least 6 characters.");
        }
    }
  },
});

// //////////////////////////////////////////////////////////////////////////
// Template Heleprs

Template.resetPassword.helpers({
  secret: function() {
    return Meteor.user().profile.loginMode === 'experiment';
  }
});
