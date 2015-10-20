/* turk.js - Provide access to AWS Mechanical Turk services using AWS data that
we track per user. See turk_methods.js for the implementation of the server
methods called by the client-side code
******************************************************************************
Some helpful documentation:

Accessing the sandbox (vs prod)
https://workersandbox.mturk.com/?sandboxinfo=true

Common parameters for Turk requests
http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_CommonParametersArticle.html

Creating a request signature for Turk
http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMechanicalTurkRequester/MakingRequests_RequestAuthenticationArticle.html

Creating an HMAC in Meteor
http://stackoverflow.com/questions/16860371/hmac-md5-with-meteor

Approving an assignment in Turk
http://docs.aws.amazon.com/AWSMechTurk/latest/AWSMturkAPI/ApiReference_ApproveAssignmentOperation.html

A Lesson in MTurk HIT Stats
-------------------------------
There are 3 main counts: Available, Pending, and Complete. When you create a
HIT, Available is equal to the number of assignment. When a worker accepts an
assignment, Available is decremented and Pending is incremented. When the
worker submits their code (for a survey link, say), Pending is decremented.
Then that assignment is approved or rejected, which increments Completed.
SO... When Available + Pending + Completed != Max Assignments we know that
there are assignments that need to be approved.
******************************************************************************
**/

(function() {
    var TURK_URL = "https://mechanicalturk.amazonaws.com";
    var SANDBOX_URL = "https://mechanicalturk.sandbox.amazonaws.com";

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
            'Timestamp': new Date(Date.now()).toISOString(),
            'Operation': '',
            'Signature': '',
        }, requestParams);

        //No spaces
        for (var key in req) {
            req[key] = Helpers.trim(req[key]);
        }

        // Add HMAC signature for request from the fields as defined by AWS
        var sigSrc = [req.Service, req.Operation, req.Timestamp].join('');
        req.Signature = createAwsHmac(decryptUserData(userProfile.aws_secret_key), sigSrc);

        console.log("About to send AWS MechTurk request", url, JSON.stringify(req, null, 2));

        // All done
        var response = HTTP.post(url, {
            'params': req
        });

        if (response.statusCode !== 200) {
            //Error!
            console.log("Response failure:", response);
            throw "Turk request '" + req.Operation + "' failed";
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
        //console.log("TURK response:", JSON.stringify(response.json, null, 2));
        return response;
    }

    //Make some of our code below much less verbose
    var fe = Helpers.firstElement;
    function fenum (src) {
        return Helpers.intVal(fe(src));
    }

    turk = {
        getAccountBalance: function(userProfile) {
            var req = {
                'Operation': 'GetAccountBalance'
            };

            var response = createTurkRequest(userProfile, req);
            var jsonResponse = response.json.GetAccountBalanceResponse;
            var result = fe(jsonResponse.GetAccountBalanceResult);

            var reqData = fe(result.Request);
            var isValid = fe(reqData.IsValid);
            if (Helpers.trim(isValid).toLowerCase() !== "true") {
                throw {
                    'errmsg': 'Could not get Account Balance',
                    'response': response
                };
            }

            var balData = fe(result.AvailableBalance);
            var fmtPrice = fe(balData.FormattedPrice);
            return fmtPrice;
        },

        //Required parameters: none
        getAvailableHITs: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'SearchHITs'
            }, requestParams);

            var response = createTurkRequest(userProfile, req);
            var jsonResponse = response.json.SearchHITsResponse;
            var result = fe(jsonResponse.SearchHITsResult);
            var hitCursor = result.HIT || [];

            var hitlist = [];
            hitCursor.forEach(function(val) {
                //Only report HITs with something that we can approve
                //See top of this module for the details
                var max = fenum(val.MaxAssignments);
                var pend = fenum(val.NumberOfAssignmentsPending);
                var avail = fenum(val.NumberOfAssignmentsAvailable);
                var complete = fenum(val.NumberOfAssignmentsCompleted);
                if (pend + avail + complete < max) {
                    hitlist.push(fe(val.HITId));
                }
            });

            return hitlist;
        },

        //Required parameters: HITId
        //Optional parameters: AssignmentStatus
        getAssignmentsForHIT: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'GetAssignmentsForHIT',
                'HITId': '',
                'AssignmentStatus': 'Submitted'
            }, requestParams);

            var response = createTurkRequest(userProfile, req);
            var jsonResp = response.json.GetAssignmentsForHITResponse;
            var result = fe(jsonResp.GetAssignmentsForHITResult);
            var assignCursor = result.Assignment || [];

            var assignlist = [];
            assignCursor.forEach(function(val) {
                assignlist.push({
                    "AssignmentId": fe(val.AssignmentId),
                    "WorkerId": fe(val.WorkerId),
                    "HITId": fe(val.HITId),
                    "AssignmentStatus": fe(val.AssignmentStatus),
                    "AutoApprovalTime": fe(val.AutoApprovalTime),
                    "AcceptTime": fe(val.AcceptTime),
                    "SubmitTime": fe(val.SubmitTime),
                    "Answer": fe(val.Answer),
                });
            });

            return result.Assignment;
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

            var response = createTurkRequest(userProfile, req);
            var jsonResponse = response.json.ApproveAssignmentResponse;
            var result = fe(jsonResponse.ApproveAssignmentResult);
            var reqData = fe(result.Request);
            var isValid = fe(reqData.IsValid);
            if (Helpers.trim(isValid).toLowerCase() !== "true") {
                throw {
                    'errmsg': 'Assignment Approval failed',
                    'response': response
                };
            }

            return response.json;
        },

        //Required parameters: AssignmentId
        //Pretty raw - currently only used for tracking/debugging on profile
        //page of our admins.
        getAssignment: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'GetAssignment',
                'AssignmentId': ''
            }, requestParams);

            var response = createTurkRequest(userProfile, req);
            return response.json;
        },

        //Required parameters: Subject, MessageText, WorkerId
        notifyWorker: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'NotifyWorkers',
                'Subject': '',
                'MessageText': '',
                'WorkerId': ''
            }, requestParams);

            var response = createTurkRequest(userProfile, req);

            var jsonResponse = response.json.NotifyWorkersResponse;
            var result = fe(jsonResponse.NotifyWorkersResult);
            var reqData = fe(result.Request);
            var isValid = fe(reqData.IsValid);
            if (Helpers.trim(isValid).toLowerCase() !== "true") {
                console.log("isValid=", isValid, "ServerRet:", JSON.stringify(response.json, null, 2));
                throw {
                    'errmsg': 'Worker Notification failed',
                    'response': response
                };
            }
            return jsonResponse;
        },

        //Required parameters: WorkerId, AssignmentId, Reason
        grantBonus: function(userProfile, amount, requestParams) {
            var req = _.extend({
                'Operation': 'GrantBonus',
                'WorkerId': '',
                'AssignmentId': '',
                'BonusAmount.1.Amount': amount,
                'BonusAmount.1.CurrencyCode': 'USD',
                'Reason': ''
            }, requestParams);

            var response = createTurkRequest(userProfile, req);
            var jsonResponse = response.json.GrantBonusResponse;
            var result = fe(jsonResponse.GrantBonusResult);
            var reqData = fe(result.Request);
            var isValid = fe(reqData.IsValid);

            if (Helpers.trim(isValid).toLowerCase() !== "true") {
                throw {
                    'errmsg': 'Bonus Granting failed',
                    'response': response
                };
            }

            return response.json;
        }
    };
})();
