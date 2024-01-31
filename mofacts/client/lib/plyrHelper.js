import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js'

let lastVolume = 0;
let lastSpeed = 0;
let loggingSeek = false;
let seekStart = 0;
let player;

function initVideoCards(player) {
  const times = Session.get('currentTdfUnit')?.videosession?.questiontimes;
  loggingSeek = false;
  if(!times){
    return
  }
  let timesCopy = times.slice(); 
  timesCopy.sort((a, b) => a - b);
  let nextTimeIndex = 0;
  let nextTime = timesCopy[nextTimeIndex];
  lastVolume = player.volume;
  lastSpeed = player.speed;

  //add event listeners to pause video playback
  player.on('timeupdate', async function(event){
    const instance = event.detail.plyr;

    if(instance.currentTime >= nextTime){
      instance.pause();
    }
  });

  player.on('pause', async function(event){
    const instance = event.detail.plyr;
    console.log('playback paused at ', instance.currentTime);
    logPlyrAction('pause', instance);

    //running here ensures that player pauses before being hidden
    if(instance.currentTime >= nextTime){
      $("#videoUnitContainer").hide();
      nextTimeIndex++;
      if(nextTimeIndex < timesCopy.length){
        nextTime = timesCopy[nextTimeIndex];
        let nextQuestion = times.indexOf(nextTime);
        Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
        Session.set('displayReady', true);
        nextTimeIndex++;
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
          nextTimeIndex = getIndex(timesCopy, player.currentTime); //allow user to see old questions
          nextTime = timesCopy[nextTimeIndex];
          let nextQuestion = times.indexOf(nextTime);
          Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
          await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
          newQuestionHandler();
        } else if(player.currentTime >= nextTime) {
          player.pause();
          $("#videoUnitContainer").hide();
          if(nextTimeIndex < timesCopy.length){
            nextTime = timesCopy[nextTimeIndex];
            let nextQuestion = times.indexOf(nextTime);
            Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
            Session.set('displayReady', true);
            nextTimeIndex++;
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
  const points = [];
  const times = Session.get('currentTdfUnit')?.videosession?.questiontimes;
  if(times){
    times.forEach(time => {
      points.push({time: Math.floor(time), label: 'Question ' + (times.indexOf(time) + 1)});
    });
  }
  player = new Plyr('#videoUnitPlayer', {
    markers: { enabled: true, points: points }
  });
  initVideoCards(player)
  playVideo();
}

export async function playVideo() {
  $("#videoUnitContainer").show();
  player.play();
  let indices = Session.get('engineIndices');
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
