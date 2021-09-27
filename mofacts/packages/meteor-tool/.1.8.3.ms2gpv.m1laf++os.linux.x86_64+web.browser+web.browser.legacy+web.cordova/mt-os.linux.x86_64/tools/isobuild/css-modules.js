!function (module1) {
  module1.export({
    cssToCommonJS: () => cssToCommonJS
  });

  function cssToCommonJS(css, _hash) {
    return ['module.exports = require("meteor/modules").addStyles(', "  " + JSON.stringify(css), ");", ""].join("\n");
  }
}.call(this, module);
//# sourceMappingURL=css-modules.js.map