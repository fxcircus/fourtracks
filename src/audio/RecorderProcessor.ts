// AudioWorklet processor for low-latency recording
// This file will be loaded as a module in the AudioWorklet

class RecorderProcessor extends AudioWorkletProcessor {
  private isRecording: boolean = false
  private bufferSize: number = 128
  private recordBuffer: Float32Array[] = []
  private channelCount: number = 2
  
  constructor() {
    super()
    
    // Handle messages from main thread
    this.port.onmessage = (event) => {
      switch (event.data.type) {
        case 'start':
          this.isRecording = true
          this.recordBuffer = []
          this.channelCount = event.data.channelCount || 2
          break
          
        case 'stop':
          this.isRecording = false
          // Send recorded data back
          this.port.postMessage({
            type: 'recordingData',
            data: this.recordBuffer
          })
          this.recordBuffer = []
          break
          
        case 'getBuffer':
          // Send current buffer without stopping
          this.port.postMessage({
            type: 'bufferData',
            data: [...this.recordBuffer]
          })
          break
      }
    }
  }
  
  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0]
    const output = outputs[0]
    
    if (!input || input.length === 0) return true
    
    // Pass through audio for monitoring
    for (let channel = 0; channel < input.length; channel++) {
      if (output[channel]) {
        output[channel].set(input[channel])
      }
    }
    
    // Record if active
    if (this.isRecording) {
      // Clone the input data
      for (let channel = 0; channel < Math.min(input.length, this.channelCount); channel++) {
        this.recordBuffer.push(new Float32Array(input[channel]))
      }
      
      // Send progress update every ~100ms (depends on sample rate)
      if (this.recordBuffer.length % 1000 === 0) {
        this.port.postMessage({
          type: 'progress',
          bufferLength: this.recordBuffer.length
        })
      }
    }
    
    return true
  }
}

// Register the processor
registerProcessor('recorder-processor', RecorderProcessor)