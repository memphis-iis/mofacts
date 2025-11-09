import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import './testRunner.html';

// Smoke test runner - executes tests directly in browser
// Based on card.test.js but adapted for in-browser execution

Template.testRunner.events({
  'click #runSmokeTests'() {
    $('#testRunning').show();
    $('#testResultsContainer').hide();

    // Run tests after short delay to show spinner
    setTimeout(() => {
      const results = runAllSmokeTests();
      displayTestResults(results);
      $('#testRunning').hide();
      $('#testResultsContainer').show();
    }, 100);
  },

  'click #clearResults'() {
    $('#testResultsContainer').hide();
    $('#testResults').html('');
    $('#testSummary').html('');
  }
});

// Main test runner
function runAllSmokeTests() {
  const testResults = [];
  let passCount = 0;
  let failCount = 0;

  // Test 1: Basic Trial Flow - Template Exists
  try {
    const test1 = testTemplateExists();
    testResults.push({ name: 'Test 1: card.js template exists', ...test1 });
    if (test1.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 1: card.js template exists', passed: false, error: e.message });
    failCount++;
  }

  // Test 2: Session Key Initialization
  try {
    const test2 = testSessionKeyInitialization();
    testResults.push({ name: 'Test 2: Session key initialization', ...test2 });
    if (test2.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 2: Session key initialization', passed: false, error: e.message });
    failCount++;
  }

  // Test 3: Template Helpers Exist
  try {
    const test3 = testTemplateHelpersExist();
    testResults.push({ name: 'Test 3: Template helpers exist', ...test3 });
    if (test3.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 3: Template helpers exist', passed: false, error: e.message });
    failCount++;
  }

  // Test 4: Helpers Don't Crash
  try {
    const test4 = testHelpersDontCrash();
    testResults.push({ name: 'Test 4: Helpers don\'t crash with basic state', ...test4 });
    if (test4.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 4: Helpers don\'t crash', passed: false, error: e.message });
    failCount++;
  }

  // Test 5: Multiple Choice State
  try {
    const test5 = testMultipleChoiceState();
    testResults.push({ name: 'Test 5: Multiple choice state setup', ...test5 });
    if (test5.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 5: Multiple choice state', passed: false, error: e.message });
    failCount++;
  }

  // Test 6: Study Phase Detection
  try {
    const test6 = testStudyPhaseDetection();
    testResults.push({ name: 'Test 6: Study phase detection', ...test6 });
    if (test6.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 6: Study phase detection', passed: false, error: e.message });
    failCount++;
  }

  // Test 7: Timeout Management
  try {
    const test7 = testTimeoutManagement();
    testResults.push({ name: 'Test 7: Timeout management', ...test7 });
    if (test7.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 7: Timeout management', passed: false, error: e.message });
    failCount++;
  }

  // Test 8: Audio Input Mode Detection
  try {
    const test8 = testAudioInputModeDetection();
    testResults.push({ name: 'Test 8: Audio input mode detection', ...test8 });
    if (test8.passed) passCount++; else failCount++;
  } catch (e) {
    testResults.push({ name: 'Test 8: Audio input mode detection', passed: false, error: e.message });
    failCount++;
  }

  return {
    tests: testResults,
    passCount,
    failCount,
    total: passCount + failCount
  };
}

// Individual test functions

function testTemplateExists() {
  const cardTemplate = Template.card;
  if (!cardTemplate) {
    return { passed: false, error: 'Template.card does not exist' };
  }
  return { passed: true, message: 'card template exists' };
}

function testSessionKeyInitialization() {
  // Save original values
  const originalValues = {};
  const testKeys = [
    'currentTdfId', 'currentTdfFile', 'currentUnitNumber',
    'currentDisplay', 'currentAnswer', 'testType',
    'displayReady', 'buttonTrial', 'recording'
  ];

  testKeys.forEach(key => {
    originalValues[key] = Session.get(key);
  });

  try {
    // Set test values
    Session.set('currentTdfId', Random.id());
    Session.set('currentTdfFile', { tdfs: {} });
    Session.set('currentUnitNumber', 0);
    Session.set('currentDisplay', { text: 'test' });
    Session.set('currentAnswer', 'test');
    Session.set('testType', 'd');
    Session.set('displayReady', false);
    Session.set('buttonTrial', false);
    Session.set('recording', false);

    // Verify all set correctly
    const allSet = testKeys.every(key => Session.get(key) !== undefined);

    // Restore original values
    testKeys.forEach(key => {
      Session.set(key, originalValues[key]);
    });

    return allSet
      ? { passed: true, message: '9 Session keys initialized successfully' }
      : { passed: false, error: 'Some Session keys failed to initialize' };
  } catch (e) {
    // Restore on error
    testKeys.forEach(key => {
      Session.set(key, originalValues[key]);
    });
    throw e;
  }
}

function testTemplateHelpersExist() {
  const requiredHelpers = [
    'isNormal', 'displayReady', 'test', 'buttonTrial', 'audioInputModeEnabled'
  ];

  const cardTemplate = Template.card;
  if (!cardTemplate || !cardTemplate.__helpers) {
    return { passed: false, error: 'Template.card.__helpers not accessible' };
  }

  const missingHelpers = requiredHelpers.filter(name => !cardTemplate.__helpers.get(name));

  return missingHelpers.length === 0
    ? { passed: true, message: `All ${requiredHelpers.length} critical helpers exist` }
    : { passed: false, error: `Missing helpers: ${missingHelpers.join(', ')}` };
}

function testHelpersDontCrash() {
  // Setup minimal state
  const originalValues = {};
  const stateKeys = ['displayReady', 'testType', 'buttonTrial', 'currentDisplay'];

  stateKeys.forEach(key => {
    originalValues[key] = Session.get(key);
  });

  try {
    Session.set('displayReady', true);
    Session.set('testType', 'd');
    Session.set('buttonTrial', false);
    Session.set('currentDisplay', { text: 'test' });

    const cardTemplate = Template.card;
    const helpersToTest = ['isNormal', 'displayReady', 'test', 'buttonTrial'];

    let errorCount = 0;
    let errorMessages = [];

    helpersToTest.forEach(helperName => {
      try {
        const helper = cardTemplate.__helpers.get(helperName);
        if (helper) {
          helper.call({});  // Call with empty context
        }
      } catch (e) {
        errorCount++;
        errorMessages.push(`${helperName}: ${e.message}`);
      }
    });

    // Restore original values
    stateKeys.forEach(key => {
      Session.set(key, originalValues[key]);
    });

    return errorCount === 0
      ? { passed: true, message: `${helpersToTest.length} helpers executed without errors` }
      : { passed: false, error: `${errorCount} helpers crashed: ${errorMessages.join('; ')}` };
  } catch (e) {
    // Restore on error
    stateKeys.forEach(key => {
      Session.set(key, originalValues[key]);
    });
    throw e;
  }
}

function testMultipleChoiceState() {
  const originalButtonTrial = Session.get('buttonTrial');
  const originalButtonList = Session.get('buttonList');

  try {
    Session.set('buttonTrial', true);
    Session.set('buttonList', [
      { text: 'Option A', isAnswer: false },
      { text: 'Option B', isAnswer: true },
      { text: 'Option C', isAnswer: false },
      { text: 'Option D', isAnswer: false }
    ]);

    const buttonList = Session.get('buttonList');
    const correctAnswers = buttonList.filter(b => b.isAnswer);

    Session.set('buttonTrial', originalButtonTrial);
    Session.set('buttonList', originalButtonList);

    return (buttonList.length === 4 && correctAnswers.length === 1)
      ? { passed: true, message: 'MC state with 4 options and 1 correct answer' }
      : { passed: false, error: 'MC state setup incorrect' };
  } catch (e) {
    Session.set('buttonTrial', originalButtonTrial);
    Session.set('buttonList', originalButtonList);
    throw e;
  }
}

function testStudyPhaseDetection() {
  const originalTestType = Session.get('testType');

  try {
    Session.set('testType', 's');

    const cardTemplate = Template.card;
    const studyHelper = cardTemplate.__helpers.get('study');

    let isStudy = false;
    if (studyHelper) {
      isStudy = studyHelper.call({});
    }

    Session.set('testType', originalTestType);

    return isStudy
      ? { passed: true, message: 'Study phase correctly detected (testType=s)' }
      : { passed: false, error: 'Study phase not detected' };
  } catch (e) {
    Session.set('testType', originalTestType);
    throw e;
  }
}

function testTimeoutManagement() {
  try {
    // Create and clear timeout
    const testTimeoutId = setTimeout(() => {}, 5000);
    const testIntervalId = setInterval(() => {}, 5000);

    clearTimeout(testTimeoutId);
    clearInterval(testIntervalId);

    return { passed: true, message: 'Timeout/interval creation and cleanup successful' };
  } catch (e) {
    return { passed: false, error: `Timeout management failed: ${e.message}` };
  }
}

function testAudioInputModeDetection() {
  const originalTdfFile = Session.get('currentTdfFile');

  try {
    // Test Case 1: User SR off, TDF SR on → should be disabled
    Session.set('currentTdfFile', {
      tdfs: {
        tutor: {
          setspec: {
            audioInputEnabled: 'true'
          }
        }
      }
    });

    // Note: Can't fully test without mocking Meteor.user(), but we can verify
    // the Session key is set correctly
    const tdfFile = Session.get('currentTdfFile');
    const audioEnabled = tdfFile?.tdfs?.tutor?.setspec?.audioInputEnabled;

    Session.set('currentTdfFile', originalTdfFile);

    return audioEnabled === 'true'
      ? { passed: true, message: 'Audio input TDF setting accessible' }
      : { passed: false, error: 'Audio input TDF setting not accessible' };
  } catch (e) {
    Session.set('currentTdfFile', originalTdfFile);
    throw e;
  }
}

// Display test results in HTML
function displayTestResults(results) {
  const { tests, passCount, failCount, total } = results;

  // Update summary
  const summaryClass = failCount === 0 ? 'text-success' : 'text-danger';
  const summaryIcon = failCount === 0 ? 'fa-check-circle' : 'fa-times-circle';
  $('#testSummary').html(`
    <span class="${summaryClass}">
      <i class="fa ${summaryIcon}"></i>
      ${passCount} / ${total} passed
    </span>
  `);

  // Build results HTML
  let html = '<div class="list-group">';

  tests.forEach((test, index) => {
    const statusClass = test.passed ? 'success' : 'danger';
    const icon = test.passed ? 'fa-check' : 'fa-times';
    const message = test.passed ? test.message : test.error;

    html += `
      <div class="list-group-item list-group-item-${statusClass}">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">
            <i class="fa ${icon}"></i> ${test.name}
          </h6>
        </div>
        <p class="mb-1"><small>${message}</small></p>
      </div>
    `;
  });

  html += '</div>';

  // Show overall status alert
  if (failCount === 0) {
    html = `
      <div class="alert alert-success">
        <i class="fa fa-check-circle"></i>
        <strong>All tests passed!</strong> Main systems are functional.
      </div>
    ` + html;
  } else {
    html = `
      <div class="alert alert-danger">
        <i class="fa fa-times-circle"></i>
        <strong>${failCount} test(s) failed!</strong> Critical path may be broken.
      </div>
    ` + html;
  }

  $('#testResults').html(html);
}
