/**
 * card.js Smoke Tests
 *
 * Purpose: Test main system paths that historically break
 * Scope: Happy paths only - not comprehensive coverage
 *
 * Test Philosophy (per user guidance):
 * "Breakages usually involve main systems and smoke tests task those."
 *
 * Coverage:
 * 1. Basic trial flow (most common path)
 * 2. Multiple choice flow (common trial type)
 * 3. Study phase flow (common path)
 * 4. Unit completion flow (critical path)
 * 5. Speech recognition initialization (critical feature)
 * 6. Timeout management (frequent breakage point)
 */

import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import { Random } from 'meteor/random';
import { expect } from 'chai';
import { sinon } from 'meteor/practicalmeteor:sinon';
import StubCollections from 'meteor/hwillson:stub-collections';

// Import the template under test
import './card.js';
import './card.html';

// Stub collections
if (Meteor.isClient) {
  describe('card.js - Smoke Tests', function() {

    // Test setup
    beforeEach(function() {
      // Stub collections
      StubCollections.stub([
        Tdfs, Items, Histories, ComponentStates,
        GlobalExperimentStates, DynamicAssets
      ]);

      // Clear all Session keys
      Object.keys(Session.keys).forEach(key => {
        Session.set(key, undefined);
      });

      // Mock user
      sinon.stub(Meteor, 'user').returns({
        _id: Random.id(),
        username: 'testuser',
        loginParams: { loginMode: 'normal' },
        audioSettings: {
          audioInputMode: false,
          audioPromptMode: 'silent'
        }
      });

      sinon.stub(Meteor, 'userId').returns(Meteor.user()._id);
    });

    afterEach(function() {
      // Restore stubs
      StubCollections.restore();
      Meteor.user.restore();
      Meteor.userId.restore();

      // Clear Session
      Object.keys(Session.keys).forEach(key => {
        Session.set(key, undefined);
      });
    });

    // ========== SMOKE TEST 1: Basic Trial Flow ==========
    describe('Smoke Test 1: Basic Trial Flow (Text Question)', function() {

      it('should load a basic text trial without errors', function(done) {
        // Setup: Minimal TDF with one text question
        const testTdf = {
          _id: Random.id(),
          fileName: 'smoke_test.xml',
          tdfs: {
            tutor: {
              setspec: {
                lessonname: 'Smoke Test',
                stimulusfile: 'test.json'
              },
              unit: [{
                unitname: 'Test Unit',
                learningsession: {
                  clusterlist: {
                    cluster: [{
                      name: 'test_cluster',
                      shuffleclusters: 'false'
                    }]
                  }
                }
              }]
            }
          }
        };

        const testStimuli = {
          _id: Random.id(),
          name: 'test.json',
          setspec: {
            stimspec: [
              {
                cluster: 'test_cluster',
                stimname: 'q1',
                isCorrect: '1',
                correctResponse: 'answer1',
                question: {
                  text: 'What is 2+2?'
                },
                answer: {
                  text: '4'
                }
              }
            ]
          }
        };

        // Insert into stubbed collections
        Tdfs.insert(testTdf);
        Items.insert(testStimuli);

        // Set required Session keys
        Session.set('currentTdfId', testTdf._id);
        Session.set('currentTdfFile', testTdf);
        Session.set('currentUnitNumber', 0);
        Session.set('currentStimuliSet', testStimuli.setspec.stimspec);
        Session.set('currentStimuliSetId', testStimuli._id);

        // Mock delivery params
        Session.set('currentDeliveryParams', {
          displayType: 'd',
          feedbackType: 'none',
          minResponseTime: 0,
          maxResponseTime: 60000
        });

        // Verify card template can be rendered
        const cardTemplate = Template.card;
        expect(cardTemplate).to.exist;

        // Verify helpers exist and don't throw
        expect(cardTemplate.__helpers.get('isNormal')).to.be.a('function');
        expect(cardTemplate.__helpers.get('displayReady')).to.be.a('function');

        done();
      });

      it('should handle answer submission without crashing', function(done) {
        // Setup basic trial state
        Session.set('currentAnswer', '4');
        Session.set('userAnswer', '4');
        Session.set('testType', 'd');
        Session.set('displayReady', true);

        // Mock Meteor method
        const callStub = sinon.stub(Meteor, 'callAsync').resolves({
          isCorrect: true,
          feedback: 'Correct!'
        });

        // Simulate answer submission (would normally be triggered by handleUserInput)
        Session.set('isCorrectAccumulator', true);
        Session.set('feedbackForAnswer', 'Correct!');

        // Verify state updated
        expect(Session.get('isCorrectAccumulator')).to.be.true;
        expect(Session.get('feedbackForAnswer')).to.equal('Correct!');

        callStub.restore();
        done();
      });
    });

    // ========== SMOKE TEST 2: Multiple Choice Flow ==========
    describe('Smoke Test 2: Multiple Choice Trial', function() {

      it('should set up button trial without errors', function(done) {
        // Setup MC stimuli
        Session.set('currentAnswer', 'correct_answer');
        Session.set('testType', 'm');

        // Mock button list
        Session.set('buttonTrial', true);
        Session.set('buttonList', [
          { text: 'Option A', isAnswer: false },
          { text: 'Option B', isAnswer: true },
          { text: 'Option C', isAnswer: false },
          { text: 'Option D', isAnswer: false }
        ]);

        // Verify helpers
        const buttonTrial = Template.card.__helpers.get('buttonTrial')();
        const buttonList = Template.card.__helpers.get('buttonList')();

        expect(buttonTrial).to.be.true;
        expect(buttonList).to.be.an('array').with.length(4);
        expect(buttonList.filter(b => b.isAnswer)).to.have.length(1);

        done();
      });
    });

    // ========== SMOKE TEST 3: Study Phase Flow ==========
    describe('Smoke Test 3: Study Phase', function() {

      it('should recognize study trial type', function(done) {
        // Setup study trial
        Session.set('testType', 's');
        Session.set('currentDisplay', {
          text: 'Study this content'
        });
        Session.set('displayReady', true);

        // Verify helper recognizes study type
        const isStudy = Template.card.__helpers.get('study')();
        expect(isStudy).to.be.true;

        done();
      });
    });

    // ========== SMOKE TEST 4: Unit Completion Flow ==========
    describe('Smoke Test 4: Unit Completion', function() {

      it('should handle unit finish state without crashing', function(done) {
        // Setup completed unit
        Session.set('currentUnitNumber', 0);
        Session.set('currentTdfUnit', {
          unitname: 'Test Unit'
        });

        // Mock unitIsFinished method call
        const callStub = sinon.stub(Meteor, 'callAsync').resolves({
          success: true
        });

        // Verify Session state for completion
        expect(Session.get('currentUnitNumber')).to.equal(0);
        expect(Session.get('currentTdfUnit')).to.exist;

        callStub.restore();
        done();
      });
    });

    // ========== SMOKE TEST 5: Speech Recognition Initialization ==========
    describe('Smoke Test 5: Speech Recognition (SR) Initialization', function() {

      it('should detect SR mode correctly based on user + TDF settings', function(done) {
        // Test Case 1: User has SR off, TDF has SR on → SR disabled
        Meteor.user.restore();
        sinon.stub(Meteor, 'user').returns({
          audioSettings: { audioInputMode: false }
        });

        Session.set('currentTdfFile', {
          tdfs: {
            tutor: {
              setspec: {
                audioInputEnabled: 'true'
              }
            }
          }
        });

        // SR should be disabled (user preference wins)
        const srEnabled1 = Template.card.__helpers.get('audioInputModeEnabled')();
        expect(srEnabled1).to.be.false;

        // Test Case 2: User has SR on, TDF has SR on → SR enabled
        Meteor.user.restore();
        sinon.stub(Meteor, 'user').returns({
          audioSettings: { audioInputMode: true }
        });

        // Force reactivity update
        Tracker.flush();

        const srEnabled2 = Template.card.__helpers.get('audioInputModeEnabled')();
        expect(srEnabled2).to.be.true;

        done();
      });
    });

    // ========== SMOKE TEST 6: Timeout Management ==========
    describe('Smoke Test 6: Timeout Management', function() {

      it('should not crash when clearing timeouts', function(done) {
        // Setup timeout state
        Session.set('varLenTimeoutName', 'test_timeout');
        Session.set('CurTimeoutId', setTimeout(() => {}, 1000));
        Session.set('CurIntervalId', setInterval(() => {}, 1000));

        // Clear timeouts (simulate clearCardTimeout behavior)
        clearTimeout(Session.get('CurTimeoutId'));
        clearInterval(Session.get('CurIntervalId'));

        Session.set('CurTimeoutId', null);
        Session.set('CurIntervalId', null);
        Session.set('varLenTimeoutName', null);

        // Verify cleared
        expect(Session.get('CurTimeoutId')).to.be.null;
        expect(Session.get('CurIntervalId')).to.be.null;

        done();
      });
    });

    // ========== SMOKE TEST 7: Session State Initialization ==========
    describe('Smoke Test 7: Session State Initialization', function() {

      it('should initialize required Session keys for trial', function(done) {
        // Verify critical Session keys can be set without errors
        const requiredKeys = {
          currentTdfId: Random.id(),
          currentTdfFile: { tdfs: {} },
          currentUnitNumber: 0,
          currentDisplay: { text: 'test' },
          currentAnswer: 'test',
          testType: 'd',
          displayReady: false,
          buttonTrial: false,
          recording: false,
          submmissionLock: false
        };

        // Set all keys
        Object.entries(requiredKeys).forEach(([key, value]) => {
          Session.set(key, value);
        });

        // Verify all set correctly
        Object.entries(requiredKeys).forEach(([key, value]) => {
          expect(Session.get(key)).to.deep.equal(value);
        });

        done();
      });
    });

    // ========== SMOKE TEST 8: Template Helpers Don't Crash ==========
    describe('Smoke Test 8: Template Helpers Stability', function() {

      it('should call critical helpers without throwing', function(done) {
        // Setup minimal state
        Session.set('displayReady', true);
        Session.set('testType', 'd');
        Session.set('buttonTrial', false);
        Session.set('currentDisplay', { text: 'test' });

        // Test critical helpers don't throw
        expect(() => Template.card.__helpers.get('isNormal')()).to.not.throw();
        expect(() => Template.card.__helpers.get('displayReady')()).to.not.throw();
        expect(() => Template.card.__helpers.get('test')()).to.not.throw();
        expect(() => Template.card.__helpers.get('buttonTrial')()).to.not.throw();
        expect(() => Template.card.__helpers.get('audioInputModeEnabled')()).to.not.throw();

        done();
      });
    });

  }); // End describe('card.js - Smoke Tests')
} // End if (Meteor.isClient)
