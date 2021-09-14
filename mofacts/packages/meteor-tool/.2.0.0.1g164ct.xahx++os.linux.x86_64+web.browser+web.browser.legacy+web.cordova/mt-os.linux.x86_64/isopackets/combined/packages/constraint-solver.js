(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var _ = Package.underscore._;
var check = Package.check.check;
var Match = Package.check.Match;
var PackageVersion = Package['package-version-parser'].PackageVersion;
var Logic = Package['logic-solver'].Logic;

/* Package-scope variables */
var ConstraintSolver, validatePackageName, splitArgs, railsGems, sinatraGems, SLOW_TEST_DATA, STACK_OVERFLOW_BUG_INPUT;

(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/datatypes.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
ConstraintSolver = {};

var PV = PackageVersion;
var CS = ConstraintSolver;

////////// PackageAndVersion

// An ordered pair of (package, version).
CS.PackageAndVersion = function (pkg, version) {
  check(pkg, String);
  check(version, String);

  this.package = pkg;
  this.version = version;
};

// The string form of a PackageAndVersion is "package version",
// for example "foo 1.0.1".  The reason we don't use an "@" is
// it would look too much like a PackageConstraint.
CS.PackageAndVersion.prototype.toString = function () {
  return this.package + " " + this.version;
};

CS.PackageAndVersion.fromString = function (str) {
  var parts = str.split(' ');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return new CS.PackageAndVersion(parts[0], parts[1]);
  } else {
    throw new Error("Malformed PackageAndVersion: " + str);
  }
};

////////// Dependency

// A Dependency consists of a PackageConstraint (like "foo@=1.2.3")
// and flags, like "isWeak".

CS.Dependency = function (packageConstraint, flags) {
  if (typeof packageConstraint !== 'string') {
    // this `if` is because Match.OneOf is really, really slow when it fails
    check(packageConstraint, Match.OneOf(PV.PackageConstraint, String));
  }
  if (typeof packageConstraint === 'string') {
    packageConstraint = PV.parsePackageConstraint(packageConstraint);
  }
  if (flags) {
    check(flags, Object);
  }

  this.packageConstraint = packageConstraint;
  this.isWeak = false;

  if (flags) {
    if (flags.isWeak) {
      this.isWeak = true;
    }
  }
};

// The string form of a Dependency is `?foo@1.0.0` for a weak
// reference to package "foo" with VersionConstraint "1.0.0".
CS.Dependency.prototype.toString = function () {
  var ret = this.packageConstraint.toString();
  if (this.isWeak) {
    ret = '?' + ret;
  }
  return ret;
};

CS.Dependency.fromString = function (str) {
  var isWeak = false;

  if (str.charAt(0) === '?') {
    isWeak = true;
    str = str.slice(1);
  }

  var flags = isWeak ? { isWeak: true } : null;

  return new CS.Dependency(str, flags);
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/catalog-cache.js                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var CS = ConstraintSolver;
var PV = PackageVersion;

var pvkey = function (pkg, version) {
  return pkg + " " + version;
};

// Stores the Dependencies for each known PackageAndVersion.
CS.CatalogCache = function () {
  // String(PackageAndVersion) -> String -> Dependency.
  // For example, "foo 1.0.0" -> "bar" -> Dependency.fromString("?bar@1.0.2").
  this._dependencies = {};
  // A map derived from the keys of _dependencies, for ease of iteration.
  // "foo" -> ["1.0.0", ...]
  // Versions in the array are unique but not sorted, unless the `.sorted`
  // property is set on the array.  The array is never empty.
  this._versions = {};
};

CS.CatalogCache.prototype.hasPackageVersion = function (pkg, version) {
  return _.has(this._dependencies, pvkey(pkg, version));
};

CS.CatalogCache.prototype.addPackageVersion = function (p, v, deps) {
  check(p, String);
  check(v, String);
  // `deps` must not have any duplicate values of `.packageConstraint.package`
  check(deps, [CS.Dependency]);

  var key = pvkey(p, v);
  if (_.has(this._dependencies, key)) {
    throw new Error("Already have an entry for " + key);
  }

  if (! _.has(this._versions, p)) {
    this._versions[p] = [];
  }
  this._versions[p].push(v);
  this._versions[p].sorted = false;

  var depsByPackage = {};
  this._dependencies[key] = depsByPackage;
  _.each(deps, function (d) {
    var p2 = d.packageConstraint.package;
    if (_.has(depsByPackage, p2)) {
      throw new Error("Can't have two dependencies on " + p2 +
                      " in " + key);
    }
    depsByPackage[p2] = d;
  });
};

// Returns the dependencies of a (package, version), stored in a map.
// The values are Dependency objects; the key for `d` is
// `d.packageConstraint.package`.  (Don't mutate the map.)
CS.CatalogCache.prototype.getDependencyMap = function (p, v) {
  var key = pvkey(p, v);
  if (! _.has(this._dependencies, key)) {
    throw new Error("No entry for " + key);
  }
  return this._dependencies[key];
};

// Returns an array of version strings, sorted, possibly empty.
// (Don't mutate the result.)
CS.CatalogCache.prototype.getPackageVersions = function (pkg) {
  var result = (_.has(this._versions, pkg) ?
                this._versions[pkg] : []);
  if ((!result.length) || result.sorted) {
    return result;
  } else {
    // sort in place, and record so that we don't sort redundantly
    // (we'll sort again if more versions are pushed onto the array)
    var pvParse = _.memoize(PV.parse);
    result.sort(function (a, b) {
      return PV.compare(pvParse(a), pvParse(b));
    });
    result.sorted = true;
    return result;
  }
};

CS.CatalogCache.prototype.hasPackage = function (pkg) {
  return _.has(this._versions, pkg);
};

CS.CatalogCache.prototype.toJSONable = function () {
  var self = this;
  var data = {};
  _.each(self._dependencies, function (depsByPackage, key) {
    // depsByPackage is a map of String -> Dependency.
    // Map over the values to get an array of String.
    data[key] = _.map(depsByPackage, function (dep) {
      return dep.toString();
    });
  });
  return { data: data };
};

CS.CatalogCache.fromJSONable = function (obj) {
  check(obj, { data: Object });

  var cache = new CS.CatalogCache();
  _.each(obj.data, function (depsArray, pv) {
    check(depsArray, [String]);
    pv = CS.PackageAndVersion.fromString(pv);
    cache.addPackageVersion(
      pv.package, pv.version,
      _.map(depsArray, function (str) {
        return CS.Dependency.fromString(str);
      }));
  });
  return cache;
};

// Calls `iter` on each PackageAndVersion, with the second argument being
// a map from package name to Dependency.  If `iter` returns true,
// iteration is stopped.  There's no particular order to the iteration.
CS.CatalogCache.prototype.eachPackageVersion = function (iter) {
  var self = this;
  _.find(self._dependencies, function (value, key) {
    var stop = iter(CS.PackageAndVersion.fromString(key), value);
    return stop;
  });
};

// Calls `iter` on each package name, with the second argument being
// a list of versions present for that package (unique and sorted).
// If `iter` returns true, iteration is stopped.
ConstraintSolver.CatalogCache.prototype.eachPackage = function (iter) {
  var self = this;
  _.find(_.keys(self._versions), function (key) {
    var stop = iter(key, self.getPackageVersions(key));
    return stop;
  });
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/catalog-loader.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var PV = PackageVersion;
var CS = ConstraintSolver;

// A CatalogLoader does the work of populating a CatalogCache from the
// Catalog.  When you run a unit test with canned Catalog data, there is
// a CatalogCache but no CatalogLoader.
//
// CatalogLoader acts as a minor cache layer between CatalogCache and
// the Catalog, because going to the Catalog generally means going to
// SQLite, i.e. disk, while caching a version in the CatalogCache means
// that it is available to the solver.  CatalogLoader's private cache
// allows it to over-read from the Catalog so that it can mediate
// between the granularity provided by the Catalog and the versions
// requested by the solver.
//
// We rely on the following `catalog` methods:
//
// * getSortedVersionRecords(packageName) ->
//     [{packageName, version, dependencies}]
//
//   Where `dependencies` is a map from packageName to
//   an object of the form `{ constraint: String|null,
//   references: [{arch: String, optional "weak": true}] }`.
//
// * getVersion(packageName, version) ->
//   {packageName, version, dependencies}

CS.CatalogLoader = function (fromCatalog, toCatalogCache) {
  var self = this;

  self.catalog = fromCatalog;
  self.catalogCache = toCatalogCache;

  self._sortedVersionRecordsCache = {};
};

var convertDeps = function (catalogDeps) {
  return _.map(catalogDeps, function (dep, pkg) {
    // The dependency is strong if any of its "references"
    // (for different architectures) are strong.
    var isStrong = _.any(dep.references, function (ref) {
      return !ref.weak;
    });

    var constraint = (dep.constraint || null);

    return new CS.Dependency(new PV.PackageConstraint(pkg, constraint),
                             isStrong ? null : {isWeak: true});
  });
};

// Since we don't fetch different versions of a package independently
// at the moment, this helper is where we get our data.
CS.CatalogLoader.prototype._getSortedVersionRecords = function (pkg) {
  if (! _.has(this._sortedVersionRecordsCache, pkg)) {
    this._sortedVersionRecordsCache[pkg] =
      this.catalog.getSortedVersionRecords(pkg);
  }

  return this._sortedVersionRecordsCache[pkg];
};

CS.CatalogLoader.prototype.loadSingleVersion = function (pkg, version) {
  var self = this;
  var cache = self.catalogCache;
  if (! cache.hasPackageVersion(pkg, version)) {
    var rec;
    if (_.has(self._sortedVersionRecordsCache, pkg)) {
      rec = _.find(self._sortedVersionRecordsCache[pkg],
                   function (r) {
                     return r.version === version;
                   });
    } else {
      rec = self.catalog.getVersion(pkg, version);
    }
    if (rec) {
      var deps = convertDeps(rec.dependencies);
      cache.addPackageVersion(pkg, version, deps);
    }
  }
};

CS.CatalogLoader.prototype.loadAllVersions = function (pkg) {
  var self = this;
  var cache = self.catalogCache;
  var versionRecs = self._getSortedVersionRecords(pkg);
  _.each(versionRecs, function (rec) {
    var version = rec.version;
    if (! cache.hasPackageVersion(pkg, version)) {
      var deps = convertDeps(rec.dependencies);
      cache.addPackageVersion(pkg, version, deps);
    }
  });
};

// Takes an array of package names.  Loads all versions of them and their
// (strong) dependencies.
CS.CatalogLoader.prototype.loadAllVersionsRecursive = function (packageList) {
  var self = this;

  // Within a call to loadAllVersionsRecursive, we only visit each package
  // at most once.  If we visit a package we've already loaded, it will
  // lead to a quick scan through the versions in our cache to make sure
  // they have been loaded into the CatalogCache.
  var loadQueue = [];
  var packagesEverEnqueued = {};

  var enqueue = function (pkg) {
    if (! _.has(packagesEverEnqueued, pkg)) {
      packagesEverEnqueued[pkg] = true;
      loadQueue.push(pkg);
    }
  };

  _.each(packageList, enqueue);

  while (loadQueue.length) {
    var pkg = loadQueue.pop();
    self.loadAllVersions(pkg);
    _.each(self.catalogCache.getPackageVersions(pkg), function (v) {
      var depMap = self.catalogCache.getDependencyMap(pkg, v);
      _.each(depMap, function (dep, package2) {
        enqueue(package2);
      });
    });
  }
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/constraint-solver-input.js                                                               //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var PV = PackageVersion;
var CS = ConstraintSolver;

// `check` can be really slow, so this line is a valve that makes it
// easy to turn off when debugging performance problems.
var _check = check;

// The "Input" object completely specifies the input to the resolver,
// and it holds the data loaded from the Catalog as well.  It can be
// serialized to JSON and read back in for testing purposes.
CS.Input = function (dependencies, constraints, catalogCache, options) {
  var self = this;
  options = options || {};

  // PackageConstraints passed in from the tool to us (where we are a
  // uniloaded package) will have constructors that we don't recognize
  // because they come from a different copy of package-version-parser!
  // Convert them to our PackageConstraint class if necessary.  (This is
  // just top-level constraints from .meteor/packages or running from
  // checkout, so it's not a lot of data.)
  constraints = _.map(constraints, function (c) {
    if (c instanceof PV.PackageConstraint) {
      return c;
    } else {
      return PV.parsePackageConstraint(c.package, c.constraintString);
    }
  });

  // Note that `dependencies` and `constraints` are required (you can't
  // omit them or pass null), while the other properties have defaults.
  self.dependencies = dependencies;
  self.constraints = constraints;
  // If you add a property, make sure you add it to:
  // - The `check` statements below
  // - toJSONable (this file)
  // - fromJSONable (this file)
  // - the "input serialization" test in constraint-solver-tests.js
  // If it's an option passed in from the tool, you'll also have to
  // add it to CS.PackagesResolver#resolve.
  self.upgrade = options.upgrade || [];
  self.anticipatedPrereleases = options.anticipatedPrereleases || {};
  self.previousSolution = options.previousSolution || null;
  self.allowIncompatibleUpdate = options.allowIncompatibleUpdate || false;
  self.upgradeIndirectDepPatchVersions =
    options.upgradeIndirectDepPatchVersions || false;

  _check(self.dependencies, [String]);
  _check(self.constraints, [PV.PackageConstraint]);
  _check(self.upgrade, [String]);
  _check(self.anticipatedPrereleases,
        Match.ObjectWithValues(Match.ObjectWithValues(Boolean)));
  _check(self.previousSolution, Match.OneOf(Object, null));
  _check(self.allowIncompatibleUpdate, Boolean);
  _check(self.upgradeIndirectDepPatchVersions, Boolean);

  self.catalogCache = catalogCache;
  _check(self.catalogCache, CS.CatalogCache);
  // The catalog presumably has valid package names in it, but make sure
  // there aren't any characters in there somehow that will trip us up
  // with creating valid variable strings.
  self.catalogCache.eachPackage(function (packageName) {
    validatePackageName(packageName);
  });
  self.catalogCache.eachPackageVersion(function (packageName, depsMap) {
    _.each(depsMap, function (deps, depPackageName) {
      validatePackageName(depPackageName);
    });
  });

  _.each(self.dependencies, validatePackageName);
  _.each(self.upgrade, validatePackageName);
  _.each(self.constraints, function (c) {
    validatePackageName(c.package);
  });
  if (self.previousSolution) {
    _.each(_.keys(self.previousSolution),
           validatePackageName);
  }

  self._dependencySet = {}; // package name -> true
  _.each(self.dependencies, function (d) {
    self._dependencySet[d] = true;
  });
  self._upgradeSet = {};
  _.each(self.upgrade, function (u) {
    self._upgradeSet[u] = true;
  });
};

validatePackageName = function (name) {
  PV.validatePackageName(name);
  // We have some hard requirements of our own so that packages can be
  // used as solver variables.  PV.validatePackageName should already
  // enforce these requirements and more, so these checks are just a
  // backstop in case it changes under us somehow.
  if ((name.charAt(0) === '$') || (name.charAt(0) === '-')) {
    throw new Error("First character of package name cannot be: " +
                    name.charAt(0));
  }
  if (/ /.test(name)) {
    throw new Error("No space allowed in package name");
  }
};

CS.Input.prototype.isKnownPackage = function (p) {
  return this.catalogCache.hasPackage(p);
};

CS.Input.prototype.isRootDependency = function (p) {
  return _.has(this._dependencySet, p);
};

CS.Input.prototype.isUpgrading = function (p) {
  return _.has(this._upgradeSet, p);
};

CS.Input.prototype.isInPreviousSolution = function (p) {
  return !! (this.previousSolution && _.has(this.previousSolution, p));
};

function getMentionedPackages(input) {
  var packages = {}; // package -> true

  _.each(input.dependencies, function (pkg) {
    packages[pkg] = true;
  });
  _.each(input.constraints, function (constraint) {
    packages[constraint.package] = true;
  });
  if (input.previousSolution) {
    _.each(input.previousSolution, function (version, pkg) {
      packages[pkg] = true;
    });
  }

  return _.keys(packages);
}

CS.Input.prototype.loadFromCatalog = function (catalogLoader) {
  // Load packages into the cache (if they aren't loaded already).
  catalogLoader.loadAllVersionsRecursive(getMentionedPackages(this));
};

CS.Input.prototype.loadOnlyPreviousSolution = function (catalogLoader) {
  var self = this;

  // load just the exact versions from the previousSolution
  if (self.previousSolution) {
    _.each(self.previousSolution, function (version, pkg) {
      catalogLoader.loadSingleVersion(pkg, version);
    });
  }
};

CS.Input.prototype.isEqual = function (otherInput) {
  var a = this;
  var b = otherInput;

  // It would be more efficient to compare the fields directly,
  // but converting to JSON is much easier to implement.
  // This equality test is also overly sensitive to order,
  // missing opportunities to declare two inputs equal when only
  // the order has changed.

  // Omit `catalogCache` -- it's not actually part of the serialized
  // input object (it's only in `toJSONable()` for tests).
  //
  // Moreover, catalogCache is populated as-needed so their values for
  // `a` and `b` will very likely be different even if they represent
  // the same input. So by omitting `catalogCache` we no longer need
  // to reload the entire relevant part of the catalog from SQLite on
  // every rebuild!
  return _.isEqual(
    a.toJSONable(true),
    b.toJSONable(true)
  );
};

CS.Input.prototype.toJSONable = function (omitCatalogCache) {
  var self = this;
  var obj = {
    dependencies: self.dependencies,
    constraints: _.map(self.constraints, function (c) {
      return c.toString();
    })
  };

  if (! omitCatalogCache) {
    obj.catalogCache = self.catalogCache.toJSONable();
  }

  // For readability of the resulting JSON, only include optional
  // properties that aren't the default.
  if (self.upgrade.length) {
    obj.upgrade = self.upgrade;
  }
  if (! _.isEmpty(self.anticipatedPrereleases)) {
    obj.anticipatedPrereleases = self.anticipatedPrereleases;
  }
  if (self.previousSolution !== null) {
    obj.previousSolution = self.previousSolution;
  }
  if (self.allowIncompatibleUpdate) {
    obj.allowIncompatibleUpdate = true;
  }
  if (self.upgradeIndirectDepPatchVersions) {
    obj.upgradeIndirectDepPatchVersions = true;
  }

  return obj;
};

CS.Input.fromJSONable = function (obj) {
  _check(obj, {
    dependencies: [String],
    constraints: [String],
    catalogCache: Object,
    anticipatedPrereleases: Match.Optional(
      Match.ObjectWithValues(Match.ObjectWithValues(Boolean))),
    previousSolution: Match.Optional(Match.OneOf(Object, null)),
    upgrade: Match.Optional([String]),
    allowIncompatibleUpdate: Match.Optional(Boolean),
    upgradeIndirectDepPatchVersions: Match.Optional(Boolean)
  });

  return new CS.Input(
    obj.dependencies,
    _.map(obj.constraints, function (cstr) {
      return PV.parsePackageConstraint(cstr);
    }),
    CS.CatalogCache.fromJSONable(obj.catalogCache),
    {
      upgrade: obj.upgrade,
      anticipatedPrereleases: obj.anticipatedPrereleases,
      previousSolution: obj.previousSolution,
      allowIncompatibleUpdate: obj.allowIncompatibleUpdate,
      upgradeIndirectDepPatchVersions: obj.upgradeIndirectDepPatchVersions
    });
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/version-pricer.js                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var CS = ConstraintSolver;
var PV = PackageVersion;

CS.VersionPricer = function () {
  var self = this;

  // self.getVersionInfo(versionString) returns an object
  // that contains at least { major, minor, patch }.
  //
  // The VersionPricer instance stores a memoization table for
  // efficiency.
  self.getVersionInfo = _.memoize(PV.parse);
};

CS.VersionPricer.MODE_UPDATE = 1;
CS.VersionPricer.MODE_GRAVITY = 2;
CS.VersionPricer.MODE_GRAVITY_WITH_PATCHES = 3;

// priceVersions(versions, mode, options) calculates small integer
// costs for each version, based on whether each part of the version
// is low or high relative to the other versions with the same higher
// parts.
//
// For example, if "1.2.0" and "1.2.1" are the only 1.2.x versions
// in the versions array, they will be assigned PATCH costs of
// 1 and 0 in UPDATE mode (penalizing the older version), or 0 and 1
// in GRAVITY mode (penalizing the newer version).  When optimizing,
// the solver will prioritizing minimizing MAJOR costs, then MINOR
// costs, then PATCH costs, and then "REST" costs (which penalizing
// being old or new within versions that have the same major, minor,
// AND patch).
//
// - `versions` - Array of version strings in sorted order
// - `mode` - A MODE constant
// - `options`:
//   - `versionAfter` - if provided, the next newer version not in the
//     array but that would come next.
//   - `versionBefore` - if provided, the next older version not in the
//     the array but that would come before it.
//
// Returns: an array of 4 arrays, each of length versions.length,
// containing the MAJOR, MINOR, PATCH, and REST costs corresponding
// to the versions.
//
// MODE_UPDATE penalizes versions for being old (because we want
// them to be new), while the MODE_GRAVITY penalizes versions for
// being new (because we are trying to apply "version gravity" and
// prefer older versions).  MODE_GRAVITY_WITH_PATCHES applies gravity
// to the major and minor parts of the version, but prefers updates
// to the patch and rest of the version.
//
// Use `versionAfter` when scanning a partial array of versions
// if you want the newest version in the array to have a non-zero
// weight in MODE_UPDATE.  For example, the versions
// `["1.0.0", "1.0.1"]` will be considered to have an out-of-date
// version if versionAfter is `"2.0.0"`.  The costs returned
// won't be the same as if the whole array was scanned at once,
// but this option is useful in order to apply MODE_UPDATE to some
// versions and MODE_GRAVITY to others, for example.
//
// `versionBefore` is used in an analogous way with the GRAVITY modes.
//
// The easiest way to implement this function would be to partition
// `versions` into subarrays of versions with the same major part,
// and then partition those arrays based on the minor parts, and
// so on.  However, that's a lot of array allocations -- O(N) or
// thereabouts.  So instead we use a linear scan backwards through
// the versions array.
CS.VersionPricer.prototype.priceVersions = function (versions, mode, options) {
  var self = this;

  var getMajorMinorPatch = function (v) {
    var vInfo = self.getVersionInfo(v);
    return [vInfo.major, vInfo.minor, vInfo.patch];
  };

  var MAJOR = 0, MINOR = 1, PATCH = 2, REST = 3;
  var gravity; // array of MAJOR, MINOR, PATCH, REST

  switch (mode) {
  case CS.VersionPricer.MODE_UPDATE:
    gravity = [false, false, false, false];
    break;
  case CS.VersionPricer.MODE_GRAVITY:
    gravity = [true, true, true, true];
    break;
  case CS.VersionPricer.MODE_GRAVITY_WITH_PATCHES:
    gravity = [true, true, false, false];
    break;
  default:
    throw new Error("Bad mode: " + mode);
  }

  var lastMajorMinorPatch = null;
  if (options && options.versionAfter) {
    lastMajorMinorPatch = getMajorMinorPatch(options.versionAfter);
  }
  // `costs` contains arrays of whole numbers, each of which will
  // have a length of versions.length.  This is what we will return.
  var costs = [[], [], [], []]; // MAJOR, MINOR, PATCH, REST
  // How many in a row of the same MAJOR, MINOR, or PATCH have we seen?
  var countOfSame = [0, 0, 0];

  // Track how old each part of versions[i] is, in terms of how many
  // greater values there are for that part among versions with the
  // same higher parts.  For example, oldness[REST] counts the number
  // of versions after versions[i] with the same MAJOR, MINOR, and REST.
  // oldness[PATCH] counts the number of *different* higher values for
  // for PATCH among later versions with the same MAJOR and MINOR parts.
  var oldness = [0, 0, 0, 0];

  // Walk the array backwards
  for (var i = versions.length - 1; i >= 0; i--) {
    var v = versions[i];
    var majorMinorPatch = getMajorMinorPatch(v);
    if (lastMajorMinorPatch) {
      for (var k = MAJOR; k <= REST; k++) {
        if (k === REST || majorMinorPatch[k] !== lastMajorMinorPatch[k]) {
          // For the highest part that changed, bumped the oldness
          // and clear the lower oldnesses.
          oldness[k]++;
          for (var m = k+1; m <= REST; m++) {
            if (gravity[m]) {
              // if we should actually be counting "newness" instead of
              // oldness, flip the count.  Instead of [0, 1, 1, 2, 3],
              // for example, make it [3, 2, 2, 1, 0].  This is the place
              // to do it, because we have just "closed out" a run.
              flipLastN(costs[m], countOfSame[m-1], oldness[m]);
            }
            countOfSame[m-1] = 0;
            oldness[m] = 0;
          }
          break;
        }
      }
    }
    for (var k = MAJOR; k <= REST; k++) {
      costs[k].push(oldness[k]);
      if (k !== REST) {
        countOfSame[k]++;
      }
    }
    lastMajorMinorPatch = majorMinorPatch;
  }
  if (options && options.versionBefore && versions.length) {
    // bump the appropriate value of oldness, as if we ran the loop
    // one more time
    majorMinorPatch = getMajorMinorPatch(options.versionBefore);
    for (var k = MAJOR; k <= REST; k++) {
      if (k === REST || majorMinorPatch[k] !== lastMajorMinorPatch[k]) {
        oldness[k]++;
        break;
      }
    }
  }

  // Flip the MAJOR costs if we have MAJOR gravity -- subtracting them
  // all from oldness[MAJOR] -- and likewise for other parts if countOfSame
  // is > 0 for the next highest part (meaning we didn't get a chance to
  // flip some of the costs because the loop ended).
  for (var k = MAJOR; k <= REST; k++) {
    if (gravity[k]) {
      flipLastN(costs[k], k === MAJOR ? costs[k].length : countOfSame[k-1],
                oldness[k]);
    }
  }

  // We pushed costs onto the arrays in reverse order.  Reverse the cost
  // arrays in place before returning them.
  return [costs[MAJOR].reverse(),
          costs[MINOR].reverse(),
          costs[PATCH].reverse(),
          costs[REST].reverse()];
};

// "Flip" the last N elements of array in place by subtracting each
// one from `max`.  For example, if `a` is `[3,0,1,1,2]`, then calling
// `flipLastN(a, 4, 2)` mutates `a` into `[3,2,1,1,0]`.
var flipLastN = function (array, N, max) {
  var len = array.length;
  for (var i = 0; i < N; i++) {
    var j = len - 1 - i;
    array[j] = max - array[j];
  }
};

// Partition a sorted array of versions into three arrays, containing
// the versions that are `older` than the `target` version,
// `compatible` with it, or have a `higherMajor` version.
//
// For example, `["1.0.0", "2.5.0", "2.6.1", "3.0.0"]` with a target of
// `"2.5.0"` returns `{ older: ["1.0.0"], compatible: ["2.5.0", "2.6.1"],
// higherMajor: ["3.0.0"] }`.
CS.VersionPricer.prototype.partitionVersions = function (versions, target) {
  var self = this;
  var firstGteIndex = versions.length;
  var higherMajorIndex = versions.length;
  var targetVInfo = self.getVersionInfo(target);
  for (var i = 0; i < versions.length; i++) {
    var v = versions[i];
    var vInfo = self.getVersionInfo(v);
    if (firstGteIndex === versions.length &&
        ! PV.lessThan(vInfo, targetVInfo)) {
      firstGteIndex = i;
    }
    if (vInfo.major > targetVInfo.major) {
      higherMajorIndex = i;
      break;
    }
  }
  return { older: versions.slice(0, firstGteIndex),
           compatible: versions.slice(firstGteIndex, higherMajorIndex),
           higherMajor: versions.slice(higherMajorIndex) };
};

// Use a combination of calls to priceVersions with different modes in order
// to generate costs for versions relative to a "previous solution" version
// (called the "target" here).
CS.VersionPricer.prototype.priceVersionsWithPrevious = function (
  versions, target, takePatches) {

  var self = this;
  var parts = self.partitionVersions(versions, target);

  var result1 = self.priceVersions(parts.older, CS.VersionPricer.MODE_UPDATE,
                                   { versionAfter: target });
  // Usually, it's better to remain as close as possible to the target
  // version, but prefer higher patch versions (and wrapNums, etc.) if
  // we were passed `takePatches`.
  var result2 = self.priceVersions(parts.compatible,
                                   (takePatches ?
                                    CS.VersionPricer.MODE_GRAVITY_WITH_PATCHES :
                                    CS.VersionPricer.MODE_GRAVITY));
  // If we're already bumping the major version, might as well take patches.
  var result3 = self.priceVersions(parts.higherMajor,
                                   CS.VersionPricer.MODE_GRAVITY_WITH_PATCHES,
                                   // not actually the version right before, but
                                   // gives the `major` cost the bump it needs
                                   { versionBefore: target });

  // Generate a fifth array, incompat, which has a 1 for each incompatible
  // version and a 0 for each compatible version.
  var incompat = [];
  var i;
  for (i = 0; i < parts.older.length; i++) {
    incompat.push(1);
  }
  for (i = 0; i < parts.compatible.length; i++) {
    incompat.push(0);
  }
  for (i = 0; i < parts.higherMajor.length; i++) {
    incompat.push(1);
  }

  return [
    incompat,
    result1[0].concat(result2[0], result3[0]),
    result1[1].concat(result2[1], result3[1]),
    result1[2].concat(result2[2], result3[2]),
    result1[3].concat(result2[3], result3[3])
  ];
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/solver.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var CS = ConstraintSolver;
var PV = PackageVersion;

var pvVar = function (p, v) {
  return p + ' ' + v;
};

// The "inner solver".  You construct it with a ConstraintSolver.Input object
// (which specifies the problem) and then call .getAnswer() on it.

CS.Solver = function (input, options) {
  var self = this;
  check(input, CS.Input);

  self.input = input;
  self.errors = []; // [String]

  self.pricer = new CS.VersionPricer();
  self.getConstraintFormula = _.memoize(_getConstraintFormula,
                                         function (p, vConstraint) {
                                           return p + "@" + vConstraint.raw;
                                         });

  self.options = options || {};
  self.Profile = (self.options.Profile || CS.DummyProfile);

  self.steps = [];
  self.stepsByName = {};

  self.analysis = {};

  self.Profile.time("Solver#analyze", function () {
    self.analyze();
  });

  self.logic = null; // Logic.Solver, initialized later
};

CS.Solver.prototype.throwAnyErrors = function () {
  if (this.errors.length) {
    var multiline = _.any(this.errors, function (e) {
      return /\n/.test(e);
    });
    CS.throwConstraintSolverError(this.errors.join(
      multiline ? '\n\n' : '\n'));
  }
};

CS.Solver.prototype.getVersions = function (pkg) {
  var self = this;
  if (_.has(self.analysis.allowedVersions, pkg)) {
    return self.analysis.allowedVersions[pkg];
  } else {
    return self.input.catalogCache.getPackageVersions(pkg);
  }
};

// Populates `self.analysis` with various data structures derived from the
// input.  May also throw errors, and may call methods that rely on
// analysis once that particular analysis is done (e.g. `self.getVersions`
// which relies on `self.analysis.allowedVersions`.
CS.Solver.prototype.analyze = function () {
  var self = this;
  var analysis = self.analysis;
  var input = self.input;
  var cache = input.catalogCache;
  var Profile = self.Profile;

  ////////// ANALYZE ALLOWED VERSIONS
  // (An "allowed version" is one that isn't ruled out by a top-level
  // constraint.)

  // package -> array of version strings.  If a package has an entry in
  // this map, then only the versions in the array are allowed for
  // consideration.
  analysis.allowedVersions = {};
  analysis.packagesWithNoAllowedVersions = {}; // package -> [constraints]

  // Process top-level constraints, applying them right now by
  // limiting what package versions we even consider.  This speeds up
  // solving, especially given the equality constraints on core
  // packages.  For versions we don't allow, we get to avoid generating
  // Constraint objects for their constraints, which saves us both
  // clause generation time and solver work up through the point where we
  // determine there are no conflicts between constraints.
  //
  // we can't throw any errors yet, because `input.constraints`
  // doesn't establish any dependencies (so we don't know if it's a
  // problem that some package has no legal versions), but we can
  // track such packages in packagesWithNoAllowedVersions so that we
  // throw a good error later.
  Profile.time("analyze allowed versions", function () {
    _.each(_.groupBy(input.constraints, 'package'), function (cs, p) {
      var versions = cache.getPackageVersions(p);
      if (! versions.length) {
        // deal with wholly unknown packages later
        return;
      }
      _.each(cs, function (constr) {
        versions = _.filter(versions, function (v) {
          return CS.isConstraintSatisfied(p, constr.versionConstraint, v);
        });
      });
      if (! versions.length) {
        analysis.packagesWithNoAllowedVersions[p] = _.filter(cs, function (c) {
          return !! c.constraintString;
        });
      }
      analysis.allowedVersions[p] = versions;
    });
  });

  ////////// ANALYZE ROOT DEPENDENCIES

  // Collect root dependencies that we've never heard of.
  analysis.unknownRootDeps = [];
  // Collect "previous solution" versions of root dependencies.
  analysis.previousRootDepVersions = [];

  Profile.time("analyze root dependencies", function () {
    _.each(input.dependencies, function (p) {
      if (! input.isKnownPackage(p)) {
        analysis.unknownRootDeps.push(p);
      } else if (input.isInPreviousSolution(p) &&
                 ! input.isUpgrading(p)) {
        analysis.previousRootDepVersions.push(new CS.PackageAndVersion(
          p, input.previousSolution[p]));
      }
    });

    // throw if there are unknown packages in root deps
    if (analysis.unknownRootDeps.length) {
      _.each(analysis.unknownRootDeps, function (p) {
        if (CS.isIsobuildFeaturePackage(p)) {
          self.errors.push(
            'unsupported Isobuild feature "' + p +
            '" in top-level dependencies; see ' +
            'https://docs.meteor.com/api/packagejs.html#isobuild-features ' +
            'for a list of features and the minimum Meteor release required'
          );
        } else {
          self.errors.push('unknown package in top-level dependencies: ' + p);
        }
      });
      self.throwAnyErrors();
    }
  });

  ////////// ANALYZE REACHABILITY

  // A "reachable" package is one that is either a root dependency or
  // a strong dependency of any "allowed" version of a reachable package.
  // In other words, we walk all strong dependencies starting
  // with the root dependencies, and visiting all allowed versions of each
  // package.
  //
  // This analysis is mainly done for performance, because if there are
  // extraneous packages in the CatalogCache (for whatever reason) we
  // want to spend as little time on them as possible.  It also establishes
  // the universe of possible "known" and "unknown" packages we might
  // come across.
  //
  // A more nuanced reachability analysis that takes versions into account
  // is probably possible.

  // package name -> true
  analysis.reachablePackages = {};
  // package name -> package versions asking for it (in pvVar form)
  analysis.unknownPackages = {};

  var markReachable = function (p) {
    analysis.reachablePackages[p] = true;

    _.each(self.getVersions(p), function (v) {
      _.each(cache.getDependencyMap(p, v), function (dep) {
        // `dep` is a CS.Dependency
        var p2 = dep.packageConstraint.package;
        if (! input.isKnownPackage(p2)) {
          // record this package so we will generate a variable
          // for it.  we'll try not to select it, and ultimately
          // throw an error if we are forced to.
          if (! _.has(analysis.unknownPackages, p2)) {
            analysis.unknownPackages[p2] = [];
          }
          analysis.unknownPackages[p2].push(pvVar(p, v));
        } else {
          if (! dep.isWeak) {
            if (! _.has(analysis.reachablePackages, p2)) {
              markReachable(p2);
            }
          }
        }
      });
    });
  };

  Profile.time("analyze reachability", function () {
    _.each(input.dependencies, markReachable);
  });

  ////////// ANALYZE CONSTRAINTS

  // Array of CS.Solver.Constraint
  analysis.constraints = [];
  // packages `foo` such that there's a simple top-level equality
  // constraint about `foo`.  package name -> true.
  analysis.topLevelEqualityConstrainedPackages = {};

  Profile.time("analyze constraints", function () {
    // Find package names with @x.y.z! overrides. We consider only
    // top-level constraints here, which includes (1) .meteor/packages,
    // (2) local package versions, and (3) Meteor release constraints.
    // Since (2) and (3) are generated programmatically without any
    // override syntax (in tools/project-context.js), the .meteor/packages
    // file is effectively the only place where override syntax has any
    // impact. This limitation is deliberate, since overriding package
    // version constraints is a power-tool that should be used sparingly
    // by application developers, and never abused by package authors.
    var overrides = new Set;
    _.each(input.constraints, function (c) {
      if (c.constraintString &&
          c.versionConstraint.override) {
        overrides.add(c.package);
      }
    });

    // Return c.versionConstraint unless it is overridden, in which case
    // make a copy of it and set vConstraint.weakMinimum = true.
    function getVersionConstraint(c) {
      var vConstraint = c.versionConstraint;

      // The meteor-tool version can never be weakened/overridden.
      if (c.package === "meteor-tool") {
        return vConstraint;
      }

      // Overrides cannot be weakened, so in theory they could conflict
      // with each other, though that's unlikely to be a problem within a
      // single .meteor/packages file.
      if (vConstraint.override) {
        return vConstraint;
      }

      if (overrides.has(c.package)) {
        // Make a defensive shallow copy of vConstraint with the same
        // prototype (that is, PV.VersionConstraint.prototype).
        vConstraint = Object.create(
          Object.getPrototypeOf(vConstraint),
          Object.getOwnPropertyDescriptors(vConstraint)
        );

        // This weakens the constraint so that it matches any version not
        // less than the constraint, regardless of whether the major or
        // minor versions are the same. See CS.isConstraintSatisfied in
        // constraint-solver.js for the implementation of this behavior.
        vConstraint.weakMinimum = true;
      }

      return vConstraint;
    }

    // top-level constraints
    _.each(input.constraints, function (c) {
      if (c.constraintString) {
        analysis.constraints.push(new CS.Solver.Constraint(
          null, c.package, getVersionConstraint(c),
          "constraint#" + analysis.constraints.length));

        if (c.versionConstraint.alternatives.length === 1 &&
            c.versionConstraint.alternatives[0].type === 'exactly') {
          analysis.topLevelEqualityConstrainedPackages[c.package] = true;
        }
      }
    });

    // constraints specified in package dependencies
    _.each(_.keys(analysis.reachablePackages), function (p) {
      _.each(self.getVersions(p), function (v) {
        var pv = pvVar(p, v);
        _.each(cache.getDependencyMap(p, v), function (dep) {
          // `dep` is a CS.Dependency
          var p2 = dep.packageConstraint.package;
          if (input.isKnownPackage(p2) &&
              dep.packageConstraint.constraintString) {
            analysis.constraints.push(new CS.Solver.Constraint(
              pv, p2, getVersionConstraint(dep.packageConstraint),
              "constraint#" + analysis.constraints.length));
          }
        });
      });
    });
  });

  ////////// ANALYZE PRE-RELEASES

  Profile.time("analyze pre-releases", function () {
    var unanticipatedPrereleases = [];
    _.each(_.keys(analysis.reachablePackages), function (p) {
      var anticipatedPrereleases = input.anticipatedPrereleases[p];
      _.each(self.getVersions(p), function (v) {
        if (/-/.test(v) && ! (anticipatedPrereleases &&
                              _.has(anticipatedPrereleases, v))) {
          unanticipatedPrereleases.push(pvVar(p, v));
        }
      });
    });
    analysis.unanticipatedPrereleases = unanticipatedPrereleases;
  });
};

var WholeNumber = Match.Where(Logic.isWholeNumber);

// A Step consists of a name, an array of terms, and an array of weights.
// Steps are optimized one by one.  Optimizing a Step means to find
// the minimum whole number value for the weighted sum of the terms,
// and then to enforce in the solver that the weighted sum be that number.
// Thus, when the Steps are optimized in sequence, earlier Steps take
// precedence and will stay minimized while later Steps are optimized.
//
// A term can be a package name, a package version, or any other variable
// name or Logic formula.
//
// A weight is a non-negative integer.  The weights array can be a single
// weight (which is used for all terms).
//
// The terms and weights arguments each default to [].  You can add terms
// with weights using addTerm.
//
// options is optional.
CS.Solver.Step = function (name, terms, weights) {
  check(name, String);
  terms = terms || [];
  check(terms, [String]);
  weights = (weights == null ? [] : weights);
  check(weights, Match.OneOf([WholeNumber], WholeNumber));

  this.name = name;

  // mutable:
  this.terms = terms;
  this.weights = weights;
  this.optimum = null; // set when optimized
};

// If weights is a single number, you can omit the weight argument.
// Adds a term.  If weight is 0, addTerm may skip it.
CS.Solver.Step.prototype.addTerm = function (term, weight) {
  if (weight == null) {
    if (typeof this.weights !== 'number') {
      throw new Error("Must specify a weight");
    }
    weight = this.weights;
  }
  check(weight, WholeNumber);
  if (weight !== 0) {
    this.terms.push(term);
    if (typeof this.weights === 'number') {
      if (weight !== this.weights) {
        throw new Error("Can't specify a different weight now: " +
                        weight + " != " + this.weights);
      }
    } else {
      this.weights.push(weight);
    }
  }
};

var DEBUG = false;

// Call as one of:
// * minimize(step, options)
// * minimize([step1, step2, ...], options)
// * minimize(stepName, costTerms, costWeights, options)
CS.Solver.prototype.minimize = function (step, options) {
  var self = this;

  if (_.isArray(step)) {
    // minimize([steps...], options)
    _.each(step, function (st) {
      self.minimize(st, options);
    });
    return;
  }

  if (typeof step === 'string') {
    // minimize(stepName, costTerms, costWeights, options)
    var stepName_ = arguments[0];
    var costTerms_ = arguments[1];
    var costWeights_ = arguments[2];
    var options_ = arguments[3];
    if (costWeights_ && typeof costWeights_ === 'object' &&
        ! _.isArray(costWeights_)) {
      options_ = costWeights_;
      costWeights_ = null;
    }
    var theStep = new CS.Solver.Step(
      stepName_, costTerms_, (costWeights_ == null ? 1 : costWeights_));
    self.minimize(theStep, options_);
    return;
  }

  // minimize(step, options);

  self.Profile.time("minimize " + step.name, function () {

    var logic = self.logic;

    self.steps.push(step);
    self.stepsByName[step.name] = step;

    if (DEBUG) {
      console.log("--- MINIMIZING " + step.name);
    }

    var costWeights = step.weights;
    var costTerms = step.terms;

    var optimized = groupMutuallyExclusiveTerms(costTerms, costWeights);

    self.setSolution(logic.minimizeWeightedSum(
      self.solution, optimized.costTerms, optimized.costWeights, {
        progress: function (status, cost) {
          if (self.options.nudge) {
            self.options.nudge();
          }
          if (DEBUG) {
            if (status === 'improving') {
              console.log(cost + " ... trying to improve ...");
            } else if (status === 'trying') {
              console.log("... trying " + cost + " ... ");
            }
          }
        },
        strategy: (options && options.strategy)
      }));

    step.optimum = self.solution.getWeightedSum(costTerms, costWeights);
    if (DEBUG) {
      console.log(step.optimum + " is optimal");

      if (step.optimum) {
        _.each(costTerms, function (t, i) {
          var w = (typeof costWeights === 'number' ? costWeights :
                   costWeights[i]);
          if (w && self.solution.evaluate(t)) {
            console.log("    " + w + ": " + t);
          }
        });
      }
    }
  });
};

// This is a correctness-preserving performance optimization.
//
// Cost functions often have many terms where both the package name
// and the weight are the same.  For example, when optimizing major
// version, we might have `(foo 3.0.0)*2 + (foo 3.0.1)*2 ...`.  It's
// more efficient to give the solver `((foo 3.0.0) OR (foo 3.0.1) OR
// ...)*2 + ...`, because it separates the question of whether to use
// ANY `foo 3.x.x` variable from the question of which one.  Other
// constraints already enforce the fact that `foo 3.0.0` and `foo 3.0.1`
// are mutually exclusive variables.  We can use that fact to "relax"
// that relationship for the purposes of the weighted sum.
//
// Note that shuffling up the order of terms unnecessarily seems to
// impact performance, so it's significant that we group by package
// first, then weight, rather than vice versa.
var groupMutuallyExclusiveTerms = function (costTerms, costWeights) {
  // Return a key for a term, such that terms with the same key are
  // guaranteed to be mutually exclusive.  We assume each term is
  // a variable representing either a package or a package version.
  // We take a prefix of the variable name up to and including the
  // first space.  So "foo 1.0.0" becomes "foo " and "foo" stays "foo".
  var getTermKey = function (t) {
    var firstSpace = t.indexOf(' ');
    return firstSpace < 0 ? t : t.slice(0, firstSpace+1);
  };

  // costWeights, as usual, may be a number or an array
  if (typeof costWeights === 'number') {
    return {
      costTerms: _.map(_.groupBy(costTerms, getTermKey), function (group) {
        return Logic.or(group);
      }),
      costWeights: costWeights
    };
  } else if (! costTerms.length) {
    return { costTerms: costTerms, costWeights: costWeights };
  } else {
    var weightedTerms = _.zip(costWeights, costTerms);
    var newWeightedTerms = _.map(_.groupBy(weightedTerms, function (wt) {
      // construct a string from the weight and term key, for grouping
      // purposes.  since the weight comes first, there's no ambiguity
      // and the separator char could be pretty much anything.
      return wt[0] + ' ' + getTermKey(wt[1]);
    }), function (wts) {
      return [wts[0][0], Logic.or(_.pluck(wts, 1))];
    });
    return {
      costTerms: _.pluck(newWeightedTerms, 1),
      costWeights: _.pluck(newWeightedTerms, 0)
    };
  }

};

// Determine the non-zero contributions to the cost function in `step`
// based on the current solution, returning a map from term (usually
// the name of a package or package version) to positive integer cost.
CS.Solver.prototype.getStepContributions = function (step) {
  var self = this;
  var solution = self.solution;
  var contributions = {};
  var weights = step.weights;
  _.each(step.terms, function (t, i) {
    var w = (typeof weights === 'number' ? weights : weights[i]);
    if (w && self.solution.evaluate(t)) {
      contributions[t] = w;
    }
  });
  return contributions;
};

var addCostsToSteps = function (pkg, versions, costs, steps) {
  var pvs = _.map(versions, function (v) {
    return pvVar(pkg, v);
  });
  for (var j = 0; j < steps.length; j++) {
    var step = steps[j];
    var costList = costs[j];
    if (costList.length !== versions.length) {
      throw new Error("Assertion failure: Bad lengths in addCostsToSteps");
    }
    for (var i = 0; i < versions.length; i++) {
      step.addTerm(pvs[i], costList[i]);
    }
  }
};

// Get an array of "Steps" that, when minimized in order, optimizes
// the package version costs of `packages` (an array of String package
// names) according to `pricerMode`, which may be
// `CS.VersionPricer.MODE_UPDATE` or a similar mode constant.
// Wraps `VersionPricer#priceVersions`, which is tasked with calculating
// the cost of every version of every package.  This function iterates
// over `packages` and puts the result into `Step` objects.
CS.Solver.prototype.getVersionCostSteps = function (stepBaseName, packages,
                                                    pricerMode) {
  var self = this;
  var major = new CS.Solver.Step(stepBaseName + '_major');
  var minor = new CS.Solver.Step(stepBaseName + '_minor');
  var patch = new CS.Solver.Step(stepBaseName + '_patch');
  var rest = new CS.Solver.Step(stepBaseName + '_rest');

  self.Profile.time(
    "calculate " + stepBaseName + " version costs",
    function () {
      _.each(packages, function (p) {
        var versions = self.getVersions(p);
        if (versions.length >= 2) {
          var costs = self.pricer.priceVersions(versions, pricerMode);
          addCostsToSteps(p, versions, costs, [major, minor, patch, rest]);
        }
      });
    });

  return [major, minor, patch, rest];
};

// Like `getVersionCostSteps`, but wraps
// `VersionPricer#priceVersionsWithPrevious` instead of `#priceVersions`.
// The cost function is "distance" from the previous versions passed in
// as `packageAndVersion`.  (Actually it's a complicated function of the
// previous and new version.)
CS.Solver.prototype.getVersionDistanceSteps = function (stepBaseName,
                                                        packageAndVersions,
                                                        takePatches) {
  var self = this;

  var incompat = new CS.Solver.Step(stepBaseName + '_incompat');
  var major = new CS.Solver.Step(stepBaseName + '_major');
  var minor = new CS.Solver.Step(stepBaseName + '_minor');
  var patch = new CS.Solver.Step(stepBaseName + '_patch');
  var rest = new CS.Solver.Step(stepBaseName + '_rest');

  self.Profile.time(
    "calculate " + stepBaseName + " distance costs",
    function () {
      _.each(packageAndVersions, function (pvArg) {
        var pkg = pvArg.package;
        var previousVersion = pvArg.version;
        var versions = self.getVersions(pkg);
        if (versions.length >= 2) {
          var costs = self.pricer.priceVersionsWithPrevious(
            versions, previousVersion, takePatches);
          addCostsToSteps(pkg, versions, costs,
                          [incompat, major, minor, patch, rest]);
        }
      });
    });

  return [incompat, major, minor, patch, rest];
};

CS.Solver.prototype.currentVersionMap = function () {
  var self = this;
  var pvs = [];
  _.each(self.solution.getTrueVars(), function (x) {
    if (x.indexOf(' ') >= 0) {
      // all variables with spaces in them are PackageAndVersions
      var pv = CS.PackageAndVersion.fromString(x);
      pvs.push(pv);
    }
  });

  var versionMap = {};
  _.each(pvs, function (pv) {
    if (_.has(versionMap, pv.package)) {
      throw new Error("Assertion failure: Selected two versions of " +
                      pv.package + ", " +versionMap[pv.package] +
                      " and " + pv.version);
    }
    versionMap[pv.package] = pv.version;
  });

  return versionMap;
};

// Called to re-assign `self.solution` after a call to `self.logic.solve()`,
// `solveAssuming`, or `minimize`.
CS.Solver.prototype.setSolution = function (solution) {
  var self = this;
  self.solution = solution;
  if (! self.solution) {
    throw new Error("Unexpected unsatisfiability");
  }
  // When we query a Solution, we always want to treat unknown variables
  // as "false".  Logic Solver normally throws an error if you ask it
  // to evaluate a formula containing a variable that isn't found in any
  // constraints, as a courtesy to help catch bugs, but we treat
  // variables as an open class of predicates ("foo" means package foo
  // is selected, for example), and we don't ensure that every package
  // or package version we might ask about is registered with the Solver.
  // For example, when we go to explain a conflict or generate an error
  // about an unknown package, we may ask about packages that were
  // forbidden in an early analysis of the problem and never entered
  // into the Solver.
  self.solution.ignoreUnknownVariables();
};

CS.Solver.prototype.getAnswer = function (options) {
  var self = this;
  return self.Profile.time("Solver#getAnswer", function () {
    return self._getAnswer(options);
  });
};

CS.Solver.prototype._getAnswer = function (options) {
  var self = this;
  var input = self.input;
  var analysis = self.analysis;
  var cache = input.catalogCache;
  var allAnswers = (options && options.allAnswers); // for tests
  var Profile = self.Profile;

  var logic;
  Profile.time("new Logic.Solver (MiniSat start-up)", function () {
    logic = self.logic = new Logic.Solver();
  });

  // require root dependencies
  Profile.time("require root dependencies", function () {
    _.each(input.dependencies, function (p) {
      logic.require(p);
    });
  });

  // generate package version variables for known, reachable packages
  Profile.time("generate package variables", function () {
    _.each(_.keys(analysis.reachablePackages), function (p) {
      if (! _.has(analysis.packagesWithNoAllowedVersions, p)) {
        var versionVars = _.map(self.getVersions(p),
                                function (v) {
                                  return pvVar(p, v);
                                });
        // At most one of ["foo 1.0.0", "foo 1.0.1", ...] is true.
        logic.require(Logic.atMostOne(versionVars));
        // The variable "foo" is true if and only if at least one of the
        // variables ["foo 1.0.0", "foo 1.0.1", ...] is true.
        logic.require(Logic.equiv(p, Logic.or(versionVars)));
      }
    });
  });

  // generate strong dependency requirements
  Profile.time("generate dependency requirements", function () {
    _.each(_.keys(analysis.reachablePackages), function (p) {
      _.each(self.getVersions(p), function (v) {
        _.each(cache.getDependencyMap(p, v), function (dep) {
          // `dep` is a CS.Dependency
          if (! dep.isWeak) {
            var p2 = dep.packageConstraint.package;
            logic.require(Logic.implies(pvVar(p, v), p2));
          }
        });
      });
    });
  });

  // generate constraints -- but technically don't enforce them, because
  // we haven't forced the conflictVars to be false
  Profile.time("generate constraints", function () {
    _.each(analysis.constraints, function (c) {
      // We logically require that EITHER a constraint is marked as a
      // conflict OR it comes from a package version that is not selected
      // OR its constraint formula must be true.
      // (The constraint formula says that if toPackage is selected,
      // then a version of it that satisfies our constraint must be true.)
      logic.require(
        Logic.or(c.conflictVar,
                 c.fromVar ? Logic.not(c.fromVar) : [],
                 self.getConstraintFormula(c.toPackage, c.vConstraint)));
    });
  });

  // Establish the invariant of self.solution being a valid solution.
  // From now on, if we add some new logical requirement to the solver
  // that isn't necessarily true of `self.solution`, we must
  // recalculate `self.solution` and pass the new value to
  // self.setSolution.  It is our job to obtain the new solution in a
  // way that ensures the solution exists and doesn't put the solver
  // in an unsatisfiable state.  There are several ways to do this:
  //
  // * Calling `logic.solve()` and immediately throwing a fatal error
  //   if there's no solution (not calling `setSolution` at all)
  // * Calling `logic.solve()` in a situation where we know we have
  //   not made the problem unsatisfiable
  // * Calling `logic.solveAssuming(...)` and checking the result, only
  //   using the solution if it exists
  // * Calling `minimize()`, which always maintains satisfiability

  Profile.time("pre-solve", function () {
    self.setSolution(logic.solve());
  });
  // There is always a solution at this point, namely,
  // select all packages (including unknown packages), select
  // any version of each known package (excluding packages with
  // "no allowed versions"), and set all conflictVars
  // to true.

  // Forbid packages with no versions allowed by top-level constraints,
  // which we didn't do earlier because we needed to establish an
  // initial solution before asking the solver if it's possible to
  // not use these packages.
  Profile.time("forbid packages with no matching versions", function () {
    _.each(analysis.packagesWithNoAllowedVersions, function (constrs, p) {
      var newSolution = logic.solveAssuming(Logic.not(p));
      if (newSolution) {
        self.setSolution(newSolution);
        logic.forbid(p);
      } else {
        var error =
          'No version of ' + p + ' satisfies all constraints: ' +
            _.map(constrs, function (constr) {
              return '@' + constr.constraintString;
            }).join(', ');
        error += '\n' + self.listConstraintsOnPackage(p);
        self.errors.push(error);
      }
    });
    self.throwAnyErrors();
  });

  // try not to use any unknown packages.  If the minimum is greater
  // than 0, we'll throw an error later, after we apply the constraints
  // and the cost function, so that we can explain the problem to the
  // user in a convincing way.
  self.minimize('unknown_packages', _.keys(analysis.unknownPackages));

  // try not to set the conflictVar on any constraint.  If the minimum
  // is greater than 0, we'll throw an error later, after we've run the
  // cost function, so we can show a better error.
  // If there are conflicts, this minimization can be time-consuming
  // (several seconds or more).  The strategy 'bottom-up' helps by
  // looking for solutions with few conflicts first.
  self.minimize('conflicts', _.pluck(analysis.constraints, 'conflictVar'),
                { strategy: 'bottom-up' });

  // Try not to use "unanticipated" prerelease versions
  self.minimize('unanticipated_prereleases',
                analysis.unanticipatedPrereleases);

  var previousRootSteps = self.getVersionDistanceSteps(
    'previous_root', analysis.previousRootDepVersions);
  // the "previous_root_incompat" step
  var previousRootIncompat = previousRootSteps[0];
  // the "previous_root_major", "previous_root_minor", etc. steps
  var previousRootVersionParts = previousRootSteps.slice(1);

  var toUpdate = _.filter(input.upgrade, function (p) {
    return analysis.reachablePackages[p] === true;
  });

  // make sure packages that are being updated can still count as
  // a previous_root for the purposes of previous_root_incompat
  Profile.time("add terms to previous_root_incompat", function () {
    _.each(toUpdate, function (p) {
      if (input.isRootDependency(p) && input.isInPreviousSolution(p)) {
        var parts = self.pricer.partitionVersions(
          self.getVersions(p), input.previousSolution[p]);
        _.each(parts.older.concat(parts.higherMajor), function (v) {
          previousRootIncompat.addTerm(pvVar(p, v), 1);
        });
      }
    });
  });

  if (! input.allowIncompatibleUpdate) {
    // Enforce that we don't make breaking changes to your root dependencies,
    // unless you pass --allow-incompatible-update.  It will actually be enforced
    // farther down, but for now, we want to apply this constraint before handling
    // updates.
    self.minimize(previousRootIncompat);
  }

  self.minimize(self.getVersionCostSteps(
    'update', toUpdate, CS.VersionPricer.MODE_UPDATE));

  if (input.allowIncompatibleUpdate) {
    // If you pass `--allow-incompatible-update`, we will still try to minimize
    // version changes to root deps that break compatibility, but with a lower
    // priority than taking as-new-as-possible versions for `meteor update`.
    self.minimize(previousRootIncompat);
  }

  self.minimize(previousRootVersionParts);

  var otherPrevious = _.filter(_.map(input.previousSolution, function (v, p) {
    return new CS.PackageAndVersion(p, v);
  }), function (pv) {
    var p = pv.package;
    return analysis.reachablePackages[p] === true &&
      ! input.isRootDependency(p);
  });

  self.minimize(self.getVersionDistanceSteps(
    'previous_indirect', otherPrevious,
    input.upgradeIndirectDepPatchVersions));

  var newRootDeps = _.filter(input.dependencies, function (p) {
    return ! input.isInPreviousSolution(p);
  });

  self.minimize(self.getVersionCostSteps(
    'new_root', newRootDeps, CS.VersionPricer.MODE_UPDATE));

  // Lock down versions of all root, previous, and updating packages that
  // are currently selected.  The reason to do this is to save the solver
  // a bunch of work (i.e. improve performance) by not asking it to
  // optimize the "unimportant" packages while also twiddling the versions
  // of the "important" packages, which would just multiply the search space.
  //
  // The important packages are root deps, packages in the previous solution,
  // and packages being upgraded.  At this point, we either have unique
  // versions for them, or else there is some kind of trade-off, like a
  // situation where raising the version of one package and lowering the
  // version of another produces the same cost -- a tie between two solutions.
  // If we have a tie, it probably won't be broken by the unimportant
  // packages, so we'll end up going with whatever we picked anyway.  (Note
  // that we have already taken the unimportant packages into account in that
  // we are only considering solutions where SOME versions can be chosen for
  // them.)  Even if optimizing the unimportant packages (coming up next)
  // was able to break a tie in the important packages, we care so little
  // about the versions of the unimportant packages that it's a very weak
  // signal.  In other words, the user might be better off with some tie-breaker
  // that looks only at the important packages anyway.
  Profile.time("lock down important versions", function () {
    _.each(self.currentVersionMap(), function (v, pkg) {
      if (input.isRootDependency(pkg) ||
          input.isInPreviousSolution(pkg) ||
          input.isUpgrading(pkg)) {
        logic.require(Logic.implies(pkg, pvVar(pkg, v)));
      }
    });
  });

  // new, indirect packages are the lowest priority
  var otherPackages = [];
  _.each(_.keys(analysis.reachablePackages), function (p) {
    if (! (input.isRootDependency(p) ||
           input.isInPreviousSolution(p) ||
           input.isUpgrading(p))) {
      otherPackages.push(p);
    }
  });

  self.minimize(self.getVersionCostSteps(
    'new_indirect', otherPackages,
    CS.VersionPricer.MODE_GRAVITY_WITH_PATCHES));

  self.minimize('total_packages', _.keys(analysis.reachablePackages));

  // throw errors about unknown packages
  if (self.stepsByName['unknown_packages'].optimum > 0) {
    Profile.time("generate error for unknown packages", function () {
      var unknownPackages = _.keys(analysis.unknownPackages);
      var unknownPackagesNeeded = _.filter(unknownPackages, function (p) {
        return self.solution.evaluate(p);
      });
      _.each(unknownPackagesNeeded, function (p) {
        var requirers = _.filter(analysis.unknownPackages[p], function (pv) {
          return self.solution.evaluate(pv);
        });
        var errorStr;
        if (CS.isIsobuildFeaturePackage(p)) {
          errorStr = 'unsupported Isobuild feature "' + p + '"; see ' +
            'https://docs.meteor.com/api/packagejs.html#isobuild-features ' +
            'for a list of features and the minimum Meteor release required';
        } else {
          errorStr = 'unknown package: ' + p;
        }
        _.each(requirers, function (pv) {
          errorStr += '\nRequired by: ' + pv;
        });
        self.errors.push(errorStr);
      });
    });
    self.throwAnyErrors();
  }

  // throw errors about conflicts
  if (self.stepsByName['conflicts'].optimum > 0) {
    self.throwConflicts();
  }

  if ((! input.allowIncompatibleUpdate) &&
      self.stepsByName['previous_root_incompat'].optimum > 0) {
    // we have some "incompatible root changes", where we needed to change a
    // version of a root dependency to a new version incompatible with the
    // original, but --allow-incompatible-update hasn't been passed in.
    // these are in the form of PackageAndVersion strings that we need.
    var incompatRootChanges = _.keys(self.getStepContributions(
      self.stepsByName['previous_root_incompat']));

    Profile.time("generate errors for incompatible root change", function () {
      var numActualErrors = 0;
      _.each(incompatRootChanges, function (pvStr) {
        var pv = CS.PackageAndVersion.fromString(pvStr);
        // exclude packages with top-level equality constraints (added by user
        // or by the tool pinning a version)
        if (! _.has(analysis.topLevelEqualityConstrainedPackages, pv.package)) {
          var prevVersion = input.previousSolution[pv.package];
          self.errors.push(
            'Potentially incompatible change required to ' +
              'top-level dependency: ' +
              pvStr + ', was ' + prevVersion + '.\n' +
              self.listConstraintsOnPackage(pv.package));
          numActualErrors++;
        }
      });
      if (numActualErrors) {
        self.errors.push(
          'To allow potentially incompatible changes to top-level ' +
            'dependencies, you must pass --allow-incompatible-update ' +
            'on the command line.');
      }
    });
    self.throwAnyErrors();
  }

  var result = {
    neededToUseUnanticipatedPrereleases: (
      self.stepsByName['unanticipated_prereleases'].optimum > 0),
    answer: Profile.time("generate version map", function () {
      return self.currentVersionMap();
    })
  };

  if (allAnswers) {
    Profile.time("generate all answers", function () {
      var allAnswersList = [result.answer];
      var nextAnswer = function () {
        var formula = self.solution.getFormula();
        var newSolution = logic.solveAssuming(Logic.not(formula));
        if (newSolution) {
          self.setSolution(newSolution);
          logic.forbid(formula);
        }
        return newSolution;
      };
      while (nextAnswer()) {
        allAnswersList.push(self.currentVersionMap());
      }
      result.allAnswers = allAnswersList;
    });
  };

  return result;
};

// Get a list of package-version variables that satisfy a given constraint.
var getOkVersions = function (toPackage, vConstraint, targetVersions) {
  return _.compact(_.map(targetVersions, function (v) {
    if (CS.isConstraintSatisfied(toPackage, vConstraint, v)) {
      return pvVar(toPackage, v);
    } else {
      return null;
    }
  }));
};

// The CS.Solver constructor turns this into a memoized method.
// Memoizing the Formula object reduces clause generation a lot.
var _getConstraintFormula = function (toPackage, vConstraint) {
  var self = this;

  var targetVersions = self.getVersions(toPackage);
  var okVersions = getOkVersions(toPackage, vConstraint, targetVersions);

  if (okVersions.length === targetVersions.length) {
    return Logic.TRUE;
  } else {
    return Logic.or(Logic.not(toPackage), okVersions);
  }
};

CS.Solver.prototype.listConstraintsOnPackage = function (pkg) {
  var self = this;
  var constraints = self.analysis.constraints;

  var result = 'Constraints on package "' + pkg + '":';

  _.each(constraints, function (c) {
    if (c.toPackage === pkg) {
      var paths;
      if (c.fromVar) {
        paths = self.getPathsToPackageVersion(
          CS.PackageAndVersion.fromString(c.fromVar));
      } else {
        paths = [['top level']];
      }
      _.each(paths, function (path) {
        result += '\n* ' + (new PV.PackageConstraint(
          pkg, c.vConstraint.raw)) + ' <- ' + path.join(' <- ');
      });
    }
  });

  return result;
};

CS.Solver.prototype.throwConflicts = function () {
  var self = this;

  var solution = self.solution;
  var constraints = self.analysis.constraints;

  self.Profile.time("generate error about conflicts", function () {
    _.each(constraints, function (c) {
      // c is a CS.Solver.Constraint
      if (solution.evaluate(c.conflictVar)) {
        // skipped this constraint
        var possibleVersions = self.getVersions(c.toPackage);
        var chosenVersion = _.find(possibleVersions, function (v) {
          return solution.evaluate(pvVar(c.toPackage, v));
        });
        if (! chosenVersion) {
          // this can't happen, because for a constraint to be a problem,
          // we must have chosen some version of the package it applies to!
          throw new Error("Internal error: Version not found");
        }
        var error = (
          'Conflict: Constraint ' + (new PV.PackageConstraint(
            c.toPackage, c.vConstraint)) +
            ' is not satisfied by ' + c.toPackage + ' ' + chosenVersion + '.');

        error += '\n' + self.listConstraintsOnPackage(c.toPackage);

        // Avoid printing exactly the same error twice.  eg, if we have two
        // different packages which have the same unsatisfiable constraint.
        if (self.errors.indexOf(error) === -1) {
          self.errors.push(error);
        }
      }
    });
  });

  // always throws, never returns
  self.throwAnyErrors();

  throw new Error("Internal error: conflicts could not be explained");
};

// Takes a PackageVersion and returns an array of arrays of PackageVersions.
// If the `packageVersion` is not selected in `self.solution`, returns
// an empty array.  Otherwise, returns an array of all paths from
// root dependencies to the package, in reverse order.  In other words,
// the first element of each path is `packageVersion`,
// and the last element is the selected version of a root dependency.
//
// Ok, it isn't all paths.  Because that would be crazy (combinatorial
// explosion).  It stops at root dependencies and tries to filter out
// ones that are definitely longer than another.
CS.Solver.prototype.getPathsToPackageVersion = function (packageAndVersion) {
  check(packageAndVersion, CS.PackageAndVersion);
  var self = this;
  var input = self.input;
  var cache = input.catalogCache;
  var solution = self.solution;

  var versionMap = self.currentVersionMap();
  var hasDep = function (p1, p2) {
    // Include weak dependencies, because their constraints matter.
    return _.has(cache.getDependencyMap(p1, versionMap[p1]), p2);
  };
  var allPackages = _.keys(versionMap);

  var getPaths = function (pv, _ignorePackageSet) {
    if (! solution.evaluate(pv.toString())) {
      return [];
    }
    var pkg = pv.package;

    if (input.isRootDependency(pkg)) {
      return [[pv]];
    }

    var newIgnorePackageSet = _.clone(_ignorePackageSet);
    newIgnorePackageSet[pkg] = true;

    var paths = [];
    var shortestLength = null;

    _.each(allPackages, function (p) {
      if ((! _.has(newIgnorePackageSet, p)) &&
          solution.evaluate(p) &&
          hasDep(p, pkg)) {
        var newPV = new CS.PackageAndVersion(p, versionMap[p]);
        _.each(getPaths(newPV, newIgnorePackageSet), function (path) {
          var newPath = [pv].concat(path);
          if ((! paths.length) || newPath.length < shortestLength) {
            paths.push(newPath);
            shortestLength = newPath.length;
          }
        });
      }
    });

    return paths;
  };

  return getPaths(packageAndVersion, {});
};


CS.Solver.Constraint = function (fromVar, toPackage, vConstraint, conflictVar) {
  this.fromVar = fromVar;
  this.toPackage = toPackage;
  this.vConstraint = vConstraint;
  this.conflictVar = conflictVar;

  // this.fromVar is a return value of pvVar(p, v), or null for a
  // top-level constraint
  check(this.fromVar, Match.OneOf(String, null));
  check(this.toPackage, String); // package name
  check(this.vConstraint, PV.VersionConstraint);
  check(this.conflictVar, String);
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/constraint-solver/constraint-solver.js                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var PV = PackageVersion;
var CS = ConstraintSolver;

// This is the entry point for the constraint-solver package.  The tool
// creates a ConstraintSolver.PackagesResolver and calls .resolve on it.

CS.PackagesResolver = function (catalog, options) {
  var self = this;

  self.catalog = catalog;
  self.catalogCache = new CS.CatalogCache();
  self.catalogLoader = new CS.CatalogLoader(self.catalog, self.catalogCache);

  self._options = {
    nudge: options && options.nudge,
    Profile: options && options.Profile,
    // For resultCache, pass in an empty object `{}`, and PackagesResolver
    // will put data on it.  Pass in the same object again to allow reusing
    // the result from the previous run.
    resultCache: options && options.resultCache
  };
};

// dependencies - an array of string names of packages (not slices)
// constraints - an array of PV.PackageConstraints
// options:
//  - upgrade - list of dependencies for which upgrade is prioritized higher
//    than keeping the old version
//  - previousSolution - mapping from package name to a version that was used in
//    the previous constraint solver run
//  - anticipatedPrereleases: mapping from package name to version to true;
//    included versions are the only pre-releases that are allowed to match
//    constraints that don't specifically name them during the "try not to
//    use unanticipated pre-releases" pass
//  - allowIncompatibleUpdate: allows choosing versions of
//    root dependencies that are incompatible with the previous solution,
//    if necessary to satisfy all constraints
//  - upgradeIndirectDepPatchVersions: also upgrade indirect dependencies
//    to newer patch versions, proactively
//  - missingPreviousVersionIsError - throw an error if a package version in
//    previousSolution is not found in the catalog
//  - supportedIsobuildFeaturePackages - map from package name to list of
//    version strings of isobuild feature packages that are available in the
//    catalog
CS.PackagesResolver.prototype.resolve = function (dependencies, constraints,
                                                  options) {
  var self = this;
  options = options || {};
  var Profile = (self._options.Profile || CS.DummyProfile);

  var input;
  Profile.time("new CS.Input", function () {
    input = new CS.Input(dependencies, constraints, self.catalogCache,
                         _.pick(options,
                                'upgrade',
                                'anticipatedPrereleases',
                                'previousSolution',
                                'allowIncompatibleUpdate',
                                'upgradeIndirectDepPatchVersions'));
  });

  // The constraint solver avoids re-solving everything from scratch on
  // rebuilds if the current input of top-level constraints matches the
  // previously solved input (also just top-level constraints). This is
  // slightly unsound, because non-top-level dependency constraints might
  // have changed, but it's important for performance, and relatively
  // harmless in practice (if there's a version conflict, you'll find out
  // about it the next time you do a full restart of the development
  // server). The unsoundness can cause problems for tests, however, so it
  // may be a good idea to set this environment variable to "true" to
  // disable the caching entirely.
  const disableCaching = !! JSON.parse(
    process.env.METEOR_DISABLE_CONSTRAINT_SOLVER_CACHING || "false"
  );

  let resultCache = self._options.resultCache;
  if (disableCaching) {
    resultCache = null;
  } else if (resultCache &&
             resultCache.lastInput &&
             _.isEqual(resultCache.lastInput,
                       input.toJSONable(true))) {
    return resultCache.lastOutput;
  }

  if (options.supportedIsobuildFeaturePackages) {
    _.each(options.supportedIsobuildFeaturePackages, function (versions, pkg) {
      _.each(versions, function (version) {
        input.catalogCache.addPackageVersion(pkg, version, []);
      });
    });
  }

  Profile.time(
    "Input#loadOnlyPreviousSolution",
    function () {
      input.loadOnlyPreviousSolution(self.catalogLoader);
    });

  if (options.previousSolution && options.missingPreviousVersionIsError) {
    // see comment where missingPreviousVersionIsError is passed in
    Profile.time("check for previous versions in catalog", function () {
      _.each(options.previousSolution, function (version, pkg) {
        if (! input.catalogCache.hasPackageVersion(pkg, version)) {
          CS.throwConstraintSolverError(
            "Package version not in catalog: " + pkg + " " + version);
        }
      });
    });
  }

  var resolveOptions = {
    nudge: self._options.nudge,
    Profile: self._options.Profile
  };

  var output = null;
  if (options.previousSolution && !input.upgrade && !input.upgradeIndirectDepPatchVersions) {
    // Try solving first with just the versions from previousSolution in
    // the catalogCache, so that we don't have to solve the big problem
    // if we don't have to. But don't do this if we're attempting to upgrade
    // packages, because that would always result in just using the current
    // version, hence disabling upgrades.
    try {
      output = CS.PackagesResolver._resolveWithInput(input, resolveOptions);
    } catch (e) {
      if (e.constraintSolverError) {
        output = null;
      } else {
        throw e;
      }
    }
  }

  if (! output) {
    // do a solve with all package versions available in the catalog.
    Profile.time(
      "Input#loadFromCatalog",
      function () {
        input.loadFromCatalog(self.catalogLoader);
      });

    // if we fail to find a solution this time, this will throw.
    output = CS.PackagesResolver._resolveWithInput(input, resolveOptions);
  }

  if (resultCache) {
    resultCache.lastInput = input.toJSONable(true);
    resultCache.lastOutput = output;
  }

  return output;
};

// Exposed for tests.
//
// Options (all optional):
// - nudge (function to be called when possible to "nudge" the progress spinner)
// - allAnswers (for testing, calculate all possible answers and put an extra
//   property named "allAnswers" on the result)
// - Profile (the profiler interface in `tools/profile.js`)
CS.PackagesResolver._resolveWithInput = function (input, options) {
  options = options || {};

  if (Meteor.isServer &&
      process.env['METEOR_PRINT_CONSTRAINT_SOLVER_INPUT']) {
    console.log("CONSTRAINT_SOLVER_INPUT = ");
    console.log(JSON.stringify(input.toJSONable(), null, 2));
  }

  var solver;
  (options.Profile || CS.DummyProfile).time("new CS.Solver", function () {
    solver = new CS.Solver(input, {
      nudge: options.nudge,
      Profile: options.Profile
    });
  });

  // Disable runtime type checks (they slow things down a bunch)
  return Logic.disablingAssertions(function () {
    var result = solver.getAnswer({
      allAnswers: options.allAnswers
    });
    // if we're here, no conflicts were found (or an error would have
    // been thrown)
    return result;
  });
};


// - package: String package name
// - vConstraint: a PackageVersion.VersionConstraint, or an object
//   with an `alternatives` property lifted from one.
// - version: version String
CS.isConstraintSatisfied = function (pkg, vConstraint, version) {
  return _.some(vConstraint.alternatives, function (simpleConstraint) {
    var type = simpleConstraint.type;

    if (type === "any-reasonable") {
      return true;
    }

    // If any top-level constraints use the @x.y.z! override syntax, all
    // other constraints on the same package will be marked with the
    // weakMinimum property, which means they constrain nothing other than
    // the minimum version of the package. Look for weakMinimum in the
    // CS.Solver#analyze method for related logic.
    if (vConstraint.weakMinimum) {
      return ! PV.lessThan(
        PV.parse(version),
        PV.parse(simpleConstraint.versionString)
      );
    }

    if (type === "exactly") {
      var cVersion = simpleConstraint.versionString;
      return (cVersion === version);
    }

    if (type === 'compatible-with') {
      if (typeof simpleConstraint.test === "function") {
        return simpleConstraint.test(version);
      }

      var cv = PV.parse(simpleConstraint.versionString);
      var v = PV.parse(version);

      // If the candidate version is less than the version named in the
      // constraint, we are not satisfied.
      if (PV.lessThan(v, cv)) {
        return false;
      }

      // To be compatible, the two versions must have the same major version
      // number.
      if (v.major !== cv.major) {
        return false;
      }

      return true;
    }

    throw Error("Unknown constraint type: " + type);
  });
};

CS.throwConstraintSolverError = function (message) {
  var e = new Error(message);
  e.constraintSolverError = true;
  throw e;
};

// This function is duplicated in tools/compiler.js.
CS.isIsobuildFeaturePackage = function (packageName) {
  return /^isobuild:/.test(packageName);
};


// Implements the Profile interface (as we use it) but doesn't do
// anything.
CS.DummyProfile = function (bucket, f) {
  return f;
};
CS.DummyProfile.time = function (bucket, f) {
  return f();
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
Package._define("constraint-solver", {
  ConstraintSolver: ConstraintSolver
});

})();
