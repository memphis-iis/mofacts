import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import { remove } from './lib/fable-library.2.10.2/String';


const expect = chai.expect;

//create a meteor user with role admin
const adminuser = {
  _id: Random.id(),
  emails : [],
  username: 'admin',
  password: 'admin',
  profile: {
    name: 'admin',
    role: 'admin',
    experiment: 'admin'
  },
  lockouts: {}
}

adminuser.emails.push({ address: 'test@gmail.com'});


//create a meteor user with no roles
const user = {
  _id: Random.id(),
  emails : [],
  username: 'test',
  password: 'test',
  profile: {
    name: 'test',
    role: 'test',
    experiment: 'test'
  },
  lockouts: {}
}

user.emails.push({ address: 'test2@gmail.com'});

//Setup mock Roles
const Roles = {}
Roles.roles = []
Roles.createRole = function(role) {
  Roles.roles.push(role);
}

Roles.addUsersToRoles = function(user, roles) {
  user.roles = roles;
}

Roles.isInRole = function(user, role) {
  return user.roles.includes(role);
}


//add the user to the admin and teacher roles
Roles.addUsersToRoles(adminuser, ['admin', 'teacher']);



//create a mock loginWithPassword function
Meteor.loginWithPassword = function(username, password) {
  if (username === adminuser.username && password === adminuser.password) {
    Meteor.userId = () => adminuser._id;
    Meteor.user = () => {return Meteor.users.findOne({_id: adminuser._id})};
  } else if (username === user.username && password === user.password) {
    Meteor.userId = () => user._id;
    Meteor.user = () => {return Meteor.users.findOne({_id: user._id})};
  }
}

//create a mock logout function
Meteor.logout = function() {
  Meteor.userId = () => null;
  Meteor.user = () => null;
}


Meteor.users = new Mongo.Collection('users-test');
//clear the collection
Meteor.users.remove({});
Meteor.users.insert(adminuser);
Meteor.users.insert(user);




//unit tests for the methods.js file

  //login as user
  Meteor.loginWithPassword(user.username, user.password);

  //getMeteorSettingsPublic
  describe('getMeteorSettingsPublic', async function() {
    it('should return the public settings', async function() {
      const settings = Meteor.settings.public;
      const result = await Meteor.call('getMeteorSettingsPublic');
      expect(result).to.deep.equal(settings);
    });
  });

  //saveAudioPromptMode
  describe('saveAudioPromptMode', async function() {
    it('should save the audio prompt mode', async function() {
      const mode = 'audio';
      await Meteor.call('saveAudioPromptMode', mode);
      const user = Meteor.users.findOne({_id: Meteor.userId()});
      expect(user.audioPromptMode).to.equal(mode);
    });
  });
  //saveAudioInputMode
  describe('saveAudioInputMode', async function() {
    it('should save the audio input mode', async function() {
      const mode = 'audio';
      await Meteor.call('saveAudioInputMode', mode);
      const user = Meteor.users.findOne({_id: Meteor.userId()});
      expect(user.audioInputMode).to.equal(mode);
    });
  });
  //updateExperimentState
  describe('ExperimentStates', async function() {
    var TDFId = "test";
    var experimentId;
    it('should create a new experiment state', async function() {
      const state = {
        currentTdfId: TDFId,
        userId: Meteor.userId(),
        experimentState: {
          "test": "test"
        }
      }
      await Meteor.call('updateExperimentState', state);
      const result = await Meteor.call('getExperimentState', Meteor.userId(), TDFId);
      expect(result.experimentState).to.deep.equal({ "test": "test" });
      experimentId = result._id;
    });
    it("should retrieve the experiment state", async function() {
      const result = await Meteor.call('getExperimentState', Meteor.userId(), TDFId);
      expect(result._id).to.equal(experimentId);
    });
    it('should update the experiment state', async function() {
      const state = {
        currentTdfId: TDFId,
        userId: Meteor.userId(),
        experimentState: {
          "test": "test2"
        }
      }
      await Meteor.call('updateExperimentState', state);
      const result = await Meteor.call('getExperimentState', Meteor.userId(), TDFId);
      expect(result.experimentState).to.deep.equal({ "test": "test2" });
    });
  });
  //secret keys
  describe('resetAllSecretKeys', async function() {
    it('should reset all secret keys', async function() {
      await Meteor.call('resetAllSecretKeys');
      Meteor.users.find().forEach(user => {
        //set the secret key to 1124
        Meteor.users.update({_id: user._id}, {$set: {secretKey: 1124}});
      });
      expect(user.secretKey).to.not.equal(1124);
    });
  });
  //getClozesFromText
  //getSimpleFeedbackForAnswer
  //initializeTutorialDialogue
  //getDialogFeedbackForAnswer
  //sendPasswordResetEmail
  //getAccessorsTDFID
  var tdfId = "1234";
  var userId = Meteor.userId();
  //assignAccessors
  describe('assignAccessors', async function() {
    it('should assign accessors to the TDF', async function() {
      tdfId = Tdfs.insert({accessors: []});
      await Meteor.call('assignAccessors', tdfId, [{"userId": userId}], []);
      const result = Tdfs.findOne({_id: tdfId});
      expect(result.accessors[0].userId).to.equal(userId);
    });
    it('should unassign accessors from the TDF', async function() {
      await Meteor.call('assignAccessors', tdfId, [], [userId]);
      const result = Tdfs.findOne({_id: tdfId});
      expect(result.accessors).to.not.include(userId);
    });
  });
  describe('getAccessorsTDFID', async function() {
    it('should return the accessors TDF ID', async function() {
      await Meteor.call('assignAccessors', tdfId, [userId], []);
      const result = await Meteor.call('getAccessorsTDFID', tdfId)[0];
      console.log("Expected: " + userId, "type: " + typeof userId);
      console.log("Result: " + result, "type: " + typeof result);
      expect(result).to.equal(Meteor.userId());
    });
  });
  //getAccessors
  describe('getAccessors', async function() {
    it('should return the accessors', async function() {
      Meteor.users.update({_id: Meteor.userId()}, {$set: {accessedTDFs: [tdfId]}});
      const result = await Meteor.call('getAccessors', tdfId);
      console.log("Expected: " + Meteor.userId(), "type: " + typeof Meteor.userId());
      console.log("Result: " + result, "type: " + typeof result);
      expect(result[0]._id).to.equal(Meteor.userId());
    });
  });
  //getAccessableTDFSForUser
  describe('getAccessableTDFSForUser', async function() {
    it('should return the accessable TDFs for the user', async function() {
      const result = await Meteor.call('getAccessableTDFSForUser', Meteor.userId());
      expect(result.TDFs[0]._id).to.equal(tdfId);
    });
  });
  //getAssignableTDFSForUser
  //transferDataOwnership
  describe('transferDataOwnership', async function() {
    it('should transfer data ownership', async function() {
      Meteor.call('transferDataOwnership', tdfId, Meteor.userId(), function(error, result) {
        expect(result).to.equal("success");
        const tdf = Tdfs.findOne({_id: tdfId});
        expect(tdf.owner).to.equal(Meteor.userId());
      });
  });
  //resetPasswordWithSecret
  describe('resetPasswordWithSecret', async function() {
    it('should reset the password with the secret key', async function() {
      Meteor.users.update({_id: Meteor.userId()}, {$set: {secret: 1124}});
      const res = await Meteor.call('resetPasswordWithSecret', Meteor.users.findOne({_id: Meteor.userId()}).emails[0].address, 1124, 'test');
      expect(res).to.equal(true);
    });
  });
  //logUserAgentAndLoginTime
  describe('logUserAgentAndLoginTime', async function() {
    it('should log the user agent and login time', async function() {
      await Meteor.call('logUserAgentAndLoginTime', Meteor.userId(), 'test');
      const result = Meteor.users.findOne({_id: Meteor.userId()});
      expect(result.userAgent).to.equal('test');
    });
  });
  //insertClozeEditHistory
  describe('insertClozeEditHistory', async function() {
    it('should insert the cloze edit history', async function() {
      const cloze = {
        _id: Random.id(),
        text: 'test',
        cloze: 'test',
        feedback: 'test',
        feedbackType: 'test',
        correctResponse: 'test',
        incorrectResponses: ['test']
      };
      await Meteor.call('insertClozeEditHistory', cloze);
      const result = ClozeEditHistory.findOne({_id: cloze._id});
      expect(result).to.deep.equal(cloze);
    });
  });

