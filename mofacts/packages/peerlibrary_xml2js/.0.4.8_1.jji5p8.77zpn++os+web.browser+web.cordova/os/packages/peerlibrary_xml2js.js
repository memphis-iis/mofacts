(function () {

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/peerlibrary:xml2js/server.js                             //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
xml2js = Npm.require('xml2js');                                      // 1
                                                                     // 2
xml2js.parseStringSync = blocking(xml2js.parseString);               // 3
///////////////////////////////////////////////////////////////////////

}).call(this);
