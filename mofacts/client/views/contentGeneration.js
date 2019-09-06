Session.set("curClozeSentencePairItemId", "");
Session.set("clozeSentencePairs", {});
Session.set("clozeHistory", []);

stubGenerateContent = function(textData){
  var sentences = [
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "itemId":"1", "hasCloze":true},
    {"sentence":"Cras placerat accumsan nulla.", "itemId":"2", "hasCloze":false},
    {"sentence":"Fusce sagittis, libero non molestie mollis, magna orci ultrices dolor, at vulputate neque nulla lacinia eros.", "itemId":"3", "hasCloze":false},
    {"sentence":"Nunc eleifend leo vitae magna.", "itemId":"4", "hasCloze":false},
    {"sentence":"Proin quam nisl, tincidunt et, mattis eget, convallis nec, purus.", "itemId":"5", "hasCloze":true},
    {"sentence":"Sed diam.", "itemId":"6", "hasCloze":false},
    {"sentence":"Etiam laoreet quam sed arcu.", "itemId":"7", "hasCloze":false},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "itemId":"8", "hasCloze":false},
    {"sentence":"Donec at pede.", "itemId":"9", "hasCloze":false},
    {"sentence":"Sed diam.", "itemId":"10", "hasCloze":false},
    {"sentence":"Nam vestibulum accumsan nisl.", "itemId":"11", "hasCloze":false},
    {"sentence":"Nunc rutrum turpis sed pede.", "itemId":"12", "hasCloze":false},
    {"sentence":"Pellentesque dapibus suscipit ligula.", "itemId":"13", "hasCloze":false},
    {"sentence":"Suspendisse potenti.", "itemId":"14", "hasCloze":false},
    {"sentence":"Nam a sapien.", "itemId":"15", "hasCloze":false},
    {"sentence":"Vivamus id enim.", "itemId":"16", "hasCloze":false},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "itemId":"17", "hasCloze":false},
    {"sentence":"Aliquam feugiat tellus ut neque.", "itemId":"18", "hasCloze":true},
    {"sentence":"Praesent fermentum tempor tellus.", "itemId":"19", "hasCloze":false},
    {"sentence":"Mauris mollis tincitemIdunt felis.", "itemId":"20", "hasCloze":true},
    {"sentence":"Etiam vel tortor sodales tellus ultricies commodo.", "itemId":"21", "hasCloze":false},
    {"sentence":"Donec hendrerit tempor tellus.", "itemId":"22", "hasCloze":true},
    {"sentence":"Praesent fermentum tempor tellus.", "itemId":"23", "hasCloze":false},
    {"sentence":"Phasellus neque orci, porta a, aliquet quis, semper a, massa.", "itemId":"24", "hasCloze":false},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "itemId":"25", "hasCloze":false},
    {"sentence":"Nunc rutrum turpis sed pede.", "itemId":"26", "hasCloze":false},
    {"sentence":"Aliquam erat volutpat.", "itemId":"27", "hasCloze":false},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "itemId":"28", "hasCloze":false},
    {"sentence":"Nulla posuere.", "itemId":"29", "hasCloze":false},
    {"sentence":"Nunc porta vulputate tellus.", "itemId":"30", "hasCloze":false},
    {"sentence":"Vivamus id enim.", "itemId":"31", "hasCloze":true},
    {"sentence":"Nullam tristique diam non turpis.", "itemId":"32", "hasCloze":false}
  ];

  var clozes = [
    {"cloze":"Donec _____ quam, dignissim in, mollis nec, sagittis eu, wisi.", "itemId":"1","clozeId":"c1", "correctResponse":"neque"},
    {"cloze":"Proin quam nisl, _____ et, mattis eget, convallis nec, purus.", "itemId":"5","clozeId":"c2", "correctResponse":"tincidunt"},
    {"cloze":"Aliquam feugiat _____ ut neque.", "itemId":"18","clozeId":"c3", "correctResponse":"tellus"},
    {"cloze":"Mauris mollis _____ felis.", "itemId":"20","clozeId":"c4", "correctResponse":"tincidunt"},
    {"cloze":"Donec _____ tempor tellus.", "itemId":"22","clozeId":"c5", "correctResponse":"hendrerit"},
    {"cloze":"_____ id enim", "itemId":"31","clozeId":"c6", "correctResponse":"Vivamus"},
    {"cloze":"Vivamus id _____", "itemId":"31","clozeId":"c7", "correctResponse":"enim"}
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
    Session.set("curClozeSentencePairItemId", event.currentTarget.getAttribute('uid'));
  },

  'click .sentence-with-cloze': function(event){
    Session.set("curClozeSentencePairItemId", event.currentTarget.getAttribute('uid'));
  },

  'click #submit-btn': function(event){
    stubGenerateContent();
  },

  'click #save-btn-final': function(event){
    stubGenerateAndSubmitTDF();
  },

  'click #save-btn': function(event){
    $('#save-modal').modal('show');
  },

  'click #edit-btn': function(event){
    $('#edit-modal').modal('show');
  },

  'click #delete-btn': function(event){
    var curClozeId = event.currentTarget.getAttribute('cloze-uid');
    var curItemId = event.currentTarget.getAttribute('uid');
    var prevClozeSentencePairs = Session.get("clozeSentencePairs");
    
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
  }
});
