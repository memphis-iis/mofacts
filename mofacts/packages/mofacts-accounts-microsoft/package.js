Package.describe({
  name: 'mofacts:accounts-microsoft',
  version: '2.0.0',
  summary: 'Login service for Microsoft accounts (Meteor 2.14+)',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('2.14');
  api.use('ecmascript');
  api.use('accounts-base', ['client', 'server']);
  api.imply('accounts-base', ['client', 'server']);
  api.use('accounts-oauth', ['client', 'server']);
  api.use('mofacts:microsoft-oauth@2.0.0', ['client', 'server']);

  api.addFiles('client/microsoft.js', 'client');
  api.addFiles('client/login_button.css', 'client');
  api.addFiles('server/microsoft.js', 'server');
});
