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
there are assignments that need to be approved. HOWEVER!!! It appears that
this is not always reliable. We have instead adopted the far more conservative
criteria where we assume a HIT might have approvable assignments if ONE of the
following is true:
    - Available > 0
    - Pending > 0
    - Completed < Max
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
            req[key] = _.trim(req[key]);
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
        try {
            response.json = xml2js.parseStringSync(response.content);
        }
        catch(e) {
            console.log("JSON parse on returned contents failed", e);
        }

        //console.log("TURK response:", JSON.stringify(response.json, null, 2));
        return response;
    }

    turk = {
        getAccountBalance: function(userProfile) {
            var req = {
                'Operation': 'GetAccountBalance'
            };

            var response = createTurkRequest(userProfile, req);

            var result = _.chain(response.json)
                .prop("GetAccountBalanceResponse")
                .prop("GetAccountBalanceResult").first()
                .value();

            var isValid = _.chain(result)
                .prop("Request").first()
                .prop("IsValid").first().trim()
                .value().toLowerCase();

            if (isValid !== "true") {
                throw {
                    'errmsg': 'Could not get Account Balance',
                    'response': response
                };
            }

            return _.chain(result)
                .prop("AvailableBalance").first()
                .prop("FormattedPrice").first()
                .value();
        },

        //Required parameters: none
        //Optional parameters: SortProperty, SortDirection
        getAvailableHITs: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'SearchHITs',
                'SortProperty': 'CreationTime',
                'SortDirection': 'Descending',
                'PageSize': 99
            }, requestParams);

            var response = createTurkRequest(userProfile, req);

            var hitCursor = _.chain(response.json)
                .prop("SearchHITsResponse")
                .prop("SearchHITsResult").first()
                .prop("HIT")
                .value() || [];

            //Little helper for our loop - note default of -1 instead of 0
            var fenum = function(n) {
                return _.chain(n).first().floatval(-1).value();
            };

            var hitlist = [];
            var rejected = 0;
            hitCursor.forEach(function(val) {
                //Only report HITs with something that we can approve
                //See top of this module for the details
                var max = fenum(val.MaxAssignments);
                var pend = fenum(val.NumberOfAssignmentsPending);
                var avail = fenum(val.NumberOfAssignmentsAvailable);
                var complete = fenum(val.NumberOfAssignmentsCompleted);

                if (max < 0 || pend < 0 || avail < 0 || complete < 0) {
                    console.log("Something wrong with this HIT's stats - including for safety. val was", val);
                    hitlist.push(_.first(val.HITId));
                }
                else if (pend > 0 || avail > 0 || complete < max) {
                    hitlist.push(_.first(val.HITId));
                }
                else {
                    rejected += 1;
                }
            });

            console.log("Searched HITs returning", hitlist.length, "as possible, rejected", rejected);

            return hitlist;
        },

        //Required parameters: HITId
        //Optional parameters: AssignmentStatus
        getAssignmentsForHIT: function(userProfile, requestParams) {
            var req = _.extend({
                'Operation': 'GetAssignmentsForHIT',
                'HITId': '',
                'AssignmentStatus': 'Submitted',
                'PageSize': 99
            }, requestParams);

            var response = createTurkRequest(userProfile, req);

            var assignCursor = _.chain(response.json)
                .prop("GetAssignmentsForHITResponse")
                .prop("GetAssignmentsForHITResult").first()
                .prop("Assignment")
                .value() || [];

            var assignlist = [];
            assignCursor.forEach(function(val) {
                assignlist.push({
                    "AssignmentId": _.first(val.AssignmentId),
                    "WorkerId": _.first(val.WorkerId),
                    "HITId": _.first(val.HITId),
                    "AssignmentStatus": _.first(val.AssignmentStatus),
                    "AutoApprovalTime": _.first(val.AutoApprovalTime),
                    "AcceptTime": _.first(val.AcceptTime),
                    "SubmitTime": _.first(val.SubmitTime),
                    "Answer": _.first(val.Answer),
                });
            });

            return assignlist;
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

            var isValid = _.chain(response.json)
                .prop("ApproveAssignmentResponse")
                .prop("ApproveAssignmentResult").first()
                .prop("Request").first()
                .prop("IsValid").first().trim()
                .value().toLowerCase();

            if (isValid !== "true") {
                console.log("Failed to approve assignment", response.json);
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

            var isValid = _.chain(response.json)
                .prop("NotifyWorkersResponse")
                .prop("NotifyWorkersResult").first()
                .prop("Request").first()
                .prop("IsValid").first().trim()
                .value().toLowerCase();

            if (isValid !== "true") {
                console.log("notifyWorker isValid=", isValid, "ServerRet:", JSON.stringify(response.json, null, 2));
                throw {
                    'errmsg': 'Worker Notification failed',
                    'response': response
                };
            }

            return response.json;
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

            var isValid = _.chain(response.json)
                .prop("GrantBonusResponse")
                .prop("GrantBonusResult").first()
                .prop("Request").first()
                .prop("IsValid").first().trim()
                .value().toLowerCase();

            if (isValid !== "true") {
                throw {
                    'errmsg': 'Bonus Granting failed',
                    'response': response
                };
            }

            return response.json;
        }
    };
})();
