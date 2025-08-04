// AudioBufferRecorder with Diagnostics - Enhanced recording with detailed debugging
import { RecordingBuffer } from './types'

interface RecorderChunk {
  channelData: Float32Array[]
  timestamp: number
  chunkIndex: number
  sampleIndex: number
}

interface RecorderDiagnostics {
  totalSamples: number
  droppedSamples: number
  chunkSizes: number[]
  timestamps: number[]
  sineTestPassed: boolean
}

export class AudioBufferRecorderDiagnostic {
  private audioContext: AudioContext
  private workletNode: AudioWorkletNode | null = null
  private inputGain: GainNode
  private isRecording: boolean = false
  private recordingStartTime: number = 0
  private onProgress?: (time: number) => void
  private onComplete?: (buffer: RecordingBuffer) => void
  private diagnosticMode: boolean = true
  
  constructor(
    audioContext: AudioContext, 
    inputGain: GainNode
  ) {
    this.audioContext = audioContext
    this.inputGain = inputGain
  }
  
  async initialize(): Promise<void> {
    try {
      // Load diagnostic AudioWorklet module
      console.log('[AudioBufferRecorderDiagnostic] Loading diagnostic AudioWorklet module...')
      await this.audioContext.audioWorklet.addModule('/recorder-worklet-diagnostic.js')
      
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
            this.handleProgress(event.data)
            break
            
          case 'recordingData':
            this.handleRecordingComplete(event.data.data, event.data.diagnostics)
            break
            
          case 'sineTestData':
            this.handleSineTestData(event.data)
            break
        }
      }
      
      console.log('[AudioBufferRecorderDiagnostic] Initialized successfully')
    } catch (error) {
      console.error('[AudioBufferRecorderDiagnostic] Initialization failed:', error)
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
    
    console.log('[AudioBufferRecorderDiagnostic] Starting recording...')
    console.log('AudioContext state:', this.audioContext.state)
    console.log('AudioContext sample rate:', this.audioContext.sampleRate)
    console.log('Requested channels:', channelCount)
    
    // Connect audio chain
    this.inputGain.connect(this.workletNode)
    
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
    
    console.log('[AudioBufferRecorderDiagnostic] Stopping recording...')
    this.isRecording = false
    
    // Stop recording
    this.workletNode.port.postMessage({ type: 'stop' })
    
    // Disconnect
    this.inputGain.disconnect(this.workletNode)
    this.workletNode.disconnect()
  }
  
  // Test sine wave generation
  async testSineWave(): Promise<void> {
    if (!this.workletNode) {
      throw new Error('Recorder not initialized')
    }
    
    console.log('[AudioBufferRecorderDiagnostic] Testing sine wave generation...')
    this.workletNode.port.postMessage({ type: 'test-sine' })
  }
  
  private handleProgress(data: any): void {
    if (!this.isRecording) return
    
    const elapsed = data.duration || (this.audioContext.currentTime - this.recordingStartTime)
    
    if (this.diagnosticMode) {
      console.log('[AudioBufferRecorderDiagnostic] Progress:', {
        elapsed: elapsed.toFixed(2),
        chunks: data.bufferLength,
        samples: data.totalSamples,
        samplesPerSecond: data.totalSamples / elapsed
      })
    }
    
    this.onProgress?.(elapsed)
  }
  
  private handleRecordingComplete(recordedData: RecorderChunk[], diagnostics: RecorderDiagnostics): void {
    console.log('[AudioBufferRecorderDiagnostic] Processing recorded data...')
    console.log('Diagnostics:', diagnostics)
    
    if (recordedData.length === 0) {
      console.error('[AudioBufferRecorderDiagnostic] No recorded data!')
      return
    }
    
    // Analyze chunk consistency
    const chunkAnalysis = this.analyzeChunks(recordedData)
    console.log('Chunk analysis:', chunkAnalysis)
    
    const sampleRate = this.audioContext.sampleRate
    const numberOfChannels = recordedData[0].channelData.length
    
    // Calculate total length
    let totalLength = 0
    for (const chunk of recordedData) {
      if (chunk.channelData && chunk.channelData[0]) {
        totalLength += chunk.channelData[0].length
      }
    }
    
    console.log('Buffer reconstruction:', {
      chunks: recordedData.length,
      totalLength,
      expectedDuration: totalLength / sampleRate,
      actualDuration: this.audioContext.currentTime - this.recordingStartTime
    })
    
    // Create channel buffers
    const channelData: Float32Array[] = []
    for (let ch = 0; ch < numberOfChannels; ch++) {
      channelData.push(new Float32Array(totalLength))
    }
    
    // Copy data from chunks to channel buffers with validation
    let offset = 0
    let corruptedChunks = 0
    
    for (let i = 0; i < recordedData.length; i++) {
      const chunk = recordedData[i]
      
      if (chunk.channelData) {
        const chunkLength = chunk.channelData[0].length
        
        // Validate chunk data
        const isCorrupted = this.isChunkCorrupted(chunk)
        if (isCorrupted) {
          corruptedChunks++
          console.warn(`Chunk ${i} appears corrupted:`, {
            index: chunk.chunkIndex,
            timestamp: chunk.timestamp,
            samples: chunkLength
          })
        }
        
        // Copy data for each channel
        for (let ch = 0; ch < numberOfChannels; ch++) {
          if (chunk.channelData[ch]) {
            channelData[ch].set(chunk.channelData[ch], offset)
          }
        }
        offset += chunkLength
      }
    }
    
    if (corruptedChunks > 0) {
      console.error(`${corruptedChunks} corrupted chunks detected!`)
    }
    
    // Analyze the final buffer
    const bufferAnalysis = this.analyzeBuffer(channelData)
    console.log('Final buffer analysis:', bufferAnalysis)
    
    const buffer: RecordingBuffer = {
      trackId: 0,
      sampleRate,
      numberOfChannels,
      length: channelData[0].length,
      channelData
    }
    
    this.onComplete?.(buffer)
  }
  
  private handleSineTestData(data: any): void {
    console.log('[AudioBufferRecorderDiagnostic] Sine test data received:', {
      chunks: data.data.length,
      frequency: data.frequency,
      duration: data.duration,
      amplitude: data.amplitude
    })
    
    // Process sine test data like regular recording
    this.handleRecordingComplete(data.data, {
      totalSamples: data.data.length * 128,
      droppedSamples: 0,
      chunkSizes: data.data.map(() => 128),
      timestamps: data.data.map((_, i) => i * 128 / this.audioContext.sampleRate),
      sineTestPassed: true
    })
  }
  
  private analyzeChunks(chunks: RecorderChunk[]): any {
    const analysis = {
      totalChunks: chunks.length,
      sampleCounts: new Set<number>(),
      timestampGaps: [] as number[],
      indexGaps: [] as number[],
      sampleIndexContinuity: true
    }
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      analysis.sampleCounts.add(chunk.channelData[0].length)
      
      if (i > 0) {
        const prevChunk = chunks[i - 1]
        const timestampGap = chunk.timestamp - prevChunk.timestamp
        const expectedGap = prevChunk.channelData[0].length / this.audioContext.sampleRate
        
        if (Math.abs(timestampGap - expectedGap) > 0.001) {
          analysis.timestampGaps.push(i)
        }
        
        if (chunk.chunkIndex !== prevChunk.chunkIndex + 1) {
          analysis.indexGaps.push(i)
        }
        
        const expectedSampleIndex = prevChunk.sampleIndex + prevChunk.channelData[0].length
        if (chunk.sampleIndex !== expectedSampleIndex) {
          analysis.sampleIndexContinuity = false
        }
      }
    }
    
    return {
      ...analysis,
      sampleCounts: Array.from(analysis.sampleCounts),
      hasTimestampGaps: analysis.timestampGaps.length > 0,
      hasIndexGaps: analysis.indexGaps.length > 0
    }
  }
  
  private isChunkCorrupted(chunk: RecorderChunk): boolean {
    // Check for common corruption patterns
    const firstChannel = chunk.channelData[0]
    
    // Check if all samples are the same (stuck value)
    const firstValue = firstChannel[0]
    const allSame = firstChannel.every(v => v === firstValue)
    if (allSame && firstChannel.length > 10) return true
    
    // Check for extreme values
    const hasExtreme = firstChannel.some(v => Math.abs(v) > 10)
    if (hasExtreme) return true
    
    // Check for NaN or Infinity
    const hasInvalid = firstChannel.some(v => !isFinite(v))
    if (hasInvalid) return true
    
    return false
  }
  
  private analyzeBuffer(channelData: Float32Array[]): any {
    const analysis = {
      channels: channelData.length,
      length: channelData[0].length,
      duration: channelData[0].length / this.audioContext.sampleRate,
      channelStats: [] as any[]
    }
    
    for (let ch = 0; ch < channelData.length; ch++) {
      const data = channelData[ch]
      let min = Infinity
      let max = -Infinity
      let sum = 0
      let sumSquares = 0
      let zeroCount = 0
      
      for (let i = 0; i < data.length; i++) {
        const value = data[i]
        min = Math.min(min, value)
        max = Math.max(max, value)
        sum += value
        sumSquares += value * value
        if (value === 0) zeroCount++
      }
      
      const mean = sum / data.length
      const rms = Math.sqrt(sumSquares / data.length)
      const silenceRatio = zeroCount / data.length
      
      // Find peak frequency using simple FFT
      const peakFreq = this.findPeakFrequency(data.slice(0, Math.min(8192, data.length)))
      
      analysis.channelStats.push({
        channel: ch,
        min,
        max,
        mean,
        rms,
        silenceRatio,
        peakFrequency: peakFreq,
        firstSamples: Array.from(data.slice(0, 10)),
        lastSamples: Array.from(data.slice(-10))
      })
    }
    
    return analysis
  }
  
  private findPeakFrequency(samples: Float32Array): number {
    // Simple peak detection - not a full FFT
    // Count zero crossings to estimate frequency
    let zeroCrossings = 0
    let prevSample = samples[0]
    
    for (let i = 1; i < samples.length; i++) {
      if ((prevSample < 0 && samples[i] >= 0) || (prevSample >= 0 && samples[i] < 0)) {
        zeroCrossings++
      }
      prevSample = samples[i]
    }
    
    const duration = samples.length / this.audioContext.sampleRate
    const frequency = zeroCrossings / (2 * duration)
    
    return frequency
  }
  
  setProgressCallback(callback: (time: number) => void): void {
    this.onProgress = callback
  }
  
  setCompleteCallback(callback: (buffer: RecordingBuffer) => void): void {
    this.onComplete = callback
  }
  
  setDiagnosticMode(enabled: boolean): void {
    this.diagnosticMode = enabled
  }
  
  dispose(): void {
    this.stop()
    this.workletNode = null
  }
}