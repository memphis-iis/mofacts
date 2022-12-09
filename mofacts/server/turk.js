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

import {serverConsole, decryptUserData, createAwsHmac} from './methods';


(function() {
  // var TURK_URL = "https://mechanicalturk.amazonaws.com";
  // var SANDBOX_URL = "https://mechanicalturk.sandbox.amazonaws.com";
  const AWS = Npm.require('aws-sdk');
  // var TURK_URL = "https://mturk-requester.us-east-1.amazonaws.com";
  // var SANDBOX_URL = "https://mturk-requester-sandbox.us-east-1.amazonaws.com";


  function validateField(fld, err) {
    if (!fld) {
      serverConsole('Validation err:');
      serverConsole(err);
      throw err;
    }
  }

  function validateUser(userProfile) {
    serverConsole(userProfile);
    validateField(userProfile.have_aws_id, 'AWS request user has no ID');
    validateField(userProfile.aws_id, 'AWS request user ID is invalid');
    validateField(userProfile.have_aws_secret, 'AWS request user has secret key');
    validateField(userProfile.aws_secret_key, 'AWS request user secret key is invalid');
  }

  function getClient(userProfile) {
    validateUser(userProfile);
    return new AWS.MTurk({
      accessKeyId: decryptUserData(userProfile.aws_id),
      secretAccessKey: decryptUserData(userProfile.aws_secret_key),
      region: 'us-east-1',
    });
  }

  function createTurkRequest(userProfile, requestParams) {
    // Validate userProfile
    validateField(userProfile.have_aws_id, 'AWS request user has no ID');
    validateField(userProfile.aws_id, 'AWS request user ID is invalid');
    validateField(userProfile.have_aws_secret, 'AWS request user has secret key');
    validateField(userProfile.aws_secret_key, 'AWS request user secret key is invalid');

    // Base url from userProfile use_sandbox
    const url = userProfile.use_sandbox ? SANDBOX_URL : TURK_URL;

    // Actual request data from default + requestParams
    const req = _.extend({
      'AWSAccessKeyId': decryptUserData(userProfile.aws_id),
      'Service': 'AWSMechanicalTurkRequester',
      'Timestamp': new Date(Date.now()).toISOString(),
      'Operation': '',
      'Signature': '',
    }, requestParams);

    // No spaces
    for (const key in req) {
      req[key] = _.trim(req[key]);
    }

    // Add HMAC signature for request from the fields as defined by AWS
    const sigSrc = [req.Service, req.Operation, req.Timestamp].join('');
    req.Signature = createAwsHmac(decryptUserData(userProfile.aws_secret_key), sigSrc);

    serverConsole('About to send AWS MechTurk request', url, JSON.stringify(req, null, 2));

    // All done
    const response = HTTP.post(url, {
      'params': req,
    });

    if (response.statusCode !== 200) {
      // Error!
      serverConsole('Response failure:', response);
      throw 'Turk request \'' + req.Operation + '\' failed';
    }

    // Add parsed JSON to the response
    try {
      response.json = xml2js.parseStringSync(response.content);
    } catch (e) {
      serverConsole('JSON parse on returned contents failed', e);
    }

    // serverConsole("TURK response:", JSON.stringify(response.json, null, 2));
    return response;
  }

  turk = {
    getAccountBalance: function(userProfile) {
      const req = {};
      validateUser(userProfile);

      const client = getClient(userProfile);

      const res = client.getAccountBalance(req).promise();

      return res;
    },

    // Required parameters: none
    // Optional parameters: SortProperty, SortDirection
    getAvailableHITs: function(userProfile) {
      const req = {
        'MaxResults': 99,
      };

      const client = getClient(userProfile);

      const hitlist = [];
      let rejected = 0;

      return client.listHITs(req).promise().then(function(data) {
        data.HITs.forEach(function(hit) {
          const max = hit.MaxAssignments;
          const pend = hit.NumberOfAssignmentsPending;
          const avail = hit.NumberOfAssignmentsAvailable;
          const complete = hit.NumberOfAssignmentsCompleted;

          if (max < 0 || pend < 0 || avail < 0 || complete < 0) {
            serverConsole('Something wrong with this HIT\'s stats - including for safety. hit was', hit);
            hitlist.push(hit.HITId);
          } else if (pend > 0 || avail > 0 || complete < max) {
            hitlist.push(hit.HITId);
          } else {
            rejected +=1;
          }
        });
        serverConsole('Searched HITs returning', hitlist.length, 'as possible, rejected', rejected);
        return hitlist;
      });
    },

    // Required parameters: HITId
    // Optional parameters: AssignmentStatus
    getAssignmentsForHIT: function(userProfile, hitId) {
      const req = {'HITId': hitId};

      const client = getClient(userProfile);

      return client.listAssignmentsForHIT(req).promise().then(function(res) {
        const assignlist = [];
        res.Assignments.forEach(function(assignment) {
          assignlist.push(assignment);
        });
        return assignlist;
      });
    },

    // Required parameters: AssignmentId
    // Optional parameters: RequesterFeedback
    approveAssignment: function(userProfile, requestParams) {
      const req = _.extend({
        'AssignmentId': '',
        'RequesterFeedback': '',
      }, requestParams);

      const client = getClient(userProfile);

      return client.approveAssignment(req).promise().then(function(res) {
        return {'Successful': 'true'}; // MTurk has stopped sending response details back for this operation, so we'll just put something here
      }, function(err) {
        throw {
          'errmsg': 'Assignment Approval failed',
          'response': err,
        };
      });
    },

    // Required parameters: AssignmentId
    // Pretty raw - currently only used for tracking/debugging on profile
    // page of our admins.
    getAssignment: function(userProfile, requestParams) {
      const req = _.extend({}, requestParams);

      const client = getClient(userProfile);

      return client.getAssignment(req).promise();
    },

    // Required parameters: Subject, MessageText, WorkerId
    notifyWorker: function(userProfile, requestParams) {
      const req = {
        'Subject': requestParams.Subject,
        'MessageText': requestParams.MessageText,
        'WorkerIds': [requestParams.WorkerId],
      };
      serverConsole('Sending request to Mechanical Turk', req);
      client = getClient(userProfile);

      return client.notifyWorkers(req).promise().then(function(res) {
        return {'Successful': 'true'}; // see approveAssignment
      }, function(err) {
        throw {
          'errmsg': 'Worker Notification failed',
          'response': err,
        };
      });
    },

    // Required parameters: WorkerId, AssignmentId, Reason
    grantBonus: function(userProfile, amount, requestParams) {
      const req = _.extend({
        'BonusAmount': amount,
        'WorkerId': '',
        'AssignmentId': '',
        'Reason': '',
      });

      const client = getClient(userProfile);

      client.sendBonus(req).promise().then(function(res) {
        return {'Successful': 'true'};
      }, function(err) {
        throw {
          'errmsg': 'Bonus Granting failed',
          'response': err,
        };
      });
    },


  };
})();
