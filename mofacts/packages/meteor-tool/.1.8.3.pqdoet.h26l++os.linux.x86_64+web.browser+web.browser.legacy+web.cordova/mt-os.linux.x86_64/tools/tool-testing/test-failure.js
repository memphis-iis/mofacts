module.export({
  default: () => TestFailure
});

class TestFailure {
  constructor(reason, details) {
    this.reason = reason;
    this.details = details || {};
    this.stack = new Error().stack;
  }

}
//# sourceMappingURL=test-failure.js.map