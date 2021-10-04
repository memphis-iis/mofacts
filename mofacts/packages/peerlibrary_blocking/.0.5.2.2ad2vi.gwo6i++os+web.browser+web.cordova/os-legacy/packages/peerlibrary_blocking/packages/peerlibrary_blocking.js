(function () {

///////////////////////////////////////////////////////////////////////////////
//                                                                           //
// packages/peerlibrary:blocking/server.js                                   //
//                                                                           //
///////////////////////////////////////////////////////////////////////////////
                                                                             //
var Future = Npm.require('fibers/future');                                   // 1
                                                                             // 2
// Inside blocking context functions should not be throwing exceptions but   // 3
// call callback with first argument an error. Exceptions will not propagate // 4
// and will only be printed to the console.                                  // 5
blocking = function (obj, fun) {                                             // 6
  if (!fun) {                                                                // 7
    fun = obj;                                                               // 8
    obj = undefined;                                                         // 9
  }                                                                          // 10
  var f = function () {                                                      // 11
    if (_.isUndefined(obj)) {                                                // 12
      obj = this;                                                            // 13
    }                                                                        // 14
    var args = _.toArray(arguments);                                         // 15
    var future = new Future();                                               // 16
    fun.apply(obj, args.concat(future.resolver()));                          // 17
    return future.wait();                                                    // 18
  };                                                                         // 19
  f._blocking = true;                                                        // 20
  return f;                                                                  // 21
};                                                                           // 22
                                                                             // 23
///////////////////////////////////////////////////////////////////////////////

}).call(this);
