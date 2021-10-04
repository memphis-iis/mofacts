(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EJSON = Package.ejson.EJSON;
var IdMap = Package['id-map'].IdMap;
var Random = Package.random.Random;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var hexString, MongoID;

var require = meteorInstall({"node_modules":{"meteor":{"mongo-id":{"id.js":function(require,exports,module){

///////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                           //
// packages/mongo-id/id.js                                                                   //
//                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////
                                                                                             //
module.export({
  MongoID: () => MongoID
});
let EJSON;
module.link("meteor/ejson", {
  EJSON(v) {
    EJSON = v;
  }

}, 0);
let Random;
module.link("meteor/random", {
  Random(v) {
    Random = v;
  }

}, 1);
const MongoID = {};

MongoID._looksLikeObjectID = str => str.length === 24 && str.match(/^[0-9a-f]*$/);

MongoID.ObjectID = class ObjectID {
  constructor(hexString) {
    //random-based impl of Mongo ObjectID
    if (hexString) {
      hexString = hexString.toLowerCase();

      if (!MongoID._looksLikeObjectID(hexString)) {
        throw new Error('Invalid hexadecimal string for creating an ObjectID');
      } // meant to work with _.isEqual(), which relies on structural equality


      this._str = hexString;
    } else {
      this._str = Random.hexString(24);
    }
  }

  equals(other) {
    return other instanceof MongoID.ObjectID && this.valueOf() === other.valueOf();
  }

  toString() {
    return "ObjectID(\"".concat(this._str, "\")");
  }

  clone() {
    return new MongoID.ObjectID(this._str);
  }

  typeName() {
    return 'oid';
  }

  getTimestamp() {
    return Number.parseInt(this._str.substr(0, 8), 16);
  }

  valueOf() {
    return this._str;
  }

  toJSONValue() {
    return this.valueOf();
  }

  toHexString() {
    return this.valueOf();
  }

};
EJSON.addType('oid', str => new MongoID.ObjectID(str));

MongoID.idStringify = id => {
  if (id instanceof MongoID.ObjectID) {
    return id.valueOf();
  } else if (typeof id === 'string') {
    var firstChar = id.charAt(0);

    if (id === '') {
      return id;
    } else if (firstChar === '-' || // escape previously dashed strings
    firstChar === '~' || // escape escaped numbers, true, false
    MongoID._looksLikeObjectID(id) || // escape object-id-form strings
    firstChar === '{') {
      // escape object-form strings, for maybe implementing later
      return "-".concat(id);
    } else {
      return id; // other strings go through unchanged.
    }
  } else if (id === undefined) {
    return '-';
  } else if (typeof id === 'object' && id !== null) {
    throw new Error('Meteor does not currently support objects other than ObjectID as ids');
  } else {
    // Numbers, true, false, null
    return "~".concat(JSON.stringify(id));
  }
};

MongoID.idParse = id => {
  var firstChar = id.charAt(0);

  if (id === '') {
    return id;
  } else if (id === '-') {
    return undefined;
  } else if (firstChar === '-') {
    return id.substr(1);
  } else if (firstChar === '~') {
    return JSON.parse(id.substr(1));
  } else if (MongoID._looksLikeObjectID(id)) {
    return new MongoID.ObjectID(id);
  } else {
    return id;
  }
};
///////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/mongo-id/id.js");

/* Exports */
Package._define("mongo-id", exports, {
  MongoID: MongoID
});

})();

//# sourceURL=meteor://💻app/packages/mongo-id.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28taWQvaWQuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiTW9uZ29JRCIsIkVKU09OIiwibGluayIsInYiLCJSYW5kb20iLCJfbG9va3NMaWtlT2JqZWN0SUQiLCJzdHIiLCJsZW5ndGgiLCJtYXRjaCIsIk9iamVjdElEIiwiY29uc3RydWN0b3IiLCJoZXhTdHJpbmciLCJ0b0xvd2VyQ2FzZSIsIkVycm9yIiwiX3N0ciIsImVxdWFscyIsIm90aGVyIiwidmFsdWVPZiIsInRvU3RyaW5nIiwiY2xvbmUiLCJ0eXBlTmFtZSIsImdldFRpbWVzdGFtcCIsIk51bWJlciIsInBhcnNlSW50Iiwic3Vic3RyIiwidG9KU09OVmFsdWUiLCJ0b0hleFN0cmluZyIsImFkZFR5cGUiLCJpZFN0cmluZ2lmeSIsImlkIiwiZmlyc3RDaGFyIiwiY2hhckF0IiwidW5kZWZpbmVkIiwiSlNPTiIsInN0cmluZ2lmeSIsImlkUGFyc2UiLCJwYXJzZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUFBLE1BQU0sQ0FBQ0MsTUFBUCxDQUFjO0FBQUNDLFNBQU8sRUFBQyxNQUFJQTtBQUFiLENBQWQ7QUFBcUMsSUFBSUMsS0FBSjtBQUFVSCxNQUFNLENBQUNJLElBQVAsQ0FBWSxjQUFaLEVBQTJCO0FBQUNELE9BQUssQ0FBQ0UsQ0FBRCxFQUFHO0FBQUNGLFNBQUssR0FBQ0UsQ0FBTjtBQUFROztBQUFsQixDQUEzQixFQUErQyxDQUEvQztBQUFrRCxJQUFJQyxNQUFKO0FBQVdOLE1BQU0sQ0FBQ0ksSUFBUCxDQUFZLGVBQVosRUFBNEI7QUFBQ0UsUUFBTSxDQUFDRCxDQUFELEVBQUc7QUFBQ0MsVUFBTSxHQUFDRCxDQUFQO0FBQVM7O0FBQXBCLENBQTVCLEVBQWtELENBQWxEO0FBRzVHLE1BQU1ILE9BQU8sR0FBRyxFQUFoQjs7QUFFQUEsT0FBTyxDQUFDSyxrQkFBUixHQUE2QkMsR0FBRyxJ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WDtBQUNEO0FBQ0YsQ0F0QkQ7O0FBd0JBN0IsT0FBTyxDQUFDbUMsT0FBUixHQUFtQk4sRUFBRCxJQUFRO0FBQ3hCLE1BQUlDLFNBQVMsR0FBR0QsRUFBRSxDQUFDRSxNQUFILENBQVUsQ0FBVixDQUFoQjs7QUFDQSxNQUFJRixFQUFFLEtBQUssRUFBWCxFQUFlO0FBQ2IsV0FBT0EsRUFBUDtBQUNELEdBRkQsTUFFTyxJQUFJQSxFQUFFLEtBQUssR0FBWCxFQUFnQjtBQUNyQixXQUFPRyxTQUFQO0FBQ0QsR0FGTSxNQUVBLElBQUlGLFNBQVMsS0FBSyxHQUFsQixFQUF1QjtBQUM1QixXQUFPRCxFQUFFLENBQUNMLE1BQUgsQ0FBVSxDQUFWLENBQVA7QUFDRCxHQUZNLE1BRUEsSUFBSU0sU0FBUyxLQUFLLEdBQWxCLEVBQXVCO0FBQzVCLFdBQU9HLElBQUksQ0FBQ0csS0FBTCxDQUFXUCxFQUFFLENBQUNMLE1BQUgsQ0FBVSxDQUFWLENBQVgsQ0FBUDtBQUNELEdBRk0sTUFFQSxJQUFJeEIsT0FBTyxDQUFDSyxrQkFBUixDQUEyQndCLEVBQTNCLENBQUosRUFBb0M7QUFDekMsV0FBTyxJQUFJN0IsT0FBTyxDQUFDUyxRQUFaLENBQXFCb0IsRUFBckIsQ0FBUDtBQUNELEdBRk0sTUFFQTtBQUNMLFdBQU9BLEVBQVA7QUFDRDtBQUNGLENBZkQsQyIsImZpbGUiOiIvcGFja2FnZXMvbW9uZ28taWQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBFSlNPTiB9IGZyb20gJ21ldGVvci9lanNvbic7XG5pbXBvcnQgeyBSYW5kb20gfSBmcm9tICdtZXRlb3IvcmFuZG9tJztcblxuY29uc3QgTW9uZ29JRCA9IHt9O1xuXG5Nb25nb0lELl9sb29rc0xpa2VPYmplY3RJRCA9IHN0ciA9PiBzdHIubGVuZ3RoID09PSAyNCAmJiBzdHIubWF0Y2goL15bMC05YS1mXSokLyk7XG5cbk1vbmdvSUQuT2JqZWN0SUQgPSBjbGFzcyBPYmplY3RJRCB7XG4gIGNvbnN0cnVjdG9yIChoZXhTdHJpbmcpIHtcbiAgICAvL3JhbmRvbS1iYXNlZCBpbXBsIG9mIE1vbmdvIE9iamVjdElEXG4gICAgaWYgKGhleFN0cmluZykge1xuICAgICAgaGV4U3RyaW5nID0gaGV4U3RyaW5nLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoIU1vbmdvSUQuX2xvb2tzTGlrZU9iamVjdElEKGhleFN0cmluZykpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGhleGFkZWNpbWFsIHN0cmluZyBmb3IgY3JlYXRpbmcgYW4gT2JqZWN0SUQnKTtcbiAgICAgIH1cbiAgICAgIC8vIG1lYW50IHRvIHdvcmsgd2l0aCBfLmlzRXF1YWwoKSwgd2hpY2ggcmVsaWVzIG9uIHN0cnVjdHVyYWwgZXF1YWxpdHlcbiAgICAgIHRoaXMuX3N0ciA9IGhleFN0cmluZztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fc3RyID0gUmFuZG9tLmhleFN0cmluZygyNCk7XG4gICAgfVxuICB9XG5cbiAgZXF1YWxzKG90aGVyKSB7XG4gICAgcmV0dXJuIG90aGVyIGluc3RhbmNlb2YgTW9uZ29JRC5PYmplY3RJRCAmJlxuICAgIHRoaXMudmFsdWVPZigpID09PSBvdGhlci52YWx1ZU9mKCk7XG4gIH1cblxuICB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gYE9iamVjdElEKFwiJHt0aGlzLl9zdHJ9XCIpYDtcbiAgfVxuXG4gIGNsb25lKCkge1xuICAgIHJldHVybiBuZXcgTW9uZ29JRC5PYmplY3RJRCh0aGlzLl9zdHIpO1xuICB9XG5cbiAgdHlwZU5hbWUoKSB7XG4gICAgcmV0dXJuICdvaWQnO1xuICB9XG5cbiAgZ2V0VGltZXN0YW1wKCkge1xuICAgIHJldHVybiBOdW1iZXIucGFyc2VJbnQodGhpcy5fc3RyLnN1YnN0cigwLCA4KSwgMTYpO1xuICB9XG5cbiAgdmFsdWVPZigpIHtcbiAgICByZXR1cm4gdGhpcy5fc3RyO1xuICB9XG5cbiAgdG9KU09OVmFsdWUoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVPZigpO1xuICB9XG5cbiAgdG9IZXhTdHJpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVPZigpO1xuICB9XG5cbn1cblxuRUpTT04uYWRkVHlwZSgnb2lkJywgc3RyID0+IG5ldyBNb25nb0lELk9iamVjdElEKHN0cikpO1xuXG5Nb25nb0lELmlkU3RyaW5naWZ5ID0gKGlkKSA9PiB7XG4gIGlmIChpZCBpbnN0YW5jZW9mIE1vbmdvSUQuT2JqZWN0SUQpIHtcbiAgICByZXR1cm4gaWQudmFsdWVPZigpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycpIHtcbiAgICB2YXIgZmlyc3RDaGFyID0gaWQuY2hhckF0KDApO1xuICAgIGlmIChpZCA9PT0gJycpIHtcbiAgICAgIHJldHVybiBpZDtcbiAgICB9IGVsc2UgaWYgKGZpcnN0Q2hhciA9PT0gJy0nIHx8IC8vIGVzY2FwZSBwcmV2aW91c2x5IGRhc2hlZCBzdHJpbmdzXG4gICAgICAgICAgICAgICBmaXJzdENoYXIgPT09ICd+JyB8fCAvLyBlc2NhcGUgZXNjYXBlZCBudW1iZXJzLCB0cnVlLCBmYWxzZVxuICAgICAgICAgICAgICAgTW9uZ29JRC5fbG9va3NMaWtlT2JqZWN0SUQoaWQpIHx8IC8vIGVzY2FwZSBvYmplY3QtaWQtZm9ybSBzdHJpbmdzXG4gICAgICAgICAgICAgICBmaXJzdENoYXIgPT09ICd7JykgeyAvLyBlc2NhcGUgb2JqZWN0LWZvcm0gc3RyaW5ncywgZm9yIG1heWJlIGltcGxlbWVudGluZyBsYXRlclxuICAgICAgcmV0dXJuIGAtJHtpZH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gaWQ7IC8vIG90aGVyIHN0cmluZ3MgZ28gdGhyb3VnaCB1bmNoYW5nZWQuXG4gICAgfVxuICB9IGVsc2UgaWYgKGlkID09PSB1bmRlZmluZWQpIHtcbiAgICByZXR1cm4gJy0nO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBpZCA9PT0gJ29iamVjdCcgJiYgaWQgIT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGVvciBkb2VzIG5vdCBjdXJyZW50bHkgc3VwcG9ydCBvYmplY3RzIG90aGVyIHRoYW4gT2JqZWN0SUQgYXMgaWRzJyk7XG4gIH0gZWxzZSB7IC8vIE51bWJlcnMsIHRydWUsIGZhbHNlLCBudWxsXG4gICAgcmV0dXJuIGB+JHtKU09OLnN0cmluZ2lmeShpZCl9YDtcbiAgfVxufTtcblxuTW9uZ29JRC5pZFBhcnNlID0gKGlkKSA9PiB7XG4gIHZhciBmaXJzdENoYXIgPSBpZC5jaGFyQXQoMCk7XG4gIGlmIChpZCA9PT0gJycpIHtcbiAgICByZXR1cm4gaWQ7XG4gIH0gZWxzZSBpZiAoaWQgPT09ICctJykge1xuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH0gZWxzZSBpZiAoZmlyc3RDaGFyID09PSAnLScpIHtcbiAgICByZXR1cm4gaWQuc3Vic3RyKDEpO1xuICB9IGVsc2UgaWYgKGZpcnN0Q2hhciA9PT0gJ34nKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoaWQuc3Vic3RyKDEpKTtcbiAgfSBlbHNlIGlmIChNb25nb0lELl9sb29rc0xpa2VPYmplY3RJRChpZCkpIHtcbiAgICByZXR1cm4gbmV3IE1vbmdvSUQuT2JqZWN0SUQoaWQpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBpZDtcbiAgfVxufTtcblxuZXhwb3J0IHsgTW9uZ29JRCB9O1xuIl19
