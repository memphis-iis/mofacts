Package.describe({
  summary: "Parse XML into JSON"
});

Npm.depends({xml2js: "0.4.1"});

Package.on_use(function (api) {
  api.export('XML2JS');
  api.add_files("xml2js.js", "server");
});