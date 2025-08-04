// AudioBufferRecorder - Low-latency recording with AudioWorklet
import { RecordingBuffer } from './types'

export class AudioBufferRecorder {
  private audioContext: AudioContext
  private workletNode: AudioWorkletNode | null = null
  private inputGain: GainNode
  private isRecording: boolean = false
  private recordingStartTime: number = 0
  private onProgress?: (time: number) => void
  private onComplete?: (buffer: RecordingBuffer) => void
  
  constructor(
    audioContext: AudioContext, 
    inputGain: GainNode
  ) {
    this.audioContext = audioContext
    this.inputGain = inputGain
  }
  
  async initialize(): Promise<void> {
    try {
      // Load AudioWorklet module
      console.log('[AudioBufferRecorder] Loading AudioWorklet module...')
      await this.audioContext.audioWorklet.addModule('/recorder-worklet.js')
      
      // Create worklet node
      this.workletNode = new AudioWorkletNode(
        this.audioContext, 
        'recorder-processor',
        {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            bufferSize: 128
          }
        }
      )
      
      // Handle messages from processor
      this.workletNode.port.onmessage = (event) => {
        switch (event.data.type) {
          case 'progress':
            this.handleProgress(event.data.bufferLength)
            break
            
          case 'recordingData':
            this.handleRecordingComplete(event.data.data)
            break
        }
      }
    } catch (error) {
      console.warn('AudioWorklet not supported, falling back to ScriptProcessor')
      throw error
    }
  }
  
  async start(channelCount: number = 2): Promise<void> {
    if (!this.workletNode) {
      throw new Error('Recorder not initialized')
    }
    
    if (this.isRecording) {
      throw new Error('Already recording')
    }
    
    console.log('[AudioBufferRecorder] Connecting audio chain...')
    // Connect audio chain
    this.inputGain.connect(this.workletNode)
    // Don't connect to destination - this causes feedback
    // this.workletNode.connect(this.audioContext.destination)
    
    // Start recording
    this.isRecording = true
    this.recordingStartTime = this.audioContext.currentTime
    
    this.workletNode.port.postMessage({
      type: 'start',
      channelCount
    })
  }
  
  stop(): void {
    if (!this.isRecording || !this.workletNode) return
    
    this.isRecording = false
    
    // Stop recording
    this.workletNode.port.postMessage({ type: 'stop' })
    
    // Disconnect
    this.inputGain.disconnect(this.workletNode)
    this.workletNode.disconnect()
  }
  
  private handleProgress(bufferLength: number): void {
    if (!this.isRecording) return
    
    const elapsed = this.audioContext.currentTime - this.recordingStartTime
    this.onProgress?.(elapsed)
  }
  
  private handleRecordingComplete(recordedData: any[]): void {
    console.log('[AudioBufferRecorder] Processing recorded data...', {
      chunks: recordedData.length,
      duration: this.audioContext.currentTime - this.recordingStartTime
    })
    
    if (recordedData.length === 0) {
      console.warn('[AudioBufferRecorder] No recorded data')
      return
    }
    
    const sampleRate = this.audioContext.sampleRate
    const numberOfChannels = recordedData[0].channelData ? recordedData[0].channelData.length : 2
    
    // Calculate total length and validate chunks
    let totalLength = 0
    let invalidChunks = 0
    
    for (const chunk of recordedData) {
      if (chunk.channelData && chunk.channelData[0]) {
        totalLength += chunk.channelData[0].length
        
        // Validate chunk data
        const firstChannel = chunk.channelData[0]
        if (firstChannel.some(v => !isFinite(v))) {
          invalidChunks++
          console.warn('[AudioBufferRecorder] Invalid chunk detected with NaN or Infinity values')
        }
      }
    }
    
    if (invalidChunks > 0) {
      console.error(`[AudioBufferRecorder] ${invalidChunks} invalid chunks detected!`)
    }
    
    console.log('[AudioBufferRecorder] Total samples to process:', totalLength)
    
    // Create channel buffers
    const channelData: Float32Array[] = []
    for (let ch = 0; ch < numberOfChannels; ch++) {
      channelData.push(new Float32Array(totalLength))
    }
    
    // Copy data from chunks to channel buffers
    let offset = 0
    for (const chunk of recordedData) {
      if (chunk.channelData) {
        const chunkLength = chunk.channelData[0].length
        for (let ch = 0; ch < numberOfChannels; ch++) {
          if (chunk.channelData[ch]) {
            channelData[ch].set(chunk.channelData[ch], offset)
          }
        }
        offset += chunkLength
      }
    }
    
    const buffer: RecordingBuffer = {
      trackId: 0, // Will be set by AudioEngine
      sampleRate,
      numberOfChannels,
      length: channelData[0].length,
      channelData
    }
    
    console.log('[AudioBufferRecorder] Recording buffer ready:', {
      length: buffer.length,
      channels: buffer.numberOfChannels,
      duration: buffer.length / buffer.sampleRate,
      firstSamples: channelData[0].slice(0, 10),
      maxValue: Math.max(...channelData[0].slice(0, 1000))
    })
    
    this.onComplete?.(buffer)
  }
  
  setProgressCallback(callback: (time: number) => void): void {
    this.onProgress = callback
  }
  
  setCompleteCallback(callback: (buffer: RecordingBuffer) => void): void {
    this.onComplete = callback
  }
  
  setNoiseFloor(value: number): void {
    // Noise floor setting removed - no longer processing audio in worklet
  }
  
  dispose(): void {
    this.stop()
    this.workletNode = null
  }
}