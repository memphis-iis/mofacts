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
import { all } from 'bluebird';


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

console.log('Starting server');
if (process.env.METEOR_SETTINGS_WORKAROUND) {
  console.log('METEOR_SETTINGS_WORKAROUND is set to ' + process.env.METEOR_SETTINGS_WORKAROUND);
  //check if process.env.METEOR_SETTINGS_WORKAROUND is a path
  if (fs.existsSync(process.env.METEOR_SETTINGS_WORKAROUND)) {
    serverConsole('loading settings from ' + process.env.METEOR_SETTINGS_WORKAROUND);
    Meteor.settings = JSON.parse(fs.readFileSync(process.env.METEOR_SETTINGS_WORKAROUND, 'utf8'));
  } else {
    serverConsole('METEOR_SETTINGS_WORKAROUND is not a path');
    Meteor.settings = JSON.parse(process.env.METEOR_SETTINGS_WORKAROUND);
  }
}
if (Meteor.settings.public.testLogin) {
  process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
  serverConsole('dev environment, allow insecure tls');
}
// if Meteor settings specifies a syllableURL, use it. Otherwise check if Meteor.isProduction and use the appropriate URL, otherwise use the dev URL
const syllableURL = Meteor.settings.syllableURL ? Meteor.settings.syllableURL : Meteor.isProduction ? 'http://syllables:4567/syllables/' : 'http://localhost:4567/syllables/';



let highestStimuliSetId;
let nextStimuliSetId;
let nextEventId = 1;
let stimDisplayTypeMap = {};

// How large the distance between two words can be to be considered a match. Larger values result in a slower search. Defualt is 2.
const maxEditDistance = Meteor.settings.SymSpell.maxEditDistance ? parseInt(Meteor.settings.SymSpell.maxEditDistance) : 2;
// How big the prefix used for indexing is. Larger values will be result in a faster search, but will use more memory. Default is 7.
const prefixLength = Meteor.settings.SymSpell.prefixLength ? parseInt(Meteor.settings.SymSpell.prefixLength) : 7;
const symSpell = new SymSpell(maxEditDistance, prefixLength);
//get the path to the dictionary in /public/dictionaries
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
    tdf = Tdfs.findOne({"content.tdfs.tutor.setspec.experimentTarget": {$regex: experimentTarget, $options: 'i'}});
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

async function updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds) {
  serverConsole('updateProbabilityEstimates', TDFId);
  const probEstimates = ProbabilityEstimates.findOne({TDFId: TDFId})
  if(probEstimates){
    ProbabilityEstimates.update({_id: probEstimates._id}, {$set: {clusterProbs: clusterProbs, individualStimProbs: individualStimProbs, relevantKCIds: relevantKCIds}});
  } else {
    ProbabilityEstimates.insert({TDFId: TDFId, clusterProbs: clusterProbs, individualStimProbs: individualStimProbs, relevantKCIds: relevantKCIds});
  }
}

async function updateSingleProbabilityEstimate(TDFId, KCId, probabilityEstimate) {
  serverConsole('updateSingleProbabilityEstimate', TDFId, KCId, probabilityEstimate);
  const probEstimates = ProbabilityEstimates.findOne({TDFId: TDFId})
  if(probEstimates){
    const clusterProbs = probEstimates.clusterProbs;
    const individualStimProbs = probEstimates.individualStimProbs;
    const relevantKCIds = probEstimates.relevantKCIds;
    for(const cluster in relevantKCIds){
      if(relevantKCIds[cluster].includes(KCId)){
        if(!clusterProbs[cluster]) clusterProbs[cluster] = [];
        clusterProbs[cluster].push(probabilityEstimate);
      }
    }
    if(individualStimProbs[KCId]){
      individualStimProbs[KCId].push(probabilityEstimate);
    } else {
      individualStimProbs[KCId] = [probabilityEstimate];
    }
    updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds);
  }
}

async function getProbabilityEstimatesByKCId(TDFId, relevantKCIds) {
  serverConsole('getProbabilityEstimatesByKCId', TDFId);
  const probEstimates = await ProbabilityEstimates.findOne({TDFId: TDFId})

  if(!probEstimates){
    //generate probability estimates then store them for future use
    const allKCIDs = [].concat(...Object.values(relevantKCIds));
    const pipeline = [
      {
        $match: { KCId: { $in: allKCIDs }, probabilityEstimate: { $ne: null } }
      },
      {
        $sort: { time: 1 }
      },
    ];

    const histories = await Histories.rawCollection().aggregate(pipeline).toArray();
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
    updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds);
    return { clusterProbs, individualStimProbs };
  }
  return probEstimates;
}

async function getResponseKCMap() {
  serverConsole('getResponseKCMap');

  let responseKCStuff = await Tdfs.find().fetch();
  responseKCStuff = responseKCStuff.map(r => r.stimuli).flat();
  const responseKCMap = {};
  for (const row of responseKCStuff) {
    if(row) {
      const correctresponse = row.correctResponse;
      const responsekc = row.responseKC;
  
      const answerText = getDisplayAnswerText(correctresponse);
      responseKCMap[answerText] = responsekc;
    }
  }
  return responseKCMap;
}

async function clearCurUnitProgress(userId, TDFId) {
  let unit = ComponentStates.findOne({userId: userId, TDFId: TDFId});
  if(unit){
    for(let cardState in unit.cardStates){
      unit.cardStates[cardState].priorCorrect = 0;
      unit.cardStates[cardState].priorIncorrect = 0;
      unit.cardStates[cardState].totalPracticeDuration = 0;
      unit.cardStates[cardState].timesSeen = 0;
    } 
    for(let stimState in unit.stimStates){
      unit.stimStates[stimState].priorCorrect = 0;
      unit.stimStates[stimState].priorIncorrect = 0;
      unit.stimStates[stimState].totalPracticeDuration = 0;
      unit.stimStates[stimState].timesSeen = 0;
    }
    for(let responseState in unit.responseStates){
      unit.responseStates[responseState].priorCorrect = 0;
      unit.responseStates[responseState].priorIncorrect = 0;
      unit.responseStates[responseState].totalPracticeDuration = 0;
      unit.responseStates[responseState].timesSeen = 0;
    }
    ComponentStates.update({_id: unit._id}, unit);
  }
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

// Package Uploader
async function processPackageUpload(fileObj, owner, zipLink, emailToggle){
  DynamicAssets.collection.update({_id: fileObj._id}, {$set: {'meta.link': zipLink}});
  let path = fileObj.path;
  let results = [];
  let unzippedFiles
  let filePath
  let fileName
  let extension
  //convert the path to a filename
  let packageFile = path.split('/').pop();
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
        packageFile: packageFile,
        type: type
      };
      unzippedFiles.push(fileMeta);
    }
    serverConsole('unzippedFiles', unzippedFiles);
    const stimFileName = unzippedFiles.filter(f => f.type == 'stim')[0].name;
    const results = await new Promise(async (resolve, reject) => {
      res = [];
      try {
        for(const tdf of unzippedFiles.filter(f => f.type == 'tdf')){
          const stim = unzippedFiles.find(f => f.name == tdf.contents.tutor.setspec.stimulusfile);
          serverConsole('stim', stim, 'stimFileName', stimFileName, tdf.contents.tutor.setspec.stimulusfile);
          tdf.packageFile = packageFile;
          const packageResult = await combineAndSaveContentFile(tdf, stim, owner);
          res.push(packageResult);
          serverConsole('packageResult', packageResult);
        }
        resolve(res)
      } catch(e) {
        if(emailToggle){
          sendEmail(
            Meteor.user().emails[0].address,
            Meteor.settings.owner,
            "Package Upload Failed",
            "Package upload failed: " + e + " on file: " + filePath
          )
        }
        serverConsole('1 processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
        reject(new Meteor.Error('package upload failed: ' + e + ' on file: ' + filePath))
      } finally {
        updateStimDisplayTypeMap()
      }
    });
  
    let stimSetId;
    if(results && results[0] && results[0].data && results[0].data.stimuliSetId)
      stimSetId = results[0].data.stimuliSetId;
    if (!stimSetId) stimSetId = await getStimuliSetIdByFilename(stimFileName);
    try {
      for(const media of unzippedFiles.filter(f => f.type == 'media')){
        await saveMediaFile(media, owner, stimSetId);
      }
    } catch(e) {
      if(emailToggle){
        sendEmail(
          Meteor.user().emails[0].address,
          Meteor.settings.owner,
          "Package Upload Failed",
          "Package upload failed at media upload: " + e + " on file: " + filePath
        )
      }
      serverConsole('2 processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
      throw new Meteor.Error('package upload failed at media upload: ' + e + ' on file: ' + filePath)
    }
    serverConsole('results', results);
    if(emailToggle){
      sendEmail(
        Meteor.user().emails[0].address,
        Meteor.settings.owner,
        "Package Upload Successful",
        "Package upload successful: " + fileName
      )
    }
    return {results, stimSetId};
  } catch(e) {
      if(emailToggle){
        sendEmail(
          Meteor.user().emails[0].address,
          Meteor.settings.owner,
          "Package Upload Failed",
          "Package upload failed at initialization: " + e + " on file: " + filePath
        )
      }
    serverConsole('3 processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
    throw new Meteor.Error('package upload failed at initialization: ' + e + ' on file: ' + filePath)
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
      if (lessonName.length < 1) {
        results.result = false;
        results.errmsg = 'TDF has no lessonname - it cannot be valid';

        return results;
      }
      const stimFileName = json.tutor.setspec.stimulusfile ? json.tutor.setspec.stimulusfile : 'INVALID';
      if (stimFileName == 'INVALID') {
        // Note this means root tdfs will have NULL stimulisetid
        results.result = false;
        results.errmsg = 'Please upload stimulus file before uploading a TDF: ' + stimFileName;

        return results;
      } else {
        const tdf = Tdfs.findOne({stimulusFileName: stimFileName});
        const stimuliSetId = tdf ? tdf.stimuliSetId : null;
        if (isEmpty(stimuliSetId)) {
          results.result = false;
          results.errmsg = 'Please upload stimulus file before uploading a TDF: ' + stimFileName;
        } else {
          try {
            const rec = {'fileName': filename, 'tdfs': json, 'ownerId': ownerId, 'source': 'upload', 'packageFile': filecontents.packageFile};
            const ret = await upsertTDFFile(filename, rec, ownerId);
            if(ret && ret.res == 'awaitClientTDF'){
              serverConsole('awaitClientTDF', ret)
              results.result = false;
              results.data = ret;
              return results;
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

async function combineAndSaveContentFile(tdf, stim, owner) {
  serverConsole('combineAndSaveContentFile', tdf, stim, owner);
  const results = {
    'result': null,
    'errmsg': 'No action taken?',
    'action': 'None',
  };
  // if (!type) throw new Error('Type required for File Save'); const stimFileName = json.tutor.setspec.stimulusfile ? json.tutor.setspec.stimulusfile : 'INVALID';
  // if (!filename) throw new Error('Filename required for File Save');
  // if (!filecontents) throw new Error('File Contents required for File Save');
  // if (type != 'tdf' && type != 'stim') {
  //   throw new Error('Unknown file type not allowed: ' + type);
  // }
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

  try {
    const jsonContents = typeof tdf.contents == 'string' ? JSON.parse(tdf.contents) : tdf.contents;
    const jsonPackageFile = tdf.packageFile;
    const json = {tutor: jsonContents.tutor};
    const lessonName = _.trim(jsonContents.tutor.setspec.lessonname);
    if (lessonName.length < 1) {
      results.result = false;
      results.errmsg = 'TDF has no lessonname - it cannot be valid';

      return results;
    }
    const stimContents = typeof stim.contents == 'string' ? JSON.parse(stim.contents) : stim.contents;
    try {
      const rec = {'fileName': tdf.name, 'tdfs': json, 'ownerId': ownerId, 'source': 'upload', 'stimuli': stimContents, 'stimFileName': stim.name, 'packageFile': jsonPackageFile};
      const ret = await upsertPackage(rec, ownerId);
      if(ret && ret.res == 'awaitClientTDF'){
        serverConsole('awaitClientTDF', ret)
        results.result = false;
      } else {
        results.result = true;
      }
      results.data = ret;
    } catch (err) {
      results.result=false;
      results.errmsg=err.toString();
      console.error(err);
    }
    return results;
  } catch (e) {
    serverConsole('ERROR saving content file:', e, e.stack);
    results.result = false;
    results.errmsg = JSON.stringify(e);
    console.error(e);
    return results;
  }
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

async function getTdfNamesByOwnerId(ownerId) {
  serverConsole('getTdfNamesByOwnerId', ownerId);
  try {
    tdfs = Tdfs.find({ownerId: ownerId}).fetch();
    const ownedTdfFileNames = tdfs.map(tdf => tdf.content.fileName);
    serverConsole('ownedTdfFileNames', ownedTdfFileNames);
    return ownedTdfFileNames;
  } catch (e) {
    serverConsole('getTdfNamesByOwnerId ERROR,', e);
    return null;
  }
}

async function getTdfNamesByAccessorId(accessorId) {
  serverConsole('getTdfNamesByAccessorId', accessorId);
  try {
    //find tdfs where accessors array contains accessorId
    tdfs = Tdfs.find({accessors: accessorId}).fetch();
    const accessibleTdfFileNames = tdfs.map(tdf => tdf.content.fileName);
    serverConsole('accessibleTdfFileNames', accessibleTdfFileNames);
    return accessibleTdfFileNames;
  } catch (e) {
    serverConsole('getTdfNamesByAccessorId ERROR,', e);
    return null;
  }
}

async function cleanExperimentStateDupes(experimentStates, idToKeep) {
  for(const eS of experimentStates){
    if(eS._id !== idToKeep)
      GlobalExperimentStates.remove({_id: eS._id});
  }
}

async function getExperimentState(userId, TDFId) { // by currentRootTDFId, not currentTdfId
  const experimentStateRet = GlobalExperimentStates.find({userId: userId, TDFId: TDFId}).fetch();
  const mergedExperimentState = {};
  //merge experiment states
  for(const experimentState of experimentStateRet){
    mergedExperimentState.experimentState = Object.assign({}, mergedExperimentState.experimentState, experimentState.experimentState);
  }
  const experimentState = mergedExperimentState && mergedExperimentState.experimentState ? mergedExperimentState.experimentState : {};
  experimentState.id = experimentStateRet && experimentStateRet[0] ? experimentStateRet[0]._id : null;
  //cleans up duplicates that occured due to a bug until next db wipe
  await cleanExperimentStateDupes(experimentStateRet, experimentState.id);
  return experimentState;
}

// UPSERT not INSERT
async function setExperimentState(userId, TDFId, experimentStateId, newExperimentState, where) { // by currentRootTDFId, not currentTdfId
  serverConsole('setExperimentState:', where, userId, TDFId, newExperimentState);
  const experimentStateRet = GlobalExperimentStates.findOne({_id: experimentStateId})
  serverConsole(experimentStateRet)
  serverConsole(newExperimentState)
  if (experimentStateRet != null) {
    const updatedExperimentState = Object.assign(experimentStateRet.experimentState, newExperimentState);
    GlobalExperimentStates.update({_id: experimentStateId}, {$set: {experimentState: updatedExperimentState}})
    return updatedExperimentState;
  }
  GlobalExperimentStates.insert({userId: userId, TDFId: TDFId, experimentState: newExperimentState});

  return TDFId;
}

function insertHiddenItem(userId, stimulusKC, tdfId) {
  let unit = ComponentStates.findOne({userId: userId, TDFId: tdfId})
  let index = -1;
  if (unit) {
    index = unit.stimStates.findIndex(function(item){
      return item.KCId === stimulusKC
    });
    if (index === -1) {
      serverConsole('insertHiddenItem: stimulusKC not found in stimStates');
      return;
    } else {
      unit.stimStates[index].showItem = false;
      ComponentStates.update({_id: unit._id}, {$set: {stimStates: unit.stimStates}});
    }
  }
  
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
  historyRecord.eventId = nextEventId;
  nextEventId += 1;
  historyRecord.dynamicTagFields = dynamicTagFields || [];
  historyRecord.recordedServerTime = (new Date()).getTime();
  serverConsole('insertHistory', historyRecord);
  Histories.insert(historyRecord)
}

async function getLastTDFAccessed(userId) {
  const lastExperimentStateUpdated = GlobalExperimentStates.findOne({userId: userId}, {sort: {"experimentState.lastActionTimeStamp": -1}, limit: 1});;
  const lastTDFId = lastExperimentStateUpdated.TDFId;
  return lastTDFId;
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

async function updateStimDisplayTypeMap(){
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
  stimDisplayTypeMap = map;
}

async function getStimDisplayTypeMap() {
  return stimDisplayTypeMap;
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

  const componentState = await ComponentStates.findOne({userId: userId, TDFId: TDFId});
  if (!componentState) return null;
  
  const studentPerformance = {
    totalStimCount: 0,
    numCorrect: 0,
    numIncorrect: 0,
    totalPracticeDuration: 0,
    allTimeNumCorrect: 0,
    allTimeNumIncorrect: 0,
    allTimePracticeDuration: 0,
    stimsIntroduced: 0,
    count: 0,
  }
  const stimStates = componentState.stimStates;
  for (const stimState of stimStates) {
    if (stimIds && !stimIds.includes(stimState.KCId)) continue;
    studentPerformance.totalStimCount++;
    studentPerformance.numCorrect += stimState.priorCorrect;
    studentPerformance.numIncorrect += stimState.priorIncorrect;
    studentPerformance.totalPracticeDuration += stimState.totalPracticeDuration;
    studentPerformance.allTimeNumCorrect += stimState.allTimeCorrect;
    studentPerformance.allTimeNumIncorrect += stimState.allTimeIncorrect;
    studentPerformance.allTimePracticeDuration += stimState.allTimeTotalPracticeDuration;
    if (stimState.priorCorrect || stimState.priorIncorrect) {
      studentPerformance.stimsIntroduced++;
    }
    studentPerformance.count += stimState.timesSeen;
  }
  // serverConsole('query', query);
  // serverConsole('studentPerformance', studentPerformance[0]);
  return studentPerformance;
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

//get most recent history record for a student given a tdfid, cluster index, and stimulus index. All we want is the outcome
async function getStudentPerformanceByStimulus(userId, TDFId, clusterIndex, stimulusIndex) {
  serverConsole('getStudentPerformanceByStimulus', userId, TDFId, clusterIndex, stimulusIndex);
  const history = Histories.findOne({userId: userId, TDFId: TDFId, clusterIndex: clusterIndex, stimulusIndex: stimulusIndex}, {sort: {time: -1}});
  return history ? history.outcome : null;
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
    if (tdfObject.tdfs.tutor.setspec.disableProgressReport) continue; // Don't display tdfs with disableProgressReport
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

//function to check drive space and send email if it is low
function checkDriveSpace() {
  serverConsole('checkDriveSpace');
  diskusage = Npm.require('diskusage');
  const path = "/"
  try{
    let info = diskusage.checkSync(path);
    let freeSpace = info.free;
    let totalSpace = info.total;
    let percentFree = (freeSpace / totalSpace) * 100;
    serverConsole('freeSpace: ' + freeSpace + ', totalSpace: ' + totalSpace + ', percentFree: ' + percentFree);
    if(percentFree < 10){
      serverConsole('Low disk space: ' + percentFree + '%');
      const from = ownerEmail;
      const subject = 'MoFaCTs Low Disk Space - ' + thisServerUrl;
      const text = 'Low disk space: ' + percentFree + '%';
      sendEmail(ownerEmail, from, subject, text);
    }
  } 
  catch (err) {
    serverConsole(err);
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
  serverConsole('sendEmail', to, from, subject, text);
  check([to, from, subject, text], [String]);
  if(Meteor.isProduction)
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
    formattedStims.push(stim);
  }
  Tdfs.upsert({"content.tdfs.tutor.setspec.stimulusfile": stimulusFileName}, {$set: {
    stimulusFileName: stimulusFileName,
    stimuliSetId: stimuliSetId, 
    rawStimuliFile: stimJSON, //raw stimuli
    stimuli: formattedStims, //formatted stimuli for use in the app
  }}, {multi: true});
  Meteor.call('updateStimSyllables', stimuliSetId, formattedStims)
  return stimuliSetId
}

async function upsertTDFFile(tdfFilename, tdfJSON, ownerId, packagePath = null) {
  serverConsole('upsertTDFFile', tdfFilename);
  serverConsole('tdfJSON', tdfJSON);
  let ret = {reason: []};
  let Tdf = tdfJSON.tdfs;
  let lessonName = _.trim(Tdf.tutor.setspec.lessonname);
  const prev = await getTdfByFileName(tdfFilename);
  let stimuliSetId = prev.stimuliSetId
  if (!stimuliSetId) {
    stimuliSetId = nextStimuliSetId;
    nextStimuliSetId += 1;
  } else {
    ret = {res: 'awaitClientTDF', reason: ['prevStimExists']}
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
    if(ret.res != 'awaitClientTDF'){
      ret.res = 'awaitClientTDF'
    }
    ret.TDF = updateObj
    ret.reason.push('prevTDFExists')
    if(prev.content.tdfs.tutor.setspec.shuffleclusters != tdfJSON.tdfs.tutor.setspec.shuffleclusters){
      serverConsole('sufflecluster changed, alerting user');
      ret.reason.push('shuffleclusterMissmatch')
    }
    return ret
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
  //create a new array the length of the number of conditions, fill it with 0
  tdfJSONtoUpsert.tdfs.tutor.setspec.condition ? conditionCounts = new Array(tdfJSONtoUpsert.tdfs.tutor.setspec.condition.length).fill(0) : conditionCounts = [];
  
  Tdfs.upsert({_id: prev._id}, {$set: {
    path: packagePath,
    content: tdfJSONtoUpsert,
    ownerId: ownerId,
    visibility: 'profileOnly',
    conditionCount: conditionCounts
    }});
}

async function upsertPackage(packageJSON, ownerId) {
  serverConsole('upsertPackage', packageJSON);
  const responseKCMap = await getResponseKCMap();
  const stimulusFileName = packageJSON.stimFileName
  const stimJSON = packageJSON.stimuli
  const packageFile = packageJSON.packageFile
  let ret = {reason: []};
  let Tdf = packageJSON.tdfs;
  let lessonName = _.trim(Tdf.tutor.setspec.lessonname);
  const prev = await getTdfByFileName(packageJSON.fileName);
  let stimuliSetId = prev ? prev.stimuliSetId : null;
  if (!stimuliSetId) {
    stimuliSetId = nextStimuliSetId;
    nextStimuliSetId += 1;
  } else {
    ret = {res: 'awaitClientTDF', reason: ['prevStimExists']}
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
  tdfJSON = {'fileName': packageJSON.fileName, 'tdfs': Tdf, 'ownerId': ownerId, 'source': 'upload'};
  let formattedStims = [];
  serverConsole('getAssociatedStimSetIdForStimFile', stimulusFileName, stimuliSetId);
  const oldStimFormat = {
    'fileName': stimulusFileName,
    'stimuli': stimJSON,
    'owner': ownerId,
    'source': 'repo',
  };
  const newStims = getNewItemFormat(oldStimFormat, stimulusFileName, stimuliSetId, responseKCMap);
  let maxStimulusKC = 0;
  //serverConsole('!!!newStims:', newStims);

  for (const stim of newStims) {
    if(stim.stimulusKC > maxStimulusKC){
      maxStimulusKC = stim.stimulusKC;
    }
    let curAnswerSylls
    stim.syllables = curAnswerSylls;
    formattedStims.push(stim);
  }
  
  let tdfJSONtoUpsert;
  if (prev && prev._id) {
    //serverConsole('updating tdf', tdfFilename, formattedStims);
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
      tdfFileName: packageJSON.fileName,
      content: tdfJSONtoUpsert,
      ownerId: ownerId,
      packageFile: packageFile,
      rawStimuliFile: stimJSON, //raw stimuli
      stimuli: formattedStims, //formatted stimuli for use in the app
      stimuliSetId: stimuliSetId,
      visibility: 'profileOnly'
    }
    if(ret.res != 'awaitClientTDF'){
      ret.res = 'awaitClientTDF'
    }
    ret.TDF = updateObj
    ret.reason.push('prevTDFExists')
    if(prev.content.tdfs.tutor.setspec.shuffleclusters != tdfJSON.tdfs.tutor.setspec.shuffleclusters){
      serverConsole('sufflecluster changed, alerting user');
      ret.reason.push('shuffleclusterMissmatch')
    }
    return ret
  } else {
    //serverConsole('inserting tdf', tdfFilename, formattedStims);
    if (hasGeneratedTdfs(tdfJSON)) {
      const tdfGenerator = new DynamicTdfGenerator(tdfJSON.tdfs, tdfFilename, ownerId, 'repo', formattedStims);
      const generatedTdf = tdfGenerator.getGeneratedTdf();
      tdfJSONtoUpsert = generatedTdf;
    } else {
      tdfJSON.createdAt = new Date();
      tdfJSONtoUpsert = tdfJSON;
    }
  }
  //create a new array the length of the number of conditions, fill it with 0
  tdfJSONtoUpsert.tdfs.tutor.setspec.condition ? conditionCounts = new Array(tdfJSONtoUpsert.tdfs.tutor.setspec.condition.length).fill(0) : conditionCounts = [];

  Tdfs.upsert({"content.fileName": packageJSON.fileName}, {$set: {
    tdfFileName: packageJSON.fileName,
    content: tdfJSONtoUpsert,
    ownerId: ownerId,
    packageFile: packageFile,
    rawStimuliFile: stimJSON, //raw stimuli
    stimuli: formattedStims, //formatted stimuli for use in the app
    stimuliSetId: stimuliSetId,
    visibility: 'profileOnly',
    conditionCounts: conditionCounts
  }});

  //update stim syllables
  Meteor.call('updateStimSyllables', stimuliSetId);

  return {stimuliSetId: stimuliSetId}
}

function tdfUpdateConfirmed(updateObj, resetShuffleClusters = false){
  serverConsole('tdfUpdateConfirmed', updateObj);
  Tdfs.upsert({_id: updateObj._id},{$set:updateObj});
  if(resetShuffleClusters){
    const expStatses = GlobalExperimentStates.find({TDFId: updateObj._id}).fetch();
    for(let expState of expStatses){
      expState.experimentState.clusterMapping = [];
      GlobalExperimentStates.update({_id: expStats._id}, {$set: {experimentState: expState}});
    }
  }
}

function setUserLoginData(entryPoint, loginMode, curTeacher = undefined, curClass = undefined, assignedTdfs = undefined){
  serverConsole('setUserLoginData', entryPoint, loginMode, curTeacher, curClass, assignedTdfs);
  let loginParams = Meteor.user().loginParams || {};
  loginParams.entryPoint = entryPoint;
  loginParams.curTeacher = curTeacher;
  loginParams.curClass = curClass;
  loginParams.loginMode = loginMode;
  loginParams.assignedTdfs = assignedTdfs;
  Meteor.users.update({_id: Meteor.userId()}, {$set: {loginParams: loginParams}});
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
    
  getMeteorSettingsPublic: function(settings) {
    //passes back current public settings
    serverConsole('updateClientMeteorSettings', settings);
    return Meteor.settings.public;
  },

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

  removeTurkById: function(turkId, experimentId){
    serverConsole('removeTurkById', turkId, experimentId)
    ScheduledTurkMessages.remove({workerUserId: turkId, experiment: experimentId});
    let profile = Meteor.user().profile;
    profile.lockoiuts[experimentId].lockoutMinutes = Number.MAX_SAFE_INTEGER;
    Meteor.users.update({_id: Meteor.userId()}, {$set: {profile: profile}});
  },

  saveAudioPromptMode: function(audioPromptMode){
    serverConsole('saveAudioPromptMode', audioPromptMode);
    Meteor.users.update({_id: Meteor.userId()}, {$set: {audioPromptMode: audioPromptMode}});
  },

  saveAudioInputMode: function(audioInputMode){
    serverConsole('saveAudioInputMode', audioInputMode);
    Meteor.users.update({_id: Meteor.userId()}, {$set: {audioInputMode: audioInputMode}});
  },

  updateExperimentState: function(curExperimentState, experimentId) {
    serverConsole('updateExperimentState', curExperimentState, curExperimentState.currentTdfId);
    if(experimentId) {
      GlobalExperimentStates.upsert({_id: experimentId}, {$set: {experimentState: curExperimentState}});
    } else {
      GlobalExperimentStates.upsert({userId: Meteor.userId(), TDFId: curExperimentState.currentTdfId}, {$set: {experimentState: curExperimentState}});
    }
  },

  createExperimentState: function(curExperimentState) {
    serverConsole('createExperimentState', curExperimentState, curExperimentState.currentTdfId);
    GlobalExperimentStates.insert({
      userId: Meteor.userId(),
      TDFId: curExperimentState.currentTdfId,
      experimentState: curExperimentState
    });
  },


  getAltServerUrl: function() {
    return altServerUrl;
  },

  getServerStatus: function() {
    diskusage = Npm.require('diskusage');
    const path = "/"
    let info = diskusage.checkSync(path);
    let diskSpaceTotal = info.total;
    let diskSpaceUsed = info.total - info.free;
    let driveSpaceUsedPercent = (diskSpaceUsed / diskSpaceTotal) * 100;
    let remainingSpace = diskSpaceTotal - diskSpaceUsed;
    //float percentages to 2 decimal places, and space sizes to GB
    driveSpaceUsedPercent = driveSpaceUsedPercent.toFixed(2);
    diskSpaceTotal = (diskSpaceTotal / 1000000000).toFixed(2);
    diskSpaceUsed = (diskSpaceUsed / 1000000000).toFixed(2);
    remainingSpace = (remainingSpace / 1000000000).toFixed(2);
    return {diskSpacePercent: driveSpaceUsedPercent, remainingSpace: remainingSpace, diskSpace: diskSpaceTotal, diskSpaceUsed: diskSpaceUsed};
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

  getSimpleFeedbackForAnswer: async function(userAnswer, correctAnswer) {
    // eslint-disable-next-line new-cap
    const mongoResult = await ElaboratedFeedbackCache.findOne({correctAnswer: correctAnswer});
    serverConsole('mongoResult', mongoResult);
    if(mongoResult && mongoResult.userAnswers && mongoResult.userAnswers[userAnswer])
      return mongoResult.userAnswers[userAnswer];
    else {
      ElaboratedFeedback.GenerateFeedback(userAnswer, correctAnswer).then((result) => {
        let userAnswers = {};
        let id = '';
        if(mongoResult){
          id = mongoResult._id;
          if(mongoResult.userAnswers)
            userAnswers = mongoResult.userAnswers;
        }
        if (result.tag != 0) {
          console.log('error with refutational feedback, feedback call: ' + result.name);
          console.log(result);
        } else if (result.tag == 0) {
          console.log('refutationalFeedback,return:', result);
          const refutationalFeedback = result.fields[0].Feedback || result.fields[0].feedback;
          if (typeof(refutationalFeedback) != 'undefined' && refutationalFeedback != null) {
            userAnswers[userAnswer] = refutationalFeedback;
            ElaboratedFeedbackCache.upsert(id, {$set: {correctAnswer: correctAnswer, userAnswers: userAnswers}});
            serverConsole('result1: ' + JSON.stringify(result), mongoResult);
          }
        }
      });
      return 'default feedback'
    }
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
    // get tdfs where ownerId is userId or .accessors array contains property with userId
    const assignableTDFs = Tdfs.find({$or: [{ownerId: userId}, {'accessors.userId': userId}]}).fetch();
    serverConsole('assignableTDFs', assignableTDFs);
    return assignableTDFs;
  },

  assignAccessors: function(TDFId, accessors, revokedAccessors){
    serverConsole('assignAccessors', TDFId, accessors, revokedAccessors)
    Tdfs.update({_id: TDFId}, {$set: {'accessors': accessors}});
    const userIds = accessors.map((x) => x.userId);
    Meteor.users.update({'_id': {$in: userIds}}, {$addToSet: {'accessedTDFs': TDFId}}, {multi: true});
    Meteor.users.update({'_id': {$in: revokedAccessors}}, {$pull: {'accessedTDFs': TDFId}}, {multi: true});
  },

  transferDataOwnership: function(tdfId, newOwner){
    //set the Tdf owner
    serverConsole('transferDataOwnership',tdfId,newOwner);
    tdf = Tdfs.findOne({_id: tdfId});
    if(!tdf){
      serverConsole('TDF not found');
      return "TDF not found";
    } else {
      serverConsole('TDF found', tdf._id, tdf.ownerId);
    }
    tdf.ownerId = newOwner._id;
    Tdfs.upsert({_id: tdfId}, tdf);
    serverConsole(tdf);
    serverConsole('transfer ' + tdfId + "to" + newOwner);
    return "success";
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

  populateSSOProfile: function(userId){
    //check if the user has a service profile
    const user = Meteor.users.findOne(userId);
    if(user && user.services){
      //if the user has a service profile, populate the user profile with the service profile
      const service = Object.keys(user.services)[0];
      const serviceProfile = user.services[service];
      const profile = {
        'email': serviceProfile.mail,
        'service': service,
        //also get refresh token
        'refreshToken': serviceProfile.refreshToken
      };
      Meteor.users.update(userId, {$set: {profile: profile, username: serviceProfile.mail}});
      return "success: " + serviceProfile.mail;
    }
    return "failure";
  },


  //Impersonate User
  impersonate: function(userId) {
    check(userId, String);
    if (!Meteor.users.findOne(userId)) {
      throw new Meteor.Error(404, 'User not found');
    }
    let profile = Meteor.user().profile;
    profile.impersonating = userId;
    Meteor.users.update({_id: Meteor.userId()}, {$set: {profile: profile}});
    this.setUserId(userId);
  },

  clearLoginData: function(){
    let loginParams = Meteor.user().loginParams;
    loginParams.entryPoint = null;
    loginParams.curTeacher = null;
    loginParams.curClass = null;
    loginParams.loginMode = null;
    Meteor.users.update({_id: Meteor.userId()}, {$set: {loginParams: loginParams}});
  },

  clearImpersonation: function(){
    let profile = Meteor.user().profile;
    profile.impersonating = false;
    Meteor.users.update({_id: Meteor.userId()}, {$set: {profile: profile}});
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
    let profile = Meteor.users.findOne({_id: Meteor.userId()}).profile;
    serverConsole('setUserSessionId', sessionId, sessionIdTimestamp)
    serverConsole('profile', profile)
    profile.lastSessionId = sessionId;
    profile.lastSessionIdTimestamp = sessionIdTimestamp;
    serverConsole('profile2', profile)
    Meteor.users.update({_id: Meteor.userId()}, {$set: {profile: profile}});
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
      //iterate through TDF.stimuli
      for (const stim of TDF.stimuli) {
        asset = stim.imageStimulus || stim.audioStimulus || stim.videoStimulus || false;
        if (asset) {
          //remove asset
          DynamicAssets.remove({"name": asset}, function(err, result){
            if(err){
              serverConsole(err);
            } else {
              serverConsole("Asset removed: ", asset);
            }
          });
        }
      }
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

  getTestLogin: function() {
    return DynamicSettings.findOne({key: 'testLoginsEnabled'}).value;
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

  initializeCustomTheme: function(themeName) {
    serverConsole('initializeCustomTheme');
    //This creates a theme key that contains an object with the theme name
    //and an empty object for the theme's properties
    let theme = {};
    theme.themeName = themeName;
    theme.enabled = true;
    theme.properties = {
      themeName: themeName,
      background_color: '#F2F2F2',
      text_color: '#000000',
      button_color: '#7ed957',
      primary_button_text_color: '#000000',
      accent_color: '#7ed957',
      secondary_color: '#d9d9d9',
      secondary_text_color: '#000000',
      audio_alert_color: '#06723e',
      success_color: '#00cc00',
      navbar_text_color: '#000000',
      neutral_color: '#ffffff',
      alert_color: '#ff0000',
      logo_url: ''
    };
    //This inserts the theme into the database, or updates it if it already exists
    DynamicSettings.upsert({key: 'customTheme'}, {$set: {value: theme}});
    return theme;
  },

  getTheme: function() {
    serverConsole('getTheme');
    ret = DynamicSettings.findOne({key: 'customTheme'}) 
    if(!ret || ret.value.enabled == false) {
      return {
        themeName: 'MoFaCTS',
        properties: {
          themeName: 'MoFaCTS',
          background_color: '#F2F2F2',
          text_color: '#000000',
          button_color: '#7ed957',
          primary_button_text_color: '#000000',
          accent_color: '#7ed957',
          secondary_color: '#d9d9d9',
          secondary_text_color: '#000000',
          audio_alert_color: '#06723e',
          success_color: '#00cc00',
          navbar_text_color: '#000000',
          neutral_color: '#ffffff',
          alert_color: '#ff0000',
          logo_url: ''
        }
      }
     }
    return ret.value;
  },

  setCustomThemeProperty: function(property, value) {
    //This sets the value of a property in the custom theme
    path = 'value.properties.' + property;
    serverConsole('setCustomThemeProperty', path, value);
    DynamicSettings.update({key: 'customTheme'}, {$set: {[path]: value}});
  },

  toggleCustomTheme: function() {
    serverConsole('toggleCustomTheme');
    //This toggles the custom theme on or off
    let theme = DynamicSettings.findOne({key: 'customTheme'});
    if(!theme) { 
      Meteor.call('initializeCustomTheme', 'Custom Theme');
    } else {
      theme = theme.value;
      theme.enabled = !theme.enabled;
      serverConsole('custom theme enabled:', theme.enabled);
      DynamicSettings.update({key: 'customTheme'}, {$set: {'value.enabled': theme.enabled}});
    }
  }
}

const asyncMethods = {
  getAllTdfs, getTdfByFileName, getTdfByExperimentTarget, getTdfIDsAndDisplaysAttemptedByUserId,

  getStimDisplayTypeMap, getStimuliSetById, getSourceSentences,

  getAllCourses, getAllCourseSections, getAllCoursesForInstructor, getAllCourseAssignmentsForInstructor,

  addCourse, editCourse, editCourseAssignments, addUserToTeachersClass, saveContentFile,

  getTdfNamesAssignedByInstructor, getTdfNamesByOwnerId, getTdfsAssignedToStudent, getTdfAssignmentsByCourseIdMap,

  getStudentPerformanceByIdAndTDFId, getStudentPerformanceByIdAndTDFIdFromHistory, getNumDroppedItemsByUserIDAndTDFId,
  
  getStudentPerformanceForClassAndTdfId, getStimSetFromLearningSessionByClusterList,

  getExperimentState, setExperimentState, getStimuliSetByFileName, getMaxResponseKC,

  getProbabilityEstimatesByKCId, getResponseKCMap, processPackageUpload, getLastTDFAccessed,

  insertHistory, getHistoryByTDFID, getUserRecentTDFs, clearCurUnitProgress, tdfUpdateConfirmed,

  loadStimsAndTdfsFromPrivate, getListOfStimTags, getUserLastFeedbackTypeFromHistory,

  checkForUserException, getTdfById,

  getUsersByExperimentId: async function(experimentId){
    const messages = ScheduledTurkMessages.find({experiment: experimentId}).fetch();
    const userIds = messages.map(x => x.workerUserId);
    let users = []
    for (const u of userIds){
      users.push({userId: u, userName: Meteor.users.findOne({_id: u}).username})
    }
    return users;
  },
  
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
    let lockouts = Meteor.user().lockouts
    if(!lockouts) lockouts = {};
    if(!lockouts[TDFId]) lockouts[TDFId] = {};
    lockouts[TDFId].lockoutTimeStamp = lockoutTimeStamp;
    lockouts[TDFId].lockoutMinutes = lockoutMinutes;
    lockouts[TDFId].currentLockoutUnit = currentUnitNumber;
    Meteor.users.update({_id: Meteor.userId()}, {$set: {lockouts: lockouts}});
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
    let unit = ComponentStates.findOne({userId: userId, TDFId: TDFId});
    if(unit) {
      for(let cardState in unit.cardStates){
        unit.cardStates[cardState].curSessionPriorCorrect = 0;
        unit.cardStates[cardState].curSessionPriorIncorrect = 0;
      } 
      for(let stimState in unit.stimStates){
        unit.stimStates[stimState].curSessionPriorCorrect = 0;
        unit.stimStates[stimState].curSessionPriorIncorrect = 0;
      }
      for(let responseState in unit.responseStates){
        unit.responseStates[responseState].curSessionPriorCorrect = 0;
        unit.responseStates[responseState].curSessionPriorIncorrect = 0;
      }
    }
    ComponentStates.update({_id: unit._id}, unit);
  },

  updateTdfConditionCounts: async function(TDFId, conditionCounts) {
    serverConsole('updateTdfConditionCounts', TDFId, conditionCounts);
    Tdfs.update({_id: TDFId}, {$set: {conditionCounts: conditionCounts}});
  },

  resetTdfConditionCounts: async function(TDFId) {
    serverConsole('resetTdfConditionCounts', TDFId);
    setspec = Tdfs.findOne({_id: TDFId}).content.tdfs.tutor.setspec;
    serverConsole("setspec:", setspec)
    conditions = setspec.condition;
    conditionCounts = {};
    for(let condition in conditions){
      conditionCounts[condition] = 0;
    }
    Tdfs.update({_id: TDFId}, {$set: {conditionCounts: conditionCounts}});
  },
  
  updateStimSyllables: async function(stimuliSetId, stimuli = undefined) {
    serverConsole('updateStimSyllables', stimuliSetId);
    if(!stimuli){
      const tdf = await Tdfs.findOne({ stimuliSetId: stimuliSetId });
      stimuli = tdf.stimuli
    }
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
      Tdfs.update({'stimuliSetId': stimuliSetId}, {$set: {'stimuli': stimuli}}, {multi: true});
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
    filesRemoved = 0;
    const files = DynamicAssets.find({}).fetch();
    serverConsole("files to remove: " + files.length);
    for(let file of files){
      serverConsole('removing file ' + file._id);
      DynamicAssets.remove({_id: file._id});
      filesRemoved++;
    }
    serverConsole('removed ' + filesRemoved + ' files');
    return filesRemoved;
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
  highestStimuliSetId = Tdfs.findOne({}, {sort: {stimuliSetId: -1}, limit: 1 });
  nextEventId = Histories.findOne({}, {limit: 1, sort: {eventId: -1}})?.eventId + 1 || 1;
  nextStimuliSetId = highestStimuliSetId && highestStimuliSetId.stimuliSetId ? parseInt(highestStimuliSetId.stimuliSetId) + 1 : 1;
  DynamicSettings.upsert({key: 'clientVerbosityLevel'}, {$set: {value: 1}});
  DynamicSettings.upsert({key: 'testLoginsEnabled'}, {$set: {value: false}});


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

  if(Meteor.settings.microsoft) {
    //add microsoft service config
    ServiceConfiguration.configurations.upsert({service: 'office365'}, {
      $set: {
        loginStyle: 'popup',
        clientId: Meteor.settings.microsoft.clientId,
        secret: Meteor.settings.microsoft.secret,
        tenent: 'common',
        //save the refresh token
        refreshToken: true,
      },
    });
  }

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
      //if the role name is admin or teacher, create a secret key for the user
      if(roleName == 'admin' || roleName == 'teacher'){
        createUserSecretKey(user._id);
      }
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

    //add sync cron job to send email to admin if the server is running low on physical memory
    SyncedCron.add({
      name: 'Check Drive Space Remaining',
      schedule: function(parser) {
        return parser.text('at 3:00 pm');
      },
      job: function() {
        return checkDriveSpace();
      }
    });
  }
  //combine owner emails, teacher emails, and admin emails into one array
  allEmails = [];
  allEmails.push(ownerEmail);
  const teacherEmails = roles.teachers;
  allEmails = allEmails.concat(teacherEmails);
  const adminEmails = roles.admins;
  allEmails = allEmails.concat(adminEmails);

  //we also need to get the users in roles admin and teacher and send them an email
  db_admins = Meteor.users.find({roles: 'admin'}).fetch();
  db_teachers = Meteor.users.find({roles: 'teacher'}).fetch();

  //the emails are the username of the user
  for (const admin of db_admins){
    allEmails.push(admin.username);
  }
  for (const teacher of db_teachers){
    allEmails.push(teacher.username);
  }
  
  //remove any duplicates
  allEmails = allEmails.filter((v, i, a) => a.indexOf(v) === i);
  console.log("Sending startup email to: ", allEmails);
  
  updateStimDisplayTypeMap();

  //email admin that the server has restarted
  for (const emailaddr of allEmails){
    const versionFile = Assets.getText('versionInfo.json');
    const version = JSON.parse(versionFile);
    server = Meteor.absoluteUrl().split('//')[1];
    server = server.substring(0, server.length - 1);
    subject = `MoFaCTs Deployed on ${server}`;
    text = `The server has restarted.\nServer: ${server}\nVersion: ${JSON.stringify(version, null, 2)}`;
    sendEmail(emailaddr, ownerEmail, subject, text)
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

    //get all tdfs assigned to the user
    const assignedTdfs = await getTdfNamesAssignedByInstructor(uid);

    //append tdfs that are owned by the user
    const ownedTdfs = await getTdfNamesByOwnerId(uid);

    //append all tdfs that the user is an accessor for
    const accessorTdfs = await getTdfNamesByAccessorId(uid);

    //combine the two arrays
    const tdfNames = assignedTdfs.concat(ownedTdfs).concat(accessorTdfs);

    console.log(userId, uid, tdfNames)

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

    const tdf = Tdfs.findOne({"content.fileName": exp});

    if (tdf && tdf.content.tdfs.tutor.setspec.condition) {
      const experiments = tdf.content.tdfs.tutor.setspec.condition;
      experiments.unshift(exp);
      response.write(await createExperimentExport(experiments, userId));
    } else {
      response.write(await createExperimentExport(exp, userId));
    }

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
