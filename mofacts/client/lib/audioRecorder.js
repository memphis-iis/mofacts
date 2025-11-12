/*License (MIT)
Copyright © 2013 Matt Diamond
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
*/

(function(window){
  var WORKER_PATH = 'lib/audioRecorderWorker.js';
  var WORKLET_PATH = 'lib/recorderWorkletProcessor.js';
  var WORKLET_NAME = 'recorder-worklet-processor';
  var workletModulePromises = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    this.context = source.context;
    this.node = null;

    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate
      }
    });

    var recording = false;
    var currCallback = null;
    var processCallback = null;
    var self = this;

    function postBufferToWorker(channelData){
      if (!recording) {
        return;
      }

      worker.postMessage({
        command: 'record',
        buffer: [
          channelData
        ]
      });
    }

    function setupScriptNode(){
      if(!self.context.createScriptProcessor){
        self.node = self.context.createJavaScriptNode(bufferLen, 1, 1);
      } else {
        self.node = self.context.createScriptProcessor(bufferLen, 1, 1);
      }

      self.node.onaudioprocess = function(e){
        postBufferToWorker(e.inputBuffer.getChannelData(0));
      };

      source.connect(self.node);
      self.node.connect(self.context.destination);
    }

    async function setupWorkletNode(){
      if (!self.context.audioWorklet || typeof window.AudioWorkletNode === 'undefined') {
        throw new Error('AudioWorkletNode is not supported in this browser');
      }

      var modulePromise;
      if (workletModulePromises) {
        modulePromise = workletModulePromises.get(self.context);
        if (!modulePromise) {
          modulePromise = self.context.audioWorklet.addModule(config.workletPath || WORKLET_PATH);
          workletModulePromises.set(self.context, modulePromise);
        }
      } else {
        modulePromise = self.context.audioWorklet.addModule(config.workletPath || WORKLET_PATH);
      }

      await modulePromise;

      self.node = new AudioWorkletNode(self.context, WORKLET_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      });
      self.node.port.onmessage = function(event) {
        postBufferToWorker(event.data);
      };

      source.connect(self.node);
      self.node.connect(self.context.destination);
    }

    async function initNode(){
      if (config.forceScriptProcessor) {
        setupScriptNode();
        return 'script';
      }

      try {
        if (self.context.audioWorklet && typeof window.AudioWorkletNode !== 'undefined') {
          await setupWorkletNode();
          return 'worklet';
        }
      } catch (err) {
        console.warn('[Recorder] AudioWorklet init failed, falling back to ScriptProcessor:', err);
      }

      setupScriptNode();
      return 'script';
    }

    // Expose a readiness promise so callers can await the node being connected before starting SR.
    this.ready = initNode();

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
      if (!this.node) {
        console.warn('[Recorder] record() called before node initialized');
        return;
      }
      recording = true;
    }

    this.stop = function(){
      recording = false;
    }

    this.clear = function(){
      worker.postMessage({ command: 'clear' });
    }

    this.setProcessCallback = function(cb){
      processCallback = cb;
    }

    this.getBuffers = function(cb) {
      currCallback = cb || config.callback;
      worker.postMessage({ command: 'getBuffers' })
    }

    this.exportWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportWAV',
        type: type
      });
    }

    this.exportMonoWAV = function(cb, type){
      currCallback = cb || config.callback;
      type = type || config.type || 'audio/wav';
      if (!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'exportMonoWAV',
        type: type
      });
    }

    this.exportLinear16 = function(cb){
      currCallback = cb;
      if(!currCallback) throw new Error('Callback not set');
      worker.postMessage({
        command: 'getLinear16'
      })
    }

    this.exportToProcessCallback = function(){
      currCallback = processCallback;
      worker.postMessage({
        command: 'getLinear16'
      })
    }

    worker.onmessage = function(e){
      var blob = e.data;
      currCallback(blob);
    }

    // Backwards compatibility: ensure ready promise always exists even if initNode threw synchronously
    if (!this.ready) {
      this.ready = Promise.resolve();
    }
  };

  Recorder.setupDownload = function(blob, filename){
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = document.getElementById("save");
    link.href = url;
    link.download = filename || 'output.wav';
  }

  window.Recorder = Recorder;

})(window);
