/**
 * Meteor.loginWithMicrosoft(options, callback)
 *
 * Client-side login function for Microsoft accounts
 */
Meteor.loginWithMicrosoft = function(options, callback) {
  // Support a callback without options
  if (!callback && typeof options === "function") {
    callback = options;
    options = null;
  }

  const credentialRequestCompleteCallback = Accounts.oauth.credentialRequestCompleteHandler(callback);
  Microsoft.requestCredential(options, credentialRequestCompleteCallback);
};
