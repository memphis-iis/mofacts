Session.set("curClozeSentencePairId", "");
Session.set("clozeSentencePairs", {});

stubGenerateContent = function(textData){
  var sentences = [
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"1"},
    {"sentence":"Cras placerat accumsan nulla.", "id":"2"},
    {"sentence":"Fusce sagittis, libero non molestie mollis, magna orci ultrices dolor, at vulputate neque nulla lacinia eros.", "id":"3"},
    {"sentence":"Nunc eleifend leo vitae magna.", "id":"4"},
    {"sentence":"Proin quam nisl, tincidunt et, mattis eget, convallis nec, purus.", "id":"5"},
    {"sentence":"Sed diam.", "id":"6"},
    {"sentence":"Etiam laoreet quam sed arcu.", "id":"7"},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"8"},
    {"sentence":"Donec at pede.", "id":"9"},
    {"sentence":"Sed diam.", "id":"10"},
    {"sentence":"Nam vestibulum accumsan nisl.", "id":"11"},
    {"sentence":"Nunc rutrum turpis sed pede.", "id":"12"},
    {"sentence":"Pellentesque dapibus suscipit ligula.", "id":"13"},
    {"sentence":"Suspendisse potenti.", "id":"14"},
    {"sentence":"Nam a sapien.", "id":"15"},
    {"sentence":"Vivamus id enim.", "id":"16"},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "id":"17"},
    {"sentence":"Aliquam feugiat tellus ut neque.", "id":"18"},
    {"sentence":"Praesent fermentum tempor tellus.", "id":"19"},
    {"sentence":"Mauris mollis tincidunt felis.", "id":"20"},
    {"sentence":"Etiam vel tortor sodales tellus ultricies commodo.", "id":"21"},
    {"sentence":"Donec hendrerit tempor tellus.", "id":"22"},
    {"sentence":"Praesent fermentum tempor tellus.", "id":"23"},
    {"sentence":"Phasellus neque orci, porta a, aliquet quis, semper a, massa.", "id":"24"},
    {"sentence":"Fusce suscipit, wisi nec facilisis facilisis, est dui fermentum leo, quis tempor ligula erat quis odio.", "id":"25"},
    {"sentence":"Nunc rutrum turpis sed pede.", "id":"26"},
    {"sentence":"Aliquam erat volutpat.", "id":"27"},
    {"sentence":"Donec neque quam, dignissim in, mollis nec, sagittis eu, wisi.", "id":"28"},
    {"sentence":"Nulla posuere.", "id":"29"},
    {"sentence":"Nunc porta vulputate tellus.", "id":"30"},
    {"sentence":"Vivamus id enim.", "id":"31"},
    {"sentence":"Nullam tristique diam non turpis.", "id":"32"}
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

Template.contentGeneration.events({
  'click #cloze': function(event){
    Session.set("curClozeSentencePairId", event.currentTarget.getAttribute('uid'));
  },

  'click #sentence': function(event){
    Session.set("curClozeSentencePairId", event.currentTarget.getAttribute('uid'));
  },

  'click #submit-btn': function(event){
    stubGenerateContent();
  },

  'click #delete-btn': function(event){
    var curCloze = event.target.ParentNode.getAttribute('uid');
    console.log('deleting cloze: ', curCloze);
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
