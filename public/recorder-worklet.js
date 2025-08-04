// Recorder AudioWorklet Processor
// Handles low-latency audio recording with minimal artifacts

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Configuration
    this.bufferSize = options.processorOptions?.bufferSize || 128;
    this.isRecording = false;
    this.recordedChunks = [];
    this.channelCount = 2;
    
    // Message handling
    this.port.onmessage = (event) => {
      switch (event.data.type) {
        case 'start':
          this.startRecording(event.data.channelCount || 2);
          break;
          
        case 'stop':
          this.stopRecording();
          break;
      }
    };
  }
  
  startRecording(channelCount) {
    this.isRecording = true;
    this.channelCount = channelCount;
    this.recordedChunks = [];
    console.log('[RecorderProcessor] Started recording with', channelCount, 'channels');
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    console.log('[RecorderProcessor] Stopped recording, chunks:', this.recordedChunks.length);
    
    // Send recorded data back to main thread
    this.port.postMessage({
      type: 'recordingData',
      data: this.recordedChunks
    });
    
    this.recordedChunks = [];
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Pass through audio (for monitoring if needed)
    if (input && outputs[0]) {
      for (let channel = 0; channel < input.length; channel++) {
        if (outputs[0][channel]) {
          outputs[0][channel].set(input[channel]);
        }
      }
    }
    
    // Record if active
    if (this.isRecording && input && input.length > 0) {
      // Create a single chunk with all channels
      const chunk = {
        channelData: [],
        timestamp: currentTime
      };
      
      // Store audio data for each channel WITHOUT any processing
      for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
        const inputData = input[channel];
        // CRITICAL FIX: Create a proper copy of the input data
        // The input arrays are reused by the audio thread!
        const channelBuffer = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          channelBuffer[i] = inputData[i];
        }
        chunk.channelData.push(channelBuffer);
      }
      
      // Store the multi-channel chunk
      this.recordedChunks.push(chunk);
      
      // Send progress update periodically (every ~100ms)
      if (this.recordedChunks.length % Math.floor(sampleRate / this.bufferSize / 10) === 0) {
        this.port.postMessage({
          type: 'progress',
          bufferLength: this.recordedChunks.length
        });
      }
    }
    
    // Keep processor alive
    return true;
  }
  
}

// Register the processor
registerProcessor('recorder-processor', RecorderProcessor);