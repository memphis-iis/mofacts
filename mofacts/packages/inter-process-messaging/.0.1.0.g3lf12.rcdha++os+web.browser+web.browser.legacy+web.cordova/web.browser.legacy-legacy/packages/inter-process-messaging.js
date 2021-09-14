(function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/inter-process-messaging/inter-process-messaging.js                      //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
const uuid = require("uuid");

const { encode, decode } = require("arson");

const {
  MESSAGE,
  RESPONSE,
  PING,
  PONG,
} = require("./types.js");

const hasOwn = Object.prototype.hasOwnProperty;

Object.assign(exports, {
  // Adds onMessage(topic, callback) and sendMessage(topic, payload)
  // methods to otherProcess. These methods are an improvement over the
  // native Node interfaces otherProcess.on("message", callback) and
  // otherProcess.send(message) because they take a topic string as their
  // first argument, which allows restricting the delivery of messages by
  // topic; and they permit the receiving process to respond by returning
  // a value (possibly a Promise) from the onMessage callback.
  enable(otherProcess) {
    if (typeof otherProcess.onMessage === "function" &&
        typeof otherProcess.sendMessage === "function") {
      // Calling enable more than once should be safe/idempotent.
      return otherProcess;
    }

    const callbacksByTopic = new Map;

    // To receive messages *from* otherProcess, this process should call
    // otherMessage.onMessage(topic, callback). The callback will receive
    // the provided payload as its first (and only) parameter. Callbacks
    // may return a Promise, in which case the response will be delayed
    // until all results returned by callbacks registered for this topic
    // have been resolved.
    otherProcess.onMessage = function onMessage(topic, callback) {
      if (! callbacksByTopic.has(topic)) {
        callbacksByTopic.set(topic, new Set);
      }
      callbacksByTopic.get(topic).add(callback);
    };

    const readyResolvers = new Map;
    const pendingMessages = new Map;
    const promisesByTopic = new Map;
    const handlersByType = Object.create(null);

    handlersByType[PING] = function ({ id }) {
      otherProcess.send({ type: PONG, id });
    };

    handlersByType[PONG] = function ({ id }) {
      const resolve = readyResolvers.get(id);
      if (typeof resolve === "function") {
        readyResolvers.delete(id);
        // This resolves the child.readyForMessages Promise created above.
        resolve();
      }
    };

    handlersByType[MESSAGE] = function ({
      responseId,
      topic,
      encodedPayload,
    }) {
      const newPromise = (
        promisesByTopic.get(topic) || Promise.resolve()
      ).then(() => {
        const results = [];
        const callbacks = callbacksByTopic.get(topic);
        if (callbacks && callbacks.size > 0) {
          // Re-decode the payload for each callback to prevent one
          // callback from modifying the payload seen by later callbacks.
          callbacks.forEach(cb => results.push(cb(decode(encodedPayload))));
          return Promise.all(results);
        }
        // Since there were no callbacks, this will be an empty array.
        return results;
      }).then(results => {
        if (responseId) {
          otherProcess.send({
            type: RESPONSE,
            responseId,
            encodedResults: encode(results),
          });
        }
      }, error => {
        const serializable = {};

        // Use Reflect.ownKeys to catch non-enumerable properties, since
        // every Error property (including "message") seems to be
        // non-enumerable by default.
        Reflect.ownKeys(error).forEach(key => {
          serializable[key] = error[key];
        });

        otherProcess.send({
          type: RESPONSE,
          responseId,
          encodedError: encode(serializable),
        });
      });

      // Immediately update the latest promise for this topic to the
      // newPromise that we just created, before any listeners run. This
      // strategy has the effect of chaining promises by topic and thus
      // keeping messages and their responses strictly ordered, one after
      // the last. Because we always register a non-throwing error handler
      // at the end of newPromise, this queue of promises should never get
      // stalled by an earlier rejection.
      promisesByTopic.set(topic, newPromise);
    };

    handlersByType[RESPONSE] = function (message) {
      const entry = pendingMessages.get(message.responseId);
      if (entry) {
        if (hasOwn.call(message, "encodedError")) {
          entry.reject(decode(message.encodedError));
        } else {
          entry.resolve(decode(message.encodedResults));
        }
      }
    };

    otherProcess.on("message", message => {
      const handler = handlersByType[message.type];
      if (typeof handler === "function") {
        handler(message);
      }
    });

    // Call otherProcess.sendMessage(topic, payload) instead of the native
    // otherProcess.send(message) to deliver a message based on a specific
    // topic string, and to receive a reliable response when the other
    // process has finished handling that message.
    otherProcess.sendMessage = function sendMessage(topic, payload) {
      otherProcess.readyForMessages =
        otherProcess.readyForMessages || makeReadyPromise();

      return otherProcess.readyForMessages.then(() => {
        const responseId = uuid();

        return new Promise((resolve, reject) => {
          pendingMessages.set(responseId, { resolve, reject });

          otherProcess.send({
            type: MESSAGE,
            responseId,
            topic,
            encodedPayload: encode(payload),
          }, error => {
            if (error) {
              reject(error);
            }
          });

        }).then(response => {
          pendingMessages.delete(responseId);
          return response;

        }, error => {
          pendingMessages.delete(responseId);
          throw error;
        });
      });
    };

    function makeReadyPromise() {
      return new Promise((resolve, reject) => {
        const pingMessage = { type: PING, id: uuid() };
        const backoff_factor = 1.1;
        let delay_ms = 50;

        readyResolvers.set(pingMessage.id, resolve);

        function poll() {
          if (readyResolvers.has(pingMessage.id)) {
            otherProcess.send(pingMessage, error => {
              if (error) {
                reject(error);
              } else {
                setTimeout(poll, delay_ms);
                delay_ms *= backoff_factor;
              }
            });
          }
        }

        poll();
      });
    }

    otherProcess.on("exit", (code, signal) => {
      const error = new Error("process exited");
      Object.assign(error, { code, signal });

      // Terminate any pending messages.
      pendingMessages.forEach(entry => entry.reject(error));

      // Prevent future messages from being sent.
      otherProcess.readyForMessages = Promise.reject(error);

      // Silence UnhandledPromiseRejectionWarning
      otherProcess.readyForMessages.catch(() => {});
    });

    return otherProcess;
  },

  // Call this onMessage function to listen for messages *from the parent
  // process* (if the parent spawned this process with an IPC channel).
  onMessage(topic, callback) {
    // Do nothing by default unless exports.enable(process) is called
    // below, because this process will never receive any messages unless
    // we have an IPC channel open with the parent process, which is true
    // only if process.send is a function.
  }
});

if (typeof process.send === "function") {
  // The process.send method is defined only when the current process was
  // spawned with an IPC channel by the parent process. In other words,
  // given that process.send can be used to send messages to the parent
  // process, it makes sense to enable process.sendMessage(topic, payload)
  // in the child-to-parent direction, too.
  exports.enable(process);

  // Override the default no-op exports.onMessage defined above.
  exports.onMessage = process.onMessage;
}

//////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/inter-process-messaging/tests.js                                        //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
import EventEmitter from "events";
import { Tinytest } from "meteor/tinytest";
import { enable } from "./inter-process-messaging.js";

// Simulated handle for a child process held by the parent process, like
// the object returned by child_process.spawn. Emits any sent messages in
// the child process, represented by this.child.
class FakeChildProcess extends EventEmitter {
  constructor() {
    super();
    this.child = new FakeProcess(this);
    enable(this);
  }

  send(message) {
    this.child.emit("message", JSON.parse(JSON.stringify(message)));
  }
}

// Fake process object analogous to global.process.
class FakeProcess extends EventEmitter {
  constructor(parent) {
    super();
    this.parent = parent;
    enable(this);
  }

  send(message) {
    this.parent.emit("message", JSON.parse(JSON.stringify(message)));
  }
}

Tinytest.addAsync('inter-process-messaging - basic', async (test) => {
  const proc = new FakeChildProcess;

  // Reach into the fake child process to register a listener.
  proc.child.onMessage("add-one-eleven", value => {
    return value + 111;
  });

  const results = await proc.sendMessage("add-one-eleven", 123);

  test.equal(results, [234]);
});

Tinytest.addAsync('inter-process-messaging - multiple listeners', async (test) => {
  const proc = new FakeChildProcess;

  proc.child.onMessage("popular-topic", () => "a");
  proc.child.onMessage("popular-topic", async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return "b";
  });
  proc.child.onMessage("popular-topic", async () => "c");

  const popularResults = await proc.sendMessage("popular-topic");
  test.equal(popularResults, ["a", "b", "c"]);

  const unpopularResults = await proc.sendMessage("unpopular-topic");
  test.equal(unpopularResults, []);

  proc.child.onMessage("unpopular-topic", () => "finally");
  test.equal(await proc.sendMessage("unpopular-topic"), ["finally"]);
});

Tinytest.addAsync('inter-process-messaging - errors', async (test) => {
  const proc = new FakeChildProcess;
  const expectedError = new Error("expected");

  proc.child.onMessage("risky-topic", () => "a");
  proc.child.onMessage("risky-topic", () => {
    throw expectedError;
  });

  return proc.sendMessage("risky-topic").then(result => {
    throw new Error("should have thrown");
  }, error => {
    test.equal(error.message, "expected");
  });
});

Tinytest.addAsync('inter-process-messaging - message from child', async (test) => {
  const proc = new FakeChildProcess;

  proc.onMessage("from-child", async (payload) => {
    test.equal(payload.hello, "hi");
    return "right back atcha";
  });

  const results = await proc.child.sendMessage("from-child", {
    hello: "hi"
  });

  test.equal(results, ["right back atcha"]);
});

Tinytest.addAsync('inter-process-messaging - exotic payloads', async (test) => {
  const proc = new FakeChildProcess;

  // Reach into the fake child process to register a listener.
  proc.child.onMessage("self-reference", payload => {
    test.ok(payload.self === payload);
    return payload;
  });

  const obj = {};
  obj.self = obj;
  const [obj2] = await proc.sendMessage("self-reference", obj);

  test.ok(obj2 !== obj);
  test.ok(obj2.self === obj2);

  // Reach into the fake child process to register a listener.
  proc.child.onMessage("repeated-reference", payload => {
    test.ok(payload[0] === payload[1]);
    return payload;
  });

  const arr = [obj, obj, obj];
  const [arr2] = await proc.sendMessage("repeated-reference", arr);

  test.ok(arr2 !== arr);
  test.ok(arr2[0] === arr2[1]);
  test.ok(arr2[1] === arr2[2]);

  // Reach into the fake child process to register a listener.
  proc.child.onMessage("Set-Map-containment", map => {
    checkMap(map);
    return map;
  });

  function checkMap(map) {
    test.equal(map.size, 1);
    map.forEach((set, self) => {
      test.ok(self === map);
      test.equal(set.size, 2);
      test.ok(set.has(map));
      test.ok(set.has(set));
    });
  }

  const map = new Map;
  const set = new Set;
  map.set(map, set);
  set.add(map).add(set);

  const [map2] = await proc.sendMessage("Set-Map-containment", map);
  test.ok(map2 !== map);
  checkMap(map2);
});

//////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

//////////////////////////////////////////////////////////////////////////////////////
//                                                                                  //
// packages/inter-process-messaging/types.js                                        //
//                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////
                                                                                    //
exports.MESSAGE = "METEOR_IPC_MESSAGE";
exports.RESPONSE = "METEOR_IPC_RESPONSE";
exports.PING = "METEOR_IPC_PING";
exports.PONG = "METEOR_IPC_PONG";

//////////////////////////////////////////////////////////////////////////////////////

}).call(this);
