if (!Accounts.saml) {
    Accounts.saml = {};
}

var Fiber = Npm.require('fibers');
//var connect = Npm.require('connect');
var bodyParser = Npm.require('body-parser')
RoutePolicy.declare('/sw-adfs/', 'network');

function updateProfile(profile, newValues) {
    var keys = Object.keys(newValues);
    var result = profile;

    keys.forEach(function(key,index) {
        if (newValues[key]) {
            result[key] = newValues[key];
        }
        
    })
    return result;
}

function blankPassword(userName) {
    return (userName + "BlankPassword").toUpperCase();
}

Accounts.registerLoginHandler(function(loginRequest) {
    if (!loginRequest.saml || !loginRequest.credentialToken) {
        console.log("not saml login request");
        return undefined;
    }
    serverConsole("samlLoginHandler, request:",loginRequest);
    var loginResult = Accounts.saml.retrieveCredential(loginRequest.credentialToken);
    serverConsole("samlLoginHandler, result:" + JSON.stringify(loginResult));
    try{
        if (loginResult && loginResult.profile) {
            serverConsole("samlLoginHandler, profile: " + JSON.stringify(loginResult.profile));
            var localProfileMatchAttribute = Meteor.settings.saml[0].localProfileMatchAttribute.replace(/\./g,'_');
            var localFindStructure;
            var nameIDFormat;
            // Default nameIDFormat is emailAddress
            if (!(Meteor.settings.saml[0].identifierFormat)) {
                nameIDFormat = "urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified";
            } else {
                nameIDFormat = Meteor.settings.saml[0].identifierFormat;
            }

            if (nameIDFormat == "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" ) {
                // If nameID Format is emailAdress, we should not force 'email' as localProfileMatchAttribute
                localProfileMatchAttribute = "email";
                localFindStructure = "emails.address";
                profileOrEmail = "email";
                profileOrEmailValue = loginResult.profile.nameID;
            } else{ 
                // any other nameID format
                // Check if Meteor.settings.saml[0].localProfileMatchAttribute has value
                // These values will be stored in profile substructure. They're NOT security relevant because profile isn't a safe place
                if (Meteor.settings.saml[0].localProfileMatchAttribute){
                profileOrEmail = "profile";
                profileOrEmailValue = loginResult.profile[localProfileMatchAttribute]
                localFindStructure = 'profile.' + localProfileMatchAttribute;
                }
            }
            serverConsole("Looking for user with " + localFindStructure + "=" + loginResult.profile[localProfileMatchAttribute]);
            var user = Meteor.users.findOne({
                //profile[Meteor.settings.saml[0].localProfileMatchAttribute]: loginResult.profile.nameID
                [localFindStructure]: profileOrEmailValue
            });

            if (!user) {
                serverConsole("no existing user found");
                if (Meteor.settings.saml[0].dynamicProfile) {
                    var newUser = {
                        password: blankPassword(profileOrEmailValue),
                        username: profileOrEmailValue,
                        [profileOrEmail]:  {
                            [localProfileMatchAttribute]: profileOrEmailValue
                        }
                    }
                    // console.log("User not found. Will dynamically create one with '" + Meteor.settings.saml[0].localProfileMatchAttribute + "' = " + loginResult.profile[localProfileMatchAttribute]);
                    // console.log("Identity handle: " + profileOrEmail + " || username = " + profileOrEmailValue);
                    // console.log("Create user: " + JSON.stringify(newUser));

                    Accounts.createUser(newUser);

                    // console.log("#################");
                    // console.log("Trying to find user");

                    user = Meteor.users.findOne({
                        "username": profileOrEmailValue
                    });

                    // update user profile w attrs from SAML Attr Satement
                    //console.log("Profile for attributes: " + JSON.stringify(loginResult.profile));
                    serverConsole("samlLoginHandler, Created User: " + JSON.stringify(user));

                    var attributeNames = Meteor.settings.saml[0].attributesSAML;
                    var meteorProfile = {};
                    if (attributeNames) {
                        attributeNames.forEach(function(attribute) {
                            meteorProfile[attribute] = loginResult.profile[attribute];
                        });
                    }
                    serverConsole("samlLoginHandler, Profile for Meteor: " + JSON.stringify(meteorProfile));
                    Meteor.users.update(user, {
                        $set: {
                            "profile": updateProfile(user.profile, meteorProfile)
                        }
                    });
                    // console.log("Created new user");
                } else {
                    throw new Error("Could not find an existing user with supplied attribute  '" + Meteor.settings.saml[0].localProfileMatchAttribute + "' and value:" + loginResult.profile[Meteor.settings.saml[0].localProfileMatchAttribute]);
                }
            } else {
                //console.log("Meteor User Found. Will try to update profile with values from SAML Response.");
                var attributeNames = Meteor.settings.saml[0].attributesSAML;
                var meteorProfile = {};
                if (attributeNames) {
                    attributeNames.forEach(function(attribute) {
                        meteorProfile[attribute] = loginResult.profile[attribute];
                    });
                }
                var newProfile = updateProfile(user.profile, meteorProfile);
                serverConsole("samlLoginHandler, New Profile: " + JSON.stringify(newProfile));
                Meteor.users.update({ _id: user._id },{
                    $set: {
                        'profile': newProfile
                    }
                });
            }

            var samlLogin = {
                provider: Accounts.saml.RelayState,
                idp: loginResult.profile.issuer,
                idpSession: loginResult.profile.sessionIndex,
                nameID: loginResult.profile.nameID,
                nameIDFormat: loginResult.profile.nameIDFormat,
                nameIDNameQualifier: loginResult.profile.nameIDNameQualifier
            };

            serverConsole("samlLoginHandler, samlLogin: " + JSON.stringify(samlLogin));

            Meteor.users.update({ _id: user._id },{
                $set: {
                    'services.saml': samlLogin
                }
            });

            if (loginResult.profile.uid) {
                Meteor.users.update({ _id: user._id },{
                    $set: {
                        'uid': loginResult.profile.uid
                    }
                });
            }

            var result = { userId: user._id };

            serverConsole("samlLoginHandler, result: " + JSON.stringify(result));

            //loginRequest.userCallback(null,result);

            return result;
        } else {
            serverConsole("samlLoginHandler, error in saml login handler");
            throw new Error("SAML Assertion did not contain a proper SAML subject value");
        }
    }catch(err){
        //loginRequest.userCallback(err,null);
        throw err;
    }
});

Accounts.saml._loginResultForCredentialToken = {};

// Accounts.saml.hasCredential = function(credentialToken) {
//     return _.has(Accounts.saml._loginResultForCredentialToken, credentialToken);
// }

Accounts.saml.retrieveCredential = function(credentialToken) {
    serverConsole("retrieveCredential: ",credentialToken,JSON.stringify(Accounts.saml._loginResultForCredentialToken));
    // The credentialToken in all these functions corresponds to SAMLs inResponseTo field and is mandatory to check.
    var result = JSON.parse(JSON.stringify((Accounts.saml._loginResultForCredentialToken[credentialToken] || {})));
    serverConsole("retrieveCredential, result: " + JSON.stringify(result));
    delete Accounts.saml._loginResultForCredentialToken[credentialToken];
    return result;
}

// Listen to incoming SAML http requests
WebApp.connectHandlers.use(bodyParser.urlencoded({
    extended: true
})).use(function(req, res, next) {
    // Need to create a Fiber since we're using synchronous http calls and nothing
    // else is wrapping this in a fiber automatically
    Fiber(function() {
        middleware(req, res, next);
    }).run();
});

middleware = function(req, res, next) {
    // Make sure to catch any exceptions because otherwise we'd crash
    // the runner
    //try {
        var samlObject = samlUrlToObject(req.url);
        if (!samlObject) {
            next();
            return;
        }

        if (!samlObject.actionName)
            throw new Error("Missing SAML action");

        if(!samlObject.serviceName){
            console.log("no service name, appending adfs");
            samlObject.serviceName = "adfs";
        }

        var service = _.find(Meteor.settings.saml, function(samlSetting) {
            return samlSetting.provider === samlObject.serviceName;
        });

        // Skip everything if there's no service set by the saml middleware
        if (!service){
            console.log("no service");
            throw new Error("Unexpected SAML service " + samlObject.serviceName);
        }

        serverConsole("saml_server,middleware","request, body: " + JSON.stringify(req.body) + ", query: " + JSON.stringify(req.query) + ", headers: " + JSON.stringify(req.headers));
        serverConsole("saml_server,middleware","request2, body: ",req.body,", query: ",req.query,", headers: ",req.headers);
            
        switch (samlObject.actionName) {
            case "metadata":
                serverConsole("saml_server,middleware","metadata");
                _saml = new SAML(service);
                service.callbackUrl = Meteor.absoluteUrl("sw-adfs/postResponse");
                res.writeHead(200);
                res.write(_saml.generateServiceProviderMetadata(service.callbackUrl));
                res.end();
                break;
            case "logout":
                // This is where we receive SAML LogoutResponse
                serverConsole("saml_server,middleware","Handling call to logout endpoint." + req.query.SAMLResponse);
                _saml = new SAML(service);
                _saml.validateLogoutResponse(req.query.SAMLResponse, function(err, result) {
                    if (!err) {
                        var logOutUser = function(inResponseTo) {
                            serverConsole("saml_server,middleware","Logging Out user via inResponseTo " + inResponseTo);
                            var loggedOutUser = Meteor.users.find({'services.saml.inResponseTo': inResponseTo}).fetch();
                            if (loggedOutUser.length == 1) {
                                var loggedOutUserID = loggedOutUser[0]._id
                                serverConsole("saml_server,middleware","Found user " + loggedOutUserID);

                                Meteor.users.update({ _id: loggedOutUserID }, {
                                    $set: {
                                        "services.resume.loginTokens": []
                                    }
                                });

                                Meteor.users.update({ _id: loggedOutUserID }, {
                                    $unset: {
                                        "services.saml": ""
                                    }
                                });
                            } else {
                                throw new Meteor.error("Found multiple users matching SAML inResponseTo fields");
                            }
                        }

                        Fiber(function() {
                            logOutUser(result);
                        }).run();

                        res.writeHead(302, {
                            'Location': req.query.RelayState
                        });
                        res.end();
                    } else {
                        serverConsole("error validating logout response: " + JSON.stringify(err));
                    }
                })
                break;
            case "sloRedirect":
                serverConsole("saml_server,middleware","sloRedirect: " + idpLogout);
                var idpLogout = req.query.redirect
                res.writeHead(302, {
                    // credentialToken here is the SAML LogOut Request that we'll send back to IDP
                    'Location': idpLogout
                });
                res.end();
                break;
            case "authorize":
                serverConsole("saml_server,middleware","authorize");
                service.callbackUrl = Meteor.absoluteUrl("sw-adfs/postResponse");
                service.credentialToken = samlObject.credentialToken;
                _saml = new SAML(service);
                _saml.getAuthorizeForm(req, function(err, data) {
                    if (err){
                        serverConsole("saml_server,middleware","error in authorize: " + JSON.stringify(err) + ", url: " + url);
                        throw new Error("Unable to generate authorize url");
                    }
                    serverConsole("saml_server,middleware","obj keys: " + Object.keys(req));
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=UTF-8'
                    });
                    res.write(data);
                    res.end();
                    serverConsole("saml_server,middleware","finished authorize successfully!");
                });
                break;
            //case "validate":
            case "postResponse":
                serverConsole("saml_server,middleware","postResponse");
                _saml = new SAML(service);
                Accounts.saml.RelayState = req.body.RelayState;
                _saml.validateResponse(req.body.SAMLResponse, req.body.RelayState, function(err, profile, loggedOut) {
                    if (err){
                        serverConsole("saml_server,middleware","error validating response: " + JSON.stringify(err));
                        throw new Error("Unable to validate response url: " + err);
                    }

                    var credentialToken = profile.inResponseToId || profile.InResponseTo || samlObject.credentialToken;
                    if (!credentialToken){
                        serverConsole("saml_server,middleware","no credential token");
                        closePopup(res,"Unable to determine credentialToken");
                        serverConsole("saml_server,middleware","Unable to determine credentialToken",profile,samlObject,Accounts.saml._loginResultForCredentialToken);
                        return;
                        //throw new Error("Unable to determine credentialToken");
                    }
                        
                    Accounts.saml._loginResultForCredentialToken[credentialToken] = {
                        profile: profile
                    };
                    serverConsole("saml_server,middleware","postResponse, validateResponse closePopup: " + JSON.stringify(Accounts.saml._loginResultForCredentialToken));
                    closePopup(res);
                });
                break;
            default:
                throw new Error("Unexpected SAML action " + samlObject.actionName);
        }
    // } catch (err) {
    //     console.log("middleware close popup");
    //     closePopup(res, err);
    // }
};

var samlUrlToObject = function(url) {
    if (!url)
        return null;

    var splitPath = url.split('/');
    serverConsole("samlUrlToObject: ",JSON.stringify(url),JSON.stringify(splitPath));

    // Any non-saml request will continue down the default middlewares.
    if (splitPath[1] !== 'sw-adfs')
        return null;

    var result = {
        actionName: splitPath[2],
        serviceName: splitPath[3],
        credentialToken: splitPath[4]
    };
    return result;
};

var closePopup = function(res, err) {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    var content =
        '<html><head><script>window.close()</script></head><body><H1>Verified</H1></body></html>';
    if (err){
        content = '<html><body><h2>Sorry, an error occured</h2><div>' + err + '</div><a onclick="window.close();">Close Window</a></body></html>';
        serverConsole("closePopupError:",JSON.stringify(err));
    }
    res.end(content, 'utf-8');
};
