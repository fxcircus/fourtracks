// Optimized Recorder AudioWorklet Processor
// Handles low-latency audio recording with proper memory management

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Configuration
    this.bufferSize = options.processorOptions?.bufferSize || 128;
    this.isRecording = false;
    this.recordedChunks = [];
    this.channelCount = 2;
    this.chunkIndex = 0;
    
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
    this.chunkIndex = 0;
    
    console.log('[RecorderProcessor] Started recording with', channelCount, 'channels at', sampleRate, 'Hz');
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    console.log('[RecorderProcessor] Stopped recording, chunks:', this.recordedChunks.length);
    
    // Prepare transferable arrays
    const transferableChunks = [];
    const transferList = [];
    
    // Convert chunks to transferable format
    for (const chunk of this.recordedChunks) {
      const transferableChunk = {
        channelData: [],
        timestamp: chunk.timestamp,
        index: chunk.index
      };
      
      // Create transferable arrays for each channel
      for (let ch = 0; ch < chunk.channelData.length; ch++) {
        const sourceData = chunk.channelData[ch];
        const buffer = new ArrayBuffer(sourceData.byteLength);
        const transferableArray = new Float32Array(buffer);
        
        // Copy data
        transferableArray.set(sourceData);
        
        transferableChunk.channelData.push(transferableArray);
        transferList.push(buffer);
      }
      
      transferableChunks.push(transferableChunk);
    }
    
    // Send with transfer of ownership
    this.port.postMessage({
      type: 'recordingData',
      data: transferableChunks,
      sampleRate: sampleRate,
      channelCount: this.channelCount
    }, transferList);
    
    this.recordedChunks = [];
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    // Pass through audio for monitoring (optional)
    if (input && outputs[0]) {
      for (let channel = 0; channel < Math.min(input.length, outputs[0].length); channel++) {
        if (outputs[0][channel] && input[channel]) {
          outputs[0][channel].set(input[channel]);
        }
      }
    }
    
    // Record if active
    if (this.isRecording && input && input.length > 0) {
      // Create chunk for this processing block
      const chunk = {
        channelData: [],
        timestamp: currentTime,
        index: this.chunkIndex++
      };
      
      // Copy audio data for each channel
      for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
        const inputData = input[channel];
        
        // Create a proper deep copy
        const channelCopy = new Float32Array(inputData.length);
        
        // Manual copy to ensure data integrity
        for (let i = 0; i < inputData.length; i++) {
          channelCopy[i] = inputData[i];
        }
        
        chunk.channelData.push(channelCopy);
      }
      
      // Store chunk
      this.recordedChunks.push(chunk);
      
      // Send progress updates periodically (every ~100ms)
      const progressInterval = Math.floor(sampleRate * 0.1 / this.bufferSize);
      if (this.chunkIndex % progressInterval === 0) {
        const duration = (this.chunkIndex * this.bufferSize) / sampleRate;
        this.port.postMessage({
          type: 'progress',
          bufferLength: this.recordedChunks.length,
          duration: duration
        });
      }
    }
    
    // Keep processor alive
    return true;
  }
}

// Register the processor
registerProcessor('recorder-processor', RecorderProcessor);