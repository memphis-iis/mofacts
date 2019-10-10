"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FileReader$$$readBlobAsText = FileReader$$$readBlobAsText;
exports.FileReader$$$readFileAsText = FileReader$$$readFileAsText;
exports.FormData$$$append = FormData$$$append;
exports.FormData$$$appendFile = FormData$$$appendFile;
exports.FormData$$$appendNamedFile = FormData$$$appendNamedFile;
exports.FormData$$$appendBlob = FormData$$$appendBlob;
exports.FormData$$$appendNamedBlob = FormData$$$appendNamedBlob;
exports.Headers$$$contentType = Headers$$$contentType;
exports.Headers$$$accept = Headers$$$accept;
exports.Headers$$$acceptCharset = Headers$$$acceptCharset;
exports.Headers$$$acceptEncoding = Headers$$$acceptEncoding;
exports.Headers$$$acceptLanguage = Headers$$$acceptLanguage;
exports.Headers$$$acceptDateTime = Headers$$$acceptDateTime;
exports.Headers$$$authorization = Headers$$$authorization;
exports.Headers$$$cacheControl = Headers$$$cacheControl;
exports.Headers$$$connection = Headers$$$connection;
exports.Headers$$$cookie = Headers$$$cookie;
exports.Headers$$$contentMD5 = Headers$$$contentMD5;
exports.Headers$$$date = Headers$$$date;
exports.Headers$$$expect = Headers$$$expect;
exports.Headers$$$ifMatch = Headers$$$ifMatch;
exports.Headers$$$ifModifiedSince = Headers$$$ifModifiedSince;
exports.Headers$$$ifNoneMatch = Headers$$$ifNoneMatch;
exports.Headers$$$ifRange = Headers$$$ifRange;
exports.Headers$$$IfUnmodifiedSince = Headers$$$IfUnmodifiedSince;
exports.Headers$$$maxForwards = Headers$$$maxForwards;
exports.Headers$$$origin = Headers$$$origin;
exports.Headers$$$pragma = Headers$$$pragma;
exports.Headers$$$proxyAuthorization = Headers$$$proxyAuthorization;
exports.Headers$$$range = Headers$$$range;
exports.Headers$$$referer = Headers$$$referer;
exports.Headers$$$userAgent = Headers$$$userAgent;
exports.Headers$$$create = Headers$$$create;
exports.Http$$$request = Http$$$request;
exports.Http$$$method = Http$$$method;
exports.Http$$$header = Http$$$header;
exports.Http$$$headers = Http$$$headers;
exports.Http$$$overrideMimeType = Http$$$overrideMimeType;
exports.Http$$$overrideResponseType = Http$$$overrideResponseType;
exports.Http$$$content = Http$$$content;
exports.Http$$$send = Http$$$send;
exports.Http$$$get = Http$$$get;
exports.Http$$$put = Http$$$put;
exports.Http$$$delete = Http$$$delete;
exports.Http$$$patch = Http$$$patch;
exports.Http$$$post = Http$$$post;

var _Async = require("../fable-library.2.3.11/Async");

var _Types = require("./Types");

var _Types2 = require("../fable-library.2.3.11/Types");

var _Util = require("../fable-library.2.3.11/Util");

var _Map = require("../fable-library.2.3.11/Map");

var _String = require("../fable-library.2.3.11/String");

var _List = require("../fable-library.2.3.11/List");

var _Array = require("../fable-library.2.3.11/Array");

var _Seq = require("../fable-library.2.3.11/Seq");

var _AsyncBuilder = require("../fable-library.2.3.11/AsyncBuilder");

var XMLHttpRequest = require("../XMLHttpRequest.js").XMLHttpRequest;

function FileReader$$$readBlobAsText(blob) {
  return (0, _Async.fromContinuations)(function (tupledArg) {
    const reader = new FileReader();

    reader.onload = function (_arg1) {
      if (reader.readyState === 2) {
        tupledArg[0](reader.result);
      }
    };

    reader.readAsText(blob);
  });
}

function FileReader$$$readFileAsText(file) {
  return (0, _Async.fromContinuations)(function (tupledArg$$1) {
    const reader$$1 = new FileReader();

    reader$$1.onload = function (_arg1$$1) {
      if (reader$$1.readyState === 2) {
        tupledArg$$1[0](reader$$1.result);
      }
    };

    reader$$1.readAsText(file);
  });
}

function FormData$$$append(key, value, form) {
  form.append(key, value);
  return form;
}

function FormData$$$appendFile(key$$1, file$$1, form$$1) {
  form$$1.append(key$$1, file$$1);
  return form$$1;
}

function FormData$$$appendNamedFile(key$$2, fileName, file$$2, form$$2) {
  form$$2.append(key$$2, file$$2, fileName);
  return form$$2;
}

function FormData$$$appendBlob(key$$3, blob$$1, form$$3) {
  form$$3.append(key$$3, blob$$1);
  return form$$3;
}

function FormData$$$appendNamedBlob(key$$4, fileName$$1, blob$$2, form$$4) {
  form$$4.append(key$$4, blob$$2, fileName$$1);
  return form$$4;
}

function Headers$$$contentType(value$$1) {
  return new _Types.Header(0, "Header", "Content-Type", value$$1);
}

function Headers$$$accept(value$$2) {
  return new _Types.Header(0, "Header", "Accept", value$$2);
}

function Headers$$$acceptCharset(value$$3) {
  return new _Types.Header(0, "Header", "Accept-Charset", value$$3);
}

function Headers$$$acceptEncoding(value$$4) {
  return new _Types.Header(0, "Header", "Accept-Encoding", value$$4);
}

function Headers$$$acceptLanguage(value$$5) {
  return new _Types.Header(0, "Header", "Accept-Language", value$$5);
}

function Headers$$$acceptDateTime(value$$6) {
  return new _Types.Header(0, "Header", "Accept-Datetime", value$$6);
}

function Headers$$$authorization(value$$7) {
  return new _Types.Header(0, "Header", "Authorization", value$$7);
}

function Headers$$$cacheControl(value$$8) {
  return new _Types.Header(0, "Header", "Cache-Control", value$$8);
}

function Headers$$$connection(value$$9) {
  return new _Types.Header(0, "Header", "Connection", value$$9);
}

function Headers$$$cookie(value$$10) {
  return new _Types.Header(0, "Header", "Cookie", value$$10);
}

function Headers$$$contentMD5(value$$11) {
  return new _Types.Header(0, "Header", "Content-MD5", value$$11);
}

function Headers$$$date(value$$12) {
  return new _Types.Header(0, "Header", "Date", value$$12);
}

function Headers$$$expect(value$$13) {
  return new _Types.Header(0, "Header", "Expect", value$$13);
}

function Headers$$$ifMatch(value$$14) {
  return new _Types.Header(0, "Header", "If-Match", value$$14);
}

function Headers$$$ifModifiedSince(value$$15) {
  return new _Types.Header(0, "Header", "If-Modified-Since", value$$15);
}

function Headers$$$ifNoneMatch(value$$16) {
  return new _Types.Header(0, "Header", "If-None-Match", value$$16);
}

function Headers$$$ifRange(value$$17) {
  return new _Types.Header(0, "Header", "If-Range", value$$17);
}

function Headers$$$IfUnmodifiedSince(value$$18) {
  return new _Types.Header(0, "Header", "If-Unmodified-Since", value$$18);
}

function Headers$$$maxForwards(value$$19) {
  return new _Types.Header(0, "Header", "Max-Forwards", value$$19);
}

function Headers$$$origin(value$$20) {
  return new _Types.Header(0, "Header", "Origin", value$$20);
}

function Headers$$$pragma(value$$21) {
  return new _Types.Header(0, "Header", "Pragma", value$$21);
}

function Headers$$$proxyAuthorization(value$$22) {
  return new _Types.Header(0, "Header", "Proxy-Authorization", value$$22);
}

function Headers$$$range(value$$23) {
  return new _Types.Header(0, "Header", "Range", value$$23);
}

function Headers$$$referer(value$$24) {
  return new _Types.Header(0, "Header", "Referer", value$$24);
}

function Headers$$$userAgent(value$$25) {
  return new _Types.Header(0, "Header", "User-Agent", value$$25);
}

function Headers$$$create(key$$5, value$$26) {
  return new _Types.Header(0, "Header", key$$5, value$$26);
}

const Http$$$defaultRequest = new _Types.HttpRequest("", new _Types.HttpMethod(0, "GET"), new _Types2.List(), null, null, new _Types.BodyContent(0, "Empty"));
const Http$$$emptyResponse = new _Types.HttpResponse(0, "", "", (0, _Map.empty)({
  Compare: _Util.comparePrimitives
}), new _Types.ResponseContent(0, "Text", ""));

function Http$$$splitAt(delimiter, input) {
  if ((0, _String.isNullOrEmpty)(input)) {
    return [input];
  } else {
    return (0, _String.split)(input, [delimiter], null, 0);
  }
}

function Http$$$serializeMethod(_arg1$$2) {
  switch (_arg1$$2.tag) {
    case 1:
      {
        return "POST";
      }

    case 3:
      {
        return "PATCH";
      }

    case 2:
      {
        return "PUT";
      }

    case 4:
      {
        return "DELETE";
      }

    case 6:
      {
        return "OPTIONS";
      }

    case 5:
      {
        return "HEAD";
      }

    default:
      {
        return "GET";
      }
  }
}

function Http$$$request(url) {
  return new _Types.HttpRequest(url, Http$$$defaultRequest.method, Http$$$defaultRequest.headers, Http$$$defaultRequest.overridenMimeType, Http$$$defaultRequest.overridenResponseType, Http$$$defaultRequest.content);
}

function Http$$$method(httpVerb, req) {
  return new _Types.HttpRequest(req.url, httpVerb, req.headers, req.overridenMimeType, req.overridenResponseType, req.content);
}

function Http$$$header(singleHeader, req$$1) {
  return new _Types.HttpRequest(req$$1.url, req$$1.method, (0, _List.append)(req$$1.headers, new _Types2.List(singleHeader, new _Types2.List())), req$$1.overridenMimeType, req$$1.overridenResponseType, req$$1.content);
}

function Http$$$headers(values, req$$2) {
  return new _Types.HttpRequest(req$$2.url, req$$2.method, (0, _List.append)(req$$2.headers, values), req$$2.overridenMimeType, req$$2.overridenResponseType, req$$2.content);
}

function Http$$$overrideMimeType(value$$27, req$$3) {
  return new _Types.HttpRequest(req$$3.url, req$$3.method, req$$3.headers, value$$27, req$$3.overridenResponseType, req$$3.content);
}

function Http$$$overrideResponseType(value$$28, req$$4) {
  return new _Types.HttpRequest(req$$4.url, req$$4.method, req$$4.headers, req$$4.overridenMimeType, value$$28, req$$4.content);
}

function Http$$$content(bodyContent, req$$5) {
  return new _Types.HttpRequest(req$$5.url, req$$5.method, req$$5.headers, req$$5.overridenMimeType, req$$5.overridenResponseType, bodyContent);
}

function Http$$$send(req$$6) {
  return (0, _Async.fromContinuations)(function (tupledArg$$2) {
    const xhr = new XMLHttpRequest();
    console.log("req$$6.url!!!:" + req$$6.url);
    xhr.open(Http$$$serializeMethod(req$$6.method), req$$6.url);

    xhr.onreadystatechange = function () {
      var matchValue$$5, matchValue$$6;

      if (xhr.readyState === 4) {
        tupledArg$$2[0](new _Types.HttpResponse(xhr.status, (matchValue$$5 = xhr.responseType, matchValue$$5 === "" ? xhr.responseText : matchValue$$5 === "text" ? xhr.responseText : ""), xhr.responseType, (0, _Map.ofArray)((0, _Array.choose)(function chooser(headerLine) {
          const parts = Http$$$splitAt(":", headerLine);
          const matchValue$$7 = (0, _List.ofArray)(parts);

          if (matchValue$$7.tail != null) {
            const rest = matchValue$$7.tail;
            const key$$6 = matchValue$$7.head;
            return [key$$6.toLocaleLowerCase(), (0, _String.join)(":", ...rest).trim()];
          } else {
            const otherwise = matchValue$$7;
            return null;
          }
        }, Http$$$splitAt("\r\n", xhr.getAllResponseHeaders()), Array), {
          Compare: _Util.comparePrimitives
        }), (matchValue$$6 = xhr.responseType, matchValue$$6 === "" ? new _Types.ResponseContent(0, "Text", xhr.responseText) : matchValue$$6 === "text" ? new _Types.ResponseContent(0, "Text", xhr.responseText) : matchValue$$6 === "arraybuffer" ? new _Types.ResponseContent(2, "ArrayBuffer", xhr.response) : matchValue$$6 === "blob" ? new _Types.ResponseContent(1, "Blob", xhr.response) : new _Types.ResponseContent(3, "Unknown", xhr.response))));
      }
    };

    (0, _Seq.iterate)(function (forLoopVar) {
      const value$$29 = forLoopVar.fields[1];
      const key$$7 = forLoopVar.fields[0];
      xhr.setRequestHeader(key$$7, value$$29);
    }, req$$6.headers);

    if (req$$6.overridenMimeType == null) {} else {
      const mimeType = req$$6.overridenMimeType;
      xhr.overrideMimeType(mimeType);
    }

    if (req$$6.overridenResponseType == null) {} else if (req$$6.overridenResponseType.tag === 1) {
      xhr.responseType = "blob";
    } else if (req$$6.overridenResponseType.tag === 2) {
      xhr.responseType = "arraybuffer";
    } else {
      xhr.responseType = "text";
    }

    const matchValue$$10 = [req$$6.method, req$$6.content];

    if (matchValue$$10[0].tag === 0) {
      xhr.send(null);
    } else if (matchValue$$10[1].tag === 1) {
      const value$$30 = matchValue$$10[1].fields[0];
      xhr.send(value$$30);
    } else if (matchValue$$10[1].tag === 3) {
      const formData = matchValue$$10[1].fields[0];
      xhr.send(formData);
    } else if (matchValue$$10[1].tag === 2) {
      const blob$$3 = matchValue$$10[1].fields[0];
      xhr.send(blob$$3);
    } else {
      xhr.send(null);
    }
  });
}

function Http$$$get(url$$1) {
  return _AsyncBuilder.singleton.Delay(function () {
    return _AsyncBuilder.singleton.Bind(Http$$$send(Http$$$method(new _Types.HttpMethod(0, "GET"), Http$$$request(url$$1))), function (_arg1$$4) {
      const response = _arg1$$4;
      return _AsyncBuilder.singleton.Return([response.statusCode, response.responseText]);
    });
  });
}

function Http$$$put(url$$2, data) {
  return _AsyncBuilder.singleton.Delay(function () {
    return _AsyncBuilder.singleton.Bind(Http$$$send(Http$$$content(new _Types.BodyContent(1, "Text", data), Http$$$method(new _Types.HttpMethod(2, "PUT"), Http$$$request(url$$2)))), function (_arg1$$5) {
      const response$$1 = _arg1$$5;
      return _AsyncBuilder.singleton.Return([response$$1.statusCode, response$$1.responseText]);
    });
  });
}

function Http$$$delete(url$$3) {
  return _AsyncBuilder.singleton.Delay(function () {
    return _AsyncBuilder.singleton.Bind(Http$$$send(Http$$$method(new _Types.HttpMethod(4, "DELETE"), Http$$$request(url$$3))), function (_arg1$$6) {
      const response$$2 = _arg1$$6;
      return _AsyncBuilder.singleton.Return([response$$2.statusCode, response$$2.responseText]);
    });
  });
}

function Http$$$patch(url$$4, data$$1) {
  return _AsyncBuilder.singleton.Delay(function () {
    return _AsyncBuilder.singleton.Bind(Http$$$send(Http$$$content(new _Types.BodyContent(1, "Text", data$$1), Http$$$method(new _Types.HttpMethod(3, "PATCH"), Http$$$request(url$$4)))), function (_arg1$$7) {
      const response$$3 = _arg1$$7;
      return _AsyncBuilder.singleton.Return([response$$3.statusCode, response$$3.responseText]);
    });
  });
}

function Http$$$post(url$$5, data$$2) {
  return _AsyncBuilder.singleton.Delay(function () {
    return _AsyncBuilder.singleton.Bind(Http$$$send(Http$$$content(new _Types.BodyContent(1, "Text", data$$2), Http$$$method(new _Types.HttpMethod(1, "POST"), Http$$$request(url$$5)))), function (_arg1$$8) {
      const response$$4 = _arg1$$8;
      return _AsyncBuilder.singleton.Return([response$$4.statusCode, response$$4.responseText]);
    });
  });
}
