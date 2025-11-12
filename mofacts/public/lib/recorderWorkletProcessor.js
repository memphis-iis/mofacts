/**
 * AudioWorklet processor that mirrors the legacy ScriptProcessorNode behavior for Recorder.js.
 * It forwards mono input frames to the main thread via port messages so they can be batched
 * and encoded inside the existing audioRecorderWorker.
 */
class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super({
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
  }

  process(inputs, outputs) {
    const inputChannels = inputs[0];
    if (inputChannels && inputChannels[0] && inputChannels[0].length) {
      const channelData = inputChannels[0];
      // Clone the buffer so the structured clone that backs postMessage stays valid.
      const frame =
        typeof channelData.slice === 'function'
          ? channelData.slice()
          : new Float32Array(channelData);
      this.port.postMessage(frame);
    }

    // Ensure downstream nodes remain silent (prevents mic monitoring/feedback).
    const outputChannels = outputs[0];
    if (outputChannels && outputChannels[0]) {
      outputChannels[0].fill(0);
    }

    return true;
  }
}

registerProcessor('recorder-worklet-processor', RecorderWorkletProcessor);
