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
import {getItem, getCourse} from './orm';
import {result} from 'underscore';
import { _ } from 'core-js';


export {
  getTdfByFileName,
  getTdfById,
  getHistoryByTDFID,
  getListOfStimTags,
  getListOfStimTagsByTDFFileNames,
  getStimuliSetById,
  getDisplayAnswerText,
  serverConsole,
  decryptUserData,
  createAwsHmac,
  getTdfByExperimentTarget
};

/* jshint sub:true*/

// The jshint inline option above suppresses a warning about using sqaure
// brackets instead of dot notation - that's because we prefer square brackets
// for creating some MongoDB queries
const SymSpell = require('node-symspell')
const fs = Npm.require('fs');
const https = require('https')
const { randomBytes } = require('crypto')
let verbosityLevel = 0; //0 = only output serverConsole logs, 1 = only output function times, 2 = output serverConsole and function times
const baseSyllableURL = 'http://localhost:4567/syllables/';

if (process.env.METEOR_SETTINGS_WORKAROUND) {
  Meteor.settings = JSON.parse(process.env.METEOR_SETTINGS_WORKAROUND);
}
if (Meteor.settings.public.testLogin) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  serverConsole('dev environment, allow insecure tls');
}

let highestStimuliSetId;
let nextStimuliSetId;

// How large the distance between two words can be to be considered a match. Larger values result in a slower search. Defualt is 2.
const maxEditDistance = Meteor.settings.SymSpell.maxEditDistance ? parseInt(Meteor.settings.SymSpell.maxEditDistance) : 2;
// How big the prefix used for indexing is. Larger values will be result in a faster search, but will use more memory. Default is 7.
const prefixLength = Meteor.settings.SymSpell.prefixLength ? parseInt(Meteor.settings.SymSpell.prefixLength) : 7;
const symSpell = new SymSpell(maxEditDistance, prefixLength);
serverConsole(Meteor.settings.frequencyDictionaryLocation)
symSpell.loadDictionary(Meteor.settings.frequencyDictionaryLocation, 0, 1);
symSpell.loadBigramDictionary(Meteor.settings.bigramDictionaryLocation, 0, 2);
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
  if(verbosityLevel == 1) return;
  const disp = [(new Date()).toString()];
  for (let i = 0; i < args.length; ++i) {
    disp.push(args[i]);
  }
  // eslint-disable-next-line no-invalid-this
  console.log.apply(this, disp);
}

function functionTimerWrapper(methods, asyncMethods)
{
  const newMethods = _.reduce(Object.keys(methods), function(newMethods, method) {
    newMethods[method] = function() {
      if(verbosityLevel > 0){
        return functionTimer(methods[method], arguments)
      } else {
        return methods[method].apply(this, arguments);
      }
    }
    return newMethods;
  }, {});

  const newAsyncMethods = _.reduce(Object.keys(asyncMethods), function(newMethods, method) {
    newMethods[method] = async function() {
      if(verbosityLevel > 0){
        return await functionTimerAsync(asyncMethods[method], arguments)
      } else {
        return asyncMethods[method].apply(this, arguments);
      }
    }
    return newMethods;
  }, {});
  return {...newMethods, ...newAsyncMethods};
}

function functionTimer(f, args) {
  const start = new Date();
  const result = f.apply(this, args);
  const total = new Date() - start;
  console.log('Function', f.name + ' took ' + total + 'ms');
  return result;
}

async function functionTimerAsync(f, args) {
  const start = new Date();
  const result = await f.apply(this, args);
  const total = new Date() - start;
  console.log('AsyncFunction', f.name + ' took ' + total + 'ms');
  return result;
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

async function getTdfById(TDFId) {
  const tdf = Tdfs.findOne({_id: TDFId});
  return tdf;
}

async function getTdfTTSAPIKey(TDFId) {
  const textToSpeechAPIKey = Tdfs.findOne({_id: TDFId}).content.tdfs.tutor.setspec.textToSpeechAPIKey;
  return textToSpeechAPIKey;
}

async function getTdfByFileName(filename) {
  try {
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
    tdf = Tdfs.findOne({"content.tdfs.tutor.setspec.experimentTarget": experimentTarget});
    return tdf;
  } catch (e) {
    serverConsole('getTdfByExperimentTarget ERROR,', experimentTarget, ',', e);
    return null;
  }
}

async function getAllTdfs() {
  serverConsole('getAllTdfs');
  const tdfs = Tdfs.find({}).fetch();
  return tdfs;
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

async function getResponseKCMap() {
  const responseKCStuff = await Tdfs.rawCollection().aggregate([
    {
      $unwind: {
        path: "$stimuli",
        preserveNullAndEmptyArrays: false
      }
    },
    {
      $group: {
      _id: "$stimuli.correctResponse",
      "doc": { "$first": "$$ROOT" }
      }
    },
    {
      $replaceRoot: {
        newRoot: "$doc"
      }
    },
    {
      $project: {
        "stimuliSetId": "$stimuli.stimuliSetId",
        "stimulusFileName": "$stimuli.stimulusFileName",
        "stimulusKC": "$stimuli.stimulusKC",
        "clusterKC": "$stimuli.clusterKC",
        "responseKC": "$stimuli.responseKC",
        "params": "$stimuli.params",
        "correctResponse": "$stimuli.correctResponse",
        "incorrectResponses": "$stimuli.incorrectResponses",
        "itemResponseType": "$stimuli.itemResponseType",
        "clozeStimulus": "$stimuli.clozeStimulus",
        "textStimulus": "$stimuli.textStimulus",
        "syllables": "$stimuli.syllables"
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

async function clearCurUnitProgress(userId, TDFId) {
  ComponentStates.update({userId: userId, TDFId: TDFId}, {$set: {'priorCorrect': 0, 'priorIncorrect': 0, 'totalPracticeDuration': 0, 'timesSeen': 0}}, {multi: true});
}

async function getMaxResponseKC(){
  const responseKC = await Tdfs.rawCollection().aggregate([
    { 
      $addFields: {
        "maxResponseKC": {
          $max: "$stimuli.responseKC"
        }
      }
    },
    {
      $sort: {
        "maxResponseKC": -1
      }
    },
    {
      $limit: 1
    }]).toArray()
  return responseKC[0].maxResponseKC;
}

async function setComponentStatesByUserIdTDFIdAndUnitNum(userId, TDFId, componentStates) {
  serverConsole('setComponentStatesByUserIdTDFIdAndUnitNum, ', userId, TDFId);
  const responseKCMap = await getResponseKCMap();
  const newResponseKCRet = await getMaxResponseKC();
  let newResponseKC = newResponseKCRet.maxResponseKC + 1;
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

// Package Uploader
async function processPackageUpload(fileObj, owner, zipLink){
  DynamicAssets.collection.update({_id: fileObj._id}, {$set: {'meta.link': zipLink}});
  let path = fileObj.path;
  let results = [];
  let unzippedFiles
  let filePath
  let fileName
  let extension
  try{
    const unzipper = Npm.require('unzipper');
    const zip = await unzipper.Open.file(path);
    unzippedFiles = [];
    for(const file of zip.files){
      let fileContents = await file.buffer();
      filePath = file.path;
      const filePathArray = filePath.split("/");
      fileName = filePathArray[filePathArray.length - 1];
      const fileNameArray = fileName.split(".");
      extension = fileNameArray[fileNameArray.length - 1];
      let type;
      if(extension == "json"){
        serverConsole(fileName);
        fileContents = JSON.parse(fileContents.toString());
        type = fileContents.setspec ? 'stim' : 'tdf'
      }
      else {
        type = 'media'
      }
      const fileMeta = { 
        name: fileName,
        path: filePath,
        extension: extension,
        contents: fileContents,
        type: type
      };
      unzippedFiles.push(fileMeta);
    }
    serverConsole('unzippedFiles', unzippedFiles);
    const stimFileName = unzippedFiles.filter(f => f.type == 'stim')[0].name;
    const stimSetId = await getStimuliSetIdByFilename(stimFileName);
    try {
      for(const stim of unzippedFiles.filter(f => f.type == 'stim')){
        results.push(await saveContentFile(stim.type, stim.name, stim.contents, owner, stim.path));
      }
    } catch(e) {
      serverConsole('processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
      throw new Meteor.Error('package upload failed at stim upload: ' + e + ' on file: ' + filePath)
    }

    try {
      for(const tdf of unzippedFiles.filter(f => f.type == 'tdf')){
        const tdfResults = await saveContentFile(tdf.type, tdf.name, tdf.contents, owner, tdf.path);
        results.push(tdfResults);
        serverConsole('tdfResults', tdfResults);
      }
    } catch(e) {
      serverConsole('processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
      throw new Meteor.Error('package upload failed at tdf upload: ' + e + ' on file: ' + filePath)
    }
    try {
      for(const media of unzippedFiles.filter(f => f.type == 'media')){
        await saveMediaFile(media, owner, stimSetId);
      }
    } catch(e) {
      serverConsole('processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
      throw new Meteor.Error('package upload failed at media upload: ' + e + ' on file: ' + filePath)
    }
    return {results, stimSetId};
  } catch(e) {
    serverConsole('processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
    throw new Meteor.Error('package upload failed at initialization: ' + e + ' on file: ' + filePath)
  }
}

async function combineStimAndTdfFiles(){
  const TDFS = await Tdfs.find({}).fetch();
  for(const tdf of TDFS){
    const stimulusFileName = await Items.findOne({stimuliSetId: tdf.stimuliSetId})?.stimulusFileName;
    const stimuli = await Items.find({stimuliSetId: tdf.stimuliSetId}).fetch();
    console.log(stimuli)
    if(stimuli){
      tdf.stimuli = stimuli;
      tdf.stimulusFileName = stimulusFileName;
      await Tdfs.update({_id: tdf._id}, tdf);
    }
  }
}

async function saveMediaFile(media, owner, stimSetId){
  serverConsole("Uploading:", media.name);
  const foundFile = DynamicAssets.collection.findOne({userId: owner, name: media.name})
  if(foundFile){
    DynamicAssets.remove({_id: foundFile._id});
    serverConsole(`File ${media.name} already exists, overwritting.`);
  }
  else{
    serverConsole(`File ${media.name} doesn't exist, uploading`)
  }
  DynamicAssets.write(media.contents, {
    name: media.name,
    userId: owner,
  }, (error, fileRef) => {
    if (error) {
      serverConsole(`File ${media.name} could not be uploaded`, error)
    } else {
      const metadata = { link: DynamicAssets.link(fileRef), stimuliSetId: stimSetId }
      DynamicAssets.collection.update({_id: fileRef._id}, {$set: {meta: metadata}});
    }
  });
}

// Allow file uploaded with name and contents. The type of file must be
// specified - current allowed types are: 'stimuli', 'tdf'
async function saveContentFile(type, filename, filecontents, owner, packagePath = null) {
  serverConsole('saveContentFile', type, filename, owner);
  const results = {
    'result': null,
    'errmsg': 'No action taken?',
    'action': 'None',
  };
  if (!type) throw new Error('Type required for File Save');
  if (!filename) throw new Error('Filename required for File Save');
  if (!filecontents) throw new Error('File Contents required for File Save');
  let ownerId = "";
  // We need a valid use that is either admin or teacher
  if(owner){
    ownerId = owner;
  } else {
    ownerId = Meteor.user()._id;
  }
  if (!ownerId) {
    throw new Error('No user logged in - no file upload allowed');
  }
  if (!Roles.userIsInRole(ownerId, ['admin', 'teacher'])) {
    throw new Error('You are not authorized to upload files');
  }
  if (type != 'tdf' && type != 'stim') {
    throw new Error('Unknown file type not allowed: ' + type);
  }

  try {
    if (type == 'tdf') {
      const jsonContents = typeof filecontents == 'string' ? JSON.parse(filecontents) : filecontents;
      const json = {tutor: jsonContents.tutor};
      const lessonName = _.trim(jsonContents.tutor.setspec.lessonname);
      const tips = jsonContents.tutor.setspec.tips;
      let newFormatttedTips = [];
      if(tips){
        for(const tip of tips){
          if(tip.split('<img').length > 1){
            const imageName = tip.split('<img')[1].split('src="')[1].split('"')[0];
            const image = await DynamicAssets.collection.findOne({userId: ownerId, name: imageName});
            if(image){
              const imageLink = image.meta.link;
              newFormatttedTips.push(tip.replace(imageName, imageLink));
              serverConsole('imageLink', imageLink);
            }
          }
        }
      }
      if(newFormatttedTips.length > 0){
        json.tutor.setspec.tips = newFormatttedTips;
      }
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
        const tdf = Tdfs.findOne({stimulusFileName: stimFileName});
        const stimuliSetId = tdf ? tdf.stimuliSetId : null;
        if (isEmpty(stimuliSetId)) {
          results.result = false;
          results.errmsg = 'Please upload stimulus file before uploading a TDF';
        } else {
          try {
            const rec = {'fileName': filename, 'tdfs': json, 'ownerId': ownerId, 'source': 'upload'};
            const ret = await upsertTDFFile(filename, rec, ownerId);
            if(ret && ret.res == 'awaitClientTDF'){
              serverConsole('awaitClientTDF', ret)
              results.result = false;
              results.data = ret;
            } else {
              results.result = true;
            }
          } catch (err) {
            results.result=false;
            results.errmsg=err.toString();
          }
        }
        return results;
      }
    } else if (type === 'stim') {
      const jsonContents = typeof filecontents == 'string' ? JSON.parse(filecontents) : filecontents;
      await upsertStimFile(filename, jsonContents, ownerId, packagePath);
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

async function getSourceSentences(stimuliSetId) {
  const sourceSentencesRet = itemSourceSentences.find({stimuliSetId: stimuliSetId});
  return sourceSentencesRet.sourceSentences;
}

async function getAllCourses() {
  try {
    let coursesRet = Courses.find().fetch();
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
        $unwind: {
          path: "$section"
        }
      },
      {
        $project: {
          _id: 0,
          sectionName: "$section.sectionName",
          courseId: "$_id",
          courseName: 1,
          teacherUserId: 1,
          semester: 1,
          beginDate: 1,
          sectionId: "$section._id"
        }
      }
    ]).toArray();
    return ret;
  } catch (e) {
    serverConsole('getAllCourseSections ERROR,', e);
    return null;
  }
}

async function getCourseById(courseId) {
  serverConsole('getAllCoursesById:', courseId);
  const course = Courses.findOne({courseId: courseId});
  return course;
}

async function getAllCoursesForInstructor(instructorId) {
  serverConsole('getAllCoursesForInstructor:', instructorId);
  const courses = Courses.find({teacherUserId: instructorId, semester: curSemester}).fetch();
  return courses;
}

async function getAllCourseAssignmentsForInstructor(instructorId) {
  try {
    //Postgres Reversion
    serverConsole('getAllCourseAssignmentsForInstructor:'+instructorId);
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
        foreignField: "_id",
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
    const curCourseAssignments = await Assignments.rawCollection().aggregate([{
      $lookup:{ //INNER JOIN tdf AS t ON t.TDFId = a.TDFId
        from: "tdfs",
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
      $unwind:  { path: "$course" }
    },
    {
      $unwind:  { path: "$TDF" }
    },
    {
      $match: { //WHERE c.courseid = $1
        "course._id": newCourseAssignment.courseId,
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

    const tdfNamesAndIDs = Tdfs.find().fetch();
    const tdfNameIDMap = {};
    for (const tdfNamesAndID of tdfNamesAndIDs) {
      tdfNameIDMap[tdfNamesAndID.content.fileName] = tdfNamesAndID._id;
    }

    for (const tdfName of tdfsAdded) {
      const TDFId = tdfNameIDMap[tdfName];
      serverConsole('editCourseAssignments tdf:', tdfNamesAndIDs, TDFId, tdfName, tdfsAdded, tdfsRemoved,
          curCourseAssignments, existingTdfs, newTdfs);
      Assignments.insert({courseId: newCourseAssignment.courseId, TDFId: TDFId});
    }
    for (const tdfName of tdfsRemoved) {
      const TDFId = tdfNameIDMap[tdfName];
      Assignments.remove({courseId: newCourseAssignment.courseId, TDFId: TDFId});
    }
    return newCourseAssignment;
  } catch (e) {
    serverConsole('editCourseAssignments ERROR,', newCourseAssignment, ',', e);
    return null;
  }
}

async function getTdfAssignmentsByCourseIdMap(instructorId) {
  serverConsole('getTdfAssignmentsByCourseIdMap', instructorId);
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
  serverConsole(assignmentTdfFileNamesRet)
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
  },
  {
    $project:{
      _id: 1,
    }
  }
]).toArray();
return tdfs.map(tdf => tdf._id);
}

async function getTdfNamesAssignedByInstructor(instructorID) {
  try {
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
  assignmentTdfFileNames = [...new Set(assignmentTdfFileNames.map(item => item.fileName))] // remove duplicates
    serverConsole('assignmentTdfFileNames', assignmentTdfFileNames);
    return assignmentTdfFileNames;
  } catch (e) {
    serverConsole('getTdfNamesAssignedByInstructor ERROR,', e);
    return null;
  }
}

async function getExperimentState(userId, TDFId) { // by currentRootTDFId, not currentTdfId
  const experimentStateRet = GlobalExperimentStates.findOne({userId: userId, TDFId: TDFId});
  const experimentState = experimentStateRet.experimentState;
  return experimentState;
}

// UPSERT not INSERT
async function setExperimentState(userId, TDFId, newExperimentState, where) { // by currentRootTDFId, not currentTdfId
  serverConsole('setExperimentState:', where, userId, TDFId, newExperimentState);
  const experimentStateRet = GlobalExperimentStates.findOne({userId: userId, TDFId: TDFId});
  serverConsole(experimentStateRet)
  serverConsole(newExperimentState)
  if (experimentStateRet != null) {
    const updatedExperimentState = Object.assign(experimentStateRet.experimentState, newExperimentState);
    GlobalExperimentStates.update({userId: userId, TDFId: TDFId}, {$set: {experimentState: updatedExperimentState}})
    return updatedExperimentState;
  }
  GlobalExperimentStates.insert({userId: userId, TDFId: TDFId, experimentState: newExperimentState});

  return TDFId;
}

function insertHiddenItem(userId, stimulusKC, tdfId) {
  ComponentStates.update({userId: userId, TDFId: tdfId, KCId: stimulusKC, componentType: "stimulus"}, {$set: {showItem: false}});
}

async function getUserLastFeedbackTypeFromHistory(tdfID) {
  const userHistory =  Histories.findOne({TDFId: tdfID, userId: Meteor.userId}, {sort: {time: -1}})?.feedbackType
  let feedbackType = 'undefined';
  if( userHistory && userHistory.feedbackType ) {
    feedbackType = userHistory.feedbackType;
  } 
  return feedbackType;
}
async function insertHistory(historyRecord) {
  const tdfFileName = historyRecord['Condition_Typea'];
  const dynamicTagFields = await getListOfStimTags(tdfFileName);
  const eventId = Histories.findOne({}, {limit: 1, sort: {eventId: -1}})?.eventId + 1 || 1;
  historyRecord.eventId = eventId
  historyRecord.dynamicTagFields = dynamicTagFields || [];
  historyRecord.recordedServerTime = (new Date()).getTime();
  serverConsole('insertHistory', historyRecord);
  Histories.insert(historyRecord)
}

async function getHistoryByTDFID(TDFId) {
  const history = Histories.find({TDFId: TDFId}).fetch();
  return history;
}

async function getUserRecentTDFs(userId) {
  const history = Histories.find({userId: userId}, {sort: {time: -1}, limit: 5}).fetch();
  //get all tdfs that match the history
  const recentTDFs = [];
  for (const historyRecord of history) {
    const tdf = Tdfs.findOne({_id: historyRecord.TDFId});
    recentTDFs.push(tdf);
  }
  return recentTDFs;
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

  const existingMappingCount = SectionUserMap.find({sectionId: sectionId, userId: userId}).count();
  serverConsole('existingMapping', existingMappingCount);
  if (existingMappingCount == 0) {
    serverConsole('new user, inserting into section_user_mapping', [sectionId, userId]);
    SectionUserMap.insert({sectionId: sectionId, userId: userId});
  }

  return true;
}

async function getStimDisplayTypeMap() {
  try {
    serverConsole('getStimDisplayTypeMap');
    const tdfs = await Tdfs.find().fetch();
    const items = tdfs.map((tdf) => tdf.stimuli).flat();
    let map = {};
    for(let item of items){
      if(!item) continue;
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
    serverConsole('getStimDisplayTypeMap', map);
    return map;
  } catch (e) {
    serverConsole('getStimDisplayTypeMap ERROR,', e);
    return null;
  }
}

function getClassPerformanceByTDF(classId, tdfId, date=false) {
  serverConsole('getClassPerformanceByTDF', classId, tdfId, date);
  const sections = Sections.find({courseId: classId}).fetch();
  const sectionIds = sections.map((section) => section._id);
  const userIds = SectionUserMap.find({sectionId: {$in: sectionIds}}).fetch().map((user) => user.userId);
  const performanceMet = [];
  const performanceNotMet = [];
  if(!date){
    curDate = new Date();
    date = curDate.getTime();
  }
  const res1 = Histories.find({userId: {$in: userIds}, TDFId: tdfId}).fetch();
  for(let history of res1){
    var outcome = 0;
    if(history.outcome === "correct"){
      outcome = 1;
    }
    var exception = false;
    var exceptions = Meteor.users.findOne({_id: history.userId}).profile.dueDateExceptions || [];
    var exceptionRawDate = false;
    if(exceptions.findIndex((item) => item.tdfId == tdfId && item.classId == classId) !== -1){
      var exceptionRaw = exceptions.find((item) => item.tdfId == tdfId && item.classId == classId).date;
      var exceptionRawDate = new Date(exceptionRaw).getTime();
      exception = new Date(exceptionRaw).toLocaleDateString();
    }
    if(history.recordedServerTime < date || history.recordedServerTime < exceptionRawDate){
      index = performanceMet.findIndex((item) => item.userId == history.userId);
      if(index == -1){
        performanceMet.push({
          userId: history.userId,
          count: 0
        });
        index = performanceMet.length - 1;
      }
      performanceMet[index].username = Meteor.users.findOne({_id: history.userId}).username;
      performanceMet[index].count  = performanceMet[index].count + 1;
      performanceMet[index].numCorrect = performanceMet[index].numCorrect + outcome || outcome;
      performanceMet[index].numIncorrect = performanceMet[index].numIncorrect + (1 - outcome) || outcome;
      performanceMet[index].percentCorrect = ((performanceMet[index].numCorrect / performanceMet[index].count)*100).toFixed(2) + '%';
      performanceMet[index].totalTime = performanceMet[index].totalTime + history.CFEndLatency + history.CFFeedbackLatency || history.CFEndLatency + history.CFFeedbackLatency;
      performanceMet[index].totalTimeMins = (performanceMet[index].totalTime / 60000).toFixed(3);
      performanceMet[index].exception = exception;
    } else {
      index = performanceNotMet.findIndex((item) => item.userId == history.userId);
      if(index == -1){
        performanceNotMet.push({
          userId: history.userId,
          count: 0
        });
        index = performanceNotMet.length - 1;
      }
      performanceNotMet[index].username = Meteor.users.findOne({_id: history.userId}).username;
      performanceNotMet[index].count  = performanceNotMet[index].count + 1;
      performanceNotMet[index].numCorrect = performanceNotMet[index].numCorrect + outcome || outcome;
      performanceNotMet[index].numIncorrect = performanceNotMet[index].numIncorrect + (1 - outcome) || outcome;
      performanceNotMet[index].percentCorrect = ((performanceMet[index].numCorrect / performanceMet[index].count)*100).toFixed(2) + '%';
      performanceNotMet[index].totalTime = performanceNotMet[index].totalTime || history.time;
      performanceNotMet[index].totalTimeMins = parseInt(history.time) / 60000;
      performanceNotMet[index].exception = exception;
    }
  }
  return [performanceMet, performanceNotMet];
};

function addUserDueDateException(userId, tdfId, classId, date){
  serverConsole('addUserDueDateException', userId, tdfId, date);
  exception = {
    tdfId: tdfId,
    classId: classId,
    date: date,
  }
  user = Meteor.users.findOne({_id: userId});
  if(user.profile.dueDateExceptions){
    user.profile.dueDateExceptions.push(exception);
  }
  else{
    user.profile.dueDateExceptions = [exception];
  }
  Meteor.users.update({_id: userId}, user);
}

async function checkForUserException(userId, tdfId){
  serverConsole('checkForUserException', userId, tdfId);
  user = Meteor.users.findOne({_id: userId});
  if(user.profile.dueDateExceptions){
    var exceptions = user.profile.dueDateExceptions;
    var exception = exceptions.find((item) => item.tdfId == tdfId);
    if(exception){
      exceptionDate = new Date(exception.date);
      exceptionDateReadable = exceptionDate.toLocaleDateString();
      return exceptionDateReadable;
    }
  }
  return false;
}

function removeUserDueDateException(userId, tdfId){
  serverConsole('removeUserDueDateException', userId, tdfId);
  user = Meteor.users.findOne({_id: userId});
  if(user.profile.dueDateExceptions){
    exceptionIndex = user.profile.dueDateExceptions.findIndex((item) => item.tdfId == tdfId);
    if(exceptionIndex > -1){
      user.profile.dueDateExceptions.splice(exceptionIndex, 1);
    } else {
      serverConsole('removeUserDueDateException ERROR, no exception found', userId, tdfId);
    }
  }
  Meteor.users.update({_id: userId}, user);
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

async function getListOfStimTagsByTDFFileNames(TDFFileNames){
  const allTagsInStimFile = new Set();

  for (const TDFFileName of TDFFileNames){
    const TDF = await getTdfByFileName(TDFFileName);
    const stimSetId = TDF.stimuliSetId;
    const stims = await getStimuliSetById(stimSetId);

    for (const stim of stims) {
      if (stim.tags) {
        for (const tagName of Object.keys(stim.tags)) {
          allTagsInStimFile.add(tagName);
        }
      }
    }
  }
  return Array.from(allTagsInStimFile);
}

async function getStimuliSetById(stimuliSetId) {
  return Tdfs.rawCollection().aggregate([
    {
      $match: { stimuliSetId: stimuliSetId }
    }, {
      $unwind: { path: "$stimuli" }
    }, {
      $replaceRoot: { newRoot: "$stimuli" }
    }, {
      $sort: { stimulusKC: 1 }
    }]).toArray();
}

async function getStimuliSetByFileName(stimulusFileName) {
  return Tdfs.rawCollection.aggregate([
    {
      $match: { stimulusFileName: stimulusFileName }
    }, {
      $unwind: { path: "$stimuli" }
    }, {
      $replaceRoot: { newRoot: "$stimuli" }
    }, {
      $sort: { stimulusKC: 1 }
    }]).toArray();
}

async function getStimuliSetIdByFilename(stimFilename) {
  idRet = Tdfs.findOne({stimulusFileName: stimFilename});
  const stimuliSetId = idRet ? idRet.stimuliSetId : null;
  return stimuliSetId;
}

async function getStimCountByStimuliSetId(stimuliSetId) {
  // PostgresReversion Staged
  let ret = await getStimuliSetById(stimuliSetId);
  return ret.count;
}

async function getStimSetFromLearningSessionByClusterList(stimuliSetId, clusterList){
  serverConsole('getStimSetFromLearningSessionByClusterList', stimuliSetId, clusterList);
  const itemRet = await getStimuliSetById(stimuliSetId);
  let learningSessionItem = [];
  for(let item of itemRet){
    if(clusterList.includes(item.clusterKC) && learningSessionItem.includes(item.stimulusKC) === false){
      learningSessionItem.push(item.stimulusKC);
    }
  }
  return learningSessionItem;
}

async function getStudentPerformanceByIdAndTDFId(userId, TDFId, stimIds=null) {
  serverConsole('getStudentPerformanceByIdAndTDFId', userId, TDFId, stimIds);
  const innerQuery = {
    userId: userId,
    TDFId: TDFId,
    componentType: 'stimulus',
  };

  if (stimIds) {
    innerQuery.KCId = {$in: stimIds};
  }

  const query = [{
    $match: innerQuery,
  },
  {
    $addFields: {
      introduced: {
        $cond: {
          if: {$or: ['$priorCorrect', '$priorIncorrect']},
          then: 1,
          else: 0,
        },
      },
      totalStimCount: 1,
    },
  },
  {
    $group: {
      _id: null,
      totalStimCount: {$sum: '$totalStimCount'},
      numCorrect: {$sum: '$priorCorrect'},
      numIncorrect: {$sum:  '$priorIncorrect'},
      totalPracticeDuration: {$sum: '$totalPracticeDuration'},
      allTimeNumCorrect: {$sum: '$allTimeCorrect'},
      allTimeNumIncorrect: {$sum: '$allTimeIncorrect'},
      allTimePracticeDuration: {$sum: '$allTimeTotalPracticeDuration'},
      stimsIntroduced: {$sum: '$introduced'},
      count: {$sum: '$timesSeen'},
    },
  },
  {
    $addFields: {
      count: {$sum: ['$priorCorrect', '$priorIncorrect', '$count']}
    },
  },
  {
    $project: {
      _id: 0,
    },
  }];

  const studentPerformance = await ComponentStates.rawCollection().aggregate(query).toArray();
  if (!studentPerformance[0]) return null;
  // serverConsole('query', query);
  // serverConsole('studentPerformance', studentPerformance[0]);
  return studentPerformance[0];
}

async function getStudentPerformanceByIdAndTDFIdFromHistory(userId, TDFId, returnRows=null) {
  // used to grab a limited sample of the student's performance
  // serverConsole('getStudentPerformanceByIdAndTDFIdFromHistory', userId, TDFId, returnRows);
  const query = [
    {
      $match: {userId: userId, TDFId: TDFId, levelUnitType: 'model'},
    },
    {
      $addFields: {
        correct: {
          $cond: {
            if: {$eq: ['$outcome', 'correct']},
            then: 1,
            else: 0,
          },
        },
        incorrect: {
          $cond: {
            if: {$eq: ['$outcome', 'incorrect']},
            then: 1,
            else: 0,
          },
        },
        practiceDuration: {$sum: ['$CFFeedbackLatency', '$CFEndLatency']},
      },
    },
    {
      $group: {
        _id: '$KCId',
        numCorrect: {$sum: '$correct'},
        numIncorrect: {$sum: '$incorrect'},
        practiceDuration: {$sum: '$practiceDuration'},
      },
    },
    {
      $addFields: {
        introduced: 1,
      },
    },
    {
      $group: {
        _id: null,
        numCorrect: {$sum: '$numCorrect'},
        numIncorrect: {$sum: '$numIncorrect'},
        stimsIntroduced: {$sum: '$introduced'},
        practiceDuration: {$sum: '$practiceDuration'},
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ];

  if (returnRows) {
    query.splice(1, 0, {$limit: returnRows});
    query.splice(1, 0, {$sort: {time: -1}});
  }
  const studentPerformance = await Histories.rawCollection().aggregate(query).toArray();
  if (!studentPerformance[0]) return null;

  studentPerformance[0].totalStimCount = await ComponentStates.find({userId: userId, TDFId: TDFId, componentType: 'stimulus'}).count();
  return studentPerformance[0];
}

async function getNumDroppedItemsByUserIDAndTDFId(userId, TDFId){
  //used to grab a limited sample of the student's performance
  serverConsole('getNumDroppedItemsByUserIDAndTDFId', userId, TDFId);
  const count = Histories.find({userId: userId, TDFId: TDFId, CFItemRemoved: true, levelUnitType: 'model'}).count();
  return count;
}

async function getStudentPerformanceForClassAndTdfId(instructorId, date=null) {
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
  const tdfRet = GlobalExperimentStates.find({userId: userId}).fetch();

  const tdfsAttempted = [];
  for (const obj of tdfRet) {
    const TDFId = obj.TDFId;
    const tdf = await getTdfById(TDFId)
    if (!tdf) continue; // Handle a case where user has data from a no longer existing tdf
    const tdfObject = tdf.content;
    if (!tdfObject.tdfs.tutor.unit) continue;// TODO: fix root/condition tdfs
    if (!tdfObject.tdfs.tutor.setspec.progressReporterParams) continue; // Don't display tdfs without progressReporterParams
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
        //make a nice email body for the user who reported the error
        textIndividual = 'Hi ' + userWhoReportedErrorUsername + ', \n\n' +
                          'Thank you for reporting an error on ' + thisServerUrl + '. ' +
                          'We have received your error report and will investigate it. ' +
                          'If you have any additional information that you think might be helpful, ' +
                          'please reply to this email. \n\n' +
                          'Error details: \n' +
                          'Page: ' + unsentErrorReport.page + '\n' +
                          'Time: ' + unsentErrorReport.time + '\n' +
                          'Description: ' + unsentErrorReport.description + '\n' +
                          'User Agent: ' + unsentErrorReport.userAgent + '\n\n' +
                          'Thanks again for your help! \n\n' +
                          'The Mofacts Team';
        // text for the all errors report
        text = text + 'User: ' + userWhoReportedErrorUsername + ', page: ' + unsentErrorReport.page +
               ', time: ' + unsentErrorReport.time + ', description: ' + unsentErrorReport.description +
               ', userAgent: ' + unsentErrorReport.userAgent + ' \n';
        //send email to user who reported error and to admin
        try{
          //check if user has an email address
          if (userWhoReportedError.emails.length > 0 ) {
            toIndividual = userWhoReportedError.emails[0].address + ', ' + admin;
          subjectIndividual = 'Mofacts Error Report - ' + thisServerUrl;
          sentErrorReports.add(unsentErrorReport._id);
          sendEmail(toIndividual, admin, subjectIndividual, textIndividual);
          }
        }
        catch (err) {
          serverConsole(err);
        }
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

function sendEmail(to, from, subject, text) {
  check([to, from, subject, text], [String]);
  Email.send({to, from, subject, text});
}

function hasGeneratedTdfs(TDFjson) {
  return TDFjson.tdfs.tutor.generatedtdfs && TDFjson.tdfs.tutor.generatedtdfs.length;
}

// TODO rework for input in a new format as well as the current assumption of the old format
async function upsertStimFile(stimulusFileName, stimJSON, ownerId, packagePath = null) {

  let formattedStims = [];

  if(packagePath){
    packagePath = packagePath.split('/')[0];
  }
  const responseKCMap = await getResponseKCMap();
  let stimuliSetId = Tdfs.findOne({"content.tdfs.tutor.setspec.stimulusfile": stimulusFileName})?.stimuliSetId
  if (!stimuliSetId) {
    stimuliSetId = nextStimuliSetId;
    nextStimuliSetId += 1;
  }
  serverConsole('getAssociatedStimSetIdForStimFile', stimulusFileName, stimuliSetId);
  
  const oldStimFormat = {
    'fileName': stimulusFileName,
    'stimuli': stimJSON,
    'owner': ownerId,
    'source': 'repo',
  };
  await Items.remove({stimuliSetId: stimuliSetId})
  const newStims = getNewItemFormat(oldStimFormat, stimulusFileName, stimuliSetId, responseKCMap);
  let maxStimulusKC = 0;
  serverConsole('!!!newStims:', newStims);
  for (const stim of newStims) {
    if(stim.stimulusKC > maxStimulusKC){
      maxStimulusKC = stim.stimulusKC;
    }
    let curAnswerSylls
    stim.syllables = curAnswerSylls;
    if(stim.imageStimulus && stim.imageStimulus.split('http').length == 1){
      //image is not a url
      const imageFilePathArray = stim.imageStimulus.split('/');
      const imageFileName = imageFilePathArray[imageFilePathArray.length - 1];
      serverConsole('grabbing link for image', imageFileName);
      const image = await DynamicAssets.findOne({name: imageFileName, userId: ownerId});
      const imageLink = image.meta.link;
      stim.imageStimulus = imageLink;
    }
    formattedStims.push(stim);
  }
  Tdfs.upsert({"content.tdfs.tutor.setspec.stimulusfile": stimulusFileName}, {$set: {
    stimulusFileName: stimulusFileName,
    stimuliSetId: stimuliSetId, 
    rawStimuliFile: stimJSON, //raw stimuli
    stimuli: formattedStims, //formatted stimuli for use in the app
  }});
}



async function upsertTDFFile(tdfFilename, tdfJSON, ownerId, packagePath = null) {
  serverConsole('upsertTDFFile', tdfFilename);
  serverConsole('tdfJSON', tdfJSON);
  let stimulusFileName = tdfJSON.tdfs.tutor.setspec.stimulusfile;
  let Tdf = tdfJSON.tdfs;
  let lessonName = _.trim(Tdf.tutor.setspec.lessonname);
  let stimuliSetId = Tdfs.findOne({stimulusFileName: stimulusFileName})?.stimuliSetId
  if (!stimuliSetId) {
    stimuliSetId = nextStimuliSetId;
    nextStimuliSetId += 1;
  }
  if (lessonName.length < 1) {
    results.result = false;
    results.errmsg = 'TDF has no lessonname - it cannot be valid';

    return results;
  }
  const tips = Tdf.tutor.setspec.tips;
  let newFormatttedTips = [];
  if(tips){
    for(const tip of tips){
      if(tip.split('<img').length > 1){
        const imageName = tip.split('<img')[1].split('src="')[1].split('"')[0];
        const image = await DynamicAssets.findOne({userId: ownerId, name: imageName});
        if(image){
          const imageLink = image.link();
          newFormatttedTips.push(tip.replace(imageName, imageLink));
          serverConsole('imageLink', imageLink);
        }
      }
    }
  }
  if(newFormatttedTips.length > 0){
    Tdf.tutor.setspec.tips = newFormatttedTips;
  }
  tdfJSON = {'fileName': tdfFilename, 'tdfs': Tdf, 'ownerId': ownerId, 'source': 'upload'};
  const prev = await getTdfByFileName(tdfFilename);
  let tdfJSONtoUpsert;
  if (prev && prev._id) {
    formattedStims = prev.formattedStims;
    serverConsole('updating tdf', tdfFilename, formattedStims);
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', formattedStims);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      delete generatedTdf.createdAt;
      tdfJSONtoUpsert = generatedTdf;
    } else {
      tdfJSONtoUpsert = tdfJSON;
    }
    let updateObj = {
      _id: prev._id,
      ownerId: ownerId,
      stimuliSetId: stimuliSetId,
      content: tdfJSONtoUpsert
    }
    if(prev.content.tdfs.tutor.setspec.shuffleclusters != tdfJSON.tdfs.tutor.setspec.shuffleclusters){
      serverConsole('sufflecluster changed, alerting user');
      return {res: 'awaitClientTDF', TDF: updateObj}
    } else {
      Tdfs.update({_id: prev._id},{$set:updateObj});
    }
  } else {
    formattedStims = [];
    serverConsole('inserting tdf', tdfFilename, formattedStims);
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', formattedStims);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      tdfJSONtoUpsert = generatedTdf;
    } else {
      tdfJSON.createdAt = new Date();
      tdfJSONtoUpsert = tdfJSON;
    }
  }
  Tdfs.upsert({stimuliSetId: stimuliSetId}, {$set: {
    tdfFileName: tdfFilename,
    path: packagePath,
    content: tdfJSONtoUpsert,
    ownerId: ownerId,
    visibility: 'profileOnly'
  }});
}

function tdfUpdateConfirmed(updateObj){
  serverConsole('tdfUpdateConfirmed', updateObj);
  Tdfs.update({_id: updateObj._id},{$set:updateObj});
}

function setUserLoginData(entryPoint, loginMode, curTeacher = undefined, curClass = undefined, assignedTdfs = undefined){
  serverConsole(Meteor.userId());
  let query = { 
    'profile.entryPoint': entryPoint,
    'profile.curTeacher': curTeacher,
    'profile.curClass': curClass,
    'profile.loginMode': loginMode,
    'profile.assignedTdfs': assignedTdfs
  };
  if(Meteor.userId()){
    Meteor.users.update(Meteor.userId(), { $set: query })
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
          serverConsole(Buffer.concat(chunks).toString());
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

function getSyllablesForWord(word) {
  const syllablesURL = baseSyllableURL + word;
  const result = HTTP.call('GET', syllablesURL);
  const syllableArray = result.content.replace(/\[|\]/g, '').split(',').map((x) => x.trim());
  return syllableArray;
}

const methods = {
  getMatchingDialogueCacheWordsForAnswer, getAllTeachers, getUserIdforUsername, getClassPerformanceByTDF, 

  removeUserDueDateException, insertHiddenItem, setUserLoginData, addUserDueDateException,

  generateContent: function( percentage, stringArrayJsonOption, inputText ) {
    if(Meteor.user() && Meteor.user().emails[0] || Meteor.isDevelopment){
      ClozeAPI.GetSelectClozePercentage(percentage, stringArrayJsonOption, null, inputText).then((result) => {
        let message;
        let subject;
        let file;
        if(result.tag == 1) {
          message = "Cloze Error: " + result;
          subject = "Could not generate stimulus.";
        } else {
          message = "Cloze Generation Complete, your file is attached.";
          subject = "Cloze Generation Complete";
          file = {
            filename: "cloze.json",
            content: JSON.stringify(result.fields[0], null, 4),
            contentType: 'application/json'
          }
        }
        Email.send({
          to: Meteor.user().emails[0].address,
          from: Meteor.settings.owner,
          subject: subject,
          text: message,
          attachments: [file]
        });
      }).catch((err) => {
        serverConsole('err', err);
      });
    }
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

  sendErrorReportSummaries: function() {
    sendErrorReportSummaries();
  },
  sendEmail: function(to, from, subject, text) {
    this.unblock();
    sendEmail(to, from, subject, text);
  },

  sendPasswordResetEmail: function(email){
    serverConsole("sending password reset code for ", email)
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

  getAccessorsTDFID: function(TDFId){
    const tdf = Tdfs.findOne({_id: TDFId});
    if(tdf){
      const accessors = tdf.accessors || [];
      return accessors;
    } else {
      return [];
    }
  },

  getAccessors: function(TDFId){
    const accessors = Meteor.users.find({'accessedTDFs': TDFId}).fetch();
    return accessors;
  },

  getAccessableTDFSForUser: function(userId){
    serverConsole('getAccessableTDFSForUser', userId);
    const accessableTDFs = Meteor.users.findOne({_id: userId}).accessedTDFs || [];
    const TDFs = Tdfs.find({_id: {$in: accessableTDFs}}).fetch();
    return {accessableTDFs, TDFs};
  },

  getAssignableTDFSForUser: function(userId){
    serverConsole('getAssignableTDFSForUser', userId);
    const assignableTDFs = Tdfs.find({$or: [{ownerId: userId}, {accessors: {$elemMatch: {userId: userId}}}]}).fetch();
    return assignableTDFs;
  },

  assignAccessors: function(TDFId, accessors, revokedAccessors){
    serverConsole('assignAccessors', TDFId, accessors, revokedAccessors)
    Tdfs.update({_id: TDFId}, {$set: {'accessors': accessors}});
    const userIds = accessors.map((x) => x.userId);
    Meteor.users.update({'_id': {$in: userIds}}, {$addToSet: {'accessedTDFs': TDFId}}, {multi: true});
    Meteor.users.update({'_id': {$in: revokedAccessors}}, {$pull: {'accessedTDFs': TDFId}}, {multi: true});
  },

  transferDataOwnership: function(fileId, fileType, newOwnerId, oldOwnerId){
    let query;
    if(fileType == 'TDF'){
      query = Roles.userIsInRole(oldOwnerId, 'admin') ? {_id: fileId} : {_id: fileId, ownerId: oldOwnerId};
    } else { 
      fileId = parseInt(fileId);
      query = Roles.userIsInRole(oldOwnerId, 'admin') ? {stimuliSetId: fileId} : {stimuliSetId: fileId, owner: oldOwnerId};
    }
    if(oldOwnerId && newOwnerId){
      serverConsole('transferring data ownership for', fileType, fileId, 'to', newOwnerId);
      if(fileType == 'TDF')
        Tdfs.update(query, {$set: {'ownerId': newOwnerId}})
      else
        Stims.update(query, {$set: {'owner': newOwnerId}})
    } else {
        serverConsole(`transferDataOwnership failed, ${fileType} or newOwner not found`);
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

  //setUserTheme - sets the user's theme in profile
  setUserTheme: function(theme) {
    console.log('setUserTheme', theme);
    Meteor.users.update(Meteor.userId(), { $set: { 'profile.theme': theme }});
    //verify that the theme was set
  },

  //Impersonate User
  impersonate: function(userId) {
    check(userId, String);
    if (!Meteor.users.findOne(userId)) {
      throw new Meteor.Error(404, 'User not found');
    }
    Meteor.users.update(this.userId, { $set: { 'profile.impersonating': userId }});
    this.setUserId(userId);
  },

  clearLoginData: function(){
    let query = { 
      'profile.entryPoint': null, 
      'profile.curTeacher': null, 
      'profile.curClass': null,
      'profile.loginMode': null
    };
    Meteor.users.update(Meteor.userId(), { $set: query })
  },

  clearImpersonation: function(){
    Meteor.users.update(this.userId, { $set: { 'profile.impersonating': false }});
    return;
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

  setUserSessionId: function(sessionId, sessionIdTimestamp) {
    const userID = Meteor.userId();
    Meteor.users.update(userID, {$set: {'profile.lastSessionId': sessionId, 'profile.lastSessionIdTimestamp': sessionIdTimestamp}});
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

  deleteTDFFile: function(tdfId){
    serverConsole("Remove TDF File:", tdfId);
    let TDF = Tdfs.findOne({_id: tdfId, ownerId: Meteor.userId()});
    if(TDF){
      ComponentStates.remove({TDFId: tdfId});
      Assignments.remove({TDFId: tdfId});
      Histories.remove({TDFId: tdfId});
      GlobalExperimentStates.remove({TDFId: tdfId});
      Tdfs.remove({_id: tdfId});
    } else {
      result = 'No matching tdf file found';
      return result;
    }
    result = "TDF deleted";
    return result;
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

  downloadStimFile: function(stimuliSetId) {
    serverConsole('downloadStimFile: ' + stimuliSetId);
    stimuliSetId = parseInt(stimuliSetId);
    let stims = Stims.find({'stimuliSetId': stimuliSetId}).fetch();
    return stims;
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
  

  removeAssetById: function(assetId) {
    DynamicAssets.remove({_id: assetId});
  },

  toggleTdfPresence: function(tdfIds, mode) {
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

  setVerbosity: function(level) {
    level = parseInt(level);
    verbosityLevel = level;
    serverConsole('Verbose logging set to ' + verbosityLevel);
  },

  getVerbosity: function() {
    return verbosityLevel
  },

  getTdfsByOwnerId: (ownerId) => {
    const tdfs = Tdfs.find({'ownerId': ownerId}).fetch();
    return tdfs || [];
  },

  getStimsByOwnerId: (ownerId) => {
    serverConsole('getStimsByOwnerId: ' + ownerId);
    const stims = Stims.find({'owner': ownerId}).fetch();
    for(let stim of stims) {
      let lessonName = Tdfs.findOne({stimuliSetId: stim.stimuliSetId}).content.tdfs.tutor.setspec.lessonname
      stim.lessonName = lessonName
    }
    return stims || [];
  },
}

const asyncMethods = {
  getAllTdfs, getTdfByFileName, getTdfByExperimentTarget, getTdfIDsAndDisplaysAttemptedByUserId,

  getStimDisplayTypeMap, getStimuliSetById, getSourceSentences, 

  getAllCourses, getAllCourseSections, getAllCoursesForInstructor, getAllCourseAssignmentsForInstructor,

  addCourse, editCourse, editCourseAssignments, addUserToTeachersClass, saveContentFile,

  getTdfNamesAssignedByInstructor, getTdfsAssignedToStudent, getTdfAssignmentsByCourseIdMap,

  getStudentPerformanceByIdAndTDFId, getStudentPerformanceByIdAndTDFIdFromHistory, getNumDroppedItemsByUserIDAndTDFId,
  
  getStudentPerformanceForClassAndTdfId, getStimSetFromLearningSessionByClusterList,

  getExperimentState, setExperimentState, getStimuliSetByFileName, getMaxResponseKC,

  getProbabilityEstimatesByKCId, getResponseKCMap, processPackageUpload, setComponentStatesByUserIdTDFIdAndUnitNum,

  insertHistory, getHistoryByTDFID, getUserRecentTDFs, clearCurUnitProgress, tdfUpdateConfirmed,

  loadStimsAndTdfsFromPrivate, getListOfStimTags, getUserLastFeedbackTypeFromHistory,

  checkForUserException, 
  
  makeGoogleTTSApiCall: async function(TDFId, message, audioPromptSpeakingRate, audioVolume, selectedVoice) {
    const ttsAPIKey = await getTdfTTSAPIKey(TDFId);
    const request = JSON.stringify({
      input: {text: message},
      voice: {languageCode: 'en-US', 'name': selectedVoice},
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
  
  setLockoutTimeStamp: async function(lockoutTimeStamp, lockoutMinutes, currentUnitNumber, TDFId) {
    serverConsole('setLockoutTimeStamp', lockoutTimeStamp, lockoutMinutes, currentUnitNumber, TDFId);
    const lockout = {
      [`profile.lockouts.${TDFId}.lockoutTimeStamp`]: lockoutTimeStamp,
      [`profile.lockouts.${TDFId}.lockoutMinutes`]: lockoutMinutes,
      [`profile.lockouts.${TDFId}.currentLockoutUnit`]: currentUnitNumber
    }
    Meteor.users.update(Meteor.userId(), { 
      $set: lockout
    });
  },

  makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey = '', request, answerGrammar){
    serverConsole('makeGoogleSpeechAPICall', TDFId, speechAPIKey, request, answerGrammar);
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
    ComponentStates.update({userId: userId, TDFId: TDFId}, {$set: {curSessionPriorCorrect: 0, curSessionPriorIncorrect: 0}});
  },


  updateStimSyllables: async function(stimuliSetId) {
    serverConsole('updateStimSyllables');
    const stimuli = await Tdfs.rawCollection().aggregate([
      {
        $match: { stimuliSetId: stimuliSetId }
      }, {
        $unwind: { path: "$stimuli" }
      }, {
        $replaceRoot: { newRoot: "$stimuli" }
      }]).toArray();
    
    if (stimuli) {
      serverConsole(stimuli);
      const answerSyllableMap = {};
      for (const i in stimuli) {
        const stim = stimuli[i];
        if(!stim.syllables){
          let syllableArray;
          const answer = stim.correctResponse;
          const safeAnswer = answer.replace(/\./g, '_').split('~')[0];
          try{
            if(!answerSyllableMap[safeAnswer]){
              serverConsole('fetching syllables for ' + safeAnswer);
              answerSyllableMap[safeAnswer] = getSyllablesForWord(safeAnswer);
            }
            syllableArray = answerSyllableMap[safeAnswer]
          }
          catch (e) {
            serverConsole('error fetching syllables for ' + answer + ': ' + JSON.stringify(e));
            syllableArray = [answer];
            syllableGenerationError = e;
          }
          stimuli[i].syllables = syllableArray;
        }
      }
      Tdfs.update({'stimuliSetId': stimuliSetId}, {$set: {'stimuli': stimuli}});
      serverConsole('after updateStimSyllables');
      serverConsole(stimuliSetId);
    }
  },

  getSymSpellCorrection: async function(userAnswer, s2, maxEditDistance = 1) {
    serverConsole('getSymSpellCorrection', userAnswer, s2, maxEditDistance);
    let corrections; 
    if(userAnswer.split(' ').length == 1)
      corrections = symSpell.lookup(userAnswer, 2, maxEditDistance);
    else
      corrections = symSpell.lookupCompound(userAnswer, maxEditDistance);
    serverConsole(corrections)
    
    const words = corrections.map( correction => correction.term );
    for(let word of words){
      if(word.localeCompare(s2) === 0) {
        return true;
      }
    }
    return false;
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

  //handle file deletions

  deleteAllFiles: async function(){
    serverConsole('delete all uploaded files');
    DynamicAssets.remove({});
    filesLength = DynamicAssets.find().fetch().length;
    return filesLength;
  },
  deleteStimFile: async function(stimSetId) {
    stimSetId = parseInt(stimSetId);
    let stim = Stims.findOne({stimuliSetId: stimSetId, owner: Meteor.userId()})
    if(stim){
      let tdfs = Tdfs.find({stimuliSetId: stimSetId}).fetch();
      serverConsole(tdfs);
      for(let tdf of tdfs) {
        tdfId = tdf._id;
        GlobalExperimentStates.remove({TDFId: tdfId});
        ComponentStates.remove({TDFId: tdfId});
        Assignments.remove({TDFId: tdfId});
        Histories.remove({TDFId: tdfId});
      }
      Items.remove({stimuliSetId: stimSetId});
      Tdfs.remove({stimuliSetId: stimSetId});
      Stims.remove({stimuliSetId: stimSetId});
      res = "Stim and related TDFS deleted.";
      return res;
    } else {
      res = "Stim not found.";
      return res;
    }
  },
}

// Server-side startup logic
Meteor.methods(functionTimerWrapper(methods, asyncMethods));

Meteor.startup(async function() {
  //await combineStimAndTdfFiles();
  highestStimuliSetId = Tdfs.findOne({}, {sort: {stimuliSetId: -1}, limit: 1 });
  nextStimuliSetId = highestStimuliSetId && highestStimuliSetId.stimuliSetId ? parseInt(highestStimuliSetId.stimuliSetId) + 1 : 1;

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
  const ret = Tdfs.find().count();
  if (ret == 0) loadStimsAndTdfsFromPrivate(adminUserId);

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
  
  if (true) { //Meteor.isProduction) {
    SyncedCron.add({
      name: 'Period Email Sent Check',
      schedule: function(parser) {
        return parser.text('every 1 minutes');
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
  }
  
  //email admin that the server has restarted
  if (ownerEmail && Meteor.isProduction) {
    const versionFile = Assets.getText('versionInfo.json');
    const version = JSON.parse(versionFile);
    server = Meteor.absoluteUrl().split('//')[1];
    server = server.substring(0, server.length - 1);
    subject = `MoFaCTs Deployed on ${server}`;
    text = `The server has restarted.\nServer: ${server}\nVersion: ${JSON.stringify(version, null, 2)}`;
    sendEmail(ownerEmail, ownerEmail, subject, text)
  }
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

    serverConsole(tdfNames);
    response.write(await createExperimentExport(tdfNames, uid));

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

    response.write(await createExperimentExport(tdfFileNames, userId));

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

    const fileName = exp.split('.json')[0] + '-data.txt';

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    response.write(await createExperimentExport(exp, userId));
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
