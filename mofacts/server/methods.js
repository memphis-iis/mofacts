import {Roles} from 'meteor/alanning:roles';
import {ServiceConfiguration} from 'meteor/service-configuration';
// @ts-nocheck
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
import {turk} from './turk';
import {getItem, getCourse, getTdf} from './orm';
import {getFullConfig, getConfigProperty} from './siteConfig';
import {result} from 'underscore';
import { _ } from 'core-js';
import { all } from 'bluebird';
import { check, Match } from 'meteor/check'; // Security: Input validation
import { WebApp } from 'meteor/webapp'; // Security: For adding HTTP headers
import { themeRegistry } from './lib/themeRegistry';


export {
  getTdfByFileName,
  getTdfById,
  getHistoryByTDFID,
  getListOfStimTags,
  getListOfStimTagsByTDFFileNames,
  getStimuliSetById,
  getDisplayAnswerText,
  serverConsole,
  decryptData,
  encryptData,
  createAwsHmac,
  getTdfByExperimentTarget
};

/* jshint sub:true*/

// The jshint inline option above suppresses a warning about using sqaure
// brackets instead of dot notation - that's because we prefer square brackets
// for creating some MongoDB queries
const SymSpell = require('node-symspell')
const Hypher = require('hypher');
const english = require('hyphenation.en-us');
const fs = Npm.require('fs');
const https = require('https')
const { randomBytes } = require('crypto')
let verbosityLevel = 0; //0 = only output serverConsole logs, 1 = only output function times, 2 = output serverConsole and function times

// Signup locks
const signUpLocks = {};

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
// SECURITY FIX: Removed insecure TLS configuration
// Setting NODE_TLS_REJECT_UNAUTHORIZED = 0 disables certificate verification
// for ALL outbound HTTPS connections, making the app vulnerable to MITM attacks.
// This was not needed since no external HTTPS connections are made from server.
// if (Meteor.settings.public.testLogin) {
//   process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
//   serverConsole('dev environment, allow insecure tls');
// }

// Initialize hypher for syllable splitting (replaces syllables.jar microservice)
const hyphenator = new Hypher(english);

// DEPRECATED: Syllable service replaced with hypher library
// const syllableURL = Meteor.settings.syllableURL ? Meteor.settings.syllableURL : Meteor.isProduction ? 'http://syllables:4567/syllables/' : 'http://localhost:4567/syllables/';



let highestStimuliSetId;
let contentGenerationAvailable = false;
let nextStimuliSetId;
let nextEventId = 1;
let stimDisplayTypeMap = {};

// ===== PHASE 1 OPTIMIZATION: Response KC Map Caching =====
// Cache for getResponseKCMap to avoid repeatedly loading all TDFs
let responseKCMapCache = null;
let responseKCMapTimestamp = null;
const RESPONSE_KC_MAP_CACHE_TTL = 3600000; // 1 hour in milliseconds

// How large the distance between two words can be to be considered a match. Larger values result in a slower search. Defualt is 2.
const maxEditDistance = Meteor.settings.SymSpell?.maxEditDistance ? parseInt(Meteor.settings.SymSpell.maxEditDistance) : 2;
// How big the prefix used for indexing is. Larger values will be result in a faster search, but will use more memory. Default is 7.
const prefixLength = Meteor.settings.SymSpell?.prefixLength ? parseInt(Meteor.settings.SymSpell.prefixLength) : 7;
const symSpell = new SymSpell(maxEditDistance, prefixLength);
//get the path to the dictionary in /public/dictionaries
// Only load dictionaries if paths are configured in settings
if (Meteor.settings.frequencyDictionaryLocation) {
  try {
    symSpell.loadDictionary(Meteor.settings.frequencyDictionaryLocation, 0, 1);
    serverConsole('SymSpell frequency dictionary loaded successfully');
  } catch (err) {
    serverConsole('Warning: Failed to load SymSpell frequency dictionary:', err.message);
  }
}
if (Meteor.settings.bigramDictionaryLocation) {
  try {
    symSpell.loadBigramDictionary(Meteor.settings.bigramDictionaryLocation, 0, 2);
    serverConsole('SymSpell bigram dictionary loaded successfully');
  } catch (err) {
    serverConsole('Warning: Failed to load SymSpell bigram dictionary:', err.message);
  }
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
// Username cache will be populated in Meteor.startup (async in Meteor 3.0)

async function getUserIdforUsername(username) {
  let userId = usernameToUserIds[username];
  if (!userId) {
    const user = await Meteor.users.findOneAsync({username: username});
    userId = user._id;
    usernameToUserIds[username] = userId;
  }
  return userId;
}

async function updateActiveThemeDocument(userId, mutator) {
  let activeSetting = await DynamicSettings.findOneAsync({key: 'customTheme'});
  if (!activeSetting || !activeSetting.value) {
    await themeRegistry.ensureActiveTheme();
    activeSetting = await DynamicSettings.findOneAsync({key: 'customTheme'});
  }

  const activeThemeId = activeSetting?.value?.activeThemeId;
  if (!activeThemeId) {
    throw new Meteor.Error('theme-not-found', 'Active theme is not set');
  }

  let entry = themeRegistry.getThemeEntry(activeThemeId);
  if (!entry) {
    await themeRegistry.refreshFromDisk();
    entry = themeRegistry.getThemeEntry(activeThemeId);
  }

  if (!entry) {
    entry = await themeRegistry.ensureStoredThemeRegistered(activeSetting?.value);
  }

  if (!entry) {
    throw new Meteor.Error('theme-not-found', 'Unable to locate active theme');
  }

  if (entry.readOnly) {
    const userRecord = userId ? await Meteor.users.findOneAsync({_id: userId}, {fields: {username: 1}}) : null;
    entry = await themeRegistry.ensureEditableTheme(entry.id, userRecord?.username || userId || 'admin');
  }

  const updatedEntry = await themeRegistry.updateTheme(entry.id, (theme) => {
    const result = mutator(theme);
    return result || theme;
  });
  const serialized = themeRegistry.serializeActiveTheme(updatedEntry);
  await DynamicSettings.upsertAsync({key: 'customTheme'}, {$set: {value: serialized}});
  return {entry: updatedEntry, serialized};
}

async function migrateLegacyHelpPage() {
  const legacyHelp = await DynamicSettings.findOneAsync({key: 'customHelpPage'});
  const legacyValue = legacyHelp?.value;
  if (!legacyValue || !legacyValue.markdownContent) {
    if (legacyHelp) {
      await DynamicSettings.removeAsync({key: 'customHelpPage'});
    }
    return;
  }

  try {
    await updateActiveThemeDocument(legacyValue.uploadedBy || null, (theme) => {
      theme.help = {
        enabled: legacyValue.enabled !== false,
        format: 'markdown',
        markdown: legacyValue.markdownContent,
        url: '',
        uploadedAt: legacyValue.uploadedAt || new Date().toISOString(),
        uploadedBy: legacyValue.uploadedBy || null,
        fileName: legacyValue.fileName || null,
        source: 'legacy'
      };
      return theme;
    });
    await DynamicSettings.removeAsync({key: 'customHelpPage'});
    serverConsole('Migrated legacy custom help page into active theme');
  } catch (err) {
    serverConsole('Warning: Failed to migrate legacy help page:', err.message);
  }
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

async function createExperimentState(curExperimentState) {
  serverConsole('createExperimentState', curExperimentState, curExperimentState.currentTdfId);
  await GlobalExperimentStates.insertAsync({
    userId: Meteor.userId(),
    TDFId: curExperimentState.currentTdfId,
    experimentState: curExperimentState
  });
}

// Published to all clients (even without subscription calls)
Meteor.publish(null, function() {
  // Only valid way to get the user ID for publications
  // eslint-disable-next-line no-invalid-this
  const userId = this.userId;

  // The default data published to everyone - all TDF's and stims, and the
  // user data (user times log and user record) for them
  const defaultData = [
    Meteor.users.find({_id: userId}, {fields: {roles: 1, username: 1, profile: 1, loginParams: 1}}),
  ];

  return defaultData;
});

Meteor.publish('allUsers', async function() {
  const opts = {
    fields: {username: 1},
  };
  // eslint-disable-next-line no-invalid-this
  if (await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
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
// Parameters - updated for Node 22 compatibility
const algo = 'aes-256-cbc';

// Node 22 removed crypto.createCipher/createDecipher (deprecated in Node 10)
// We need to use createCipheriv/createDecipheriv with explicit IV

function encryptData(data) {
  // New encryption format with IV (Node 22 compatible)
  const key = crypto.scryptSync(Meteor.settings.encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algo, key, iv);
  let crypted = cipher.update(data, 'utf8', 'hex');
  crypted += cipher.final('hex');
  return iv.toString('hex') + ':' + crypted; // Prepend IV
}

function decryptData(data) {
  if (!data) return '';

  // Check if this is new format (has IV) or legacy format
  if (data.includes(':')) {
    // New format with IV
    const parts = data.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const key = crypto.scryptSync(Meteor.settings.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv(algo, key, iv);
    let dec = decipher.update(encryptedData, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } else {
    // Legacy format - need to use EVP_BytesToKey (what old createDecipher used)
    // This provides backwards compatibility with existing encrypted data
    const key = evpBytesToKey(Meteor.settings.encryptionKey);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key.key, key.iv);
    decipher.setAutoPadding(true);
    let dec = decipher.update(data, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  }
}

// EVP_BytesToKey implementation for backwards compatibility with old crypto.createDecipher
// This is what Node.js used internally before removing createCipher/createDecipher
function evpBytesToKey(password, keyLen = 32, ivLen = 16) {
  const md5Hashes = [];
  let digest = Buffer.from('');
  let totalLen = 0;

  while (totalLen < keyLen + ivLen) {
    const toHash = Buffer.concat([digest, Buffer.from(password, 'binary')]);
    digest = crypto.createHash('md5').update(toHash).digest();
    md5Hashes.push(digest);
    totalLen += digest.length;
  }

  const result = Buffer.concat(md5Hashes);
  return {
    key: result.slice(0, keyLen),
    iv: result.slice(keyLen, keyLen + ivLen)
  };
}

function createAwsHmac(secretKey, dataString) {
  return crypto
      .createHmac('sha1', secretKey)
      .update(dataString)
      .digest('base64');
}

async function getTdfById(TDFId) {
  const tdf = await Tdfs.findOneAsync({_id: TDFId});
  return tdf;
}

async function checkCongentGenerationAvailable() {
  try {
    const response = await fetch('http://spacy:80');
    return true
  } catch (error) {
    return false;
  }
}

async function getTdfByFileName(filename) {
  try {
    const tdf = await Tdfs.findOneAsync({"content.fileName": filename});
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
  experimentTarget = experimentTarget.toLowerCase();
  try {
    serverConsole('getTdfByExperimentTarget:'+experimentTarget);
    const tdf = await Tdfs.findOneAsync({"content.tdfs.tutor.setspec.experimentTarget": experimentTarget});
    return tdf;
  } catch (e) {
    serverConsole('getTdfByExperimentTarget ERROR,', experimentTarget, ',', e);
    return null;
  }
}

async function getAllTdfs() {
  serverConsole('getAllTdfs');
  const tdfs = await Tdfs.find({}).fetchAsync();
  return tdfs;
}

async function updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds) {
  serverConsole('updateProbabilityEstimates', TDFId);
  const probEstimates = await ProbabilityEstimates.findOneAsync({TDFId: TDFId})
  if(probEstimates){
    await ProbabilityEstimates.updateAsync({_id: probEstimates._id}, {$set: {clusterProbs: clusterProbs, individualStimProbs: individualStimProbs, relevantKCIds: relevantKCIds}});
  } else {
    await ProbabilityEstimates.insertAsync({TDFId: TDFId, clusterProbs: clusterProbs, individualStimProbs: individualStimProbs, relevantKCIds: relevantKCIds});
  }
}

async function updateSingleProbabilityEstimate(TDFId, KCId, probabilityEstimate) {
  serverConsole('updateSingleProbabilityEstimate', TDFId, KCId, probabilityEstimate);
  const probEstimates = await ProbabilityEstimates.findOneAsync({TDFId: TDFId})
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
    await updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds);
  }
}

async function getProbabilityEstimatesByKCId(TDFId, relevantKCIds) {
  serverConsole('getProbabilityEstimatesByKCId', TDFId);
  const probEstimates = await ProbabilityEstimates.findOneAsync({TDFId: TDFId})

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
    await updateProbabilityEstimates(TDFId, clusterProbs, individualStimProbs, relevantKCIds);
    return { clusterProbs, individualStimProbs };
  }
  return probEstimates;
}

// ===== PHASE 1 OPTIMIZATION: Cached version of getResponseKCMap =====
async function getResponseKCMap() {
  const now = Date.now();

  // Return cached version if valid (less than 1 hour old)
  if (responseKCMapCache && responseKCMapTimestamp && (now - responseKCMapTimestamp) < RESPONSE_KC_MAP_CACHE_TTL) {
    serverConsole('getResponseKCMap - using cache (age: ' + Math.round((now - responseKCMapTimestamp) / 1000 / 60) + ' minutes)');
    return responseKCMapCache;
  }

  // Build fresh cache
  serverConsole('getResponseKCMap - building fresh cache (loading all TDFs)');

  let responseKCStuff = await Tdfs.find().fetchAsync();
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

  // Update cache
  responseKCMapCache = responseKCMap;
  responseKCMapTimestamp = now;
  serverConsole('getResponseKCMap - cache updated');

  return responseKCMap;
}

// ===== PHASE 1 OPTIMIZATION: Cache Invalidation =====
function invalidateResponseKCMapCache() {
  if (responseKCMapCache) {
    serverConsole('invalidateResponseKCMapCache - cache cleared');
  }
  responseKCMapCache = null;
  responseKCMapTimestamp = null;
}

// Optimized version that only fetches responseKC mappings for a single TDF
// This is 100x+ faster than getResponseKCMap() which fetches ALL TDFs
async function getResponseKCMapForTdf(tdfId) {
  serverConsole('getResponseKCMapForTdf', tdfId);

  const tdf = await Tdfs.findOneAsync({_id: tdfId});
  if (!tdf || !tdf.stimuli) {
    serverConsole('getResponseKCMapForTdf: TDF not found or has no stimuli', tdfId);
    return {};
  }

  const responseKCMap = {};
  for (const stim of tdf.stimuli) {
    if (stim && stim.correctResponse !== undefined) {
      const answerText = getDisplayAnswerText(stim.correctResponse);
      responseKCMap[answerText] = stim.responseKC;
    }
  }

  serverConsole('getResponseKCMapForTdf: Built map with', Object.keys(responseKCMap).length, 'entries');
  return responseKCMap;
}

async function clearCurUnitProgress(userId, TDFId) {
  let unit = await ComponentStates.findOneAsync({userId: userId, TDFId: TDFId});
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
    await ComponentStates.updateAsync({_id: unit._id}, unit);
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
  // Security: Authorization check - only owner or admin/teacher can process uploads
  if (!this.userId) {
    throw new Meteor.Error(401, 'Must be logged in to upload packages');
  }

  if (owner !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
    throw new Meteor.Error(403, 'Can only upload packages for yourself unless admin');
  }

  if (!await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher'])) {
    throw new Meteor.Error(403, 'Only admins and teachers can upload packages');
  }

  await DynamicAssets.collection.updateAsync({_id: fileObj._id}, {$set: {'meta.link': zipLink}});
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

      // Security: Validate path to prevent path traversal attacks
      if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\\..')) {
        throw new Meteor.Error(400, 'Invalid file path in zip: path traversal detected');
      }

      const filePathArray = filePath.split("/");
      fileName = filePathArray[filePathArray.length - 1];

      // Security: Validate filename
      if (fileName.includes('..') || fileName.includes('\\')) {
        throw new Meteor.Error(400, 'Invalid filename in zip: ' + fileName);
      }

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
    serverConsole('Unzipped', unzippedFiles.length, 'files');
    const stimFileName = unzippedFiles.filter(f => f.type == 'stim')[0].name;
    const results = await new Promise(async (resolve, reject) => {
      const res = [];
      try {
        for(const tdf of unzippedFiles.filter(f => f.type == 'tdf')){
          const stim = unzippedFiles.find(f => f.name == tdf.contents.tutor.setspec.stimulusfile);
          serverConsole('Processing stimFileName:', stimFileName, 'from setspec:', tdf.contents.tutor.setspec.stimulusfile);
          tdf.packageFile = packageFile;
          //search for google TTS  api key and encrypt it
          if(tdf.contents.tutor.setspec.textToSpeechAPIKey){
            tdf.contents.tutor.setspec.textToSpeechAPIKey = encryptData(tdf.contents.tutor.setspec.textToSpeechAPIKey);
          }
          //search for google speech to text api key and encrypt it
          if(tdf.contents.tutor.setspec.speechAPIKey){
            tdf.contents.tutor.setspec.speechAPIKey = encryptData(tdf.contents.tutor.setspec.speechAPIKey);
          }
          const packageResult = await combineAndSaveContentFile(tdf, stim, owner);
          res.push(packageResult);
          // REDUCED: Don't log entire package result object
          serverConsole('packageResult success:', packageResult?.tdfFileName || 'unknown');
        }
        resolve(res)
      } catch(e) {
        if(emailToggle){
          sendEmail(
            (await Meteor.userAsync()).emails[0].address,
            ownerEmail,
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
          (await Meteor.userAsync()).emails[0].address,
          ownerEmail,
          "Package Upload Failed",
          "Package upload failed at media upload: " + e + " on file: " + filePath
        )
      }
      serverConsole('2 processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
      throw new Meteor.Error('package upload failed at media upload: ' + e + ' on file: ' + filePath)
    }
    serverConsole('Package upload completed with', results.length, 'results');
    if(emailToggle){
      sendEmail(
        (await Meteor.userAsync()).emails[0].address,
        ownerEmail,
        "Package Upload Successful",
        "Package upload successful: " + fileName
      )
    }
    return {results, stimSetId};
  } catch(e) {
      if(emailToggle){
        sendEmail(
          (await Meteor.userAsync()).emails[0].address,
          ownerEmail,
          "Package Upload Failed",
          "Package upload failed at initialization: " + e + " on file: " + filePath
        )
      }
    serverConsole('3 processPackageUpload ERROR,', path, ',', e + ' on file: ' + filePath);
    throw new Meteor.Error('package upload failed at initialization: ' + e + ' on file: ' + filePath)
  } finally {
    for(const tdfFile of unzippedFiles.filter(f => f.type == 'tdf')) {
      const tdf = await Tdfs.findOneAsync({tdfFileName: tdfFile.name})
      if (tdf && tdf.content && tdf.content.tdfs && tdf.content.tdfs.tutor && tdf.content.tdfs.tutor.unit) {
        const t = await processAudioFilesForTDF(tdf.content.tdfs);
        tdf.content.tdfs.tutor.unit = t.tutor.unit
        await Tdfs.upsertAsync({_id: tdf._id}, tdf)
      }
    }

    // PHASE 1 OPTIMIZATION: Invalidate cache after package upload completes
    invalidateResponseKCMapCache();
  }
}

async function saveMediaFile(media, owner, stimSetId){
  serverConsole("Uploading:", media.name);
  const foundFile = await DynamicAssets.collection.findOneAsync({userId: owner, name: media.name})
  if(foundFile){
    await DynamicAssets.removeAsync({_id: foundFile._id});
    serverConsole(`File ${media.name} already exists, overwritting.`);
  }
  else{
    serverConsole(`File ${media.name} doesn't exist, uploading`)
  }

  try {
    // METEOR 3 FIX: Use writeAsync instead of write callback
    const fileRef = await DynamicAssets.writeAsync(media.contents, {
      fileName: media.name,
      userId: owner,
      meta: {
        stimuliSetId: stimSetId,
        public: true
      }
    });

    const link = DynamicAssets.link(fileRef);
    await DynamicAssets.collection.updateAsync({_id: fileRef._id}, {$set: {'meta.link': link}});
    serverConsole(`File ${media.name} uploaded successfully`);
    return fileRef;
  } catch (error) {
    serverConsole(`File ${media.name} could not be uploaded`, error);
    throw error;
  }
}

// Content Validation
async function validateStimAndTdf(tdfJson, stimJson, tdfFileName, stimFileName) {
  // Check stimulus file structure
  if (!stimJson || !stimJson.setspec || !Array.isArray(stimJson.setspec.clusters)) {
    return { result: false, errmsg: `Stimulus file "${stimFileName}" missing clusters array.` };
  }
  const clusters = stimJson.setspec.clusters;
  if (!clusters.length) {
    return { result: false, errmsg: `Stimulus file "${stimFileName}" has no clusters.` };
  }
  // Check each cluster and stim
  for (const [clusterIdx, cluster] of clusters.entries()) {
    if (!cluster || !Array.isArray(cluster.stims) || !cluster.stims.length) {
      return { result: false, errmsg: `Cluster ${clusterIdx} in "${stimFileName}" missing or empty stims array.` };
    }
    // Check for duplicate correctResponses in cluster
    const corrects = cluster.stims.map(s => s.response && s.response.correctResponse).filter(Boolean);
    if (new Set(corrects).size !== corrects.length) {
      return { result: false, errmsg: `Duplicate correctResponse values in cluster ${clusterIdx} of "${stimFileName}".` };
    }
    for (const [stimIdx, stim] of cluster.stims.entries()) {
      if (!stim || typeof stim !== 'object') {
        return { result: false, errmsg: `Stim ${stimIdx} in cluster ${clusterIdx} is not an object.` };
      }
      if (!stim.response || typeof stim.response !== 'object' || !stim.response.hasOwnProperty('correctResponse')) {
        return { result: false, errmsg: `Stim ${stimIdx} in cluster ${clusterIdx} missing correctResponse.` };
      }
      // Display fields should be strings if present
      if (stim.display) {
        ['text', 'audioSrc', 'imgSrc', 'videoSrc'].forEach(field => {
          if (stim.display[field] && typeof stim.display[field] !== 'string') {
            return { result: false, errmsg: `Stim ${stimIdx} in cluster ${clusterIdx} has non-string display.${field}.` };
          }
        });
        //validate that audioSrc, imgSrc, and videoSrc are valid URLs or in DynamicAssets
        for (const field of ['audioSrc', 'imgSrc', 'videoSrc']) {
          if (stim.display[field]) {
            const url = stim.display[field];
            if (!url.startsWith('http') && !await DynamicAssets.collection.findOneAsync({name: url})) {
              return { result: false, errmsg: `Stim ${stimIdx} in cluster ${clusterIdx} has invalid display.${field}: ${url}.` };
            }
          }
        }
      }
    }
  }
  // TDF checks
  if (!tdfJson.tutor || !tdfJson.tutor.setspec) {
    return { result: false, errmsg: `TDF "${tdfFileName}" missing tutor.setspec.` };
  }
  if (!tdfJson.tutor.setspec.lessonname || typeof tdfJson.tutor.setspec.lessonname !== 'string') {
    return { result: false, errmsg: `TDF "${tdfFileName}" missing or invalid lessonname.` };
  }
  if (!tdfJson.tutor.setspec.stimulusfile || typeof tdfJson.tutor.setspec.stimulusfile !== 'string') {
    return { result: false, errmsg: `TDF "${tdfFileName}" missing or invalid stimulusfile.` };
  }
  // Check all cluster indices referenced in TDF exist in stim file
  function extractClusterIndicesFromTDF(tdf) {
    let indices = new Set();
    const units = [
      ...(tdf.tutor.unit || []),
      ...(tdf.tutor.unitTemplate || [])
    ];
    for (const [unitIdx, unit] of units.entries()) {
      if (unit.hasOwnProperty('clusterIndex')) {
        indices.add(Number(unit.clusterIndex));
      }
      if (unit.assessmentsession && unit.assessmentsession.clusterlist) {
        const cl = unit.assessmentsession.clusterlist;
        if (typeof cl === "string") {
          cl.split(',').forEach(part => {
            if (part.includes('-')) {
              const [start, end] = part.split('-').map(Number);
              for (let i = start; i <= end; i++) indices.add(i);
            } else {
              indices.add(Number(part));
            }
          });
        }
      }
    }
    return Array.from(indices);
  }
  const tdfClusterRefs = extractClusterIndicesFromTDF(tdfJson);
  for (const idx of tdfClusterRefs) {
    if (isNaN(idx) || idx < 0 || idx >= clusters.length) {
      return { result: false, errmsg: `TDF "${tdfFileName}" references cluster index ${idx}, but stimulus file "${stimFileName}" only has ${clusters.length} clusters.` };
    }
  }
  return { result: true };
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
  let ownerId = owner ? owner : (await Meteor.userAsync())._id;
  if (!ownerId) throw new Error('No user logged in - no file upload allowed');
  if (!await Roles.userIsInRoleAsync(ownerId, ['admin', 'teacher'])) throw new Error('You are not authorized to upload files');
  if (type != 'tdf' && type != 'stim') throw new Error('Unknown file type not allowed: ' + type);

  try {
    if (type == 'tdf') {
      let jsonContents;
      try {
        jsonContents = typeof filecontents == 'string' ? JSON.parse(filecontents) : filecontents;
      } catch (e) {
        results.result = false;
        results.errmsg = `Error parsing JSON in file "${filename}": ${e.message}`;
        return results;
      }
      const stimFileName = jsonContents.tutor.setspec.stimulusfile;
      const stimTdf = await Tdfs.findOneAsync({stimulusFileName: stimFileName});
      const stimJson = stimTdf ? stimTdf.rawStimuliFile : null;
      const validation = await validateStimAndTdf(jsonContents, stimJson, filename, stimFileName);
      if (!validation.result) {
        results.result = false;
        results.errmsg = validation.errmsg;
        return results;
      }
      // Continue with normal upsert logic...
      await upsertTDFFile(filename, {fileName: filename, tdfs: jsonContents, ownerId: ownerId, source: 'upload'}, ownerId, packagePath);
      results.result = true;
      results.errmsg = '';
      return results;
    } else if (type === 'stim') {
      let jsonContents;
      try {
        jsonContents = typeof filecontents == 'string' ? JSON.parse(filecontents) : filecontents;
      } catch (e) {
        results.result = false;
        results.errmsg = `Error parsing JSON in stimulus file "${filename}": ${e.message}`;
        return results;
      }
      await upsertStimFile(filename, jsonContents, ownerId, packagePath);
      results.data = jsonContents;
    }
  } catch (e) {
    serverConsole('ERROR saving content file:', e, e.stack);
    results.result = false;
    results.errmsg = `saveContentFile error in file "${filename}": ${e && e.message ? e.message : e}`;
    return results;
  }

  results.result = true;
  results.errmsg = '';
  return results;
}
async function combineAndSaveContentFile(tdf, stim, owner) {
  serverConsole('combineAndSaveContentFile for owner:', owner);
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
    ownerId = (await Meteor.userAsync())._id;
  }
  if (!ownerId) {
    throw new Error('No user logged in - no file upload allowed');
  }
  if (!await Roles.userIsInRoleAsync(ownerId, ['admin', 'teacher'])) {
    throw new Error('You are not authorized to upload files');
  }

  try {
    const jsonContents = typeof tdf.contents == 'string' ? JSON.parse(tdf.contents) : tdf.contents;
    const jsonPackageFile = tdf.packageFile;
    if (jsonContents.tutor.setspec.experimentTarget)
      jsonContents.tutor.setspec.experimentTarget = jsonContents.tutor.setspec.experimentTarget.toLowerCase();
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

function extractSrcFromHtml(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') {
    return [];
  }
  
  const srcValues = [];
  
  // Multiple regex patterns to catch different src attribute formats
  const patterns = [
    // Standard src="value" (with double quotes)
    /src\s*=\s*"([^"]+)"/gi,
    // Single quotes src='value'
    /src\s*=\s*'([^']+)'/gi,
    // No quotes src=value (ends at space or >)
    /src\s*=\s*([^\s>]+)/gi
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(htmlString)) !== null) {
      let srcValue = match[1].trim();
      // Remove backslashes and quotes that might be escaped or malformed
      srcValue = srcValue.replace(/[\\\"]/g, '');
      if (srcValue && !srcValues.includes(srcValue)) {
        srcValues.push(srcValue);
      }
    }
  });
  
  return srcValues;
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
    let coursesRet =  await Courses.find().fetchAsync();
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
    const ret =  await Courses.rawCollection().aggregate([
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
  const course = await Courses.findOneAsync({courseId: courseId});
  return course;
}

async function getAllCoursesForInstructor(instructorId) {
  serverConsole('getAllCoursesForInstructor:', instructorId);
  const courses =  await Courses.find({teacherUserId: instructorId, semester: curSemester}).fetchAsync();
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

async function updateUserAssignments(courseId) {
  serverConsole('updateUserAssignments', courseId);
  const sections = await Sections.find({courseId: courseId}).fetchAsync();
  const students = [];
  for (const section of sections) {
    const studentsInSection = await SectionUserMap.find({sectionId: section._id}).fetchAsync();
    for(const student of studentsInSection){
      // REMOVED: Don't log every student in loop
      // serverConsole({studentId: student.userId, sectionId: section._id})
      students.push({studentId: student.userId, sectionId: section._id});
    }
  }
  serverConsole('updateUserAssignments: Processing', students.length, 'students');
  for(const student of students){
    const assignedTDFs = await getTdfsAssignedToStudent(student.studentId, student.sectionId);
    // REDUCED: Don't log full objects, just counts
    // serverConsole('updating student', student, 'with new assignments', assignedTDFs);
    const loginParams = await Meteor.users.findOneAsync({_id: student.studentId}).loginParams;
    loginParams.assignedTDFs = assignedTDFs;
    await Meteor.users.updateAsync({_id: student.studentId}, {$set: {loginParams: loginParams}});
  }
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

    const tdfNamesAndIDs =  await Tdfs.find().fetchAsync();
    const tdfNameIDMap = {};
    for (const tdfNamesAndID of tdfNamesAndIDs) {
      tdfNameIDMap[tdfNamesAndID.content.fileName] = tdfNamesAndID._id;
    }

    serverConsole('editCourseAssignments: Adding', tdfsAdded.length, 'TDFs, removing', tdfsRemoved.length, 'TDFs');
    for (const tdfName of tdfsAdded) {
      const TDFId = tdfNameIDMap[tdfName];
      // REMOVED: Don't log 7 large arrays for every TDF in loop!
      // serverConsole('editCourseAssignments tdf:', tdfNamesAndIDs, TDFId, tdfName, tdfsAdded, tdfsRemoved,
      //     curCourseAssignments, existingTdfs, newTdfs);
      await Assignments.insertAsync({courseId: newCourseAssignment.courseId, TDFId: TDFId});
    }
    for (const tdfName of tdfsRemoved) {
      const TDFId = tdfNameIDMap[tdfName];
      await Assignments.removeAsync({courseId: newCourseAssignment.courseId, TDFId: TDFId});
    }
    updateUserAssignments(newCourseAssignment.courseId);
    return newCourseAssignment;
  } catch (e) {
    // REDUCED: Don't log entire course assignment object on error
    serverConsole('editCourseAssignments ERROR for courseId:', newCourseAssignment.courseId, ',', e);
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
  // REDUCED: Don't log entire array, just count
  serverConsole('Found', assignmentTdfFileNamesRet.length, 'assigned TDFs');
  // const courses =  await Courses.find({teacherUserId: instructorId}).fetchAsync();
  // const assignments =  await Assignments.find().fetchAsync();
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
  // REMOVED: Already logged count above, don't log entire array
  // serverConsole('assignmentTdfFileNames', assignmentTdfFileNamesRet);
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
    const tdfs =  await Tdfs.find({ownerId: ownerId}).fetchAsync();
    const ownedTdfFileNames = tdfs.map(tdf => tdf.content.fileName);
    // REDUCED: Don't log entire array, just count
    serverConsole('ownedTdfFileNames count:', ownedTdfFileNames.length);
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
    const tdfs =  await Tdfs.find({accessors: accessorId}).fetchAsync();
    const accessibleTdfFileNames = tdfs.map(tdf => tdf.content.fileName);
    // REDUCED: Don't log entire array, just count
    serverConsole('accessibleTdfFileNames count:', accessibleTdfFileNames.length);
    return accessibleTdfFileNames;
  } catch (e) {
    serverConsole('getTdfNamesByAccessorId ERROR,', e);
    return null;
  }
}

async function cleanExperimentStateDupes(experimentStates, idToKeep) {
  for(const eS of experimentStates){
    if(eS._id !== idToKeep)
      await GlobalExperimentStates.removeAsync({_id: eS._id});
  }
}

async function getExperimentState(userId, TDFId) { // by currentRootTDFId, not currentTdfId
  const experimentStateRet =  await GlobalExperimentStates.find({userId: userId, TDFId: TDFId}).fetchAsync();
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
  // REDUCED LOGGING: Only log essential info, not entire experiment state objects
  serverConsole('setExperimentState:', where, userId, TDFId);
  const experimentStateRet = await GlobalExperimentStates.findOneAsync({_id: experimentStateId})
  // serverConsole(experimentStateRet)
  // serverConsole(newExperimentState)
  if (experimentStateRet != null) {
    const updatedExperimentState = Object.assign(experimentStateRet.experimentState, newExperimentState);
    await GlobalExperimentStates.updateAsync({_id: experimentStateId}, {$set: {experimentState: updatedExperimentState}})
    return updatedExperimentState;
  }
  await GlobalExperimentStates.insertAsync({userId: userId, TDFId: TDFId, experimentState: newExperimentState});

  return TDFId;
}

async function insertHiddenItem(userId, stimulusKC, tdfId) {
  let unit = await ComponentStates.findOneAsync({userId: userId, TDFId: tdfId})
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
      await ComponentStates.updateAsync({_id: unit._id}, {$set: {stimStates: unit.stimStates}});
    }
  }
  
}

async function getUserLastFeedbackTypeFromHistory(tdfID) {
  const userHistory =  await Histories.findOneAsync({TDFId: tdfID, userId: Meteor.userId}, {sort: {time: -1}})?.feedbackType
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
  // REMOVED: This logs the entire history record on EVERY trial answer - extremely verbose
  // serverConsole('insertHistory', historyRecord);
  await Histories.insertAsync(historyRecord)
}

async function getLastTDFAccessed(userId) {
  const lastExperimentStateUpdated = await GlobalExperimentStates.findOneAsync({userId: userId}, {sort: {"experimentState.lastActionTimeStamp": -1}, limit: 1});;
  const lastTDFId = lastExperimentStateUpdated.TDFId;
  return lastTDFId;
}

async function getHistoryByTDFID(TDFId) {
  const history =  await Histories.find({TDFId: TDFId}).fetchAsync();
  return history;
}

async function getUserRecentTDFs(userId) {
  const history =  await Histories.find({userId: userId}, {sort: {time: -1}, limit: 5}).fetchAsync();
  //get all tdfs that match the history
  const recentTDFs = [];
  for (const historyRecord of history) {
    const tdf = await Tdfs.findOneAsync({_id: historyRecord.TDFId});
    recentTDFs.push(tdf);
  }
  return recentTDFs;
}

async function getAllTeachers(southwestOnly=false) {
  const query = {'roles': 'teacher'};
  if (southwestOnly) query['username']=/southwest[.]tn[.]edu/i;
  serverConsole('getAllTeachers', query);
  const allTeachers = await Meteor.users.find(query).fetchAsync();

  return allTeachers;
}

async function addCourse(mycourse) {
  serverConsole('addCourse:' + JSON.stringify(mycourse));
  const courseId = await Courses.insertAsync(mycourse);
  for (const sectionName of mycourse.sections) {
    await Sections.insertAsync({courseId: courseId, sectionName: sectionName})
  }
  return courseId;
}

async function editCourse(mycourse) {
  serverConsole('editCourse:' + JSON.stringify(mycourse));
  await Courses.updateAsync({_id: mycourse._id}, mycourse);
  const newSections = mycourse.sections;
  const curCourseSections =  await Sections.find({courseId: mycourse.courseId}).fetchAsync()
  const oldSections = curCourseSections.map((section) => section.sectionName);
  serverConsole('old/new', oldSections, newSections);

  const sectionsAdded = getSetAMinusB(newSections, oldSections);
  const sectionsRemoved = getSetAMinusB(oldSections, newSections);
  serverConsole('sectionsAdded,', sectionsAdded);
  serverConsole('sectionsRemoved,', sectionsRemoved);

  for (const sectionName of sectionsAdded) {
    await Sections.insertAsync({courseId: mycourse.courseId, sectionName: sectionName});
  }
  for (const sectionName of sectionsRemoved) {
    await Sections.removeAsync({courseId: mycourse.courseId, sectionName: sectionName});
  }

  return mycourse.courseId;
}

async function addUserToTeachersClass(userId, teacherID, sectionId) {
  serverConsole('addUserToTeachersClass', userId, teacherID, sectionId);

  const existingMappingCount =  await SectionUserMap.find({sectionId: sectionId, userId: userId}).countAsync();
  serverConsole('existingMapping', existingMappingCount);
  if (existingMappingCount == 0) {
    serverConsole('new user, inserting into section_user_mapping', [sectionId, userId]);
    await SectionUserMap.insertAsync({sectionId: sectionId, userId: userId});
  }

  return true;
}

async function updateStimDisplayTypeMap(){
  serverConsole('getStimDisplayTypeMap');
  const tdfs = await Tdfs.find().fetchAsync();
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

async function getClassPerformanceByTDF(classId, tdfId, date=false) {
  serverConsole('getClassPerformanceByTDF', classId, tdfId, date);
  const sections =  await Sections.find({courseId: classId}).fetchAsync();
  const sectionIds = sections.map((section) => section._id);
  const userIds =  await SectionUserMap.find({sectionId: {$in: sectionIds}}).fetchAsync().map((user) => user.userId);
  const performanceMet = [];
  const performanceNotMet = [];
  if(!date){
    const curDate = new Date();
    date = curDate.getTime();
  }
  const res1 =  await Histories.find({userId: {$in: userIds}, TDFId: tdfId, levelUnitType: {$ne: "Instruction"}}).fetchAsync();
  for(let history of res1){
    var outcome = 0;
    if(history.outcome === "correct"){
      outcome = 1;
    }
    var exception = false;
    var exceptions = await Meteor.users.findOneAsync({_id: history.userId}).dueDateExceptions || [];
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
      performanceMet[index].username = await Meteor.users.findOneAsync({_id: history.userId}).username;
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
      performanceNotMet[index].username = await Meteor.users.findOneAsync({_id: history.userId}).username;
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

async function addUserDueDateException(userId, tdfId, classId, date){
  serverConsole('addUserDueDateException', userId, tdfId, date);
  exception = {
    tdfId: tdfId,
    classId: classId,
    date: date,
  }
  user = await Meteor.users.findOneAsync({_id: userId});
  if(user.dueDateExceptions){
    user.dueDateExceptions.push(exception);
  }
  else{
    user.dueDateExceptions = [exception];
  }
  await Meteor.users.updateAsync({_id: userId}, user);
}

async function checkForTDFData(tdfId){
  const userId = Meteor.userId();
  serverConsole('checkForTDFData', tdfId, userId);
  const tdf = await Histories.findOneAsync({TDFId: tdfId, userId: userId, $and: [ {levelUnitType: {$ne: "schedule"}}, {levelUnitType: {$ne: "Instruction"}} ] });
  if(tdf){
    return true;
  }
  return false;
}

async function checkForUserException(userId, tdfId){
  serverConsole('checkForUserException', userId, tdfId);
  user = await Meteor.users.findOneAsync({_id: userId});
  if(user.dueDateExceptions){
    var exceptions = user.dueDateExceptions;
    var exception = exceptions.find((item) => item.tdfId == tdfId);
    if(exception){
      const exceptionDate = new Date(exception.date);
      const exceptionDateReadable = exceptionDate.toLocaleDateString();
      return exceptionDateReadable;
    }
  }
  return false;
}

async function removeUserDueDateException(userId, tdfId){
  serverConsole('removeUserDueDateException', userId, tdfId);
  user = await Meteor.users.findOneAsync({_id: userId});
  if(user.dueDateExceptions){
    exceptionIndex = user.dueDateExceptions.findIndex((item) => item.tdfId == tdfId);
    if(exceptionIndex > -1){
      user.dueDateExceptions.splice(exceptionIndex, 1);
    } else {
      serverConsole('removeUserDueDateException ERROR, no exception found', userId, tdfId);
    }
  }
  await Meteor.users.updateAsync({_id: userId}, user);
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
    if (!TDF) {
      serverConsole('getListOfStimTagsByTDFFileNames: TDF not found for', TDFFileName);
      continue; // Skip this TDF if not found
    }
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
  return Tdfs.rawCollection().aggregate([
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
  const idRet = await Tdfs.findOneAsync({stimulusFileName: stimFilename});
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

  const componentState = await ComponentStates.findOneAsync({userId: userId, TDFId: TDFId});
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

  studentPerformance[0].totalStimCount = await ComponentStates.find({userId: userId, TDFId: TDFId, componentType: 'stimulus'}).countAsync();
  return studentPerformance[0];
}

//get most recent history record for a student given a tdfid, cluster index, and stimulus index. All we want is the outcome
async function getStudentPerformanceByStimulus(userId, TDFId, clusterIndex, stimulusIndex) {
  serverConsole('getStudentPerformanceByStimulus', userId, TDFId, clusterIndex, stimulusIndex);
  const history = await Histories.findOneAsync({userId: userId, TDFId: TDFId, clusterIndex: clusterIndex, stimulusIndex: stimulusIndex}, {sort: {time: -1}});
  return history ? history.outcome : null;
}



async function getNumDroppedItemsByUserIDAndTDFId(userId, TDFId){
  //used to grab a limited sample of the student's performance
  serverConsole('getNumDroppedItemsByUserIDAndTDFId', userId, TDFId);
  const count =  await Histories.find({userId: userId, TDFId: TDFId, CFItemRemoved: true, levelUnitType: 'model'}).countAsync();
  return count;
}

async function getStudentPerformanceForClassAndTdfId(instructorId, date=null) {
  let studentPerformanceRet = [];
  let hist;
  if(date){
    hist =  await Histories.find({levelUnitType: "model", recordedServerTime: {$lt: date}}).fetchAsync();
  }
  else {
    hist =  await Histories.find({levelUnitType: "model"}).fetchAsync();
  }

  const courses =  await Courses.find({teacherUserId: instructorId}).fetchAsync();
  const sections = await Sections.find({courseId: {$in: courses.map(x => x._id)}}).fetchAsync();
  const userMap =  await SectionUserMap.find().fetchAsync();

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
      serverConsole(await Meteor.users.findOneAsync({_id: userId}).username + ', ' + userId);
      studentUsername = await Meteor.users.findOneAsync({_id: userId}).username;
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
  for (const index of Object.keys(studentPerformanceForClass)) {
    const coursetotals = studentPerformanceForClass[index];
    for (const index2 of Object.keys(coursetotals)) {
      const tdftotal = coursetotals[index2];
      tdftotal.percentCorrect = ((tdftotal.numCorrect / tdftotal.count)*100).toFixed(2) + '%',
      tdftotal.totalTimeDisplay = (tdftotal.totalTime / (60 * 1000) ).toFixed(1); // convert to minutes from ms
    }
  }
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
  // First try GlobalExperimentStates, then fall back to Histories for older data
  let tdfRet =  await GlobalExperimentStates.find({userId: userId}).fetchAsync();

  // If no data in GlobalExperimentStates, check Histories
  if (tdfRet.length === 0) {
    const historyTdfIds = await Histories.find(
      {userId: userId, levelUnitType: 'model'},
      {fields: {TDFId: 1}, sort: {recordedServerTime: -1}}
    ).fetchAsync();

    // Get unique TDF IDs from history
    const uniqueTdfIds = [...new Set(historyTdfIds.map(h => h.TDFId))];
    tdfRet = uniqueTdfIds.map(TDFId => ({TDFId}));
  }

  const tdfsAttempted = [];
  const seenTdfIds = new Set();

  for (const obj of tdfRet) {
    const TDFId = obj.TDFId;

    // Skip if we've already processed this TDF
    if (seenTdfIds.has(TDFId)) {
      continue;
    }
    seenTdfIds.add(TDFId);

    const tdf = await getTdfById(TDFId)
    if (!tdf) {
      continue;
    }
    const tdfObject = tdf.content;
    if (!tdfObject.tdfs.tutor.unit) {
      continue;
    }
    // Remove progressReporterParams requirement - we'll compute simple stats from history
    if (tdfObject.tdfs.tutor.setspec.disableProgressReport) {
      continue;
    }

    // Add the TDF - we'll show stats for anything with history
    const displayName = tdfObject.tdfs.tutor.setspec.lessonname;
    tdfsAttempted.push({_id: TDFId, TDFId, displayName});
  }

  return tdfsAttempted;
}

async function getSimpleTdfStats(userId, tdfId) {
  // PHASE 1.7 DEPRECATION: This method is deprecated in favor of 'userHistory' publication
  // Kept for backward compatibility - new code should use Meteor.subscribe('userHistory')
  // and compute stats client-side using computeTdfStats() helper
  serverConsole('getSimpleTdfStats [DEPRECATED - use userHistory publication instead]');

  // Get all history for this user and TDF (excluding instructions and assessments)
  const history = await Histories.find({
    userId: userId,
    TDFId: tdfId,
    levelUnitType: 'model'
  }, {
    sort: { recordedServerTime: 1 }
  }).fetchAsync();

  if (history.length === 0) {
    return null;
  }

  // Calculate basic stats
  let correct = 0;
  let incorrect = 0;
  let totalTime = 0;
  const uniqueItems = new Set();
  const sessionDates = new Set();
  const last10 = history.slice(-10);
  let last10Correct = 0;

  for (const trial of history) {
    if (trial.outcome === 'correct') correct++;
    else if (trial.outcome === 'incorrect') incorrect++;

    // Sum endLatency and feedbackLatency for total time practiced
    const endLatency = trial.CFEndLatency || 0;
    const feedbackLatency = trial.CFFeedbackLatency || 0;
    totalTime += (endLatency + feedbackLatency);

    // Track unique items practiced by itemId, CFStimFileIndex, or problemName
    const itemIdentifier = trial.itemId || trial.CFStimFileIndex || trial.problemName;
    if (itemIdentifier !== undefined && itemIdentifier !== null) {
      uniqueItems.add(itemIdentifier);
    }

    // Track unique practice dates
    const date = new Date(trial.recordedServerTime);
    sessionDates.add(date.toDateString());
  }

  // Last 10 trials accuracy
  for (const trial of last10) {
    if (trial.outcome === 'correct') last10Correct++;
  }

  const totalTrials = history.length;
  const overallAccuracy = (correct + incorrect) > 0 ? (correct / (correct + incorrect) * 100).toFixed(1) : 0;
  const last10Accuracy = last10.length > 0 ? (last10Correct / last10.length * 100).toFixed(1) : 0;
  const totalTimeMinutes = (totalTime / 60000).toFixed(1);
  const lastPracticeDate = new Date(history[history.length - 1].recordedServerTime).toLocaleDateString();
  const totalSessions = sessionDates.size;

  return {
    totalTrials,
    overallAccuracy,
    last10Accuracy,
    totalTimeMinutes,
    itemsPracticed: uniqueItems.size,
    lastPracticeDate,
    totalSessions
  };
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

async function sendErrorReportSummaries() {
  serverConsole('sendErrorReportSummaries');
  const unsentErrorReports =  await ErrorReports.find({'emailed': false}).fetchAsync();
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
        const userWhoReportedError = await Meteor.users.findOneAsync({_id: unsentErrorReport.user});
        const userWhoReportedErrorUsername = userWhoReportedError ? userWhoReportedError.username : 'UNKNOWN';
        //make a nice email body for the user who reported the error
        const textIndividual = 'Hi ' + userWhoReportedErrorUsername + ', \n\n' +
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
          if (userWhoReportedError.emails && userWhoReportedError.emails.length > 0 ) {
            const toIndividual = userWhoReportedError.emails[0].address + ', ' + admin;
          const subjectIndividual = 'Mofacts Error Report - ' + thisServerUrl;
          sentErrorReports.add(unsentErrorReport._id);
          sendEmail(toIndividual, admin, subjectIndividual, textIndividual);
          }
        }
        catch (err) {
          serverConsole(err);
        }
        await ErrorReports.updateAsync({_id: unsentErrorReport._id}, {$set: {'emailed': true}});
      }
      try {
        sendEmail(admin, from, subject, text);
      } catch (err) {
        serverConsole(err);
      }
    }
    sentErrorReports = Array.from(sentErrorReports);
    serverConsole('Sent ' + sentErrorReports.length + ' error reports summary');
  } else {
    serverConsole('no unsent error reports to send');
  }
}

//function to check drive space and send email if it is low
function checkDriveSpace() {
  serverConsole('checkDriveSpace');
  let diskusage;
  try {
    diskusage = Npm.require('diskusage');
  } catch (err) {
    serverConsole('diskusage package not available, skipping disk space check');
    return;
  }
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
async function userProfileSave(user, awsProfile) {
  serverConsole('userProfileSave', user._id, awsProfile);
  user.aws = awsProfile;
  const numUpdated = await Meteor.users.updateAsync(
    { _id: user._id },
    { $set: { aws: user.aws } },
    { multi: false }
  );
  // serverConsole('numUpdated', numUpdated);
  serverConsole('numUpdated', numUpdated);
  if (numUpdated.numberAffected === 1) {
    serverConsole('Save succeeded');
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
async function createUserSecretKey(targetUserId){
  if(!(await Meteor.users.findOneAsync({_id: targetUserId})).secretKey){
    await Meteor.users.updateAsync({_id: targetUserId}, { $set: { secretKey: generateKey() }});
  }
}

async function updateUserSecretKey(targetUserId){
  if (await Roles.userIsInRoleAsync(targetUserId, ['admin', 'teacher']))
    await Meteor.users.updateAsync({_id: targetUserId}, { $set: { secretKey: generateKey() }});
}

// Only removes secret key if the user is no longer an admin or teacher
async function removeUserSecretKey(targetUserId){
  if(!await Roles.userIsInRoleAsync(targetUserId, ['admin', 'teacher']))
    await Meteor.users.updateAsync({_id: targetUserId}, { $set: { secretKey: '' }});
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
  let stimuliSetId = await Tdfs.findOneAsync({"content.tdfs.tutor.setspec.stimulusfile": stimulusFileName})?.stimuliSetId
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
  const newStims = getNewItemFormat(oldStimFormat, stimulusFileName, stimuliSetId, responseKCMap);
  let maxStimulusKC = 0;
  // REDUCED: Don't log entire stims array, just count
  serverConsole('newStims count:', newStims.length);
  for (const stim of newStims) {
    if(stim.stimulusKC > maxStimulusKC){
      maxStimulusKC = stim.stimulusKC;
    }
    let curAnswerSylls
    stim.syllables = curAnswerSylls;
    formattedStims.push(stim);
  }
  await Tdfs.upsertAsync({"content.tdfs.tutor.setspec.stimulusfile": stimulusFileName}, {$set: {
    stimulusFileName: stimulusFileName,
    stimuliSetId: stimuliSetId, 
    rawStimuliFile: stimJSON, //raw stimuli
    stimuli: formattedStims, //formatted stimuli for use in the app
  }}, {multi: true});
  Meteor.call('updateStimSyllables', stimuliSetId, formattedStims)

  // PHASE 1 OPTIMIZATION: Invalidate cache when stimuli are updated
  invalidateResponseKCMapCache();

  return stimuliSetId
}

async function upsertTDFFile(tdfFilename, tdfJSON, ownerId, packagePath = null) {
  serverConsole('upsertTDFFile', tdfFilename);
  // REMOVED: Don't log entire TDF JSON object - can be very large
  // serverConsole('tdfJSON', tdfJSON);
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
        const image = await DynamicAssets.findOneAsync({userId: ownerId, name: imageName});
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
  const conditionCounts = tdfJSONtoUpsert.tdfs.tutor.setspec.condition ? new Array(tdfJSONtoUpsert.tdfs.tutor.setspec.condition.length).fill(0) : [];

  await Tdfs.upsertAsync({_id: prev._id}, {$set: {
    path: packagePath,
    content: tdfJSONtoUpsert,
    ownerId: ownerId,
    visibility: 'profileOnly',
    conditionCount: conditionCounts
    }});
}

async function upsertPackage(packageJSON, ownerId) {
  // REDUCED: Don't log entire package JSON, just filename
  serverConsole('upsertPackage', packageJSON.packageFile || 'unknown');
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
        const image = await DynamicAssets.findOneAsync({userId: ownerId, name: imageName});
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
  const tdfJSON = {'fileName': packageJSON.fileName, 'tdfs': Tdf, 'ownerId': ownerId, 'source': 'upload'};
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
  const conditionCounts = tdfJSONtoUpsert.tdfs.tutor.setspec.condition ? new Array(tdfJSONtoUpsert.tdfs.tutor.setspec.condition.length).fill(0) : [];

  await Tdfs.upsertAsync({"content.fileName": packageJSON.fileName}, {$set: {
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

async function tdfUpdateConfirmed(updateObj, resetShuffleClusters = false){
  // REDUCED: Don't log entire update object
  serverConsole('tdfUpdateConfirmed for TDF:', updateObj.TDFId || 'unknown');
  await Tdfs.upsertAsync({_id: updateObj._id},{$set:updateObj});
  if(resetShuffleClusters){
    const expStatses =  await GlobalExperimentStates.find({TDFId: updateObj._id}).fetchAsync();
    for(let expState of expStatses){
      expState.experimentState.clusterMapping = [];
      await GlobalExperimentStates.updateAsync({_id: expStats._id}, {$set: {experimentState: expState}});
    }
  }
}

async function processAudioFilesForTDF(TDF){
  for (const unitIdx in TDF.tutor.unit){
    const unit = TDF.tutor.unit[unitIdx]
    if (unit && unit.unitinstructions) {
      const srcValues = extractSrcFromHtml(unit.unitinstructions);
      if (srcValues.length > 0) {
        for(const src of srcValues) {
          if(!src.includes('http')) {
            const audio = await DynamicAssets.findOneAsync({name: src});
            const link = audio.link();
            TDF.tutor.unit[unitIdx].unitinstructions = unit.unitinstructions.replace(src, link)
          }
        }
      }
    }
  }
  return TDF
}

async function setUserLoginData(entryPoint, loginMode, curTeacher = undefined, curClass = undefined, assignedTdfs = undefined){
  serverConsole('setUserLoginData called with:', entryPoint, loginMode, curTeacher, curClass, assignedTdfs);

  // eslint-disable-next-line no-invalid-this
  let userId = this.userId;
  serverConsole('setUserLoginData initial userId:', userId);

  // METEOR 3 FIX: In Meteor 3, there's a DDP sync race where client-side userId is set
  // but server-side this.userId is still null. Retry a few times to wait for sync.
  if (!userId) {
    serverConsole('setUserLoginData: userId not set yet, waiting for DDP sync...');
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
      // eslint-disable-next-line no-invalid-this
      userId = this.userId;
      if (userId) {
        serverConsole('setUserLoginData: userId set after', (i + 1) * 100, 'ms:', userId);
        break;
      }
    }
  }

  if (!userId) {
    serverConsole('setUserLoginData ERROR: userId still not set after retry');
    throw new Meteor.Error('not-authorized', 'Must be logged in to set login data');
  }

  const user = await Meteor.users.findOneAsync({_id: userId});
  serverConsole('setUserLoginData found user:', !!user, 'username:', user?.username);

  if (!user) {
    throw new Meteor.Error('user-not-found', 'User document not found');
  }

  let loginParams = user.loginParams || {};
  loginParams.entryPoint = entryPoint;
  loginParams.curTeacher = curTeacher;
  loginParams.curClass = curClass;
  loginParams.loginMode = loginMode;
  loginParams.assignedTdfs = assignedTdfs;

  serverConsole('setUserLoginData updating with loginParams:', loginParams);
  const result = await Meteor.users.updateAsync({_id: userId}, {$set: {loginParams: loginParams}});
  serverConsole('setUserLoginData update result:', result);

  return result;
}

async function loadStimsAndTdfsFromPrivate(adminUserId) {
  if (!isProd) {
    serverConsole('loading stims and tdfs from asset dir');
    serverConsole('start stims');
    const stimFilenames = _.filter(fs.readdirSync('./assets/app/stims/'), (fn) => {
      return fn.indexOf('.json') >= 0;
    });
    for (const filename of stimFilenames) {
      const data = await Assets.getTextAsync('stims/' + filename);
      const json = JSON.parse(data);
      await upsertStimFile(filename, json, adminUserId);
    }
    setTimeout(async () => {
      serverConsole('start tdfs');
      const tdfFilenames = _.filter(fs.readdirSync('./assets/app/tdf/'), (fn) => {
        return fn.indexOf('.json') >= 0;
      });
      for (let filename of tdfFilenames) {
        const data = await Assets.getTextAsync('tdf/' + filename);
        const json = JSON.parse(data);
        filename = filename.replace('.json', curSemester + '.json');
        const rec = {'fileName': filename, 'tdfs': json, 'ownerId': adminUserId, 'source': 'repo'};
        await upsertTDFFile(filename, rec, adminUserId);
      }
    }, 2000);
  }
}

async function makeHTTPSrequest(options, request, timeoutMs = 30000){
  return new Promise((resolve, reject) => {
    let chunks = []
    let timeoutHandle = null;

    const req = https.request(options, res => {
      res.on('data', d => {
          chunks.push(d);
      })
      res.on('end', function() {
          clearTimeout(timeoutHandle);
          // REMOVED: Don't log response data - can contain large audio bytes or speech transcription data
          // serverConsole(Buffer.concat(chunks).toString());
          resolve(Buffer.concat(chunks));
      })
    })

    req.on('error', (e) => {
      clearTimeout(timeoutHandle);
      reject(e.message);
    });

    // Add timeout - if no response after timeoutMs, reject
    timeoutHandle = setTimeout(() => {
      req.destroy();
      reject(new Error(`HTTPS request timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    req.write(request)
    req.end()
  });
}

function getSyllablesForWord(word) {
  // Use hypher library for syllable splitting (replaces syllables.jar microservice)
  try {
    const syllableArray = hyphenator.hyphenate(word);
    return syllableArray;
  } catch (e) {
    serverConsole('error splitting syllables for ' + word + ': ' + JSON.stringify(e));
    // Fallback to whole word if hyphenation fails
    return [word];
  }
}

export const methods = {
  getMatchingDialogueCacheWordsForAnswer,
    
  getMeteorSettingsPublic: function(settings) {
    //passes back current public settings
    serverConsole('updateClientMeteorSettings', settings);
    return Meteor.settings.public;
  },

  generateContent: async function( percentage, stringArrayJsonOption, inputText ) {
    const user = await Meteor.userAsync();
    const userEmail = user?.emails[0]?.address;
    if((user && user.emails[0]) || Meteor.isDevelopment){
      serverConsole('generateContent', percentage, stringArrayJsonOption, inputText);
      ClozeAPI.GetSelectClozePercentage(percentage, stringArrayJsonOption, null, inputText).then((result) => {
        serverConsole('result', result);
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
        file ? files = [file] : files = [];
        Email.send({
          to: userEmail,
          from: ownerEmail,
          subject: subject,
          text: message,
          attachments: files
        });
      }).catch((err) => {
        serverConsole('err', err);
      });
    }
  },

  removeTurkById: async function(turkId, experimentId){
    // Security: User must be logged in and can only modify their own lockouts
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (turkId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Can only modify your own lockouts');
    }

    serverConsole('removeTurkById', turkId, experimentId)
    await ScheduledTurkMessages.removeAsync({workerUserId: turkId, experiment: experimentId});
    let lockout = (await Meteor.userAsync()).lockouts;
    lockout[experimentId].lockoutMinutes = Number.MAX_SAFE_INTEGER;
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {lockouts: lockout}});
  },

  saveAudioPromptMode: async function(audioPromptMode){
    serverConsole('saveAudioPromptMode', audioPromptMode);
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {audioPromptMode: audioPromptMode}});
  },

  saveAudioInputMode: async function(audioInputMode){
    serverConsole('saveAudioInputMode', audioInputMode);
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {audioInputMode: audioInputMode}});
  },

  // Unified audio settings save method
  saveAudioSettings: async function(audioSettings) {
    // Security: User must be logged in
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in to save audio settings');
    }

    // Define default values
    const DEFAULT_AUDIO_SETTINGS = {
      audioPromptMode: 'silent',
      audioPromptQuestionVolume: 0,
      audioPromptQuestionSpeakingRate: 1,
      audioPromptVoice: 'en-US-Standard-A',
      audioPromptFeedbackVolume: 0,
      audioPromptFeedbackSpeakingRate: 1,
      audioPromptFeedbackVoice: 'en-US-Standard-A',
      audioInputMode: false,
      audioInputSensitivity: 60,
    };

    // Merge provided settings with defaults
    const settingsToSave = { ...DEFAULT_AUDIO_SETTINGS, ...audioSettings };

    // Save to user.audioSettings object only (single source of truth)
    await Meteor.users.updateAsync(
      {_id: this.userId},
      {$set: {audioSettings: settingsToSave}}
    );

    return { success: true };
  },

  updateExperimentState: async function(curExperimentState, experimentId) {
    // REDUCED LOGGING: Only log TDF ID, not entire experiment state object
    serverConsole('updateExperimentState', curExperimentState.currentTdfId);
    if(experimentId) {
      await GlobalExperimentStates.updateAsync({_id: experimentId}, {$set: {experimentState: curExperimentState}});
    } else {
      createExperimentState(curExperimentState)
    }
  },

  getAltServerUrl: function() {
    return altServerUrl;
  },

  getServerStatus: function() {
    try {
      // Try diskusage package first
      const diskusage = Npm.require('diskusage');
      const path = "/";
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
    } catch (error) {
      console.error('Error getting server disk usage with diskusage package:', error.message);

      // Fallback to using df command (works better in Docker)
      try {
        const { execSync } = Npm.require('child_process');
        const output = execSync('df -k /').toString();
        const lines = output.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[1].split(/\s+/);
          const diskSpaceTotal = parseInt(parts[1]) * 1024; // Convert KB to bytes
          const diskSpaceUsed = parseInt(parts[2]) * 1024;
          const remainingSpace = parseInt(parts[3]) * 1024;
          const driveSpaceUsedPercent = (diskSpaceUsed / diskSpaceTotal) * 100;

          return {
            diskSpacePercent: driveSpaceUsedPercent.toFixed(2),
            remainingSpace: (remainingSpace / 1000000000).toFixed(2),
            diskSpace: (diskSpaceTotal / 1000000000).toFixed(2),
            diskSpaceUsed: (diskSpaceUsed / 1000000000).toFixed(2)
          };
        }
      } catch (dfError) {
        console.error('Error getting disk usage with df command:', dfError.message);
      }

      return {diskSpacePercent: 'N/A', remainingSpace: 'N/A', diskSpace: 'N/A', diskSpaceUsed: 'N/A', error: 'Disk usage unavailable'};
    }
  },

  resetAllSecretKeys: async function() {
    if(Meteor.userId() && await Roles.userIsInRoleAsync(Meteor.userId(), ['admin'])){
      serverConsole('resetting user secrets');
      const users = await Meteor.users.find({$or: [{roles: "teacher"}, {roles: "admin"}]}).fetchAsync();
      for(user of users){
        serverConsole(`resetting user secret for ${user._id}`)
        await updateUserSecretKey(user._id);
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
    const mongoResult = await ElaboratedFeedbackCache.findOneAsync({correctAnswer: correctAnswer});
    serverConsole('mongoResult', mongoResult);
    if(mongoResult && mongoResult.userAnswers && mongoResult.userAnswers[userAnswer])
      return mongoResult.userAnswers[userAnswer];
    else {
      ElaboratedFeedback.GenerateFeedback(userAnswer, correctAnswer).then(async (result) => {
        let userAnswers = {};
        let id = '';
        if(mongoResult){
          id = mongoResult._id;
          if(mongoResult.userAnswers)
            userAnswers = mongoResult.userAnswers;
        }
        if (result.tag != 0) {
          // Error getting refutational feedback
        } else if (result.tag == 0) {
          const refutationalFeedback = result.fields[0].Feedback || result.fields[0].feedback;
          if (typeof(refutationalFeedback) != 'undefined' && refutationalFeedback != null) {
            userAnswers[userAnswer] = refutationalFeedback;
            await ElaboratedFeedbackCache.upsertAsync(id, {$set: {correctAnswer: correctAnswer, userAnswers: userAnswers}});
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

  sendPasswordResetEmail: async function(email){
    // Security: Validate input type
    check(email, String);

    serverConsole("sending password reset code for ", email)
    //Generate Code
    var secret = '';
    var length = 5;
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    await Meteor.users.findOneAsync({username: email})
    for ( var i = 0; i < length; i++ ) {
      secret += characters.charAt(Math.floor(Math.random() * charactersLength));
    }  
    await Meteor.users.updateAsync({username: email},{
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

  checkPasswordResetSecret: async function(email, secret){
    const user = await Meteor.users.findOneAsync({username: email});
    const userSecret = user?.secret;
    if(userSecret == secret){
      return true;
    } else {
      return false;
    }
  },

  getAccessorsTDFID: async function(TDFId){
    // Security: User must be logged in and either own the TDF or be an admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const tdf = await Tdfs.findOneAsync({_id: TDFId});
    if(tdf){
      // Check if user is owner or admin
      if (tdf.ownerId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher'])) {
        throw new Meteor.Error(403, 'Access denied');
      }
      const accessors = tdf.accessors || [];
      return accessors;
    } else {
      return [];
    }
  },

  getAccessors: async function(TDFId){
    // Security: User must be logged in and either own the TDF or be an admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const tdf = await Tdfs.findOneAsync({_id: TDFId});
    if (tdf && tdf.ownerId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher'])) {
      throw new Meteor.Error(403, 'Access denied');
    }

    const accessors = await Meteor.users.find({'accessedTDFs': TDFId}).fetchAsync();
    return accessors;
  },

  getAccessableTDFSForUser: async function(userId){
    // Security: User must be logged in and can only access their own data unless admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (userId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher'])) {
      throw new Meteor.Error(403, 'Can only access your own TDFs');
    }

    serverConsole('getAccessableTDFSForUser', userId);
    const accessableTDFs = await Meteor.users.findOneAsync({_id: userId}).accessedTDFs || [];
    const TDFs =  await Tdfs.find({_id: {$in: accessableTDFs}}).fetchAsync();
    return {accessableTDFs, TDFs};
  },

  getAssignableTDFSForUser: async function(userId){
    serverConsole('getAssignableTDFSForUser', userId);
    // get tdfs where ownerId is userId or .accessors array contains property with userId
    const assignableTDFs =  await Tdfs.find({$or: [{ownerId: userId}, {'accessors.userId': userId}]}).fetchAsync();
    serverConsole('assignableTDFs', assignableTDFs);
    return assignableTDFs;
  },

  assignAccessors: async function(TDFId, accessors, revokedAccessors){
    // Security: User must be logged in and either own the TDF or be an admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const tdf = await Tdfs.findOneAsync({_id: TDFId});
    if (!tdf) {
      throw new Meteor.Error(404, 'TDF not found');
    }
    if (tdf.ownerId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher'])) {
      throw new Meteor.Error(403, 'Only TDF owner or admin can assign accessors');
    }

    serverConsole('assignAccessors', TDFId, accessors, revokedAccessors)
    await Tdfs.updateAsync({_id: TDFId}, {$set: {'accessors': accessors}});
    const userIds = accessors.map((x) => x.userId);
    await Meteor.users.updateAsync({'_id': {$in: userIds}}, {$addToSet: {'accessedTDFs': TDFId}}, {multi: true});
    await Meteor.users.updateAsync({'_id': {$in: revokedAccessors}}, {$pull: {'accessedTDFs': TDFId}}, {multi: true});
  },

  transferDataOwnership: async function(tdfId, newOwner){
    // Security: User must be logged in and either own the TDF or be an admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    //set the Tdf owner
    serverConsole('transferDataOwnership',tdfId,newOwner);
    tdf = await Tdfs.findOneAsync({_id: tdfId});
    if(!tdf){
      serverConsole('TDF not found');
      return "TDF not found";
    } else {
      serverConsole('TDF found', tdf._id, tdf.ownerId);
    }

    // Check if user is current owner or admin
    if (tdf.ownerId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Only current owner or admin can transfer ownership');
    }

    tdf.ownerId = newOwner._id;
    await Tdfs.upsertAsync({_id: tdfId}, tdf);
    serverConsole(tdf);
    serverConsole('transfer ' + tdfId + "to" + newOwner);
    return "success";
  },

  // DEPRECATED: Old insecure password reset - kept for backward compatibility
  // Use requestPasswordReset and resetPasswordWithToken instead
  resetPasswordWithSecret: async function(email, secret, newPassword){
    // Security: Validate input types
    check(email, String);
    check(secret, String);
    check(newPassword, String);

    user = await Meteor.users.findOneAsync({username: email});
    userId = user._id;
    userSecret = user.secret;
    if(secret == userSecret){
      Accounts.setPassword(userId, newPassword);
      return true;
    } else {
      return false;
    }
  },

  // Security: New secure password reset - Step 1: Request reset token
  requestPasswordReset: async function(email) {
    check(email, String);

    // Rate limiting: Check recent reset requests
    const recentResets = await PasswordResetTokens.find({
      email: email,
      createdAt: {$gt: new Date(Date.now() - 60000)} // Last minute
    }).countAsync();

    if (recentResets >= 3) {
      throw new Meteor.Error('rate-limit', 'Too many reset requests. Please wait a minute.');
    }

    // Find user
    const user = await Meteor.users.findOneAsync({username: email});
    if (!user) {
      // Security: Don't reveal if email exists
      serverConsole('Password reset requested for non-existent email:', email);
      return { success: true }; // Fake success to prevent enumeration
    }

    // Generate cryptographically secure token (32 bytes = 256 bits)
    const token = randomBytes(32).toString('hex');

    // Hash the token before storing (using SHA-256)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Store hashed token with expiration (1 hour)
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour
    await PasswordResetTokens.insertAsync({
      email: email,
      userId: user._id,
      tokenHash: tokenHash,
      createdAt: new Date(),
      expiresAt: expiresAt,
      used: false
    });

    // In production, send email with token
    // For now, log it (REMOVE THIS IN PRODUCTION)
    serverConsole('Password reset token for', email, ':', token);
    serverConsole('Token expires at:', expiresAt);

    return {
      success: true,
      // TODO: Remove token from response in production - send via email instead
      token: token  // TEMPORARY: For testing only
    };
  },

  // Security: New secure password reset - Step 2: Reset with token
  resetPasswordWithToken: async function(email, token, newPassword) {
    check(email, String);
    check(token, String);
    check(newPassword, String);

    // Security: Validate password strength
    if (!newPassword || newPassword.length < 8) {
      throw new Meteor.Error('weak-password', 'Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      throw new Meteor.Error('weak-password', 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }

    // Hash the provided token
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid token
    const resetRecord = await PasswordResetTokens.findOneAsync({
      email: email,
      tokenHash: tokenHash,
      used: false,
      expiresAt: {$gt: new Date()}
    });

    if (!resetRecord) {
      throw new Meteor.Error('invalid-token', 'Invalid or expired reset token');
    }

    // Mark token as used
    await PasswordResetTokens.updateAsync({_id: resetRecord._id}, {$set: {used: true, usedAt: new Date()}});

    // Reset the password
    Accounts.setPassword(resetRecord.userId, newPassword);

    serverConsole('Password successfully reset for user:', email);
    return { success: true };
  },

  // Security: Clean up expired tokens (call this periodically via cron)
  cleanupExpiredPasswordResetTokens: async function() {
    // Only admins can cleanup
    if (!this.userId || !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Admin access required');
    }

    const deleted = await PasswordResetTokens.removeAsync({
      expiresAt: {$lt: new Date()}
    });

    serverConsole('Cleaned up', deleted, 'expired password reset tokens');
    return { deleted: deleted };
  },
  sendUserErrorReport: async function(userID, description, curPage, sessionVars, userAgent, logs, currentExperimentState) {
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
    return await ErrorReports.insertAsync(errorReport);
  },

  logUserAgentAndLoginTime: async function(userID, userAgent) {
    const loginTime = new Date();
    return await Meteor.users.updateAsync({_id: userID}, {$set: {status: {lastLogin: loginTime, userAgent: userAgent}}});
  },

  insertClozeEditHistory: async function(history) {
    await ClozeEditHistory.insertAsync(history);
  },

  getClozesAndSentencesForText: function(rawText) {
    serverConsole('rawText!!!: ' + rawText);
    // eslint-disable-next-line new-cap
    return clozeGeneration.GetClozeAPI(null, null, null, rawText);
  },

  serverLog: async function(data) {
    if (await Meteor.userAsync()) {
      const logData = 'User:' + (await Meteor.userAsync())._id + ', log:' + data;
      serverConsole(logData);
    }
  },

  

  // Functionality to create a new user ID: return null on success. Return
  // an array of error messages on failure. If previous OK is true, then
  // we silently skip duplicate users (this is mainly for experimental
  // participants who are created on the fly)



  signUpUser: async function(newUserName, newUserPassword, previousOK) {
    // Security: Validate input types
    check(newUserName, String);
    check(newUserPassword, String);
    check(previousOK, Match.Maybe(Boolean));

    serverConsole('signUpUser', newUserName, 'previousOK == ', previousOK);

  if (!newUserName) throw new Error('Blank user names aren\'t allowed');

  // Security: Strengthen password requirements - but NOT for experiment/Turk logins
  // For experiment logins (previousOK=true), any string is allowed as username with auto-generated password
  if (!previousOK) {
    if (!newUserPassword || newUserPassword.length < 8) {
      throw new Meteor.Error('weak-password', 'Password must be at least 8 characters long');
    }

    // Check password complexity (uppercase, lowercase, and numbers)
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newUserPassword)) {
      throw new Meteor.Error('weak-password', 'Password must contain at least one uppercase letter, one lowercase letter, and one number');
    }
  }

  // Simple mutex: block if another signup is in progress for this username
  while (signUpLocks[newUserName]) {
    Meteor._sleepForMs(50);
  }
  signUpLocks[newUserName] = true;

  try {
    let prevUser = Accounts.findUserByUsername(newUserName) || Accounts.findUserByEmail(newUserName);
    if (prevUser) {
      if (previousOK) {
        Accounts.setPassword(prevUser._id, newUserPassword);
        return { userExists: true, userId: prevUser._id };
      } else {
        throw new Error('User is already in use');
      }
    }

    // Retry loop to handle duplicate _id race condition
    let createdId = null;
    let retryAttempts = 0;
    const maxRetries = 3;

    while (!createdId && retryAttempts < maxRetries) {
      try {
        //get the default user profile
        createdId = Accounts.createUser({
          email: newUserName,
          username: newUserName,
          password: newUserPassword,
          profile: { experiment: !!previousOK },
          aws: {
                have_aws_id: false,
                have_aws_secret: false,
                aws_id: '',
                aws_secret_key: '',
                use_sandbox: true,
          }

        });

        // Wait for user to be available in the DB before proceeding
        let user = null, attempts = 0;
        while (!user && attempts < 10) {
          user = await Meteor.users.findOneAsync({ _id: createdId });
          if (!user) {
            Meteor._sleepForMs(50);
            attempts++;
          }
        }
        if (!user) throw new Error('User creation race condition: user not found after createUser');
        // userProfileSave(user, defaultUserProfile()); // Not needed if onCreateUser does this
        return { userExists: false, userId: createdId };
      } catch (e) {
        // Check for duplicate key error on _id field (race condition in ID generation)
        if (/E11000 duplicate key error.*\b_id\b/.test(e.message || e.reason)) {
          retryAttempts++;
          serverConsole('Duplicate _id detected, retrying user creation (attempt ' + retryAttempts + '/' + maxRetries + ')');
          if (retryAttempts >= maxRetries) {
            throw new Error('Failed to create user after ' + maxRetries + ' attempts due to ID collisions');
          }
          // Add small random delay before retry to reduce collision probability
          Meteor._sleepForMs(Math.random() * 100);
          continue;
        }

        // Check for duplicate username/email
        if (e.error === 403 && (/Username already exists|E11000 duplicate key error/.test(e.reason || e.message))) {
          prevUser = Accounts.findUserByUsername(newUserName) || Accounts.findUserByEmail(newUserName);
          if (prevUser) {
            if (previousOK) {
              Accounts.setPassword(prevUser._id, newUserPassword);
              return { userExists: true, userId: prevUser._id };
            } else {
              throw new Error('User is already in use');
            }
          }
          throw new Error('Duplicate key error but user not found');
        } else {
          throw e;
        }
      }
    }
  } finally {
    delete signUpLocks[newUserName];
  }
},
  populateSSOProfile: async function(userId){
    // Security: Users can only populate their own profile unless admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (userId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Can only populate your own SSO profile');
    }

    //check if the user has a service profile
    const user = await Meteor.users.findOneAsync(userId);
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
      await Meteor.users.updateAsync(userId, {$set: {profile: profile, username: serviceProfile.mail}});
      return "success: " + serviceProfile.mail;
    }
    return "failure";
  },


  //Impersonate User
  impersonate: async function(userId) {
    check(userId, String);

    // Security: Authorization check
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Admin access required');
    }

    // Verify target user exists
    const targetUser = await Meteor.users.findOneAsync(userId);
    if (!targetUser) {
      throw new Meteor.Error(404, 'User not found');
    }

    // Security: Audit logging
    const adminUser = await Meteor.userAsync();
    await AuditLog.insertAsync({
      action: 'impersonate',
      adminUserId: this.userId,
      adminUsername: adminUser.username || adminUser.emails?.[0]?.address,
      targetUserId: userId,
      targetUsername: targetUser.username || targetUser.emails?.[0]?.address,
      timestamp: new Date(),
      ipAddress: this.connection?.clientAddress,
      userAgent: this.connection?.httpHeaders?.['user-agent']
    });

    // Security: Set impersonation with timeout (1 hour)
    const expiration = new Date(Date.now() + 3600000); // 1 hour
    await Meteor.users.updateAsync({_id: this.userId}, {
      $set: {
        impersonating: true,
        impersonatedUserId: userId,
        impersonationStartTime: new Date(),
        impersonationExpires: expiration
      }
    });

    // Security: Return only necessary fields, not entire user object
    return {
      userId: targetUser._id,
      username: targetUser.username || targetUser.emails?.[0]?.address,
      roles: targetUser.roles,
      impersonating: true,
      impersonationExpires: expiration
    };
  },

  clearLoginData: async function(){    
    const user = await Meteor.userAsync();
    if (!user) {
      throw new Meteor.Error(401, 'User must be logged in to clear login data');
    }
    let loginParams = user.loginParams || {};
    loginParams.entryPoint = null;
    loginParams.curTeacher = null;
    loginParams.curClass = null;
    loginParams.loginMode = null;
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {loginParams: loginParams}});
  },

  clearImpersonation: async function(){
    // Security: Authorization check
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const user = await Meteor.userAsync();
    if (!user.impersonating) {
      throw new Meteor.Error(400, 'Not currently impersonating');
    }

    // Security: Audit logging
    await AuditLog.insertAsync({
      action: 'end_impersonation',
      adminUserId: this.userId,
      adminUsername: user.username || user.emails?.[0]?.address,
      targetUserId: user.impersonatedUserId,
      timestamp: new Date(),
      ipAddress: this.connection?.clientAddress
    });

    // Clear impersonation fields
    await Meteor.users.updateAsync({_id: this.userId}, {
      $unset: {
        impersonating: "",
        impersonatedUserId: "",
        impersonationStartTime: "",
        impersonationExpires: ""
      }
    });

    return true;
  },

  // Security: Check and clear expired impersonation sessions
  checkImpersonationExpiry: async function() {
    if (!this.userId) {
      return false;
    }

    const user = await Meteor.userAsync();
    if (!user.impersonating || !user.impersonationExpires) {
      return false;
    }

    // Check if impersonation has expired
    if (new Date() > user.impersonationExpires) {
      // Automatically clear expired impersonation
      await AuditLog.insertAsync({
        action: 'impersonation_auto_expired',
        adminUserId: this.userId,
        adminUsername: user.username || user.emails?.[0]?.address,
        targetUserId: user.impersonatedUserId,
        timestamp: new Date(),
        expiredAt: user.impersonationExpires
      });

      await Meteor.users.updateAsync({_id: this.userId}, {
        $unset: {
          impersonating: "",
          impersonatedUserId: "",
          impersonationStartTime: "",
          impersonationExpires: ""
        }
      });

      return true; // Impersonation was expired and cleared
    }

    return false; // Impersonation still active
  },

  getUserSpeechAPIKey: async function() {
    const speechAPIKey = (await Meteor.userAsync()).speechAPIKey;
    if (speechAPIKey) {
      return decryptData(speechAPIKey);
    } else {
      return null;
    }
  },

  isUserSpeechAPIKeySetup: async function() {
    const speechAPIKey = (await Meteor.userAsync()).speechAPIKey;
    return !!speechAPIKey;
  },

  hasUserPersonalKeys: async function() {
    if (!this.userId) {
      return {hasSR: false, hasTTS: false};
    }
    const user = await Meteor.users.findOneAsync({_id: this.userId});
    if (!user) {
      return {hasSR: false, hasTTS: false};
    }
    return {
      hasSR: !!user.speechAPIKey,
      hasTTS: !!user.ttsAPIKey
    };
  },

  saveUserSpeechAPIKey: async function(key) {
    key = encryptData(key);
    let result = true;
    let error = '';
    const user = Meteor.userId();
    if (!user) {
      result = false;
      error = 'User not found';
    } else {
      await Meteor.users.upsertAsync({_id: user}, {$set: {speechAPIKey: key}});
    }
  },

  getTdfTTSAPIKey: async function(tdfId){
    // Security: Users practicing a TDF can access its TTS API key
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const tdf = await Tdfs.findOneAsync({_id: tdfId});
    if(!tdf){
      return '';
    }

    // Allow access if:
    // 1. User owns this TDF
    // 2. User is admin/teacher
    // 3. TDF is accessible to this user (has userselect=true or user has history with it)
    const isOwner = tdf.ownerId === this.userId;
    const isAdminOrTeacher = await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher']);
    const isUserSelectTdf = tdf.content?.tdfs?.tutor?.setspec?.userselect === 'true';
    const hasHistory = await Histories.findOneAsync({ userId: this.userId, TDFId: tdfId });

    if (!isOwner && !isAdminOrTeacher && !isUserSelectTdf && !hasHistory) {
      throw new Meteor.Error(403, 'Access denied to TDF API keys');
    }

    const apiKey = tdf.content?.tdfs?.tutor?.setspec?.textToSpeechAPIKey;
    return apiKey ? decryptData(apiKey) : '';
  },

  getTdfSpeechAPIKey: async function(tdfId){
    // Security: Users practicing a TDF can access its speech API key
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const tdf = await Tdfs.findOneAsync({_id: tdfId});
    if(!tdf){
      return '';
    }

    // Allow access if:
    // 1. User owns this TDF
    // 2. User is admin/teacher
    // 3. TDF is accessible to this user (has userselect=true or user has history with it)
    const isOwner = tdf.ownerId === this.userId;
    const isAdminOrTeacher = await Roles.userIsInRoleAsync(this.userId, ['admin', 'teacher']);
    const isUserSelectTdf = tdf.content?.tdfs?.tutor?.setspec?.userselect === 'true';
    const hasHistory = await Histories.findOneAsync({ userId: this.userId, TDFId: tdfId });

    if (!isOwner && !isAdminOrTeacher && !isUserSelectTdf && !hasHistory) {
      throw new Meteor.Error(403, 'Access denied to TDF API keys');
    }

    const apiKey = tdf.content?.tdfs?.tutor?.setspec?.speechAPIKey;
    return apiKey ? decryptData(apiKey) : '';
  },


  setUserSessionId: async function(sessionId, sessionIdTimestamp) {
    serverConsole('setUserSessionId', sessionId, sessionIdTimestamp)
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {lastSessionId: sessionId, lastSessionIdTimestamp: sessionIdTimestamp}});
  },

  deleteUserSpeechAPIKey: async function() {
    const userID = Meteor.userId();
    await Meteor.users.updateAsync({_id: userID}, {$unset: {speechAPIKey: ''}});
  },

  // ONLY FOR ADMINS: for the given targetUserId, perform roleAction (add
  // or remove) vs roleName
  userAdminRoleChange: async function(targetUserId, roleAction, roleName) {
    serverConsole('userAdminRoleChange', targetUserId, roleAction, roleName);
    const usr = await Meteor.userAsync();
    if (!await Roles.userIsInRoleAsync(usr, ['admin'])) {
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

    const targetUser = await Meteor.users.findOneAsync({_id: targetUserId});
    if (!targetUser) {
      throw new Error('Invalid: could not find that user');
    }

    const targetUsername = _.prop(targetUser, 'username');

    serverConsole('Before role change - User roles:', targetUser.roles);

    // Directly manipulate the roles array like onCreateUser does
    // This matches the format used when creating new users (see line 4905-4911)
    let currentRoles = targetUser.roles || [];
    if (!Array.isArray(currentRoles)) {
      // Handle old format if roles is an object
      currentRoles = [];
    }

    if (roleAction === 'add') {
      if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
        await Meteor.users.updateAsync({_id: targetUserId}, {$set: {roles: currentRoles}});
      }
      await createUserSecretKey(targetUserId);
    } else if (roleAction === 'remove') {
      const index = currentRoles.indexOf(roleName);
      if (index !== -1) {
        currentRoles.splice(index, 1);
        await Meteor.users.updateAsync({_id: targetUserId}, {$set: {roles: currentRoles}});
      }
      await removeUserSecretKey(targetUserId);
    } else {
      throw new Error('Serious logic error: please report this');
    }

    // Verify the role was actually added/removed
    const updatedUser = await Meteor.users.findOneAsync({_id: targetUserId});
    serverConsole('After role change - User roles:', updatedUser.roles);

    return {
      'RESULT': 'SUCCESS',
      'targetUserId': targetUserId,
      'targetUsername': targetUsername,
      'roleAction': roleAction,
      'roleName': roleName,
    };
  },

  insertNewUsers: async function(filename, filecontents) {
    serverConsole('insertNewUsers: ' + filename);
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
      try {
        await Meteor.callAsync('signUpUser', username, password, true);
      } catch (error) {
        serverConsole('Error creating user ' + username + ':', error);
        allErrors.push({username: username, error: error.message});
      }
    }
    serverConsole('allErrors: ' + JSON.stringify(allErrors));
    return allErrors;
  },

  deletePackageFile: async function(packageId){
    serverConsole("Remove package:", packageId);
    //check if the user is an admin or owner of the TDF
    try{
      let deletedCount = 0;
      // Extract the asset ID from the packageId (handles both "id.zip" and "/path/id.zip")
      const packageFileName = packageId.split('/').pop(); // Get just the filename
      const packageAssetId = packageFileName.split('.').shift(); // Get ID before .zip

      // Find all TDFs that contain this package ID anywhere in their packageFile field
      const allTdfs =  await Tdfs.find({}).fetchAsync();
      const matchingTdfs = allTdfs.filter(tdf => tdf.packageFile && tdf.packageFile.includes(packageAssetId));

      serverConsole("Found", matchingTdfs.length, "TDFs with packageFile containing:", packageAssetId);

      matchingTdfs.forEach(async (TDF) => {
        if(TDF && (await Roles.userIsInRoleAsync(Meteor.userId(), ['admin']) || TDF.ownerId == Meteor.userId())){
          const tdfId = TDF._id;
          await ComponentStates.removeAsync({TDFId: tdfId});
          await Assignments.removeAsync({TDFId: tdfId});
          await Histories.removeAsync({TDFId: tdfId});
          await GlobalExperimentStates.removeAsync({TDFId: tdfId});
          await Tdfs.removeAsync({_id: tdfId});
          deletedCount++;
          //iterate through TDF.stimuli
          for (const stim of TDF.stimuli) {
            const asset = stim.imageStimulus || stim.audioStimulus || stim.videoStimulus || false;
            if (asset) {
              //remove asset
              try {
                await DynamicAssets.removeAsync({"name": asset});
                serverConsole("Asset removed: ", asset);
              } catch (err) {
                serverConsole("Error removing asset:", err);
              }
            }
          }
        }
      });

      // Also delete the package file itself from DynamicAssets
      serverConsole("Removing package asset with ID:", packageAssetId);
      const packageAsset = await DynamicAssets.findOneAsync({_id: packageAssetId});
      if (packageAsset) {
        await DynamicAssets.removeAsync({_id: packageAssetId});
        serverConsole("Package file removed from DynamicAssets");
      } else {
        serverConsole("Package file not found in DynamicAssets (may have been deleted already)");
      }

      // PHASE 1 OPTIMIZATION: Invalidate cache after TDFs are deleted
      invalidateResponseKCMapCache();

      return "Package removed: " + deletedCount + " TDF(s) deleted";
    } catch (e) {
      serverConsole(e);
      return "There was an error deleting the package: " + e.message;
    }
  },

  // Let client code send console output up to server
  debugLog: async function(logtxt) {
    let usr = await Meteor.userAsync();
    if (!usr) {
      usr = '[No Current User]';
    } else {
      usr = usr.username ? usr.username : usr._id;
      usr = '[USER:' + usr + ']';
    }

    serverConsole(usr + ' ' + logtxt);
  },
  

  removeAssetById: async function(assetId) {
    // Security: User must be logged in and either own the asset or be an admin
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }

    const asset = await DynamicAssets.findOneAsync({_id: assetId});
    if (!asset) {
      throw new Meteor.Error(404, 'Asset not found');
    }
    if (asset.userId !== this.userId && !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Can only delete your own assets');
    }

    await DynamicAssets.removeAsync({_id: assetId});
  },

  toggleTdfPresence: async function(tdfIds, mode) {
    // Security: User must be logged in and be an admin to toggle TDF visibility
    if (!this.userId) {
      throw new Meteor.Error(401, 'Must be logged in');
    }
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Admin access required to toggle TDF visibility');
    }

    tdfIds.forEach(async (tdfid) => {
      await Tdfs.updateAsync({_id: tdfid}, {$set: {visibility: mode}})
    })
  },

  getTdfOwnersMap: async (ownerIds) => {
    const ownerMap = {};
    ownerIds.forEach(async (id) => {
      const foundUser = await Meteor.users.findOneAsync({_id: id});
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

  getTestLogin: async function() {
    return await DynamicSettings.findOneAsync({key: 'testLoginsEnabled'}).value;
  },

  ensureClientVerbositySetting: async function() {
    // Ensure clientVerbosityLevel setting exists in database
    // This is a global admin-controlled setting, not a per-user preference
    const existing = await DynamicSettings.findOneAsync({key: 'clientVerbosityLevel'});
    if (!existing) {
      await DynamicSettings.insertAsync({
        key: 'clientVerbosityLevel',
        value: 0  // Default: no logging (fastest)
      });
      serverConsole('Initialized clientVerbosityLevel setting to 0');
    }
    return existing ? existing.value : 0;
  },

  setClientVerbosity: async function(level) {
    // Only admins can change client verbosity (global setting)
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('not-authorized', 'Only admins can change client verbosity level');
    }

    level = parseInt(level, 10);
    if (level < 0 || level > 2) {
      throw new Meteor.Error('invalid-value', 'Verbosity level must be 0, 1, or 2');
    }

    await DynamicSettings.updateAsync(
      {key: 'clientVerbosityLevel'},
      {$set: {value: level}}
    );

    serverConsole(`Client verbosity level changed to ${level} by ${this.userId}`);
    return level;
  },

  getTdfsByOwnerId: async (ownerId) => {
    const tdfs =  await Tdfs.find({'ownerId': ownerId}).fetchAsync();
    return tdfs || [];
  },

  getStimsByOwnerId: async (ownerId) => {
    serverConsole('getStimsByOwnerId: ' + ownerId);
    const tdfs =  await Tdfs.find({'ownerId': ownerId}).fetchAsync();
    const stims = tdfs.stimuli;
    for(let stim of stims) {
      let lessonName = await Tdfs.findOneAsync({stimuliSetId: stim.stimuliSetId}).content.tdfs.tutor.setspec.lessonname
      stim.lessonName = lessonName
    }
    return stims || [];
  },

  initializeCustomTheme: async function(themeName) {
    serverConsole('initializeCustomTheme');

    // Only admins may reset the theme
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can initialize themes');
    }

    const requestedName = typeof themeName === 'string' && themeName.trim() ? themeName.trim() : 'MoFaCTS';

    // Resetting to the stock theme just activates the bundled default
    if (requestedName === 'MoFaCTS') {
      return await themeRegistry.setActiveTheme('mofacts-default');
    }

    // Otherwise spin up a brand-new editable theme cloned from the default palette
    const createdTheme = await themeRegistry.createTheme({
      name: requestedName,
      description: `Custom theme "${requestedName}" initialized from default`,
      baseThemeId: 'mofacts-default',
      author: this.userId
    });

    return await themeRegistry.setActiveTheme(createdTheme.id);
  },

  // PHASE 1.5 DEPRECATION: This method is deprecated in favor of 'theme' publication
  // Kept for backward compatibility - new code should use Meteor.subscribe('theme')
  getTheme: async function() {
    serverConsole('getTheme [DEPRECATED - use theme publication instead]');
    return await themeRegistry.ensureActiveTheme();
  },

  setCustomThemeProperty: async function(property, value) {
    serverConsole('setCustomThemeProperty', property);

    if (!this.userId) {
      throw new Meteor.Error('not-logged-in', 'Must be logged in to modify theme');
    }
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can modify theme settings');
    }
    if (typeof property !== 'string' || !property.trim()) {
      throw new Meteor.Error('invalid-property', 'Theme property name is required');
    }

    try {
      let updateResult = await updateActiveThemeDocument(this.userId, (theme) => {
        theme.properties = theme.properties || {};
        theme.properties[property] = value;
        if (property === 'themeName') {
          theme.themeName = value;
          theme.metadata = theme.metadata || {};
          theme.metadata.name = value;
          theme.properties.themeName = value;
        }
        return theme;
      });

      let serializedTheme = updateResult.serialized;

      if (property === 'logo_url' && value && typeof value === 'string' && value.startsWith('data:image')) {
        try {
          const favicons = await Meteor.callAsync('generateFaviconsFromLogo', value);
          const faviconUpdates = {};
          if (favicons.favicon_16) {
            faviconUpdates.favicon_16_url = favicons.favicon_16;
          }
          if (favicons.favicon_32) {
            faviconUpdates.favicon_32_url = favicons.favicon_32;
          }
          if (Object.keys(faviconUpdates).length) {
            const faviconResult = await updateActiveThemeDocument(this.userId, (theme) => {
              theme.properties = theme.properties || {};
              Object.assign(theme.properties, faviconUpdates);
              return theme;
            });
            serializedTheme = faviconResult.serialized;
          }
          serverConsole('Auto-generated favicons from logo');
        } catch (error) {
          serverConsole('Warning: Failed to auto-generate favicons:', error.message);
        }
      }

      return {success: true, property, value, theme: serializedTheme};
    } catch (error) {
      serverConsole('Error setting theme property:', error);
      throw new Meteor.Error('update-failed', 'Failed to update theme property: ' + error.message);
    }
  },

  generateFaviconsFromLogo: async function(logoDataUrl) {
    // Generate 16x16 and 32x32 favicons from a logo data URL
    if (!this.userId) {
      throw new Meteor.Error('not-logged-in', 'Must be logged in to generate favicons');
    }

    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    try {
      // Extract base64 data from data URL
      const matches = logoDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Meteor.Error('invalid-format', 'Invalid image data URL format');
      }

      const imageType = matches[1];
      const base64Data = matches[2];
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Create temporary directory for processing
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'favicon-'));
      const inputPath = path.join(tmpDir, `logo.${imageType}`);
      const favicon16Path = path.join(tmpDir, 'favicon-16.png');
      const favicon32Path = path.join(tmpDir, 'favicon-32.png');

      try {
        // Write input image
        await fs.writeFile(inputPath, imageBuffer);

        // Generate 16x16 favicon
        await execAsync(`convert "${inputPath}" -resize 16x16 -background transparent -flatten "${favicon16Path}"`);

        // Generate 32x32 favicon
        await execAsync(`convert "${inputPath}" -resize 32x32 -background transparent -flatten "${favicon32Path}"`);

        // Read generated favicons
        const favicon16Buffer = await fs.readFile(favicon16Path);
        const favicon32Buffer = await fs.readFile(favicon32Path);

        // Convert to data URLs
        const favicon16DataUrl = `data:image/png;base64,${favicon16Buffer.toString('base64')}`;
        const favicon32DataUrl = `data:image/png;base64,${favicon32Buffer.toString('base64')}`;

        return {
          favicon_16: favicon16DataUrl,
          favicon_32: favicon32DataUrl
        };
      } finally {
        // Clean up temporary files
        try {
          await fs.rm(tmpDir, { recursive: true, force: true });
        } catch (cleanupError) {
          serverConsole('Warning: Failed to clean up temp directory:', cleanupError.message);
        }
      }
    } catch (error) {
      serverConsole('Error generating favicons:', error);
      throw new Meteor.Error('favicon-generation-failed', 'Failed to generate favicons: ' + error.message);
    }
  },

  toggleCustomTheme: async function() {
    serverConsole('toggleCustomTheme');
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can toggle themes');
    }

    const current = await themeRegistry.ensureActiveTheme();
    const wasEnabled = current?.enabled !== false;
    const nextState = {
      ...current,
      enabled: !wasEnabled
    };

    await DynamicSettings.upsertAsync({key: 'customTheme'}, {$set: {value: nextState}});

    const entry = nextState?.activeThemeId ? themeRegistry.getThemeEntry(nextState.activeThemeId) : null;
    if (entry && !entry.readOnly) {
      await themeRegistry.updateTheme(entry.id, (theme) => {
        theme.enabled = nextState.enabled;
        return theme;
      });
    }

    serverConsole('custom theme enabled:', nextState.enabled);
    return nextState;
  },

  createThemeFromBase: async function(options) {
    serverConsole('createThemeFromBase', options?.name);
    check(options, {
      name: String,
      description: Match.Optional(String),
      baseThemeId: Match.Optional(String),
      properties: Match.Optional(Object),
      activate: Match.Optional(Boolean)
    });

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can create themes');
    }

    const theme = await themeRegistry.createTheme({
      name: options.name,
      description: options.description,
      baseThemeId: options.baseThemeId || 'mofacts-default',
      properties: options.properties,
      author: this.userId
    });

    if (options.activate === false) {
      return theme;
    }
    return await themeRegistry.setActiveTheme(theme.id);
  },

  duplicateTheme: async function(options) {
    serverConsole('duplicateTheme', options?.sourceThemeId, options?.name);
    check(options, {
      sourceThemeId: String,
      name: String,
      activate: Match.Optional(Boolean)
    });

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can duplicate themes');
    }

    const sourceEntry = themeRegistry.getThemeEntry(options.sourceThemeId);
    if (!sourceEntry) {
      throw new Meteor.Error('theme-not-found', 'Source theme not found');
    }

    const theme = await themeRegistry.createTheme({
      name: options.name,
      description: sourceEntry.data.metadata?.description,
      baseThemeId: sourceEntry.id,
      properties: sourceEntry.data.properties,
      author: this.userId
    });

    if (options.activate === false) {
      return theme;
    }
    return await themeRegistry.setActiveTheme(theme.id);
  },

  importThemeFile: async function(payload, activate = true) {
    serverConsole('importThemeFile');
    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can import themes');
    }

    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (err) {
        throw new Meteor.Error('invalid-json', 'Uploaded theme is not valid JSON');
      }
    }

    if (!parsedPayload || typeof parsedPayload !== 'object') {
      throw new Meteor.Error('invalid-theme', 'Theme payload must be an object');
    }

    const theme = await themeRegistry.importTheme(parsedPayload);
    if (!activate) {
      return theme;
    }
    return await themeRegistry.setActiveTheme(theme.id);
  },

  exportThemeFile: async function(themeId) {
    serverConsole('exportThemeFile', themeId);
    check(themeId, String);

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can export themes');
    }

    return await themeRegistry.exportTheme(themeId);
  },

  deleteTheme: async function(themeId) {
    serverConsole('deleteTheme', themeId);
    check(themeId, String);

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can delete themes');
    }

    await themeRegistry.deleteTheme(themeId);
    return await themeRegistry.ensureActiveTheme();
  },

  renameTheme: async function(options) {
    serverConsole('renameTheme', options?.themeId, options?.newName);
    check(options, {
      themeId: String,
      newName: String
    });

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can rename themes');
    }

    return await themeRegistry.renameTheme(options.themeId, options.newName);
  },

  setActiveTheme: async function(themeId) {
    serverConsole('setActiveTheme', themeId);
    check(themeId, String);

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can change the active theme');
    }

    return await themeRegistry.setActiveTheme(themeId);
  },

  // Custom Help Page Methods
  setCustomHelpPage: async function(markdownContent) {
    serverConsole('setCustomHelpPage');

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can set custom help page');
    }

    if (typeof markdownContent !== 'string') {
      throw new Meteor.Error('invalid-help', 'Help content must be text');
    }

    if (markdownContent.length > 1048576) {
      throw new Meteor.Error('file-too-large', 'Help file must be less than 1MB');
    }

    const timestamp = new Date().toISOString();

    await updateActiveThemeDocument(this.userId, (theme) => {
      theme.help = {
        enabled: true,
        format: 'markdown',
        markdown: markdownContent,
        url: '',
        uploadedAt: timestamp,
        uploadedBy: this.userId,
        source: 'admin'
      };
      return theme;
    });

    return {success: true};
  },

  getCustomHelpPage: async function() {
    serverConsole('getCustomHelpPage');

    const activeTheme = await themeRegistry.ensureActiveTheme();
    const help = activeTheme?.help;

    if (!help || help.enabled === false) {
      return null;
    }

    if (help.markdown && help.markdown.length) {
      return help.markdown;
    }

    return null;
  },

  removeCustomHelpPage: async function() {
    serverConsole('removeCustomHelpPage');

    if (!await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error('unauthorized', 'Only admins can remove custom help page');
    }

    const timestamp = new Date().toISOString();

    await updateActiveThemeDocument(this.userId, (theme) => {
      const existingHelp = theme.help || {};
      theme.help = {
        enabled: false,
        format: existingHelp.format || 'markdown',
        markdown: '',
        url: '',
        uploadedAt: timestamp,
        uploadedBy: this.userId,
        source: 'admin'
      };
      return theme;
    });

    return {success: true};
  },

  getCustomHelpPageStatus: async function() {
    serverConsole('getCustomHelpPageStatus');

    const activeTheme = await themeRegistry.ensureActiveTheme();
    const help = activeTheme?.help;

    if (!help || help.enabled === false || (!help.markdown && !help.url)) {
      return {
        enabled: false,
        uploadedAt: null,
        uploadedBy: null
      };
    }

    return {
      enabled: true,
      uploadedAt: help.uploadedAt || null,
      uploadedBy: help.uploadedBy || null
    };
  }
}

const asyncMethods = {
  getAllTdfs, getTdfByFileName, getTdfByExperimentTarget, getTdfIDsAndDisplaysAttemptedByUserId,

  getAllTeachers, getUserIdforUsername, getClassPerformanceByTDF, createExperimentState,

  removeUserDueDateException, insertHiddenItem, setUserLoginData, addUserDueDateException,

  getStimDisplayTypeMap, getStimuliSetById, getSourceSentences, updateStimDisplayTypeMap,

  getAllCourses, getAllCourseSections, getAllCoursesForInstructor, getAllCourseAssignmentsForInstructor,

  addCourse, editCourse, editCourseAssignments, addUserToTeachersClass, saveContentFile,

  getTdfNamesAssignedByInstructor, getTdfNamesByOwnerId, getTdfsAssignedToStudent, getTdfAssignmentsByCourseIdMap,

  getStudentPerformanceByIdAndTDFId, getStudentPerformanceByIdAndTDFIdFromHistory, getNumDroppedItemsByUserIDAndTDFId,

  getSimpleTdfStats,
  
  getStudentPerformanceForClassAndTdfId, getStimSetFromLearningSessionByClusterList,

  getExperimentState, setExperimentState, getStimuliSetByFileName, getMaxResponseKC,

  getProbabilityEstimatesByKCId, getResponseKCMap, getResponseKCMapForTdf, processPackageUpload, getLastTDFAccessed,

  insertHistory, getHistoryByTDFID, getUserRecentTDFs, clearCurUnitProgress, tdfUpdateConfirmed,

  loadStimsAndTdfsFromPrivate, getListOfStimTags, getUserLastFeedbackTypeFromHistory,

  checkForUserException, getTdfById, checkForTDFData,

  getOutcomesForAdaptiveLearning: async function(userId, TDFId) {
    const history =  await Histories.find({userId: userId, TDFId: TDFId}, {fields: {KCId: 1, outcome: 1}, $sort: { recordedServerTime: -1 }}).fetchAsync();
    let outcomes = {};
    for(let h of history){
      if(h.KCId)
        outcomes[h.KCId % 1000] = h.outcome == 'correct'
    }
    // need to convert to cluster stim set
    const tdf = await Tdfs.findOneAsync({_id: TDFId});
    const stimSet = tdf.stimuli;
    const clusterStimSet = {};
    for(const stim of stimSet){
      clusterStimSet[stim.clusterKC % 1000] = stim;
    }

    for(const cluster in clusterStimSet){
      if(!outcomes[cluster]){
        outcomes[cluster] = false;
      }
    }

    return outcomes;
  },

  getUsersByExperimentId: async function(experimentId){
    const messages =  await ScheduledTurkMessages.find({experiment: experimentId}).fetchAsync();
    const userIds = messages.map(x => x.workerUserId);
    let users = []
    for (const u of userIds){
      users.push({userId: u, userName: (await Meteor.users.findOneAsync({_id: u})).username})
    }
    return users;
  },
  
  makeGoogleTTSApiCall: async function(TDFId, message, audioPromptSpeakingRate, audioVolume, selectedVoice = 'en-US-Standard-A') {
    try {
      serverConsole('[TTS] makeGoogleTTSApiCall called:', {TDFId, message, audioPromptSpeakingRate, audioVolume, selectedVoice});
      let ttsAPIKey;

      // Try to get API key from multiple sources
      if (this.userId) {
        // 1. Try TDF API key first (preferred)
        try {
          ttsAPIKey = await methods.getTdfTTSAPIKey.call(this, TDFId);
          if (ttsAPIKey) {
            serverConsole('Using TDF API key for TTS');
          }
        } catch(err) {
          serverConsole('Could not access TDF TTS key:', err.message);
        }

        // 2. Fallback to user's personal TTS API key (if field exists)
        if (!ttsAPIKey) {
          try {
            const user = await Meteor.users.findOneAsync({_id: this.userId});
            if (user && user.ttsAPIKey) {
              ttsAPIKey = decryptData(user.ttsAPIKey);
              serverConsole('Using user personal API key for TTS');
            }
          } catch(err) {
            serverConsole('Could not access user TTS key:', err.message);
          }
        }
      }

      if (!ttsAPIKey) {
        serverConsole('[TTS] ERROR: No API key available');
        throw new Meteor.Error('no-api-key', 'No TTS API key available');
      }

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
          throw new Meteor.Error('tts-api-error', 'Error with Google TTS API call: ' + error);
        const response = JSON.parse(data.toString('utf-8'))
        return response.audioContent;
      });
    } catch (error) {
      serverConsole('[TTS] ERROR in makeGoogleTTSApiCall:', error);
      throw error;
    }
  },

  getContentGenerationAvailable: function(){
    return contentGenerationAvailable;
  },
  
  setLockoutTimeStamp: async function(lockoutTimeStamp, lockoutMinutes, currentUnitNumber, TDFId) {
    serverConsole('setLockoutTimeStamp', lockoutTimeStamp, lockoutMinutes, currentUnitNumber, TDFId);
    let lockouts = (await Meteor.userAsync()).lockouts
    if(!lockouts) lockouts = {};
    if(!lockouts[TDFId]) lockouts[TDFId] = {};
    lockouts[TDFId].lockoutTimeStamp = lockoutTimeStamp;
    lockouts[TDFId].lockoutMinutes = lockoutMinutes;
    lockouts[TDFId].currentLockoutUnit = currentUnitNumber;
    await Meteor.users.updateAsync({_id: Meteor.userId()}, {$set: {lockouts: lockouts}});
  },

  makeGoogleSpeechAPICall: async function(TDFId, speechAPIKey, request, answerGrammar){
    // FIX: Allow other methods to run while waiting for Google API (prevents blocking client methods)
    this.unblock();

    serverConsole('makeGoogleSpeechAPICall for TDFId:', TDFId);

    // Try to get API key from multiple sources (if user is logged in)
    if (this.userId) {
      // 1. Try TDF API key first (preferred)
      if (!speechAPIKey) {
        try {
          const TDFAPIKey = await methods.getTdfSpeechAPIKey.call(this, TDFId);
          if (TDFAPIKey) {
            speechAPIKey = TDFAPIKey;
            serverConsole('Using TDF API key for speech recognition');
          }
        } catch(err) {
          serverConsole('Could not access TDF key:', err.message);
        }
      }

      // 2. Fallback to user's personal API key
      if (!speechAPIKey) {
        try {
          const userAPIKey = await methods.getUserSpeechAPIKey.call(this);
          if (userAPIKey) {
            speechAPIKey = userAPIKey;
            serverConsole('Using user personal API key for speech recognition');
          }
        } catch(err) {
          serverConsole('Could not access user API key:', err.message);
        }
      }
    }

    // If we still don't have a key, error out
    if (!speechAPIKey) {
      throw new Meteor.Error('no-api-key', 'No speech API key available');
    }

    const options = {
      hostname: 'speech.googleapis.com',
      path: '/v1p1beta1/speech:recognize?key=' + speechAPIKey,  // Use v1p1beta1 for boost and better alternatives
      method: 'POST'
    }
    try {
      const data = await makeHTTPSrequest(options, JSON.stringify(request), 30000);
      return [answerGrammar, JSON.parse(data.toString('utf-8'))];
    } catch(error) {
      serverConsole('Google Speech API error:', error);
      throw new Meteor.Error('google-speech-api-error', 'Error with Google SR API call: ' + error.message);
    }
  },
  getUIDAndSecretForCurrentUser: async function(){
    if(!Meteor.userId()){
      throw new Meteor.Error('Unauthorized: No user login');
    }
    else if(!await Roles.userIsInRoleAsync(Meteor.userId(), ['teacher', 'admin'])){
      throw new Meteor.Error('Unauthorized: You do not have permission to this data');
    }
    return [Meteor.userId(), (await Meteor.userAsync()).secretKey]
  },

  resetCurSessionTrialsCount: async function(userId, TDFId) {
    let unit = await ComponentStates.findOneAsync({userId: userId, TDFId: TDFId});
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
    await ComponentStates.updateAsync({_id: unit._id}, unit);
  },

  updateTdfConditionCounts: async function(TDFId, conditionCounts) {
    serverConsole('updateTdfConditionCounts', TDFId, conditionCounts);
    await Tdfs.updateAsync({_id: TDFId}, {$set: {conditionCounts: conditionCounts}});
  },

  resetTdfConditionCounts: async function(TDFId) {
    serverConsole('resetTdfConditionCounts', TDFId);
    const tdf = await Tdfs.findOneAsync({_id: TDFId});
    const setspec = tdf.content.tdfs.tutor.setspec;
    const conditions = setspec.condition;
    const conditionCounts = {};
    for(let condition in conditions){
      conditionCounts[condition] = 0;
    }
    await Tdfs.updateAsync({_id: TDFId}, {$set: {conditionCounts: conditionCounts}});
  },
  
  // TEST METHOD: Simple syllable splitting test (can be called from browser console)
  testSyllableSplitting: function(words = ['computer', 'mali', 'malawi', 'beautiful', 'hyphenation']) {
    serverConsole('=== Testing Syllable Splitting with hypher ===');
    const results = {};
    words.forEach(word => {
      const syllables = getSyllablesForWord(word);
      results[word] = syllables;
      serverConsole(`${word} => [${syllables.join(', ')}]`);
    });
    serverConsole('=== Test Complete ===');
    return results;
  },

  updateStimSyllables: async function(stimuliSetId, stimuli = undefined) {
    serverConsole('updateStimSyllables', stimuliSetId);
    if(!stimuli){
      const tdf = await Tdfs.findOneAsync({ stimuliSetId: stimuliSetId });
      stimuli = tdf.stimuli
    }
    if (stimuli) {
      serverConsole('Processing', Object.keys(stimuli).length, 'stimuli');
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
            const syllableGenerationError = e;
          }
          stimuli[i].syllables = syllableArray;
        }
      }
      await Tdfs.updateAsync({'stimuliSetId': stimuliSetId}, {$set: {'stimuli': stimuli}}, {multi: true});
      serverConsole('after updateStimSyllables');
      serverConsole(stimuliSetId);
    }
  },

  getSymSpellCorrection: function(userAnswer, s2, maxEditDistance = 1) {
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
  saveUserAWSData: async function(profileData) {
    serverConsole('saveUserAWSData', displayify(profileData));

    let saveResult; let result; let errmsg; let acctBal;
    try {
      const data = _.extend(defaultUserProfile(), profileData);

      // Check length BEFORE any kind of encryption
      data.have_aws_id = data.aws_id.length > 0;
      data.have_aws_secret = data.aws_secret_key.length > 0;

      data.aws_id = encryptData(data.aws_id);
      data.aws_secret_key = encryptData(data.aws_secret_key);

      saveResult = userProfileSave(await Meteor.userAsync(), data);

      // We test by reading the profile back and checking their
      // account balance
      const res = await turk.getAccountBalance(
          await Meteor.users.findOneAsync({_id: Meteor.userId()}),
      );

      if (!res) {
        throw new Error('There was an error reading your account balance');
      }

      result = true;
      acctBal = res.AvailableBalance;
      errmsg = '';
    } catch (e) {
      result = false;
      serverConsole('here', e);
      errmsg = e;
    }
    return {
      'result': result,
      'saveResult': saveResult,
      'acctBal': acctBal,
      'error': errmsg,
    };
  },

  //handle file deletions

  deleteAllFiles: async function(){
    // Security: Require admin role to delete all files
    if (!this.userId || !await Roles.userIsInRoleAsync(this.userId, ['admin'])) {
      throw new Meteor.Error(403, 'Admin access required to delete all files');
    }

    try {
      serverConsole('delete all uploaded files');

      // Delete all TDFs first
      const tdfs =  await Tdfs.find({}).fetchAsync();
      serverConsole("TDFs to remove: " + tdfs.length);
      let tdfsRemoved = 0;

      for(let tdf of tdfs){
        try {
          const tdfId = tdf._id;
          // Remove related data
          await ComponentStates.removeAsync({TDFId: tdfId});
          await Assignments.removeAsync({TDFId: tdfId});
          await Histories.removeAsync({TDFId: tdfId});
          await GlobalExperimentStates.removeAsync({TDFId: tdfId});
          // Remove the TDF itself
          await Tdfs.removeAsync({_id: tdfId});
          tdfsRemoved++;
          serverConsole('removed TDF ' + tdfId);
        } catch (tdfError) {
          serverConsole('Error removing TDF ' + tdf._id + ':', tdfError);
        }
      }

      // Delete all assets
      const files =  await DynamicAssets.find({}).fetchAsync();
      serverConsole("Asset files to remove: " + files.length);
      let filesRemoved = 0;

      for(let file of files){
        try {
          serverConsole('removing file ' + file._id);
          await DynamicAssets.removeAsync({_id: file._id});
          filesRemoved++;
        } catch (fileError) {
          serverConsole('Error removing file ' + file._id + ':', fileError);
        }
      }

      serverConsole('removed ' + tdfsRemoved + ' TDFs and ' + filesRemoved + ' asset files');
      return filesRemoved + tdfsRemoved;
    } catch (error) {
      serverConsole('Error in deleteAllFiles:', error);
      throw new Meteor.Error('delete-failed', 'Failed to delete files: ' + error.message);
    }
  },
  deleteStimFile: async function(stimSetId) {
    stimSetId = parseInt(stimSetId);
    let tdfs = await Tdfs.find({stimuliSetId: stimSetId, owner: Meteor.userId()}).fetchAsync();
    if(tdfs){
      serverConsole(tdfs);
      for(let tdf of tdfs) {
        tdfId = tdf._id;
        await GlobalExperimentStates.removeAsync({TDFId: tdfId});
        await ComponentStates.removeAsync({TDFId: tdfId});
        await Assignments.removeAsync({TDFId: tdfId});
        await Histories.removeAsync({TDFId: tdfId});
      }
      await Tdfs.removeAsync({stimuliSetId: stimSetId});
      res = "Stim and related TDFS deleted.";
      return res;
    } else {
      res = "Stim not found.";
      return res;
    }
  },

  // ComponentStates methods for Meteor 3 compatibility
  insertComponentState: async function(componentState) {
    const userId = this.userId;
    if (!userId) {
      throw new Meteor.Error('not-authorized', 'Must be logged in to insert component state');
    }
    if (componentState.userId !== userId) {
      throw new Meteor.Error('not-authorized', 'Cannot insert component state for another user');
    }
    return await ComponentStates.insertAsync(componentState);
  },

  updateComponentState: async function(selector, modifier) {
    const userId = this.userId;
    if (!userId) {
      throw new Meteor.Error('not-authorized', 'Must be logged in to update component state');
    }
    // Verify the selector targets this user's documents
    const doc = await ComponentStates.findOneAsync(selector);
    if (!doc) {
      throw new Meteor.Error('not-found', 'Component state not found');
    }
    if (doc.userId !== userId) {
      throw new Meteor.Error('not-authorized', 'Cannot update component state for another user');
    }
    return await ComponentStates.updateAsync(selector, modifier);
  },
}

// Server-side startup logic
Meteor.methods(functionTimerWrapper(methods, asyncMethods));

Meteor.startup(async function() {
  // Security: Add security headers to all HTTP responses
  WebApp.handlers.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self)');
    // DO NOT set Cross-Origin-Opener-Policy - it breaks OAuth popup communication
    next();
  });

  await themeRegistry.initialize();
  await migrateLegacyHelpPage();

  // Initialize username cache (Meteor 3.0 async pattern)
  serverConsole('Initializing username cache...');
  const users = await Meteor.users.find({}, {fields: {_id: 1, username: 1}, sort: [['username', 'asc']]}).fetchAsync();
  for (const user of users) {
    userIdToUsernames[user._id] = user.username;
    usernameToUserIds[user.username] = user._id;
  }
  serverConsole('Username cache initialized with ' + users.length + ' users');

  highestStimuliSetId = await Tdfs.findOneAsync({}, {sort: {stimuliSetId: -1}, limit: 1 });
  nextEventId = await Histories.findOneAsync({}, {limit: 1, sort: {eventId: -1}})?.eventId + 1 || 1;
  nextStimuliSetId = highestStimuliSetId && highestStimuliSetId.stimuliSetId ? parseInt(highestStimuliSetId.stimuliSetId) + 1 : 1;

  // Initialize settings only if they don't exist (don't overwrite admin changes on restart!)
  const existingClientVerbosity = await DynamicSettings.findOneAsync({key: 'clientVerbosityLevel'});
  if (!existingClientVerbosity) {
    await DynamicSettings.insertAsync({key: 'clientVerbosityLevel', value: 1});
    serverConsole('Initialized clientVerbosityLevel to default: 1');
  }

  const existingTestLogins = await DynamicSettings.findOneAsync({key: 'testLoginsEnabled'});
  if (!existingTestLogins) {
    await DynamicSettings.insertAsync({key: 'testLoginsEnabled', value: false});
    serverConsole('Initialized testLoginsEnabled to default: false');
  }


  // Let anyone looking know what config is in effect
  serverConsole('Log Notice (from siteConfig):', getConfigProperty('logNotice'));

  // Force our OAuth settings to be current
  serverConsole('Configuring Google OAuth service...');
  const google = getConfigProperty('google');
  await ServiceConfiguration.configurations.upsertAsync(
    {service: 'google'},
    {
      $set: {
        clientId: _.prop(google, 'clientId'),
        secret: _.prop(google, 'secret'),
      }
    }
  );
  serverConsole('Google OAuth service configured');

  if(Meteor.settings.microsoft) {
    serverConsole('Configuring Microsoft OAuth service...');
    //add microsoft service config
    await ServiceConfiguration.configurations.upsertAsync({service: 'microsoft'}, {
      $set: {
        loginStyle: 'redirect',
        clientId: Meteor.settings.microsoft.clientId,
        secret: Meteor.settings.microsoft.secret,
        tenant: 'common',
        //save the refresh token
        refreshToken: true,
      },
    });
    serverConsole('Microsoft OAuth service configured');
  } else {
    serverConsole('WARNING: No Microsoft OAuth configuration found in settings');
  }

  // METEOR 3 FIX: Set up Accounts.onLogin hook to handle OAuth loginParams
  // This runs on the server AFTER successful authentication, so this.userId is guaranteed to be set
  // This solves the DDP race condition where client has userId but server method calls fail
  Accounts.onLogin(async (loginInfo) => {
    serverConsole('[ACCOUNTS.ONLOGIN] Login detected:', {
      type: loginInfo.type,
      userId: loginInfo.user?._id,
      methodName: loginInfo.methodName,
      allowed: loginInfo.allowed
    });

    if (!loginInfo.user || !loginInfo.allowed) {
      return;
    }

    const userId = loginInfo.user._id;
    const userEmail = _.chain(loginInfo.user.emails).first().prop('address').value() ||
                      loginInfo.user.email ||
                      loginInfo.user.username;

    serverConsole('[ACCOUNTS.ONLOGIN] Processing login for user:', userId, 'email:', userEmail);

    // Check if this user should be assigned roles based on initRoles settings
    const initRoles = getConfigProperty('initRoles');
    if (initRoles && userEmail) {
      const admins = _.prop(initRoles, 'admins') || [];
      const teachers = _.prop(initRoles, 'teachers') || [];

      // Check if user email is in admins list
      if (admins.includes(userEmail)) {
        serverConsole('[ACCOUNTS.ONLOGIN] User', userEmail, 'found in initRoles.admins - assigning admin role');
        try {
          await Roles.addUsersToRolesAsync(userId, 'admin');
          await createUserSecretKey(userId);
          serverConsole('[ACCOUNTS.ONLOGIN] Admin role assigned successfully to', userEmail);
        } catch (err) {
          serverConsole('[ACCOUNTS.ONLOGIN] ERROR assigning admin role:', err);
        }
      }

      // Check if user email is in teachers list
      if (teachers.includes(userEmail)) {
        serverConsole('[ACCOUNTS.ONLOGIN] User', userEmail, 'found in initRoles.teachers - assigning teacher role');
        try {
          await Roles.addUsersToRolesAsync(userId, 'teacher');
          await createUserSecretKey(userId);
          serverConsole('[ACCOUNTS.ONLOGIN] Teacher role assigned successfully to', userEmail);
        } catch (err) {
          serverConsole('[ACCOUNTS.ONLOGIN] ERROR assigning teacher role:', err);
        }
      }
    }

    // Only auto-set loginParams for OAuth logins (google, microsoft)
    // Password logins have their own flow that sets more specific parameters
    const isOAuthLogin = loginInfo.type === 'google' || loginInfo.type === 'microsoft';

    if (isOAuthLogin) {
      const loginMode = loginInfo.type; // 'google' or 'microsoft'

      serverConsole('[ACCOUNTS.ONLOGIN] Setting OAuth loginParams for user:', userId, 'mode:', loginMode);

      // Set basic loginParams for OAuth logins
      // This runs synchronously on the server, so no DDP race condition
      try {
        await Meteor.users.updateAsync({_id: userId}, {
          $set: {
            'loginParams.entryPoint': 'direct',
            'loginParams.loginMode': loginMode,
            'loginParams.lastLoginTime': new Date()
          }
        });
        serverConsole('[ACCOUNTS.ONLOGIN] loginParams set successfully for user:', userId);
      } catch (err) {
        serverConsole('[ACCOUNTS.ONLOGIN] ERROR setting loginParams:', err);
      }
    }
  });
  serverConsole('Accounts.onLogin hook registered for OAuth handling and role assignment');

  // Figure out the "prime admin" (owner of repo TDF/stim files)
  // Note that we accept username or email and then find the ID
  const adminUser = findUserByName(getConfigProperty('owner'));

  // Create roles if they don't exist (required in newer alanning:roles)
  // Must be done BEFORE any role assignments
  await Roles.createRoleAsync('admin', {unlessExists: true});
  await Roles.createRoleAsync('teacher', {unlessExists: true});

  // Used below for ownership
  const adminUserId = _.prop(adminUser, '_id') || '';
  // adminUser should be in an admin role
  if (adminUserId) {
    await Roles.addUsersToRolesAsync(adminUserId, 'admin');
    serverConsole('Admin User Found ID:', adminUserId, 'with obj:', _.pick(adminUser, '_id', 'username', 'email'));
  } else {
    serverConsole('Admin user ID could not be found. adminUser=', displayify(adminUser || 'null'));
    serverConsole('ADMIN USER is MISSING: a restart might be required');
    serverConsole('Make sure you have a valid siteConfig');
    serverConsole('***IMPORTANT*** There will be no owner for system TDF\'s');
  }

  contentGenerationAvailable = Meteor.settings.contentGenerationEnabled || false;

  // Get user in roles and make sure they are added
  const roles = getConfigProperty('initRoles');
  const roleAdd = async function(memberName, roleName) {
    const requested = _.prop(roles, memberName) || [];
    serverConsole('Role', roleName, '- found', _.prop(requested, 'length'));

    for (const username of requested) {
      const user = findUserByName(username);
      if (!user || !user._id) {
        serverConsole('Warning: user', username, 'role', roleName, 'request, but user not found');
        continue;
      }
      await Roles.addUsersToRolesAsync(user._id, roleName);
      //if the role name is admin or teacher, create a secret key for the user
      if(roleName == 'admin' || roleName == 'teacher'){
        await createUserSecretKey(user._id);
      }
      serverConsole('Added user', username, 'to role', roleName);
    }
  };

  await roleAdd('admins', 'admin');
  await roleAdd('teachers', 'teacher');
  const ret =  await Tdfs.find().countAsync();
  if (ret == 0) loadStimsAndTdfsFromPrivate(adminUserId);

  // Make sure we create a default user profile record when a new OAuth user
  // shows up (Google or Microsoft). We still want the default hook's 'profile'
  // behavior, AND we want our custom user profile collection to have a default record
  Accounts.onCreateUser(function(options, user) {
    serverConsole('[ACCOUNTS] onCreateUser called');
    serverConsole('[ACCOUNTS] User services:', Object.keys(user.services || {}));

    // Little display helper
    const dispUsr = function(u) {
      return _.pick(u, '_id', 'username', 'emails', 'profile');
    };

    // Default profile save
    //userProfileSave(user, defaultUserProfile());

    // Default hook's behavior
    if (options.profile) {
      user.profile = _.extend(user.profile || {}, options.profile);
    }

    if (_.prop(user.profile, 'experiment')) {
      serverConsole('Experiment participant user created:', dispUsr(user));
      return user;
    }

    let email = null;
    let serviceName = null;

    // Try to get email from Google service
    if (user.services && user.services.google) {
      email = _.chain(user)
          .prop('services')
          .prop('google')
          .prop('email').trim()
          .value().toLowerCase();
      serviceName = 'Google';
    }
    // Try to get email from Microsoft service
    else if (user.services && user.services.microsoft) {
      // Microsoft uses 'mail' or 'userPrincipalName'
      const msEmail = _.chain(user)
          .prop('services')
          .prop('microsoft')
          .prop('mail')
          .value();
      const msUserPrincipalName = _.chain(user)
          .prop('services')
          .prop('microsoft')
          .prop('userPrincipalName')
          .value();

      email = (msEmail || msUserPrincipalName || '').trim().toLowerCase();
      serviceName = 'Microsoft';

      serverConsole('[ACCOUNTS] Microsoft user data:', {
        mail: msEmail,
        userPrincipalName: msUserPrincipalName,
        extractedEmail: email
      });
    }

    if (!email) {
      serverConsole('[ACCOUNTS] WARNING: No email found for OAuth user!');
      serverConsole('[ACCOUNTS] User object:', JSON.stringify(user, null, 2));
      // throw new Meteor.Error("No email found for your OAuth account");
    }

    if (email) {
      user.username = email;
      user.emails = [{
        'address': email,
        'verified': true,
      }];
      // Set profile.username so client doesn't try to call populateSSOProfile
      user.profile = user.profile || {};
      user.profile.username = email;
    }

    serverConsole(`[ACCOUNTS] Creating new ${serviceName} user:`, dispUsr(user));

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
  await ScheduledTurkMessages.rawCollection().createIndex({'sent': 1, 'scheduled': 1});

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
  let allEmails = [];
  allEmails.push(ownerEmail);
  const teacherEmails = roles.teachers;
  allEmails = allEmails.concat(teacherEmails);
  const adminEmails = roles.admins;
  allEmails = allEmails.concat(adminEmails);

  //we also need to get the users in roles admin and teacher and send them an email
  const db_admins = await Meteor.users.find({roles: 'admin'}).fetchAsync();
  const db_teachers = await Meteor.users.find({roles: 'teacher'}).fetchAsync();

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
    const rootUrl = Meteor.settings.ROOT_URL;
    let server = Meteor.absoluteUrl().split('//')[1];
    server = server.substring(0, server.length - 1);
    const subject = `MoFaCTs Deployed on ${server}`;
    const text = `The server has restarted.\nServer: ${server}`;
    sendEmail(emailaddr, ownerEmail, subject, text)
  }
  
});

Router.route('/dynamic-assets/:tdfid?/:filetype?/:filename?', {
  name: 'dynamic-asset',
  where: 'server',
  action: async function() {
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

    const authUser = await Meteor.users.findOneAsync({_id: userId});
    if (!authUser || authUser.secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }

    if (!uid) {
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

    //remove duplicates
    const uniqueTdfs = tdfNames.filter((v, i, a) => a.indexOf(v) === i);

    console.log(userId, uid, tdfNames)

    if (!uniqueTdfs.length > 0) {
      response.writeHead(404);
      response.end('No tdfs found for any classes');
      return;
    }

    const user = await Meteor.users.findOneAsync({'_id': uid});
    let userName = user.username;
    // eslint-disable-next-line no-useless-escape
    userName = userName.replace('/[/\\?%*:|"<>\s]/g', '_');

    const fileName = 'mofacts_' + userName + '_all_tdf_data.tsv';

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    serverConsole(uniqueTdfs);
    response.write(await createExperimentExport(uniqueTdfs, uid));

    uniqueTdfs.forEach(function(tdf) {
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

    const user = await Meteor.users.findOneAsync({_id: userId});
    if (!user || user.secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }

    if (!classId) {
      response.writeHead(404);
      response.end('No class ID specified');
      return;
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
    const fileName = 'mofacts_' + className + '_all_class_data.tsv';

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
    else {
      const user = await Meteor.users.findOneAsync({_id: userId});
      if (!user || user.secretKey != loginToken){
        response.writeHead(403);
        response.end('Unauthorized');
        return;
      }
    }

    if (path.includes('..')){ //user is trying to do some naughty stuff
      response.writeHead('404');
      response.end();
      return;
    }
    else if (!exp) {
      response.writeHead(404);
      response.end('No experiment specified');
      return;
    }

    const fileName = exp.split('.json')[0] + '-data.tsv';

    response.writeHead(200, {
      'Content-Type': 'text/tab-separated-values',
      'File-Name': fileName
    });

    const tdf = await Tdfs.findOneAsync({"content.fileName": exp});

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
  action: async function() {
    const userId = this.request.headers['x-user-id'];
    const loginToken = this.request.headers['x-auth-token'];
    const uid = this.params.uid;
    const response = this.response;
    
    if(!userId || !loginToken){
      response.writeHead('403');
      response.end();
      return;
    }

    const user = await Meteor.users.findOneAsync({_id: userId});
    if (!user || user.secretKey != loginToken){
      response.writeHead(403);
      response.end('Unauthorized');
      return;
    }

    if (!uid) {
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

// ============================================================================
// Security: Rate Limiting Configuration
// ============================================================================

import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';

// Rate limit password reset requests (3 per hour per connection)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'requestPasswordReset',
  connectionId() { return true; }
}, 3, 3600000); // 3 requests per hour

// Rate limit password reset with token (5 attempts per hour)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'resetPasswordWithToken',
  connectionId() { return true; }
}, 5, 3600000); // 5 attempts per hour

// Rate limit old password reset method (3 per hour)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'resetPasswordWithSecret',
  connectionId() { return true; }
}, 3, 3600000);

// Rate limit login attempts (10 per 5 minutes per connection)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'login',
  connectionId() { return true; }
}, 10, 300000); // 10 attempts per 5 minutes

// Rate limit signup (5 per hour per connection)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'signUpUser',
  connectionId() { return true; }
}, 5, 3600000); // 5 signups per hour

// Rate limit file uploads (20 per hour per user)
DDPRateLimiter.addRule({
  type: 'method',
  name: 'processPackageUpload',
  userId(userId) { return !!userId; }
}, 20, 3600000); // 20 uploads per hour

// Rate limit data deletion operations (10 per hour per user)
DDPRateLimiter.addRule({
  type: 'method',
  name(name) {
    return ['deleteAllFiles', 'deleteStimFile', 'removeAssetById'].includes(name);
  },
  userId(userId) { return !!userId; }
}, 10, 3600000); // 10 deletions per hour

// Rate limit sensitive admin operations (30 per hour per user)
DDPRateLimiter.addRule({
  type: 'method',
  name(name) {
    return ['transferDataOwnership', 'assignAccessors', 'toggleTdfPresence', 'impersonate'].includes(name);
  },
  userId(userId) { return !!userId; }
}, 30, 3600000); // 30 admin operations per hour

// Log rate limit violations
DDPRateLimiter.setErrorMessage(function(rateLimitResult) {
  const { timeToReset, numInvocationsLeft } = rateLimitResult;
  const seconds = Math.ceil(timeToReset / 1000);
  serverConsole('Rate limit exceeded - wait', seconds, 'seconds. Remaining:', numInvocationsLeft);
  return `Too many requests. Please try again in ${seconds} seconds.`;
});
