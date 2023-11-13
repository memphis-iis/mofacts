import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js'

let lastTimestamp = 0;
let lastVolume = 0;
let lastSpeed = 0;
let loggingSeek = false;
let seekStart = 0;
let player;

function initVideoCards(player) {
  const times = Session.get('currentTdfUnit')?.videosession?.questiontimes;
  lastTimestamp = 0;
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
    // if(instance.currentTime - lastTimestamp > 2){
    //   //if the user seeks backwards or forwards more than 2 seconds, log a seek event
    //   logPlyrAction('seek', instance);
    // } else if (lastTimestamp > instance.currentTime){
    //   logPlyrAction('seek', instance);
    //   nextTimeIndex = getIndex(timesCopy, instance.currentTime); //allow user to see old questions
    //   nextTime = timesCopy[nextTimeIndex];
    //   let nextQuestion = times.indexOf(nextTime);
    //   Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
    //   await engine.selectNextCard(Session.get('engineIndices'), Session.get('currentExperimentState'));
    //   newQuestionHandler();
    // }
    console.log('timeupdate', instance.currentTime, lastTimestamp, instance.currentTime - lastTimestamp, nextTime);
    lastTimestamp = instance.currentTime;

    if(instance.currentTime >= nextTime){
      instance.pause();
      $('#videoUnitPlayer').hide();
      if(nextTimeIndex < timesCopy.length){
        nextTime = timesCopy[nextTimeIndex];
        let nextQuestion = times.indexOf(nextTime);
        Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
        Session.set('displayReady', true);
        nextTimeIndex++;
      }
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

  player.on('seeking', async function(event){
    if(loggingSeek) return;
    loggingSeek = true;
    const instance = event.detail.plyr;
    seekStart = instance.currentTime;
    console.log('seeking from ', instance.currentTime);
  });

  player.on("mouseup", async function(){
    if(loggingSeek) {
      console.log('seeked to ', player.currentTime, ' from ', seekStart);
      logPlyrAction('seek', player);
      loggingSeek = false;
    }
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
  
function logPlyrAction(action, player){
  console.log('logging plyr action', action, player.currentTime, player.volume, player.speed, player.playing)
  const trialStartTimestamp = Session.get('trialStartTimestamp');
  const sessionID = (new Date(trialStartTimestamp)).toUTCString().substr(0, 16) + ' ' + Session.get('currentTdfName');

  const curTdf = Session.get('currentTdfFile');
  const unitName = _.trim(curTdf.tdfs.tutor.unit[Session.get('currentUnitNumber')].unitname);

  const problemName = Session.get('currentExperimentState').originalDisplay;
  const stepName = problemName;
    
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
    'CFVideoTimeStamp': player.currentTime,
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
  //Meteor.call('insertHistory', answerLogRecord);
}

export async function initializePlyr() {
  Session.set('trialStartTimestamp', Date.now());
  player = new Plyr('#videoUnitPlayer');
  initVideoCards(player)
  playVideo();
}

export async function playVideo() {
  $('#videoUnitPlayer').show();
  player.play();
  let indices = Session.get('engineIndices');
  await engine.selectNextCard(indices, Session.get('currentExperimentState'));
  Session.set('engineIndices', indices);
  newQuestionHandler();
}
