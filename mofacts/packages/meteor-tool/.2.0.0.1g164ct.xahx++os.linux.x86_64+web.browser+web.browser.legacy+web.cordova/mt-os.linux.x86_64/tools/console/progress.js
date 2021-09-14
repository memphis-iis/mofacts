let _objectSpread;

module.link("@babel/runtime/helpers/objectSpread2", {
  default(v) {
    _objectSpread = v;
  }

}, 0);
module.export({
  Progress: () => Progress
});

class Progress {
  constructor() {
    let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    this.startTime = Date.now();
    this.allTasks = [];
    this.selfState = {
      current: 0,
      done: false
    };
    this.state = {
      current: 0,
      done: false
    };
    this.isDone = false;
    this.parent = options.parent || null;
    this.watchers = options.watchers || [];
    this.forkJoin = !!options.forkJoin;

    if (this.title = options.title) {
      // Capitalize job titles when displayed in the progress bar.
      this.title = this.title[0].toUpperCase() + this.title.slice(1);
    }
  }

  toString() {
    return "Progress [state=" + JSON.stringify(this.state) + "]";
  }

  reportProgressDone() {
    const state = _objectSpread(_objectSpread({}, this.selfState), {}, {
      done: true
    });

    if (typeof state.end !== 'undefined') {
      if (state.current > state.end) {
        state.end = state.current;
      }

      state.current = state.end;
    }

    this.reportProgress(state);
  } // Tries to determine which is the 'current' job in the tree
  // This is very heuristical... we use some hints, like:
  // don't descend into fork-join jobs; we know these execute concurrently,
  // so we assume the top-level task has the title
  // i.e. "Downloading packages", not "downloading supercool-1.0"


  getCurrentProgress() {
    const isRoot = !this.parent;

    if (this.isDone) {
      // A done task cannot be the active task
      return null;
    }

    if (!this.state.done && this.state.current !== 0 && this.state.end && !isRoot) {
      // We are not done and we have interesting state to report
      return this;
    }

    if (this.forkJoin) {
      // Don't descend into fork-join tasks (by choice)
      return this;
    }

    if (this.allTasks.length) {
      const active = this.allTasks.map(task => task.getCurrentProgress()).filter(Boolean);

      if (active.length) {
        // pick one to display, somewhat arbitrarily
        return active[active.length - 1];
      } // No single active task, return self


      return this;
    }

    return this;
  } // Creates a subtask that must be completed as part of this (bigger) task


  addChildTask(options) {
    options = _objectSpread({
      parent: this
    }, options);
    const child = new Progress(options);
    this.allTasks.push(child);
    this.reportChildState();
    return child;
  } // Dumps the tree, for debug


  dump(stream, options, prefix) {
    if (options && options.skipDone && this.isDone) {
      return;
    }

    if (prefix) {
      stream.write(prefix);
    }

    const end = this.state.end || '?';
    stream.write("Task [" + this.title + "] " + this.state.current + "/" + end + (this.isDone ? " done" : "") + "\n");

    if (this.allTasks.length) {
      this.allTasks.forEach(child => {
        child.dump(stream, options, (prefix || '') + '  ');
      });
    }
  } // Receives a state report indicating progress of self


  reportProgress(state) {
    this.selfState = state;
    this.updateTotalState(); // Nudge the spinner/progress bar, but don't yield (might not be safe to yield)

    require('./console.js').Console.nudge(false);

    this.notifyState();
  } // Subscribes a watcher to changes


  addWatcher(watcher) {
    this.watchers.push(watcher);
  } // Notifies watchers & parents


  notifyState() {
    if (this.parent) {
      this.parent.reportChildState();
    }

    if (this.watchers.length) {
      this.watchers.forEach(watcher => {
        watcher(this.state);
      });
    }
  } // Recomputes state, incorporating children's states


  updateTotalState() {
    let allChildrenDone = true;

    const state = _objectSpread({}, this.selfState);

    this.allTasks.forEach(child => {
      const childState = child.state;

      if (!child.isDone) {
        allChildrenDone = false;
      }

      state.current += childState.current;

      if (state.end !== undefined) {
        if (childState.done) {
          state.end += childState.current;
        } else if (childState.end !== undefined) {
          state.end += childState.end;
        } else {
          state.end = undefined;
        }
      }
    });
    this.isDone = allChildrenDone && !!this.selfState.done;

    if (!allChildrenDone) {
      state.done = false;
    }

    if (!state.done && this.state.done) {
      // This shouldn't happen
      throw new Error("Progress transition from done => !done");
    }

    this.state = state;
  } // Called by a child when its state changes


  reportChildState() {
    this.updateTotalState();
    this.notifyState();
  }

  getState() {
    return this.state;
  }

}
//# sourceMappingURL=progress.js.map