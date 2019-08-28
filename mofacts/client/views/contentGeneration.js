Session.set("curClozeSentencePairId", "");
Session.set("clozeSentencePairs", {});

stubGenerateContent = function(textData){
  var sentences = [
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"1", "hasCloze":true},
    {"sentence":"Cras placerat accumsan nulla.", "id":"2", "hasCloze":false},
    {"sentence":"Fusce sagittis, libero non molestie mollis, magna orci ultrices dolor, at vulputate neque nulla lacinia eros.", "id":"3", "hasCloze":false},
    {"sentence":"Nunc eleifend leo vitae magna.", "id":"4", "hasCloze":false},
    {"sentence":"Proin quam nisl, tincidunt et, mattis eget, convallis nec, purus.", "id":"5", "hasCloze":true},
    {"sentence":"Sed diam.", "id":"6", "hasCloze":false},
    {"sentence":"Etiam laoreet quam sed arcu.", "id":"7", "hasCloze":false},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"8", "hasCloze":false},
    {"sentence":"Donec at pede.", "id":"9", "hasCloze":false},
    {"sentence":"Sed diam.", "id":"10", "hasCloze":false},
    {"sentence":"Nam vestibulum accumsan nisl.", "id":"11", "hasCloze":false},
    {"sentence":"Nunc rutrum turpis sed pede.", "id":"12", "hasCloze":false},
    {"sentence":"Pellentesque dapibus suscipit ligula.", "id":"13", "hasCloze":false},
    {"sentence":"Suspendisse potenti.", "id":"14", "hasCloze":false},
    {"sentence":"Nam a sapien.", "id":"15", "hasCloze":false},
    {"sentence":"Vivamus id enim.", "id":"16", "hasCloze":false},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "id":"17", "hasCloze":false},
    {"sentence":"Aliquam feugiat tellus ut neque.", "id":"18", "hasCloze":true},
    {"sentence":"Praesent fermentum tempor tellus.", "id":"19", "hasCloze":false},
    {"sentence":"Mauris mollis tincidunt felis.", "id":"20", "hasCloze":true},
    {"sentence":"Etiam vel tortor sodales tellus ultricies commodo.", "id":"21", "hasCloze":false},
    {"sentence":"Donec hendrerit tempor tellus.", "id":"22", "hasCloze":true},
    {"sentence":"Praesent fermentum tempor tellus.", "id":"23", "hasCloze":false},
    {"sentence":"Phasellus neque orci, porta a, aliquet quis, semper a, massa.", "id":"24", "hasCloze":false},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "id":"25", "hasCloze":false},
    {"sentence":"Nunc rutrum turpis sed pede.", "id":"26", "hasCloze":false},
    {"sentence":"Aliquam erat volutpat.", "id":"27", "hasCloze":false},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"28", "hasCloze":false},
    {"sentence":"Nulla posuere.", "id":"29", "hasCloze":false},
    {"sentence":"Nunc porta vulputate tellus.", "id":"30", "hasCloze":false},
    {"sentence":"Vivamus id enim.", "id":"31", "hasCloze":true},
    {"sentence":"Nullam tristique diam non turpis.", "id":"32", "hasCloze":false}
  ];

  var clozes = [
    {"cloze":"Donec _____ quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"1", "correctResponse":"neque"},
    {"cloze":"Proin quam nisl, _____ et, mattis eget, convallis nec, purus.", "id":"5", "correctResponse":"tincidunt"},
    {"cloze":"Aliquam feugiat _____ ut neque.", "id":"18", "correctResponse":"tellus"},
    {"cloze":"Mauris mollis _____ felis.", "id":"20", "correctResponse":"tincidunt"},
    {"cloze":"Donec _____ tempor tellus.", "id":"22", "correctResponse":"hendrerit"},
    {"cloze":"_____ id enim", "id":"31", "correctResponse":"Vivamus"}
  ];

  Session.set("clozeSentencePairs", {
    "sentences":sentences,
    "clozes":clozes
  });
}

stubGenerateAndSubmitTDF = function(){
  console.log('Generating TDF with clozes: ', Session.get('clozeSentencePairs').clozes);
}

Template.contentGeneration.events({
  'click #cloze': function(event){
    Session.set("curClozeSentencePairId", event.currentTarget.getAttribute('uid'));
  },

  'click .sentence-with-cloze': function(event){
    Session.set("curClozeSentencePairId", event.currentTarget.getAttribute('uid'));
  },

  'click #submit-btn': function(event){
    stubGenerateContent();
  },

  'click #save-btn': function(event){
    stubGenerateAndSubmitTDF();
  },

  'click #delete-btn': function(event){
    var curClozeId = event.currentTarget.getAttribute('uid');
    var prevClozeSentencePairs = Session.get("clozeSentencePairs");
    var newSentences = _.map(prevClozeSentencePairs.sentences, function(s) {
      if(s.id === curClozeId) {
        s.hasCloze = false;
        return s;
      } else {
        return s;
      }
    });
    var newClozes = _.filter(prevClozeSentencePairs.clozes, function(c) {return c.id != curClozeId});
    Session.set('clozeSentencePairs', {
      'sentences':newSentences,
      'clozes':newClozes
    });
  }
});

Template.contentGeneration.helpers({
  sentences: function() {
    return Session.get("clozeSentencePairs").sentences;
  },

  clozes: function() {
    return Session.get("clozeSentencePairs").clozes;
  },

  isCurrentPair: function(id) {
    return id === Session.get("curClozeSentencePairId");
  }
});
