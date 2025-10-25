# mofacts:accounts-microsoft

Meteor Accounts integration for Microsoft OAuth (Azure AD, Office 365, personal Microsoft accounts).

## Overview

This package provides `Meteor.loginWithMicrosoft()` functionality using modern Microsoft Identity Platform v2.0.

## Installation

This is a local package. It's already included in your `packages/` directory.

## Configuration

Add Microsoft configuration to your `settings.json`:

```json
{
  "microsoft": {
    "clientId": "your-application-client-id",
    "secret": "your-client-secret",
    "tenant": "common"
  }
}
```

Or configure via the Accounts UI configuration:

```javascript
ServiceConfiguration.configurations.upsert(
  { service: 'microsoft' },
  {
    $set: {
      clientId: 'your-application-client-id',
      secret: 'your-client-secret',
      tenant: 'common',  // or 'organizations', 'consumers', or specific tenant ID
      loginStyle: 'popup'
    }
  }
);
```

## Usage

### Client-side Login

```javascript
Meteor.loginWithMicrosoft({
  requestPermissions: ['User.Read'],  // Additional Microsoft Graph scopes
  requestOfflineToken: true,           // Request refresh token
}, (error) => {
  if (error) {
    console.error('Login failed:', error);
  } else {
    console.log('Login successful!');
  }
});
```

### Server-side User Data

After login, user data is stored in:

```javascript
Meteor.user().services.microsoft
```

Available fields:
- `id` - Microsoft user ID
- `displayName` - Full name
- `givenName` - First name
- `surname` - Last name
- `mail` or `userPrincipalName` - Email address
- `accessToken` - OAuth access token
- `expiresAt` - Token expiration timestamp
- `refreshToken` - Refresh token (if offline access requested)

## Differences from Q42 Package

1. **Modern Endpoints**: Uses Microsoft Identity Platform v2 instead of Windows Live
2. **OpenID Connect**: Uses standard `openid`, `profile`, `email` scopes
3. **Async/Await**: Compatible with Meteor 2.14+ async patterns
4. **Microsoft Graph**: Uses Graph API for user info instead of legacy `apis.live.net`
5. **Multi-tenant**: Supports Azure AD multi-tenancy
