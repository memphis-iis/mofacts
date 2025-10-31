"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Document$$reflection = Document$$reflection;
exports.AnswerDocuments$reflection = AnswerDocuments$reflection;
exports.Answer$reflection = Answer$reflection;
exports.AnswerRequest$reflection = AnswerRequest$reflection;
exports.AnswerContextRequest$reflection = AnswerContextRequest$reflection;
exports.WikipediaAnswerRequest$reflection = WikipediaAnswerRequest$reflection;
exports.DocumentsRequest$reflection = DocumentsRequest$reflection;
exports.getAnswer = getAnswer;
exports.getAnswerWithContext = getAnswerWithContext;
exports.getAnswerWikipedia = getAnswerWikipedia;
exports.getDocuments = getDocuments;
exports.testAnswer = testAnswer;
exports.DocumentsRequest = exports.WikipediaAnswerRequest = exports.AnswerContextRequest = exports.AnswerRequest = exports.endpoint = exports.Answer = exports.AnswerDocuments = exports.Document$ = void 0;

require("isomorphic-fetch");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Util = require("./fable-library.2.10.2/Util");

var _Fetch = require("./Thoth.Fetch.2.0.0/Fetch");

var _PromiseImpl = require("./Fable.Promise.2.1.0/PromiseImpl");

var _Promise = require("./Fable.Promise.2.1.0/Promise");

var _Types2 = require("./Thoth.Json.4.0.0/Types");

const Document$ = (0, _Types.declare)(function LongformQA_Document(Article, Sections, Text$, Score) {
  this.Article = Article;
  this.Sections = Sections;
  this.Text = Text$;
  this.Score = Score;
}, _Types.Record);
exports.Document$ = Document$;

function Document$$reflection() {
  return (0, _Reflection.record_type)("LongformQA.Document", [], Document$, () => [["Article", _Reflection.string_type], ["Sections", _Reflection.string_type], ["Text", _Reflection.string_type], ["Score", _Reflection.float64_type]]);
}

const AnswerDocuments = (0, _Types.declare)(function LongformQA_AnswerDocuments(answer, documents) {
  this.answer = answer;
  this.documents = documents;
}, _Types.Record);
exports.AnswerDocuments = AnswerDocuments;

function AnswerDocuments$reflection() {
  return (0, _Reflection.record_type)("LongformQA.AnswerDocuments", [], AnswerDocuments, () => [["answer", _Reflection.string_type], ["documents", (0, _Reflection.array_type)(Document$$reflection())]]);
}

const Answer = (0, _Types.declare)(function LongformQA_Answer(answer) {
  this.answer = answer;
}, _Types.Record);
exports.Answer = Answer;

function Answer$reflection() {
  return (0, _Reflection.record_type)("LongformQA.Answer", [], Answer, () => [["answer", _Reflection.string_type]]);
}

const endpoint = "http://127.0.0.1:5000/api/";
exports.endpoint = endpoint;
const AnswerRequest = (0, _Types.declare)(function LongformQA_AnswerRequest(question) {
  this.question = question;
}, _Types.Record);
exports.AnswerRequest = AnswerRequest;

function AnswerRequest$reflection() {
  return (0, _Reflection.record_type)("LongformQA.AnswerRequest", [], AnswerRequest, () => [["question", _Reflection.string_type]]);
}

const AnswerContextRequest = (0, _Types.declare)(function LongformQA_AnswerContextRequest(question, context) {
  this.question = question;
  this.context = context;
}, _Types.Record);
exports.AnswerContextRequest = AnswerContextRequest;

function AnswerContextRequest$reflection() {
  return (0, _Reflection.record_type)("LongformQA.AnswerContextRequest", [], AnswerContextRequest, () => [["question", _Reflection.string_type], ["context", (0, _Reflection.array_type)(_Reflection.string_type)]]);
}

const WikipediaAnswerRequest = (0, _Types.declare)(function LongformQA_WikipediaAnswerRequest(question, indexName) {
  this.question = question;
  this.indexName = indexName;
}, _Types.Record);
exports.WikipediaAnswerRequest = WikipediaAnswerRequest;

function WikipediaAnswerRequest$reflection() {
  return (0, _Reflection.record_type)("LongformQA.WikipediaAnswerRequest", [], WikipediaAnswerRequest, () => [["question", _Reflection.string_type], ["indexName", _Reflection.string_type]]);
}

const DocumentsRequest = (0, _Types.declare)(function LongformQA_DocumentsRequest(query) {
  this.query = query;
}, _Types.Record);
exports.DocumentsRequest = DocumentsRequest;

function DocumentsRequest$reflection() {
  return (0, _Reflection.record_type)("LongformQA.DocumentsRequest", [], DocumentsRequest, () => [["query", _Reflection.string_type]]);
}

function getAnswer(question) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoint + "getAnswer", new AnswerRequest(question), undefined, undefined, undefined, undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return AnswerDocuments$reflection();
      }

    }, {
      ResolveType() {
        return AnswerRequest$reflection();
      }

    });
  }));
}

function getAnswerWithContext(question$$1, context) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoint + "getAnswerWithContext", new AnswerContextRequest(question$$1, context), undefined, undefined, new _Types2.CaseStrategy(2, "SnakeCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return Answer$reflection();
      }

    }, {
      ResolveType() {
        return AnswerContextRequest$reflection();
      }

    });
  }));
}

function getAnswerWikipedia(question$$2) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoint + "getAnswer", new WikipediaAnswerRequest(question$$2, "wiki40b_snippets_100w"), undefined, undefined, new _Types2.CaseStrategy(1, "CamelCase"), undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return AnswerDocuments$reflection();
      }

    }, {
      ResolveType() {
        return WikipediaAnswerRequest$reflection();
      }

    });
  }));
}

function getDocuments(query) {
  return (0, _Promise.PromiseBuilder$$Run$$212F1D4B)(_PromiseImpl.promise, (0, _Promise.PromiseBuilder$$Delay$$62FBFDE1)(_PromiseImpl.promise, function () {
    return (0, _Fetch.Fetch$$$tryPost$$5760677E)(endpoint + "getDocuments", new DocumentsRequest(query), undefined, undefined, undefined, undefined, (0, _Util.uncurry)(2, undefined), {
      ResolveType() {
        return (0, _Reflection.array_type)(Document$$reflection());
      }

    }, {
      ResolveType() {
        return DocumentsRequest$reflection();
      }

    });
  }));
}

function testAnswer(question$$3) {
  return getAnswerWithContext(question$$3, ["The cerebrum is part of the brain in the upper part of the cranial cavity that provides higher mental functions.", "The cerebellum is the part of the brain that coordinates skeletal muscle movement.", "Small amounts enter the central canal of the spinal cord, but most CSF circulates through the subarachnoid space of both the brain and the spinal cord by passing through openings in the wall of the fourth ventricle near the cerebellum.", "The pattern of these elevations and depressions is complex, but, despite individual variations, is similar in all normal brains. For example, a longitudinal fissure separates the right and left cerebral hemispheres; a transverse fissure separates the cerebrum from the cerebellum; and sulci divide each hemisphere into lobes. Most of the five lobes of the cerebral hemispheres are named after the skull bones that they underlie. The lobes of each hemisphere include the following: All lobes of the cerebrum have a thin layer of gray matter called the cerebral cortex. The cortex constitutes the outermost portion of the cerebrum. It covers", "matter called the red nucleus. This nucleus communicates with the cerebellum and with centers of the spinal cord, and it plays a role in reflexes that maintain posture. It appears red because it is richly supplied with blood vessels. The pons occupies the full thickness of the brainstem, but it is most visible ventrally as a rounded bulge where it separates the midbrain from the medulla oblongata. The ventral portion of the pons consists mostly of longitudinal nerve fibers, which relay information between the medulla oblongata and the cerebrum. Its ventral portion also contains large bundles of transverse nerve fibers", "that wrap around to the back and connect with the cerebellum. They conduct impulses from the cerebrum to centers within the cerebellum. Several nuclei of the pons relay sensory information from peripheral nerves to higher brain centers. Other nuclei may function with centers of the medulla oblongata to control breathing. The medulla oblongata is an enlarged continuation of the spinal cord, extending from the level of the foramen magnum to the pons. Its dorsal surface flattens to form the floor of the fourth ventricle, and its ventral surface is marked by two longitudinal enlargements called the pyramids. These contain descending", "separated by a layer of dura mater called the falx cerebelli. A structure called the vermis connects the cerebellar hemispheres at the midline. Like the cerebrum, the cerebellum is primarily composed of white matter with a thin layer of gray matter, the cerebellar cortex, on its surface. This cortex doubles over on itself in a series of complex folds that have myelinated nerve fibers branching into them. A cut into the cerebellum reveals a treelike pattern of white matter, called the arbor vitae, surrounded by gray matter. A number of nuclei lie deep within each cerebellar hemisphere. The largest and", "REM sleep sometimes twitch their limbs. In humans, REM sleep usually lasts from five to fifteen minutes. This \"dream sleep\" is important. If a person lacks REM sleep for just one night, sleep on the next night makes up for it. During REM sleep, heart and respiratory rates are irregular. Marijuana, alcohol, and certain other drugs, such as benzodiazepines, interfere with REM sleep. it describes several disorders of sleep. The cerebellum is a large mass of tissue inferior to the occipital lobes of the cerebrum and dorsal to the pons and medulla oblongata. It consists of two lateral hemispheres partially"]);
}