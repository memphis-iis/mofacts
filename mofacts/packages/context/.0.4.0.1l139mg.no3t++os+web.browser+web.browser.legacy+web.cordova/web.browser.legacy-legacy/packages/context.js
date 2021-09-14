(function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/context/context.js                                       //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
const {
  Slot,
  bind,
  noContext,
  setTimeout,
  asyncFromGen,
} = require("@wry/context");

Object.assign(exports, {
  Slot,
  bind,
  noContext,
  setTimeout,
  asyncFromGen,
});

///////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/context/context-tests.js                                 //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
import { Tinytest } from "meteor/tinytest";
import { Slot } from "meteor/context";

Tinytest.add('context - basic Slot usage', function (test) {
  const slot = new Slot();
  test.equal(slot.hasValue(), false);
  slot.withValue(123, () => {
    test.equal(slot.hasValue(), true);
    test.equal(slot.getValue(), 123);
  });
  test.equal(slot.hasValue(), false);
});

///////////////////////////////////////////////////////////////////////

}).call(this);






(function(){

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/context/server.js                                        //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
const { wrapYieldingFiberMethods } = require("@wry/context");
wrapYieldingFiberMethods(require("fibers"));

///////////////////////////////////////////////////////////////////////

}).call(this);
