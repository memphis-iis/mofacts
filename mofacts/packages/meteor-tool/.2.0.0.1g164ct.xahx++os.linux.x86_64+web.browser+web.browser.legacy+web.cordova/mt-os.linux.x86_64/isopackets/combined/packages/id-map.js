(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var EJSON = Package.ejson.EJSON;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var IdMap;

var require = meteorInstall({"node_modules":{"meteor":{"id-map":{"id-map.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/id-map/id-map.js                                                                                    //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
module.export({
  IdMap: () => IdMap
});
const hasOwn = Object.prototype.hasOwnProperty;

class IdMap {
  constructor(idStringify, idParse) {
    this._map = new Map();
    this._idStringify = idStringify || JSON.stringify;
    this._idParse = idParse || JSON.parse;
  } // Some of these methods are designed to match methods on OrderedDict, since
  // (eg) ObserveMultiplex and _CachingChangeObserver use them interchangeably.
  // (Conceivably, this should be replaced with "UnorderedDict" with a specific
  // set of methods that overlap between the two.)


  get(id) {
    var key = this._idStringify(id);

    return this._map.get(key);
  }

  set(id, value) {
    var key = this._idStringify(id);

    this._map.set(key, value);
  }

  remove(id) {
    var key = this._idStringify(id);

    this._map.delete(key);
  }

  has(id) {
    var key = this._idStringify(id);

    return this._map.has(key);
  }

  empty() {
    return this._map.size === 0;
  }

  clear() {
    this._map.clear();
  } // Iterates over the items in the map. Return `false` to break the loop.


  forEach(iterator) {
    // don't use _.each, because we can't break out of it.
    for (const [key, value] of this._map) {
      var breakIfFalse = iterator.call(null, value, this._idParse(key));

      if (breakIfFalse === false) {
        return;
      }
    }
  }

  size() {
    return this._map.size;
  }

  setDefault(id, def) {
    var key = this._idStringify(id);

    if (this._map.has(key)) {
      return this._map.get(key);
    }

    this._map.set(key, def);

    return def;
  } // Assumes that values are EJSON-cloneable, and that we don't need to clone
  // IDs (ie, that nobody is going to mutate an ObjectId).


  clone() {
    var clone = new IdMap(this._idStringify, this._idParse); // copy directly to avoid stringify/parse overhead

    this._map.forEach(function (value, key) {
      clone._map.set(key, EJSON.clone(value));
    });

    return clone;
  }

}
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/id-map/id-map.js");

/* Exports */
Package._define("id-map", exports, {
  IdMap: IdMap
});

})();

//# sourceURL=meteor://💻app/packages/id-map.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaWQtbWFwL2lkLW1hcC5qcyJdLCJuYW1lcyI6WyJtb2R1bGUiLCJleHBvcnQiLCJJZE1hcCIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiY29uc3RydWN0b3IiLCJpZFN0cmluZ2lmeSIsImlkUGFyc2UiLCJfbWFwIiwiTWFwIiwiX2lkU3RyaW5naWZ5IiwiSlNPTiIsInN0cmluZ2lmeSIsIl9pZFBhcnNlIiwicGFyc2UiLCJnZXQiLCJpZCIsImtleSIsInNldCIsInZhbHVlIiwicmVtb3ZlIiwiZGVsZXRlIiwiaGFzIiwiZW1wdHkiLCJzaXplIiwiY2xlYXIiLCJmb3JFYWNoIiwiaXRlcmF0b3IiLCJicmVha0lmRmFsc2UiLCJjYWxsIiwic2V0RGVmYXVsdCIsImRlZiIsImNsb25lIiwiRUpTT04iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQUEsTUFBTSxDQUFDQyxNQUFQLENBQWM7QUFBQ0MsT0FBSyxFQUFDLE1BQUlBO0FBQVgsQ0FBZDtBQUFBLE1BQU1DLE1BQU0sR0FBR0MsTUFBTSxDQUFDQyxTQUFQLENBQWlCQyxjQUFoQzs7QUFFTyxNQUFNSixLQUFOLENBQVk7QUFDakJLLGFBQVcsQ0FBQ0MsV0FBRCxFQUFjQyxPQUFkLEVBQXVCO0FBQ2hDLFNBQUtDLElBQUwsR0FBWSxJQUFJQyxHQUFKLEVBQVo7QUFDQSxTQUFLQyxZQUFMLEdBQW9CSixXQUFXLElBQUlLLElBQUksQ0FBQ0MsU0FBeEM7QUFDQSxTQUFLQyxRQUFMLEdBQWdCTixPQUFPLElBQUlJLElBQUksQ0FBQ0csS0FBaEM7QUFDRCxHQUxnQixDQU9uQjtBQUNBO0FBQ0E7QUFDQTs7O0FBRUVDLEtBQUcsQ0FBQ0MsRUFBRCxFQUFLO0FBQ04sUUFBSUMsR0FBRyxHQUFHLEtBQUtQLFlBQUwsQ0FBa0JNLEVBQWxCLENBQVY7O0FBQ0EsV0FBTyxLQUFLUixJQUFMLENBQVVPLEdBQVYsQ0FBY0UsR0FBZCxDQUFQO0FBQ0Q7O0FBRURDLEtBQUcsQ0FBQ0YsRUFBRCxFQUFLRyxLQUFMLEVBQVk7QUFDYixRQUFJRixHQUFHLEdBQUcsS0FBS1AsWUFBTCxDQUFrQk0sRUFBbEIsQ0FBVjs7QUFDQSxTQUFLUixJQUFMLENBQVVVLEdBQVYsQ0FBY0QsR0FBZCxFQUFtQkUsS0FBbkI7QUFDRDs7QUFFREMsUUFBTSxDQUFDSixFQUFELEVBQUs7QUFDVCxRQUFJQyxHQUFHLEdBQUcsS0FBS1AsWUFBTCxDQUFrQk0sRUFBbEIsQ0FBVjs7QUFDQSxTQUFLUixJQUFMLENBQVVhLE1BQVYsQ0FBaUJKLEdBQWpCO0FBQ0Q7O0FBRURLLEtBQUcsQ0FBQ04sRUFBRCxFQUFLO0FBQ04sUUFBSUMsR0FBRyxHQUFHLEtBQUtQLFlBQUwsQ0FBa0JNLEVBQWxCLENBQVY7O0FBQ0EsV0FBTyxLQUFLUixJQUFMLENBQVVjLEdBQVYsQ0FBY0wsR0FBZCxDQUFQO0FBQ0Q7O0FBRURNLE9BQUssR0FBRztBQUNOLFdBQU8sS0FBS2YsSUFBTCxDQUFVZ0IsSUFBVixLQUFtQixDQUExQjtBQUNEOztBQUVEQyxPQUFLLEdBQUc7QUFDTixTQUFLakIsSUFBTCxDQUFVaUIsS0FBVjtBQUNELEdBdENnQixDQXdDakI7OztBQUNBQyxTQUFPLENBQUNDLFFBQUQsRUFBVztBQUNoQjtBQUNBLFNBQUssTUFBTSxDQUFDVixHQUFELEVBQU1FLEtBQU4sQ0FBWCxJQUEyQixLQUFLWCxJQUFoQyxFQUFxQztBQUNuQyxVQUFJb0IsWUFBWSxHQUFHRCxRQUFRLENBQUNFLElBQVQsQ0FDakIsSUFEaUIsRUFFakJWLEtBRmlCLEVBR2pCLEtBQUtOLFFBQUwsQ0FBY0ksR0FBZCxDQUhpQixDQUFuQjs7QUFLQSxVQUFJVyxZQUFZLEtBQUssS0FBckIsRUFBNEI7QUFDMUI7QUFDRDtBQUNGO0FBQ0Y7O0FBRURKLE1BQUksR0FBRztBQUNMLFdBQU8sS0FBS2hCLElBQUwsQ0FBVWdCLElBQWpCO0FBQ0Q7O0FBRURNLFlBQVUsQ0FBQ2QsRUFBRCxFQUFLZSxHQUFMLEVBQVU7QUFDbEIsUUFBSWQsR0FBRyxHQUFHLEtBQUtQLFlBQUwsQ0FBa0JNLEVBQWxCLENBQVY7O0FBQ0EsUUFBSSxLQUFLUixJQUFMLENBQVVjLEdBQVYsQ0FBY0wsR0FBZCxDQUFKLEVBQXdCO0FBQ3RCLGFBQU8sS0FBS1QsSUFBTCxDQUFVTyxHQUFWLENBQWNFLEdBQWQsQ0FBUDtBQUNEOztBQUNELFNBQUtULElBQUwsQ0FBVVUsR0FBVixDQUFjRCxHQUFkLEVBQW1CYyxHQUFuQjs7QUFDQSxXQUFPQSxHQUFQO0FBQ0QsR0FsRWdCLENBb0VqQjtBQUNBOzs7QUFDQUMsT0FBSyxHQUFHO0FBQ04sUUFBSUEsS0FBSyxHQUFHLElBQUloQyxLQUFKLENBQVUsS0FBS1UsWUFBZixFQUE2QixLQUFLRyxRQUFsQyxDQUFaLENBRE0sQ0FFTjs7QUFDQSxTQUFLTCxJQUFMLENBQVVrQixPQUFWLENBQWtCLFVBQVNQLEtBQVQsRUFBZ0JGLEdBQWhCLEVBQW9CO0FBQ3BDZSxXQUFLLENBQUN4QixJQUFOLENBQVdVLEdBQVgsQ0FBZUQsR0FBZixFQUFvQmdCLEtBQUssQ0FBQ0QsS0FBTixDQUFZYixLQUFaLENBQXBCO0FBQ0QsS0FGRDs7QUFHQSxXQUFPYSxLQUFQO0FBQ0Q7O0FBN0VnQixDIiwiZmlsZSI6Ii9wYWNrYWdlcy9pZC1tYXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJjb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5leHBvcnQgY2xhc3MgSWRNYXAge1xuICBjb25zdHJ1Y3RvcihpZFN0cmluZ2lmeSwgaWRQYXJzZSkge1xuICAgIHRoaXMuX21hcCA9IG5ldyBNYXAoKTtcbiAgICB0aGlzLl9pZFN0cmluZ2lmeSA9IGlkU3RyaW5naWZ5IHx8IEpTT04uc3RyaW5naWZ5O1xuICAgIHRoaXMuX2lkUGFyc2UgPSBpZFBhcnNlIHx8IEpTT04ucGFyc2U7XG4gIH1cblxuLy8gU29tZSBvZiB0aGVzZSBtZXRob2RzIGFyZSBkZXNpZ25lZCB0byBtYXRjaCBtZXRob2RzIG9uIE9yZGVyZWREaWN0LCBzaW5jZVxuLy8gKGVnKSBPYnNlcnZlTXVsdGlwbGV4IGFuZCBfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIHVzZSB0aGVtIGludGVyY2hhbmdlYWJseS5cbi8vIChDb25jZWl2YWJseSwgdGhpcyBzaG91bGQgYmUgcmVwbGFjZWQgd2l0aCBcIlVub3JkZXJlZERpY3RcIiB3aXRoIGEgc3BlY2lmaWNcbi8vIHNldCBvZiBtZXRob2RzIHRoYXQgb3ZlcmxhcCBiZXR3ZWVuIHRoZSB0d28uKVxuXG4gIGdldChpZCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9pZFN0cmluZ2lmeShpZCk7XG4gICAgcmV0dXJuIHRoaXMuX21hcC5nZXQoa2V5KTtcbiAgfVxuXG4gIHNldChpZCwgdmFsdWUpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX21hcC5zZXQoa2V5LCB2YWx1ZSk7XG4gIH1cblxuICByZW1vdmUoaWQpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIHRoaXMuX21hcC5kZWxldGUoa2V5KTtcbiAgfVxuXG4gIGhhcyhpZCkge1xuICAgIHZhciBrZXkgPSB0aGlzLl9pZFN0cmluZ2lmeShpZCk7XG4gICAgcmV0dXJuIHRoaXMuX21hcC5oYXMoa2V5KTtcbiAgfVxuXG4gIGVtcHR5KCkge1xuICAgIHJldHVybiB0aGlzLl9tYXAuc2l6ZSA9PT0gMDtcbiAgfVxuXG4gIGNsZWFyKCkge1xuICAgIHRoaXMuX21hcC5jbGVhcigpO1xuICB9XG5cbiAgLy8gSXRlcmF0ZXMgb3ZlciB0aGUgaXRlbXMgaW4gdGhlIG1hcC4gUmV0dXJuIGBmYWxzZWAgdG8gYnJlYWsgdGhlIGxvb3AuXG4gIGZvckVhY2goaXRlcmF0b3IpIHtcbiAgICAvLyBkb24ndCB1c2UgXy5lYWNoLCBiZWNhdXNlIHdlIGNhbid0IGJyZWFrIG91dCBvZiBpdC5cbiAgICBmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzLl9tYXApe1xuICAgICAgdmFyIGJyZWFrSWZGYWxzZSA9IGl0ZXJhdG9yLmNhbGwoXG4gICAgICAgIG51bGwsXG4gICAgICAgIHZhbHVlLFxuICAgICAgICB0aGlzLl9pZFBhcnNlKGtleSlcbiAgICAgICk7XG4gICAgICBpZiAoYnJlYWtJZkZhbHNlID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgc2l6ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fbWFwLnNpemU7XG4gIH1cblxuICBzZXREZWZhdWx0KGlkLCBkZWYpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5faWRTdHJpbmdpZnkoaWQpO1xuICAgIGlmICh0aGlzLl9tYXAuaGFzKGtleSkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9tYXAuZ2V0KGtleSk7XG4gICAgfVxuICAgIHRoaXMuX21hcC5zZXQoa2V5LCBkZWYpO1xuICAgIHJldHVybiBkZWY7XG4gIH1cblxuICAvLyBBc3N1bWVzIHRoYXQgdmFsdWVzIGFyZSBFSlNPTi1jbG9uZWFibGUsIGFuZCB0aGF0IHdlIGRvbid0IG5lZWQgdG8gY2xvbmVcbiAgLy8gSURzIChpZSwgdGhhdCBub2JvZHkgaXMgZ29pbmcgdG8gbXV0YXRlIGFuIE9iamVjdElkKS5cbiAgY2xvbmUoKSB7XG4gICAgdmFyIGNsb25lID0gbmV3IElkTWFwKHRoaXMuX2lkU3RyaW5naWZ5LCB0aGlzLl9pZFBhcnNlKTtcbiAgICAvLyBjb3B5IGRpcmVjdGx5IHRvIGF2b2lkIHN0cmluZ2lmeS9wYXJzZSBvdmVyaGVhZFxuICAgIHRoaXMuX21hcC5mb3JFYWNoKGZ1bmN0aW9uKHZhbHVlLCBrZXkpe1xuICAgICAgY2xvbmUuX21hcC5zZXQoa2V5LCBFSlNPTi5jbG9uZSh2YWx1ZSkpO1xuICAgIH0pO1xuICAgIHJldHVybiBjbG9uZTtcbiAgfVxufVxuIl19
