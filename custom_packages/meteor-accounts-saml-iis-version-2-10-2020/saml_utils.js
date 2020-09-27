/* globals SAML:true */
'use strict';

const SignedXml = Npm.require('xml-crypto').SignedXml;
const zlib = Npm.require('zlib');
const xml2js = Npm.require('xml2js');
const xmlCrypto = Npm.require('xml-crypto');
const crypto = Npm.require('crypto');
const xmldom = Npm.require('xmldom');
const querystring = Npm.require('querystring');
const xmlbuilder = Npm.require('xmlbuilder');
const array2string = Npm.require('arraybuffer-to-string');
const https = Npm.require('https');

serverConsole = function() {
    var disp = [(new Date()).toString()];
    for (var i = 0; i < arguments.length; ++i) {
        disp.push(arguments[i]);
    }
    console.log.apply(this, disp);
};

SAML = function(options) {
    this.options = this.initialize(options);
};

SAML.prototype.initialize = function(options) {
    console.log("SAML.initialize");
    if (!options) {
        options = {};
    }

    if (!options.protocol) {
        options.protocol = 'https://';
    }

    if (!options.path) {
        options.path = '/sw-adfs';
    }

    if (!options.issuer) {
        options.issuer = Meteor.settings.ROOT_URL; //'https://mofacts.optimallearning.org';
    }

    if (options.identifierFormat === undefined) {
        options.identifierFormat = 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress';
    }

    if (options.authnContext === undefined) {
        options.authnContext = 'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport';
    }

    options.signatureAlgorithm = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

    console.log("saml init options: " + JSON.stringify(options));

    return options;
};

SAML.prototype.generateUniqueID = function() {
    console.log("SAML.generateUniqueID");
    const chars = 'abcdef0123456789';
    let uniqueID = 'id-';
    for (let i = 0; i < 20; i++) {
        uniqueID += chars.substr(Math.floor((Math.random() * 15)), 1);
    }
    console.log("uniqueid: " + uniqueID);
    return uniqueID;
};

SAML.prototype.generateInstant = function() {
    console.log("SAML.generateInstant");
    return new Date().toISOString();
};

SAML.prototype.signRequest = function(xml) {
    console.log("SAML.signRequest");
    var queryfied = querystring.stringify(xml);
    console.log("signRequest: " + JSON.stringify(queryfied));
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(queryfied);
    console.log("signRequest: " + JSON.stringify(this.options.privateKey));
    var test = signer.sign(this.options.privateKey, 'base64');
    console.log("signed: " + JSON.stringify(test));
    return test;
};

SAML.prototype.genAuthorizeRequestJSON = function (req) {
    console.log("SAML.genAuthorizeRequestJSON");
    let id;
    if (this.options.credentialToken) {
        id = this.options.credentialToken;
    }else{
        id = `_${ this.generateUniqueID() }`;
    }
    const instant = this.generateInstant();
    
    var request = {
        'samlp:AuthnRequest': {
            '@xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
            '@ID': id,
            '@Version': '2.0',
            '@IssueInstant': instant,
            '@ProtocolBinding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            '@Destination': this.options.entryPoint,
            'saml:Issuer' : {
            '@xmlns:saml' : 'urn:oasis:names:tc:SAML:2.0:assertion',
            '#text': this.options.issuer
            }
        }
    };
  
    if (this.options.identifierFormat) {
        request['samlp:AuthnRequest']['samlp:NameIDPolicy'] = {
            '@xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
            '@Format': this.options.identifierFormat,
            '@AllowCreate': 'true'
        };
    }

    request['samlp:AuthnRequest']['samlp:RequestedAuthnContext'] = {
        '@xmlns:samlp': 'urn:oasis:names:tc:SAML:2.0:protocol',
        '@Comparison': 'exact',
        'saml:AuthnContextClassRef': [{
            '@xmlns:saml': 'urn:oasis:names:tc:SAML:2.0:assertion',
            '#text':'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport'
        }]
    };
    request['samlp:AuthnRequest']['@ProviderName'] = "Mofacts";

    //request['SigAlg'] = this.options.signatureAlgorithm;
  
    //var stringRequest = xmlbuilder.create(request).end();
    // if (this.options.privateCert) {
    //     stringRequest = this.signAuthnRequestPost(stringRequest);
    // }
   return request;
}

SAML.prototype.signAuthnRequestPost = function(samlMessage) {
    console.log("SAML.signAuthnRequestPost");
    const defaultTransforms = [ 'http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#' ];
    const xpath = '/*[local-name(.)="AuthnRequest" and namespace-uri(.)="urn:oasis:names:tc:SAML:2.0:protocol"]';
    const issuerXPath = '/*[local-name(.)="Issuer" and namespace-uri(.)="urn:oasis:names:tc:SAML:2.0:assertion"]';
    var sig = new SignedXml();
    sig.signatureAlgorithm = this.options.signatureAlgorithm;
    sig.addReference(xpath, defaultTransforms, 'http://www.w3.org/2001/04/xmlenc#sha256');
    sig.signingKey = this.options.privateKey;
    sig.computeSignature(samlMessage, { location: { reference: xpath + issuerXPath, action: 'after' }});
    return sig.getSignedXml();
}

SAML.prototype.generateAuthorizeRequest = function(req) {
    console.log("SAML.generateAuthorizeRequest");

    var reqJSON = this.genAuthorizeRequestJSON(req);
    console.log("getAuthorizeRequestJSON: " + JSON.stringify(reqJSON));

    var reqXML = xmlbuilder.create(reqJSON).end();
    console.log("getAuthorizeRequestXML: " + reqXML);

    signedRequest = this.signAuthnRequestPost(reqXML);
    console.log("signedRequest: " + JSON.stringify(signedRequest));

    return signedRequest;
};

SAML.prototype.generateLogoutRequest = function(options) {
    console.log("SAML.generateLogoutRequest");
    // options should be of the form
    // nameID: <nameId as submitted during SAML SSO>
    // nameIDFormat: <nameId Format as submitted during SAML SSO>
    // nameIDNameQualifier: <nameId NameQualifier as submitted during SAML SSO>
    // sessionIndex: sessionIndex
    // --- NO SAMLsettings: <Meteor.setting.saml  entry for the provider you want to SLO from

    const id = `_${ this.generateUniqueID() }`;
    const instant = this.generateInstant();

    let request = `${ '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ' +
		'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="' }${ id }" Version="2.0" IssueInstant="${ instant
		}" Destination="${ this.options.idpSLORedirectURL }">` +
        `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${ this.options.issuer }</saml:Issuer>` +
        `<saml:NameID Format="${ this.options.identifierFormat }">${ options.nameID }</saml:NameID>` +
        '</samlp:LogoutRequest>';

    request = `${ '<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"  ' +
		'ID="' }${ id }" ` +
        'Version="2.0" ' +
        `IssueInstant="${ instant }" ` +
        `Destination="${ this.options.idpSLORedirectURL }" ` +
        '>' +
        `<saml:Issuer xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">${ this.options.issuer }</saml:Issuer>` +
        '<saml:NameID xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ';
    if (options.nameIDNameQualifier) {
        request += `NameQualifier="${ options.nameIDNameQualifier }" `;
    }
    if (options.nameIDFormat) {
        request += `Format="${ options.nameIDFormat }" `;
    }
    else {
        request += `Format="${ this.options.identifierFormat }" `;
    }
    request += `>${ options.nameID }</saml:NameID>` +
        `<samlp:SessionIndex xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">${ options.sessionIndex }</samlp:SessionIndex>` +
        '</samlp:LogoutRequest>';
    if (Meteor.settings.debug) {
        console.log('------- SAML Logout request -----------');
        console.log(request);
    }
    return {
        request,
        id
    };
};

SAML.prototype.requestToUrl = function(request, operation, callback) {
    console.log("SAML.requestToUrl",request,operation);
    if(typeof(request) == "string"){
        console.log("requestToUrl: " + request + ", operation: " + operation);
    }else{
        console.log("requestToUrl, typeof: " + typeof(request));
    }
    
    var quoteattr = function(s, preserveCR) {
        preserveCR = preserveCR ? '&#13;' : '\n';
        return ('' + s) // Forces the conversion to string.
          .replace(/&/g, '&amp;') // This MUST be the 1st replacement.
          .replace(/'/g, '&apos;') // The 4 other predefined entities, required.
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
           // Add other replacements here for HTML only
           // Or for XML, only if the named entities are defined in its DTD.
          .replace(/\r\n/g, preserveCR) // Must be before the next replacement.
          .replace(/[\r\n]/g, preserveCR);
    };

    const requestBuffer = Buffer.from(request, 'utf8');
    var base64 = requestBuffer.toString('base64');

    var samlMessage = {
        SAMLRequest: base64,
        RelayState: Meteor.settings.ROOT_URL + "/profile", //"https://mofacts.optimallearning.org/profile",
    };

    var formInputs = Object.keys(samlMessage).map(k => {
        return '<input type="hidden" name="' + k + '" value="' + quoteattr(samlMessage[k]) + '" />';
    }).join('\r\n');

    var output = [
        '<!DOCTYPE html>',
        '<html>',
        '<head>',
        '<meta charset="utf-8">',
        '<meta http-equiv="x-ua-compatible" content="ie=edge">',
        '</head>',
        '<body onload="document.forms[0].submit()">',
        '<noscript>',
        '<p><strong>Note:</strong> Since your browser does not support JavaScript, you must press the button below once to proceed.</p>',
        '</noscript>',
        '<form method="POST" action="' + encodeURI(this.options.entryPoint) + '">',
        formInputs,
        '<input type="submit" value="Submit" />',
        '</form>',
        '<script>document.forms[0].style.display="none";</script>', // Hide the form if JavaScript is enabled
        '</body>',
        '</html>'
    ].join('\r\n');

    console.log("output: " + JSON.stringify(output));

    callback(null,output);
};

SAML.prototype.getAuthorizeForm = function(req, callback) {
    console.log("SAML.getAuthorizeForm");
    const request = this.generateAuthorizeRequest(req);

    this.requestToUrl(request, 'authorize', callback);
};

SAML.prototype.getLogoutUrl = function(req, callback) {
    console.log("SAML.getLogoutUrl");
    const request = this.generateLogoutRequest(req);

    this.requestToUrl(request, 'logout', callback);
};

SAML.prototype.certToPEM = function(cert) {
    console.log("SAML.certToPEM");
    cert = cert.match(/.{1,64}/g).join('\n');
    cert = `-----BEGIN CERTIFICATE-----\n${ cert }`;
    cert = `${ cert }\n-----END CERTIFICATE-----\n`;
    return cert;
};

SAML.prototype.validateStatus = function(doc) {
    console.log("SAML.validateStatus");
    let successStatus = false;
    let status = '';
    let messageText = '';
    const statusNodes = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'StatusCode');

    if (statusNodes.length) {
        const statusMessage = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'StatusMessage')[0];
        if (statusMessage) {
            messageText = statusMessage.firstChild.textContent;
        }

        const statusNode = statusNodes[0];
        status = statusNode.getAttribute('Value');

        if (status === 'urn:oasis:names:tc:SAML:2.0:status:Success') {
            successStatus = true;
        }
    }

    var ret = {
        success: successStatus,
        message: messageText,
        statusCode: status
    };

    console.log("ret: " + JSON.stringify(ret));

    return ret;
};

//TODO: fix this and run in during authentication
SAML.prototype.validateSignature = function(xml, cert) {
    console.log("SAML.validateSignature");
    //console.log("validate signature, xml: " + JSON.stringify(xml) + ", cert: " + JSON.stringify(cert));
    const self = this;

    const doc = new xmldom.DOMParser().parseFromString(xml);
    const signature = xmlCrypto.xpath(doc, '//*[local-name(.)=\'Signature\' and namespace-uri(.)=\'http://www.w3.org/2000/09/xmldsig#\']')[0];

    const sig = new xmlCrypto.SignedXml();

    sig.keyInfoProvider = {
        getKeyInfo( /*key*/ ) {
            return '<X509Data></X509Data>';
        },
        getKey( /*keyInfo*/ ) {
            return self.certToPEM(cert);
        }
    };

    sig.loadSignature(signature);

    var test = sig.checkSignature(xml);

    console.log("check sig: " + JSON.stringify(test) + ", validationErrors: " + JSON.stringify(sig.validationErrors))

    return test;
};

SAML.prototype.validateLogoutResponse = function(samlResponse, callback) {
    console.log("SAML.validateLogoutResponse");
    const self = this;
    const compressedSAMLResponse = new Buffer(samlResponse, 'base64');
    zlib.inflateRaw(compressedSAMLResponse, function(err, decoded) {
        if (err) {
            if (Meteor.settings.debug) {
                console.log("Error while inflating." + err);
            }
        } else {
            console.log("construvting new DOM parser: " + Object.prototype.toString.call(decoded));
            console.log(">>>>" + decoded);
            const doc = new xmldom.DOMParser().parseFromString(array2string(decoded), 'text/xml');
            console.log("validateLogoutResponse, doc: " + JSON.stringify(doc));
            if (doc) {
                const response = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'LogoutResponse')[0];
                if (response) {

                    // TBD. Check if this msg corresponds to one we sent
										var inResponseTo;
                    try {
                        inResponseTo = response.getAttribute('InResponseTo');
                        if (Meteor.settings.debug) {
                            console.log(`In Response to: ${ inResponseTo }`);
                        }
                    } catch (e) {
                        if (Meteor.settings.debug) {
														console.log("Caught error: " + e);
														const msg = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'StatusMessage');
                            console.log("Unexpected msg from IDP. Does your session still exist at IDP? Idp returned: \n" + msg);
                        }
                    }


                    let statusValidateObj = self.validateStatus(doc);

                    if (statusValidateObj.success) {
                        callback(null, inResponseTo);
                    } else {
                        callback('Error. Logout not confirmed by IDP', null);

                    }
                } else {
                    callback('No Response Found', null);
                }
            }
        }

    });
};

SAML.prototype.validateResponse = function(samlResponse, relayState, callback) {
    console.log("SAML.validateResponse",samlResponse,relayState);
    const self = this;
    const xml = new Buffer(samlResponse, 'base64').toString('utf8');
    // We currently use RelayState to save SAML provider
    console.log("SAML.validateResponse",`Validating response with relay state: ${ xml }`);
    const parser = new xml2js.Parser({ explicitRoot: true });
    const doc = new xmldom.DOMParser().parseFromString(xml, 'text/xml');

    if (doc) {
        let statusValidateObj = self.validateStatus(doc);

        if (statusValidateObj.success) {
            console.log("SAML.validateResponse",'Status ok');
            // Verify signature
            //TODO: insert code here
            // console.log('Verify signature');
            // console.log('Signature OK');
            const response = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'Response')[0];
            if (response) {
                console.log("SAML.validateResponse",'Got response');

                var assertion = response.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Assertion')[0];
                const encAssertion = response.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'EncryptedAssertion')[0];

                var xmlenc = Npm.require('xml-encryption');
                var options = { key: this.options.privateKey};

                if (typeof encAssertion !== 'undefined') {
                    xmlenc.decrypt(encAssertion.getElementsByTagNameNS('*', 'EncryptedData')[0], options, function(err, result) {
                        assertion = new xmldom.DOMParser().parseFromString(result, 'text/xml');
                    });
                }

                if (!assertion) {
                    return callback(new Error('Missing SAML assertion'), null, false);
                }

                // if (self.options.cert){ //# && !self.validateSignature(assertion, self.options.cert)) {
                //     if (Meteor.settings.debug) {
                //         console.log('Signature WRONG');
                //     }
                //     return callback(new Error('Invalid signature'), null, false);
                // }

                const profile = {};

                if (response.hasAttribute('InResponseTo')) {
                    profile.inResponseToId = response.getAttribute('InResponseTo');
                }else{
                    serverConsole("SAML.validateResponse, no InResponseTo?");
                }

                const issuer = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Issuer')[0];
                if (issuer) {
                    profile.issuer = issuer.textContent;
                }

                var subject = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Subject')[0];
                const encSubject = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'EncryptedID')[0];

                if (typeof encSubject !== 'undefined') {
                    xmlenc.decrypt(encSubject.getElementsByTagNameNS('*', 'EncryptedData')[0], options, function(err, result) {
                        subject = new xmldom.DOMParser().parseFromString(result, 'text/xml');
                    });
                }

                const authnStatement = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AuthnStatement')[0];

                if(authnStatement){
                    if (authnStatement.hasAttribute('SessionIndex')) {
                        profile.sessionIndex = authnStatement.getAttribute('SessionIndex');
                        console.log("SAML.validateResponse,",`Session Index: ${ profile.sessionIndex }`);
                    } else {
                        console.log("SAML.validateResponse,",'No Session Index Found');
                    }
                }else{
                    console.log("SAML.validateResponse,",'No AuthN Statement found');
                }

                const attributeStatement = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeStatement')[0];
                if (attributeStatement) {
                    console.log("SAML.validateResponse,","Attribute Statement found in SAML response: " + attributeStatement);
                    const attributes = attributeStatement.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute');
                    console.log("SAML.validateResponse,","Attributes will be processed: " + attributes.length);
                    if (attributes) {
                        for (let i = 0; i < attributes.length; i++) {
                            const values = attributes[i].getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeValue');
                            let value;
                            console.log("values.length = " + values.length);
                            if (values.length === 1) {
                                value = values[0].textContent;
                            } else {
                                value = [];
                                for (var attributeValue of values) {
                                    value.push(attributeValue.textContent);
                                }
                            }
                            console.log("SAML.validateResponse,","Name: " + attributes[i]);
                            console.log("SAML.validateResponse,",`Adding attribute from SAML response to profile:` + attributes[i].getAttribute('Name') + " = " + value);
                            //console.log("value: " + JSON.stringify(value));
                            profile[attributes[i].getAttribute('Name').replace(/\./g,'_')] = value;
                        }
                        console.log("SAML.validateResponse,","profile after attributes: " + JSON.stringify(profile));
                    } else {
                        console.log("SAML.validateResponse,","No Attributes found in SAML attribute statement.");
                    }
                } else {
                    console.log("SAML.validateResponse,","No Attribute Statement found in SAML response.");
                }

                console.log("SAML.validateResponse, profile: " + JSON.stringify(profile));
                callback(null, profile, false);
            } else {
                const logoutResponse = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:protocol', 'LogoutResponse');

                if (logoutResponse) {
                    callback(null, null, true);
                } else {
                    return callback(new Error('Unknown SAML response message'), null, false);
                }

            }
        } else {
            return callback(new Error(`Status is:  ${ statusValidateObj.statusCode }`), null, false);
        }
    }

};

let decryptionCert;
SAML.prototype.generateServiceProviderMetadata = function(callbackUrl) {
    console.log("SAML.generateServiceProviderMetadata",JSON.stringify(decryptionCert));
    if (!decryptionCert) {
        decryptionCert = this.options.privateCert;
        console.log("generateServiceProviderMetadata, 2: " + JSON.stringify(decryptionCert));
    }

    if (!this.options.callbackUrl && !callbackUrl) {
        throw new Error('Unable to generate service provider metadata when callbackUrl option is not set');
    }

    const metadata = {
        'EntityDescriptor': {
            '@xmlns': 'urn:oasis:names:tc:SAML:2.0:metadata',
            '@xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
            '@entityID': this.options.issuer,
            'SPSSODescriptor': {
                '@protocolSupportEnumeration': 'urn:oasis:names:tc:SAML:2.0:protocol',
                'SingleLogoutService': {
                    '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
                    '@Location': `${ Meteor.absoluteUrl() }sw-adfs/logout`,
                    '@ResponseLocation': `${ Meteor.absoluteUrl() }sw-adfs/logout`
                },
                'NameIDFormat': this.options.identifierFormat,
                'AssertionConsumerService': {
                    '@index': '1',
                    '@isDefault': 'true',
                    '@Binding': 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
                    '@Location': callbackUrl
                }
            }
        }
    };

    if (this.options.privateKey) {
        if (!decryptionCert) {
            throw new Error(
                'Missing decryptionCert while generating metadata for decrypting service provider');
        }

        decryptionCert = decryptionCert.replace(/-+BEGIN CERTIFICATE-+\r?\n?/, '');
        decryptionCert = decryptionCert.replace(/-+END CERTIFICATE-+\r?\n?/, '');
        decryptionCert = decryptionCert.replace(/\n/g, '');

        metadata['EntityDescriptor']['SPSSODescriptor']['KeyDescriptor'] = {
            'ds:KeyInfo': {
                'ds:X509Data': {
                    'ds:X509Certificate': {
                        '#text': decryptionCert
                    }
                }
            },
            'EncryptionMethod': [
                // this should be the set that the xmlenc library supports
                {
                    '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#aes256-cbc'
                },
                {
                    '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#aes128-cbc'
                },
                {
                    '@Algorithm': 'http://www.w3.org/2001/04/xmlenc#tripledes-cbc'
                }
            ]
        };
    }

    return xmlbuilder.create(metadata).end({
        pretty: true,
        indent: '  ',
        newline: '\n'
    });
};