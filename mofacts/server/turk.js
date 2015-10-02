/* turk.js
 *
 * Provide access to AWS Mechanical Turk services using AWS data that we track
 * per user. Some helpful documentation:
 *
 * Accessing the sandbox (vs prod)
 * https://workersandbox.mturk.com/?sandboxinfo=true
 *
 * Common parameters for Turk requests
 * http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_CommonParametersArticle.html
 *
 * Creating a request signature for Turk
 * http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMechanicalTurkRequester/MakingRequests_RequestAuthenticationArticle.html
 *
 * Creating an HMAC in Meteor
 * http://stackoverflow.com/questions/16860371/hmac-md5-with-meteor
 *
 * Approving an assignment in Turk
 * http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_ApproveAssignmentOperation.html
 * */

(function() {
    var TURK_URL = "http://mechanicalturk.amazonaws.com";
    var SANDBOX_URL = "http://mechanicalturk.sandbox.amazonaws.com";

    function validateField(fld, err) {
        if (!fld) {
            throw err;
        }
    }

    function createTurkRequest(userProfile, requestParams) {
        // Validate userProfile
        validateField(userProfile.have_aws_id, "AWS request user has no ID");
        validateField(userProfile.aws_id, "AWS request user ID is invalid");
        validateField(userProfile.have_aws_secret, "AWS request user has secret key");
        validateField(userProfile.aws_secret_key, "AWS request user secret key is invalid");

        // Base url from userProfile use_sandbox
        var url = userProfile.use_sandbox ? SANDBOX_URL : TURK_URL;

        // Actual request data from default + requestParams
        // TODO: Timestamp should be UTC and match the format of the XML Schema dateTime data type
        var defaultRequest = {
            'url': url,
            'AWSAccessKeyId': decryptUserData(userProfile.aws_id),
            'Service': '',
            'Operation': '',
            'Timestamp': Date.now(),
            'Signature': '',
        };
        var req = _.extend(defaultRequest, requestParams);

        // Add HMAC signature for request from the fields as defined by AWS
        req.Signature = createAwsHmac(
            decryptUserData(userProfile.aws_secret_key),
            [req.Service, req.Operation, req.Timestamp].join('')
        );

        // TODO: remove this
        console.log("About to send AWS MechTurk request:", req);

        // All done
        return req;
    }

    turk = {
        getReviewableHITs: function(userProfile, requestParams) {
            var baseParams = {
                'Operation': 'GetReviewableHITs'
            };

            var parms = _.extend(baseParams, requestParams);
            var request = createTurkRequest(userProfile, requestParams);

            var url = request.url;

            //TODO: var response = Meteor.http.post()
        }
    };

    // TODO: find HIT/assignment for Turk user
    // TODO: confirm assignment for Turk user
    // TODO: send message to Turk user
    // TODO: pay bonus for assignment to Turk user
})();
