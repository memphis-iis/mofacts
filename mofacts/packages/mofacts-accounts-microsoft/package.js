Package.describe({
  name: 'mofacts:accounts-microsoft',
  version: '3.0.0',
  summary: 'Login service for Microsoft accounts (Meteor 3.0+)',
  git: '',
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('3.0');
  api.use('ecmascript');
  api.use('accounts-base', ['client', 'server']);
  api.imply('accounts-base', ['client', 'server']);
  api.use('accounts-oauth', ['client', 'server']);
  api.use('mofacts:microsoft-oauth@3.0.0', ['client', 'server']);

  api.addFiles('client/microsoft.js', 'client');
  api.addFiles('client/login_button.css', 'client');
  api.addFiles('server/microsoft.js', 'server');
});
