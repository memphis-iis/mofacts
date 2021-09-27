(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var HTML = Package.htmljs.HTML;
var HTMLTools = Package['html-tools'].HTMLTools;
var BlazeTools = Package['blaze-tools'].BlazeTools;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var SpacebarsCompiler;

var require = meteorInstall({"node_modules":{"meteor":{"spacebars-compiler":{"preamble.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/preamble.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  SpacebarsCompiler: () => SpacebarsCompiler
});
let CodeGen, builtInBlockHelpers, isReservedName;
module.link("./codegen", {
  CodeGen(v) {
    CodeGen = v;
  },

  builtInBlockHelpers(v) {
    builtInBlockHelpers = v;
  },

  isReservedName(v) {
    isReservedName = v;
  }

}, 0);
let optimize;
module.link("./optimizer", {
  optimize(v) {
    optimize = v;
  }

}, 1);
let parse, compile, codeGen, TemplateTagReplacer, beautify;
module.link("./compiler", {
  parse(v) {
    parse = v;
  },

  compile(v) {
    compile = v;
  },

  codeGen(v) {
    codeGen = v;
  },

  TemplateTagReplacer(v) {
    TemplateTagReplacer = v;
  },

  beautify(v) {
    beautify = v;
  }

}, 2);
let TemplateTag;
module.link("./templatetag", {
  TemplateTag(v) {
    TemplateTag = v;
  }

}, 3);
module.runSetters(SpacebarsCompiler = {
  CodeGen,
  _builtInBlockHelpers: builtInBlockHelpers,
  isReservedName,
  optimize,
  parse,
  compile,
  codeGen,
  _TemplateTagReplacer: TemplateTagReplacer,
  _beautify: beautify,
  TemplateTag
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"codegen.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/codegen.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  CodeGen: () => CodeGen,
  builtInBlockHelpers: () => builtInBlockHelpers,
  isReservedName: () => isReservedName
});
let HTMLTools;
module.link("meteor/html-tools", {
  HTMLTools(v) {
    HTMLTools = v;
  }

}, 0);
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 1);
let BlazeTools;
module.link("meteor/blaze-tools", {
  BlazeTools(v) {
    BlazeTools = v;
  }

}, 2);
let codeGen;
module.link("./compiler", {
  codeGen(v) {
    codeGen = v;
  }

}, 3);

function CodeGen() {}

const builtInBlockHelpers = {
  'if': 'Blaze.If',
  'unless': 'Blaze.Unless',
  'with': 'Spacebars.With',
  'each': 'Blaze.Each',
  'let': 'Blaze.Let'
};
// Mapping of "macros" which, when preceded by `Template.`, expand
// to special code rather than following the lookup rules for dotted
// symbols.
var builtInTemplateMacros = {
  // `view` is a local variable defined in the generated render
  // function for the template in which `Template.contentBlock` or
  // `Template.elseBlock` is invoked.
  'contentBlock': 'view.templateContentBlock',
  'elseBlock': 'view.templateElseBlock',
  // Confusingly, this makes `{{> Template.dynamic}}` an alias
  // for `{{> __dynamic}}`, where "__dynamic" is the template that
  // implements the dynamic template feature.
  'dynamic': 'Template.__dynamic',
  'subscriptionsReady': 'view.templateInstance().subscriptionsReady()'
};
var additionalReservedNames = ["body", "toString", "instance", "constructor", "toString", "toLocaleString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__lookupGetter__", "__defineSetter__", "__lookupSetter__", "__proto__", "dynamic", "registerHelper", "currentData", "parentData", "_migrateTemplate", "_applyHmrChanges", "__pendingReplacement"]; // A "reserved name" can't be used as a <template> name.  This
// function is used by the template file scanner.
//
// Note that the runtime imposes additional restrictions, for example
// banning the name "body" and names of built-in object properties
// like "toString".

function isReservedName(name) {
  return builtInBlockHelpers.hasOwnProperty(name) || builtInTemplateMacros.hasOwnProperty(name) || additionalReservedNames.includes(name);
}

var makeObjectLiteral = function (obj) {
  var parts = [];

  for (var k in obj) parts.push(BlazeTools.toObjectLiteralKey(k) + ': ' + obj[k]);

  return '{' + parts.join(', ') + '}';
};

Object.assign(CodeGen.prototype, {
  codeGenTemplateTag: function (tag) {
    var self = this;

    if (tag.position === HTMLTools.TEMPLATE_TAG_POSITION.IN_START_TAG) {
      // Special dynamic attributes: `<div {{attrs}}>...`
      // only `tag.type === 'DOUBLE'` allowed (by earlier validation)
      return BlazeTools.EmitCode('function () { return ' + self.codeGenMustache(tag.path, tag.args, 'attrMustache') + '; }');
    } else {
      if (tag.type === 'DOUBLE' || tag.type === 'TRIPLE') {
        var code = self.codeGenMustache(tag.path, tag.args);

        if (tag.type === 'TRIPLE') {
          code = 'Spacebars.makeRaw(' + code + ')';
        }

        if (tag.position !== HTMLTools.TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {
          // Reactive attributes are already wrapped in a function,
          // and there's no fine-grained reactivity.
          // Anywhere else, we need to create a View.
          code = 'Blaze.View(' + BlazeTools.toJSLiteral('lookup:' + tag.path.join('.')) + ', ' + 'function () { return ' + code + '; })';
        }

        return BlazeTools.EmitCode(code);
      } else if (tag.type === 'INCLUSION' || tag.type === 'BLOCKOPEN') {
        var path = tag.path;
        var args = tag.args;

        if (tag.type === 'BLOCKOPEN' && builtInBlockHelpers.hasOwnProperty(path[0])) {
          // if, unless, with, each.
          //
          // If someone tries to do `{{> if}}`, we don't
          // get here, but an error is thrown when we try to codegen the path.
          // Note: If we caught these errors earlier, while scanning, we'd be able to
          // provide nice line numbers.
          if (path.length > 1) throw new Error("Unexpected dotted path beginning with " + path[0]);
          if (!args.length) throw new Error("#" + path[0] + " requires an argument");
          var dataCode = null; // #each has a special treatment as it features two different forms:
          // - {{#each people}}
          // - {{#each person in people}}

          if (path[0] === 'each' && args.length >= 2 && args[1][0] === 'PATH' && args[1][1].length && args[1][1][0] === 'in') {
            // minimum conditions are met for each-in.  now validate this
            // isn't some weird case.
            var eachUsage = "Use either {{#each items}} or " + "{{#each item in items}} form of #each.";
            var inArg = args[1];

            if (!(args.length >= 3 && inArg[1].length === 1)) {
              // we don't have at least 3 space-separated parts after #each, or
              // inArg doesn't look like ['PATH',['in']]
              throw new Error("Malformed #each. " + eachUsage);
            } // split out the variable name and sequence arguments


            var variableArg = args[0];

            if (!(variableArg[0] === "PATH" && variableArg[1].length === 1 && variableArg[1][0].replace(/\./g, ''))) {
              throw new Error("Bad variable name in #each");
            }

            var variable = variableArg[1][0];
            dataCode = 'function () { return { _sequence: ' + self.codeGenInclusionData(args.slice(2)) + ', _variable: ' + BlazeTools.toJSLiteral(variable) + ' }; }';
          } else if (path[0] === 'let') {
            var dataProps = {};
            args.forEach(function (arg) {
              if (arg.length !== 3) {
                // not a keyword arg (x=y)
                throw new Error("Incorrect form of #let");
              }

              var argKey = arg[2];
              dataProps[argKey] = 'function () { return Spacebars.call(' + self.codeGenArgValue(arg) + '); }';
            });
            dataCode = makeObjectLiteral(dataProps);
          }

          if (!dataCode) {
            // `args` must exist (tag.args.length > 0)
            dataCode = self.codeGenInclusionDataFunc(args) || 'null';
          } // `content` must exist


          var contentBlock = 'content' in tag ? self.codeGenBlock(tag.content) : null; // `elseContent` may not exist

          var elseContentBlock = 'elseContent' in tag ? self.codeGenBlock(tag.elseContent) : null;
          var callArgs = [dataCode, contentBlock];
          if (elseContentBlock) callArgs.push(elseContentBlock);
          return BlazeTools.EmitCode(builtInBlockHelpers[path[0]] + '(' + callArgs.join(', ') + ')');
        } else {
          var compCode = self.codeGenPath(path, {
            lookupTemplate: true
          });

          if (path.length > 1) {
            // capture reactivity
            compCode = 'function () { return Spacebars.call(' + compCode + '); }';
          }

          var dataCode = self.codeGenInclusionDataFunc(tag.args);
          var content = 'content' in tag ? self.codeGenBlock(tag.content) : null;
          var elseContent = 'elseContent' in tag ? self.codeGenBlock(tag.elseContent) : null;
          var includeArgs = [compCode];

          if (content) {
            includeArgs.push(content);
            if (elseContent) includeArgs.push(elseContent);
          }

          var includeCode = 'Spacebars.include(' + includeArgs.join(', ') + ')'; // calling convention compat -- set the data context around the
          // entire inclusion, so that if the name of the inclusion is
          // a helper function, it gets the data context in `this`.
          // This makes for a pretty confusing calling convention --
          // In `{{#foo bar}}`, `foo` is evaluated in the context of `bar`
          // -- but it's what we shipped for 0.8.0.  The rationale is that
          // `{{#foo bar}}` is sugar for `{{#with bar}}{{#foo}}...`.

          if (dataCode) {
            includeCode = 'Blaze._TemplateWith(' + dataCode + ', function () { return ' + includeCode + '; })';
          } // XXX BACK COMPAT - UI is the old name, Template is the new


          if ((path[0] === 'UI' || path[0] === 'Template') && (path[1] === 'contentBlock' || path[1] === 'elseBlock')) {
            // Call contentBlock and elseBlock in the appropriate scope
            includeCode = 'Blaze._InOuterTemplateScope(view, function () { return ' + includeCode + '; })';
          }

          return BlazeTools.EmitCode(includeCode);
        }
      } else if (tag.type === 'ESCAPE') {
        return tag.value;
      } else {
        // Can't get here; TemplateTag validation should catch any
        // inappropriate tag types that might come out of the parser.
        throw new Error("Unexpected template tag type: " + tag.type);
      }
    }
  },
  // `path` is an array of at least one string.
  //
  // If `path.length > 1`, the generated code may be reactive
  // (i.e. it may invalidate the current computation).
  //
  // No code is generated to call the result if it's a function.
  //
  // Options:
  //
  // - lookupTemplate {Boolean} If true, generated code also looks in
  //   the list of templates. (After helpers, before data context).
  //   Used when generating code for `{{> foo}}` or `{{#foo}}`. Only
  //   used for non-dotted paths.
  codeGenPath: function (path, opts) {
    if (builtInBlockHelpers.hasOwnProperty(path[0])) throw new Error("Can't use the built-in '" + path[0] + "' here"); // Let `{{#if Template.contentBlock}}` check whether this template was
    // invoked via inclusion or as a block helper, in addition to supporting
    // `{{> Template.contentBlock}}`.
    // XXX BACK COMPAT - UI is the old name, Template is the new

    if (path.length >= 2 && (path[0] === 'UI' || path[0] === 'Template') && builtInTemplateMacros.hasOwnProperty(path[1])) {
      if (path.length > 2) throw new Error("Unexpected dotted path beginning with " + path[0] + '.' + path[1]);
      return builtInTemplateMacros[path[1]];
    }

    var firstPathItem = BlazeTools.toJSLiteral(path[0]);
    var lookupMethod = 'lookup';
    if (opts && opts.lookupTemplate && path.length === 1) lookupMethod = 'lookupTemplate';
    var code = 'view.' + lookupMethod + '(' + firstPathItem + ')';

    if (path.length > 1) {
      code = 'Spacebars.dot(' + code + ', ' + path.slice(1).map(BlazeTools.toJSLiteral).join(', ') + ')';
    }

    return code;
  },
  // Generates code for an `[argType, argValue]` argument spec,
  // ignoring the third element (keyword argument name) if present.
  //
  // The resulting code may be reactive (in the case of a PATH of
  // more than one element) and is not wrapped in a closure.
  codeGenArgValue: function (arg) {
    var self = this;
    var argType = arg[0];
    var argValue = arg[1];
    var argCode;

    switch (argType) {
      case 'STRING':
      case 'NUMBER':
      case 'BOOLEAN':
      case 'NULL':
        argCode = BlazeTools.toJSLiteral(argValue);
        break;

      case 'PATH':
        argCode = self.codeGenPath(argValue);
        break;

      case 'EXPR':
        // The format of EXPR is ['EXPR', { type: 'EXPR', path: [...], args: { ... } }]
        argCode = self.codeGenMustache(argValue.path, argValue.args, 'dataMustache');
        break;

      default:
        // can't get here
        throw new Error("Unexpected arg type: " + argType);
    }

    return argCode;
  },
  // Generates a call to `Spacebars.fooMustache` on evaluated arguments.
  // The resulting code has no function literals and must be wrapped in
  // one for fine-grained reactivity.
  codeGenMustache: function (path, args, mustacheType) {
    var self = this;
    var nameCode = self.codeGenPath(path);
    var argCode = self.codeGenMustacheArgs(args);
    var mustache = mustacheType || 'mustache';
    return 'Spacebars.' + mustache + '(' + nameCode + (argCode ? ', ' + argCode.join(', ') : '') + ')';
  },
  // returns: array of source strings, or null if no
  // args at all.
  codeGenMustacheArgs: function (tagArgs) {
    var self = this;
    var kwArgs = null; // source -> source

    var args = null; // [source]
    // tagArgs may be null

    tagArgs.forEach(function (arg) {
      var argCode = self.codeGenArgValue(arg);

      if (arg.length > 2) {
        // keyword argument (represented as [type, value, name])
        kwArgs = kwArgs || {};
        kwArgs[arg[2]] = argCode;
      } else {
        // positional argument
        args = args || [];
        args.push(argCode);
      }
    }); // put kwArgs in options dictionary at end of args

    if (kwArgs) {
      args = args || [];
      args.push('Spacebars.kw(' + makeObjectLiteral(kwArgs) + ')');
    }

    return args;
  },
  codeGenBlock: function (content) {
    return codeGen(content);
  },
  codeGenInclusionData: function (args) {
    var self = this;

    if (!args.length) {
      // e.g. `{{#foo}}`
      return null;
    } else if (args[0].length === 3) {
      // keyword arguments only, e.g. `{{> point x=1 y=2}}`
      var dataProps = {};
      args.forEach(function (arg) {
        var argKey = arg[2];
        dataProps[argKey] = 'Spacebars.call(' + self.codeGenArgValue(arg) + ')';
      });
      return makeObjectLiteral(dataProps);
    } else if (args[0][0] !== 'PATH') {
      // literal first argument, e.g. `{{> foo "blah"}}`
      //
      // tag validation has confirmed, in this case, that there is only
      // one argument (`args.length === 1`)
      return self.codeGenArgValue(args[0]);
    } else if (args.length === 1) {
      // one argument, must be a PATH
      return 'Spacebars.call(' + self.codeGenPath(args[0][1]) + ')';
    } else {
      // Multiple positional arguments; treat them as a nested
      // "data mustache"
      return self.codeGenMustache(args[0][1], args.slice(1), 'dataMustache');
    }
  },
  codeGenInclusionDataFunc: function (args) {
    var self = this;
    var dataCode = self.codeGenInclusionData(args);

    if (dataCode) {
      return 'function () { return ' + dataCode + '; }';
    } else {
      return null;
    }
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"compiler.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/compiler.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  parse: () => parse,
  compile: () => compile,
  TemplateTagReplacer: () => TemplateTagReplacer,
  codeGen: () => codeGen,
  beautify: () => beautify
});
let Meteor;
module.link("meteor/meteor", {
  Meteor(v) {
    Meteor = v;
  }

}, 0);
let HTMLTools;
module.link("meteor/html-tools", {
  HTMLTools(v) {
    HTMLTools = v;
  }

}, 1);
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 2);
let BlazeTools;
module.link("meteor/blaze-tools", {
  BlazeTools(v) {
    BlazeTools = v;
  }

}, 3);
let CodeGen;
module.link("./codegen", {
  CodeGen(v) {
    CodeGen = v;
  }

}, 4);
let optimize;
module.link("./optimizer", {
  optimize(v) {
    optimize = v;
  }

}, 5);
let ReactComponentSiblingForbidder;
module.link("./react", {
  ReactComponentSiblingForbidder(v) {
    ReactComponentSiblingForbidder = v;
  }

}, 6);
let TemplateTag;
module.link("./templatetag", {
  TemplateTag(v) {
    TemplateTag = v;
  }

}, 7);
let removeWhitespace;
module.link("./whitespace", {
  removeWhitespace(v) {
    removeWhitespace = v;
  }

}, 8);
var UglifyJSMinify = null;

if (Meteor.isServer) {
  UglifyJSMinify = Npm.require('uglify-js').minify;
}

function parse(input) {
  return HTMLTools.parseFragment(input, {
    getTemplateTag: TemplateTag.parseCompleteTag
  });
}

function compile(input, options) {
  var tree = parse(input);
  return codeGen(tree, options);
}

const TemplateTagReplacer = HTML.TransformingVisitor.extend();
TemplateTagReplacer.def({
  visitObject: function (x) {
    if (x instanceof HTMLTools.TemplateTag) {
      // Make sure all TemplateTags in attributes have the right
      // `.position` set on them.  This is a bit of a hack
      // (we shouldn't be mutating that here), but it allows
      // cleaner codegen of "synthetic" attributes like TEXTAREA's
      // "value", where the template tags were originally not
      // in an attribute.
      if (this.inAttributeValue) x.position = HTMLTools.TEMPLATE_TAG_POSITION.IN_ATTRIBUTE;
      return this.codegen.codeGenTemplateTag(x);
    }

    return HTML.TransformingVisitor.prototype.visitObject.call(this, x);
  },
  visitAttributes: function (attrs) {
    if (attrs instanceof HTMLTools.TemplateTag) return this.codegen.codeGenTemplateTag(attrs); // call super (e.g. for case where `attrs` is an array)

    return HTML.TransformingVisitor.prototype.visitAttributes.call(this, attrs);
  },
  visitAttribute: function (name, value, tag) {
    this.inAttributeValue = true;
    var result = this.visit(value);
    this.inAttributeValue = false;

    if (result !== value) {
      // some template tags must have been replaced, because otherwise
      // we try to keep things `===` when transforming.  Wrap the code
      // in a function as per the rules.  You can't have
      // `{id: Blaze.View(...)}` as an attributes dict because the View
      // would be rendered more than once; you need to wrap it in a function
      // so that it's a different View each time.
      return BlazeTools.EmitCode(this.codegen.codeGenBlock(result));
    }

    return result;
  }
});

function codeGen(parseTree, options) {
  // is this a template, rather than a block passed to
  // a block helper, say
  var isTemplate = options && options.isTemplate;
  var isBody = options && options.isBody;
  var whitespace = options && options.whitespace;
  var sourceName = options && options.sourceName;
  var tree = parseTree; // The flags `isTemplate` and `isBody` are kind of a hack.

  if (isTemplate || isBody) {
    if (typeof whitespace === 'string' && whitespace.toLowerCase() === 'strip') {
      tree = removeWhitespace(tree);
    } // optimizing fragments would require being smarter about whether we are
    // in a TEXTAREA, say.


    tree = optimize(tree);
  } // throws an error if using `{{> React}}` with siblings


  new ReactComponentSiblingForbidder({
    sourceName: sourceName
  }).visit(tree);
  var codegen = new CodeGen();
  tree = new TemplateTagReplacer({
    codegen: codegen
  }).visit(tree);
  var code = '(function () { ';

  if (isTemplate || isBody) {
    code += 'var view = this; ';
  }

  code += 'return ';
  code += BlazeTools.toJS(tree);
  code += '; })';
  code = beautify(code);
  return code;
}

function beautify(code) {
  if (!UglifyJSMinify) {
    return code;
  }

  var result = UglifyJSMinify(code, {
    fromString: true,
    mangle: false,
    compress: false,
    output: {
      beautify: true,
      indent_level: 2,
      width: 80
    }
  });
  var output = result.code; // Uglify interprets our expression as a statement and may add a semicolon.
  // Strip trailing semicolon.

  output = output.replace(/;$/, '');
  return output;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"optimizer.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/optimizer.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  toRaw: () => toRaw,
  TreeTransformer: () => TreeTransformer,
  optimize: () => optimize
});
let HTMLTools;
module.link("meteor/html-tools", {
  HTMLTools(v) {
    HTMLTools = v;
  }

}, 0);
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 1);

// Optimize parts of an HTMLjs tree into raw HTML strings when they don't
// contain template tags.
var constant = function (value) {
  return function () {
    return value;
  };
};

var OPTIMIZABLE = {
  NONE: 0,
  PARTS: 1,
  FULL: 2
}; // We can only turn content into an HTML string if it contains no template
// tags and no "tricky" HTML tags.  If we can optimize the entire content
// into a string, we return OPTIMIZABLE.FULL.  If the we are given an
// unoptimizable node, we return OPTIMIZABLE.NONE.  If we are given a tree
// that contains an unoptimizable node somewhere, we return OPTIMIZABLE.PARTS.
//
// For example, we always create SVG elements programmatically, since SVG
// doesn't have innerHTML.  If we are given an SVG element, we return NONE.
// However, if we are given a big tree that contains SVG somewhere, we
// return PARTS so that the optimizer can descend into the tree and optimize
// other parts of it.

var CanOptimizeVisitor = HTML.Visitor.extend();
CanOptimizeVisitor.def({
  visitNull: constant(OPTIMIZABLE.FULL),
  visitPrimitive: constant(OPTIMIZABLE.FULL),
  visitComment: constant(OPTIMIZABLE.FULL),
  visitCharRef: constant(OPTIMIZABLE.FULL),
  visitRaw: constant(OPTIMIZABLE.FULL),
  visitObject: constant(OPTIMIZABLE.NONE),
  visitFunction: constant(OPTIMIZABLE.NONE),
  visitArray: function (x) {
    for (var i = 0; i < x.length; i++) if (this.visit(x[i]) !== OPTIMIZABLE.FULL) return OPTIMIZABLE.PARTS;

    return OPTIMIZABLE.FULL;
  },
  visitTag: function (tag) {
    var tagName = tag.tagName;

    if (tagName === 'textarea') {
      // optimizing into a TEXTAREA's RCDATA would require being a little
      // more clever.
      return OPTIMIZABLE.NONE;
    } else if (tagName === 'script') {
      // script tags don't work when rendered from strings
      return OPTIMIZABLE.NONE;
    } else if (!(HTML.isKnownElement(tagName) && !HTML.isKnownSVGElement(tagName))) {
      // foreign elements like SVG can't be stringified for innerHTML.
      return OPTIMIZABLE.NONE;
    } else if (tagName === 'table') {
      // Avoid ever producing HTML containing `<table><tr>...`, because the
      // browser will insert a TBODY.  If we just `createElement("table")` and
      // `createElement("tr")`, on the other hand, no TBODY is necessary
      // (assuming IE 8+).
      return OPTIMIZABLE.PARTS;
    } else if (tagName === 'tr') {
      return OPTIMIZABLE.PARTS;
    }

    var children = tag.children;

    for (var i = 0; i < children.length; i++) if (this.visit(children[i]) !== OPTIMIZABLE.FULL) return OPTIMIZABLE.PARTS;

    if (this.visitAttributes(tag.attrs) !== OPTIMIZABLE.FULL) return OPTIMIZABLE.PARTS;
    return OPTIMIZABLE.FULL;
  },
  visitAttributes: function (attrs) {
    if (attrs) {
      var isArray = HTML.isArray(attrs);

      for (var i = 0; i < (isArray ? attrs.length : 1); i++) {
        var a = isArray ? attrs[i] : attrs;
        if (typeof a !== 'object' || a instanceof HTMLTools.TemplateTag) return OPTIMIZABLE.PARTS;

        for (var k in a) if (this.visit(a[k]) !== OPTIMIZABLE.FULL) return OPTIMIZABLE.PARTS;
      }
    }

    return OPTIMIZABLE.FULL;
  }
});

var getOptimizability = function (content) {
  return new CanOptimizeVisitor().visit(content);
};

function toRaw(x) {
  return HTML.Raw(HTML.toHTML(x));
}

const TreeTransformer = HTML.TransformingVisitor.extend();
TreeTransformer.def({
  visitAttributes: function (attrs
  /*, ...*/
  ) {
    // pass template tags through by default
    if (attrs instanceof HTMLTools.TemplateTag) return attrs;
    return HTML.TransformingVisitor.prototype.visitAttributes.apply(this, arguments);
  }
}); // Replace parts of the HTMLjs tree that have no template tags (or
// tricky HTML tags) with HTML.Raw objects containing raw HTML.

var OptimizingVisitor = TreeTransformer.extend();
OptimizingVisitor.def({
  visitNull: toRaw,
  visitPrimitive: toRaw,
  visitComment: toRaw,
  visitCharRef: toRaw,
  visitArray: function (array) {
    var optimizability = getOptimizability(array);

    if (optimizability === OPTIMIZABLE.FULL) {
      return toRaw(array);
    } else if (optimizability === OPTIMIZABLE.PARTS) {
      return TreeTransformer.prototype.visitArray.call(this, array);
    } else {
      return array;
    }
  },
  visitTag: function (tag) {
    var optimizability = getOptimizability(tag);

    if (optimizability === OPTIMIZABLE.FULL) {
      return toRaw(tag);
    } else if (optimizability === OPTIMIZABLE.PARTS) {
      return TreeTransformer.prototype.visitTag.call(this, tag);
    } else {
      return tag;
    }
  },
  visitChildren: function (children) {
    // don't optimize the children array into a Raw object!
    return TreeTransformer.prototype.visitArray.call(this, children);
  },
  visitAttributes: function (attrs) {
    return attrs;
  }
}); // Combine consecutive HTML.Raws.  Remove empty ones.

var RawCompactingVisitor = TreeTransformer.extend();
RawCompactingVisitor.def({
  visitArray: function (array) {
    var result = [];

    for (var i = 0; i < array.length; i++) {
      var item = array[i];

      if (item instanceof HTML.Raw && (!item.value || result.length && result[result.length - 1] instanceof HTML.Raw)) {
        // two cases: item is an empty Raw, or previous item is
        // a Raw as well.  In the latter case, replace the previous
        // Raw with a longer one that includes the new Raw.
        if (item.value) {
          result[result.length - 1] = HTML.Raw(result[result.length - 1].value + item.value);
        }
      } else {
        result.push(this.visit(item));
      }
    }

    return result;
  }
}); // Replace pointless Raws like `HTMl.Raw('foo')` that contain no special
// characters with simple strings.

var RawReplacingVisitor = TreeTransformer.extend();
RawReplacingVisitor.def({
  visitRaw: function (raw) {
    var html = raw.value;

    if (html.indexOf('&') < 0 && html.indexOf('<') < 0) {
      return html;
    } else {
      return raw;
    }
  }
});

function optimize(tree) {
  tree = new OptimizingVisitor().visit(tree);
  tree = new RawCompactingVisitor().visit(tree);
  tree = new RawReplacingVisitor().visit(tree);
  return tree;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"react.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/react.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  ReactComponentSiblingForbidder: () => ReactComponentSiblingForbidder
});
let HTMLTools;
module.link("meteor/html-tools", {
  HTMLTools(v) {
    HTMLTools = v;
  }

}, 0);
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 1);
let BlazeTools;
module.link("meteor/blaze-tools", {
  BlazeTools(v) {
    BlazeTools = v;
  }

}, 2);
const ReactComponentSiblingForbidder = HTML.Visitor.extend();
ReactComponentSiblingForbidder.def({
  visitArray: function (array, parentTag) {
    for (var i = 0; i < array.length; i++) {
      this.visit(array[i], parentTag);
    }
  },
  visitObject: function (obj, parentTag) {
    if (obj.type === "INCLUSION" && obj.path.length === 1 && obj.path[0] === "React") {
      if (!parentTag) {
        throw new Error("{{> React}} must be used in a container element" + (this.sourceName ? " in " + this.sourceName : "") + ". Learn more at https://github.com/meteor/meteor/wiki/React-components-must-be-the-only-thing-in-their-wrapper-element");
      }

      var numSiblings = 0;

      for (var i = 0; i < parentTag.children.length; i++) {
        var child = parentTag.children[i];

        if (child !== obj && !(typeof child === "string" && child.match(/^\s*$/))) {
          numSiblings++;
        }
      }

      if (numSiblings > 0) {
        throw new Error("{{> React}} must be used as the only child in a container element" + (this.sourceName ? " in " + this.sourceName : "") + ". Learn more at https://github.com/meteor/meteor/wiki/React-components-must-be-the-only-thing-in-their-wrapper-element");
      }
    }
  },
  visitTag: function (tag) {
    this.visitArray(tag.children, tag
    /*parentTag*/
    );
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"templatetag.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/templatetag.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  TemplateTag: () => TemplateTag
});
let HTMLTools;
module.link("meteor/html-tools", {
  HTMLTools(v) {
    HTMLTools = v;
  }

}, 0);
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 1);
let BlazeTools;
module.link("meteor/blaze-tools", {
  BlazeTools(v) {
    BlazeTools = v;
  }

}, 2);
// A TemplateTag is the result of parsing a single `{{...}}` tag.
//
// The `.type` of a TemplateTag is one of:
//
// - `"DOUBLE"` - `{{foo}}`
// - `"TRIPLE"` - `{{{foo}}}`
// - `"EXPR"` - `(foo)`
// - `"COMMENT"` - `{{! foo}}`
// - `"BLOCKCOMMENT" - `{{!-- foo--}}`
// - `"INCLUSION"` - `{{> foo}}`
// - `"BLOCKOPEN"` - `{{#foo}}`
// - `"BLOCKCLOSE"` - `{{/foo}}`
// - `"ELSE"` - `{{else}}`
// - `"ESCAPE"` - `{{|`, `{{{|`, `{{{{|` and so on
//
// Besides `type`, the mandatory properties of a TemplateTag are:
//
// - `path` - An array of one or more strings.  The path of `{{foo.bar}}`
//   is `["foo", "bar"]`.  Applies to DOUBLE, TRIPLE, INCLUSION, BLOCKOPEN,
//   BLOCKCLOSE, and ELSE.
//
// - `args` - An array of zero or more argument specs.  An argument spec
//   is a two or three element array, consisting of a type, value, and
//   optional keyword name.  For example, the `args` of `{{foo "bar" x=3}}`
//   are `[["STRING", "bar"], ["NUMBER", 3, "x"]]`.  Applies to DOUBLE,
//   TRIPLE, INCLUSION, BLOCKOPEN, and ELSE.
//
// - `value` - A string of the comment's text. Applies to COMMENT and
//   BLOCKCOMMENT.
//
// These additional are typically set during parsing:
//
// - `position` - The HTMLTools.TEMPLATE_TAG_POSITION specifying at what sort
//   of site the TemplateTag was encountered (e.g. at element level or as
//   part of an attribute value). Its absence implies
//   TEMPLATE_TAG_POSITION.ELEMENT.
//
// - `content` and `elseContent` - When a BLOCKOPEN tag's contents are
//   parsed, they are put here.  `elseContent` will only be present if
//   an `{{else}}` was found.
var TEMPLATE_TAG_POSITION = HTMLTools.TEMPLATE_TAG_POSITION;

function TemplateTag() {
  HTMLTools.TemplateTag.apply(this, arguments);
}

TemplateTag.prototype = new HTMLTools.TemplateTag();
TemplateTag.prototype.constructorName = 'SpacebarsCompiler.TemplateTag';

var makeStacheTagStartRegex = function (r) {
  return new RegExp(r.source + /(?![{>!#/])/.source, r.ignoreCase ? 'i' : '');
}; // "starts" regexes are used to see what type of template
// tag the parser is looking at.  They must match a non-empty
// result, but not the interesting part of the tag.


var starts = {
  ESCAPE: /^\{\{(?=\{*\|)/,
  ELSE: makeStacheTagStartRegex(/^\{\{\s*else(\s+(?!\s)|(?=[}]))/i),
  DOUBLE: makeStacheTagStartRegex(/^\{\{\s*(?!\s)/),
  TRIPLE: makeStacheTagStartRegex(/^\{\{\{\s*(?!\s)/),
  BLOCKCOMMENT: makeStacheTagStartRegex(/^\{\{\s*!--/),
  COMMENT: makeStacheTagStartRegex(/^\{\{\s*!/),
  INCLUSION: makeStacheTagStartRegex(/^\{\{\s*>\s*(?!\s)/),
  BLOCKOPEN: makeStacheTagStartRegex(/^\{\{\s*#\s*(?!\s)/),
  BLOCKCLOSE: makeStacheTagStartRegex(/^\{\{\s*\/\s*(?!\s)/)
};
var ends = {
  DOUBLE: /^\s*\}\}/,
  TRIPLE: /^\s*\}\}\}/,
  EXPR: /^\s*\)/
};
var endsString = {
  DOUBLE: '}}',
  TRIPLE: '}}}',
  EXPR: ')'
}; // Parse a tag from the provided scanner or string.  If the input
// doesn't start with `{{`, returns null.  Otherwise, either succeeds
// and returns a SpacebarsCompiler.TemplateTag, or throws an error (using
// `scanner.fatal` if a scanner is provided).

TemplateTag.parse = function (scannerOrString) {
  var scanner = scannerOrString;
  if (typeof scanner === 'string') scanner = new HTMLTools.Scanner(scannerOrString);
  if (!(scanner.peek() === '{' && scanner.rest().slice(0, 2) === '{{')) return null;

  var run = function (regex) {
    // regex is assumed to start with `^`
    var result = regex.exec(scanner.rest());
    if (!result) return null;
    var ret = result[0];
    scanner.pos += ret.length;
    return ret;
  };

  var advance = function (amount) {
    scanner.pos += amount;
  };

  var scanIdentifier = function (isFirstInPath) {
    var id = BlazeTools.parseExtendedIdentifierName(scanner);

    if (!id) {
      expected('IDENTIFIER');
    }

    if (isFirstInPath && (id === 'null' || id === 'true' || id === 'false')) scanner.fatal("Can't use null, true, or false, as an identifier at start of path");
    return id;
  };

  var scanPath = function () {
    var segments = []; // handle initial `.`, `..`, `./`, `../`, `../..`, `../../`, etc

    var dots;

    if (dots = run(/^[\.\/]+/)) {
      var ancestorStr = '.'; // eg `../../..` maps to `....`

      var endsWithSlash = /\/$/.test(dots);
      if (endsWithSlash) dots = dots.slice(0, -1);
      dots.split('/').forEach(function (dotClause, index) {
        if (index === 0) {
          if (dotClause !== '.' && dotClause !== '..') expected("`.`, `..`, `./` or `../`");
        } else {
          if (dotClause !== '..') expected("`..` or `../`");
        }

        if (dotClause === '..') ancestorStr += '.';
      });
      segments.push(ancestorStr);
      if (!endsWithSlash) return segments;
    }

    while (true) {
      // scan a path segment
      if (run(/^\[/)) {
        var seg = run(/^[\s\S]*?\]/);
        if (!seg) error("Unterminated path segment");
        seg = seg.slice(0, -1);
        if (!seg && !segments.length) error("Path can't start with empty string");
        segments.push(seg);
      } else {
        var id = scanIdentifier(!segments.length);

        if (id === 'this') {
          if (!segments.length) {
            // initial `this`
            segments.push('.');
          } else {
            error("Can only use `this` at the beginning of a path.\nInstead of `foo.this` or `../this`, just write `foo` or `..`.");
          }
        } else {
          segments.push(id);
        }
      }

      var sep = run(/^[\.\/]/);
      if (!sep) break;
    }

    return segments;
  }; // scan the keyword portion of a keyword argument
  // (the "foo" portion in "foo=bar").
  // Result is either the keyword matched, or null
  // if we're not at a keyword argument position.


  var scanArgKeyword = function () {
    var match = /^([^\{\}\(\)\>#=\s"'\[\]]+)\s*=\s*/.exec(scanner.rest());

    if (match) {
      scanner.pos += match[0].length;
      return match[1];
    } else {
      return null;
    }
  }; // scan an argument; succeeds or errors.
  // Result is an array of two or three items:
  // type , value, and (indicating a keyword argument)
  // keyword name.


  var scanArg = function () {
    var keyword = scanArgKeyword(); // null if not parsing a kwarg

    var value = scanArgValue();
    return keyword ? value.concat(keyword) : value;
  }; // scan an argument value (for keyword or positional arguments);
  // succeeds or errors.  Result is an array of type, value.


  var scanArgValue = function () {
    var startPos = scanner.pos;
    var result;

    if (result = BlazeTools.parseNumber(scanner)) {
      return ['NUMBER', result.value];
    } else if (result = BlazeTools.parseStringLiteral(scanner)) {
      return ['STRING', result.value];
    } else if (/^[\.\[]/.test(scanner.peek())) {
      return ['PATH', scanPath()];
    } else if (run(/^\(/)) {
      return ['EXPR', scanExpr('EXPR')];
    } else if (result = BlazeTools.parseExtendedIdentifierName(scanner)) {
      var id = result;

      if (id === 'null') {
        return ['NULL', null];
      } else if (id === 'true' || id === 'false') {
        return ['BOOLEAN', id === 'true'];
      } else {
        scanner.pos = startPos; // unconsume `id`

        return ['PATH', scanPath()];
      }
    } else {
      expected('identifier, number, string, boolean, null, or a sub expression enclosed in "(", ")"');
    }
  };

  var scanExpr = function (type) {
    var endType = type;
    if (type === 'INCLUSION' || type === 'BLOCKOPEN' || type === 'ELSE') endType = 'DOUBLE';
    var tag = new TemplateTag();
    tag.type = type;
    tag.path = scanPath();
    tag.args = [];
    var foundKwArg = false;

    while (true) {
      run(/^\s*/);
      if (run(ends[endType])) break;else if (/^[})]/.test(scanner.peek())) {
        expected('`' + endsString[endType] + '`');
      }
      var newArg = scanArg();

      if (newArg.length === 3) {
        foundKwArg = true;
      } else {
        if (foundKwArg) error("Can't have a non-keyword argument after a keyword argument");
      }

      tag.args.push(newArg); // expect a whitespace or a closing ')' or '}'

      if (run(/^(?=[\s})])/) !== '') expected('space');
    }

    return tag;
  };

  var type;

  var error = function (msg) {
    scanner.fatal(msg);
  };

  var expected = function (what) {
    error('Expected ' + what);
  }; // must do ESCAPE first, immediately followed by ELSE
  // order of others doesn't matter


  if (run(starts.ESCAPE)) type = 'ESCAPE';else if (run(starts.ELSE)) type = 'ELSE';else if (run(starts.DOUBLE)) type = 'DOUBLE';else if (run(starts.TRIPLE)) type = 'TRIPLE';else if (run(starts.BLOCKCOMMENT)) type = 'BLOCKCOMMENT';else if (run(starts.COMMENT)) type = 'COMMENT';else if (run(starts.INCLUSION)) type = 'INCLUSION';else if (run(starts.BLOCKOPEN)) type = 'BLOCKOPEN';else if (run(starts.BLOCKCLOSE)) type = 'BLOCKCLOSE';else error('Unknown stache tag');
  var tag = new TemplateTag();
  tag.type = type;

  if (type === 'BLOCKCOMMENT') {
    var result = run(/^[\s\S]*?--\s*?\}\}/);
    if (!result) error("Unclosed block comment");
    tag.value = result.slice(0, result.lastIndexOf('--'));
  } else if (type === 'COMMENT') {
    var result = run(/^[\s\S]*?\}\}/);
    if (!result) error("Unclosed comment");
    tag.value = result.slice(0, -2);
  } else if (type === 'BLOCKCLOSE') {
    tag.path = scanPath();
    if (!run(ends.DOUBLE)) expected('`}}`');
  } else if (type === 'ELSE') {
    if (!run(ends.DOUBLE)) {
      tag = scanExpr(type);
    }
  } else if (type === 'ESCAPE') {
    var result = run(/^\{*\|/);
    tag.value = '{{' + result.slice(0, -1);
  } else {
    // DOUBLE, TRIPLE, BLOCKOPEN, INCLUSION
    tag = scanExpr(type);
  }

  return tag;
}; // Returns a SpacebarsCompiler.TemplateTag parsed from `scanner`, leaving scanner
// at its original position.
//
// An error will still be thrown if there is not a valid template tag at
// the current position.


TemplateTag.peek = function (scanner) {
  var startPos = scanner.pos;
  var result = TemplateTag.parse(scanner);
  scanner.pos = startPos;
  return result;
}; // Like `TemplateTag.parse`, but in the case of blocks, parse the complete
// `{{#foo}}...{{/foo}}` with `content` and possible `elseContent`, rather
// than just the BLOCKOPEN tag.
//
// In addition:
//
// - Throws an error if `{{else}}` or `{{/foo}}` tag is encountered.
//
// - Returns `null` for a COMMENT.  (This case is distinguishable from
//   parsing no tag by the fact that the scanner is advanced.)
//
// - Takes an HTMLTools.TEMPLATE_TAG_POSITION `position` and sets it as the
//   TemplateTag's `.position` property.
//
// - Validates the tag's well-formedness and legality at in its position.


TemplateTag.parseCompleteTag = function (scannerOrString, position) {
  var scanner = scannerOrString;
  if (typeof scanner === 'string') scanner = new HTMLTools.Scanner(scannerOrString);
  var startPos = scanner.pos; // for error messages

  var result = TemplateTag.parse(scannerOrString);
  if (!result) return result;
  if (result.type === 'BLOCKCOMMENT') return null;
  if (result.type === 'COMMENT') return null;
  if (result.type === 'ELSE') scanner.fatal("Unexpected {{else}}");
  if (result.type === 'BLOCKCLOSE') scanner.fatal("Unexpected closing template tag");
  position = position || TEMPLATE_TAG_POSITION.ELEMENT;
  if (position !== TEMPLATE_TAG_POSITION.ELEMENT) result.position = position;

  if (result.type === 'BLOCKOPEN') {
    // parse block contents
    // Construct a string version of `.path` for comparing start and
    // end tags.  For example, `foo/[0]` was parsed into `["foo", "0"]`
    // and now becomes `foo,0`.  This form may also show up in error
    // messages.
    var blockName = result.path.join(',');
    var textMode = null;

    if (blockName === 'markdown' || position === TEMPLATE_TAG_POSITION.IN_RAWTEXT) {
      textMode = HTML.TEXTMODE.STRING;
    } else if (position === TEMPLATE_TAG_POSITION.IN_RCDATA || position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {
      textMode = HTML.TEXTMODE.RCDATA;
    }

    var parserOptions = {
      getTemplateTag: TemplateTag.parseCompleteTag,
      shouldStop: isAtBlockCloseOrElse,
      textMode: textMode
    };
    result.textMode = textMode;
    result.content = HTMLTools.parseFragment(scanner, parserOptions);
    if (scanner.rest().slice(0, 2) !== '{{') scanner.fatal("Expected {{else}} or block close for " + blockName);
    var lastPos = scanner.pos; // save for error messages

    var tmplTag = TemplateTag.parse(scanner); // {{else}} or {{/foo}}

    var lastElseContentTag = result;

    while (tmplTag.type === 'ELSE') {
      if (lastElseContentTag === null) {
        scanner.fatal("Unexpected else after {{else}}");
      }

      if (tmplTag.path) {
        lastElseContentTag.elseContent = new TemplateTag();
        lastElseContentTag.elseContent.type = 'BLOCKOPEN';
        lastElseContentTag.elseContent.path = tmplTag.path;
        lastElseContentTag.elseContent.args = tmplTag.args;
        lastElseContentTag.elseContent.textMode = textMode;
        lastElseContentTag.elseContent.content = HTMLTools.parseFragment(scanner, parserOptions);
        lastElseContentTag = lastElseContentTag.elseContent;
      } else {
        // parse {{else}} and content up to close tag
        lastElseContentTag.elseContent = HTMLTools.parseFragment(scanner, parserOptions);
        lastElseContentTag = null;
      }

      if (scanner.rest().slice(0, 2) !== '{{') scanner.fatal("Expected block close for " + blockName);
      lastPos = scanner.pos;
      tmplTag = TemplateTag.parse(scanner);
    }

    if (tmplTag.type === 'BLOCKCLOSE') {
      var blockName2 = tmplTag.path.join(',');

      if (blockName !== blockName2) {
        scanner.pos = lastPos;
        scanner.fatal('Expected tag to close ' + blockName + ', found ' + blockName2);
      }
    } else {
      scanner.pos = lastPos;
      scanner.fatal('Expected tag to close ' + blockName + ', found ' + tmplTag.type);
    }
  }

  var finalPos = scanner.pos;
  scanner.pos = startPos;
  validateTag(result, scanner);
  scanner.pos = finalPos;
  return result;
};

var isAtBlockCloseOrElse = function (scanner) {
  // Detect `{{else}}` or `{{/foo}}`.
  //
  // We do as much work ourselves before deferring to `TemplateTag.peek`,
  // for efficiency (we're called for every input token) and to be
  // less obtrusive, because `TemplateTag.peek` will throw an error if it
  // sees `{{` followed by a malformed tag.
  var rest, type;
  return scanner.peek() === '{' && (rest = scanner.rest()).slice(0, 2) === '{{' && /^\{\{\s*(\/|else\b)/.test(rest) && (type = TemplateTag.peek(scanner).type) && (type === 'BLOCKCLOSE' || type === 'ELSE');
}; // Validate that `templateTag` is correctly formed and legal for its
// HTML position.  Use `scanner` to report errors. On success, does
// nothing.


var validateTag = function (ttag, scanner) {
  if (ttag.type === 'INCLUSION' || ttag.type === 'BLOCKOPEN') {
    var args = ttag.args;

    if (ttag.path[0] === 'each' && args[1] && args[1][0] === 'PATH' && args[1][1][0] === 'in') {// For slightly better error messages, we detect the each-in case
      // here in order not to complain if the user writes `{{#each 3 in x}}`
      // that "3 is not a function"
    } else {
      if (args.length > 1 && args[0].length === 2 && args[0][0] !== 'PATH') {
        // we have a positional argument that is not a PATH followed by
        // other arguments
        scanner.fatal("First argument must be a function, to be called on " + "the rest of the arguments; found " + args[0][0]);
      }
    }
  }

  var position = ttag.position || TEMPLATE_TAG_POSITION.ELEMENT;

  if (position === TEMPLATE_TAG_POSITION.IN_ATTRIBUTE) {
    if (ttag.type === 'DOUBLE' || ttag.type === 'ESCAPE') {
      return;
    } else if (ttag.type === 'BLOCKOPEN') {
      var path = ttag.path;
      var path0 = path[0];

      if (!(path.length === 1 && (path0 === 'if' || path0 === 'unless' || path0 === 'with' || path0 === 'each'))) {
        scanner.fatal("Custom block helpers are not allowed in an HTML attribute, only built-in ones like #each and #if");
      }
    } else {
      scanner.fatal(ttag.type + " template tag is not allowed in an HTML attribute");
    }
  } else if (position === TEMPLATE_TAG_POSITION.IN_START_TAG) {
    if (!(ttag.type === 'DOUBLE')) {
      scanner.fatal("Reactive HTML attributes must either have a constant name or consist of a single {{helper}} providing a dictionary of names and values.  A template tag of type " + ttag.type + " is not allowed here.");
    }

    if (scanner.peek() === '=') {
      scanner.fatal("Template tags are not allowed in attribute names, only in attribute values or in the form of a single {{helper}} that evaluates to a dictionary of name=value pairs.");
    }
  }
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"whitespace.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/spacebars-compiler/whitespace.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  removeWhitespace: () => removeWhitespace
});
let HTML;
module.link("meteor/htmljs", {
  HTML(v) {
    HTML = v;
  }

}, 0);
let TreeTransformer, toRaw;
module.link("./optimizer", {
  TreeTransformer(v) {
    TreeTransformer = v;
  },

  toRaw(v) {
    toRaw = v;
  }

}, 1);

function compactRaw(array) {
  var result = [];

  for (var i = 0; i < array.length; i++) {
    var item = array[i];

    if (item instanceof HTML.Raw) {
      if (!item.value) {
        continue;
      }

      if (result.length && result[result.length - 1] instanceof HTML.Raw) {
        result[result.length - 1] = HTML.Raw(result[result.length - 1].value + item.value);
        continue;
      }
    }

    result.push(item);
  }

  return result;
}

function replaceIfContainsNewline(match) {
  if (match.indexOf('\n') >= 0) {
    return '';
  }

  return match;
}

function stripWhitespace(array) {
  var result = [];

  for (var i = 0; i < array.length; i++) {
    var item = array[i];

    if (item instanceof HTML.Raw) {
      // remove nodes that contain only whitespace & a newline
      if (item.value.indexOf('\n') !== -1 && !/\S/.test(item.value)) {
        continue;
      } // Trim any preceding whitespace, if it contains a newline


      var newStr = item.value;
      newStr = newStr.replace(/^\s+/, replaceIfContainsNewline);
      newStr = newStr.replace(/\s+$/, replaceIfContainsNewline);
      item.value = newStr;
    }

    result.push(item);
  }

  return result;
}

var WhitespaceRemovingVisitor = TreeTransformer.extend();
WhitespaceRemovingVisitor.def({
  visitNull: toRaw,
  visitPrimitive: toRaw,
  visitCharRef: toRaw,
  visitArray: function (array) {
    // this.super(array)
    var result = TreeTransformer.prototype.visitArray.call(this, array);
    result = compactRaw(result);
    result = stripWhitespace(result);
    return result;
  },
  visitTag: function (tag) {
    var tagName = tag.tagName; // TODO - List tags that we don't want to strip whitespace for.

    if (tagName === 'textarea' || tagName === 'script' || tagName === 'pre' || !HTML.isKnownElement(tagName) || HTML.isKnownSVGElement(tagName)) {
      return tag;
    }

    return TreeTransformer.prototype.visitTag.call(this, tag);
  },
  visitAttributes: function (attrs) {
    return attrs;
  }
});

function removeWhitespace(tree) {
  tree = new WhitespaceRemovingVisitor().visit(tree);
  return tree;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/spacebars-compiler/preamble.js");

/* Exports */
Package._define("spacebars-compiler", exports, {
  SpacebarsCompiler: SpacebarsCompiler
});

})();




//# sourceURL=meteor://💻app/packages/spacebars-compiler.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3BhY2ViYXJzLWNvbXBpbGVyL3ByZWFtYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zcGFjZWJhcnMtY29tcGlsZXIvY29kZWdlbi5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3BhY2ViYXJzLWNvbXBpbGVyL2NvbXBpbGVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zcGFjZWJhcnMtY29tcGlsZXIvb3B0aW1pemVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9zcGFjZWJhcnMtY29tcGlsZXIvcmVhY3QuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3NwYWNlYmFycy1jb21waWxlci90ZW1wbGF0ZXRhZy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvc3BhY2ViYXJzLWNvbXBpbGVyL3doaXRlc3BhY2UuanMiXSwibmFtZXMiOlsibW9kdWxlIiwiZXhwb3J0IiwiU3BhY2ViYXJzQ29tcGlsZXIiLCJDb2RlR2VuIiwiYnVpbHRJbkJsb2NrSGVscGVycyIsImlzUmVzZXJ2ZWROYW1lIiwibGluayIsInYiLCJvcHRpbWl6ZSIsInBhcnNlIiwiY29tcGlsZSIsImNvZGVHZW4iLCJUZW1wbGF0ZVRhZ1JlcGxhY2VyIiwiYmVhdXRpZnkiLCJUZW1wbGF0ZVRhZyIsIl9idWlsdEluQmxvY2tIZWxwZXJzIiwiX1RlbXBsYXRlVGFnUmVwbGFjZXIiLCJfYmVhdXRpZnkiLCJIVE1MVG9vbHMiLCJIVE1MIiwiQmxhemVUb29scyIsImJ1aWx0SW5UZW1wbGF0ZU1hY3JvcyIsImFkZGl0aW9uYWxSZXNlcnZlZE5hbWVzIiwibmFtZSIsImhhc093blByb3BlcnR5IiwiaW5jbHVkZXMiLCJtYWtlT2JqZWN0TGl0ZXJhbCIsIm9iaiIsInBhcnRzIiwiayIsInB1c2giLCJ0b09iamVjdExpdGVyYWxLZXkiLCJqb2luIiwiT2JqZWN0IiwiYXNzaWduIiwicHJvdG90eXBlIiwiY29kZUdlblRlbXBsYXRlVGFnIiwidGFnIiwic2VsZiIsInBvc2l0aW9uIiwiVEVNUExBVEVfVEFHX1BPU0lUSU9OIiwiSU5fU1RBUlRfVEFHIiwiRW1pdENvZGUiLCJjb2RlR2VuTXVzdGFjaGUiLCJwYXRoIiwiYXJncyIsInR5cGUiLCJjb2RlIiwiSU5fQVRUUklCVVRFIiwidG9KU0xpdGVyYWwiLCJsZW5ndGgiLCJFcnJvciIsImRhdGFDb2RlIiwiZWFjaFVzYWdlIiwiaW5BcmciLCJ2YXJpYWJsZUFyZyIsInJlcGxhY2UiLCJ2YXJpYWJsZSIsImNvZGVHZW5JbmNsdXNpb25EYXRhIiwic2xpY2UiLCJkYXRhUHJvcHMiLCJmb3JFYWNoIiwiYXJnIiwiYXJnS2V5IiwiY29kZUdlbkFyZ1ZhbHVlIiwiY29kZUdlbkluY2x1c2lvbkRhdGFGdW5jIiwiY29udGVudEJsb2NrIiwiY29kZUdlbkJsb2NrIiwiY29udGVudCIsImVsc2VDb250ZW50QmxvY2siLCJlbHNlQ29udGVudCIsImNhbGxBcmdzIiwiY29tcENvZGUiLCJjb2RlR2VuUGF0aCIsImxvb2t1cFRlbXBsYXRlIiwiaW5jbHVkZUFyZ3MiLCJpbmNsdWRlQ29kZSIsInZhbHVlIiwib3B0cyIsImZpcnN0UGF0aEl0ZW0iLCJsb29rdXBNZXRob2QiLCJtYXAiLCJhcmdUeXBlIiwiYXJnVmFsdWUiLCJhcmdDb2RlIiwibXVzdGFjaGVUeXBlIiwibmFtZUNvZGUiLCJjb2RlR2VuTXVzdGFjaGVBcmdzIiwibXVzdGFjaGUiLCJ0YWdBcmdzIiwia3dBcmdzIiwiTWV0ZW9yIiwiUmVhY3RDb21wb25lbnRTaWJsaW5nRm9yYmlkZGVyIiwicmVtb3ZlV2hpdGVzcGFjZSIsIlVnbGlmeUpTTWluaWZ5IiwiaXNTZXJ2ZXIiLCJOcG0iLCJyZXF1aXJlIiwibWluaWZ5IiwiaW5wdXQiLCJwYXJzZUZyYWdtZW50IiwiZ2V0VGVtcGxhdGVUYWciLCJwYXJzZUNvbXBsZXRlVGFnIiwib3B0aW9ucyIsInRyZWUiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiZXh0ZW5kIiwiZGVmIiwidmlzaXRPYmplY3QiLCJ4IiwiaW5BdHRyaWJ1dGVWYWx1ZSIsImNvZGVnZW4iLCJjYWxsIiwidmlzaXRBdHRyaWJ1dGVzIiwiYXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZSIsInJlc3VsdCIsInZpc2l0IiwicGFyc2VUcmVlIiwiaXNUZW1wbGF0ZSIsImlzQm9keSIsIndoaXRlc3BhY2UiLCJzb3VyY2VOYW1lIiwidG9Mb3dlckNhc2UiLCJ0b0pTIiwiZnJvbVN0cmluZyIsIm1hbmdsZSIsImNvbXByZXNzIiwib3V0cHV0IiwiaW5kZW50X2xldmVsIiwid2lkdGgiLCJ0b1JhdyIsIlRyZWVUcmFuc2Zvcm1lciIsImNvbnN0YW50IiwiT1BUSU1JWkFCTEUiLCJOT05FIiwiUEFSVFMiLCJGVUxMIiwiQ2FuT3B0aW1pemVWaXNpdG9yIiwiVmlzaXRvciIsInZpc2l0TnVsbCIsInZpc2l0UHJpbWl0aXZlIiwidmlzaXRDb21tZW50IiwidmlzaXRDaGFyUmVmIiwidmlzaXRSYXciLCJ2aXNpdEZ1bmN0aW9uIiwidmlzaXRBcnJheSIsImkiLCJ2aXNpdFRhZyIsInRhZ05hbWUiLCJpc0tub3duRWxlbWVudCIsImlzS25vd25TVkdFbGVtZW50IiwiY2hpbGRyZW4iLCJpc0FycmF5IiwiYSIsImdldE9wdGltaXphYmlsaXR5IiwiUmF3IiwidG9IVE1MIiwiYXBwbHkiLCJhcmd1bWVudHMiLCJPcHRpbWl6aW5nVmlzaXRvciIsImFycmF5Iiwib3B0aW1pemFiaWxpdHkiLCJ2aXNpdENoaWxkcmVuIiwiUmF3Q29tcGFjdGluZ1Zpc2l0b3IiLCJpdGVtIiwiUmF3UmVwbGFjaW5nVmlzaXRvciIsInJhdyIsImh0bWwiLCJpbmRleE9mIiwicGFyZW50VGFnIiwibnVtU2libGluZ3MiLCJjaGlsZCIsIm1hdGNoIiwiY29uc3RydWN0b3JOYW1lIiwibWFrZVN0YWNoZVRhZ1N0YXJ0UmVnZXgiLCJyIiwiUmVnRXhwIiwic291cmNlIiwiaWdub3JlQ2FzZSIsInN0YXJ0cyIsIkVTQ0FQRSIsIkVMU0UiLCJET1VCTEUiLCJUUklQTEUiLCJCTE9DS0NPTU1FTlQiLCJDT01NRU5UIiwiSU5DTFVTSU9OIiwiQkxPQ0tPUEVOIiwiQkxPQ0tDTE9TRSIsImVuZHMiLCJFWFBSIiwiZW5kc1N0cmluZyIsInNjYW5uZXJPclN0cmluZyIsInNjYW5uZXIiLCJTY2FubmVyIiwicGVlayIsInJlc3QiLCJydW4iLCJyZWdleCIsImV4ZWMiLCJyZXQiLCJwb3MiLCJhZHZhbmNlIiwiYW1vdW50Iiwic2NhbklkZW50aWZpZXIiLCJpc0ZpcnN0SW5QYXRoIiwiaWQiLCJwYXJzZUV4dGVuZGVkSWRlbnRpZmllck5hbWUiLCJleHBlY3RlZCIsImZhdGFsIiwic2NhblBhdGgiLCJzZWdtZW50cyIsImRvdHMiLCJhbmNlc3RvclN0ciIsImVuZHNXaXRoU2xhc2giLCJ0ZXN0Iiwic3BsaXQiLCJkb3RDbGF1c2UiLCJpbmRleCIsInNlZyIsImVycm9yIiwic2VwIiwic2NhbkFyZ0tleXdvcmQiLCJzY2FuQXJnIiwia2V5d29yZCIsInNjYW5BcmdWYWx1ZSIsImNvbmNhdCIsInN0YXJ0UG9zIiwicGFyc2VOdW1iZXIiLCJwYXJzZVN0cmluZ0xpdGVyYWwiLCJzY2FuRXhwciIsImVuZFR5cGUiLCJmb3VuZEt3QXJnIiwibmV3QXJnIiwibXNnIiwid2hhdCIsImxhc3RJbmRleE9mIiwiRUxFTUVOVCIsImJsb2NrTmFtZSIsInRleHRNb2RlIiwiSU5fUkFXVEVYVCIsIlRFWFRNT0RFIiwiU1RSSU5HIiwiSU5fUkNEQVRBIiwiUkNEQVRBIiwicGFyc2VyT3B0aW9ucyIsInNob3VsZFN0b3AiLCJpc0F0QmxvY2tDbG9zZU9yRWxzZSIsImxhc3RQb3MiLCJ0bXBsVGFnIiwibGFzdEVsc2VDb250ZW50VGFnIiwiYmxvY2tOYW1lMiIsImZpbmFsUG9zIiwidmFsaWRhdGVUYWciLCJ0dGFnIiwicGF0aDAiLCJjb21wYWN0UmF3IiwicmVwbGFjZUlmQ29udGFpbnNOZXdsaW5lIiwic3RyaXBXaGl0ZXNwYWNlIiwibmV3U3RyIiwiV2hp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R0FBVixFQUFlO0FBQ3ZCLFFBQUlnSCxPQUFPLEdBQUdoSCxHQUFHLENBQUNnSCxPQUFsQixDQUR1QixDQUV2Qjs7QUFDQSxRQUFJQSxPQUFPLEtBQUssVUFBWixJQUEwQkEsT0FBTyxLQUFLLFFBQXRDLElBQWtEQSxPQUFPLEtBQUssS0FBOUQsSUFDQyxDQUFDbEksSUFBSSxDQUFDbUksY0FBTCxDQUFvQkQsT0FBcEIsQ0FERixJQUNrQ2xJLElBQUksQ0FBQ29JLGlCQUFMLENBQXVCRixPQUF2QixDQUR0QyxFQUN1RTtBQUNyRSxhQUFPaEgsR0FBUDtBQUNEOztBQUNELFdBQU8rRixlQUFlLENBQUNqRyxTQUFoQixDQUEwQmlILFFBQTFCLENBQW1DcEMsSUFBbkMsQ0FBd0MsSUFBeEMsRUFBOEMzRSxHQUE5QyxDQUFQO0FBQ0QsR0FuQjJCO0FBb0I1QjRFLGlCQUFlLEVBQUUsVUFBVUMsS0FBVixFQUFpQjtBQUNoQyxXQUFPQSxLQUFQO0FBQ0Q7QUF0QjJCLENBQTlCOztBQTBCTyxTQUFTckIsZ0JBQVQsQ0FBMEJXLElBQTFCLEVBQWdDO0FBQ3JDQSxNQUFJLEdBQUksSUFBSTZKLHlCQUFKLEVBQUQsQ0FBZ0NoSixLQUFoQyxDQUFzQ2IsSUFBdEMsQ0FBUDtBQUNBLFNBQU9BLElBQVA7QUFDRCxDIiwiZmlsZSI6Ii9wYWNrYWdlcy9zcGFjZWJhcnMtY29tcGlsZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDb2RlR2VuLCBidWlsdEluQmxvY2tIZWxwZXJzLCBpc1Jlc2VydmVkTmFtZSB9IGZyb20gJy4vY29kZWdlbic7XG5pbXBvcnQgeyBvcHRpbWl6ZSB9IGZyb20gJy4vb3B0aW1pemVyJztcbmltcG9ydCB7IHBhcnNlLCBjb21waWxlLCBjb2RlR2VuLCBUZW1wbGF0ZVRhZ1JlcGxhY2VyLCBiZWF1dGlmeSB9IGZyb20gJy4vY29tcGlsZXInO1xuaW1wb3J0IHsgVGVtcGxhdGVUYWcgfSBmcm9tICcuL3RlbXBsYXRldGFnJztcblxuU3BhY2ViYXJzQ29tcGlsZXIgPSB7XG4gIENvZGVHZW4sXG4gIF9idWlsdEluQmxvY2tIZWxwZXJzOiBidWlsdEluQmxvY2tIZWxwZXJzLFxuICBpc1Jlc2VydmVkTmFtZSxcbiAgb3B0aW1pemUsXG4gIHBhcnNlLFxuICBjb21waWxlLFxuICBjb2RlR2VuLFxuICBfVGVtcGxhdGVUYWdSZXBsYWNlcjogVGVtcGxhdGVUYWdSZXBsYWNlcixcbiAgX2JlYXV0aWZ5OiBiZWF1dGlmeSxcbiAgVGVtcGxhdGVUYWcsXG59O1xuXG5leHBvcnQgeyBTcGFjZWJhcnNDb21waWxlciB9O1xuIiwiaW1wb3J0IHsgSFRNTFRvb2xzIH0gZnJvbSAnbWV0ZW9yL2h0bWwtdG9vbHMnO1xuaW1wb3J0IHsgSFRNTCB9IGZyb20gJ21ldGVvci9odG1sanMnO1xuaW1wb3J0IHsgQmxhemVUb29scyB9IGZyb20gJ21ldGVvci9ibGF6ZS10b29scyc7XG5pbXBvcnQgeyBjb2RlR2VuIH0gZnJvbSAnLi9jb21waWxlcic7XG5cblxuLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4vLyBDb2RlLWdlbmVyYXRpb24gb2YgdGVtcGxhdGUgdGFnc1xuXG4vLyBUaGUgYENvZGVHZW5gIGNsYXNzIGN1cnJlbnRseSBoYXMgbm8gaW5zdGFuY2Ugc3RhdGUsIGJ1dCBpbiB0aGVvcnlcbi8vIGl0IGNvdWxkIGJlIHVzZWZ1bCB0byB0cmFjayBwZXItZnVuY3Rpb24gc3RhdGUsIGxpa2Ugd2hldGhlciB3ZVxuLy8gbmVlZCB0byBlbWl0IGB2YXIgc2VsZiA9IHRoaXNgIG9yIG5vdC5cbmV4cG9ydCBmdW5jdGlvbiBDb2RlR2VuKCkge31cblxuZXhwb3J0IGNvbnN0IGJ1aWx0SW5CbG9ja0hlbHBlcnMgPSB7XG4gICdpZic6ICdCbGF6ZS5JZicsXG4gICd1bmxlc3MnOiAnQmxhemUuVW5sZXNzJyxcbiAgJ3dpdGgnOiAnU3BhY2ViYXJzLldpdGgnLFxuICAnZWFjaCc6ICdCbGF6ZS5FYWNoJyxcbiAgJ2xldCc6ICdCbGF6ZS5MZXQnXG59O1xuXG5cbi8vIE1hcHBpbmcgb2YgXCJtYWNyb3NcIiB3aGljaCwgd2hlbiBwcmVjZWRlZCBieSBgVGVtcGxhdGUuYCwgZXhwYW5kXG4vLyB0byBzcGVjaWFsIGNvZGUgcmF0aGVyIHRoYW4gZm9sbG93aW5nIHRoZSBsb29rdXAgcnVsZXMgZm9yIGRvdHRlZFxuLy8gc3ltYm9scy5cbnZhciBidWlsdEluVGVtcGxhdGVNYWNyb3MgPSB7XG4gIC8vIGB2aWV3YCBpcyBhIGxvY2FsIHZhcmlhYmxlIGRlZmluZWQgaW4gdGhlIGdlbmVyYXRlZCByZW5kZXJcbiAgLy8gZnVuY3Rpb24gZm9yIHRoZSB0ZW1wbGF0ZSBpbiB3aGljaCBgVGVtcGxhdGUuY29udGVudEJsb2NrYCBvclxuICAvLyBgVGVtcGxhdGUuZWxzZUJsb2NrYCBpcyBpbnZva2VkLlxuICAnY29udGVudEJsb2NrJzogJ3ZpZXcudGVtcGxhdGVDb250ZW50QmxvY2snLFxuICAnZWxzZUJsb2NrJzogJ3ZpZXcudGVtcGxhdGVFbHNlQmxvY2snLFxuXG4gIC8vIENvbmZ1c2luZ2x5LCB0aGlzIG1ha2VzIGB7ez4gVGVtcGxhdGUuZHluYW1pY319YCBhbiBhbGlhc1xuICAvLyBmb3IgYHt7PiBfX2R5bmFtaWN9fWAsIHdoZXJlIFwiX19keW5hbWljXCIgaXMgdGhlIHRlbXBsYXRlIHRoYXRcbiAgLy8gaW1wbGVtZW50cyB0aGUgZHluYW1pYyB0ZW1wbGF0ZSBmZWF0dXJlLlxuICAnZHluYW1pYyc6ICdUZW1wbGF0ZS5fX2R5bmFtaWMnLFxuXG4gICdzdWJzY3JpcHRpb25zUmVhZHknOiAndmlldy50ZW1wbGF0ZUluc3RhbmNlKCkuc3Vic2NyaXB0aW9uc1JlYWR5KCknXG59O1xuXG52YXIgYWRkaXRpb25hbFJlc2VydmVkTmFtZXMgPSBbXCJib2R5XCIsIFwidG9TdHJpbmdcIiwgXCJpbnN0YW5jZVwiLCAgXCJjb25zdHJ1Y3RvclwiLFxuICBcInRvU3RyaW5nXCIsIFwidG9Mb2NhbGVTdHJpbmdcIiwgXCJ2YWx1ZU9mXCIsIFwiaGFzT3duUHJvcGVydHlcIiwgXCJpc1Byb3RvdHlwZU9mXCIsXG4gIFwicHJvcGVydHlJc0VudW1lcmFibGVcIiwgXCJfX2RlZmluZUdldHRlcl9fXCIsIFwiX19sb29rdXBHZXR0ZXJfX1wiLFxuICBcIl9fZGVmaW5lU2V0dGVyX19cIiwgXCJfX2xvb2t1cFNldHRlcl9fXCIsIFwiX19wcm90b19fXCIsIFwiZHluYW1pY1wiLFxuICBcInJlZ2lzdGVySGVscGVyXCIsIFwiY3VycmVudERhdGFcIiwgXCJwYXJlbnREYXRhXCIsIFwiX21pZ3JhdGVUZW1wbGF0ZVwiLFxuICBcIl9hcHBseUhtckNoYW5nZXNcIiwgXCJfX3BlbmRpbmdSZXBsYWNlbWVudFwiXG5dO1xuXG4vLyBBIFwicmVzZXJ2ZWQgbmFtZVwiIGNhbid0IGJlIHVzZWQgYXMgYSA8dGVtcGxhdGU+IG5hbWUuICBUaGlzXG4vLyBmdW5jdGlvbiBpcyB1c2VkIGJ5IHRoZSB0ZW1wbGF0ZSBmaWxlIHNjYW5uZXIuXG4vL1xuLy8gTm90ZSB0aGF0IHRoZSBydW50aW1lIGltcG9zZXMgYWRkaXRpb25hbCByZXN0cmljdGlvbnMsIGZvciBleGFtcGxlXG4vLyBiYW5uaW5nIHRoZSBuYW1lIFwiYm9keVwiIGFuZCBuYW1lcyBvZiBidWlsdC1pbiBvYmplY3QgcHJvcGVydGllc1xuLy8gbGlrZSBcInRvU3RyaW5nXCIuXG5leHBvcnQgZnVuY3Rpb24gaXNSZXNlcnZlZE5hbWUobmFtZSkge1xuICByZXR1cm4gYnVpbHRJbkJsb2NrSGVscGVycy5oYXNPd25Qcm9wZXJ0eShuYW1lKSB8fFxuICAgIGJ1aWx0SW5UZW1wbGF0ZU1hY3Jvcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSB8fFxuICAgIGFkZGl0aW9uYWxSZXNlcnZlZE5hbWVzLmluY2x1ZGVzKG5hbWUpO1xufVxuXG52YXIgbWFrZU9iamVjdExpdGVyYWwgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHZhciBwYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBrIGluIG9iailcbiAgICBwYXJ0cy5wdXNoKEJsYXplVG9vbHMudG9PYmplY3RMaXRlcmFsS2V5KGspICsgJzogJyArIG9ialtrXSk7XG4gIHJldHVybiAneycgKyBwYXJ0cy5qb2luKCcsICcpICsgJ30nO1xufTtcblxuT2JqZWN0LmFzc2lnbihDb2RlR2VuLnByb3RvdHlwZSwge1xuICBjb2RlR2VuVGVtcGxhdGVUYWc6IGZ1bmN0aW9uICh0YWcpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRhZy5wb3NpdGlvbiA9PT0gSFRNTFRvb2xzLlRFTVBMQVRFX1RBR19QT1NJVElPTi5JTl9TVEFSVF9UQUcpIHtcbiAgICAgIC8vIFNwZWNpYWwgZHluYW1pYyBhdHRyaWJ1dGVzOiBgPGRpdiB7e2F0dHJzfX0+Li4uYFxuICAgICAgLy8gb25seSBgdGFnLnR5cGUgPT09ICdET1VCTEUnYCBhbGxvd2VkIChieSBlYXJsaWVyIHZhbGlkYXRpb24pXG4gICAgICByZXR1cm4gQmxhemVUb29scy5FbWl0Q29kZSgnZnVuY3Rpb24gKCkgeyByZXR1cm4gJyArXG4gICAgICAgICAgc2VsZi5jb2RlR2VuTXVzdGFjaGUodGFnLnBhdGgsIHRhZy5hcmdzLCAnYXR0ck11c3RhY2hlJylcbiAgICAgICAgICArICc7IH0nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHRhZy50eXBlID09PSAnRE9VQkxFJyB8fCB0YWcudHlwZSA9PT0gJ1RSSVBMRScpIHtcbiAgICAgICAgdmFyIGNvZGUgPSBzZWxmLmNvZGVHZW5NdXN0YWNoZSh0YWcucGF0aCwgdGFnLmFyZ3MpO1xuICAgICAgICBpZiAodGFnLnR5cGUgPT09ICdUUklQTEUnKSB7XG4gICAgICAgICAgY29kZSA9ICdTcGFjZWJhcnMubWFrZVJhdygnICsgY29kZSArICcpJztcbiAgICAgICAgfVxuICAgICAgICBpZiAodGFnLnBvc2l0aW9uICE9PSBIVE1MVG9vbHMuVEVNUExBVEVfVEFHX1BPU0lUSU9OLklOX0FUVFJJQlVURSkge1xuICAgICAgICAgIC8vIFJlYWN0aXZlIGF0dHJpYnV0ZXMgYXJlIGFscmVhZHkgd3JhcHBlZCBpbiBhIGZ1bmN0aW9uLFxuICAgICAgICAgIC8vIGFuZCB0aGVyZSdzIG5vIGZpbmUtZ3JhaW5lZCByZWFjdGl2aXR5LlxuICAgICAgICAgIC8vIEFueXdoZXJlIGVsc2UsIHdlIG5lZWQgdG8gY3JlYXRlIGEgVmlldy5cbiAgICAgICAgICBjb2RlID0gJ0JsYXplLlZpZXcoJyArXG4gICAgICAgICAgICBCbGF6ZVRvb2xzLnRvSlNMaXRlcmFsKCdsb29rdXA6JyArIHRhZy5wYXRoLmpvaW4oJy4nKSkgKyAnLCAnICtcbiAgICAgICAgICAgICdmdW5jdGlvbiAoKSB7IHJldHVybiAnICsgY29kZSArICc7IH0pJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gQmxhemVUb29scy5FbWl0Q29kZShjb2RlKTtcbiAgICAgIH0gZWxzZSBpZiAodGFnLnR5cGUgPT09ICdJTkNMVVNJT04nIHx8IHRhZy50eXBlID09PSAnQkxPQ0tPUEVOJykge1xuICAgICAgICB2YXIgcGF0aCA9IHRhZy5wYXRoO1xuICAgICAgICB2YXIgYXJncyA9IHRhZy5hcmdzO1xuXG4gICAgICAgIGlmICh0YWcudHlwZSA9PT0gJ0JMT0NLT1BFTicgJiZcbiAgICAgICAgICAgIGJ1aWx0SW5CbG9ja0hlbHBlcnMuaGFzT3duUHJvcGVydHkocGF0aFswXSkpIHtcbiAgICAgICAgICAvLyBpZiwgdW5sZXNzLCB3aXRoLCBlYWNoLlxuICAgICAgICAgIC8vXG4gICAgICAgICAgLy8gSWYgc29tZW9uZSB0cmllcyB0byBkbyBge3s+IGlmfX1gLCB3ZSBkb24ndFxuICAgICAgICAgIC8vIGdldCBoZXJlLCBidXQgYW4gZXJyb3IgaXMgdGhyb3duIHdoZW4gd2UgdHJ5IHRvIGNvZGVnZW4gdGhlIHBhdGguXG5cbiAgICAgICAgICAvLyBOb3RlOiBJZiB3ZSBjYXVnaHQgdGhlc2UgZXJyb3JzIGVhcmxpZXIsIHdoaWxlIHNjYW5uaW5nLCB3ZSdkIGJlIGFibGUgdG9cbiAgICAgICAgICAvLyBwcm92aWRlIG5pY2UgbGluZSBudW1iZXJzLlxuICAgICAgICAgIGlmIChwYXRoLmxlbmd0aCA+IDEpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGRvdHRlZCBwYXRoIGJlZ2lubmluZyB3aXRoIFwiICsgcGF0aFswXSk7XG4gICAgICAgICAgaWYgKCEgYXJncy5sZW5ndGgpXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCIjXCIgKyBwYXRoWzBdICsgXCIgcmVxdWlyZXMgYW4gYXJndW1lbnRcIik7XG5cbiAgICAgICAgICB2YXIgZGF0YUNvZGUgPSBudWxsO1xuICAgICAgICAgIC8vICNlYWNoIGhhcyBhIHNwZWNpYWwgdHJlYXRtZW50IGFzIGl0IGZlYXR1cmVzIHR3byBkaWZmZXJlbnQgZm9ybXM6XG4gICAgICAgICAgLy8gLSB7eyNlYWNoIHBlb3BsZX19XG4gICAgICAgICAgLy8gLSB7eyNlYWNoIHBlcnNvbiBpbiBwZW9wbGV9fVxuICAgICAgICAgIGlmIChwYXRoWzBdID09PSAnZWFjaCcgJiYgYXJncy5sZW5ndGggPj0gMiAmJiBhcmdzWzFdWzBdID09PSAnUEFUSCcgJiZcbiAgICAgICAgICAgICAgYXJnc1sxXVsxXS5sZW5ndGggJiYgYXJnc1sxXVsxXVswXSA9PT0gJ2luJykge1xuICAgICAgICAgICAgLy8gbWluaW11bSBjb25kaXRpb25zIGFyZSBtZXQgZm9yIGVhY2gtaW4uICBub3cgdmFsaWRhdGUgdGhpc1xuICAgICAgICAgICAgLy8gaXNuJ3Qgc29tZSB3ZWlyZCBjYXNlLlxuICAgICAgICAgICAgdmFyIGVhY2hVc2FnZSA9IFwiVXNlIGVpdGhlciB7eyNlYWNoIGl0ZW1zfX0gb3IgXCIgK1xuICAgICAgICAgICAgICAgICAgXCJ7eyNlYWNoIGl0ZW0gaW4gaXRlbXN9fSBmb3JtIG9mICNlYWNoLlwiO1xuICAgICAgICAgICAgdmFyIGluQXJnID0gYXJnc1sxXTtcbiAgICAgICAgICAgIGlmICghIChhcmdzLmxlbmd0aCA+PSAzICYmIGluQXJnWzFdLmxlbmd0aCA9PT0gMSkpIHtcbiAgICAgICAgICAgICAgLy8gd2UgZG9uJ3QgaGF2ZSBhdCBsZWFzdCAzIHNwYWNlLXNlcGFyYXRlZCBwYXJ0cyBhZnRlciAjZWFjaCwgb3JcbiAgICAgICAgICAgICAgLy8gaW5BcmcgZG9lc24ndCBsb29rIGxpa2UgWydQQVRIJyxbJ2luJ11dXG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1hbGZvcm1lZCAjZWFjaC4gXCIgKyBlYWNoVXNhZ2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc3BsaXQgb3V0IHRoZSB2YXJpYWJsZSBuYW1lIGFuZCBzZXF1ZW5jZSBhcmd1bWVudHNcbiAgICAgICAgICAgIHZhciB2YXJpYWJsZUFyZyA9IGFyZ3NbMF07XG4gICAgICAgICAgICBpZiAoISAodmFyaWFibGVBcmdbMF0gPT09IFwiUEFUSFwiICYmIHZhcmlhYmxlQXJnWzFdLmxlbmd0aCA9PT0gMSAmJlxuICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlQXJnWzFdWzBdLnJlcGxhY2UoL1xcLi9nLCAnJykpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkJhZCB2YXJpYWJsZSBuYW1lIGluICNlYWNoXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHZhcmlhYmxlID0gdmFyaWFibGVBcmdbMV1bMF07XG4gICAgICAgICAgICBkYXRhQ29kZSA9ICdmdW5jdGlvbiAoKSB7IHJldHVybiB7IF9zZXF1ZW5jZTogJyArXG4gICAgICAgICAgICAgIHNlbGYuY29kZUdlbkluY2x1c2lvbkRhdGEoYXJncy5zbGljZSgyKSkgK1xuICAgICAgICAgICAgICAnLCBfdmFyaWFibGU6ICcgKyBCbGF6ZVRvb2xzLnRvSlNMaXRlcmFsKHZhcmlhYmxlKSArICcgfTsgfSc7XG4gICAgICAgICAgfSBlbHNlIGlmIChwYXRoWzBdID09PSAnbGV0Jykge1xuICAgICAgICAgICAgdmFyIGRhdGFQcm9wcyA9IHt9O1xuICAgICAgICAgICAgYXJncy5mb3JFYWNoKGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgICAgICAgaWYgKGFyZy5sZW5ndGggIT09IDMpIHtcbiAgICAgICAgICAgICAgICAvLyBub3QgYSBrZXl3b3JkIGFyZyAoeD15KVxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkluY29ycmVjdCBmb3JtIG9mICNsZXRcIik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGFyZ0tleSA9IGFyZ1syXTtcbiAgICAgICAgICAgICAgZGF0YVByb3BzW2FyZ0tleV0gPVxuICAgICAgICAgICAgICAgICdmdW5jdGlvbiAoKSB7IHJldHVybiBTcGFjZWJhcnMuY2FsbCgnICtcbiAgICAgICAgICAgICAgICBzZWxmLmNvZGVHZW5BcmdWYWx1ZShhcmcpICsgJyk7IH0nO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBkYXRhQ29kZSA9IG1ha2VPYmplY3RMaXRlcmFsKGRhdGFQcm9wcyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCEgZGF0YUNvZGUpIHtcbiAgICAgICAgICAgIC8vIGBhcmdzYCBtdXN0IGV4aXN0ICh0YWcuYXJncy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgZGF0YUNvZGUgPSBzZWxmLmNvZGVHZW5JbmNsdXNpb25EYXRhRnVuYyhhcmdzKSB8fCAnbnVsbCc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gYGNvbnRlbnRgIG11c3QgZXhpc3RcbiAgICAgICAgICB2YXIgY29udGVudEJsb2NrID0gKCgnY29udGVudCcgaW4gdGFnKSA/XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvZGVHZW5CbG9jayh0YWcuY29udGVudCkgOiBudWxsKTtcbiAgICAgICAgICAvLyBgZWxzZUNvbnRlbnRgIG1heSBub3QgZXhpc3RcbiAgICAgICAgICB2YXIgZWxzZUNvbnRlbnRCbG9jayA9ICgoJ2Vsc2VDb250ZW50JyBpbiB0YWcpID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxmLmNvZGVHZW5CbG9jayh0YWcuZWxzZUNvbnRlbnQpIDogbnVsbCk7XG5cbiAgICAgICAgICB2YXIgY2FsbEFyZ3MgPSBbZGF0YUNvZGUsIGNvbnRlbnRCbG9ja107XG4gICAgICAgICAgaWYgKGVsc2VDb250ZW50QmxvY2spXG4gICAgICAgICAgICBjYWxsQXJncy5wdXNoKGVsc2VDb250ZW50QmxvY2spO1xuXG4gICAgICAgICAgcmV0dXJuIEJsYXplVG9vbHMuRW1pdENvZGUoXG4gICAgICAgICAgICBidWlsdEluQmxvY2tIZWxwZXJzW3BhdGhbMF1dICsgJygnICsgY2FsbEFyZ3Muam9pbignLCAnKSArICcpJyk7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgY29tcENvZGUgPSBzZWxmLmNvZGVHZW5QYXRoKHBhdGgsIHtsb29rdXBUZW1wbGF0ZTogdHJ1ZX0pO1xuICAgICAgICAgIGlmIChwYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgIC8vIGNhcHR1cmUgcmVhY3Rpdml0eVxuICAgICAgICAgICAgY29tcENvZGUgPSAnZnVuY3Rpb24gKCkgeyByZXR1cm4gU3BhY2ViYXJzLmNhbGwoJyArIGNvbXBDb2RlICtcbiAgICAgICAgICAgICAgJyk7IH0nO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBkYXRhQ29kZSA9IHNlbGYuY29kZUdlbkluY2x1c2lvbkRhdGFGdW5jKHRhZy5hcmdzKTtcbiAgICAgICAgICB2YXIgY29udGVudCA9ICgoJ2NvbnRlbnQnIGluIHRhZykgP1xuICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGYuY29kZUdlbkJsb2NrKHRhZy5jb250ZW50KSA6IG51bGwpO1xuICAgICAgICAgIHZhciBlbHNlQ29udGVudCA9ICgoJ2Vsc2VDb250ZW50JyBpbiB0YWcpID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5jb2RlR2VuQmxvY2sodGFnLmVsc2VDb250ZW50KSA6IG51bGwpO1xuXG4gICAgICAgICAgdmFyIGluY2x1ZGVBcmdzID0gW2NvbXBDb2RlXTtcbiAgICAgICAgICBpZiAoY29udGVudCkge1xuICAgICAgICAgICAgaW5jbHVkZUFyZ3MucHVzaChjb250ZW50KTtcbiAgICAgICAgICAgIGlmIChlbHNlQ29udGVudClcbiAgICAgICAgICAgICAgaW5jbHVkZUFyZ3MucHVzaChlbHNlQ29udGVudCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGluY2x1ZGVDb2RlID1cbiAgICAgICAgICAgICAgICAnU3BhY2ViYXJzLmluY2x1ZGUoJyArIGluY2x1ZGVBcmdzLmpvaW4oJywgJykgKyAnKSc7XG5cbiAgICAgICAgICAvLyBjYWxsaW5nIGNvbnZlbnRpb24gY29tcGF0IC0tIHNldCB0aGUgZGF0YSBjb250ZXh0IGFyb3VuZCB0aGVcbiAgICAgICAgICAvLyBlbnRpcmUgaW5jbHVzaW9uLCBzbyB0aGF0IGlmIHRoZSBuYW1lIG9mIHRoZSBpbmNsdXNpb24gaXNcbiAgICAgICAgICAvLyBhIGhlbHBlciBmdW5jdGlvbiwgaXQgZ2V0cyB0aGUgZGF0YSBjb250ZXh0IGluIGB0aGlzYC5cbiAgICAgICAgICAvLyBUaGlzIG1ha2VzIGZvciBhIHByZXR0eSBjb25mdXNpbmcgY2FsbGluZyBjb252ZW50aW9uIC0tXG4gICAgICAgICAgLy8gSW4gYHt7I2ZvbyBiYXJ9fWAsIGBmb29gIGlzIGV2YWx1YXRlZCBpbiB0aGUgY29udGV4dCBvZiBgYmFyYFxuICAgICAgICAgIC8vIC0tIGJ1dCBpdCdzIHdoYXQgd2Ugc2hpcHBlZCBmb3IgMC44LjAuICBUaGUgcmF0aW9uYWxlIGlzIHRoYXRcbiAgICAgICAgICAvLyBge3sjZm9vIGJhcn19YCBpcyBzdWdhciBmb3IgYHt7I3dpdGggYmFyfX17eyNmb299fS4uLmAuXG4gICAgICAgICAgaWYgKGRhdGFDb2RlKSB7XG4gICAgICAgICAgICBpbmNsdWRlQ29kZSA9XG4gICAgICAgICAgICAgICdCbGF6ZS5fVGVtcGxhdGVXaXRoKCcgKyBkYXRhQ29kZSArICcsIGZ1bmN0aW9uICgpIHsgcmV0dXJuICcgK1xuICAgICAgICAgICAgICBpbmNsdWRlQ29kZSArICc7IH0pJztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBYWFggQkFDSyBDT01QQVQgLSBVSSBpcyB0aGUgb2xkIG5hbWUsIFRlbXBsYXRlIGlzIHRoZSBuZXdcbiAgICAgICAgICBpZiAoKHBhdGhbMF0gPT09ICdVSScgfHwgcGF0aFswXSA9PT0gJ1RlbXBsYXRlJykgJiZcbiAgICAgICAgICAgICAgKHBhdGhbMV0gPT09ICdjb250ZW50QmxvY2snIHx8IHBhdGhbMV0gPT09ICdlbHNlQmxvY2snKSkge1xuICAgICAgICAgICAgLy8gQ2FsbCBjb250ZW50QmxvY2sgYW5kIGVsc2VCbG9jayBpbiB0aGUgYXBwcm9wcmlhdGUgc2NvcGVcbiAgICAgICAgICAgIGluY2x1ZGVDb2RlID0gJ0JsYXplLl9Jbk91dGVyVGVtcGxhdGVTY29wZSh2aWV3LCBmdW5jdGlvbiAoKSB7IHJldHVybiAnXG4gICAgICAgICAgICAgICsgaW5jbHVkZUNvZGUgKyAnOyB9KSc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIEJsYXplVG9vbHMuRW1pdENvZGUoaW5jbHVkZUNvZGUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHRhZy50eXBlID09PSAnRVNDQVBFJykge1xuICAgICAgICByZXR1cm4gdGFnLnZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gQ2FuJ3QgZ2V0IGhlcmU7IFRlbXBsYXRlVGFnIHZhbGlkYXRpb24gc2hvdWxkIGNhdGNoIGFueVxuICAgICAgICAvLyBpbmFwcHJvcHJpYXRlIHRhZyB0eXBlcyB0aGF0IG1pZ2h0IGNvbWUgb3V0IG9mIHRoZSBwYXJzZXIuXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgdGVtcGxhdGUgdGFnIHR5cGU6IFwiICsgdGFnLnR5cGUpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvLyBgcGF0aGAgaXMgYW4gYXJyYXkgb2YgYXQgbGVhc3Qgb25lIHN0cmluZy5cbiAgLy9cbiAgLy8gSWYgYHBhdGgubGVuZ3RoID4gMWAsIHRoZSBnZW5lcmF0ZWQgY29kZSBtYXkgYmUgcmVhY3RpdmVcbiAgLy8gKGkuZS4gaXQgbWF5IGludmFsaWRhdGUgdGhlIGN1cnJlbnQgY29tcHV0YXRpb24pLlxuICAvL1xuICAvLyBObyBjb2RlIGlzIGdlbmVyYXRlZCB0byBjYWxsIHRoZSByZXN1bHQgaWYgaXQncyBhIGZ1bmN0aW9uLlxuICAvL1xuICAvLyBPcHRpb25zOlxuICAvL1xuICAvLyAtIGxvb2t1cFRlbXBsYXRlIHtCb29sZWFufSBJZiB0cnVlLCBnZW5lcmF0ZWQgY29kZSBhbHNvIGxvb2tzIGluXG4gIC8vICAgdGhlIGxpc3Qgb2YgdGVtcGxhdGVzLiAoQWZ0ZXIgaGVscGVycywgYmVmb3JlIGRhdGEgY29udGV4dCkuXG4gIC8vICAgVXNlZCB3aGVuIGdlbmVyYXRpbmcgY29kZSBmb3IgYHt7PiBmb299fWAgb3IgYHt7I2Zvb319YC4gT25seVxuICAvLyAgIHVzZWQgZm9yIG5vbi1kb3R0ZWQgcGF0aHMuXG4gIGNvZGVHZW5QYXRoOiBmdW5jdGlvbiAocGF0aCwgb3B0cykge1xuICAgIGlmIChidWlsdEluQmxvY2tIZWxwZXJzLmhhc093blByb3BlcnR5KHBhdGhbMF0pKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgdXNlIHRoZSBidWlsdC1pbiAnXCIgKyBwYXRoWzBdICsgXCInIGhlcmVcIik7XG4gICAgLy8gTGV0IGB7eyNpZiBUZW1wbGF0ZS5jb250ZW50QmxvY2t9fWAgY2hlY2sgd2hldGhlciB0aGlzIHRlbXBsYXRlIHdhc1xuICAgIC8vIGludm9rZWQgdmlhIGluY2x1c2lvbiBvciBhcyBhIGJsb2NrIGhlbHBlciwgaW4gYWRkaXRpb24gdG8gc3VwcG9ydGluZ1xuICAgIC8vIGB7ez4gVGVtcGxhdGUuY29udGVudEJsb2NrfX1gLlxuICAgIC8vIFhYWCBCQUNLIENPTVBBVCAtIFVJIGlzIHRoZSBvbGQgbmFtZSwgVGVtcGxhdGUgaXMgdGhlIG5ld1xuICAgIGlmIChwYXRoLmxlbmd0aCA+PSAyICYmXG4gICAgICAgIChwYXRoWzBdID09PSAnVUknIHx8IHBhdGhbMF0gPT09ICdUZW1wbGF0ZScpXG4gICAgICAgICYmIGJ1aWx0SW5UZW1wbGF0ZU1hY3Jvcy5oYXNPd25Qcm9wZXJ0eShwYXRoWzFdKSkge1xuICAgICAgaWYgKHBhdGgubGVuZ3RoID4gMilcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBkb3R0ZWQgcGF0aCBiZWdpbm5pbmcgd2l0aCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoWzBdICsgJy4nICsgcGF0aFsxXSk7XG4gICAgICByZXR1cm4gYnVpbHRJblRlbXBsYXRlTWFjcm9zW3BhdGhbMV1dO1xuICAgIH1cblxuICAgIHZhciBmaXJzdFBhdGhJdGVtID0gQmxhemVUb29scy50b0pTTGl0ZXJhbChwYXRoWzBdKTtcbiAgICB2YXIgbG9va3VwTWV0aG9kID0gJ2xvb2t1cCc7XG4gICAgaWYgKG9wdHMgJiYgb3B0cy5sb29rdXBUZW1wbGF0ZSAmJiBwYXRoLmxlbmd0aCA9PT0gMSlcbiAgICAgIGxvb2t1cE1ldGhvZCA9ICdsb29rdXBUZW1wbGF0ZSc7XG4gICAgdmFyIGNvZGUgPSAndmlldy4nICsgbG9va3VwTWV0aG9kICsgJygnICsgZmlyc3RQYXRoSXRlbSArICcpJztcblxuICAgIGlmIChwYXRoLmxlbmd0aCA+IDEpIHtcbiAgICAgIGNvZGUgPSAnU3BhY2ViYXJzLmRvdCgnICsgY29kZSArICcsICcgK1xuICAgICAgcGF0aC5zbGljZSgxKS5tYXAoQmxhemVUb29scy50b0pTTGl0ZXJhbCkuam9pbignLCAnKSArICcpJztcbiAgICB9XG5cbiAgICByZXR1cm4gY29kZTtcbiAgfSxcblxuICAvLyBHZW5lcmF0ZXMgY29kZSBmb3IgYW4gYFthcmdUeXBlLCBhcmdWYWx1ZV1gIGFyZ3VtZW50IHNwZWMsXG4gIC8vIGlnbm9yaW5nIHRoZSB0aGlyZCBlbGVtZW50IChrZXl3b3JkIGFyZ3VtZW50IG5hbWUpIGlmIHByZXNlbnQuXG4gIC8vXG4gIC8vIFRoZSByZXN1bHRpbmcgY29kZSBtYXkgYmUgcmVhY3RpdmUgKGluIHRoZSBjYXNlIG9mIGEgUEFUSCBvZlxuICAvLyBtb3JlIHRoYW4gb25lIGVsZW1lbnQpIGFuZCBpcyBub3Qgd3JhcHBlZCBpbiBhIGNsb3N1cmUuXG4gIGNvZGVHZW5BcmdWYWx1ZTogZnVuY3Rpb24gKGFyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBhcmdUeXBlID0gYXJnWzBdO1xuICAgIHZhciBhcmdWYWx1ZSA9IGFyZ1sxXTtcblxuICAgIHZhciBhcmdDb2RlO1xuICAgIHN3aXRjaCAoYXJnVHlwZSkge1xuICAgIGNhc2UgJ1NUUklORyc6XG4gICAgY2FzZSAnTlVNQkVSJzpcbiAgICBjYXNlICdCT09MRUFOJzpcbiAgICBjYXNlICdOVUxMJzpcbiAgICAgIGFyZ0NvZGUgPSBCbGF6ZVRvb2xzLnRvSlNMaXRlcmFsKGFyZ1ZhbHVlKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1BBVEgnOlxuICAgICAgYXJnQ29kZSA9IHNlbGYuY29kZUdlblBhdGgoYXJnVmFsdWUpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRVhQUic6XG4gICAgICAvLyBUaGUgZm9ybWF0IG9mIEVYUFIgaXMgWydFWFBSJywgeyB0eXBlOiAnRVhQUicsIHBhdGg6IFsuLi5dLCBhcmdzOiB7IC4uLiB9IH1dXG4gICAgICBhcmdDb2RlID0gc2VsZi5jb2RlR2VuTXVzdGFjaGUoYXJnVmFsdWUucGF0aCwgYXJnVmFsdWUuYXJncywgJ2RhdGFNdXN0YWNoZScpO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIC8vIGNhbid0IGdldCBoZXJlXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGFyZyB0eXBlOiBcIiArIGFyZ1R5cGUpO1xuICAgIH1cblxuICAgIHJldHVybiBhcmdDb2RlO1xuICB9LFxuXG4gIC8vIEdlbmVyYXRlcyBhIGNhbGwgdG8gYFNwYWNlYmFycy5mb29NdXN0YWNoZWAgb24gZXZhbHVhdGVkIGFyZ3VtZW50cy5cbiAgLy8gVGhlIHJlc3VsdGluZyBjb2RlIGhhcyBubyBmdW5jdGlvbiBsaXRlcmFscyBhbmQgbXVzdCBiZSB3cmFwcGVkIGluXG4gIC8vIG9uZSBmb3IgZmluZS1ncmFpbmVkIHJlYWN0aXZpdHkuXG4gIGNvZGVHZW5NdXN0YWNoZTogZnVuY3Rpb24gKHBhdGgsIGFyZ3MsIG11c3RhY2hlVHlwZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHZhciBuYW1lQ29kZSA9IHNlbGYuY29kZUdlblBhdGgocGF0aCk7XG4gICAgdmFyIGFyZ0NvZGUgPSBzZWxmLmNvZGVHZW5NdXN0YWNoZUFyZ3MoYXJncyk7XG4gICAgdmFyIG11c3RhY2hlID0gKG11c3RhY2hlVHlwZSB8fCAnbXVzdGFjaGUnKTtcblxuICAgIHJldHVybiAnU3BhY2ViYXJzLicgKyBtdXN0YWNoZSArICcoJyArIG5hbWVDb2RlICtcbiAgICAgIChhcmdDb2RlID8gJywgJyArIGFyZ0NvZGUuam9pbignLCAnKSA6ICcnKSArICcpJztcbiAgfSxcblxuICAvLyByZXR1cm5zOiBhcnJheSBvZiBzb3VyY2Ugc3RyaW5ncywgb3IgbnVsbCBpZiBub1xuICAvLyBhcmdzIGF0IGFsbC5cbiAgY29kZUdlbk11c3RhY2hlQXJnczogZnVuY3Rpb24gKHRhZ0FyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB2YXIga3dBcmdzID0gbnVsbDsgLy8gc291cmNlIC0+IHNvdXJjZVxuICAgIHZhciBhcmdzID0gbnVsbDsgLy8gW3NvdXJjZV1cblxuICAgIC8vIHRhZ0FyZ3MgbWF5IGJlIG51bGxcbiAgICB0YWdBcmdzLmZvckVhY2goZnVuY3Rpb24gKGFyZykge1xuICAgICAgdmFyIGFyZ0NvZGUgPSBzZWxmLmNvZGVHZW5BcmdWYWx1ZShhcmcpO1xuXG4gICAgICBpZiAoYXJnLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgLy8ga2V5d29yZCBhcmd1bWVudCAocmVwcmVzZW50ZWQgYXMgW3R5cGUsIHZhbHVlLCBuYW1lXSlcbiAgICAgICAga3dBcmdzID0gKGt3QXJncyB8fCB7fSk7XG4gICAgICAgIGt3QXJnc1thcmdbMl1dID0gYXJnQ29kZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHBvc2l0aW9uYWwgYXJndW1lbnRcbiAgICAgICAgYXJncyA9IChhcmdzIHx8IFtdKTtcbiAgICAgICAgYXJncy5wdXNoKGFyZ0NvZGUpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcHV0IGt3QXJncyBpbiBvcHRpb25zIGRpY3Rpb25hcnkgYXQgZW5kIG9mIGFyZ3NcbiAgICBpZiAoa3dBcmdzKSB7XG4gICAgICBhcmdzID0gKGFyZ3MgfHwgW10pO1xuICAgICAgYXJncy5wdXNoKCdTcGFjZWJhcnMua3coJyArIG1ha2VPYmplY3RMaXRlcmFsKGt3QXJncykgKyAnKScpO1xuICAgIH1cblxuICAgIHJldHVybiBhcmdzO1xuICB9LFxuXG4gIGNvZGVHZW5CbG9jazogZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAgICByZXR1cm4gY29kZUdlbihjb250ZW50KTtcbiAgfSxcblxuICBjb2RlR2VuSW5jbHVzaW9uRGF0YTogZnVuY3Rpb24gKGFyZ3MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoISBhcmdzLmxlbmd0aCkge1xuICAgICAgLy8gZS5nLiBge3sjZm9vfX1gXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2UgaWYgKGFyZ3NbMF0ubGVuZ3RoID09PSAzKSB7XG4gICAgICAvLyBrZXl3b3JkIGFyZ3VtZW50cyBvbmx5LCBlLmcuIGB7ez4gcG9pbnQgeD0xIHk9Mn19YFxuICAgICAgdmFyIGRhdGFQcm9wcyA9IHt9O1xuICAgICAgYXJncy5mb3JFYWNoKGZ1bmN0aW9uIChhcmcpIHtcbiAgICAgICAgdmFyIGFyZ0tleSA9IGFyZ1syXTtcbiAgICAgICAgZGF0YVByb3BzW2FyZ0tleV0gPSAnU3BhY2ViYXJzLmNhbGwoJyArIHNlbGYuY29kZUdlbkFyZ1ZhbHVlKGFyZykgKyAnKSc7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBtYWtlT2JqZWN0TGl0ZXJhbChkYXRhUHJvcHMpO1xuICAgIH0gZWxzZSBpZiAoYXJnc1swXVswXSAhPT0gJ1BBVEgnKSB7XG4gICAgICAvLyBsaXRlcmFsIGZpcnN0IGFyZ3VtZW50LCBlLmcuIGB7ez4gZm9vIFwiYmxhaFwifX1gXG4gICAgICAvL1xuICAgICAgLy8gdGFnIHZhbGlkYXRpb24gaGFzIGNvbmZpcm1lZCwgaW4gdGhpcyBjYXNlLCB0aGF0IHRoZXJlIGlzIG9ubHlcbiAgICAgIC8vIG9uZSBhcmd1bWVudCAoYGFyZ3MubGVuZ3RoID09PSAxYClcbiAgICAgIHJldHVybiBzZWxmLmNvZGVHZW5BcmdWYWx1ZShhcmdzWzBdKTtcbiAgICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID09PSAxKSB7XG4gICAgICAvLyBvbmUgYXJndW1lbnQsIG11c3QgYmUgYSBQQVRIXG4gICAgICByZXR1cm4gJ1NwYWNlYmFycy5jYWxsKCcgKyBzZWxmLmNvZGVHZW5QYXRoKGFyZ3NbMF1bMV0pICsgJyknO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBNdWx0aXBsZSBwb3NpdGlvbmFsIGFyZ3VtZW50czsgdHJlYXQgdGhlbSBhcyBhIG5lc3RlZFxuICAgICAgLy8gXCJkYXRhIG11c3RhY2hlXCJcbiAgICAgIHJldHVybiBzZWxmLmNvZGVHZW5NdXN0YWNoZShhcmdzWzBdWzFdLCBhcmdzLnNsaWNlKDEpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICdkYXRhTXVzdGFjaGUnKTtcbiAgICB9XG5cbiAgfSxcblxuICBjb2RlR2VuSW5jbHVzaW9uRGF0YUZ1bmM6IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBkYXRhQ29kZSA9IHNlbGYuY29kZUdlbkluY2x1c2lvbkRhdGEoYXJncyk7XG4gICAgaWYgKGRhdGFDb2RlKSB7XG4gICAgICByZXR1cm4gJ2Z1bmN0aW9uICgpIHsgcmV0dXJuICcgKyBkYXRhQ29kZSArICc7IH0nO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxufSk7XG4iLCJpbXBvcnQgeyBNZXRlb3IgfSBmcm9tICdtZXRlb3IvbWV0ZW9yJztcbmltcG9ydCB7IEhUTUxUb29scyB9IGZyb20gJ21ldGVvci9odG1sLXRvb2xzJztcbmltcG9ydCB7IEhUTUwgfSBmcm9tICdtZXRlb3IvaHRtbGpzJztcbmltcG9ydCB7IEJsYXplVG9vbHMgfSBmcm9tICdtZXRlb3IvYmxhemUtdG9vbHMnO1xuaW1wb3J0IHsgQ29kZUdlbiB9IGZyb20gJy4vY29kZWdlbic7XG5pbXBvcnQgeyBvcHRpbWl6ZSB9IGZyb20gJy4vb3B0aW1pemVyJztcbmltcG9ydCB7IFJlYWN0Q29tcG9uZW50U2libGluZ0ZvcmJpZGRlcn0gZnJvbSAnLi9yZWFjdCc7XG5pbXBvcnQgeyBUZW1wbGF0ZVRhZyB9IGZyb20gJy4vdGVtcGxhdGV0YWcnO1xuaW1wb3J0IHsgcmVtb3ZlV2hpdGVzcGFjZSB9IGZyb20gJy4vd2hpdGVzcGFjZSc7XG5cbnZhciBVZ2xpZnlKU01pbmlmeSA9IG51bGw7XG5pZiAoTWV0ZW9yLmlzU2VydmVyKSB7XG4gIFVnbGlmeUpTTWluaWZ5ID0gTnBtLnJlcXVpcmUoJ3VnbGlmeS1qcycpLm1pbmlmeTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gIHJldHVybiBIVE1MVG9vbHMucGFyc2VGcmFnbWVudChcbiAgICBpbnB1dCxcbiAgICB7IGdldFRlbXBsYXRlVGFnOiBUZW1wbGF0ZVRhZy5wYXJzZUNvbXBsZXRlVGFnIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcGlsZShpbnB1dCwgb3B0aW9ucykge1xuICB2YXIgdHJlZSA9IHBhcnNlKGlucHV0KTtcbiAgcmV0dXJuIGNvZGVHZW4odHJlZSwgb3B0aW9ucyk7XG59XG5cbmV4cG9ydCBjb25zdCBUZW1wbGF0ZVRhZ1JlcGxhY2VyID0gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLmV4dGVuZCgpO1xuVGVtcGxhdGVUYWdSZXBsYWNlci5kZWYoe1xuICB2aXNpdE9iamVjdDogZnVuY3Rpb24gKHgpIHtcbiAgICBpZiAoeCBpbnN0YW5jZW9mIEhUTUxUb29scy5UZW1wbGF0ZVRhZykge1xuXG4gICAgICAvLyBNYWtlIHN1cmUgYWxsIFRlbXBsYXRlVGFncyBpbiBhdHRyaWJ1dGVzIGhhdmUgdGhlIHJpZ2h0XG4gICAgICAvLyBgLnBvc2l0aW9uYCBzZXQgb24gdGhlbS4gIFRoaXMgaXMgYSBiaXQgb2YgYSBoYWNrXG4gICAgICAvLyAod2Ugc2hvdWxkbid0IGJlIG11dGF0aW5nIHRoYXQgaGVyZSksIGJ1dCBpdCBhbGxvd3NcbiAgICAgIC8vIGNsZWFuZXIgY29kZWdlbiBvZiBcInN5bnRoZXRpY1wiIGF0dHJpYnV0ZXMgbGlrZSBURVhUQVJFQSdzXG4gICAgICAvLyBcInZhbHVlXCIsIHdoZXJlIHRoZSB0ZW1wbGF0ZSB0YWdzIHdlcmUgb3JpZ2luYWxseSBub3RcbiAgICAgIC8vIGluIGFuIGF0dHJpYnV0ZS5cbiAgICAgIGlmICh0aGlzLmluQXR0cmlidXRlVmFsdWUpXG4gICAgICAgIHgucG9zaXRpb24gPSBIVE1MVG9vbHMuVEVNUExBVEVfVEFHX1BPU0lUSU9OLklOX0FUVFJJQlVURTtcblxuICAgICAgcmV0dXJuIHRoaXMuY29kZWdlbi5jb2RlR2VuVGVtcGxhdGVUYWcoeCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRPYmplY3QuY2FsbCh0aGlzLCB4KTtcbiAgfSxcbiAgdmlzaXRBdHRyaWJ1dGVzOiBmdW5jdGlvbiAoYXR0cnMpIHtcbiAgICBpZiAoYXR0cnMgaW5zdGFuY2VvZiBIVE1MVG9vbHMuVGVtcGxhdGVUYWcpXG4gICAgICByZXR1cm4gdGhpcy5jb2RlZ2VuLmNvZGVHZW5UZW1wbGF0ZVRhZyhhdHRycyk7XG5cbiAgICAvLyBjYWxsIHN1cGVyIChlLmcuIGZvciBjYXNlIHdoZXJlIGBhdHRyc2AgaXMgYW4gYXJyYXkpXG4gICAgcmV0dXJuIEhUTUwuVHJhbnNmb3JtaW5nVmlzaXRvci5wcm90b3R5cGUudmlzaXRBdHRyaWJ1dGVzLmNhbGwodGhpcywgYXR0cnMpO1xuICB9LFxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcpIHtcbiAgICB0aGlzLmluQXR0cmlidXRlVmFsdWUgPSB0cnVlO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnZpc2l0KHZhbHVlKTtcbiAgICB0aGlzLmluQXR0cmlidXRlVmFsdWUgPSBmYWxzZTtcblxuICAgIGlmIChyZXN1bHQgIT09IHZhbHVlKSB7XG4gICAgICAvLyBzb21lIHRlbXBsYXRlIHRhZ3MgbXVzdCBoYXZlIGJlZW4gcmVwbGFjZWQsIGJlY2F1c2Ugb3RoZXJ3aXNlXG4gICAgICAvLyB3ZSB0cnkgdG8ga2VlcCB0aGluZ3MgYD09PWAgd2hlbiB0cmFuc2Zvcm1pbmcuICBXcmFwIHRoZSBjb2RlXG4gICAgICAvLyBpbiBhIGZ1bmN0aW9uIGFzIHBlciB0aGUgcnVsZXMuICBZb3UgY2FuJ3QgaGF2ZVxuICAgICAgLy8gYHtpZDogQmxhemUuVmlldyguLi4pfWAgYXMgYW4gYXR0cmlidXRlcyBkaWN0IGJlY2F1c2UgdGhlIFZpZXdcbiAgICAgIC8vIHdvdWxkIGJlIHJlbmRlcmVkIG1vcmUgdGhhbiBvbmNlOyB5b3UgbmVlZCB0byB3cmFwIGl0IGluIGEgZnVuY3Rpb25cbiAgICAgIC8vIHNvIHRoYXQgaXQncyBhIGRpZmZlcmVudCBWaWV3IGVhY2ggdGltZS5cbiAgICAgIHJldHVybiBCbGF6ZVRvb2xzLkVtaXRDb2RlKHRoaXMuY29kZWdlbi5jb2RlR2VuQmxvY2socmVzdWx0KSk7XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn0pO1xuXG5leHBvcnQgZnVuY3Rpb24gY29kZUdlbiAocGFyc2VUcmVlLCBvcHRpb25zKSB7XG4gIC8vIGlzIHRoaXMgYSB0ZW1wbGF0ZSwgcmF0aGVyIHRoYW4gYSBibG9jayBwYXNzZWQgdG9cbiAgLy8gYSBibG9jayBoZWxwZXIsIHNheVxuICB2YXIgaXNUZW1wbGF0ZSA9IChvcHRpb25zICYmIG9wdGlvbnMuaXNUZW1wbGF0ZSk7XG4gIHZhciBpc0JvZHkgPSAob3B0aW9ucyAmJiBvcHRpb25zLmlzQm9keSk7XG4gIHZhciB3aGl0ZXNwYWNlID0gKG9wdGlvbnMgJiYgb3B0aW9ucy53aGl0ZXNwYWNlKVxuICB2YXIgc291cmNlTmFtZSA9IChvcHRpb25zICYmIG9wdGlvbnMuc291cmNlTmFtZSk7XG5cbiAgdmFyIHRyZWUgPSBwYXJzZVRyZWU7XG5cbiAgLy8gVGhlIGZsYWdzIGBpc1RlbXBsYXRlYCBhbmQgYGlzQm9keWAgYXJlIGtpbmQgb2YgYSBoYWNrLlxuICBpZiAoaXNUZW1wbGF0ZSB8fCBpc0JvZHkpIHtcbiAgICBpZiAodHlwZW9mIHdoaXRlc3BhY2UgPT09ICdzdHJpbmcnICYmIHdoaXRlc3BhY2UudG9Mb3dlckNhc2UoKSA9PT0gJ3N0cmlwJykge1xuICAgICAgdHJlZSA9IHJlbW92ZVdoaXRlc3BhY2UodHJlZSk7XG4gICAgfVxuICAgIC8vIG9wdGltaXppbmcgZnJhZ21lbnRzIHdvdWxkIHJlcXVpcmUgYmVpbmcgc21hcnRlciBhYm91dCB3aGV0aGVyIHdlIGFyZVxuICAgIC8vIGluIGEgVEVYVEFSRUEsIHNheS5cbiAgICB0cmVlID0gb3B0aW1pemUodHJlZSk7XG4gIH1cblxuICAvLyB0aHJvd3MgYW4gZXJyb3IgaWYgdXNpbmcgYHt7PiBSZWFjdH19YCB3aXRoIHNpYmxpbmdzXG4gIG5ldyBSZWFjdENvbXBvbmVudFNpYmxpbmdGb3JiaWRkZXIoe3NvdXJjZU5hbWU6IHNvdXJjZU5hbWV9KVxuICAgIC52aXNpdCh0cmVlKTtcblxuICB2YXIgY29kZWdlbiA9IG5ldyBDb2RlR2VuO1xuICB0cmVlID0gKG5ldyBUZW1wbGF0ZVRhZ1JlcGxhY2VyKFxuICAgIHtjb2RlZ2VuOiBjb2RlZ2VufSkpLnZpc2l0KHRyZWUpO1xuXG4gIHZhciBjb2RlID0gJyhmdW5jdGlvbiAoKSB7ICc7XG4gIGlmIChpc1RlbXBsYXRlIHx8IGlzQm9keSkge1xuICAgIGNvZGUgKz0gJ3ZhciB2aWV3ID0gdGhpczsgJztcbiAgfVxuICBjb2RlICs9ICdyZXR1cm4gJztcbiAgY29kZSArPSBCbGF6ZVRvb2xzLnRvSlModHJlZSk7XG4gIGNvZGUgKz0gJzsgfSknO1xuXG4gIGNvZGUgPSBiZWF1dGlmeShjb2RlKTtcblxuICByZXR1cm4gY29kZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJlYXV0aWZ5IChjb2RlKSB7XG4gIGlmICghVWdsaWZ5SlNNaW5pZnkpIHtcbiAgICByZXR1cm4gY29kZTtcbiAgfVxuXG4gIHZhciByZXN1bHQgPSBVZ2xpZnlKU01pbmlmeShjb2RlLCB7XG4gICAgZnJvbVN0cmluZzogdHJ1ZSxcbiAgICBtYW5nbGU6IGZhbHNlLFxuICAgIGNvbXByZXNzOiBmYWxzZSxcbiAgICBvdXRwdXQ6IHtcbiAgICAgIGJlYXV0aWZ5OiB0cnVlLFxuICAgICAgaW5kZW50X2xldmVsOiAyLFxuICAgICAgd2lkdGg6IDgwXG4gICAgfVxuICB9KTtcblxuICB2YXIgb3V0cHV0ID0gcmVzdWx0LmNvZGU7XG4gIC8vIFVnbGlmeSBpbnRlcnByZXRzIG91ciBleHByZXNzaW9uIGFzIGEgc3RhdGVtZW50IGFuZCBtYXkgYWRkIGEgc2VtaWNvbG9uLlxuICAvLyBTdHJpcCB0cmFpbGluZyBzZW1pY29sb24uXG4gIG91dHB1dCA9IG91dHB1dC5yZXBsYWNlKC87JC8sICcnKTtcbiAgcmV0dXJuIG91dHB1dDtcbn1cbiIsImltcG9ydCB7IEhUTUxUb29scyB9IGZyb20gJ21ldGVvci9odG1sLXRvb2xzJztcbmltcG9ydCB7IEhUTUwgfSBmcm9tICdtZXRlb3IvaHRtbGpzJztcblxuLy8gT3B0aW1pemUgcGFydHMgb2YgYW4gSFRNTGpzIHRyZWUgaW50byByYXcgSFRNTCBzdHJpbmdzIHdoZW4gdGhleSBkb24ndFxuLy8gY29udGFpbiB0ZW1wbGF0ZSB0YWdzLlxuXG52YXIgY29uc3RhbnQgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9O1xufTtcblxudmFyIE9QVElNSVpBQkxFID0ge1xuICBOT05FOiAwLFxuICBQQVJUUzogMSxcbiAgRlVMTDogMlxufTtcblxuLy8gV2UgY2FuIG9ubHkgdHVybiBjb250ZW50IGludG8gYW4gSFRNTCBzdHJpbmcgaWYgaXQgY29udGFpbnMgbm8gdGVtcGxhdGVcbi8vIHRhZ3MgYW5kIG5vIFwidHJpY2t5XCIgSFRNTCB0YWdzLiAgSWYgd2UgY2FuIG9wdGltaXplIHRoZSBlbnRpcmUgY29udGVudFxuLy8gaW50byBhIHN0cmluZywgd2UgcmV0dXJuIE9QVElNSVpBQkxFLkZVTEwuICBJZiB0aGUgd2UgYXJlIGdpdmVuIGFuXG4vLyB1bm9wdGltaXphYmxlIG5vZGUsIHdlIHJldHVybiBPUFRJTUlaQUJMRS5OT05FLiAgSWYgd2UgYXJlIGdpdmVuIGEgdHJlZVxuLy8gdGhhdCBjb250YWlucyBhbiB1bm9wdGltaXphYmxlIG5vZGUgc29tZXdoZXJlLCB3ZSByZXR1cm4gT1BUSU1JWkFCTEUuUEFSVFMuXG4vL1xuLy8gRm9yIGV4YW1wbGUsIHdlIGFsd2F5cyBjcmVhdGUgU1ZHIGVsZW1lbnRzIHByb2dyYW1tYXRpY2FsbHksIHNpbmNlIFNWR1xuLy8gZG9lc24ndCBoYXZlIGlubmVySFRNTC4gIElmIHdlIGFyZSBnaXZlbiBhbiBTVkcgZWxlbWVudCwgd2UgcmV0dXJuIE5PTkUuXG4vLyBIb3dldmVyLCBpZiB3ZSBhcmUgZ2l2ZW4gYSBiaWcgdHJlZSB0aGF0IGNvbnRhaW5zIFNWRyBzb21ld2hlcmUsIHdlXG4vLyByZXR1cm4gUEFSVFMgc28gdGhhdCB0aGUgb3B0aW1pemVyIGNhbiBkZXNjZW5kIGludG8gdGhlIHRyZWUgYW5kIG9wdGltaXplXG4vLyBvdGhlciBwYXJ0cyBvZiBpdC5cbnZhciBDYW5PcHRpbWl6ZVZpc2l0b3IgPSBIVE1MLlZpc2l0b3IuZXh0ZW5kKCk7XG5DYW5PcHRpbWl6ZVZpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBjb25zdGFudChPUFRJTUlaQUJMRS5GVUxMKSxcbiAgdmlzaXRQcmltaXRpdmU6IGNvbnN0YW50KE9QVElNSVpBQkxFLkZVTEwpLFxuICB2aXNpdENvbW1lbnQ6IGNvbnN0YW50KE9QVElNSVpBQkxFLkZVTEwpLFxuICB2aXNpdENoYXJSZWY6IGNvbnN0YW50KE9QVElNSVpBQkxFLkZVTEwpLFxuICB2aXNpdFJhdzogY29uc3RhbnQoT1BUSU1JWkFCTEUuRlVMTCksXG4gIHZpc2l0T2JqZWN0OiBjb25zdGFudChPUFRJTUlaQUJMRS5OT05FKSxcbiAgdmlzaXRGdW5jdGlvbjogY29uc3RhbnQoT1BUSU1JWkFCTEUuTk9ORSksXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uICh4KSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKHRoaXMudmlzaXQoeFtpXSkgIT09IE9QVElNSVpBQkxFLkZVTEwpXG4gICAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5QQVJUUztcbiAgICByZXR1cm4gT1BUSU1JWkFCTEUuRlVMTDtcbiAgfSxcbiAgdmlzaXRUYWc6IGZ1bmN0aW9uICh0YWcpIHtcbiAgICB2YXIgdGFnTmFtZSA9IHRhZy50YWdOYW1lO1xuICAgIGlmICh0YWdOYW1lID09PSAndGV4dGFyZWEnKSB7XG4gICAgICAvLyBvcHRpbWl6aW5nIGludG8gYSBURVhUQVJFQSdzIFJDREFUQSB3b3VsZCByZXF1aXJlIGJlaW5nIGEgbGl0dGxlXG4gICAgICAvLyBtb3JlIGNsZXZlci5cbiAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5OT05FO1xuICAgIH0gZWxzZSBpZiAodGFnTmFtZSA9PT0gJ3NjcmlwdCcpIHtcbiAgICAgIC8vIHNjcmlwdCB0YWdzIGRvbid0IHdvcmsgd2hlbiByZW5kZXJlZCBmcm9tIHN0cmluZ3NcbiAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5OT05FO1xuICAgIH0gZWxzZSBpZiAoISAoSFRNTC5pc0tub3duRWxlbWVudCh0YWdOYW1lKSAmJlxuICAgICAgICAgICAgICAgICAgISBIVE1MLmlzS25vd25TVkdFbGVtZW50KHRhZ05hbWUpKSkge1xuICAgICAgLy8gZm9yZWlnbiBlbGVtZW50cyBsaWtlIFNWRyBjYW4ndCBiZSBzdHJpbmdpZmllZCBmb3IgaW5uZXJIVE1MLlxuICAgICAgcmV0dXJuIE9QVElNSVpBQkxFLk5PTkU7XG4gICAgfSBlbHNlIGlmICh0YWdOYW1lID09PSAndGFibGUnKSB7XG4gICAgICAvLyBBdm9pZCBldmVyIHByb2R1Y2luZyBIVE1MIGNvbnRhaW5pbmcgYDx0YWJsZT48dHI+Li4uYCwgYmVjYXVzZSB0aGVcbiAgICAgIC8vIGJyb3dzZXIgd2lsbCBpbnNlcnQgYSBUQk9EWS4gIElmIHdlIGp1c3QgYGNyZWF0ZUVsZW1lbnQoXCJ0YWJsZVwiKWAgYW5kXG4gICAgICAvLyBgY3JlYXRlRWxlbWVudChcInRyXCIpYCwgb24gdGhlIG90aGVyIGhhbmQsIG5vIFRCT0RZIGlzIG5lY2Vzc2FyeVxuICAgICAgLy8gKGFzc3VtaW5nIElFIDgrKS5cbiAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5QQVJUUztcbiAgICB9IGVsc2UgaWYgKHRhZ05hbWUgPT09ICd0cicpe1xuICAgICAgcmV0dXJuIE9QVElNSVpBQkxFLlBBUlRTO1xuICAgIH1cblxuICAgIHZhciBjaGlsZHJlbiA9IHRhZy5jaGlsZHJlbjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKHRoaXMudmlzaXQoY2hpbGRyZW5baV0pICE9PSBPUFRJTUlaQUJMRS5GVUxMKVxuICAgICAgICByZXR1cm4gT1BUSU1JWkFCTEUuUEFSVFM7XG5cbiAgICBpZiAodGhpcy52aXNpdEF0dHJpYnV0ZXModGFnLmF0dHJzKSAhPT0gT1BUSU1JWkFCTEUuRlVMTClcbiAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5QQVJUUztcblxuICAgIHJldHVybiBPUFRJTUlaQUJMRS5GVUxMO1xuICB9LFxuICB2aXNpdEF0dHJpYnV0ZXM6IGZ1bmN0aW9uIChhdHRycykge1xuICAgIGlmIChhdHRycykge1xuICAgICAgdmFyIGlzQXJyYXkgPSBIVE1MLmlzQXJyYXkoYXR0cnMpO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCAoaXNBcnJheSA/IGF0dHJzLmxlbmd0aCA6IDEpOyBpKyspIHtcbiAgICAgICAgdmFyIGEgPSAoaXNBcnJheSA/IGF0dHJzW2ldIDogYXR0cnMpO1xuICAgICAgICBpZiAoKHR5cGVvZiBhICE9PSAnb2JqZWN0JykgfHwgKGEgaW5zdGFuY2VvZiBIVE1MVG9vbHMuVGVtcGxhdGVUYWcpKVxuICAgICAgICAgIHJldHVybiBPUFRJTUlaQUJMRS5QQVJUUztcbiAgICAgICAgZm9yICh2YXIgayBpbiBhKVxuICAgICAgICAgIGlmICh0aGlzLnZpc2l0KGFba10pICE9PSBPUFRJTUlaQUJMRS5GVUxMKVxuICAgICAgICAgICAgcmV0dXJuIE9QVElNSVpBQkxFLlBBUlRTO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gT1BUSU1JWkFCTEUuRlVMTDtcbiAgfVxufSk7XG5cbnZhciBnZXRPcHRpbWl6YWJpbGl0eSA9IGZ1bmN0aW9uIChjb250ZW50KSB7XG4gIHJldHVybiAobmV3IENhbk9wdGltaXplVmlzaXRvcikudmlzaXQoY29udGVudCk7XG59O1xuXG5leHBvcnQgZnVuY3Rpb24gdG9SYXcoeCkge1xuICByZXR1cm4gSFRNTC5SYXcoSFRNTC50b0hUTUwoeCkpO1xufVxuXG5leHBvcnQgY29uc3QgVHJlZVRyYW5zZm9ybWVyID0gSFRNTC5UcmFuc2Zvcm1pbmdWaXNpdG9yLmV4dGVuZCgpO1xuVHJlZVRyYW5zZm9ybWVyLmRlZih7XG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzLyosIC4uLiovKSB7XG4gICAgLy8gcGFzcyB0ZW1wbGF0ZSB0YWdzIHRocm91Z2ggYnkgZGVmYXVsdFxuICAgIGlmIChhdHRycyBpbnN0YW5jZW9mIEhUTUxUb29scy5UZW1wbGF0ZVRhZylcbiAgICAgIHJldHVybiBhdHRycztcblxuICAgIHJldHVybiBIVE1MLlRyYW5zZm9ybWluZ1Zpc2l0b3IucHJvdG90eXBlLnZpc2l0QXR0cmlidXRlcy5hcHBseShcbiAgICAgIHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cbn0pO1xuXG4vLyBSZXBsYWNlIHBhcnRzIG9mIHRoZSBIVE1ManMgdHJlZSB0aGF0IGhhdmUgbm8gdGVtcGxhdGUgdGFncyAob3Jcbi8vIHRyaWNreSBIVE1MIHRhZ3MpIHdpdGggSFRNTC5SYXcgb2JqZWN0cyBjb250YWluaW5nIHJhdyBIVE1MLlxudmFyIE9wdGltaXppbmdWaXNpdG9yID0gVHJlZVRyYW5zZm9ybWVyLmV4dGVuZCgpO1xuT3B0aW1pemluZ1Zpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiB0b1JhdyxcbiAgdmlzaXRQcmltaXRpdmU6IHRvUmF3LFxuICB2aXNpdENvbW1lbnQ6IHRvUmF3LFxuICB2aXNpdENoYXJSZWY6IHRvUmF3LFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICB2YXIgb3B0aW1pemFiaWxpdHkgPSBnZXRPcHRpbWl6YWJpbGl0eShhcnJheSk7XG4gICAgaWYgKG9wdGltaXphYmlsaXR5ID09PSBPUFRJTUlaQUJMRS5GVUxMKSB7XG4gICAgICByZXR1cm4gdG9SYXcoYXJyYXkpO1xuICAgIH0gZWxzZSBpZiAob3B0aW1pemFiaWxpdHkgPT09IE9QVElNSVpBQkxFLlBBUlRTKSB7XG4gICAgICByZXR1cm4gVHJlZVRyYW5zZm9ybWVyLnByb3RvdHlwZS52aXNpdEFycmF5LmNhbGwodGhpcywgYXJyYXkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYXJyYXk7XG4gICAgfVxuICB9LFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZykge1xuICAgIHZhciBvcHRpbWl6YWJpbGl0eSA9IGdldE9wdGltaXphYmlsaXR5KHRhZyk7XG4gICAgaWYgKG9wdGltaXphYmlsaXR5ID09PSBPUFRJTUlaQUJMRS5GVUxMKSB7XG4gICAgICByZXR1cm4gdG9SYXcodGFnKTtcbiAgICB9IGVsc2UgaWYgKG9wdGltaXphYmlsaXR5ID09PSBPUFRJTUlaQUJMRS5QQVJUUykge1xuICAgICAgcmV0dXJuIFRyZWVUcmFuc2Zvcm1lci5wcm90b3R5cGUudmlzaXRUYWcuY2FsbCh0aGlzLCB0YWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGFnO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRDaGlsZHJlbjogZnVuY3Rpb24gKGNoaWxkcmVuKSB7XG4gICAgLy8gZG9uJ3Qgb3B0aW1pemUgdGhlIGNoaWxkcmVuIGFycmF5IGludG8gYSBSYXcgb2JqZWN0IVxuICAgIHJldHVybiBUcmVlVHJhbnNmb3JtZXIucHJvdG90eXBlLnZpc2l0QXJyYXkuY2FsbCh0aGlzLCBjaGlsZHJlbik7XG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG59KTtcblxuLy8gQ29tYmluZSBjb25zZWN1dGl2ZSBIVE1MLlJhd3MuICBSZW1vdmUgZW1wdHkgb25lcy5cbnZhciBSYXdDb21wYWN0aW5nVmlzaXRvciA9IFRyZWVUcmFuc2Zvcm1lci5leHRlbmQoKTtcblJhd0NvbXBhY3RpbmdWaXNpdG9yLmRlZih7XG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uIChhcnJheSkge1xuICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgICAgaWYgKChpdGVtIGluc3RhbmNlb2YgSFRNTC5SYXcpICYmXG4gICAgICAgICAgKCghIGl0ZW0udmFsdWUpIHx8XG4gICAgICAgICAgIChyZXN1bHQubGVuZ3RoICYmXG4gICAgICAgICAgICAocmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIEhUTUwuUmF3KSkpKSB7XG4gICAgICAgIC8vIHR3byBjYXNlczogaXRlbSBpcyBhbiBlbXB0eSBSYXcsIG9yIHByZXZpb3VzIGl0ZW0gaXNcbiAgICAgICAgLy8gYSBSYXcgYXMgd2VsbC4gIEluIHRoZSBsYXR0ZXIgY2FzZSwgcmVwbGFjZSB0aGUgcHJldmlvdXNcbiAgICAgICAgLy8gUmF3IHdpdGggYSBsb25nZXIgb25lIHRoYXQgaW5jbHVkZXMgdGhlIG5ldyBSYXcuXG4gICAgICAgIGlmIChpdGVtLnZhbHVlKSB7XG4gICAgICAgICAgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXSA9IEhUTUwuUmF3KFxuICAgICAgICAgICAgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXS52YWx1ZSArIGl0ZW0udmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXN1bHQucHVzaCh0aGlzLnZpc2l0KGl0ZW0pKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxufSk7XG5cbi8vIFJlcGxhY2UgcG9pbnRsZXNzIFJhd3MgbGlrZSBgSFRNbC5SYXcoJ2ZvbycpYCB0aGF0IGNvbnRhaW4gbm8gc3BlY2lhbFxuLy8gY2hhcmFjdGVycyB3aXRoIHNpbXBsZSBzdHJpbmdzLlxudmFyIFJhd1JlcGxhY2luZ1Zpc2l0b3IgPSBUcmVlVHJhbnNmb3JtZXIuZXh0ZW5kKCk7XG5SYXdSZXBsYWNpbmdWaXNpdG9yLmRlZih7XG4gIHZpc2l0UmF3OiBmdW5jdGlvbiAocmF3KSB7XG4gICAgdmFyIGh0bWwgPSByYXcudmFsdWU7XG4gICAgaWYgKGh0bWwuaW5kZXhPZignJicpIDwgMCAmJiBodG1sLmluZGV4T2YoJzwnKSA8IDApIHtcbiAgICAgIHJldHVybiBodG1sO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gcmF3O1xuICAgIH1cbiAgfVxufSk7XG5cbmV4cG9ydCBmdW5jdGlvbiBvcHRpbWl6ZSAodHJlZSkge1xuICB0cmVlID0gKG5ldyBPcHRpbWl6aW5nVmlzaXRvcikudmlzaXQodHJlZSk7XG4gIHRyZWUgPSAobmV3IFJhd0NvbXBhY3RpbmdWaXNpdG9yKS52aXNpdCh0cmVlKTtcbiAgdHJlZSA9IChuZXcgUmF3UmVwbGFjaW5nVmlzaXRvcikudmlzaXQodHJlZSk7XG4gIHJldHVybiB0cmVlO1xufVxuIiwiaW1wb3J0IHsgSFRNTFRvb2xzIH0gZnJvbSAnbWV0ZW9yL2h0bWwtdG9vbHMnO1xuaW1wb3J0IHsgSFRNTCB9IGZyb20gJ21ldGVvci9odG1sanMnO1xuaW1wb3J0IHsgQmxhemVUb29scyB9IGZyb20gJ21ldGVvci9ibGF6ZS10b29scyc7XG5cbi8vIEEgdmlzaXRvciB0byBlbnN1cmUgdGhhdCBSZWFjdCBjb21wb25lbnRzIGluY2x1ZGVkIHZpYSB0aGUgYHt7PlxuLy8gUmVhY3R9fWAgdGVtcGxhdGUgZGVmaW5lZCBpbiB0aGUgcmVhY3QtdGVtcGxhdGUtaGVscGVyIHBhY2thZ2UgYXJlXG4vLyB0aGUgb25seSBjaGlsZCBpbiB0aGVpciBwYXJlbnQgY29tcG9uZW50LiBPdGhlcndpc2UgYFJlYWN0LnJlbmRlcmBcbi8vIHdvdWxkIGVsaW1pbmF0ZSBhbGwgb2YgdGhlaXIgc2libGluZyBub2Rlcy5cbi8vXG4vLyBJdCdzIGEgbGl0dGxlIHN0cmFuZ2UgdGhhdCB0aGlzIGxvZ2ljIGlzIGluIHNwYWNlYmFycy1jb21waWxlciBpZlxuLy8gaXQncyBvbmx5IHJlbGV2YW50IHRvIGEgc3BlY2lmaWMgcGFja2FnZSBidXQgdGhlcmUncyBubyB3YXkgdG8gaGF2ZVxuLy8gYSBwYWNrYWdlIGhvb2sgaW50byBhIGJ1aWxkIHBsdWdpbi5cbmV4cG9ydCBjb25zdCBSZWFjdENvbXBvbmVudFNpYmxpbmdGb3JiaWRkZXIgPSBIVE1MLlZpc2l0b3IuZXh0ZW5kKCk7XG5SZWFjdENvbXBvbmVudFNpYmxpbmdGb3JiaWRkZXIuZGVmKHtcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5LCBwYXJlbnRUYWcpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnZpc2l0KGFycmF5W2ldLCBwYXJlbnRUYWcpO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRPYmplY3Q6IGZ1bmN0aW9uIChvYmosIHBhcmVudFRhZykge1xuICAgIGlmIChvYmoudHlwZSA9PT0gXCJJTkNMVVNJT05cIiAmJiBvYmoucGF0aC5sZW5ndGggPT09IDEgJiYgb2JqLnBhdGhbMF0gPT09IFwiUmVhY3RcIikge1xuICAgICAgaWYgKCFwYXJlbnRUYWcpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwie3s+IFJlYWN0fX0gbXVzdCBiZSB1c2VkIGluIGEgY29udGFpbmVyIGVsZW1lbnRcIlxuICAgICAgICAgICAgKyAodGhpcy5zb3VyY2VOYW1lID8gKFwiIGluIFwiICsgdGhpcy5zb3VyY2VOYW1lKSA6IFwiXCIpXG4gICAgICAgICAgICAgICArIFwiLiBMZWFybiBtb3JlIGF0IGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3dpa2kvUmVhY3QtY29tcG9uZW50cy1tdXN0LWJlLXRoZS1vbmx5LXRoaW5nLWluLXRoZWlyLXdyYXBwZXItZWxlbWVudFwiKTtcbiAgICAgIH1cblxuICAgICAgdmFyIG51bVNpYmxpbmdzID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcGFyZW50VGFnLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IHBhcmVudFRhZy5jaGlsZHJlbltpXTtcbiAgICAgICAgaWYgKGNoaWxkICE9PSBvYmogJiYgISh0eXBlb2YgY2hpbGQgPT09IFwic3RyaW5nXCIgJiYgY2hpbGQubWF0Y2goL15cXHMqJC8pKSkge1xuICAgICAgICAgIG51bVNpYmxpbmdzKys7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG51bVNpYmxpbmdzID4gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgXCJ7ez4gUmVhY3R9fSBtdXN0IGJlIHVzZWQgYXMgdGhlIG9ubHkgY2hpbGQgaW4gYSBjb250YWluZXIgZWxlbWVudFwiXG4gICAgICAgICAgICArICh0aGlzLnNvdXJjZU5hbWUgPyAoXCIgaW4gXCIgKyB0aGlzLnNvdXJjZU5hbWUpIDogXCJcIilcbiAgICAgICAgICAgICAgICsgXCIuIExlYXJuIG1vcmUgYXQgaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3Ivd2lraS9SZWFjdC1jb21wb25lbnRzLW11c3QtYmUtdGhlLW9ubHktdGhpbmctaW4tdGhlaXItd3JhcHBlci1lbGVtZW50XCIpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgdmlzaXRUYWc6IGZ1bmN0aW9uICh0YWcpIHtcbiAgICB0aGlzLnZpc2l0QXJyYXkodGFnLmNoaWxkcmVuLCB0YWcgLypwYXJlbnRUYWcqLyk7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IHsgSFRNTFRvb2xzIH0gZnJvbSAnbWV0ZW9yL2h0bWwtdG9vbHMnO1xuaW1wb3J0IHsgSFRNTCB9IGZyb20gJ21ldGVvci9odG1sanMnO1xuaW1wb3J0IHsgQmxhemVUb29scyB9IGZyb20gJ21ldGVvci9ibGF6ZS10b29scyc7XG5cbi8vIEEgVGVtcGxhdGVUYWcgaXMgdGhlIHJlc3VsdCBvZiBwYXJzaW5nIGEgc2luZ2xlIGB7ey4uLn19YCB0YWcuXG4vL1xuLy8gVGhlIGAudHlwZWAgb2YgYSBUZW1wbGF0ZVRhZyBpcyBvbmUgb2Y6XG4vL1xuLy8gLSBgXCJET1VCTEVcImAgLSBge3tmb299fWBcbi8vIC0gYFwiVFJJUExFXCJgIC0gYHt7e2Zvb319fWBcbi8vIC0gYFwiRVhQUlwiYCAtIGAoZm9vKWBcbi8vIC0gYFwiQ09NTUVOVFwiYCAtIGB7eyEgZm9vfX1gXG4vLyAtIGBcIkJMT0NLQ09NTUVOVFwiIC0gYHt7IS0tIGZvby0tfX1gXG4vLyAtIGBcIklOQ0xVU0lPTlwiYCAtIGB7ez4gZm9vfX1gXG4vLyAtIGBcIkJMT0NLT1BFTlwiYCAtIGB7eyNmb299fWBcbi8vIC0gYFwiQkxPQ0tDTE9TRVwiYCAtIGB7ey9mb299fWBcbi8vIC0gYFwiRUxTRVwiYCAtIGB7e2Vsc2V9fWBcbi8vIC0gYFwiRVNDQVBFXCJgIC0gYHt7fGAsIGB7e3t8YCwgYHt7e3t8YCBhbmQgc28gb25cbi8vXG4vLyBCZXNpZGVzIGB0eXBlYCwgdGhlIG1hbmRhdG9yeSBwcm9wZXJ0aWVzIG9mIGEgVGVtcGxhdGVUYWcgYXJlOlxuLy9cbi8vIC0gYHBhdGhgIC0gQW4gYXJyYXkgb2Ygb25lIG9yIG1vcmUgc3RyaW5ncy4gIFRoZSBwYXRoIG9mIGB7e2Zvby5iYXJ9fWBcbi8vICAgaXMgYFtcImZvb1wiLCBcImJhclwiXWAuICBBcHBsaWVzIHRvIERPVUJMRSwgVFJJUExFLCBJTkNMVVNJT04sIEJMT0NLT1BFTixcbi8vICAgQkxPQ0tDTE9TRSwgYW5kIEVMU0UuXG4vL1xuLy8gLSBgYXJnc2AgLSBBbiBhcnJheSBvZiB6ZXJvIG9yIG1vcmUgYXJndW1lbnQgc3BlY3MuICBBbiBhcmd1bWVudCBzcGVjXG4vLyAgIGlzIGEgdHdvIG9yIHRocmVlIGVsZW1lbnQgYXJyYXksIGNvbnNpc3Rpbmcgb2YgYSB0eXBlLCB2YWx1ZSwgYW5kXG4vLyAgIG9wdGlvbmFsIGtleXdvcmQgbmFtZS4gIEZvciBleGFtcGxlLCB0aGUgYGFyZ3NgIG9mIGB7e2ZvbyBcImJhclwiIHg9M319YFxuLy8gICBhcmUgYFtbXCJTVFJJTkdcIiwgXCJiYXJcIl0sIFtcIk5VTUJFUlwiLCAzLCBcInhcIl1dYC4gIEFwcGxpZXMgdG8gRE9VQkxFLFxuLy8gICBUUklQTEUsIElOQ0xVU0lPTiwgQkxPQ0tPUEVOLCBhbmQgRUxTRS5cbi8vXG4vLyAtIGB2YWx1ZWAgLSBBIHN0cmluZyBvZiB0aGUgY29tbWVudCdzIHRleHQuIEFwcGxpZXMgdG8gQ09NTUVOVCBhbmRcbi8vICAgQkxPQ0tDT01NRU5ULlxuLy9cbi8vIFRoZXNlIGFkZGl0aW9uYWwgYXJlIHR5cGljYWxseSBzZXQgZHVyaW5nIHBhcnNpbmc6XG4vL1xuLy8gLSBgcG9zaXRpb25gIC0gVGhlIEhUTUxUb29scy5URU1QTEFURV9UQUdfUE9TSVRJT04gc3BlY2lmeWluZyBhdCB3aGF0IHNvcnRcbi8vICAgb2Ygc2l0ZSB0aGUgVGVtcGxhdGVUYWcgd2FzIGVuY291bnRlcmVkIChlLmcuIGF0IGVsZW1lbnQgbGV2ZWwgb3IgYXNcbi8vICAgcGFydCBvZiBhbiBhdHRyaWJ1dGUgdmFsdWUpLiBJdHMgYWJzZW5jZSBpbXBsaWVzXG4vLyAgIFRFTVBMQVRFX1RBR19QT1NJVElPTi5FTEVNRU5ULlxuLy9cbi8vIC0gYGNvbnRlbnRgIGFuZCBgZWxzZUNvbnRlbnRgIC0gV2hlbiBhIEJMT0NLT1BFTiB0YWcncyBjb250ZW50cyBhcmVcbi8vICAgcGFyc2VkLCB0aGV5IGFyZSBwdXQgaGVyZS4gIGBlbHNlQ29udGVudGAgd2lsbCBvbmx5IGJlIHByZXNlbnQgaWZcbi8vICAgYW4gYHt7ZWxzZX19YCB3YXMgZm91bmQuXG5cbnZhciBURU1QTEFURV9UQUdfUE9TSVRJT04gPSBIVE1MVG9vbHMuVEVNUExBVEVfVEFHX1BPU0lUSU9OO1xuXG5leHBvcnQgZnVuY3Rpb24gVGVtcGxhdGVUYWcgKCkge1xuICBIVE1MVG9vbHMuVGVtcGxhdGVUYWcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxuVGVtcGxhdGVUYWcucHJvdG90eXBlID0gbmV3IEhUTUxUb29scy5UZW1wbGF0ZVRhZztcblRlbXBsYXRlVGFnLnByb3RvdHlwZS5jb25zdHJ1Y3Rvck5hbWUgPSAnU3BhY2ViYXJzQ29tcGlsZXIuVGVtcGxhdGVUYWcnO1xuXG52YXIgbWFrZVN0YWNoZVRhZ1N0YXJ0UmVnZXggPSBmdW5jdGlvbiAocikge1xuICByZXR1cm4gbmV3IFJlZ0V4cChyLnNvdXJjZSArIC8oPyFbez4hIy9dKS8uc291cmNlLFxuICAgICAgICAgICAgICAgICAgICByLmlnbm9yZUNhc2UgPyAnaScgOiAnJyk7XG59O1xuXG4vLyBcInN0YXJ0c1wiIHJlZ2V4ZXMgYXJlIHVzZWQgdG8gc2VlIHdoYXQgdHlwZSBvZiB0ZW1wbGF0ZVxuLy8gdGFnIHRoZSBwYXJzZXIgaXMgbG9va2luZyBhdC4gIFRoZXkgbXVzdCBtYXRjaCBhIG5vbi1lbXB0eVxuLy8gcmVzdWx0LCBidXQgbm90IHRoZSBpbnRlcmVzdGluZyBwYXJ0IG9mIHRoZSB0YWcuXG52YXIgc3RhcnRzID0ge1xuICBFU0NBUEU6IC9eXFx7XFx7KD89XFx7KlxcfCkvLFxuICBFTFNFOiBtYWtlU3RhY2hlVGFnU3RhcnRSZWdleCgvXlxce1xce1xccyplbHNlKFxccysoPyFcXHMpfCg/PVt9XSkpL2kpLFxuICBET1VCTEU6IG1ha2VTdGFjaGVUYWdTdGFydFJlZ2V4KC9eXFx7XFx7XFxzKig/IVxccykvKSxcbiAgVFJJUExFOiBtYWtlU3RhY2hlVGFnU3RhcnRSZWdleCgvXlxce1xce1xce1xccyooPyFcXHMpLyksXG4gIEJMT0NLQ09NTUVOVDogbWFrZVN0YWNoZVRhZ1N0YXJ0UmVnZXgoL15cXHtcXHtcXHMqIS0tLyksXG4gIENPTU1FTlQ6IG1ha2VTdGFjaGVUYWdTdGFydFJlZ2V4KC9eXFx7XFx7XFxzKiEvKSxcbiAgSU5DTFVTSU9OOiBtYWtlU3RhY2hlVGFnU3RhcnRSZWdleCgvXlxce1xce1xccyo+XFxzKig/IVxccykvKSxcbiAgQkxPQ0tPUEVOOiBtYWtlU3RhY2hlVGFnU3RhcnRSZWdleCgvXlxce1xce1xccyojXFxzKig/IVxccykvKSxcbiAgQkxPQ0tDTE9TRTogbWFrZVN0YWNoZVRhZ1N0YXJ0UmVnZXgoL15cXHtcXHtcXHMqXFwvXFxzKig/IVxccykvKVxufTtcblxudmFyIGVuZHMgPSB7XG4gIERPVUJMRTogL15cXHMqXFx9XFx9LyxcbiAgVFJJUExFOiAvXlxccypcXH1cXH1cXH0vLFxuICBFWFBSOiAvXlxccypcXCkvXG59O1xuXG52YXIgZW5kc1N0cmluZyA9IHtcbiAgRE9VQkxFOiAnfX0nLFxuICBUUklQTEU6ICd9fX0nLFxuICBFWFBSOiAnKSdcbn07XG5cbi8vIFBhcnNlIGEgdGFnIGZyb20gdGhlIHByb3ZpZGVkIHNjYW5uZXIgb3Igc3RyaW5nLiAgSWYgdGhlIGlucHV0XG4vLyBkb2Vzbid0IHN0YXJ0IHdpdGggYHt7YCwgcmV0dXJucyBudWxsLiAgT3RoZXJ3aXNlLCBlaXRoZXIgc3VjY2VlZHNcbi8vIGFuZCByZXR1cm5zIGEgU3BhY2ViYXJzQ29tcGlsZXIuVGVtcGxhdGVUYWcsIG9yIHRocm93cyBhbiBlcnJvciAodXNpbmdcbi8vIGBzY2FubmVyLmZhdGFsYCBpZiBhIHNjYW5uZXIgaXMgcHJvdmlkZWQpLlxuVGVtcGxhdGVUYWcucGFyc2UgPSBmdW5jdGlvbiAoc2Nhbm5lck9yU3RyaW5nKSB7XG4gIHZhciBzY2FubmVyID0gc2Nhbm5lck9yU3RyaW5nO1xuICBpZiAodHlwZW9mIHNjYW5uZXIgPT09ICdzdHJpbmcnKVxuICAgIHNjYW5uZXIgPSBuZXcgSFRNTFRvb2xzLlNjYW5uZXIoc2Nhbm5lck9yU3RyaW5nKTtcblxuICBpZiAoISAoc2Nhbm5lci5wZWVrKCkgPT09ICd7JyAmJlxuICAgICAgICAgKHNjYW5uZXIucmVzdCgpKS5zbGljZSgwLCAyKSA9PT0gJ3t7JykpXG4gICAgcmV0dXJuIG51bGw7XG5cbiAgdmFyIHJ1biA9IGZ1bmN0aW9uIChyZWdleCkge1xuICAgIC8vIHJlZ2V4IGlzIGFzc3VtZWQgdG8gc3RhcnQgd2l0aCBgXmBcbiAgICB2YXIgcmVzdWx0ID0gcmVnZXguZXhlYyhzY2FubmVyLnJlc3QoKSk7XG4gICAgaWYgKCEgcmVzdWx0KVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgdmFyIHJldCA9IHJlc3VsdFswXTtcbiAgICBzY2FubmVyLnBvcyArPSByZXQubGVuZ3RoO1xuICAgIHJldHVybiByZXQ7XG4gIH07XG5cbiAgdmFyIGFkdmFuY2UgPSBmdW5jdGlvbiAoYW1vdW50KSB7XG4gICAgc2Nhbm5lci5wb3MgKz0gYW1vdW50O1xuICB9O1xuXG4gIHZhciBzY2FuSWRlbnRpZmllciA9IGZ1bmN0aW9uIChpc0ZpcnN0SW5QYXRoKSB7XG4gICAgdmFyIGlkID0gQmxhemVUb29scy5wYXJzZUV4dGVuZGVkSWRlbnRpZmllck5hbWUoc2Nhbm5lcik7XG4gICAgaWYgKCEgaWQpIHtcbiAgICAgIGV4cGVjdGVkKCdJREVOVElGSUVSJyk7XG4gICAgfVxuICAgIGlmIChpc0ZpcnN0SW5QYXRoICYmXG4gICAgICAgIChpZCA9PT0gJ251bGwnIHx8IGlkID09PSAndHJ1ZScgfHwgaWQgPT09ICdmYWxzZScpKVxuICAgICAgc2Nhbm5lci5mYXRhbChcIkNhbid0IHVzZSBudWxsLCB0cnVlLCBvciBmYWxzZSwgYXMgYW4gaWRlbnRpZmllciBhdCBzdGFydCBvZiBwYXRoXCIpO1xuXG4gICAgcmV0dXJuIGlkO1xuICB9O1xuXG4gIHZhciBzY2FuUGF0aCA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VnbWVudHMgPSBbXTtcblxuICAgIC8vIGhhbmRsZSBpbml0aWFsIGAuYCwgYC4uYCwgYC4vYCwgYC4uL2AsIGAuLi8uLmAsIGAuLi8uLi9gLCBldGNcbiAgICB2YXIgZG90cztcbiAgICBpZiAoKGRvdHMgPSBydW4oL15bXFwuXFwvXSsvKSkpIHtcbiAgICAgIHZhciBhbmNlc3RvclN0ciA9ICcuJzsgLy8gZWcgYC4uLy4uLy4uYCBtYXBzIHRvIGAuLi4uYFxuICAgICAgdmFyIGVuZHNXaXRoU2xhc2ggPSAvXFwvJC8udGVzdChkb3RzKTtcblxuICAgICAgaWYgKGVuZHNXaXRoU2xhc2gpXG4gICAgICAgIGRvdHMgPSBkb3RzLnNsaWNlKDAsIC0xKTtcblxuICAgICAgZG90cy5zcGxpdCgnLycpLmZvckVhY2goZnVuY3Rpb24oZG90Q2xhdXNlLCBpbmRleCkge1xuICAgICAgICBpZiAoaW5kZXggPT09IDApIHtcbiAgICAgICAgICBpZiAoZG90Q2xhdXNlICE9PSAnLicgJiYgZG90Q2xhdXNlICE9PSAnLi4nKVxuICAgICAgICAgICAgZXhwZWN0ZWQoXCJgLmAsIGAuLmAsIGAuL2Agb3IgYC4uL2BcIik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGRvdENsYXVzZSAhPT0gJy4uJylcbiAgICAgICAgICAgIGV4cGVjdGVkKFwiYC4uYCBvciBgLi4vYFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkb3RDbGF1c2UgPT09ICcuLicpXG4gICAgICAgICAgYW5jZXN0b3JTdHIgKz0gJy4nO1xuICAgICAgfSk7XG5cbiAgICAgIHNlZ21lbnRzLnB1c2goYW5jZXN0b3JTdHIpO1xuXG4gICAgICBpZiAoIWVuZHNXaXRoU2xhc2gpXG4gICAgICAgIHJldHVybiBzZWdtZW50cztcbiAgICB9XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgLy8gc2NhbiBhIHBhdGggc2VnbWVudFxuXG4gICAgICBpZiAocnVuKC9eXFxbLykpIHtcbiAgICAgICAgdmFyIHNlZyA9IHJ1bigvXltcXHNcXFNdKj9cXF0vKTtcbiAgICAgICAgaWYgKCEgc2VnKVxuICAgICAgICAgIGVycm9yKFwiVW50ZXJtaW5hdGVkIHBhdGggc2VnbWVudFwiKTtcbiAgICAgICAgc2VnID0gc2VnLnNsaWNlKDAsIC0xKTtcbiAgICAgICAgaWYgKCEgc2VnICYmICEgc2VnbWVudHMubGVuZ3RoKVxuICAgICAgICAgIGVycm9yKFwiUGF0aCBjYW4ndCBzdGFydCB3aXRoIGVtcHR5IHN0cmluZ1wiKTtcbiAgICAgICAgc2VnbWVudHMucHVzaChzZWcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGlkID0gc2NhbklkZW50aWZpZXIoISBzZWdtZW50cy5sZW5ndGgpO1xuICAgICAgICBpZiAoaWQgPT09ICd0aGlzJykge1xuICAgICAgICAgIGlmICghIHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gaW5pdGlhbCBgdGhpc2BcbiAgICAgICAgICAgIHNlZ21lbnRzLnB1c2goJy4nKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXJyb3IoXCJDYW4gb25seSB1c2UgYHRoaXNgIGF0IHRoZSBiZWdpbm5pbmcgb2YgYSBwYXRoLlxcbkluc3RlYWQgb2YgYGZvby50aGlzYCBvciBgLi4vdGhpc2AsIGp1c3Qgd3JpdGUgYGZvb2Agb3IgYC4uYC5cIik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2goaWQpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBzZXAgPSBydW4oL15bXFwuXFwvXS8pO1xuICAgICAgaWYgKCEgc2VwKVxuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gc2VnbWVudHM7XG4gIH07XG5cbiAgLy8gc2NhbiB0aGUga2V5d29yZCBwb3J0aW9uIG9mIGEga2V5d29yZCBhcmd1bWVudFxuICAvLyAodGhlIFwiZm9vXCIgcG9ydGlvbiBpbiBcImZvbz1iYXJcIikuXG4gIC8vIFJlc3VsdCBpcyBlaXRoZXIgdGhlIGtleXdvcmQgbWF0Y2hlZCwgb3IgbnVsbFxuICAvLyBpZiB3ZSdyZSBub3QgYXQgYSBrZXl3b3JkIGFyZ3VtZW50IHBvc2l0aW9uLlxuICB2YXIgc2NhbkFyZ0tleXdvcmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1hdGNoID0gL14oW15cXHtcXH1cXChcXClcXD4jPVxcc1wiJ1xcW1xcXV0rKVxccyo9XFxzKi8uZXhlYyhzY2FubmVyLnJlc3QoKSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBzY2FubmVyLnBvcyArPSBtYXRjaFswXS5sZW5ndGg7XG4gICAgICByZXR1cm4gbWF0Y2hbMV07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfTtcblxuICAvLyBzY2FuIGFuIGFyZ3VtZW50OyBzdWNjZWVkcyBvciBlcnJvcnMuXG4gIC8vIFJlc3VsdCBpcyBhbiBhcnJheSBvZiB0d28gb3IgdGhyZWUgaXRlbXM6XG4gIC8vIHR5cGUgLCB2YWx1ZSwgYW5kIChpbmRpY2F0aW5nIGEga2V5d29yZCBhcmd1bWVudClcbiAgLy8ga2V5d29yZCBuYW1lLlxuICB2YXIgc2NhbkFyZyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIga2V5d29yZCA9IHNjYW5BcmdLZXl3b3JkKCk7IC8vIG51bGwgaWYgbm90IHBhcnNpbmcgYSBrd2FyZ1xuICAgIHZhciB2YWx1ZSA9IHNjYW5BcmdWYWx1ZSgpO1xuICAgIHJldHVybiBrZXl3b3JkID8gdmFsdWUuY29uY2F0KGtleXdvcmQpIDogdmFsdWU7XG4gIH07XG5cbiAgLy8gc2NhbiBhbiBhcmd1bWVudCB2YWx1ZSAoZm9yIGtleXdvcmQgb3IgcG9zaXRpb25hbCBhcmd1bWVudHMpO1xuICAvLyBzdWNjZWVkcyBvciBlcnJvcnMuICBSZXN1bHQgaXMgYW4gYXJyYXkgb2YgdHlwZSwgdmFsdWUuXG4gIHZhciBzY2FuQXJnVmFsdWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXJ0UG9zID0gc2Nhbm5lci5wb3M7XG4gICAgdmFyIHJlc3VsdDtcbiAgICBpZiAoKHJlc3VsdCA9IEJsYXplVG9vbHMucGFyc2VOdW1iZXIoc2Nhbm5lcikpKSB7XG4gICAgICByZXR1cm4gWydOVU1CRVInLCByZXN1bHQudmFsdWVdO1xuICAgIH0gZWxzZSBpZiAoKHJlc3VsdCA9IEJsYXplVG9vbHMucGFyc2VTdHJpbmdMaXRlcmFsKHNjYW5uZXIpKSkge1xuICAgICAgcmV0dXJuIFsnU1RSSU5HJywgcmVzdWx0LnZhbHVlXTtcbiAgICB9IGVsc2UgaWYgKC9eW1xcLlxcW10vLnRlc3Qoc2Nhbm5lci5wZWVrKCkpKSB7XG4gICAgICByZXR1cm4gWydQQVRIJywgc2NhblBhdGgoKV07XG4gICAgfSBlbHNlIGlmIChydW4oL15cXCgvKSkge1xuICAgICAgcmV0dXJuIFsnRVhQUicsIHNjYW5FeHByKCdFWFBSJyldO1xuICAgIH0gZWxzZSBpZiAoKHJlc3VsdCA9IEJsYXplVG9vbHMucGFyc2VFeHRlbmRlZElkZW50aWZpZXJOYW1lKHNjYW5uZXIpKSkge1xuICAgICAgdmFyIGlkID0gcmVzdWx0O1xuICAgICAgaWYgKGlkID09PSAnbnVsbCcpIHtcbiAgICAgICAgcmV0dXJuIFsnTlVMTCcsIG51bGxdO1xuICAgICAgfSBlbHNlIGlmIChpZCA9PT0gJ3RydWUnIHx8IGlkID09PSAnZmFsc2UnKSB7XG4gICAgICAgIHJldHVybiBbJ0JPT0xFQU4nLCBpZCA9PT0gJ3RydWUnXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNjYW5uZXIucG9zID0gc3RhcnRQb3M7IC8vIHVuY29uc3VtZSBgaWRgXG4gICAgICAgIHJldHVybiBbJ1BBVEgnLCBzY2FuUGF0aCgpXTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZXhwZWN0ZWQoJ2lkZW50aWZpZXIsIG51bWJlciwgc3RyaW5nLCBib29sZWFuLCBudWxsLCBvciBhIHN1YiBleHByZXNzaW9uIGVuY2xvc2VkIGluIFwiKFwiLCBcIilcIicpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgc2NhbkV4cHIgPSBmdW5jdGlvbiAodHlwZSkge1xuICAgIHZhciBlbmRUeXBlID0gdHlwZTtcbiAgICBpZiAodHlwZSA9PT0gJ0lOQ0xVU0lPTicgfHwgdHlwZSA9PT0gJ0JMT0NLT1BFTicgfHwgdHlwZSA9PT0gJ0VMU0UnKVxuICAgICAgZW5kVHlwZSA9ICdET1VCTEUnO1xuXG4gICAgdmFyIHRhZyA9IG5ldyBUZW1wbGF0ZVRhZztcbiAgICB0YWcudHlwZSA9IHR5cGU7XG4gICAgdGFnLnBhdGggPSBzY2FuUGF0aCgpO1xuICAgIHRhZy5hcmdzID0gW107XG4gICAgdmFyIGZvdW5kS3dBcmcgPSBmYWxzZTtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgcnVuKC9eXFxzKi8pO1xuICAgICAgaWYgKHJ1bihlbmRzW2VuZFR5cGVdKSlcbiAgICAgICAgYnJlYWs7XG4gICAgICBlbHNlIGlmICgvXlt9KV0vLnRlc3Qoc2Nhbm5lci5wZWVrKCkpKSB7XG4gICAgICAgIGV4cGVjdGVkKCdgJyArIGVuZHNTdHJpbmdbZW5kVHlwZV0gKyAnYCcpO1xuICAgICAgfVxuICAgICAgdmFyIG5ld0FyZyA9IHNjYW5BcmcoKTtcbiAgICAgIGlmIChuZXdBcmcubGVuZ3RoID09PSAzKSB7XG4gICAgICAgIGZvdW5kS3dBcmcgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGZvdW5kS3dBcmcpXG4gICAgICAgICAgZXJyb3IoXCJDYW4ndCBoYXZlIGEgbm9uLWtleXdvcmQgYXJndW1lbnQgYWZ0ZXIgYSBrZXl3b3JkIGFyZ3VtZW50XCIpO1xuICAgICAgfVxuICAgICAgdGFnLmFyZ3MucHVzaChuZXdBcmcpO1xuXG4gICAgICAvLyBleHBlY3QgYSB3aGl0ZXNwYWNlIG9yIGEgY2xvc2luZyAnKScgb3IgJ30nXG4gICAgICBpZiAocnVuKC9eKD89W1xcc30pXSkvKSAhPT0gJycpXG4gICAgICAgIGV4cGVjdGVkKCdzcGFjZScpO1xuICAgIH1cblxuICAgIHJldHVybiB0YWc7XG4gIH07XG5cbiAgdmFyIHR5cGU7XG5cbiAgdmFyIGVycm9yID0gZnVuY3Rpb24gKG1zZykge1xuICAgIHNjYW5uZXIuZmF0YWwobXNnKTtcbiAgfTtcblxuICB2YXIgZXhwZWN0ZWQgPSBmdW5jdGlvbiAod2hhdCkge1xuICAgIGVycm9yKCdFeHBlY3RlZCAnICsgd2hhdCk7XG4gIH07XG5cbiAgLy8gbXVzdCBkbyBFU0NBUEUgZmlyc3QsIGltbWVkaWF0ZWx5IGZvbGxvd2VkIGJ5IEVMU0VcbiAgLy8gb3JkZXIgb2Ygb3RoZXJzIGRvZXNuJ3QgbWF0dGVyXG4gIGlmIChydW4oc3RhcnRzLkVTQ0FQRSkpIHR5cGUgPSAnRVNDQVBFJztcbiAgZWxzZSBpZiAocnVuKHN0YXJ0cy5FTFNFKSkgdHlwZSA9ICdFTFNFJztcbiAgZWxzZSBpZiAocnVuKHN0YXJ0cy5ET1VCTEUpKSB0eXBlID0gJ0RPVUJMRSc7XG4gIGVsc2UgaWYgKHJ1bihzdGFydHMuVFJJUExFKSkgdHlwZSA9ICdUUklQTEUnO1xuICBlbHNlIGlmIChydW4oc3RhcnRzLkJMT0NLQ09NTUVOVCkpIHR5cGUgPSAnQkxPQ0tDT01NRU5UJztcbiAgZWxzZSBpZiAocnVuKHN0YXJ0cy5DT01NRU5UKSkgdHlwZSA9ICdDT01NRU5UJztcbiAgZWxzZSBpZiAocnVuKHN0YXJ0cy5JTkNMVVNJT04pKSB0eXBlID0gJ0lOQ0xVU0lPTic7XG4gIGVsc2UgaWYgKHJ1bihzdGFydHMuQkxPQ0tPUEVOKSkgdHlwZSA9ICdCTE9DS09QRU4nO1xuICBlbHNlIGlmIChydW4oc3RhcnRzLkJMT0NLQ0xPU0UpKSB0eXBlID0gJ0JMT0NLQ0xPU0UnO1xuICBlbHNlXG4gICAgZXJyb3IoJ1Vua25vd24gc3RhY2hlIHRhZycpO1xuXG4gIHZhciB0YWcgPSBuZXcgVGVtcGxhdGVUYWc7XG4gIHRhZy50eXBlID0gdHlwZTtcblxuICBpZiAodHlwZSA9PT0gJ0JMT0NLQ09NTUVOVCcpIHtcbiAgICB2YXIgcmVzdWx0ID0gcnVuKC9eW1xcc1xcU10qPy0tXFxzKj9cXH1cXH0vKTtcbiAgICBpZiAoISByZXN1bHQpXG4gICAgICBlcnJvcihcIlVuY2xvc2VkIGJsb2NrIGNvbW1lbnRcIik7XG4gICAgdGFnLnZhbHVlID0gcmVzdWx0LnNsaWNlKDAsIHJlc3VsdC5sYXN0SW5kZXhPZignLS0nKSk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0NPTU1FTlQnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHJ1bigvXltcXHNcXFNdKj9cXH1cXH0vKTtcbiAgICBpZiAoISByZXN1bHQpXG4gICAgICBlcnJvcihcIlVuY2xvc2VkIGNvbW1lbnRcIik7XG4gICAgdGFnLnZhbHVlID0gcmVzdWx0LnNsaWNlKDAsIC0yKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSAnQkxPQ0tDTE9TRScpIHtcbiAgICB0YWcucGF0aCA9IHNjYW5QYXRoKCk7XG4gICAgaWYgKCEgcnVuKGVuZHMuRE9VQkxFKSlcbiAgICAgIGV4cGVjdGVkKCdgfX1gJyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gJ0VMU0UnKSB7XG4gICAgaWYgKCEgcnVuKGVuZHMuRE9VQkxFKSkge1xuICAgICAgdGFnID0gc2NhbkV4cHIodHlwZSk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09ICdFU0NBUEUnKSB7XG4gICAgdmFyIHJlc3VsdCA9IHJ1bigvXlxceypcXHwvKTtcbiAgICB0YWcudmFsdWUgPSAne3snICsgcmVzdWx0LnNsaWNlKDAsIC0xKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBET1VCTEUsIFRSSVBMRSwgQkxPQ0tPUEVOLCBJTkNMVVNJT05cbiAgICB0YWcgPSBzY2FuRXhwcih0eXBlKTtcbiAgfVxuXG4gIHJldHVybiB0YWc7XG59O1xuXG4vLyBSZXR1cm5zIGEgU3BhY2ViYXJzQ29tcGlsZXIuVGVtcGxhdGVUYWcgcGFyc2VkIGZyb20gYHNjYW5uZXJgLCBsZWF2aW5nIHNjYW5uZXJcbi8vIGF0IGl0cyBvcmlnaW5hbCBwb3NpdGlvbi5cbi8vXG4vLyBBbiBlcnJvciB3aWxsIHN0aWxsIGJlIHRocm93biBpZiB0aGVyZSBpcyBub3QgYSB2YWxpZCB0ZW1wbGF0ZSB0YWcgYXRcbi8vIHRoZSBjdXJyZW50IHBvc2l0aW9uLlxuVGVtcGxhdGVUYWcucGVlayA9IGZ1bmN0aW9uIChzY2FubmVyKSB7XG4gIHZhciBzdGFydFBvcyA9IHNjYW5uZXIucG9zO1xuICB2YXIgcmVzdWx0ID0gVGVtcGxhdGVUYWcucGFyc2Uoc2Nhbm5lcik7XG4gIHNjYW5uZXIucG9zID0gc3RhcnRQb3M7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG4vLyBMaWtlIGBUZW1wbGF0ZVRhZy5wYXJzZWAsIGJ1dCBpbiB0aGUgY2FzZSBvZiBibG9ja3MsIHBhcnNlIHRoZSBjb21wbGV0ZVxuLy8gYHt7I2Zvb319Li4ue3svZm9vfX1gIHdpdGggYGNvbnRlbnRgIGFuZCBwb3NzaWJsZSBgZWxzZUNvbnRlbnRgLCByYXRoZXJcbi8vIHRoYW4ganVzdCB0aGUgQkxPQ0tPUEVOIHRhZy5cbi8vXG4vLyBJbiBhZGRpdGlvbjpcbi8vXG4vLyAtIFRocm93cyBhbiBlcnJvciBpZiBge3tlbHNlfX1gIG9yIGB7ey9mb299fWAgdGFnIGlzIGVuY291bnRlcmVkLlxuLy9cbi8vIC0gUmV0dXJucyBgbnVsbGAgZm9yIGEgQ09NTUVOVC4gIChUaGlzIGNhc2UgaXMgZGlzdGluZ3Vpc2hhYmxlIGZyb21cbi8vICAgcGFyc2luZyBubyB0YWcgYnkgdGhlIGZhY3QgdGhhdCB0aGUgc2Nhbm5lciBpcyBhZHZhbmNlZC4pXG4vL1xuLy8gLSBUYWtlcyBhbiBIVE1MVG9vbHMuVEVNUExBVEVfVEFHX1BPU0lUSU9OIGBwb3NpdGlvbmAgYW5kIHNldHMgaXQgYXMgdGhlXG4vLyAgIFRlbXBsYXRlVGFnJ3MgYC5wb3NpdGlvbmAgcHJvcGVydHkuXG4vL1xuLy8gLSBWYWxpZGF0ZXMgdGhlIHRhZydzIHdlbGwtZm9ybWVkbmVzcyBhbmQgbGVnYWxpdHkgYXQgaW4gaXRzIHBvc2l0aW9uLlxuVGVtcGxhdGVUYWcucGFyc2VDb21wbGV0ZVRhZyA9IGZ1bmN0aW9uIChzY2FubmVyT3JTdHJpbmcsIHBvc2l0aW9uKSB7XG4gIHZhciBzY2FubmVyID0gc2Nhbm5lck9yU3RyaW5nO1xuICBpZiAodHlwZW9mIHNjYW5uZXIgPT09ICdzdHJpbmcnKVxuICAgIHNjYW5uZXIgPSBuZXcgSFRNTFRvb2xzLlNjYW5uZXIoc2Nhbm5lck9yU3RyaW5nKTtcblxuICB2YXIgc3RhcnRQb3MgPSBzY2FubmVyLnBvczsgLy8gZm9yIGVycm9yIG1lc3NhZ2VzXG4gIHZhciByZXN1bHQgPSBUZW1wbGF0ZVRhZy5wYXJzZShzY2FubmVyT3JTdHJpbmcpO1xuICBpZiAoISByZXN1bHQpXG4gICAgcmV0dXJuIHJlc3VsdDtcblxuICBpZiAocmVzdWx0LnR5cGUgPT09ICdCTE9DS0NPTU1FTlQnKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmIChyZXN1bHQudHlwZSA9PT0gJ0NPTU1FTlQnKVxuICAgIHJldHVybiBudWxsO1xuXG4gIGlmIChyZXN1bHQudHlwZSA9PT0gJ0VMU0UnKVxuICAgIHNjYW5uZXIuZmF0YWwoXCJVbmV4cGVjdGVkIHt7ZWxzZX19XCIpO1xuXG4gIGlmIChyZXN1bHQudHlwZSA9PT0gJ0JMT0NLQ0xPU0UnKVxuICAgIHNjYW5uZXIuZmF0YWwoXCJVbmV4cGVjdGVkIGNsb3NpbmcgdGVtcGxhdGUgdGFnXCIpO1xuXG4gIHBvc2l0aW9uID0gKHBvc2l0aW9uIHx8IFRFTVBMQVRFX1RBR19QT1NJVElPTi5FTEVNRU5UKTtcbiAgaWYgKHBvc2l0aW9uICE9PSBURU1QTEFURV9UQUdfUE9TSVRJT04uRUxFTUVOVClcbiAgICByZXN1bHQucG9zaXRpb24gPSBwb3NpdGlvbjtcblxuICBpZiAocmVzdWx0LnR5cGUgPT09ICdCTE9DS09QRU4nKSB7XG4gICAgLy8gcGFyc2UgYmxvY2sgY29udGVudHNcblxuICAgIC8vIENvbnN0cnVjdCBhIHN0cmluZyB2ZXJzaW9uIG9mIGAucGF0aGAgZm9yIGNvbXBhcmluZyBzdGFydCBhbmRcbiAgICAvLyBlbmQgdGFncy4gIEZvciBleGFtcGxlLCBgZm9vL1swXWAgd2FzIHBhcnNlZCBpbnRvIGBbXCJmb29cIiwgXCIwXCJdYFxuICAgIC8vIGFuZCBub3cgYmVjb21lcyBgZm9vLDBgLiAgVGhpcyBmb3JtIG1heSBhbHNvIHNob3cgdXAgaW4gZXJyb3JcbiAgICAvLyBtZXNzYWdlcy5cbiAgICB2YXIgYmxvY2tOYW1lID0gcmVzdWx0LnBhdGguam9pbignLCcpO1xuXG4gICAgdmFyIHRleHRNb2RlID0gbnVsbDtcbiAgICAgIGlmIChibG9ja05hbWUgPT09ICdtYXJrZG93bicgfHxcbiAgICAgICAgICBwb3NpdGlvbiA9PT0gVEVNUExBVEVfVEFHX1BPU0lUSU9OLklOX1JBV1RFWFQpIHtcbiAgICAgICAgdGV4dE1vZGUgPSBIVE1MLlRFWFRNT0RFLlNUUklORztcbiAgICAgIH0gZWxzZSBpZiAocG9zaXRpb24gPT09IFRFTVBMQVRFX1RBR19QT1NJVElPTi5JTl9SQ0RBVEEgfHxcbiAgICAgICAgICAgICAgICAgcG9zaXRpb24gPT09IFRFTVBMQVRFX1RBR19QT1NJVElPTi5JTl9BVFRSSUJVVEUpIHtcbiAgICAgICAgdGV4dE1vZGUgPSBIVE1MLlRFWFRNT0RFLlJDREFUQTtcbiAgICAgIH1cbiAgICAgIHZhciBwYXJzZXJPcHRpb25zID0ge1xuICAgICAgICBnZXRUZW1wbGF0ZVRhZzogVGVtcGxhdGVUYWcucGFyc2VDb21wbGV0ZVRhZyxcbiAgICAgICAgc2hvdWxkU3RvcDogaXNBdEJsb2NrQ2xvc2VPckVsc2UsXG4gICAgICAgIHRleHRNb2RlOiB0ZXh0TW9kZVxuICAgICAgfTtcbiAgICByZXN1bHQudGV4dE1vZGUgPSB0ZXh0TW9kZTtcbiAgICByZXN1bHQuY29udGVudCA9IEhUTUxUb29scy5wYXJzZUZyYWdtZW50KHNjYW5uZXIsIHBhcnNlck9wdGlvbnMpO1xuXG4gICAgaWYgKHNjYW5uZXIucmVzdCgpLnNsaWNlKDAsIDIpICE9PSAne3snKVxuICAgICAgc2Nhbm5lci5mYXRhbChcIkV4cGVjdGVkIHt7ZWxzZX19IG9yIGJsb2NrIGNsb3NlIGZvciBcIiArIGJsb2NrTmFtZSk7XG5cbiAgICB2YXIgbGFzdFBvcyA9IHNjYW5uZXIucG9zOyAvLyBzYXZlIGZvciBlcnJvciBtZXNzYWdlc1xuICAgIHZhciB0bXBsVGFnID0gVGVtcGxhdGVUYWcucGFyc2Uoc2Nhbm5lcik7IC8vIHt7ZWxzZX19IG9yIHt7L2Zvb319XG5cbiAgICB2YXIgbGFzdEVsc2VDb250ZW50VGFnID0gcmVzdWx0O1xuICAgIHdoaWxlICh0bXBsVGFnLnR5cGUgPT09ICdFTFNFJykge1xuICAgICAgaWYgKGxhc3RFbHNlQ29udGVudFRhZyA9PT0gbnVsbCkge1xuICAgICAgICBzY2FubmVyLmZhdGFsKFwiVW5leHBlY3RlZCBlbHNlIGFmdGVyIHt7ZWxzZX19XCIpO1xuICAgICAgfVxuXG4gICAgICBpZiAodG1wbFRhZy5wYXRoKSB7XG4gICAgICAgIGxhc3RFbHNlQ29udGVudFRhZy5lbHNlQ29udGVudCA9IG5ldyBUZW1wbGF0ZVRhZztcbiAgICAgICAgbGFzdEVsc2VDb250ZW50VGFnLmVsc2VDb250ZW50LnR5cGUgPSAnQkxPQ0tPUEVOJztcbiAgICAgICAgbGFzdEVsc2VDb250ZW50VGFnLmVsc2VDb250ZW50LnBhdGggPSB0bXBsVGFnLnBhdGg7XG4gICAgICAgIGxhc3RFbHNlQ29udGVudFRhZy5lbHNlQ29udGVudC5hcmdzID0gdG1wbFRhZy5hcmdzO1xuICAgICAgICBsYXN0RWxzZUNvbnRlbnRUYWcuZWxzZUNvbnRlbnQudGV4dE1vZGUgPSB0ZXh0TW9kZTtcbiAgICAgICAgbGFzdEVsc2VDb250ZW50VGFnLmVsc2VDb250ZW50LmNvbnRlbnQgPSBIVE1MVG9vbHMucGFyc2VGcmFnbWVudChzY2FubmVyLCBwYXJzZXJPcHRpb25zKTtcblxuICAgICAgICBsYXN0RWxzZUNvbnRlbnRUYWcgPSBsYXN0RWxzZUNvbnRlbnRUYWcuZWxzZUNvbnRlbnQ7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgLy8gcGFyc2Uge3tlbHNlfX0gYW5kIGNvbnRlbnQgdXAgdG8gY2xvc2UgdGFnXG4gICAgICAgIGxhc3RFbHNlQ29udGVudFRhZy5lbHNlQ29udGVudCA9IEhUTUxUb29scy5wYXJzZUZyYWdtZW50KHNjYW5uZXIsIHBhcnNlck9wdGlvbnMpO1xuXG4gICAgICAgIGxhc3RFbHNlQ29udGVudFRhZyA9IG51bGw7XG4gICAgICB9XG5cbiAgICAgIGlmIChzY2FubmVyLnJlc3QoKS5zbGljZSgwLCAyKSAhPT0gJ3t7JylcbiAgICAgICAgc2Nhbm5lci5mYXRhbChcIkV4cGVjdGVkIGJsb2NrIGNsb3NlIGZvciBcIiArIGJsb2NrTmFtZSk7XG5cbiAgICAgIGxhc3RQb3MgPSBzY2FubmVyLnBvcztcbiAgICAgIHRtcGxUYWcgPSBUZW1wbGF0ZVRhZy5wYXJzZShzY2FubmVyKTtcbiAgICB9XG5cbiAgICBpZiAodG1wbFRhZy50eXBlID09PSAnQkxPQ0tDTE9TRScpIHtcbiAgICAgIHZhciBibG9ja05hbWUyID0gdG1wbFRhZy5wYXRoLmpvaW4oJywnKTtcbiAgICAgIGlmIChibG9ja05hbWUgIT09IGJsb2NrTmFtZTIpIHtcbiAgICAgICAgc2Nhbm5lci5wb3MgPSBsYXN0UG9zO1xuICAgICAgICBzY2FubmVyLmZhdGFsKCdFeHBlY3RlZCB0YWcgdG8gY2xvc2UgJyArIGJsb2NrTmFtZSArICcsIGZvdW5kICcgK1xuICAgICAgICAgICAgICAgICAgICAgIGJsb2NrTmFtZTIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzY2FubmVyLnBvcyA9IGxhc3RQb3M7XG4gICAgICBzY2FubmVyLmZhdGFsKCdFeHBlY3RlZCB0YWcgdG8gY2xvc2UgJyArIGJsb2NrTmFtZSArICcsIGZvdW5kICcgK1xuICAgICAgICAgICAgICAgICAgICB0bXBsVGFnLnR5cGUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBmaW5hbFBvcyA9IHNjYW5uZXIucG9zO1xuICBzY2FubmVyLnBvcyA9IHN0YXJ0UG9zO1xuICB2YWxpZGF0ZVRhZyhyZXN1bHQsIHNjYW5uZXIpO1xuICBzY2FubmVyLnBvcyA9IGZpbmFsUG9zO1xuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG52YXIgaXNBdEJsb2NrQ2xvc2VPckVsc2UgPSBmdW5jdGlvbiAoc2Nhbm5lcikge1xuICAvLyBEZXRlY3QgYHt7ZWxzZX19YCBvciBge3svZm9vfX1gLlxuICAvL1xuICAvLyBXZSBkbyBhcyBtdWNoIHdvcmsgb3Vyc2VsdmVzIGJlZm9yZSBkZWZlcnJpbmcgdG8gYFRlbXBsYXRlVGFnLnBlZWtgLFxuICAvLyBmb3IgZWZmaWNpZW5jeSAod2UncmUgY2FsbGVkIGZvciBldmVyeSBpbnB1dCB0b2tlbikgYW5kIHRvIGJlXG4gIC8vIGxlc3Mgb2J0cnVzaXZlLCBiZWNhdXNlIGBUZW1wbGF0ZVRhZy5wZWVrYCB3aWxsIHRocm93IGFuIGVycm9yIGlmIGl0XG4gIC8vIHNlZXMgYHt7YCBmb2xsb3dlZCBieSBhIG1hbGZvcm1lZCB0YWcuXG4gIHZhciByZXN0LCB0eXBlO1xuICByZXR1cm4gKHNjYW5uZXIucGVlaygpID09PSAneycgJiZcbiAgICAgICAgICAocmVzdCA9IHNjYW5uZXIucmVzdCgpKS5zbGljZSgwLCAyKSA9PT0gJ3t7JyAmJlxuICAgICAgICAgIC9eXFx7XFx7XFxzKihcXC98ZWxzZVxcYikvLnRlc3QocmVzdCkgJiZcbiAgICAgICAgICAodHlwZSA9IFRlbXBsYXRlVGFnLnBlZWsoc2Nhbm5lcikudHlwZSkgJiZcbiAgICAgICAgICAodHlwZSA9PT0gJ0JMT0NLQ0xPU0UnIHx8IHR5cGUgPT09ICdFTFNFJykpO1xufTtcblxuLy8gVmFsaWRhdGUgdGhhdCBgdGVtcGxhdGVUYWdgIGlzIGNvcnJlY3RseSBmb3JtZWQgYW5kIGxlZ2FsIGZvciBpdHNcbi8vIEhUTUwgcG9zaXRpb24uICBVc2UgYHNjYW5uZXJgIHRvIHJlcG9ydCBlcnJvcnMuIE9uIHN1Y2Nlc3MsIGRvZXNcbi8vIG5vdGhpbmcuXG52YXIgdmFsaWRhdGVUYWcgPSBmdW5jdGlvbiAodHRhZywgc2Nhbm5lcikge1xuXG4gIGlmICh0dGFnLnR5cGUgPT09ICdJTkNMVVNJT04nIHx8IHR0YWcudHlwZSA9PT0gJ0JMT0NLT1BFTicpIHtcbiAgICB2YXIgYXJncyA9IHR0YWcuYXJncztcbiAgICBpZiAodHRhZy5wYXRoWzBdID09PSAnZWFjaCcgJiYgYXJnc1sxXSAmJiBhcmdzWzFdWzBdID09PSAnUEFUSCcgJiZcbiAgICAgICAgYXJnc1sxXVsxXVswXSA9PT0gJ2luJykge1xuICAgICAgLy8gRm9yIHNsaWdodGx5IGJldHRlciBlcnJvciBtZXNzYWdlcywgd2UgZGV0ZWN0IHRoZSBlYWNoLWluIGNhc2VcbiAgICAgIC8vIGhlcmUgaW4gb3JkZXIgbm90IHRvIGNvbXBsYWluIGlmIHRoZSB1c2VyIHdyaXRlcyBge3sjZWFjaCAzIGluIHh9fWBcbiAgICAgIC8vIHRoYXQgXCIzIGlzIG5vdCBhIGZ1bmN0aW9uXCJcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMSAmJiBhcmdzWzBdLmxlbmd0aCA9PT0gMiAmJiBhcmdzWzBdWzBdICE9PSAnUEFUSCcpIHtcbiAgICAgICAgLy8gd2UgaGF2ZSBhIHBvc2l0aW9uYWwgYXJndW1lbnQgdGhhdCBpcyBub3QgYSBQQVRIIGZvbGxvd2VkIGJ5XG4gICAgICAgIC8vIG90aGVyIGFyZ3VtZW50c1xuICAgICAgICBzY2FubmVyLmZhdGFsKFwiRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIGZ1bmN0aW9uLCB0byBiZSBjYWxsZWQgb24gXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIFwidGhlIHJlc3Qgb2YgdGhlIGFyZ3VtZW50czsgZm91bmQgXCIgKyBhcmdzWzBdWzBdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICB2YXIgcG9zaXRpb24gPSB0dGFnLnBvc2l0aW9uIHx8IFRFTVBMQVRFX1RBR19QT1NJVElPTi5FTEVNRU5UO1xuICBpZiAocG9zaXRpb24gPT09IFRFTVBMQVRFX1RBR19QT1NJVElPTi5JTl9BVFRSSUJVVEUpIHtcbiAgICBpZiAodHRhZy50eXBlID09PSAnRE9VQkxFJyB8fCB0dGFnLnR5cGUgPT09ICdFU0NBUEUnKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICh0dGFnLnR5cGUgPT09ICdCTE9DS09QRU4nKSB7XG4gICAgICB2YXIgcGF0aCA9IHR0YWcucGF0aDtcbiAgICAgIHZhciBwYXRoMCA9IHBhdGhbMF07XG4gICAgICBpZiAoISAocGF0aC5sZW5ndGggPT09IDEgJiYgKHBhdGgwID09PSAnaWYnIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgwID09PSAndW5sZXNzJyB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXRoMCA9PT0gJ3dpdGgnIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGgwID09PSAnZWFjaCcpKSkge1xuICAgICAgICBzY2FubmVyLmZhdGFsKFwiQ3VzdG9tIGJsb2NrIGhlbHBlcnMgYXJlIG5vdCBhbGxvd2VkIGluIGFuIEhUTUwgYXR0cmlidXRlLCBvbmx5IGJ1aWx0LWluIG9uZXMgbGlrZSAjZWFjaCBhbmQgI2lmXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzY2FubmVyLmZhdGFsKHR0YWcudHlwZSArIFwiIHRlbXBsYXRlIHRhZyBpcyBub3QgYWxsb3dlZCBpbiBhbiBIVE1MIGF0dHJpYnV0ZVwiKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAocG9zaXRpb24gPT09IFRFTVBMQVRFX1RBR19QT1NJVElPTi5JTl9TVEFSVF9UQUcpIHtcbiAgICBpZiAoISAodHRhZy50eXBlID09PSAnRE9VQkxFJykpIHtcbiAgICAgIHNjYW5uZXIuZmF0YWwoXCJSZWFjdGl2ZSBIVE1MIGF0dHJpYnV0ZXMgbXVzdCBlaXRoZXIgaGF2ZSBhIGNvbnN0YW50IG5hbWUgb3IgY29uc2lzdCBvZiBhIHNpbmdsZSB7e2hlbHBlcn19IHByb3ZpZGluZyBhIGRpY3Rpb25hcnkgb2YgbmFtZXMgYW5kIHZhbHVlcy4gIEEgdGVtcGxhdGUgdGFnIG9mIHR5cGUgXCIgKyB0dGFnLnR5cGUgKyBcIiBpcyBub3QgYWxsb3dlZCBoZXJlLlwiKTtcbiAgICB9XG4gICAgaWYgKHNjYW5uZXIucGVlaygpID09PSAnPScpIHtcbiAgICAgIHNjYW5uZXIuZmF0YWwoXCJUZW1wbGF0ZSB0YWdzIGFyZSBub3QgYWxsb3dlZCBpbiBhdHRyaWJ1dGUgbmFtZXMsIG9ubHkgaW4gYXR0cmlidXRlIHZhbHVlcyBvciBpbiB0aGUgZm9ybSBvZiBhIHNpbmdsZSB7e2hlbHBlcn19IHRoYXQgZXZhbHVhdGVzIHRvIGEgZGljdGlvbmFyeSBvZiBuYW1lPXZhbHVlIHBhaXJzLlwiKTtcbiAgICB9XG4gIH1cblxufTtcbiIsImltcG9ydCB7IEhUTUwgfSBmcm9tICdtZXRlb3IvaHRtbGpzJztcbmltcG9ydCB7IFRyZWVUcmFuc2Zvcm1lciwgdG9SYXcgfSBmcm9tICcuL29wdGltaXplcic7XG5cbmZ1bmN0aW9uIGNvbXBhY3RSYXcoYXJyYXkpe1xuICB2YXIgcmVzdWx0ID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgaXRlbSA9IGFycmF5W2ldO1xuICAgIGlmIChpdGVtIGluc3RhbmNlb2YgSFRNTC5SYXcpIHtcbiAgICAgIGlmICghaXRlbS52YWx1ZSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXN1bHQubGVuZ3RoICYmXG4gICAgICAgICAgKHJlc3VsdFtyZXN1bHQubGVuZ3RoIC0gMV0gaW5zdGFuY2VvZiBIVE1MLlJhdykpe1xuICAgICAgICByZXN1bHRbcmVzdWx0Lmxlbmd0aCAtIDFdID0gSFRNTC5SYXcoXG4gICAgICAgICAgcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXS52YWx1ZSArIGl0ZW0udmFsdWUpO1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuICAgIH1cbiAgICByZXN1bHQucHVzaChpdGVtKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiByZXBsYWNlSWZDb250YWluc05ld2xpbmUobWF0Y2gpIHtcbiAgaWYgKG1hdGNoLmluZGV4T2YoJ1xcbicpID49IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuICByZXR1cm4gbWF0Y2g7XG59XG5cbmZ1bmN0aW9uIHN0cmlwV2hpdGVzcGFjZShhcnJheSl7XG4gIHZhciByZXN1bHQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gYXJyYXlbaV07XG4gICAgaWYgKGl0ZW0gaW5zdGFuY2VvZiBIVE1MLlJhdykge1xuICAgICAgLy8gcmVtb3ZlIG5vZGVzIHRoYXQgY29udGFpbiBvbmx5IHdoaXRlc3BhY2UgJiBhIG5ld2xpbmVcbiAgICAgIGlmIChpdGVtLnZhbHVlLmluZGV4T2YoJ1xcbicpICE9PSAtMSAmJiAhL1xcUy8udGVzdChpdGVtLnZhbHVlKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIFRyaW0gYW55IHByZWNlZGluZyB3aGl0ZXNwYWNlLCBpZiBpdCBjb250YWlucyBhIG5ld2xpbmVcbiAgICAgIHZhciBuZXdTdHIgPSBpdGVtLnZhbHVlO1xuICAgICAgbmV3U3RyID0gbmV3U3RyLnJlcGxhY2UoL15cXHMrLywgcmVwbGFjZUlmQ29udGFpbnNOZXdsaW5lKTtcbiAgICAgIG5ld1N0ciA9IG5ld1N0ci5yZXBsYWNlKC9cXHMrJC8sIHJlcGxhY2VJZkNvbnRhaW5zTmV3bGluZSk7XG4gICAgICBpdGVtLnZhbHVlID0gbmV3U3RyO1xuICAgIH1cbiAgICByZXN1bHQucHVzaChpdGVtKVxuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbnZhciBXaGl0ZXNwYWNlUmVtb3ZpbmdWaXNpdG9yID0gVHJlZVRyYW5zZm9ybWVyLmV4dGVuZCgpO1xuV2hpdGVzcGFjZVJlbW92aW5nVmlzaXRvci5kZWYoe1xuICB2aXNpdE51bGw6IHRvUmF3LFxuICB2aXNpdFByaW1pdGl2ZTogdG9SYXcsXG4gIHZpc2l0Q2hhclJlZjogdG9SYXcsXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uKGFycmF5KXtcbiAgICAvLyB0aGlzLnN1cGVyKGFycmF5KVxuICAgIHZhciByZXN1bHQgPSBUcmVlVHJhbnNmb3JtZXIucHJvdG90eXBlLnZpc2l0QXJyYXkuY2FsbCh0aGlzLCBhcnJheSk7XG4gICAgcmVzdWx0ID0gY29tcGFjdFJhdyhyZXN1bHQpO1xuICAgIHJlc3VsdCA9IHN0cmlwV2hpdGVzcGFjZShyZXN1bHQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnKSB7XG4gICAgdmFyIHRhZ05hbWUgPSB0YWcudGFnTmFtZTtcbiAgICAvLyBUT0RPIC0gTGlzdCB0YWdzIHRoYXQgd2UgZG9uJ3Qgd2FudCB0byBzdHJpcCB3aGl0ZXNwYWNlIGZvci5cbiAgICBpZiAodGFnTmFtZSA9PT0gJ3RleHRhcmVhJyB8fCB0YWdOYW1lID09PSAnc2NyaXB0JyB8fCB0YWdOYW1lID09PSAncHJlJ1xuICAgICAgfHwgIUhUTUwuaXNLbm93bkVsZW1lbnQodGFnTmFtZSkgfHwgSFRNTC5pc0tub3duU1ZHRWxlbWVudCh0YWdOYW1lKSkge1xuICAgICAgcmV0dXJuIHRhZztcbiAgICB9XG4gICAgcmV0dXJuIFRyZWVUcmFuc2Zvcm1lci5wcm90b3R5cGUudmlzaXRUYWcuY2FsbCh0aGlzLCB0YWcpXG4gIH0sXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzKSB7XG4gICAgcmV0dXJuIGF0dHJzO1xuICB9XG59KTtcblxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlV2hpdGVzcGFjZSh0cmVlKSB7XG4gIHRyZWUgPSAobmV3IFdoaXRlc3BhY2VSZW1vdmluZ1Zpc2l0b3IpLnZpc2l0KHRyZWUpO1xuICByZXR1cm4gdHJlZTtcbn1cbiJdfQ==
