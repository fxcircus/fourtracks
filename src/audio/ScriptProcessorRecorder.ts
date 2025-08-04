// ScriptProcessor fallback for browsers without AudioWorklet support
import { RecordingBuffer } from './types'

export class ScriptProcessorRecorder {
  private audioContext: AudioContext
  private inputGain: GainNode
  private processor: ScriptProcessorNode | null = null
  private isRecording: boolean = false
  private recordingBuffer: Float32Array[] = []
  private recordingStartTime: number = 0
  private bufferSize: number = 4096
  private onProgress?: (time: number) => void
  private onComplete?: (buffer: RecordingBuffer) => void
  
  constructor(
    audioContext: AudioContext,
    inputGain: GainNode,
    bufferSize: number = 4096
  ) {
    this.audioContext = audioContext
    this.inputGain = inputGain
    this.bufferSize = bufferSize
  }
  
  async start(channelCount: number = 2): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording')
    }
    
    console.log('[ScriptProcessorRecorder] Starting recording...', {
      channelCount,
      bufferSize: this.bufferSize,
      sampleRate: this.audioContext.sampleRate
    })
    
    // Create processor
    this.processor = this.audioContext.createScriptProcessor(
      this.bufferSize,
      channelCount,
      channelCount
    )
    
    // Process audio
    let sampleCount = 0
    let lastSample = new Array(channelCount).fill(0) // For click prevention
    
    this.processor.onaudioprocess = (event) => {
      if (!this.isRecording) return
      
      const inputBuffer = event.inputBuffer
      
      // Process each channel
      for (let ch = 0; ch < inputBuffer.numberOfChannels; ch++) {
        const channelData = inputBuffer.getChannelData(ch)
        const processedData = new Float32Array(channelData.length)
        
        // Copy samples with DC offset removal and click prevention
        for (let i = 0; i < channelData.length; i++) {
          let sample = channelData[i]
          
          // Apply simple DC offset removal
          if (isNaN(sample) || !isFinite(sample)) {
            sample = lastSample[ch] // Use last valid sample if current is invalid
          }
          
          // Store the processed sample
          processedData[i] = sample
          lastSample[ch] = sample
        }
        
        // Store the processed buffer
        this.recordingBuffer.push(processedData)
        
        // Log first few samples to verify we're getting audio
        if (sampleCount < 5) {
          const maxValue = Math.max(...Array.from(channelData).map(Math.abs))
          console.log(`[ScriptProcessorRecorder] Channel ${ch} sample ${sampleCount} max:`, maxValue)
        }
      }
      
      sampleCount++
      
      // Progress callback - throttle to reduce overhead
      if (sampleCount % 10 === 0) {
        const elapsed = this.audioContext.currentTime - this.recordingStartTime
        this.onProgress?.(elapsed)
      }
    }
    
    // Connect chain
    console.log('[ScriptProcessorRecorder] Connecting audio nodes...')
    this.inputGain.connect(this.processor)
    // Connect to destination with zero gain to ensure proper timing
    // This is required for ScriptProcessor to work correctly
    const silentGain = this.audioContext.createGain()
    silentGain.gain.value = 0
    this.processor.connect(silentGain)
    silentGain.connect(this.audioContext.destination)
    
    this.isRecording = true
    this.recordingStartTime = this.audioContext.currentTime
    this.recordingBuffer = []
  }
  
  stop(): void {
    if (!this.isRecording || !this.processor) return
    
    console.log('[ScriptProcessorRecorder] Stopping recording...')
    this.isRecording = false
    
    // Process recorded data
    const duration = this.audioContext.currentTime - this.recordingStartTime
    console.log('[ScriptProcessorRecorder] Recording stopped', {
      duration,
      bufferCount: this.recordingBuffer.length
    })
    const numberOfChannels = 2
    
    const channelData = this.organizeChannelData(numberOfChannels, duration)
    
    // Verify we have actual audio data
    const hasAudio = channelData.some(channel => {
      const maxValue = Math.max(...Array.from(channel.slice(0, 1000)).map(Math.abs))
      return maxValue > 0
    })
    
    console.log('[ScriptProcessorRecorder] Audio check:', { hasAudio })
    
    const buffer: RecordingBuffer = {
      trackId: 0,
      sampleRate: this.audioContext.sampleRate,
      numberOfChannels,
      length: Math.floor(duration * this.audioContext.sampleRate),
      channelData
    }
    
    // Cleanup
    this.inputGain.disconnect(this.processor)
    this.processor.disconnect()
    this.processor.onaudioprocess = null // Important: clear the callback to prevent memory leak
    this.processor = null
    
    this.onComplete?.(buffer)
  }
  
  private organizeChannelData(
    numberOfChannels: number, 
    duration: number
  ): Float32Array[] {
    const sampleRate = this.audioContext.sampleRate
    const totalLength = Math.floor(duration * sampleRate)
    const channelData: Float32Array[] = []
    
    console.log('[ScriptProcessorRecorder] Organizing channel data...', {
      numberOfChannels,
      totalLength,
      bufferCount: this.recordingBuffer.length
    })
    
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelBuffer = new Float32Array(totalLength)
      let offset = 0
      
      for (let i = ch; i < this.recordingBuffer.length; i += numberOfChannels) {
        const chunk = this.recordingBuffer[i]
        if (offset + chunk.length <= totalLength) {
          channelBuffer.set(chunk, offset)
          offset += chunk.length
        }
      }
      
      console.log(`[ScriptProcessorRecorder] Channel ${ch} total samples:`, offset)
      channelData.push(channelBuffer)
    }
    
    return channelData
  }
  
  setProgressCallback(callback: (time: number) => void): void {
    this.onProgress = callback
  }
  
  setCompleteCallback(callback: (buffer: RecordingBuffer) => void): void {
    this.onComplete = callback
  }
  
  dispose(): void {
    this.stop()
  }
}