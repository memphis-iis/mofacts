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

  var Recorder = function(source, cfg){
    var config = cfg || {};
    var bufferLen = config.bufferLen || 4096;
    this.context = source.context;
    if(!this.context.createScriptProcessor){
       this.node = this.context.createJavaScriptNode(bufferLen, 2, 2);
    } else {
       this.node = this.context.createScriptProcessor(bufferLen, 2, 2);
    }

    var worker = new Worker(config.workerPath || WORKER_PATH);
    worker.postMessage({
      command: 'init',
      config: {
        sampleRate: this.context.sampleRate
      }
    });

      console.log("sample rate: " + this.context.sampleRate);
    var recording = false,
    currCallback;
    processCallback = null;
    var wasSilent = true;

    this.node.onaudioprocess = function(e){
      if (!recording){
        return;
      }
      worker.postMessage({
        command: 'record',
        buffer: [
          e.inputBuffer.getChannelData(0),
          e.inputBuffer.getChannelData(1)
        ]
      });
      //startSilenceDetection();

      // recording = false;
      // console.log("ending recording after first sample");
    }

    // var startSilenceDetection = function() {
    //   analyser.fftSize = 2048;
    //   var bufferLength = analyser.fftSize;
    //   var dataArray = new Uint8Array(bufferLength);
    //
    //   analyser.getByteTimeDomainData(dataArray);
    //
    //   if (typeof visualizationCallback === 'function') {
    //     visualizationCallback(dataArray, bufferLength);
    //   }
    //
    //   var curr_value_time = (dataArray[0] / 128) - 1.0;
    //
    //   if (curr_value_time > 0.01 || curr_value_time < -0.01) {
    //     start = Date.now();
    //     console.log("start silence time");
    //   }else if(curr_value_time < 0.0015 && curr_value_time > -0.0015){
    //     speechStart = Date.now();
    //     console.log("start speech time");
    //   }
    //   var newtime = Date.now();
    //   var elapsedTime = newtime - start;
    //   var elapsedSpeechTime = newtime - speechStart;
    //   if (elapsedTime > 3000) {
    //     console.log("silence of 3 seconds detected");
    //     if(!wasSilent){
    //       if(processCallback){
    //         console.log("SILENCE DETECTED, PROCESSING SPEECH NOW");
    //         processCallback();
    //         this.stop();
    //       }else{
    //         console.log("NO SILENCE CALLBACK SETUP");
    //       }
    //     }else{
    //       console.log("");
    //     }
    //     wasSilent = true;
    //   }else if(elapsedSpeechTime > 1000){
    //     console.log("speech of 1 second detected");
    //     wasSilent = false;
    //   }
    // };

    this.configure = function(cfg){
      for (var prop in cfg){
        if (cfg.hasOwnProperty(prop)){
          config[prop] = cfg[prop];
        }
      }
    }

    this.record = function(){
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

    // var analyser = source.context.createAnalyser();
    // analyser.minDecibels = -90;
    // analyser.maxDecibels = -10;
    // analyser.smoothingTimeConstant = 0.85;
    //
    // source.connect(analyser);
    // analyser.connect(this.node);
    // this.node.connect(source.context.destination);

    source.connect(this.node);
    this.node.connect(this.context.destination);   // if the script node is not connected to an output the "onaudioprocess" event is not triggered in chrome.
  };

  Recorder.setupDownload = function(blob, filename){
    var url = (window.URL || window.webkitURL).createObjectURL(blob);
    var link = document.getElementById("save");
    link.href = url;
    link.download = filename || 'output.wav';
  }

  window.Recorder = Recorder;

})(window);
