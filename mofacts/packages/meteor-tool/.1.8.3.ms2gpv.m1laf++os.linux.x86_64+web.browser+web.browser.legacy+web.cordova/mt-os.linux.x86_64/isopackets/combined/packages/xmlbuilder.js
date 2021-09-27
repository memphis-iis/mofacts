(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;

/* Package-scope variables */
var XmlBuilder;

(function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/xmlbuilder/xmlbuilder.js                                 //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
XmlBuilder = Npm.require('xmlbuilder');


///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
Package._define("xmlbuilder", {
  XmlBuilder: XmlBuilder
});

})();
