import Plyr from 'plyr';
import { newQuestionHandler, unitIsFinished } from '../views/experiment/card.js'

export let player;

let lastVolume = 0;
let lastSpeed = 0;
let loggingSeek = false;
let lastTimeIndex = 0;
let nextTimeIndex = 0;
let nextTime = 0;
let seekStart = 0;
let times = [];
let questions = [];
let lastlogicIndex = 0;

function initVideoCards(player) {
  questions = Session.get('currentTdfUnit').videosession.questions;
  times.sort((a, b) => a - b);
  nextTime = times[nextTimeIndex];
  lastVolume = player.volume;
  lastSpeed = player.speed;
  let nextQuestion = questions[nextTimeIndex];
  let indices = {stimIndex: 0, clusterIndex: nextQuestion}
  engine.selectNextCard(indices, Session.get('currentExperimentState'));

  //if the player already has event listeners, remove them
  player.off('timeupdate');
  player.off('pause');
  player.off('play');
  player.off('volumechange');
  player.off('ratechange');
  
  //if this is not the furthest unit the student has reached, display the continue button
  if(Session.get('currentUnitNumber') < Session.get('currentExperimentState').lastUnitStarted){
    $("#continueBar").removeAttr('hidden');
    $('#continueButton').prop('disabled', false);
  }

  player.on('timeupdate', async function(event){
    const instance = event.detail.plyr;
    if(times.length == 0 || nextTimeIndex == -1) {
      nextTime = instance.duration;
      timeIsEndTime = true;
    } else {
      nextTime = times[nextTimeIndex];
    }
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
    if(times.length != 0 || Session.get('curTdfUISettings').displayReviewTimeoutAsBarOrText == "bar" || Session.get('curTdfUISettings').displayEndOfVideoCountdown){
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
      showQuestion();
    }
  });

  player.on('pause', async function(event){
    const instance = event.detail.plyr;
    console.log('playback paused at ', instance.currentTime);
    logPlyrAction('pause', instance);
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
        if(player.currentTime >= nextTime) {
            showQuestion();
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

  player.on('ended', async function(event){
    const instance = event.detail.plyr;
    console.log('video ended');
    logPlyrAction('end', instance);
    Session.set('engineIndices', undefined);
    $("#continueBar").removeAttr('hidden');
    $('#continueButton').prop('disabled', false);
  });
  
}

function showQuestion(){
  Session.set('fullscreenUser', player.fullscreen.active);
  player.pause();
  if(player.fullscreen.active) player.fullscreen.exit();
  Session.set('displayReady', true);

  console.log('playback paused at ', player.currentTime);
  logPlyrAction('pause', player);
  //running here ensures that player pauses before being hidden
  if(player.currentTime >= nextTime){
    lastTimeIndex = nextTimeIndex;
    if(nextTimeIndex < times.length){
      nextTimeIndex++;
      nextTime = times[nextTimeIndex];
      let nextQuestion = questions[nextTimeIndex];
      Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
      $('#userAnswer, #multipleChoiceContainer button').prop('disabled', false);
    }
  }
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
    'entryPoint': Meteor.user().loginParams.entryPoint
  };
  Meteor.call('insertHistory', answerLogRecord);
}

export async function initializePlyr() {
  Session.set('trialStartTimestamp', Date.now());
  if(questions.length == 0){
    questions = Session.get('currentTdfUnit').videosession.questions;
  } 
  let schedule = engine.adaptiveQuestionLogic.schedule;
  if(times.length == 0 ){
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
  if(!player){
    player = new Plyr('#videoUnitPlayer', {
      markers: { enabled: times.length > 0 , points: points }
    });
  }
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
    player.source = {
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
    player.source = {
      type: 'video',
      sources: [
        {
          src: source,
          type: 'video/mp4',
        },
      ],
    };
  }
  initVideoCards(player);
  playVideo();
}

export async function playNextCard() {
  let curTdfUnit = Session.get('currentTdfUnit');
  if( curTdfUnit.videosession.adaptiveLogic && curTdfUnit.videosession.adaptiveLogic[lastlogicIndex])
    logic = curTdfUnit.videosession.adaptiveLogic[lastlogicIndex];
  else
    logic = '';
  lastlogicIndex++;
  if(engine.adaptiveQuestionLogic){
    if(logic != '' && logic != undefined){
      console.log('adaptive schedule', engine.adaptiveQuestionLogic.schedule);   
      await engine.adaptiveQuestionLogic.evaluate(logic);
    }
    //add new question to current unit
    if(engine.adaptiveQuestionLogic.when == Session.get("currentUnitNumber")){
      addStimToSchedule(curTdfUnit);
    }
  }
  playVideo();
}

async function addStimToSchedule(curTdfUnit){
  let markers = [];
  newschedule = engine.adaptiveQuestionLogic.schedule;
  questions = [];
  times = [];
  //assume time is correct and sort questions based on times
  newschedule.sort((a, b) => curTdfUnit.videosession.questiontimes[a.clusterIndex] - curTdfUnit.videosession.questiontimes[b.clusterIndex]);

  for (let i = 0; i < newschedule.length; i++){
    const question = newschedule[i].clusterIndex
    const time = curTdfUnit.videosession.questiontimes[question]
    if(time < 0)
      continue;

    times.push(time);
    questions.push(question);
    markers.push({time: Math.floor(time)});
  }
  //sort markers based on time
  markers.sort((a, b) => a.time - b.time);
  for(let i = 0; i < markers.length; i++){
    markers[i].label = 'Question ' + (i + 1);
  }
  //create markers for new markers
  addNewMarkers(player, markers);

  
  //default nextTime to end of player
  nextTimeIndex = -1;
  nextTime = player.duration + 1;
  //check if next time needs to be set to new question
  for(let i in times){
    if(player.currentTime < times[i]){
      nextTimeIndex = i;
      nextTime = times[nextTimeIndex];
      const nextQuestion = questions[i];
      Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
      Session.set('displayReady', true);
      break;
    }
  }
}

function addNewMarkers(player, markers){
  //filter out all old questions
  let newMarkers = markers.filter(x => !player.config.markers.points.some(y => y.time == x.time))

  player.config.markers.points = markers
  for(let i = 0; i < newMarkers.length; i++){
    $(".plyr__progress").append(`<span class="plyr__progress__marker" style="left: ${newMarkers[i].time/player.duration*100}%;"></span>`)
  }
}

export async function playVideo() {
  let indices = Session.get('engineIndices');

  if(Session.get('fullscreenUser')){
    player.fullscreen.enter();
  }
  $("#videoUnitContainer").show();
  player.play();
  await engine.selectNextCard(indices, Session.get('currentExperimentState'));
  Session.set('engineIndices', indices);
  newQuestionHandler();
}
export async function destroyPlyr() {
  lastVolume = 0;
  lastSpeed = 0;
  loggingSeek = false;
  lastTimeIndex = 0;
  nextTimeIndex = 0;
  nextTime = 0;
  seekStart = 0;
  times = [];
  questions = [];
  lastlogicIndex = 0;
  player.destroy();
  player = null;
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
