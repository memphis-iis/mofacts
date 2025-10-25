// Client-side Microsoft OAuth implementation
Microsoft = {
  serviceName: 'microsoft',

  // Request Microsoft credentials for the user
  requestCredential: function (options, credentialRequestCompleteCallback) {
    // Support both (options, callback) and (callback)
    if (!credentialRequestCompleteCallback && typeof options === 'function') {
      credentialRequestCompleteCallback = options;
      options = {};
    } else if (!options) {
      options = {};
    }

    // Fetch the service configuration
    const config = ServiceConfiguration.configurations.findOne({service: Microsoft.serviceName});
    if (!config) {
      credentialRequestCompleteCallback &&
        credentialRequestCompleteCallback(new ServiceConfiguration.ConfigError());
      return;
    }

    const credentialToken = Random.secret();
    const loginStyle = OAuth._loginStyle(Microsoft.serviceName, config, options);

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

    Object.assign(loginUrlParameters, {
      response_type: 'code',
      response_mode: 'query',
      client_id: config.clientId,
      scope: scope.join(' '),
      redirect_uri: OAuth._redirectUri(Microsoft.serviceName, config),
      state: OAuth._stateParam(loginStyle, credentialToken, options.redirectUrl)
    });

    const loginUrl = baseUrl + '?' +
      Object.entries(loginUrlParameters)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

    OAuth.launchLogin({
      loginService: Microsoft.serviceName,
      loginStyle: loginStyle,
      loginUrl: loginUrl,
      credentialRequestCompleteCallback: credentialRequestCompleteCallback,
      credentialToken: credentialToken,
      popupOptions: { width: 520, height: 680 }
    });
  }
};
