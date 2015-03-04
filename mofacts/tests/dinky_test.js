//Silly little test framework

var suites = [];
function curr_suite() {
    return suites.length ? suites[suites.length-1] : "NO SUITE";
}

test_suite = function(suite_name, func) {
    try {
        suites.push(suite_name);
        func();
    }
    catch(e) {
        console.log("Test suite failure: ", e);
    }
    suites.pop();
};

unit_test = function(unit_name, func) {
    var logger = {
        print: function() {
            var output = [curr_suite(), unit_name, "=>"];
            for(var i = 0; i < arguments.length; ++i) {
                output.push(("" + arguments[i]).trim());
            }
            console.log(output.join(' '));
        }
    };

    try {
        func(logger);
    }
    catch(e) {
        logger.print("FAILURE", e.toString());
        return;
    }

    logger.print("ok");
};
