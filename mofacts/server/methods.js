import { DynamicTdfGenerator } from "../common/DynamicTdfGenerator";
import { curSemester, ALL_TDFS } from "../common/Definitions";
import * as TutorialDialogue from "../server/lib/TutorialDialogue";
import * as DefinitionalFeedback from "../server/lib/DefinitionalFeedback.js";
import * as ClozeAPI from "../server/lib/ClozeAPI.js";
export { getTdfBy_id };

/*jshint sub:true*/

//The jshint inline option above suppresses a warning about using sqaure
//brackets instead of dot notation - that's because we prefer square brackets
//for creating some MongoDB queries

var Future = Npm.require("fibers/future");
var fs = Npm.require("fs");

if(!!process.env.METEOR_SETTINGS_WORKAROUND){
  Meteor.settings = JSON.parse(process.env.METEOR_SETTINGS_WORKAROUND);
}
if(!!Meteor.settings.public.testLogin){
  process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
  console.log("dev environment, allow insecure tls");
}
console.log("meteor settings: " + JSON.stringify(Meteor.settings));
process.env.MAIL_URL = Meteor.settings.MAIL_URL;
var adminUsers = Meteor.settings.initRoles.admins;
var ownerEmail = Meteor.settings.owner;
let isProd = Meteor.settings.prod || false;
console.log("isProd: " + isProd);

const thisServerUrl = Meteor.settings.ROOT_URL;
console.log("thisServerUrl: " + thisServerUrl);

const altServerUrl = Meteor.settings.ALT_URL;
console.log("altServerUrl: " + altServerUrl);

var clozeGeneration = require('./lib/Process.js');

let userIdToUsernames = {};
let usernameToUserIds = {};
Meteor.users.find({},{ fields: {_id:1, username: 1}, sort: [['username', 'asc']] }).map(function(user){
  userIdToUsernames[user._id] = user.username;
  usernameToUserIds[user.username] = user._id;
});

function getUserIdforUsername(username){
  let userId = usernameToUserIds[username];
  if(!userId){
    let user = Meteor.users.findOne({username:username}).fetch();
    userId = user._id;
    usernameToUserIds[username] = userId;
  }
  return userId;
}

//For Southwest SSO with ADFS/SAML 2.0
if(Meteor.settings.saml){
  console.log("reading SAML settings");
  for (i = 0; i < Meteor.settings.saml.length; i++) {
    // privateCert is weird name, I know. spCert is better one. Will need to refactor
    if (Meteor.settings.saml[i].privateKeyFile && Meteor.settings.saml[i].publicCertFile) {
        console.log("Set keys/certs for " + Meteor.settings.saml[i].provider);
        let privateCert = fs.readFileSync(Meteor.settings.saml[i].publicCertFile);
        if(typeof(privateCert) != "string"){
          privateCert = privateCert.toString();
        }
        Meteor.settings.saml[i].privateCert = privateCert;
        
        let privateKey = fs.readFileSync(Meteor.settings.saml[i].privateKeyFile);
        if(typeof(privateKey) != "string"){
          privateKey = privateKey.toString();
        }
        Meteor.settings.saml[i].privateKey = privateKey;
    } else {
        console.log("No keys/certs found for " + Meteor.settings.saml[i].provider);
    }
  }
}

if(Meteor.settings.definitionalFeedbackDataLocation){
  console.log("reading feedbackdata");
  var feedbackData = fs.readFileSync(Meteor.settings.definitionalFeedbackDataLocation);
  console.log("initializing feedback");
  DefinitionalFeedback.Initialize(feedbackData);
}

const pgp = require('pg-promise')();
const connectionString = "postgres://mofacts:test101@localhost:5432";
const db = pgp(connectionString);

//Published to all clients (even without subscription calls)
Meteor.publish(null, function () {
  //Only valid way to get the user ID for publications
  var userId = this.userId;

  //The default data published to everyone - all TDF's and stims, and the
  //user data (user times log and user record) for them
  var defaultData = [
      StimSyllables.find({}),
      Meteor.users.find({_id: userId}),
      UserProfileData.find({_id: userId}, {fields: {
          have_aws_id: 1,
          have_aws_secret: 1,
          use_sandbox: 1
      }}),
  ];

  return defaultData;
});

Meteor.publish('allUsers', function () {
  var opts = {
      fields: {username: 1}
  };
  if (Roles.userIsInRole(this.userId, ["admin"])) {
      opts.fields.roles = 1;
  }
return Meteor.users.find({}, opts);
});

//Config for scheduled jobs - the start command is at the end of
//Meteor.startup below
SyncedCron.config({
  log: true,
  logger: null,
  collectionName: 'cronHistory',
  utc: false,
  collectionTTL: undefined
});

serverConsole = function() {
    var disp = [(new Date()).toString()];
    for (var i = 0; i < arguments.length; ++i) {
        disp.push(arguments[i]);
    }
    console.log.apply(this, disp);
};

async function getAllTdfFileNames() {
  const allTdfs = await getAllTdfs();
  return allTdfs.map(x => x.content.fileName);
}

async function getTdfQueryNames(tdfFileName) {
  let tdfQueryNames = {};
  if (tdfFileName === ALL_TDFS) {
    tdfQueryNames = await getAllTdfFileNames();
  } else if (tdfFileName){
    tdfQueryNames = [tdfFileName];
  }
  return tdfQueryNames;
}

async function getLearningSessionItems(tdfFileName) {
  let learningSessionItems = [];
  const tdfQueryNames = await getTdfQueryNames(tdfFileName);
  tdfQueryNames.forEach(async function(tdfQueryName){
    if (!learningSessionItems[tdfQueryName]) {
      learningSessionItems[tdfQueryName] = {};
    }
    const tdf = await getTdfByFileName(tdfQueryName);
    if (tdf.content.isMultiTdf) {
      setLearningSessionItemsMulti(learningSessionItems[tdfQueryName], tdf.content);
    } else {
      setLearningSessionItems(learningSessionItems[tdfQueryName], tdf.content);
    }
  });
  return learningSessionItems;
}

async function getTdfByOwnerId(ownerId){
  try{
    console.log("getTdfByOwnerId:"+ownerId);
    const tdfs = await db.any("SELECT * from tdf WHERE ownerid=$1",[ownerId]);
    return tdfs[0];
  }catch(e){
    console.log("getTdfByOwnerId ERROR,",ownerId,",",e);
    return null;
  }
}

async function getTdfById(TDFId){
  return await db.one("SELECT * from tdf WHERE TDFId=$1",TDFId);
}

async function getTdfBy_id(_id){
  try{
    console.log("getTdfBy_id:"+_id);
    let queryJSON = {"_id":_id};
    const tdfs = await db.any("SELECT * from tdf WHERE content @> $1" + "::jsonb",[queryJSON]);
    return tdfs[0];
  }catch(e){
    console.log("getTdfBy_id ERROR,",_id,",",e);
    return null;
  }
}

async function getTdfByFileName(filename){
  try{
    console.log("getTdfByFileName:"+filename);
    let queryJSON = {"fileName":filename};
    const tdfs = await db.any("SELECT * from tdf WHERE content @> $1" + "::jsonb",[queryJSON]);
    return tdfs[0];
  }catch(e){
    console.log("getTdfByFileName ERROR,",filename,",",e);
    return null;
  }
}

async function getTdfByExperimentTarget(experimentTarget){
  try{
    console.log("getTdfByExperimentTarget:"+experimentTarget);
    let queryJSON = {"tdfs":{"tutor":{"setspec":[{"experimentTarget":[experimentTarget]}]}}};
    const tdfs = await db.any("SELECT * from tdf WHERE content @> $1" + "::jsonb",[queryJSON]);
    return tdfs[0];
  }catch(e){
    console.log("getTdfByExperimentTarget ERROR,",experimentTarget,",",e);
    return null;
  }
}

async function getAllTdfs(){
  console.log("getAllTdfs");
  const tdfs = await db.any("SELECT * from tdf");
  return tdfs;
}

async function getAllCourses(){
  try{
    const courses = await db.any("SELECT * from course");
    return courses;
  }catch(e){
    console.log("getAllCourses ERROR,",e);
    return null;
  }
}

async function getAllCourseSections(){
  try{//  //sectionid, courseandsectionname
    console.log("getAllCourseSections");
    let query = "SELECT s.sectionid, s.sectionname, c.courseid, c.coursename, c.teacheruserid from course AS c INNER JOIN section AS s ON c.courseid = s.courseid WHERE c.semester=$1";
    const courses = await db.any(query,curSemester);
    return courses;
  }catch(e){
    console.log("getAllCourseSections ERROR,",instructorId,inCurrentSemester,",",e);
    return null;
  }
}

async function getAllCoursesForInstructor(instructorId){
  console.log("getAllCoursesForInstructor:",instructorId);
  let query = "SELECT * from course WHERE teacherUserId=$1 AND semester=$2";
  const courses = await db.any(query,[instructorId,curSemester]);
  return courses;
}

async function getAllCourseAssignmentsForInstructor(instructorId){
  try{
    console.log("getAllCourseAssignmentsForInstructor:"+instructorId);
    let query = "SELECT t.content -> 'fileName' AS filename, c.courseName, c.courseId from assignment AS a \
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 INNER JOIN course AS c ON c.courseId = a.courseId \
                 WHERE c.teacherUserId = $1 AND c.semester = $2";
    let args = [instructorId,curSemester];
    const courseAssignments = await db.any(query,args);
    return courseAssignments;
  }catch(e){
    console.log("getAllCourseAssignmentsForInstructor ERROR,",instructorId,",",e);
    return null;
  }
}

function getSetAMinusB(arrayA, arrayB){
  let a = new Set(arrayA);
  let b = new Set(arrayB);
  let difference = new Set([...a].filter(x => !b.has(x)));
  return Array.from(difference);
}

async function editCourseAssignments(newCourseAssignment){ //Shape: {coursename: "Test Course", courseid: 1, 'tdfs': ['filename1']}
  try{
    console.log("editCourseAssignments:",newCourseAssignment);
    const res = await db.tx(async t => {
      let newTdfs = newCourseAssignment.tdfs;
      let query = "SELECT t.content -> 'fileName' AS filename, t.TDFId, c.courseId from assignment AS a \
                  INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                  INNER JOIN course AS c ON c.courseId = a.courseId \
                  WHERE c.courseid = $1";
      const curCourseAssignments = await db.manyOrNone(query,newCourseAssignment.courseid);
      let existingTdfs = curCourseAssignments.map((courseAssignment) => courseAssignment.filename);
  
      let tdfsAdded = getSetAMinusB(newTdfs,existingTdfs);
      let tdfsRemoved = getSetAMinusB(existingTdfs,newTdfs);

      const tdfNamesAndIDs = await t.manyOrNone("SELECT TDFId, content -> 'fileName' AS filename from tdf");
      console.log("tdfNamesAndIDs",tdfNamesAndIDs);
      let tdfNameIDMap = {};
      for(let tdfNamesAndID of tdfNamesAndIDs){
        tdfNameIDMap[tdfNamesAndID.filename] = tdfNamesAndID.tdfid;
      }
      console.log("tdfNameIDMap",tdfNameIDMap);
  
      for(let tdfName of tdfsAdded){
        let TDFId = tdfNameIDMap[tdfName];
        await t.none('INSERT INTO assignment(courseId, TDFId) VALUES($1, $2)',[newCourseAssignment.courseid,TDFId]);
      }
      for(let tdfName of tdfsRemoved){
        let TDFId = tdfNameIDMap[tdfName];
        await t.none('DELETE FROM assignment WHERE courseId=$1 AND TDFId=$2',[newCourseAssignment.courseid,TDFId]);
      }
      return newCourseAssignment;
    });
    return res;
  }catch(e){
    console.log("editCourseAssignments ERROR,",newCourseAssignment,",",e);
    return null;
  }
}

async function getTdfAssignmentsByCourseIdMap(instructorId){
    console.log("getTdfAssignmentsByCourseIdMap",instructorId);
    let query = "SELECT t.content -> 'tdfs.tutor.setspec[0].lessonname[0]' AS displayname, TDFId, a.courseId \
                 FROM assignment AS a \
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 INNER JOIN course AS c ON c.courseId = a.courseId \
                 WHERE c.semester = $1 AND c.teacherUserId=$2";
    const assignmentTdfFileNamesRet = await db.any(query,[curSemester,instructorId]);
    console.log("assignmentTdfFileNames",assignmentTdfFileNamesRet);
    let assignmentTdfFileNamesByCourseIdMap = {};
    for(let assignment of assignmentTdfFileNamesRet){
      if(!assignmentTdfFileNamesByCourseIdMap[assignment.courseid]) assignmentTdfFileNamesByCourseIdMap[assignment.courseid] = [];
      assignmentTdfFileNamesByCourseIdMap[assignment.courseid].push({tdfid:assignment.tdfid, displayname:assignment.displayname});
    }
    return assignmentTdfFileNamesByCourseIdMap;
}

async function getTdfsAssignedToStudent(userId){
  console.log('getTdfsAssignedToStudent',userId);
  const tdfs = await db.manyOrNone('SELECT t.* from TDF AS t INNER JOIN assignment AS a ON a.TDFId = t.TDFId INNER JOIN course AS c ON c.courseId = a.courseId INNER JOIN section AS s ON s.courseId = c.courseId INNER JOIN section_user_map AS m ON m.sectionId = s.sectionId WHERE m.userId = $1 AND c.semester = $2',[userId,curSemester]);
  console.log("tdfs",tdfs);
  return tdfs;
}
               
async function getTdfNamesAssignedByInstructor(instructorID){
  try{
    let query = "SELECT t.content -> 'fileName' AS filename from course AS c \
                 INNER JOIN assignment AS a ON a.courseId = c.courseId\
                 INNER JOIN tdf AS t ON t.TDFId = a.TDFId \
                 WHERE c.teacherUserId = $1 AND c.semester = $2";
    const allTdfs = await getAllTdfs();
    console.log("allTdfs.length:",allTdfs.length);
    const assignmentTdfFileNames = await db.any(query,[instructorID,curSemester]);
    let unboxedAssignmentTdfFileNames = assignmentTdfFileNames.map((obj) => obj.filename);
    console.log("assignmentTdfFileNames",unboxedAssignmentTdfFileNames);
    return unboxedAssignmentTdfFileNames;
  }catch(e){
    console.log("getTdfNamesAssignedByInstructor ERROR,",e);
    return null;
  }
}

async function getExperimentState(UserId,TDFId){
  let query = "SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2";
  const experimentStateRet = await db.oneOrNone(query,[TDFId,UserId]);
  let experimentState = experimentStateRet[0].experimentState;
  console.log("getExperimentState",TDFId,UserId,experimentState);
  return experimentState;
}

async function setExperimentState(UserId,TDFId,newExperimentState){
  let query = "SELECT experimentState FROM globalExperimentState WHERE userId = $1 AND TDFId = $2";
  const experimentStateRet = await db.oneOrNone(query,[TDFId,UserId]);
  let experimentState = experimentStateRet.length > 0 ? experimentStateRet[0].experimentState : {};
  let updatedExperimentState = Object.assign(experimentState,newExperimentState);
  let updateQuery = "UPDATE course SET experimentState=$1 WHERE userId = $2 AND TDFId = $3 RETURNING experimentStateId";
  const res = await db.one(updateQuery,[updatedExperimentState,UserId,TDFId])
  console.log("setExperimentState",TDFId,UserId,updatedExperimentState,res);
  return updatedExperimentState;
}

function getAllTeachers(southwestOnly=false){
  let query = {'roles':'teacher'};
  if(southwestOnly) query["username"]=/southwest[.]tn[.]edu/i;
  console.log("getAllTeachers",query);
  let allTeachers = Meteor.users.find(query).fetch();

  console.log("allTeachers",allTeachers);
  return allTeachers;
}

async function addCourse(mycourse){
  console.log("addCourse:" + JSON.stringify(mycourse));
  const res = await db.tx(async t => {
    return t.one('INSERT INTO course(courseName, teacherUserId, semester, beginDate) VALUES(${coursename}, ${teacheruserid}, ${semester}, ${beginDate}) RETURNING courseId',mycourse)
    .then(async row => {
      let courseId = row.courseid;
      for(let sectionName of mycourse.sections){
        await t.none('INSERT INTO section(courseId, sectionName) VALUES($1, $2)',[courseId,sectionName]);
      }
      return courseId;
    })
  });
  return res;
}

async function editCourse(mycourse){
  console.log("editCourse:" + JSON.stringify(mycourse));
  const res = await db.tx(async t => {
    console.log("transaction");
    return t.one('UPDATE course SET courseName=${coursename}, beginDate=${beginDate} WHERE courseid=${courseid} RETURNING courseId',mycourse).then(async row => {
      let courseId = row.courseid;
      console.log("courseId",courseId,row);
      let newSections = mycourse.sections;
      const curCourseSections = await t.many('SELECT sectionName from section WHERE courseId=$1',courseId);
      let oldSections = curCourseSections.map(section => section.sectionname);
      console.log("old/new",oldSections,newSections);

      let sectionsAdded = getSetAMinusB(newSections,oldSections);
      let sectionsRemoved = getSetAMinusB(oldSections,newSections);
      console.log("sectionsAdded,",sectionsAdded);
      console.log("sectionsRemoved,",sectionsRemoved);

      for(let sectionName of sectionsAdded){
        await t.none('INSERT INTO section(courseId, sectionName) VALUES($1, $2)',[courseId,sectionName]);
      }
      for(let sectionName of sectionsRemoved){
        await t.none('DELETE FROM section WHERE courseId=$1 AND sectionName=$2',[courseId,sectionName]);
      }
      
      return courseId;
    })
  });
  return res;
}

async function addUserToTeachersClass(userid,teacherID,sectionId){
  console.log("addUserToTeachersClass",userid,teacherID,sectionId);

  const existingMapping = await db.oneOrNone('SELECT COUNT(*) FROM section_user_map WHERE sectionId=$1 AND userId=$2',[sectionId,userid]);
  console.log("existingMapping",existingMapping);
  if(!existingMapping.length || existingMapping.length == 0){
    console.log("new user, inserting into section_user_mapping",[sectionId,userid]);
    await db.none('INSERT INTO section_user_map(sectionId, userId) VALUES($1, $2)',[sectionId,userid]);
  }

  return true;
}

async function getStimDisplayTypeMap(){
  try{
    console.log("getStimDisplayTypeMap");
    let query = "SELECT \
    COUNT(i.clozeStimulus) AS clozeItemCount, \
    COUNT(i.textStimulus)  AS textItemCount, \
    COUNT(i.audioStimulus) AS audioItemCount, \
    COUNT(i.imageStimulus) AS imageItemCount, \
    COUNT(i.videoStimulus) AS videoItemCount, \
    i.stimuliSetId \
    FROM item AS i \
    GROUP BY i.stimuliSetId;"
    const counts = await db.many(query);
    let map = {};
    for(let count of counts){
      map[count.stimulisetid] = {
        hasCloze: count.clozeItemCount > 0,
        hasText:  count.textItemCount  > 0,
        hasAudio: count.audioItemCount > 0,
        hasImage: count.imageItemCount > 0,
        hasVideo: count.videoItemCount > 0
      }
    }
    return map;
  }catch(e){
    console.log("getStimDisplayTypeMap ERROR,",e);
    return null;
  }
}

async function getStimuliSetById(stimuliSetId){
  let query = "SELECT * FROM item \
               WHERE stimuliSetId=$1 \
               ORDER BY itemId";
  return await db.many(query,stimuliSetId);
}

async function getStimCountByStimuliSetId(stimuliSetId){
  let query = "SELECT COUNT(*) FROM item \
               WHERE stimuliSetId=$1 \
               ORDER BY itemId";
  const ret = await db.one(query,stimuliSetId);
  return ret.count;
}

async function getStudentPerformanceByIdAndTDFId(userId, TDFid){
  let query = "SELECT SUM(s.priorCorrect) AS numCorrect, \
               SUM(s.priorIncorrect) AS numIncorrect, \
               SUM(s.totalPromptDuration) AS totalPrompt, \
               SUM(s.totalStudyDuration) AS totalStudy \
               FROM componentState AS s \
               INNER JOIN item AS i ON i.stimulusKC = s.KCId \
               INNER JOIN tdf AS t ON t.stimuliSetId = i.stimuliSetId \
               WHERE s.userId=$1 AND t.TDFId=$2 AND s.currentUnitType = 'learningsession' \
               GROUP BY s.userId";
  return await db.one(query,[userId,TDFid]);
}

async function getStudentPerformanceForClassAndTdfId(instructorId){
  let query =  "SELECT MAX(t.TDFId) AS tdfid, \ 
                MAX(t.courseId) AS courseid, \
                MAX(s.userId) AS userid, \
                SUM(s.priorCorrect) AS correct, \
                SUM(s.priorIncorrect) AS incorrect, \
                SUM(s.totalPromptDuration) AS totalPrompt, \
                SUM(s.totalStudyDuration) AS totalStudy \
                FROM componentState AS s \
                INNER JOIN item AS i ON i.stimulusKC = s.KCId \
                INNER JOIN tdf AS t ON t.stimuliSetId = i.stimuliSetId \
                INNER JOIN assignment AS a on a.TDFId = t.TDFId \
                INNER JOIN course AS c on c.courseId = t.courseId \
                WHERE c.semester = $1, c.teacherUserId = $2 AND s.currentUnitType = 'learningsession' \
                GROUP BY s.userId, t.TDFId, c.courseId";

  const studentPerformanceRet = await db.any(query,[curSemester,instructorId]);
  let studentPerformanceForClass = {};
  let studentPerformanceForClassAndTdfIdMap = {};
  for(let studentPerformance of studentPerformanceRet){
    let studentUsername = userIdToUsernames[studentPerformance.userid];
    if(!studentUsername){
      studentUsername = Meteor.find({_id:userid});
      userIdToUsernames[userid] = studentUsername;
    } 

    let { courseid, userid, tdfid, correct, incorrect, totalPrompt, totalStudy } = studentPerformance;
    if(!studentPerformanceForClass[courseid]) studentPerformanceForClass[courseid] = {};
    if(!studentPerformanceForClass[courseid][tdfid]) studentPerformanceForClass[courseid][tdfid] = {count:0,totalTime:0,numCorrect:0}
    studentPerformanceForClass[courseid][tdfid].numCorrect += correct;
    studentPerformanceForClass[courseid][tdfid].count += correct + incorrect;
    studentPerformanceForClass[courseid][tdfid].totalTime += totalPrompt + totalStudy;

    if(!studentPerformanceForClassAndTdfIdMap[courseid]) studentPerformanceForClassAndTdfIdMap[courseid] = {};
    if(!studentPerformanceForClassAndTdfIdMap[courseid][tdfid]) studentPerformanceForClassAndTdfIdMap[courseid][tdfid] = {};

    if(!studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid]) studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid] = {count:0,totalTime:0,numCorrect:0,username:studentUsername};
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].numCorrect += correct;
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].count += correct + incorrect;
    studentPerformanceForClassAndTdfIdMap[courseid][tdfid][userid].totalTime = totalPrompt + totalStudy;
  }
  for(let coursetotals of studentPerformanceForClass){
    for(let tdftotal of coursetotals){
      tdftotal.percentCorrect = ((tdftotal.numCorrect / tdftotal.count)*100).toFixed(2) + "%",
      tdftotal.totalTimeDisplay = tdftotal.totalTime.toFixed(1)
    }
  }
  for(let coursetotals of studentPerformanceForClassAndTdfIdMap){
    for(let tdftotals of coursetotals){
      for( let studenttotal of tdftotals){
        studenttotal.percentCorrect = ((studenttotal.numCorrect / studenttotal.count)*100).toFixed(2) + "%",
        studenttotal.totalTimeDisplay = studenttotal.totalTime.toFixed(1)
      }
    }
  }
  return [studentPerformanceForClass,studentPerformanceForClassAndTdfIdMap];
}

async function getTdfIDsAndDisplaysAttemptedByUserId(userId,onlyWithLearningSessions=true){
  let query = "SELECT TDFId from globalExperimentState WHERE userId = $1";
  const tdfRet = await db.manyOrNone(query,userId);
  const allTdfs = await getAllTdfs();
  
  let tdfsAttempted = [];
  for(let obj of tdfRet){
    let tdfid = obj.tdfid;
    let tdfObject = allTdfs.findOne(x => x.tdfid == tdfid).content;
    if(!tdfObject.tdfs.tutor.unit) continue;//TODO: fix root/condition tdfs

    if(onlyWithLearningSessions){
      for(let unit of tdfObject.tdfs.tutor.unit){
        if(unit.learningsession){
          let displayName = tdfObject.tdfs.tutor.setspec[0].lessonname[0];
          tdfsAttempted.push({tdfid,displayName});
          break;
        } 
      }
    }else{
      let displayName = tdfObject.tdfs.tutor.setspec[0].lessonname[0];
      tdfsAttempted.push({tdfid,displayName});
    }
  }

  return tdfsAttempted;
}

function setLearningSessionItemsMulti(learningSessionItem, tdf) {
  let lastStim = getStimCountByStimuliSetId(tdf.stimuliSetId) - 1;
  for (let i = 0; i < lastStim - 1; i++) {
    learningSessionItem[i] = true;
  }
}

function setLearningSessionItems(learningSessionItem, tdf) {
  let units = tdf.tdfs.tutor.unit;
  if (!_.isEmpty(units)) {
    units.forEach(unit => {
      if (!!unit.learningsession) {
        let clusterList = getClusterListsFromUnit(unit);
        clusterList.forEach(clusterRange => {
          let [start, end] = clusterRange;
          for (let i = start; i <= end; i++) {
            learningSessionItem[i] = true;
          }
        });
      }
    });
  }
}

function getClusterListsFromUnit(unit) {
  let clustersToParse = unit.learningsession[0].clusterlist[0];
  return clustersToParse.split(' ').map(x => x.split('-').map(y => parseInt(y)));
}

function getStimJSON(fileName) {
  var future = new Future();
  Assets.getText(fileName, function (err, data) {
      if (err) {
          serverConsole("Error reading Stim JSON", err);
          throw err;
      }
      future.return(JSON.parse(data));
  });
  return future.wait();
}

function getTdfJSON(fileName) {
    var future = new Future();
    Assets.getText(fileName, function (err, data) {
        if (err) {
            serverConsole("Error reading Tdf JSON", err);
            throw err;
        }
        future.return(xml2js.parseStringSync(data));
    });
    return future.wait();
}

function defaultUserProfile() {
    return {
        have_aws_id: false,
        have_aws_secret: false,
        aws_id: '',
        aws_secret_key: '',
        use_sandbox: true
    };
}

function sendErrorReportSummaries(){
  serverConsole("sendErrorReportSummaries");
  var unsentErrorReports = ErrorReports.find({"emailed":false}).fetch();
  if(unsentErrorReports.length > 0){
    var sentErrorReports = new Set();
    for(var index in adminUsers){
      var admin = adminUsers[index];
      var from = ownerEmail;
      var subject = "Error Reports Summary - " + thisServerUrl;
      var text = "";
      for(var index2 in unsentErrorReports){
        var unsentErrorReport = unsentErrorReports[index2];
        var userWhoReportedError = Meteor.users.findOne({_id:unsentErrorReport.user});
        var userWhoReportedErrorUsername = userWhoReportedError ? userWhoReportedError.username : "UNKNOWN";
        text = text + "User: " + userWhoReportedErrorUsername + ", page: " + unsentErrorReport.page + ", time: " + unsentErrorReport.time + ", description: " + unsentErrorReport.description + ", userAgent: " + unsentErrorReport.userAgent + " \n";
        sentErrorReports.add(unsentErrorReport._id);
      }
      
      try {
        sendEmail(admin,from,subject,text);
      } catch (err) {
        serverConsole(err);
      }
    }
    sentErrorReports = Array.from(sentErrorReports);
    ErrorReports.update({_id:{$in:sentErrorReports}},{$set:{"emailed":true}},{multi:true});
    serverConsole("Sent " + sentErrorReports.length + " error reports summary");
  }else{
      serverConsole("no unsent error reports to send");
  }
}

// Save the given user profile via "upsert" logic
function userProfileSave(id, profile) {
    try {
        //Insure record matching ID is present while working around MongoDB 2.4 bug
        UserProfileData.update({_id: id}, {'$set': {'preUpdate': true}}, {upsert: true});
    }
    catch(e) {
        serverConsole("Ignoring user profile upsert ", e);
    }
    var numUpdated = UserProfileData.update({_id: id}, profile);
    if (numUpdated == 1) {
        return "Save succeeed";
    }

    // WHOOOPS! If we're still here something has gone horribly wrong
    if (numUpdated < 1) {
        throw new Meteor.Error("user-profile-save", "No records updated by save");
    }
    else {
        throw new Meteor.Error("user-profile-save", "More than one record updated?! " + _.display(numUpdate));
    }
}

// Return the user object matching the user. We use Meteor's provided search
// function to attempt to locate the user. We will attempt to find the user
// by username *and* by email.
function findUserByName(username) {
    if (!username || _.prop(username, "length") < 1) {
        return null;
    }

    var funcs = [Accounts.findUserByUsername, Accounts.findUserByEmail];

    for (var i = 0; i < funcs.length; ++i) {
        var user = funcs[i](username);
        if (!!user) {
            return user;
        }
    }

    return null;
}

// Create a formatted TDF record given the specified parameters
function createTdfRecord(fileName, tdfJson, ownerId, source) {
    return {
        'fileName': fileName,
        'tdfs': tdfJson,
        'owner': ownerId,
        'source': source
    };
}

// Create a formatted Stim record given the specified parameters
function createStimRecord(fileName, stimJson, ownerId, source) {
    return {
        'fileName': fileName,
        'stimuli': stimJson,
        'owner': ownerId,
        'source': source
    };
}

function genID(length){
  return Math.random().toString(36).substring(2, (2+length));
}

function sendEmail(to,from,subject,text){
  check([to,from,subject,text],[String]);
  Email.send({to,from,subject,text});
}

/**
 * Helper to determine if a TDF should be generated according
 * to the provided tags
 * @param {Object} json 
 */
function hasGeneratedTdfs(json) {
  return json.tutor.generatedtdfs && json.tutor.generatedtdfs.length;
}

function hasAssociatedStimFile(json) {
  return !!Stimuli.findOne({fileName: json.tutor.setspec[0].stimulusfile[0]});
}

const baseSyllableURL = 'http://localhost:4567/syllables/'
function getSyllablesForWord(word){
  let syllablesURL = baseSyllableURL + word;
  const result = HTTP.call('GET',syllablesURL);
  let syllableArray = result.content.replace(/\[|\]/g,'').split(',').map(x => x.trim());
  console.log("syllables for word, " + word + ": " + JSON.stringify(syllableArray) );
  return syllableArray;
}

const lengthOfNewGeneratedIDs = 6;

//Server-side startup logic

Meteor.startup(async function () {
    // Let anyone looking know what config is in effect
    serverConsole("Log Notice (from siteConfig):", getConfigProperty("logNotice"));

    // Force our OAuth settings to be current
    ServiceConfiguration.configurations.remove({"service": "google"});
    serverConsole("Removed Google service config - rewriting now");

    var google = getConfigProperty("google");
    ServiceConfiguration.configurations.insert({
        "service": "google",
        "clientId": _.prop(google, "clientId"),
        "secret": _.prop(google, "secret"),
    });
    serverConsole("Rewrote Google service config");

    // Figure out the "prime admin" (owner of repo TDF/stim files)
    // Note that we accept username or email and then find the ID
    var adminUser = findUserByName(getConfigProperty("owner"));

    // Used below for ownership
    var adminUserId = _.prop(adminUser, "_id") || "";
    // adminUser should be in an admin role
    if (adminUserId) {
        Roles.addUsersToRoles(adminUserId, "admin");
        serverConsole("Admin User Found ID:", adminUserId, "with obj:", _.pick(adminUser, "_id", "username", "email"));
    }
    else {
        serverConsole("Admin user ID could not be found. adminUser=", displayify(adminUser || "null"));
    }

    // Get user in roles and make sure they are added
    var roles = getConfigProperty("initRoles");
    var roleAdd = function(memberName, roleName) {
        var requested = _.prop(roles, memberName) || [];
        serverConsole("Role", roleName, "- found", _.prop(requested, "length"));

        _.each(requested, function(username) {
            var user = findUserByName(username);
            if (!user) {
                serverConsole("Warning: user", username, "role", roleName, "request, but user not found");
                return;
            }
            Roles.addUsersToRoles(user._id, roleName);
            serverConsole("Added user", username, "to role", roleName);
        });
    };

    roleAdd("admins", "admin");
    roleAdd("teachers", "teacher");

    //Rewrite TDF and Stimuli documents if we have a file
    //You'll note our lack of upsert in the loops below - we don't want _id to
    //change under MongoDB 2.4 (later versions of Mongo don't have the bug)

    var isXML = function (fn) {
        return fn.indexOf('.xml') >= 0;
    };
    var isJSON = function (fn) {
      return fn.indexOf('.json') >= 0;
    };
    if(!isProd){
        _.each(
          _.filter(fs.readdirSync('./assets/app/stims/'), isJSON),
          function (ele) {
              //serverConsole("Updating Stim in DB from ", ele);
              var json = getStimJSON('stims/' + ele);
              var rec = createStimRecord(ele, json, adminUserId, 'repo');

              var prev = Stimuli.findOne({'fileName': ele});
              if (prev) {
                  Stimuli.update({ _id: prev._id }, rec);
              }
              else {
                  Stimuli.insert(rec);
              }
          }
      );

      _.each(
          _.filter(fs.readdirSync('./assets/app/tdf/'), isXML),
          async function (ele) {
              //serverConsole("Updating TDF in DB from ", ele);
              var json = getTdfJSON('tdf/' + ele);

              var rec = createTdfRecord(ele, json, adminUserId, 'repo');

              const prev = await getTdfByFileName(ele);

              if (prev && !hasGeneratedTdfs(json)) {
                Tdfs.update({ _id: prev._id }, rec);
              } else if (hasGeneratedTdfs(json)) {
                let tdfGenerator = new DynamicTdfGenerator(json, ele, adminUserId, 
                  'repo');
                let generatedTdf = tdfGenerator.getGeneratedTdf();
                if (prev) {
                  try {
                    delete generatedTdf.createdAt;
                    Tdfs.update({_id: prev._id}, generatedTdf);
                  } catch (error) {
                    throw new Error('Error updating generated TDF: ', error);
                  }
                } else {
                  try {
                    Tdfs.insert(generatedTdf);
                  } catch (error) {
                    throw new Error('Error inserting generated TDF: ', error)
                  }
                }
                console.log(JSON.stringify(tdfGenerator.getGeneratedTdf()));
              } else {
                rec.createdAt = new Date();
                Tdfs.insert(rec);
              }
          }
      );
    }

    //Log this late so they're more prone to see it
    if (adminUserId) {
        serverConsole("Admin user is", _.pick(adminUser, "_id", "username", "email"));
    }else {
        serverConsole("ADMIN USER is MISSING: a restart might be required");
        serverConsole("Make sure you have a valid siteConfig");
        serverConsole("***IMPORTANT*** There will be no owner for system TDF's");
    }

    //Make sure we create a default user profile record when a new Google user
    //shows up. We still want the default hook's 'profile' behavior, AND we want
    // our custom user profile collection to have a default record
    Accounts.onCreateUser(function(options, user) {
        // Little display helper
        var dispUsr = function(u) {
            return _.pick(u, "_id", "username", "emails", "profile");
        };

        // Default profile save
        userProfileSave(user._id, defaultUserProfile());

        // Default hook's behavior
        if (options.profile) {
            user.profile = _.extend(user.profile || {}, options.profile);
        }

        if (_.prop(user.profile, "experiment")) {
            serverConsole("Experiment participant user created:", dispUsr(user));
            return user;
        }

        // Set username and an email address from the google service info
        // We use the lowercase email for both username and email
        var email = _.chain(user)
            .prop("services")
            .prop("google")
            .prop("email").trim()
            .value().toLowerCase();
        if (!email) {
            //throw new Meteor.Error("No email found for your Google account");
        }

        if(!!email){
          user.username = email;
          user.emails = [{
              "address": email,
              "verified": true
          }];
        }

        serverConsole("Creating new Google user:", dispUsr(user));

        // If the user is initRoles, go ahead and add them to the roles.
        // Unfortunately, the user hasn't been created... so we need to actually
        // cheat a little and manipulate the user record as if we were the roles
        // code. IMPORTANT: a new version of alanning:roles could break this.
        user.roles = [];
        var roles = getConfigProperty("initRoles");
        var addIfInit = function(initName, roleName) {
            var initList = _.prop(roles, initName) || [];
            if (_.contains(initList, user.username)) {
                serverConsole("Adding", user.username, "to", roleName);
                user.roles.push(roleName);
            }
        };

        addIfInit("admins", "admin");
        addIfInit("teachers", "teacher");

        return user;
    });

    //Set up our server-side methods
    Meteor.methods({
      getAllTdfs,getTdfById,getTdfByFileName,getTdfByExperimentTarget,getTdfByOwnerId,getTdfIDsAndDisplaysAttemptedByUserId,
      getLearningSessionItems,getAllCourses,getAllCourseSections,getAllCoursesForInstructor,getAllCourseAssignmentsForInstructor,
      getAllTeachers,getTdfNamesAssignedByInstructor,addCourse,editCourse,editCourseAssignments,addUserToTeachersClass,
      getTdfsAssignedToStudent,getStimDisplayTypeMap,getStimuliSetById,getStudentPerformanceByIdAndTDFId,getExperimentState,
      setExperimentState,getStudentPerformanceForClassAndTdfId,getUserIdforUsername,

      getAltServerUrl:function(){
        return altServerUrl;
      },

      getClozesFromText:function(inputText){
        let clozes = ClozeAPI.GetSelectCloze(null,null,null,true,null,inputText);
        return clozes;
      },

      getSimpleFeedbackForAnswer:function(userAnswer,correctAnswer){
        let result = DefinitionalFeedback.GenerateFeedback(userAnswer,correctAnswer);
        console.log("result: " + JSON.stringify(result));
        return result;
      },

      getDialogFeedbackForAnswer:function(state){
        let feedback = TutorialDialogue.GetDialogue(state);
        return feedback;
        // Display: text to show the student. Show this always.
        // Finished: if true, continue normal MoFaCTS operation; if false, get a student input
        // LastStudentAnswer: Mutate this with student input you just got
      },

      updateStimSyllableCache:function(stimFileName,answers){
        console.log("updateStimSyllableCache");
        let curStimSyllables = StimSyllables.findOne({filename:stimFileName});
        console.log("curStimSyllables: " + JSON.stringify(curStimSyllables));
        if(!curStimSyllables){
          let data = {};
          for(let answer of answers){
            let syllableArray;
            let syllableGenerationError;
            let safeAnswer = answer.replace(/\./g,'_')
            try{
              syllableArray = getSyllablesForWord(safeAnswer);
            }catch(e){
              console.log("error fetching syllables for " + answer + ": " + JSON.stringify(e));
              syllableArray = [answer];
              syllableGenerationError = e;
            }
            data[safeAnswer] = {
              count: syllableArray.length,
              syllables: syllableArray,
              error:syllableGenerationError
            }
          }
          StimSyllables.insert({filename:stimFileName,data:data});
          console.log("after updateStimSyllableCache");
        }
      },

      getClozeEditAuthors:function(){
        var authorIDs = {};
        ClozeEditHistory.find({}).forEach(function(entry){
          authorIDs[entry.user] = Meteor.users.findOne({_id:entry.user}).username;
        });
        return authorIDs;
      },

      sendErrorReportSummaries:function(){
        sendErrorReportSummaries();
      },
      sendEmail:function(to,from,subject,text){
        this.unblock();
        sendEmail(to,from,subject,text);
      },

      sendUserErrorReport:function(userID,description,curPage,sessionVars,userAgent,logs){
        var errorReport = {
          user:userID,
          description:description,
          page:curPage,
          time:new Date(),
          sessionVars:sessionVars,
          userAgent:userAgent,
          logs:logs,
          emailed:false
        };
        return ErrorReports.insert(errorReport);
      },

      logUserAgentAndLoginTime:function(userID,userAgent){
        var loginTime = new Date();
        return Meteor.users.update({_id:userID},{$set: {status : {lastLogin:loginTime,userAgent:userAgent}}});
      },

      insertClozeEditHistory:function(history){
        ClozeEditHistory.insert(history);
      },

      getClozesAndSentencesForText:function(rawText){
        console.log("rawText!!!: " + rawText);
        return clozeGeneration.GetClozeAPI(null,null,null,rawText);
      },

      insertStimTDFPair:function(newStimJSON,newTDFJSON){
        Stimuli.insert(newStimJSON);
        Tdfs.insert(newTDFJSON);
      },

      serverLog: function(data){
        if(Meteor.user()){
          logData = "User:" + Meteor.user()._id + ', log:' + data;
          console.log(logData);
        }
      },

      //Functionality to create a new user ID: return null on success. Return
      //an array of error messages on failure. If previous OK is true, then
      //we silently skip duplicate users (this is mainly for experimental
      //participants who are created on the fly)
      signUpUser: function (newUserName, newUserPassword, previousOK) {
          serverConsole("signUpUser", newUserName, "previousOK == ", previousOK);
          var checks = [];

          if (!newUserName) {
              checks.push("Blank user names aren't allowed");
          }
          else {
              var prevUser = Accounts.findUserByUsername(newUserName);
              if (!!prevUser) {
                  if (previousOK) {
                      // Older accounts from turk users are having problems with
                      // passwords - so when we detect them, we automatically
                      // change the password
                      Accounts.setPassword(prevUser._id, newUserPassword);
                      return prevUser._id; //User has already been created - nothing to do
                  }else{
                    checks.push("User is already in use");
                  }
              }
          }

          if (!newUserPassword || newUserPassword.length < 6) {
              checks.push("Passwords must be at least 6 characters long");
          }

          if (checks.length > 0) {
              throw new Error(checks[0]) //Nothing to create
          }

          // Now we can actually create the user
          // Note that on the server we just get back the ID and have nothing
          // to do right now. Also note that this method is called for creating
          // NON-google user accounts (which should generally just be experiment
          // participants) - so we make sure to set an initial profile
          var createdId = Accounts.createUser({
              'email': newUserName,
              'username': newUserName,
              'password': newUserPassword,
              'profile': {
                  'experiment': !!previousOK
              }
          });
          if (!createdId) {
              throw new Error("Unknown failure creating user account");
          }

          //Now we need to create a default user profile record
          userProfileSave(createdId, defaultUserProfile());

          //Remember we return a LIST of errors, so this is success
          return createdId;
      },

      //We provide a separate server method for user profile info - this is
      //mainly since we don't want some of this data just flowing around
      //between client and server
      saveUserProfileData: async function(profileData) {
        serverConsole('saveUserProfileData', displayify(profileData));

        var saveResult, result, errmsg, acctBal;
        try {
          data = _.extend(defaultUserProfile(), profileData);

          //Check length BEFORE any kind of encryption
          data.have_aws_id = data.aws_id.length > 0;
          data.have_aws_secret = data.aws_secret_key.length > 0;

          data.aws_id = encryptUserData(data.aws_id);
          data.aws_secret_key = encryptUserData(data.aws_secret_key);

          saveResult = userProfileSave(Meteor.userId(), data);

          //We test by reading the profile back and checking their
          //account balance
          var res = await turk.getAccountBalance(
            UserProfileData.findOne({_id: Meteor.user()._id})
          );

          if (!res) {
            throw "There was an error reading your account balance";
          }

          result = true;
          acctBal = res.AvailableBalance;
          errmsg = "";
          return {
            'result':result,
            'saveResult':saveResult,
            'acctBal':acctBal,
            'error':errmsg
          }
        }
        catch(e) {
          result = false;
          console.log(e)
          errmsg = e;
        }
      },

      getUserSpeechAPIKey: function(){
        var speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
        if(!!speechAPIKey){
          return decryptUserData(speechAPIKey['key']);
        }else{
          return null;
        }
      },

      isUserSpeechAPIKeySetup: function(){
        var speechAPIKey = GoogleSpeechAPIKeys.findOne({_id: Meteor.userId()});
        return !!speechAPIKey;
      },

      saveUserSpeechAPIKey: function(key) {
        key = encryptUserData(key);
        serverConsole("key:" + key);
        var result = true;
        var error = "";
        var userID = Meteor.userId();
        try {
            //Insure record matching ID is present while working around MongoDB 2.4 bug
            GoogleSpeechAPIKeys.update({_id: userID}, {'$set': {'preUpdate': true}}, {upsert: true});
        }
        catch(e) {
            serverConsole("Ignoring user speech api key upsert ", e);
        }
        var numUpdated = GoogleSpeechAPIKeys.update({_id: userID}, {key:key});

        // WHOOOPS! If we're still here something has gone horribly wrong
        if (numUpdated < 1) {
            result = false;
            error = "No records updated by save";
        }
        else if (numUpdated > 1) {
            result = false;
            error = "More than one record updated?! " + _.display(numUpdate);
        }

        return{
          'result': result,
          'error': error
        }
      },

      deleteUserSpeechAPIKey: function(){
        var userID = Meteor.userId();
        GoogleSpeechAPIKeys.remove(userID);
      },

      // ONLY FOR ADMINS: for the given targetUserId, perform roleAction (add
      // or remove) vs roleName
      userAdminRoleChange: function(targetUserId, roleAction, roleName) {
          serverConsole("userAdminRoleChange", targetUserId, roleAction, roleName);
          var usr = Meteor.user();
          if (!Roles.userIsInRole(usr, ["admin"])) {
              throw "You are not authorized to do that";
          }

          targetUserId = _.trim(targetUserId);
          roleAction = _.trim(roleAction).toLowerCase();
          roleName = _.trim(roleName);

          if (targetUserId.length < 1) {
              throw "Invalid: blank user ID not allowed";
          }
          if (!_.contains(["add", "remove"], roleAction)) {
              throw "Invalid: unknown requested action";
          }
          if (!_.contains(["admin", "teacher"], roleName)) {
              throw "Invalid: unknown requested role";
          }

          var targetUser = Meteor.users.findOne({_id: targetUserId});
          if (!targetUser) {
              throw "Invalid: could not find that user";
          }

          var targetUsername = _.prop(targetUser, "username");

          if (roleAction === "add") {
              Roles.addUsersToRoles(targetUserId, [roleName]);
          }
          else if (roleAction === "remove") {
              Roles.removeUsersFromRoles(targetUserId, [roleName]);
          }
          else {
              throw "Serious logic error: please report this";
          }

          return {
              'RESULT': 'SUCCESS',
              'targetUserId': targetUserId,
              'targetUsername': targetUsername,
              'roleAction': roleAction,
              'roleName': roleName
          };
      },

      saveUsersFile: function(filename,filecontents){
        serverConsole("saveUsersFile: " + filename);
        var allErrors = [];
        var rows = Papa.parse(filecontents).data;
        rows = rows.slice(1);
        for(var index in rows){
          var row = rows[index];
          var username = row[0];
          var password = row[1];
          serverConsole("username: " + username + ", password: " + password);
          Meteor.call('signUpUser',username,password,true,function(error,result){
            if(!!error){
              allErrors.push({username:error});
            }
            if(!!result){
              allErrors.push({username:result});
            }
          });
        }
        serverConsole("allErrors: " + JSON.stringify(allErrors));
        return allErrors;
      },

      //Allow file uploaded with name and contents. The type of file must be
      //specified - current allowed types are: 'stimuli', 'tdf'
      saveContentFile: function(type, filename, filecontents) {
          serverConsole('saveContentFile', type, filename);
          var results = {
              'result': null,
              'errmsg': 'No action taken?',
              'action': 'None'
          };

          //try {
              if (!type)         throw "Type required for File Save";
              if (!filename)     throw "Filename required for File Save";
              if (!filecontents) throw "File Contents required for File Save";

              //We need a valid use that is either admin or teacher
              var ownerId = Meteor.user()._id;
              if (!ownerId) {
                  throw "No user logged in - no file upload allowed";
              }

              if (!Roles.userIsInRole(Meteor.user(), ["admin", "teacher"])) {
                  throw "You are not authorized to upload files";
              }

              var rec, prev, collection;

              if (type == "tdf") {
                  //Parse the XML contents to make sure we can acutally handle the file
                  var jsonContents = xml2js.parseStringSync(filecontents);

                  //Make sure the TDF looks valid-ish
                  var tutor = _.chain(jsonContents).prop("tutor").value();

                  var lessonName = _.chain(tutor)
                      .prop("setspec").first()
                      .prop("lessonname").first().trim().value();
                  if (lessonName.length < 1) {
                      throw "TDF has no lessonname - it cannot be valid";
                  }

                  //Note that we don't check for units since a root TDF may
                  //not have any units

                  let json = {
                    tutor: tutor,
                  }
                  if (hasGeneratedTdfs(json)) {
                    if (!hasAssociatedStimFile(json)) {
                      results.result = false;
                      results.errmsg = "Please upload stimulus file before uploading a TDF"

                      return results;
                    } else {
                      let tdfGenerator = new DynamicTdfGenerator(json, filename, ownerId, 'upload');
                      let generatedTdf = tdfGenerator.getGeneratedTdf();
                      rec = generatedTdf;
                    }             
                  } else {
                    //Set up for TDF save
                    rec = createTdfRecord(filename, jsonContents, ownerId, 'upload');
                  }
                  
                  collection = Tdfs;
              }
              else if (type === "stim") {
                  let jsonContents = JSON.parse(filecontents);
                  //Make sure the stim looks valid-ish
                  var clusterCount = _.chain(jsonContents)
                      .prop("setspec")
                      .prop("clusters").prop("length").value();
                  if (clusterCount < 1) {
                      throw "Stimulus has no clusters - it cannot be valid";
                  }

                  //Set up for stim save
                  rec = createStimRecord(filename, jsonContents, ownerId, 'upload');
                  collection = Stimuli;
              }
              else {
                  throw "Unknown file type not allowed: " + type;
              }

              //If we're here we should have enough to handle the file
              prev = collection.findOne({'fileName': filename});
              if (prev) {
                  if (prev.owner !== ownerId) {
                      throw "You may not overwrite a file you don't own";
                  }
                  results.action = "overwrite previous file";
                  collection.update({ _id: prev._id }, rec);
              }
              else {
                  results.action = "save new file";
                  collection.insert(rec);
              }

              results.result = true;
              results.errmsg = "";
          // }
          // catch(e) {
          //     results.result = false;
          //     results.errmsg = e;
          // }

          return results;
      },

      updatePerformanceData: function(type,codeLocation,userId){
        let timestamp = new Date();
        let record = { userId, timestamp, codeLocation };
        switch(type){
          case "login":
            LoginTimes.insert(record);
          break;
          case "utlQuery":
            UtlQueryTimes.insert(record);
          break;
        }
      },

      isSystemDown: function(){
        let curConfig = DynamicConfig.findOne({});
        return curConfig.isSystemDown;
      },

      isCurrentServerLoadTooHigh: function(){
        let last50Logins = LoginTimes.find({},{sort:{$natural:-1},limit:50});
        let last50UtlQueries = UtlQueryTimes.find({},{sort:{$natural:-1},limit:50}).fetch();
        let curConfig = DynamicConfig.findOne({});
        let { loginsWithinAHalfHourLimit,utlQueriesWithinFifteenMinLimit } = curConfig.serverLoadConstants;//10,8

        let loginsWithinAHalfHour = new Set();
        let utlQueriesWithinFifteenMin = [];
        let now = new Date();
        let thirtyMinAgo = new Date(now - (30*60*1000)); // Down from an hour to 30 min
        let fifteenMinAgo = new Date(now - (15*60*1000)); // Up from 5 min to 15 min

        for(var loginData of last50Logins){
          if(loginData.timestamp > thirtyMinAgo){
            loginsWithinAHalfHour.add(loginData.userId);
          }
        }

        utlQueriesWithinFifteenMin = last50UtlQueries.filter(x => x.timestamp > fifteenMinAgo);
        let currentServerLoadIsTooHigh = (loginsWithinAHalfHour.size > loginsWithinAHalfHourLimit || utlQueriesWithinFifteenMin.length > utlQueriesWithinFifteenMinLimit);

        serverConsole("isCurrentServerLoadTooHigh:" + currentServerLoadIsTooHigh + ", loginsWithinAHalfHour:" + loginsWithinAHalfHour.size + "/" + loginsWithinAHalfHourLimit + ", utlQueriesWithinFifteenMin:" + utlQueriesWithinFifteenMin.length + "/" + utlQueriesWithinFifteenMinLimit);

        return currentServerLoadIsTooHigh;
      },

      //Let client code send console output up to server
      debugLog: function (logtxt) {
          var usr = Meteor.user();
          if (!usr) {
              usr = "[No Current User]";
          }
          else {
              usr = !!usr.username ? usr.username : usr._id;
              usr = "[USER:" + usr + "]";
          }

          serverConsole(usr + " " + logtxt);
      },

      toggleTdfPresence: (tdfIds, mode) => {
        let disable = mode === 'disable' ? true : false;
        tdfIds.forEach(uid => {
          Tdfs.update({_id: uid}, { $set: { disabled: disable } });
        });
      },

      getTdfOwnersMap: ownerIds => {
        let ownerMap = {};
        ownerIds.forEach(id => {
          let foundUser = Meteor.users.findOne({_id: id});
          if(typeof(foundUser) != "undefined"){
            ownerMap[id] = foundUser.username;
          }
        });
        return ownerMap;
      }
    });

  //Create any helpful indexes for queries we run
  ScheduledTurkMessages._ensureIndex({ "sent": 1, "scheduled": 1 });

  //Start up synched cron background jobs
  SyncedCron.start();

  //Now check for messages to send every 5 minutes
  SyncedCron.add({
      name: 'Period Email Sent Check',
      schedule: function(parser) { return parser.text('every 5 minutes'); },
      job: function() { return sendScheduledTurkMessages(); }
  });

  SyncedCron.add({
    name: 'Send Error Report Summaries',
    schedule: function(parser) { return parser.text('at 3:00 pm');},
    job: function() { return sendErrorReportSummaries(); }
  })
});

Router.route("clozeEditHistory",{
  name: "server.clozeData",
  where: "server",
  path: "/clozeEditHistory/:userID",
  action: function () {
      var userID = this.params.userID;
      var response = this.response;

      if (!userID) {
          response.writeHead(404);
          response.end("No user id specified");
          return;
      }

      var filename = userID + "-clozeEditHistory.json";

      response.writeHead(200, {
          "Content-Type": "application/json",
          "Content-Disposition": "attachment; filename=" + filename
      });

      var recCount = 0;
      ClozeEditHistory.find({"user":userID}).forEach(function(record){
        recCount += 1;
        response.write(JSON.stringify(record));
        response.write("\r\n");
      });
      response.end("");

      serverConsole("Sent all  data for", userID, "as file", filename, "with record-count:", recCount);
  }
});

// Serves data file containing all TDF data for single teacher
Router.route("data-by-teacher", {
  name: "server.teacherData",
  where: "server",
  path: "/data-by-teacher/:uid/:format",
  action: async function() {
    var uid = this.params.uid;
    var fmt = this.params.format;
    var response = this.response;

    if (!uid) {
      response.writeHead(404);
      response.end("No user ID specified");
      return;
    }

    if (fmt !== "datashop") {
      response.writeHead(404);
      response.end("Unknown format specified: only datashop currently supported");
      return;
    }

    let tdfNames = getTdfNamesAssignedByInstructor(uid);

    if (!tdfNames.length > 0) {
      response.writeHead(404);
      response.end("No tdfs found for any classes");
      return;
    }

    var user = Meteor.users.findOne({'_id': uid});
    var userName = user.username;
    userName = userName.replace('/[/\\?%*:|"<>\s]/g', '_');

    var fileName = 'mofacts_' + userName + '_all_tdf_data.txt';

    response.writeHead(200, {
      "Content-Type": "text/tab-separated-values",
      "Content-Disposition": "attachment; filename=" + fileName
    });

    const recCount = await createExperimentExport(tdfNames, fmt, function(record) {
      response.write(record);
      response.write('\r\n');
    });

    tdfNames.forEach(function(tdf) {
      serverConsole("Sent all  data for", tdf, "as file", fileName, "with record-count:", recCount);
    });

    response.end("");
  }
});

// Serves data file containing all TDF data for all classes for a teacher
Router.route("data-by-class", {
  name: "server.classData",
  where: "server",
  path: "/data-by-class/:classid/:format",
  action: async function() {
    var classId = this.params.classid;
    var fmt = this.params.format;
    var response = this.response;

    if (!classId) {
      response.writeHead(404);
      response.end("No class ID specified");
      return;
    }

    if (fmt !== "datashop") {
      response.writeHead(404);
      response.end("Unknown format specified: only datashop currently supported");
      return;
    }

    const foundClass = await getCourseById(classId);
  
    if (!foundClass) {
      response.writeHead(404);
      response.end("No classes found for the specified class ID");
      return;
    }

    const tdfFileNames = await getTdfAssignmentsByCourseIdMap(classId);

    if (!tdfFileNames || tdfFileNames.length == 0) {
      response.writeHead(404);
      response.end("No tdfs found for any classes");
      return;
    }

    let className = foundClass.coursename.replace('/[/\\?%*:|"<>\s]/g', '_');
    let fileName = 'mofacts_' + className + '_all_class_data.txt';

    response.writeHead(200, {
      "Content-Type": "text/tab-separated-values",
      "Content-Disposition": "attachment; filename=" + fileName
    });

    const recCount = await createExperimentExport(tdfFileNames, fmt, function(record) {
      response.write(record);
      response.write('\r\n');
    });

    tdfFileNames.forEach(function(tdf) {
      serverConsole("Sent all  data for", tdf, "as file", fileName, "with record-count:", recCount);
    });

    response.end("");
  }
});

//We use a special server-side route for our experimental data download
Router.route("experiment-data", {
    name: "server.data",
    where: "server",
    path: "/experiment-data/:expKey/:format",
    action: async function () {
        var exp = this.params.expKey;
        var fmt = this.params.format;
        var response = this.response;

        if (!exp) {
            response.writeHead(404);
            response.end("No experiment specified");
            return;
        }

        if (fmt !== "datashop") {
            response.writeHead(404);
            response.end("Unknown format specified: only datashop currently supported");
            return;
        }

        let filename = fmt + exp + "-data.txt";

        response.writeHead(200, {
            "Content-Type": "text/tab-separated-values",
            "Content-Disposition": "attachment; filename=" + filename
        });

        const recCount = await createExperimentExport(exp, fmt, function(record) {
            response.write(record);
            response.write('\r\n');
        });
        response.end("");

        serverConsole("Sent all  data for", exp, "as file", filename, "with record-count:", recCount);
    }
});
