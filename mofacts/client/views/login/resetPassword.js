Template.resetPassword.onRendered(function() {
  if (Session.get('loginMode') !== 'experiment') {
    console.log('password signin, setting login mode');
    Session.set('loginMode', 'password');
  }
});

// //////////////////////////////////////////////////////////////////////////
// Template Events

Template.resetPassword.events({
  'click #sendSecret': async function(event) {
      event.preventDefault();
      email = $('#email').val();
      try {
        await Meteor.callAsync('sendPasswordResetEmail', email);
        alert('If you have an account, an email was sent to you.');
      } catch (err) {
        console.log('Error sending password reset email:', err);
      }
      $('#verifySecret').show();
      $('#sendPasswordEmail').hide();
  },
  'click #verifySecretButton': async function(event) {
    event.preventDefault();
    email = $('#email').val();
    secret = $('#secret').val();
    try {
      const res = await Meteor.callAsync('checkPasswordResetSecret', email, secret);
      if(res == true){
        $('#verifySecret').hide();
        $('#resetPasswordForm').show();
      } else {
        alert('Your secret is incorrect.');
        Router.go('/resetPassword');
      }
    } catch (err) {
      console.log('Error verifying reset secret:', err);
      alert('Your secret is incorrect.');
      Router.go('/resetPassword');
    }
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
            Meteor.callAsync('resetPasswordWithSecret', email, secret, resetPassword);
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
    return Meteor.user().loginParams.loginMode === 'experiment';
  }
});
