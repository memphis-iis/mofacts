var soundsDict = {};
var onEndCallbackDict = {};

preloadAudioFiles = function(){
  console.log("preloading audio files");
  var allQuestions = getAllStimQuestions();
  for(var index in allQuestions){
    var question = allQuestions[index];
    soundsDict[question] = new Howl({
        preload: true,
        src: [
            question + '.mp3',
            question + '.ogg',
            question + '.wav',
        ],

        //Must do an Immediately Invoked Function Expression otherwise question
        //is captured as a closure and will change to the last value in the loop
        //by the time we call this
        onplay: (function(question) {
            if (soundsDict[question]) {
                soundsDict[question].isCurrentlyPlaying = true;
            }
            console.log("Sound " + question + " played");
        })(question),

        onend: (function(question) {
          return function(){
              if (soundsDict[question]) {
                  soundsDict[question].isCurrentlyPlaying = false;
              }
              if (!!onEndCallbackDict[question]) {
                  onEndCallbackDict[question]();
              }
              console.log("Sound completed");
          }
        })(question),
    });
  }
  console.log("Sounds loaded");
}

Template.soundTest.rendered = function() {
    console.log("card rendered");
    Session.set("currentStimName","Chinesestims.xml");
    console.log("curStimName: " + getCurrentStimName());
    //preloadAudioFiles();
};

playSound = function(){
  console.log("Play Sound clicked!");
  console.log($('#curSoundFile').val());
  currentQuestion = $('#curSoundFile').val();//'sounds/toneresource/1.4ma/T1_400ms__vowel';
  currentQuestionSound = soundsDict[currentQuestion];
  onEndCallback = function(){
    console.log("sound done playing");
  }
  onEndCallbackDict[currentQuestion] = onEndCallback;

  //In case our caller checks before the sound has a chance to load, we
  //mark the howler instance as playing
  currentQuestionSound.isCurrentlyPlaying = true;
  currentQuestionSound.play();
}
