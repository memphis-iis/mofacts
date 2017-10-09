(function(window) {
    var AUDIO_RECORDER_WORKER = 'lib/audioRecorderWorker.js';
    var AudioRecorder = function(source, cfg) {
	this.consumers = [];
	var config = cfg || {};
	var errorCallback = config.errorCallback || function() {};
	var inputBufferLength = config.inputBufferLength || 4096;
	var outputBufferLength = config.outputBufferLength || 4000;
	this.context = source.context;
	this.node = this.context.createScriptProcessor(inputBufferLength);
	var worker = new Worker(config.worker || AUDIO_RECORDER_WORKER);
	worker.postMessage({
	    command: 'init',
	    config: {
    		sampleRate: this.context.sampleRate,
    		outputBufferLength: outputBufferLength,
    		outputSampleRate: (config.outputSampleRate || 16000)
	    }
	});
	var recording = false;
	this.node.onaudioprocess = function(e) {
	    if (!recording) return;
	    worker.postMessage({
		command: 'record',
		buffer: [
		    e.inputBuffer.getChannelData(0),
		    e.inputBuffer.getChannelData(1)
		]
	    });
	};
	this.start = function(data) {
    //console.log("looking for user answer");
    //var userAnswer = document.getElementByID("userAnswer");
    //console.log("found user answer");
	    // this.consumers.forEach(function(consumer, y, z) {
      //           consumer.postMessage({ command: 'start', data: data });
      //   		recording = true;
      //   		return true;
	    // });
      this.consumers.forEach(function(callback){
        callback(data);
      });
	    recording = true;
	    return true;//return (this.consumers.length > 0);
	};
	this.stop = function() {
	    if (recording) {
    		// this.consumers.forEach(function(consumer, y, z) {
        //                 consumer.postMessage({ command: 'stop' });
    		// });
	      recording = false;
	    }
	    worker.postMessage({ command: 'clear' });
	};
	this.cancel = function() {
	    this.stop();
	};
	myClosure = this;
	worker.onmessage = function(e) {
	    if (e.data.error && (e.data.error == "silent")) errorCallback("silent");
	    if ((e.data.command == 'newBuffer') && recording) {
        console.log("RECORDING DATA:");
        console.log(e.data.data);
        myClosure.consumers.forEach(function(callback){
          callback(e.data.data);
        });
      	// myClosure.consumers.forEach(function(consumer, y, z) {
        //                 consumer.postMessage({ command: 'process', data: e.data.data });
      	// });
	    }
	};
	source.connect(this.node);
	this.node.connect(this.context.destination);
    };
    window.AudioRecorder = AudioRecorder;
})(window);
