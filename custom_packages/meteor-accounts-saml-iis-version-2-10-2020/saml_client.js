//import { Random } from 'meteor/random';

if (!Accounts.saml) {
    Accounts.saml = {};
}

Accounts.saml.initiateLogin = function (options, callback, dimensions) {
    // default dimensions that worked well for facebook and google
    try{
        var popup = openCenteredPopup(
            Meteor.absoluteUrl("sw-adfs/authorize/" + options.provider + "/" + options.credentialToken), (dimensions && dimensions.width) || 650, (dimensions && dimensions.height) || 500);

        var checkPopupOpen = setInterval(function () {
            try {
                // Fix for #328 - added a second test criteria (popup.closed === undefined)
                // to humour this Android quirk:
                // http://code.google.com/p/android/issues/detail?id=21061
                var popupClosed = popup.closed || popup.closed === undefined;
            } catch (e) {
                // For some unknown reason, IE9 (and others?) sometimes (when
                // the popup closes too quickly?) throws "SCRIPT16386: No such
                // interface supported" when trying to read 'popup.closed'. Try
                // again in 100ms.
                return;
            }

            if (popupClosed) {
                clearInterval(checkPopupOpen);
                callback(null,options.credentialToken);
            }
        }, 100);
    }catch(err){
        callback(err,null);
    }
};


var openCenteredPopup = function (url, width, height) {
    var newwindow;

    if (typeof cordova !== 'undefined' && typeof cordova.InAppBrowser !== 'undefined') {
        newwindow = cordova.InAppBrowser.open(url, '_blank');
        newwindow.closed = false;

        var intervalId = setInterval(function () {
            newwindow.executeScript({
                code: "document.getElementsByTagName('script')[0].textContent"
            }, function (data) {
                if (data && data.length > 0 && data[0] == 'window.close()') {
                    newwindow.close();
                    newwindow.closed = true;
                }
            });
        }, 100);

        newwindow.addEventListener('exit', function () {
            clearInterval(intervalId);
        });
    } else {
        var screenX = typeof window.screenX !== 'undefined' ? window.screenX : window.screenLeft;
        var screenY = typeof window.screenY !== 'undefined' ? window.screenY : window.screenTop;
        var outerWidth = typeof window.outerWidth !== 'undefined' ? window.outerWidth : document.body.clientWidth;
        var outerHeight = typeof window.outerHeight !== 'undefined' ? window.outerHeight : (document.body.clientHeight - 22);
        // XXX what is the 22?

        // Use `outerWidth - width` and `outerHeight - height` for help in
        // positioning the popup centered relative to the current window
        var left = screenX + (outerWidth - width) / 2;
        var top = screenY + (outerHeight - height) / 2;
        var features = ('width=' + width + ',height=' + height +
            ',left=' + left + ',top=' + top + ',scrollbars=yes');

        var newwindow = window.open(url, 'Login', features);
        if (newwindow.focus)
            newwindow.focus();
    }

    return newwindow;
};

clientGenerateUniqueID = function() {
    const chars = 'abcdef0123456789';
    let uniqueID = 'id-';
    for (let i = 0; i < 20; i++) {
        uniqueID += chars.substr(Math.floor((Math.random() * 15)), 1);
    }
    console.log("uniqueid: " + uniqueID);
    return uniqueID;
};

Meteor.loginWithSaml = function (options, callback) {
    options = options || {};
    var credentialToken = clientGenerateUniqueID();
    console.log("credentialToken:",credentialToken);
    options.credentialToken = credentialToken;

    Accounts.saml.initiateLogin(options, function (error, result) {
        console.log("initiatelogin callback, error: ",error,", result: ",result);
        Accounts.callLoginMethod({
            methodArguments: [{
                saml: true,
                credentialToken: credentialToken
            }],
            userCallback: callback
        });
    });
};
