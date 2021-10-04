module.export({
  dirtyNodeModulesDirectory: () => dirtyNodeModulesDirectory,
  optimisticStatOrNull: () => optimisticStatOrNull,
  optimisticLStat: () => optimisticLStat,
  optimisticLStatOrNull: () => optimisticLStatOrNull,
  optimisticReadFile: () => optimisticReadFile,
  optimisticReaddir: () => optimisticReaddir,
  optimisticHashOrNull: () => optimisticHashOrNull,
  optimisticReadJsonOrNull: () => optimisticReadJsonOrNull,
  optimisticReadMeteorIgnore: () => optimisticReadMeteorIgnore,
  optimisticLookupPackageJson: () => optimisticLookupPackageJson
});
let assert;
module.link("assert", {
  default(v) {
    assert = v;
  }

}, 0);
let wrap, dep;
module.link("optimism", {
  wrap(v) {
    wrap = v;
  },

  dep(v) {
    dep = v;
  }

}, 1);
let ignore;
module.link("ignore", {
  default(v) {
    ignore = v;
  }

}, 2);
let Profile;
module.link("../tool-env/profile", {
  Profile(v) {
    Profile = v;
  }

}, 3);
let watch;
module.link("./safe-watcher", {
  watch(v) {
    watch = v;
  }

}, 4);
let sha1;
module.link("./watch", {
  sha1(v) {
    sha1 = v;
  }

}, 5);
let pathSep, pathBasename, pathDirname, pathIsAbsolute, pathJoin, statOrNull, lstat, readFile, readdir, dependOnPath, findAppDir;
module.link("./files", {
  pathSep(v) {
    pathSep = v;
  },

  pathBasename(v) {
    pathBasename = v;
  },

  pathDirname(v) {
    pathDirname = v;
  },

  pathIsAbsolute(v) {
    pathIsAbsolute = v;
  },

  pathJoin(v) {
    pathJoin = v;
  },

  statOrNull(v) {
    statOrNull = v;
  },

  lstat(v) {
    lstat = v;
  },

  readFile(v) {
    readFile = v;
  },

  readdir(v) {
    readdir = v;
  },

  dependOnPath(v) {
    dependOnPath = v;
  },

  findAppDir(v) {
    findAppDir = v;
  }

}, 6);
// When in doubt, the optimistic caching system can be completely disabled
// by setting this environment variable.
const ENABLED = !process.env.METEOR_DISABLE_OPTIMISTIC_CACHING;

function makeOptimistic(name, fn) {
  fn = Profile("optimistic " + name, fn);
  const wrapper = wrap(ENABLED ? function () {
    maybeDependOnPath(arguments[0]);
    return fn.apply(this, arguments);
  } : fn, {
    makeCacheKey() {
      if (!ENABLED) {
        // Cache nothing when the optimistic caching system is disabled.
        return;
      }

      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      const path = args[0];

      if (!pathIsAbsolute(path)) {
        return;
      }

      if (!args.every(arg => typeof arg === "string")) {
        // If any of the arguments is not a string, then we won't cache the
        // result of the corresponding file.* method invocation.
        return;
      }

      return args.join("\0");
    },

    subscribe() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      const path = args[0];

      if (!shouldWatch(path)) {
        return;
      }

      assert.ok(pathIsAbsolute(path));
      let watcher = watch(path, () => {
        wrapper.dirty(...args);
      });
      return () => {
        if (watcher) {
          watcher.close();
          watcher = null;
        }
      };
    }

  });
  return wrapper;
} // The Meteor application directory should never change during the lifetime
// of the build process, so it should be safe to cache findAppDir without
// subscribing to file changes.


const optimisticFindAppDir = wrap(findAppDir);
const shouldWatch = wrap(Profile("shouldWatch", path => {
  const parts = path.split(pathSep);
  const nmi = parts.indexOf("node_modules");

  if (nmi < 0) {
    // Watch everything not in a node_modules directory.
    return true;
  }

  const dotMeteorIndex = parts.lastIndexOf(".meteor", nmi);

  if (dotMeteorIndex >= 0) {
    // Watch nothing inside of .meteor, at least for the purposes of the
    // optimistic caching system. Meteor watches files inside .meteor/local
    // via the WatchSet abstraction, unrelatedly.
    return false;
  }

  if (nmi < parts.length - 1) {
    const nmi2 = parts.indexOf("node_modules", nmi + 1);

    if (nmi2 > nmi) {
      // If this path is nested inside more than one node_modules
      // directory, then it isn't part of a linked npm package, so we
      // should not watch it.
      return false;
    }

    const parentDirParts = parts.slice(0, nmi);
    const parentDir = parentDirParts.join(pathSep);
    const appDir = optimisticFindAppDir(parentDir);

    if (appDir && parentDir.startsWith(appDir) && appDir.split(pathSep).length < parentDirParts.length) {
      // If the given path is contained by the Meteor application directory,
      // but the node_modules directory we're considering is not directly
      // contained by the root application directory, watch the file. See
      // discussion in issue https://github.com/meteor/meteor/issues/10664
      return true;
    }

    const packageDirParts = parts.slice(0, nmi + 2);

    if (parts[nmi + 1].startsWith("@")) {
      // For linked @scoped npm packages, the symlink is nested inside the
      // @scoped directory (which is a child of node_modules).
      packageDirParts.push(parts[nmi + 2]);
    }

    const packageDir = packageDirParts.join(pathSep);

    if (optimisticIsSymbolicLink(packageDir)) {
      // If this path is in a linked npm package, then it might be under
      // active development, so we should watch it.
      return true;
    }
  } // Starting a watcher for every single file contained within a
  // node_modules directory would be prohibitively expensive, so
  // instead we rely on dependOnNodeModules to tell us when files in
  // node_modules directories might have changed.


  return false;
}));

function maybeDependOnPath(path) {
  if (typeof path === "string") {
    dependOnPath(path);
    maybeDependOnNodeModules(path);
  }
}

function maybeDependOnNodeModules(path) {
  if (typeof path !== "string") {
    return;
  }

  const parts = path.split(pathSep);

  while (true) {
    const index = parts.lastIndexOf("node_modules");

    if (index < 0) {
      return;
    }

    parts.length = index + 1;
    dependOnNodeModules(parts.join(pathSep));
    assert.strictEqual(parts.pop(), "node_modules");
  }
}

const dependOnDirectory = dep({
  subscribe(dir) {
    let watcher = watch(dir, () => dependOnDirectory.dirty(dir));
    return function () {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    };
  }

}); // Called when an optimistic function detects the given file does not
// exist, but needs to return null or false rather than throwing an
// exception. When/if the file is eventually created, we might only get a
// file change notification for the parent directory, so it's important to
// depend on the parent directory using this function, so that we don't
// cache the unsuccessful result forever.

function dependOnParentDirectory(path) {
  const parentDir = pathDirname(path);

  if (parentDir !== path) {
    dependOnDirectory(parentDir);
  }
} // Called by any optimistic function that receives a */node_modules/* path
// as its first argument, so that we can later bulk-invalidate the results
// of those calls if the contents of the node_modules directory change.
// Note that this strategy will not detect changes within subdirectories
// of this node_modules directory, but that's ok because the use case we
// care about is adding or removing npm packages.


function dependOnNodeModules(nodeModulesDir) {
  assert(pathIsAbsolute(nodeModulesDir), nodeModulesDir);
  assert(nodeModulesDir.endsWith(pathSep + "node_modules"));
  dependOnDirectory(nodeModulesDir);
} // Invalidate all optimistic results derived from paths involving the
// given node_modules directory.


function dirtyNodeModulesDirectory(nodeModulesDir) {
  dependOnDirectory.dirty(nodeModulesDir);
}

function makeCheapPathFunction(pathFunction) {
  if (!ENABLED) {
    return pathFunction;
  }

  const wrapper = wrap(pathFunction, {
    // The maximum LRU cache size is Math.pow(2, 16) by default, but it's
    // important to prevent eviction churn for very-frequently-called
    // functions like optimisticStatOrNull. While it's tempting to set
    // this limit to Infinity, increasing it by 16x comes close enough.
    max: Math.pow(2, 20),

    subscribe(path) {
      let watcher = watch(path, () => wrapper.dirty(path));
      return function () {
        if (watcher) {
          watcher.close();
          watcher = null;
        }
      };
    }

  });
  return wrapper;
}

const optimisticStatOrNull = makeCheapPathFunction(path => {
  const result = statOrNull(path);

  if (result === null) {
    dependOnParentDirectory(path);
  }

  return result;
});
const optimisticLStat = makeOptimistic("lstat", lstat);
const optimisticLStatOrNull = makeCheapPathFunction(path => {
  try {
    return optimisticLStat(path);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    dependOnParentDirectory(path);
    return null;
  }
});
const optimisticReadFile = makeOptimistic("readFile", readFile);
const optimisticReaddir = makeOptimistic("readdir", readdir);
const optimisticHashOrNull = makeOptimistic("hashOrNull", (path, options) => {
  try {
    return sha1(optimisticReadFile(path, options));
  } catch (e) {
    if (e.code !== "EISDIR" && e.code !== "ENOENT") {
      throw e;
    }
  }

  dependOnParentDirectory(path);
  return null;
});
const riskyJsonWhitespacePattern = // Turns out a lot of weird characters technically count as /\s/ characters.
// This is all of them except for " ", "\n", and "\r", which are safe:
/[\t\b\f\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g;
const optimisticReadJsonOrNull = makeOptimistic("readJsonOrNull", (path, options) => {
  let contents;

  try {
    contents = optimisticReadFile(path, options);
  } catch (e) {
    if (e.code === "ENOENT") {
      dependOnParentDirectory(path);
      return null;
    }

    throw e;
  }

  try {
    return JSON.parse(contents);
  } catch (e) {
    if (e instanceof SyntaxError && options && options.allowSyntaxError) {
      return null;
    }

    const stringContents = contents.toString("utf8"); // Replace any risky whitespace characters with spaces, to address issue
    // https://github.com/meteor/meteor/issues/10688

    const cleanContents = stringContents.replace(riskyJsonWhitespacePattern, " ");

    if (cleanContents !== stringContents) {
      // Try one last time to parse cleanContents before throwing.
      return JSON.parse(cleanContents);
    }

    throw e;
  }
});
const optimisticReadMeteorIgnore = wrap(dir => {
  const meteorIgnorePath = pathJoin(dir, ".meteorignore");
  const meteorIgnoreStat = optimisticStatOrNull(meteorIgnorePath);

  if (meteorIgnoreStat && meteorIgnoreStat.isFile()) {
    return ignore().add(optimisticReadFile(meteorIgnorePath).toString("utf8"));
  }

  return null;
});
const optimisticLookupPackageJson = wrap((absRootDir, relDir) => {
  const absPkgJsonPath = pathJoin(absRootDir, relDir, "package.json");
  const pkgJson = optimisticReadJsonOrNull(absPkgJsonPath);

  if (pkgJson && typeof pkgJson.name === "string") {
    return pkgJson;
  }

  const relParentDir = pathDirname(relDir);

  if (relParentDir === relDir) {
    return null;
  } // Stop searching if an ancestor node_modules directory is encountered.


  if (pathBasename(relParentDir) === "node_modules") {
    return null;
  }

  return optimisticLookupPackageJson(absRootDir, relParentDir);
});
const optimisticIsSymbolicLink = wrap(path => {
  try {
    return lstat(path).isSymbolicLink();
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    dependOnParentDirectory(path);
    return false;
  }
}, {
  subscribe(path) {
    let watcher = watch(path, () => {
      optimisticIsSymbolicLink.dirty(path);
    });
    return function () {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    };
  }

});
//# sourceMappingURL=optimistic.js.map