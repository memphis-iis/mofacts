import Plyr from 'plyr';
import { newQuestionHandler } from '../views/experiment/card.js'

let lastTimestamp = 0;

function initVideoCards(player) {
    const times = Session.get('currentTdfUnit')?.videosession?.questiontimes;
    lastTimestamp = 0;
    if(!times){
      return
    }
    let timesCopy = times.slice(); 
    timesCopy.sort((a, b) => a - b);
    let nextTime = timesCopy.shift();
    //add event listeners to pause video playback
    player.on('timeupdate', async function(){
      if(lastTimestamp > player.currentTime || player.currentTime - lastTimestamp > 2){
        //if the user seeks backwards or forwards more than 2 seconds, log a seek event
        logPlyrAction('seek', player);
      }
      console.log('timeupdate', player.currentTime, lastTimestamp, nextTime);
      lastTimestamp = player.currentTime;
      if(player.currentTime >= nextTime && player.currentTime < nextTime+2){ //add 2 second buffer
        player.pause();
        $('#videoUnitPlayer').hide();
        nextTime = timesCopy.shift();
        nextQuestion = times.indexOf(nextTime);
        Session.set('engineIndices', {stimIndex: 0, clusterIndex: nextQuestion});
        Session.set('displayReady', true);
      }
    });
  
    player.on('pause', async function(){
      console.log('playback paused at ', player.currentTime);
      logPlyrAction('pause', player);
    });
  
    player.on('play', async function(){
      console.log('playback resumed at ', player.currentTime);
      logPlyrAction('resume', player);
    });
  
    player.on('volumechange', async function(){
      console.log('volume changed to ', player.volume);
      logPlyrAction('volumeChange', player);
    });
  
    player.on('ratechange', async function(){
      console.log('playback speed changed to ', player.speed);
      logPlyrAction('playbackSpeedChange', player);
    });
  
}
  
function logPlyrAction(action, player){
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
