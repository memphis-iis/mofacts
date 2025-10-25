# mofacts:microsoft-oauth

Microsoft OAuth flow implementation for Meteor 2.14+ using the Microsoft Identity Platform v2.0 endpoints.

## Overview

This package provides OAuth 2.0 authentication with Microsoft (Azure AD, Office 365, personal Microsoft accounts) using modern OpenID Connect standards.

## Key Differences from Q42 Package

- Uses **Microsoft Identity Platform v2** endpoints instead of Windows Live
- Uses **OpenID Connect scopes** (`openid`, `profile`, `email`) instead of legacy Windows Live scopes
- **Async/await** implementation compatible with Meteor 2.14+
- Uses **Microsoft Graph API** (`graph.microsoft.com/v1.0/me`) for user info instead of `apis.live.net`
- Supports **multi-tenant** authentication (common, organizations, consumers, or specific tenant ID)

## Configuration

Configure in your settings.json:

```json
{
  "microsoft": {
    "clientId": "your-application-client-id",
    "secret": "your-client-secret",
    "tenant": "common"
  }
}
```

### Tenant Options

- `common` - Any Microsoft account (Azure AD or personal)
- `organizations` - Any Azure AD account
- `consumers` - Personal Microsoft accounts only
- `{tenant-id}` - Specific Azure AD tenant

## Endpoints Used

- **Authorization**: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize`
- **Token**: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- **User Info**: `https://graph.microsoft.com/v1.0/me`

## Default Scopes

- `openid` - Required for ID token
- `profile` - User profile information
- `email` - User email address
- `offline_access` - Refresh token (when `requestOfflineToken: true`)
