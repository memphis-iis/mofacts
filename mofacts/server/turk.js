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
        var req = _.extend({
            'AWSAccessKeyId': decryptUserData(userProfile.aws_id),
            'Service': 'AWSMechanicalTurkRequester',
            'ResponseGroup': 'Minimal',
            'Timestamp': new Date(Date.now()).toISOString(),
            'Operation': '',
            'Signature': '',
        }, requestParams);

        // Add HMAC signature for request from the fields as defined by AWS
        req.Signature = createAwsHmac(
            decryptUserData(userProfile.aws_secret_key),
            [req.Service, req.Operation, req.Timestamp].join('')
        );

        // TODO: remove this
        console.log("About to send AWS MechTurk request", url, req);

        // All done
        var response = Meteor.http.post(url, {
            'params': req
        });

        if (response.statusCode === 200) {
            //Error!
            console.log("Response failure:", response);
            throw "getReviewableHITs failed";
        }

        //Add parsed JSON to the response
        var json = null;
        try {
            xml2js.parseString(response.content, function (err, result) {
                json = result;
            });
        }
        catch(e) {
            console.log("JSON parse on returned contents failed", e);
        }
        response.json = json;

        return response;
    }

    turk = {
        //Required parameters: none
        getReviewableHITs: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'GetReviewableHITs'
            }, requestParams);

            var respose = createTurkRequest(userProfile, req);

            var result = Helpers.firstElement(response.json.GetReviewableHITsResult);
            var hitlist = [];
            result.HIT.forEach(function(val) {
                hitlist.push(Helpers.firstElement.HITId);
            });

            return hitlist;
        },

        //Required parameters: HITId
        getAssignmentsForHIT: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'GetAssignmentsForHIT',
                'HITId': ''
            }, requestParams);

            var respose = createTurkRequest(userProfile, req);

            var result = Helpers.firstElement(respose.json.GetAssignmentsForHITResult);
            return result.Assigment;
        },

        //Required parameters: AssignmentId
        //Optional parameters: RequesterFeedback
        approveAssignment: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'ApproveAssignment',
                'ResponseGroup': 'Request', // Ask for everything back
                'AssignmentId': '',
                'RequesterFeedback': ''
            }, requestParams);

            var respose = createTurkRequest(userProfile, req);

            var result = Helpers.firstElement(respose.json.ApproveAssignmentResult);
            var reqData = Helpers.firstElement(result.Request);
            var isValid = Helpers.firstElement(reqData.IsValid);
            if (Helpers.trim(isValue).toLowerCase() === "true") {
                throw "Assignment Approval failed";
            }
        },

        //Required parameters: Subject, MessageText, WorkerId
        notifyWorker: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'NotifyWorkers',
                'Subject': '',
                'MessageText': '',
                'WorkerId': ''
            }, requestParams);

            var respose = createTurkRequest(userProfile, req);

            var result = Helpers.firstElement(respose.json.NotifyWorkersResult);
            var reqData = Helpers.firstElement(result.Request);
            var isValid = Helpers.firstElement(reqData.IsValid);
            if (Helpers.trim(isValue).toLowerCase() === "true") {
                throw "Worker Notification failed";
            }
        },

        //Required parameters: WorkerId, AssignmentId, BonusAmount.Amount, Reason
        //If you specify a third parameter (amount), then BonusAmount.Amount
        //should not be specified
        grantBonus: function(userProfile, requestParams, amount) {
            amount = amount || 0.00;
            var req = _.extend({
                'Operation': 'GrantBonus',
                'WorkerId': '',
                'AssignmentId': '',
                'BonusAmount': {
                    'CurrencyCode': 'USD',
                    'Amount': amount
                },
                'Reason': ''
            }, requestParams);

            var respose = createTurkRequest(userProfile, req);

            var result = Helpers.firstElement(respose.json.GrantBonusResult);
            var reqData = Helpers.firstElement(result.Request);
            var isValid = Helpers.firstElement(reqData.IsValid);
            if (Helpers.trim(isValue).toLowerCase() === "true") {
                throw "Bonus Granting failed";
            }
        }
    };
})();
