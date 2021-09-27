module.export({
  randomString: () => randomString,
  accountsCommandTimeoutSecs: () => accountsCommandTimeoutSecs,
  randomAppName: () => randomAppName,
  randomUserEmail: () => randomUserEmail,
  login: () => login,
  logout: () => logout,
  registrationUrlRegexp: () => registrationUrlRegexp,
  ddpConnect: () => ddpConnect,
  registerWithToken: () => registerWithToken,
  randomOrgName: () => randomOrgName,
  createOrganization: () => createOrganization,
  getMeteorRuntimeConfigFromHTML: () => getMeteorRuntimeConfigFromHTML,
  checkForSettings: () => checkForSettings,
  markThrowingMethods: () => markThrowingMethods
});
let getAuthDDPUrl;
module.link("../meteor-services/config.js", {
  getAuthDDPUrl(v) {
    getAuthDDPUrl = v;
  }

}, 0);
let timeoutScaleFactor;
module.link("../utils/utils.js", {
  timeoutScaleFactor(v) {
    timeoutScaleFactor = v;
  }

}, 1);
let withAccountsConnection;
module.link("../meteor-services/auth.js", {
  withAccountsConnection(v) {
    withAccountsConnection = v;
  }

}, 2);
let fail, markStack;
module.link("./selftest.js", {
  fail(v) {
    fail = v;
  },

  markStack(v) {
    markStack = v;
  }

}, 3);
let request;
module.link("../utils/http-helpers.js", {
  request(v) {
    request = v;
  }

}, 4);
let isEqual;
module.link("underscore", {
  isEqual(v) {
    isEqual = v;
  }

}, 5);
let loadIsopackage;
module.link("../tool-env/isopackets.js", {
  loadIsopackage(v) {
    loadIsopackage = v;
  }

}, 6);

function randomString(charsCount) {
  var chars = 'abcdefghijklmnopqrstuvwxyz';
  var str = '';

  for (var i = 0; i < charsCount; i++) {
    str = str + chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return str;
}

const accountsCommandTimeoutSecs = 15 * timeoutScaleFactor;

function randomAppName() {
  return 'selftest-app-' + randomString(10);
}

function randomUserEmail() {
  return 'selftest-user-' + randomString(15) + '@guerrillamail.com';
}

function login(s, username, password) {
  var run = s.run('login');
  run.waitSecs(15);
  run.matchErr('Username:');
  run.write(username + '\n');
  run.matchErr('Password:');
  run.write(password + '\n');
  run.waitSecs(15);
  run.matchErr('Logged in as ' + username + ".");
  run.expectExit(0);
}

function logout(s) {
  var run = s.run('logout');
  run.waitSecs(15);
  run.matchErr('Logged out');
  run.expectExit(0);
}

const registrationUrlRegexp = /https:\/\/www\.meteor\.com\/setPassword\?([a-zA-Z0-9\+\/]+)/;

function ddpConnect(url) {
  return loadIsopackage('ddp-client').DDP.connect(url);
}

function registerWithToken(token, username, password, email) {
  // XXX It might make more sense to hard-code the DDP url to
  // https://www.meteor.com, since that's who the sandboxes are talking
  // to.
  var accountsConn = ddpConnect(getAuthDDPUrl());
  var registrationTokenInfo = accountsConn.call('registrationTokenInfo', token);
  var registrationCode = registrationTokenInfo.code;
  accountsConn.call('register', {
    username: username,
    password: password,
    emails: [email],
    token: token,
    code: registrationCode
  });
  accountsConn.close();
}

function randomOrgName() {
  return "selftestorg" + exports.randomString(10);
}

function createOrganization(username, password) {
  var orgName = exports.randomOrgName();
  withAccountsConnection(function (conn) {
    try {
      conn.call("login", {
        meteorAccountsLoginInfo: {
          username: username,
          password: password
        },
        clientInfo: {}
      });
    } catch (err) {
      fail("Failed to log in to Meteor developer accounts\n" + "with test user: " + err);
    }

    try {
      conn.call("createOrganization", orgName);
    } catch (err) {
      fail("Failed to create organization: " + err);
    }
  })();
  return orgName;
}

function getMeteorRuntimeConfigFromHTML(html) {
  var m = html.match(/__meteor_runtime_config__ = JSON.parse\(decodeURIComponent\("([^"]+?)"\)\)/);

  if (!m) {
    fail("Can't find __meteor_runtime_config__");
  }

  return JSON.parse(decodeURIComponent(m[1]));
}

const checkForSettings = markStack(function (appName, settings, timeoutSecs) {
  var timeoutDate = new Date(new Date().valueOf() + timeoutSecs * 1000);

  while (true) {
    if (new Date() >= timeoutDate) {
      fail('Expected settings not found on app ' + appName);
    }

    var result = request('http://' + appName); // XXX This is brittle; the test will break if we start formatting the
    // __meteor_runtime_config__ JS differently. Ideally we'd do something
    // like point a phantom at the deployed app and actually evaluate
    // Meteor.settings.

    try {
      var mrc = exports.getMeteorRuntimeConfigFromHTML(result.body);
    } catch (e) {
      // ignore
      continue;
    }

    if (_.isEqual(mrc.PUBLIC_SETTINGS, settings['public'])) {
      return;
    }
  }
});

function markThrowingMethods(prototype) {
  Object.keys(prototype).forEach(key => {
    const value = prototype[key];

    if (typeof value === "function") {
      const code = Function.prototype.toString.call(value);

      if (/\bnew TestFailure\b/.test(code)) {
        prototype[name] = markStack(value);
      }
    }
  });
}
//# sourceMappingURL=test-utils.js.map