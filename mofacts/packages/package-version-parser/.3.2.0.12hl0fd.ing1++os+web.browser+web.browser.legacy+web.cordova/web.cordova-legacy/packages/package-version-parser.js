(function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/package-version-parser/package-version-parser.js                                                 //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
var inTool = typeof Package === "undefined";

// Provided by dev_bundle/server-lib/node_modules/semver.
var semver = inTool
  ? module.parent.require("semver")
  : require("semver");

// Takes in a meteor version string, for example 1.2.3-rc.5_1+12345.
//
// Returns an object composed of the following:
//  * major (integer >= 0)
//  * minor (integer >= 0)
//  * patch (integer >= 0)
//  * prerelease (Array of Number-or-String, possibly empty)
//  * wrapNum (integer >= 0)
//  * build (Array of String, possibly empty)
//  * raw (String), the raw meteor version string
//  * version (String), canonical meteor version without build ID
//  * semver (String), canonical semver version with build ID but no wrap num
//
// The input string "1.2.3-rc.5_1+12345" has a (major, minor, patch) of
// (1, 2, 3), a prerelease of ["rc", 5], a wrapNum of 1, a build of
// ["12345"], a raw of "1.2.3-rc.5_1+12345", a version of
// "1.2.3-rc.5_1", and a semver of "1.2.3-rc.5+12345".
//
// Throws if the version string is invalid in any way.
//
// You can write `PV.parse("1.2.3")` as an alternative to `new PV("1.2.3")`
var PV = function (versionString) {
  if (! (typeof versionString === 'string')) {
    throw new Error("Invalid PackageVersion argument: " + versionString);
  }
  if (! versionString) {
    throwVersionParserError("Empty string is not a valid version");
  }

  // The buildID ("+foo" suffix) is part of semver, but split it off
  // because it comes after the wrapNum.  The wrapNum ("_123" suffix)
  // is a Meteor extension to semver.
  var plusSplit = versionString.split('+');
  var wrapSplit = plusSplit[0].split('_');
  var wrapNum = 0;

  if (plusSplit.length > 2) {
    throwVersionParserError("Can't have two + in version: " + versionString);
  }
  if (wrapSplit.length > 2) {
    throwVersionParserError("Can't have two _ in version: " + versionString);
  }
  if (wrapSplit.length > 1) {
    wrapNum = wrapSplit[1];
    if (! wrapNum) {
      throwVersionParserError("A wrap number must follow _");
    } else if (!/^\d+$/.test(wrapNum)) {
      throwVersionParserError(
        "The wrap number (after _) must contain only digits, so " +
          versionString + " is invalid.");
    } else if (wrapNum[0] === "0") {
      throwVersionParserError(
        "The wrap number (after _) must not have a leading zero, so " +
          versionString + " is invalid.");
    }
    wrapNum = parseInt(wrapNum, 10);
  }

  // semverPart is everything but the wrapNum, so for "1.0.0_2+xyz",
  // it is "1.0.0+xyz".
  var semverPart = wrapSplit[0];
  if (plusSplit.length > 1) {
    semverPart += "+" + plusSplit[1];
  }

  // NPM's semver spec supports things like 'v1.0.0' and considers them valid,
  // but we don't. Everything before the + or - should be of the x.x.x form.
  if (! /^\d+\.\d+\.\d+(\+|-|$)/.test(semverPart)) {
    throwVersionParserError(
      "Version string must look like semver (eg '1.2.3'), not '"
        + versionString + "'.");
  };

  var semverParse = semver.parse(semverPart);
  if (! semverParse) {
    throwVersionParserError(
      "Version string must look like semver (eg '1.2.3'), not '"
        + semverPart + "'.");
  }

  this.major = semverParse.major; // Number
  this.minor = semverParse.minor; // Number
  this.patch = semverParse.patch; // Number
  this.prerelease = semverParse.prerelease; // [OneOf(Number, String)]
  this.wrapNum = wrapNum; // Number
  this.build = semverParse.build; // [String]
  this.raw = versionString; // the entire version string
  // `.version` is everything but the build ID ("+foo"), and it
  // has been run through semver's canonicalization, ie "cleaned"
  // (for whatever that's worth)
  this.version = semverParse.version + (wrapNum ? '_' + wrapNum : '');
  // everything but the wrapnum ("_123")
  this.semver = semverParse.version + (
    semverParse.build.length ? '+' + semverParse.build.join('.') : '');

  this._semverParsed = null; // populate lazily
};

// Set module.exports for tools/packaging/package-version-parser.js and
// module.exports.PackageVersion for api.export("PackageVersion").
PV.PackageVersion = module.exports = PV;

PV.parse = function (versionString) {
  return new PV(versionString);
};

// Converts a meteor version into a large floating point number, which
// is (more or less [*]) unique to that version. Satisfies the
// following guarantee: If PV.lessThan(v1, v2) then
// PV.versionMagnitude(v1) < PV.versionMagnitude(v2) [*]
//
// [* XXX!] We don't quite satisfy the uniqueness and comparison properties in
// these cases:
// 1. If any of the version parts are greater than 100 (pretty unlikely?)
// 2. If we're dealing with a prerelease version, we only look at the
//    first two characters of each prerelease part. So, "1.0.0-beta" and
//    "1.0.0-bear" will have the same magnitude.
// 3. If we're dealing with a prerelease version with more than two parts, eg
//    "1.0.0-rc.0.1". In this comparison may fail since we'd get to the limit
//    of JavaScript floating point precision.
//
// If we wanted to fix this, we'd make this function return a BigFloat
// instead of a vanilla JavaScript number. That will make the
// constraint solver slower (by how much?), and would require some
// careful thought.
// (Or it could just return some sort of tuple, and ensure that
// the cost functions that consume this can deal with tuples...)
PV.versionMagnitude = function (versionString) {
  var v = PV.parse(versionString);

  return v.major * 100 * 100 +
    v.minor * 100 +
    v.patch +
    v.wrapNum / 100 +
    prereleaseIdentifierToFraction(v.prerelease) / 100 / 100;
};

// Accepts an array, eg ["rc", 2, 3]. Returns a number in the range
// (-1, 0].  An empty array returns 0. A non-empty string returns a
// number that is "as large" as the its precedence.
var prereleaseIdentifierToFraction = function (prerelease) {
  if (prerelease.length === 0)
    return 0;

  return prerelease.reduce(function (memo, part, index) {
    var digit;
    if (typeof part === 'number') {
      digit = part+1;
    } else if (typeof part === 'string') {
      var VALID_CHARACTERS =
            "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

      var validCharToNumber = function (ch) {
        var result = VALID_CHARACTERS.indexOf(ch);
        if (result === -1)
          throw new Error("Unexpected character in prerelease identifier: " + ch);
        else
          return result;
      };

      digit = 101 + // Numeric parts always have lower precedence than non-numeric parts.
        validCharToNumber(part[0]) * VALID_CHARACTERS.length +
        (part[1] ? validCharToNumber(part[1]) : 0);
    } else {
      throw new Error("Unexpected prerelease identifier part: " + part + " of type " + typeof part);
    }

    // 4100 > 101 + VALID_CHARACTERS.length *
    // VALID_CHARACTERS.length. And there's a test to verify this
    // ("test the edges of `versionMagnitude`")
    return memo + digit / Math.pow(4100, index+1);
  }, -1);
};

// Takes in two meteor versions. Returns true if the first one is less than the second.
// Versions are strings or PackageVersion objects.
PV.lessThan = function (versionOne, versionTwo) {
  return PV.compare(versionOne, versionTwo) < 0;
};

// Given a string version, returns its major version (the first section of the
// semver), as an integer. Two versions are compatible if they have the same
// version number.
//
// versionString: valid meteor version string.
PV.majorVersion = function (versionString) {
  return PV.parse(versionString).major;
};

// Takes in two meteor versions. Returns 0 if equal, a positive number if v1
// is greater, a negative number if v2 is greater.
// Versions are strings or PackageVersion objects.
PV.compare = function (versionOne, versionTwo) {
  var v1 = versionOne;
  if (typeof v1 === 'string') {
    v1 = PV.parse(v1);
  }
  var v2 = versionTwo;
  if (typeof v2 === 'string') {
    v2 = PV.parse(v2);
  }

  // If the semver parts are different, use the semver library to compare,
  // ignoring wrap numbers.  (The semver library will ignore the build ID
  // per the semver spec.)
  if (v1.semver !== v2.semver) {
    if (! v1._semverParsed) {
      v1._semverParsed = new semver(v1.semver);
    }
    if (! v2._semverParsed) {
      v2._semverParsed = new semver(v2.semver);
    }
    return semver.compare(v1._semverParsed, v2._semverParsed);
  } else {
    // If the semver components are equal, then the one with the smaller wrap
    // numbers is smaller.
    return v1.wrapNum - v2.wrapNum;
  }
};

// Conceptually we have four types of simple constraints:
//
// 1. "any-reasonable" - "A" - any version of A is allowed (other than
//    prerelease versions that contain dashes, unless a prerelease version
//    has been explicitly selected elsewhere).
//
// 2. "compatible-with" (major) - "A@x.y.z" - constrains package A to
//    version x.y.z or higher, and requires the major version of package A
//    to match x. This is the most common kind of version constraint.
//
// 3. "compatible-with" (minor) - "A@~x.y.z" - constrains package A to
//    version x.y.z or higher, and requires the major and minor versions
//    of package A to match x and y, respectively. This style is allowed
//    anywhere, but is used most often to constrain the minor versions of
//    Meteor core packages, according to the current Meteor release.
//
// 4. "exactly" - A@=x.y.z - constrains package A to version x.y.z and
//    nothing else.
//
// If a top-level constraint (e.g. in .meteor/packages) ends with a '!'
// character, any other constraints on that package will be weakened to
// accept any version of the package that is not less than the constraint,
// regardless of whether the major/minor versions match.
function parseSimpleConstraint(constraintString) {
  if (! constraintString) {
    throw new Error("Non-empty string required");
  }

  var result = {};
  var needToCheckValidity = true;

  if (constraintString.charAt(0) === '=') {
    result.type = "exactly";
    result.versionString = constraintString.slice(1);

  } else {
    result.type = "compatible-with";

    if (constraintString.charAt(0) === "~") {
      var semversion = PV.parse(
        result.versionString = constraintString.slice(1)
      ).semver;

      var range = new semver.Range("~" + semversion);

      result.test = function (version) {
        return range.test(PV.parse(version).semver);
      };

      // Already checked by calling PV.parse above.
      needToCheckValidity = false;

    } else {
      result.versionString = constraintString;
    }
  }

  if (needToCheckValidity) {
    // This will throw if the version string is invalid.
    PV.getValidServerVersion(result.versionString);
  }

  return result;
}

// Check to see if the versionString that we pass in is a valid meteor version.
//
// Returns a valid meteor version string that can be included in the
// server. That means that it has everything EXCEPT the build id. Throws if the
// entered string was invalid.
PV.getValidServerVersion = function (meteorVersionString) {
  return PV.parse(meteorVersionString).version;
};

PV.VersionConstraint = function (vConstraintString) {
  var alternatives;
  // If there is no version string ("" or null), then our only
  // constraint is any-reasonable.
  if (! vConstraintString) {
    // .versionString === null is relied on in the tool
    alternatives =
      [ { type: "any-reasonable", versionString: null } ];
    vConstraintString = "";
  } else {
    if (vConstraintString.endsWith("!")) {
      // If a top-level constraint (e.g. from .meteor/packages) ends with
      // a '!' character, any other constraints on that package will be
      // weakened to accept any version of the package that is not less
      // than the constraint, regardless of whether the major/minor
      // versions actually match. See packages/constraint-solver/solver.js
      // for implementation details.
      this.override = true;
      vConstraintString =
        vConstraintString.slice(0, vConstraintString.length - 1);
    }

    // Parse out the versionString.
    var parts = vConstraintString.split(/ *\|\| */);
    alternatives = parts.map(function (alt) {
      if (! alt) {
        throwVersionParserError("Invalid constraint string: " +
                                vConstraintString);
      }
      return parseSimpleConstraint(alt);
    });
  }

  this.raw = vConstraintString;
  this.alternatives = alternatives;
};

PV.parseVersionConstraint = function (constraintString) {
  return new PV.VersionConstraint(constraintString);
};

// A PackageConstraint consists of a package name and a version constraint.
// Call either with args (package, versionConstraintString) or
// (packageConstraintString), or (package, versionConstraint).
// That is, ("foo", "1.2.3") or ("foo@1.2.3"), or ("foo", vc) where vc
// is instanceof PV.VersionConstraint.
PV.PackageConstraint = function (part1, part2) {
  if ((typeof part1 !== "string") ||
      (part2 && (typeof part2 !== "string") &&
       ! (part2 instanceof PV.VersionConstraint))) {
    throw new Error("constraintString must be a string");
  }

  var packageName, versionConstraint, vConstraintString;
  if (part2) {
    packageName = part1;
    if (part2 instanceof PV.VersionConstraint) {
      versionConstraint = part2;
    } else {
      vConstraintString = part2;
    }
  } else if (part1.indexOf("@") >= 0) {
    // Shave off last part after @, with "a@b@c" becoming ["a@b", "c"].
    // Validating the package name will catch extra @.
    var parts = part1.match(/^(.*)@([^@]*)$/).slice(1);
    packageName = parts[0];
    vConstraintString = parts[1];
    if (! vConstraintString) {
      throwVersionParserError(
        "Version constraint for package '" + packageName +
          "' cannot be empty; leave off the @ if you don't want to constrain " +
          "the version.");
    }
  } else {
    packageName = part1;
    vConstraintString = "";
  }

  PV.validatePackageName(packageName);
  if (versionConstraint) {
    vConstraintString = versionConstraint.raw;
  } else {
    versionConstraint = PV.parseVersionConstraint(vConstraintString);
  }

  this.package = packageName;
  this.constraintString = vConstraintString;
  this.versionConstraint = versionConstraint;
};

PV.PackageConstraint.prototype.toString = function () {
  var ret = this.package;
  if (this.constraintString) {
    ret += "@" + this.constraintString;
  }
  return ret;
};

// Structure of a parsed constraint:
//
// /*PV.PackageConstraint*/
// { package: String,
//   constraintString: String,
//   versionConstraint: /*PV.VersionConstraint*/ {
//     raw: String,
//     alternatives: [{versionString: String|null,
//                     type: String}]}}
PV.parsePackageConstraint = function (part1, part2) {
  return new PV.PackageConstraint(part1, part2);
};

PV.validatePackageName = function (packageName, options) {
  options = options || {};

  var badChar = packageName.match(/[^a-z0-9:.\-]/);
  if (badChar) {
    if (options.detailedColonExplanation) {
      throwVersionParserError(
        "Bad character in package name: " + JSON.stringify(badChar[0]) +
          ".\n\nPackage names can only contain lowercase ASCII alphanumerics, " +
          "dash, or dot.\nIf you plan to publish a package, it must be " +
          "prefixed with your\nMeteor Developer Account username and a colon.");
    }
    throwVersionParserError(
      "Package names can only contain lowercase ASCII alphanumerics, dash, " +
        "dot, or colon, not " + JSON.stringify(badChar[0]) + ".");
  }
  if (!/[a-z]/.test(packageName)) {
    throwVersionParserError("Package name must contain a lowercase ASCII letter: "
                            + JSON.stringify(packageName));
  }
  if (packageName[0] === '.') {
    throwVersionParserError("Package name may not begin with a dot: "
                            + JSON.stringify(packageName));
  }
  if (packageName.slice(-1) === '.') {
    throwVersionParserError("Package name may not end with a dot: "
                            + JSON.stringify(packageName));
  }

  if (packageName.slice(-1) === '.') {
    throwVersionParserError("Package names may not end with a dot: " +
                            JSON.stringify(packageName));
  }
  if (packageName.indexOf('..') >= 0) {
    throwVersionParserError("Package names may not contain two consecutive dots: " +
                            JSON.stringify(packageName));
  }
  if (packageName[0] === '-') {
    throwVersionParserError("Package names may not begin with a hyphen: " +
                            JSON.stringify(packageName));
  }
  // (There is already a package ending with a `-` and one with two consecutive `-`
  // in troposphere, though they both look like typos.)

  if (packageName.startsWith(":") ||
      packageName.endsWith(":")) {
    throwVersionParserError("Package names may not start or end with a colon: " +
                            JSON.stringify(packageName));
  }
};

var throwVersionParserError = function (message) {
  var e = new Error(message);
  e.versionParserError = true;
  throw e;
};

// Return true if the version constraint was invalid prior to 0.9.3
// (adding _ and || support)
//
// NOTE: this is not used on the client yet. This package is used by the
// package server to determine what is valid.
PV.invalidFirstFormatConstraint = function (validConstraint) {
  if (!validConstraint) return false;
  // We can check this easily right now, because we introduced some new
  // characters. Anything with those characters is invalid prior to
  // 0.9.3. XXX: If we ever have to go through these, we should write a more
  // complicated regex.
  return (/_/.test(validConstraint) ||
          /\|/.test(validConstraint));
};

// Remove a suffix like "+foo" if present.
PV.removeBuildID = function (versionString) {
  return versionString.replace(/\+.*$/, '');
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                           //
// packages/package-version-parser/package-version-parser-tests.js                                           //
//                                                                                                           //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                             //
var currentTest = null;

Tinytest.add("package-version-parser - validatePackageName", function (test) {
  var badName = function (packageName, messageExpect) {
    test.throws(function () {
      try {
        PackageVersion.validatePackageName(packageName);
      } catch (e) {
        if (! e.versionParserError) {
          test.fail(e.message);
        }
        throw e;
      }
    }, messageExpect);
  };

  PackageVersion.validatePackageName('a');
  PackageVersion.validatePackageName('a-b');
  PackageVersion.validatePackageName('a.b');

  badName("$foo", /can only contain/);
  badName("", /must contain a lowercase/);
  badName("foo$bar", /can only contain/);
  badName("Foo", /can only contain/);
  badName("a b", /can only contain/);
  badName(".foo", /may not begin with a dot/);
  badName("foo.", /may not end with a dot/);
  badName("foo..bar", /not contain two consecutive dots/);
  badName("-x", /not begin with a hyphen/);
  badName("--x", /not begin with a hyphen/);
  badName("0.0", /must contain/);
  badName(":a", /start or end with a colon/);
  badName("a:", /start or end with a colon/);

  // these are ok
  PackageVersion.validatePackageName('x-');
  PackageVersion.validatePackageName('x--y');
  PackageVersion.validatePackageName('x--');
});

Tinytest.add("package-version-parser - parse", function (test) {
  test.isTrue(new PackageVersion("1.2.3") instanceof PackageVersion);

  var throws = function (v, re) {
    test.throws(function () {
      new PackageVersion(v);
    }, re);
  };
  var formatPV = function (pv) {
    pv = JSON.parse(JSON.stringify(pv));
    delete pv._semverParsed;
    return (JSON.stringify(pv)
            .replace(/,(?="prerelease"|"raw")/g, ',\n')
            .replace(/,/g, ', ')
            .replace(/"(\w+)":/g, '$1: ')
            .replace("{", "{\n")
            .replace("}", "\n}"));
  };
  var equal = function (pv1, pv2) {
    test.equal(formatPV(pv1), formatPV(pv2));
  };

  equal(new PackageVersion("1.2.3-rc.5_1+12345"), {
    major: 1, minor: 2, patch: 3,
    prerelease: ["rc", 5], wrapNum: 1, build: ["12345"],
    raw: "1.2.3-rc.5_1+12345", version: "1.2.3-rc.5_1",
    semver: "1.2.3-rc.5+12345"
  });

  equal(PackageVersion.parse("1.2.3-rc.5_1+12345"), {
    major: 1, minor: 2, patch: 3,
    prerelease: ["rc", 5], wrapNum: 1, build: ["12345"],
    raw: "1.2.3-rc.5_1+12345", version: "1.2.3-rc.5_1",
    semver: "1.2.3-rc.5+12345"
  });

  equal(new PackageVersion("1.2.3"), {
    major: 1, minor: 2, patch: 3,
    prerelease: [], wrapNum: 0, build: [],
    raw: "1.2.3", version: "1.2.3", semver: "1.2.3"
  });
  throws("1.2", /must look like semver/);
  throws("1", /must look like semver/);
  equal(new PackageVersion("1.0.0-rc.1"), {
    major: 1, minor: 0, patch: 0,
    prerelease: ["rc", 1], wrapNum: 0, build: [],
    raw: "1.0.0-rc.1", version: "1.0.0-rc.1", semver: "1.0.0-rc.1"
  });
  throws("1.0.0-.", /must look like semver/);
  throws("1.0.0-rc.", /must look like semver/);
  throws("1.0.0-01", /must look like semver/);
  equal(new PackageVersion("1.2.3-1-1"), {
    major: 1, minor: 2, patch: 3,
    prerelease: ["1-1"], wrapNum: 0, build: [],
    raw: "1.2.3-1-1", version: "1.2.3-1-1", semver: "1.2.3-1-1"
  });
  equal(new PackageVersion("1.2.3_4"), {
    major: 1, minor: 2, patch: 3,
    prerelease: [], wrapNum: 4, build: [],
    raw: "1.2.3_4", version: "1.2.3_4", semver: "1.2.3"
  });
  throws("1.2.3_4_5", /have two _/);
  throws("1.2.3_0", /must not have a leading zero/);
  throws("1.2.3_01", /must not have a leading zero/);
  throws("1.2.3_a", /must contain only digits/);
  // (prerelease must go *before* the wrap num)
  throws("1.2.3_a-rc.1", /must contain only digits/);
  equal(new PackageVersion("1.2.3-4_5"), {
    major: 1, minor: 2, patch: 3,
    prerelease: [4], wrapNum: 5, build: [],
    raw: "1.2.3-4_5", version: "1.2.3-4_5", semver: "1.2.3-4"
  });
  equal(new PackageVersion("1.2.3-rc.1_7+8.9-10.c"), {
    major: 1, minor: 2, patch: 3,
    prerelease: ["rc", 1], wrapNum: 7, build: ["8", "9-10", "c"],
    raw: "1.2.3-rc.1_7+8.9-10.c", version: "1.2.3-rc.1_7",
    semver: "1.2.3-rc.1+8.9-10.c"
  });
  throws("1.2.3+4+5", /have two \+/);
  equal(new PackageVersion("1.2.3+x"), {
    major: 1, minor: 2, patch: 3,
    prerelease: [], wrapNum: 0, build: ["x"],
    raw: "1.2.3+x", version: "1.2.3", semver: "1.2.3+x"
  });
  throws("1.2.3+x_1", /must look like semver/);
  equal(new PackageVersion("1.2.3_1+x"), {
    major: 1, minor: 2, patch: 3,
    prerelease: [], wrapNum: 1, build: ["x"],
    raw: "1.2.3_1+x", version: "1.2.3_1", semver: "1.2.3+x"
  });

  throws("v1.0.0", /must look like semver/);
});

Tinytest.add("package-version-parser - constraints - parsePackageConstraint", function (test) {
  test.isTrue(PackageVersion.parsePackageConstraint("foo") instanceof
              PackageVersion.PackageConstraint);

  test.equal(PackageVersion.parsePackageConstraint("foo@1.2.3"),
             { package: "foo", constraintString: "1.2.3",
               versionConstraint: {
                 raw: "1.2.3",
                 alternatives: [{type: "compatible-with",
                                 versionString: "1.2.3"}] } });

  test.equal(PackageVersion.parsePackageConstraint("foo"),
             { package: "foo", constraintString: "",
               versionConstraint: {
                 raw: "",
                 alternatives: [{type: "any-reasonable",
                                 versionString: null}] } });

  test.equal(PackageVersion.parsePackageConstraint("foo@1.0.0 || =2.0.0"),
             { package: "foo", constraintString: "1.0.0 || =2.0.0",
               versionConstraint: {
                 raw: "1.0.0 || =2.0.0",
                 alternatives: [{type: "compatible-with",
                                 versionString: "1.0.0"},
                                {type: "exactly",
                                 versionString: "2.0.0"}] } });

  test.equal(new PackageVersion.PackageConstraint("foo@1.0.0 || =2.0.0"),
             PackageVersion.parsePackageConstraint("foo@1.0.0 || =2.0.0"));

  test.equal(PackageVersion.parsePackageConstraint("foo", null),
             PackageVersion.parsePackageConstraint("foo"));

  test.equal(PackageVersion.parsePackageConstraint("foo", ""),
             PackageVersion.parsePackageConstraint("foo"));

  test.equal(PackageVersion.parsePackageConstraint("foo", "1.0.0"),
             PackageVersion.parsePackageConstraint("foo@1.0.0"));

  test.equal(PackageVersion.parsePackageConstraint("foo", "=1.0.0"),
             PackageVersion.parsePackageConstraint("foo@=1.0.0"));

  test.throws(function () {
    PackageVersion.parsePackageConstraint("", "1.0.0");
  });
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@1.0.0", "1.0.0");
  });
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@", "1.0.0");
  });
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@");
  }, /leave off the @/);
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@", "");
  });
  test.throws(function () {
    PackageVersion.parsePackageConstraint("a@b@c");
  });
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@||");
  }, /Invalid constraint string: \|\|/);
  test.throws(function () {
    PackageVersion.parsePackageConstraint("foo@=||=");
  }, /Empty string is not a valid version/);

  test.equal(new PackageVersion.PackageConstraint(
    "foo", new PackageVersion.VersionConstraint(null)),
             { package: "foo", constraintString: "",
               versionConstraint: {
                 raw: "",
                 alternatives: [{type: "any-reasonable",
                                 versionString: null}] } });

  test.equal(PackageVersion.parsePackageConstraint(
    "foo", PackageVersion.parseVersionConstraint("1.0.0 || =2.0.0")),
             { package: "foo", constraintString: "1.0.0 || =2.0.0",
               versionConstraint: {
                 raw: "1.0.0 || =2.0.0",
                 alternatives: [{type: "compatible-with",
                                 versionString: "1.0.0"},
                                {type: "exactly",
                                 versionString: "2.0.0"}] } });

  test.equal(PackageVersion.parseVersionConstraint(null),
             {raw: "", alternatives: [{type: "any-reasonable",
                                       versionString: null}]});
  test.equal(PackageVersion.parseVersionConstraint(""),
             {raw: "", alternatives: [{type: "any-reasonable",
                                       versionString: null}]});

  test.equal(PackageVersion.parsePackageConstraint("foo").toString(),
             "foo");
  test.equal(PackageVersion.parsePackageConstraint("foo", null).toString(),
             "foo");
  test.equal(PackageVersion.parsePackageConstraint("foo@1.0.0").toString(),
             "foo@1.0.0");
  test.equal(PackageVersion.parsePackageConstraint(
    "foo@=1.0.0 || 2.0.0").toString(), "foo@=1.0.0 || 2.0.0");
});

var t = function (pConstraintString, expected, descr) {
  var constraintString = pConstraintString.replace(/^.*?(@|$)/, '');
  var versionConstraint = {
    raw: constraintString,
    alternatives: expected.alternatives
  };
  currentTest.equal(
    PackageVersion.parsePackageConstraint(pConstraintString),
    {
      package: expected.package,
      constraintString: constraintString,
      versionConstraint: {
        raw: constraintString,
        alternatives: expected.alternatives
      }
    },
    descr);
};

var FAIL = function (versionString, errorExpect) {
  currentTest.throws(function () {
    PackageVersion.parsePackageConstraint(versionString);
  }, errorExpect);
};

Tinytest.add("package-version-parser - constraints - any-reasonable", function (test) {
  currentTest = test;

  t("foo", { package: "foo", alternatives: [{
        versionString: null, type: "any-reasonable" } ]});
  t("foo-1234", { package: "foo-1234", alternatives: [{
        versionString: null, type: "any-reasonable" } ]});
  FAIL("bad_name");
});

Tinytest.add("package-version-parser - constraints - compatible version, compatible-with", function (test) {
  currentTest = test;

  t("foo@1.2.3", { package: "foo", alternatives: [{
        versionString: "1.2.3", type: "compatible-with" } ]});
  t("foo-1233@1.2.3", { package: "foo-1233", alternatives: [{
        versionString: "1.2.3", type: "compatible-with" } ]});
  t("foo-bar@3.2.1", { package: "foo-bar", alternatives: [{
        versionString: "3.2.1", type: "compatible-with" } ]});
  FAIL("42@0.2.0");
  FAIL("foo@1.2.3.4");
  FAIL("foo@1.4");
  FAIL("foo@1");
  FAIL("foo@");
  FAIL("foo@@");
  FAIL("foo@x.y.z");
  FAIL("foo@<1.2");
  FAIL("foo<1.2");
  FAIL("foo@1.2.3_abc");
  FAIL("foo@1.2.3+1234_1");
  FAIL("foo@1.2.3_1-rc1");
  FAIL("foo-1233@1.2.3_0", /must not have a leading zero/);
  FAIL("foo-1233@1.2.3_a", /must contain only digits/);
  FAIL("foo-1233@1.2.3_", /wrap number must follow/);
  FAIL("foo-1233@1.2.3_0123");

  t("foo@1.2.3_1", { package: "foo", alternatives: [{
       versionString: "1.2.3_1", type: "compatible-with" } ]});
  t("foo-bar@3.2.1-rc0_123", { package: "foo-bar", alternatives: [{
       versionString: "3.2.1-rc0_123", type: "compatible-with" } ]});
  t("foo-1233@1.2.3_5+1234", { package: "foo-1233", alternatives: [{
       versionString: "1.2.3_5+1234", type: "compatible-with" } ]});
  t("foo", { package: "foo", alternatives: [{
       versionString: null, type: "any-reasonable" } ]});
});

Tinytest.add("package-version-parser - constraints - compatible version, exactly", function (test) {
  currentTest = test;

  t("foo@=1.2.3", { package: "foo", alternatives: [
         { versionString: "1.2.3", type: "exactly" } ]});
  t("foo-bar@=3.2.1", { package: "foo-bar", alternatives: [{
      versionString: "3.2.1", type: "exactly" } ]});
  t("foo@=1.2.3_1", { package: "foo", alternatives: [{
       versionString: "1.2.3_1", type: "exactly" } ]});
  t("foo-bar@=3.2.1_34", { package: "foo-bar", alternatives: [{
       versionString: "3.2.1_34", type: "exactly" } ]});

  FAIL("42@=0.2.0");
  FAIL("foo@=1.2.3.4");
  FAIL("foo@=1.4");
  FAIL("foo@=1");
  FAIL("foo@@=");
  FAIL("foo@=@");
  FAIL("foo@=x.y.z");
  FAIL("foo@=<1.2");
  FAIL("foo@<=1.2");
  FAIL("foo<=1.2");
  FAIL("foo@=1.2.3_rc0");

  // We no longer support @>=.
  FAIL("foo@>=1.2.3");
  FAIL("foo-bar@>=3.2.1");
  FAIL("42@>=0.2.0");
  FAIL("foo@>=1.2.3.4");
  FAIL("foo@>=1.4");
  FAIL("foo@>=1");
  FAIL("foo@@>=");
  FAIL("foo@>=@");
  FAIL("foo@>=x.y.z");
  FAIL("foo@=>12.3.11");
});


Tinytest.add("package-version-parser - constraints - or", function (test) {
  currentTest = test;

  t("foo@1.0.0 || 2.0.0 || 3.0.0 || =4.0.0-rc1",
    { package: "foo", alternatives:
      [{ versionString: "1.0.0", type: "compatible-with"},
       { versionString: "2.0.0", type: "compatible-with"},
       { versionString: "3.0.0", type: "compatible-with"},
       { versionString: "4.0.0-rc1", type: "exactly"}]
   });
  t("foo@1.0.0|| 2.0.0||3.0.0    ||     =4.0.0-rc1",
    { package: "foo", alternatives:
      [{ versionString: "1.0.0", type: "compatible-with"},
       { versionString: "2.0.0", type: "compatible-with"},
       { versionString: "3.0.0", type: "compatible-with"},
       { versionString: "4.0.0-rc1", type: "exactly"}]
   });
  t("foo-bar@=3.2.1 || 1.0.0",
    { package: "foo-bar", alternatives:
      [{ versionString: "3.2.1", type: "exactly"},
       { versionString: "1.0.0", type: "compatible-with"}]
   });
  t("foo@=1.2.3_1 || 1.2.4",
    { package: "foo", alternatives:
      [{ versionString: "1.2.3_1", type: "exactly"},
       { versionString: "1.2.4", type: "compatible-with"}]
   });
  t("foo-bar@=3.2.1_34 || =3.2.1-rc1",
    { package: "foo-bar", alternatives:
      [{ versionString: "3.2.1_34", type: "exactly"},
       { versionString: "3.2.1-rc1", type: "exactly"}]
    });

  FAIL("foo@1.0.0 1.0.0");
  FAIL("foo@1.0.0 | 1.0.0");
  FAIL("foo || bar");
  FAIL("foo@1.0.0-rc|1.0.0");

  // This is the current implementation, but is arguably not great.
  FAIL("foo@1.0.0 "); // trailing space
});

Tinytest.add(
  "package-version-parser - less than, compare, version magnitude",
  function (test) {
    var compare = function (v1, v2, expected) {
      if (expected === '<') {
        test.isTrue(PackageVersion.lessThan(v1, v2));
        test.isTrue(PackageVersion.versionMagnitude(v1) < PackageVersion.versionMagnitude(v2));
        test.isTrue(PackageVersion.compare(v1, v2) < 0);
      } else if (expected === '=') {
        test.isFalse(PackageVersion.lessThan(v1, v2));
        test.isFalse(PackageVersion.lessThan(v2, v1));
        test.isTrue(PackageVersion.versionMagnitude(v1) === PackageVersion.versionMagnitude(v2));
        test.isTrue(PackageVersion.compare(v1, v2) === 0);
      } else if (expected === '>') {
        test.isTrue(PackageVersion.lessThan(v2, v1));
        test.isTrue(PackageVersion.versionMagnitude(v1) > PackageVersion.versionMagnitude(v2));
        test.isTrue(PackageVersion.compare(v1, v2) > 0);
      } else {
        throw new Error("expected should be '<', '=' or '>'");
      }
    };

    compare("1.0.0", "1.2.0", "<");
    compare("1.0.0_50", "1.0.1", "<");
    compare("1.0.0_50", "1.2.0", "<");
    compare("1.0.0_1", "1.0.0_2", "<");
    compare("1.0.0_2", "1.0.0_10", "<"); // verify that we compare _N "wrap numbers" as numbers, not strings
    compare("1.0.0", "1.0.0_2", "<");
    compare("1.99.0_99", "3.0.0_2", "<");
    compare("1.99.0", "2.0.0", "<");
    compare("1.0.0_5", "1.0.0_2", ">");
    compare("1.0.0_99", "1.2.0", "<");
    compare("1.0.0_99", "1.0.1", "<");
    compare("1.0.0_1", "1.0.0_2", "<");
    compare("1.0.0", "1.0.0_2", "<");
    compare("1.99.0_99", "3.0.0_2", "<");

    compare("1.0.0_5", "1.0.0_2", ">");
    compare("1.0.0", "1.0.0", "=");
    compare("1.0.0_5", "1.0.0_5", "=");
    compare("1.2.0", "1.0.0", ">");
    compare("1.0.1", "1.0.0_5", ">");

    // Rule 11 from http://semver.org
    compare("0.99.99", "1.0.0-alpha.1", "<");
    compare("1.0.0-alpha", "1.0.0-alpha.1", "<");
    compare("1.0.0-alpha.1", "1.0.0-alpha.beta", "<");
    compare("1.0.0-alpha.beta", "1.0.0-beta", "<");
    compare("1.0.0-beta", "1.0.0-beta.2", "<");
    compare("1.0.0-beta.2", "1.0.0-beta.11", "<");
    compare("1.0.0-beta.11", "1.0.0-rc.1", "<");
    compare("1.0.0-rc.1", "1.0.0", "<");

    // dashes are allowed in prerelease parts
    compare("1.0.0--alpha", "1.0.0-alpha", "<");
    compare("1.0.0-a-lpha", "1.0.0-alpha", "<");
    // test single character prerelease parts
    compare("1.0.0-r.1", "1.0.0", "<");
    // test the edges of `versionMagnitude`
    compare("1.0.0-zzzzzzzzzzzz", "1.0.0", "<");
    // prerelease parts can contain digits and non-digits
    compare("1.0.0-r1", "1.0.0-rc", "<");

    // Our broken implementation of Rule 11 (see [*] above the
    // declaration of PackageVersion.versionMagnitude). Maybe one day
    // we'll fix it, in which case replace "===" with ">"
    test.isTrue(PackageVersion.versionMagnitude("1.0.0-beta.0") ===
                PackageVersion.versionMagnitude("1.0.0-bear.0"));

  });

Tinytest.add("package-version-parser - Invalid in 0.9.2", function (test) {
  // Note that invalidFirstFormatConstraint assumes that the initial version
  // passed in has been previously checked to be valid in 0.9.3.

  // These are invalid in 0.9.2, but valid in 0.9.3 and above.
  var invalidVersions =
    ["1.0.0_1", "1.0.0 || 2.0.0", "1.0.0-rc1_1",
     "3.4.0-rc1 || =1.0.0"];
  _.each(invalidVersions, function (v) {
    test.isTrue(PackageVersion.invalidFirstFormatConstraint(v));
  });

  // These are all valid in 0.9.2.
  var validVersions =
    ["1.0.0", "2.0.0-rc1", "=2.5.0"];
  _.each(validVersions, function (v) {
    test.isFalse(PackageVersion.invalidFirstFormatConstraint(v));
  });
});

Tinytest.add("package-version-parser - sort", function (test) {
  var versions = ["1.0.0", "1.0.0-rc.0", "1.0.10", "1.0.2"];
  versions.sort(PackageVersion.compare);
  test.equal(versions, ["1.0.0-rc.0", "1.0.0", "1.0.2", "1.0.10"]);
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);
