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
import {getItem, getComponentState, getCourse, getTdf} from './orm';
import { FilesCollection } from 'meteor/ostrio:files';


export {
  getTdfByFileName,
  getTdfBy_id,
  getHistoryByTDFfileName,
  getListOfStimTags,
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
  console.log('dev environment, allow insecure tls');
}

process.env.MAIL_URL = Meteor.settings.MAIL_URL;
const adminUsers = Meteor.settings.initRoles.admins;
const ownerEmail = Meteor.settings.owner;
const isProd = Meteor.settings.prod || false;
console.log('isProd: ' + isProd);

const thisServerUrl = Meteor.settings.ROOT_URL;
console.log('thisServerUrl: ' + thisServerUrl);

const altServerUrl = Meteor.settings.ALT_URL;
console.log('altServerUrl: ' + altServerUrl);

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
  console.log('reading SAML settings');
  for (let i = 0; i < Meteor.settings.saml.length; i++) {
    // privateCert is weird name, I know. spCert is better one. Will need to refactor
    if (Meteor.settings.saml[i].privateKeyFile && Meteor.settings.saml[i].publicCertFile) {
      console.log('Set keys/certs for ' + Meteor.settings.saml[i].provider);
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
      console.log('No keys/certs found for ' + Meteor.settings.saml[i].provider);
    }
  }
}

if (Meteor.settings.definitionalFeedbackDataLocation) {
  console.log('reading feedbackdata');
  const feedbackData = fs.readFileSync(Meteor.settings.definitionalFeedbackDataLocation);
  console.log('initializing feedback');
  // eslint-disable-next-line new-cap
  DefinitionalFeedback.Initialize(feedbackData);
}

const feedbackCacheMap = {};
if (Meteor.settings.elaboratedFeedbackDataLocation) {
  console.log('initializing elaborated feedback');
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
    StimSyllables.find({}),
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
    const tdfsRet = await db.any('SELECT content -> \'fileName\' AS filename from tdf');
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
  const ret = await db.many('SELECT * FROM tdf WHERE stimulisetid =$1', stimuliSetId);
  const shortFileName = fileName.replace('.json', '').replace('.xml', '');
  for(let tdf in ret){
    serverConsole("fileName param : " + fileName + " | fileName querey: " + ret[tdf].content.fileName);
    if (ret[tdf].content.fileName.includes(shortFileName)){
      return ret[tdf].tdfid;
    }
  }
}

async function getTdfById(TDFId) {
  const tdfs = await db.one('SELECT * from tdf WHERE TDFId=$1', TDFId);
  const tdf = getTdf(tdfs);
  return tdf;
}

// eslint-disable-next-line camelcase
async function getTdfBy_id(_id) {
  try {
    const queryJSON = {'_id': _id};
    const tdfs = await db.one('SELECT * from tdf WHERE content @> $1' + '::jsonb', [queryJSON]);
    const tdf = getTdf(tdfs);
    return tdf;
  } catch (e) {
    console.log('getTdfBy_id ERROR,', _id, ',', e);
    return null;
  }
}

async function getTdfByFileName(filename) {
  try {
    const queryJSON = {'fileName': filename};
    const tdfs = await db.oneOrNone('SELECT * from tdf WHERE content @> $1::jsonb', [queryJSON]);
    if (!tdfs) {
      return null;
    }
    const tdf = getTdf(tdfs);
    return tdf;
  } catch (e) {
    console.log('getTdfByFileName ERROR,', filename, ',', e);
    return null;
  }
}

async function getTdfByExperimentTarget(experimentTarget) {
  try {
    console.log('getTdfByExperimentTarget:'+experimentTarget);
    const queryJSON = {'tdfs': {'tutor': {'setspec': {'experimentTarget': experimentTarget}}}};
    const tdfs = await db.one('SELECT * from tdf WHERE content @> $1' + '::jsonb', [queryJSON]);
    const tdf = getTdf(tdfs);
    return tdf;
  } catch (e) {
    console.log('getTdfByExperimentTarget ERROR,', experimentTarget, ',', e);
    return null;
  }
}

async function getAllTdfs() {
  console.log('getAllTdfs');
  const tdfsRet = await db.any('SELECT * from tdf');
  const tdfs = [];
  for (const tdf of tdfsRet) {
    tdfs.push(getTdf(tdf));
  }
  return tdfs;
}

async function getAllStims() {
  console.log('getAllStims');
  const stimRet = await db.any('SELECT DISTINCT(stimulusfilename), stimulisetid FROM item;')
  const stims = [];
  for (const stim of stimRet){
    stims.push(stim);
  }
  return stims;
}

async function getStimuliSetsForIdSet(stimuliSetIds) {
  const stimSetsStr = stimuliSetIds.join(',');
  const query = 'SELECT * FROM ITEM WHERE stimuliSetId IN (' + stimSetsStr + ') ORDER BY itemId';
  const stimSets = await db.many(query);
  const ret = [];
  for (const stim of stimSets) {
    ret.push(getItem(stim));
  }
  return ret;
}

async function getProbabilityEstimatesByKCId(relevantKCIds) { // {clusterIndex:[stimKCId,stimKCId],...}
  const clusterQuery = 'SELECT array_agg(probabilityEstimate ORDER BY eventId) AS probabilityEstimates \
    FROM history WHERE KCId = ANY($1) AND probabilityEstimate IS NOT NULL';
  const clusterProbs = {};
  let individualStimKCs = [];
  // eslint-disable-next-line guard-for-in
  for (const clusterIndex in relevantKCIds) {
    const clusterKCs = relevantKCIds[clusterIndex];
    const ret = await db.oneOrNone(clusterQuery, [clusterKCs]);
    clusterProbs[clusterIndex] = ret.probabilityestimates;
    individualStimKCs = individualStimKCs.concat(clusterKCs);
  }
  const query = 'SELECT KCId, array_agg(probabilityEstimate ORDER BY eventId) AS probabilityEstimates \
    FROM history WHERE KCId = ANY($1) AND probabilityEstimate IS NOT NULL GROUP BY KCId';
  const ret = await db.manyOrNone(query, [individualStimKCs]);
  const individualStimProbs = {};
  for (const pair of ret) {
    individualStimProbs[pair.kcid] = pair.probabilityestimates;
  }
  return {clusterProbs, individualStimProbs};
}

// by currentTdfId, not currentRootTDFId
async function getOutcomeHistoryByUserAndTDFfileName(userId, TDFfileName) {
  const tdfRet = await db.one('SELECT TDFId from tdf WHERE content @> $1' + '::jsonb', {'fileName': TDFfileName});
  const TDFId = tdfRet[0].tdfid;
  const query = 'SELECT array_agg(outcome) AS outcomeHistory FROM history \
    WHERE userId=$1 AND TDFId=$2 GROUP BY TDFId ORDER BY eventId';
  const ret = await db.manyOrNone(query, [userId, TDFId]);
  return {outcomeHistory: ret.outcomehistory};
}

async function getReponseKCMap() {
  const responseKCStuff = await db.manyOrNone('SELECT DISTINCT correctResponse, responseKC FROM item');
  const responseKCMap = {};
  for (const row of responseKCStuff) {
    const correctresponse = row.correctresponse;
    const responsekc = row.responsekc;

    const answerText = getDisplayAnswerText(correctresponse);
    responseKCMap[answerText] = responsekc;
  }

  return responseKCMap;
}

// by currentTdfId, not currentRootTDFId
async function getComponentStatesByUserIdTDFIdAndUnitNum(userId, TDFId) {
  const query = 'SELECT * FROM componentState WHERE userId = $1 AND TDFId = $2 ORDER BY componentStateId';
  const componentStatesRet = await db.manyOrNone(query, [userId, TDFId]);
  const componentStates = [];
  for (const componentState of componentStatesRet) {
    componentStates.push(getComponentState(componentState));
  }
  return componentStates;
}

async function setComponentStatesByUserIdTDFIdAndUnitNum(userId, TDFId, componentStates, hintLevel) {
  serverConsole('setComponentStatesByUserIdTDFIdAndUnitNum, ', userId, TDFId);
  const res = await db.tx(async (t) => {
    const responseKCMap = await getReponseKCMap();
    const newResponseKCRet = await t.one('SELECT MAX(responseKC) AS responseKC from ITEM');
    let newResponseKC = newResponseKCRet.responsekc + 1;
    const resArr = [];

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

      const updateQuery = 'UPDATE componentstate SET probabilityEstimate=${probabilityEstimate}, \
        firstSeen=${firstSeen}, lastSeen=${lastSeen}, trialsSinceLastSeen=${trialsSinceLastSeen}, \
        priorCorrect=${priorCorrect}, priorIncorrect=${priorIncorrect}, \
        priorStudy=${priorStudy}, totalPracticeDuration=${totalPracticeDuration}, outcomeStack=${outcomeStack} \
        WHERE userId=${userId} AND TDFId=${TDFId} AND KCId=${KCId} AND componentType=${componentType} \
        RETURNING componentStateId';
      try {
        const componentStateId = await t.one(updateQuery, componentState);
        resArr.push(componentStateId);
      } catch (e) {
      // ComponentState didn't exist before so we'll insert it
        if (e.name == 'QueryResultError') {
          console.log("ComponentState didn't exist before so we'll insert it")
          console.log(componentState)
          const componentStateId = await t.one('INSERT INTO componentstate(userId,TDFId,KCId,componentType, \
            probabilityEstimate,hintLevel,firstSeen,lastSeen,trialsSinceLastSeen,priorCorrect,priorIncorrect,priorStudy, \
            totalPracticeDuration,outcomeStack) VALUES(${userId},${TDFId}, ${KCId}, ${componentType}, \
            ${probabilityEstimate},${hintLevel},  ${firstSeen},${lastSeen},${trialsSinceLastSeen},${priorCorrect},${priorIncorrect}, \
            ${priorStudy},${totalPracticeDuration},${outcomeStack}) \
            RETURNING componentStateId',
            componentState);
        } else {
          resArr.push('not caught error:', e);
        }
      }
    }
    return {userId, TDFId, resArr};
  });
  serverConsole('res:', res);
  return res;
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
  const highestStimuliSetIdRet = await db.oneOrNone('SELECT MAX(stimuliSetId) AS stimuliSetId FROM item');
  const newStimuliSetId = highestStimuliSetIdRet.stimulisetid + 1;
  wrappedTDF.stimuliSetId = newStimuliSetId;
  for (const stim of newStimJSON) {
    stim.stimuliSetId = newStimuliSetId;
  }
  const highestStimulusKCRet = await db.oneOrNone('SELECT MAX(stimulusKC) AS stimulusKC FROM item');
  const curNewKCBase = (Math.floor(highestStimulusKCRet.stimuluskc / KC_MULTIPLE) * KC_MULTIPLE) + KC_MULTIPLE;// + 1

  let curNewStimulusKC = curNewKCBase;
  let curNewClusterKC = curNewKCBase;

  const responseKCMap = await getReponseKCMap();
  const maxResponseKC = 1;
  console.log('!!!insertStimTDFPair:', highestStimuliSetIdRet, newStimuliSetId, highestStimulusKCRet, curNewKCBase);
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
  }
  const res = await db.tx(async (t) => {
    const query = 'INSERT INTO tdf(ownerId, stimuliSetId, visibility, content) \
        VALUES(${ownerId}, ${stimuliSetId}, ${visibility}, ${content}) RETURNING TDFId';
    return t.one(query, wrappedTDF)
        .then(async (row) => {
          const TDFId = row.tdfid;
          for (const stim of newStimJSON) {
            if (!stim.incorrectResponses) stim.incorrectResponses = null;
            if (!stim.alternateDisplays) {
              stim.alternateDisplays = null;
            } else {
              stim.alternateDisplays = JSON.stringify(stim.alternateDisplays);
            }

            const query2 = 'INSERT INTO item(stimuliSetId, stimulusFilename, parentStimulusFileName, stimulusKC, \
                clusterKC, responseKC, params, correctResponse, incorrectResponses, itemResponseType, \
                speechHintExclusionList, clozeStimulus, textStimulus, audioStimulus, imageStimulus, videoStimulus, \
                alternateDisplays, tags) \
                VALUES(${stimuliSetId}, ${stimulusFilename}, ${parentStimulusFileName}, ${stimulusKC}, ${clusterKC}, \
                ${responseKC}, ${params}, ${correctResponse}, ${incorrectResponses}, ${itemResponseType}, \
                ${speechHintExclusionList}, ${clozeStimulus}, ${textStimulus}, ${audioStimulus}, ${imageStimulus},\
                ${videoStimulus}, ${alternateDisplays}::jsonb, ${tags})';
            await t.none(query2, stim);
          }
          if (sourceSentences) {
            const query3 = 'INSERT INTO itemSourceSentences (stimuliSetId, sourceSentences) VALUES($1,$2)';
            await t.none(query3, [newStimuliSetId, sourceSentences]);
          }
          return TDFId;
        });
  });
  return res;
}

async function getSourceSentences(stimuliSetId) {
  const query = 'SELECT sourceSentences FROM itemSourceSentences WHERE stimuliSetId=$1';
  const sourceSentencesRet = await db.manyOrNone(query, stimuliSetId);
  return sourceSentencesRet.sourceSentences;
}

async function getAllCourses() {
  try {
    const coursesRet = await db.any('SELECT * from course');
    const courses = [];
    for (const course of coursesRet) {
      courses.push(getCourse(course));
    }
    return courses;
  } catch (e) {
    console.log('getAllCourses ERROR,', e);
    return null;
  }
}

async function getAllCourseSections() {
  try {
    console.log('getAllCourseSections');
    const query = 'SELECT s.sectionid, s.sectionname, c.courseid, c.coursename, c.teacheruserid, c.semester, \
        c.beginDate from course AS c INNER JOIN section AS s ON c.courseid = s.courseid WHERE c.semester=$1';
    const ret = await db.any(query, curSemester);
    return ret;
  } catch (e) {
    console.log('getAllCourseSections ERROR,', e);
    return null;
  }
}

async function getCourseById(courseId) {
  console.log('getAllCoursesForInstructor:', courseId);
  const query = 'SELECT * from course WHERE courseId=$1';
  const course = await db.oneOrNone(query, [courseId, curSemester]);
  return course;
}

async function getAllCoursesForInstructor(instructorId) {
  console.log('getAllCoursesForInstructor:', instructorId);
  const query = 'SELECT *, (SELECT array_agg(section.sectionName) as sectionNames FROM section \
      WHERE courseId=course.courseId) from course WHERE teacherUserId=$1 AND semester=$2';
  const coursesRet = await db.any(query, [instructorId, curSemester]);
  const courses = [];
  for (const course of coursesRet) {
    courses.push(getCourse(course));
  }
  return courses;
}

async function getAllCourseAssignmentsForInstructor(instructorId) {
  try {
    console.log('getAllCourseAssignmentsForInstructor:'+instructorId);
    const query = 'SELECT t.content -> \'fileName\' AS filename, c.courseName, c.courseId from assignment AS a \
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 INNER JOIN course AS c ON c.courseId = a.courseId \
                 WHERE c.teacherUserId = $1 AND c.semester = $2';
    const args = [instructorId, curSemester];
    const courseAssignments = await db.any(query, args);
    return courseAssignments;
  } catch (e) {
    console.log('getAllCourseAssignmentsForInstructor ERROR,', instructorId, ',', e);
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
    console.log('editCourseAssignments:', newCourseAssignment);
    const res = await db.tx(async (t) => {
      const newTdfs = newCourseAssignment.tdfs;
      const query = 'SELECT t.content -> \'fileName\' AS filename, t.TDFId, c.courseId from assignment AS a \
                  INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                  INNER JOIN course AS c ON c.courseId = a.courseId \
                  WHERE c.courseid = $1';
      const curCourseAssignments = await db.manyOrNone(query, newCourseAssignment.courseid);
      const existingTdfs = curCourseAssignments.map((courseAssignment) => courseAssignment.filename);

      const tdfsAdded = getSetAMinusB(newTdfs, existingTdfs);
      const tdfsRemoved = getSetAMinusB(existingTdfs, newTdfs);

      const tdfNamesAndIDs = await t.manyOrNone('SELECT TDFId, content -> \'fileName\' AS filename from tdf');
      const tdfNameIDMap = {};
      for (const tdfNamesAndID of tdfNamesAndIDs) {
        tdfNameIDMap[tdfNamesAndID.filename] = tdfNamesAndID.tdfid;
      }

      for (const tdfName of tdfsAdded) {
        const TDFId = tdfNameIDMap[tdfName];
        console.log('editCourseAssignments tdf:', TDFId, tdfName, tdfsAdded, tdfsRemoved,
            curCourseAssignments, existingTdfs, newTdfs);
        await t.none('INSERT INTO assignment(courseId, TDFId) VALUES($1, $2)', [newCourseAssignment.courseid, TDFId]);
      }
      for (const tdfName of tdfsRemoved) {
        const TDFId = tdfNameIDMap[tdfName];
        await t.none('DELETE FROM assignment WHERE courseId=$1 AND TDFId=$2', [newCourseAssignment.courseid, TDFId]);
      }
      return newCourseAssignment;
    });
    return res;
  } catch (e) {
    console.log('editCourseAssignments ERROR,', newCourseAssignment, ',', e);
    return null;
  }
}

async function getTdfAssignmentsByCourseIdMap(instructorId) {
  console.log('getTdfAssignmentsByCourseIdMap', instructorId);
  const query = 'SELECT t.content \
                 AS content, a.TDFId, a.courseId \
                 FROM assignment AS a \
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 INNER JOIN course AS c ON c.courseId = a.courseId \
                 WHERE c.semester = $1 AND c.teacherUserId=$2';
  const assignmentTdfFileNamesRet = await db.any(query, [curSemester, instructorId]);
  console.log('assignmentTdfFileNames', assignmentTdfFileNamesRet);
  const assignmentTdfFileNamesByCourseIdMap = {};
  for (const assignment of assignmentTdfFileNamesRet) {
    if (!assignmentTdfFileNamesByCourseIdMap[assignment.courseid]) {
      assignmentTdfFileNamesByCourseIdMap[assignment.courseid] = [];
    }
    assignmentTdfFileNamesByCourseIdMap[assignment.courseid].push({
      tdfid: assignment.tdfid,
      displayname: assignment.content.tdfs.tutor.setspec.lessonname,
    });
  }
  return assignmentTdfFileNamesByCourseIdMap;
}

async function getTdfsAssignedToStudent(userId) {
  console.log('getTdfsAssignedToStudent', userId);
  const query = 'SELECT t.* from TDF AS t INNER JOIN assignment AS a ON a.TDFId = t.TDFId INNER JOIN course AS c \
                 ON c.courseId = a.courseId INNER JOIN section AS s ON s.courseId = c.courseId \
                 INNER JOIN section_user_map AS m \
                 ON m.sectionId = s.sectionId WHERE m.userId = $1 AND c.semester = $2';
  const tdfs = await db.manyOrNone(query, [userId, curSemester]);
  const formattedTdfs = tdfs.map((x) => getTdf(x));
  return formattedTdfs;
}

async function getTdfNamesAssignedByInstructor(instructorID) {
  try {
    const query = 'SELECT t.content -> \'fileName\' AS filename from course AS c \
                 INNER JOIN assignment AS a ON a.courseId = c.courseId\
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 WHERE c.teacherUserId = $1 AND c.semester = $2';
    const assignmentTdfFileNames = await db.any(query, [instructorID, curSemester]);
    const unboxedAssignmentTdfFileNames = assignmentTdfFileNames.map((obj) => obj.filename);
    console.log('assignmentTdfFileNames', unboxedAssignmentTdfFileNames);
    return unboxedAssignmentTdfFileNames;
  } catch (e) {
    console.log('getTdfNamesAssignedByInstructor ERROR,', e);
    return null;
  }
}

async function getExperimentState(UserId, TDFId) { // by currentRootTDFId, not currentTdfId
  const query = 'SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2';
  const experimentStateRet = await db.oneOrNone(query, [UserId, TDFId]);
  const experimentState = experimentStateRet.experimentstate;
  return experimentState;
}

// UPSERT not INSERT
async function setExperimentState(UserId, TDFId, newExperimentState, where) { // by currentRootTDFId, not currentTdfId
  serverConsole('setExperimentState:', where, UserId, TDFId, newExperimentState);
  const query = 'SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2';
  const experimentStateRet = await db.oneOrNone(query, [UserId, TDFId]);

  if (experimentStateRet != null) {
    const updatedExperimentState = Object.assign(experimentStateRet.experimentstate, newExperimentState);
    const updateQuery = 'UPDATE globalExperimentState SET experimentState=$1 WHERE userId = $2 AND TDFId = $3';
    await db.none(updateQuery, [updatedExperimentState, UserId, TDFId]);
    return updatedExperimentState;
  }

  const insertQuery = 'INSERT INTO globalExperimentState (experimentState, userId, TDFId) VALUES ($1, $2, $3)';
  await db.query(insertQuery, [{}, UserId, TDFId]);

  return TDFId;
}

async function insertHiddenItem(userId, stimulusKC, tdfId) {
  let query = "UPDATE componentstate SET showitem = FALSE WHERE userid = $1  AND tdfid = $2 AND kcid = $3 AND componenttype = 'stimulus'";
  await db.manyOrNone(query, [userId, tdfId, stimulusKC]);
}

async function getHiddenItems(userId, tdfId) {
  let query = "SELECT kcid FROM componentstate WHERE userid = $1 AND tdfid = $2 AND showitem = false AND componenttype = 'stimulus'";
  const res = await db.manyOrNone(query, [userId, tdfId]);
  let hiddenItems = [];
  for(let item in res){
    hiddenItems.push(res[item].kcid);
  }
  return hiddenItems;
}
async function getUserLastFeedbackTypeFromHistory(tdfID) {
  const query = "SELECT feedbackType FROM HISTORY WHERE TDFId = $1 AND userId = $2 ORDER BY eventid DESC LIMIT 1";
  const feedbackType = await db.oneOrNone(query, [tdfID, Meteor.userId]);
  return feedbackType;
}
async function insertHistory(historyRecord) {
  const tdfFileName = historyRecord['Condition_Typea'];
  const dynamicTagFields = await getListOfStimTags(tdfFileName);
  historyRecord.dynamicTagFields = dynamicTagFields || [];
  historyRecord.recordedServerTime = (new Date()).getTime();
  let query = 'INSERT INTO history \
                            (itemId, \
                            userId, \
                            TDFId, \
                            KCId, \
                            responseDuration, \
                            outcome, \
                            probabilityEstimate, \
                            typeOfResponse, \
                            responseValue, \
                            displayedStimulus, \
                            dynamicTagFields, \
                            Anon_Student_Id, \
                            Session_ID, \
                            Condition_Namea, \
                            Condition_Typea, \
                            Condition_Nameb, \
                            Condition_Typeb, \
                            Condition_Namec, \
                            Condition_Typec, \
                            Condition_Named, \
                            Condition_Typed, \
                            Level_Unit, \
                            Level_Unitname, \
                            Problem_Name, \
                            Step_Name, \
                            Time, \
                            Input, \
                            Student_Response_Type, \
                            Student_Response_Subtype, \
                            Tutor_Response_Type, \
                            KC_Default, \
                            KC_Cluster, \
                            CF_Audio_Input_Enabled, \
                            CF_Audio_Output_Enabled, \
                            CF_Display_Order, \
                            CF_Stim_File_Index, \
                            CF_Set_Shuffled_Index, \
                            CF_Alternate_Display_Index, \
                            CF_Stimulus_Version, \
                            CF_Correct_Answer, \
                            CF_Correct_Answer_Syllables, \
                            CF_Correct_Answer_Syllables_Count, \
                            CF_Display_Syllable_Indices, \
                            CF_Response_Time, \
                            CF_Start_Latency, \
                            CF_End_Latency, \
                            CF_Feedback_Latency, \
                            CF_Review_Latency, \
                            CF_Review_Entry, \
                            CF_Button_Order, \
                            Feedback_Text, \
                            feedbackType, \
                            dialogueHistory, \
                            recordedServerTime, \
                            instructionquestionresult, \
                            hintlevel)';
  query += ' VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[], \
            $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25, \
            $26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41, \
            $42,$43,$44,$45,$46,$47,$48,$49,$50,$51,$52,$53::jsonb,$54,$55,$56)';

  const historyVals = [
    historyRecord.itemId,
    historyRecord.userId,
    historyRecord.TDFId,
    historyRecord.KCId,
    historyRecord.responseDuration,
    historyRecord.outcome,
    historyRecord.probabilityEstimate,
    historyRecord.typeOfResponse,
    historyRecord.responseValue,
    historyRecord.displayedStimulus,
    historyRecord.dynamicTagFields,
    historyRecord.Anon_Student_Id,
    historyRecord.Session_ID,
    historyRecord.Condition_Namea,
    historyRecord.Condition_Typea,
    historyRecord.Condition_Nameb,
    historyRecord.Condition_Typeb || null,
    historyRecord.Condition_Namec,
    historyRecord.Condition_Typec,
    historyRecord.Condition_Named,
    historyRecord.Condition_Typed,
    historyRecord.Level_Unit,
    historyRecord.Level_Unitname,
    historyRecord.Problem_Name,
    historyRecord.Step_Name,
    historyRecord.Time,
    historyRecord.Input,
    historyRecord.Student_Response_Type,
    historyRecord.Student_Response_Subtype,
    historyRecord.Tutor_Response_Type,
    historyRecord.KC_Default,
    historyRecord.KC_Cluster,
    historyRecord.CF_Audio_Input_Enabled,
    historyRecord.CF_Audio_Output_Enabled,
    historyRecord.CF_Display_Order,
    historyRecord.CF_Stim_File_Index,
    historyRecord.CF_Set_Shuffled_Index,
    historyRecord.CF_Alternate_Display_Index,
    historyRecord.CF_Stimulus_Version,
    historyRecord.CF_Correct_Answer,
    historyRecord.CF_Correct_Answer_Syllables,
    historyRecord.CF_Correct_Answer_Syllables_Count,
    historyRecord.CF_Display_Syllable_Indices,
    historyRecord.CF_Response_Time,
    historyRecord.CF_Start_Latency,
    historyRecord.CF_End_Latency,
    historyRecord.CF_Feedback_Latency,
    historyRecord.CF_Review_Latency,
    historyRecord.CF_Review_Entry,
    historyRecord.CF_Button_Order,
    historyRecord.Feedback_Text,
    historyRecord.feedbackType,
    historyRecord.dialogueHistory,
    historyRecord.recordedServerTime,
    historyRecord.instructionQuestionResult || false,
    historyRecord.hintLevel,
  ];
  await db.none(query, historyVals);
}

async function getHistoryByTDFfileName(TDFfileName) {
  const query = 'SELECT h.* FROM history AS h INNER JOIN item AS i ON i.itemId=h.itemId \
                 INNER JOIN tdf AS t ON i.stimuliSetId=t.stimuliSetId WHERE t.content @> $1::jsonb';
  // let query = 'SELECT * FROM history WHERE content @> $1' + '::jsonb';
  const historyRet = await db.manyOrNone(query, [{'fileName': TDFfileName}]);

  return historyRet;
}

function getAllTeachers(southwestOnly=false) {
  const query = {'roles': 'teacher'};
  if (southwestOnly) query['username']=/southwest[.]tn[.]edu/i;
  console.log('getAllTeachers', query);
  const allTeachers = Meteor.users.find(query).fetch();

  return allTeachers;
}

async function addCourse(mycourse) {
  console.log('addCourse:' + JSON.stringify(mycourse));
  const res = await db.tx(async (t) => {
    return t.one('INSERT INTO course(courseName, teacherUserId, semester, beginDate) \
                  VALUES(${courseName}, ${teacherUserId}, ${semester}, ${beginDate}) RETURNING courseId', mycourse)
        .then(async (row) => {
          const courseId = row.courseid;
          for (const sectionName of mycourse.sections) {
            await t.none('INSERT INTO section(courseId, sectionName) VALUES($1, $2)', [courseId, sectionName]);
          }
          return courseId;
        });
  });
  return res;
}

async function editCourse(mycourse) {
  console.log('editCourse:' + JSON.stringify(mycourse));
  const res = await db.tx(async (t) => {
    console.log('transaction');
    return t.one('UPDATE course SET courseName=${coursename}, beginDate=${beginDate} \
                  WHERE courseid=${courseid} RETURNING courseId', mycourse).then(async (row) => {
      const courseId = row.courseid;
      console.log('courseId', courseId, row);
      const newSections = mycourse.sections;
      const curCourseSections = await t.many('SELECT sectionName from section WHERE courseId=$1', courseId);
      const oldSections = curCourseSections.map((section) => section.sectionname);
      console.log('old/new', oldSections, newSections);

      const sectionsAdded = getSetAMinusB(newSections, oldSections);
      const sectionsRemoved = getSetAMinusB(oldSections, newSections);
      console.log('sectionsAdded,', sectionsAdded);
      console.log('sectionsRemoved,', sectionsRemoved);

      for (const sectionName of sectionsAdded) {
        await t.none('INSERT INTO section(courseId, sectionName) VALUES($1, $2)', [courseId, sectionName]);
      }
      for (const sectionName of sectionsRemoved) {
        await t.none('DELETE FROM section WHERE courseId=$1 AND sectionName=$2', [courseId, sectionName]);
      }

      return courseId;
    });
  });
  return res;
}

async function addUserToTeachersClass(userid, teacherID, sectionId) {
  console.log('addUserToTeachersClass', userid, teacherID, sectionId);

  const query = 'SELECT COUNT(*) AS existingMappingCount FROM section_user_map WHERE sectionId=$1 AND userId=$2';
  const existingMappingCountRet = await db.oneOrNone(query, [sectionId, userid]);
  const existingMappingCount = existingMappingCountRet.existingmappingcount;
  console.log('existingMapping', existingMappingCount);
  if (existingMappingCount == 0) {
    console.log('new user, inserting into section_user_mapping', [sectionId, userid]);
    await db.none('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)', [sectionId, userid]);
  }

  return true;
}

async function getStimDisplayTypeMap() {
  try {
    console.log('getStimDisplayTypeMap');
    const query = 'SELECT \
    COUNT(i.clozeStimulus) AS clozeItemCount, \
    COUNT(i.textStimulus)  AS textItemCount, \
    COUNT(i.audioStimulus) AS audioItemCount, \
    COUNT(i.imageStimulus) AS imageItemCount, \
    COUNT(i.videoStimulus) AS videoItemCount, \
    i.stimuliSetId \
    FROM item AS i \
    GROUP BY i.stimuliSetId;';
    const counts = await db.many(query);
    const map = {};
    for (const count of counts) {
      map[count.stimulisetid] = {
        hasCloze: parseInt(count.clozeitemcount) > 0,
        hasText: parseInt(count.textitemcount) > 0,
        hasAudio: parseInt(count.audioitemcount) > 0,
        hasImage: parseInt(count.imageitemcount) > 0,
        hasVideo: parseInt(count.videoitemcount) > 0,
      };
    }
    return map;
  } catch (e) {
    console.log('getStimDisplayTypeMap ERROR,', e);
    return null;
  }
}

async function getPracticeTimeIntervalsMap(userIds, tdfId, date) {
  console.log('getPracticeTimeIntervalsMap', userIds, tdfId, date, userIds.join(','));
  const query = "SELECT userId, SUM(CF_End_Latency) AS duration \
    FROM history WHERE recordedServerTime < $1 \
    AND userId IN ('" + userIds.join(`','`) + "') AND TDFId = $2 \
    GROUP BY userId";

  const res = await db.manyOrNone(query, [date, tdfId]);
  const practiceTimeIntervalsMap = {};
  for (const row of res) {
    practiceTimeIntervalsMap[row.userid] = parseInt(row.duration);
  }
  console.log(practiceTimeIntervalsMap)
  return practiceTimeIntervalsMap;
}

async function getUsersByUnitUpdateDate(userIds, tdfId, date) {
  console.log('getUsersByUnitUpdateDate', userIds, tdfId, date, userIds.join(','));
  const query = "SELECT userId, SUM(CF_End_Latency) AS duration \
    FROM history WHERE recordedServerTime < $1 \
    AND userId IN ('" + userIds.join(`','`) + "') AND TDFId = $2 \
    GROUP BY userId";

  const res = await db.manyOrNone(query, [date, tdfId]);
  const practiceTimeIntervalsMap = {};
  for (const row of res) {
    practiceTimeIntervalsMap[row.userid] = parseInt(row.duration);
  }
  console.log(practiceTimeIntervalsMap)
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

async function getStimuliSetByFilename(stimFilename) {
  const idRet = await db.oneOrNone('SELECT stimuliSetId FROM item WHERE stimulusFilename = $1 LIMIT 1', stimFilename);
  const stimuliSetId = idRet ? idRet.stimulisetid : null;
  if (isEmpty(stimuliSetId)) return null;
  return await getStimuliSetById(stimuliSetId);
}

async function getStimuliSetById(stimuliSetId) {
  const query = 'SELECT * FROM item \
               WHERE stimuliSetId=$1 \
               ORDER BY itemId';
  const itemRet = await db.manyOrNone(query, stimuliSetId);

  const items = [];
  for (const item of itemRet) {
    items.push(getItem(item));
  }
  return items;
}

async function getStimCountByStimuliSetId(stimuliSetId) {
  const query = 'SELECT COUNT(*) FROM item \
               WHERE stimuliSetId=$1 \
               ORDER BY itemId';
  const ret = await db.one(query, stimuliSetId);
  return ret.count;
}
async function getItemsByFileName(stimFileName) {
  const query = 'SELECT * FROM item \
               WHERE stimulusfilename=$1 \
               ORDER BY itemId';
  const itemRet = await db.manyOrNone(query, stimFileName);

  const items = [];
  for (const item of itemRet) {
    items.push(getItem(item));
  }
  console.log(items[0]);
  return items;
}
async function getStudentReportingData(userId, TDFid, hintLevel) {
  const query = 'SELECT ordinality, SUM(CASE WHEN outcome=\'1\' THEN 1 ELSE 0 END) \
                 as numCorrect, COUNT(outcome) as numTotal FROM componentState, \
                 unnest(string_to_array(outcomestack,\',\')) WITH ORDINALITY as outcome \
                 WHERE componentType=\'stimulus\' AND USERId=$1 AND TDFId=$2'
                 + 'AND hintLevel=$3 AND showItem=true' + ' GROUP BY ordinality \
                 ORDER BY ORDINALITY ASC LIMIT 5;';
  const dataRet = await db.manyOrNone(query, [userId, TDFid, hintLevel]);
  const correctnessAcrossRepetitions = [];
  for (const curData of dataRet) {
    const numCorrect = parseInt(curData.numcorrect);
    const numTotal = parseInt(curData.numtotal);
    correctnessAcrossRepetitions.push({
      numCorrect,
      numTotal,
      percentCorrect: Math.round( (numCorrect / numTotal) * 100 ),
    });
  }

  const query2 = 'SELECT item.clozeStimulus, item.textStimulus, componentState.probabilityEstimate, \
                  componentState.lastSeen, componentState.KCId FROM componentState JOIN item \
                  ON componentState.kcid=item.stimuluskc WHERE componentType=\'stimulus\' AND userId=$1 AND TDFId=$2;';
  const dataRet2 = await db.manyOrNone(query2, [userId, TDFid]);
  const probEstimates = [];
  for (const curData of dataRet2) {
    probEstimates.push({
      stimulus: curData.clozestimulus || curData.textstimulus,
      probabilityEstimate: Math.round(100 * parseFloat(curData.probabilityestimate)),
      lastSeen: curData.lastseen,
    });
  }
  return {correctnessAcrossRepetitions, probEstimates};
}

async function getStudentPerformanceByIdAndTDFId(userId, TDFid,hintLevel=0,returnRows=null) {
  console.log('getStudentPerformanceByIdAndTDFId', userId, TDFid, hintLevel, returnRows);
  let hintLevelAddendunm = "";
  if(hintLevel){
    let hintLevelAddendunm = "AND s.hintLevel=$3";
  }
  const query = 'SELECT SUM(s.priorCorrect) AS numCorrect, \
               SUM(s.priorIncorrect) AS numIncorrect, \
               COUNT(i.itemID) AS totalStimCount, \
               SUM(s.totalPracticeDuration) AS totalPracticeDuration, \
               COUNT(CASE WHEN (s.priorIncorrect = 1 AND s.priorCorrect = 0) OR (s.priorIncorrect = 0 AND s.priorCorrect = 1) THEN 1 END) AS stimsIntroduced \
               FROM (SELECT * from componentState LIMIT $4) AS s \
               INNER JOIN item AS i ON i.stimulusKC = s.KCId \
               INNER JOIN tdf AS t ON t.stimuliSetId = i.stimuliSetId \
               WHERE s.userId=$1 AND t.TDFId=$2 AND s.componentType =\'stimulus\' \ AND s.showitem = true  ' + hintLevelAddendunm;
  const perfRet = await db.oneOrNone(query, [userId, TDFid, hintLevel, returnRows]);
  const query2 = 'SELECT COUNT(DISTINCT s.ItemId) AS stimsSeen \
                  FROM history AS s \
                  WHERE s.userId=$1 AND s.tdfid=$2 AND s.level_unitname = $3';                  
  const perfRet2 = await db.oneOrNone(query2, [userId, TDFid,'Model Unit']);
  if (!perfRet || !perfRet2) return null;
  return {
    numCorrect: perfRet.numcorrect,
    numIncorrect: perfRet.numincorrect,
    totalStimCount: perfRet.totalstimcount,
    stimsSeen: perfRet2.stimsseen,
    totalPracticeDuration: perfRet.totalpracticeduration,
    stimsIntroduced: perfRet.stimsintroduced
  };
}

async function getStudentPerformanceForClassAndTdfId(instructorId) {
  const query = 'SELECT MAX(t.TDFId) AS tdfid, \
                MAX(c.courseId) AS courseid, \
                MAX(s.userId) AS userid, \
                SUM(s.priorCorrect) AS correct, \
                SUM(s.priorIncorrect) AS incorrect, \
                SUM(s.totalPracticeDuration) AS totalPracticeDuration \
                FROM componentState AS s \
                INNER JOIN item AS i ON i.stimulusKC = s.KCId \
                INNER JOIN tdf AS t ON t.stimuliSetId = i.stimuliSetId \
                INNER JOIN assignment AS a on a.TDFId = t.TDFId \
                INNER JOIN course AS c on c.courseId = a.courseId \
                WHERE c.semester = $1 AND c.teacherUserId = $2 \
                GROUP BY s.userId, t.TDFId, c.courseId';

  const studentPerformanceRet = await db.manyOrNone(query, [curSemester, instructorId]);
  console.log('studentPerformanceRet', studentPerformanceRet);
  if (studentPerformanceRet==null) {
    return [];
  }
  const studentPerformanceForClass = {};
  const studentPerformanceForClassAndTdfIdMap = {};
  for (const studentPerformance of studentPerformanceRet) {
    let {courseid, userid, tdfid, correct, incorrect, totalpracticeduration} = studentPerformance;
    let studentUsername = userIdToUsernames[userid];
    if (!studentUsername) {
      console.log(Meteor.users.findOne({_id: userid}).username + ', ' + userid);
      studentUsername = Meteor.users.findOne({_id: userid}).username;
      userIdToUsernames[userid] = studentUsername;
    }

    correct = parseInt(correct);
    incorrect = parseInt(incorrect);
    totalpracticeduration = parseInt(totalpracticeduration);

    if (!studentPerformanceForClass[courseid]) studentPerformanceForClass[courseid] = {};
    if (!studentPerformanceForClass[courseid][tdfid]) {
      studentPerformanceForClass[courseid][tdfid] = {count: 0, totalTime: 0, numCorrect: 0};
    }
    studentPerformanceForClass[courseid][tdfid].numCorrect += correct;
    studentPerformanceForClass[courseid][tdfid].count += correct + incorrect;
    studentPerformanceForClass[courseid][tdfid].totalTime += totalpracticeduration;

    if (!studentPerformanceForClassAndTdfIdMap[courseid]) studentPerformanceForClassAndTdfIdMap[courseid] = {};
    if (!studentPerformanceForClassAndTdfIdMap[courseid][tdfid]) {
      studentPerformanceForClassAndTdfIdMap[courseid][tdfid] = {};
    }

    if (!studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid]) {
      studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid] = {
        count: 0,
        totalTime: 0,
        numCorrect: 0,
        username: studentUsername,
        userId: userid,
      };
    }
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].numCorrect += correct;
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].count += correct + incorrect;
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].totalTime = totalpracticeduration;
  }
  console.log('studentPerformanceForClass:', JSON.stringify(studentPerformanceForClass, null, 4));
  for (const index of Object.keys(studentPerformanceForClass)) {
    const coursetotals = studentPerformanceForClass[index];
    for (const index2 of Object.keys(coursetotals)) {
      const tdftotal = coursetotals[index2];
      tdftotal.percentCorrect = ((tdftotal.numCorrect / tdftotal.count)*100).toFixed(2) + '%',
      tdftotal.totalTimeDisplay = (tdftotal.totalTime / (60 * 1000) ).toFixed(1); // convert to minutes from ms
    }
  }
  console.log('studentPerformanceForClassAndTdfIdMap:', studentPerformanceForClassAndTdfIdMap);
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
  const query = 'SELECT TDFId from globalExperimentState WHERE userId = $1';
  const tdfRet = await db.manyOrNone(query, userId);
  const allTdfs = await getAllTdfs();

  const tdfsAttempted = [];
  for (const obj of tdfRet) {
    const tdfid = obj.tdfid;
    const tdf = allTdfs.find((x) => x.TDFId == tdfid);
    if (!tdf) continue; // Handle a case where user has data from a no longer existing tdf
    const tdfObject = tdf.content;
    if (!tdfObject.tdfs.tutor.unit) continue;// TODO: fix root/condition tdfs

    if (onlyWithLearningSessions) {
      for (const unit of tdfObject.tdfs.tutor.unit) {
        if (unit.learningsession) {
          const displayName = tdfObject.tdfs.tutor.setspec.lessonname;
          const disableProgressReport = tdfObject.tdfs.tutor.setspec.disableProgressReport;
          tdfsAttempted.push({tdfid, displayName, disableProgressReport});
          break;
        }
      }
    } else {
      const displayName = tdfObject.tdfs.tutor.setspec.lessonname;
      const disableProgressReport = tdfObject.tdfs.tutor.setspec.disableProgressReport;
      tdfsAttempted.push({tdfid, displayName, disableProgressReport});
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

function sendEmail(to, from, subject, text) {
  check([to, from, subject, text], [String]);
  Email.send({to, from, subject, text});
}

function hasGeneratedTdfs(TDFjson) {
  return TDFjson.tdfs.tutor.generatedtdfs && TDFjson.tdfs.tutor.generatedtdfs.length;
}

// TODO rework for input in a new format as well as the current assumption of the old format
async function upsertStimFile(stimFilename, stimJSON, ownerId) {
  console.log('upsertStimFile', stimFilename);
  const oldStimFormat = {
    'fileName': stimFilename,
    'stimuli': stimJSON,
    'owner': ownerId,
    'source': 'repo',
  };
  await db.tx(async (t) => {
    const responseKCMap = await getReponseKCMap();
    const query = 'SELECT stimuliSetId FROM item WHERE stimulusFilename = $1 LIMIT 1';
    const associatedStimSetIdRet = await t.oneOrNone(query, stimFilename);
    serverConsole('getAssociatedStimSetIdForStimFile', stimFilename, associatedStimSetIdRet);
    let stimuliSetId;
    if (associatedStimSetIdRet) {
      stimuliSetId = associatedStimSetIdRet.stimulisetid;
      console.log('stimuliSetId1:', stimuliSetId, associatedStimSetIdRet);
    } else {
      const highestStimuliSetId = await t.oneOrNone('SELECT MAX(stimuliSetId) AS stimuliSetId FROM item');
      stimuliSetId = highestStimuliSetId && highestStimuliSetId.stimulisetid ?
          parseInt(highestStimuliSetId.stimulisetid) + 1 : 1;
      console.log('stimuliSetId2:', stimuliSetId, highestStimuliSetId);
    }

    const newFormatItems = getNewItemFormat(oldStimFormat, stimFilename, stimuliSetId, responseKCMap);
    const existingStims = await t.manyOrNone('SELECT * FROM item WHERE stimulusFilename = $1', stimFilename);
    let newStims = [];
    if (existingStims && existingStims.length > 0) {
      for (const newStim of newFormatItems) {
        const stimulusKC = newStim.stimulusKC;
        let matchingStim = existingStims.find((x) => x.stimuluskc == stimulusKC);
        if (!matchingStim) {
          newStims.push(newStim);
          continue;
        }
        matchingStim = getItem(matchingStim);
        const mergedStim = Object.assign(matchingStim, newStim);
        if (mergedStim.alternateDisplays) mergedStim.alternateDisplays = JSON.stringify(mergedStim.alternateDisplays);
        await t.none('UPDATE item SET stimuliSetId = ${stimuliSetId}, stimulusFilename = ${stimulusFilename}, \
                      parentStimulusFileName = ${parentStimulusFileName}, stimulusKC = ${stimulusKC}, \
                      clusterKC = ${clusterKC}, responseKC = ${responseKC}, params = ${params}, \
                      optimalProb = ${optimalProb}, correctResponse = ${correctResponse}, \
                      incorrectResponses = ${incorrectResponses}, itemResponseType = ${itemResponseType}, \
                      speechHintExclusionList = ${speechHintExclusionList}, clozeStimulus = ${clozeStimulus}, \
                      textStimulus = ${textStimulus}, audioStimulus = ${audioStimulus}, \
                      imageStimulus = ${imageStimulus}, videoStimulus = ${videoStimulus}, \
                      alternateDisplays = ${alternateDisplays}, tags = ${tags}', mergedStim);
      }
    } else {
      newStims = newFormatItems;
    }
    console.log('!!!newStims:', newStims);
    for (const stim of newStims) {
      if (stim.alternateDisplays) stim.alternateDisplays = JSON.stringify(stim.alternateDisplays);
      await t.none('INSERT INTO item(stimuliSetId, stimulusFilename, stimulusKC, clusterKC, responseKC, params, \
        optimalProb, correctResponse, incorrectResponses, itemResponseType, speechHintExclusionList, clozeStimulus, \
        textStimulus, audioStimulus, imageStimulus, videoStimulus, alternateDisplays, tags) \
      VALUES(${stimuliSetId}, ${stimulusFilename}, ${stimulusKC}, ${clusterKC}, ${responseKC}, ${params}, \
        ${optimalProb}, ${correctResponse}, ${incorrectResponses}, ${itemResponseType}, ${speechHintExclusionList}, \
        ${clozeStimulus}, ${textStimulus}, ${audioStimulus}, ${imageStimulus}, ${videoStimulus}, \
        ${alternateDisplays}::jsonb, ${tags})', stim);
    }

    return {ownerId};
  });
}

async function upsertTDFFile(tdfFilename, tdfJSON, ownerId) {
  console.log('upsertTDFFile', tdfFilename);
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
  if (prev && prev.TDFId) {
    let tdfJSONtoUpsert;
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', stimSet);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      delete generatedTdf.createdAt;
      tdfJSONtoUpsert = JSON.stringify(generatedTdf);
    } else {
      tdfJSONtoUpsert = JSON.stringify(tdfJSON);
    }
    const query = 'UPDATE tdf SET ownerId=$1, stimuliSetId=$2, content=$3::jsonb WHERE TDFId=$4';
    await db.none(query, [ownerId, prev.stimuliSetId, tdfJSONtoUpsert, prev.TDFId]);
  } else {
    let tdfJSONtoUpsert;
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', stimSet);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      tdfJSONtoUpsert = JSON.stringify(generatedTdf);
    } else {
      tdfJSON.createdAt = new Date();
      tdfJSONtoUpsert = JSON.stringify(tdfJSON);
    }
    await db.tx(async (t) => {
      let stimuliSetId;
      if (tdfJSON.tdfs.tutor.setspec.stimulusfile) {
        const stimFileName = tdfJSON.tdfs.tutor.setspec.stimulusfile;
        const stimuliSetIdQuery = 'SELECT stimuliSetId FROM item WHERE stimulusFilename = $1 LIMIT 1';
        const associatedStimSetIdRet = await t.oneOrNone(stimuliSetIdQuery, stimFileName);
        if (associatedStimSetIdRet) {
          stimuliSetId = associatedStimSetIdRet.stimulisetid;
        } else {
          throw new Error('No matching stimulus file found');
        }
      } else {
        stimuliSetId = null; // Root condition tdfs have no stimulisetid
      }
      const query = 'INSERT INTO tdf(ownerId, stimuliSetId, content) VALUES($1, $2, $3::jsonb)';
      await t.none(query, [ownerId, stimuliSetId, tdfJSONtoUpsert]);
    });
  }
}

function parseStringSync(str) {
  let result;
  // eslint-disable-next-line new-cap
  require('xml2js').Parser().parseString(str, (e, r) => {
    result = r;
  });
  return result;
}

async function loadStimsAndTdfsFromPrivate(adminUserId) {
  if (!isProd) {
    console.log('loading stims and tdfs from asset dir');
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

const baseSyllableURL = 'http://localhost:4567/syllables/';
function getSyllablesForWord(word) {
  const syllablesURL = baseSyllableURL + word;
  const result = HTTP.call('GET', syllablesURL);
  const syllableArray = result.content.replace(/\[|\]/g, '').split(',').map((x) => x.trim());
  console.log('syllables for word, ' + word + ': ' + stringifyIfExists(syllableArray) );
  return syllableArray;
}

// Server-side startup logic

Meteor.startup(async function() {
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
  const ret = await db.oneOrNone('SELECT COUNT(*) FROM tdf');
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

  // Set up our server-side methods
  Meteor.methods({
    getAllTdfs, getAllStims, getTdfById, getTdfByFileName, getTdfByExperimentTarget, getTdfIDsAndDisplaysAttemptedByUserId,

    getLearningSessionItems, getStimDisplayTypeMap, getStimuliSetById, getStimuliSetsForIdSet,
    getStimuliSetByFilename, getSourceSentences, getMatchingDialogueCacheWordsForAnswer,

    getAllCourses, getAllCourseSections, getAllCoursesForInstructor, getAllCourseAssignmentsForInstructor,
    addCourse, editCourse, editCourseAssignments, addUserToTeachersClass,

    getAllTeachers, getTdfNamesAssignedByInstructor, getTdfsAssignedToStudent, getTdfAssignmentsByCourseIdMap,

    getStudentPerformanceByIdAndTDFId, getStudentPerformanceForClassAndTdfId,

    getExperimentState, setExperimentState, getUserIdforUsername, insertStimTDFPair,

    getProbabilityEstimatesByKCId, getOutcomeHistoryByUserAndTDFfileName, getReponseKCMap,

    getComponentStatesByUserIdTDFIdAndUnitNum, setComponentStatesByUserIdTDFIdAndUnitNum,

    insertHistory, getHistoryByTDFfileName, getPracticeTimeIntervalsMap, getUsersByUnitUpdateDate,

    loadStimsAndTdfsFromPrivate, getListOfStimTags, getStudentReportingData,

    insertHiddenItem, getHiddenItems, getUserLastFeedbackTypeFromHistory,

    getTdfIdByStimSetIdAndFileName, getItemsByFileName,

    createExperimentDataFile: async function(exp) {
      if(!Meteor.userId()){
        throw new Meteor.Error('Unauthorized: No user login');
      }
      else if(!Roles.userIsInRole(Meteor.userId(), ['teacher', 'admin'])){
        throw new Meteor.Error('Unauthorized: You do not have permission to this data');
      }
      else if (!exp) {
        throw new Meteor.Error('No experiment specified');
      }

      return await createExperimentExport(exp);
    },

    createTeacherDataFile: async function(teacherID) {
      const uid = teacherID || Meteor.userId();

      if(!Meteor.userId()){
        throw new Meteor.Error('Unauthorized: No user login');
      }
      else if(!Roles.userIsInRole(Meteor.userId(), ['teacher', 'admin'])){
        throw new Meteor.Error('Unauthorized: You do not have permission to this data');
      }
  
      const tdfNames = getTdfNamesAssignedByInstructor(uid);
  
      if (!tdfNames.length > 0) {
        throw new Meteor.Error('No tdfs found for any classes for: ' + Meteor.user().username);
      }
  
      return await createExperimentExport(tdfNames);
    },

    createClassDataFile: async function(classId) {
      if(!Meteor.userId()){
        throw new Meteor.Error('Unauthorized: No user login');
      }
      else if(!Roles.userIsInRole(Meteor.userId(), ['teacher', 'admin'])){
        throw new Meteor.Error('Unauthorized: You do not have permission to this data');
      }
      else if (!classId) {
        throw new Meteor.Error('No class ID specified');
      }

      const foundClass = await getCourseById(classId);

      if (!foundClass) {
        throw new Meteor.Error('No classes found for the specified class ID: ' + classId);
      }

      const tdfFileNames = await getTdfAssignmentsByCourseIdMap(classId);

      if (!tdfFileNames || tdfFileNames.length == 0) {
        throw new Meteor.Error('No tdfs found for any classes');
      }
      return await createExperimentExport(tdfFileNames);
    },

    createClozeEditHistoryDataFile: async function(authorID) {
      let response = '';
      if(!Meteor.userId()){
        throw new Meteor.Error('Unauthorized: No user login');
      }
      else if(!Roles.userIsInRole(Meteor.userId(), ['teacher', 'admin'])){
        throw new Meteor.Error('Unauthorized: You do not have permission to this data');
      }
      else if (!authorID) {
        throw new Meteor.Error('No user id specified');
      }

      for(let record of ClozeEditHistory.find({'user': authorID})){
        response += JSON.stringify(record);
        response += '\r\n';
      }
      return response;
    },

    getAltServerUrl: function() {
      return altServerUrl;
    },

    getClozesFromText: function(inputText) {
      // eslint-disable-next-line new-cap
      const clozes = ClozeAPI.GetSelectCloze(null, null, null, true, null, inputText);
      return clozes;
    },

    getSimpleFeedbackForAnswer: function(userAnswer, correctAnswer) {
      // eslint-disable-next-line new-cap
      const result = ElaboratedFeedback.GenerateFeedback(userAnswer, correctAnswer);
      console.log('result: ' + JSON.stringify(result));
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

    updateStimSyllableCache: function(stimFileName, answers) {
      console.log('updateStimSyllableCache');
      const curStimSyllables = StimSyllables.findOne({filename: stimFileName});
      console.log('curStimSyllables: ' + JSON.stringify(curStimSyllables));
      if (!curStimSyllables) {
        const data = {};
        for (const answer of answers) {
          let syllableArray;
          let syllableGenerationError;
          const safeAnswer = answer.replace(/\./g, '_');
          try {
            syllableArray = getSyllablesForWord(safeAnswer);
          } catch (e) {
            console.log('error fetching syllables for ' + answer + ': ' + JSON.stringify(e));
            syllableArray = [answer];
            syllableGenerationError = e;
          }
          data[safeAnswer] = {
            count: syllableArray.length,
            syllables: syllableArray,
            error: syllableGenerationError,
          };
        }
        StimSyllables.insert({filename: stimFileName, data: data});
        console.log('after updateStimSyllableCache');
      }
    },

    getClozeEditAuthors: function() {
      const authorIDs = {};
      ClozeEditHistory.find({}).forEach(function(entry) {
        authorIDs[entry.user] = Meteor.users.findOne({_id: entry.user}).username;
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
      console.log('rawText!!!: ' + rawText);
      // eslint-disable-next-line new-cap
      return clozeGeneration.GetClozeAPI(null, null, null, rawText);
    },

    serverLog: function(data) {
      if (Meteor.user()) {
        const logData = 'User:' + Meteor.user()._id + ', log:' + data;
        console.log(logData);
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
        console.log(e);
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
      } else if (roleAction === 'remove') {
        Roles.removeUsersFromRoles(targetUserId, [roleName]);
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
            const query = 'SELECT stimuliSetId FROM item WHERE stimulusFilename = $1 LIMIT 1';
            const associatedStimSetIdRet = await db.oneOrNone(query, stimFileName);
            const stimuliSetId = associatedStimSetIdRet ? associatedStimSetIdRet.stimulisetid : null;
            if (isEmpty(stimuliSetId)) {
              results.result = false;
              results.errmsg = 'Please upload stimulus file before uploading a TDF';
            } else {
              try {
                const rec = {'fileName': filename, 'tdfs': json, 'ownerId': ownerId, 'source': 'upload'};
                await upsertTDFFile(filename, rec, ownerId);
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
      await db.tx(async (t) => {
        tdfIds.forEach((tdfid) => {
          console.log('!!!toggleTdfPresence:', [mode, tdfid]);
          t.none('UPDATE tdf SET visibility = $1 WHERE TDFId=$2', [mode, tdfid]);
        });
      });
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