Package.describe({
  name: 'mofacts:microsoft-oauth',
  version: '2.0.0',
  summary: 'Microsoft OAuth flow for Meteor 2.14+ using Microsoft Identity Platform v2',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('2.14');
  api.use('ecmascript');
  api.use('oauth2', ['client', 'server']);
  api.use('oauth', ['client', 'server']);
  api.use('fetch', 'server');
  api.use('service-configuration', ['client', 'server']);
  api.use('random', 'client');

  api.export('Microsoft');

  api.addFiles('client/microsoft.js', 'client');
  api.addFiles('server/microsoft.js', 'server');
});
