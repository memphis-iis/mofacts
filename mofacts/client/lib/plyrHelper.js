import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js';

let lastVolume = 0;
let lastSpeed = 0;
let loggingSeek = false;
let lastTimeIndex = 0;
let nextTimeIndex = 0;
let nextTime = 0;
let seekStart = 0;
let player;
let times = [];
let questions = [];
let lastlogicIndex = 0;
let lastTimeDestroy = 0;

function initVideoCards(player) {
  questions = Session.get('currentTdfUnit').videosession.questions;
  times.sort((a, b) => a - b);
  nextTime = times[nextTimeIndex];
  lastVolume = player.volume;
  lastSpeed = player.speed;

  //if the player already has event listeners, remove them
  player.off('timeupdate');
  player.off('pause');
  player.off('play');
  player.off('volumechange');
  player.off('ratechange');
  

  //add event listeners to pause video playback
  //onready, set the time to the last time the video was paused
  player.once('canplay', event => {
    player.currentTime = lastTimeDestroy;
    player.play();
  });
  player.once('ready', event => {
    player.currentTime = lastTimeDestroy;
    player.play();
  });

  player.on('ended', async function(event){
    //set indecies to -1
    Session.set('engineIndices', {stimIndex: -1, clusterIndex: -1});
    engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    $("#videoUnitContainer").hide();
  });



  player.on('timeupdate', async function(event){
    const instance = event.detail.plyr;
    //get the difference between the current time and the next time
    const timeDiff = nextTime - instance.currentTime;
    //if times[nextTimeIndex] is undefined, we set it to the end of the video
    if(nextTime == undefined){
      times.push(instance.duration);
      nextTime = instance.duration;
    }
    //get the difference between the next time and the previous time
    const lastTime = nextTimeIndex == 0 ? 0: times[lastTimeIndex];
    const totalTimeDiff =  nextTime - lastTime;
    //get the percentage of the progress bar that should be filled
    const percentage = (timeDiff / totalTimeDiff) * 100;
    //console.log('timeupdate', instance.currentTime, nextTime, '-', lastTime, '=', totalTimeDiff, timeDiff, percentage);
    //add class
    $('#progressbar').addClass('progress-bar');
    //set the width of the progress bar
    document.getElementById('progressbar').style.width = percentage + '%';
    //set the CountdownTimerText to the time remaining
    document.getElementById('CountdownTimerText').innerHTML = Math.round(timeDiff) + ' seconds until next question.';
    if(instance.currentTime >= nextTime){
      instance.pause();
      //reset progress bar
      document.getElementById('progressbar').style.width = '0%';
    }
  });

  player.on('pause', async function(event){
    const instance = event.detail.plyr;
    console.log('playback paused at ', instance.currentTime);
    logPlyrAction('pause', instance);
    //running here ensures that player pauses before being hidden
    if(instance.currentTime >= nextTime){
      lastTimeIndex = nextTimeIndex;
      if(nextTimeIndex < times.length){
        nextTimeIndex++;
        nextTime = times[nextTimeIndex];
        let nextQuestion = questions[nextTimeIndex];
        Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
        Session.set('displayReady', true);
      }
    }

  });

  player.on('play', async function(event){
    const instance = event.detail.plyr;
    console.log('playback resumed at ', instance.currentTime);
    logPlyrAction('resume', instance);
  });

  player.on('volumechange', async function(event){
    const instance = event.detail.plyr;
    console.log('volume changed to ', instance.volume, ' from ', lastVolume);
    logPlyrAction('volumeChange', instance);
  });

  waitForElm("[id*='plyr-seek']").then(function(elm) {
    elm.addEventListener("mouseup", async function(){
      if(loggingSeek) {
        console.log('seeked to ', player.currentTime, ' from ', seekStart);
        logPlyrAction('seek', player, player.currentTime, seekStart);
        loggingSeek = false; 
        if (seekStart > player.currentTime){
          nextTimeIndex = getIndex(times, player.currentTime); //allow user to see old questions
          nextTime = times[nextTimeIndex];
          let nextQuestion = questions[nextTimeIndex];
          Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
          await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
          newQuestionHandler();
        } else if(player.currentTime >= nextTime) {
          player.pause();
          lastTimeIndex = nextTimeIndex;
          nextTimeIndex++;
          if(nextTimeIndex < times.length){
            nextTime = times[nextTimeIndex];
            let nextQuestion = questions[nextTimeIndex];
            Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
            Session.set('displayReady', true);
          }
        }
      }
    });
  });

  waitForElm("[id*='plyr-seek']").then(function(elm) {
    elm.addEventListener("mousedown", async function(){ 
      if(loggingSeek) return;
      loggingSeek = true;
      const instance = player
      seekStart = instance.currentTime;
      console.log('seeking from ', instance.currentTime);
    });
  });

  player.on('ratechange', async function(event){
    const instance = event.detail.plyr;
    console.log('playback speed changed to ', instance.speed, "from ", lastSpeed);
    logPlyrAction('playbackSpeedChange', instance);
  });
  
}

function getIndex(arr, num) {
  return arr.concat(num).sort(function(a, b) {
    return a - b;
  }).indexOf(num);
}
  
function logPlyrAction(action, player, currentTime = null, seekStart = null){
  console.log('logging plyr action', action, player.currentTime, player.volume, player.speed, player.playing)
  const trialStartTimestamp = Session.get('trialStartTimestamp');
  const sessionID = (new Date(trialStartTimestamp)).toUTCString().substr(0, 16) + ' ' + Session.get('currentTdfName');

  const curTdf = Session.get('currentTdfFile');
  const unitName = _.trim(curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].unitname);

  const problemName = Session.get('currentExperimentState').originalDisplay;
  const stepName = problemName;

  currentTime = currentTime || player.currentTime;
  const seekEnd = seekStart ? currentTime : null;
    
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
    'conditionTypeE': Meteor.user().profile.entryPoint && 
        Meteor.user().profile.entryPoint !== 'direct' ? Meteor.user().profile.entryPoint : null,

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
    'CFVideoSeekStart': seekStart,
    'CFVideoSeekEnd': seekEnd,
    'CFVideoCurrentSpeed': player.speed,
    'CFVideoCurrentVolume': player.volume,
    'CFVideoPreviousSpeed': lastSpeed,
    'CFVideoPreviousVolume': lastVolume,
    'CFVideoIsPlaying': player.playing,
    'feedbackText': $('#UserInteraction').text() || '',
    'feedbackType': 'N/A',
    'dialogueHistory': "N/A",
    'instructionQuestionResult': Session.get('instructionQuestionResult') || false,
    'hintLevel': 0,
    'entryPoint': Meteor.user().profile.entryPoint
  };
  Meteor.call('insertHistory', answerLogRecord);
}

export async function initializePlyr() {
  Session.set('trialStartTimestamp', Date.now());
  if(questions.length == 0){
    questions = Session.get('currentTdfUnit').videosession.questions;
  } 
  if(times.length == 0){
    for (let i = 0; i < questions.length; i++){
      times.push(Session.get('currentTdfUnit').videosession.questiontimes[i]);
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
  player = new Plyr('#videoUnitPlayer', {
    markers: { enabled: true, points: points }
  });
  Session.set('engineIndices', {stimIndex: 0, clusterIndex: questions[0]});
  initVideoCards(player)
  playVideo();
}

export async function playNextCard() {
  let curTdfUnit = Session.get('currentTdfUnit');
  curTdfUnit.videosession.adaptiveLogic[lastlogicIndex] ? logic = curTdfUnit.videosession.adaptiveLogic[lastlogicIndex] : logic = '';
  lastlogicIndex++;
  if(engine.adaptiveQuestionLogic){
    if(logic != '' && logic != undefined){
      console.log('adaptive schedule', engine.adaptiveQuestionLogic.schedule);   
      await engine.adaptiveQuestionLogic.evaluate(logic);
    }
    if(engine.adaptiveQuestionLogic.when == "now"){
      //remove the first question from the schedule
      engine.adaptiveQuestionLogic.schedule.shift();
      newschedule = engine.adaptiveQuestionLogic.schedule;
      let points = []
      questions = [];
      times = [];
      for (let i = 0; i < newschedule.length; i++){
        times.push(curTdfUnit.videosession.questiontimes[newschedule[i].clusterIndex]);
        questions.push(newschedule[i].clusterIndex);
        points.push({time: Math.floor(curTdfUnit.videosession.questiontimes[newschedule[i].clusterIndex]), label: 'Question ' + (i + 1)});
      }
      //push the end of the video to the times array
      nextTimeIndex = 0;
      nextTime = times[nextTimeIndex];
      lastTimeDestroy = player.currentTime;
      player.destroy();
      //initialize the player
      player = new Plyr('#videoUnitPlayer', {
        markers: { enabled: true, points: points }
      });
      indecies = {stimIndex: 0, clusterIndex: questions[0]};
      Session.set('engineIndices', indecies);
      initVideoCards(player);
    } else {
      playVideo();
    }
  } else {
    playVideo();
  }
}

export async function playVideo() {
  let indices = Session.get('engineIndices');

  $("#videoUnitContainer").show();
  player.play();
  await engine.selectNextCard(indices, Session.get('currentExperimentState'));
  Session.set('engineIndices', indices);
  newQuestionHandler();
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
