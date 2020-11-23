"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Rules$$$tryGetValue = Rules$$$tryGetValue;
exports.Rules$$$toLower = Rules$$$toLower;
exports.Rules$002EToken$reflection = Rules$002EToken$reflection;
exports.Rules$002EToken$$$Create$$Z2BAB6A85 = Rules$002EToken$$$Create$$Z2BAB6A85;
exports.Rules$002EToken$$$Create$$Z27166B40 = Rules$002EToken$$$Create$$Z27166B40;
exports.Rules$002EDependency$reflection = Rules$002EDependency$reflection;
exports.Rules$002ERuleToken$reflection = Rules$002ERuleToken$reflection;
exports.Rules$002ERuleToken$$Signature = Rules$002ERuleToken$$Signature;
exports.Rules$002ESpecifierType$reflection = Rules$002ESpecifierType$reflection;
exports.Rules$002ERelationType$reflection = Rules$002ERelationType$reflection;
exports.Rules$002EProperty$reflection = Rules$002EProperty$reflection;
exports.Rules$002ERelation$reflection = Rules$002ERelation$reflection;
exports.Rules$002ERelation$$Signature = Rules$002ERelation$$Signature;
exports.Rules$$$spannedText = Rules$$$spannedText;
exports.Rules$$$governor = Rules$$$governor;
exports.Rules$$$dependenciesFromTokens = Rules$$$dependenciesFromTokens;
exports.Rules$$$doMatch = Rules$$$doMatch;
exports.Rules$$$propertyMatch = Rules$$$propertyMatch;
exports.Rules$002EModel$reflection = Rules$002EModel$reflection;
exports.Rules$002EModel$$$Create$$Z37302880 = Rules$002EModel$$$Create$$Z37302880;
exports.Rules$002EModel$$AddRuleToken$$7BB8F29B = Rules$002EModel$$AddRuleToken$$7BB8F29B;
exports.Rules$002ERule$reflection = Rules$002ERule$reflection;
exports.Rules$002ERule$$ResolvedRelationName$$Z711AA79F = Rules$002ERule$$ResolvedRelationName$$Z711AA79F;
exports.Rules$002EStage$reflection = Rules$002EStage$reflection;
exports.Collapser$$$getCandidatesAndIndices = Collapser$$$getCandidatesAndIndices;
exports.Collapser$$$createModels = Collapser$$$createModels;
exports.Collapser$$$selectDependenciesWithModels = Collapser$$$selectDependenciesWithModels;
exports.Collapser$$$StanfordFormat = Collapser$$$StanfordFormat;
exports.Collapser$$$CollapseTokens = Collapser$$$CollapseTokens;
exports.Rules$$$stageRuleList = exports.Rules$002EStage = exports.Rules$002ERule = exports.Rules$002EModel = exports.Rules$002ERelation = exports.Rules$002EProperty = exports.Rules$002ERelationType = exports.Rules$002ESpecifierType = exports.Rules$002ERuleToken = exports.Rules$002EDependency = exports.Rules$002EToken = void 0;

var _Util = require("./fable-library.2.10.2/Util");

var _Option = require("./fable-library.2.10.2/Option");

var _Types = require("./fable-library.2.10.2/Types");

var _Reflection = require("./fable-library.2.10.2/Reflection");

var _Seq = require("./fable-library.2.10.2/Seq");

var _List = require("./fable-library.2.10.2/List");

var _String = require("./fable-library.2.10.2/String");

var _RegExp = require("./fable-library.2.10.2/RegExp");

var _Map = require("./fable-library.2.10.2/Map");

var _Int = require("./fable-library.2.10.2/Int32");

var _Set = require("./fable-library.2.10.2/Set");

var _Array = require("./fable-library.2.10.2/Array");

function Rules$$$tryGetValue(collection, key) {
  const matchValue = (0, _Util.tryGetValue)(collection, key, null);

  if (matchValue[0]) {
    return (0, _Option.some)(matchValue[1]);
  } else {
    return undefined;
  }
}

function Rules$$$toLower(s) {
  return s.toLocaleLowerCase();
}

const Rules$002EToken = (0, _Types.declare)(function DependencyCollapser_Rules_Token(Index, Word, POS, Lemma, DependencyType, Head) {
  this.Index = Index | 0;
  this.Word = Word;
  this.POS = POS;
  this.Lemma = Lemma;
  this.DependencyType = DependencyType;
  this.Head = Head | 0;
}, _Types.Record);
exports.Rules$002EToken = Rules$002EToken;

function Rules$002EToken$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Token", [], Rules$002EToken, () => [["Index", _Reflection.int32_type], ["Word", _Reflection.string_type], ["POS", _Reflection.string_type], ["Lemma", _Reflection.string_type], ["DependencyType", _Reflection.string_type], ["Head", _Reflection.int32_type]]);
}

function Rules$002EToken$$$Create$$Z2BAB6A85(index, word, pos, depType, head) {
  return new Rules$002EToken(index, word, pos, word, depType, head);
}

function Rules$002EToken$$$Create$$Z27166B40(index$$1, word$$1, pos$$1, lemma, depType$$1, head$$1) {
  return new Rules$002EToken(index$$1, word$$1, pos$$1, lemma, depType$$1, head$$1);
}

const Rules$002EDependency = (0, _Types.declare)(function DependencyCollapser_Rules_Dependency(Type, Governor, Dependent) {
  this.Type = Type;
  this.Governor = Governor;
  this.Dependent = Dependent;
}, _Types.Record);
exports.Rules$002EDependency = Rules$002EDependency;

function Rules$002EDependency$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Dependency", [], Rules$002EDependency, () => [["Type", _Reflection.string_type], ["Governor", Rules$002EToken$reflection()], ["Dependent", Rules$002EToken$reflection()]]);
}

const Rules$002ERuleToken = (0, _Types.declare)(function DependencyCollapser_Rules_RuleToken(Index, Token, TargetIndex, TargetToken, DependencyType, Durable) {
  this.Index = Index | 0;
  this.Token = Token;
  this.TargetIndex = TargetIndex | 0;
  this.TargetToken = TargetToken;
  this.DependencyType = DependencyType;
  this.Durable = Durable;
}, _Types.Record);
exports.Rules$002ERuleToken = Rules$002ERuleToken;

function Rules$002ERuleToken$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.RuleToken", [], Rules$002ERuleToken, () => [["Index", _Reflection.int32_type], ["Token", Rules$002EToken$reflection()], ["TargetIndex", _Reflection.int32_type], ["TargetToken", Rules$002EToken$reflection()], ["DependencyType", _Reflection.string_type], ["Durable", _Reflection.bool_type]]);
}

function Rules$002ERuleToken$$Signature(this$) {
  const typeString = this$.Durable ? "d" : "r";
  return typeString + (0, _Util.int32ToString)(this$.Index) + "_" + (0, _Util.int32ToString)(this$.TargetIndex);
}

const Rules$002ESpecifierType = (0, _Types.declare)(function DependencyCollapser_Rules_SpecifierType(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Rules$002ESpecifierType = Rules$002ESpecifierType;

function Rules$002ESpecifierType$reflection() {
  return (0, _Reflection.union_type)("DependencyCollapser.Rules.SpecifierType", [], Rules$002ESpecifierType, () => ["Word", "POS", "Lemma"]);
}

const Rules$002ERelationType = (0, _Types.declare)(function DependencyCollapser_Rules_RelationType(tag, name, ...fields) {
  this.tag = tag | 0;
  this.name = name;
  this.fields = fields;
}, _Types.Union);
exports.Rules$002ERelationType = Rules$002ERelationType;

function Rules$002ERelationType$reflection() {
  return (0, _Reflection.union_type)("DependencyCollapser.Rules.RelationType", [], Rules$002ERelationType, () => ["Relation", "DurableRelation"]);
}

const Rules$002EProperty = (0, _Types.declare)(function DependencyCollapser_Rules_Property(Type, Reference, Regex) {
  this.Type = Type;
  this.Reference = Reference | 0;
  this.Regex = Regex;
}, _Types.Record);
exports.Rules$002EProperty = Rules$002EProperty;

function Rules$002EProperty$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Property", [], Rules$002EProperty, () => [["Type", Rules$002ESpecifierType$reflection()], ["Reference", _Reflection.int32_type], ["Regex", _Reflection.string_type]]);
}

const Rules$002ERelation = (0, _Types.declare)(function DependencyCollapser_Rules_Relation(Type, From, To, Regex) {
  this.Type = Type;
  this.From = From | 0;
  this.To = To | 0;
  this.Regex = Regex;
}, _Types.Record);
exports.Rules$002ERelation = Rules$002ERelation;

function Rules$002ERelation$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Relation", [], Rules$002ERelation, () => [["Type", Rules$002ERelationType$reflection()], ["From", _Reflection.int32_type], ["To", _Reflection.int32_type], ["Regex", _Reflection.string_type]]);
}

function Rules$002ERelation$$Signature(this$$$1) {
  const typeString$$1 = this$$$1.Type.tag === 1 ? "d" : "r";
  return typeString$$1 + (0, _Util.int32ToString)(this$$$1.From) + "_" + (0, _Util.int32ToString)(this$$$1.To);
}

function Rules$$$spannedText(token, tokens) {
  const frontier = new Set([]);
  const value = (0, _Util.addToSet)(token.Index + 1, frontier);
  void value;
  let notDone = true;

  while (notDone) {
    notDone = false;
    let inputSequence;
    inputSequence = Array.from(frontier);
    (0, _Seq.iterate)(function (f) {
      (0, _Seq.iterate)(function (t) {
        if (frontier.has(t.Head)) {
          notDone = (0, _Util.addToSet)(t.Index + 1, frontier);
        } else {
          void null;
        }
      }, tokens);
    }, inputSequence);
  }

  let strings;
  let source$$1;
  source$$1 = (0, _Seq.sortWith)(_Util.comparePrimitives, frontier);
  strings = (0, _Seq.map)(function mapping(f$$1) {
    return (0, _List.item)(f$$1 - 1, tokens).Word;
  }, source$$1);
  return (0, _String.join)(" ", strings);
}

function Rules$$$governor(tokens$$1, token$$1) {
  if (token$$1.Head > 0) {
    return (0, _List.item)(token$$1.Head - 1, tokens$$1);
  } else {
    return token$$1;
  }
}

function Rules$$$dependenciesFromTokens(tokens$$2) {
  return (0, _List.map)(function mapping$$1(token$$2) {
    let Governor;
    Governor = Rules$$$governor(tokens$$2, token$$2);
    return new Rules$002EDependency(token$$2.DependencyType, Governor, token$$2);
  }, tokens$$2);
}

function Rules$$$doMatch(retVal, pattern, input) {
  const m = (0, _RegExp.match)(input, pattern);

  if (m != null) {
    return (0, _Option.some)(retVal);
  } else {
    return undefined;
  }
}

function Rules$$$propertyMatch(property, token$$4) {
  if (property.Type.tag === 1) {
    return Rules$$$doMatch(token$$4.Word, property.Regex, token$$4.POS);
  } else if (property.Type.tag === 2) {
    return Rules$$$doMatch(token$$4.Lemma, property.Regex, token$$4.Lemma);
  } else {
    return Rules$$$doMatch(token$$4.Word, property.Regex, token$$4.Word);
  }
}

const Rules$002EModel = (0, _Types.declare)(function DependencyCollapser_Rules_Model(From, To, Tokens, Relations, AddedTokens) {
  this.From = From | 0;
  this.To = To | 0;
  this.Tokens = Tokens;
  this.Relations = Relations;
  this.AddedTokens = AddedTokens;
}, _Types.Record);
exports.Rules$002EModel = Rules$002EModel;

function Rules$002EModel$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Model", [], Rules$002EModel, () => [["From", _Reflection.int32_type], ["To", _Reflection.int32_type], ["Tokens", (0, _Reflection.class_type)("System.Collections.Generic.Dictionary`2", [_Reflection.int32_type, Rules$002EToken$reflection()])], ["Relations", (0, _Reflection.array_type)(Rules$002ERuleToken$reflection())], ["AddedTokens", (0, _Reflection.class_type)("System.Collections.Generic.HashSet`1", [_Reflection.string_type])]]);
}

function Rules$002EModel$$$Create$$Z37302880(from, To) {
  return new Rules$002EModel(from, To, new Map([]), [], new Set([]));
}

function Rules$002EModel$$AddRuleToken$$7BB8F29B(this$$$2, ruleToken) {
  var clo1;
  const matchValue$$3 = (0, _Util.addToSet)((clo1 = (0, _String.toText)((0, _String.printf)("%A")), clo1(ruleToken)), this$$$2.AddedTokens);

  if (matchValue$$3) {
    let newModel;
    const Tokens = new Map(this$$$2.Tokens);
    const Relations = Array.from(this$$$2.Relations);
    const AddedTokens = new Set(this$$$2.AddedTokens);
    newModel = new Rules$002EModel(this$$$2.From, this$$$2.To, Tokens, Relations, AddedTokens);
    const matchValue$$4 = [(0, _Util.tryGetValue)(this$$$2.Tokens, ruleToken.Index, null), (0, _Util.tryGetValue)(this$$$2.Tokens, ruleToken.TargetIndex, null)];
    var $target$$135;

    if (matchValue$$4[0][0]) {
      if (matchValue$$4[1][0]) {
        $target$$135 = 2;
      } else if ((0, _Util.equals)(matchValue$$4[0][1], ruleToken.Token)) {
        $target$$135 = 1;
      } else {
        $target$$135 = 2;
      }
    } else if (matchValue$$4[1][0]) {
      $target$$135 = 2;
    } else {
      $target$$135 = 0;
    }

    switch ($target$$135) {
      case 0:
        {
          (0, _Util.addToDict)(newModel.Tokens, ruleToken.Index, ruleToken.Token);
          (0, _Util.addToDict)(newModel.Tokens, ruleToken.TargetIndex, ruleToken.TargetToken);
          void newModel.Relations.push(ruleToken);
          return newModel;
        }

      case 1:
        {
          (0, _Util.addToDict)(newModel.Tokens, ruleToken.TargetIndex, ruleToken.TargetToken);
          void newModel.Relations.push(ruleToken);
          return newModel;
        }

      case 2:
        {
          var $target$$136;

          if (matchValue$$4[0][0]) {
            $target$$136 = 1;
          } else if (matchValue$$4[1][0]) {
            if ((0, _Util.equals)(matchValue$$4[1][1], ruleToken.TargetToken)) {
              $target$$136 = 0;
            } else {
              $target$$136 = 1;
            }
          } else {
            $target$$136 = 1;
          }

          switch ($target$$136) {
            case 0:
              {
                (0, _Util.addToDict)(newModel.Tokens, ruleToken.Index, ruleToken.Token);
                void newModel.Relations.push(ruleToken);
                return newModel;
              }

            case 1:
              {
                (0, _Seq.iterate)(function (relation) {
                  if ((0, _Util.equals)(relation, ruleToken)) {
                    void newModel.Relations.push(ruleToken);
                  } else {
                    void null;
                  }
                }, this$$$2.Relations);
                let newModelString;
                const clo1$$1 = (0, _String.toText)((0, _String.printf)("%A"));
                newModelString = clo1$$1(newModel);
                let thisString;
                const clo1$$2 = (0, _String.toText)((0, _String.printf)("%A"));
                thisString = clo1$$2(this$$$2);

                if (newModelString === thisString) {
                  return undefined;
                } else {
                  return newModel;
                }
              }
          }
        }
    }
  } else {
    return undefined;
  }
}

const Rules$002ERule = (0, _Types.declare)(function DependencyCollapser_Rules_Rule(Properties, Relations, From, To, RelationName) {
  this.Properties = Properties;
  this.Relations = Relations;
  this.From = From | 0;
  this.To = To | 0;
  this.RelationName = RelationName;
}, _Types.Record);
exports.Rules$002ERule = Rules$002ERule;

function Rules$002ERule$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Rule", [], Rules$002ERule, () => [["Properties", (0, _Reflection.class_type)("Microsoft.FSharp.Collections.FSharpMap`2", [_Reflection.int32_type, Rules$002EProperty$reflection()])], ["Relations", (0, _Reflection.list_type)(Rules$002ERelation$reflection())], ["From", _Reflection.int32_type], ["To", _Reflection.int32_type], ["RelationName", _Reflection.string_type]]);
}

function Rules$002ERule$$ResolvedRelationName$$Z711AA79F(this$$$3, model) {
  const matchDictionary = new Map([]);
  let list$$1;
  list$$1 = (0, _Map.toList)(this$$$3.Properties);
  (0, _List.iterate)(function action(tupledArg) {
    var clo1$$3;
    let matchValue$$5;
    const token$$10 = (0, _Util.getItemFromDict)(model.Tokens, tupledArg[0]);
    matchValue$$5 = Rules$$$propertyMatch(tupledArg[1], token$$10);

    if (matchValue$$5 == null) {
      void null;
    } else {
      const matchedWords = matchValue$$5;
      (0, _Util.addToDict)(matchDictionary, (clo1$$3 = (0, _String.toText)((0, _String.printf)("%A")), clo1$$3(tupledArg[1])), matchedWords);
    }
  }, list$$1);
  (0, _List.iterate)(function action$$2(relation$$1) {
    (0, _Seq.iterate)(function action$$1(ruleToken$$1) {
      var clo1$$4;

      if (Rules$002ERelation$$Signature(relation$$1) === Rules$002ERuleToken$$Signature(ruleToken$$1)) {
        let matchValue$$6;
        matchValue$$6 = Rules$$$doMatch(ruleToken$$1.DependencyType, relation$$1.Regex, ruleToken$$1.DependencyType);

        if (matchValue$$6 == null) {
          void null;
        } else {
          const matchedWords$$1 = matchValue$$6;
          (0, _Util.addToDict)(matchDictionary, (clo1$$4 = (0, _String.toText)((0, _String.printf)("%A")), clo1$$4(relation$$1)), matchedWords$$1);
        }
      } else {
        void null;
      }

      void null;
    }, model.Relations);
  }, this$$$3.Relations);
  let retVal$$4 = this$$$3.RelationName;
  const regex = (0, _RegExp.create)("\\{(\\w+)\\}");
  let source$$5;
  let source$$4;
  const source$$3 = (0, _RegExp.matches)(regex, this$$$3.RelationName);
  source$$4 = source$$3;
  source$$5 = (0, _Seq.choose)(function chooser(m$$1) {
    var arg00$$1;
    const id = m$$1[1] || "";

    if (id.indexOf("r") === 0 ? true : id.indexOf("d") === 0) {
      let matchValue$$7;
      matchValue$$7 = (0, _List.tryFind)(function predicate(relation$$2) {
        return id === Rules$002ERelation$$Signature(relation$$2);
      }, this$$$3.Relations);

      if (matchValue$$7 == null) {
        return undefined;
      } else {
        const r = matchValue$$7;
        let key$$1;
        const clo1$$5 = (0, _String.toText)((0, _String.printf)("%A"));
        key$$1 = clo1$$5(r);
        return Rules$$$tryGetValue(matchDictionary, key$$1);
      }
    } else {
      let key$$2;
      const arg10$$6 = (0, _Map.FSharpMap$$get_Item$$2B595)(this$$$3.Properties, (arg00$$1 = (0, _String.substring)(id, 1), ((0, _Int.parse)(arg00$$1, 511, false, 32))));
      const clo1$$6 = (0, _String.toText)((0, _String.printf)("%A"));
      key$$2 = clo1$$6(arg10$$6);
      return Rules$$$tryGetValue(matchDictionary, key$$2);
    }
  }, source$$4);
  (0, _Seq.iterate)(function action$$3(s$$1) {
    retVal$$4 = (0, _RegExp.replace)(regex, retVal$$4, s$$1, 1);
  }, source$$5);
  const s$$2 = retVal$$4;
  return Rules$$$toLower(s$$2);
}

const Rules$002EStage = (0, _Types.declare)(function DependencyCollapser_Rules_Stage(Id, Rules) {
  this.Id = Id | 0;
  this.Rules = Rules;
}, _Types.Record);
exports.Rules$002EStage = Rules$002EStage;

function Rules$002EStage$reflection() {
  return (0, _Reflection.record_type)("DependencyCollapser.Rules.Stage", [], Rules$002EStage, () => [["Id", _Reflection.int32_type], ["Rules", (0, _Reflection.list_type)(Rules$002ERule$reflection())]]);
}

const Rules$$$stageRuleList = (0, _List.ofArray)([new Rules$002EStage(1, (0, _List.ofArray)([new Rules$002ERule((() => {
  const elements = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep")]), 1, 3, "prep"), new Rules$002ERule((() => {
  const elements$$1 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, "well")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "as")]]);
  return (0, _Map.ofList)(elements$$1, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, ".*"), new _Types.List()), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$2 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$2, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "xcomp"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "ccomp")]), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$3 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$3, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "conj")]), 1, 3, "conj"), new Rules$002ERule((() => {
  const elements$$4 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$4, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "conj")]), 1, 3, "prep"), new Rules$002ERule((() => {
  const elements$$5 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$5, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "cc"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "mwe")]), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$6 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 2, "IN|TO|VBG")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$6, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "pobj"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 4, "mwe")]), 1, 4, "mwe_helper"), new Rules$002ERule((() => {
  const elements$$7 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$7, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "parataxis"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "^(?!parataxis|tmod$).*")]), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$8 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$8, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "tmod"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "parataxis")]), 1, 2, "void")])), new Rules$002EStage(2, (0, _List.ofArray)([new Rules$002ERule((() => {
  const elements$$9 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "next")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, "to")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$9, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, ".*"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, ".*"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 3, 4, "pobj")]), 1, 4, "prep_{w2}_to"), new Rules$002ERule((() => {
  const elements$$10 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 2, "IN|TO|VBG")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$10, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "pobj")]), 1, 3, "prep_{w2}"), new Rules$002ERule((() => {
  const elements$$11 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "as")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, "such")]]);
  return (0, _Map.ofList)(elements$$11, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pobj"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 4, "mwe")]), 1, 3, "prep_such_as"), new Rules$002ERule((() => {
  const elements$$12 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 2, "IN|TO")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$12, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pobj"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 4, "punct")]), 1, 4, "punct"), new Rules$002ERule((() => {
  const elements$$13 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 2, "IN|TO")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$13, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pcomp")]), 1, 3, "prepc_{w2}"), new Rules$002ERule((() => {
  const elements$$14 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "and|or|but|nor|in|only|as|at|vs\\.|&|versus|and/or")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$14, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "cc"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "conj")]), 1, 3, "conj_{w2}"), new Rules$002ERule((() => {
  const elements$$15 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "not|instead|rather")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$15, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "cc"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "conj")]), 1, 3, "conj_negcc"), new Rules$002ERule((() => {
  const elements$$16 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$16, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "xsubj|ref|possessive"), new _Types.List()), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$17 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$17, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "advmod")]), 1, 3, "advmod"), new Rules$002ERule((() => {
  const elements$$18 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$18, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "dep")]), 1, 3, "dep"), new Rules$002ERule((() => {
  const elements$$19 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, "to")]]);
  return (0, _Map.ofList)(elements$$19, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pcomp")]), 1, 3, "prepc_{w2}_{w3}")])), new Rules$002EStage(3, (0, _List.ofArray)([new Rules$002ERule((() => {
  const elements$$20 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "such")]]);
  return (0, _Map.ofList)(elements$$20, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_as"), new _Types.List()), 1, 2, "prep_such_as"), new Rules$002ERule((() => {
  const elements$$21 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$21, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_[^_]+"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep_[^_]+_.+")]), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$22 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")]]);
  return (0, _Map.ofList)(elements$$22, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "conj_&"), new _Types.List()), 1, 2, "conj_and"), new Rules$002ERule((() => {
  const elements$$23 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$23, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "conj_and"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "pobj"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 3, 4, "pobj")]), 2, 4, "conj_and"), new Rules$002ERule((() => {
  const elements$$24 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 2, "IN|TO|VBG")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$24, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pobj")]), 1, 3, "void"), new Rules$002ERule((() => {
  const elements$$25 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$25, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "advmod")]), 1, 3, "void"), new Rules$002ERule((() => {
  const elements$$26 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "to|of|with")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$26, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep[c]?_.+"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pobj")]), 1, 3, "pobj"), new Rules$002ERule((() => {
  const elements$$27 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$27, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "cc"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 3, "conj_and")]), 1, 2, "void"), new Rules$002ERule((() => {
  const elements$$28 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(1, "POS"), 1, "CD")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$28, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "advmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "prep_of")]), 1, 3, "prep_{w2}_of"), new Rules$002ERule((() => {
  const elements$$29 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$29, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "advmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prepc_of")]), 1, 3, "prepc_{w2}_of"), new Rules$002ERule((() => {
  const elements$$30 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$30, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "advmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "prep_to")]), 1, 3, "prep_{w2}_to"), new Rules$002ERule((() => {
  const elements$$31 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$31, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "advmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_to")]), 1, 3, "prep_{w2}_to"), new Rules$002ERule((() => {
  const elements$$32 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "[aA]ccording|[dD]ue")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$32, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, ".*"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_to")]), 1, 3, "prep_{w2}_to"), new Rules$002ERule((() => {
  const elements$$33 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "addition")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$33, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_in"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_to")]), 1, 3, "prep_in_addition_to"), new Rules$002ERule((() => {
  const elements$$34 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "addition")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$34, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_in"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_of")]), 1, 3, "prep_in_front_of"), new Rules$002ERule((() => {
  const elements$$35 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "[aA]long|[tT]ogether")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$35, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "advmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_with")]), 1, 3, "prep_{w2}_with"), new Rules$002ERule((() => {
  const elements$$36 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "with")]]);
  return (0, _Map.ofList)(elements$$36, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prepc_along|prepc_together"), new _Types.List()), 1, 2, "{r1_2}_with"), new Rules$002ERule((() => {
  const elements$$37 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "out|off")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$37, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prt"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 3, "prep_of")]), 1, 3, "prep_{w2}_of"), new Rules$002ERule((() => {
  const elements$$38 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, "of")]]);
  return (0, _Map.ofList)(elements$$38, {
    Compare: _Util.comparePrimitives
  });
})(), new _Types.List(new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prepc_as|prepc_out"), new _Types.List()), 1, 2, "{r1_2}_of"), new Rules$002ERule((() => {
  const elements$$39 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, "of|to")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$39, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_of|prep_to"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 4, "mwe_helper"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 3, 4, "mwe")]), 1, 2, "prep_{w4}_{w3}"), new Rules$002ERule((() => {
  const elements$$40 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$40, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prepc_.*"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "pcomp")]), 1, 3, "pcomp"), new Rules$002ERule((() => {
  const elements$$41 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$41, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep[c]?_by"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 3, "auxpass")]), 1, 2, "agent"), new Rules$002ERule((() => {
  const elements$$42 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$42, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "vmod"), new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 2, 3, "prep_by")]), 2, 3, "agent"), new Rules$002ERule((() => {
  const elements$$43 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, "[fF]rom")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")], [4, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 4, ".*")]]);
  return (0, _Map.ofList)(elements$$43, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(0, "Relation"), 1, 2, "prep_to"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 3, 4, "prep_from")]), 3, 2, "prep_to")])), new Rules$002EStage(4, (0, _List.ofArray)([new Rules$002ERule((() => {
  const elements$$44 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$44, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "dobj|nsubj"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "conj.*")]), 1, 3, "{d1_2}"), new Rules$002ERule((() => {
  const elements$$45 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$45, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "prep.*"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "conj.*")]), 1, 3, "{d1_2}"), new Rules$002ERule((() => {
  const elements$$46 = (0, _List.ofArray)([[1, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 1, ".*")], [2, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 2, ".*")], [3, new Rules$002EProperty(new Rules$002ESpecifierType(0, "Word"), 3, ".*")]]);
  return (0, _Map.ofList)(elements$$46, {
    Compare: _Util.comparePrimitives
  });
})(), (0, _List.ofArray)([new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 1, 2, "nsubj"), new Rules$002ERelation(new Rules$002ERelationType(1, "DurableRelation"), 2, 3, "conj.*")]), 3, 2, "{d1_2}")]))]);
exports.Rules$$$stageRuleList = Rules$$$stageRuleList;

function Collapser$$$getCandidatesAndIndices(rule, dependencies) {
  let candidates;
  candidates = (0, _List.map)(function mapping$$2(relation$$3) {
    let source$$7;
    source$$7 = (0, _Seq.choose)(function chooser$$1(dep) {
      return Rules$$$doMatch(dep, relation$$3.Regex, dep.Type);
    }, dependencies);
    return (0, _List.ofSeq)(source$$7);
  }, rule.Relations);
  const confirmedCandidates = [];
  const ruleTokens = new Map([]);
  const targetRuleTokens = new Map([]);

  for (let i$$1 = 0; i$$1 <= (0, _List.length)(candidates) - 1; i$$1++) {
    void confirmedCandidates.push([]);
    const inputSequence$$2 = (0, _List.item)(i$$1, candidates);
    (0, _Seq.iterate)(function (dep$$1) {
      var value$$1, value$$2;
      const patternInput = [(0, _List.item)(i$$1, rule.Relations).From, (0, _List.item)(i$$1, rule.Relations).To];
      let headMatch;
      const property$$2 = (0, _Map.FSharpMap$$get_Item$$2B595)(rule.Properties, patternInput[0]);
      headMatch = Rules$$$propertyMatch(property$$2, dep$$1.Governor);
      let dependentMatch;
      const property$$3 = (0, _Map.FSharpMap$$get_Item$$2B595)(rule.Properties, patternInput[1]);
      dependentMatch = Rules$$$propertyMatch(property$$3, dep$$1.Dependent);
      let relationMatch;
      const pattern$$6 = (0, _List.item)(i$$1, rule.Relations).Regex;
      relationMatch = Rules$$$doMatch(null, pattern$$6, dep$$1.Type);
      var $target$$149;

      if (headMatch != null) {
        if (dependentMatch != null) {
          if (relationMatch != null) {
            $target$$149 = 0;
          } else {
            $target$$149 = 1;
          }
        } else {
          $target$$149 = 1;
        }
      } else {
        $target$$149 = 1;
      }

      switch ($target$$149) {
        case 0:
          {
            void confirmedCandidates[i$$1].push(dep$$1);

            if (value$$1 = ruleTokens.has(patternInput[0]), (!value$$1)) {
              (0, _Util.addToDict)(ruleTokens, patternInput[0], []);
            } else {
              void null;
            }

            if (value$$2 = targetRuleTokens.has(patternInput[1]), (!value$$2)) {
              (0, _Util.addToDict)(targetRuleTokens, patternInput[1], []);
            } else {
              void null;
            }

            const ruleToken$$2 = new Rules$002ERuleToken(patternInput[0], dep$$1.Governor, patternInput[1], dep$$1.Dependent, dep$$1.Type, (0, _Util.equals)((0, _List.item)(i$$1, rule.Relations).Type, new Rules$002ERelationType(1, "DurableRelation")));
            void (0, _Util.getItemFromDict)(ruleTokens, patternInput[0]).push(ruleToken$$2);
            void (0, _Util.getItemFromDict)(targetRuleTokens, patternInput[1]).push(ruleToken$$2);
            break;
          }

        case 1:
          {
            void null;
            break;
          }
      }
    }, inputSequence$$2);
    void null;
  }

  void null;
  return [confirmedCandidates, ruleTokens, targetRuleTokens];
}

function Collapser$$$createModels(rule$$1, ruleTokens$$1, targetRuleTokens$$1) {
  const models = [];
  void models.push(Rules$002EModel$$$Create$$Z37302880(rule$$1.From, rule$$1.To));

  for (let x = 0; x <= (0, _Map.FSharpMap$$get_Count)(rule$$1.Properties) - 1; x++) {
    (0, _Seq.iterate)(function (relation$$4) {
      if ((0, _Util.getItemFromDict)(ruleTokens$$1, relation$$4.From).length > 0 ? (0, _Util.getItemFromDict)(targetRuleTokens$$1, relation$$4.To).length > 0 : false) {
        const inputSequence$$4 = (0, _Util.getItemFromDict)(ruleTokens$$1, relation$$4.From);
        (0, _Seq.iterate)(function (fromRuleToken) {
          const modelCount = models.length - 1 | 0;

          for (let i$$2 = 0; i$$2 <= modelCount; i$$2++) {
            const matchValue$$9 = Rules$002EModel$$AddRuleToken$$7BB8F29B(models[i$$2], fromRuleToken);

            if (matchValue$$9 == null) {
              void null;
            } else {
              const model$$1 = matchValue$$9;
              void models.push(model$$1);
            }
          }
        }, inputSequence$$4);
      } else {
        void null;
      }
    }, rule$$1.Relations);
    void null;
  }

  void null;
  return models;
}

function Collapser$$$selectDependenciesWithModels(rule$$2, models$$1, dependenciesToRemove, dependenciesToAdd) {
  const keys = new Set([]);
  (0, _Seq.iterate)(function (model$$2) {
    const matchValue$$10 = [(0, _Util.tryGetValue)(model$$2.Tokens, rule$$2.From, null), (0, _Util.tryGetValue)(model$$2.Tokens, rule$$2.To, null)];
    var $target$$157;

    if (matchValue$$10[0][0]) {
      if (matchValue$$10[1][0]) {
        $target$$157 = 0;
      } else {
        $target$$157 = 1;
      }
    } else {
      $target$$157 = 1;
    }

    switch ($target$$157) {
      case 0:
        {
          let modelIsValid;
          modelIsValid = (0, _List.forAll)(function predicate$$2(relation$$5) {
            if (model$$2.Tokens.has(relation$$5.From) ? model$$2.Tokens.has(relation$$5.To) : false) {
              return (0, _Seq.exists)(function predicate$$1(ruleToken$$3) {
                if (ruleToken$$3.Index === relation$$5.From ? ruleToken$$3.TargetIndex === relation$$5.To : false) {
                  return (Rules$$$doMatch(null, relation$$5.Regex, ruleToken$$3.DependencyType)) != null;
                } else {
                  return false;
                }
              }, model$$2.Relations);
            } else {
              return false;
            }
          }, rule$$2.Relations);

          if (modelIsValid) {
            const dependencyType$$1 = Rules$002ERule$$ResolvedRelationName$$Z711AA79F(rule$$2, model$$2);
            const key$$3 = (0, _Util.int32ToString)(matchValue$$10[0][1].Index) + "|" + (0, _Util.int32ToString)(matchValue$$10[1][1].Index) + "|" + dependencyType$$1;

            if ((0, _Util.addToSet)(key$$3, keys)) {
              let source$$10;
              source$$10 = (0, _Seq.filter)(function predicate$$3(rt) {
                return !rt.Durable;
              }, model$$2.Relations);
              (0, _Seq.iterate)(function action$$4(rt$$1) {
                const value$$4 = (0, _Util.addToSet)([rt$$1.Token, rt$$1.TargetToken], dependenciesToRemove);
                void value$$4;
              }, source$$10);

              if (dependencyType$$1 !== "void") {
                const value$$5 = (0, _Util.addToSet)(new Rules$002EDependency(dependencyType$$1, matchValue$$10[0][1], matchValue$$10[1][1]), dependenciesToAdd);
                void value$$5;
              } else {
                void null;
              }
            } else {
              void null;
            }
          } else {
            void null;
          }

          break;
        }

      case 1:
        {
          void null;
          break;
        }
    }
  }, models$$1);
}

function Collapser$$$StanfordFormat(dependency) {
  var copyOfStruct, copyOfStruct$$1;
  const governorString = dependency.Type === "root" ? "ROOT-0" : dependency.Governor.Word + "-" + (copyOfStruct = dependency.Governor.Index + 1 | 0, (0, _Util.int32ToString)(copyOfStruct));
  const dependentString = dependency.Dependent.Word + "-" + (copyOfStruct$$1 = dependency.Dependent.Index + 1 | 0, (0, _Util.int32ToString)(copyOfStruct$$1));
  return dependency.Type + "(" + governorString + ", " + dependentString + ")";
}

function Collapser$$$CollapseTokens(tokens$$3) {
  var projection;
  let dependencies$$1;
  let arg00$$2;
  arg00$$2 = Rules$$$dependenciesFromTokens(tokens$$3);
  dependencies$$1 = Array.from(arg00$$2);
  (0, _Seq.iterate)(function (stage) {
    const dependenciesToRemove$$1 = (0, _Set.createMutable)([], {
      Equals: _Util.equalArrays,
      GetHashCode: _Util.structuralHash
    });
    const dependenciesToAdd$$1 = (0, _Set.createMutable)([], {
      Equals: _Util.equals,
      GetHashCode: _Util.structuralHash
    });
    (0, _Seq.iterate)(function (rule$$3) {
      const patternInput$$1 = Collapser$$$getCandidatesAndIndices(rule$$3, dependencies$$1);

      if ((0, _Seq.forAll)(function predicate$$4(depList) {
        return depList.length > 0;
      }, patternInput$$1[0])) {
        const models$$2 = Collapser$$$createModels(rule$$3, patternInput$$1[1], patternInput$$1[2]);
        Collapser$$$selectDependenciesWithModels(rule$$3, models$$2, dependenciesToRemove$$1, dependenciesToAdd$$1);
      } else {
        void null;
      }
    }, stage.Rules);
    let list$$6;
    list$$6 = (0, _List.ofSeq)(dependencies$$1);
    (0, _List.iterate)(function action$$5(dep$$2) {
      if (dependenciesToRemove$$1.has([dep$$2.Governor, dep$$2.Dependent])) {
        const value$$6 = (0, _Array.removeInPlace)(dep$$2, dependencies$$1);
        void value$$6;
      } else {
        void null;
      }
    }, list$$6);
    (0, _Array.addRangeInPlace)(dependenciesToAdd$$1, dependencies$$1);
  }, Rules$$$stageRuleList);
  return [(Rules$$$dependenciesFromTokens(tokens$$3)), (projection = function projection(dep$$3) {
    return dep$$3.Dependent.Index * 10 + dep$$3.Governor.Index;
  }, (0, _Seq.sortWith)(function ($x$$101, $y$$102) {
    return (0, _Util.comparePrimitives)(projection($x$$101), projection($y$$102));
  }, dependencies$$1))];
}