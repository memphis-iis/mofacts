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

// Note that this is correct and crypto should *not* be listed in our deps.
// See https://github.com/meteor/meteor/issues/2050 for details
var crypto = Npm.require('crypto');

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
    var url;
    if (userProfile.use_sandbox) url = "http://mechanicalturk.sandbox.amazonaws.com";
    else                         url = "http://mechanicalturk.amazonaws.com";

    // Actual request data from default + requestParams
    // TODO: Timestamp should be UTC and match the format of the XML Schema dateTime data type
    // TODO: We're missing fields
    var defaultRequest = {
        'url': url,
        'AWSAccessKeyId': userProfile.aws_id,
        'Service': '',
        'Operation': '',
        'Timestamp': Date.now(),
        'Signature': '',
    };
    var requestData = _.extend(defaultRequest, requestParams);

    // Add HMAC signature for request from the fields as defined by AWS
    var signatureSource = [
        requestData.Service,
        requestData.Operation,
        requestData.Timestamp
    ].join('');

    requestData.Signature = crypto
        .createHmac('md5', userProfile.aws_secret_key)
        .update(signatureSource)
        .digest('base64');

    // All done
    return requestData;
}

// TODO: find HIT/assignment for Turk user
// TODO: confirm assignment for Turk user
// TODO: send message to Turk user
// TODO: pay bonus for assignment to Turk user
