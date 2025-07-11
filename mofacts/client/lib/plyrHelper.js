import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js'
import { Session } from 'meteor/session';

export let playerController;

class PlayerController {
  player;
  currentCheckpointIndex = 0;  
  maxAllowedTime = 0;         
  allowSeeking = false;       

  lastVolume;
  lastSpeed;
  lastTimeIndex = 0;
  lastlogicIndex = 0;
  nextTimeIndex = 0;
  nextTime = 0;
  seekStart;
  loggingSeek = false;
  fullscreenUser = false;
  questioningComplete = false;

  // Checkpoint-related properties
  preventScrubbing = false;
  rewindOnIncorrect = false;
  checkpointBehavior = 'none';
  repeatQuestionsSinceCheckpoint = false;
  checkpoints = [];
  completedQuestions = new Set();
  questionsToRepeat = [];

  times = [];
  questions = [];

  constructor(playerElement, times, questions, points) {
    const videoSession = Session.get('currentTdfUnit').videosession;
    this.preventScrubbing = videoSession.preventScrubbing || false;
    this.rewindOnIncorrect = videoSession.rewindOnIncorrect || false;
    this.checkpointBehavior = videoSession.checkpointBehavior || 'none'
    this.repeatQuestionsSinceCheckpoint = videoSession.repeatQuestionsSinceCheckpoint || false;
    
    // Initialize checkpoints based on behavior
    this.checkpoints = [];
    this.questionTimes = times || [];
    this.questions = questions || [];
    this.currentQuestionIndex = 0;
    this.completedQuestions = new Set(); // Track which questions have been answered correctly
    this.questionsToRepeat = []; // Track questions that need to be repeated after rewind
    
    if (this.checkpointBehavior === 'all') {
      // Use all question times as checkpoints
      this.checkpoints = times.map(time => ({ time }));
    } else if (this.checkpointBehavior === 'some') {
      // Use question times where stim has checkpoint:true
      this.checkpoints = this.buildSelectiveCheckpoints(times, questions);
    } else if (this.checkpointBehavior === 'adaptive' && videoSession.checkpoints) {
      // Use adaptively generated checkpoints
      this.checkpoints = videoSession.checkpoints.slice();
    }
    
    // Always add time 0 as the first checkpoint (beginning of video)
    if (this.checkpoints.length > 0 && this.checkpoints[0].time !== 0) {
      this.checkpoints.unshift({ time: 0 });
    }
    
    const plyrConfig = {
      markers: { enabled: times.length > 0, points: points }
    };
    // If scrubbing is prevented, modify controls
    if (this.preventScrubbing) {
      plyrConfig.controls = [
        'play-large', 
        'play', 
        'current-time', 
        'mute', 
        'volume', 
        'fullscreen'
      ];
      // Disable seeking and keyboard controls
      plyrConfig.seekTime = 0;
      plyrConfig.keyboard = { focused: false, global: false };
      plyrConfig.clickToPlay = false;
    }
    this.player = new Plyr(playerElement, plyrConfig);
    this.times = times;
    this.questions = questions;
    this.lastVolume = this.player.volume;
    this.lastSpeed = this.player.speed;
    this.currentProgressTime = 0;
    this.startTime = Date.now();
    this.checkingPoint = false;
    this.isPlaying = false;
    this.hasSetSpeed = false;
    this.totalTime = 0;
    this.currentQuestionIndex = 0;
  }

  // Build checkpoints for selective behavior (checkpointBehavior: "some")
  buildSelectiveCheckpoints(times, questions) {
    const checkpoints = [];
    const videoSession = Session.get('currentTdfUnit').videosession;
    
    // New approach: Use checkpointQuestions array if available
    if (videoSession.checkpointQuestions && Array.isArray(videoSession.checkpointQuestions)) {
      videoSession.checkpointQuestions.forEach(questionIndex => {
        // Convert 1-based question index to 0-based array index
        const arrayIndex = questionIndex - 1;
        if (arrayIndex >= 0 && arrayIndex < times.length) {
          checkpoints.push({ time: times[arrayIndex] });
        }
      });
    } else {
      // Fallback: Use legacy stims array approach
      const currentStimuliSet = Session.get('currentStimuliSet') || [];
      
      // Check each question time to see if corresponding stim has checkpoint:true
      times.forEach((time, index) => {
        if (index < currentStimuliSet.length) {
          const stim = currentStimuliSet[index];
          if (stim && stim.checkpoint === true) {
            checkpoints.push({ time });
          }
        }
      });
    }
    
    return checkpoints;
  }

  // Find the previous checkpoint before the current time
  findPreviousCheckpoint(currentTime) {
    if (this.checkpoints.length === 0) return null;
    
    // Find the checkpoint that comes before the current time
    let previousCheckpoint = null;
    for (const checkpoint of this.checkpoints) {
      if (checkpoint.time < currentTime) {
        previousCheckpoint = checkpoint;
      } else {
        break; 
      }
    }
    
    return previousCheckpoint;
  }

  // Get the current question index based on time
  getCurrentQuestionIndex(currentTime) {
    for (let i = 0; i < this.questionTimes.length; i++) {
      if (Math.abs(this.questionTimes[i] - currentTime) < 5) { // 5 second tolerance
        return i;
      }
    }
    return -1; // Not at a question time
  }

  // Mark questions between checkpoint and current time for repetition
  markQuestionsForRepetition(checkpointTime, currentTime) {
    if (!this.repeatQuestionsSinceCheckpoint) return;
    
    // Find all questions between checkpoint time and current time
    const questionsToRepeat = [];
    for (let i = 0; i < this.questionTimes.length; i++) {
      const questionTime = this.questionTimes[i];
      if (questionTime >= checkpointTime && questionTime <= currentTime) {
        // Only add questions that haven't been completed correctly
        if (!this.completedQuestions.has(i)) {
          questionsToRepeat.push({
            index: i,
            time: questionTime,
            question: this.questions[i]
          });
        }
      }
    }
    
    this.questionsToRepeat = questionsToRepeat;
    console.log(`Marked ${questionsToRepeat.length} questions for repetition:`, questionsToRepeat);
    
    // Optionally, schedule these questions to be repeated after the video segment
    if (questionsToRepeat.length > 0) {
      this.scheduleQuestionRepetition(questionsToRepeat);
    }
  }

  // Schedule repeated questions (this would integrate with the MoFaCTS question engine)
  scheduleQuestionRepetition(questionsToRepeat) {
    // This is a placeholder for integration with the MoFaCTS scheduling system
    // In practice, this would need to interact with the experiment engine
    console.log('Scheduling questions for repetition:', questionsToRepeat);
    
    // Store the questions to repeat in session for later processing
    Session.set('questionsToRepeat', questionsToRepeat);
    
    // Optionally, show a notification to the user
    this.showRepetitionNotification(questionsToRepeat.length);
  }

  // Show notification about question repetition
  showRepetitionNotification(count) {
    console.log(`${count} questions will be repeated after this video segment`);
    // This could show a UI notification to inform the student
  }

  // Check if there are questions pending repetition
  hasPendingRepetitions() {
    return this.questionsToRepeat && this.questionsToRepeat.length > 0;
  }

  // Get the next question to repeat
  getNextRepetitionQuestion() {
    if (this.questionsToRepeat && this.questionsToRepeat.length > 0) {
      return this.questionsToRepeat.shift();
    }
    return null;
  }

  // Clear completed repetitions
  clearCompletedRepetition(questionIndex) {
    this.completedQuestions.add(questionIndex);
    console.log(`Question ${questionIndex} completed during repetition`);
  }

  // Handle question response with enhanced checkpoint logic
  handleQuestionResponse(isCorrect) {
    const currentTime = this.player.currentTime;
    const currentQuestionIndex = this.getCurrentQuestionIndex(currentTime);
    
    if (isCorrect) {
      // Mark this question as completed correctly
      if (currentQuestionIndex !== -1) {
        this.completedQuestions.add(currentQuestionIndex);
      }
      return; // No rewind needed
    }

    if (!this.rewindOnIncorrect) {
      return; // Rewind is disabled
    }

    const previousCheckpoint = this.findPreviousCheckpoint(currentTime);
    
    if (previousCheckpoint) {
      console.log(`Rewinding to previous checkpoint at ${previousCheckpoint.time} seconds`);
      
      // If repeatQuestionsSinceCheckpoint is enabled, mark questions for repetition
      if (this.repeatQuestionsSinceCheckpoint) {
        this.markQuestionsForRepetition(previousCheckpoint.time, currentTime);
      }
      
      this.player.currentTime = previousCheckpoint.time;
      // Auto-play after rewind
      if (this.player.paused) {
        this.player.play();
      }
    } else {
      console.log('No previous checkpoint found, rewinding to beginning');
      
      // If repeatQuestionsSinceCheckpoint is enabled, mark all questions for repetition
      if (this.repeatQuestionsSinceCheckpoint) {
        this.markQuestionsForRepetition(0, currentTime);
      }
      
      this.player.currentTime = 0;
      if (this.player.paused) {
        this.player.play();
      }
    }
  } 
  
  rewindToPreviousCheckpoint() {
      if (!this.rewindOnIncorrect) return;
      
      if (this.currentCheckpointIndex > 0) {
        this.currentCheckpointIndex--;
      }
      
      const checkpointTime = this.checkpoints[this.currentCheckpointIndex];
      this.maxAllowedTime = checkpointTime;
      
      // Temporarily allow seeking for rewind
      this.allowSeeking = true;
      this.player.currentTime = checkpointTime;
      this.allowSeeking = false;
      
      // Reset question state for dynamic scheduling
      this.questioningComplete = false;
      for(let i = 0; i < this.times.length; i++){
        if(this.times[i] > checkpointTime){
          this.nextTimeIndex = i;
          this.nextTime = this.times[i];
          break;
        }
      }
      
      console.log(`Rewound to checkpoint ${this.currentCheckpointIndex} at time ${checkpointTime}`);
      this.logPlyrAction('rewind_to_checkpoint');
    }
    
    advanceToNextCheckpoint() {
      if (this.currentCheckpointIndex < this.checkpoints.length - 1) {
        this.currentCheckpointIndex++;
        this.maxAllowedTime = Math.max(this.maxAllowedTime, this.player.currentTime);
      }
      
      console.log(`Advanced to checkpoint ${this.currentCheckpointIndex}`);
      this.logPlyrAction('advance_checkpoint');
    }

    handleCorrectAnswer() {
      this.advanceToNextCheckpoint();
  }
  // Initialize video cards and set up event listeners
  async initVideoCards() {
    this.questions = Session.get('currentTdfUnit').videosession.questions;
    this.times.sort((a, b) => a - b);
    if(this.nextTimeIndex < this.times.length){
      this.nextTime = this.times[this.nextTimeIndex];
      let nextQuestion = this.questions[this.nextTimeIndex];
      let indices = {stimIndex: 0, clusterIndex: nextQuestion}
      await engine.selectNextCard(indices, Session.get('currentExperimentState'));
      await newQuestionHandler();
    }

    //if this is not the furthest unit the student has reached, display the continue button
    if(Session.get('currentUnitNumber') < Session.get('currentExperimentState').lastUnitStarted){
      $("#continueBar").removeAttr('hidden');
      $('#continueButton').prop('disabled', false);
    }
  
    this.player.on('timeupdate', () => this.timeUpdate());
  
    this.player.on('pause', () => this.logPlyrAction('pause'));
  
    this.player.on('play', () => this.logPlyrAction('play'));
  
    this.player.on('volumechange', () => this.logPlyrAction('volumechange'));
  
    this.player.on('ratechange', () => this.logPlyrAction('ratechange'));
  
    this.player.on('ended', () => this.endPlayback());

    if (this.preventScrubbing) {
      this.player.on('seeking', (event) => {
        if (!this.allowSeeking) {
          const targetTime = this.player.currentTime;
          if (targetTime > this.maxAllowedTime) {
            event.preventDefault();
            this.player.currentTime = this.maxAllowedTime;
            this.logPlyrAction('seek_blocked');
          }
        }
      });
    }
  
    waitForElm("[id*='plyr-seek']").then((elm) => elm.addEventListener("mouseup", stopSeeking));
  
    waitForElm("[id*='plyr-seek']").then((elm) => elm.addEventListener("mousedown", startSeeking));

    this.playVideo();
  }

  async setNextTime(time, index){
    this.nextTime = time;
    this.nextTimeIndex = index;
    const nextQuestion = this.questions[index];
    Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
    await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    await newQuestionHandler();
  }

  timeUpdate(){
    let currentTime = this.player.currentTime;
    
    // Prevent scrubbing ahead if enabled
    if (this.preventScrubbing && currentTime > this.maxAllowedTime + 1) {
      this.player.currentTime = this.maxAllowedTime;
      return;
    }
    
    // Update max allowed time as video progresses naturally
    if (!this.preventScrubbing || currentTime <= this.maxAllowedTime + 1) {
      this.maxAllowedTime = Math.max(this.maxAllowedTime, currentTime);
    }

    // If no times are set or nextTimeIndex is -1, set nextTime to end of video
    if(this.times.length == 0 || this.nextTimeIndex == -1) {
      this.nextTime = this.player.duration;
      this.questioningComplete = true;
    } else {
      this.nextTime = this.times[this.nextTimeIndex];
    }
    //get the difference between the current time and the next time

    const timeDiff = this.nextTime - this.player.currentTime;
    //if this.times[this.nextTimeIndex] is undefined, we set it to the end of the video
    if(this.nextTime == undefined){
      this.questioningComplete = true;
      this.times.push(this.player.duration);
      this.nextTime = this.player.duration;
    }
    //get the difference between the next time and the previous time
    const lastTime = this.nextTimeIndex == 0 ? 0: this.times[this.lastTimeIndex];
    const totalTimeDiff =  this.nextTime - lastTime;
    //get the percentage of the progress bar that should be filled
    const percentage = (timeDiff / totalTimeDiff) * 100;
    //console.log('timeupdate', this.player.currentTime, nextTime, '-', lastTime, '=', totalTimeDiff, timeDiff, percentage);
    //add class
    $('#progressbar').addClass('progress-bar');
    //set the width of the progress bar
    if(this.times.length != 0 || Session.get('curTdfUISettings').displayReviewTimeoutAsBarOrText == "bar" || Session.get('curTdfUISettings').displayEndOfVideoCountdown){
      if(Session.get('curTdfUISettings').displayReviewTimeoutAsBarOrText == "text" || Session.get('curTdfUISettings').displayReviewTimeoutAsBarOrText == "both"){                
        document.getElementById("CountdownTimerText").innerHTML = 'Continuing in: ' + Math.floor(timeDiff) + ' seconds';
      } else {
        document.getElementById("CountdownTimerText").innerHTML = '';
      }
      if(Session.get('curTdfUISettings').displayReviewTimeoutAsBarOrText == "bar" || Session.get('curTdfUISettings').displayCardTimeoutAsBarOrText == "both"){
        //add the progress bar class
        $('#progressbar').addClass('progress-bar');
        document.getElementById("progressbar").style.width = percentage + "%";
      } else {
        //set width to 0% 
        document.getElementById("progressbar").style.width = 0 + "%";
        //remove progress bar class
        $('#progressbar').removeClass('progress-bar');
      }
   }
    if(timeDiff < 0 && !this.questioningComplete){
      this.showQuestion();
    }
  }

  endPlayback(){
    console.log('video ended');
    this.logPlyrAction('end');
    Session.set('engineIndices', undefined);
    $("#continueBar").removeAttr('hidden');
    $('#continueButton').prop('disabled', false);
  }
  
  logPlyrAction(action){
    console.log('logging plyr action', action, this.player.currentTime, this.player.volume, this.player.speed, this.player.playing)
    const trialStartTimestamp = Session.get('trialStartTimestamp');
    const sessionID = (new Date(trialStartTimestamp)).toUTCString().substr(0, 16) + ' ' + Session.get('currentTdfName');
  
    const curTdf = Session.get('currentTdfFile');
    const unitName = _.trim(curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].unitname);
  
    const problemName = Session.get('currentExperimentState').originalDisplay;
    const stepName = problemName;
  
    const currentTime = this.player.currentTime;
    const seekEnd = this.seekStart ? currentTime : null;
      
    const answerLogRecord = {
      'itemId': "N/A",
      'KCId': "N/A",
      'hintLevel': parseInt(Session.get('hintLevel')) || 0,
      'userId': Meteor.userId(),
      'TDFId': Session.get('currentTdfId'),
      'outcome': action,
      'probabilityEstimate': "N/A",
      'typeOfResponse': "N/A",
      'responseValue': "N/A",
      'displayedStimulus': Session.get('currentDisplay'),
      'sectionId': Session.get('curSectionId'),
      'teacherId': Session.get('curTeacher')?._id,
      'anonStudentId': Meteor.user().username,
      'sessionID': sessionID,
  
      'conditionNameA': 'tdf file',
      // Note: we use this to enrich the history record server side, change both places if at all
      'conditionTypeA': Session.get('currentTdfName'),
      'conditionNameB': 'xcondition',
      'conditionTypeB': Session.get('experimentXCond') || null,
      'conditionNameC': 'schedule condition',
      'conditionTypeC': "N/A",
      'conditionNameD': 'how answered',
      'conditionTypeD': _.trim(action),
      'conditionNameE': 'section',
      'conditionTypeE': Meteor.user().loginParams.entryPoint && 
          Meteor.user().loginParams.entryPoint !== 'direct' ? Meteor.user().loginParams.entryPoint : null,
  
      'responseDuration': null,
  
      'levelUnit': Session.get('currentUnitNumber'),
      'levelUnitName': unitName,
      'levelUnitType': Session.get('unitType'),
      'problemName': problemName,
      'stepName': stepName, // this is no longer a valid field as we don't restore state one step at a time
      'time': trialStartTimestamp,
      'selection': '',
      'action': action,
      'input': _.trim(action),
      'studentResponseType': "N/A",
      'studentResponseSubtype': "N/A",
      'tutorResponseType': "N/A",
      'KCDefault': "N/A",
      'KCCategoryDefault': '',
      'KCCluster': "N/A",
      'KCCategoryCluster': '',
      'CFStartLatency': null,
      'CFEndLatency': null,
      'CFFeedbackLatency': null,
      'CFVideoTimeStamp': currentTime,
      'CFVideoSeekStart': this.seekStart,
      'CFVideoSeekEnd': seekEnd,
      'CFVideoCurrentSpeed': this.player.speed,
      'CFVideoCurrentVolume': this.player.volume,
      'CFVideoPreviousSpeed': this.lastSpeed,
      'CFVideoPreviousVolume': this.lastVolume,
      'CFVideoIsPlaying': this.player.playing,
      'feedbackText': $('#UserInteraction').text() || '',
      'feedbackType': 'N/A',
      'dialogueHistory': "N/A",
      'instructionQuestionResult': Session.get('instructionQuestionResult') || false,
      'hintLevel': 0,
      'entryPoint': Meteor.user().loginParams.entryPoint
    };
    Meteor.call('insertHistory', answerLogRecord);
  }

  async playVideo() {
    let indices = Session.get('engineIndices');
  
    if(this.fullscreenUser){
      this.player.fullscreen.enter();
    }
    $("#videoUnitContainer").show();
    this.player.play();
    newQuestionHandler();
  }


  showQuestion(){
    this.fullscreenUser = this.player.fullscreen.active;
    this.player.pause();
    if(this.player.fullscreen.active) this.player.fullscreen.exit();
    Session.set('displayReady', true);

    console.log('playback paused at ', this.player.currentTime);
    this.lastTimeIndex = this.nextTimeIndex;
    if(this.nextTimeIndex < this.times.length){
      this.nextTimeIndex++;
      this.nextTime = this.times[this.nextTimeIndex];
      let nextQuestion = this.questions[this.nextTimeIndex];
      Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', false);
    }
  }

  async playNextCard() {
    let curTdfUnit = Session.get('currentTdfUnit');
    let logic = '';
    if( curTdfUnit.videosession.adaptiveLogic && curTdfUnit.videosession.adaptiveLogic[this.lastlogicIndex])
      logic = curTdfUnit.videosession.adaptiveLogic[this.lastlogicIndex];
    this.lastlogicIndex++;
    if(engine.adaptiveQuestionLogic){
      if(logic != '' && logic != undefined){
        console.log('adaptive schedule', engine.adaptiveQuestionLogic.schedule);   
        await engine.adaptiveQuestionLogic.evaluate(logic);
      }
      //add new question to current unit
      if(engine.adaptiveQuestionLogic.when == Session.get("currentUnitNumber")){
        this.addStimToSchedule(curTdfUnit);
      }
    }
    if(this.nextTimeIndex < this.questions.length){
      const nextQuestion = this.questions[this.nextTimeIndex];
      Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
      console.log(nextQuestion, this.questions)
      await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
      await newQuestionHandler();
    }
    this.playVideo();
  }

  addStimToSchedule(curTdfUnit){
    let markers = [];
    newschedule = engine.adaptiveQuestionLogic.schedule;
    this.questions = [];
    this.times = [];
    //assume time is correct and sort questions based on times
    newschedule.sort((a, b) => curTdfUnit.videosession.questiontimes[a.clusterIndex] - curTdfUnit.videosession.questiontimes[b.clusterIndex]);
  
    for (let i = 0; i < newschedule.length; i++){
      const question = newschedule[i].clusterIndex
      const time = curTdfUnit.videosession.questiontimes[question]
      if(time < 0)
        continue;
  
      this.times.push(time);
      this.questions.push(question);
      markers.push({time: Math.floor(time)});
    }

    //sort markers based on time
    markers.sort((a, b) => a.time - b.time);
    for(let i = 0; i < markers.length; i++){
      markers[i].label = 'Question ' + (i + 1);
    }
    //create markers for new markers
    this.addNewMarkers(markers);

    // Update max allowed time if we're not preventing scrubbing
    if (!this.preventScrubbing) {
      this.maxAllowedTime = Math.max(this.maxAllowedTime, this.player.currentTime);
    }
  
    //default nextTime to end of player
    this.nextTime = this.player.duration;
    //check if next time needs to be set to new question
    for(let i in this.times){
      if(this.player.currentTime < this.times[i]){
        this.nextTimeIndex = i;
        this.nextTime = this.times[this.nextTimeIndex];
        const nextQuestion = this.questions[i];
        Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
        Session.set('displayReady', true);
        break;
      }
    }
  }
  
  addNewMarkers(markers){
    //filter out all old questions
    let newMarkers = markers.filter(x => !this.player.config.markers.points.some(y => y.time == x.time))
  
    this.player.config.markers.points = markers

    //Updatge checkpoints when markers change
    if(this.checkpointBehavior === "question"){
      this.checkpoints = [0, ...this.times.sort((a, b) => a - b)];
    }
    for(let i = 0; i < newMarkers.length; i++){
      $(".plyr__progress").append(`<span class="plyr__progress__marker" style="left: ${newMarkers[i].time/this.player.duration*100}%;"></span>`)
    }
  }
}

async function stopSeeking(){
  if(playerController.loggingSeek) {
    const currentTime = playerController.player.currentTime;
    const seekStart = playerController.seekStart;

    // Check if seeking is allowed
    if (playerController.preventScrubbing && currentTime > playerController.maxAllowedTime) {
      playerController.player.currentTime = playerController.maxAllowedTime;
      playerController.logPlyrAction('seek_blocked');
      playerController.loggingSeek = false;
      return;
    }

    const nextTime = playerController.nextTime;
    const prevTimeIndex = playerController.nextTimeIndex - 1;
    let prevTime = playerController.times[0];
    if(prevTimeIndex >= 0) prevTime = playerController.times[prevTimeIndex];

    console.log('seeked to ', currentTime, ' from ', seekStart);
    playerController.logPlyrAction('seek');
    playerController.loggingSeek = false; 
    if(currentTime >= nextTime) {
      playerController.showQuestion();
    } else if(currentTime < prevTime){
      playerController.questioningComplete = false;
      let nextTimeIndex = getIndex(playerController.times, currentTime);
      await playerController.setNextTime(playerController.times[nextTimeIndex], nextTimeIndex);
    }
  }
}

function startSeeking(){
  if(playerController.loggingSeek) return;
  playerController.loggingSeek = true;
  playerController.seekStart = playerController.player.currentTime;
  console.log('seeking from ', playerController.seekStart);
}

function getIndex(arr, num) {
  return arr.concat(num).sort(function(a, b) {
    return a - b;
  }).indexOf(num);
}

export async function initializePlyr() {
  Session.set('trialStartTimestamp', Date.now());
  let questions = Session.get('currentTdfUnit').videosession.questions;
  let times = [];
  let schedule = engine.adaptiveQuestionLogic.schedule;
  if(schedule.length == 0){
    for (let i = 0; i < questions?.length; i++){
      schedule.push({clusterIndex: questions[i], stimIndex: 0});
      times.push(Session.get('currentTdfUnit').videosession.questiontimes[i]);
    }
    engine.adaptiveQuestionLogic.setSchedule(schedule);
  } else {
    for (let i = 0; i < questions?.length; i++){
      times.push(Session.get('currentTdfUnit').videosession.questiontimes[questions[i].clusterIndex]);
    }
  }
  //sort times
  times.sort((a, b) => a - b);
  loggingSeek = false;
  points = [];
  if(times){
    times.forEach(time => {
      points.push({time: Math.floor(time), label: 'Question ' + (times.indexOf(time) + 1)});
    });
  }
  playerController = new PlayerController('#videoUnitPlayer', times, questions, points);
  //set the source of the video to the new video
  source = Session.get('currentTdfUnit').videosession.videosource;
  //check if its a youtube or shortened youtube link
  if(source.includes('youtu')){
    //check if youtube link is shortened
    if(source.includes('youtu.be')){
      source = source.split('youtu.be/')[1];
    } else {
      source = source.split('v=')[1]
      source = source.split('&')[0];
    }   
    playerController.player.source = {
      type: 'video',
      sources: [
        {
          src: 'https://www.youtube.com/watch?v=' + source,
          provider: 'youtube',
        },
      ],
    };
  } else {
    //html5 video
    playerController.player.source = {
      type: 'video',
      sources: [
        {
          src: source,
          type: 'video/mp4',
        },
      ],
    };
  }
  playerController.initVideoCards();
}

export async function destroyPlyr() {
  playerController.player.destroy();
  playerController = null;
}

function waitForElm(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });

    // If you get "parameter 1 is not of type 'Node'" error, see https://stackoverflow.com/a/77855838/492336
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}
