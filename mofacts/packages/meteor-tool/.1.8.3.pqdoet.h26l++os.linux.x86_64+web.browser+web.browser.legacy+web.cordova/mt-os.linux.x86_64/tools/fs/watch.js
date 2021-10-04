let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  WatchSet: () => WatchSet,
  readFile: () => readFile,
  sha1: () => sha1,
  sha512: () => sha512,
  readDirectory: () => readDirectory,
  Watcher: () => Watcher,
  isUpToDate: () => isUpToDate,
  readAndWatchDirectory: () => readAndWatchDirectory,
  readAndWatchFileWithHash: () => readAndWatchFileWithHash,
  readAndWatchFile: () => readAndWatchFile
});
let files;
module.link("./files", {
  "*"(v) {
    files = v;
  }

}, 0);
let safeWatcher;
module.link("./safe-watcher", {
  "*"(v) {
    safeWatcher = v;
  }

}, 1);
let createHash;
module.link("crypto", {
  createHash(v) {
    createHash = v;
  }

}, 2);
let coalesce;
module.link("../utils/func-utils", {
  coalesce(v) {
    coalesce = v;
  }

}, 3);
let Profile;
module.link("../tool-env/profile", {
  Profile(v) {
    Profile = v;
  }

}, 4);
let optimisticHashOrNull, optimisticStatOrNull;
module.link("./optimistic", {
  optimisticHashOrNull(v) {
    optimisticHashOrNull = v;
  },

  optimisticStatOrNull(v) {
    optimisticStatOrNull = v;
  }

}, 5);

const _ = require("underscore");

const WATCH_COALESCE_MS = +(process.env.METEOR_FILE_WATCH_COALESCE_MS || 100);

class WatchSet {
  constructor() {
    // Set this to true if any Watcher built on this WatchSet must immediately
    // fire (eg, if this WatchSet was given two different sha1 for the same file).
    this.alwaysFire = false; // Map from the absolute path to a file, to a sha1 hash, or null if the file
    // should not exist. A Watcher created from this set fires when the file
    // changes from that sha, or is deleted (if non-null) or created (if null).
    //
    // Note that Isopack.getSourceFilesUnderSourceRoot() depends on this field
    // existing (it's not just an internal implementation detail of watch.ts).

    this.files = Object.create(null); // This represents the assertion that 'absPath' is a directory and that
    // 'contents' is its immediate contents, as filtered by the regular
    // expressions.  Entries in 'contents' are file and subdirectory names;
    // directory names end with '/'. 'contents' is sorted. An entry is in
    // 'contents' if its value (including the slash, for directories) matches at
    // least one regular expression in 'include' and no regular expressions in
    // 'exclude'... or if it is in 'names'.
    //
    // There is no recursion here: files contained in subdirectories never appear.
    //
    // A directory may have multiple entries (presumably with different
    // include/exclude filters).

    this.directories = []; // Files added via addPotentiallyUnusedFile will be included in this Set
    // until addFile is called at a later time, which removes them from the
    // potentiallyUnusedFiles Set and prevents them from being considered as
    // potentially unused in the future. Either way, this.files will have
    // the same contents as if addFile was called instead, which is
    // important for checks such as IsopackCache._checkUpToDate, which need
    // to take everything (even potentially unused files) into account.

    this.potentiallyUnusedFiles = new Set();
  }

  addFile(filePath, hash) {
    // Calling addFile directly instead of addPotentiallyUnusedFile implies
    // that the file will be used, so we can mark it as such here. Note that
    // addPotentiallyUnusedFile overrides this value based on the alreadyUsed
    // variable after calling this.addFile.
    this.potentiallyUnusedFiles.delete(filePath); // No need to update if this is in always-fire mode already.

    if (this.alwaysFire) {
      return;
    }

    if (_.has(this.files, filePath)) {
      // Redundant?
      if (this.files[filePath] === hash) {
        return;
      } // Nope, inconsistent.


      this.alwaysFire = true;
      return;
    }

    this.files[filePath] = hash;
  }

  hasFile(filePath) {
    return _.has(this.files, filePath);
  }

  isDefinitelyUsed(filePath) {
    return this.hasFile(filePath) && !this.isPotentiallyUnused(filePath);
  }

  isPotentiallyUnused(filePath) {
    return this.potentiallyUnusedFiles.has(filePath);
  }

  addPotentiallyUnusedFile(filePath, hash) {
    const alreadyUsed = this.isDefinitelyUsed(filePath);
    this.addFile(filePath, hash);

    if (!alreadyUsed) {
      this.potentiallyUnusedFiles.add(filePath);
    }
  }

  addDirectory(_ref) {
    let {
      absPath,
      include,
      exclude,
      names,
      contents
    } = _ref;
    if (this.alwaysFire) return;

    if (_.isEmpty(include) && _.isEmpty(names)) {
      return;
    }

    this.directories.push({
      absPath,
      include,
      exclude,
      names,
      contents: contents && contents.slice(0).sort()
    });
  } // Merges another WatchSet into this one. This one will now fire if either
  // WatchSet would have fired.


  merge(that) {
    if (this.alwaysFire) return;

    if (that.alwaysFire) {
      this.alwaysFire = true;
      return;
    }

    Object.keys(that.files).forEach(name => {
      if (that.isPotentiallyUnused(name)) {
        this.addPotentiallyUnusedFile(name, that.files[name]);
      } else {
        this.addFile(name, that.files[name]);
      }
    });
    that.directories.forEach(dir => {
      // XXX this doesn't deep-clone the directory, but I think these objects
      // are never mutated #WatchSetShallowClone #TypeScriptOpportunity
      this.directories.push(dir);
    });
  }

  clone() {
    const ret = new WatchSet();
    ret.alwaysFire = this.alwaysFire;
    Object.keys(this.files).forEach(name => {
      ret.files[name] = this.files[name];
    });
    this.potentiallyUnusedFiles.forEach(name => {
      ret.potentiallyUnusedFiles.add(name);
    }); // XXX doesn't bother to deep-clone the directory info
    // #WatchSetShallowClone

    this.directories.forEach(entry => {
      ret.directories.push(entry);
    });
    return ret;
  }

  toJSON() {
    if (this.alwaysFire) {
      return {
        alwaysFire: true
      };
    }

    function reToJSON(r) {
      let options = '';

      if (r.ignoreCase) {
        options += 'i';
      }

      if (r.multiline) {
        options += 'm';
      }

      if (r.global) {
        options += 'g';
      }

      if (options) {
        return {
          $regex: r.source,
          $options: options
        };
      }

      return r.source;
    }

    const potentiallyUnusedFiles = [];
    this.potentiallyUnusedFiles.forEach(name => {
      potentiallyUnusedFiles.push(name);
    });
    return {
      files: this.files,
      potentiallyUnusedFiles,
      directories: this.directories.map(d => ({
        absPath: d.absPath,
        include: d.include.map(reToJSON),
        exclude: d.exclude.map(reToJSON),
        names: d.names,
        contents: d.contents
      }))
    };
  }

  static fromJSON(json) {
    const watchSet = new WatchSet();

    if (!json) {
      return watchSet;
    }

    if (json.alwaysFire) {
      watchSet.alwaysFire = true;
      return watchSet;
    }

    Object.keys(json.files).forEach(name => {
      watchSet.files[name] = json.files[name];
    });

    if (Array.isArray(json.potentiallyUnusedFiles)) {
      json.potentiallyUnusedFiles.forEach(name => {
        watchSet.potentiallyUnusedFiles.add(name);
      });
    }

    function reFromJSON(j) {
      if (j.$regex) {
        return new RegExp(j.$regex, j.$options);
      }

      return new RegExp(j);
    }

    json.directories.forEach(d => {
      watchSet.directories.push({
        absPath: d.absPath,
        include: d.include.map(reFromJSON),
        exclude: d.exclude.map(reFromJSON),
        names: d.names,
        contents: d.contents
      });
    });
    return watchSet;
  }

}

function readFile(absPath) {
  try {
    return files.readFile(absPath);
  } catch (e) {
    // Rethrow most errors.
    if (!e || e.code !== 'ENOENT' && e.code !== 'EISDIR') {
      throw e;
    } // File does not exist (or is a directory).


    return null;
  }
}

;
const sha1 = Profile("sha1", function () {
  const hash = createHash('sha1');

  for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  args.forEach(arg => hash.update(arg));
  return hash.digest('hex');
});
const sha512 = Profile("sha512", function () {
  const hash = createHash('sha512');

  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  args.forEach(arg => hash.update(arg));
  return hash.digest('base64');
});

function readAndStatDirectory(absPath) {
  // Read the directory.
  try {
    var contents = files.readdir(absPath);
  } catch (e) {
    // If the path is not a directory, return null; let other errors through.
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
      return null;
    }

    throw e;
  } // Add slashes to the end of directories.


  const contentsWithSlashes = [];
  contents.forEach(entry => {
    // We do stat instead of lstat here, so that we treat symlinks to
    // directories just like directories themselves.
    const stat = optimisticStatOrNull(files.pathJoin(absPath, entry));

    if (!stat) {
      // Disappeared after the readdir (or a dangling symlink)?
      // Eh, pretend it was never there in the first place.
      return;
    }

    if (stat.isDirectory()) {
      entry += '/';
    }

    contentsWithSlashes.push(entry);
  });
  return contentsWithSlashes;
}

function filterDirectoryContents(contents, _ref2) {
  let {
    include,
    exclude,
    names
  } = _ref2;
  // Filter based on regexps.
  return contents.filter(entry => {
    // Is it one of the names we explicitly requested?
    if (names && names.indexOf(entry) !== -1) {
      return true;
    } // Is it ruled out by an exclude rule?


    if (exclude && exclude.some(re => re.test(entry))) {
      return false;
    } // Is it ruled in by an include rule?


    if (include && include.some(re => re.test(entry))) {
      return true;
    }

    return false;
  }).sort();
}

function readDirectory(_ref3) {
  let {
    absPath,
    include,
    exclude,
    names
  } = _ref3;
  const contents = readAndStatDirectory(absPath);
  return contents ? filterDirectoryContents(contents, {
    include,
    exclude,
    names
  }) : [];
}

class Watcher {
  constructor(options) {
    this.stopped = false;
    this.justCheckOnce = false;
    this.async = false;
    this.includePotentiallyUnusedFiles = true;
    this.watches = Object.create(null);
    this.async = !!options.async;
    this.watchSet = options.watchSet;
    this.onChange = options.onChange;
    this.justCheckOnce = !!options.justCheckOnce;

    if (options.includePotentiallyUnusedFiles === false) {
      this.includePotentiallyUnusedFiles = false;
    } // Were we given an inconsistent WatchSet? Fire now and be done with it.


    if (this.watchSet.alwaysFire) {
      this.fire();
      return;
    }

    this.startFileWatches();
    this.checkDirectories();
  }

  fireIfFileChanged(absPath) {
    if (this.stopped) {
      return true;
    }

    if (!this.includePotentiallyUnusedFiles && this.watchSet.isPotentiallyUnused(absPath)) {
      return false;
    }

    const oldHash = this.watchSet.files[absPath];

    if (typeof oldHash === "undefined") {
      throw new Error("Checking unknown file " + absPath);
    }

    const newHash = optimisticHashOrNull(absPath);

    if (newHash === null) {
      // File does not exist (or is a directory).
      // Is this what we expected?
      if (oldHash === null) {
        return false;
      } // Nope, not what we expected.


      this.fire();
      return true;
    } // File exists! Is that what we expected?


    if (oldHash === null) {
      this.fire();
      return true;
    } // Unchanged?


    if (newHash === oldHash) {
      return false;
    }

    this.fire();
    return true;
  } // infos must all be for the same directory


  fireIfDirectoryChanged(infos) {
    if (this.stopped) {
      return true;
    }

    const contents = readAndStatDirectory(infos[0].absPath);

    for (const info of infos) {
      const newContents = filterDirectoryContents(contents || [], info); // If the directory has changed (including being deleted or created).

      if (!_.isEqual(info.contents, newContents)) {
        this.fire();
        return true;
      }
    }

    return false;
  }

  startFileWatches() {
    const keys = Object.keys(this.watchSet.files); // Set up a watch for each file

    this.processBatches(keys, absPath => {
      if (!this.justCheckOnce) {
        this.watchFileOrDirectory(absPath, true);
      } // Check for the case where by the time we created the watch,
      // the file had already changed from the sha we were provided.


      this.fireIfFileChanged(absPath);
    });
  }

  watchFileOrDirectory(absPath) {
    let skipCheck = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (!_.has(this.watches, absPath)) {
      this.watches[absPath] = {
        watcher: null,
        // Initially undefined (instead of null) to indicate we have never
        // called files.stat on this file before.
        lastStat: undefined
      };
    }

    const entry = this.watches[absPath];

    if (entry.watcher) {
      // Already watching this path.
      return;
    }

    if (files.statOrNull(absPath)) {
      if (this.mustNotExist(absPath)) {
        this.fire();
        return;
      }

      const onWatchEvent = this.makeWatchEventCallback(absPath);
      entry.watcher = safeWatcher.watch(absPath, onWatchEvent);

      if (!skipCheck) {
        // If we successfully created the watcher, invoke the callback
        // immediately, so that we examine this file at least once.
        onWatchEvent();
      } else {
        this.updateStatForWatch(absPath);
      }
    } else {
      if (this.mustBeAFile(absPath)) {
        this.fire();
        return;
      }

      const parentDir = files.pathDirname(absPath);

      if (parentDir === absPath) {
        throw new Error("Unable to watch parent directory of " + absPath);
      }

      this.watchFileOrDirectory(parentDir);
    }
  }

  makeWatchEventCallback(absPath) {
    // Sometimes we receive a rapid succession of change events, perhaps
    // because several files were modified at once (e.g. by git reset
    // --hard), or a file was deleted and then recreated by an editor like
    // Vim. Because detecting changes can be costly, and because we care
    // most about the settled state of the file system, we use the
    // funcUtils.coalesce helper to delay calls to the callback by
    // METEOR_FILE_WATCH_COALESCE_MS or 100 milliseconds, canceling any
    // additional calls if they happen within that window of time, so that
    // a rapid succession of calls will tend to trigger only one inspection
    // of the file system.
    return coalesce(WATCH_COALESCE_MS, () => {
      if (this.stopped) {
        return;
      } // This helper method will call this._fire() if the old and new stat
      // objects have different types (missing, file, or directory), so we
      // can assume they have the same type for the rest of this method.


      const stat = this.updateStatForWatch(absPath);

      if (this.stopped) {
        return;
      }

      if (stat === null || stat.isFile()) {
        if (_.has(this.watchSet.files, absPath)) {
          this.fireIfFileChanged(absPath); // XXX #3335 We probably should check again in a second, due to low
          // filesystem modtime resolution.
        }
      } else if (stat.isDirectory()) {
        try {
          var dirFiles = files.readdir(absPath);
        } catch (err) {
          if (err.code === "ENOENT" || err.code === "ENOTDIR") {
            // The directory was removed or changed type since we called
            // this._updateStatForWatch, so we fire unconditionally.
            this.fire();
            return;
          }

          throw err;
        }

        dirFiles.forEach(file => {
          const fullPath = files.pathJoin(absPath, file); // Recursively watch new files, if we ever previously tried to
          // watch them. Recall that when we attempt to watch a
          // non-existent file, we actually watch the closest enclosing
          // directory that exists, so once the file (and/or any
          // intermediate directories) are created, we begin watching
          // those directories in response to change events fired for
          // directories we're already watching.

          if (_.has(this.watches, fullPath)) {
            this.watchFileOrDirectory(fullPath);
          }
        }); // If this.watchSet.directories contains any entries for the
        // directory we are examining, call this._fireIfDirectoryChanged.

        const infos = this.watchSet.directories.filter(info => info.absPath === absPath);

        if (infos.length) {
          this.fireIfDirectoryChanged(infos);
        } // XXX #3335 We probably should check again in a second, due to low
        // filesystem modtime resolution.

      }
    });
  }

  mustNotExist(absPath) {
    const wsFiles = this.watchSet.files;

    if (_.has(wsFiles, absPath)) {
      return wsFiles[absPath] === null;
    }

    return false;
  }

  mustBeAFile(absPath) {
    const wsFiles = this.watchSet.files;

    if (_.has(wsFiles, absPath)) {
      return _.isString(wsFiles[absPath]);
    }

    return false;
  }

  updateStatForWatch(absPath) {
    const entry = this.watches[absPath];
    const lastStat = entry.lastStat;
    let stat = files.statOrNull(absPath);
    const mustNotExist = this.mustNotExist(absPath);
    const mustBeAFile = this.mustBeAFile(absPath);

    if (stat && lastStat === undefined) {
      // We have not checked for this file before, so our expectations are
      // somewhat relaxed (namely, we don't care about lastStat), but
      // this._fire() might still need to be called if this.watchSet.files
      // has conflicting expectations.
      if (stat.isFile()) {
        if (mustNotExist) {
          this.fire();
        }
      } else if (stat.isDirectory()) {
        if (mustNotExist || mustBeAFile) {
          this.fire();
        }
      } else {
        // Neither a file nor a directory, so treat as non-existent.
        stat = null;

        if (mustBeAFile) {
          this.fire();
        }
      } // We have not checked for this file before, so just record the new
      // stat object.


      entry.lastStat = stat;
    } else if (stat && stat.isFile()) {
      entry.lastStat = stat;

      if (!lastStat || !lastStat.isFile()) {
        this.fire();
      }
    } else if (stat && stat.isDirectory()) {
      entry.lastStat = stat;

      if (!lastStat || !lastStat.isDirectory()) {
        this.fire();
      }
    } else {
      entry.lastStat = stat = null;

      if (lastStat) {
        this.fire();
      }
    }

    return stat;
  } // Iterates over the array, calling handleItem for each item
  // When this._async is true, it pauses ocassionally to avoid blocking for too long
  // Stops iterating after watcher is stopped


  processBatches(array, handleItem) {
    let index = 0;

    const processBatch = () => {
      const stopTime = this.async ? Date.now() + 50 : Infinity;

      while (Date.now() < stopTime && index < array.length) {
        if (this.stopped) {
          return;
        }

        handleItem(array[index]);
        index += 1;
      }

      if (index < array.length) {
        if (this.async) {
          setImmediate(processBatch);
        } else {
          processBatch();
        }
      }
    };

    processBatch();
  }

  checkDirectories() {
    const dirs = Object.values(this.watchSet.directories.reduce((result, dir) => {
      const dirs = result[dir.absPath];

      if (dirs) {
        dirs.push(dir);
      } else {
        result[dir.absPath] = [dir];
      }

      return result;
    }, {}));

    if (this.stopped) {
      return;
    }

    this.processBatches(dirs, entries => {
      if (!this.justCheckOnce) {
        this.watchFileOrDirectory(entries[0].absPath, true);
      } // Check for the case where by the time we created the watch, the
      // directory has already changed.


      this.fireIfDirectoryChanged(entries);
    });
  }

  fire() {
    if (this.stopped) return;
    this.stop();
    this.onChange();
  }

  stop() {
    this.stopped = true; // Clean up file watches

    _.each(this.watches, function (entry) {
      if (entry.watcher) {
        entry.watcher.close();
        entry.watcher = null;
      }
    });

    this.watches = Object.create(null);
  }

}

function isUpToDate(watchSet) {
  let includePotentiallyUnusedFiles = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
  return Profile.time('watch.isUpToDate', () => {
    let upToDate = true;
    const watcher = new Watcher({
      watchSet: watchSet,

      onChange() {
        upToDate = false;
      },

      // internal flag which prevents us from starting watches and timers that
      // we're about to cancel anyway
      justCheckOnce: true,
      includePotentiallyUnusedFiles
    });
    watcher.stop();
    return upToDate;
  });
}

function readAndWatchDirectory(watchSet, options) {
  const contents = readDirectory(options);
  watchSet.addDirectory(_objectSpread({
    contents
  }, options));
  return contents;
}

function readAndWatchFileWithHash(watchSet, absPath) {
  const result = {
    contents: null,
    hash: null
  };

  try {
    result.contents = files.readFile(absPath);
  } catch (e) {
    if (e && e.code === "EISDIR") {
      // Avoid adding directories to the watchSet as files.
      return result;
    }

    if (e && e.code === "ENOENT") {// Continue, leaving result.{contents,hash} both null.
    } else {
      // Throw all other errors.
      throw e;
    }
  }

  if (result.contents !== null) {
    result.hash = sha1(result.contents);
  } // Allow null watchSet, if we want to use readFile-style error handling in a
  // context where we might not always have a WatchSet (eg, reading
  // settings.json where we watch for "meteor run" but not for "meteor deploy").


  if (watchSet) {
    watchSet.addFile(absPath, result.hash);
  }

  return result;
}

function readAndWatchFile(watchSet, absPath) {
  return readAndWatchFileWithHash(watchSet, absPath).contents;
}
//# sourceMappingURL=watch.js.map