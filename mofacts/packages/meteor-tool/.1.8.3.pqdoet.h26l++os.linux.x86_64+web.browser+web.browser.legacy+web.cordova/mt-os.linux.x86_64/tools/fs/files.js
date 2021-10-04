let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  cwd: () => cwd,
  findAppDir: () => findAppDir,
  findPackageDir: () => findPackageDir,
  findGitCommitHash: () => findGitCommitHash,
  addToGitignore: () => addToGitignore,
  inCheckout: () => inCheckout,
  usesWarehouse: () => usesWarehouse,
  getToolsVersion: () => getToolsVersion,
  getDevBundle: () => getDevBundle,
  getCurrentNodeBinDir: () => getCurrentNodeBinDir,
  getCurrentToolsDir: () => getCurrentToolsDir,
  getSettings: () => getSettings,
  prettyPath: () => prettyPath,
  statOrNull: () => statOrNull,
  realpathOrNull: () => realpathOrNull,
  rm_recursive_async: () => rm_recursive_async,
  rm_recursive: () => rm_recursive,
  fileHash: () => fileHash,
  blankHash: () => blankHash,
  treeHash: () => treeHash,
  mkdir_p: () => mkdir_p,
  cp_r: () => cp_r,
  symlinkWithOverwrite: () => symlinkWithOverwrite,
  getPathsInDir: () => getPathsInDir,
  findPathsWithRegex: () => findPathsWithRegex,
  mkdtemp: () => mkdtemp,
  freeTempDir: () => freeTempDir,
  extractTarGz: () => extractTarGz,
  createTarGzStream: () => createTarGzStream,
  createTarball: () => createTarball,
  renameDirAlmostAtomically: () => renameDirAlmostAtomically,
  writeFileAtomically: () => writeFileAtomically,
  symlinkOverSync: () => symlinkOverSync,
  runJavaScript: () => runJavaScript,
  FancySyntaxError: () => FancySyntaxError,
  OfflineError: () => OfflineError,
  readdirNoDots: () => readdirNoDots,
  getLines: () => getLines,
  splitBufferToLines: () => splitBufferToLines,
  getLinesOrEmpty: () => getLinesOrEmpty,
  readJSONOrNull: () => readJSONOrNull,
  trimSpaceAndComments: () => trimSpaceAndComments,
  trimSpace: () => trimSpace,
  KeyValueFile: () => KeyValueFile,
  getHomeDir: () => getHomeDir,
  currentEnvWithPathsAdded: () => currentEnvWithPathsAdded,
  _generateScriptLinkToMeteorScript: () => _generateScriptLinkToMeteorScript,
  _getLocationFromScriptLinkToMeteorScript: () => _getLocationFromScriptLinkToMeteorScript,
  linkToMeteorScript: () => linkToMeteorScript,
  readLinkToMeteorScript: () => readLinkToMeteorScript,
  exists: () => exists,
  readBufferWithLengthAndOffset: () => readBufferWithLengthAndOffset,
  withCache: () => withCache,
  dependOnPath: () => dependOnPath,
  readFile: () => readFile,
  copyFile: () => copyFile,
  rename: () => rename,
  realpath: () => realpath,
  readdir: () => readdir,
  appendFile: () => appendFile,
  chmod: () => chmod,
  close: () => close,
  createReadStream: () => createReadStream,
  createWriteStream: () => createWriteStream,
  lstat: () => lstat,
  mkdir: () => mkdir,
  open: () => open,
  read: () => read,
  readlink: () => readlink,
  rmdir: () => rmdir,
  stat: () => stat,
  symlink: () => symlink,
  unlink: () => unlink,
  write: () => write,
  writeFile: () => writeFile,
  watchFile: () => watchFile,
  unwatchFile: () => unwatchFile
});
let assert;
module.link("assert", {
  default(v) {
    assert = v;
  }

}, 0);
let fs;
module.link("fs", {
  default(v) {
    fs = v;
  }

}, 1);
let path;
module.link("path", {
  default(v) {
    path = v;
  }

}, 2);
let os;
module.link("os", {
  default(v) {
    os = v;
  }

}, 3);
let spawn, execFile;
module.link("child_process", {
  spawn(v) {
    spawn = v;
  },

  execFile(v) {
    execFile = v;
  }

}, 4);
let Slot;
module.link("@wry/context", {
  Slot(v) {
    Slot = v;
  }

}, 5);
let dep;
module.link("optimism", {
  dep(v) {
    dep = v;
  }

}, 6);
module.link("../static-assets/server/mini-files", {
  "*": "*"
}, 7);
let convertToOSPath, convertToPosixPath, convertToStandardLineEndings, convertToStandardPath, convertToWindowsPath, isWindowsLikeFilesystem, pathBasename, pathDirname, pathJoin, pathNormalize, pathOsDelimiter, pathRelative, pathResolve, pathSep;
module.link("../static-assets/server/mini-files", {
  convertToOSPath(v) {
    convertToOSPath = v;
  },

  convertToPosixPath(v) {
    convertToPosixPath = v;
  },

  convertToStandardLineEndings(v) {
    convertToStandardLineEndings = v;
  },

  convertToStandardPath(v) {
    convertToStandardPath = v;
  },

  convertToWindowsPath(v) {
    convertToWindowsPath = v;
  },

  isWindowsLikeFilesystem(v) {
    isWindowsLikeFilesystem = v;
  },

  pathBasename(v) {
    pathBasename = v;
  },

  pathDirname(v) {
    pathDirname = v;
  },

  pathJoin(v) {
    pathJoin = v;
  },

  pathNormalize(v) {
    pathNormalize = v;
  },

  pathOsDelimiter(v) {
    pathOsDelimiter = v;
  },

  pathRelative(v) {
    pathRelative = v;
  },

  pathResolve(v) {
    pathResolve = v;
  },

  pathSep(v) {
    pathSep = v;
  }

}, 8);

const _ = require('underscore');

const Fiber = require("fibers");

const rimraf = require('rimraf');

const sourcemap = require('source-map');

const sourceMapRetrieverStack = require('../tool-env/source-map-retriever-stack.js');

const utils = require('../utils/utils.js');

const cleanup = require('../tool-env/cleanup.js');

const buildmessage = require('../utils/buildmessage.js');

const fiberHelpers = require('../utils/fiber-helpers.js');

const colonConverter = require('../utils/colon-converter.js');

const Profile = require('../tool-env/profile').Profile;

const {
  hasOwnProperty
} = Object.prototype;
const parsedSourceMaps = {};
let nextStackFilenameCounter = 1; // Use the source maps specified to runJavaScript

function useParsedSourceMap(pathForSourceMap) {
  // Check our fancy source map data structure, used for isopacks
  if (hasOwnProperty.call(parsedSourceMaps, pathForSourceMap)) {
    return {
      map: parsedSourceMaps[pathForSourceMap]
    };
  }

  return null;
} // Try this source map first


sourceMapRetrieverStack.push(useParsedSourceMap);

function canYield() {
  return Fiber.current && Fiber.yield && !Fiber.yield.disallowed;
} // given a predicate function and a starting path, traverse upwards
// from the path until we find a path that satisfies the predicate.
//
// returns either the path to the lowest level directory that passed
// the test or null for none found. if starting path isn't given, use
// cwd.


function findUpwards(predicate) {
  let startPath = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : cwd();
  let testDir = startPath;

  while (testDir) {
    if (predicate(testDir)) {
      break;
    }

    var newDir = pathDirname(testDir);

    if (newDir === testDir) {
      testDir = null;
    } else {
      testDir = newDir;
    }
  }

  return testDir || null;
}

function cwd() {
  return convertToStandardPath(process.cwd());
}

function findAppDir(filepath) {
  return findUpwards(function isAppDir(filepath) {
    // XXX once we are done with the transition to engine, this should
    // change to: `return exists(path.join(filepath, '.meteor',
    // 'release'))`
    // .meteor/packages can be a directory, if .meteor is a warehouse
    // directory.  since installing meteor initializes a warehouse at
    // $HOME/.meteor, we want to make sure your home directory (and all
    // subdirectories therein) don't count as being within a meteor app.
    try {
      // use try/catch to avoid the additional syscall to exists
      return stat(pathJoin(filepath, '.meteor', 'packages')).isFile();
    } catch (e) {
      return false;
    }
  }, filepath);
}

function findPackageDir(filepath) {
  return findUpwards(function isPackageDir(filepath) {
    try {
      return stat(pathJoin(filepath, 'package.js')).isFile();
    } catch (e) {
      return false;
    }
  }, filepath);
}

function findGitCommitHash(path) {
  return new Promise(resolve => {
    const appDir = findAppDir(path);

    if (appDir) {
      execFile("git", ["rev-parse", "HEAD"], {
        cwd: convertToOSPath(appDir)
      }, (error, stdout) => {
        if (!error && typeof stdout === "string") {
          resolve(stdout.trim());
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  }).await();
}

function addToGitignore(dirPath, entry) {
  const filePath = pathJoin(dirPath, ".gitignore");

  if (exists(filePath)) {
    let data = readFile(filePath, 'utf8');
    const lines = data.split(/\n/);

    if (lines.some(line => line === entry)) {// already there do nothing
    } else {
      // rewrite file w/ new entry.
      if (data.substr(-1) !== "\n") {
        data = data + "\n";
      }

      data = data + entry + "\n";
      writeFile(filePath, data, 'utf8');
    }
  } else {
    // doesn't exist, just write it.
    writeFile(filePath, entry + "\n", 'utf8');
  }
}

const inCheckout = _.once(function () {
  try {
    if (exists(pathJoin(getCurrentToolsDir(), '.git'))) {
      return true;
    }
  } catch (e) {
    console.log(e);
  }

  return false;
});

function usesWarehouse() {
  // Test hook: act like we're "installed" using a non-homedir warehouse
  // directory.
  if (process.env.METEOR_WAREHOUSE_DIR) {
    return true;
  } else {
    return !inCheckout();
  }
}

function getToolsVersion() {
  if (!inCheckout()) {
    const isopackJsonPath = pathJoin(getCurrentToolsDir(), '..', // get out of tool, back to package
    'isopack.json');
    let parsed;

    if (exists(isopackJsonPath)) {
      // XXX "isopack-1" is duplicate of isopack.currentFormat
      parsed = JSON.parse(readFile(isopackJsonPath))["isopack-1"];
      return parsed.name + '@' + parsed.version;
    } // XXX COMPAT WITH 0.9.3


    const unipackageJsonPath = pathJoin(getCurrentToolsDir(), '..', // get out of tool, back to package
    'unipackage.json');
    parsed = JSON.parse(readFile(unipackageJsonPath));
    return parsed.name + '@' + parsed.version;
  } else {
    throw new Error("Unexpected. Git checkouts don't have tools versions.");
  }
}

function getDevBundle() {
  return pathJoin(getCurrentToolsDir(), 'dev_bundle');
}

function getCurrentNodeBinDir() {
  return pathJoin(getDevBundle(), "bin");
}

function getCurrentToolsDir() {
  return pathDirname(pathDirname(convertToStandardPath(__dirname)));
}

function getSettings(filename, watchSet) {
  buildmessage.assertInCapture();
  const absPath = pathResolve(filename);

  const buffer = require("./watch").readAndWatchFile(watchSet, absPath);

  if (buffer === null) {
    buildmessage.error("file not found (settings file)", {
      file: filename
    });
    return null;
  }

  if (buffer.length > 0x10000) {
    buildmessage.error("settings file is too large (must be less than 64k)", {
      file: filename
    });
    return null;
  }

  let str = buffer.toString('utf8'); // The use of a byte order mark crashes JSON parsing. Since a BOM is not
  // required (or recommended) when using UTF-8, let's remove it if it exists.

  str = str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str; // Ensure that the string is parseable in JSON, but there's no reason to use
  // the object value of it yet.

  if (str.match(/\S/)) {
    try {
      JSON.parse(str);
    } catch (e) {
      buildmessage.error("parse error reading settings file", {
        file: filename
      });
    }
  }

  return str;
}

function prettyPath(p) {
  p = realpath(p);
  const home = getHomeDir();

  if (!home) {
    return p;
  }

  const relativeToHome = pathRelative(home, p);

  if (relativeToHome.substr(0, 3) === '..' + pathSep) {
    return p;
  }

  return pathJoin('~', relativeToHome);
}

function statOrNull(path) {
  return statOrNullHelper(path, false);
}

function statOrNullHelper(path) {
  let preserveSymlinks = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  try {
    return preserveSymlinks ? lstat(path) : stat(path);
  } catch (e) {
    if (e.code === "ENOENT") {
      return null;
    }

    throw e;
  }
}

function realpathOrNull(path) {
  try {
    return realpath(path);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return null;
  }
}

function rm_recursive_async(path) {
  return new Promise((resolve, reject) => {
    rimraf(convertToOSPath(path), err => err ? reject(err) : resolve());
  });
}

const rm_recursive = Profile("files.rm_recursive", path => {
  try {
    rimraf.sync(convertToOSPath(path));
  } catch (e) {
    if ((e.code === "ENOTEMPTY" || e.code === "EPERM") && canYield()) {
      rm_recursive_async(path).await();
      return;
    }

    throw e;
  }
});

function fileHash(filename) {
  const crypto = require('crypto');

  const hash = crypto.createHash('sha256');
  hash.setEncoding('base64');
  const rs = createReadStream(filename);
  return new Promise(function (resolve) {
    rs.on('end', function () {
      rs.close();
      resolve(hash.digest('base64'));
    });
    rs.pipe(hash, {
      end: false
    });
  }).await();
}

const blankHash = "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=";

function treeHash(root, options) {
  options = _objectSpread({
    ignore() {
      return false;
    }

  }, options);

  const hash = require('crypto').createHash('sha256');

  function traverse(relativePath) {
    if (options.ignore(relativePath)) {
      return;
    }

    var absPath = pathJoin(root, relativePath);
    var stat = lstat(absPath);

    if (stat.isDirectory()) {
      if (relativePath) {
        hash.update('dir ' + JSON.stringify(relativePath) + '\n');
      }

      readdir(absPath).forEach(entry => {
        traverse(pathJoin(relativePath, entry));
      });
    } else if (stat.isFile()) {
      if (!relativePath) {
        throw Error("must call files.treeHash on a directory");
      }

      hash.update('file ' + JSON.stringify(relativePath) + ' ' + stat.size + ' ' + fileHash(absPath) + '\n');

      if (stat.mode & 64) {
        hash.update('exec\n');
      }
    } else if (stat.isSymbolicLink()) {
      if (!relativePath) {
        throw Error("must call files.treeHash on a directory");
      }

      hash.update('symlink ' + JSON.stringify(relativePath) + ' ' + JSON.stringify(readlink(absPath)) + '\n');
    } // ignore anything weirder

  }

  ;
  traverse('');
  return hash.digest('base64');
}

function mkdir_p(dir) {
  let mode = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  const p = pathResolve(dir);
  const ps = pathNormalize(p).split(pathSep);
  const stat = statOrNull(p);

  if (stat) {
    return stat.isDirectory();
  } // doesn't exist. recurse to build parent.
  // Don't use pathJoin here because it can strip off the leading slash
  // accidentally.


  const parentPath = ps.slice(0, -1).join(pathSep);
  const success = mkdir_p(parentPath, mode); // parent is not a directory.

  if (!success) {
    return false;
  }

  try {
    mkdir(p, mode);
  } catch (err) {
    if (err.code === "EEXIST") {
      if (pathIsDirectory(p)) {
        // all good, someone else created this directory for us while we were
        // yielding
        return true;
      } else {
        return false;
      }
    } else {
      throw err;
    }
  } // double check we exist now


  return pathIsDirectory(p);
}

function pathIsDirectory(path) {
  const stat = statOrNull(path);
  return stat && stat.isDirectory();
} // Roughly like cp -R.
//
// The output files will be readable and writable by everyone that the umask
// allows, and executable by everyone (modulo umask) if the original file was
// owner-executable. Symlinks are treated transparently (ie the contents behind
// them are copied, and it's an error if that points nowhere).
//
// If options.transform{Filename, Contents} is present, it should
// be a function, and the contents (as a buffer) or filename will be
// passed through the function. Use this to, eg, fill templates.
//
// If options.ignore is present, it should be a list of regexps. Any
// file whose basename matches one of the regexps, before
// transformation, will be skipped.


function cp_r(from, to) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  from = pathResolve(from);
  const stat = statOrNullHelper(from, options.preserveSymlinks);

  if (!stat) {
    return;
  }

  if (stat.isDirectory()) {
    mkdir_p(to, 493);
    readdir(from).forEach(f => {
      if (options.ignore && options.ignore.some(pattern => f.match(pattern))) {
        return;
      }

      const fullFrom = pathJoin(from, f);

      if (options.transformFilename) {
        f = options.transformFilename(f);
      }

      cp_r(fullFrom, pathJoin(to, f), options);
    });
    return;
  }

  mkdir_p(pathDirname(to));

  if (stat.isSymbolicLink()) {
    symlinkWithOverwrite(readlink(from), to);
  } else if (options.transformContents) {
    writeFile(to, options.transformContents(readFile(from), pathBasename(from)), {
      // Create the file as readable and writable by everyone, and
      // executable by everyone if the original file is executable by
      // owner. (This mode will be modified by umask.) We don't copy the
      // mode *directly* because this function is used by 'meteor create'
      // which is copying from the read-only tools tree into a writable app.
      mode: stat.mode & 64 ? 511 : 438
    });
  } else {
    // Note: files.copyFile applies the same stat.mode logic as above.
    copyFile(from, to);
  }
}

const symlinkWithOverwrite = Profile("files.symlinkWithOverwrite", function symlinkWithOverwrite(source, target) {
  const args = [source, target];

  if (process.platform === "win32") {
    const absoluteSource = pathResolve(target, source);

    if (stat(absoluteSource).isDirectory()) {
      args[2] = "junction";
    }
  }

  try {
    symlink(...args);
  } catch (e) {
    if (e.code === "EEXIST") {
      function normalizePath(path) {
        return convertToOSPath(path).replace(/[\/\\]$/, "");
      }

      if (lstat(target).isSymbolicLink() && normalizePath(readlink(target)) === normalizePath(source)) {
        // If the target already points to the desired source, we don't
        // need to do anything.
        return;
      } // overwrite existing link, file, or directory


      rm_recursive(target);
      symlink(...args);
    } else {
      throw e;
    }
  }
});

function getPathsInDir(dir, options) {
  // Don't let this function yield so that the file system doesn't get changed
  // underneath us
  return fiberHelpers.noYieldsAllowed(function () {
    var cwd = options.cwd || convertToStandardPath(process.cwd());

    if (!exists(cwd)) {
      throw new Error("Specified current working directory doesn't exist: " + cwd);
    }

    const absoluteDir = pathResolve(cwd, dir);

    if (!exists(absoluteDir)) {
      // There are no paths in this dir, so don't do anything
      return;
    }

    const output = options.output || [];

    function pathIsDirectory(path) {
      var stat = lstat(path);
      return stat.isDirectory();
    }

    readdir(absoluteDir).forEach(entry => {
      const newPath = pathJoin(dir, entry);
      const newAbsPath = pathJoin(absoluteDir, entry);
      output.push(newPath);

      if (pathIsDirectory(newAbsPath)) {
        getPathsInDir(newPath, {
          cwd: cwd,
          output: output
        });
      }
    });
    return output;
  });
}

function findPathsWithRegex(dir, regex, options) {
  return getPathsInDir(dir, {
    cwd: options.cwd
  }).filter(function (path) {
    return path.match(regex);
  });
}

// Make a temporary directory. Returns the path to the newly created
// directory. Only the current user is allowed to read or write the
// files in the directory (or add files to it). The directory will
// be cleaned up on exit.
const tempDirs = Object.create(null);

function mkdtemp(prefix) {
  function make() {
    prefix = prefix || 'mt-'; // find /tmp

    let tmpDir;
    ['TMPDIR', 'TMP', 'TEMP'].some(t => {
      const value = process.env[t];

      if (value) {
        tmpDir = value;
        return true;
      }
    });

    if (!tmpDir && process.platform !== 'win32') {
      tmpDir = '/tmp';
    }

    if (!tmpDir) {
      throw new Error("Couldn't create a temporary directory.");
    }

    tmpDir = realpath(tmpDir); // make the directory. give it 3 tries in case of collisions from
    // crappy random.

    var tries = 3;

    while (tries > 0) {
      const dirPath = pathJoin(tmpDir, prefix + (Math.random() * 0x100000000 + 1).toString(36));

      try {
        mkdir(dirPath, 448);
        return dirPath;
      } catch (err) {
        tries--;
      }
    }

    throw new Error("failed to make temporary directory in " + tmpDir);
  }

  ;
  const dir = make();
  tempDirs[dir] = true;
  return dir;
}

function freeTempDir(dir) {
  if (!tempDirs[dir]) {
    throw Error("not a tracked temp dir: " + dir);
  }

  if (process.env.METEOR_SAVE_TMPDIRS) {
    return;
  }

  return rm_recursive_async(dir).then(() => {
    // Delete tempDirs[dir] only when the removal finishes, so that the
    // cleanup.onExit handler can attempt the removal synchronously if it
    // fires in the meantime.
    delete tempDirs[dir];
  }, error => {
    // Leave tempDirs[dir] in place so the cleanup.onExit handler can try
    // to delete it again when the process exits.
    console.log(error);
  });
}

if (!process.env.METEOR_SAVE_TMPDIRS) {
  cleanup.onExit(function () {
    Object.keys(tempDirs).forEach(dir => {
      delete tempDirs[dir];

      try {
        rm_recursive(dir);
      } catch (err) {// Don't crash and print a stack trace because we failed to delete
        // a temp directory. This happens sometimes on Windows and seems
        // to be unavoidable.
      }
    });
  });
} // Takes a buffer containing `.tar.gz` data and extracts the archive
// into a destination directory. destPath should not exist yet, and
// the archive should contain a single top-level directory, which will
// be renamed atomically to destPath.


function extractTarGz(buffer, destPath) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  const parentDir = pathDirname(destPath);
  const tempDir = pathJoin(parentDir, '.tmp' + utils.randomToken());
  mkdir_p(tempDir);

  if (!hasOwnProperty.call(options, "verbose")) {
    options.verbose = require("../console/console.js").Console.verbose;
  }

  const startTime = +new Date();
  let promise = process.platform === "win32" ? tryExtractWithNative7z(buffer, tempDir, options) : tryExtractWithNativeTar(buffer, tempDir, options);
  promise = promise.catch(() => tryExtractWithNpmTar(buffer, tempDir, options));
  promise.await(); // succeed!

  const topLevelOfArchive = readdir(tempDir) // On Windows, the 7z.exe tool sometimes creates an auxiliary
  // PaxHeader directory.
  .filter(file => !file.startsWith("PaxHeader"));

  if (topLevelOfArchive.length !== 1) {
    throw new Error("Extracted archive '" + tempDir + "' should only contain one entry");
  }

  const extractDir = pathJoin(tempDir, topLevelOfArchive[0]);
  rename(extractDir, destPath);
  rm_recursive(tempDir);

  if (options.verbose) {
    console.log("Finished extracting in", Date.now() - startTime, "ms");
  }
}

function ensureDirectoryEmpty(dir) {
  readdir(dir).forEach(file => {
    rm_recursive(pathJoin(dir, file));
  });
}

function tryExtractWithNativeTar(buffer, tempDir) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  ensureDirectoryEmpty(tempDir);

  if (options.forceConvert) {
    return Promise.reject(new Error("Native tar cannot convert colons in package names"));
  }

  return new Promise((resolve, reject) => {
    const flags = options.verbose ? "-xzvf" : "-xzf";
    const tarProc = spawn("tar", [flags, "-"], {
      cwd: convertToOSPath(tempDir),
      stdio: options.verbose ? ["pipe", process.stdout, process.stderr] : "pipe"
    });
    tarProc.on("error", reject);
    tarProc.on("exit", resolve);

    if (tarProc.stdin) {
      tarProc.stdin.write(buffer);
      tarProc.stdin.end();
    }
  });
}

function tryExtractWithNative7z(buffer, tempDir) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  ensureDirectoryEmpty(tempDir);

  if (options.forceConvert) {
    return Promise.reject(new Error("Native 7z.exe cannot convert colons in package names"));
  }

  const exeOSPath = convertToOSPath(pathJoin(getCurrentNodeBinDir(), "7z.exe"));
  const tarGzBasename = "out.tar.gz";
  const spawnOptions = {
    cwd: convertToOSPath(tempDir),
    stdio: options.verbose ? "inherit" : "pipe"
  };
  writeFile(pathJoin(tempDir, tarGzBasename), buffer);
  return new Promise((resolve, reject) => {
    spawn(exeOSPath, ["x", "-y", tarGzBasename], spawnOptions).on("error", reject).on("exit", resolve);
  }).then(code => {
    assert.strictEqual(code, 0);
    let tarBasename;
    const foundTar = readdir(tempDir).some(file => {
      if (file !== tarGzBasename) {
        tarBasename = file;
        return true;
      }
    });
    assert.ok(foundTar, "failed to find .tar file");

    function cleanUp() {
      unlink(pathJoin(tempDir, tarGzBasename));
      unlink(pathJoin(tempDir, tarBasename));
    }

    return new Promise((resolve, reject) => {
      spawn(exeOSPath, ["x", "-y", tarBasename], spawnOptions).on("error", reject).on("exit", resolve);
    }).then(code => {
      cleanUp();
      return code;
    }, error => {
      cleanUp();
      throw error;
    });
  });
}

function tryExtractWithNpmTar(buffer, tempDir) {
  let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  ensureDirectoryEmpty(tempDir);

  const tar = require("tar");

  const zlib = require("zlib");

  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip().on('error', reject);
    const extractor = new tar.Extract({
      path: convertToOSPath(tempDir)
    }).on('entry', function (e) {
      if (process.platform === "win32" || options.forceConvert) {
        // On Windows, try to convert old packages that have colons in
        // paths by blindly replacing all of the paths. Otherwise, we
        // can't even extract the tarball
        e.path = colonConverter.convert(e.path);
      }
    }).on('error', reject).on('end', resolve); // write the buffer to the (gunzip|untar) pipeline; these calls
    // cause the tar to be extracted to disk.

    gunzip.pipe(extractor);
    gunzip.write(buffer);
    gunzip.end();
  });
} // In the same fashion as node-pre-gyp does, add the executable
// bit but only if the read bit was present.  Same as:
// https://github.com/mapbox/node-pre-gyp/blob/7a28f4b0f562ba4712722fefe4eeffb7b20fbf7a/lib/install.js#L71-L77
// and others reported in: https://github.com/npm/node-tar/issues/7


function addExecBitWhenReadBitPresent(fileMode) {
  return fileMode |= fileMode >>> 2 & 73;
} // Tar-gzips a directory, returning a stream that can then be piped as
// needed.  The tar archive will contain a top-level directory named
// after dirPath.


function createTarGzStream(dirPath) {
  const tar = require("tar");

  const fstream = require('fstream');

  const zlib = require("zlib"); // Create a segment of the file path which we will look for to
  // identify exactly what we think is a "bin" file (that is, something
  // which should be expected to work within the context of an
  // 'npm run-script').


  const binPathMatch = ["", "node_modules", ".bin", ""].join(path.sep); // Don't use `{ path: dirPath, type: 'Directory' }` as an argument to
  // fstream.Reader. This triggers a collection of odd behaviors in fstream
  // (which might be bugs or might just be weirdnesses).
  //
  // First, if we pass an object with `type: 'Directory'` as an argument, then
  // the resulting tarball has no entry for the top-level directory, because
  // the reader emits an entry (with just the path, no permissions or other
  // properties) before the pipe to gzip is even set up, so that entry gets
  // lost. Even if we pause the streams until all the pipes are set up, we'll
  // get the entry in the tarball for the top-level directory without
  // permissions or other properties, which is problematic. Just passing
  // `dirPath` appears to cause `fstream` to stat the directory before emitting
  // an entry for it, so the pipes are set up by the time the entry is emitted,
  // and the entry has all the right permissions, etc. from statting it.
  //
  // The second weird behavior is that we need an entry for the top-level
  // directory in the tarball to untar it with npm `tar`. (GNU tar, in
  // contrast, appears to have no problems untarring tarballs without entries
  // for the top-level directory inside them.) The problem is that, without an
  // entry for the top-level directory, `fstream` will create the directory
  // with the same permissions as the first file inside it. This manifests as
  // an EACCESS when untarring if the first file inside the top-level directory
  // is not writeable.

  const fileStream = fstream.Reader({
    path: convertToOSPath(dirPath),

    filter(entry) {
      if (process.platform !== "win32") {
        return true;
      } // Refuse to create a directory that isn't listable. Tarballs
      // created on Windows will have non-executable directories (since
      // executable isn't a thing in Windows directory permissions), and
      // so the resulting extracted directories will not be listable on
      // Linux/Mac unless we explicitly make them executable. We think
      // this should really be an option that you pass to node tar, but
      // setting it in an 'entry' handler is the same strategy that npm
      // does, so we do that here too.


      if (entry.type === "Directory") {
        entry.props.mode = addExecBitWhenReadBitPresent(entry.props.mode);
      } // In a similar way as for directories, but only if is in a path
      // location that is expected to be executable (npm "bin" links)


      if (entry.type === "File" && entry.path.indexOf(binPathMatch) > -1) {
        entry.props.mode = addExecBitWhenReadBitPresent(entry.props.mode);
      }

      return true;
    }

  });
  return fileStream.pipe(tar.Pack({
    noProprietary: true
  })).pipe(zlib.createGzip());
}

const createTarball = Profile(function (_, tarball) {
  return "files.createTarball " + pathBasename(tarball);
}, function (dirPath, tarball) {
  const out = createWriteStream(tarball);
  new Promise(function (resolve, reject) {
    out.on('error', reject);
    out.on('close', resolve);
    createTarGzStream(dirPath).pipe(out);
  }).await();
});
const renameDirAlmostAtomically = Profile("files.renameDirAlmostAtomically", (fromDir, toDir) => {
  const garbageDir = pathJoin(pathDirname(toDir), // Begin the base filename with a '.' character so that it can be
  // ignored by other directory-scanning code.
  ".".concat(pathBasename(toDir), "-garbage-").concat(utils.randomToken())); // Get old dir out of the way, if it exists.

  let cleanupGarbage = false;
  let forceCopy = false;

  try {
    rename(toDir, garbageDir);
    cleanupGarbage = true;
  } catch (e) {
    if (e.code === 'EXDEV') {
      // Some (notably Docker) file systems will fail to do a seemingly
      // harmless operation, such as renaming, on what is apparently the same
      // file system.  AUFS will do this even if the `fromDir` and `toDir`
      // are on the same layer, and OverlayFS will fail if the `fromDir` and
      // `toDir` are on different layers.  In these cases, we will not be
      // atomic and will need to do a recursive copy.
      forceCopy = true;
    } else if (e.code !== 'ENOENT') {
      // No such file or directory is okay, but anything else is not.
      throw e;
    }
  }

  if (!forceCopy) {
    try {
      rename(fromDir, toDir);
    } catch (e) {
      // It's possible that there may not have been a `toDir` to have
      // advanced warning about this, so we're prepared to handle it again.
      if (e.code === 'EXDEV') {
        forceCopy = true;
      } else {
        throw e;
      }
    }
  } // If we've been forced to jeopardize our atomicity due to file-system
  // limitations, we'll resort to copying.


  if (forceCopy) {
    rm_recursive(toDir);
    cp_r(fromDir, toDir, {
      preserveSymlinks: true
    });
  } // ... and take out the trash.


  if (cleanupGarbage) {
    // We don't care about how long this takes, so we'll let it go async.
    rm_recursive_async(garbageDir);
  }
});
const writeFileAtomically = Profile("files.writeFileAtomically", function (filename, contents) {
  const parentDir = pathDirname(filename);
  mkdir_p(parentDir);
  const tmpFile = pathJoin(parentDir, '.' + pathBasename(filename) + '.' + utils.randomToken());
  writeFile(tmpFile, contents);
  rename(tmpFile, filename);
});

function symlinkOverSync(linkText, file) {
  file = pathResolve(file);
  const tmpSymlink = pathJoin(pathDirname(file), "." + pathBasename(file) + ".tmp" + utils.randomToken());
  symlink(linkText, tmpSymlink);
  rename(tmpSymlink, file);
}

function runJavaScript(code, _ref) {
  let {
    symbols = Object.create(null),
    filename = "<anonymous>",
    sourceMap,
    sourceMapRoot
  } = _ref;
  return Profile.time('runJavaScript ' + filename, () => {
    const keys = [],
          values = []; // don't assume that _.keys and _.values are guaranteed to
    // enumerate in the same order

    _.each(symbols, function (value, name) {
      keys.push(name);
      values.push(value);
    });

    let stackFilename = filename;

    if (sourceMap) {
      // We want to generate an arbitrary filename that we use to associate the
      // file with its source map.
      stackFilename = "<runJavaScript-" + nextStackFilenameCounter++ + ">";
    }

    const chunks = [];
    const header = "(function(" + keys.join(',') + "){";
    chunks.push(header);

    if (sourceMap) {
      chunks.push(sourcemap.SourceNode.fromStringWithSourceMap(code, new sourcemap.SourceMapConsumer(sourceMap)));
    } else {
      chunks.push(code);
    } // \n is necessary in case final line is a //-comment


    chunks.push("\n})");
    let wrapped;
    let parsedSourceMap = null;

    if (sourceMap) {
      const results = new sourcemap.SourceNode(null, null, null, chunks).toStringWithSourceMap({
        file: stackFilename
      });
      wrapped = results.code;
      parsedSourceMap = results.map.toJSON();

      if (sourceMapRoot) {
        // Add the specified root to any root that may be in the file.
        parsedSourceMap.sourceRoot = pathJoin(sourceMapRoot, parsedSourceMap.sourceRoot || '');
      } // source-map-support doesn't ever look at the sourcesContent field, so
      // there's no point in keeping it in memory.


      delete parsedSourceMap.sourcesContent;
      parsedSourceMaps[stackFilename] = parsedSourceMap;
    } else {
      wrapped = chunks.join('');
    }

    ;

    try {
      // See #runInThisContext
      //
      // XXX it'd be nice to runInNewContext so that the code can't mess
      // with our globals, but objects that come out of runInNewContext
      // have bizarro antimatter prototype chains and break 'instanceof
      // Array'. for now, steer clear
      //
      // Pass 'true' as third argument if we want the parse error on
      // stderr (which we don't).
      var script = require('vm').createScript(wrapped, stackFilename);
    } catch (nodeParseError) {
      if (!(nodeParseError instanceof SyntaxError)) {
        throw nodeParseError;
      } // Got a parse error. Unfortunately, we can't actually get the
      // location of the parse error from the SyntaxError; Node has some
      // hacky support for displaying it over stderr if you pass an
      // undocumented third argument to stackFilename, but that's not
      // what we want. See
      //    https://github.com/joyent/node/issues/3452
      // for more information. One thing to try (and in fact, what an
      // early version of this function did) is to actually fork a new
      // node to run the code and parse its output. We instead run an
      // entirely different JS parser, from the Babel project, but
      // which at least has a nice API for reporting errors.


      const {
        parse
      } = require('meteor-babel');

      try {
        parse(wrapped, {
          strictMode: false
        });
      } catch (parseError) {
        if (typeof parseError.loc !== "object") {
          throw parseError;
        }

        const err = new FancySyntaxError();
        err.message = parseError.message;

        if (parsedSourceMap) {
          // XXX this duplicates code in computeGlobalReferences
          var consumer2 = new sourcemap.SourceMapConsumer(parsedSourceMap);
          var original = consumer2.originalPositionFor(parseError.loc);

          if (original.source) {
            err.file = original.source;
            err.line = original.line;
            err.column = original.column;
            throw err;
          }
        }

        err.file = filename; // *not* stackFilename

        err.line = parseError.loc.line;
        err.column = parseError.loc.column; // adjust errors on line 1 to account for our header

        if (err.line === 1 && typeof err.column === "number") {
          err.column -= header.length;
        }

        throw err;
      } // What? Node thought that this was a parse error and Babel didn't?
      // Eh, just throw Node's error and don't care too much about the line
      // numbers being right.


      throw nodeParseError;
    }

    return buildmessage.markBoundary(script.runInThisContext()).apply(null, values);
  });
}

class FancySyntaxError {
  constructor(message) {
    this.message = message;
  }

}

class OfflineError {
  constructor(error) {
    this.error = error;
  }

  toString() {
    return "[Offline: " + this.error.toString() + "]";
  }

}

function readdirNoDots(path) {
  try {
    var entries = readdir(path);
  } catch (e) {
    if (e.code === 'ENOENT') {
      return [];
    }

    throw e;
  }

  return entries.filter(entry => {
    return entry && entry[0] !== '.';
  });
}

function getLines(file) {
  var buffer = readFile(file);
  var lines = exports.splitBufferToLines(buffer); // strip blank lines at the end

  while (lines.length) {
    var line = lines[lines.length - 1];

    if (line.match(/\S/)) {
      break;
    }

    lines.pop();
  }

  return lines;
}

function splitBufferToLines(buffer) {
  return buffer.toString('utf8').split(/\r*\n\r*/);
}

function getLinesOrEmpty(file) {
  try {
    return getLines(file);
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return [];
    }

    throw e;
  }
}

function readJSONOrNull(file) {
  try {
    var raw = readFile(file, 'utf8');
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return null;
    }

    throw e;
  }

  return JSON.parse(raw);
}

function trimSpaceAndComments(line) {
  var match = line.match(/^([^#]*)#/);

  if (match) {
    line = match[1];
  }

  return trimSpace(line);
}

function trimSpace(line) {
  return line.replace(/^\s+|\s+$/g, '');
}

class KeyValueFile {
  constructor(path) {
    this.path = path;
  }

  set(k, v) {
    const data = (this.readAll() || '').toString("utf8");
    const lines = data.split(/\n/);
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();

      if (trimmed.indexOf(k + '=') == 0) {
        lines[i] = k + '=' + v;
        found = true;
      }
    }

    if (!found) {
      lines.push(k + "=" + v);
    }

    const newdata = lines.join('\n') + '\n';
    writeFile(this.path, newdata, 'utf8');
  }

  readAll() {
    if (exists(this.path)) {
      return readFile(this.path, 'utf8');
    } else {
      return null;
    }
  }

}

function getHomeDir() {
  if (process.platform === "win32") {
    const MI = process.env.METEOR_INSTALLATION;

    if (typeof MI === "string") {
      return pathDirname(convertToStandardPath(MI));
    }
  }

  return process.env.HOME;
}

function currentEnvWithPathsAdded() {
  const env = _objectSpread({}, process.env);

  let pathPropertyName;

  if (process.platform === "win32") {
    // process.env allows for case insensitive access on Windows, but copying it
    // creates a normal JavaScript object with case sensitive property access.
    // This leads to problems, because we would be adding a PATH property instead
    // of setting Path for instance.
    // We want to make sure we're setting the right property, so we
    // lookup the property name case insensitively ourselves.
    pathPropertyName = _.find(Object.keys(env), key => {
      return key.toUpperCase() === 'PATH';
    });

    if (!pathPropertyName) {
      pathPropertyName = 'Path';
    }
  } else {
    pathPropertyName = 'PATH';
  }

  for (var _len = arguments.length, paths = new Array(_len), _key = 0; _key < _len; _key++) {
    paths[_key] = arguments[_key];
  }

  const convertedPaths = paths.map(path => convertToOSPath(path));
  let pathDecomposed = (env[pathPropertyName] || "").split(pathOsDelimiter);
  pathDecomposed.unshift(...convertedPaths);
  env[pathPropertyName] = pathDecomposed.join(pathOsDelimiter);
  return env;
}

// add .bat extension to link file if not present
function ensureBatExtension(p) {
  return p.endsWith(".bat") ? p : p + ".bat";
} // Windows-only, generates a bat script that calls the destination bat script


function _generateScriptLinkToMeteorScript(scriptLocation) {
  const scriptLocationIsAbsolutePath = scriptLocation.match(/^\//);
  const scriptLocationConverted = scriptLocationIsAbsolutePath ? convertToWindowsPath(scriptLocation) : "%~dp0\\" + convertToWindowsPath(scriptLocation);
  return ["@echo off", "SETLOCAL", "SET METEOR_INSTALLATION=%~dp0%", // always convert to Windows path since this function can also be
  // called on Linux or Mac when we are building bootstrap tarballs
  "\"" + scriptLocationConverted + "\" %*", "ENDLOCAL", // always exit with the same exit code as the child script
  "EXIT /b %ERRORLEVEL%", // add a comment with the destination of the link, so it can be read later
  // by files.readLinkToMeteorScript
  "rem " + scriptLocationConverted].join(os.EOL);
}

function _getLocationFromScriptLinkToMeteorScript(script) {
  const lines = _.compact(script.toString().split('\n'));

  let scriptLocation = _.last(lines).replace(/^rem /g, '');

  let isAbsolute = true;

  if (scriptLocation.match(/^%~dp0/)) {
    isAbsolute = false;
    scriptLocation = scriptLocation.replace(/^%~dp0\\?/g, '');
  }

  if (!scriptLocation) {
    throw new Error('Failed to parse script location from meteor.bat');
  }

  return convertToPosixPath(scriptLocation, !isAbsolute);
}

function linkToMeteorScript(scriptLocation, linkLocation, platform) {
  platform = platform || process.platform;

  if (platform === 'win32') {
    // Make a meteor batch script that points to current tool
    linkLocation = ensureBatExtension(linkLocation);
    scriptLocation = ensureBatExtension(scriptLocation);

    const script = _generateScriptLinkToMeteorScript(scriptLocation);

    writeFile(linkLocation, script, {
      encoding: "ascii"
    });
  } else {
    // Symlink meteor tool
    symlinkOverSync(scriptLocation, linkLocation);
  }
}

function readLinkToMeteorScript(linkLocation) {
  let platform = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process.platform;

  if (platform === 'win32') {
    linkLocation = ensureBatExtension(linkLocation);
    const script = readFile(linkLocation);
    return _getLocationFromScriptLinkToMeteorScript(script);
  } else {
    return readlink(linkLocation);
  }
}

function exists(path) {
  return !!statOrNull(path);
}

function readBufferWithLengthAndOffset(filename, length, offset) {
  const data = Buffer.alloc(length); // Read the data from disk, if it is non-empty. Avoid doing IO for empty
  // files, because (a) unnecessary and (b) fs.readSync with length 0
  // throws instead of acting like POSIX read:
  // https://github.com/joyent/node/issues/5685

  if (length > 0) {
    const fd = open(filename, "r");

    try {
      var count = read(fd, data, 0, length, offset);
    } finally {
      close(fd);
    }

    if (count !== length) {
      throw new Error("couldn't read entire resource");
    }
  }

  return data;
}

function wrapFsFunc(fnName, fn, pathArgIndices, options) {
  return Profile("files." + fnName, function () {
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    for (let j = pathArgIndices.length - 1; j >= 0; --j) {
      const i = pathArgIndices[j];
      args[i] = convertToOSPath(args[i]);
    }

    let cacheKey = null;

    if (options && options.cached) {
      const cache = withCacheSlot.getValue();

      if (cache) {
        const strings = [fnName];
        const allStrings = args.every(arg => {
          if (typeof arg === "string") {
            strings.push(arg);
            return true;
          }

          return false;
        });

        if (allStrings) {
          cacheKey = JSON.stringify(strings);

          if (hasOwnProperty.call(cache, cacheKey)) {
            return cache[cacheKey];
          }
        }
      }
    }

    const result = fn.apply(fs, args);

    if (options && options.dirty) {
      options.dirty(...args);
    }

    const finalResult = options && options.modifyReturnValue ? options.modifyReturnValue(result) : result;

    if (cacheKey) {
      withCacheSlot.getValue()[cacheKey] = finalResult;
    }

    return finalResult;
  });
}

const withCacheSlot = new Slot();

function withCache(fn) {
  const cache = withCacheSlot.getValue();
  return cache ? fn() : withCacheSlot.withValue(Object.create(null), fn);
}

const dependOnPath = dep();

function wrapDestructiveFsFunc(fnName, fn) {
  let pathArgIndices = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [0];
  let options = arguments.length > 3 ? arguments[3] : undefined;
  return wrapFsFunc(fnName, fn, pathArgIndices, _objectSpread({}, options, {
    dirty() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      pathArgIndices.forEach(i => dependOnPath.dirty(args[i]));
    }

  }));
}

const readFile = wrapFsFunc("readFile", fs.readFileSync, [0], {
  modifyReturnValue: function (fileData) {
    if (typeof fileData === "string") {
      return convertToStandardLineEndings(fileData);
    }

    return fileData;
  }
});
// Copies a file, which is expected to exist. Parent directories of "to" do not
// have to exist. Treats symbolic links transparently (copies the contents, not
// the link itself, and it's an error if the link doesn't point to a file).
const wrappedCopyFile = wrapDestructiveFsFunc("copyFile", fs.copyFileSync, [0, 1]);

function copyFile(from, to) {
  let flags = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
  mkdir_p(pathDirname(pathResolve(to)), 493);
  wrappedCopyFile(from, to, flags);
  const stat = statOrNull(from);

  if (stat && stat.isFile()) {
    // Create the file as readable and writable by everyone, and executable by
    // everyone if the original file is executably by owner. (This mode will be
    // modified by umask.) We don't copy the mode *directly* because this function
    // is used by 'meteor create' which is copying from the read-only tools tree
    // into a writable app.
    chmod(to, stat.mode & 64 ? 511 : 438);
  }
}

const wrappedRename = wrapDestructiveFsFunc("rename", fs.renameSync, [0, 1]);
const rename = isWindowsLikeFilesystem() ? function (from, to) {
  // Retries are necessary only on Windows, because the rename call can
  // fail with EBUSY, which means the file is in use.
  const osTo = convertToOSPath(to);
  const startTimeMs = Date.now();
  const intervalMs = 50;
  const timeLimitMs = 1000;
  return new Promise((resolve, reject) => {
    function attempt() {
      try {
        // Despite previous failures, the top-level destination directory
        // may have been successfully created, so we must remove it to
        // avoid moving the source file *into* the destination directory.
        rimraf.sync(osTo);
        wrappedRename(from, to);
        resolve();
      } catch (err) {
        if (err.code !== 'EPERM' && err.code !== 'EACCES') {
          reject(err);
        } else if (Date.now() - startTimeMs < timeLimitMs) {
          setTimeout(attempt, intervalMs);
        } else {
          reject(err);
        }
      }
    }

    attempt();
  }).catch(error => {
    if (error.code === 'EPERM' || error.code === 'EACCESS') {
      cp_r(from, to, {
        preserveSymlinks: true
      });
      rm_recursive(from);
    } else {
      throw error;
    }
  }).await();
} : wrappedRename;
const realpath = wrapFsFunc("realpath", fs.realpathSync, [0], {
  cached: true,
  modifyReturnValue: convertToStandardPath
});
const readdir = wrapFsFunc("readdir", fs.readdirSync, [0], {
  cached: true,

  modifyReturnValue(entries) {
    return entries.map(entry => convertToStandardPath(entry));
  }

});
const appendFile = wrapDestructiveFsFunc("appendFile", fs.appendFileSync);
const chmod = wrapDestructiveFsFunc("chmod", fs.chmodSync);
const close = wrapFsFunc("close", fs.closeSync, []);
const createReadStream = wrapFsFunc("createReadStream", fs.createReadStream, [0]);
const createWriteStream = wrapFsFunc("createWriteStream", fs.createWriteStream, [0]);
const lstat = wrapFsFunc("lstat", fs.lstatSync, [0], {
  cached: true
});
const mkdir = wrapDestructiveFsFunc("mkdir", fs.mkdirSync);
const open = wrapFsFunc("open", fs.openSync, [0]);
const read = wrapFsFunc("read", fs.readSync, []);
const readlink = wrapFsFunc("readlink", fs.readlinkSync, [0]);
const rmdir = wrapDestructiveFsFunc("rmdir", fs.rmdirSync);
const stat = wrapFsFunc("stat", fs.statSync, [0], {
  cached: true
});
const symlink = wrapFsFunc("symlink", fs.symlinkSync, [0, 1]);
const unlink = wrapDestructiveFsFunc("unlink", fs.unlinkSync);
const write = wrapFsFunc("write", fs.writeSync, []);
const writeFile = wrapDestructiveFsFunc("writeFile", fs.writeFileSync);
const watchFile = wrapFsFunc("watchFile", (filename, options, listener) => {
  return fs.watchFile(filename, options, listener);
}, [0]);
const unwatchFile = wrapFsFunc("unwatchFile", (filename, listener) => {
  return fs.unwatchFile(filename, listener);
}, [0]);
//# sourceMappingURL=files.js.map