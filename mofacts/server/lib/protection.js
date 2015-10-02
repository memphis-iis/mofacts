/* Provide simple data protection routines. Currently this includes:
 *   - Encrypt/Decrypt sensitive data
 *   - Create an HMAC per Amazon standards
*/

// Note that this is correct and crypto should *not* be listed in our deps.
// See https://github.com/meteor/meteor/issues/2050 for details
var crypto = Npm.require('crypto');

(function () { //Begin IIFE pattern

    // Parameters
    var algo = "aes256";
    var key = "KwMYUJRUsD1FWTlGzCCL1KfD8icjlnBKw5txaLw53IZgLCeGpHYZ3ucL9HYb" +
              "hamfsHXsVuptLWRtwFwJHU9I5ra5rgNMRmmdb7AUi3fE2VH5FbfwMvpDKVeP" +
              "qR274SS2BuZY4pghBMS6NtxOMMMeMaRBzHL52UEyUgqXs7nckWXlU2va3TjQ" +
              "Sl8U8kaSjI2Xz9ryVV3kjdfTrUPS9tFsrDBmJ10PEILxmkBc5RCoxfWRfKgc" +
              "t1VEXwuLlzTbI8zu3fsHDSEk3apYUyFrR0hLbn4CIkIkG3Ejg5ZBqkJmKgtD" +
              "U5OG4eLB1SHxx5C9pffpI2pi7p31of4nYGb5FnsxodGxrDlJI6j2ituf5iqD" +
              "5GkWDW7QZZi3feiuUebJhsDfmlvlr73hDahAeTUH4p4g22QybcP5G2mV9blm" +
              "Zf0k837VTvUMsoBCOpurjDFyX9fpL1FFMpWZ4eXveH7I5Ck2h0wtmgCVpCJX"
    ; //TODO: get a real key

    encryptUserData = function(data) {
        var cipher = crypto.createCipher(algo, key);
        return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
    };

    decryptUserData = function(data) {
        var decipher = crypto.createDecipher(algo, key);
        return decipher.update(data, 'hex', 'utf8') + decipher.final('utf8');
    };

    createAwsHmac = function(secretKey, dataString) {
        return crypto
            .createHmac('md5', secretKey)
            .update(dataString)
            .digest('base64');
    };
})(); //end IIFE
