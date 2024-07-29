import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js'

export let playerController;

class PlayerController {
  player;

  lastVolume;
  lastSpeed;
  lastTimeIndex = 0;
  lastlogicIndex = 0;
  nextTimeIndex = 0;
  nextTime = 0;
  seekStart;
  loggingSeek = false;
  fullscreenUser = false;

  times = [];
  questions = [];

  constructor(playerElement, times, questions, points) {
    this.player = new Plyr(playerElement, {
      markers: { enabled: times.length > 0 , points: points }
    });
    this.times = times;
    this.questions = questions;
    this.lastVolume = this.player.volume;
    this.lastSpeed = this.player.speed;
  }

  initVideoCards() {
    this.questions = Session.get('currentTdfUnit').videosession.questions;
    this.times.sort((a, b) => a - b);
    this.nextTime = this.times[this.nextTimeIndex];
    let nextQuestion = this.questions[this.nextTimeIndex];
    let indices = {stimIndex: 0, clusterIndex: nextQuestion}
    engine.selectNextCard(indices, Session.get('currentExperimentState'));
    
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
    newQuestionHandler();
  }

  timeUpdate(){
    if(this.times.length == 0 || this.nextTimeIndex == -1) {
      this.nextTime = this.player.duration;
      timeIsEndTime = true;
    } else {
      this.nextTime = this.times[this.nextTimeIndex];
    }
    //get the difference between the current time and the next time

    const timeDiff = this.nextTime - this.player.currentTime;
    //if this.times[this.nextTimeIndex] is undefined, we set it to the end of the video
    if(this.nextTime == undefined){
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
    if(timeDiff < 0){
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
    await engine.selectNextCard(indices, Session.get('currentExperimentState'));
    Session.set('engineIndices', indices);
    newQuestionHandler();
  }


  showQuestion(){
    this.fullscreenUser = this.player.fullscreen.active;
    this.player.pause();
    if(this.player.fullscreen.active) this.player.fullscreen.exit();
    Session.set('displayReady', true);

    console.log('playback paused at ', this.player.currentTime);
    this.logPlyrAction('pause', this.player);
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
  
    
    //default nextTime to end of player
    this.nextTimeIndex = -1;
    this.nextTime = this.player.duration + 1;
    //check if next time needs to be set to new question
    for(let i in times){
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
    for(let i = 0; i < newMarkers.length; i++){
      $(".plyr__progress").append(`<span class="plyr__progress__marker" style="left: ${newMarkers[i].time/this.player.duration*100}%;"></span>`)
    }
  }
}

async function stopSeeking(){
  if(playerController.loggingSeek) {
    const currentTime = playerController.player.currentTime;
    const seekStart = playerController.seekStart;
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
