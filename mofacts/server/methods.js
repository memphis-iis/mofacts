import {DynamicTdfGenerator} from '../common/DynamicTdfGenerator';
import {curSemester, ALL_TDFS, KC_MULTIPLE} from '../common/Definitions';
import * as TutorialDialogue from '../server/lib/TutorialDialogue';
import * as ElaboratedFeedback from './lib/CachedElaboratedFeedback';
import * as DefinitionalFeedback from '../server/lib/DefinitionalFeedback.js';
import * as ClozeAPI from '../server/lib/ClozeAPI.js';
import {displayify, isEmpty, stringifyIfExists} from '../common/globalHelpers';
import {createExperimentExport} from './experiment_times';
import {getNewItemFormat} from './conversions/convert';
import {sendScheduledTurkMessages} from './turk_methods';
import {getItem, getComponentState, getCourse, getTdf, getHistoryForMongo} from './orm';
import { result } from 'underscore';
import { Mongo } from 'meteor/mongo'


export {
  getTdfByFileName,
  getTdfBy_id,
  getHistoryByTDFfileName,
  getListOfStimTags,
  getListOfStimTagsFromStims,
  getStimuliSetById,
  getDisplayAnswerText,
  serverConsole,
  decryptUserData,
  createAwsHmac,
};

/* jshint sub:true*/

// The jshint inline option above suppresses a warning about using sqaure
// brackets instead of dot notation - that's because we prefer square brackets
// for creating some MongoDB queries

const fs = Npm.require('fs');
const https = require('https')
const { randomBytes } = require('crypto')

if (Meteor.isClient) {
  Meteor.subscribe('files.assets.all');
}

if (Meteor.isServer) {
  Meteor.publish('files.assets.all', function () {
    return DynamicAssets.find().cursor;
  });
}

if (process.env.METEOR_SETTINGS_WORKAROUND) {
  Meteor.settings = JSON.parse(process.env.METEOR_SETTINGS_WORKAROUND);
}
if (Meteor.settings.public.testLogin) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  serverConsole('dev environment, allow insecure tls');
}

process.env.MAIL_URL = Meteor.settings.MAIL_URL;
const adminUsers = Meteor.settings.initRoles.admins;
const ownerEmail = Meteor.settings.owner;
const isProd = Meteor.settings.prod || false;
serverConsole('isProd: ' + isProd);

const thisServerUrl = Meteor.settings.ROOT_URL;
serverConsole('thisServerUrl: ' + thisServerUrl);

const altServerUrl = Meteor.settings.ALT_URL;
serverConsole('altServerUrl: ' + altServerUrl);

const clozeGeneration = require('./lib/Process.js');

const userIdToUsernames = {};
const usernameToUserIds = {};
Meteor.users.find({}, {fields: {_id: 1, username: 1}, sort: [['username', 'asc']]}).map(function(user) {
  userIdToUsernames[user._id] = user.username;
  usernameToUserIds[user.username] = user._id;
});

function getUserIdforUsername(username) {
  let userId = usernameToUserIds[username];
  if (!userId) {
    const user = Meteor.users.findOne({username: username}).fetch();
    userId = user._id;
    usernameToUserIds[username] = userId;
  }
  return userId;
}

// For Southwest SSO with ADFS/SAML 2.0
if (Meteor.settings.saml) {
  serverConsole('reading SAML settings');
  for (let i = 0; i < Meteor.settings.saml.length; i++) {
    // privateCert is weird name, I know. spCert is better one. Will need to refactor
    if (Meteor.settings.saml[i].privateKeyFile && Meteor.settings.saml[i].publicCertFile) {
      serverConsole('Set keys/certs for ' + Meteor.settings.saml[i].provider);
      let privateCert = fs.readFileSync(Meteor.settings.saml[i].publicCertFile);
      if (typeof(privateCert) != 'string') {
        privateCert = privateCert.toString();
      }
      Meteor.settings.saml[i].privateCert = privateCert;

      let privateKey = fs.readFileSync(Meteor.settings.saml[i].privateKeyFile);
      if (typeof(privateKey) != 'string') {
        privateKey = privateKey.toString();
      }
      Meteor.settings.saml[i].privateKey = privateKey;
    } else {
      serverConsole('No keys/certs found for ' + Meteor.settings.saml[i].provider);
    }
  }
}

if (Meteor.settings.definitionalFeedbackDataLocation) {
  serverConsole('reading feedbackdata');
  const feedbackData = fs.readFileSync(Meteor.settings.definitionalFeedbackDataLocation);
  serverConsole('initializing feedback');
  // eslint-disable-next-line new-cap
  DefinitionalFeedback.Initialize(feedbackData);
}

const feedbackCacheMap = {};
if (Meteor.settings.elaboratedFeedbackDataLocation) {
  serverConsole('initializing elaborated feedback');
  const dataBuff = fs.readFileSync(Meteor.settings.elaboratedFeedbackDataLocation);
  const cacheJSON = JSON.parse(dataBuff.toString());
  for (const triple of cacheJSON) {
    const pairWord1 = triple[0];
    const pairWord2 = triple[1];
    if (!feedbackCacheMap[pairWord1]) {
      feedbackCacheMap[pairWord1] = new Set();
    }
    if (!feedbackCacheMap[pairWord2]) {
      feedbackCacheMap[pairWord2] = new Set();
    }
    feedbackCacheMap[pairWord1].add(pairWord2);
    feedbackCacheMap[pairWord2].add(pairWord1);
  }
  // eslint-disable-next-line new-cap
  ElaboratedFeedback.Initialize(dataBuff);
}

function getMatchingDialogueCacheWordsForAnswer(answer) {
  const matches = feedbackCacheMap[answer.toLowerCase()];
  if (matches) {
    return Array.from(matches);
  } else {
    return [];
  }
}

const pgp = require('pg-promise')();
// TODO: don't hardcode this
const connectionString = 'postgres://mofacts:test101@localhost:5432';
const db = pgp(connectionString);

// Published to all clients (even without subscription calls)
Meteor.publish(null, function() {
  // Only valid way to get the user ID for publications
  // eslint-disable-next-line no-invalid-this
  const userId = this.userId;

  // The default data published to everyone - all TDF's and stims, and the
  // user data (user times log and user record) for them
  const defaultData = [
    Meteor.users.find({_id: userId}),
    UserProfileData.find({_id: userId}, {fields: {
      have_aws_id: 1,
      have_aws_secret: 1,
      use_sandbox: 1,
    }}),
  ];

  return defaultData;
});

Meteor.publish('allUsers', function() {
  const opts = {
    fields: {username: 1},
  };
  // eslint-disable-next-line no-invalid-this
  if (Roles.userIsInRole(this.userId, ['admin'])) {
    opts.fields.roles = 1;
  }
  return Meteor.users.find({}, opts);
});

async function migration(){
  const tdfret = await db.any("select * from tdf");
  for(let tdf of tdfret){
    console.log(`tdf: ${tdfret.indexOf(tdf) + 1}/${tdfret.length}`)
    tdf = getTdf(tdf);
    Tdfs.insert(tdf);
  }

  const course = "select * from course"
  const courseRet = await db.any(course);
  for(let t of courseRet){
    console.log(`course: ${courseRet.indexOf(t) + 1}/${courseRet.length}`)
    Courses.insert(getCourse(t));
  }

  const assignments = "select * from assignment"
  const assignmentsRet = await db.any(assignments);
  for(let t of assignmentsRet){
    console.log(`assignments: ${assignmentsRet.indexOf(t) + 1}/${assignmentsRet.length}`)
    t = {
      courseId: Courses.findOne({courseId: t.courseid})._id,
      TDFId: Tdfs.findOne({TDFId: t.tdfid})._id
    };
    Assignments.insert(t);
  }

  const componentstate = "select * from componentstate"
  const componentstateret = await db.any(componentstate);
  for(let t of componentstateret){
    console.log(`componentstate: ${componentstateret.indexOf(t) + 1}/${componentstateret.length}`)
    t = getComponentState(t)
    t.TDFId = Tdfs.findOne({TDFId: t.TDFId})._id;
    ComponentStates.insert(t);
  }

  const item = "select * from item"
  const itemret = await db.any(item);
  for(let t of itemret){
    console.log(`item: ${itemret.indexOf(t) + 1}/${itemret.length}`)
    t = getItem(t);
    Items.insert(t);
  }

  const iSS = "select * from itemSourceSentences"
  const iSSret = await db.any(iSS);
  for(let t of iSSret){
    console.log(`iSS: ${iSSret.indexOf(t) + 1}/${iSSret.length}`)
    t = {
      stimuliSetId: t.stimulisetid,
      sourceSentences: t.sourcesentences
    };
    itemSourceSentences.insert(t);
  }

  const section = "select * from section"
  const sectionret = await db.any(section);
  for(let t of sectionret){
    console.log(`section: ${sectionret.indexOf(t) + 1}/${sectionret.length}`)
    t = {
      sectionId: t.sectionid,
      courseId: Courses.findOne({courseId: t.courseid})._id,
      sectionName: t.sectionname
    }
    Sections.insert(t);
  }

  const sum = "select * from section_user_map"
  const sumret = await db.any(sum);
  for(let t of sumret){
    console.log(`sum: ${sumret.indexOf(t) + 1}/${sumret.length}`)
    t = {
      sectionId: Sections.findOne({sectionId: t.sectionid})._id,
      userId: t.userid
    };
    SectionUserMap.insert(t);
  }

  const globalExperimentState = "select * from globalExperimentState"
  const globalExperimentStateret = await db.any(globalExperimentState);
  for(let t of globalExperimentStateret){
    console.log(`globalExperimentState: ${globalExperimentStateret.indexOf(t) + 1}/${globalExperimentStateret.length}`)
    if(Tdfs.findOne({TDFId: t.tdfid})){
      t = {
        userId: t.userid,
        TDFId: Tdfs.findOne({TDFId: t.tdfid})._id,
        experimentState: t.experimentstate
      };
      GlobalExperimentStates.insert(t);
    }
  }

  const history = "select * from history"
  const historyret = await db.any(history);
  for(let t of historyret){
    console.log(`history: ${historyret.indexOf(t) + 1}/${historyret.length}`)
    let itemid = Items.findOne({itemId: t.itemid})._id
    let tdfid = Tdfs.findOne({TDFId: t.tdfid})._id
    t.itemid = itemid;
    t.tdfid = tdfid;
    t = getHistoryForMongo(t);
    Histories.insert(t);
  }

}

async function migration2(){
  const sections = Sections.find().fetch()
  for(let t in sections){
    console.log(`sections: ${t}/${sections.length}`)
    let oldEntry = sections[t];
    delete sections[t].sectionId;
    Sections.update(oldEntry, sections[t]);
  }

  const tdfs = Tdfs.find().fetch()
  for(let t in tdfs){
    console.log(`tdfs: ${t}/${tdfs.length}`)
    let oldEntry = tdfs[t];
    delete tdfs[t].TDFId;
    Tdfs.update(oldEntry, tdfs[t]);
  }

  const componentStates = ComponentStates.find().fetch()
  for(let t in componentStates){
    console.log(`componentStates: ${t}/${componentStates.length}`)
    let oldEntry = componentStates[t];
    delete componentStates[t].componentStateId;
    ComponentStates.update(oldEntry, componentStates[t]);
  }

  const stimuli = Items.find().fetch();
  const stimuli_syllables = StimSyllables.find().fetch();
  let syllCache = {};
  for(let t in stimuli){
    console.log(`stimuli: ${t}/${stimuli.length}`)
    let oldEntry = stimuli[t];
    let oldId = oldEntry._id;
    const curStimSetSylls = stimuli_syllables.find(s => s.filename == oldEntry.stimuliSetId)?.data || undefined
    let response = oldEntry.correctResponse
    if(response.includes('~'))
      response = response.split('~')[0];
    let sylls = curStimSetSylls && response ? curStimSetSylls[response.toLowerCase()].syllables : null;

    if(!sylls){
      sylls = syllCache[stimuli[t].correctResponse]
    }
    
    if(!sylls){
      try{
        sylls = getSyllablesForWord(stimuli[t].correctResponse.replace(/\./g, '_').split('~')[0]);
      }
      catch (e) {
        serverConsole('error fetching syllables for ' + stimuli[t].correctResponse + ': ' + JSON.stringify(e));
        sylls = [stimuli[t].correctResponse];
      }
    }
    if(!syllCache[stimuli[t].correctResponse]) syllCache[stimuli[t].correctResponse] = sylls
    delete stimuli[t].itemId;
    stimuli[t].syllables = sylls;
    Items.update({_id: oldId}, stimuli[t]);
  }

  const courses = Courses.find().fetch()
  for(let t in courses){
    console.log(`courses: ${t}/${courses.length}`)
    let oldEntry = courses[t];
    delete courses[t].courseId;
    Courses.update(oldEntry, courses[t]);
  }
}


// Config for scheduled jobs - the start command is at the end of
// Meteor.startup below
SyncedCron.config({
  log: true,
  logger: null,
  collectionName: 'cronHistory',
  utc: false,
  collectionTTL: undefined,
});

function serverConsole(...args) {
  const disp = [(new Date()).toString()];
  for (let i = 0; i < args.length; ++i) {
    disp.push(args[i]);
  }
  // eslint-disable-next-line no-invalid-this
  console.log.apply(this, disp);
}

const crypto = Npm.require('crypto');
// Parameters
const algo = 'aes256';

function encryptUserData(data) {
  const key = getConfigProperty('protectionKey');
  const cipher = crypto.createCipher(algo, key);
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function decryptUserData(data) {
  const key = getConfigProperty('protectionKey');
  const decipher = crypto.createDecipher(algo, key);
  return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
}

function createAwsHmac(secretKey, dataString) {
  return crypto
      .createHmac('sha1', secretKey)
      .update(dataString)
      .digest('base64');
}

async function getTdfQueryNames(tdfFileName) {
  let tdfQueryNames = [];
  if (tdfFileName === ALL_TDFS) {
    // Postgres Reversion
    // const tdfsRet = await db.any('SELECT content -> \'fileName\' AS filename from tdf');
    const tdfsRet = tdfs.find({},{ "fileName": 1 }).fetch();
    for (const tdfFileName of tdfsRet) {
      tdfQueryNames.push(tdfFileName);
    }
  } else if (tdfFileName) {
    tdfQueryNames = [tdfFileName];
  }
  return tdfQueryNames;
}

async function getLearningSessionItems(tdfFileName) {
  const learningSessionItems = [];
  const tdfQueryNames = await getTdfQueryNames(tdfFileName);
  tdfQueryNames.forEach(async function(tdfQueryName) {
    if (!learningSessionItems[tdfQueryName]) {
      learningSessionItems[tdfQueryName] = {};
    }
    const tdf = await getTdfByFileName(tdfQueryName);
    if (tdf.content.isMultiTdf) {
      setLearningSessionItemsMulti(learningSessionItems[tdfQueryName], tdf);
    } else {
      setLearningSessionItems(learningSessionItems[tdfQueryName], tdf);
    }
  });
  return learningSessionItems;
}

async function getTdfIdByStimSetIdAndFileName(stimuliSetId, fileName){
  //Postgres Reversion
  // const ret = await db.many('SELECT * FROM tdf WHERE stimulisetid =$1', stimuliSetId);
  const shortFileName = fileName.replace('.json', '').replace('.xml', '');
  let tdf = Tdfs.find({"content.fileName": shortFileName, stimuliSetId: stimuliSetId}).fetch()._id;
  return tdf;
}

async function getTdfById(TDFId) {
  //const tdfs = await db.one('SELECT * from tdf WHERE TDFId=$1', TDFId);
  //PostgresReversion
  const tdf = Tdfs.findOne({_id: TDFId});
  return tdf;
}

async function getTdfTTSAPIKey(TDFId) {
  const tdfs = await db.one('SELECT * from tdf WHERE TDFId=$1', TDFId);
  const textToSpeechAPIKey = tdfs.content.tdfs.tutor.setspec.textToSpeechAPIKey;
  return textToSpeechAPIKey;
}

async function getTdfSpeachAPIKey(TDFId) {
  const tdfs = await db.one(`SELECT * from tdf WHERE TDFId=${TDFId}`);
  const speechAPIKey = tdfs.content.tdfs.tutor.setspec.speechAPIKey;
  return speechAPIKey;
}

// eslint-disable-next-line camelcase
async function getTdfBy_id(_id) {
  try {
    //Postgres Reversion
    tdf = TDFs.find({_id: _id}).fetch();
    // const queryJSON = {'_id': _id};
    // const tdfs = await db.one('SELECT * from tdf WHERE content @> $1' + '::jsonb', [queryJSON]);
    return tdf;
  } catch (e) {
    serverConsole('getTdfBy_id ERROR,', _id, ',', e);
    return null;
  }
}

async function getTdfByFileName(filename) {
  try {
    //Postgres Reversion
    // const queryJSON = {'fileName': filename};
    // const tdfs = await db.oneOrNone('SELECT * from tdf WHERE content @> $1::jsonb', [queryJSON]);
    const tdf = Tdfs.findOne({"content.fileName": filename});
    if (!tdf) {
      return null;
    }
    return tdf;
  } catch (e) {
    serverConsole('getTdfByFileName ERROR,', filename, ',', e);
    return null;
  }
}

async function getTdfByExperimentTarget(experimentTarget) {
  try {
    serverConsole('getTdfByExperimentTarget:'+experimentTarget);
    //PostgresReversion
    // const queryJSON = {'tdfs': {'tutor': {'setspec': {'experimentTarget': experimentTarget}}}};
    // const tdfs = await db.one('SELECT * from tdf WHERE content @> $1' + '::jsonb', [queryJSON]);
    tdf = Tdfs.findOne({"content.tdfs.tutor.setspec.experimentTarget": experimentTarget});
    return tdf;
  } catch (e) {
    serverConsole('getTdfByExperimentTarget ERROR,', experimentTarget, ',', e);
    return null;
  }
}

async function getAllTdfs() {
  serverConsole('getAllTdfs');
  //PostgresReversion
  const tdfs = Tdfs.find({}).fetch();
  // const tdfsRet = await db.any('SELECT * from tdf');
  return tdfs;
}

async function getAllStims() {
  serverConsole('getAllStims');
  //PostgresReversion
  // const stimRet = await db.any('SELECT DISTINCT(stimulusfilename), stimulisetid FROM item;')
  return await Items.rawCollection().aggregate([
    {
      $group: {
        _id: {
          stimulusFileName: "$stimulusFileName",
          stimuliSetId: "$stimuliSetId"
        }
      },
    },
    {
      $project:{
        _id: 0,
        stimulusFileName: "$_id.stimulusFileName",
        stimuliSetId: "$_id.stimuliSetId"
      }
    }
  ]).toArray();
}

async function getStimuliSetsForIdSet(stimuliSetIds) {
  const stimSetsStr = stimuliSetIds.join(',');
  //Postgres Reversion
  // const query = 'SELECT * FROM ITEM WHERE stimuliSetId IN (' + stimSetsStr + ') ORDER BY itemId';
  // const stimSets = await db.many(query);
  const stimSets = Items.find({stimuliSetId: {$in: [stimSetsStr]}}, {sort: {stimulusKC: 1}});
  const ret = [];
  for (const stim of stimSets) {
    ret.push(getItem(stim));
  }
  return ret;
}

async function getProbabilityEstimatesByKCId(relevantKCIds) { // {clusterIndex:[stimKCId,stimKCId],...}
  //theres gotta be a more efficient way to do this
  let allKCIDs = []
  for(let kcidIndex in relevantKCIds){
    for(let kcid of relevantKCIds[kcidIndex]){
      allKCIDs.push(kcid);
    }
  }
  const histories = Histories.find({KCId: { $in: allKCIDs }}, {sort: { time: 1 }}).fetch();
  const clusterProbs = {};
  const individualStimProbs = {};
  // eslint-disable-next-line guard-for-in
  for (const clusterIndex in relevantKCIds) {
    clusterProbs[clusterIndex] = [];
    const clusterKCs = relevantKCIds[clusterIndex];
    const ret = histories.filter(h => clusterKCs.includes(h.KCId));
    if(ret){
      for(const pair of ret){
        if(pair.probabilityEstimate){
          clusterProbs[clusterIndex].push(pair.probabilityEstimate);
          if(individualStimProbs[pair.KCId]) individualStimProbs[pair.KCId].push(pair.probabilityEstimate);
          else individualStimProbs[pair.KCId] = [pair.probabilityEstimate];
        }
      }
    }
  }
  return {clusterProbs, individualStimProbs};
}

async function getReponseKCMap() {
  // //const responseKCStuff = await db.manyOrNone('SELECT DISTINCT correctResponse, responseKC FROM item');
  const responseKCStuff = await Items.rawCollection().aggregate([{
    $group: {
      _id: "$correctResponse",
      "doc": { "$first": "$$ROOT" }
      }
    },
    {
      $replaceRoot: {
        newRoot: "$doc"
    }
  }]).toArray();
  const responseKCMap = {};
  for (const row of responseKCStuff) {
    const correctresponse = row.correctResponse;
    const responsekc = row.responseKC;

    const answerText = getDisplayAnswerText(correctresponse);
    responseKCMap[answerText] = responsekc;
  }

  return responseKCMap;
}

// by currentTdfId, not currentRootTDFId
async function getComponentStatesByUserIdTDFIdAndUnitNum(userId, TDFId) {
  //PostgresReversion
  const componentStates = ComponentStates.find({ userId: userId, TDFId: TDFId }, { sort: { KCId: -1 } }).fetch();
  // const query = 'SELECT * FROM componentState WHERE userId = $1 AND TDFId = $2 ORDER BY componentStateId';
  // const componentStatesRet = await db.manyOrNone(query, [userId, TDFId]);
  return componentStates;
}

async function setComponentStatesByUserIdTDFIdAndUnitNum(userId, TDFId, componentStates) {
  serverConsole('setComponentStatesByUserIdTDFIdAndUnitNum, ', userId, TDFId);
  const responseKCMap = await getReponseKCMap();
  const newResponseKCRet = Items.find({}, {sort: {responseKC: -1}, limit: 1}).fetch();//await t.one('SELECT MAX(responseKC) AS responseKC from ITEM');
  let newResponseKC = newResponseKCRet.responsekc + 1;
  let c = ComponentStates.find({userId: userId, TDFId: TDFId}).fetch();
  for (const componentState of componentStates) {
    componentState.userId = userId;
    componentState.TDFId = TDFId;
    if (componentState.componentType == 'response') {
      if (!isEmpty(responseKCMap[componentState.responseText])) {
        componentState.KCId = responseKCMap[componentState.responseText];
      } else {
        componentState.KCId = newResponseKC;
        newResponseKC += 1;
      }
      delete componentState.responseText;
    }
    if (!componentState.trialsSinceLastSeen) {
      componentState.trialsSinceLastSeen = null;
    }
    const curComponentState = c.find(cs => cs.KCId == componentState.KCId && cs.componentType == componentState.componentType)
    if(curComponentState){
      ComponentStates.update({_id: curComponentState._id}, componentState);
    }
    else{
      serverConsole("ComponentState didn't exist before so we'll insert it")
      ComponentStates.insert(componentState);
    }
  }
  serverConsole('res:', {userId, TDFId});
  return {userId, TDFId};
}

function stripSpacesAndLowerCase(input) {
  return input.replace(/ /g, '').toLowerCase();
}

function getDisplayAnswerText(answer) {
  return answerIsBranched(answer) ? stripSpacesAndLowerCase(_branchingCorrectText(answer)) :
      stripSpacesAndLowerCase(answer);
}

function answerIsBranched(answer) {
  return _.trim(answer).indexOf(';') >= 0;
}

function _branchingCorrectText(answer) {
  let result = '';

  const branches = _.trim(answer).split(';');
  if (branches.length > 0) {
    const flds = branches[0].split('~');
    if (flds.length == 2) {
      result = flds[0];
    }
  }

  result = result.split('|');
  return result[0];
}

// TODO: move this to function through existing upsert functions
async function insertStimTDFPair(newStimJSON, wrappedTDF, sourceSentences) {
  //PostgresReversion
  const maxStimuliSetId = Items.find().sort({stimuliSetId: -1}).limit(1);
  // const highestStimuliSetIdRet = await db.oneOrNone('SELECT MAX(stimuliSetId) AS stimuliSetId FROM item');
  const newStimuliSetId = maxStimuliSetId + 1;
  wrappedTDF.stimuliSetId = newStimuliSetId;
  for (const stim of newStimJSON) {
    stim.stimuliSetId = newStimuliSetId;
  }
  //PostgresReversion
  const maxStimulusKC = Items.find({}, { sort: {stimulusKC: -1}}).limit(1).stimulusKC;
  // const highestStimulusKCRet = await db.oneOrNone('SELECT MAX(stimulusKC) AS stimulusKC FROM item');
  const curNewKCBase = (Math.floor(maxStimulusKC / KC_MULTIPLE) * KC_MULTIPLE) + KC_MULTIPLE;// + 1

  let curNewStimulusKC = curNewKCBase;
  let curNewClusterKC = curNewKCBase;

  const responseKCMap = await getReponseKCMap();
  const maxResponseKC = 1;
  serverConsole('!!!insertStimTDFPair:', maxStimuliSetId, newStimuliSetId, maxStimulusKC, curNewKCBase);
  let curNewResponseKC = maxResponseKC + 1;

  const stimulusKCTranslationMap = {};
  const clusterKCTranslationMap = {};
  for (const stim of newStimJSON) {
    if (isEmpty(stimulusKCTranslationMap[stim.stimulusKC])) {
      stimulusKCTranslationMap[stim.stimulusKC] = curNewStimulusKC;
      curNewStimulusKC += 1;
    }
    if (isEmpty(clusterKCTranslationMap[stim.clusterKC])) {
      clusterKCTranslationMap[stim.clusterKC] = curNewClusterKC;
      curNewClusterKC += 1;
    }

    const stimAnswerText = getDisplayAnswerText(stim.correctResponse);
    if (isEmpty(responseKCMap[stimAnswerText])) {
      responseKCMap[stimAnswerText] = curNewResponseKC;
      curNewResponseKC += 1;
    }
    stim.stimulusKC = stimulusKCTranslationMap[stim.stimulusKC];
    stim.responseKC = responseKCMap[stimAnswerText];
    stim.clusterKC = clusterKCTranslationMap[stim.clusterKC];
    if (!stim.incorrectResponses) stim.incorrectResponses = null;
    if (!stim.alternateDisplays) stim.alternateDisplays = null;
    Items.insert(stim);
  }
  const newTDFId = Tdfs.insert(wrappedTDF);
  if (sourceSentences) {
    itemSourceSentences.insert({stimuliSetId: newStimuliSetId, sourceSentences: sourceSentences});
  }
  return newTDFId;
}

async function getSourceSentences(stimuliSetId) {
  //PostgresReversion
  // const query = 'SELECT sourceSentences FROM itemSourceSentences WHERE stimuliSetId=$1';
  // const sourceSentencesRet = await db.manyOrNone(query, stimuliSetId);
  const sourceSentencesRet = itemSourceSentences.find({stimuliSetId: stimuliSetId});
  return sourceSentencesRet.sourceSentences;
}

async function getAllCourses() {
  try {
    //PostgresReversion Staged
    let coursesRet = Courses.find().fetch();
    // coursesRet = await db.any('SELECT * from course');
    const courses = [];
    for (const course of coursesRet) {
      courses.push(getCourse(course));
    }
    return courses;
  } catch (e) {
    serverConsole('getAllCourses ERROR,', e);
    return null;
  }
}

async function getAllCourseSections() {
  try {
    serverConsole('getAllCourseSections');
    //PostgresReversion Staged
    ret =  await Courses.rawCollection().aggregate([
      {
        $match: {semester: curSemester}
      },
      {
        $lookup: {
          from: "section",
          localField: "_id",
          foreignField: "courseId",
          as: "section"
        }
      },
      {
        $project: {
          _id: 0,
          sections: "$section.sectionName",
          courseId: "$_id",
          courseName: 1,
          teacherUserId: 1,
          semester: 1,
          beginDate: 1,
          sectionId: "$section._id"
        }
      }
    ]).toArray();
    // const query = 'SELECT s.sectionid, s.sectionname, c.courseid, c.coursename, c.teacheruserid, c.semester, \
    //     c.beginDate from course AS c INNER JOIN section AS s ON c.courseid = s.courseid WHERE c.semester=$1';
    // const ret = await db.any(query, curSemester);
    return ret;
  } catch (e) {
    serverConsole('getAllCourseSections ERROR,', e);
    return null;
  }
}

async function getCourseById(courseId) {
  serverConsole('getAllCoursesById:', courseId);
  //PostgresReversion Staged
  // const query = 'SELECT * from course WHERE courseId=$1';
  // const course = await db.oneOrNone(query, [courseId, curSemester]);
  const course = Courses.findOne({courseId: courseId});
  return course;
}

async function getAllCoursesForInstructor(instructorId) {
  serverConsole('getAllCoursesForInstructor:', instructorId);
  // const query = 'SELECT *, (SELECT array_agg(section.sectionName) as sectionNames FROM section \
  //     WHERE courseId=course.courseId) from course WHERE teacherUserId=$1 AND semester=$2';
  // const coursesRet = await db.any(query, [instructorId, curSemester]);
  const courses = Courses.find({teacherUserId: instructorId}).fetch();
  return courses;
}

async function getAllCourseAssignmentsForInstructor(instructorId) {
  try {
    //Postgres Reversion
    serverConsole('getAllCourseAssignmentsForInstructor:'+instructorId);
    //const query = 'SELECT t.content -> \'fileName\' AS filename, c.courseName, c.courseId from assignment AS a \
    //             INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
    //             INNER JOIN course AS c ON c.courseId = a.courseId \
    //             WHERE c.teacherUserId = $1 AND c.semester = $2';
    //const args = [instructorId, curSemester];
    //const courseAssignments = await db.any(query, args);
    const courseAssignments = await Assignments.rawCollection().aggregate([{ //from assignment
      $lookup:{ //INNER JOIN tdf AS t ON t.TDFId = a.TDFId
        from: "tdfs",
        localField: "TDFId",
        foreignField: "_id",
        as: "TDF"
      }
    },
    {
      $unwind: { path: "$TDF" }
    },
    {
      $lookup:{ //INNER JOIN course AS c ON c.courseId = a.courseId
        from: "course",
        localField: "courseId",
        foreignField: "courseId",
        as: "course"
      }
    },
    {
      $unwind: { path: "$course" }
    },
    { 
      $match: { //WHERE c.teacherUserId = instructorId AND c.semester = curSemester
        "course.teacherUserId": instructorId,
        "course.semester": curSemester
      }
    },
    {
      $project:{ //SELECT t.content -> \'fileName\' AS filename, c.courseName, c.courseId
        _id: 0,
        fileName: "$TDF.content.fileName",
        courseName: "$course.courseName",
        courseId: "$course._id"
      }
    }
  ]).toArray();
    return courseAssignments;
  } catch (e) {
    serverConsole('getAllCourseAssignmentsForInstructor ERROR,', instructorId, ',', e);
    return null;
  }
}

function getSetAMinusB(arrayA, arrayB) {
  const a = new Set(arrayA);
  const b = new Set(arrayB);
  const difference = new Set([...a].filter((x) => !b.has(x)));
  return Array.from(difference);
}

// Shape: {coursename: "Test Course", courseid: 1, 'tdfs': ['filename1']}
async function editCourseAssignments(newCourseAssignment) {
  try {
    serverConsole('editCourseAssignments:', newCourseAssignment);
    const newTdfs = newCourseAssignment.tdfs;
    //Postgres Reversion
    // const query = 'SELECT t.content -> \'fileName\' AS filename, t.TDFId, c.courseId from assignment AS a \
    //            INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
    //            INNER JOIN course AS c ON c.courseId = a.courseId \
    //            WHERE c.courseid = $1';
    // const curCourseAssignments = await db.manyOrNone(query, newCourseAssignment.courseid);
    const curCourseAssignments = await Assignments.rawCollection().aggregate([{
      $lookup:{ //INNER JOIN tdf AS t ON t.TDFId = a.TDFId
        from: "tdf",
        localField: "TDFId",
        foreignField: "_id",
        as: "TDF"
      }
    },
    {
      $lookup:{ //INNER JOIN course AS c ON c.courseId = a.courseId
        from: "course",
        localField: "courseId",
        foreignField: "_id",
        as: "course"
      }
    },
    {
      $unwind: "$course"
    },
    {
      $unwind: "$TDF"
    },
    {
      $match: { //WHERE c.courseid = $1
        "course._id": newCourseAssignment.courseid,
      }
    },
    {
      $project:{ //SELECT t.content -> \'fileName\' AS filename, t.TDFId, c.courseId
        fileName: "$TDF.content.fileName",
        TDFId: "$TDF._id",
        courseId: "$course._id"
      }
    }]).toArray();
    const existingTdfs = curCourseAssignments.map((courseAssignment) => courseAssignment.fileName);

    const tdfsAdded = getSetAMinusB(newTdfs, existingTdfs);
    const tdfsRemoved = getSetAMinusB(existingTdfs, newTdfs);

    // const tdfNamesAndIDs = await t.manyOrNone('SELECT TDFId, content -> \'fileName\' AS filename from tdf');
    const tdfNamesAndIDs = Tdfs.find().fetch();
    const tdfNameIDMap = {};
    for (const tdfNamesAndID of tdfNamesAndIDs) {
      tdfNameIDMap[tdfNamesAndID.content.fileName] = tdfNamesAndID._id;
    }

    for (const tdfName of tdfsAdded) {
      const TDFId = tdfNameIDMap[tdfName];
      serverConsole('editCourseAssignments tdf:', tdfNamesAndIDs, TDFId, tdfName, tdfsAdded, tdfsRemoved,
          curCourseAssignments, existingTdfs, newTdfs);
      //PostgresReversion Staged
      Assignments.insert({courseId: newCourseAssignment.courseid, TDFId: TDFId});
      // await t.none('INSERT INTO assignment(courseId, TDFId) VALUES($1, $2)', [newCourseAssignment.courseid, TDFId]);
    }
    for (const tdfName of tdfsRemoved) {
      const TDFId = tdfNameIDMap[tdfName];
      //PostgresReversion Staged
      Assignment.remove({$and: [{courseId: newCourseAssignment.courseid}, {TDFId: TDFId}]});
      // await t.none('DELETE FROM assignment WHERE courseId=$1 AND TDFId=$2', [newCourseAssignment.courseid, TDFId]);
    }
    return newCourseAssignment;
  } catch (e) {
    serverConsole('editCourseAssignments ERROR,', newCourseAssignment, ',', e);
    return null;
  }
}

async function getTdfAssignmentsByCourseIdMap(instructorId) {
  serverConsole('getTdfAssignmentsByCourseIdMap', instructorId);
  // Postgres Reversion
  // const query = 'SELECT t.content \
  //               AS content, a.TDFId, a.courseId \
  //               FROM assignment AS a \
  //               INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
  //               INNER JOIN course AS c ON c.courseId = a.courseId \
  //               WHERE c.semester = $1 AND c.teacherUserId=$2';
  // const assignmentTdfFileNamesRet = await db.any(query, [curSemester, instructorId]);
  const assignmentTdfFileNamesRet = await Assignments.rawCollection().aggregate([{
    $lookup:{
      from: "course",
      localField: "courseId",
      foreignField: "_id",
      as: "course"
    }
  },
  {
    $match: {
      "course.semester": curSemester,
      "course.teacherUserId": instructorId
    }
  },
  {
    $lookup:{
      from: 'tdfs',
      localField: 'TDFId',
      foreignField: '_id',
      as: 'TDF'
    }
  },
  {
    $unwind: {
      path: "$TDF",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project:{
      _id: 0,
      content: "$TDF.content",
      TDFId: 1,
      courseId: 1
    }
  }]).toArray();
  console.log(assignmentTdfFileNamesRet)
  // const courses = Courses.find({teacherUserId: instructorId}).fetch();
  // const assignments = Assignments.find().fetch();
  // let assignmentTdfFileNamesRet = []
  // let assignedTDFId = []

  // for(let course of courses){
  //   let assigns = assignments.filter(a => a.courseId == course._id);
  //   for(let assi of assigns){
  //     if(!assignedTDFId.find(assi.TDFId))
  //       assignedTDFId.push(assi.TDFId);
  //   }
  // }
  // for(let TDFId of assignedTDFId){
  //   assignmentTdfFileNamesRet.push({
  //     con
  //   })
  // }
  serverConsole('assignmentTdfFileNames', assignmentTdfFileNamesRet);
  const assignmentTdfFileNamesByCourseIdMap = {};
  for (const assignment of assignmentTdfFileNamesRet) {
    if (!assignmentTdfFileNamesByCourseIdMap[assignment.courseId]) {
      assignmentTdfFileNamesByCourseIdMap[assignment.courseId] = [];
    }
    assignmentTdfFileNamesByCourseIdMap[assignment.courseId].push({
      TDFId: assignment.TDFId,
      displayName: assignment.content.tdfs.tutor.setspec.lessonname,
    });
  }
  return assignmentTdfFileNamesByCourseIdMap;
}

async function getTdfsAssignedToStudent(userId, curSectionId) {
  serverConsole('getTdfsAssignedToStudent', userId, curSectionId);
  // Postgres Reversion
  // const query = 'SELECT t.* from TDF AS t INNER JOIN assignment AS a ON a.TDFId = t.TDFId INNER JOIN course AS c \
  //               ON c.courseId = a.courseId INNER JOIN section AS s ON s.courseId = c.courseId \
  //               INNER JOIN section_user_map AS m \
  //               ON m.sectionId = s.sectionId WHERE m.userId = $1 AND c.semester = $2 AND s.sectionId = $3';
  // const tdfs = await db.manyOrNone(query, [userId, curSemester, curSectionId]);
  const tdfs = await Tdfs.rawCollection().aggregate([{
    $lookup:{
      from: "assessments",
      localField: "_id",
      foreignField: "TDFId",
      as: "assessment"
    }
  },
  {
    $unwind: {  path: "$assessment" }
  },
  {
    $lookup:{
      from: "course",
      localField: "assessment.courseId",
      foreignField: "_id",
      as: "course"
    }
  },
  {
    $unwind: {  path: "$course" }
  },
  {
    $lookup:{
      from: "section",
      localField: "assessment.courseId",
      foreignField: "courseId",
      as: "section"
    }
  },
  {
    $unwind: {  path: "$section" }
  },
  {
    $lookup:{
      from: "section_user_map",
      localField: "section._id",
      foreignField: "sectionId",
      as: "users"
    }
  },
  {
    $match: {
      "course.semester": curSemester,
      "section._id": curSectionId
    }
  }
]).toArray();
return tdfs;
}

async function getTdfNamesAssignedByInstructor(instructorID) {
  try {
    // Postgres Reversion
    // const query = 'SELECT t.content -> \'fileName\' AS filename from course AS c \
    //             INNER JOIN assignment AS a ON a.courseId = c.courseId\
    //             INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
    //             WHERE c.teacherUserId = $1 AND c.semester = $2';
    // const assignmentTdfFileNames = await db.any(query, [instructorID, curSemester]);
    let  assignmentTdfFileNames = await Courses.rawCollection().aggregate([{
      $lookup:{
        from: "assessments",
        localField: "_id",
        foreignField: "courseId",
        as: "assessment"
      }
    },
    {
      $unwind: {  path: "$assessment" }
    },
    {
      $lookup:{
        from: "tdfs",
        localField: "assessment.TDFId",
        foreignField: "_id",
        as: "TDF"
      }
    },
    {
      $unwind: {  path: "$TDF" }
    },
    {
      $match: {
        "semester": curSemester,
        "teacherUserId": instructorID
      }
    },
    {
      $project:{
        _id: 0,
        fileName: "$TDF.content.fileName"
      }
    }
  ]).toArray();
  assignmentTdfFileNames = assignmentTdfFileNames.map(t => t.fileName)
    serverConsole('assignmentTdfFileNames', assignmentTdfFileNames);
    return assignmentTdfFileNames;
  } catch (e) {
    serverConsole('getTdfNamesAssignedByInstructor ERROR,', e);
    return null;
  }
}

async function getExperimentState(userId, TDFId) { // by currentRootTDFId, not currentTdfId
  //PostgresReversion Staged
  // const query = 'SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2';
  // const experimentStateRet = await db.oneOrNone(query, [UserId, TDFId]);
  const experimentStateRet = GlobalExperimentStates.findOne({userId: userId, TDFId: TDFId});
  const experimentState = experimentStateRet.experimentState;
  return experimentState;
}

// UPSERT not INSERT
async function setExperimentState(userId, TDFId, newExperimentState, where) { // by currentRootTDFId, not currentTdfId
  serverConsole('setExperimentState:', where, userId, TDFId, newExperimentState);
  //PostgresReversion Staged
  // const query = 'SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2';
  // const experimentStateRet = await db.oneOrNone(query, [UserId, TDFId]);
  const experimentStateRet = GlobalExperimentStates.findOne({userId: userId, TDFId: TDFId});
  console.log(experimentStateRet)
  console.log(newExperimentState)
  if (experimentStateRet != null) {
    const updatedExperimentState = Object.assign(experimentStateRet.experimentState, newExperimentState);
    GlobalExperimentStates.update({userId: userId, TDFId: TDFId}, {$set: {experimentState: updatedExperimentState}})
    return updatedExperimentState;
  }
  //PostgresReversion Staged
  // const insertQuery = 'INSERT INTO globalExperimentState (experimentState, userId, TDFId) VALUES ($1, $2, $3)';
  // await db.query(insertQuery, [{}, UserId, TDFId]);
  GlobalExperimentStates.insert({userId: userId, TDFId: TDFId, experimentState: {}});

  return TDFId;
}

async function insertHiddenItem(userId, stimulusKC, tdfId) {
  //PostgresReversion Staged
  //let query = "UPDATE componentstate SET showitem = FALSE WHERE userid = $1  AND tdfid = $2 AND kcid = $3 AND componenttype = 'stimulus'";
  //await db.manyOrNone(query, [userId, tdfId, stimulusKC]);
  ComponentStates.update({userId: userId, TDFId: tdfId, KCId: stimulusKC, componentType: "stimulus"}, {$set: {showItem: false}});
}

async function getHiddenItems(userId, tdfId) {
  //PostgresReversion Staged
  // let query = "SELECT kcid FROM componentstate WHERE userid = $1 AND tdfid = $2 AND showitem = false AND componenttype = 'stimulus'";
  // const res = await db.manyOrNone(query, [userId, tdfId]);
  const hiddenItems = ComponentStates.find({userId: userId, TDFId: tdfId, componentType: 'stimulus', showItem: false}).fetch();
  return hiddenItems;
}
async function getUserLastFeedbackTypeFromHistory(tdfID) {
  //PostgresReversion Staged
  // const query = "SELECT feedbackType FROM HISTORY WHERE TDFId = $1 AND userId = $2 ORDER BY eventid DESC LIMIT 1";
  // const feedbackType = await db.oneOrNone(query, [tdfID, Meteor.userId]);
  const feedbackType = Histories.findOne({TDFId: tdfID, userId: Meteor.userId}, {sort: {time: -1}}).feedbackType;
  return feedbackType;
}
async function insertHistory(historyRecord) {
  const tdfFileName = historyRecord['Condition_Typea'];
  const dynamicTagFields = await getListOfStimTags(tdfFileName);
  const eventId = histories.find({}, {limit: 1, sort: {eventId: 1}}).eventId + 1;
  historyRecord.eventId = eventId
  historyRecord.dynamicTagFields = dynamicTagFields || [];
  historyRecord.recordedServerTime = (new Date()).getTime();
  Histories.insert(historyRecord)
}

async function getHistoryByTDFfileName(TDFfileName) {
  const history = Histories.find({conditionTypeA: TDFfileName}).fetch();
  // const query = 'SELECT DISTINCT h.* FROM history AS h INNER JOIN item AS i ON i.itemId=h.itemId \
  //                INNER JOIN tdf AS t ON i.stimuliSetId=t.stimuliSetId WHERE h.condition_typea = $2 \
  //                and t.content @> $1::jsonb';
  // let query = 'SELECT * FROM history WHERE content @> $1' + '::jsonb';
  // const historyRet = await db.manyOrNone(query, [{'fileName': TDFfileName}, TDFfileName]);
  return history;
}

function getAllTeachers(southwestOnly=false) {
  const query = {'roles': 'teacher'};
  if (southwestOnly) query['username']=/southwest[.]tn[.]edu/i;
  serverConsole('getAllTeachers', query);
  const allTeachers = Meteor.users.find(query).fetch();

  return allTeachers;
}

async function addCourse(mycourse) {
  serverConsole('addCourse:' + JSON.stringify(mycourse));
  const courseId = Courses.insert(mycourse);
  for (const sectionName of mycourse.sections) {
    Sections.insert({courseId: courseId, sectionName: sectionName})
  }
  return courseId;
}

async function editCourse(mycourse) {
  serverConsole('editCourse:' + JSON.stringify(mycourse));
  Courses.update({_id: mycourse._id}, mycourse);
  const newSections = mycourse.sections;
  const curCourseSections = Sections.find({courseId: mycourse.courseId}).fetch()
  const oldSections = curCourseSections.map((section) => section.sectionName);
  serverConsole('old/new', oldSections, newSections);

  const sectionsAdded = getSetAMinusB(newSections, oldSections);
  const sectionsRemoved = getSetAMinusB(oldSections, newSections);
  serverConsole('sectionsAdded,', sectionsAdded);
  serverConsole('sectionsRemoved,', sectionsRemoved);

  for (const sectionName of sectionsAdded) {
    Sections.insert({courseId: mycourse.courseId, sectionName: sectionName});
  }
  for (const sectionName of sectionsRemoved) {
    Sections.remove({courseId: mycourse.courseId, sectionName: sectionName});
  }

  return mycourse.courseId;
}

async function addUserToTeachersClass(userId, teacherID, sectionId) {
  serverConsole('addUserToTeachersClass', userId, teacherID, sectionId);

  //const query = 'SELECT COUNT(*) AS existingMappingCount FROM section_user_map WHERE sectionId=$1 AND userId=$2';
  //await db.oneOrNone(query, [sectionId, userId]);
  const existingMappingCount = SectionUserMap.find({sectionId: sectionId, userId: userId}).count();
  serverConsole('existingMapping', existingMappingCount);
  if (existingMappingCount == 0) {
    serverConsole('new user, inserting into section_user_mapping', [sectionId, userId]);
    //await db.none('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)', [sectionId, userId]);
    SectionUserMap.insert({sectionId: sectionId, userId: userId});
  }

  return true;
}

async function getStimDisplayTypeMap() {
  try {
    serverConsole('getStimDisplayTypeMap');
    // const query = 'SELECT \
    // COUNT(i.clozeStimulus) AS clozeItemCount, \
    // COUNT(i.textStimulus)  AS textItemCount, \
    // COUNT(i.audioStimulus) AS audioItemCount, \
    // COUNT(i.imageStimulus) AS imageItemCount, \
    // COUNT(i.videoStimulus) AS videoItemCount, \
    // i.stimuliSetId \
    // FROM item AS i \
    // GROUP BY i.stimuliSetId;';
    //const counts = await db.many(query);
    const items = Items.find().fetch();
    let map = {};
    for(let item of items){
      if(!map[item.stimuliSetId]){
        map[item.stimuliSetId] = {
          hasCloze: false,
          hasText: false,
          hasAudio: false,
          hasImage: false,
          hasVideo: false
        }
      }
      else if(map[item.stimuliSetId].hasCloze && map[item.stimuliSetId].hasText && map[item.stimuliSetId].hasAudio &&
              map[item.stimuliSetId].hasImage && map[item.stimuliSetId].hasVideo){
        continue;
      }
      if(!map[item.stimuliSetId].hasCloze && item.clozeStimulus){
        map[item.stimuliSetId].hasCloze = true;
      }
      if(!map[item.stimuliSetId].hasText && item.textStimulus){
        map[item.stimuliSetId].hasText = true;
      }
      if(!map[item.stimuliSetId].hasAudio && item.audioStimulus){
        map[item.stimuliSetId].hasAudio = true;
      }
      if(!map[item.stimuliSetId].hasImage && item.imageStimulus){
        map[item.stimuliSetId].hasImage = true;
      }
      if(!map[item.stimuliSetId].hasVideo && item.videoStimulus){
        map[item.stimuliSetId].hasVideo = true;
      }
    }
    return map;
  } catch (e) {
    serverConsole('getStimDisplayTypeMap ERROR,', e);
    return null;
  }
}

async function getUsersByUnitUpdateDate(userIds, tdfId, date) {
  serverConsole('getUsersByUnitUpdateDate', userIds, tdfId, date, userIds.join(','));
  // const query = "SELECT userId, SUM(CF_End_Latency) AS duration \
  //   FROM history WHERE recordedServerTime < $1 \
  //   AND userId IN ('" + userIds.join(`','`) + "') AND TDFId = $2 \
  //   GROUP BY userId";

  //const res = await db.manyOrNone(query, [date, tdfId]);
  const res = Histories.find({userId: {$in: userIds}, TDFId: tdfId, recordedServerTime: {$lt: date}});
  const practiceTimeIntervalsMap = {};
  for (const row of res) {
    practiceTimeIntervalsMap[row.userId] = parseInt(row.duration);
  }
  serverConsole(practiceTimeIntervalsMap)
  return practiceTimeIntervalsMap;
}

async function getListOfStimTags(tdfFileName) {
  serverConsole('getListOfStimTags, tdfFileName: ' + tdfFileName);
  const tdf = await getTdfByFileName(tdfFileName);
  const stimuliSetId = tdf.stimuliSetId;
  serverConsole('getListOfStimTags, stimuliSetId: ' + stimuliSetId);
  const stims = await getStimuliSetById(stimuliSetId);
  const allTagsInStimFile = new Set();

  for (const stim of stims) {
    if (stim.tags) {
      for (const tagName of Object.keys(stim.tags)) {
        allTagsInStimFile.add(tagName);
      }
    }
  }

  return Array.from(allTagsInStimFile);
}

async function getListOfStimTagsFromStims(stims) {
  const allTagsInStimFile = new Set();

  for (const stim of stims) {
    if (stim.tags) {
      for (const tagName of Object.keys(stim.tags)) {
        allTagsInStimFile.add(tagName);
      }
    }
  }

  return Array.from(allTagsInStimFile);
}

async function getStimuliSetByFilename(stimFilename) {
  //Postgres Reversion
  // const idRet = await db.oneOrNone('SELECT stimuliSetId FROM item WHERE stimulusFileName = $1 LIMIT 1', stimFilename);
  idRet = Items.findOne({stimulusFileName: stimFilename});
  const stimuliSetId = idRet ? idRet.stimuliSetId : null;
  if (isEmpty(stimuliSetId)) return null;
  return await getStimuliSetById(stimuliSetId);
}

async function getStimuliSetById(stimuliSetId) {
  // PostgresReversion Staged
  // const query = 'SELECT * FROM item \
  //             WHERE stimuliSetId=$1 \
  //             ORDER BY itemId';
  // const itemRet = await db.manyOrNone(query, stimuliSetId);
  return Items.find({stimuliSetId: stimuliSetId}, {sort: {stimulusKC: 1}}).fetch();
}

async function getStimCountByStimuliSetId(stimuliSetId) {
  // PostgresReversion Staged
  let ret = Items.find({$count: {stimuliSetId: stimuliSetId}}, {sort: {stimulusKC: 1}}).fetch();
  // const query = 'SELECT COUNT(*) FROM item \
  //             WHERE stimuliSetId=$1 \
  //             ORDER BY itemId';
  // ret = await db.one(query, stimuliSetId);
  return ret.count;
}
async function getItemsByFileName(stimFileName) {
  // PostgresReversion Staged
  let itemRet = Items.find({stimulusfilename: stimFileName}, {$sort: {stimulusKC: 1}}).fetch();
  // const query = 'SELECT * FROM item \
  //            WHERE stimulusfilename=$1 \
  //            ORDER BY itemId';
  // itemRet = await db.manyOrNone(query, stimFileName);
  const items = [];
  for (const item of itemRet) {
    items.push(getItem(item));
  }
  serverConsole(items[0]);
  return items;
}
async function getStudentReportingData(userId, TDFId, hintLevel) {
  //creates a list of the correctness of the first 5 times a user answers.
  const correctnessAcrossRepetitions = await ComponentStates.rawCollection().aggregate([{
    $match: {
      userId: userId,
      TDFId: TDFId,
      componentType: 'stimulus',
      showItem: true,
      outcomeStack: { $exists: true, $not: {$size: 0} }
    }
  },
  {
    $unwind: {
      path: "$outcomeStack",
      includeArrayIndex: 'ordinality'
    }
  },
  {
    $group: {
      _id: "$ordinality",
      "ordinality": { "$first": "$ordinality"},
      "numCorrect": { "$sum": "$outcomeStack" },
      "numTotal": { "$sum": 1}
    }
  },
  {
    $match: {
      _id: {"$lt": 5}
    }
  },
  {
    $sort: {
      ordinality: 1
    }
  },
  {
    $project: {
      _id: 0,
      numCorrect: 1,
      numTotal: 1,
      'percentCorrect': {
        $round: {
          $multiply: [{$divide: ['$numCorrect', '$numTotal']}, 100]
        }
      },
    }
  }]).toArray();
  const probEstimates = await ComponentStates.rawCollection().aggregate([{
    $match: {
      "userId": userId,
      "TDFId": TDFId,
      "componentType": 'stimulus'
    }
  },
  {
    $lookup: {
      from: 'stimuli',
      localField: 'KCId',
      foreignField: 'stimulusKC',
      as: 'items'
    }
  },
  {
    $unwind: {
      path: "$items",
      preserveNullAndEmptyArrays: true
    }
  },
  {
    $project: {
      _id: 0,
      "clozeStimulus": {
        $cond: { 
          if:{
            $eq: ["$items.textStimulus", ""]
          }, 
          then:"$items.clozeStimulus", 
          else: '$items.textStimulus'
        }
      },
      'probabilityEstimate': {
        $round: {
          $multiply: ['$probabilityEstimate', 100]
        }
      },
      'lastSeen': '$lastSeen',
      'KCId': '$KCId'
    }
  }]).toArray();
  serverConsole(correctnessAcrossRepetitions, probEstimates)
  return {correctnessAcrossRepetitions, probEstimates};
}

async function getStimSetFromLearningSessionByClusterList(stimuliSetId, clusterList){
  // const query = 'SELECT stimuluskc FROM item \
  //              WHERE stimuliSetId=$1 \
  //              AND POSITION(CAST(clusterkc as text) in $2)>0 \
  //              ORDER BY itemId';
  // const itemRet = await db.manyOrNone(query, [stimuliSetId, clusterList]);
  const itemRet = Items.find({stimuliSetId: stimuliSetId}).fetch();
  console.log(itemRet)
  let learningSessionItem = [];
  for(let item of itemRet){
    if(clusterList.includes(item.clusterKC)){
      learningSessionItem.push(item.stimulusKC);
    }
  }
  return learningSessionItem;
}

async function getStudentPerformanceByIdAndTDFId(userId, TDFId, stimIds=null) {
  serverConsole('getStudentPerformanceByIdAndTDFId', userId, TDFId);
  // const query = `SELECT COUNT(i.itemID) AS totalStimCount,
  //                SUM(s.priorCorrect) AS numCorrect,
  //                SUM(s.priorIncorrect) AS numIncorrect,
  //                SUM(s.totalPracticeDuration) AS totalPracticeDuration,
  //                COUNT(CASE WHEN (s.priorIncorrect > 0 OR s.priorCorrect > 0) THEN 1 END) AS stimsIntroduced
  //                FROM (SELECT * from componentState WHERE userId=$1 AND TDFId=$2 AND componentType ='stimulus') AS s
  //                INNER JOIN item AS i ON i.stimulusKC = s.KCId`;
  //const perfRet = await db.oneOrNone(query, [userId, TDFid, stimIds]);
  let perfRet = {
    totalStimCount: 0,
    numCorrect: 0,
    numIncorrect: 0,
    totalPracticeDuration: 0,
    stimsIntroduced: 0
  };
  let innerQuery;
  console.log('stimIds: ', stimIds)
  if(stimIds)
    innerQuery = ComponentStates.find({userId: userId, TDFId: TDFId, componentType: 'stimulus', KCId: { $in: stimIds }}).fetch();
  else
    innerQuery = ComponentStates.find({userId: userId, TDFId: TDFId, componentType: 'stimulus'}).fetch();
  
  for(let i of innerQuery){
    const introduced = (i.priorCorrect > 0 || i.priorIncorrect > 0);
    perfRet = {
      totalStimCount: perfRet.totalStimCount + 1,
      numCorrect: perfRet.numCorrect + i.priorCorrect,
      numIncorrect: perfRet.numIncorrect + i.priorIncorrect,
      totalPracticeDuration: perfRet.totalPracticeDuration + i.totalPracticeDuration,
      stimsIntroduced: introduced ? perfRet.stimsIntroduced + 1 : perfRet.stimsIntroduced
    }
  }
  if (!perfRet) return null;
  return perfRet;
}

async function getStudentPerformanceByIdAndTDFIdFromHistory(userId, TDFId,returnRows=null){
  //used to grab a limited sample of the student's performance
  serverConsole('getStudentPerformanceByIdAndTDFIdFromHistory', userId, TDFId, returnRows);
  // let limitAddendum = "";
  // if(returnRows != null){
  //   limitAddendum = "ORDER BY itemid DESC LIMIT " + returnRows;
  // }
  // const query = `SELECT COUNT(DISTINCT s.ItemId) AS stimsintroduced,
  //                 COUNT(CASE WHEN s.outcome='correct' THEN 1 END) AS numCorrect,
  //                 COUNT(CASE WHEN s.outcome='incorrect' THEN 1 END) AS numIncorrect,
  //                 SUM(s.trialTime) as practiceDuration
  //                 FROM
  //                 (
  //                   SELECT itemid, outcome, cf_end_latency + cf_feedback_latency as trialTime
  //                   from history 
  //                   WHERE userId=$1 AND TDFId=$2
  //                   AND level_unittype = 'model'
  //                   ${limitAddendum}
  //                 ) s`;
  //const perfRet = await db.oneOrNone(query, [userId, TDFid]);
  let histories;
  if(returnRows)
    histories = Histories.find({userId: userId, TDFId: TDFId, levelUnitType: 'model'}, {limit: returnRows, sort: {time: -1}}).fetch(); //limit
  else
    histories = Histories.find({userId: userId, TDFId: TDFId, levelUnitType: 'model'}).fetch();
  let perfRet = {
    numCorrect: 0,
    numIncorrect: 0,
    practiceDuration: 0,
    stimsIntroduced: 0
  }
  let itemIds = []
  for(let history of histories){
    perfRet = {
      numCorrect: history.outcome == 'correct' ? perfRet.numCorrect + 1 : perfRet.numCorrect,
      numIncorrect: history.outcome == 'incorrect' ? perfRet.numIncorrect + 1 : perfRet.numIncorrect,
      practiceDuration: perfRet.practiceDuration + history.CFEndLatency + history.CFFeedbackLatency,
    }
    itemIds.push(history.itemId);
  }
  perfRet.stimsIntroduced = new Set(itemIds).size;
  if (!perfRet) return null;
  return perfRet
}

async function getNumDroppedItemsByUserIDAndTDFId(userId, TDFId){
  //used to grab a limited sample of the student's performance
  serverConsole('getNumDroppedItemsByUserIDAndTDFId', userId, TDFId);
  // const query = `select COUNT
  //               (
  //                 CASE WHEN CF_Item_Removed=TRUE AND 
  //                 userId=$1 AND 
  //                 TDFId=$2 AND 
  //                 level_unittype = 'model' THEN 1 END
  //               ) from history`;
  // const queryRet = await db.oneOrNone(query, [userId, TDFid]);
  const count = Histories.find({userId: userId, TDFId: TDFId, CFItemRemoved: true, levelUnitType: 'model'}).count();
  return count;
}

async function getStudentPerformanceForClassAndTdfId(instructorId, date=null) {
  // let dateAdendumn = "";
  // if(date){
  //   dateAdendumn = `AND s.recordedServerTime < ${date}`
  // }
  // const query = `SELECT MAX(t.TDFId) AS tdfid, 
  //                 MAX(c.courseId) AS courseid, 
  //                 MAX(s.userId) AS userid, 
  //                 COUNT(CASE WHEN s.outcome='correct' THEN 1 END) AS correct, 
  //                 COUNT(CASE WHEN s.outcome='incorrect' THEN 1 END) AS incorrect, 
  //                 SUM(COALESCE(s.cf_end_latency + s.cf_feedback_latency, s.cf_end_latency, s.cf_feedback_latency)) AS totalPracticeDuration,
  //                 sc.sectionId AS sectionId 
  //                 FROM history AS s 
  //                 INNER JOIN item AS i ON i.stimulusKC = s.KCId 
  //                 INNER JOIN tdf AS t ON t.stimuliSetId = i.stimuliSetId 
  //                 INNER JOIN assignment AS a on a.TDFId = t.TDFId 
  //                 INNER JOIN course AS c on c.courseId = a.courseId 
  //                 INNER JOIN section_user_map AS sm on sm.userId = s.userId 
  //                 INNER JOIN section AS sc on sc.sectionId = sm.sectionId 
  //                 WHERE c.semester = $1 AND c.teacherUserId = $2 AND sc.courseId = c.courseId AND s.level_unittype = 'model'  ${dateAdendumn}
  //                 GROUP BY s.userId, t.TDFId, c.courseId, sc.sectionId;`

  //const studentPerformanceRet = await db.manyOrNone(query, [curSemester, instructorId]);
  let studentPerformanceRet = [];
  let hist;
  if(date){
    hist = Histories.find({levelUnitType: "model", recordedServerTime: {$lt: date}}).fetch();
  }
  else {
    hist = Histories.find({levelUnitType: "model"}).fetch();
  }

  const courses = Courses.find({teacherUserId: instructorId}).fetch();
  const sections = Sections.find({courseId: {$in: courses.map(x => x._id)}}).fetch();
  const userMap = SectionUserMap.find().fetch();

  for(let history of hist){
    let sectionsRet = userMap.filter(u => u.userId == history.userId); //find all the sections that the user is in
    for(section of sectionsRet){
      let sectionId = section.sectionId;
      let courseId = sections.find(s => s._id == sectionId); //find the courseID of each section
      if(courseId)
      {
        courseId = courseId.courseId
        let course = courses.find(c => c._id == courseId);
        if(course.teacherUserId == instructorId){
          let foundIndex = studentPerformanceRet.findIndex( entry => 
            entry.TDFId == history.TDFId && 
            entry.userId == history.userId && 
            entry.courseId == courseId
          )
          const correct = history.outcome == 'correct'
          if(foundIndex > 0){
            //entry exists
            const studentPerf = studentPerformanceRet[foundIndex];
            studentPerformanceRet[foundIndex].correct = studentPerf.correct + (correct ? 1 : 0);
            studentPerformanceRet[foundIndex].incorrect = studentPerf.incorrect + (correct ? 0 : 1);
            studentPerformanceRet[foundIndex].totalPracticeDuration = studentPerf.totalPracticeDuration + history.CFEndLatency + history.CFFeedbackLatency;
          }
          else{
            studentPerformanceRet.push({
              TDFId: history.TDFId,
              courseId: courseId,
              userId: history.userId,
              correct: correct ? 1 : 0,
              incorrect: correct ? 0 : 1,
              totalPracticeDuration: history.CFEndLatency + history.CFFeedbackLatency,
              sectionId: sectionId
            })
          }
        }
      }
    }
  }
  serverConsole('studentPerformanceRet', studentPerformanceRet);
  if (studentPerformanceRet==null) {
    return [];
  }
  const studentPerformanceForClass = {};
  const studentPerformanceForClassAndTdfIdMap = {};
  for (const studentPerformance of studentPerformanceRet) {
    let {courseId, userId, TDFId, correct, incorrect, totalPracticeDuration} = studentPerformance;
    let studentUsername = userIdToUsernames[userId];
    if (!studentUsername) {
      serverConsole(Meteor.users.findOne({_id: userId}).username + ', ' + userId);
      studentUsername = Meteor.users.findOne({_id: userId}).username;
      userIdToUsernames[userId] = studentUsername;
    }

    correct = parseInt(correct);
    incorrect = parseInt(incorrect);
    totalPracticeDuration = parseInt(totalPracticeDuration);

    if (!studentPerformanceForClass[courseId]) studentPerformanceForClass[courseId] = {};
    if (!studentPerformanceForClass[courseId][TDFId]) {
      studentPerformanceForClass[courseId][TDFId] = {count: 0, totalTime: 0, numCorrect: 0};
    }
    studentPerformanceForClass[courseId][TDFId].numCorrect += correct;
    studentPerformanceForClass[courseId][TDFId].count += correct + incorrect;
    studentPerformanceForClass[courseId][TDFId].totalTime += totalPracticeDuration;

    if (!studentPerformanceForClassAndTdfIdMap[courseId]) studentPerformanceForClassAndTdfIdMap[courseId] = {};
    if (!studentPerformanceForClassAndTdfIdMap[courseId][TDFId]) {
      studentPerformanceForClassAndTdfIdMap[courseId][TDFId] = {};
    }

    if (!studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId]) {
      studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId] = {
        count: 0,
        totalTime: 0,
        numCorrect: 0,
        username: studentUsername,
        userId: userId,
      };
    }
    studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId].numCorrect += correct;
    studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId].count += correct + incorrect;
    studentPerformanceForClassAndTdfIdMap[courseId][TDFId][userId].totalTime = totalPracticeDuration;
  }
  serverConsole('studentPerformanceForClass:', JSON.stringify(studentPerformanceForClass, null, 4));
  for (const index of Object.keys(studentPerformanceForClass)) {
    const coursetotals = studentPerformanceForClass[index];
    for (const index2 of Object.keys(coursetotals)) {
      const tdftotal = coursetotals[index2];
      tdftotal.percentCorrect = ((tdftotal.numCorrect / tdftotal.count)*100).toFixed(2) + '%',
      tdftotal.totalTimeDisplay = (tdftotal.totalTime / (60 * 1000) ).toFixed(1); // convert to minutes from ms
    }
  }
  serverConsole('studentPerformanceForClassAndTdfIdMap:', studentPerformanceForClassAndTdfIdMap);
  for (const index3 of Object.keys(studentPerformanceForClassAndTdfIdMap)) {
    const coursetotals = studentPerformanceForClassAndTdfIdMap[index3];
    for (const index4 of Object.keys(coursetotals)) {
      const tdftotals = coursetotals[index4];
      for ( const studenttotal of Object.values(tdftotals)) {
        studenttotal.percentCorrect = ((studenttotal.numCorrect / studenttotal.count)*100).toFixed(2) + '%',
        studenttotal.totalTimeDisplay = (studenttotal.totalTime / (60 * 1000) ).toFixed(1);
      }
    }
  }
  return [studentPerformanceForClass, studentPerformanceForClassAndTdfIdMap];
}

async function getTdfIDsAndDisplaysAttemptedByUserId(userId, onlyWithLearningSessions=true) {
  //Postgres Reversion 
  // const query = 'SELECT TDFId from globalExperimentState WHERE userId = $1';
  // const tdfRet = await db.manyOrNone(query, userId);
  const tdfRet = GlobalExperimentStates.find({userId: userId}).fetch();

  const tdfsAttempted = [];
  for (const obj of tdfRet) {
    const TDFId = obj.TDFId;
    const tdf = await getTdfById(TDFId)
    if (!tdf) continue; // Handle a case where user has data from a no longer existing tdf
    const tdfObject = tdf.content;
    if (!tdfObject.tdfs.tutor.unit) continue;// TODO: fix root/condition tdfs

    if (onlyWithLearningSessions) {
      for (const unit of tdfObject.tdfs.tutor.unit) {
        if (unit.learningsession) {
          const displayName = tdfObject.tdfs.tutor.setspec.lessonname;
          tdfsAttempted.push({TDFId, displayName});
          break;
        }
      }
    } else {
      const displayName = tdfObject.tdfs.tutor.setspec.lessonname;
      tdfsAttempted.push({TDFId, displayName});
    }
  }

  return tdfsAttempted;
}

function setLearningSessionItemsMulti(learningSessionItem, tdf) {
  const lastStim = getStimCountByStimuliSetId(tdf.stimuliSetId) - 1;
  for (let i = 0; i < lastStim - 1; i++) {
    learningSessionItem[i] = true;
  }
}

function setLearningSessionItems(learningSessionItem, tdf) {
  const units = tdf.content.tdfs.tutor.unit;
  if (!_.isEmpty(units)) {
    units.forEach((unit) => {
      if (unit.learningsession) {
        const clusterList = getClusterListsFromUnit(unit);
        clusterList.forEach((clusterRange) => {
          const [start, end] = clusterRange;
          for (let i = start; i <= end; i++) {
            learningSessionItem[i] = true;
          }
        });
      }
    });
  }
}

function getClusterListsFromUnit(unit) {
  const clustersToParse = unit.learningsession.clusterlist;
  return clustersToParse.split(' ').map((x) => x.split('-').map((y) => parseInt(y)));
}

function defaultUserProfile() {
  return {
    have_aws_id: false,
    have_aws_secret: false,
    aws_id: '',
    aws_secret_key: '',
    use_sandbox: true,
  };
}

function sendErrorReportSummaries() {
  serverConsole('sendErrorReportSummaries');
  const unsentErrorReports = ErrorReports.find({'emailed': false}).fetch();
  if (unsentErrorReports.length > 0) {
    let sentErrorReports = new Set();
    // eslint-disable-next-line guard-for-in
    for (const index in adminUsers) {
      const admin = adminUsers[index];
      const from = ownerEmail;
      const subject = 'Error Reports Summary - ' + thisServerUrl;
      let text = '';
      // eslint-disable-next-line guard-for-in
      for (const index2 in unsentErrorReports) {
        const unsentErrorReport = unsentErrorReports[index2];
        const userWhoReportedError = Meteor.users.findOne({_id: unsentErrorReport.user});
        const userWhoReportedErrorUsername = userWhoReportedError ? userWhoReportedError.username : 'UNKNOWN';
        text = text + 'User: ' + userWhoReportedErrorUsername + ', page: ' + unsentErrorReport.page +
               ', time: ' + unsentErrorReport.time + ', description: ' + unsentErrorReport.description +
               ', userAgent: ' + unsentErrorReport.userAgent + ' \n';
        sentErrorReports.add(unsentErrorReport._id);
      }

      try {
        sendEmail(admin, from, subject, text);
      } catch (err) {
        serverConsole(err);
      }
    }
    sentErrorReports = Array.from(sentErrorReports);
    ErrorReports.update({_id: {$in: sentErrorReports}}, {$set: {'emailed': true}}, {multi: true});
    serverConsole('Sent ' + sentErrorReports.length + ' error reports summary');
  } else {
    serverConsole('no unsent error reports to send');
  }
}

// Save the given user profile via "upsert" logic
function userProfileSave(id, profile) {
  try {
    // Insure record matching ID is present while working around MongoDB 2.4 bug
    UserProfileData.update({_id: id}, {'$set': {'preUpdate': true}}, {upsert: true});
  } catch (e) {
    serverConsole('Ignoring user profile upsert ', e);
  }
  const numUpdated = UserProfileData.update({_id: id}, profile);
  if (numUpdated == 1) {
    return 'Save succeeed';
  }

  // WHOOOPS! If we're still here something has gone horribly wrong
  if (numUpdated < 1) {
    throw new Meteor.Error('user-profile-save', 'No records updated by save');
  } else {
    throw new Meteor.Error('user-profile-save', 'More than one record updated?! ' + _.display(numUpdated));
  }
}

// used to generate teacher/admin secret keys for api calls
function generateKey(size = 32, format = 'base64') {
  const buffer = crypto.randomBytes(size);
  return buffer.toString(format);
}

//only if we dont already have a secret for this user. 
function createUserSecretKey(targetUserId){
  if(!Meteor.users.findOne({_id: targetUserId}).secretKey){
    Meteor.users.update({_id: targetUserId}, { $set: { secretKey: generateKey() }});
  }
}

function updateUserSecretKey(targetUserId){
  if(Roles.userIsInRole(targetUserId, ['admin', 'teacher']))
    Meteor.users.update({_id: targetUserId}, { $set: { secretKey: generateKey() }});
}

// Only removes secret key if the user is no longer an admin or teacher
function removeUserSecretKey(targetUserId){
  if(!Roles.userIsInRole(targetUserId, ['admin', 'teacher']))
    Meteor.users.update({_id: targetUserId}, { $set: { secretKey: '' }});
}

// Return the user object matching the user. We use Meteor's provided search
// function to attempt to locate the user. We will attempt to find the user
// by username *and* by email.
function findUserByName(username) {
  if (!username || _.prop(username, 'length') < 1) {
    return null;
  }

  const funcs = [Accounts.findUserByUsername, Accounts.findUserByEmail];

  for (let i = 0; i < funcs.length; ++i) {
    const user = funcs[i](username);
    if (user) {
      return user;
    }
  }

  return null;
}

async function verifySyllableUpload(stimSetId){
  // const query = 'SELECT COUNT(DISTINCT LOWER(correctresponse)) FROM item WHERE stimulisetid = $1';
  // PostgresReversion Staged
  return true;
  let postgresRet = Items.find();
  // postgresRet = await db.oneOrNone(query, stimSetId);
  const answersCountPostgres = postgresRet.count;

  const mongoRet = StimSyllables.findOne({filename: stimSetId});
  if(mongoRet){
    const answersCountMongo = Object.keys(mongoRet.data).length;
    if(answersCountMongo == answersCountPostgres)
      return true;
  }
  StimSyllables.remove({filename: stimSetId});
  return false;
}

function sendEmail(to, from, subject, text) {
  check([to, from, subject, text], [String]);
  Email.send({to, from, subject, text});
}

function hasGeneratedTdfs(TDFjson) {
  return TDFjson.tdfs.tutor.generatedtdfs && TDFjson.tdfs.tutor.generatedtdfs.length;
}

// TODO rework for input in a new format as well as the current assumption of the old format
async function upsertStimFile(stimFilename, stimJSON, ownerId) {
  serverConsole('upsertStimFile', stimFilename);
  const oldStimFormat = {
    'fileName': stimFilename,
    'stimuli': stimJSON,
    'owner': ownerId,
    'source': 'repo',
  };
  const responseKCMap = await getReponseKCMap();
  // PostgresReversion Staged
  // const query = 'SELECT stimuliSetId FROM item WHERE stimulusFileName = $1 LIMIT 1';
  const associatedStimSetIdRet = Items.findOne({stimulusFileName: stimFilename})
  // const associatedStimSetIdRet = await t.oneOrNone(query, stimFilename);
  serverConsole('getAssociatedStimSetIdForStimFile', stimFilename, associatedStimSetIdRet);
  let stimuliSetId;
  if (associatedStimSetIdRet) {
    stimuliSetId = associatedStimSetIdRet.stimuliSetId;
    serverConsole('stimuliSetId1:', stimuliSetId, associatedStimSetIdRet);
  } else {
    // PostgresReversion Staged
    // const highestStimuliSetId = await t.oneOrNone('SELECT MAX(stimuliSetId) AS stimuliSetId FROM item');
    const highestStimuliSetId = Items.findOne({}, {sort: {stimuliSetId: -1}, limit: 1 });
    stimuliSetId = highestStimuliSetId && highestStimuliSetId.stimuliSetId ?
        parseInt(highestStimuliSetId.stimuliSetId) + 1 : 1;
    serverConsole('stimuliSetId2:', stimuliSetId, highestStimuliSetId);
  }

  const newFormatItems = getNewItemFormat(oldStimFormat, stimFilename, stimuliSetId, responseKCMap);
  // PostgresReversion Staged
  // const existingStims = await t.manyOrNone('SELECT * FROM item WHERE stimulusFileName = $1', stimFilename);
  const existingStims = await Items.find({stimulusFileName: stimFilename});
  let newStims = [];
  let stimulusKC;
  if (existingStims && existingStims.length > 0) {
    for (const newStim of newFormatItems) {
      stimulusKC = newStim.stimulusKC;
      let matchingStim = existingStims.find((x) => x.stimulusKC == stimulusKC);
      if (!matchingStim) {
        serverConsole('matchingstims')
        newStims.push(newStim);
        continue;
      }
      matchingStim = getItem(matchingStim);
      const mergedStim = Object.assign(matchingStim, newStim);
      //await t.none('UPDATE item SET stimuliSetId = ${stimuliSetId}, \
      //              parentStimulusFileName = ${parentStimulusFileName}, stimulusKC = ${stimulusKC}, \
      //              clusterKC = ${clusterKC}, responseKC = ${responseKC}, params = ${params}, \
      //             optimalProb = ${optimalProb}, correctResponse = ${correctResponse}, \
      //              incorrectResponses = ${incorrectResponses}, itemResponseType = ${itemResponseType}, \
      //              speechHintExclusionList = ${speechHintExclusionList}, clozeStimulus = ${clozeStimulus}, \
      //              textStimulus = ${textStimulus}, audioStimulus = ${audioStimulus}, \
      //              imageStimulus = ${imageStimulus}, videoStimulus = ${videoStimulus}, \
      //              alternateDisplays = ${alternateDisplays}, tags = ${tags} \
      //              WHERE stimulusFileName = ${stimulusFileName} AND stimulusKC = ${stimulusKC}', mergedStim);
      Items.update({stimulusFileName: stimulusFileName, stimulusKC: stimulusKC},{$set: {
        stimuliSetId: mergedStim.stimuliSetId,
        parentStimulusFileName: mergedStim.parentStimulusFileName,
        stimulusKC: mergedStim.stimulusKC,
        clusterKC: mergedStim.clusterKC,
        responseKC: mergedStim.responsKC,
        params: mergedStim.params,
        optimalProb: mergedStim.optimalProb,
        correctResponse: mergedStim.correctResponse,
        incorrectResponses: mergedStim.incorrectResponses,
        itemResponseType: mergedStim.itemResponseType,
        speechHintExclusionList: mergedStim.speechHintExclusionList,
        clozeStimulus: mergedStim.clozeStimulus,
        textStimulus: mergedStim.textStimulus,
        audioStimulus: mergedStim.audioStimulus,
        imageStimulus: mergedStim.imageStimulus,
        videoStimulus: mergedStim.videoStimulus,
        aleternateDisplays: mergedStim.aleternateDisplays,
        tags: mergedStim.tags
      }})
    }
    // PostgresReversion Staged
    //if we get here we might have more stims in the old file than in the new. Need to remove them from the db.
    // PostgresReversion Staged
    Items.remove({stimulusKC: {$gt: stimulusKC},stimulusKC: {$lt: (stimulusKC + 1) * 10000}});
    // await t.none(`DELETE FROM item WHERE stimulusKC > ${stimulusKC} and stimulusKC < ${stimuliSetId + 1} * 10000;`);
  } else {
    newStims = newFormatItems;
  }
  serverConsole('!!!newStims:', newStims);
  for (const stim of newStims) {
    Items.insert(stim);
    // PostgresReversion Staged
    // await t.none('INSERT INTO item(stimuliSetId, stimulusFileName, stimulusKC, clusterKC, responseKC, params, \
    //   optimalProb, correctResponse, incorrectResponses, itemResponseType, speechHintExclusionList, clozeStimulus, \
    //  textStimulus, audioStimulus, imageStimulus, videoStimulus, alternateDisplays, tags) \
    // VALUES(${stimuliSetId}, ${stimulusFileName}, ${stimulusKC}, ${clusterKC}, ${responseKC}, ${params}, \
    //   ${optimalProb}, ${correctResponse}, ${incorrectResponses}, ${itemResponseType}, ${speechHintExclusionList}, \
    //  ${clozeStimulus}, ${textStimulus}, ${audioStimulus}, ${imageStimulus}, ${videoStimulus}, \
    //  ${alternateDisplays}::jsonb, ${tags})', stim);
  }
  //Update Stim Cache every upload
  Meteor.call('updateStimSyllables', stimuliSetId);
}



async function upsertTDFFile(tdfFilename, tdfJSON, ownerId) {
  serverConsole('upsertTDFFile', tdfFilename);
  const prev = await getTdfByFileName(tdfFilename);
  let stimFileName;
  let skipStimSet = false;
  let stimSet;
  if (tdfJSON.tdfs.tutor.setspec.stimulusfile) {
    stimFileName = tdfJSON.tdfs.tutor.setspec.stimulusfile;
    stimSet = await getStimuliSetByFilename(stimFileName);
  } else {
    skipStimSet = true;
  }
  if (!stimSet && !skipStimSet) throw new Error('no stimset for tdf:', tdfFilename);
  if (prev && prev._id) {
    let tdfJSONtoUpsert;
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', stimSet);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      delete generatedTdf.createdAt;
      tdfJSONtoUpsert = generatedTdf;
    } else {
      tdfJSONtoUpsert = tdfJSON;
    }
    // PostgresReversion Staged
    Tdfs.update({_id: prev._id},{$set:{
      ownerId: ownerId,
      stimuliSetId: prev.stimuliSetId,
      content: tdfJSONtoUpsert
    }});
    // const query = 'UPDATE tdf SET ownerId=$1, stimuliSetId=$2, content=$3::jsonb WHERE TDFId=$4';
    // await db.none(query, [ownerId, prev.stimuliSetId, tdfJSONtoUpsert, prev.TDFId]);
  } else {
    let tdfJSONtoUpsert;
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', stimSet);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      tdfJSONtoUpsert = generatedTdf;
    } else {
      tdfJSON.createdAt = new Date();
      tdfJSONtoUpsert = tdfJSON;
    }
    let stimuliSetId;
    if (tdfJSON.tdfs.tutor.setspec.stimulusfile) {
      const stimFileName = tdfJSON.tdfs.tutor.setspec.stimulusfile;
      // PostgresReversion Staged
      const associatedStimSetIdRet = Items.findOne({stimulusFileName: stimFileName});
      // const stimuliSetIdQuery = 'SELECT stimuliSetId FROM item WHERE stimulusFileName = $1 LIMIT 1';
      // const associatedStimSetIdRet = await t.oneOrNone(stimuliSetIdQuery, stimFileName);
      if (associatedStimSetIdRet) {
        stimuliSetId = associatedStimSetIdRet.stimuliSetId;
      } else {
        throw new Error('No matching stimulus file found');
      }
    } else {
      stimuliSetId = null; // Root condition tdfs have no stimulisetid
    }
    // PostgresReversion Staged
    Tdfs.insert({ownerId: ownerId, stimuliSetId: stimuliSetId, content: tdfJSONtoUpsert});
    // const query = 'INSERT INTO tdf(ownerId, stimuliSetId, content) VALUES($1, $2, $3::jsonb)';
    // await t.none(query, [ownerId, stimuliSetId, tdfJSONtoUpsert]);
  }
}


async function loadStimsAndTdfsFromPrivate(adminUserId) {
  if (!isProd) {
    serverConsole('loading stims and tdfs from asset dir');
    serverConsole('start stims');
    const stimFilenames = _.filter(fs.readdirSync('./assets/app/stims/'), (fn) => {
      return fn.indexOf('.json') >= 0;
    });
    for (const filename of stimFilenames) {
      const data = Assets.getText('stims/' + filename);
      const json = JSON.parse(data);
      await upsertStimFile(filename, json, adminUserId);
    }
    setTimeout(async () => {
      serverConsole('start tdfs');
      const tdfFilenames = _.filter(fs.readdirSync('./assets/app/tdf/'), (fn) => {
        return fn.indexOf('.json') >= 0;
      });
      for (let filename of tdfFilenames) {
        const data = Assets.getText('tdf/' + filename);
        const json = JSON.parse(data);
        filename = filename.replace('.json', curSemester + '.json');
        const rec = {'fileName': filename, 'tdfs': json, 'ownerId': adminUserId, 'source': 'repo'};
        await upsertTDFFile(filename, rec, adminUserId);
      }
    }, 2000);
  }
}

async function makeHTTPSrequest(options, request){
  return new Promise((resolve, reject) => {
    let chunks = []
    const req = https.request(options, res => {        
      res.on('data', d => {
          chunks.push(d);
      })
      res.on('end', function() {
          console.log(Buffer.concat(chunks).toString());
          resolve(Buffer.concat(chunks));
      })
    })
    
    req.on('error', (e) => {
      reject(e.message);
    });

    req.write(request)
    req.end()
  });
}

const baseSyllableURL = 'http://localhost:4567/syllables/';
function getSyllablesForWord(word) {
  const syllablesURL = baseSyllableURL + word;
  const result = HTTP.call('GET', syllablesURL);
  const syllableArray = result.content.replace(/\[|\]/g, '').split(',').map((x) => x.trim());
  serverConsole('syllables for word, ' + word + ': ' + stringifyIfExists(syllableArray) );
  return syllableArray;
}

// Server-side startup logic
Meteor.methods({
  getAllTdfs, getAllStims, getTdfById, getTdfByFileName, getTdfByExperimentTarget, getTdfIDsAndDisplaysAttemptedByUserId,

  getLearningSessionItems, getStimDisplayTypeMap, getStimuliSetById, getStimuliSetsForIdSet,
  getStimuliSetByFilename, getSourceSentences, getMatchingDialogueCacheWordsForAnswer,

  getAllCourses, getAllCourseSections, getAllCoursesForInstructor, getAllCourseAssignmentsForInstructor,
  addCourse, editCourse, editCourseAssignments, addUserToTeachersClass,

  getAllTeachers, getTdfNamesAssignedByInstructor, getTdfsAssignedToStudent, getTdfAssignmentsByCourseIdMap,

  getStudentPerformanceByIdAndTDFId, getStudentPerformanceByIdAndTDFIdFromHistory, getNumDroppedItemsByUserIDAndTDFId,
  
  getStudentPerformanceForClassAndTdfId, getStimSetFromLearningSessionByClusterList,

  getExperimentState, setExperimentState, getUserIdforUsername, insertStimTDFPair,

  getProbabilityEstimatesByKCId, getReponseKCMap,

  getComponentStatesByUserIdTDFIdAndUnitNum, setComponentStatesByUserIdTDFIdAndUnitNum,

  insertHistory, getHistoryByTDFfileName, getUsersByUnitUpdateDate,

  loadStimsAndTdfsFromPrivate, getListOfStimTags, getStudentReportingData,

  insertHiddenItem, getHiddenItems, getUserLastFeedbackTypeFromHistory,

  getTdfIdByStimSetIdAndFileName, getItemsByFileName,


  makeGoogleTTSApiCall: async function(TDFId, message, audioPromptSpeakingRate, audioVolume) {
    const ttsAPIKey = await getTdfTTSAPIKey(TDFId);
    const request = JSON.stringify({
      input: {text: message},
      voice: {languageCode: 'en-US', ssmlGender: 'FEMALE'},
      audioConfig: {audioEncoding: 'MP3', speakingRate: audioPromptSpeakingRate, volumeGainDb: audioVolume},
    });
    const options = {
      hostname: 'texttospeech.googleapis.com',
      path: '/v1/text:synthesize?key=' + ttsAPIKey,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    }
    return await makeHTTPSrequest(options, request).then((data, error) => {
      if(error)
        throw new Meteor.Error('Error with Google TTS API call: ' + error);
      response = JSON.parse(data.toString('utf-8'))
      return response.audioContent;
    });
  },
  
  makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey = '', request, answerGrammar){
    console.log(request)
    if(speechAPIKey == ''){
      speechAPIKey = await getTdfTTSAPIKey(TDFId);
    }
    const options = {
      hostname: 'speech.googleapis.com',
      path: '/v1/speech:recognize?key=' + speechAPIKey,
      method: 'POST'
    }
    return await makeHTTPSrequest(options, JSON.stringify(request)).then((data, error) => {
      if(error)
        throw new Meteor.Error('Error with Google SR API call: ' + error);
      return [answerGrammar, JSON.parse(data.toString('utf-8'))]
    });
  },
  getUIDAndSecretForCurrentUser: async function(){
    if(!Meteor.userId()){
      throw new Meteor.Error('Unauthorized: No user login');
    }
    else if(!Roles.userIsInRole(Meteor.userId(), ['teacher', 'admin'])){
      throw new Meteor.Error('Unauthorized: You do not have permission to this data');
    }
    return [Meteor.userId(), Meteor.user().secretKey]
  },

  resetCurSessionTrialsCount: async function(userId, TDFId) {
    //await db.none('UPDATE componentstate SET cursessionpriorcorrect = 0, cursessionpriorincorrect = 0 WHERE userId = $1 AND TDFId = $2', [userId, TDFId])
    ComponentStates.update({userId: userId, TDFId: TDFId}, {$set: {curSessionPriorCorrect: 0, curSessionPriorIncorrect: 0}});
  },

  getAltServerUrl: function() {
    return altServerUrl;
  },

  resetAllSecretKeys: function() {
    if(Meteor.userId() && Roles.userIsInRole(Meteor.userId(), ['admin'])){
      serverConsole('resetting user secrets');
      const users = Meteor.users.find({$or: [{roles: "teacher"}, {roles: "admin"}]}).fetch();
      for(user of users){
        serverConsole(`resetting user secret for ${user._id}`)
        updateUserSecretKey(user._id);
      }
    }
  },

  getClozesFromText: function(inputText) {
    // eslint-disable-next-line new-cap
    const clozes = ClozeAPI.GetSelectCloze(null, null, null, true, null, inputText);
    return clozes;
  },

  getSimpleFeedbackForAnswer: function(userAnswer, correctAnswer) {
    // eslint-disable-next-line new-cap
    const result = ElaboratedFeedback.GenerateFeedback(userAnswer, correctAnswer);
    serverConsole('result: ' + JSON.stringify(result));
    return result;
  },

  initializeTutorialDialogue: function(correctAnswer, userIncorrectAnswer, clozeItem) {
    // eslint-disable-next-line new-cap
    const initialState = TutorialDialogue.GetElaboratedDialogueState(correctAnswer, userIncorrectAnswer, clozeItem);
    return initialState;
  },

  getDialogFeedbackForAnswer: function(state) {
    // eslint-disable-next-line new-cap
    const feedback = TutorialDialogue.GetDialogue(state);
    return feedback;
    // Display: text to show the student. Show this always.
    // Finished: if true, continue normal MoFaCTS operation; if false, get a student input
    // LastStudentAnswer: Mutate this with student input you just got
  },

  updateStimSyllables: async function(stimSetId) {
    StimSyllables.remove({filename: stimSetId});
    serverConsole('updateStimSyllables');
    const curStimuliSet = Items.find({stimuliSetId: stimSetId}).fetch();
    serverConsole('curStimuliSet: ' + JSON.stringify(curStimuliSet));
    if (curStimuliSet) {
      const answerSyllableMap = {};
      for (const stim of curStimuliSet) {
        if(!stim.syllables){
          let syllableArray;
          let syllableGenerationError;
          const answer = stim.correctResponse;
          const safeAnswer = answer.replace(/\./g, '_').split('~')[0];
          try{
            if(!answerSyllableMap[safeAnswer]){
              answerSyllableMap[safeAnswer] = getSyllablesForWord(safeAnswer);
            }
            syllableArray = answerSyllableMap[safeAnswer]
          }
          catch (e) {
            serverConsole('error fetching syllables for ' + answer + ': ' + JSON.stringify(e));
            syllableArray = [answer];
            syllableGenerationError = e;
          }
          Items.upsert({_id: stim._id}, { $set: {syllables: syllableArray}})
        }
      }
      serverConsole('after updateStimSyllables');
      serverConsole(stimSetId);
    }
  },

  getClozeEditAuthors: function() {
    const authorIDs = {};
    ClozeEditHistory.find({}).forEach(function(entry) {
      authorIDs[entry.user] = Meteor.users.findOne({_id: entry.user})?.username || undefined;
    });
    return authorIDs;
  },

  sendErrorReportSummaries: function() {
    sendErrorReportSummaries();
  },
  sendEmail: function(to, from, subject, text) {
    this.unblock();
    sendEmail(to, from, subject, text);
  },

  sendPasswordResetEmail: function(email){
    console.log ("sending password reset code for ", email)
    //Generate Code
    var secret = '';
    var length = 5;
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    Meteor.users.findOne({username: email})
    for ( var i = 0; i < length; i++ ) {
      secret += characters.charAt(Math.floor(Math.random() * charactersLength));
    }  
    Meteor.users.update({username: email},{
      $set:{
        secret: secret
      }
    });
    
    //Setup email variables
    const ownerEmail = Meteor.settings.owner;
    const from = ownerEmail;
    const subject = 'MoFaCTs Password Reset';
    let text = 'Your password reset secret is: <b>' + secret + "</b>.<br>If this email was sent in error, please contact your MoFaCTs administrator.";

    //Send email
    sendEmail(email,from,subject,text);
  },

  checkPasswordResetSecret: function(email, secret){
    userSecret = Meteor.users.findOne({username: email}).secret;
    if(userSecret == secret){
      return true;
    } else {
      return false;
    }
  },

  resetPasswordWithSecret: function(email, secret, newPassword){
    user = Meteor.users.findOne({username: email});
    userId = user._id;
    userSecret = user.secret;
    if(secret == userSecret){
      Accounts.setPassword(userId, newPassword);
      return true;
    } else {
      return false;
    }        
  },
  sendUserErrorReport: function(userID, description, curPage, sessionVars, userAgent, logs, currentExperimentState) {
    const errorReport = {
      user: userID,
      description: description,
      page: curPage,
      time: new Date(),
      sessionVars: sessionVars,
      userAgent: userAgent,
      logs: logs,
      currentExperimentState: currentExperimentState,
      emailed: false,
    };
    return ErrorReports.insert(errorReport);
  },

  logUserAgentAndLoginTime: function(userID, userAgent) {
    const loginTime = new Date();
    return Meteor.users.update({_id: userID}, {$set: {status: {lastLogin: loginTime, userAgent: userAgent}}});
  },

  insertClozeEditHistory: function(history) {
    ClozeEditHistory.insert(history);
  },

  getClozesAndSentencesForText: function(rawText) {
    serverConsole('rawText!!!: ' + rawText);
    // eslint-disable-next-line new-cap
    return clozeGeneration.GetClozeAPI(null, null, null, rawText);
  },

  serverLog: function(data) {
    if (Meteor.user()) {
      const logData = 'User:' + Meteor.user()._id + ', log:' + data;
      serverConsole(logData);
    }
  },

  // Functionality to create a new user ID: return null on success. Return
  // an array of error messages on failure. If previous OK is true, then
  // we silently skip duplicate users (this is mainly for experimental
  // participants who are created on the fly)
  signUpUser: function(newUserName, newUserPassword, previousOK) {
    serverConsole('signUpUser', newUserName, 'previousOK == ', previousOK);

    if (!newUserName) {
      throw new Error('Blank user names aren\'t allowed');
    } else {
      const prevUser = Accounts.findUserByUsername(newUserName);
      if (prevUser) {
        if (previousOK) {
          // Older accounts from turk users are having problems with
          // passwords - so when we detect them, we automatically
          // change the password
          Accounts.setPassword(prevUser._id, newUserPassword);
          return prevUser._id; // User has already been created - nothing to do
        } else {
          throw new Error('User is already in use');
        }
      }
    }

    if (!newUserPassword || newUserPassword.length < 6) {
      throw new Error('Passwords must be at least 6 characters long');
    }
    

    // Now we can actually create the user
    // Note that on the server we just get back the ID and have nothing
    // to do right now. Also note that this method is called for creating
    // NON-google user accounts (which should generally just be experiment
    // participants) - so we make sure to set an initial profile
    const createdId = Accounts.createUser({
      'email': newUserName,
      'username': newUserName,
      'password': newUserPassword,
      'profile': {
        'experiment': !!previousOK,
      },
    });
    if (!createdId) {
      throw new Error('Unknown failure creating user account');
    }

    // Now we need to create a default user profile record
    userProfileSave(createdId, defaultUserProfile());

    // Remember we return a LIST of errors, so this is success
    return createdId;
  },

  //Impersonate User
  impersonate: function(userId) {
    check(userId, String);
    if (!Meteor.users.findOne(userId))
      throw new Meteor.Error(404, 'User not found');
      Meteor.users.update(this.userId, { $set: { 'profile.impersonating': userId }});
       this.setUserId(userId);
  },

  clearImpersonation: function(){
    Meteor.users.update(this.userId, { $set: { 'profile.impersonating': false }});
    return;
  },
  // We provide a separate server method for user profile info - this is
  // mainly since we don't want some of this data just flowing around
  // between client and server
  saveUserProfileData: async function(profileData) {
    serverConsole('saveUserProfileData', displayify(profileData));

    let saveResult; let result; let errmsg; let acctBal;
    try {
      const data = _.extend(defaultUserProfile(), profileData);

      // Check length BEFORE any kind of encryption
      data.have_aws_id = data.aws_id.length > 0;
      data.have_aws_secret = data.aws_secret_key.length > 0;

      data.aws_id = encryptUserData(data.aws_id);
      data.aws_secret_key = encryptUserData(data.aws_secret_key);

      saveResult = userProfileSave(Meteor.userId(), data);

      // We test by reading the profile back and checking their
      // account balance
      const res = await turk.getAccountBalance(
          UserProfileData.findOne({_id: Meteor.user()._id}),
      );

      if (!res) {
        throw new Error('There was an error reading your account balance');
      }

      result = true;
      acctBal = res.AvailableBalance;
      errmsg = '';
      return {
        'result': result,
        'saveResult': saveResult,
        'acctBal': acctBal,
        'error': errmsg,
      };
    } catch (e) {
      result = false;
      serverConsole(e);
      errmsg = e;
    }
  },

  getUserSpeechAPIKey: function() {
    const speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
    if (speechAPIKey) {
      return decryptUserData(speechAPIKey['key']);
    } else {
      return null;
    }
  },

  isUserSpeechAPIKeySetup: function() {
    const speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
    return !!speechAPIKey;
  },

  saveUserSpeechAPIKey: function(key) {
    key = encryptUserData(key);
    let result = true;
    let error = '';
    const userID = Meteor.userId();
    try {
      // Insure record matching ID is present while working around MongoDB 2.4 bug
      GoogleSpeechAPIKeys.update({_id: userID}, {'$set': {'preUpdate': true}}, {upsert: true});
    } catch (e) {
      serverConsole('Ignoring user speech api key upsert ', e);
    }
    const numUpdated = GoogleSpeechAPIKeys.update({_id: userID}, {key: key});

    // WHOOOPS! If we're still here something has gone horribly wrong
    if (numUpdated < 1) {
      result = false;
      error = 'No records updated by save';
    } else if (numUpdated > 1) {
      result = false;
      error = 'More than one record updated?! ' + _.display(numUpdated);
    }

    return {
      'result': result,
      'error': error,
    };
  },

  deleteUserSpeechAPIKey: function() {
    const userID = Meteor.userId();
    GoogleSpeechAPIKeys.remove(userID);
  },

  // ONLY FOR ADMINS: for the given targetUserId, perform roleAction (add
  // or remove) vs roleName
  userAdminRoleChange: function(targetUserId, roleAction, roleName) {
    serverConsole('userAdminRoleChange', targetUserId, roleAction, roleName);
    const usr = Meteor.user();
    if (!Roles.userIsInRole(usr, ['admin'])) {
      throw new Error('You are not authorized to do that');
    }

    targetUserId = _.trim(targetUserId);
    roleAction = _.trim(roleAction).toLowerCase();
    roleName = _.trim(roleName);

    if (targetUserId.length < 1) {
      throw new Error('Invalid: blank user ID not allowed');
    }
    if (!_.contains(['add', 'remove'], roleAction)) {
      throw new Error('Invalid: unknown requested action');
    }
    if (!_.contains(['admin', 'teacher'], roleName)) {
      throw new Error('Invalid: unknown requested role');
    }

    const targetUser = Meteor.users.findOne({_id: targetUserId});
    if (!targetUser) {
      throw new Error('Invalid: could not find that user');
    }

    const targetUsername = _.prop(targetUser, 'username');

    if (roleAction === 'add') {
      Roles.addUsersToRoles(targetUserId, [roleName]);
      createUserSecretKey(targetUserId);
    } else if (roleAction === 'remove') {
      Roles.removeUsersFromRoles(targetUserId, [roleName]);
      removeUserSecretKey(targetUserId);
    } else {
      throw new Error('Serious logic error: please report this');
    }

    return {
      'RESULT': 'SUCCESS',
      'targetUserId': targetUserId,
      'targetUsername': targetUsername,
      'roleAction': roleAction,
      'roleName': roleName,
    };
  },

  saveUsersFile: function(filename, filecontents) {
    serverConsole('saveUsersFile: ' + filename);
    const allErrors = [];
    let rows = Papa.parse(filecontents).data;
    serverConsole(rows);
    rows = rows.slice(1);
    for (const index in rows) {
      const row = rows[index];
      serverConsole(row);
      const username = row[0];
      const password = row[1];
      serverConsole('username: ' + username + ', password: ' + password);
      Meteor.call('signUpUser', username, password, true, function(error, result) {
        if (error) {
          allErrors.push({username: error});
        }
      });
    }
    serverConsole('allErrors: ' + JSON.stringify(allErrors));
    return allErrors;
  },

  //handle file deletions
  deleteStimFile: async function(stimFilename) {
    serverConsole('delete Stim File', stimFilename);
    stimSet = await getStimuliSetByFilename(stimFilename);
    stimSetId = stimSet[0].stimuliSetId;
    const query1 = 'SELECT tdfid FROM tdf WHERE stimulisetid = $1';
    //Postgres Reversion
    //tdfIds = await db.manyOrNone(query1, [stimSetId]);
    tdfIds = TDFs.find({stimulisetid: stimSetId});
    for(i=0; i < tdfIds.length; i++){
        tdf = tdfIds[i].tdfid;
        //Postgres Reversion
        //const querya = 'DELETE FROM globalexperimentstate WHERE TDFId=$1'
        GlobalExperimentStates.remove({TDFId: tdf});
        //await db.none(querya, [tdf]);
        //Postgres Reversion
        //const queryb = 'DELETE FROM componentstate WHERE tdfid = $1'
        //await db.none(queryb, [tdf]);
        ComponentStates.remove({TDFId: tdf});
        //Postgres Reversion
        //const queryc = 'DELETE FROM assignment WHERE tdfid = $1'
        //await db.none(queryc, [tdf]);
        Assignments.remove({TDFId: tdf});
        //Postgres Reversion
        //const queryd = 'DELETE FROM history WHERE tdfid = $1'
        //await db.none(queryd, [tdf]);
        Histories.remove({TDFId: tdf});
    }
    //Postgres Reversion
    // const query2 = 'DELETE FROM item WHERE stimulusFileName = $1';
    // await db.none(query2, [stimFilename]);
    Items.remove({stimulusFileName: stimFilename});
    //Postgres Reversion
    // const query3 = 'DELETE FROM tdf WHERE stimulisetid = $1';
    // await db.none(query3, [stimSetId]);
    Tdfs.remove({stimulisetid: stimSetId});
    res = "Stim and related TDFS deleted.";
    return res;
  },

  deleteTDFFile: async function(tdfFileName){
    serverConsole("Remove TDF File:", tdfFileName);
    const toRemove = await getTdfByFileName(tdfFileName);
    serverConsole(toRemove);
    if(toRemove.TDFId){
      tdf = toRemove.TDFId;
      //Postgres Reversion
      // const querya = 'DELETE FROM componentstate WHERE tdfid = $1'
      // await db.none(querya, [tdf]);
      ComponentStates.remove({TDFId: tdf});
      //Postgres Reversion
      // const queryb = 'DELETE FROM assignment WHERE tdfid = $1'
      Assignments.remove({TDFId: tdf});
      //Postgres Reversion
      // const queryc = 'DELETE FROM history WHERE tdfid = $1'
      // await db.none(queryc, [tdf]);
      Histories.remove({TDFId: tdf});
      //Postgres Reversion
      // const query2 = 'DELETE FROM globalexperimentstate WHERE TDFId=$1'
      // await db.none(query2, [toRemove.TDFId]);
      GlobalExperimentStates.remove({TDFId: tdf});
      //Postgres Reversion
      // const query1 = 'DELETE FROM tdf WHERE TDFId=$1';
      // await db.none(query1, [toRemove.TDFId]);
      Tdfs.remove({TDFId: tdf});
    } else {
      result = 'No matching tdf file found';
      return result;
    }
    result = "TDF deleted";
    return result;
  },

  // Allow file uploaded with name and contents. The type of file must be
  // specified - current allowed types are: 'stimuli', 'tdf'
  saveContentFile: async function(type, filename, filecontents) {
    serverConsole('saveContentFile', type, filename);
    const results = {
      'result': null,
      'errmsg': 'No action taken?',
      'action': 'None',
    };
    if (!type) throw new Error('Type required for File Save');
    if (!filename) throw new Error('Filename required for File Save');
    if (!filecontents) throw new Error('File Contents required for File Save');

    // We need a valid use that is either admin or teacher
    const ownerId = Meteor.user()._id;
    if (!ownerId) {
      throw new Error('No user logged in - no file upload allowed');
    }
    if (!Roles.userIsInRole(Meteor.user(), ['admin', 'teacher'])) {
      throw new Error('You are not authorized to upload files');
    }
    if (type != 'tdf' && type != 'stim') {
      throw new Error('Unknown file type not allowed: ' + type);
    }

    try {
      if (type == 'tdf') {
        const jsonContents = JSON.parse(filecontents);
        const json = {tutor: jsonContents.tutor};
        const lessonName = _.trim(jsonContents.tutor.setspec.lessonname);
        if (lessonName.length < 1) {
          results.result = false;
          results.errmsg = 'TDF has no lessonname - it cannot be valid';

          return results;
        }
        const stimFileName = json.tutor.setspec.stimulusfile ? json.tutor.setspec.stimulusfile : 'INVALID';
        if (stimFileName == 'INVALID') {
          // Note this means root tdfs will have NULL stimulisetid
          results.result = false;
          results.errmsg = 'Please upload stimulus file before uploading a TDF';

          return results;
        } else {
          //Postgres Reversion
          // const query = 'SELECT stimuliSetId FROM item WHERE stimulusFileName = $1 LIMIT 1';
          // const associatedStimSetIdRet = await db.oneOrNone(query, stimFileName);
          const associatedStimSetIdRet = Items.findOne({stimulusFileName: stimFileName});
          const stimuliSetId = associatedStimSetIdRet ? associatedStimSetIdRet.stimuliSetId : null;
          if (isEmpty(stimuliSetId)) {
            results.result = false;
            results.errmsg = 'Please upload stimulus file before uploading a TDF';
          } else {
            try {
              const rec = {'fileName': filename, 'tdfs': json, 'ownerId': ownerId, 'source': 'upload'};
              await upsertTDFFile(filename, rec, ownerId);
              //Update Stim Cache every upload
              Meteor.call('updateStimSyllables', stimuliSetId);
              results.result = true;
            } catch (err) {
              results.result=false;
              results.errmsg=err.toString();
            }
          }
          return results;
        }
      } else if (type === 'stim') {
        const jsonContents = JSON.parse(filecontents);
        await upsertStimFile(filename, jsonContents, ownerId);
        results.data = jsonContents;
      }
    } catch (e) {
      serverConsole('ERROR saving content file:', e, e.stack);
      results.result = false;
      results.errmsg = JSON.stringify(e);
      return results;
    }

    results.result = true;
    results.errmsg = '';

    return results;
  },

  updatePerformanceData: function(type, codeLocation, userId) {
    const timestamp = new Date();
    const record = {userId, timestamp, codeLocation};
    switch (type) {
      case 'login':
        LoginTimes.insert(record);
        break;
      case 'utlQuery':
        UtlQueryTimes.insert(record);
        break;
    }
  },

  isSystemDown: function() {
    const curConfig = DynamicConfig.findOne({});
    return curConfig.isSystemDown;
  },

  isCurrentServerLoadTooHigh: function() {
    const last50Logins = LoginTimes.find({}, {sort: {$natural: -1}, limit: 50});
    const last50UtlQueries = UtlQueryTimes.find({}, {sort: {$natural: -1}, limit: 50}).fetch();
    const curConfig = DynamicConfig.findOne({});
    const {loginsWithinAHalfHourLimit, utlQueriesWithinFifteenMinLimit} = curConfig.serverLoadConstants;// 10,8

    const loginsWithinAHalfHour = new Set();
    let utlQueriesWithinFifteenMin = [];
    const now = new Date();
    const thirtyMinAgo = new Date(now - (30*60*1000)); // Down from an hour to 30 min
    const fifteenMinAgo = new Date(now - (15*60*1000)); // Up from 5 min to 15 min

    for (const loginData of last50Logins) {
      if (loginData.timestamp > thirtyMinAgo) {
        loginsWithinAHalfHour.add(loginData.userId);
      }
    }

    utlQueriesWithinFifteenMin = last50UtlQueries.filter((x) => x.timestamp > fifteenMinAgo);
    const currentServerLoadIsTooHigh = (loginsWithinAHalfHour.size > loginsWithinAHalfHourLimit ||
          utlQueriesWithinFifteenMin.length > utlQueriesWithinFifteenMinLimit);

    serverConsole('isCurrentServerLoadTooHigh:' + currentServerLoadIsTooHigh + ', loginsWithinAHalfHour:' +
        loginsWithinAHalfHour.size + '/' + loginsWithinAHalfHourLimit + ', utlQueriesWithinFifteenMin:' +
        utlQueriesWithinFifteenMin.length + '/' + utlQueriesWithinFifteenMinLimit);

    return currentServerLoadIsTooHigh;
  },

  // Let client code send console output up to server
  debugLog: function(logtxt) {
    let usr = Meteor.user();
    if (!usr) {
      usr = '[No Current User]';
    } else {
      usr = usr.username ? usr.username : usr._id;
      usr = '[USER:' + usr + ']';
    }

    serverConsole(usr + ' ' + logtxt);
  },

  toggleTdfPresence: async function(tdfIds, mode) {
    tdfIds.forEach((tdfid) => {
      Tdfs.update({_id: tdfid}, {$set: {visibility: mode}})
    })
  },

  getTdfOwnersMap: (ownerIds) => {
    const ownerMap = {};
    ownerIds.forEach((id) => {
      const foundUser = Meteor.users.findOne({_id: id});
      if (typeof(foundUser) != 'undefined') {
        ownerMap[id] = foundUser.username;
      }
    });
    return ownerMap;
  },
});

Meteor.startup(async function() {
  Tdfs = new Meteor.Collection('tdfs')
  Assignments = new Meteor.Collection('assessments');
  ComponentStates = new Meteor.Collection('component_state');
  Courses = new Meteor.Collection('course');
  GlobalExperimentStates = new Meteor.Collection('global_experiment_state');
  Histories = new Meteor.Collection('history');
  Items = new Meteor.Collection('stimuli');
  itemSourceSentences = new Meteor.Collection('item_source_sentences');
  Sections = new Meteor.Collection('section');
  SectionUserMap = new Meteor.Collection('section_user_map');
  // await migration();
  // await migration2();
  // Let anyone looking know what config is in effect
  serverConsole('Log Notice (from siteConfig):', getConfigProperty('logNotice'));

  // Force our OAuth settings to be current
  ServiceConfiguration.configurations.remove({'service': 'google'});
  serverConsole('Removed Google service config - rewriting now');

  const google = getConfigProperty('google');
  ServiceConfiguration.configurations.insert({
    'service': 'google',
    'clientId': _.prop(google, 'clientId'),
    'secret': _.prop(google, 'secret'),
  });
  serverConsole('Rewrote Google service config');

  // Figure out the "prime admin" (owner of repo TDF/stim files)
  // Note that we accept username or email and then find the ID
  const adminUser = findUserByName(getConfigProperty('owner'));

  // Used below for ownership
  const adminUserId = _.prop(adminUser, '_id') || '';
  // adminUser should be in an admin role
  if (adminUserId) {
    Roles.addUsersToRoles(adminUserId, 'admin');
    serverConsole('Admin User Found ID:', adminUserId, 'with obj:', _.pick(adminUser, '_id', 'username', 'email'));
  } else {
    serverConsole('Admin user ID could not be found. adminUser=', displayify(adminUser || 'null'));
    serverConsole('ADMIN USER is MISSING: a restart might be required');
    serverConsole('Make sure you have a valid siteConfig');
    serverConsole('***IMPORTANT*** There will be no owner for system TDF\'s');
  }

  // Get user in roles and make sure they are added
  const roles = getConfigProperty('initRoles');
  const roleAdd = function(memberName, roleName) {
    const requested = _.prop(roles, memberName) || [];
    serverConsole('Role', roleName, '- found', _.prop(requested, 'length'));

    _.each(requested, function(username) {
      const user = findUserByName(username);
      if (!user) {
        serverConsole('Warning: user', username, 'role', roleName, 'request, but user not found');
        return;
      }
      Roles.addUsersToRoles(user._id, roleName);
      serverConsole('Added user', username, 'to role', roleName);
    });
  };

  roleAdd('admins', 'admin');
  roleAdd('teachers', 'teacher');
  //const ret = await db.oneOrNone('SELECT COUNT(*) FROM tdf');
  const ret = Tdfs.find().count();
  if (ret.count == 0) loadStimsAndTdfsFromPrivate(adminUserId);

  // Make sure we create a default user profile record when a new Google user
  // shows up. We still want the default hook's 'profile' behavior, AND we want
  // our custom user profile collection to have a default record
  Accounts.onCreateUser(function(options, user) {
    // Little display helper
    const dispUsr = function(u) {
      return _.pick(u, '_id', 'username', 'emails', 'profile');
    };

    // Default profile save
    userProfileSave(user._id, defaultUserProfile());

    // Default hook's behavior
    if (options.profile) {
      user.profile = _.extend(user.profile || {}, options.profile);
    }

    if (_.prop(user.profile, 'experiment')) {
      serverConsole('Experiment participant user created:', dispUsr(user));
      return user;
    }

    // Set username and an email address from the google service info
    // We use the lowercase email for both username and email
    const email = _.chain(user)
        .prop('services')
        .prop('google')
        .prop('email').trim()
        .value().toLowerCase();
    if (!email) {
      // throw new Meteor.Error("No email found for your Google account");
    }

    if (email) {
      user.username = email;
      user.emails = [{
        'address': email,
        'verified': true,
      }];
    }

    serverConsole('Creating new Google user:', dispUsr(user));

    // If the user is initRoles, go ahead and add them to the roles.
    // Unfortunately, the user hasn't been created... so we need to actually
    // cheat a little and manipulate the user record as if we were the roles
    // code. IMPORTANT: a new version of alanning:roles could break this.
    user.roles = [];
    const roles = getConfigProperty('initRoles');
    const addIfInit = function(initName, roleName) {
      const initList = _.prop(roles, initName) || [];
      if (_.contains(initList, user.username)) {
        serverConsole('Adding', user.username, 'to', roleName);
        user.roles.push(roleName);
      }
    };

    addIfInit('admins', 'admin');
    addIfInit('teachers', 'teacher');

    userIdToUsernames[user._id] = user.username;
    usernameToUserIds[user.username] = user._id;

    return user;
  });

  // Set the global logout time for all users
  Accounts.config({
    loginExpirationInDays: 90
  })

  // Create any helpful indexes for queries we run
  ScheduledTurkMessages._ensureIndex({'sent': 1, 'scheduled': 1});

  // Start up synched cron background jobs
  SyncedCron.start();

  // Now check for messages to send every 5 minutes
  SyncedCron.add({
    name: 'Period Email Sent Check',
    schedule: function(parser) {
      return parser.text('every 5 minutes');
    },
    job: function() {
      return sendScheduledTurkMessages();
    },
  });

  SyncedCron.add({
    name: 'Send Error Report Summaries',
    schedule: function(parser) {
      return parser.text('at 3:00 pm');
    },
    job: function() {
      return sendErrorReportSummaries();
    },
  });
});

Router.route('/dynamic-assets/:tdfid?/:filetype?/:filename?', {
  name: 'dynamic-asset',
  where: 'server',
  action: function() {
    let filename = this.params.filename;
    let filetype = this.params.filetype; //should only be image or audio
    let path = this.url;
    let extension = filename.split('.')[1];

    if (this.url.includes('..')){ //user is trying to do some naughty stuff
      this.response.writeHead('404');
      this.response.end();
      return;
    }

    this.response.writeHeader('200', {
      'Content-Type': `${filetype}/${extension}`
    })
    let content;

    if (filetype == 'image'){
      if(isProd){
        serverConsole(`loading image from ${process.env.HOME + path}`)
        content = fs.readFileSync(process.env.HOME + path)
      }
      else{
        serverConsole(`loading image from ${process.env.PWD + '/..' + path}`)
        try{
          content = fs.readFileSync(process.env.PWD + '/..' + path)
        }
        catch(e){
          serverConsole(e);
        }
      }
    }
    else if (filetype == 'audio'){
      if(isProd){
        serverConsole(`loading audio from ${process.env.HOME + path}`)
        content = fs.readFileSync(process.env.HOME + path)
      }
      else{
        serverConsole(`loading audio from ${process.env.PWD + '/..' + path}`)
        try{
          content = fs.readFileSync(process.env.PWD + '/..' + path)
        }
        catch(e){
          serverConsole(e);
        }
      }
    }
    this.response.write(content);
    this.response.end();
  }
});
// Serves data file containing all TDF data for single teacher
Router.route('data-by-teacher', {
  name: 'server.teacherData',
  where: 'server',
  path: '/data-by-teacher/:uid',
  action: async function() {
    console.time('data-by-teacher')
    const userId = this.request.headers['x-user-id'];
    const loginToken = this.request.headers['x-auth-token'];
    const uid = this.params.uid;
    const response = this.response;
    
    if(!userId || !loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }
    else if (!uid) {
      response.writeHead(404);
      response.end('No user ID specified');
      return;
    }

    const tdfNames = await getTdfNamesAssignedByInstructor(uid);

    if (!tdfNames.length > 0) {
      response.writeHead(404);
      response.end('No tdfs found for any classes');
      return;
    }

    const user = Meteor.users.findOne({'_id': uid});
    let userName = user.username;
    // eslint-disable-next-line no-useless-escape
    userName = userName.replace('/[/\\?%*:|"<>\s]/g', '_');

    const fileName = 'mofacts_' + userName + '_all_tdf_data.txt';

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    for(tdfName of tdfNames){
      response.write(await createExperimentExport(tdfName));
      response.write('\r\n');
    }

    tdfNames.forEach(function(tdf) {
      serverConsole('Sent all  data for', tdf, 'as file', fileName);
    });
    console.timeEnd('data-by-teacher')
    response.end('');
  },
});

// Serves data file containing all TDF data for all classes for a teacher
Router.route('data-by-class', {
  name: 'server.classData',
  where: 'server',
  path: '/data-by-class/:classid/',
  action: async function() {
    const userId = this.request.headers['x-user-id'];
    const loginToken = this.request.headers['x-auth-token'];
    const classId = this.params.classid;
    const response = this.response;
    
    if(!userId || !loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }
    else if (Meteor.users.findOne({_id: userId}).secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }
    else if (!classId) {
      response.writeHead(404);
      response.end('No class ID specified');
      return;
    }
    else if (!classId) {
      throw new Meteor.Error('No class ID specified');
    }

    const foundClass = await getCourseById(classId);

    if (!foundClass) {
      response.writeHead(404);
      response.end('No classes found for the specified class ID');
      return;
    }

    const tdfFileNames = await getTdfAssignmentsByCourseIdMap(classId);

    if (!tdfFileNames || tdfFileNames.length == 0) {
      response.writeHead(404);
      response.end('No tdfs found for any classes');
      return;
    }

    // eslint-disable-next-line no-useless-escape
    const className = foundClass.coursename.replace('/[/\\?%*:|"<>\s]/g', '_');
    const fileName = 'mofacts_' + className + '_all_class_data.txt';

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    for(tdfName of tdfFileNames){
      response.write(await createExperimentExport(tdfName));
      response.write('\r\n');
    }

    tdfFileNames.forEach(function(tdf) {
      serverConsole('Sent all  data for', tdf, 'as file', fileName, 'with record-count:', recCount);
    });

    response.end('');
  },
});

// We use a special server-side route for our experimental data download
Router.route('data-by-file', {
  name: 'server.data',
  where: 'server',
  path: '/data-by-file/:exp',
  action: async function() {
    const userId = this.request.headers['x-user-id'];
    const loginToken = this.request.headers['x-auth-token'];
    const exp = this.params.exp;
    const response = this.response;
    let path = this.url;
    
    if(!userId || !loginToken){
      response.writeHead('403');
      response.end();
    }
    else if (Meteor.users.findOne({_id: userId}).secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }
    else if (path.includes('..')){ //user is trying to do some naughty stuff
      response.writeHead('404');
      response.end();
      return;
    }
    else if (!exp) {
      response.writeHead(404);
      response.end('No experiment specified');
      return;
    }

    const fileName = exp.split('.json')[0] + '-data.txt';;

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    response.write(await createExperimentExport(exp));
    response.end('');

    serverConsole('Sent all  data for', exp, 'as file', fileName);
  }
});

Router.route('clozeEditHistory', {
  name: 'server.clozeData',
  where: 'server',
  path: '/clozeEditHistory/:uid',
  action: function() {
    const userId = this.request.headers['x-user-id'];
    const loginToken = this.request.headers['x-auth-token'];
    const uid = this.params.uid;
    const response = this.response;
    
    if(!userId || !loginToken){
      response.writeHead('403');
      response.end();
    }
    else if (Meteor.users.findOne({_id: userId}).secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }
    else if (!uid) {
      response.writeHead(404);
      response.end('No user id specified');
      return;
    }
    const filename = uid + '-clozeEditHistory.json';

    response.writeHead(200, {
      'Content-Type': 'application/json',
      'File-Name': filename
    });

    let recCount = 0;
    ClozeEditHistory.find({'user': uid}).forEach(function(record) {
      recCount += 1;
      response.write(JSON.stringify(record));
      response.write('\r\n');
    });
    response.end('');

    serverConsole('Sent all  data for', uid, 'as file', filename, 'with record-count:', recCount);
  },
});
