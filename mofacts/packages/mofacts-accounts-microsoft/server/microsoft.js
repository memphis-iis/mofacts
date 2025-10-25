import { Accounts } from 'meteor/accounts-base';

// Register the service with Accounts
Accounts.oauth.registerService('microsoft');

// Autopublish configuration
if (Accounts._autopublishFields) {
  // Publish Microsoft service data for logged-in user
  Accounts._autopublishFields.forLoggedInUser.push({
    forLoggedInUser: ['services.microsoft'],
    forOtherUsers: [
      'services.microsoft.id',
      'services.microsoft.displayName',
      'services.microsoft.givenName',
      'services.microsoft.surname'
    ]
  });

  // Ensure email addresses are published
  Accounts._autopublishFields.forLoggedInUser.push('services.microsoft.mail');
  Accounts._autopublishFields.forLoggedInUser.push('services.microsoft.userPrincipalName');
}
