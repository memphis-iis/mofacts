(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var ECMAScript = Package.ecmascript.ECMAScript;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var HTML;

var require = meteorInstall({"node_modules":{"meteor":{"htmljs":{"preamble.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/preamble.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  HTML: () => HTML
});
let HTMLTags, Tag, Attrs, getTag, ensureTag, isTagEnsured, getSymbolName, knownHTMLElementNames, knownSVGElementNames, knownElementNames, voidElementNames, isKnownElement, isKnownSVGElement, isVoidElement, CharRef, Comment, Raw, isArray, isConstructedObject, isNully, isValidAttributeName, flattenAttributes;
module.link("./html", {
  HTMLTags(v) {
    HTMLTags = v;
  },

  Tag(v) {
    Tag = v;
  },

  Attrs(v) {
    Attrs = v;
  },

  getTag(v) {
    getTag = v;
  },

  ensureTag(v) {
    ensureTag = v;
  },

  isTagEnsured(v) {
    isTagEnsured = v;
  },

  getSymbolName(v) {
    getSymbolName = v;
  },

  knownHTMLElementNames(v) {
    knownHTMLElementNames = v;
  },

  knownSVGElementNames(v) {
    knownSVGElementNames = v;
  },

  knownElementNames(v) {
    knownElementNames = v;
  },

  voidElementNames(v) {
    voidElementNames = v;
  },

  isKnownElement(v) {
    isKnownElement = v;
  },

  isKnownSVGElement(v) {
    isKnownSVGElement = v;
  },

  isVoidElement(v) {
    isVoidElement = v;
  },

  CharRef(v) {
    CharRef = v;
  },

  Comment(v) {
    Comment = v;
  },

  Raw(v) {
    Raw = v;
  },

  isArray(v) {
    isArray = v;
  },

  isConstructedObject(v) {
    isConstructedObject = v;
  },

  isNully(v) {
    isNully = v;
  },

  isValidAttributeName(v) {
    isValidAttributeName = v;
  },

  flattenAttributes(v) {
    flattenAttributes = v;
  }

}, 0);
let Visitor, TransformingVisitor, ToHTMLVisitor, ToTextVisitor, toHTML, TEXTMODE, toText;
module.link("./visitors", {
  Visitor(v) {
    Visitor = v;
  },

  TransformingVisitor(v) {
    TransformingVisitor = v;
  },

  ToHTMLVisitor(v) {
    ToHTMLVisitor = v;
  },

  ToTextVisitor(v) {
    ToTextVisitor = v;
  },

  toHTML(v) {
    toHTML = v;
  },

  TEXTMODE(v) {
    TEXTMODE = v;
  },

  toText(v) {
    toText = v;
  }

}, 1);
const HTML = Object.assign(HTMLTags, {
  Tag,
  Attrs,
  getTag,
  ensureTag,
  isTagEnsured,
  getSymbolName,
  knownHTMLElementNames,
  knownSVGElementNames,
  knownElementNames,
  voidElementNames,
  isKnownElement,
  isKnownSVGElement,
  isVoidElement,
  CharRef,
  Comment,
  Raw,
  isArray,
  isConstructedObject,
  isNully,
  isValidAttributeName,
  flattenAttributes,
  toHTML,
  TEXTMODE,
  toText,
  Visitor,
  TransformingVisitor,
  ToHTMLVisitor,
  ToTextVisitor
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"html.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/html.js                                                                                        //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Tag: () => Tag,
  Attrs: () => Attrs,
  HTMLTags: () => HTMLTags,
  getTag: () => getTag,
  ensureTag: () => ensureTag,
  isTagEnsured: () => isTagEnsured,
  getSymbolName: () => getSymbolName,
  knownHTMLElementNames: () => knownHTMLElementNames,
  knownSVGElementNames: () => knownSVGElementNames,
  knownElementNames: () => knownElementNames,
  voidElementNames: () => voidElementNames,
  isKnownElement: () => isKnownElement,
  isKnownSVGElement: () => isKnownSVGElement,
  isVoidElement: () => isVoidElement,
  CharRef: () => CharRef,
  Comment: () => Comment,
  Raw: () => Raw,
  isArray: () => isArray,
  isConstructedObject: () => isConstructedObject,
  isNully: () => isNully,
  isValidAttributeName: () => isValidAttributeName,
  flattenAttributes: () => flattenAttributes
});

const Tag = function () {};

Tag.prototype.tagName = ''; // this will be set per Tag subclass

Tag.prototype.attrs = null;
Tag.prototype.children = Object.freeze ? Object.freeze([]) : [];
Tag.prototype.htmljsType = Tag.htmljsType = ['Tag']; // Given "p" create the function `HTML.P`.

var makeTagConstructor = function (tagName) {
  // Tag is the per-tagName constructor of a HTML.Tag subclass
  var HTMLTag = function () {
    // Work with or without `new`.  If not called with `new`,
    // perform instantiation by recursively calling this constructor.
    // We can't pass varargs, so pass no args.
    var instance = this instanceof Tag ? this : new HTMLTag();
    var i = 0;

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var attrs = args.length && args[0];

    if (attrs && typeof attrs === 'object') {
      // Treat vanilla JS object as an attributes dictionary.
      if (!isConstructedObject(attrs)) {
        instance.attrs = attrs;
        i++;
      } else if (attrs instanceof Attrs) {
        var array = attrs.value;

        if (array.length === 1) {
          instance.attrs = array[0];
        } else if (array.length > 1) {
          instance.attrs = array;
        }

        i++;
      }
    } // If no children, don't create an array at all, use the prototype's
    // (frozen, empty) array.  This way we don't create an empty array
    // every time someone creates a tag without `new` and this constructor
    // calls itself with no arguments (above).


    if (i < args.length) instance.children = args.slice(i);
    return instance;
  };

  HTMLTag.prototype = new Tag();
  HTMLTag.prototype.constructor = HTMLTag;
  HTMLTag.prototype.tagName = tagName;
  return HTMLTag;
}; // Not an HTMLjs node, but a wrapper to pass multiple attrs dictionaries
// to a tag (for the purpose of implementing dynamic attributes).


function Attrs() {
  // Work with or without `new`.  If not called with `new`,
  // perform instantiation by recursively calling this constructor.
  // We can't pass varargs, so pass no args.
  var instance = this instanceof Attrs ? this : new Attrs();

  for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  instance.value = args;
  return instance;
}

const HTMLTags = {};

function getTag(tagName) {
  var symbolName = getSymbolName(tagName);
  if (symbolName === tagName) // all-caps tagName
    throw new Error("Use the lowercase or camelCase form of '" + tagName + "' here");
  if (!HTMLTags[symbolName]) HTMLTags[symbolName] = makeTagConstructor(tagName);
  return HTMLTags[symbolName];
}

function ensureTag(tagName) {
  getTag(tagName); // don't return it
}

function isTagEnsured(tagName) {
  return isKnownElement(tagName);
}

function getSymbolName(tagName) {
  // "foo-bar" -> "FOO_BAR"
  return tagName.toUpperCase().replace(/-/g, '_');
}

const knownHTMLElementNames = 'a abbr acronym address applet area article aside audio b base basefont bdi bdo big blockquote body br button canvas caption center cite code col colgroup command data datagrid datalist dd del details dfn dir div dl dt em embed eventsource fieldset figcaption figure font footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins isindex kbd keygen label legend li link main map mark menu meta meter nav noframes noscript object ol optgroup option output p param pre progress q rp rt ruby s samp script section select small source span strike strong style sub summary sup table tbody td textarea tfoot th thead time title tr track tt u ul var video wbr'.split(' ');
const knownSVGElementNames = 'altGlyph altGlyphDef altGlyphItem animate animateColor animateMotion animateTransform circle clipPath color-profile cursor defs desc ellipse feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting feDisplacementMap feDistantLight feFlood feFuncA feFuncB feFuncG feFuncR feGaussianBlur feImage feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting feSpotLight feTile feTurbulence filter font font-face font-face-format font-face-name font-face-src font-face-uri foreignObject g glyph glyphRef hkern image line linearGradient marker mask metadata missing-glyph path pattern polygon polyline radialGradient rect set stop style svg switch symbol text textPath title tref tspan use view vkern'.split(' ');
const knownElementNames = knownHTMLElementNames.concat(knownSVGElementNames);
const voidElementNames = 'area base br col command embed hr img input keygen link meta param source track wbr'.split(' ');
var voidElementSet = new Set(voidElementNames);
var knownElementSet = new Set(knownElementNames);
var knownSVGElementSet = new Set(knownSVGElementNames);

function isKnownElement(tagName) {
  return knownElementSet.has(tagName);
}

function isKnownSVGElement(tagName) {
  return knownSVGElementSet.has(tagName);
}

function isVoidElement(tagName) {
  return voidElementSet.has(tagName);
}

// Ensure tags for all known elements
knownElementNames.forEach(ensureTag);

function CharRef(attrs) {
  if (!(this instanceof CharRef)) // called without `new`
    return new CharRef(attrs);
  if (!(attrs && attrs.html && attrs.str)) throw new Error("HTML.CharRef must be constructed with ({html:..., str:...})");
  this.html = attrs.html;
  this.str = attrs.str;
}

CharRef.prototype.htmljsType = CharRef.htmljsType = ['CharRef'];

function Comment(value) {
  if (!(this instanceof Comment)) // called without `new`
    return new Comment(value);
  if (typeof value !== 'string') throw new Error('HTML.Comment must be constructed with a string');
  this.value = value; // Kill illegal hyphens in comment value (no way to escape them in HTML)

  this.sanitizedValue = value.replace(/^-|--+|-$/g, '');
}

Comment.prototype.htmljsType = Comment.htmljsType = ['Comment'];

function Raw(value) {
  if (!(this instanceof Raw)) // called without `new`
    return new Raw(value);
  if (typeof value !== 'string') throw new Error('HTML.Raw must be constructed with a string');
  this.value = value;
}

Raw.prototype.htmljsType = Raw.htmljsType = ['Raw'];

function isArray(x) {
  return x instanceof Array || Array.isArray(x);
}

function isConstructedObject(x) {
  // Figure out if `x` is "an instance of some class" or just a plain
  // object literal.  It correctly treats an object literal like
  // `{ constructor: ... }` as an object literal.  It won't detect
  // instances of classes that lack a `constructor` property (e.g.
  // if you assign to a prototype when setting up the class as in:
  // `Foo = function () { ... }; Foo.prototype = { ... }`, then
  // `(new Foo).constructor` is `Object`, not `Foo`).
  if (!x || typeof x !== 'object') return false; // Is this a plain object?

  let plain = false;

  if (Object.getPrototypeOf(x) === null) {
    plain = true;
  } else {
    let proto = x;

    while (Object.getPrototypeOf(proto) !== null) {
      proto = Object.getPrototypeOf(proto);
    }

    plain = Object.getPrototypeOf(x) === proto;
  }

  return !plain && typeof x.constructor === 'function' && x instanceof x.constructor;
}

function isNully(node) {
  if (node == null) // null or undefined
    return true;

  if (isArray(node)) {
    // is it an empty array or an array of all nully items?
    for (var i = 0; i < node.length; i++) if (!isNully(node[i])) return false;

    return true;
  }

  return false;
}

function isValidAttributeName(name) {
  return /^[:_A-Za-z][:_A-Za-z0-9.\-]*/.test(name);
}

function flattenAttributes(attrs) {
  if (!attrs) return attrs;
  var isList = isArray(attrs);
  if (isList && attrs.length === 0) return null;
  var result = {};

  for (var i = 0, N = isList ? attrs.length : 1; i < N; i++) {
    var oneAttrs = isList ? attrs[i] : attrs;
    if (typeof oneAttrs !== 'object' || isConstructedObject(oneAttrs)) throw new Error("Expected plain JS object as attrs, found: " + oneAttrs);

    for (var name in oneAttrs) {
      if (!isValidAttributeName(name)) throw new Error("Illegal HTML attribute name: " + name);
      var value = oneAttrs[name];
      if (!isNully(value)) result[name] = value;
    }
  }

  return result;
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"visitors.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                //
// packages/htmljs/visitors.js                                                                                    //
//                                                                                                                //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                  //
module.export({
  Visitor: () => Visitor,
  TransformingVisitor: () => TransformingVisitor,
  ToTextVisitor: () => ToTextVisitor,
  ToHTMLVisitor: () => ToHTMLVisitor,
  toHTML: () => toHTML,
  TEXTMODE: () => TEXTMODE,
  toText: () => toText
});
let Tag, CharRef, Comment, Raw, isArray, getTag, isConstructedObject, flattenAttributes, isVoidElement;
module.link("./html", {
  Tag(v) {
    Tag = v;
  },

  CharRef(v) {
    CharRef = v;
  },

  Comment(v) {
    Comment = v;
  },

  Raw(v) {
    Raw = v;
  },

  isArray(v) {
    isArray = v;
  },

  getTag(v) {
    getTag = v;
  },

  isConstructedObject(v) {
    isConstructedObject = v;
  },

  flattenAttributes(v) {
    flattenAttributes = v;
  },

  isVoidElement(v) {
    isVoidElement = v;
  }

}, 0);

var IDENTITY = function (x) {
  return x;
}; // _assign is like _.extend or the upcoming Object.assign.
// Copy src's own, enumerable properties onto tgt and return
// tgt.


var _hasOwnProperty = Object.prototype.hasOwnProperty;

var _assign = function (tgt, src) {
  for (var k in src) {
    if (_hasOwnProperty.call(src, k)) tgt[k] = src[k];
  }

  return tgt;
};

const Visitor = function (props) {
  _assign(this, props);
};

Visitor.def = function (options) {
  _assign(this.prototype, options);
};

Visitor.extend = function (options) {
  var curType = this;

  var subType = function HTMLVisitorSubtype()
  /*arguments*/
  {
    Visitor.apply(this, arguments);
  };

  subType.prototype = new curType();
  subType.extend = curType.extend;
  subType.def = curType.def;
  if (options) _assign(subType.prototype, options);
  return subType;
};

Visitor.def({
  visit: function (content
  /*, ...*/
  ) {
    if (content == null) // null or undefined.
      return this.visitNull.apply(this, arguments);

    if (typeof content === 'object') {
      if (content.htmljsType) {
        switch (content.htmljsType) {
          case Tag.htmljsType:
            return this.visitTag.apply(this, arguments);

          case CharRef.htmljsType:
            return this.visitCharRef.apply(this, arguments);

          case Comment.htmljsType:
            return this.visitComment.apply(this, arguments);

          case Raw.htmljsType:
            return this.visitRaw.apply(this, arguments);

          default:
            throw new Error("Unknown htmljs type: " + content.htmljsType);
        }
      }

      if (isArray(content)) return this.visitArray.apply(this, arguments);
      return this.visitObject.apply(this, arguments);
    } else if (typeof content === 'string' || typeof content === 'boolean' || typeof content === 'number') {
      return this.visitPrimitive.apply(this, arguments);
    } else if (typeof content === 'function') {
      return this.visitFunction.apply(this, arguments);
    }

    throw new Error("Unexpected object in htmljs: " + content);
  },
  visitNull: function (nullOrUndefined
  /*, ...*/
  ) {},
  visitPrimitive: function (stringBooleanOrNumber
  /*, ...*/
  ) {},
  visitArray: function (array
  /*, ...*/
  ) {},
  visitComment: function (comment
  /*, ...*/
  ) {},
  visitCharRef: function (charRef
  /*, ...*/
  ) {},
  visitRaw: function (raw
  /*, ...*/
  ) {},
  visitTag: function (tag
  /*, ...*/
  ) {},
  visitObject: function (obj
  /*, ...*/
  ) {
    throw new Error("Unexpected object in htmljs: " + obj);
  },
  visitFunction: function (fn
  /*, ...*/
  ) {
    throw new Error("Unexpected function in htmljs: " + fn);
  }
});
const TransformingVisitor = Visitor.extend();
TransformingVisitor.def({
  visitNull: IDENTITY,
  visitPrimitive: IDENTITY,
  visitArray: function (array) {
    var result = array;

    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    for (var i = 0; i < array.length; i++) {
      var oldItem = array[i];
      var newItem = this.visit(oldItem, ...args);

      if (newItem !== oldItem) {
        // copy `array` on write
        if (result === array) result = array.slice();
        result[i] = newItem;
      }
    }

    return result;
  },
  visitComment: IDENTITY,
  visitCharRef: IDENTITY,
  visitRaw: IDENTITY,
  visitObject: function (obj) {
    // Don't parse Markdown & RCData as HTML
    if (obj.textMode != null) {
      return obj;
    }

    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    if ('content' in obj) {
      obj.content = this.visit(obj.content, ...args);
    }

    if ('elseContent' in obj) {
      obj.elseContent = this.visit(obj.elseContent, ...args);
    }

    return obj;
  },
  visitFunction: IDENTITY,
  visitTag: function (tag) {
    var oldChildren = tag.children;

    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }

    var newChildren = this.visitChildren(oldChildren, ...args);
    var oldAttrs = tag.attrs;
    var newAttrs = this.visitAttributes(oldAttrs, ...args);
    if (newAttrs === oldAttrs && newChildren === oldChildren) return tag;
    var newTag = getTag(tag.tagName).apply(null, newChildren);
    newTag.attrs = newAttrs;
    return newTag;
  },
  visitChildren: function (children) {
    for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
      args[_key4 - 1] = arguments[_key4];
    }

    return this.visitArray(children, ...args);
  },
  // Transform the `.attrs` property of a tag, which may be a dictionary,
  // an array, or in some uses, a foreign object (such as
  // a template tag).
  visitAttributes: function (attrs) {
    for (var _len5 = arguments.length, args = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
      args[_key5 - 1] = arguments[_key5];
    }

    if (isArray(attrs)) {
      var result = attrs;

      for (var i = 0; i < attrs.length; i++) {
        var oldItem = attrs[i];
        var newItem = this.visitAttributes(oldItem, ...args);

        if (newItem !== oldItem) {
          // copy on write
          if (result === attrs) result = attrs.slice();
          result[i] = newItem;
        }
      }

      return result;
    }

    if (attrs && isConstructedObject(attrs)) {
      throw new Error("The basic TransformingVisitor does not support " + "foreign objects in attributes.  Define a custom " + "visitAttributes for this case.");
    }

    var oldAttrs = attrs;
    var newAttrs = oldAttrs;

    if (oldAttrs) {
      var attrArgs = [null, null];
      attrArgs.push.apply(attrArgs, arguments);

      for (var k in oldAttrs) {
        var oldValue = oldAttrs[k];
        attrArgs[0] = k;
        attrArgs[1] = oldValue;
        var newValue = this.visitAttribute.apply(this, attrArgs);

        if (newValue !== oldValue) {
          // copy on write
          if (newAttrs === oldAttrs) newAttrs = _assign({}, oldAttrs);
          newAttrs[k] = newValue;
        }
      }
    }

    return newAttrs;
  },
  // Transform the value of one attribute name/value in an
  // attributes dictionary.
  visitAttribute: function (name, value, tag) {
    for (var _len6 = arguments.length, args = new Array(_len6 > 3 ? _len6 - 3 : 0), _key6 = 3; _key6 < _len6; _key6++) {
      args[_key6 - 3] = arguments[_key6];
    }

    return this.visit(value, ...args);
  }
});
const ToTextVisitor = Visitor.extend();
ToTextVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);

    if (this.textMode === TEXTMODE.RCDATA) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    } else if (this.textMode === TEXTMODE.ATTRIBUTE) {
      // escape `&` and `"` this time, not `&` and `<`
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    } else {
      return str;
    }
  },
  visitArray: function (array) {
    var parts = [];

    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));

    return parts.join('');
  },
  visitComment: function (comment) {
    throw new Error("Can't have a comment here");
  },
  visitCharRef: function (charRef) {
    if (this.textMode === TEXTMODE.RCDATA || this.textMode === TEXTMODE.ATTRIBUTE) {
      return charRef.html;
    } else {
      return charRef.str;
    }
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    // Really we should just disallow Tags here.  However, at the
    // moment it's useful to stringify any HTML we find.  In
    // particular, when you include a template within `{{#markdown}}`,
    // we render the template as text, and since there's currently
    // no way to make the template be *parsed* as text (e.g. `<template
    // type="text">`), we hackishly support HTML tags in markdown
    // in templates by parsing them and stringifying them.
    return this.visit(this.toHTML(tag));
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toText: " + x);
  },
  toHTML: function (node) {
    return toHTML(node);
  }
});
const ToHTMLVisitor = Visitor.extend();
ToHTMLVisitor.def({
  visitNull: function (nullOrUndefined) {
    return '';
  },
  visitPrimitive: function (stringBooleanOrNumber) {
    var str = String(stringBooleanOrNumber);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  },
  visitArray: function (array) {
    var parts = [];

    for (var i = 0; i < array.length; i++) parts.push(this.visit(array[i]));

    return parts.join('');
  },
  visitComment: function (comment) {
    return '<!--' + comment.sanitizedValue + '-->';
  },
  visitCharRef: function (charRef) {
    return charRef.html;
  },
  visitRaw: function (raw) {
    return raw.value;
  },
  visitTag: function (tag) {
    var attrStrs = [];
    var tagName = tag.tagName;
    var children = tag.children;
    var attrs = tag.attrs;

    if (attrs) {
      attrs = flattenAttributes(attrs);

      for (var k in attrs) {
        if (k === 'value' && tagName === 'textarea') {
          children = [attrs[k], children];
        } else {
          var v = this.toText(attrs[k], TEXTMODE.ATTRIBUTE);
          attrStrs.push(' ' + k + '="' + v + '"');
        }
      }
    }

    var startTag = '<' + tagName + attrStrs.join('') + '>';
    var childStrs = [];
    var content;

    if (tagName === 'textarea') {
      for (var i = 0; i < children.length; i++) childStrs.push(this.toText(children[i], TEXTMODE.RCDATA));

      content = childStrs.join('');
      if (content.slice(0, 1) === '\n') // TEXTAREA will absorb a newline, so if we see one, add
        // another one.
        content = '\n' + content;
    } else {
      for (var i = 0; i < children.length; i++) childStrs.push(this.visit(children[i]));

      content = childStrs.join('');
    }

    var result = startTag + content;

    if (children.length || !isVoidElement(tagName)) {
      // "Void" elements like BR are the only ones that don't get a close
      // tag in HTML5.  They shouldn't have contents, either, so we could
      // throw an error upon seeing contents here.
      result += '</' + tagName + '>';
    }

    return result;
  },
  visitObject: function (x) {
    throw new Error("Unexpected object in htmljs in toHTML: " + x);
  },
  toText: function (node, textMode) {
    return toText(node, textMode);
  }
}); ////////////////////////////// TOHTML

function toHTML(content) {
  return new ToHTMLVisitor().visit(content);
}

const TEXTMODE = {
  STRING: 1,
  RCDATA: 2,
  ATTRIBUTE: 3
};

function toText(content, textMode) {
  if (!textMode) throw new Error("textMode required for HTML.toText");
  if (!(textMode === TEXTMODE.STRING || textMode === TEXTMODE.RCDATA || textMode === TEXTMODE.ATTRIBUTE)) throw new Error("Unknown textMode: " + textMode);
  var visitor = new ToTextVisitor({
    textMode: textMode
  });
  return visitor.visit(content);
}
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});

var exports = require("/node_modules/meteor/htmljs/preamble.js");

/* Exports */
Package._define("htmljs", exports, {
  HTML: HTML
});

})();




//# sourceURL=meteor://💻app/packages/htmljs.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3ByZWFtYmxlLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9odG1sanMvaHRtbC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvaHRtbGpzL3Zpc2l0b3JzLmpzIl0sIm5hbWVzIjpbIm1vZHVsZSIsImV4cG9ydCIsIkhUTUwiLCJIVE1MVGFncyIsIlRhZyIsIkF0dHJzIiwiZ2V0VGFnIiwiZW5zdXJlVGFnIiwiaXNUYWdFbnN1cmVkIiwiZ2V0U3ltYm9sTmFtZSIsImtub3duSFRNTEVsZW1lbnROYW1lcyIsImtub3duU1ZHRWxlbWVudE5hbWVzIiwia25vd25FbGVtZW50TmFtZXMiLCJ2b2lkRWxlbWVudE5hbWVzIiwiaXNLbm93bkVsZW1lbnQiLCJpc0tub3duU1ZHRWxlbWVudCIsImlzVm9pZEVsZW1lbnQiLCJDaGFyUmVmIiwiQ29tbWVudCIsIlJhdyIsImlzQXJyYXkiLCJpc0NvbnN0cnVjdGVkT2JqZWN0IiwiaXNOdWxseSIsImlzVmFsaWRBdHRyaWJ1dGVOYW1lIiwiZmxhdHRlbkF0dHJpYnV0ZXMiLCJsaW5rIiwidiIsIlZpc2l0b3IiLCJUcmFuc2Zvcm1pbmdWaXNpdG9yIiwiVG9IVE1MVmlzaXRvciIsIlRvVGV4dFZpc2l0b3IiLCJ0b0hUTUwiLCJURVhUTU9ERSIsInRvVGV4dCIsIk9iamVjdCIsImFzc2lnbiIsInByb3RvdHlwZSIsInRhZ05hbWUiLCJhdHRycyIsImNoaWxkcmVuIiwiZnJlZXplIiwiaHRtbGpzVHlwZSIsIm1ha2VUYWdDb25zdHJ1Y3RvciIsIkhUTUxUYWciLCJpbnN0YW5jZSIsImkiLCJhcmdzIiwibGVuZ3RoIiwiYXJyYXkiLCJ2YWx1ZSIsInNsaWNlIiwiY29uc3RydWN0b3IiLCJzeW1ib2xOYW1lIiwiRXJyb3IiLCJ0b1VwcGVyQ2FzZSIsInJlcGxhY2UiLCJzcGxpdCIsImNvbmNhdCIsInZvaWRFbGVtZW50U2V0IiwiU2V0Iiwia25vd25FbGVtZW50U2V0Iiwia25vd25TVkdFbGVtZW50U2V0IiwiaGFzIiwiZm9yRWFjaCIsImh0bWwiLCJzdHIiLCJzYW5pdGl6ZWRWYWx1ZSIsIngiLCJBcnJheSIsInBsYWluIiwiZ2V0UHJvdG90eXBlT2YiLCJwcm90byIsIm5vZGUiLCJuYW1lIiwidGVzdCIsImlzTGlzdCIsInJlc3VsdCIsIk4iLCJvbmVBdHRycyIsIklERU5USVRZIiwiX2hhc093blByb3BlcnR5IiwiaGFzT3duUHJvcGVydHkiLCJfYXNzaWduIiwidGd0Iiwic3JjIiwiayIsImNhbGwiLCJwcm9wcyIsImRlZiIsIm9wdGlvbnMiLCJleHRlbmQiLCJjdXJUeXBlIiwic3ViVHlwZSIsIkhUTUxWaXNpdG9yU3VidHlwZSIsImFwcGx5IiwiYXJndW1lbnRzIiwidmlzaXQiLCJjb250ZW50IiwidmlzaXROdWxsIiwidmlzaXRUYWciLCJ2aXNpdENoYXJSZWYiLCJ2aXNpdENvbW1lbnQiLCJ2aXNpdFJhdyIsInZpc2l0QXJyYXkiLCJ2aXNpdE9iamVjdCIsInZpc2l0UHJpbWl0aXZlIiwidmlzaXRGdW5jdGlvbiIsIm51bGxPclVuZGVmaW5lZCIsInN0cmluZ0Jvb2xlYW5Pck51bWJlciIsImNvbW1lbnQiLCJjaGFyUmVmIiwicmF3IiwidGFnIiwib2JqIiwiZm4iLCJvbGRJdGVtIiwibmV3SXRlbSIsInRleHRNb2RlIiwiZWxzZUNvbnRlbnQiLCJvbGRDaGlsZHJlbiIsIm5ld0NoaWxkcmVuIiwidmlzaXRDaGlsZHJlbiIsIm9sZEF0dHJzIiwibmV3QXR0cnMiLCJ2aXNpdEF0dHJpYnV0ZXMiLCJuZXdUYWciLCJhdHRyQXJncyIsInB1c2giLCJvbGRWYWx1ZSIsIm5ld1ZhbHVlIiwidmlzaXRBdHRyaWJ1dGUiLCJTdHJpbmciLCJSQ0RBVEEiLCJBVFRSSUJVVEUiLCJwYXJ0cyIsImpvaW4iLCJhdHRyU3RycyIsInN0YXJ0VGFnIiwiY2hpbGRTdHJzIiwiU1RSSU5HIiwidmlzaXRvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7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ZSI6Ii9wYWNrYWdlcy9odG1sanMuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBIVE1MVGFncyxcbiAgVGFnLFxuICBBdHRycyxcbiAgZ2V0VGFnLFxuICBlbnN1cmVUYWcsXG4gIGlzVGFnRW5zdXJlZCxcbiAgZ2V0U3ltYm9sTmFtZSxcbiAga25vd25IVE1MRWxlbWVudE5hbWVzLFxuICBrbm93blNWR0VsZW1lbnROYW1lcyxcbiAga25vd25FbGVtZW50TmFtZXMsXG4gIHZvaWRFbGVtZW50TmFtZXMsXG4gIGlzS25vd25FbGVtZW50LFxuICBpc0tub3duU1ZHRWxlbWVudCxcbiAgaXNWb2lkRWxlbWVudCxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBpc0NvbnN0cnVjdGVkT2JqZWN0LFxuICBpc051bGx5LFxuICBpc1ZhbGlkQXR0cmlidXRlTmFtZSxcbiAgZmxhdHRlbkF0dHJpYnV0ZXMsXG59IGZyb20gJy4vaHRtbCc7XG5cbmltcG9ydCB7XG4gIFZpc2l0b3IsXG4gIFRyYW5zZm9ybWluZ1Zpc2l0b3IsXG4gIFRvSFRNTFZpc2l0b3IsXG4gIFRvVGV4dFZpc2l0b3IsXG4gIHRvSFRNTCxcbiAgVEVYVE1PREUsXG4gIHRvVGV4dFxufSBmcm9tICcuL3Zpc2l0b3JzJztcblxuXG4vLyB3ZSdyZSBhY3R1YWxseSBleHBvcnRpbmcgdGhlIEhUTUxUYWdzIG9iamVjdC5cbi8vICBiZWNhdXNlIGl0IGlzIGR5bmFtaWNhbGx5IGFsdGVyZWQgYnkgZ2V0VGFnL2Vuc3VyZVRhZ1xuZXhwb3J0IGNvbnN0IEhUTUwgPSBPYmplY3QuYXNzaWduKEhUTUxUYWdzLCB7XG4gIFRhZyxcbiAgQXR0cnMsXG4gIGdldFRhZyxcbiAgZW5zdXJlVGFnLFxuICBpc1RhZ0Vuc3VyZWQsXG4gIGdldFN5bWJvbE5hbWUsXG4gIGtub3duSFRNTEVsZW1lbnROYW1lcyxcbiAga25vd25TVkdFbGVtZW50TmFtZXMsXG4gIGtub3duRWxlbWVudE5hbWVzLFxuICB2b2lkRWxlbWVudE5hbWVzLFxuICBpc0tub3duRWxlbWVudCxcbiAgaXNLbm93blNWR0VsZW1lbnQsXG4gIGlzVm9pZEVsZW1lbnQsXG4gIENoYXJSZWYsXG4gIENvbW1lbnQsXG4gIFJhdyxcbiAgaXNBcnJheSxcbiAgaXNDb25zdHJ1Y3RlZE9iamVjdCxcbiAgaXNOdWxseSxcbiAgaXNWYWxpZEF0dHJpYnV0ZU5hbWUsXG4gIGZsYXR0ZW5BdHRyaWJ1dGVzLFxuICB0b0hUTUwsXG4gIFRFWFRNT0RFLFxuICB0b1RleHQsXG4gIFZpc2l0b3IsXG4gIFRyYW5zZm9ybWluZ1Zpc2l0b3IsXG4gIFRvSFRNTFZpc2l0b3IsXG4gIFRvVGV4dFZpc2l0b3IsXG59KTtcbiIsIlxuZXhwb3J0IGNvbnN0IFRhZyA9IGZ1bmN0aW9uICgpIHt9O1xuVGFnLnByb3RvdHlwZS50YWdOYW1lID0gJyc7IC8vIHRoaXMgd2lsbCBiZSBzZXQgcGVyIFRhZyBzdWJjbGFzc1xuVGFnLnByb3RvdHlwZS5hdHRycyA9IG51bGw7XG5UYWcucHJvdG90eXBlLmNoaWxkcmVuID0gT2JqZWN0LmZyZWV6ZSA/IE9iamVjdC5mcmVlemUoW10pIDogW107XG5UYWcucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBUYWcuaHRtbGpzVHlwZSA9IFsnVGFnJ107XG5cbi8vIEdpdmVuIFwicFwiIGNyZWF0ZSB0aGUgZnVuY3Rpb24gYEhUTUwuUGAuXG52YXIgbWFrZVRhZ0NvbnN0cnVjdG9yID0gZnVuY3Rpb24gKHRhZ05hbWUpIHtcbiAgLy8gVGFnIGlzIHRoZSBwZXItdGFnTmFtZSBjb25zdHJ1Y3RvciBvZiBhIEhUTUwuVGFnIHN1YmNsYXNzXG4gIHZhciBIVE1MVGFnID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICAvLyBXb3JrIHdpdGggb3Igd2l0aG91dCBgbmV3YC4gIElmIG5vdCBjYWxsZWQgd2l0aCBgbmV3YCxcbiAgICAvLyBwZXJmb3JtIGluc3RhbnRpYXRpb24gYnkgcmVjdXJzaXZlbHkgY2FsbGluZyB0aGlzIGNvbnN0cnVjdG9yLlxuICAgIC8vIFdlIGNhbid0IHBhc3MgdmFyYXJncywgc28gcGFzcyBubyBhcmdzLlxuICAgIHZhciBpbnN0YW5jZSA9ICh0aGlzIGluc3RhbmNlb2YgVGFnKSA/IHRoaXMgOiBuZXcgSFRNTFRhZztcblxuICAgIHZhciBpID0gMDtcbiAgICB2YXIgYXR0cnMgPSBhcmdzLmxlbmd0aCAmJiBhcmdzWzBdO1xuICAgIGlmIChhdHRycyAmJiAodHlwZW9mIGF0dHJzID09PSAnb2JqZWN0JykpIHtcbiAgICAgIC8vIFRyZWF0IHZhbmlsbGEgSlMgb2JqZWN0IGFzIGFuIGF0dHJpYnV0ZXMgZGljdGlvbmFyeS5cbiAgICAgIGlmICghIGlzQ29uc3RydWN0ZWRPYmplY3QoYXR0cnMpKSB7XG4gICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXR0cnM7XG4gICAgICAgIGkrKztcbiAgICAgIH0gZWxzZSBpZiAoYXR0cnMgaW5zdGFuY2VvZiBBdHRycykge1xuICAgICAgICB2YXIgYXJyYXkgPSBhdHRycy52YWx1ZTtcbiAgICAgICAgaWYgKGFycmF5Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXJyYXlbMF07XG4gICAgICAgIH0gZWxzZSBpZiAoYXJyYXkubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGluc3RhbmNlLmF0dHJzID0gYXJyYXk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gSWYgbm8gY2hpbGRyZW4sIGRvbid0IGNyZWF0ZSBhbiBhcnJheSBhdCBhbGwsIHVzZSB0aGUgcHJvdG90eXBlJ3NcbiAgICAvLyAoZnJvemVuLCBlbXB0eSkgYXJyYXkuICBUaGlzIHdheSB3ZSBkb24ndCBjcmVhdGUgYW4gZW1wdHkgYXJyYXlcbiAgICAvLyBldmVyeSB0aW1lIHNvbWVvbmUgY3JlYXRlcyBhIHRhZyB3aXRob3V0IGBuZXdgIGFuZCB0aGlzIGNvbnN0cnVjdG9yXG4gICAgLy8gY2FsbHMgaXRzZWxmIHdpdGggbm8gYXJndW1lbnRzIChhYm92ZSkuXG4gICAgaWYgKGkgPCBhcmdzLmxlbmd0aClcbiAgICAgIGluc3RhbmNlLmNoaWxkcmVuID0gYXJncy5zbGljZShpKTtcblxuICAgIHJldHVybiBpbnN0YW5jZTtcbiAgfTtcbiAgSFRNTFRhZy5wcm90b3R5cGUgPSBuZXcgVGFnO1xuICBIVE1MVGFnLnByb3RvdHlwZS5jb25zdHJ1Y3RvciA9IEhUTUxUYWc7XG4gIEhUTUxUYWcucHJvdG90eXBlLnRhZ05hbWUgPSB0YWdOYW1lO1xuXG4gIHJldHVybiBIVE1MVGFnO1xufTtcblxuLy8gTm90IGFuIEhUTUxqcyBub2RlLCBidXQgYSB3cmFwcGVyIHRvIHBhc3MgbXVsdGlwbGUgYXR0cnMgZGljdGlvbmFyaWVzXG4vLyB0byBhIHRhZyAoZm9yIHRoZSBwdXJwb3NlIG9mIGltcGxlbWVudGluZyBkeW5hbWljIGF0dHJpYnV0ZXMpLlxuZXhwb3J0IGZ1bmN0aW9uIEF0dHJzKC4uLmFyZ3MpIHtcbiAgLy8gV29yayB3aXRoIG9yIHdpdGhvdXQgYG5ld2AuICBJZiBub3QgY2FsbGVkIHdpdGggYG5ld2AsXG4gIC8vIHBlcmZvcm0gaW5zdGFudGlhdGlvbiBieSByZWN1cnNpdmVseSBjYWxsaW5nIHRoaXMgY29uc3RydWN0b3IuXG4gIC8vIFdlIGNhbid0IHBhc3MgdmFyYXJncywgc28gcGFzcyBubyBhcmdzLlxuICB2YXIgaW5zdGFuY2UgPSAodGhpcyBpbnN0YW5jZW9mIEF0dHJzKSA/IHRoaXMgOiBuZXcgQXR0cnM7XG5cbiAgaW5zdGFuY2UudmFsdWUgPSBhcmdzO1xuXG4gIHJldHVybiBpbnN0YW5jZTtcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vIEtOT1dOIEVMRU1FTlRTXG5leHBvcnQgY29uc3QgSFRNTFRhZ3MgPSB7fTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFRhZyAodGFnTmFtZSkge1xuICB2YXIgc3ltYm9sTmFtZSA9IGdldFN5bWJvbE5hbWUodGFnTmFtZSk7XG4gIGlmIChzeW1ib2xOYW1lID09PSB0YWdOYW1lKSAvLyBhbGwtY2FwcyB0YWdOYW1lXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVXNlIHRoZSBsb3dlcmNhc2Ugb3IgY2FtZWxDYXNlIGZvcm0gb2YgJ1wiICsgdGFnTmFtZSArIFwiJyBoZXJlXCIpO1xuXG4gIGlmICghIEhUTUxUYWdzW3N5bWJvbE5hbWVdKVxuICAgIEhUTUxUYWdzW3N5bWJvbE5hbWVdID0gbWFrZVRhZ0NvbnN0cnVjdG9yKHRhZ05hbWUpO1xuXG4gIHJldHVybiBIVE1MVGFnc1tzeW1ib2xOYW1lXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZVRhZyh0YWdOYW1lKSB7XG4gIGdldFRhZyh0YWdOYW1lKTsgLy8gZG9uJ3QgcmV0dXJuIGl0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1RhZ0Vuc3VyZWQgKHRhZ05hbWUpIHtcbiAgcmV0dXJuIGlzS25vd25FbGVtZW50KHRhZ05hbWUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U3ltYm9sTmFtZSAodGFnTmFtZSkge1xuICAvLyBcImZvby1iYXJcIiAtPiBcIkZPT19CQVJcIlxuICByZXR1cm4gdGFnTmFtZS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoLy0vZywgJ18nKTtcbn1cblxuZXhwb3J0IGNvbnN0IGtub3duSFRNTEVsZW1lbnROYW1lcyA9ICdhIGFiYnIgYWNyb255bSBhZGRyZXNzIGFwcGxldCBhcmVhIGFydGljbGUgYXNpZGUgYXVkaW8gYiBiYXNlIGJhc2Vmb250IGJkaSBiZG8gYmlnIGJsb2NrcXVvdGUgYm9keSBiciBidXR0b24gY2FudmFzIGNhcHRpb24gY2VudGVyIGNpdGUgY29kZSBjb2wgY29sZ3JvdXAgY29tbWFuZCBkYXRhIGRhdGFncmlkIGRhdGFsaXN0IGRkIGRlbCBkZXRhaWxzIGRmbiBkaXIgZGl2IGRsIGR0IGVtIGVtYmVkIGV2ZW50c291cmNlIGZpZWxkc2V0IGZpZ2NhcHRpb24gZmlndXJlIGZvbnQgZm9vdGVyIGZvcm0gZnJhbWUgZnJhbWVzZXQgaDEgaDIgaDMgaDQgaDUgaDYgaGVhZCBoZWFkZXIgaGdyb3VwIGhyIGh0bWwgaSBpZnJhbWUgaW1nIGlucHV0IGlucyBpc2luZGV4IGtiZCBrZXlnZW4gbGFiZWwgbGVnZW5kIGxpIGxpbmsgbWFpbiBtYXAgbWFyayBtZW51IG1ldGEgbWV0ZXIgbmF2IG5vZnJhbWVzIG5vc2NyaXB0IG9iamVjdCBvbCBvcHRncm91cCBvcHRpb24gb3V0cHV0IHAgcGFyYW0gcHJlIHByb2dyZXNzIHEgcnAgcnQgcnVieSBzIHNhbXAgc2NyaXB0IHNlY3Rpb24gc2VsZWN0IHNtYWxsIHNvdXJjZSBzcGFuIHN0cmlrZSBzdHJvbmcgc3R5bGUgc3ViIHN1bW1hcnkgc3VwIHRhYmxlIHRib2R5IHRkIHRleHRhcmVhIHRmb290IHRoIHRoZWFkIHRpbWUgdGl0bGUgdHIgdHJhY2sgdHQgdSB1bCB2YXIgdmlkZW8gd2JyJy5zcGxpdCgnICcpO1xuLy8gKHdlIGFkZCB0aGUgU1ZHIG9uZXMgYmVsb3cpXG5cbmV4cG9ydCBjb25zdCBrbm93blNWR0VsZW1lbnROYW1lcyA9ICdhbHRHbHlwaCBhbHRHbHlwaERlZiBhbHRHbHlwaEl0ZW0gYW5pbWF0ZSBhbmltYXRlQ29sb3IgYW5pbWF0ZU1vdGlvbiBhbmltYXRlVHJhbnNmb3JtIGNpcmNsZSBjbGlwUGF0aCBjb2xvci1wcm9maWxlIGN1cnNvciBkZWZzIGRlc2MgZWxsaXBzZSBmZUJsZW5kIGZlQ29sb3JNYXRyaXggZmVDb21wb25lbnRUcmFuc2ZlciBmZUNvbXBvc2l0ZSBmZUNvbnZvbHZlTWF0cml4IGZlRGlmZnVzZUxpZ2h0aW5nIGZlRGlzcGxhY2VtZW50TWFwIGZlRGlzdGFudExpZ2h0IGZlRmxvb2QgZmVGdW5jQSBmZUZ1bmNCIGZlRnVuY0cgZmVGdW5jUiBmZUdhdXNzaWFuQmx1ciBmZUltYWdlIGZlTWVyZ2UgZmVNZXJnZU5vZGUgZmVNb3JwaG9sb2d5IGZlT2Zmc2V0IGZlUG9pbnRMaWdodCBmZVNwZWN1bGFyTGlnaHRpbmcgZmVTcG90TGlnaHQgZmVUaWxlIGZlVHVyYnVsZW5jZSBmaWx0ZXIgZm9udCBmb250LWZhY2UgZm9udC1mYWNlLWZvcm1hdCBmb250LWZhY2UtbmFtZSBmb250LWZhY2Utc3JjIGZvbnQtZmFjZS11cmkgZm9yZWlnbk9iamVjdCBnIGdseXBoIGdseXBoUmVmIGhrZXJuIGltYWdlIGxpbmUgbGluZWFyR3JhZGllbnQgbWFya2VyIG1hc2sgbWV0YWRhdGEgbWlzc2luZy1nbHlwaCBwYXRoIHBhdHRlcm4gcG9seWdvbiBwb2x5bGluZSByYWRpYWxHcmFkaWVudCByZWN0IHNldCBzdG9wIHN0eWxlIHN2ZyBzd2l0Y2ggc3ltYm9sIHRleHQgdGV4dFBhdGggdGl0bGUgdHJlZiB0c3BhbiB1c2UgdmlldyB2a2Vybicuc3BsaXQoJyAnKTtcbi8vIEFwcGVuZCBTVkcgZWxlbWVudCBuYW1lcyB0byBsaXN0IG9mIGtub3duIGVsZW1lbnQgbmFtZXNcbmV4cG9ydCBjb25zdCBrbm93bkVsZW1lbnROYW1lcyA9IGtub3duSFRNTEVsZW1lbnROYW1lcy5jb25jYXQoa25vd25TVkdFbGVtZW50TmFtZXMpO1xuXG5leHBvcnQgY29uc3Qgdm9pZEVsZW1lbnROYW1lcyA9ICdhcmVhIGJhc2UgYnIgY29sIGNvbW1hbmQgZW1iZWQgaHIgaW1nIGlucHV0IGtleWdlbiBsaW5rIG1ldGEgcGFyYW0gc291cmNlIHRyYWNrIHdicicuc3BsaXQoJyAnKTtcblxuXG52YXIgdm9pZEVsZW1lbnRTZXQgPSBuZXcgU2V0KHZvaWRFbGVtZW50TmFtZXMpO1xudmFyIGtub3duRWxlbWVudFNldCA9IG5ldyBTZXQoa25vd25FbGVtZW50TmFtZXMpO1xudmFyIGtub3duU1ZHRWxlbWVudFNldCA9IG5ldyBTZXQoa25vd25TVkdFbGVtZW50TmFtZXMpO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNLbm93bkVsZW1lbnQodGFnTmFtZSkge1xuICByZXR1cm4ga25vd25FbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzS25vd25TVkdFbGVtZW50KHRhZ05hbWUpIHtcbiAgcmV0dXJuIGtub3duU1ZHRWxlbWVudFNldC5oYXModGFnTmFtZSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1ZvaWRFbGVtZW50KHRhZ05hbWUpIHtcbiAgcmV0dXJuIHZvaWRFbGVtZW50U2V0Lmhhcyh0YWdOYW1lKTtcbn1cblxuXG4vLyBFbnN1cmUgdGFncyBmb3IgYWxsIGtub3duIGVsZW1lbnRzXG5rbm93bkVsZW1lbnROYW1lcy5mb3JFYWNoKGVuc3VyZVRhZyk7XG5cblxuZXhwb3J0IGZ1bmN0aW9uIENoYXJSZWYoYXR0cnMpIHtcbiAgaWYgKCEgKHRoaXMgaW5zdGFuY2VvZiBDaGFyUmVmKSlcbiAgICAvLyBjYWxsZWQgd2l0aG91dCBgbmV3YFxuICAgIHJldHVybiBuZXcgQ2hhclJlZihhdHRycyk7XG5cbiAgaWYgKCEgKGF0dHJzICYmIGF0dHJzLmh0bWwgJiYgYXR0cnMuc3RyKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBcIkhUTUwuQ2hhclJlZiBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggKHtodG1sOi4uLiwgc3RyOi4uLn0pXCIpO1xuXG4gIHRoaXMuaHRtbCA9IGF0dHJzLmh0bWw7XG4gIHRoaXMuc3RyID0gYXR0cnMuc3RyO1xufVxuQ2hhclJlZi5wcm90b3R5cGUuaHRtbGpzVHlwZSA9IENoYXJSZWYuaHRtbGpzVHlwZSA9IFsnQ2hhclJlZiddO1xuXG5leHBvcnQgZnVuY3Rpb24gQ29tbWVudCh2YWx1ZSkge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIENvbW1lbnQpKVxuICAgIC8vIGNhbGxlZCB3aXRob3V0IGBuZXdgXG4gICAgcmV0dXJuIG5ldyBDb21tZW50KHZhbHVlKTtcblxuICBpZiAodHlwZW9mIHZhbHVlICE9PSAnc3RyaW5nJylcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0hUTUwuQ29tbWVudCBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggYSBzdHJpbmcnKTtcblxuICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIC8vIEtpbGwgaWxsZWdhbCBoeXBoZW5zIGluIGNvbW1lbnQgdmFsdWUgKG5vIHdheSB0byBlc2NhcGUgdGhlbSBpbiBIVE1MKVxuICB0aGlzLnNhbml0aXplZFZhbHVlID0gdmFsdWUucmVwbGFjZSgvXi18LS0rfC0kL2csICcnKTtcbn1cbkNvbW1lbnQucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBDb21tZW50Lmh0bWxqc1R5cGUgPSBbJ0NvbW1lbnQnXTtcblxuZXhwb3J0IGZ1bmN0aW9uIFJhdyh2YWx1ZSkge1xuICBpZiAoISAodGhpcyBpbnN0YW5jZW9mIFJhdykpXG4gICAgLy8gY2FsbGVkIHdpdGhvdXQgYG5ld2BcbiAgICByZXR1cm4gbmV3IFJhdyh2YWx1ZSk7XG5cbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpXG4gICAgdGhyb3cgbmV3IEVycm9yKCdIVE1MLlJhdyBtdXN0IGJlIGNvbnN0cnVjdGVkIHdpdGggYSBzdHJpbmcnKTtcblxuICB0aGlzLnZhbHVlID0gdmFsdWU7XG59XG5SYXcucHJvdG90eXBlLmh0bWxqc1R5cGUgPSBSYXcuaHRtbGpzVHlwZSA9IFsnUmF3J107XG5cblxuZXhwb3J0IGZ1bmN0aW9uIGlzQXJyYXkgKHgpIHtcbiAgcmV0dXJuIHggaW5zdGFuY2VvZiBBcnJheSB8fCBBcnJheS5pc0FycmF5KHgpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDb25zdHJ1Y3RlZE9iamVjdCAoeCkge1xuICAvLyBGaWd1cmUgb3V0IGlmIGB4YCBpcyBcImFuIGluc3RhbmNlIG9mIHNvbWUgY2xhc3NcIiBvciBqdXN0IGEgcGxhaW5cbiAgLy8gb2JqZWN0IGxpdGVyYWwuICBJdCBjb3JyZWN0bHkgdHJlYXRzIGFuIG9iamVjdCBsaXRlcmFsIGxpa2VcbiAgLy8gYHsgY29uc3RydWN0b3I6IC4uLiB9YCBhcyBhbiBvYmplY3QgbGl0ZXJhbC4gIEl0IHdvbid0IGRldGVjdFxuICAvLyBpbnN0YW5jZXMgb2YgY2xhc3NlcyB0aGF0IGxhY2sgYSBgY29uc3RydWN0b3JgIHByb3BlcnR5IChlLmcuXG4gIC8vIGlmIHlvdSBhc3NpZ24gdG8gYSBwcm90b3R5cGUgd2hlbiBzZXR0aW5nIHVwIHRoZSBjbGFzcyBhcyBpbjpcbiAgLy8gYEZvbyA9IGZ1bmN0aW9uICgpIHsgLi4uIH07IEZvby5wcm90b3R5cGUgPSB7IC4uLiB9YCwgdGhlblxuICAvLyBgKG5ldyBGb28pLmNvbnN0cnVjdG9yYCBpcyBgT2JqZWN0YCwgbm90IGBGb29gKS5cbiAgaWYoIXggfHwgKHR5cGVvZiB4ICE9PSAnb2JqZWN0JykpIHJldHVybiBmYWxzZTtcbiAgLy8gSXMgdGhpcyBhIHBsYWluIG9iamVjdD9cbiAgbGV0IHBsYWluID0gZmFsc2U7XG4gIGlmKE9iamVjdC5nZXRQcm90b3R5cGVPZih4KSA9PT0gbnVsbCkge1xuICAgIHBsYWluID0gdHJ1ZTtcbiAgfSBlbHNlIHtcbiAgICBsZXQgcHJvdG8gPSB4O1xuICAgIHdoaWxlKE9iamVjdC5nZXRQcm90b3R5cGVPZihwcm90bykgIT09IG51bGwpIHtcbiAgICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHByb3RvKTtcbiAgICB9XG4gICAgcGxhaW4gPSBPYmplY3QuZ2V0UHJvdG90eXBlT2YoeCkgPT09IHByb3RvO1xuICB9XG5cbiAgcmV0dXJuICFwbGFpbiAmJlxuICAgICh0eXBlb2YgeC5jb25zdHJ1Y3RvciA9PT0gJ2Z1bmN0aW9uJykgJiZcbiAgICAoeCBpbnN0YW5jZW9mIHguY29uc3RydWN0b3IpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNOdWxseSAobm9kZSkge1xuICBpZiAobm9kZSA9PSBudWxsKVxuICAgIC8vIG51bGwgb3IgdW5kZWZpbmVkXG4gICAgcmV0dXJuIHRydWU7XG5cbiAgaWYgKGlzQXJyYXkobm9kZSkpIHtcbiAgICAvLyBpcyBpdCBhbiBlbXB0eSBhcnJheSBvciBhbiBhcnJheSBvZiBhbGwgbnVsbHkgaXRlbXM/XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2RlLmxlbmd0aDsgaSsrKVxuICAgICAgaWYgKCEgaXNOdWxseShub2RlW2ldKSlcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNWYWxpZEF0dHJpYnV0ZU5hbWUgKG5hbWUpIHtcbiAgcmV0dXJuIC9eWzpfQS1aYS16XVs6X0EtWmEtejAtOS5cXC1dKi8udGVzdChuYW1lKTtcbn1cblxuLy8gSWYgYGF0dHJzYCBpcyBhbiBhcnJheSBvZiBhdHRyaWJ1dGVzIGRpY3Rpb25hcmllcywgY29tYmluZXMgdGhlbVxuLy8gaW50byBvbmUuICBSZW1vdmVzIGF0dHJpYnV0ZXMgdGhhdCBhcmUgXCJudWxseS5cIlxuZXhwb3J0IGZ1bmN0aW9uIGZsYXR0ZW5BdHRyaWJ1dGVzIChhdHRycykge1xuICBpZiAoISBhdHRycylcbiAgICByZXR1cm4gYXR0cnM7XG5cbiAgdmFyIGlzTGlzdCA9IGlzQXJyYXkoYXR0cnMpO1xuICBpZiAoaXNMaXN0ICYmIGF0dHJzLmxlbmd0aCA9PT0gMClcbiAgICByZXR1cm4gbnVsbDtcblxuICB2YXIgcmVzdWx0ID0ge307XG4gIGZvciAodmFyIGkgPSAwLCBOID0gKGlzTGlzdCA/IGF0dHJzLmxlbmd0aCA6IDEpOyBpIDwgTjsgaSsrKSB7XG4gICAgdmFyIG9uZUF0dHJzID0gKGlzTGlzdCA/IGF0dHJzW2ldIDogYXR0cnMpO1xuICAgIGlmICgodHlwZW9mIG9uZUF0dHJzICE9PSAnb2JqZWN0JykgfHxcbiAgICAgICAgaXNDb25zdHJ1Y3RlZE9iamVjdChvbmVBdHRycykpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFeHBlY3RlZCBwbGFpbiBKUyBvYmplY3QgYXMgYXR0cnMsIGZvdW5kOiBcIiArIG9uZUF0dHJzKTtcbiAgICBmb3IgKHZhciBuYW1lIGluIG9uZUF0dHJzKSB7XG4gICAgICBpZiAoISBpc1ZhbGlkQXR0cmlidXRlTmFtZShuYW1lKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSWxsZWdhbCBIVE1MIGF0dHJpYnV0ZSBuYW1lOiBcIiArIG5hbWUpO1xuICAgICAgdmFyIHZhbHVlID0gb25lQXR0cnNbbmFtZV07XG4gICAgICBpZiAoISBpc051bGx5KHZhbHVlKSlcbiAgICAgICAgcmVzdWx0W25hbWVdID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cbiIsImltcG9ydCB7XG4gIFRhZyxcbiAgQ2hhclJlZixcbiAgQ29tbWVudCxcbiAgUmF3LFxuICBpc0FycmF5LFxuICBnZXRUYWcsXG4gIGlzQ29uc3RydWN0ZWRPYmplY3QsXG4gIGZsYXR0ZW5BdHRyaWJ1dGVzLFxuICBpc1ZvaWRFbGVtZW50LFxufSBmcm9tICcuL2h0bWwnO1xuXG5cbnZhciBJREVOVElUWSA9IGZ1bmN0aW9uICh4KSB7IHJldHVybiB4OyB9O1xuXG4vLyBfYXNzaWduIGlzIGxpa2UgXy5leHRlbmQgb3IgdGhlIHVwY29taW5nIE9iamVjdC5hc3NpZ24uXG4vLyBDb3B5IHNyYydzIG93biwgZW51bWVyYWJsZSBwcm9wZXJ0aWVzIG9udG8gdGd0IGFuZCByZXR1cm5cbi8vIHRndC5cbnZhciBfaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xudmFyIF9hc3NpZ24gPSBmdW5jdGlvbiAodGd0LCBzcmMpIHtcbiAgZm9yICh2YXIgayBpbiBzcmMpIHtcbiAgICBpZiAoX2hhc093blByb3BlcnR5LmNhbGwoc3JjLCBrKSlcbiAgICAgIHRndFtrXSA9IHNyY1trXTtcbiAgfVxuICByZXR1cm4gdGd0O1xufTtcblxuZXhwb3J0IGNvbnN0IFZpc2l0b3IgPSBmdW5jdGlvbiAocHJvcHMpIHtcbiAgX2Fzc2lnbih0aGlzLCBwcm9wcyk7XG59O1xuXG5WaXNpdG9yLmRlZiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIF9hc3NpZ24odGhpcy5wcm90b3R5cGUsIG9wdGlvbnMpO1xufTtcblxuVmlzaXRvci5leHRlbmQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgY3VyVHlwZSA9IHRoaXM7XG4gIHZhciBzdWJUeXBlID0gZnVuY3Rpb24gSFRNTFZpc2l0b3JTdWJ0eXBlKC8qYXJndW1lbnRzKi8pIHtcbiAgICBWaXNpdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH07XG4gIHN1YlR5cGUucHJvdG90eXBlID0gbmV3IGN1clR5cGU7XG4gIHN1YlR5cGUuZXh0ZW5kID0gY3VyVHlwZS5leHRlbmQ7XG4gIHN1YlR5cGUuZGVmID0gY3VyVHlwZS5kZWY7XG4gIGlmIChvcHRpb25zKVxuICAgIF9hc3NpZ24oc3ViVHlwZS5wcm90b3R5cGUsIG9wdGlvbnMpO1xuICByZXR1cm4gc3ViVHlwZTtcbn07XG5cblZpc2l0b3IuZGVmKHtcbiAgdmlzaXQ6IGZ1bmN0aW9uIChjb250ZW50LyosIC4uLiovKSB7XG4gICAgaWYgKGNvbnRlbnQgPT0gbnVsbClcbiAgICAgIC8vIG51bGwgb3IgdW5kZWZpbmVkLlxuICAgICAgcmV0dXJuIHRoaXMudmlzaXROdWxsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICBpZiAodHlwZW9mIGNvbnRlbnQgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoY29udGVudC5odG1sanNUeXBlKSB7XG4gICAgICAgIHN3aXRjaCAoY29udGVudC5odG1sanNUeXBlKSB7XG4gICAgICAgIGNhc2UgVGFnLmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRUYWcuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgY2FzZSBDaGFyUmVmLmh0bWxqc1R5cGU6XG4gICAgICAgICAgcmV0dXJuIHRoaXMudmlzaXRDaGFyUmVmLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGNhc2UgQ29tbWVudC5odG1sanNUeXBlOlxuICAgICAgICAgIHJldHVybiB0aGlzLnZpc2l0Q29tbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICBjYXNlIFJhdy5odG1sanNUeXBlOlxuICAgICAgICAgIHJldHVybiB0aGlzLnZpc2l0UmF3LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW5rbm93biBodG1sanMgdHlwZTogXCIgKyBjb250ZW50Lmh0bWxqc1R5cGUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0FycmF5KGNvbnRlbnQpKVxuICAgICAgICByZXR1cm4gdGhpcy52aXNpdEFycmF5LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICAgIHJldHVybiB0aGlzLnZpc2l0T2JqZWN0LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgICB9IGVsc2UgaWYgKCh0eXBlb2YgY29udGVudCA9PT0gJ3N0cmluZycpIHx8XG4gICAgICAgICAgICAgICAodHlwZW9mIGNvbnRlbnQgPT09ICdib29sZWFuJykgfHxcbiAgICAgICAgICAgICAgICh0eXBlb2YgY29udGVudCA9PT0gJ251bWJlcicpKSB7XG4gICAgICByZXR1cm4gdGhpcy52aXNpdFByaW1pdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgY29udGVudCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcmV0dXJuIHRoaXMudmlzaXRGdW5jdGlvbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqczogXCIgKyBjb250ZW50KTtcblxuICB9LFxuICB2aXNpdE51bGw6IGZ1bmN0aW9uIChudWxsT3JVbmRlZmluZWQvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlci8qLCAuLi4qLykge30sXG4gIHZpc2l0QXJyYXk6IGZ1bmN0aW9uIChhcnJheS8qLCAuLi4qLykge30sXG4gIHZpc2l0Q29tbWVudDogZnVuY3Rpb24gKGNvbW1lbnQvKiwgLi4uKi8pIHt9LFxuICB2aXNpdENoYXJSZWY6IGZ1bmN0aW9uIChjaGFyUmVmLyosIC4uLiovKSB7fSxcbiAgdmlzaXRSYXc6IGZ1bmN0aW9uIChyYXcvKiwgLi4uKi8pIHt9LFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZy8qLCAuLi4qLykge30sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAob2JqLyosIC4uLiovKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBvYmplY3QgaW4gaHRtbGpzOiBcIiArIG9iaik7XG4gIH0sXG4gIHZpc2l0RnVuY3Rpb246IGZ1bmN0aW9uIChmbi8qLCAuLi4qLykge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgZnVuY3Rpb24gaW4gaHRtbGpzOiBcIiArIGZuKTtcbiAgfVxufSk7XG5cbmV4cG9ydCBjb25zdCBUcmFuc2Zvcm1pbmdWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRyYW5zZm9ybWluZ1Zpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBJREVOVElUWSxcbiAgdmlzaXRQcmltaXRpdmU6IElERU5USVRZLFxuICB2aXNpdEFycmF5OiBmdW5jdGlvbiAoYXJyYXksIC4uLmFyZ3MpIHtcbiAgICB2YXIgcmVzdWx0ID0gYXJyYXk7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIG9sZEl0ZW0gPSBhcnJheVtpXTtcbiAgICAgIHZhciBuZXdJdGVtID0gdGhpcy52aXNpdChvbGRJdGVtLCAuLi5hcmdzKTtcbiAgICAgIGlmIChuZXdJdGVtICE9PSBvbGRJdGVtKSB7XG4gICAgICAgIC8vIGNvcHkgYGFycmF5YCBvbiB3cml0ZVxuICAgICAgICBpZiAocmVzdWx0ID09PSBhcnJheSlcbiAgICAgICAgICByZXN1bHQgPSBhcnJheS5zbGljZSgpO1xuICAgICAgICByZXN1bHRbaV0gPSBuZXdJdGVtO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuICB2aXNpdENvbW1lbnQ6IElERU5USVRZLFxuICB2aXNpdENoYXJSZWY6IElERU5USVRZLFxuICB2aXNpdFJhdzogSURFTlRJVFksXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbihvYmosIC4uLmFyZ3Mpe1xuICAgIC8vIERvbid0IHBhcnNlIE1hcmtkb3duICYgUkNEYXRhIGFzIEhUTUxcbiAgICBpZiAob2JqLnRleHRNb2RlICE9IG51bGwpe1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9XG4gICAgaWYgKCdjb250ZW50JyBpbiBvYmopIHtcbiAgICAgIG9iai5jb250ZW50ID0gdGhpcy52aXNpdChvYmouY29udGVudCwgLi4uYXJncyk7XG4gICAgfVxuICAgIGlmICgnZWxzZUNvbnRlbnQnIGluIG9iail7XG4gICAgICBvYmouZWxzZUNvbnRlbnQgPSB0aGlzLnZpc2l0KG9iai5lbHNlQ29udGVudCwgLi4uYXJncyk7XG4gICAgfVxuICAgIHJldHVybiBvYmo7XG4gIH0sXG4gIHZpc2l0RnVuY3Rpb246IElERU5USVRZLFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZywgLi4uYXJncykge1xuICAgIHZhciBvbGRDaGlsZHJlbiA9IHRhZy5jaGlsZHJlbjtcbiAgICB2YXIgbmV3Q2hpbGRyZW4gPSB0aGlzLnZpc2l0Q2hpbGRyZW4ob2xkQ2hpbGRyZW4sIC4uLmFyZ3MpO1xuXG4gICAgdmFyIG9sZEF0dHJzID0gdGFnLmF0dHJzO1xuICAgIHZhciBuZXdBdHRycyA9IHRoaXMudmlzaXRBdHRyaWJ1dGVzKG9sZEF0dHJzLCAuLi5hcmdzKTtcblxuICAgIGlmIChuZXdBdHRycyA9PT0gb2xkQXR0cnMgJiYgbmV3Q2hpbGRyZW4gPT09IG9sZENoaWxkcmVuKVxuICAgICAgcmV0dXJuIHRhZztcblxuICAgIHZhciBuZXdUYWcgPSBnZXRUYWcodGFnLnRhZ05hbWUpLmFwcGx5KG51bGwsIG5ld0NoaWxkcmVuKTtcbiAgICBuZXdUYWcuYXR0cnMgPSBuZXdBdHRycztcbiAgICByZXR1cm4gbmV3VGFnO1xuICB9LFxuICB2aXNpdENoaWxkcmVuOiBmdW5jdGlvbiAoY2hpbGRyZW4sIC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdEFycmF5KGNoaWxkcmVuLCAuLi5hcmdzKTtcbiAgfSxcbiAgLy8gVHJhbnNmb3JtIHRoZSBgLmF0dHJzYCBwcm9wZXJ0eSBvZiBhIHRhZywgd2hpY2ggbWF5IGJlIGEgZGljdGlvbmFyeSxcbiAgLy8gYW4gYXJyYXksIG9yIGluIHNvbWUgdXNlcywgYSBmb3JlaWduIG9iamVjdCAoc3VjaCBhc1xuICAvLyBhIHRlbXBsYXRlIHRhZykuXG4gIHZpc2l0QXR0cmlidXRlczogZnVuY3Rpb24gKGF0dHJzLCAuLi5hcmdzKSB7XG4gICAgaWYgKGlzQXJyYXkoYXR0cnMpKSB7XG4gICAgICB2YXIgcmVzdWx0ID0gYXR0cnM7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGF0dHJzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBvbGRJdGVtID0gYXR0cnNbaV07XG4gICAgICAgIHZhciBuZXdJdGVtID0gdGhpcy52aXNpdEF0dHJpYnV0ZXMob2xkSXRlbSwgLi4uYXJncyk7XG4gICAgICAgIGlmIChuZXdJdGVtICE9PSBvbGRJdGVtKSB7XG4gICAgICAgICAgLy8gY29weSBvbiB3cml0ZVxuICAgICAgICAgIGlmIChyZXN1bHQgPT09IGF0dHJzKVxuICAgICAgICAgICAgcmVzdWx0ID0gYXR0cnMuc2xpY2UoKTtcbiAgICAgICAgICByZXN1bHRbaV0gPSBuZXdJdGVtO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGlmIChhdHRycyAmJiBpc0NvbnN0cnVjdGVkT2JqZWN0KGF0dHJzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGJhc2ljIFRyYW5zZm9ybWluZ1Zpc2l0b3IgZG9lcyBub3Qgc3VwcG9ydCBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJmb3JlaWduIG9iamVjdHMgaW4gYXR0cmlidXRlcy4gIERlZmluZSBhIGN1c3RvbSBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgXCJ2aXNpdEF0dHJpYnV0ZXMgZm9yIHRoaXMgY2FzZS5cIik7XG4gICAgfVxuXG4gICAgdmFyIG9sZEF0dHJzID0gYXR0cnM7XG4gICAgdmFyIG5ld0F0dHJzID0gb2xkQXR0cnM7XG4gICAgaWYgKG9sZEF0dHJzKSB7XG4gICAgICB2YXIgYXR0ckFyZ3MgPSBbbnVsbCwgbnVsbF07XG4gICAgICBhdHRyQXJncy5wdXNoLmFwcGx5KGF0dHJBcmdzLCBhcmd1bWVudHMpO1xuICAgICAgZm9yICh2YXIgayBpbiBvbGRBdHRycykge1xuICAgICAgICB2YXIgb2xkVmFsdWUgPSBvbGRBdHRyc1trXTtcbiAgICAgICAgYXR0ckFyZ3NbMF0gPSBrO1xuICAgICAgICBhdHRyQXJnc1sxXSA9IG9sZFZhbHVlO1xuICAgICAgICB2YXIgbmV3VmFsdWUgPSB0aGlzLnZpc2l0QXR0cmlidXRlLmFwcGx5KHRoaXMsIGF0dHJBcmdzKTtcbiAgICAgICAgaWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xuICAgICAgICAgIC8vIGNvcHkgb24gd3JpdGVcbiAgICAgICAgICBpZiAobmV3QXR0cnMgPT09IG9sZEF0dHJzKVxuICAgICAgICAgICAgbmV3QXR0cnMgPSBfYXNzaWduKHt9LCBvbGRBdHRycyk7XG4gICAgICAgICAgbmV3QXR0cnNba10gPSBuZXdWYWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBuZXdBdHRycztcbiAgfSxcbiAgLy8gVHJhbnNmb3JtIHRoZSB2YWx1ZSBvZiBvbmUgYXR0cmlidXRlIG5hbWUvdmFsdWUgaW4gYW5cbiAgLy8gYXR0cmlidXRlcyBkaWN0aW9uYXJ5LlxuICB2aXNpdEF0dHJpYnV0ZTogZnVuY3Rpb24gKG5hbWUsIHZhbHVlLCB0YWcsIC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy52aXNpdCh2YWx1ZSwgLi4uYXJncyk7XG4gIH1cbn0pO1xuXG5cbmV4cG9ydCBjb25zdCBUb1RleHRWaXNpdG9yID0gVmlzaXRvci5leHRlbmQoKTtcblRvVGV4dFZpc2l0b3IuZGVmKHtcbiAgdmlzaXROdWxsOiBmdW5jdGlvbiAobnVsbE9yVW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICcnO1xuICB9LFxuICB2aXNpdFByaW1pdGl2ZTogZnVuY3Rpb24gKHN0cmluZ0Jvb2xlYW5Pck51bWJlcikge1xuICAgIHZhciBzdHIgPSBTdHJpbmcoc3RyaW5nQm9vbGVhbk9yTnVtYmVyKTtcbiAgICBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBKSB7XG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpO1xuICAgIH0gZWxzZSBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSB7XG4gICAgICAvLyBlc2NhcGUgYCZgIGFuZCBgXCJgIHRoaXMgdGltZSwgbm90IGAmYCBhbmQgYDxgXG4gICAgICByZXR1cm4gc3RyLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgdmFyIHBhcnRzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgIHBhcnRzLnB1c2godGhpcy52aXNpdChhcnJheVtpXSkpO1xuICAgIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbiAgfSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IGhhdmUgYSBjb21tZW50IGhlcmVcIik7XG4gIH0sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYpIHtcbiAgICBpZiAodGhpcy50ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgIHRoaXMudGV4dE1vZGUgPT09IFRFWFRNT0RFLkFUVFJJQlVURSkge1xuICAgICAgcmV0dXJuIGNoYXJSZWYuaHRtbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGNoYXJSZWYuc3RyO1xuICAgIH1cbiAgfSxcbiAgdmlzaXRSYXc6IGZ1bmN0aW9uIChyYXcpIHtcbiAgICByZXR1cm4gcmF3LnZhbHVlO1xuICB9LFxuICB2aXNpdFRhZzogZnVuY3Rpb24gKHRhZykge1xuICAgIC8vIFJlYWxseSB3ZSBzaG91bGQganVzdCBkaXNhbGxvdyBUYWdzIGhlcmUuICBIb3dldmVyLCBhdCB0aGVcbiAgICAvLyBtb21lbnQgaXQncyB1c2VmdWwgdG8gc3RyaW5naWZ5IGFueSBIVE1MIHdlIGZpbmQuICBJblxuICAgIC8vIHBhcnRpY3VsYXIsIHdoZW4geW91IGluY2x1ZGUgYSB0ZW1wbGF0ZSB3aXRoaW4gYHt7I21hcmtkb3dufX1gLFxuICAgIC8vIHdlIHJlbmRlciB0aGUgdGVtcGxhdGUgYXMgdGV4dCwgYW5kIHNpbmNlIHRoZXJlJ3MgY3VycmVudGx5XG4gICAgLy8gbm8gd2F5IHRvIG1ha2UgdGhlIHRlbXBsYXRlIGJlICpwYXJzZWQqIGFzIHRleHQgKGUuZy4gYDx0ZW1wbGF0ZVxuICAgIC8vIHR5cGU9XCJ0ZXh0XCI+YCksIHdlIGhhY2tpc2hseSBzdXBwb3J0IEhUTUwgdGFncyBpbiBtYXJrZG93blxuICAgIC8vIGluIHRlbXBsYXRlcyBieSBwYXJzaW5nIHRoZW0gYW5kIHN0cmluZ2lmeWluZyB0aGVtLlxuICAgIHJldHVybiB0aGlzLnZpc2l0KHRoaXMudG9IVE1MKHRhZykpO1xuICB9LFxuICB2aXNpdE9iamVjdDogZnVuY3Rpb24gKHgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIG9iamVjdCBpbiBodG1sanMgaW4gdG9UZXh0OiBcIiArIHgpO1xuICB9LFxuICB0b0hUTUw6IGZ1bmN0aW9uIChub2RlKSB7XG4gICAgcmV0dXJuIHRvSFRNTChub2RlKTtcbiAgfVxufSk7XG5cblxuXG5leHBvcnQgY29uc3QgVG9IVE1MVmlzaXRvciA9IFZpc2l0b3IuZXh0ZW5kKCk7XG5Ub0hUTUxWaXNpdG9yLmRlZih7XG4gIHZpc2l0TnVsbDogZnVuY3Rpb24gKG51bGxPclVuZGVmaW5lZCkge1xuICAgIHJldHVybiAnJztcbiAgfSxcbiAgdmlzaXRQcmltaXRpdmU6IGZ1bmN0aW9uIChzdHJpbmdCb29sZWFuT3JOdW1iZXIpIHtcbiAgICB2YXIgc3RyID0gU3RyaW5nKHN0cmluZ0Jvb2xlYW5Pck51bWJlcik7XG4gICAgcmV0dXJuIHN0ci5yZXBsYWNlKC8mL2csICcmYW1wOycpLnJlcGxhY2UoLzwvZywgJyZsdDsnKTtcbiAgfSxcbiAgdmlzaXRBcnJheTogZnVuY3Rpb24gKGFycmF5KSB7XG4gICAgdmFyIHBhcnRzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKylcbiAgICAgIHBhcnRzLnB1c2godGhpcy52aXNpdChhcnJheVtpXSkpO1xuICAgIHJldHVybiBwYXJ0cy5qb2luKCcnKTtcbiAgfSxcbiAgdmlzaXRDb21tZW50OiBmdW5jdGlvbiAoY29tbWVudCkge1xuICAgIHJldHVybiAnPCEtLScgKyBjb21tZW50LnNhbml0aXplZFZhbHVlICsgJy0tPic7XG4gIH0sXG4gIHZpc2l0Q2hhclJlZjogZnVuY3Rpb24gKGNoYXJSZWYpIHtcbiAgICByZXR1cm4gY2hhclJlZi5odG1sO1xuICB9LFxuICB2aXNpdFJhdzogZnVuY3Rpb24gKHJhdykge1xuICAgIHJldHVybiByYXcudmFsdWU7XG4gIH0sXG4gIHZpc2l0VGFnOiBmdW5jdGlvbiAodGFnKSB7XG4gICAgdmFyIGF0dHJTdHJzID0gW107XG5cbiAgICB2YXIgdGFnTmFtZSA9IHRhZy50YWdOYW1lO1xuICAgIHZhciBjaGlsZHJlbiA9IHRhZy5jaGlsZHJlbjtcblxuICAgIHZhciBhdHRycyA9IHRhZy5hdHRycztcbiAgICBpZiAoYXR0cnMpIHtcbiAgICAgIGF0dHJzID0gZmxhdHRlbkF0dHJpYnV0ZXMoYXR0cnMpO1xuICAgICAgZm9yICh2YXIgayBpbiBhdHRycykge1xuICAgICAgICBpZiAoayA9PT0gJ3ZhbHVlJyAmJiB0YWdOYW1lID09PSAndGV4dGFyZWEnKSB7XG4gICAgICAgICAgY2hpbGRyZW4gPSBbYXR0cnNba10sIGNoaWxkcmVuXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgdiA9IHRoaXMudG9UZXh0KGF0dHJzW2tdLCBURVhUTU9ERS5BVFRSSUJVVEUpO1xuICAgICAgICAgIGF0dHJTdHJzLnB1c2goJyAnICsgayArICc9XCInICsgdiArICdcIicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHN0YXJ0VGFnID0gJzwnICsgdGFnTmFtZSArIGF0dHJTdHJzLmpvaW4oJycpICsgJz4nO1xuXG4gICAgdmFyIGNoaWxkU3RycyA9IFtdO1xuICAgIHZhciBjb250ZW50O1xuICAgIGlmICh0YWdOYW1lID09PSAndGV4dGFyZWEnKSB7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyBpKyspXG4gICAgICAgIGNoaWxkU3Rycy5wdXNoKHRoaXMudG9UZXh0KGNoaWxkcmVuW2ldLCBURVhUTU9ERS5SQ0RBVEEpKTtcblxuICAgICAgY29udGVudCA9IGNoaWxkU3Rycy5qb2luKCcnKTtcbiAgICAgIGlmIChjb250ZW50LnNsaWNlKDAsIDEpID09PSAnXFxuJylcbiAgICAgICAgLy8gVEVYVEFSRUEgd2lsbCBhYnNvcmIgYSBuZXdsaW5lLCBzbyBpZiB3ZSBzZWUgb25lLCBhZGRcbiAgICAgICAgLy8gYW5vdGhlciBvbmUuXG4gICAgICAgIGNvbnRlbnQgPSAnXFxuJyArIGNvbnRlbnQ7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKylcbiAgICAgICAgY2hpbGRTdHJzLnB1c2godGhpcy52aXNpdChjaGlsZHJlbltpXSkpO1xuXG4gICAgICBjb250ZW50ID0gY2hpbGRTdHJzLmpvaW4oJycpO1xuICAgIH1cblxuICAgIHZhciByZXN1bHQgPSBzdGFydFRhZyArIGNvbnRlbnQ7XG5cbiAgICBpZiAoY2hpbGRyZW4ubGVuZ3RoIHx8ICEgaXNWb2lkRWxlbWVudCh0YWdOYW1lKSkge1xuICAgICAgLy8gXCJWb2lkXCIgZWxlbWVudHMgbGlrZSBCUiBhcmUgdGhlIG9ubHkgb25lcyB0aGF0IGRvbid0IGdldCBhIGNsb3NlXG4gICAgICAvLyB0YWcgaW4gSFRNTDUuICBUaGV5IHNob3VsZG4ndCBoYXZlIGNvbnRlbnRzLCBlaXRoZXIsIHNvIHdlIGNvdWxkXG4gICAgICAvLyB0aHJvdyBhbiBlcnJvciB1cG9uIHNlZWluZyBjb250ZW50cyBoZXJlLlxuICAgICAgcmVzdWx0ICs9ICc8LycgKyB0YWdOYW1lICsgJz4nO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG4gIHZpc2l0T2JqZWN0OiBmdW5jdGlvbiAoeCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgb2JqZWN0IGluIGh0bWxqcyBpbiB0b0hUTUw6IFwiICsgeCk7XG4gIH0sXG4gIHRvVGV4dDogZnVuY3Rpb24gKG5vZGUsIHRleHRNb2RlKSB7XG4gICAgcmV0dXJuIHRvVGV4dChub2RlLCB0ZXh0TW9kZSk7XG4gIH1cbn0pO1xuXG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vIFRPSFRNTFxuXG5leHBvcnQgZnVuY3Rpb24gdG9IVE1MKGNvbnRlbnQpIHtcbiAgcmV0dXJuIChuZXcgVG9IVE1MVmlzaXRvcikudmlzaXQoY29udGVudCk7XG59XG5cbi8vIEVzY2FwaW5nIG1vZGVzIGZvciBvdXRwdXR0aW5nIHRleHQgd2hlbiBnZW5lcmF0aW5nIEhUTUwuXG5leHBvcnQgY29uc3QgVEVYVE1PREUgPSB7XG4gIFNUUklORzogMSxcbiAgUkNEQVRBOiAyLFxuICBBVFRSSUJVVEU6IDNcbn07XG5cblxuZXhwb3J0IGZ1bmN0aW9uIHRvVGV4dChjb250ZW50LCB0ZXh0TW9kZSkge1xuICBpZiAoISB0ZXh0TW9kZSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ0ZXh0TW9kZSByZXF1aXJlZCBmb3IgSFRNTC50b1RleHRcIik7XG4gIGlmICghICh0ZXh0TW9kZSA9PT0gVEVYVE1PREUuU1RSSU5HIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gVEVYVE1PREUuUkNEQVRBIHx8XG4gICAgICAgICB0ZXh0TW9kZSA9PT0gVEVYVE1PREUuQVRUUklCVVRFKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmtub3duIHRleHRNb2RlOiBcIiArIHRleHRNb2RlKTtcblxuICB2YXIgdmlzaXRvciA9IG5ldyBUb1RleHRWaXNpdG9yKHt0ZXh0TW9kZTogdGV4dE1vZGV9KTtcbiAgcmV0dXJuIHZpc2l0b3IudmlzaXQoY29udGVudCk7XG59XG4iXX0=
