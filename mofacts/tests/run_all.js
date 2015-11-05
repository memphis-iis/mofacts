//Simple file that runs all our tests

require('./dinky_test.js');

suspend_reporting = true;  //No reporting until all suites are done

//Test suite collections we want to run
require('./AssessmentSessionTesting.js');
require('./shuffle_swap_testing.js');
require('./global_help_testing.js');

suspend_reporting = false;
test_report();
