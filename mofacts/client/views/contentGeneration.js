Session.set("curClozeSentencePairItemId", "");
Session.set("clozeSentencePairs", {});
Session.set("clozeHistory", []);
Session.set("editingSentence",{});
Session.set("editingCloze",{});
sentenceIDtoSentenceMap = {};
sentenceIDtoClozesMap = {};
clozeIDToClozeMap = {};
tdfFileNameToStimfileMap = {};
tdfFileNameToTdfFileMap = {};
speechAPIKey = undefined;
textToSpeechAPIKey = undefined;
originalClozes = undefined;
clozeEdits = [];
dropDownTdfFileNames = ['Chapter_9_Template_andrew.tackett_2019_10_10T22_49_09_052Z_TDF.xml',
                        'Chapter_10_Template_andrew.tackett_2019_10_10T22_15_20_268Z_TDF.xml',
                        'Chapter_11_Template_andrew.tackett_2019_10_10T22_16_29_616Z_TDF.xml'];

recordClozeEditHistory = function(oldCloze,newCloze){
  var timestamp = Date.now();
  console.log(new Date(timestamp).toString() + ":" + JSON.stringify(oldCloze) + "|" + JSON.stringify(newCloze));
  clozeEdits.push({startingCloze:oldCloze,endingCloze:newCloze,timestamp:timestamp});
}

setAllTdfs = function(){
  console.log("setAllTdfs");
  allTdfs = [];
  Meteor.subscribe('tdfs',function(){
    Tdfs.find({}).forEach(function(entry){
      try{
        var fileName = entry.fileName;
        if(dropDownTdfFileNames.includes(fileName)){
          var displayName = entry.tdfs.tutor.setspec[0].lessonname[0];
          var stimulusFile = entry.tdfs.tutor.setspec[0].stimulusfile[0];

          var stimulusObject = Stimuli.findOne({"fileName":stimulusFile})
          var containsClozes = (_.filter(stimulusObject.stimuli.setspec.clusters[0].cluster,function(cluster){
            return !!cluster.displayType && cluster.displayType.length > 0 && cluster.displayType[0].toLowerCase() === "cloze";
          })).length > 0;

          if(containsClozes){
            allTdfs.push({'fileName':fileName,'displayName':displayName});
            tdfFileNameToTdfFileMap[fileName] = entry;
            tdfFileNameToStimfileMap[fileName] = stimulusObject;
          }
        }
      }catch(err){
        console.log("error with setting all tdfs: " + JSON.stringify(err));
      }
    });

    Session.set('contentGenerationAllTdfs',allTdfs);
  });
}

setClozesFromStimObject = function(stimObject){
  var allClozes = [];
  var allClusters = stimObject.stimuli.setspec.clusters[0].cluster;
  for(var index in allClusters){
    var cluster = allClusters[index];
    var fakeSentenceId = _.random(-9999999999,9999999999);
    for(var index2 in cluster.display){
      var clozeText = cluster.display[index2];
      var clozeResponse = cluster.response[index2];
      var clozeId = _.random(-9999999999,9999999999);
      allClozes.push({
        cloze:clozeText,
        correctResponse:clozeResponse,
        clozeId:clozeId,
        itemId:fakeSentenceId
      })
    }
  }
  Session.set("clozeSentencePairs", {
    "sentences":[],
    "clozes":allClozes
  });
  originalClozes = allClozes;
  fillOutItemLookupMaps([],allClozes);
}

fillOutItemLookupMaps = function(sentences,clozes){
  sentenceIDtoSentenceMap = {};
  clozeIDToClozeMap = {};
  sentenceIDtoClozesMap = {};

  for(var sentenceIndex in sentences){
    var sentence = sentences[sentenceIndex];
    var sentenceID = parseInt(sentence.itemId);
    sentenceIDtoSentenceMap[sentenceID] = sentence;
  }

  _.map(clozes,function(cloze){
      clozeIDToClozeMap[cloze.clozeId] = cloze;
      var sentenceID = cloze.itemId;
      if(!sentenceIDtoClozesMap[sentenceID]){
        sentenceIDtoClozesMap[sentenceID] = [];
      }
      sentenceIDtoClozesMap[sentenceID].push(cloze);
  });
}

stubGenerateContent = function(textData){
  var sentences = serverStubContent.sentences;

  var clozes = serverStubContent.clozes;

  Session.set("clozeSentencePairs", {
    "sentences":sentences,
    "clozes":clozes
  });

  fillOutItemLookupMaps(sentences,clozes);
}

saveEditHistory = function(originalClozes,newClozes){
  var history = {
    originalClozes:originalClozes,
    endingClozes:newClozes,
    clozeEdits:clozeEdits,
    user:Meteor.userId(),
    timestamp:Date.now()
  };
  Meteor.call('insertClozeEditHistory',history,function(err,result){
    if(!!err){
      console.log("error saving cloze edit history: " + JSON.stringify(err));
    }else{
      console.log("saving cloze edit history results: " + JSON.stringify(result));
    }
  });

  clozeEdits = [];
}

generateAndSubmitTDFAndStimFiles = function(){
  var clozes = Session.get('clozeSentencePairs').clozes;
  console.log('Generating TDF with clozes: ' + JSON.stringify(clozes));
  var displayName = $("#tdfDisplayNameTextBox").val();
  var curUserName = Meteor.user().username.split('@')[0].replace(/[.]/g,"_");
  var curDateTime = new Date().toISOString().replace(/-/g,'_').replace(/:/g,'_').replace(/[.]/g,'_');
  var tdfFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_TDF.xml";
  var stimFileName = displayName.replace(/ /g,"_") + "_" + curUserName + "_" + curDateTime + "_Stim.xml";

  var newStimJSON = generateStimJSON(clozes,stimFileName);
  var numClusters = newStimJSON.stimuli.setspec.clusters[0].cluster.length;
  var newTDFJSON = generateTDFJSON(tdfFileName,displayName,stimFileName,numClusters);

  Meteor.call("insertStimTDFPair",newStimJSON,newTDFJSON,function(err,res){
    if(!!err){
      console.log("Error inserting stim/tdf pair: " + err);
      alert("Error creating content: " + err);
    }else{
      console.log("Inserting stim/tdf pair result: " + res);
      saveEditHistory(originalClozes,clozes);
      //Update session variable used in tdfAssignmentEdit so that we can assign a tdf immediately after generation without reloading the page
      Session.set("allTdfFilenamesAndDisplayNames",Session.get("allTdfFilenamesAndDisplayNames").concat({fileName:tdfFileName,displayName:displayName}));
      Session.set("allTdfs",Session.get("allTdfs").concat(newTDFJSON));
      alert("Saved Successfully!");
      $("#tdfDisplayNameTextBox").val("");
      $("#save-modal").modal('hide');
    }
  });
  console.log("newStimJSON: " + JSON.stringify(newStimJSON));
  console.log("newTDFJSON: " + JSON.stringify(newTDFJSON));
}

generateStimJSON = function(clozes,stimFileName){
  var curStim = JSON.parse(JSON.stringify(templateStimJSON));
  curStim.fileName = stimFileName;
  curStim.owner = Meteor.userId();
  var completedSentenceIDs = {};
  for(var index in clozes){
    var sentenceID = clozes[index].itemId;
    if(!completedSentenceIDs[sentenceID]){
      var cluster = {displayType:["Cloze"],display:[],response:[],parameter:[]};
      var curSentenceClozes = sentenceIDtoClozesMap[sentenceID];
      for(var index2 in curSentenceClozes){
        var cloze = curSentenceClozes[index2];
        cluster.parameter.push("0,.72");
        cluster.display.push(cloze.cloze);
        cluster.response.push(cloze.correctResponse);
      }
      curStim.stimuli.setspec.clusters[0].cluster.push(cluster);
      completedSentenceIDs[sentenceID] = true;
    }
  }

  return curStim;
}

generateTDFJSON = function(tdfFileName,displayName,stimFileName,numStimClozes){
  var tdfTemplateFileName = $("#templateTDFSelect").val();
  var originalTDF = tdfFileNameToTdfFileMap[tdfTemplateFileName];
  var curTdf = originalTDF || JSON.parse(JSON.stringify(templateTdfJSON));

  delete curTdf._id;
  curTdf.owner = Meteor.userId();
  curTdf.fileName = tdfFileName;
  curTdf.source = "content_generation";
  curTdf.tdfs.tutor.setspec[0].lessonname = [displayName];
  curTdf.tdfs.tutor.setspec[0].stimulusfile = [stimFileName];
  curTdf.tdfs.tutor.unit[0].learningsession[0].clusterlist = ["0-"+(numStimClozes-1)];
  curTdf.tdfs.tutor.setspec[0].speechAPIKey = [speechAPIKey];
  curTdf.tdfs.tutor.setspec[0].textToSpeechAPIKey = [textToSpeechAPIKey];

  return curTdf;
}

Template.contentGeneration.onRendered(function(){
  console.log("contentGeneration rendered");
  setAllTdfs();
});

Template.contentGeneration.events({
  'click #cloze': function(event){
    var cloze_uid = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", cloze_uid);
    var parsedSentencesMatchingSentence = $("#parsed-sentences").find("[uid=" + cloze_uid + "]").get(0);
    if(!!parsedSentencesMatchingSentence){
      parsedSentencesMatchingSentence.scrollIntoView();
    }
  },

  'click .sentence-with-cloze': function(event){
    var sentence_uid = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", sentence_uid);
    $("#extracted-clozes").find("[uid=" + sentence_uid + "]").get(0).scrollIntoView();
  },

  'click #submit-btn': function(event){
    alert("This feature is not yet implemented.  Please choose a template file.");
    originalClozes = undefined;
    clozeEdits = [];
    // stubGenerateContent();
    // $("#templateTDFSelect").val($("#templateTDFSelect option:first").val());
  },

  'click #editClozeSaveButton': function(event){
    console.log(event);
    var newCloze = $("#clozeTextEdit").val();
    var response = $("#clozeResponseEdit").val();
    var editingCloze = Session.get("editingCloze");

    var sentenceID = editingCloze.itemId;
    var clozeID = editingCloze.clozeId;
    if(newCloze.indexOf("_") == -1){
      alert("Please make sure to insert underscores to indicate a missing word.");
    }else if (response.length < 1) {
      alert("Please enter a correct response");
    }else{
      var oldCloze = clozeIDToClozeMap[clozeID];
      var newCloze = {cloze:newCloze,correctResponse:response,itemId:sentenceID,clozeId:clozeID};
      recordClozeEditHistory(oldCloze,newCloze);
      var clozeSentencePairs = Session.get('clozeSentencePairs');
      var clozes = clozeSentencePairs.clozes;
      var clozesWithNew = [];
      for(var clozeIndex in clozes){
        var cloze = clozes[clozeIndex];
        if(cloze.clozeId === clozeID){
          clozesWithNew.push(newCloze);
        }else{
          clozesWithNew.push(cloze);
        }
      }

      clozeSentencePairs.clozes = clozesWithNew;
      Session.set("clozeSentencePairs",clozeSentencePairs);
      clozeIDToClozeMap[clozeID] = newCloze;
      $('#edit-modal').modal('hide');
      $("#clozeResponseEdit").val("");
    }
  },

  'click #save-btn-final': function(event){
    generateAndSubmitTDFAndStimFiles();
  },

  'click #save-btn': function(event){
    $('#save-modal').modal('show');
  },

  'click #edit-btn': function(event){
    var cloze_uid = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    var curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    Session.set("curClozeSentencePairItemId", curItemId);
    Session.set("editingClozeUID",cloze_uid);

    var curCloze = clozeIDToClozeMap[cloze_uid];
    var curSentence = sentenceIDtoSentenceMap[curItemId];
    Session.set("editingCloze",curCloze);
    if(!!curSentence){
      Session.set("editingSentence",curSentence);
    }else{
      $("#clozeTextEdit").val("");
      Session.set("editingSentence",{});
    }
    $('#edit-modal').modal('show');
  },

  'click #delete-btn': function(event){
    var curClozeId = parseInt(event.currentTarget.getAttribute('cloze-uid'));
    var curItemId = parseInt(event.currentTarget.getAttribute('uid'));
    var prevClozeSentencePairs = Session.get("clozeSentencePairs");

    var oldCloze = clozeIDToClozeMap[curClozeId];
    recordClozeEditHistory(oldCloze,{});

    var newClozes = _.filter(prevClozeSentencePairs.clozes, function(c) {return c.clozeId != curClozeId});
    var newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
      if(s.itemId === curItemId) {
        var matchingClozes = _.filter(newClozes, function(c) {
          return c.itemId === s.itemId;
        });
        if(matchingClozes.length == 0) s.hasCloze = false;
        return s;
      } else {
        return s;
      }
    });
    Session.set('clozeSentencePairs', {
      'sentences':newSentences,
      'clozes':newClozes
    });
  },

  "change #templateTDFSelect": function(event){
    var curTdfFileName = $(event.currentTarget).val();
    var stimObject = tdfFileNameToStimfileMap[curTdfFileName];
    var tdfObject = tdfFileNameToTdfFileMap[curTdfFileName];
    if(!!tdfObject.tdfs.tutor.setspec[0].speechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0]){
      speechAPIKey = tdfObject.tdfs.tutor.setspec[0].speechAPIKey[0];
    }else{
      speechAPIKey = null;
    }
    if(!!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey && !!tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0]){
      textToSpeechAPIKey = tdfObject.tdfs.tutor.setspec[0].textToSpeechAPIKey[0];
    }else{
      textToSpeechAPIKey = null;
    }
    setClozesFromStimObject(stimObject);
    clozeEdits = [];
  }
});

Template.contentGeneration.helpers({
  sentences: function() {
    return Session.get("clozeSentencePairs").sentences;
  },

  clozes: function() {
    return Session.get("clozeSentencePairs").clozes;
  },

  isCurrentPair: function(itemId) {
    return itemId === Session.get("curClozeSentencePairItemId");
  },

  currentCloze: function() {
    var curClozeItemId = Session.get("curClozeSentencePairItemId");
    var curClozeText;
    _.map(Session.get("clozeSentencePairs").clozes, function(c) {
      if (c.itemId === curClozeItemId) { curClozeText = c.cloze }
    });
    return curClozeText;
  },

  editingCloze: function(){
    return Session.get("editingCloze").cloze;
  },

  editingClozeResponse: function(){
    return Session.get("editingCloze").correctResponse;
  },

  editingSentence: function(){
    return Session.get("editingSentence").sentence;
  },

  tdfs: function(){
    return Session.get("contentGenerationAllTdfs");
  }
});

templateStimJSON = {
    "fileName" : "CH10AB.xml",
    "stimuli" : {
        "setspec" : {
            "clusters" : [
                {
                    "cluster" : []
                }
            ]
        }
    },
    "owner" : "",
    "source" : "content_generation"
}

templateTdfJSON = {
    "fileName" : "IESchapter10AB.xml",
    "tdfs" : {
        "tutor" : {
            "setspec" : [
                {
                    "lessonname" : [
                        "Chapter 10 Nervous System 1 AB"
                    ],
                    "userselect" : [
                        "false"
                    ],
                    "stimulusfile" : [
                        "CH10AB.xml"
                    ],
                    "lfparameter" : [
                        ".85"
                    ],
                    "speechAPIKey" : [
                        ""
                    ],
                    "audioInputEnabled" : [
                        "true"
                    ],
                    "audioInputSensitivity" : [
                        "15"
                    ],
                    "speechIgnoreOutOfGrammarResponses" : [
                        "true"
                    ],
                    "speechOutOfGrammarFeedback" : [
                        "Please try again"
                    ],
                    "enableAudioPromptAndFeedback" : [
                        "true"
                    ],
                    "audioPromptSpeakingRate" : [
                        "1"
                    ],
                    "textToSpeechAPIKey" : [
                        ""
                    ]
                }
            ],
            "unit" : [
                {
                    "unitinstructions" : [
                        "Instructions: Our MoFaCTS system has chosen some of the most important sentences from your textbook and they are presented here for your practice. This practice assumes you have read the textbook first, so that you understand the basic layout. For each sentence we remove keywords and the practice is to fill-in-the-blank for each sentence. Such quizzing has been proven to be an powerful aid to memory, and the system focuses on items you get wrong to make sure you learn all the items thouroughly. The system  pronounces keywords to help you memorize them if you turn that on in the main menu. The system also provides the progress button above to check how much practice you have done, and how well our AI system thinks you have learned the words. We hope you will be able to use this progress information to decide if you want to continue the practice after you have completed the required amount."
                    ],
                    "unitname" : [
                        "Chapter 10 Nervous System 1"
                    ],
                    "learningsession" : [
                        {
                            "clusterlist" : [
                                "0-0"
                            ],
                            "unitMode" : [
                                "thresholdCeiling"
                            ],
                            "calculateProbability" : [
                                "\n\n          function mul(m1, m2) {\n            var result = 0;\n            var len = m1.length;\n            for (var i = 0; i < len; i++) {\n                result += m1[i] * m2[i]\n            } return result}\n\n          function logitdec(outcomes, decay) {\n            if (outcomes) {\n                var outcomessuc = JSON.parse(JSON.stringify(outcomes));\n                var outcomesfail = outcomes.map(function(value) {\n                    return Math.abs(value - 1)\n                });\n                var w = outcomessuc.unshift(1);\n                var v = outcomesfail.unshift(1);\n                return Math.log(mul(outcomessuc, [...Array(w).keys()].reverse().map(function(value, index) {\n                    return Math.pow(decay, value)\n                })) / mul(outcomesfail, [...Array(w).keys()].reverse().map(function(value, index) {\n                    return Math.pow(decay, value)\n                }))) } return 0}\n\n          function recency(age, d) {\n          if (age==0) { return 0;\n          } else\n            {return Math.pow(1 + age, -d); }}\n\n          function quaddiffcor(seq, probs) {\n            return mul(seq, probs.map(function(value) {\n                return value * value\n            }))}\n\n          function linediffcor(seq, probs) {\n            return mul(seq, probs)}\n\n          function linediffincor(seq, probs) {\n            return mul(seq.map(function(value) {\n                return Math.abs(value - 1)\n            }), probs)}\n\n          p.y = -0.88209+\n          0.56762 * logitdec(\n              p.overallOutcomeHistory.slice(p.overallOutcomeHistory.length-60,\n              p.overallOutcomeHistory.length), .97) +\n          0.66748 * logitdec(p.responseOutcomeHistory, .91) +\n          12.38413 * recency(p.stimSecsSinceLastShown, .52) +\n          1.57492 *  recency(p.responseSecsSinceLastShown, .105) +\n          1.72852  * linediffcor(p.stimOutcomeHistory, p.stimPreviousCalculatedProbabilities) +\n          -1.83550 * quaddiffcor(p.stimOutcomeHistory, p.stimPreviousCalculatedProbabilities) +\n          -0.27823 * linediffincor(p.stimOutcomeHistory, p.stimPreviousCalculatedProbabilities);\n          p.probability = 1.0 / (1.0 + Math.exp(-p.y));\n\n        // console.log(p.overallOutcomeHistory+\" - \"+p.responseOutcomeHistory +\" - \"+p.stimSecsSinceLastShown+\" - \"+p.stimOutcomeHistory+\" - \"+p.stimPreviousCalculatedProbabilities);\n          return p\n             "
                            ]
                        }
                    ],
                    "deliveryparams" : [
                        {
                            "autostopTimeoutThreshold" : [
                                "1"
                            ],
                            "drill" : [
                                "30000"
                            ],
                            "purestudy" : [
                                "16000"
                            ],
                            "skipstudy" : [
                                "true"
                            ],
                            "reviewstudy" : [
                                "15000"
                            ],
                            "correctprompt" : [
                                "750"
                            ],
                            "fontsize" : [
                                "4"
                            ],
                            "correctscore" : [
                                "1"
                            ],
                            "incorrectscore" : [
                                "0"
                            ]
                        }
                    ]
                }
            ]
        }
    },
    "owner" : "",
    "source" : "content_generation"
}

serverStubContent = {
  "sentences": [
    {
      "sentence": "Snap your fingers !",
      "itemId": -327779956,
      "hasCloze": false
    },
    {
      "sentence": "In the time it took to do that , a decision made in a part of your brain that controls skeletal muscles resulted in impulses along motor neuron axons to the muscles in your hand , releasing acetylcholine at neuromuscular junctions .",
      "itemId": 236861440,
      "hasCloze": true
    },
    {
      "sentence": "As soon as the muscles contracted during the `` snap , '' a decision in the brain stopped the action .",
      "itemId": -463805844,
      "hasCloze": true
    },
    {
      "sentence": "Impulses ceased , enzymes broke down the ACh , active transport carried calcium back into storage in the muscle cells , and your hand relaxed .",
      "itemId": 1960362843,
      "hasCloze": false
    },
    {
      "sentence": "Think about how quickly these events unfolded .",
      "itemId": -325514838,
      "hasCloze": false
    },
    {
      "sentence": "Then focus on all of the activities going on in your body while reading this passage .",
      "itemId": -1682452606,
      "hasCloze": false
    },
    {
      "sentence": "Your nervous system exerts precise control over many of the body 's functions , and is responsible for your awareness of some of what is happening .",
      "itemId": -1883305925,
      "hasCloze": false
    },
    {
      "sentence": "astrocyte -- star-shaped neuroglia .",
      "itemId": -1160727976,
      "hasCloze": false
    },
    {
      "sentence": "axon -- cylindrical process that conducts impulses away from a neuron cell body .",
      "itemId": 953624645,
      "hasCloze": true
    },
    {
      "sentence": "bipolar neuron -- neuron with two processes extending from the cell body .",
      "itemId": 1220544949,
      "hasCloze": true
    },
    {
      "sentence": "dendrite -- branched process that serves as the receptor surface of a neuron .",
      "itemId": 1105563707,
      "hasCloze": false
    },
    {
      "sentence": "ependyma -- neuroglia that line spaces in the brain and spinal cord .",
      "itemId": -151439403,
      "hasCloze": true
    },
    {
      "sentence": "neurilemma -- sheath that surrounds the myelin of a nerve cell process .",
      "itemId": -89357368,
      "hasCloze": false
    },
    {
      "sentence": "motor neuron -- neuron that stimulates a muscle to contract or a gland to release a secretion .",
      "itemId": -1258920703,
      "hasCloze": false
    },
    {
      "sentence": "multipolar neuron -- neuron with many processes extending from the cell body .",
      "itemId": 1932513740,
      "hasCloze": false
    },
    {
      "sentence": "oligodendrocyte -- small type of neuroglia with few cellular processes .",
      "itemId": 1297088272,
      "hasCloze": false
    },
    {
      "sentence": "peripheral nervous system -- portion of the nervous system that consists of the nerves branching from the brain and spinal cord .",
      "itemId": 756925138,
      "hasCloze": true
    },
    {
      "sentence": "saltatory conduction -- impulse conduction in which the impulse seems to jump from node to node along the axon .",
      "itemId": 79602613,
      "hasCloze": true
    },
    {
      "sentence": "sensory neuron -- neuron that can be stimulated by a sensory receptor and conducts impulses into the brain or spinal cord .",
      "itemId": 867660353,
      "hasCloze": true
    },
    {
      "sentence": "synapse -- junction between two neurons .",
      "itemId": -1118204041,
      "hasCloze": false
    },
    {
      "sentence": "unipolar -- neuron with only one process extending from the cell body .",
      "itemId": -729033589,
      "hasCloze": true
    },
    {
      "sentence": "The nervous system oversees all that we do and determines who we are .",
      "itemId": 667213912,
      "hasCloze": true
    },
    {
      "sentence": "Through a vast communicating network of cells and the information that they send and receive , the nervous system can detect changes affecting the body , make decisions , and stimulate muscles or glands to respond .",
      "itemId": 15624849,
      "hasCloze": true
    },
    {
      "sentence": "Typically , these responses counteract the effects of the changes , and in this way , the nervous system helps maintain homeostasis .",
      "itemId": -977019673,
      "hasCloze": false
    },
    {
      "sentence": "The nervous system is composed predominantly of neural tissue , but also includes blood vessels and connective tissue .",
      "itemId": -59245489,
      "hasCloze": false
    },
    {
      "sentence": "Neural tissue consists of two cell types : nerve cells , or neurons , and neuroglia .",
      "itemId": -1739322461,
      "hasCloze": false
    },
    {
      "sentence": "Neurons are specialized to react to physical and chemical changes in their surroundings .",
      "itemId": -426603705,
      "hasCloze": false
    },
    {
      "sentence": "Small cellular processes called dendrites receive the input .",
      "itemId": 1516750133,
      "hasCloze": false
    },
    {
      "sentence": "A longer process called an axon , or nerve fiber , carries the information away from the cell in the form of bioelectric signals , called impulses , which allow the neuron to communicate with other neurons and with cells outside the nervous system .",
      "itemId": -924819158,
      "hasCloze": true
    },
    {
      "sentence": "Typically , axons within the nervous system are not isolated , but bundled in groups .",
      "itemId": -2126192613,
      "hasCloze": true
    },
    {
      "sentence": "In the peripheral nervous system , such bundles of axons are called nerves .",
      "itemId": 1569841675,
      "hasCloze": true
    },
    {
      "sentence": "In the central nervous system they are called tracts .",
      "itemId": -1320684940,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia are found throughout the nervous system , and in the brain they greatly outnumber neurons .",
      "itemId": 731686989,
      "hasCloze": false
    },
    {
      "sentence": "It was once thought that neuroglia only fill spaces and surround or support neurons .",
      "itemId": 241786942,
      "hasCloze": false
    },
    {
      "sentence": "Today we know that they have many other functions , including nourishing neurons and sending and receiving chemical messages .",
      "itemId": 1855500906,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia assemble in a special , protective way in the brain .",
      "itemId": 939907153,
      "hasCloze": false
    },
    {
      "sentence": "The blood-brain barrier offers an example .",
      "itemId": -1010300401,
      "hasCloze": false
    },
    {
      "sentence": "Most capillaries are `` leaky , '' allowing small molecules to enter or leave the bloodstream .",
      "itemId": 664116787,
      "hasCloze": false
    },
    {
      "sentence": "The cells that form capillaries in the brain , in contrast , are much more tightly connected , thanks partly to neuroglia called astrocytes .",
      "itemId": -1108253883,
      "hasCloze": true
    },
    {
      "sentence": "The barrier that this specialized architecture provides shields delicate brain tissue from chemical fluctuations , blocking entry to many substances .",
      "itemId": 72631058,
      "hasCloze": false
    },
    {
      "sentence": "Drug developers must consider the barrier when formulating drugs that act in the brain , including chemicals that let the drug through .",
      "itemId": -1232560071,
      "hasCloze": true
    },
    {
      "sentence": "An important part of the nervous system at the cellular level is not a cell at all , but the functional connection between a neuron and the cell with which it communicates , called a synapse .",
      "itemId": 1474316769,
      "hasCloze": true
    },
    {
      "sentence": "It is a functional connection because the two cells do not actually touch .",
      "itemId": 1822170287,
      "hasCloze": true
    },
    {
      "sentence": "The small space between them is called a synaptic cleft .",
      "itemId": -1239614491,
      "hasCloze": false
    },
    {
      "sentence": "Much of the work of the nervous system is to send and receive chemical messages at synapses .",
      "itemId": 508291767,
      "hasCloze": true
    },
    {
      "sentence": "Biological messenger molecules called neurotransmitters convey this neural information .",
      "itemId": 1522889540,
      "hasCloze": true
    },
    {
      "sentence": "The organs of the nervous system can be divided into two groups .",
      "itemId": -2069901638,
      "hasCloze": false
    },
    {
      "sentence": "One group , consisting of the brain and spinal cord , forms the central nervous system .",
      "itemId": 1865368652,
      "hasCloze": true
    },
    {
      "sentence": "The other group , the peripheral nervous system , includes the nerves that connect the central nervous system to other body parts .",
      "itemId": -1212445270,
      "hasCloze": true
    },
    {
      "sentence": "The PNS also includes ganglia , which are clusters of neuron cell bodies located outside the brain and spinal cord .",
      "itemId": -1965387021,
      "hasCloze": true
    },
    {
      "sentence": "The three general functions of the nervous system -- receiving information , deciding what to do , and acting on those decisions -- are termed sensory , integrative , and motor .",
      "itemId": 1133873024,
      "hasCloze": true
    },
    {
      "sentence": "Structures called sensory receptors at the ends of neurons in the peripheral nervous system provide the sensory function of the nervous system .",
      "itemId": 102037629,
      "hasCloze": true
    },
    {
      "sentence": "These receptors gather information by detecting changes inside and outside the body .",
      "itemId": -1501520431,
      "hasCloze": true
    },
    {
      "sentence": "They monitor external environmental factors such as light and sound intensities as well as the temperature , oxygen concentration , and other conditions of the body 's internal environment .",
      "itemId": -772081414,
      "hasCloze": true
    },
    {
      "sentence": "Sensory receptors convert their information into impulses , which are then conducted along peripheral nerves to the CNS .",
      "itemId": 1171962790,
      "hasCloze": true
    },
    {
      "sentence": "There the signals are integrated .",
      "itemId": 1782057417,
      "hasCloze": false
    },
    {
      "sentence": "That is , they are brought together , creating sensations , adding to memory , or helping produce thoughts .",
      "itemId": 65908715,
      "hasCloze": false
    },
    {
      "sentence": "Following integration , conscious or subconscious decisions are made and then acted upon by means of motor functions .",
      "itemId": -383705325,
      "hasCloze": false
    },
    {
      "sentence": "Neurons that conduct impulses from the CNS to responsive structures called effectors carry out the motor functions of the nervous system .",
      "itemId": -2027892486,
      "hasCloze": true
    },
    {
      "sentence": "These effectors are outside the nervous system and include muscles and glands whose actions are either controlled or modified by nerve activity .",
      "itemId": -24375778,
      "hasCloze": true
    },
    {
      "sentence": "The motor portion of the PNS can be subdivided into the somatic and the autonomic nervous systems .",
      "itemId": 611795290,
      "hasCloze": false
    },
    {
      "sentence": "The somatic nervous system communicates voluntary instructions originating in the CNS to skeletal muscles , causing contraction .",
      "itemId": 310348838,
      "hasCloze": true
    },
    {
      "sentence": "The autonomic nervous system communicates instructions from the CNS that control viscera , such as the heart and various glands , and thus causes involuntary , subconscious actions .",
      "itemId": 344381694,
      "hasCloze": true
    },
    {
      "sentence": "Typically these responses counteract the effects of the changes detected .",
      "itemId": -1670901030,
      "hasCloze": false
    },
    {
      "sentence": "In this way , the nervous system helps maintain homeostasis .",
      "itemId": -1270052926,
      "hasCloze": true
    },
    {
      "sentence": "Neurons vary in size and shape .",
      "itemId": -1914550840,
      "hasCloze": false
    },
    {
      "sentence": "They may differ in the lengths and sizes of their axons and dendrites and in the number of processes .",
      "itemId": -1413196874,
      "hasCloze": false
    },
    {
      "sentence": "Despite this variability , neurons share certain features .",
      "itemId": -128625758,
      "hasCloze": false
    },
    {
      "sentence": "Every neuron has a cell body , dendrites , and an axon .",
      "itemId": -1833025603,
      "hasCloze": false
    },
    {
      "sentence": "Figure 10.3 shows some of the other structures common to neurons .",
      "itemId": -48499052,
      "hasCloze": true
    },
    {
      "sentence": "A neuron 's cell body contains granular cytoplasm , mitochondria , lysosomes , a Golgi apparatus , and many microtubules .",
      "itemId": 787961820,
      "hasCloze": false
    },
    {
      "sentence": "A network of fine threads called neurofilaments extends into the axon and supports it .",
      "itemId": -423183028,
      "hasCloze": true
    },
    {
      "sentence": "Scattered throughout the cytoplasm are many membranous packets of chromatophilic substance , which consist mainly of rough endoplasmic reticulum .",
      "itemId": -1726804550,
      "hasCloze": false
    },
    {
      "sentence": "Cytoplasmic inclusions in neurons include glycogen , lipids , and pigments such as melanin .",
      "itemId": -373259150,
      "hasCloze": false
    },
    {
      "sentence": "Near the center of the neuron cell body is a large , spherical nucleus with a conspicuous nucleolus .",
      "itemId": -1105085195,
      "hasCloze": true
    },
    {
      "sentence": "Dendrites are typically highly branched , providing receptive surfaces with which processes from other neurons communicate .",
      "itemId": -348988129,
      "hasCloze": false
    },
    {
      "sentence": "In some types of neurons , the cell body provides such a receptive surface .",
      "itemId": -53356534,
      "hasCloze": false
    },
    {
      "sentence": "Some dendrites have tiny , thornlike spines on their surfaces , which are contact points for other neurons .",
      "itemId": -781564580,
      "hasCloze": false
    },
    {
      "sentence": "A neuron may have many dendrites , but no more than one axon .",
      "itemId": 1124619736,
      "hasCloze": false
    },
    {
      "sentence": "In most neurons the axon arises from the cell body as a cone-shaped thickening called the axon hillock .",
      "itemId": -1795078143,
      "hasCloze": false
    },
    {
      "sentence": "The cytoplasm of the axon includes many mitochondria , microtubules , and neurofibrils .",
      "itemId": -1972004663,
      "hasCloze": true
    },
    {
      "sentence": "The axon may give off branches , called collaterals .",
      "itemId": 1396021397,
      "hasCloze": false
    },
    {
      "sentence": "Near its end , an axon may have many fine extensions , each with a specialized ending called an axon terminal .",
      "itemId": 1604315426,
      "hasCloze": true
    },
    {
      "sentence": "The axon terminal ends as a synaptic knob close to the receptive surface of another cell , separated only by a space called the synaptic cleft .",
      "itemId": 84265547,
      "hasCloze": false
    },
    {
      "sentence": "The general pattern is that neurons receive input through the dendrites and the cell body , and send output in the form of an impulse conducted away from the cell body , down the axon .",
      "itemId": 490266929,
      "hasCloze": true
    },
    {
      "sentence": "An axon , in addition to conducting impulses , conveys biochemicals and organelles , which can be quite a task in these long cells .",
      "itemId": -635350967,
      "hasCloze": false
    },
    {
      "sentence": "In this activity , called axonal transport , movement occurs in both directions between the cell body and the ends of the axon .",
      "itemId": 2026354652,
      "hasCloze": true
    },
    {
      "sentence": "For example , enzymes required for neurotransmitter synthesis are produced in the cell body and transported to the axon terminals .",
      "itemId": -529667006,
      "hasCloze": false
    },
    {
      "sentence": "Old organelles and other cellular components may be transported in the reverse direction to be recycled .",
      "itemId": 1933746320,
      "hasCloze": false
    },
    {
      "sentence": "It is a highly regulated process .",
      "itemId": -307327503,
      "hasCloze": false
    },
    {
      "sentence": "In the PNS , neuroglia called Schwann cells encase the large axons of peripheral neurons in lipid-rich sheaths .",
      "itemId": -2035780688,
      "hasCloze": true
    },
    {
      "sentence": "These tight coverings form as Schwann cell membranes wind and wrap around axons .",
      "itemId": 810217760,
      "hasCloze": false
    },
    {
      "sentence": "The layers are composed of myelin , which consists of several types of lipids and proteins .",
      "itemId": -1593679950,
      "hasCloze": false
    },
    {
      "sentence": "Myelin gives the cell membranes of Schwann cells a higher proportion of lipid than other cell membranes .",
      "itemId": 1601567615,
      "hasCloze": true
    },
    {
      "sentence": "This coating is called a myelin sheath .",
      "itemId": -1106913730,
      "hasCloze": false
    },
    {
      "sentence": "The parts of the Schwann cells that contain most of the cytoplasm and the nuclei remain outside the myelin sheath and comprise a neurilemma , or neurilemmal sheath , which surrounds the myelin sheath .",
      "itemId": -1304346091,
      "hasCloze": true
    },
    {
      "sentence": "Narrow gaps in the myelin sheath between Schwann cells are called nodes of Ranvier .",
      "itemId": 105315226,
      "hasCloze": false
    },
    {
      "sentence": "Schwann cells also enclose , but do not wind around , the smallest axons of peripheral neurons .",
      "itemId": -1872853241,
      "hasCloze": false
    },
    {
      "sentence": "Consequently , these axons do not have myelin sheaths .",
      "itemId": -1412924854,
      "hasCloze": false
    },
    {
      "sentence": "Instead , the axon or a group of axons may lie partially or completely in a longitudinal groove of a Schwann cell .",
      "itemId": -1950461316,
      "hasCloze": false
    },
    {
      "sentence": "Axons that have myelin sheaths are called myelinated axons , and those that do not have these sheaths are unmyelinated axons .",
      "itemId": 458242436,
      "hasCloze": true
    },
    {
      "sentence": "Myelinated axons conduct impulses rapidly compared to unmyelinated axons .",
      "itemId": 281810938,
      "hasCloze": false
    },
    {
      "sentence": "Groups of myelinated axons appear white .",
      "itemId": -1169622898,
      "hasCloze": false
    },
    {
      "sentence": "The white matter in the brain and spinal cord gets its color from masses of myelinated axons .",
      "itemId": -1508852339,
      "hasCloze": true
    },
    {
      "sentence": "In the CNS , myelin is produced by a type of neuroglia called an oligodendrocyte rather than by a Schwann cell .",
      "itemId": -1112609839,
      "hasCloze": true
    },
    {
      "sentence": "In the brain and spinal cord , myelinated axons do not have neurilemmae .",
      "itemId": 1278963295,
      "hasCloze": false
    },
    {
      "sentence": "Unmyelinated nerve tissue appears gray .",
      "itemId": 339411497,
      "hasCloze": false
    },
    {
      "sentence": "Thus , the gray matter in the CNS contains many unmyelinated axons and neuron cell bodies .",
      "itemId": -778226713,
      "hasCloze": false
    },
    {
      "sentence": "Clinical Application 10.2 discusses multiple sclerosis , a condition in which neurons in the brain and spinal cord lose their myelin .",
      "itemId": -312252064,
      "hasCloze": true
    },
    {
      "sentence": "Clinical Application 3.2 describes adrenoleukodystrophy , in which myelin vanishes in the brains and spinal cords of boys .",
      "itemId": -1796335826,
      "hasCloze": false
    },
    {
      "sentence": "The cells of nervous tissue are intimately related .",
      "itemId": -1187057909,
      "hasCloze": false
    },
    {
      "sentence": "They descend from the same neural stem cells and remain associated throughout their existence .",
      "itemId": -1549019528,
      "hasCloze": false
    },
    {
      "sentence": "Neurons can be classified into three major groups based on structural differences , as figure 10.6 shows .",
      "itemId": -1620003341,
      "hasCloze": true
    },
    {
      "sentence": "Each type of neuron is specialized to conduct an impulse in one direction .",
      "itemId": -1965671171,
      "hasCloze": false
    },
    {
      "sentence": "A multipolar neuron has many processes arising from its cell body .",
      "itemId": -1600162138,
      "hasCloze": true
    },
    {
      "sentence": "Only one is an axon ; the rest are dendrites .",
      "itemId": -1225717783,
      "hasCloze": false
    },
    {
      "sentence": "Most neurons whose cell bodies lie within the brain or spinal cord are of this type .",
      "itemId": 585659350,
      "hasCloze": true
    },
    {
      "sentence": "Some multipolar neurons are in ganglia associated with the autonomic nervous system .",
      "itemId": 1673361404,
      "hasCloze": true
    },
    {
      "sentence": "Others are found in specialized parts of the eyes .",
      "itemId": -676717737,
      "hasCloze": false
    },
    {
      "sentence": "The neuron illustrated in figure 10.3 is multipolar .",
      "itemId": 1516994241,
      "hasCloze": true
    },
    {
      "sentence": "The cell body of a bipolar neuron has only two processes , one arising from either end .",
      "itemId": 1321894315,
      "hasCloze": false
    },
    {
      "sentence": "Although these processes are similar in structure , one is an axon and the other is a dendrite .",
      "itemId": -1591702230,
      "hasCloze": false
    },
    {
      "sentence": "Bipolar neurons are found in specialized parts of the eyes , nose , and ears .",
      "itemId": 92826784,
      "hasCloze": true
    },
    {
      "sentence": "Each unipolar neuron has a single process extending from its cell body .",
      "itemId": 1148593998,
      "hasCloze": true
    },
    {
      "sentence": "These are also called pseudounipolar , because they start out with two processes that merge into one during development .",
      "itemId": -488443295,
      "hasCloze": true
    },
    {
      "sentence": "A short distance from the cell body , this process divides into two branches , which really function as a single axon : One branch has dendrites near a peripheral body part .",
      "itemId": -194197607,
      "hasCloze": true
    },
    {
      "sentence": "The other branch enters the brain or spinal cord .",
      "itemId": -1945602707,
      "hasCloze": false
    },
    {
      "sentence": "The cell bodies of most unipolar neurons are found in ganglia .",
      "itemId": -1185909081,
      "hasCloze": false
    },
    {
      "sentence": "Neurons can also be classified by functional differences into the following groups , depending on whether they carry information into the CNS , completely within the CNS , or out of the CNS .",
      "itemId": 1249088166,
      "hasCloze": true
    },
    {
      "sentence": "Sensory neurons conduct impulses from peripheral body parts into the brain or spinal cord .",
      "itemId": -1548698474,
      "hasCloze": true
    },
    {
      "sentence": "At their distal ends , the dendrites of these neurons or specialized structures associated with them act as sensory receptors , detecting changes in the outside world or in the body .",
      "itemId": -12615177,
      "hasCloze": true
    },
    {
      "sentence": "When sufficiently stimulated , sensory receptors trigger impulses that travel on sensory neuron axons into the brain or spinal cord .",
      "itemId": 1237795403,
      "hasCloze": true
    },
    {
      "sentence": "Most sensory neurons are unipolar , as shown in figure 10.7 , although some are bipolar and others are multipolar .",
      "itemId": -535743014,
      "hasCloze": false
    },
    {
      "sentence": "Interneurons lie within the brain or spinal cord .",
      "itemId": 2038318062,
      "hasCloze": false
    },
    {
      "sentence": "They are multipolar and form links with other neurons .",
      "itemId": 1731713863,
      "hasCloze": false
    },
    {
      "sentence": "Interneurons relay information from one part of the brain or spinal cord to another .",
      "itemId": -1000653490,
      "hasCloze": true
    },
    {
      "sentence": "That is , they may conduct incoming sensory information to appropriate regions for processing and interpreting .",
      "itemId": -2113163562,
      "hasCloze": false
    },
    {
      "sentence": "Other instructions are transferred to motor neurons .",
      "itemId": 470744697,
      "hasCloze": false
    },
    {
      "sentence": "The cell bodies of some interneurons aggregate in specialized masses of nervous tissue called nuclei .",
      "itemId": 406053174,
      "hasCloze": false
    },
    {
      "sentence": "Nuclei are similar to ganglia , but are within the CNS .",
      "itemId": -1596265784,
      "hasCloze": false
    },
    {
      "sentence": "Motor neurons are multipolar and conduct impulses out of the brain or spinal cord to effectors .",
      "itemId": 209159839,
      "hasCloze": false
    },
    {
      "sentence": "For example , when motor neurons stimulate muscle cells , the muscle cells contract ; when motor neurons stimulate glands , the glands release secretions .",
      "itemId": -1018525892,
      "hasCloze": true
    },
    {
      "sentence": "Motor neurons of the somatic nervous system that control skeletal muscle contraction are under voluntary control .",
      "itemId": -837741657,
      "hasCloze": false
    },
    {
      "sentence": "Those that control cardiac and smooth muscle contraction and the secretions of glands are part of the autonomic nervous system and are largely under involuntary control .",
      "itemId": -941139809,
      "hasCloze": false
    },
    {
      "sentence": "Multipolar neurons have a cell body with many processes , one of which is an axon , the rest dendrites .",
      "itemId": -1062083122,
      "hasCloze": false
    },
    {
      "sentence": "Multipolar neurons are the most common type of neuron in the brain and spinal cord ; also found in ganglia of the autonomic nervous system .",
      "itemId": -1977927324,
      "hasCloze": true
    },
    {
      "sentence": "Bipolar neurons have a cell body with a process arising from each end , one axon and one dendrite .",
      "itemId": 893490643,
      "hasCloze": false
    },
    {
      "sentence": "Bipolar neurons are located in specialized parts of the eyes , nose , and ears .",
      "itemId": -809514486,
      "hasCloze": false
    },
    {
      "sentence": "Unipolar neurons have a cell body with a single process that divides into two branches and functions as an axon .",
      "itemId": -1611492935,
      "hasCloze": true
    },
    {
      "sentence": "Unipolar neurons are found in ganglia .",
      "itemId": -687855604,
      "hasCloze": false
    },
    {
      "sentence": "Sensory neurons conduct impulses from receptors in peripheral body parts into the brain or spinal cord .",
      "itemId": -592876824,
      "hasCloze": false
    },
    {
      "sentence": "Sensory neurons are mostly unipolar , some bipolar , some multipolar .",
      "itemId": 663575281,
      "hasCloze": false
    },
    {
      "sentence": "Interneurons replay information between neurons in the brain and spinal cord .",
      "itemId": 342485655,
      "hasCloze": true
    },
    {
      "sentence": "Interneurons are multipolar .",
      "itemId": -157898025,
      "hasCloze": false
    },
    {
      "sentence": "Motor neurons conduct impulses from the brain or spinal cord out to effectors -- muscles or glands .",
      "itemId": 165659868,
      "hasCloze": true
    },
    {
      "sentence": "Motor neurons are multipolar .",
      "itemId": -90623274,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia were once thought to be mere bystanders to neural function , providing scaffolding and controlling the sites at which neurons contact one another .",
      "itemId": -474146419,
      "hasCloze": true
    },
    {
      "sentence": "These important cells have additional functions .",
      "itemId": 494914558,
      "hasCloze": false
    },
    {
      "sentence": "In the embryo , neuroglia guide neurons to their positions and may stimulate them to specialize .",
      "itemId": -1576986223,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia also produce the growth factors that nourish neurons and remove excess ions and neurotransmitters that accumulate between neurons .",
      "itemId": -765248800,
      "hasCloze": true
    },
    {
      "sentence": "In cell culture experiments , certain types of neuroglia signal neurons to form and maintain synapses .",
      "itemId": -221760922,
      "hasCloze": true
    },
    {
      "sentence": "The four types of CNS neuroglia are astrocytes , oligodendrocytes , microglia , and ependyma : As their name implies , astrocytes are star-shaped cells .",
      "itemId": 1028282945,
      "hasCloze": true
    },
    {
      "sentence": "They are commonly found between neurons and blood vessels , where they provide support and hold structures together with abundant cellular processes .",
      "itemId": 1840440003,
      "hasCloze": true
    },
    {
      "sentence": "Astrocytes aid metabolism of certain substances , such as glucose , and they may help regulate the concentrations of important ions , such as potassium ions , in the interstitial space of nervous tissue .",
      "itemId": 823355651,
      "hasCloze": false
    },
    {
      "sentence": "Astrocytes also respond to injury of brain tissue and form a special type of scar tissue , which fills spaces and closes gaps in the CNS .",
      "itemId": 182813590,
      "hasCloze": true
    },
    {
      "sentence": "These multifunctional cells also have a nutritive function , regulating movement of substances from blood vessels to neurons and bathing nearby neurons in growth factors .",
      "itemId": -1977754896,
      "hasCloze": false
    },
    {
      "sentence": "Astrocytes play a role in the formation of the blood-brain barrier , which restricts movement of substances between the blood and the CNS .",
      "itemId": -1010582647,
      "hasCloze": true
    },
    {
      "sentence": "Gap junctions link astrocytes to one another , forming protein-lined channels through which calcium ions travel , possibly stimulating neurons .",
      "itemId": 673678717,
      "hasCloze": true
    },
    {
      "sentence": "Oligodendrocytes resemble astrocytes but are smaller and have fewer processes .",
      "itemId": 1483087658,
      "hasCloze": false
    },
    {
      "sentence": "They form in rows along axons , and myelinate these axons in the brain and spinal cord .",
      "itemId": -2014420761,
      "hasCloze": false
    },
    {
      "sentence": "Unlike the Schwann cells of the PNS , oligodendrocytes can send out a number of processes , each of which forms a myelin sheath around a nearby axon .",
      "itemId": -1439498144,
      "hasCloze": true
    },
    {
      "sentence": "In this way , a single oligodendrocyte may myelinate many axons .",
      "itemId": 2124522387,
      "hasCloze": false
    },
    {
      "sentence": "However , these cells do not form neurilemmae .",
      "itemId": -2107433976,
      "hasCloze": false
    },
    {
      "sentence": "Microglia are small cells and have fewer processes than other types of neuroglia .",
      "itemId": -1844720303,
      "hasCloze": false
    },
    {
      "sentence": "These cells are scattered throughout the CNS , where they help support neurons and phagocytize bacterial cells and cellular debris .",
      "itemId": -330737872,
      "hasCloze": true
    },
    {
      "sentence": "They usually proliferate whenever the brain or spinal cord is inflamed because of injury or disease .",
      "itemId": -1994956712,
      "hasCloze": true
    },
    {
      "sentence": "Ependyma are cuboidal or columnar cells in shape and may have cilia .",
      "itemId": -268001981,
      "hasCloze": false
    },
    {
      "sentence": "They form the inner lining of the central canal that extends downward through the spinal cord .",
      "itemId": -1142581539,
      "hasCloze": true
    },
    {
      "sentence": "Ependymal cells also form a one-cell-thick epithelial-like membrane that covers the inside of spaces in the brain called ventricles .",
      "itemId": -1880071343,
      "hasCloze": true
    },
    {
      "sentence": "Here , gap junctions join ependymal cells , allowing free exchange between cells .",
      "itemId": -760404390,
      "hasCloze": true
    },
    {
      "sentence": "The ependymal layer itself is porous , allowing substances to diffuse freely between the interstitial fluid of the brain tissues and the fluid in the ventricles .",
      "itemId": -228754266,
      "hasCloze": true
    },
    {
      "sentence": "Ependymal cells also cover the specialized capillaries called choroid plexuses associated with the ventricles of the brain .",
      "itemId": 2038842525,
      "hasCloze": true
    },
    {
      "sentence": "Here they help regulate the composition of the cerebrospinal fluid .",
      "itemId": -1135995958,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia , which comprise more than half of the volume of the brain and outnumber neurons 10 to 1 , are critical to neuron function .",
      "itemId": -991430650,
      "hasCloze": true
    },
    {
      "sentence": "Abnormal neuroglia are associated with certain disorders .",
      "itemId": -1365137877,
      "hasCloze": false
    },
    {
      "sentence": "Most brain tumors , for example , consist of neuroglia that divide too often .",
      "itemId": 140215506,
      "hasCloze": false
    },
    {
      "sentence": "Neuroglia that produce toxins may lie behind some neurodegenerative disorders .",
      "itemId": -639696184,
      "hasCloze": false
    },
    {
      "sentence": "In one familial form of amyotrophic lateral sclerosis , astrocytes release a toxin that destroys motor neurons , causing progressive weakness .",
      "itemId": -904906666,
      "hasCloze": true
    },
    {
      "sentence": "In Huntington disease , which causes uncontrollable movements and cognitive impairment , microglia in the brain release a toxin that damages neurons .",
      "itemId": 713727445,
      "hasCloze": true
    },
    {
      "sentence": "ALS and HD affect specific sets of neurons .",
      "itemId": -257697416,
      "hasCloze": false
    },
    {
      "sentence": "Identifying the roles of neuroglia in nervous system disorders suggests new targets for treatments .",
      "itemId": 1910098847,
      "hasCloze": false
    },
    {
      "sentence": "The two types of neuroglia in the peripheral nervous system are Schwann cells and satellite cells : Schwann cells produce the myelin on peripheral myelinated neurons , as described earlier .",
      "itemId": 1488973956,
      "hasCloze": true
    },
    {
      "sentence": "Satellite cells provide nutritional support and help regulate the concentrations of ions around neuron cell bodies within ganglia .",
      "itemId": 682988407,
      "hasCloze": true
    },
    {
      "sentence": "Astrocytes are star-shaped cells between neurons and blood vessels .",
      "itemId": 1435297440,
      "hasCloze": false
    },
    {
      "sentence": "Astrocytes have the following functions : structural support , formation of scar tissue , transport of substances between blood vessels and neurons , communication with one another and with neurons , mopping up excess ions and neurotransmitters , inducing synapse formation .",
      "itemId": 4453415,
      "hasCloze": true
    },
    {
      "sentence": "Oligodendrocytes are shaped like astrocytes , but with fewer cellular processes , in rows along axons .",
      "itemId": 824680352,
      "hasCloze": false
    },
    {
      "sentence": "Oligodendrocytes form myelin sheaths in the brain and spinal cord , produce nerve growth factors .",
      "itemId": -105655491,
      "hasCloze": false
    },
    {
      "sentence": "Microglia are small cells with few cellular processes and found throughout the CNS .",
      "itemId": -1552986833,
      "hasCloze": false
    },
    {
      "sentence": "Microglia provide structural support and phagocytosis .",
      "itemId": 711351654,
      "hasCloze": false
    },
    {
      "sentence": "Ependyma are cuboidal and columnar cells in the lining of the ventricles of the brain and the central canal of the spinal cord .",
      "itemId": -1144680338,
      "hasCloze": false
    },
    {
      "sentence": "Ependyma form a porous layer through which substances diffuse between the interstitial fluid of the brain and spinal cord and the cerebrospinal fluid .",
      "itemId": 43193760,
      "hasCloze": true
    },
    {
      "sentence": "Schwann cells are cells with abundant , lipid-rich membranes that wrap tightly around the axons of peripheral neurons .",
      "itemId": -2084259480,
      "hasCloze": true
    },
    {
      "sentence": "Schwann cells form myelin sheaths , mop up excess ions and neurotransmitters , support neuronal regeneration in PNS .",
      "itemId": -846305738,
      "hasCloze": false
    },
    {
      "sentence": "Satellite cells are small , cuboidal cells that surround cell bodies of neurons in ganglia .",
      "itemId": -1841381001,
      "hasCloze": true
    },
    {
      "sentence": "Satellite cells support ganglia , mop up excess ions and neurotransmitters .",
      "itemId": -962347271,
      "hasCloze": false
    },
    {
      "sentence": "Injury to the cell body usually kills the neuron , and because mature neurons do not divide , the destroyed cell is not replaced unless neural stem cells are stimulated to proliferate .",
      "itemId": 896685563,
      "hasCloze": true
    },
    {
      "sentence": "However , a damaged peripheral axon may regenerate .",
      "itemId": 108797785,
      "hasCloze": false
    },
    {
      "sentence": "For example , if injury or disease separates an axon in a peripheral nerve from its cell body , the distal portion of the axon and its myelin sheath deteriorate within a few weeks , although the Schwann cells and neurilemma remain .",
      "itemId": -837469695,
      "hasCloze": true
    },
    {
      "sentence": "Macrophages remove the fragments of myelin and other cellular debris .",
      "itemId": 394305011,
      "hasCloze": false
    },
    {
      "sentence": "The proximal end of the injured axon develops sprouts shortly after the injury .",
      "itemId": 306491256,
      "hasCloze": false
    },
    {
      "sentence": "Influenced by nerve growth factors that nearby neuroglia secrete , one of these sprouts may grow into a tube formed by the remaining Schwann cells .",
      "itemId": 1023816967,
      "hasCloze": false
    },
    {
      "sentence": "At the same time , Schwann cells along the length of the regenerating portion form new myelin around the growing axon .",
      "itemId": -1434465597,
      "hasCloze": false
    },
    {
      "sentence": "Growth of a regenerating axon is slow , but eventually the new axon may reestablish the former connection .",
      "itemId": -823573689,
      "hasCloze": false
    },
    {
      "sentence": "Nerve growth factors , secreted by neuroglia , may help direct the growing axon .",
      "itemId": 1090545840,
      "hasCloze": false
    },
    {
      "sentence": "However , the regenerating axon may still end up in the wrong place , so full function often does not return .",
      "itemId": -1034157988,
      "hasCloze": false
    },
    {
      "sentence": "If an axon of a neuron within the CNS is separated from its cell body , the distal portion of the axon will degenerate , but more slowly than a separated axon in the PNS .",
      "itemId": 1714454419,
      "hasCloze": true
    },
    {
      "sentence": "However , axons in the CNS lack neurilemmae , and the myelin-producing oligodendrocytes do not proliferate following injury .",
      "itemId": -971201981,
      "hasCloze": false
    },
    {
      "sentence": "Consequently , the proximal end of a damaged axon that begins to grow has no tube of sheath cells to guide it .",
      "itemId": -641802462,
      "hasCloze": true
    },
    {
      "sentence": "Therefore , regeneration is unlikely .",
      "itemId": 2099113772,
      "hasCloze": false
    },
    {
      "sentence": "Neurons do not normally divide .",
      "itemId": 1444529735,
      "hasCloze": false
    },
    {
      "sentence": "New neural tissue arises from neural stem cells , which give rise to neural progenitor cells that can give rise to neurons or neuroglia .",
      "itemId": 1374384348,
      "hasCloze": true
    },
    {
      "sentence": "Recall that neurons communicate with one another at synapses .",
      "itemId": 1690326645,
      "hasCloze": false
    },
    {
      "sentence": "When you get a text message , the person texting is the sender and you are the receiver .",
      "itemId": 624570519,
      "hasCloze": false
    },
    {
      "sentence": "Similarly , the neuron conducting an impulse to the synapse is the sender , or presynaptic neuron .",
      "itemId": -1881161437,
      "hasCloze": false
    },
    {
      "sentence": "The neuron receiving input at the synapse is the postsynaptic neuron .",
      "itemId": -1534746646,
      "hasCloze": true
    },
    {
      "sentence": "The postsynaptic cell could also be a muscle or glandular cell .",
      "itemId": -1244423158,
      "hasCloze": false
    },
    {
      "sentence": "The mechanism by which the impulse in the presynaptic neuron signals the postsynaptic cell is called synaptic transmission .",
      "itemId": 522818480,
      "hasCloze": true
    },
    {
      "sentence": "As a result of synaptic transmission , the presynaptic neuron stimulates or inhibits a postsynaptic cell .",
      "itemId": -512241012,
      "hasCloze": false
    },
    {
      "sentence": "Synaptic transmission is a one-way process carried out by neurotransmitters .",
      "itemId": 1039294831,
      "hasCloze": false
    },
    {
      "sentence": "An impulse travels along the axon of the presynaptic neuron to the axon terminal .",
      "itemId": 449848294,
      "hasCloze": false
    },
    {
      "sentence": "Most axons have several rounded synaptic knobs at their terminals , which dendrites do not have .",
      "itemId": 88086582,
      "hasCloze": false
    },
    {
      "sentence": "These knobs have arrays of membranous sacs , called synaptic vesicles , that contain neurotransmitter molecules .",
      "itemId": 200458796,
      "hasCloze": false
    },
    {
      "sentence": "When an impulse reaches a synaptic knob , voltage-sensitive calcium channels open and calcium diffuses inward from the extracellular fluid .",
      "itemId": 1499889412,
      "hasCloze": false
    },
    {
      "sentence": "The increased calcium concentration inside the cell initiates a series of events that fuses the synaptic vesicles with the cell membrane , where they release their neurotransmitter by exocytosis .",
      "itemId": -937636965,
      "hasCloze": true
    },
    {
      "sentence": "Once the neurotransmitter binds to receptors on a postsynaptic cell , the action is either excitatory or inhibitory .",
      "itemId": -1830009099,
      "hasCloze": true
    },
    {
      "sentence": "The net effect on the postsynaptic cell depends on the combined effect of the excitatory and inhibitory inputs from as few as 1 to 10,000 or more presynaptic neurons .",
      "itemId": -169855861,
      "hasCloze": false
    },
    {
      "sentence": "A cell membrane is usually electrically charged , or polarized , so that the inside is negatively charged with respect to the outside .",
      "itemId": -588093810,
      "hasCloze": false
    },
    {
      "sentence": "This polarization is due to an unequal distribution of positive and negative ions across the membrane .",
      "itemId": 1753007417,
      "hasCloze": true
    },
    {
      "sentence": "It is important in the conduction of impulses in both muscle fibers and neurons .",
      "itemId": 1405739287,
      "hasCloze": false
    },
    {
      "sentence": "Potassium ions are the major intracellular positive ion , and sodium ions are the major extracellular cation .",
      "itemId": -1704447058,
      "hasCloze": false
    },
    {
      "sentence": "The distribution is created largely by the sodium/potassium pump , which actively transports sodium ions out of the cell and potassium ions into the cell .",
      "itemId": -1064325184,
      "hasCloze": true
    },
    {
      "sentence": "It is also in part due to channels in the cell membrane that determine membrane permeability to these ions .",
      "itemId": 2014021445,
      "hasCloze": true
    },
    {
      "sentence": "These channels , formed by membrane proteins , can be selective ; that is , a particular channel may allow only one type of ion to pass through and exclude all other ions of different size and charge .",
      "itemId": 89428361,
      "hasCloze": false
    },
    {
      "sentence": "Thus , even though concentration gradients are present for sodium and potassium , the ability of these ions to diffuse across the cell membrane depends on the presence of channels .",
      "itemId": 691771967,
      "hasCloze": true
    },
    {
      "sentence": "For an ion to diffuse across the cell membrane requires both a concentration gradient for that ion and membrane permeability to that ion .",
      "itemId": -2059024254,
      "hasCloze": true
    },
    {
      "sentence": "Some channels are always open , whereas others may be either open or closed , somewhat like a gate .",
      "itemId": 1919930622,
      "hasCloze": false
    },
    {
      "sentence": "Both chemical and electrical factors can affect the opening and closing of these gated channels .",
      "itemId": 1901234103,
      "hasCloze": false
    },
    {
      "sentence": "A resting nerve cell is not being stimulated to send an impulse .",
      "itemId": -1688933756,
      "hasCloze": false
    },
    {
      "sentence": "Under resting conditions , non-gated channels determine the membrane permeability to sodium and potassium ions .",
      "itemId": -1103618630,
      "hasCloze": false
    },
    {
      "sentence": "Sodium and potassium ions follow the rules of diffusion described in section 3 .",
      "itemId": -1114360101,
      "hasCloze": false
    },
    {
      "sentence": "3 , Movements Into and Out of the Cell , Diffusion , and show a net movement from areas of high concentration to areas of low concentration across a membrane as their permeabilities permit .",
      "itemId": -807569280,
      "hasCloze": true
    },
    {
      "sentence": "The resting cell membrane is much more permeable to potassium ions than to sodium ions .",
      "itemId": -275043458,
      "hasCloze": false
    },
    {
      "sentence": "Calcium ions are less able to cross the resting cell membrane than are either sodium ions or potassium ions , and have a special role in neuron function , described in section 10.7 , Synaptic Transmission , Neurotransmitters .",
      "itemId": 1869311136,
      "hasCloze": true
    },
    {
      "sentence": "Also , the cytoplasm of these cells has many negatively charged ions , which include phosphate , sulfate , and proteins , that are synthesized inside the cell and can not diffuse through cell membranes .",
      "itemId": -228125780,
      "hasCloze": true
    },
    {
      "sentence": "Imagine a hypothetical neuron , before a membrane potential has been established .",
      "itemId": -1538375387,
      "hasCloze": false
    },
    {
      "sentence": "Because of the gradients and permeabilities for Na + and K + , we would expect potassium to diffuse out of the cell more rapidly than sodium could diffuse in .",
      "itemId": 1402872851,
      "hasCloze": true
    },
    {
      "sentence": "This means that every millisecond , a few more positive ions leave the cell than enter it .",
      "itemId": -1311932009,
      "hasCloze": false
    },
    {
      "sentence": "As a result , the outside of the membrane gains a slight surplus of positive charges , and the inside reflects a surplus of the impermeant negatively charged ions .",
      "itemId": -915820736,
      "hasCloze": true
    },
    {
      "sentence": "This situation separates positive and negative electrical charges between the inside and outside surfaces of the cell membrane .",
      "itemId": 2004404586,
      "hasCloze": false
    },
    {
      "sentence": "In order to maintain a balanced condition , for every K + moving out of the cell , there must be a K + moving back into the cell .",
      "itemId": 723305216,
      "hasCloze": false
    },
    {
      "sentence": "Similarly , for every Na + moving into the cell , a Na + must move out .",
      "itemId": -1698118038,
      "hasCloze": false
    },
    {
      "sentence": "A number of mechanisms move ions across cell membranes , but for our purposes we will consider the Na + / K + pump responsible for maintaining this balance .",
      "itemId": -1500848046,
      "hasCloze": true
    },
    {
      "sentence": "Thus , the cell continues to expend metabolic energy in the form of ATP to actively transport sodium and potassium ions in opposite directions , thereby maintaining the concentration gradients for those ions responsible for their diffusion in the first place .",
      "itemId": -326519406,
      "hasCloze": true
    },
    {
      "sentence": "For conditions to remain constant in a cell , the amount of any particular substance that enters must be balanced by the same amount leaving , and vice versa .",
      "itemId": 1300700170,
      "hasCloze": false
    },
    {
      "sentence": "The difference in electrical charge between two points is measured in units called volts .",
      "itemId": 1538556315,
      "hasCloze": false
    },
    {
      "sentence": "It is called a potential difference because it represents stored electrical energy that can be used to do work at some future time .",
      "itemId": 1577202896,
      "hasCloze": false
    },
    {
      "sentence": "The potential difference across the cell membrane is called the membrane potential and is measured in millivolts .",
      "itemId": -1457355099,
      "hasCloze": false
    },
    {
      "sentence": "In the case of a resting neuron , one that is not sending impulses or responding to other neurons , the membrane potential is termed the resting potential and for a typical neuron has a value of -LSB- ? -RSB-",
      "itemId": -526354656,
      "hasCloze": true
    },
    {
      "sentence": "70 millivolts .",
      "itemId": 828987726,
      "hasCloze": false
    },
    {
      "sentence": "The negative sign is relative to the inside of the cell and is due to the excess negative charges on the inside of the cell membrane .",
      "itemId": 1356993210,
      "hasCloze": false
    },
    {
      "sentence": "To understand how the resting potential provides the energy for sending an impulse down the axon , we must first understand how neurons respond to signals called stimuli .",
      "itemId": 1927895201,
      "hasCloze": true
    },
    {
      "sentence": "With the resting membrane potential established , sodium ions and potassium ions continue to diffuse across the cell membrane .",
      "itemId": -1840082358,
      "hasCloze": true
    },
    {
      "sentence": "The negative membrane potential helps the positively charged sodium ions enter the cell despite sodium 's low permeability , but it hinders the positively charged potassium ions from leaving the cell despite potassium 's higher permeability .",
      "itemId": -1931630643,
      "hasCloze": true
    },
    {
      "sentence": "The net effect is that three sodium ions `` leak '' into the cell for every two potassium ions that `` leak '' out .",
      "itemId": -1471890932,
      "hasCloze": true
    },
    {
      "sentence": "The Na + / K + pump balances these leaks by pumping three sodium ions out for every two potassium ions it pumps in .",
      "itemId": 196399584,
      "hasCloze": true
    },
    {
      "sentence": "There are many such `` pumps '' per cell , but they are usually referred to as singular .",
      "itemId": -1454743011,
      "hasCloze": false
    },
    {
      "sentence": "Recall from section 1.6 , Organization of the Human Body , Integration and Coordination , that neurons can conduct electrical signals .",
      "itemId": -1249731661,
      "hasCloze": true
    },
    {
      "sentence": "The key to understanding how this happens is the action potential , which is a rapid change in the membrane potential , first in a positive direction , then in a negative direction , returning to the resting potential .",
      "itemId": 1872935687,
      "hasCloze": true
    },
    {
      "sentence": "When a neuron conducts an electrical current , that current is in the form of a series of action potentials occurring in sequence along the axon , from the cell body to the axon terminal .",
      "itemId": 950045235,
      "hasCloze": true
    },
    {
      "sentence": "The next sections discuss how all of this happens .",
      "itemId": -372879039,
      "hasCloze": false
    },
    {
      "sentence": "Neurons are excitable ; that is , they can respond to changes in their surroundings .",
      "itemId": 96262102,
      "hasCloze": true
    },
    {
      "sentence": "Some neurons , for example , detect changes in temperature , light , or pressure outside the body , whereas others respond to signals from inside the body .",
      "itemId": -2119775520,
      "hasCloze": true
    },
    {
      "sentence": "In either case , such changes or stimuli usually affect the membrane potential in the region of the membrane exposed to the stimulus , causing a local potential change .",
      "itemId": -2014874725,
      "hasCloze": true
    },
    {
      "sentence": "Typically , the environmental change affects the membrane potential by opening a gated ion channel .",
      "itemId": 222772170,
      "hasCloze": false
    },
    {
      "sentence": "The effect will depend on the ion that can pass through the channel .",
      "itemId": -712889931,
      "hasCloze": false
    },
    {
      "sentence": "If , as a result , the membrane potential becomes more negative than the resting potential , the membrane is hyperpolarized .",
      "itemId": -1185440587,
      "hasCloze": true
    },
    {
      "sentence": "If the membrane becomes less negative than the resting potential , the membrane is depolarized .",
      "itemId": 1122138182,
      "hasCloze": true
    },
    {
      "sentence": "Local potential changes are graded .",
      "itemId": 322180309,
      "hasCloze": false
    },
    {
      "sentence": "This means that the degree of change in the resting potential is directly proportional to the intensity of the stimulation .",
      "itemId": -202668020,
      "hasCloze": false
    },
    {
      "sentence": "For example , if the membrane is being depolarized , the greater the stimulus , the greater the depolarization .",
      "itemId": -401044887,
      "hasCloze": true
    },
    {
      "sentence": "If and only if neurons are sufficiently depolarized , the membrane potential reaches a level called the threshold potential , which is approximately -LSB- ? -RSB-",
      "itemId": -176602201,
      "hasCloze": false
    },
    {
      "sentence": "55 millivolts in a neuron .",
      "itemId": -355931110,
      "hasCloze": false
    },
    {
      "sentence": "If threshold is reached , an action potential results .",
      "itemId": -1072549097,
      "hasCloze": false
    },
    {
      "sentence": "In many cases , a depolarizing stimulus is not sufficient to bring the postsynaptic cell to threshold .",
      "itemId": 673258798,
      "hasCloze": false
    },
    {
      "sentence": "Such a subthreshold depolarization will not result in an action potential .",
      "itemId": -1354405920,
      "hasCloze": false
    },
    {
      "sentence": "If the presynaptic neurons release more neurotransmitter , or if other neurons that synapse with the same cell have an additive effect on depolarization , threshold may be reached , and an action potential result .",
      "itemId": 622721625,
      "hasCloze": false
    },
    {
      "sentence": "The mechanism uses another type of ion channel , a voltage-gated sodium channel that opens when threshold is reached .",
      "itemId": 15840657,
      "hasCloze": true
    },
    {
      "sentence": "In a multipolar neuron , the first part of the axon , the cone-shaped axon hillock or initial segment , is often referred to as the trigger zone because it contains many such voltage-gated sodium channels .",
      "itemId": 1992659876,
      "hasCloze": true
    },
    {
      "sentence": "At the resting membrane potential , these sodium channels remain closed , but when threshold is reached , they open for an instant , briefly increasing sodium permeability .",
      "itemId": -101408936,
      "hasCloze": true
    },
    {
      "sentence": "Sodium ions diffuse inward through the open sodium channels , down their concentration gradient , aided by the attraction of the sodium ions to the negative charges on the inside of the membrane .",
      "itemId": -394700180,
      "hasCloze": true
    },
    {
      "sentence": "As the sodium ions diffuse inward , the membrane potential at the trigger zone changes from its resting value and momentarily becomes positive on the inside .",
      "itemId": 2100579123,
      "hasCloze": true
    },
    {
      "sentence": "At the peak of the action potential , the membrane potential may reach +30 millivolts or more .",
      "itemId": 206019364,
      "hasCloze": false
    },
    {
      "sentence": "The voltage-gated sodium channels quickly close , but at almost the same time , slower voltage-gated potassium channels open and briefly increase potassium permeability .",
      "itemId": 323073193,
      "hasCloze": true
    },
    {
      "sentence": "As potassium ions diffuse outward , down their concentration gradient and through the open potassium channels , the inside becomes negatively charged once more .",
      "itemId": -900620800,
      "hasCloze": true
    },
    {
      "sentence": "The membrane is thus repolarized .",
      "itemId": 1659254253,
      "hasCloze": false
    },
    {
      "sentence": "The voltage-gated potassium channels then close as well .",
      "itemId": 1598644773,
      "hasCloze": false
    },
    {
      "sentence": "These actions quickly reestablish the resting potential , which remains in the resting state until it is stimulated again .",
      "itemId": 1213662209,
      "hasCloze": true
    },
    {
      "sentence": "The number of sodium and potassium ions crossing the membrane during an action potential is extremely small , although the bioelectric effect is quite significant .",
      "itemId": -686547375,
      "hasCloze": true
    },
    {
      "sentence": "The active transport mechanism in the membrane restores and maintains the original concentrations of sodium and potassium ions .",
      "itemId": -939585643,
      "hasCloze": false
    },
    {
      "sentence": "Most voltage-gated channels in a neuron are along the axon , especially at the trigger zone .",
      "itemId": 1264683719,
      "hasCloze": true
    },
    {
      "sentence": "An action potential at the trigger zone causes a bioelectric current to flow a short distance down the axon , which stimulates the adjacent membrane to reach its threshold level , triggering another action potential .",
      "itemId": 138000390,
      "hasCloze": true
    },
    {
      "sentence": "The second action potential causes another electric current to flow farther down the axon .",
      "itemId": -584569540,
      "hasCloze": true
    },
    {
      "sentence": "This sequence of events results in the conduction of the action potential along the axon without decreasing in amplitude , even if the axon branches .",
      "itemId": -56060958,
      "hasCloze": true
    },
    {
      "sentence": "The propagation of an action potential continues to the end of the axon .",
      "itemId": 1074113798,
      "hasCloze": true
    },
    {
      "sentence": "Conduction of an impulse along an axon is similar to conduction of an impulse in a muscle fiber mentioned in section 9.2 , Skeletal Muscle Contraction , Stimulus for Contraction .",
      "itemId": 903185814,
      "hasCloze": true
    },
    {
      "sentence": "In the muscle fiber , stimulation at the motor end plate triggers an action potential that spreads over the surface of the fiber and down into its transverse tubules .",
      "itemId": 157541087,
      "hasCloze": true
    },
    {
      "sentence": "See table 10.3 for a summary of the events leading to the conduction of an action potential down an axon .",
      "itemId": 372082085,
      "hasCloze": true
    },
    {
      "sentence": "Nerve cell membrane maintains resting potential by diffusion of Na + and K + down their concentration gradients as the cell pumps them up the gradients .",
      "itemId": 11343476,
      "hasCloze": true
    },
    {
      "sentence": "Neurons receive stimulation , causing local potential changes , which may sum to reach threshold .",
      "itemId": 1695832840,
      "hasCloze": false
    },
    {
      "sentence": "If threshold is reached , sodium channels in the trigger zone of the axon open .",
      "itemId": 646479045,
      "hasCloze": false
    },
    {
      "sentence": "Sodium ions diffuse inward , depolarizing the membrane .",
      "itemId": -1241137711,
      "hasCloze": true
    },
    {
      "sentence": "Potassium channels in the membrane open .",
      "itemId": -1737550098,
      "hasCloze": false
    },
    {
      "sentence": "Potassium ions diffuse outward , repolarizing the membrane .",
      "itemId": 542967272,
      "hasCloze": true
    },
    {
      "sentence": "The resulting action potential causes an electric current that stimulates adjacent portions of the membrane .",
      "itemId": -1901344824,
      "hasCloze": true
    },
    {
      "sentence": "The action potential propagates along the length of the axon .",
      "itemId": -660391213,
      "hasCloze": false
    },
    {
      "sentence": "An action potential is an all-or-none response .",
      "itemId": -1620641717,
      "hasCloze": false
    },
    {
      "sentence": "In other words , if a neuron responds at all , it responds completely .",
      "itemId": 1734198470,
      "hasCloze": true
    },
    {
      "sentence": "Thus , an impulse is conducted whenever a stimulus of threshold intensity or above is applied to an axon and all impulses conducted on that axon are the same strength .",
      "itemId": 1202573761,
      "hasCloze": true
    },
    {
      "sentence": "A greater intensity of stimulation produces more impulses per second , not a stronger impulse .",
      "itemId": -403743880,
      "hasCloze": false
    },
    {
      "sentence": "The number of action potentials per second that an axon can generate is limited , because during an action potential , that part of the axon becomes unresponsive to another threshold stimulus .",
      "itemId": -1104777290,
      "hasCloze": true
    },
    {
      "sentence": "This brief period , called the refractory period , has two parts .",
      "itemId": -129372885,
      "hasCloze": true
    },
    {
      "sentence": "During the absolute refractory period , which lasts about 1/1 ,000 of a second , the axon 's voltage-gated sodium channels are temporarily not responsive at all , and the axon can not be stimulated .",
      "itemId": -1279763388,
      "hasCloze": false
    },
    {
      "sentence": "A relative refractory period follows , as the membrane reestablishes its resting potential .",
      "itemId": 1912624329,
      "hasCloze": true
    },
    {
      "sentence": "During this time , even though repolarization is incomplete , a stimulus of higher than usual intensity may trigger an impulse .",
      "itemId": 613753750,
      "hasCloze": false
    },
    {
      "sentence": "Rapidly , the intensity of stimulation required to trigger an impulse decreases until the axon 's original excitability is restored .",
      "itemId": 1079396807,
      "hasCloze": false
    },
    {
      "sentence": "This return to the resting state usually takes from 1 to 3 milliseconds .",
      "itemId": 798571809,
      "hasCloze": false
    },
    {
      "sentence": "The refractory period limits how many action potentials may be generated in a neuron in a given period .",
      "itemId": 1160522257,
      "hasCloze": false
    },
    {
      "sentence": "Remembering that the action potential takes about a millisecond , and adding the time of the relative refractory period , the maximum theoretical frequency of impulses in a neuron is about 700 per second .",
      "itemId": 270277154,
      "hasCloze": true
    },
    {
      "sentence": "In the body , this limit is rarely achieved -- frequencies of about 100 impulses per second are common .",
      "itemId": -1910580746,
      "hasCloze": true
    },
    {
      "sentence": "The refractory period also ensures that an action potential is conducted in only one direction , down the axon , because the area upstream from where the action potential has just occurred is still in the refractory period from the previous action potential .",
      "itemId": 545648483,
      "hasCloze": true
    },
    {
      "sentence": "An unmyelinated axon conducts an impulse over its entire surface .",
      "itemId": -888120933,
      "hasCloze": false
    },
    {
      "sentence": "A myelinated axon functions differently .",
      "itemId": 1740593436,
      "hasCloze": false
    },
    {
      "sentence": "Myelin contains a high proportion of lipid that excludes water and water-soluble substances .",
      "itemId": 343538454,
      "hasCloze": false
    },
    {
      "sentence": "Thus , myelin prevents almost all flow of ions through the membrane that it encloses and serves as an electrical insulator .",
      "itemId": -1396900750,
      "hasCloze": true
    },
    {
      "sentence": "It might seem that the myelin sheath would prevent conduction of an impulse , and this would be true if the sheath were continuous along the length of the axon .",
      "itemId": -1884620609,
      "hasCloze": true
    },
    {
      "sentence": "However , nodes of Ranvier between Schwann cells or oligodendrocytes interrupt the sheath .",
      "itemId": -12201302,
      "hasCloze": false
    },
    {
      "sentence": "At these nodes , the axon membrane has channels for sodium and potassium ions that open during a threshold depolarization .",
      "itemId": -1093930975,
      "hasCloze": false
    },
    {
      "sentence": "When a myelinated axon is stimulated to threshold , an action potential occurs at the trigger zone .",
      "itemId": 1084901721,
      "hasCloze": true
    },
    {
      "sentence": "This causes a bioelectric current to flow away from the trigger zone through the cytoplasm of the axon .",
      "itemId": -1196509633,
      "hasCloze": false
    },
    {
      "sentence": "As this local current reaches the first node , it stimulates the membrane to its threshold level , and an action potential occurs there , sending a bioelectric current to the next node downstream .",
      "itemId": 938786659,
      "hasCloze": true
    },
    {
      "sentence": "Consequently , as an impulse is conducted along a myelinated axon , action potentials occur only at the nodes .",
      "itemId": 35269491,
      "hasCloze": true
    },
    {
      "sentence": "Because the action potentials appear to jump from node to node , this type of impulse conduction is called saltatory conduction .",
      "itemId": -839950803,
      "hasCloze": true
    },
    {
      "sentence": "Conduction on myelinated axons is many times faster than conduction on unmyelinated axons The diameter of the axon affects the speed of impulse conduction -- the greater the diameter , the faster the impulse .",
      "itemId": -237421839,
      "hasCloze": true
    },
    {
      "sentence": "An impulse on a comparatively thick , myelinated axon , such as that of a motor neuron associated with a skeletal muscle , might travel 120 meters per second , whereas an impulse on a thin , unmyelinated axon , such as that of a sensory neuron associated with the skin , might move only 0.5 meter per second .",
      "itemId": -1812507191,
      "hasCloze": true
    },
    {
      "sentence": "Clinical Application 10.3 discusses factors that influence impulse conduction .",
      "itemId": 755442748,
      "hasCloze": true
    },
    {
      "sentence": "Released neurotransmitter molecules diffuse across the synaptic cleft and bind to receptors on the postsynaptic cell membrane .",
      "itemId": -1806312963,
      "hasCloze": false
    },
    {
      "sentence": "When neurotransmitters bind these receptors , they cause ion channels in the postsynaptic cells to open .",
      "itemId": 946865316,
      "hasCloze": true
    },
    {
      "sentence": "Ion channels that respond to neurotransmitter molecules are called chemically gated , in contrast to the voltage-gated ion channels that participate in action potentials .",
      "itemId": -1937443057,
      "hasCloze": true
    },
    {
      "sentence": "Changes in chemically gated ion channels create local potentials , called synaptic potentials , which enable one neuron to affect another .",
      "itemId": -1595270807,
      "hasCloze": true
    },
    {
      "sentence": "Neurotransmitters that increase postsynaptic membrane permeability to sodium ions will bring the postsynaptic membrane closer to threshold and may trigger impulses .",
      "itemId": -934533785,
      "hasCloze": false
    },
    {
      "sentence": "Such neurotransmitters are excitatory .",
      "itemId": 1094798364,
      "hasCloze": false
    },
    {
      "sentence": "Neurotransmitters that make reaching threshold less likely are called inhibitory , because they decrease the chance that an impulse will occur .",
      "itemId": -371966183,
      "hasCloze": true
    },
    {
      "sentence": "Some relatively uncommon synapses , called electrical synapses , are in certain parts of the brain and eyes .",
      "itemId": -12512586,
      "hasCloze": true
    },
    {
      "sentence": "Electrical synapses involve direct exchange of ions between neurons through gap junctions .",
      "itemId": 1024792553,
      "hasCloze": false
    },
    {
      "sentence": "Synaptic potentials can depolarize or hyperpolarize the receiving cell membrane .",
      "itemId": 2119331156,
      "hasCloze": false
    },
    {
      "sentence": "For example , if a neurotransmitter binds to a postsynaptic receptor and opens sodium ion channels , the ions diffuse inward , depolarizing the membrane , possibly triggering an action potential .",
      "itemId": 238571322,
      "hasCloze": true
    },
    {
      "sentence": "This type of membrane change is called an excitatory postsynaptic potential , and it lasts for about 15 milliseconds .",
      "itemId": 648497002,
      "hasCloze": false
    },
    {
      "sentence": "If a different neurotransmitter binds other receptors and increases membrane permeability to potassium ions , these ions diffuse outward , hyperpolarizing the membrane .",
      "itemId": 55490464,
      "hasCloze": true
    },
    {
      "sentence": "Because an action potential is now less likely to occur , this change is called an inhibitory postsynaptic potential .",
      "itemId": -1851327343,
      "hasCloze": true
    },
    {
      "sentence": "Some inhibitory neurotransmitters open chloride ion channels .",
      "itemId": -1270595892,
      "hasCloze": false
    },
    {
      "sentence": "In this case , negative chloride ions enter the cell opposing the depolarization .",
      "itemId": 1893971483,
      "hasCloze": true
    },
    {
      "sentence": "In the brain and spinal cord , each neuron may receive the synaptic knobs of a thousand or more axons on its dendrites and cell body .",
      "itemId": 1411001210,
      "hasCloze": true
    },
    {
      "sentence": "Furthermore , at any moment , some of the postsynaptic potentials are excitatory on a particular neuron , while others are inhibitory .",
      "itemId": 863233727,
      "hasCloze": false
    },
    {
      "sentence": "The integrated sum of the EPSPs and IPSPs determines whether an action potential results .",
      "itemId": -1056134418,
      "hasCloze": false
    },
    {
      "sentence": "If the net effect is more excitatory than inhibitory , threshold may be reached and an action potential triggered .",
      "itemId": -39311403,
      "hasCloze": false
    },
    {
      "sentence": "Conversely , if the net effect is inhibitory , an action potential does not occur .",
      "itemId": 1520102270,
      "hasCloze": true
    },
    {
      "sentence": "Summation of the excitatory and inhibitory effects of the postsynaptic potentials commonly takes place at the trigger zone .",
      "itemId": -543496284,
      "hasCloze": true
    },
    {
      "sentence": "This is usually in a proximal region of the axon , but in some sensory neurons it may be in the distal peripheral process .",
      "itemId": 297636903,
      "hasCloze": true
    },
    {
      "sentence": "This region has an especially low threshold for triggering an action potential .",
      "itemId": -1871306267,
      "hasCloze": false
    },
    {
      "sentence": "In this way , the trigger zone , as its name implies , serves as a `` decision-making '' part of the neuron .",
      "itemId": -1561949184,
      "hasCloze": true
    },
    {
      "sentence": "The nervous system produces at least 100 different types of neurotransmitters in the brain alone .",
      "itemId": 161586001,
      "hasCloze": false
    },
    {
      "sentence": "Some neurons release only one type , whereas others produce two or three .",
      "itemId": -139405194,
      "hasCloze": true
    },
    {
      "sentence": "Neurotransmitters include acetylcholine , which stimulates skeletal muscle contractions ; a group of compounds called monoamines , which are modified amino acids ; a group of unmodified amino acids ; and a large group of peptides , which are short chains of amino acids .",
      "itemId": -1352136865,
      "hasCloze": true
    },
    {
      "sentence": "Peptide neurotransmitters are synthesized in the rough endoplasmic reticulum of a neuron cell body and transported in vesicles down the axon to the nerve cell terminal .",
      "itemId": -963553108,
      "hasCloze": false
    },
    {
      "sentence": "Other neurotransmitters are synthesized in the cytoplasm of the nerve cell terminal and stored in vesicles .",
      "itemId": 1535678024,
      "hasCloze": false
    },
    {
      "sentence": "When an action potential passes along the membrane of a synaptic knob , it increases the membrane 's permeability to calcium ions by opening calcium ion channels .",
      "itemId": 1810783172,
      "hasCloze": true
    },
    {
      "sentence": "Calcium ions diffuse inward , and in response , some of the synaptic vesicles fuse with the presynaptic membrane and release their contents by exocytosis into the synaptic cleft .",
      "itemId": 1948544048,
      "hasCloze": false
    },
    {
      "sentence": "If multiple action potentials reach the synaptic knob , more calcium will enter .",
      "itemId": -302689800,
      "hasCloze": false
    },
    {
      "sentence": "The more calcium that enters the synaptic knob , the more vesicles release neurotransmitter .",
      "itemId": -506221883,
      "hasCloze": false
    },
    {
      "sentence": "The action of a neurotransmitter depends on the receptors at a particular synapse .",
      "itemId": 818791273,
      "hasCloze": false
    },
    {
      "sentence": "Table 10.4 lists the major neurotransmitters and their actions .",
      "itemId": -232031087,
      "hasCloze": false
    },
    {
      "sentence": "Tables 10.5 and 10.6 , respectively , list disorders and drugs that alter neurotransmitter levels .",
      "itemId": -214194669,
      "hasCloze": false
    },
    {
      "sentence": "Acetylcholine in the CNS controls skeletal muscle actions .",
      "itemId": -690875941,
      "hasCloze": false
    },
    {
      "sentence": "Acetylcholine in the PNS stimulates skeletal muscle contraction at neuromuscular junctions ; may excite or inhibit at autonomic nervous system synapses .",
      "itemId": 1534254420,
      "hasCloze": false
    },
    {
      "sentence": "Norepinephrine CNS creates a sense of well-being ; low levels may lead to depression .",
      "itemId": -518900117,
      "hasCloze": false
    },
    {
      "sentence": "Norepinephrine in the PNS may excite or inhibit autonomic nervous system actions , depending on receptors .",
      "itemId": 1408419565,
      "hasCloze": true
    },
    {
      "sentence": "Dopamine in the CNS creates a sense of well-being ; deficiency in some brain areas associated with Parkinson disease .",
      "itemId": -1271863236,
      "hasCloze": true
    },
    {
      "sentence": "Dopamine in the PNS limits actions in autonomic nervous system ; may excite or inhibit , depending on receptors .",
      "itemId": -598839670,
      "hasCloze": false
    },
    {
      "sentence": "Serotonin in the CNS is primarily inhibitory ; leads to sleepiness ; action is blocked by LSD , enhanced by selective serotonin reuptake inhibitor antidepressant drugs .",
      "itemId": 1092243635,
      "hasCloze": false
    },
    {
      "sentence": "Histamine in the CNS releases in hypothalamus and promotes alertness .",
      "itemId": 671223181,
      "hasCloze": false
    },
    {
      "sentence": "GABA and glycine in the CNS are generally inhibitory .",
      "itemId": -702826797,
      "hasCloze": false
    },
    {
      "sentence": "Glutamate in the CNS is the most abundant excitatory neurotransmitter in the CNS .",
      "itemId": 1583752233,
      "hasCloze": false
    },
    {
      "sentence": "Enkephalins and endorphins in the CNS are generally inhibitory ; reduce pain by inhibiting substance P release .",
      "itemId": -1948153013,
      "hasCloze": true
    },
    {
      "sentence": "Substance P in the PNS is excitatory and involved with pain perception .",
      "itemId": 809159548,
      "hasCloze": false
    },
    {
      "sentence": "Nitric oxide in the CNS may play a role in memory .",
      "itemId": 2104994140,
      "hasCloze": false
    },
    {
      "sentence": "Nitric oxide in the PNS is involved with vasodilation .",
      "itemId": 572918767,
      "hasCloze": false
    },
    {
      "sentence": "Clinical depression is characterized by debilitating , inexplicable sadness and is caused by deficient norepinephrine and/or serotonin .",
      "itemId": -1412344988,
      "hasCloze": false
    },
    {
      "sentence": "Epilepsy is characterized by Seizures , loss of consciousness and is caused by excess GABA that leads to excess norepinephrine and dopamine .",
      "itemId": 1098224581,
      "hasCloze": false
    },
    {
      "sentence": "Huntington disease is characterized by cognitive and behavioral changes , loss of coordination , uncontrollable dancelike movements , death and is caused by deficient GABA .",
      "itemId": 2019625219,
      "hasCloze": false
    },
    {
      "sentence": "Hypersomnia is characterized by excessive sleeping and is caused by excess serotonin .",
      "itemId": 583643902,
      "hasCloze": false
    },
    {
      "sentence": "Insomnia is characterized by inability to sleep and is caused by deficient serotonin .",
      "itemId": 799111514,
      "hasCloze": false
    },
    {
      "sentence": "Mania is characterized by elation , irritability , overtalkativeness , increased movements and is caused by excess norepinephrine .",
      "itemId": -1262410858,
      "hasCloze": false
    },
    {
      "sentence": "Parkinson disease is characterized by tremors of hands , slowed movements , muscle rigidity and is caused by deficient dopamine .",
      "itemId": 987640643,
      "hasCloze": false
    },
    {
      "sentence": "Schizophrenia is characterized by inappropriate emotional responses , hallucinations and is caused by deficient GABA that leads to excess dopamine .",
      "itemId": -1546756077,
      "hasCloze": false
    },
    {
      "sentence": "Tardive dyskinesia is characterized by uncontrollable movements of facial muscles and is caused by deficient dopamine .",
      "itemId": 340337317,
      "hasCloze": false
    },
    {
      "sentence": "Tryptophan affects serotonin by stimulates neurotransmitter synthesis and causes sleepiness .",
      "itemId": 1281552850,
      "hasCloze": false
    },
    {
      "sentence": "Reserpine affects norepinephrine by decreasing packaging of neurotransmitter into vesicles and causes decreased blood pressure .",
      "itemId": 306172087,
      "hasCloze": false
    },
    {
      "sentence": "Curare affects acetylcholine by blocking receptor binding and causes muscle paralysis .",
      "itemId": -831410559,
      "hasCloze": false
    },
    {
      "sentence": "Valium affects GABA by enhancing receptor binding and causes decreased anxiety .",
      "itemId": 484226449,
      "hasCloze": false
    },
    {
      "sentence": "Nicotine affects acetylcholine by activating receptors and causes increased alertness .",
      "itemId": 1722838375,
      "hasCloze": false
    },
    {
      "sentence": "Nicotine affects dopamine by elevating levels and causes a sense of pleasure .",
      "itemId": 898431101,
      "hasCloze": false
    },
    {
      "sentence": "Cocaine affects dopamine by blocking reuptake and causes euphoria .",
      "itemId": -1644732718,
      "hasCloze": false
    },
    {
      "sentence": "Tricyclic antidepressants affect norepinephrine by blocking reuptake and cause an antidepressant effect .",
      "itemId": 76112059,
      "hasCloze": false
    },
    {
      "sentence": "Tricyclic antidepressants affect serotonin by blocking reuptake and cause an antidepressant effect .",
      "itemId": -1438043204,
      "hasCloze": false
    },
    {
      "sentence": "Monoamine oxidase inhibitors affect norepinephrine by blocking enzymatic degradation of neurotransmitters in presynaptic cells and cause an antidepressant effect .",
      "itemId": 485449209,
      "hasCloze": false
    },
    {
      "sentence": "Selective serotonin reuptake inhibitors affects serotonin by blocking reuptake and cause antidepressant and anti-anxiety effects .",
      "itemId": 1838399874,
      "hasCloze": false
    },
    {
      "sentence": "Dual reuptake inhibitors affect serotonin and norepinephrine by blocking reuptake and cause mood elevation .",
      "itemId": -1833319370,
      "hasCloze": false
    },
    {
      "sentence": "Molecules too large for channels or carrier proteins may leave cells by exocytosis or enter by endocytosis .",
      "itemId": -711654482,
      "hasCloze": false
    },
    {
      "sentence": "A vesicle becomes part of the cell membrane after it releases its neurotransmitter .",
      "itemId": -999127211,
      "hasCloze": true
    },
    {
      "sentence": "Endocytosis eventually returns the membrane material to the cytoplasm , where it can provide material to form new secretory vesicles .",
      "itemId": 113807494,
      "hasCloze": true
    },
    {
      "sentence": "Table 10.7 summarizes this process , which is called vesicle trafficking .",
      "itemId": -1155435422,
      "hasCloze": true
    },
    {
      "sentence": "Action potential passes along an axon and over the surface of its synaptic knob .",
      "itemId": 1460512230,
      "hasCloze": false
    },
    {
      "sentence": "Synaptic knob membrane becomes more permeable to calcium ions , and they diffuse inward .",
      "itemId": -1236587044,
      "hasCloze": false
    },
    {
      "sentence": "In the presence of calcium ions , synaptic vesicles fuse to synaptic knob membrane .",
      "itemId": 936103360,
      "hasCloze": false
    },
    {
      "sentence": "Synaptic vesicles release their neurotransmitter by exocytosis into the synaptic cleft .",
      "itemId": 877612563,
      "hasCloze": false
    },
    {
      "sentence": "Synaptic vesicle membrane becomes part of the cell membrane .",
      "itemId": 1662970459,
      "hasCloze": false
    },
    {
      "sentence": "The added membrane provides material for endocytotic vesicles .",
      "itemId": -249801101,
      "hasCloze": false
    },
    {
      "sentence": "To keep signal duration short , enzymes in synaptic clefts and on postsynaptic membranes rapidly decompose some neurotransmitters .",
      "itemId": 1248046540,
      "hasCloze": false
    },
    {
      "sentence": "The enzyme acetylcholinesterase , for example , decomposes acetylcholine on postsynaptic membranes .",
      "itemId": -1571761145,
      "hasCloze": false
    },
    {
      "sentence": "Other neurotransmitters are transported back into the synaptic knob of the presynaptic neuron or into nearby neurons or neuroglia , in a process called reuptake .",
      "itemId": -157698659,
      "hasCloze": false
    },
    {
      "sentence": "The enzyme monoamine oxidase inactivates the monoamine neurotransmitters epinephrine and norepinephrine after reuptake .",
      "itemId": -52942102,
      "hasCloze": false
    },
    {
      "sentence": "This enzyme is found in mitochondria in the synaptic knob .",
      "itemId": 229808869,
      "hasCloze": false
    },
    {
      "sentence": "Destruction or removal of neurotransmitter prevents continuous stimulation of the postsynaptic neuron .",
      "itemId": 1068478657,
      "hasCloze": false
    },
    {
      "sentence": "Many neurons in the brain or spinal cord synthesize neuropeptides .",
      "itemId": -1288991630,
      "hasCloze": false
    },
    {
      "sentence": "These peptides act as neurotransmitters or as neuromodulators , which are substances that alter a neuron 's response to a neurotransmitter or block the release of a neurotransmitter .",
      "itemId": 545306248,
      "hasCloze": true
    },
    {
      "sentence": "Among the neuropeptides are the enkephalins , which are present throughout the brain and spinal cord .",
      "itemId": 2100041257,
      "hasCloze": false
    },
    {
      "sentence": "Each enkephalin molecule is a chain of five amino acids .",
      "itemId": -223552059,
      "hasCloze": false
    },
    {
      "sentence": "Synthesis of enkephalins increases during periods of painful stress , and they bind to the same receptors in the brain as the narcotic morphine .",
      "itemId": -1444802740,
      "hasCloze": false
    },
    {
      "sentence": "Enkephalins relieve pain sensations and probably have other functions .",
      "itemId": -1497071194,
      "hasCloze": false
    },
    {
      "sentence": "Another morphinelike peptide , beta endorphin , is found in the brain and cerebrospinal fluid .",
      "itemId": 1009377346,
      "hasCloze": false
    },
    {
      "sentence": "It acts longer than enkephalins and is a much more potent pain reliever .",
      "itemId": 1249227012,
      "hasCloze": false
    },
    {
      "sentence": "Clinical Application 10.4 discusses opiates in the human body .",
      "itemId": 99554760,
      "hasCloze": false
    },
    {
      "sentence": "Substance P is a neuropeptide that consists of eleven amino acids and is widely distributed .",
      "itemId": -1687975934,
      "hasCloze": false
    },
    {
      "sentence": "It functions as a neurotransmitter in the neurons that conduct impulses associated with pain into the spinal cord and on to the brain .",
      "itemId": -587738334,
      "hasCloze": true
    },
    {
      "sentence": "Enkephalins and endorphins may relieve pain by inhibiting the release of substance P from these neurons .",
      "itemId": 1274747942,
      "hasCloze": true
    },
    {
      "sentence": "The way the nervous system collects , processes , and responds to information reflects , in part , the organization of neurons and axons in the brain and spinal cord .",
      "itemId": -1834037355,
      "hasCloze": true
    },
    {
      "sentence": "Interneurons , which are the neurons completely within the CNS , are organized into neuronal pools .",
      "itemId": -1537581738,
      "hasCloze": true
    },
    {
      "sentence": "These are groups of neurons that synapse with each other and perform a common function , even though their cell bodies may be in different parts of the CNS .",
      "itemId": -1458304340,
      "hasCloze": true
    },
    {
      "sentence": "Each neuronal pool receives input from neurons .",
      "itemId": -163551229,
      "hasCloze": false
    },
    {
      "sentence": "Each pool generates output .",
      "itemId": -342707590,
      "hasCloze": false
    },
    {
      "sentence": "Neuronal pools may have excitatory or inhibitory effects on other pools or on peripheral effectors .",
      "itemId": -304669709,
      "hasCloze": false
    },
    {
      "sentence": "A neuron in a neuronal pool may be excited by some presynaptic neurons and inhibited by others .",
      "itemId": 1072819434,
      "hasCloze": false
    },
    {
      "sentence": "If the net effect is excitatory , threshold may be reached , and an impulse triggered .",
      "itemId": 1894922531,
      "hasCloze": true
    },
    {
      "sentence": "If the net effect is excitatory , but subthreshold , an impulse will not be triggered .",
      "itemId": 1343342769,
      "hasCloze": true
    },
    {
      "sentence": "Repeated impulses on an excitatory presynaptic neuron may cause that neuron to release more neurotransmitter in response to a single impulse , making it more likely to bring the postsynaptic cell to threshold .",
      "itemId": -682172951,
      "hasCloze": true
    },
    {
      "sentence": "This phenomenon is called facilitation .",
      "itemId": 1555533739,
      "hasCloze": false
    },
    {
      "sentence": "Any single neuron in a neuronal pool may receive input from two or more other neurons .",
      "itemId": -820973567,
      "hasCloze": false
    },
    {
      "sentence": "Axons originating from different neurons leading to the same postsynaptic neuron exhibit convergence .",
      "itemId": 1067920777,
      "hasCloze": false
    },
    {
      "sentence": "Incoming impulses often represent information from various sensory receptors that detect changes .",
      "itemId": 313397842,
      "hasCloze": false
    },
    {
      "sentence": "Convergence allows the nervous system to collect , process , and respond to information .",
      "itemId": 1340589924,
      "hasCloze": false
    },
    {
      "sentence": "Convergence makes it possible for a neuron to sum impulses from different sources .",
      "itemId": -467570762,
      "hasCloze": true
    },
    {
      "sentence": "For example , if a neuron receives what would be subthreshold stimulation from one presynaptic neuron , it may reach threshold if it receives additional stimulation from one or more additional presynaptic neurons at the same time .",
      "itemId": -1323841235,
      "hasCloze": true
    },
    {
      "sentence": "Thus , impulses on this postsynaptic neuron may reflect summation of input from more than one source .",
      "itemId": -1333601874,
      "hasCloze": false
    },
    {
      "sentence": "As a result , an impulse may occur in the postsynaptic neuron , travel to a particular effector , and evoke a response .",
      "itemId": -635694923,
      "hasCloze": false
    },
    {
      "sentence": "A neuron has a single axon , but axons may branch at several points .",
      "itemId": 1829029902,
      "hasCloze": false
    },
    {
      "sentence": "Therefore , a neuron of a neuronal pool may exhibit divergence by forming synapses with several other neurons .",
      "itemId": -863210415,
      "hasCloze": true
    },
    {
      "sentence": "One neuron stimulates others , each of which stimulates several others , and so forth .",
      "itemId": 393573542,
      "hasCloze": false
    },
    {
      "sentence": "Such a pattern of diverging axons allows an impulse to reach increasing numbers of neurons within the pool .",
      "itemId": -1692679407,
      "hasCloze": false
    },
    {
      "sentence": "As a result of divergence , an impulse originating from a single motor neuron in the CNS may stimulate several muscle fibers in a skeletal muscle to contract .",
      "itemId": 1830738647,
      "hasCloze": true
    },
    {
      "sentence": "Similarly , an impulse originating from a sensory receptor may diverge and reach several different regions of the CNS , where the information can be processed and evoke a response .",
      "itemId": -1994814392,
      "hasCloze": true
    },
    {
      "sentence": "The nervous system enables us to experience the world and to think and feel emotion .",
      "itemId": 561298630,
      "hasCloze": false
    },
    {
      "sentence": "This organ system is also sensitive to outside influences .",
      "itemId": -1031240485,
      "hasCloze": false
    },
    {
      "sentence": "Clinical Application 10.5 discusses one way that an outside influence can affect the nervous system -- drug addiction .",
      "itemId": -1108014630,
      "hasCloze": false
    }
  ],
  "clozes": [
    {
      "cloze": "3 , Movements Into and Out of the Cell , Diffusion , and show a net movement from areas of high concentration to areas of low concentration across a membrane as their __________ permit .",
      "itemId": -807569280,
      "clozeId": -2051418911,
      "correctResponse": "permeabilities"
    },
    {
      "cloze": "A longer process called an axon , or nerve fiber , carries the information away from the cell in the form of __________ , called impulses , which allow the neuron to communicate with other neurons and with cells outside the nervous system .",
      "itemId": -924819158,
      "clozeId": -1547653588,
      "correctResponse": "bioelectric signals"
    },
    {
      "cloze": "A longer process called an __________ , or nerve fiber , carries the information away from the cell in the form of bioelectric signals , called impulses , which allow the neuron to communicate with other neurons and with cells outside the nervous system .",
      "itemId": -924819158,
      "clozeId": -2089401128,
      "correctResponse": "axon"
    },
    {
      "cloze": "A __________ has many processes arising from its cell body .",
      "itemId": -1600162138,
      "clozeId": 974223716,
      "correctResponse": "multipolar neuron"
    },
    {
      "cloze": "A network of fine threads called __________ extends into the axon and supports it .",
      "itemId": -423183028,
      "clozeId": -854550912,
      "correctResponse": "neurofilaments"
    },
    {
      "cloze": "A network of fine threads called neurofilaments extends into the __________ and supports it .",
      "itemId": -423183028,
      "clozeId": -1899270614,
      "correctResponse": "axon"
    },
    {
      "cloze": "A number of mechanisms move ions across cell membranes , but for our purposes we will consider the __________ + / K + pump responsible for maintaining this balance .",
      "itemId": -1500848046,
      "clozeId": 293515567,
      "correctResponse": "Na"
    },
    {
      "cloze": "A __________ follows , as the membrane reestablishes its resting potential .",
      "itemId": 1912624329,
      "clozeId": 74569417,
      "correctResponse": "relative refractory period"
    },
    {
      "cloze": "A short distance from the cell body , this process divides into two branches , which really function as a single axon : One branch has __________ near a peripheral body part .",
      "itemId": -194197607,
      "clozeId": 431008319,
      "correctResponse": "dendrites"
    },
    {
      "cloze": "A __________ becomes part of the cell membrane after it releases its neurotransmitter .",
      "itemId": -999127211,
      "clozeId": 1333687078,
      "correctResponse": "vesicle"
    },
    {
      "cloze": "A vesicle becomes part of the cell membrane after it releases its __________ .",
      "itemId": -999127211,
      "clozeId": -278273021,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "Also , the cytoplasm of these cells has many negatively charged ions , which include __________ , sulfate , and proteins , that are synthesized inside the cell and can not diffuse through cell membranes .",
      "itemId": -228125780,
      "clozeId": 785937112,
      "correctResponse": "phosphate"
    },
    {
      "cloze": "An action potential at the trigger zone causes a bioelectric current to flow a short distance down the __________ , which stimulates the adjacent membrane to reach its threshold level , triggering another action potential .",
      "itemId": 138000390,
      "clozeId": -1769399580,
      "correctResponse": "axon"
    },
    {
      "cloze": "An important part of the nervous system at the cellular level is not a cell at all , but the functional connection between a neuron and the cell with which it communicates , called a __________ .",
      "itemId": 1474316769,
      "clozeId": -2050496780,
      "correctResponse": "synapse"
    },
    {
      "cloze": "An impulse on a comparatively __________ , such as that of a motor neuron associated with a skeletal muscle , might travel 120 meters per second , whereas an impulse on a thin , unmyelinated axon , such as that of a sensory neuron associated with the skin , might move only 0.5 meter per second .",
      "itemId": -1812507191,
      "clozeId": -994019610,
      "correctResponse": "thick , myelinated axon"
    },
    {
      "cloze": "An impulse on a comparatively thick , myelinated axon , such as that of a motor neuron associated with a skeletal muscle , might travel 120 meters per second , whereas an impulse on a __________ , such as that of a sensory neuron associated with the skin , might move only 0.5 meter per second .",
      "itemId": -1812507191,
      "clozeId": -856906925,
      "correctResponse": "thin , unmyelinated axon"
    },
    {
      "cloze": "An impulse on a comparatively thick , myelinated axon , such as that of a motor neuron associated with a skeletal muscle , might travel 120 meters per second , whereas an impulse on a thin , unmyelinated axon , such as that of a sensory neuron associated with the skin , might move only __________ per second .",
      "itemId": -1812507191,
      "clozeId": 1379515289,
      "correctResponse": "0.5 meter"
    },
    {
      "cloze": "As a result , the outside of the membrane gains a __________ of positive charges , and the inside reflects a surplus of the impermeant negatively charged ions .",
      "itemId": -915820736,
      "clozeId": -653799139,
      "correctResponse": "slight surplus"
    },
    {
      "cloze": "As a result of divergence , an impulse originating from a single motor neuron in the __________ may stimulate several muscle fibers in a skeletal muscle to contract .",
      "itemId": 1830738647,
      "clozeId": 1028128033,
      "correctResponse": "CNS"
    },
    {
      "cloze": "As potassium ions diffuse outward , down their __________ and through the open potassium channels , the inside becomes negatively charged once more .",
      "itemId": -900620800,
      "clozeId": -2074188935,
      "correctResponse": "concentration gradient"
    },
    {
      "cloze": "As __________ diffuse outward , down their concentration gradient and through the open potassium channels , the inside becomes negatively charged once more .",
      "itemId": -900620800,
      "clozeId": -1750538830,
      "correctResponse": "potassium ions"
    },
    {
      "cloze": "As potassium ions diffuse outward , down their concentration gradient and through the __________ , the inside becomes negatively charged once more .",
      "itemId": -900620800,
      "clozeId": -165617015,
      "correctResponse": "open potassium channels"
    },
    {
      "cloze": "As soon as the muscles contracted during the `` __________ , '' a decision in the brain stopped the action .",
      "itemId": -463805844,
      "clozeId": -630929150,
      "correctResponse": "snap"
    },
    {
      "cloze": "As the sodium ions diffuse inward , the membrane potential at the __________ from its resting value and momentarily becomes positive on the inside .",
      "itemId": 2100579123,
      "clozeId": 1327545266,
      "correctResponse": "trigger zone changes"
    },
    {
      "cloze": "As this local current reaches the first node , it stimulates the membrane to its threshold level , and an action potential occurs there , sending a bioelectric current to the __________ downstream .",
      "itemId": 938786659,
      "clozeId": -1924471346,
      "correctResponse": "next node"
    },
    {
      "cloze": "As this local current reaches the __________ , it stimulates the membrane to its threshold level , and an action potential occurs there , sending a bioelectric current to the next node downstream .",
      "itemId": 938786659,
      "clozeId": -1771664975,
      "correctResponse": "first node"
    },
    {
      "cloze": "__________ also respond to injury of brain tissue and form a special type of scar tissue , which fills spaces and closes gaps in the CNS .",
      "itemId": 182813590,
      "clozeId": 1144320699,
      "correctResponse": "Astrocytes"
    },
    {
      "cloze": "Astrocytes also respond to injury of brain tissue and form a special type of scar tissue , which fills spaces and closes gaps in the __________ .",
      "itemId": 182813590,
      "clozeId": 839130266,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Astrocytes also respond to injury of brain tissue and form a special type of scar tissue , which fills spaces and closes __________ in the CNS .",
      "itemId": 182813590,
      "clozeId": -1689268919,
      "correctResponse": "gaps"
    },
    {
      "cloze": "__________ have the following functions : structural support , formation of scar tissue , transport of substances between blood vessels and neurons , communication with one another and with neurons , mopping up excess ions and neurotransmitters , inducing synapse formation .",
      "itemId": 4453415,
      "clozeId": -1061270882,
      "correctResponse": "Astrocytes"
    },
    {
      "cloze": "Astrocytes have the following functions : structural support , formation of scar tissue , transport of substances between blood vessels and neurons , communication with one another and with neurons , mopping up excess ions and __________ , inducing synapse formation .",
      "itemId": 4453415,
      "clozeId": 1013362458,
      "correctResponse": "neurotransmitters"
    },
    {
      "cloze": "Astrocytes have the following functions : structural support , formation of scar tissue , transport of substances between blood vessels and neurons , communication with one another and with neurons , mopping up excess ions and neurotransmitters , inducing __________ .",
      "itemId": 4453415,
      "clozeId": -1659722349,
      "correctResponse": "synapse formation"
    },
    {
      "cloze": "__________ play a role in the formation of the blood-brain barrier , which restricts movement of substances between the blood and the CNS .",
      "itemId": -1010582647,
      "clozeId": -348810594,
      "correctResponse": "Astrocytes"
    },
    {
      "cloze": "Astrocytes play a role in the formation of the __________ , which restricts movement of substances between the blood and the CNS .",
      "itemId": -1010582647,
      "clozeId": 1172712961,
      "correctResponse": "blood-brain barrier"
    },
    {
      "cloze": "Astrocytes play a role in the formation of the blood-brain barrier , which restricts movement of substances between the blood and the __________ .",
      "itemId": -1010582647,
      "clozeId": 821160903,
      "correctResponse": "CNS"
    },
    {
      "cloze": "At the resting membrane potential , these sodium channels remain closed , but when threshold is reached , they open for an instant , briefly increasing __________ .",
      "itemId": -101408936,
      "clozeId": 1821121390,
      "correctResponse": "sodium permeability"
    },
    {
      "cloze": "At the resting membrane potential , these sodium channels remain closed , but when __________ is reached , they open for an instant , briefly increasing sodium permeability .",
      "itemId": -101408936,
      "clozeId": 14556473,
      "correctResponse": "threshold"
    },
    {
      "cloze": "At the resting membrane potential , these __________ remain closed , but when threshold is reached , they open for an instant , briefly increasing sodium permeability .",
      "itemId": -101408936,
      "clozeId": -560545365,
      "correctResponse": "sodium channels"
    },
    {
      "cloze": "At their __________ , the dendrites of these neurons or specialized structures associated with them act as sensory receptors , detecting changes in the outside world or in the body .",
      "itemId": -12615177,
      "clozeId": -1042971490,
      "correctResponse": "distal ends"
    },
    {
      "cloze": "At their distal ends , the __________ of these neurons or specialized structures associated with them act as sensory receptors , detecting changes in the outside world or in the body .",
      "itemId": -12615177,
      "clozeId": 588724677,
      "correctResponse": "dendrites"
    },
    {
      "cloze": "Axons that have myelin sheaths are called myelinated axons , and those that do not have these sheaths are __________ .",
      "itemId": 458242436,
      "clozeId": 603899352,
      "correctResponse": "unmyelinated axons"
    },
    {
      "cloze": "Axons that have myelin sheaths are called __________ , and those that do not have these sheaths are unmyelinated axons .",
      "itemId": 458242436,
      "clozeId": 1852168157,
      "correctResponse": "myelinated axons"
    },
    {
      "cloze": "Axons that have __________ are called myelinated axons , and those that do not have these sheaths are unmyelinated axons .",
      "itemId": 458242436,
      "clozeId": -1848201404,
      "correctResponse": "myelin sheaths"
    },
    {
      "cloze": "__________ that have myelin sheaths are called myelinated axons , and those that do not have these sheaths are unmyelinated axons .",
      "itemId": 458242436,
      "clozeId": 1111293863,
      "correctResponse": "Axons"
    },
    {
      "cloze": "Because an action potential is now less likely to occur , this change is called an __________ .",
      "itemId": -1851327343,
      "clozeId": -1806819273,
      "correctResponse": "inhibitory postsynaptic potential"
    },
    {
      "cloze": "Because of the gradients and __________ for Na + and K + , we would expect potassium to diffuse out of the cell more rapidly than sodium could diffuse in .",
      "itemId": 1402872851,
      "clozeId": -1854999828,
      "correctResponse": "permeabilities"
    },
    {
      "cloze": "Because of the __________ and permeabilities for Na + and K + , we would expect potassium to diffuse out of the cell more rapidly than sodium could diffuse in .",
      "itemId": 1402872851,
      "clozeId": 1097396786,
      "correctResponse": "gradients"
    },
    {
      "cloze": "Because of the gradients and permeabilities for __________ + and K + , we would expect potassium to diffuse out of the cell more rapidly than sodium could diffuse in .",
      "itemId": 1402872851,
      "clozeId": 1785180270,
      "correctResponse": "Na"
    },
    {
      "cloze": "Because the __________ appear to jump from node to node , this type of impulse conduction is called saltatory conduction .",
      "itemId": -839950803,
      "clozeId": 618213048,
      "correctResponse": "action potentials"
    },
    {
      "cloze": "Because the action potentials appear to jump from node to node , this type of __________ is called saltatory conduction .",
      "itemId": -839950803,
      "clozeId": 1397970994,
      "correctResponse": "impulse conduction"
    },
    {
      "cloze": "Biological messenger molecules called __________ convey this neural information .",
      "itemId": 1522889540,
      "clozeId": 1889951741,
      "correctResponse": "neurotransmitters"
    },
    {
      "cloze": "Biological messenger molecules called neurotransmitters convey this __________ .",
      "itemId": 1522889540,
      "clozeId": -1864224199,
      "correctResponse": "neural information"
    },
    {
      "cloze": "__________ called neurotransmitters convey this neural information .",
      "itemId": 1522889540,
      "clozeId": -334442565,
      "correctResponse": "Biological messenger molecules"
    },
    {
      "cloze": "__________ are found in specialized parts of the eyes , nose , and ears .",
      "itemId": 92826784,
      "clozeId": 772193213,
      "correctResponse": "Bipolar neurons"
    },
    {
      "cloze": "Calcium ions are less able to cross the resting cell membrane than are either sodium ions or potassium ions , and have a special role in neuron function , described in section 10.7 , Synaptic Transmission , __________ .",
      "itemId": 1869311136,
      "clozeId": -1179985945,
      "correctResponse": "Neurotransmitters"
    },
    {
      "cloze": "Calcium ions are less able to cross the resting cell membrane than are either sodium ions or potassium ions , and have a special role in neuron function , described in section 10.7 , __________ , Neurotransmitters .",
      "itemId": 1869311136,
      "clozeId": -524861657,
      "correctResponse": "Synaptic Transmission"
    },
    {
      "cloze": "Changes in chemically gated ion channels create local potentials , called __________ , which enable one neuron to affect another .",
      "itemId": -1595270807,
      "clozeId": 1556109681,
      "correctResponse": "synaptic potentials"
    },
    {
      "cloze": "Changes in chemically gated ion channels create __________ , called synaptic potentials , which enable one neuron to affect another .",
      "itemId": -1595270807,
      "clozeId": 876562087,
      "correctResponse": "local potentials"
    },
    {
      "cloze": "Changes in chemically gated ion channels create local potentials , called synaptic potentials , which enable __________ to affect another .",
      "itemId": -1595270807,
      "clozeId": -1659128516,
      "correctResponse": "one neuron"
    },
    {
      "cloze": "Changes in chemically gated __________ create local potentials , called synaptic potentials , which enable one neuron to affect another .",
      "itemId": -1595270807,
      "clozeId": 683205457,
      "correctResponse": "ion channels"
    },
    {
      "cloze": "Clinical Application 10.2 discusses multiple __________ , a condition in which neurons in the brain and spinal cord lose their myelin .",
      "itemId": -312252064,
      "clozeId": 1936512743,
      "correctResponse": "sclerosis"
    },
    {
      "cloze": "Clinical Application 10.3 discusses factors that influence __________ .",
      "itemId": 755442748,
      "clozeId": -1445440037,
      "correctResponse": "impulse conduction"
    },
    {
      "cloze": "Conduction of an impulse along an __________ is similar to conduction of an impulse in a muscle fiber mentioned in section 9.2 , Skeletal Muscle Contraction , Stimulus for Contraction .",
      "itemId": 903185814,
      "clozeId": -501418312,
      "correctResponse": "axon"
    },
    {
      "cloze": "Conduction of an impulse along an axon is similar to __________ of an impulse in a muscle fiber mentioned in section 9.2 , Skeletal Muscle Contraction , Stimulus for Contraction .",
      "itemId": 903185814,
      "clozeId": 1866471714,
      "correctResponse": "conduction"
    },
    {
      "cloze": "__________ of an impulse along an axon is similar to conduction of an impulse in a muscle fiber mentioned in section 9.2 , Skeletal Muscle Contraction , Stimulus for Contraction .",
      "itemId": 903185814,
      "clozeId": 1848173962,
      "correctResponse": "Conduction"
    },
    {
      "cloze": "Conduction on myelinated axons is many times faster than conduction on __________ The diameter of the axon affects the speed of impulse conduction -- the greater the diameter , the faster the impulse .",
      "itemId": -237421839,
      "clozeId": -156114705,
      "correctResponse": "unmyelinated axons"
    },
    {
      "cloze": "Conduction on __________ is many times faster than conduction on unmyelinated axons The diameter of the axon affects the speed of impulse conduction -- the greater the diameter , the faster the impulse .",
      "itemId": -237421839,
      "clozeId": -269004182,
      "correctResponse": "myelinated axons"
    },
    {
      "cloze": "Consequently , as an impulse is conducted along a __________ , action potentials occur only at the nodes .",
      "itemId": 35269491,
      "clozeId": -852077151,
      "correctResponse": "myelinated axon"
    },
    {
      "cloze": "Consequently , as an impulse is conducted along a myelinated axon , __________ occur only at the nodes .",
      "itemId": 35269491,
      "clozeId": 1220118226,
      "correctResponse": "action potentials"
    },
    {
      "cloze": "Consequently , as an impulse is conducted along a myelinated axon , action potentials occur only at the __________ .",
      "itemId": 35269491,
      "clozeId": -2036208600,
      "correctResponse": "nodes"
    },
    {
      "cloze": "Consequently , the __________ of a damaged axon that begins to grow has no tube of sheath cells to guide it .",
      "itemId": -641802462,
      "clozeId": -1556387217,
      "correctResponse": "proximal end"
    },
    {
      "cloze": "Consequently , the proximal end of a damaged axon that begins to grow has no tube of __________ to guide it .",
      "itemId": -641802462,
      "clozeId": -1463328996,
      "correctResponse": "sheath cells"
    },
    {
      "cloze": "Consequently , the proximal end of a damaged __________ that begins to grow has no tube of sheath cells to guide it .",
      "itemId": -641802462,
      "clozeId": -1010251500,
      "correctResponse": "axon"
    },
    {
      "cloze": "__________ makes it possible for a neuron to sum impulses from different sources .",
      "itemId": -467570762,
      "clozeId": -1761426787,
      "correctResponse": "Convergence"
    },
    {
      "cloze": "Convergence makes it possible for a __________ to sum impulses from different sources .",
      "itemId": -467570762,
      "clozeId": -301583867,
      "correctResponse": "neuron"
    },
    {
      "cloze": "Conversely , if the __________ is inhibitory , an action potential does not occur .",
      "itemId": 1520102270,
      "clozeId": -845991588,
      "correctResponse": "net effect"
    },
    {
      "cloze": "__________ in the CNS creates a sense of well-being ; deficiency in some brain areas associated with Parkinson disease .",
      "itemId": -1271863236,
      "clozeId": 2096956819,
      "correctResponse": "Dopamine"
    },
    {
      "cloze": "Dopamine in the __________ creates a sense of well-being ; deficiency in some brain areas associated with Parkinson disease .",
      "itemId": -1271863236,
      "clozeId": 1623098734,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Dopamine in the CNS creates a sense of well-being ; deficiency in some brain areas associated with __________ .",
      "itemId": -1271863236,
      "clozeId": 1506863547,
      "correctResponse": "Parkinson disease"
    },
    {
      "cloze": "__________ must consider the barrier when formulating drugs that act in the brain , including chemicals that let the drug through .",
      "itemId": -1232560071,
      "clozeId": 140731020,
      "correctResponse": "Drug developers"
    },
    {
      "cloze": "Each __________ has a single process extending from its cell body .",
      "itemId": 1148593998,
      "clozeId": -2141543313,
      "correctResponse": "unipolar neuron"
    },
    {
      "cloze": "__________ eventually returns the membrane material to the cytoplasm , where it can provide material to form new secretory vesicles .",
      "itemId": 113807494,
      "clozeId": -68296456,
      "correctResponse": "Endocytosis"
    },
    {
      "cloze": "Endocytosis eventually returns the membrane material to the cytoplasm , where it can provide material to form __________ .",
      "itemId": 113807494,
      "clozeId": -1677155908,
      "correctResponse": "new secretory vesicles"
    },
    {
      "cloze": "Endocytosis eventually returns the membrane material to the __________ , where it can provide material to form new secretory vesicles .",
      "itemId": 113807494,
      "clozeId": -1879113302,
      "correctResponse": "cytoplasm"
    },
    {
      "cloze": "__________ and endorphins in the CNS are generally inhibitory ; reduce pain by inhibiting substance P release .",
      "itemId": -1948153013,
      "clozeId": -2091148077,
      "correctResponse": "Enkephalins"
    },
    {
      "cloze": "Enkephalins and endorphins in the __________ are generally inhibitory ; reduce pain by inhibiting substance P release .",
      "itemId": -1948153013,
      "clozeId": -2119392779,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Enkephalins and __________ in the CNS are generally inhibitory ; reduce pain by inhibiting substance P release .",
      "itemId": -1948153013,
      "clozeId": -2129496027,
      "correctResponse": "endorphins"
    },
    {
      "cloze": "__________ and endorphins may relieve pain by inhibiting the release of substance P from these neurons .",
      "itemId": 1274747942,
      "clozeId": 1007414970,
      "correctResponse": "Enkephalins"
    },
    {
      "cloze": "Enkephalins and __________ may relieve pain by inhibiting the release of substance P from these neurons .",
      "itemId": 1274747942,
      "clozeId": -797173964,
      "correctResponse": "endorphins"
    },
    {
      "cloze": "Enkephalins and endorphins may relieve pain by inhibiting the release of substance P from these __________ .",
      "itemId": 1274747942,
      "clozeId": -2132520980,
      "correctResponse": "neurons"
    },
    {
      "cloze": "Ependyma form a porous layer through which substances diffuse between the interstitial fluid of the brain and spinal cord and the __________ .",
      "itemId": 43193760,
      "clozeId": 2055039407,
      "correctResponse": "cerebrospinal fluid"
    },
    {
      "cloze": "Ependyma form a porous layer through which substances diffuse between the __________ of the brain and spinal cord and the cerebrospinal fluid .",
      "itemId": 43193760,
      "clozeId": 516883568,
      "correctResponse": "interstitial fluid"
    },
    {
      "cloze": "Ependyma form a __________ through which substances diffuse between the interstitial fluid of the brain and spinal cord and the cerebrospinal fluid .",
      "itemId": 43193760,
      "clozeId": 379062597,
      "correctResponse": "porous layer"
    },
    {
      "cloze": "Ependymal cells also cover the specialized capillaries called __________ associated with the ventricles of the brain .",
      "itemId": 2038842525,
      "clozeId": -1108957704,
      "correctResponse": "choroid plexuses"
    },
    {
      "cloze": "__________ also cover the specialized capillaries called choroid plexuses associated with the ventricles of the brain .",
      "itemId": 2038842525,
      "clozeId": 1283781459,
      "correctResponse": "Ependymal cells"
    },
    {
      "cloze": "Ependymal cells also cover the specialized capillaries called choroid plexuses associated with the __________ of the brain .",
      "itemId": 2038842525,
      "clozeId": -2032237488,
      "correctResponse": "ventricles"
    },
    {
      "cloze": "Ependymal cells also form a __________ that covers the inside of spaces in the brain called ventricles .",
      "itemId": -1880071343,
      "clozeId": 152157432,
      "correctResponse": "one-cell-thick epithelial-like membrane"
    },
    {
      "cloze": "__________ also form a one-cell-thick epithelial-like membrane that covers the inside of spaces in the brain called ventricles .",
      "itemId": -1880071343,
      "clozeId": -1430700293,
      "correctResponse": "Ependymal cells"
    },
    {
      "cloze": "Ependymal cells also form a one-cell-thick epithelial-like membrane that covers the inside of spaces in the brain called __________ .",
      "itemId": -1880071343,
      "clozeId": 1803559864,
      "correctResponse": "ventricles"
    },
    {
      "cloze": "Figure 10.3 shows some of the other structures common to __________ .",
      "itemId": -48499052,
      "clozeId": -499897386,
      "correctResponse": "neurons"
    },
    {
      "cloze": "For an ion to diffuse across the cell membrane requires __________ for that ion and membrane permeability to that ion .",
      "itemId": -2059024254,
      "clozeId": 212557095,
      "correctResponse": "both a concentration gradient"
    },
    {
      "cloze": "For an ion to diffuse across the cell membrane requires both a concentration gradient for that ion and __________ to that ion .",
      "itemId": -2059024254,
      "clozeId": 1065194922,
      "correctResponse": "membrane permeability"
    },
    {
      "cloze": "For example , if a neuron receives what would be subthreshold stimulation from one presynaptic neuron , it may reach threshold if it receives additional stimulation from __________ at the same time .",
      "itemId": -1323841235,
      "clozeId": 723149962,
      "correctResponse": "one or more additional presynaptic neurons"
    },
    {
      "cloze": "For example , if a neuron receives what would be subthreshold stimulation from __________ , it may reach threshold if it receives additional stimulation from one or more additional presynaptic neurons at the same time .",
      "itemId": -1323841235,
      "clozeId": 207837152,
      "correctResponse": "one presynaptic neuron"
    },
    {
      "cloze": "For example , if a neurotransmitter binds to a __________ and opens sodium ion channels , the ions diffuse inward , depolarizing the membrane , possibly triggering an action potential .",
      "itemId": 238571322,
      "clozeId": 330546575,
      "correctResponse": "postsynaptic receptor"
    },
    {
      "cloze": "For example , if a __________ binds to a postsynaptic receptor and opens sodium ion channels , the ions diffuse inward , depolarizing the membrane , possibly triggering an action potential .",
      "itemId": 238571322,
      "clozeId": 1597878610,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "For example , if injury or disease separates an axon in a peripheral nerve from its cell body , the distal portion of the axon and its myelin sheath deteriorate within a few weeks , although the Schwann cells and __________ remain .",
      "itemId": -837469695,
      "clozeId": -243617072,
      "correctResponse": "neurilemma"
    },
    {
      "cloze": "For example , if injury or disease separates an axon in a peripheral nerve from its cell body , the distal portion of the axon and its myelin sheath deteriorate within a few weeks , although the __________ and neurilemma remain .",
      "itemId": -837469695,
      "clozeId": 1146086878,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "For example , if injury or disease separates an axon in a peripheral nerve from its cell body , the distal portion of the axon and its __________ deteriorate within a few weeks , although the Schwann cells and neurilemma remain .",
      "itemId": -837469695,
      "clozeId": -345389366,
      "correctResponse": "myelin sheath"
    },
    {
      "cloze": "For example , if injury or disease separates an axon in a peripheral nerve from its cell body , the __________ of the axon and its myelin sheath deteriorate within a few weeks , although the Schwann cells and neurilemma remain .",
      "itemId": -837469695,
      "clozeId": 1714214907,
      "correctResponse": "distal portion"
    },
    {
      "cloze": "For example , if injury or disease separates an axon in a __________ from its cell body , the distal portion of the axon and its myelin sheath deteriorate within a few weeks , although the Schwann cells and neurilemma remain .",
      "itemId": -837469695,
      "clozeId": -400451025,
      "correctResponse": "peripheral nerve"
    },
    {
      "cloze": "For example , if injury or disease separates an __________ in a peripheral nerve from its cell body , the distal portion of the __________ and its myelin sheath deteriorate within a few weeks , although the Schwann cells and neurilemma remain .",
      "itemId": -837469695,
      "clozeId": -2094646687,
      "correctResponse": "axon"
    },
    {
      "cloze": "For example , if the membrane is being depolarized , the greater the stimulus , the greater the __________ .",
      "itemId": -401044887,
      "clozeId": -1829148854,
      "correctResponse": "depolarization"
    },
    {
      "cloze": "For example , when motor neurons stimulate muscle cells , the muscle cells contract ; when motor neurons stimulate glands , the glands release __________ .",
      "itemId": -1018525892,
      "clozeId": 1015965277,
      "correctResponse": "secretions"
    },
    {
      "cloze": "Gap junctions link astrocytes to one another , forming __________ through which calcium ions travel , possibly stimulating neurons .",
      "itemId": 673678717,
      "clozeId": -1036625395,
      "correctResponse": "protein-lined channels"
    },
    {
      "cloze": "Gap junctions link __________ to one another , forming protein-lined channels through which calcium ions travel , possibly stimulating neurons .",
      "itemId": 673678717,
      "clozeId": 1921284784,
      "correctResponse": "astrocytes"
    },
    {
      "cloze": "__________ link astrocytes to one another , forming protein-lined channels through which calcium ions travel , possibly stimulating neurons .",
      "itemId": 673678717,
      "clozeId": 427479952,
      "correctResponse": "Gap junctions"
    },
    {
      "cloze": "Here , gap junctions join __________ , allowing free exchange between cells .",
      "itemId": -760404390,
      "clozeId": 978522086,
      "correctResponse": "ependymal cells"
    },
    {
      "cloze": "Here , __________ join ependymal cells , allowing free exchange between cells .",
      "itemId": -760404390,
      "clozeId": -1275962191,
      "correctResponse": "gap junctions"
    },
    {
      "cloze": "If , as a result , the __________ potential becomes more negative than the resting potential , the __________ is hyperpolarized .",
      "itemId": -1185440587,
      "clozeId": -1915629451,
      "correctResponse": "membrane"
    },
    {
      "cloze": "If a __________ binds other receptors and increases membrane permeability to potassium ions , these ions diffuse outward , hyperpolarizing the membrane .",
      "itemId": 55490464,
      "clozeId": -1662053501,
      "correctResponse": "different neurotransmitter"
    },
    {
      "cloze": "If a different neurotransmitter binds other receptors and increases __________ to potassium ions , these ions diffuse outward , hyperpolarizing the membrane .",
      "itemId": 55490464,
      "clozeId": -1454061984,
      "correctResponse": "membrane permeability"
    },
    {
      "cloze": "If an axon of a neuron within the CNS is separated from its cell body , the distal portion of the axon will degenerate , but more slowly than a separated axon in the __________ .",
      "itemId": 1714454419,
      "clozeId": -876153684,
      "correctResponse": "PNS"
    },
    {
      "cloze": "If an axon of a neuron within the __________ is separated from its cell body , the distal portion of the axon will degenerate , but more slowly than a separated axon in the PNS .",
      "itemId": 1714454419,
      "clozeId": -163015179,
      "correctResponse": "CNS"
    },
    {
      "cloze": "If an axon of a neuron within the CNS is separated from its cell body , the __________ of the axon will degenerate , but more slowly than a separated axon in the PNS .",
      "itemId": 1714454419,
      "clozeId": 1528760929,
      "correctResponse": "distal portion"
    },
    {
      "cloze": "If the __________ becomes less negative than the resting potential , the __________ is depolarized .",
      "itemId": 1122138182,
      "clozeId": 465571430,
      "correctResponse": "membrane"
    },
    {
      "cloze": "If the net effect is excitatory , but subthreshold , an __________ will not be triggered .",
      "itemId": 1343342769,
      "clozeId": 57618098,
      "correctResponse": "impulse"
    },
    {
      "cloze": "If the net effect is excitatory , __________ may be reached , and an impulse triggered .",
      "itemId": 1894922531,
      "clozeId": -256142662,
      "correctResponse": "threshold"
    },
    {
      "cloze": "In Huntington disease , which causes uncontrollable movements and cognitive impairment , __________ in the brain release a toxin that damages neurons .",
      "itemId": 713727445,
      "clozeId": -1677496104,
      "correctResponse": "microglia"
    },
    {
      "cloze": "In __________ , which causes uncontrollable movements and cognitive impairment , microglia in the brain release a toxin that damages neurons .",
      "itemId": 713727445,
      "clozeId": -883244105,
      "correctResponse": "Huntington disease"
    },
    {
      "cloze": "In Huntington disease , which causes __________ and cognitive impairment , microglia in the brain release a toxin that damages neurons .",
      "itemId": 713727445,
      "clozeId": -902559381,
      "correctResponse": "uncontrollable movements"
    },
    {
      "cloze": "In Huntington disease , which causes uncontrollable movements and cognitive impairment , microglia in the brain release a __________ that damages neurons .",
      "itemId": 713727445,
      "clozeId": -958387703,
      "correctResponse": "toxin"
    },
    {
      "cloze": "In Huntington disease , which causes uncontrollable movements and cognitive __________ , microglia in the brain release a toxin that damages neurons .",
      "itemId": 713727445,
      "clozeId": 1918801345,
      "correctResponse": "impairment"
    },
    {
      "cloze": "In a __________ , the first part of the axon , the cone-shaped axon hillock or initial segment , is often referred to as the trigger zone because it contains many such voltage-gated sodium channels .",
      "itemId": 1992659876,
      "clozeId": 1331738520,
      "correctResponse": "multipolar neuron"
    },
    {
      "cloze": "In a multipolar neuron , the first part of the axon , the cone-shaped axon hillock or initial segment , is often referred to as the trigger zone because it contains __________ .",
      "itemId": 1992659876,
      "clozeId": 690722305,
      "correctResponse": "many such voltage-gated sodium channels"
    },
    {
      "cloze": "In a multipolar neuron , the first part of the axon , the __________ or initial segment , is often referred to as the trigger zone because it contains many such voltage-gated sodium channels .",
      "itemId": 1992659876,
      "clozeId": 1526826253,
      "correctResponse": "cone-shaped axon hillock"
    },
    {
      "cloze": "In cell culture experiments , certain types of __________ to form and maintain synapses .",
      "itemId": -221760922,
      "clozeId": -1550048482,
      "correctResponse": "neuroglia signal neurons"
    },
    {
      "cloze": "In cell culture experiments , certain types of neuroglia signal neurons to form and maintain __________ .",
      "itemId": -221760922,
      "clozeId": 66705332,
      "correctResponse": "synapses"
    },
    {
      "cloze": "In either case , such changes or __________ usually affect the membrane potential in the region of the membrane exposed to the stimulus , causing a local potential change .",
      "itemId": -2014874725,
      "clozeId": 1331841076,
      "correctResponse": "stimuli"
    },
    {
      "cloze": "In one familial form of amyotrophic lateral sclerosis , __________ release a toxin that destroys motor neurons , causing progressive weakness .",
      "itemId": -904906666,
      "clozeId": 1491597467,
      "correctResponse": "astrocytes"
    },
    {
      "cloze": "In __________ of amyotrophic lateral sclerosis , astrocytes release a toxin that destroys motor neurons , causing progressive weakness .",
      "itemId": -904906666,
      "clozeId": 103474685,
      "correctResponse": "one familial form"
    },
    {
      "cloze": "In one familial form of amyotrophic lateral sclerosis , astrocytes release a __________ that destroys motor neurons , causing progressive weakness .",
      "itemId": -904906666,
      "clozeId": -815358042,
      "correctResponse": "toxin"
    },
    {
      "cloze": "In other words , if a __________ responds at all , it responds completely .",
      "itemId": 1734198470,
      "clozeId": -310757685,
      "correctResponse": "neuron"
    },
    {
      "cloze": "In the CNS , myelin is produced by a type of neuroglia called an __________ rather than by a Schwann cell .",
      "itemId": -1112609839,
      "clozeId": -369645262,
      "correctResponse": "oligodendrocyte"
    },
    {
      "cloze": "In the CNS , myelin is produced by a type of __________ called an oligodendrocyte rather than by a Schwann cell .",
      "itemId": -1112609839,
      "clozeId": 832482973,
      "correctResponse": "neuroglia"
    },
    {
      "cloze": "In the CNS , myelin is produced by a type of neuroglia called an oligodendrocyte rather than by a __________ .",
      "itemId": -1112609839,
      "clozeId": 1728742137,
      "correctResponse": "Schwann cell"
    },
    {
      "cloze": "In the __________ , myelin is produced by a type of neuroglia called an oligodendrocyte rather than by a Schwann cell .",
      "itemId": -1112609839,
      "clozeId": 1952421431,
      "correctResponse": "CNS"
    },
    {
      "cloze": "In the PNS , neuroglia called Schwann cells encase the large axons of peripheral neurons in __________ .",
      "itemId": -2035780688,
      "clozeId": -1039973935,
      "correctResponse": "lipid-rich sheaths"
    },
    {
      "cloze": "In the __________ , neuroglia called Schwann cells encase the large axons of peripheral neurons in lipid-rich sheaths .",
      "itemId": -2035780688,
      "clozeId": 1297166013,
      "correctResponse": "PNS"
    },
    {
      "cloze": "In the PNS , __________ called Schwann cells encase the large axons of peripheral neurons in lipid-rich sheaths .",
      "itemId": -2035780688,
      "clozeId": -267899386,
      "correctResponse": "neuroglia"
    },
    {
      "cloze": "In the PNS , neuroglia called __________ encase the large axons of peripheral neurons in lipid-rich sheaths .",
      "itemId": -2035780688,
      "clozeId": -900689769,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "In the PNS , neuroglia called Schwann cells encase the __________ of peripheral neurons in lipid-rich sheaths .",
      "itemId": -2035780688,
      "clozeId": -1516215026,
      "correctResponse": "large axons"
    },
    {
      "cloze": "In the PNS , neuroglia called Schwann cells encase the large axons of __________ in lipid-rich sheaths .",
      "itemId": -2035780688,
      "clozeId": -1659039414,
      "correctResponse": "peripheral neurons"
    },
    {
      "cloze": "In the body , this limit is rarely achieved -- __________ of about 100 impulses per second are common .",
      "itemId": -1910580746,
      "clozeId": -1305037088,
      "correctResponse": "frequencies"
    },
    {
      "cloze": "In the brain and spinal cord , each neuron may receive the __________ of a thousand or more axons on its dendrites and cell body .",
      "itemId": 1411001210,
      "clozeId": 1045438560,
      "correctResponse": "synaptic knobs"
    },
    {
      "cloze": "In the brain and spinal cord , each neuron may receive the synaptic knobs of a __________ on its dendrites and cell body .",
      "itemId": 1411001210,
      "clozeId": -862390609,
      "correctResponse": "thousand or more axons"
    },
    {
      "cloze": "In the brain and spinal cord , each neuron may receive the synaptic knobs of a thousand or more axons on its __________ and cell body .",
      "itemId": 1411001210,
      "clozeId": 144844614,
      "correctResponse": "dendrites"
    },
    {
      "cloze": "In the case of a resting neuron , one that is not sending impulses or responding to other neurons , the membrane potential is termed the resting potential and for a __________ has a value of -LSB- ? -RSB-",
      "itemId": -526354656,
      "clozeId": 1442800823,
      "correctResponse": "typical neuron"
    },
    {
      "cloze": "In the muscle fiber , stimulation at the motor end plate triggers an action potential that spreads over the surface of the fiber and down into its __________ .",
      "itemId": 157541087,
      "clozeId": 2045195206,
      "correctResponse": "transverse tubules"
    },
    {
      "cloze": "In the muscle fiber , __________ at the motor end plate triggers an action potential that spreads over the surface of the fiber and down into its transverse tubules .",
      "itemId": 157541087,
      "clozeId": -621290028,
      "correctResponse": "stimulation"
    },
    {
      "cloze": "In the peripheral nervous system , such bundles of __________ are called nerves .",
      "itemId": 1569841675,
      "clozeId": 2140850626,
      "correctResponse": "axons"
    },
    {
      "cloze": "In the __________ , such bundles of axons are called nerves .",
      "itemId": 1569841675,
      "clozeId": 48254104,
      "correctResponse": "peripheral nervous system"
    },
    {
      "cloze": "In the peripheral nervous system , __________ of axons are called nerves .",
      "itemId": 1569841675,
      "clozeId": 715654345,
      "correctResponse": "such bundles"
    },
    {
      "cloze": "In the time it took to do that , a decision made in a part of your brain that controls skeletal muscles resulted in impulses along motor neuron axons to the muscles in your hand , releasing acetylcholine at __________ .",
      "itemId": 236861440,
      "clozeId": 476838646,
      "correctResponse": "neuromuscular junctions"
    },
    {
      "cloze": "In the time it took to do that , a decision made in a part of your brain that controls skeletal muscles resulted in impulses along __________ to the muscles in your hand , releasing acetylcholine at neuromuscular junctions .",
      "itemId": 236861440,
      "clozeId": -2130062861,
      "correctResponse": "motor neuron axons"
    },
    {
      "cloze": "In the time it took to do that , a decision made in a part of your brain that controls skeletal muscles resulted in impulses along motor neuron axons to the muscles in your hand , releasing __________ at neuromuscular junctions .",
      "itemId": 236861440,
      "clozeId": 920992390,
      "correctResponse": "acetylcholine"
    },
    {
      "cloze": "In this activity , called axonal transport , movement occurs in both directions between the cell body and the ends of the __________ .",
      "itemId": 2026354652,
      "clozeId": 2087461434,
      "correctResponse": "axon"
    },
    {
      "cloze": "In this case , negative chloride ions enter the cell opposing the __________ .",
      "itemId": 1893971483,
      "clozeId": -1451094032,
      "correctResponse": "depolarization"
    },
    {
      "cloze": "In this way , the nervous system helps maintain __________ .",
      "itemId": -1270052926,
      "clozeId": 1582700937,
      "correctResponse": "homeostasis"
    },
    {
      "cloze": "In this way , the trigger zone , as its name implies , serves as a `` __________ of the neuron .",
      "itemId": -1561949184,
      "clozeId": -1523144239,
      "correctResponse": "decision-making '' part"
    },
    {
      "cloze": "Injury to the cell body usually kills the neuron , and because mature neurons do not divide , the destroyed cell is not replaced unless __________ are stimulated to proliferate .",
      "itemId": 896685563,
      "clozeId": -1609305290,
      "correctResponse": "neural stem cells"
    },
    {
      "cloze": "__________ , which are the neurons completely within the CNS , are organized into neuronal pools .",
      "itemId": -1537581738,
      "clozeId": -1326523442,
      "correctResponse": "Interneurons"
    },
    {
      "cloze": "Interneurons , which are the neurons completely within the CNS , are organized into __________ .",
      "itemId": -1537581738,
      "clozeId": 232124047,
      "correctResponse": "neuronal pools"
    },
    {
      "cloze": "Interneurons , which are the neurons completely within the __________ , are organized into neuronal pools .",
      "itemId": -1537581738,
      "clozeId": -852680262,
      "correctResponse": "CNS"
    },
    {
      "cloze": "__________ relay information from one part of the brain or spinal cord to another .",
      "itemId": -1000653490,
      "clozeId": -1563082014,
      "correctResponse": "Interneurons"
    },
    {
      "cloze": "__________ replay information between neurons in the brain and spinal cord .",
      "itemId": 342485655,
      "clozeId": -998459191,
      "correctResponse": "Interneurons"
    },
    {
      "cloze": "Interneurons __________ between neurons in the brain and spinal cord .",
      "itemId": 342485655,
      "clozeId": -590809514,
      "correctResponse": "replay information"
    },
    {
      "cloze": "Ion channels that respond to neurotransmitter molecules are called chemically gated , in contrast to the __________ that participate in action potentials .",
      "itemId": -1937443057,
      "clozeId": -708254481,
      "correctResponse": "voltage-gated ion channels"
    },
    {
      "cloze": "Ion channels that respond to __________ are called chemically gated , in contrast to the voltage-gated ion channels that participate in action potentials .",
      "itemId": -1937443057,
      "clozeId": -2060861256,
      "correctResponse": "neurotransmitter molecules"
    },
    {
      "cloze": "Ion channels that respond to neurotransmitter molecules are called chemically gated , in contrast to the voltage-gated ion channels that participate in __________ .",
      "itemId": -1937443057,
      "clozeId": -1079114982,
      "correctResponse": "action potentials"
    },
    {
      "cloze": "__________ that respond to neurotransmitter molecules are called chemically gated , in contrast to the voltage-gated ion channels that participate in action potentials .",
      "itemId": -1937443057,
      "clozeId": 856206535,
      "correctResponse": "Ion channels"
    },
    {
      "cloze": "It functions as a __________ in the neurons that conduct impulses associated with pain into the spinal cord and on to the brain .",
      "itemId": -587738334,
      "clozeId": 994586722,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "It is a __________ because the two cells do not actually touch .",
      "itemId": 1822170287,
      "clozeId": -874356116,
      "correctResponse": "functional connection"
    },
    {
      "cloze": "It is also in part due to channels in the cell membrane that determine __________ to these ions .",
      "itemId": 2014021445,
      "clozeId": 1535690431,
      "correctResponse": "membrane permeability"
    },
    {
      "cloze": "It might seem that the __________ would prevent conduction of an impulse , and this would be true if the sheath were continuous along the length of the axon .",
      "itemId": -1884620609,
      "clozeId": -1544020996,
      "correctResponse": "myelin sheath"
    },
    {
      "cloze": "__________ whose cell bodies lie within the brain or spinal cord are of this type .",
      "itemId": 585659350,
      "clozeId": -302819283,
      "correctResponse": "Most neurons"
    },
    {
      "cloze": "__________ in a neuron are along the axon , especially at the trigger zone .",
      "itemId": 1264683719,
      "clozeId": 1827566828,
      "correctResponse": "Most voltage-gated channels"
    },
    {
      "cloze": "Most voltage-gated channels in a neuron are along the __________ , especially at the trigger zone .",
      "itemId": 1264683719,
      "clozeId": 319435667,
      "correctResponse": "axon"
    },
    {
      "cloze": "Motor neurons conduct impulses from the brain or spinal cord out to __________ -- muscles or glands .",
      "itemId": 165659868,
      "clozeId": -827185835,
      "correctResponse": "effectors"
    },
    {
      "cloze": "Much of the work of the nervous system is to send and receive chemical messages at __________ .",
      "itemId": 508291767,
      "clozeId": -809897741,
      "correctResponse": "synapses"
    },
    {
      "cloze": "__________ are the most common type of neuron in the brain and spinal cord ; also found in ganglia of the autonomic nervous system .",
      "itemId": -1977927324,
      "clozeId": -514670173,
      "correctResponse": "Multipolar neurons"
    },
    {
      "cloze": "Multipolar neurons are the most common type of neuron in the brain and spinal cord ; also found in __________ of the autonomic nervous system .",
      "itemId": -1977927324,
      "clozeId": 443347023,
      "correctResponse": "ganglia"
    },
    {
      "cloze": "Multipolar neurons are the most common type of neuron in the brain and spinal cord ; also found in ganglia of the __________ .",
      "itemId": -1977927324,
      "clozeId": -1153931032,
      "correctResponse": "autonomic nervous system"
    },
    {
      "cloze": "Myelin gives the cell membranes of __________ a higher proportion of lipid than other cell membranes .",
      "itemId": 1601567615,
      "clozeId": 661684116,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "__________ gives the cell membranes of Schwann cells a higher proportion of lipid than other cell membranes .",
      "itemId": 1601567615,
      "clozeId": -53661999,
      "correctResponse": "Myelin"
    },
    {
      "cloze": "Myelin gives the cell membranes of Schwann cells a higher proportion of __________ than other cell membranes .",
      "itemId": 1601567615,
      "clozeId": -21467281,
      "correctResponse": "lipid"
    },
    {
      "cloze": "Near its end , an axon may have __________ , each with a specialized ending called an axon terminal .",
      "itemId": 1604315426,
      "clozeId": 1136980427,
      "correctResponse": "many fine extensions"
    },
    {
      "cloze": "Near its end , an axon may have many fine extensions , each with a specialized ending called an __________ .",
      "itemId": 1604315426,
      "clozeId": -1541381724,
      "correctResponse": "axon terminal"
    },
    {
      "cloze": "Near the center of the neuron cell body is a __________ with a conspicuous nucleolus .",
      "itemId": -1105085195,
      "clozeId": 120883482,
      "correctResponse": "large , spherical nucleus"
    },
    {
      "cloze": "Near the center of the neuron cell body is a large , spherical nucleus with a __________ .",
      "itemId": -1105085195,
      "clozeId": -1583196184,
      "correctResponse": "conspicuous nucleolus"
    },
    {
      "cloze": "Near the center of the __________ cell body is a large , spherical nucleus with a conspicuous nucleolus .",
      "itemId": -1105085195,
      "clozeId": 477835722,
      "correctResponse": "neuron"
    },
    {
      "cloze": "Nerve cell membrane maintains resting potential by diffusion of Na + and K + down their __________ as the cell pumps them up the gradients .",
      "itemId": 11343476,
      "clozeId": 1021847264,
      "correctResponse": "concentration gradients"
    },
    {
      "cloze": "Nerve cell membrane maintains resting potential by diffusion of __________ + and K + down their concentration gradients as the cell pumps them up the gradients .",
      "itemId": 11343476,
      "clozeId": -13840475,
      "correctResponse": "Na"
    },
    {
      "cloze": "__________ , which comprise more than half of the volume of the brain and outnumber neurons 10 to 1 , are critical to neuron function .",
      "itemId": -991430650,
      "clozeId": -43060250,
      "correctResponse": "Neuroglia"
    },
    {
      "cloze": "__________ also produce the growth factors that nourish neurons and remove excess ions and neurotransmitters that accumulate between neurons .",
      "itemId": -765248800,
      "clozeId": -481164424,
      "correctResponse": "Neuroglia"
    },
    {
      "cloze": "Neuroglia also produce the growth factors that nourish neurons and remove excess ions and __________ that accumulate between neurons .",
      "itemId": -765248800,
      "clozeId": 151106111,
      "correctResponse": "neurotransmitters"
    },
    {
      "cloze": "__________ were once thought to be mere bystanders to neural function , providing scaffolding and controlling the sites at which neurons contact one another .",
      "itemId": -474146419,
      "clozeId": 380178493,
      "correctResponse": "Neuroglia"
    },
    {
      "cloze": "Neuroglia were once thought to be mere bystanders to neural function , providing __________ and controlling the sites at which neurons contact one another .",
      "itemId": -474146419,
      "clozeId": 1728713435,
      "correctResponse": "scaffolding"
    },
    {
      "cloze": "Neuroglia were once thought to be __________ to neural function , providing scaffolding and controlling the sites at which neurons contact one another .",
      "itemId": -474146419,
      "clozeId": 1739231321,
      "correctResponse": "mere bystanders"
    },
    {
      "cloze": "__________ are excitable ; that is , they can respond to changes in their surroundings .",
      "itemId": 96262102,
      "clozeId": -1734645508,
      "correctResponse": "Neurons"
    },
    {
      "cloze": "Neurons can also be classified by functional differences into the following groups , depending on whether they carry information into the __________ , completely within the __________ , or out of the __________ .",
      "itemId": 1249088166,
      "clozeId": -1203046590,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Neurons can be classified into three major groups based on structural differences , as __________ .",
      "itemId": -1620003341,
      "clozeId": 1445601010,
      "correctResponse": "figure 10.6 shows"
    },
    {
      "cloze": "Neurons that conduct impulses from the __________ to responsive structures called effectors carry out the motor functions of the nervous system .",
      "itemId": -2027892486,
      "clozeId": -2067198762,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Neurons that conduct impulses from the CNS to responsive structures called __________ carry out the motor functions of the nervous system .",
      "itemId": -2027892486,
      "clozeId": 14888947,
      "correctResponse": "effectors"
    },
    {
      "cloze": "Neurotransmitters include acetylcholine , which stimulates skeletal muscle contractions ; a group of compounds called __________ , which are modified amino acids ; a group of unmodified amino acids ; and a large group of peptides , which are short chains of amino acids .",
      "itemId": -1352136865,
      "clozeId": -1030288135,
      "correctResponse": "monoamines"
    },
    {
      "cloze": "__________ include acetylcholine , which stimulates skeletal muscle contractions ; a group of compounds called monoamines , which are modified amino acids ; a group of unmodified amino acids ; and a large group of peptides , which are short chains of amino acids .",
      "itemId": -1352136865,
      "clozeId": 1309311818,
      "correctResponse": "Neurotransmitters"
    },
    {
      "cloze": "Neurotransmitters include __________ , which stimulates skeletal muscle contractions ; a group of compounds called monoamines , which are modified amino acids ; a group of unmodified amino acids ; and a large group of peptides , which are short chains of amino acids .",
      "itemId": -1352136865,
      "clozeId": -165989053,
      "correctResponse": "acetylcholine"
    },
    {
      "cloze": "Neurotransmitters include acetylcholine , which stimulates __________ ; a group of compounds called monoamines , which are modified amino acids ; a group of unmodified amino acids ; and a large group of peptides , which are short chains of amino acids .",
      "itemId": -1352136865,
      "clozeId": 1631104262,
      "correctResponse": "skeletal muscle contractions"
    },
    {
      "cloze": "__________ that make reaching threshold less likely are called inhibitory , because they decrease the chance that an impulse will occur .",
      "itemId": -371966183,
      "clozeId": 1846728460,
      "correctResponse": "Neurotransmitters"
    },
    {
      "cloze": "Neurotransmitters that make reaching __________ less likely are called inhibitory , because they decrease the chance that an impulse will occur .",
      "itemId": -371966183,
      "clozeId": 1359496852,
      "correctResponse": "threshold"
    },
    {
      "cloze": "New neural tissue arises from neural stem cells , which give rise to __________ that can give rise to neurons or neuroglia .",
      "itemId": 1374384348,
      "clozeId": -2132020557,
      "correctResponse": "neural progenitor cells"
    },
    {
      "cloze": "New neural tissue arises from __________ , which give rise to neural progenitor cells that can give rise to neurons or neuroglia .",
      "itemId": 1374384348,
      "clozeId": 1221167141,
      "correctResponse": "neural stem cells"
    },
    {
      "cloze": "New __________ arises from neural stem cells , which give rise to neural progenitor cells that can give rise to neurons or neuroglia .",
      "itemId": 1374384348,
      "clozeId": 1606722976,
      "correctResponse": "neural tissue"
    },
    {
      "cloze": "New neural tissue arises from neural stem cells , which give rise to neural progenitor cells that can give rise to __________ or neuroglia .",
      "itemId": 1374384348,
      "clozeId": -98799936,
      "correctResponse": "neurons"
    },
    {
      "cloze": "Norepinephrine in the __________ may excite or inhibit autonomic nervous system actions , depending on receptors .",
      "itemId": 1408419565,
      "clozeId": -1179525222,
      "correctResponse": "PNS"
    },
    {
      "cloze": "__________ in the PNS may excite or inhibit autonomic nervous system actions , depending on receptors .",
      "itemId": 1408419565,
      "clozeId": -514129771,
      "correctResponse": "Norepinephrine"
    },
    {
      "cloze": "Norepinephrine in the PNS may excite or inhibit __________ , depending on receptors .",
      "itemId": 1408419565,
      "clozeId": -1717253738,
      "correctResponse": "autonomic nervous system actions"
    },
    {
      "cloze": "Norepinephrine in the PNS may excite or inhibit autonomic nervous system actions , depending on __________ .",
      "itemId": 1408419565,
      "clozeId": -47072760,
      "correctResponse": "receptors"
    },
    {
      "cloze": "Once the neurotransmitter binds to receptors on a __________ , the action is either excitatory or inhibitory .",
      "itemId": -1830009099,
      "clozeId": 788075326,
      "correctResponse": "postsynaptic cell"
    },
    {
      "cloze": "Once the __________ binds to receptors on a postsynaptic cell , the action is either excitatory or inhibitory .",
      "itemId": -1830009099,
      "clozeId": 1011004643,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "Once the neurotransmitter binds to __________ on a postsynaptic cell , the action is either excitatory or inhibitory .",
      "itemId": -1830009099,
      "clozeId": -1638367278,
      "correctResponse": "receptors"
    },
    {
      "cloze": "One group , consisting of the brain and spinal cord , forms the __________ .",
      "itemId": 1865368652,
      "clozeId": 1298908818,
      "correctResponse": "central nervous system"
    },
    {
      "cloze": "__________ diffuse outward , repolarizing the membrane .",
      "itemId": 542967272,
      "clozeId": -187467862,
      "correctResponse": "Potassium ions"
    },
    {
      "cloze": "Recall from section 1.6 , Organization of the Human Body , __________ and Coordination , that neurons can conduct electrical signals .",
      "itemId": -1249731661,
      "clozeId": 2013351393,
      "correctResponse": "Integration"
    },
    {
      "cloze": "Remembering that the action potential takes about a millisecond , and adding the time of the __________ , the maximum theoretical frequency of impulses in a neuron is about 700 per second .",
      "itemId": 270277154,
      "clozeId": 1239334522,
      "correctResponse": "relative refractory period"
    },
    {
      "cloze": "Repeated impulses on an __________ may cause that neuron to release more neurotransmitter in response to a single impulse , making it more likely to bring the postsynaptic cell to threshold .",
      "itemId": -682172951,
      "clozeId": -703687638,
      "correctResponse": "excitatory presynaptic neuron"
    },
    {
      "cloze": "Repeated impulses on an excitatory presynaptic neuron may cause that neuron to release more neurotransmitter in response to a single impulse , making it more likely to bring the __________ to threshold .",
      "itemId": -682172951,
      "clozeId": 2045892098,
      "correctResponse": "postsynaptic cell"
    },
    {
      "cloze": "Repeated impulses on an excitatory presynaptic neuron may cause that neuron to release __________ in response to a single impulse , making it more likely to bring the postsynaptic cell to threshold .",
      "itemId": -682172951,
      "clozeId": -1363848562,
      "correctResponse": "more neurotransmitter"
    },
    {
      "cloze": "Repeated impulses on an excitatory presynaptic neuron may cause that neuron to release more neurotransmitter in response to a __________ , making it more likely to bring the postsynaptic cell to threshold .",
      "itemId": -682172951,
      "clozeId": -1044531646,
      "correctResponse": "single impulse"
    },
    {
      "cloze": "Satellite cells are __________ that surround cell bodies of neurons in ganglia .",
      "itemId": -1841381001,
      "clozeId": 71305122,
      "correctResponse": "small , cuboidal cells"
    },
    {
      "cloze": "Satellite cells are small , cuboidal cells that surround cell bodies of __________ in ganglia .",
      "itemId": -1841381001,
      "clozeId": 793347309,
      "correctResponse": "neurons"
    },
    {
      "cloze": "__________ are small , cuboidal cells that surround cell bodies of neurons in ganglia .",
      "itemId": -1841381001,
      "clozeId": -1458841251,
      "correctResponse": "Satellite cells"
    },
    {
      "cloze": "Satellite cells provide nutritional support and help regulate the __________ of ions around neuron cell bodies within ganglia .",
      "itemId": 682988407,
      "clozeId": -22661131,
      "correctResponse": "concentrations"
    },
    {
      "cloze": "Satellite cells provide nutritional support and help regulate the concentrations of ions around __________ within ganglia .",
      "itemId": 682988407,
      "clozeId": -1882139852,
      "correctResponse": "neuron cell bodies"
    },
    {
      "cloze": "__________ provide nutritional support and help regulate the concentrations of ions around neuron cell bodies within ganglia .",
      "itemId": 682988407,
      "clozeId": 2021350473,
      "correctResponse": "Satellite cells"
    },
    {
      "cloze": "Schwann cells are cells with __________ that wrap tightly around the axons of peripheral neurons .",
      "itemId": -2084259480,
      "clozeId": -189453382,
      "correctResponse": "abundant , lipid-rich membranes"
    },
    {
      "cloze": "__________ are cells with abundant , lipid-rich membranes that wrap tightly around the axons of peripheral neurons .",
      "itemId": -2084259480,
      "clozeId": 563025109,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "Schwann cells are cells with abundant , lipid-rich membranes that wrap tightly around the __________ of peripheral neurons .",
      "itemId": -2084259480,
      "clozeId": -1813380183,
      "correctResponse": "axons"
    },
    {
      "cloze": "Schwann cells are cells with abundant , lipid-rich membranes that wrap tightly around the axons of __________ .",
      "itemId": -2084259480,
      "clozeId": 805178458,
      "correctResponse": "peripheral neurons"
    },
    {
      "cloze": "See table 10.3 for a summary of the events leading to the conduction of an action potential down an __________ .",
      "itemId": 372082085,
      "clozeId": 1295082505,
      "correctResponse": "axon"
    },
    {
      "cloze": "See table 10.3 for a summary of the events leading to the __________ of an action potential down an axon .",
      "itemId": 372082085,
      "clozeId": -1753098711,
      "correctResponse": "conduction"
    },
    {
      "cloze": "Sensory neurons conduct impulses from __________ into the brain or spinal cord .",
      "itemId": -1548698474,
      "clozeId": 1837616688,
      "correctResponse": "peripheral body parts"
    },
    {
      "cloze": "Sensory receptors convert their information into impulses , which are then conducted along peripheral nerves to the __________ .",
      "itemId": 1171962790,
      "clozeId": -831006666,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Sensory receptors convert their information into impulses , which are then conducted along __________ to the CNS .",
      "itemId": 1171962790,
      "clozeId": 1132433201,
      "correctResponse": "peripheral nerves"
    },
    {
      "cloze": "Similarly , an impulse originating from a sensory receptor may diverge and reach several different regions of the __________ , where the information can be processed and evoke a response .",
      "itemId": -1994814392,
      "clozeId": 900425572,
      "correctResponse": "CNS"
    },
    {
      "cloze": "Similarly , an impulse originating from a __________ may diverge and reach several different regions of the CNS , where the information can be processed and evoke a response .",
      "itemId": -1994814392,
      "clozeId": 300315245,
      "correctResponse": "sensory receptor"
    },
    {
      "cloze": "__________ diffuse inward , depolarizing the membrane .",
      "itemId": -1241137711,
      "clozeId": -1357688845,
      "correctResponse": "Sodium ions"
    },
    {
      "cloze": "Sodium ions diffuse inward through the open sodium channels , down their __________ , aided by the attraction of the sodium ions to the negative charges on the inside of the membrane .",
      "itemId": -394700180,
      "clozeId": -1769686095,
      "correctResponse": "concentration gradient"
    },
    {
      "cloze": "Some __________ are in ganglia associated with the autonomic nervous system .",
      "itemId": 1673361404,
      "clozeId": -666239123,
      "correctResponse": "multipolar neurons"
    },
    {
      "cloze": "Some multipolar neurons are in __________ associated with the autonomic nervous system .",
      "itemId": 1673361404,
      "clozeId": 1127167521,
      "correctResponse": "ganglia"
    },
    {
      "cloze": "Some multipolar neurons are in ganglia associated with the __________ .",
      "itemId": 1673361404,
      "clozeId": -791197656,
      "correctResponse": "autonomic nervous system"
    },
    {
      "cloze": "Some __________ , for example , detect changes in temperature , light , or pressure outside the body , whereas others respond to signals from inside the body .",
      "itemId": -2119775520,
      "clozeId": -166342590,
      "correctResponse": "neurons"
    },
    {
      "cloze": "Some __________ release only one type , whereas others produce two or three .",
      "itemId": -139405194,
      "clozeId": -828382408,
      "correctResponse": "neurons"
    },
    {
      "cloze": "Some relatively uncommon synapses , called __________ , are in certain parts of the brain and eyes .",
      "itemId": -12512586,
      "clozeId": 63567178,
      "correctResponse": "electrical synapses"
    },
    {
      "cloze": "Some relatively __________ , called electrical synapses , are in certain parts of the brain and eyes .",
      "itemId": -12512586,
      "clozeId": -675095000,
      "correctResponse": "uncommon synapses"
    },
    {
      "cloze": "Structures called sensory receptors at the ends of neurons in the __________ provide the sensory function of the nervous system .",
      "itemId": 102037629,
      "clozeId": 1428474858,
      "correctResponse": "peripheral nervous system"
    },
    {
      "cloze": "Summation of the excitatory and inhibitory effects of the __________ commonly takes place at the trigger zone .",
      "itemId": -543496284,
      "clozeId": 1196156022,
      "correctResponse": "postsynaptic potentials"
    },
    {
      "cloze": "__________ of the excitatory and inhibitory effects of the postsynaptic potentials commonly takes place at the trigger zone .",
      "itemId": -543496284,
      "clozeId": -2110029381,
      "correctResponse": "Summation"
    },
    {
      "cloze": "Summation of the __________ of the postsynaptic potentials commonly takes place at the trigger zone .",
      "itemId": -543496284,
      "clozeId": 1263134122,
      "correctResponse": "excitatory and inhibitory effects"
    },
    {
      "cloze": "Summation of the excitatory and inhibitory effects of the postsynaptic potentials commonly takes place at the __________ .",
      "itemId": -543496284,
      "clozeId": -1548448296,
      "correctResponse": "trigger zone"
    },
    {
      "cloze": "Table 10.7 summarizes this process , which is called __________ .",
      "itemId": -1155435422,
      "clozeId": 851736621,
      "correctResponse": "vesicle trafficking"
    },
    {
      "cloze": "The Na + / K + pump balances these leaks by pumping three sodium ions out for every two potassium ions it pumps in .",
      "itemId": 196399584,
      "clozeId": 196399584,
      "correctResponse": "K + pump balances"
    },
    {
      "cloze": "The __________ + / K + pump balances these leaks by pumping three sodium ions out for every two potassium ions it pumps in .",
      "itemId": 196399584,
      "clozeId": -1396567093,
      "correctResponse": "Na"
    },
    {
      "cloze": "The Na + / K + pump balances these __________ by pumping three sodium ions out for every two potassium ions it pumps in .",
      "itemId": 196399584,
      "clozeId": -625215322,
      "correctResponse": "leaks"
    },
    {
      "cloze": "The __________ also includes ganglia , which are clusters of neuron cell bodies located outside the brain and spinal cord .",
      "itemId": -1965387021,
      "clozeId": -1097667554,
      "correctResponse": "PNS"
    },
    {
      "cloze": "The PNS also includes __________ , which are clusters of neuron cell bodies located outside the brain and spinal cord .",
      "itemId": -1965387021,
      "clozeId": -74033360,
      "correctResponse": "ganglia"
    },
    {
      "cloze": "The autonomic nervous system communicates instructions from the CNS that control viscera , such as the heart and various glands , and thus causes __________ .",
      "itemId": 344381694,
      "clozeId": -2052676980,
      "correctResponse": "involuntary , subconscious actions"
    },
    {
      "cloze": "The autonomic nervous system communicates instructions from the CNS that control __________ , such as the heart and various glands , and thus causes involuntary , subconscious actions .",
      "itemId": 344381694,
      "clozeId": -5248535,
      "correctResponse": "viscera"
    },
    {
      "cloze": "The autonomic nervous system communicates instructions from the __________ that control viscera , such as the heart and various glands , and thus causes involuntary , subconscious actions .",
      "itemId": 344381694,
      "clozeId": -966733568,
      "correctResponse": "CNS"
    },
    {
      "cloze": "The cells that form capillaries in the brain , in contrast , are much more tightly connected , thanks partly to neuroglia called __________ .",
      "itemId": -1108253883,
      "clozeId": 300608956,
      "correctResponse": "astrocytes"
    },
    {
      "cloze": "The cells that form capillaries in the brain , in contrast , are much more tightly connected , thanks partly to __________ called astrocytes .",
      "itemId": -1108253883,
      "clozeId": -1822658059,
      "correctResponse": "neuroglia"
    },
    {
      "cloze": "The cytoplasm of the axon includes many mitochondria , microtubules , and __________ .",
      "itemId": -1972004663,
      "clozeId": 727951195,
      "correctResponse": "neurofibrils"
    },
    {
      "cloze": "The cytoplasm of the axon includes many mitochondria , __________ , and neurofibrils .",
      "itemId": -1972004663,
      "clozeId": -344591093,
      "correctResponse": "microtubules"
    },
    {
      "cloze": "The cytoplasm of the __________ includes many mitochondria , microtubules , and neurofibrils .",
      "itemId": -1972004663,
      "clozeId": -1360044243,
      "correctResponse": "axon"
    },
    {
      "cloze": "The cytoplasm of the axon includes many __________ , microtubules , and neurofibrils .",
      "itemId": -1972004663,
      "clozeId": -1632230476,
      "correctResponse": "mitochondria"
    },
    {
      "cloze": "The distribution is created largely by the __________ , which actively transports sodium ions out of the cell and potassium ions into the cell .",
      "itemId": -1064325184,
      "clozeId": -698095097,
      "correctResponse": "sodium/potassium pump"
    },
    {
      "cloze": "The __________ itself is porous , allowing substances to diffuse freely between the interstitial fluid of the brain tissues and the fluid in the ventricles .",
      "itemId": -228754266,
      "clozeId": 1988548302,
      "correctResponse": "ependymal layer"
    },
    {
      "cloze": "The ependymal layer itself is porous , allowing substances to diffuse freely between the __________ of the brain tissues and the fluid in the ventricles .",
      "itemId": -228754266,
      "clozeId": -73568466,
      "correctResponse": "interstitial fluid"
    },
    {
      "cloze": "The ependymal layer itself is porous , allowing substances to diffuse freely between the interstitial fluid of the brain tissues and the fluid in the __________ .",
      "itemId": -228754266,
      "clozeId": 151604509,
      "correctResponse": "ventricles"
    },
    {
      "cloze": "The four types of CNS neuroglia are __________ , oligodendrocytes , microglia , and ependyma : As their name implies , __________ are star-shaped cells .",
      "itemId": 1028282945,
      "clozeId": -1759535663,
      "correctResponse": "astrocytes"
    },
    {
      "cloze": "The four types of CNS neuroglia are astrocytes , oligodendrocytes , __________ , and ependyma : As their name implies , astrocytes are star-shaped cells .",
      "itemId": 1028282945,
      "clozeId": 1381506538,
      "correctResponse": "microglia"
    },
    {
      "cloze": "The four types of CNS neuroglia are astrocytes , __________ , microglia , and ependyma : As their name implies , astrocytes are star-shaped cells .",
      "itemId": 1028282945,
      "clozeId": 124455445,
      "correctResponse": "oligodendrocytes"
    },
    {
      "cloze": "The four types of __________ are astrocytes , oligodendrocytes , microglia , and ependyma : As their name implies , astrocytes are star-shaped cells .",
      "itemId": 1028282945,
      "clozeId": -466989125,
      "correctResponse": "CNS neuroglia"
    },
    {
      "cloze": "The four types of CNS neuroglia are astrocytes , oligodendrocytes , microglia , and ependyma : As their name implies , astrocytes are __________ .",
      "itemId": 1028282945,
      "clozeId": 1102704278,
      "correctResponse": "star-shaped cells"
    },
    {
      "cloze": "The general pattern is that neurons receive input through the __________ and the cell body , and send output in the form of an impulse conducted away from the cell body , down the axon .",
      "itemId": 490266929,
      "clozeId": -1145549637,
      "correctResponse": "dendrites"
    },
    {
      "cloze": "The increased calcium concentration inside the cell initiates a series of events that fuses the __________ with the cell membrane , where they release their neurotransmitter by exocytosis .",
      "itemId": -937636965,
      "clozeId": -667542652,
      "correctResponse": "synaptic vesicles"
    },
    {
      "cloze": "The increased calcium concentration inside the cell initiates a series of events that fuses the synaptic vesicles with the cell membrane , where they release their __________ by exocytosis .",
      "itemId": -937636965,
      "clozeId": 544856421,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "The key to understanding how this happens is the action potential , which is a rapid change in the __________ , first in a positive direction , then in a negative direction , returning to the resting potential .",
      "itemId": 1872935687,
      "clozeId": -1305869504,
      "correctResponse": "membrane potential"
    },
    {
      "cloze": "The mechanism by which the impulse in the __________ the postsynaptic cell is called synaptic transmission .",
      "itemId": 522818480,
      "clozeId": -854781356,
      "correctResponse": "presynaptic neuron signals"
    },
    {
      "cloze": "The mechanism by which the impulse in the presynaptic neuron signals the __________ is called synaptic transmission .",
      "itemId": 522818480,
      "clozeId": -1607768697,
      "correctResponse": "postsynaptic cell"
    },
    {
      "cloze": "The mechanism by which the __________ in the presynaptic neuron signals the postsynaptic cell is called synaptic transmission .",
      "itemId": 522818480,
      "clozeId": -1230599351,
      "correctResponse": "impulse"
    },
    {
      "cloze": "The __________ by which the impulse in the presynaptic neuron signals the postsynaptic cell is called synaptic transmission .",
      "itemId": 522818480,
      "clozeId": -815327807,
      "correctResponse": "mechanism"
    },
    {
      "cloze": "The mechanism uses another type of ion channel , a __________ that opens when threshold is reached .",
      "itemId": 15840657,
      "clozeId": 934262995,
      "correctResponse": "voltage-gated sodium channel"
    },
    {
      "cloze": "The mechanism uses another type of ion channel , a voltage-gated sodium channel that opens when __________ is reached .",
      "itemId": 15840657,
      "clozeId": -1174266088,
      "correctResponse": "threshold"
    },
    {
      "cloze": "The mechanism uses another type of __________ , a voltage-gated sodium channel that opens when threshold is reached .",
      "itemId": 15840657,
      "clozeId": 4671364,
      "correctResponse": "ion channel"
    },
    {
      "cloze": "The negative membrane potential helps the positively charged sodium ions enter the cell despite sodium 's low permeability , but it hinders the positively charged potassium ions from leaving the cell despite __________ .",
      "itemId": -1931630643,
      "clozeId": -131718334,
      "correctResponse": "potassium 's higher permeability"
    },
    {
      "cloze": "The negative membrane potential helps the positively charged sodium ions enter the cell despite __________ , but it hinders the positively charged potassium ions from leaving the cell despite potassium 's higher permeability .",
      "itemId": -1931630643,
      "clozeId": -1990118471,
      "correctResponse": "sodium 's low permeability"
    },
    {
      "cloze": "The __________ oversees all that we do and determines who we are .",
      "itemId": 667213912,
      "clozeId": -533221259,
      "correctResponse": "nervous system"
    },
    {
      "cloze": "The net effect is that three sodium __________ '' into the cell for every two potassium ions that `` leak '' out .",
      "itemId": -1471890932,
      "clozeId": 1886707982,
      "correctResponse": "ions `` leak"
    },
    {
      "cloze": "The __________ illustrated in figure 10.3 is multipolar .",
      "itemId": 1516994241,
      "clozeId": 1717817504,
      "correctResponse": "neuron"
    },
    {
      "cloze": "The neuron receiving input at the synapse is the __________ .",
      "itemId": -1534746646,
      "clozeId": 948055630,
      "correctResponse": "postsynaptic neuron"
    },
    {
      "cloze": "The neuron receiving input at the __________ is the postsynaptic neuron .",
      "itemId": -1534746646,
      "clozeId": -347739453,
      "correctResponse": "synapse"
    },
    {
      "cloze": "The number of action potentials per second that an __________ can generate is limited , because during an action potential , that part of the __________ becomes unresponsive to another threshold stimulus .",
      "itemId": -1104777290,
      "clozeId": -946228650,
      "correctResponse": "axon"
    },
    {
      "cloze": "The number of sodium and potassium ions crossing the membrane during an action potential is extremely small , although the __________ is quite significant .",
      "itemId": -686547375,
      "clozeId": -1611614359,
      "correctResponse": "bioelectric effect"
    },
    {
      "cloze": "The other group , the __________ , includes the nerves that connect the central nervous system to other body parts .",
      "itemId": -1212445270,
      "clozeId": -1483251525,
      "correctResponse": "peripheral nervous system"
    },
    {
      "cloze": "The parts of the Schwann cells that contain most of the cytoplasm and the nuclei remain outside the myelin sheath and comprise a __________ , or neurilemmal sheath , which surrounds the myelin sheath .",
      "itemId": -1304346091,
      "clozeId": 1092678678,
      "correctResponse": "neurilemma"
    },
    {
      "cloze": "The parts of the __________ that contain most of the cytoplasm and the nuclei remain outside the myelin sheath and comprise a neurilemma , or neurilemmal sheath , which surrounds the myelin sheath .",
      "itemId": -1304346091,
      "clozeId": -404188870,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "The parts of the Schwann cells that contain most of the cytoplasm and the nuclei remain outside the __________ and comprise a neurilemma , or neurilemmal sheath , which surrounds the __________ .",
      "itemId": -1304346091,
      "clozeId": 599112241,
      "correctResponse": "myelin sheath"
    },
    {
      "cloze": "The __________ of an action potential continues to the end of the axon .",
      "itemId": 1074113798,
      "clozeId": -35645876,
      "correctResponse": "propagation"
    },
    {
      "cloze": "The propagation of an action potential continues to the end of the __________ .",
      "itemId": 1074113798,
      "clozeId": 297573300,
      "correctResponse": "axon"
    },
    {
      "cloze": "The __________ also ensures that an action potential is conducted in only one direction , down the axon , because the area upstream from where the action potential has just occurred is still in the __________ from the previous action potential .",
      "itemId": 545648483,
      "clozeId": 1126369043,
      "correctResponse": "refractory period"
    },
    {
      "cloze": "The resulting action potential causes an electric current that stimulates __________ of the membrane .",
      "itemId": -1901344824,
      "clozeId": -2046619678,
      "correctResponse": "adjacent portions"
    },
    {
      "cloze": "The second action potential causes another electric current to flow farther down the __________ .",
      "itemId": -584569540,
      "clozeId": 1974897358,
      "correctResponse": "axon"
    },
    {
      "cloze": "The somatic nervous system communicates voluntary instructions originating in the __________ to skeletal muscles , causing contraction .",
      "itemId": 310348838,
      "clozeId": -272069594,
      "correctResponse": "CNS"
    },
    {
      "cloze": "The somatic nervous system communicates voluntary instructions originating in the CNS to __________ , causing contraction .",
      "itemId": 310348838,
      "clozeId": -290919197,
      "correctResponse": "skeletal muscles"
    },
    {
      "cloze": "The somatic nervous system communicates voluntary instructions originating in the CNS to skeletal muscles , causing __________ .",
      "itemId": 310348838,
      "clozeId": 835449344,
      "correctResponse": "contraction"
    },
    {
      "cloze": "The somatic nervous system communicates __________ originating in the CNS to skeletal muscles , causing contraction .",
      "itemId": 310348838,
      "clozeId": 1109880135,
      "correctResponse": "voluntary instructions"
    },
    {
      "cloze": "The three general functions of the nervous system -- receiving information , deciding what to do , and acting on those decisions -- are termed sensory , integrative , and __________ .",
      "itemId": 1133873024,
      "clozeId": 1271246833,
      "correctResponse": "motor"
    },
    {
      "cloze": "The two types of __________ in the peripheral nervous system are Schwann cells and satellite cells : Schwann cells produce the myelin on peripheral myelinated neurons , as described earlier .",
      "itemId": 1488973956,
      "clozeId": -1463197498,
      "correctResponse": "neuroglia"
    },
    {
      "cloze": "The two types of neuroglia in the peripheral nervous system are __________ and satellite cells : __________ produce the myelin on peripheral myelinated neurons , as described earlier .",
      "itemId": 1488973956,
      "clozeId": -76093642,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "The two types of neuroglia in the peripheral nervous system are Schwann cells and satellite cells : Schwann cells produce the myelin on __________ , as described earlier .",
      "itemId": 1488973956,
      "clozeId": 756312016,
      "correctResponse": "peripheral myelinated neurons"
    },
    {
      "cloze": "The two types of neuroglia in the __________ are Schwann cells and satellite cells : Schwann cells produce the myelin on peripheral myelinated neurons , as described earlier .",
      "itemId": 1488973956,
      "clozeId": 1822459497,
      "correctResponse": "peripheral nervous system"
    },
    {
      "cloze": "The __________ quickly close , but at almost the same time , slower voltage-gated potassium channels open and briefly increase potassium permeability .",
      "itemId": 323073193,
      "clozeId": 636262750,
      "correctResponse": "voltage-gated sodium channels"
    },
    {
      "cloze": "The voltage-gated sodium channels quickly __________ , slower voltage-gated potassium channels open and briefly increase potassium permeability .",
      "itemId": 323073193,
      "clozeId": -526826769,
      "correctResponse": "close , but at almost the same time"
    },
    {
      "cloze": "The voltage-gated sodium channels quickly close , but at almost the same time , __________ open and briefly increase potassium permeability .",
      "itemId": 323073193,
      "clozeId": 2109278188,
      "correctResponse": "slower voltage-gated potassium channels"
    },
    {
      "cloze": "The voltage-gated sodium channels quickly close , but at almost the same time , slower voltage-gated potassium channels open and briefly __________ .",
      "itemId": 323073193,
      "clozeId": -586358293,
      "correctResponse": "increase potassium permeability"
    },
    {
      "cloze": "The voltage-gated sodium channels quickly close , but at almost the same time , slower voltage-gated potassium channels open and __________ increase potassium permeability .",
      "itemId": 323073193,
      "clozeId": 1622243286,
      "correctResponse": "briefly"
    },
    {
      "cloze": "The way the nervous system collects , processes , and responds to information reflects , in part , the organization of __________ and axons in the brain and spinal cord .",
      "itemId": -1834037355,
      "clozeId": -1361238089,
      "correctResponse": "neurons"
    },
    {
      "cloze": "The white matter in the brain and spinal cord gets its color from masses of __________ .",
      "itemId": -1508852339,
      "clozeId": -1929138164,
      "correctResponse": "myelinated axons"
    },
    {
      "cloze": "Therefore , a neuron of a __________ may exhibit divergence by forming synapses with several other neurons .",
      "itemId": -863210415,
      "clozeId": 2144849181,
      "correctResponse": "neuronal pool"
    },
    {
      "cloze": "Therefore , a neuron of a neuronal pool may exhibit __________ by forming synapses with several other neurons .",
      "itemId": -863210415,
      "clozeId": 2139299311,
      "correctResponse": "divergence"
    },
    {
      "cloze": "Therefore , a neuron of a neuronal pool may exhibit divergence by forming __________ with several other neurons .",
      "itemId": -863210415,
      "clozeId": -1829031991,
      "correctResponse": "synapses"
    },
    {
      "cloze": "Therefore , a __________ of a neuronal pool may exhibit divergence by forming synapses with several other neurons .",
      "itemId": -863210415,
      "clozeId": -1680939264,
      "correctResponse": "neuron"
    },
    {
      "cloze": "Therefore , a neuron of a neuronal pool may exhibit divergence by forming synapses with __________ .",
      "itemId": -863210415,
      "clozeId": -1336593023,
      "correctResponse": "several other neurons"
    },
    {
      "cloze": "These __________ quickly reestablish the resting potential , which remains in the resting state until it is stimulated again .",
      "itemId": 1213662209,
      "clozeId": 1307371092,
      "correctResponse": "actions"
    },
    {
      "cloze": "These are also called pseudounipolar , because they start out with __________ that merge into one during development .",
      "itemId": -488443295,
      "clozeId": -1691171684,
      "correctResponse": "two processes"
    },
    {
      "cloze": "These are groups of neurons that synapse with each other and perform a common function , even though their cell bodies may be in different parts of the __________ .",
      "itemId": -1458304340,
      "clozeId": -1873041248,
      "correctResponse": "CNS"
    },
    {
      "cloze": "These cells are scattered throughout the CNS , where they help support neurons and __________ bacterial cells and cellular debris .",
      "itemId": -330737872,
      "clozeId": 1522696991,
      "correctResponse": "phagocytize"
    },
    {
      "cloze": "These cells are scattered throughout the __________ , where they help support neurons and phagocytize bacterial cells and cellular debris .",
      "itemId": -330737872,
      "clozeId": 843905446,
      "correctResponse": "CNS"
    },
    {
      "cloze": "These __________ are outside the nervous system and include muscles and glands whose actions are either controlled or modified by nerve activity .",
      "itemId": -24375778,
      "clozeId": 1981489333,
      "correctResponse": "effectors"
    },
    {
      "cloze": "These peptides act as neurotransmitters or as __________ , which are substances that alter a neuron 's response to a neurotransmitter or block the release of a neurotransmitter .",
      "itemId": 545306248,
      "clozeId": 20614749,
      "correctResponse": "neuromodulators"
    },
    {
      "cloze": "These __________ act as neurotransmitters or as neuromodulators , which are substances that alter a neuron 's response to a neurotransmitter or block the release of a neurotransmitter .",
      "itemId": 545306248,
      "clozeId": -1777868120,
      "correctResponse": "peptides"
    },
    {
      "cloze": "These peptides act as neurotransmitters or as neuromodulators , which are substances that alter a __________ to a neurotransmitter or block the release of a neurotransmitter .",
      "itemId": 545306248,
      "clozeId": 1618911212,
      "correctResponse": "neuron 's response"
    },
    {
      "cloze": "These peptides act as __________ or as neuromodulators , which are substances that alter a neuron 's response to a neurotransmitter or block the release of a neurotransmitter .",
      "itemId": 545306248,
      "clozeId": -1575981709,
      "correctResponse": "neurotransmitters"
    },
    {
      "cloze": "These peptides act as neurotransmitters or as neuromodulators , which are substances that alter a neuron 's response to a __________ or block the release of a __________ .",
      "itemId": 545306248,
      "clozeId": 1043415184,
      "correctResponse": "neurotransmitter"
    },
    {
      "cloze": "These __________ gather information by detecting changes inside and outside the body .",
      "itemId": -1501520431,
      "clozeId": -1348015902,
      "correctResponse": "receptors"
    },
    {
      "cloze": "They are commonly found between neurons and blood vessels , where they provide support and hold structures together with __________ .",
      "itemId": 1840440003,
      "clozeId": -1101838139,
      "correctResponse": "abundant cellular processes"
    },
    {
      "cloze": "They form the __________ of the central canal that extends downward through the spinal cord .",
      "itemId": -1142581539,
      "clozeId": -1902027774,
      "correctResponse": "inner lining"
    },
    {
      "cloze": "They form the inner lining of the central canal that extends downward through the __________ .",
      "itemId": -1142581539,
      "clozeId": 500578018,
      "correctResponse": "spinal cord"
    },
    {
      "cloze": "They monitor external environmental factors such as light and sound intensities as well as the temperature , oxygen concentration , and other conditions of the __________ .",
      "itemId": -772081414,
      "clozeId": -1299845638,
      "correctResponse": "body 's internal environment"
    },
    {
      "cloze": "They monitor external environmental factors such as __________ as well as the temperature , oxygen concentration , and other conditions of the body 's internal environment .",
      "itemId": -772081414,
      "clozeId": -2031129477,
      "correctResponse": "light and sound intensities"
    },
    {
      "cloze": "They usually proliferate whenever the brain or spinal __________ is inflamed because of injury or disease .",
      "itemId": -1994956712,
      "clozeId": 1035097482,
      "correctResponse": "cord"
    },
    {
      "cloze": "This brief period , called the __________ , has two parts .",
      "itemId": -129372885,
      "clozeId": 1414790503,
      "correctResponse": "refractory period"
    },
    {
      "cloze": "This is usually in a __________ of the axon , but in some sensory neurons it may be in the distal peripheral process .",
      "itemId": 297636903,
      "clozeId": 343718315,
      "correctResponse": "proximal region"
    },
    {
      "cloze": "This is usually in a proximal region of the axon , but in some sensory neurons it may be in the __________ .",
      "itemId": 297636903,
      "clozeId": -704783817,
      "correctResponse": "distal peripheral process"
    },
    {
      "cloze": "This is usually in a proximal region of the __________ , but in some sensory neurons it may be in the distal peripheral process .",
      "itemId": 297636903,
      "clozeId": -2110543885,
      "correctResponse": "axon"
    },
    {
      "cloze": "This __________ is due to an unequal distribution of positive and negative ions across the membrane .",
      "itemId": 1753007417,
      "clozeId": -1349803865,
      "correctResponse": "polarization"
    },
    {
      "cloze": "This polarization is due to an __________ of positive and negative ions across the membrane .",
      "itemId": 1753007417,
      "clozeId": 1862702496,
      "correctResponse": "unequal distribution"
    },
    {
      "cloze": "This sequence of events results in the conduction of the action potential along the __________ without decreasing in amplitude , even if the __________ branches .",
      "itemId": -56060958,
      "clozeId": 107049490,
      "correctResponse": "axon"
    },
    {
      "cloze": "Through a __________ of cells and the information that they send and receive , the nervous system can detect changes affecting the body , make decisions , and stimulate muscles or glands to respond .",
      "itemId": 15624849,
      "clozeId": -1925137397,
      "correctResponse": "vast communicating network"
    },
    {
      "cloze": "Thus , an impulse is conducted whenever a stimulus of threshold intensity or above is applied to an __________ and all impulses conducted on that __________ are the same strength .",
      "itemId": 1202573761,
      "clozeId": 246671393,
      "correctResponse": "axon"
    },
    {
      "cloze": "Thus , an impulse is conducted whenever a stimulus of __________ or above is applied to an axon and all impulses conducted on that axon are the same strength .",
      "itemId": 1202573761,
      "clozeId": 1945809805,
      "correctResponse": "threshold intensity"
    },
    {
      "cloze": "Thus , even though __________ are present for sodium and potassium , the ability of these ions to diffuse across the cell membrane depends on the presence of channels .",
      "itemId": 691771967,
      "clozeId": 308932383,
      "correctResponse": "concentration gradients"
    },
    {
      "cloze": "Thus , myelin prevents almost all flow of ions through the membrane that it encloses and serves as an __________ .",
      "itemId": -1396900750,
      "clozeId": 2028745579,
      "correctResponse": "electrical insulator"
    },
    {
      "cloze": "Thus , the cell continues to expend metabolic energy in the form of ATP to actively transport sodium and potassium ions in opposite directions , thereby maintaining the __________ for those ions responsible for their diffusion in the first place .",
      "itemId": -326519406,
      "clozeId": -253874696,
      "correctResponse": "concentration gradients"
    },
    {
      "cloze": "To understand how the resting potential provides the energy for sending an impulse down the __________ , we must first understand how neurons respond to signals called stimuli .",
      "itemId": 1927895201,
      "clozeId": 1474217325,
      "correctResponse": "axon"
    },
    {
      "cloze": "Typically , __________ within the nervous system are not isolated , but bundled in groups .",
      "itemId": -2126192613,
      "clozeId": 1891845768,
      "correctResponse": "axons"
    },
    {
      "cloze": "__________ have a cell body with a single process that divides into two branches and functions as an axon .",
      "itemId": -1611492935,
      "clozeId": 1337867237,
      "correctResponse": "Unipolar neurons"
    },
    {
      "cloze": "Unipolar neurons have a cell body with a single process that divides into two branches and functions as an __________ .",
      "itemId": -1611492935,
      "clozeId": 720051141,
      "correctResponse": "axon"
    },
    {
      "cloze": "Unlike the Schwann cells of the PNS , __________ can send out a number of processes , each of which forms a myelin sheath around a nearby axon .",
      "itemId": -1439498144,
      "clozeId": 27699068,
      "correctResponse": "oligodendrocytes"
    },
    {
      "cloze": "Unlike the Schwann cells of the __________ , oligodendrocytes can send out a number of processes , each of which forms a myelin sheath around a nearby axon .",
      "itemId": -1439498144,
      "clozeId": -741696357,
      "correctResponse": "PNS"
    },
    {
      "cloze": "Unlike the __________ of the PNS , oligodendrocytes can send out a number of processes , each of which forms a myelin sheath around a nearby axon .",
      "itemId": -1439498144,
      "clozeId": 106879237,
      "correctResponse": "Schwann cells"
    },
    {
      "cloze": "Unlike the Schwann cells of the PNS , oligodendrocytes can send out a number of processes , each of which forms a __________ around a nearby axon .",
      "itemId": -1439498144,
      "clozeId": 321852083,
      "correctResponse": "myelin sheath"
    },
    {
      "cloze": "Unlike the Schwann cells of the PNS , oligodendrocytes can send out a number of processes , each of which forms a myelin sheath around a __________ .",
      "itemId": -1439498144,
      "clozeId": -2143609327,
      "correctResponse": "nearby axon"
    },
    {
      "cloze": "When a __________ is stimulated to threshold , an action potential occurs at the trigger zone .",
      "itemId": 1084901721,
      "clozeId": 1416640307,
      "correctResponse": "myelinated axon"
    },
    {
      "cloze": "When a neuron conducts an electrical current , that current is in the form of a series of __________ occurring in sequence along the axon , from the cell body to the axon terminal .",
      "itemId": 950045235,
      "clozeId": 151788532,
      "correctResponse": "action potentials"
    },
    {
      "cloze": "When an action potential passes along the membrane of a synaptic knob , it increases the __________ to calcium ions by opening calcium ion channels .",
      "itemId": 1810783172,
      "clozeId": 826085680,
      "correctResponse": "membrane 's permeability"
    },
    {
      "cloze": "When an action potential passes along the membrane of a __________ , it increases the membrane 's permeability to calcium ions by opening calcium ion channels .",
      "itemId": 1810783172,
      "clozeId": -1802390953,
      "correctResponse": "synaptic knob"
    },
    {
      "cloze": "When neurotransmitters bind these receptors , they cause ion channels in the __________ to open .",
      "itemId": 946865316,
      "clozeId": -1426451344,
      "correctResponse": "postsynaptic cells"
    },
    {
      "cloze": "When __________ bind these receptors , they cause ion channels in the postsynaptic cells to open .",
      "itemId": 946865316,
      "clozeId": 1955481185,
      "correctResponse": "neurotransmitters"
    },
    {
      "cloze": "When neurotransmitters bind these __________ , they cause ion channels in the postsynaptic cells to open .",
      "itemId": 946865316,
      "clozeId": 403552531,
      "correctResponse": "receptors"
    },
    {
      "cloze": "When sufficiently stimulated , sensory receptors trigger impulses that travel on __________ into the brain or spinal cord .",
      "itemId": 1237795403,
      "clozeId": -1028681156,
      "correctResponse": "sensory neuron axons"
    },
    {
      "cloze": "With the resting membrane potential established , sodium ions and __________ continue to diffuse across the cell membrane .",
      "itemId": -1840082358,
      "clozeId": -1416554680,
      "correctResponse": "potassium ions"
    },
    {
      "cloze": "__________ -- cylindrical process that conducts impulses away from a neuron cell body .",
      "itemId": 953624645,
      "clozeId": 1201131529,
      "correctResponse": "axon"
    },
    {
      "cloze": "axon -- cylindrical process that conducts impulses away from a __________ .",
      "itemId": 953624645,
      "clozeId": 950744168,
      "correctResponse": "neuron cell body"
    },
    {
      "cloze": "bipolar __________ -- __________ with two processes extending from the cell body .",
      "itemId": 1220544949,
      "clozeId": -1286886251,
      "correctResponse": "neuron"
    },
    {
      "cloze": "__________ -- neuroglia that line spaces in the brain and spinal cord .",
      "itemId": -151439403,
      "clozeId": -1354205268,
      "correctResponse": "ependyma"
    },
    {
      "cloze": "ependyma -- __________ that line spaces in the brain and spinal cord .",
      "itemId": -151439403,
      "clozeId": -1787869595,
      "correctResponse": "neuroglia"
    },
    {
      "cloze": "peripheral nervous system -- portion of the nervous system that consists of the __________ branching from the brain and spinal cord .",
      "itemId": 756925138,
      "clozeId": 1580809791,
      "correctResponse": "nerves"
    },
    {
      "cloze": "saltatory conduction -- impulse conduction in which the impulse seems to jump from __________ to __________ along the axon .",
      "itemId": 79602613,
      "clozeId": 597047381,
      "correctResponse": "node"
    },
    {
      "cloze": "saltatory conduction -- impulse conduction in which the impulse seems to jump from node to node along the __________ .",
      "itemId": 79602613,
      "clozeId": 699873513,
      "correctResponse": "axon"
    },
    {
      "cloze": "saltatory conduction -- __________ in which the impulse seems to jump from node to node along the axon .",
      "itemId": 79602613,
      "clozeId": -220898526,
      "correctResponse": "impulse conduction"
    },
    {
      "cloze": "sensory neuron -- neuron that can be stimulated by a __________ and conducts impulses into the brain or spinal cord .",
      "itemId": 867660353,
      "clozeId": -2127113068,
      "correctResponse": "sensory receptor"
    },
    {
      "cloze": "unipolar -- __________ with only one process extending from the cell body .",
      "itemId": -729033589,
      "clozeId": -836326944,
      "correctResponse": "neuron"
    }
  ]
};
