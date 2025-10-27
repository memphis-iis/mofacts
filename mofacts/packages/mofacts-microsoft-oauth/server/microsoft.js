// Server-side Microsoft OAuth implementation
import { Meteor } from 'meteor/meteor';
import { OAuth } from 'meteor/oauth';
import { ServiceConfiguration } from 'meteor/service-configuration';
import { fetch } from 'meteor/fetch';

Microsoft = {
  serviceName: 'microsoft',

  // Microsoft Graph API fields we want to retrieve
  whitelistedFields: [
    'id',
    'userPrincipalName',
    'displayName',
    'givenName',
    'surname',
    'mail',
    'preferredLanguage',
    'jobTitle',
    'officeLocation',
    'mobilePhone'
  ],

  retrieveCredential: function(credentialToken, credentialSecret) {
    return OAuth.retrieveCredential(credentialToken, credentialSecret);
  }
};

// Exchange authorization code for tokens
const getTokens = async (query) => {
  const config = await ServiceConfiguration.configurations.findOneAsync({
    service: Microsoft.serviceName
  });

  if (!config) {
    throw new ServiceConfiguration.ConfigError();
  }

  const tenant = config.tenant || 'common';
  const tokenEndpoint = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;

  const content = new URLSearchParams({
    code: query.code,
    client_id: config.clientId,
    client_secret: OAuth.openSecret(config.secret),
    redirect_uri: OAuth._redirectUri(Microsoft.serviceName, config),
    grant_type: 'authorization_code'
  });

  try {
    const request = await OAuth._fetch(tokenEndpoint, 'POST', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: content
    });

    const response = await request.json();

    if (response.error) {
      throw new Error(`Microsoft OAuth error: ${response.error_description || response.error}`);
    }

    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: response.expires_in,
      idToken: response.id_token
    };
  } catch (err) {
    throw new Error(`Failed to complete OAuth handshake with Microsoft: ${err.message}`);
  }
};

// Get user identity from Microsoft Graph API
const getIdentity = async (accessToken) => {
  try {
    const request = await OAuth._fetch('https://graph.microsoft.com/v1.0/me', 'GET', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    return await request.json();
  } catch (err) {
    throw new Error(`Failed to fetch identity from Microsoft Graph: ${err.message}`);
  }
};

// Register the OAuth service handler (legacy OAuth2 integration)
OAuth.registerService(Microsoft.serviceName, 2, null, async (query) => {
  serverConsole('[MS-OAUTH-SERVER] OAuth callback received, query params:', Object.keys(query));

  const tokens = await getTokens(query);
  serverConsole('[MS-OAUTH-SERVER] Tokens received:', {
    hasAccessToken: !!tokens.accessToken,
    hasRefreshToken: !!tokens.refreshToken,
    hasIdToken: !!tokens.idToken,
    expiresIn: tokens.expiresIn
  });

  const identity = await getIdentity(tokens.accessToken);
  serverConsole('[MS-OAUTH-SERVER] Identity received from Microsoft Graph:', {
    id: identity.id,
    displayName: identity.displayName,
    mail: identity.mail,
    userPrincipalName: identity.userPrincipalName
  });

  const serviceData = {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    expiresAt: Date.now() + (1000 * parseInt(tokens.expiresIn, 10))
  };

  // Copy whitelisted fields from identity
  const fields = {};
  Microsoft.whitelistedFields.forEach(fieldName => {
    if (identity[fieldName]) {
      fields[fieldName] = identity[fieldName];
    }
  });

  Object.assign(serviceData, fields);

  // Include refresh token if present (only on first login)
  if (tokens.refreshToken) {
    serviceData.refreshToken = tokens.refreshToken;
  }

  // Normalize email - Microsoft Graph uses 'mail' or 'userPrincipalName'
  const email = identity.mail || identity.userPrincipalName;

  serverConsole('[MS-OAUTH-SERVER] Preparing user data:', {
    email: email,
    name: identity.displayName || identity.givenName,
    serviceDataKeys: Object.keys(serviceData)
  });

  return {
    serviceData: serviceData,
    options: {
      profile: {
        name: identity.displayName || identity.givenName
      },
      emails: email ? [{
        address: email,
        verified: true
      }] : undefined
    }
  };
});
