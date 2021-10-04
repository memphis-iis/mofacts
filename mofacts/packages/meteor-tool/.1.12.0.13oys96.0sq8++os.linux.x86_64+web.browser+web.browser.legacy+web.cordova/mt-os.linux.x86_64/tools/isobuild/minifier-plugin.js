let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  JsFile: () => JsFile,
  CssFile: () => CssFile
});
let buildmessage;
module.link("../utils/buildmessage.js", {
  default(v) {
    buildmessage = v;
  }

}, 0);

const buildPluginModule = require('./build-plugin.js');

class InputFile extends buildPluginModule.InputFile {
  constructor(source) {
    let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    super();
    this._source = source;
    this._arch = options.arch;
    this._minifiedFiles = [];
  }

  getContentsAsBuffer() {
    return this._source.contents();
  }

  getPathInPackage() {
    throw new Error("Compiled files don't belong to any package");
  }

  getPackageName() {
    throw new Error("Compiled files don't belong to any package");
  }

  getSourceHash() {
    return this._source.hash();
  }

  getArch() {
    return this._arch;
  }

  error(_ref) {
    let {
      message,
      sourcePath,
      line,
      column,
      func
    } = _ref;
    const relPath = this.getPathInBundle();
    buildmessage.error(message || 'error minifying ' + relPath, {
      file: sourcePath || relPath,
      line: line ? line : undefined,
      column: column ? column : undefined,
      func: func ? func : undefined
    });
  }
  /**
   * @summary Returns the path of the compiled file in the bundle.
   * @memberof InputFile
   * @returns {String}
   */


  getPathInBundle() {
    return this._source.targetPath;
  }
  /**
   * @summary Returns the source-map associated with the file.
   * @memberof InputFile
   * @returns {String}
   */


  getSourceMap() {
    return this._source.sourceMap;
  }

}

class JsFile extends InputFile {
  // - data
  // - sourceMap
  // - path
  // - hash?
  // - stats?
  addJavaScript(options) {
    this._minifiedFiles.push(_objectSpread({}, options));
  }

}

class CssFile extends InputFile {
  // - data
  // - sourceMap
  // - path
  // - hash?
  // - stats?
  addStylesheet(options) {
    this._minifiedFiles.push(_objectSpread({}, options));
  }

}
//# sourceMappingURL=minifier-plugin.js.map