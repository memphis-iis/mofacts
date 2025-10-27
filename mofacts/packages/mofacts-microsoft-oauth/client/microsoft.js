// Client-side Microsoft OAuth implementation
Microsoft = {
  serviceName: 'microsoft',

  // Request Microsoft credentials for the user
  requestCredential: function (options, credentialRequestCompleteCallback) {
    clientConsole(2, '[MS-OAUTH-CLIENT] requestCredential called with options:', options);

    // Support both (options, callback) and (callback)
    if (!credentialRequestCompleteCallback && typeof options === 'function') {
      credentialRequestCompleteCallback = options;
      options = {};
    } else if (!options) {
      options = {};
    }

    // Fetch the service configuration
    const config = ServiceConfiguration.configurations.findOne({service: Microsoft.serviceName});
    clientConsole(2, '[MS-OAUTH-CLIENT] Service config found:', !!config);
    if (!config) {
      clientConsole(1, '[MS-OAUTH-CLIENT] ERROR: No service configuration found for Microsoft!');
      credentialRequestCompleteCallback &&
        credentialRequestCompleteCallback(new ServiceConfiguration.ConfigError());
      return;
    }

    clientConsole(2, '[MS-OAUTH-CLIENT] Config details:', {
      hasClientId: !!config.clientId,
      hasSecret: !!config.secret,
      tenant: config.tenant,
      loginStyle: config.loginStyle
    });

    const credentialToken = Random.secret();
    const loginStyle = OAuth._loginStyle(Microsoft.serviceName, config, options);

    clientConsole(2, '[MS-OAUTH-CLIENT] Using loginStyle:', loginStyle);

    // Microsoft Identity Platform v2 scopes (OpenID Connect)
    const scope = ['openid', 'profile', 'email'];

    // Add offline_access for refresh token
    if (options.requestOfflineToken) {
      scope.push('offline_access');
    }

    // Add any additional permissions
    if (options.requestPermissions) {
      scope.push(...options.requestPermissions);
    }

    clientConsole(2, '[MS-OAUTH-CLIENT] Requested scopes:', scope);

    const loginUrlParameters = {};

    // ServiceConfiguration parameters
    if (config.loginUrlParameters) {
      Object.assign(loginUrlParameters, config.loginUrlParameters);
    }

    // Function call parameters (override config)
    if (options.loginUrlParameters) {
      Object.assign(loginUrlParameters, options.loginUrlParameters);
    }

    // Prevent illegal parameter overrides
    const illegalParameters = ['response_type', 'client_id', 'scope', 'redirect_uri', 'state', 'response_mode'];
    Object.keys(loginUrlParameters).forEach(key => {
      if (illegalParameters.includes(key)) {
        throw new Error('Microsoft.requestCredential: Invalid loginUrlParameter: ' + key);
      }
    });

    // Microsoft Identity Platform v2 authorization endpoint
    const tenant = config.tenant || 'common';
    const baseUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;

    const redirectUri = OAuth._redirectUri(Microsoft.serviceName, config);
    clientConsole(2, '[MS-OAUTH-CLIENT] Redirect URI:', redirectUri);

    Object.assign(loginUrlParameters, {
      response_type: 'code',
      response_mode: 'query',
      client_id: config.clientId,
      scope: scope.join(' '),
      redirect_uri: redirectUri,
      state: OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl)
    });

    const loginUrl = baseUrl + '?' +
      Object.entries(loginUrlParameters)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    clientConsole(2, '[MS-OAUTH-CLIENT] Launching OAuth login to:', baseUrl);
    clientConsole(2, '[MS-OAUTH-CLIENT] Full login URL (check redirect_uri):', loginUrl);

    OAuth.launchLogin({
      loginService: Microsoft.serviceName,
      loginStyle: loginStyle,
      loginUrl: loginUrl,
      credentialRequestCompleteCallback: credentialRequestCompleteCallback,
      credentialToken: credentialToken,
      popupOptions: { width: 520, height: 680 }
    });

    clientConsole(2, '[MS-OAUTH-CLIENT] OAuth.launchLogin called');
  }
};
