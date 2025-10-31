/* Provide simple data protection routines. Currently this includes:
 *   - Encrypt/Decrypt sensitive data
 *   - Create an HMAC per Amazon standards
*/

import {getConfigProperty} from './siteConfig';

// Note that this is correct and crypto should *not* be listed in our deps.
// See https://github.com/meteor/meteor/issues/2050 for details
var crypto = Npm.require('crypto');

// Parameters
var algo = "aes256";

export function encryptUserData(data) {
    var key = getConfigProperty("protectionKey");
    var cipher = crypto.createCipher(algo, key);
    return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
};

export function decryptUserData(data) {
    var key = getConfigProperty("protectionKey");
    var decipher = crypto.createDecipher(algo, key);
    return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
};

export function createAwsHmac(secretKey, dataString) {
    return crypto
        .createHmac('sha1', secretKey)
        .update(dataString)
        .digest('base64');
};
