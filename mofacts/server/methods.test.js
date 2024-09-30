
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import {  methods } from './methods.js';
import { decryptData, encryptData } from './methods.js';
import { sinon } from 'meteor/practicalmeteor:sinon';
import StubCollections from 'meteor/hwillson:stub-collections';
import { Random } from 'meteor/random';
import "../common/Collections.js";
import {Factory} from 'meteor/dburles:factory';
import { expect } from 'chai';




//mock the mongo collections


StubCollections.stub(StimSyllables);
StubCollections.stub(Tdfs);
StubCollections.stub(Assignments);
StubCollections.stub(ComponentStates);
StubCollections.stub(Courses);
StubCollections.stub(GlobalExperimentStates);
StubCollections.stub(Histories);
StubCollections.stub(Items);
StubCollections.stub(Stims);
StubCollections.stub(Sections);
StubCollections.stub(SectionUserMap);
StubCollections.stub(UserTimesLog);
StubCollections.stub(UserMetrics);
StubCollections.stub(ElaboratedFeedbackCache);
StubCollections.stub(DynamicSettings);
StubCollections.stub(ScheduledTurkMessages);
StubCollections.stub(ClozeEditHistory);
StubCollections.stub(ErrorReports);
StubCollections.stub(LoginTimes);
StubCollections.stub(UtlQueryTimes);
StubCollections.stub(DynamicConfig);
StubCollections.stub(UserProfileData);
StubCollections.stub(ProbabilityEstimates);
StubCollections.stub(ScheduledTurkMessages);
StubCollections.stub(DynamicAssets);
StubCollections.stub(Tdfs);

//Meteor users stub
StubCollections.stub(Meteor.users);



//Hyjack the login user Meteor.loginWithPassword method, it will set Meteor.user() and Meteor.userId() to the test user
let testUser = {
    _id: Random.id(),
    email: 'test@test.com',
    password: Random.id()
};
let adminUser = {
    _id: Random.id(),
    email: 'admin@test.com',
    password: Random.id()
};

Meteor.loginWithPassword = function(email, password, callback) {
    if(email === testUser.email && password === testUser.password) {
        Meteor.user = sinon.stub().returns(testUser);
        Meteor.userId = sinon.stub().returns(testUser._id);
    }
    else if(email === adminUser.email && password === adminUser.password) {
        Meteor.user = sinon.stub().returns(adminUser);
        Meteor.userId = sinon.stub().returns(adminUser._id);
    }
    else {
        Meteor.user = null;
        Meteor.userId = null;
    }
}

Meteor.logout = function() {
    Meteor.user = null;
    Meteor.userId = null;
};

//Hyjack the Roles.userIsInRole method to return true if the user is admin, false otherwise
Roles.userIsInRole = sinon.stub();
Roles.userIsInRole.withArgs(testUser._id, sinon.match.any).returns(false);
Roles.userIsInRole.withArgs(adminUser._id, sinon.match.any).returns(true);


//Hyjack the EmailSend function to throw an error if no to, from, or subject or text is provided
Email.Send = function(options) {
    if(!options.to || !options.from || !options.subject || !options.text) {
        throw new Error("Email.Send was called without the required parameters");
    }
    return true;
}

//Startup related methods
describe('startup related methods', function() {
    it('should return a valid settings.json', function() {
        let settings = methods.getMeteorSettingsPublic();
        expect(settings).to.be.deep.equal(Meteor.settings.public);
    });
});

//we should do this to create a baselevel user to perform the tests
describe('user creation related methods', function() {
    it('should create a new user', function() {
        methods.signUpUser(testUser.email, testUser.password);
        methods.signUpUser(adminUser.email, adminUser.password);
        expect(Meteor.users.find().count()).to.equal(2);
        testUser._id = Meteor.users.findOne()._id;
    });
});


//User related methods that require a user to be logged in
describe('user related configuration methods', function() {
    beforeEach(() => {
        Meteor.loginWithPassword(testUser.email, testUser.password);
    });
    afterEach(() => {
        Meteor.logout();       
    });
    it('should set the audio prompt mode for the user', function() {
        methods.saveAudioPromptMode(true);
        expect(Meteor.users.findOne({_id: testUser._id}).audioPromptMode).to.equal(true);
    });
    it('should send password reset email', function() {
        expect(methods.sendPasswordResetEmail(testUser.email)).to.not.throw;
    });
    it('should compare the users reset password token', function() {
        let token = Random.id();
        Meteor.users.update({_id: testUser._id}, {$set: {secret: token}});
        testUser.secret = token;
        expect(methods.checkPasswordResetSecret(testUser.email, testUser.secret)).to.equal(true);
    });
    it('should populate SSO data for a user', function() {
        //mock up the service profile
        testUser.services 
        testUser.services = {
            google: {
                mail: testUser.email,
                refreshToken: Random.id()
            }
        }
        Meteor.users.update({_id: testUser._id}, {$set: {services: testUser.services}});
        expect(methods.populateSSOProfile(testUser._id)).to.equal("success: " + testUser.email);
    });

    //should be able to impersonate a user
    it('should clear login data', function() {
        //mock up the login data
        var loginParams = {
            entryPoint: Random.id(),
            curTeacher: Random.id(),
            curClass: Random.id(),
            loginMode: "test"
        }
        testUser.loginParams = loginParams;
        Meteor.users.update({_id: testUser._id}, {$set: {loginParams: loginParams}});
        methods.clearLoginData();
        expect(Meteor.users.findOne({_id: testUser._id}).loginParams.entryPoint).to.equal(null);
        expect(Meteor.users.findOne({_id: testUser._id}).loginParams.curTeacher).to.equal(null);
        expect(Meteor.users.findOne({_id: testUser._id}).loginParams.curClass).to.equal(null);
        expect(Meteor.users.findOne({_id: testUser._id}).loginParams.loginMode).to.equal(null);
    });
});

//Mechanical Turk Related methods
describe('mechanical turk related methods', function() {
    var turkId = Random.id();
    var expId = Random.id();
    console.log("Test Turk ID: " + turkId);
    console.log("Test Experiment ID: " + expId);
    beforeEach(() => {
        ScheduledTurkMessages.insert({workerUserId: turkId, experiment: expId});
        let lockout = {}
        lockout[expId] = {}
        lockout[expId].lockoutMinutes = 0;
        testUser.lockouts = lockout;
        Meteor.users.update({_id: testUser._id}, {$set: {lockouts: lockout}});
        Meteor.loginWithPassword(testUser.email, testUser.password);
    });
    afterEach(() => {
        Meteor.logout();       
    });
    it('should remove scheduled turk by id', function() {
        methods.removeTurkById(turkId, expId);
        console.log(ScheduledTurkMessages.find().fetch());
        expect(ScheduledTurkMessages.find({workerUserId: turkId}).count()).to.equal(0);
    });
});

//Experiment State related methods
describe('experiment state related methods', function() {
    var curExperimentState = {
        currentTdfId: Random.id()
    }
    var expId;
    beforeEach(() => {
        Meteor.loginWithPassword(testUser.email, testUser.password);
    });
    afterEach(() => {
        Meteor.logout();       
    });
    it('should set the experiment state', function() {
        methods.createExperimentState(curExperimentState);
        expId = GlobalExperimentStates.findOne();
        expect(GlobalExperimentStates.findOne().userId).to.equal(testUser._id);
    });
    it('should update the experiment state', function() {
        //modify the experiment state
        curExperimentState.TDFId = Random.id();
        console.log("Experiment State: " + GlobalExperimentStates.find().fetch());
        methods.updateExperimentState(curExperimentState, expId);
        expect(GlobalExperimentStates.findOne().experimentState.currentTdfId).to.equal(curExperimentState.currentTdfId);
    });
});

//Tdf Check functions
//load the packae
testPackage = Assets.getBinary('testPackage.zip');
describe('Content related methods', function() {
    beforeEach(() => {
        Meteor.loginWithPassword(adminUser.email, adminUser.password);
    });
    afterEach(() => {
        Meteor.logout();       
    });
    it('should upsert a Package', async function() {
        var fileObj = {
            name: "testPackage.zip",
            type: "application/zip",
            path: Assets.absoluteFilePath('testPackage.zip')
        }
        var zipLink = "http://dummylink.com";
        await Meteor.call('processPackageUpload', fileObj, Meteor.userId(), zipLink, false);
        expect(Tdfs.find().count()).to.equal(2);
    });
    //inject an API key into the TDF
    var TdfTTSAPIKey = "1241515124";
    var TdfAPIKey = "124124124";
    Meteor.settings.encryptionKey = Random.id();
    it('should return a decrypted TTS API key', async function() {
        var TdfId = Tdfs.findOne({packageFile: "testPackage.zip"})._id;
        var decryptedAPIKey = methods.getTdfTTSAPIKey(TdfId);
        expect(decryptedAPIKey).to.equal(TdfTTSAPIKey);
    });
    it('should return a decrypted Speech API key', async function() {
        var TdfId = Tdfs.findOne({packageFile: "testPackage.zip"})._id;
        var decryptedAPIKey = methods.getTdfSpeechAPIKey(TdfId);
        expect(decryptedAPIKey).to.equal(TdfAPIKey);
    });
    var tdfs = [];
    var tdfId = "";
    var testTdfInCollection = {};
    //check if tdfs getAllTdfs returns a list of tdfs
    it('should get all Tdfs', async function() {
        tdfs = await Meteor.call('getAllTdfs');
        console.log(tdfs);
        expect(tdfs).to.be.a('array');
        //should match Tdfs.find().fetch()
        expect(tdfs).to.deep.equal(Tdfs.find().fetch());
    });
    var testTdfOutsideCollection = {};
    //get the tdf by packageFile
    it('should get Tdf by packageFile', async function() {
        testTdfOutsideCollection = tdfs.find(tdf => tdf.packageFile === "testPackage.zip");
        console.log("Test TDF Outside Collection: " + testTdfOutsideCollection);
        expect(testTdfOutsideCollection).to.not.be.undefined;
    });
    //should assign accessors to a tdf
    it('should assign accessors to a Tdf', async function() {
        tdfId = testTdfOutsideCollection._id;
        var accessors = [Meteor.userId()];
        methods.assignAccessors(tdfId, accessors, []);
        expect(Tdfs.findOne({_id: tdfId}).accessors).to.contain(Meteor.userId());
    });
    //should get accessors by tdfid
    it('should get accessors by TdfId', async function() {
        tdfId = testTdfOutsideCollection._id;
        var accessors = methods.getAccessorsTDFID(tdfId);
        console.log("Accessors: " + accessors);
        expect(accessors).to.contain(Meteor.userId());
    });
    //should get get the accesible tdfs for a user
    it('should get assignable Tdfs', async function() {
        const assignableTDFs = methods.getAssignableTDFSForUser(Meteor.userId());
        var userId = Meteor.userId();
        expect(Tdfs.find({$or: [{ownerId: userId}, {'accessors.userId': userId}]}).fetch()).to.deep.equal(assignableTDFs);
    });
    //should revoke accessors from a tdf
    it('should revoke accessors from a Tdf', async function() {
        tdfId = testTdfOutsideCollection._id;
        var accessors = [Meteor.userId()];
        methods.assignAccessors(tdfId, [], accessors);
        tdfs = await Meteor.call('getAllTdfs');
        expect(tdfs.find(tdf => tdf._id === tdfId).accessors).to.not.contain(Meteor.userId());
    });
    //transfer ownership of a tdf
    it('should transfer ownership of a Tdf', async function() {
        tdfs = await Meteor.call('getAllTdfs');
        tdfId = tdfs.find(tdf => tdf.packageFile === "testPackage.zip")._id;
        var newOwner = Random.id();
        var res = methods.transferDataOwnership(tdfId, newOwner);
        expect(res).to.equal("success");
    });
});



//Admin functions
describe('admin related methods', function() {
    beforeEach(() => {
        Meteor.loginWithPassword(adminUser.email, adminUser.password);
    });
    afterEach(() => {
        Meteor.logout();       
    });
    it('should regenerate user secret keys', function() {
        Meteor.users.update({_id: testUser._id}, {$set: {secretKey: Random.id()}});
        methods.resetAllSecretKeys();
        expect(Meteor.users.findOne({_id: testUser._id}).secretKey).to.not.equal(testUser.secretKey);
    });
    it('should impersonate a user', function() {
        var newUser = methods.impersonate(testUser._id);
        expect(newUser._id).to.equal(testUser._id);
    });
});


