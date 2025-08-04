// Diagnostic Recorder AudioWorklet Processor
// This version includes extensive logging and diagnostic capabilities

class RecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    
    // Configuration
    this.bufferSize = options.processorOptions?.bufferSize || 128;
    this.isRecording = false;
    this.recordedChunks = [];
    this.channelCount = 2;
    this.chunkCount = 0;
    this.sampleCount = 0;
    
    // Diagnostic data
    this.diagnostics = {
      totalSamples: 0,
      droppedSamples: 0,
      chunkSizes: [],
      timestamps: [],
      sineTestPassed: false
    };
    
    // Message handling
    this.port.onmessage = (event) => {
      switch (event.data.type) {
        case 'start':
          this.startRecording(event.data.channelCount || 2);
          break;
          
        case 'stop':
          this.stopRecording();
          break;
          
        case 'test-sine':
          this.testSineWave();
          break;
      }
    };
    
    console.log('[RecorderProcessor] Initialized with buffer size:', this.bufferSize);
  }
  
  startRecording(channelCount) {
    this.isRecording = true;
    this.channelCount = channelCount;
    this.recordedChunks = [];
    this.chunkCount = 0;
    this.sampleCount = 0;
    this.diagnostics = {
      totalSamples: 0,
      droppedSamples: 0,
      chunkSizes: [],
      timestamps: [],
      sineTestPassed: false
    };
    
    console.log('[RecorderProcessor] Started recording:', {
      channelCount,
      sampleRate,
      bufferSize: this.bufferSize
    });
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    
    this.isRecording = false;
    
    console.log('[RecorderProcessor] Stopped recording:', {
      chunks: this.recordedChunks.length,
      totalSamples: this.sampleCount,
      diagnostics: this.diagnostics
    });
    
    // Convert chunks to transferable buffers for efficient transfer
    const transferableChunks = this.recordedChunks.map(chunk => {
      const transferableChunk = {
        channelData: chunk.channelData.map(channel => {
          // Create a new buffer that can be transferred
          const buffer = new ArrayBuffer(channel.byteLength);
          const view = new Float32Array(buffer);
          view.set(channel);
          return view;
        }),
        timestamp: chunk.timestamp,
        chunkIndex: chunk.chunkIndex,
        sampleIndex: chunk.sampleIndex
      };
      return transferableChunk;
    });
    
    // Get all the ArrayBuffers for transfer
    const transferList = [];
    transferableChunks.forEach(chunk => {
      chunk.channelData.forEach(channelData => {
        transferList.push(channelData.buffer);
      });
    });
    
    // Send with transferable objects
    this.port.postMessage({
      type: 'recordingData',
      data: transferableChunks,
      diagnostics: this.diagnostics
    }, transferList);
    
    this.recordedChunks = [];
  }
  
  testSineWave() {
    console.log('[RecorderProcessor] Testing sine wave generation');
    
    const testDuration = 1; // 1 second
    const frequency = 440; // A4
    const amplitude = 0.5;
    const numSamples = sampleRate * testDuration;
    const numChannels = 2;
    
    const testChunks = [];
    const samplesPerChunk = 128;
    
    for (let i = 0; i < numSamples; i += samplesPerChunk) {
      const chunk = {
        channelData: [],
        timestamp: i / sampleRate,
        chunkIndex: Math.floor(i / samplesPerChunk),
        sampleIndex: i
      };
      
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = new Float32Array(samplesPerChunk);
        for (let s = 0; s < samplesPerChunk; s++) {
          const sampleIndex = i + s;
          if (sampleIndex < numSamples) {
            channelData[s] = amplitude * Math.sin(2 * Math.PI * frequency * sampleIndex / sampleRate);
          }
        }
        chunk.channelData.push(channelData);
      }
      
      testChunks.push(chunk);
    }
    
    // Send test data
    this.port.postMessage({
      type: 'sineTestData',
      data: testChunks,
      frequency,
      duration: testDuration,
      amplitude
    });
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
      const currentTime = this.sampleCount / sampleRate;
      
      // Log first few chunks for debugging
      if (this.chunkCount < 5) {
        const firstChannel = input[0];
        const stats = this.calculateStats(firstChannel);
        console.log(`[RecorderProcessor] Chunk ${this.chunkCount}:`, {
          timestamp: currentTime.toFixed(3),
          samples: firstChannel.length,
          min: stats.min.toFixed(4),
          max: stats.max.toFixed(4),
          rms: stats.rms.toFixed(4),
          firstSamples: Array.from(firstChannel.slice(0, 10)).map(v => v.toFixed(4))
        });
      }
      
      // Create chunk with metadata
      const chunk = {
        channelData: [],
        timestamp: currentTime,
        chunkIndex: this.chunkCount,
        sampleIndex: this.sampleCount
      };
      
      // Store audio data for each channel
      for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
        const inputData = input[channel];
        
        // CRITICAL: Create a proper copy of the input data
        // The input arrays are reused by the audio thread!
        const channelBuffer = new Float32Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          channelBuffer[i] = inputData[i];
        }
        
        chunk.channelData.push(channelBuffer);
      }
      
      // Store chunk
      this.recordedChunks.push(chunk);
      
      // Update counters
      this.chunkCount++;
      this.sampleCount += input[0].length;
      this.diagnostics.totalSamples = this.sampleCount;
      this.diagnostics.chunkSizes.push(input[0].length);
      this.diagnostics.timestamps.push(currentTime);
      
      // Send progress update periodically
      if (this.chunkCount % Math.floor(sampleRate / this.bufferSize / 10) === 0) {
        this.port.postMessage({
          type: 'progress',
          bufferLength: this.recordedChunks.length,
          totalSamples: this.sampleCount,
          duration: currentTime
        });
      }
    }
    
    // Keep processor alive
    return true;
  }
  
  calculateStats(samples) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSquares = 0;
    
    for (let i = 0; i < samples.length; i++) {
      const value = samples[i];
      min = Math.min(min, value);
      max = Math.max(max, value);
      sum += value;
      sumSquares += value * value;
    }
    
    const mean = sum / samples.length;
    const rms = Math.sqrt(sumSquares / samples.length);
    
    return { min, max, mean, rms };
  }
}

// Register the processor
registerProcessor('recorder-processor', RecorderProcessor);