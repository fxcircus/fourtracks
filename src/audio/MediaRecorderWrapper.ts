// MediaRecorderWrapper - Recording using MediaRecorder API for better compatibility
import { RecordingBuffer } from './types'

export class MediaRecorderWrapper {
  private audioContext: AudioContext
  private inputGain: GainNode
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private recordedChunks: Blob[] = []
  private isRecording: boolean = false
  private isProcessing: boolean = false
  private recordingStartTime: number = 0
  private onProgress?: (time: number) => void
  private onComplete?: (buffer: RecordingBuffer) => void
  private progressInterval: number | null = null
  private channelCount: number = 2
  
  constructor(
    audioContext: AudioContext, 
    inputGain: GainNode
  ) {
    this.audioContext = audioContext
    this.inputGain = inputGain
  }
  
  async initialize(): Promise<void> {
    console.log('[MediaRecorderWrapper] Initializing...')
    // MediaRecorder doesn't require pre-initialization like AudioWorklet
    // We'll create the recorder when start() is called
  }
  
  async start(channelCount: number = 2): Promise<void> {
    if (this.isRecording) {
      throw new Error('Already recording')
    }
    
    this.channelCount = channelCount
    console.log('[MediaRecorderWrapper] Starting recording with', channelCount, 'channels')
    
    try {
      // Ensure audio context is running
      if (this.audioContext.state === 'suspended') {
        console.log('[MediaRecorderWrapper] Audio context suspended, resuming...')
        await this.audioContext.resume()
      }
      // Create a MediaStreamDestination to capture the audio from Web Audio API
      const destination = this.audioContext.createMediaStreamDestination()
      
      // Connect the input to the destination
      this.inputGain.connect(destination)
      
      // Store the stream
      this.mediaStream = destination.stream
      
      // Determine the best mime type for the browser
      const mimeType = this.getSupportedMimeType()
      console.log('[MediaRecorderWrapper] Using mime type:', mimeType)
      
      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType,
        audioBitsPerSecond: 128000 // 128kbps for good quality
      })
      
      // Reset recorded chunks
      console.log('[MediaRecorderWrapper] Resetting recordedChunks in start()')
      console.trace('[MediaRecorderWrapper] Stack trace for chunk reset in start()')
      this.recordedChunks = []
      
      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        console.log('[MediaRecorderWrapper] ondataavailable fired, data size:', event.data.size)
        console.log('[MediaRecorderWrapper] Current recordedChunks array:', this.recordedChunks)
        console.log('[MediaRecorderWrapper] isRecording:', this.isRecording, 'isProcessing:', this.isProcessing)
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data)
          console.log('[MediaRecorderWrapper] Chunk received, size:', event.data.size, 'total chunks:', this.recordedChunks.length)
        }
      }
      
      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('[MediaRecorderWrapper] onstop event fired')
        console.log('[MediaRecorderWrapper] Final chunks count:', this.recordedChunks.length)
        console.log('[MediaRecorderWrapper] isProcessing:', this.isProcessing)
        console.log('[MediaRecorderWrapper] Current recordedChunks:', this.recordedChunks)
        
        // Double-check we have chunks before processing
        if (this.recordedChunks.length === 0) {
          console.error('[MediaRecorderWrapper] CRITICAL: Chunks lost before onstop!')
          console.trace('[MediaRecorderWrapper] Stack trace for missing chunks')
        }
        
        // Process immediately - no delay needed
        this.processRecording()
      }
      
      // Handle errors
      this.mediaRecorder.onerror = (event) => {
        console.error('[MediaRecorderWrapper] Recording error:', event)
        this.stop()
      }
      
      // Start recording
      this.isRecording = true
      this.recordingStartTime = this.audioContext.currentTime
      // Use a longer timeslice to avoid too many small chunks
      this.mediaRecorder.start(500) // Request data every 500ms
      
      // Start progress reporting
      this.startProgressReporting()
      
      console.log('[MediaRecorderWrapper] Recording started')
    } catch (error) {
      console.error('[MediaRecorderWrapper] Failed to start recording:', error)
      this.cleanup()
      throw error
    }
  }
  
  stop(): void {
    if (!this.isRecording || !this.mediaRecorder) return
    
    console.log('[MediaRecorderWrapper] Stopping recording...')
    console.log('[MediaRecorderWrapper] Current chunks before stop:', this.recordedChunks.length)
    console.log('[MediaRecorderWrapper] mediaRecorder state:', this.mediaRecorder.state)
    this.isRecording = false
    
    // Stop progress reporting
    this.stopProgressReporting()
    
    // Stop the MediaRecorder (this will trigger onstop event)
    if (this.mediaRecorder.state !== 'inactive') {
      // Mark that we're about to process to prevent premature cleanup
      this.isProcessing = true
      
      // Request any remaining data before stopping
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.requestData()
      }
      this.mediaRecorder.stop()
    }
    
    // Don't disconnect audio nodes or cleanup here - wait for onstop event
    // The MediaRecorder will trigger onstop which calls processRecording
    // which will handle cleanup after processing is complete
  }
  
  private getSupportedMimeType(): string {
    // Check if MediaRecorder is supported at all
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder API is not supported in this browser')
    }
    
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
      'audio/mpeg'
    ]
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    
    // Fallback to default
    console.warn('[MediaRecorderWrapper] No specific mime type supported, using browser default')
    return ''
  }
  
  private startProgressReporting(): void {
    this.progressInterval = window.setInterval(() => {
      if (this.isRecording) {
        const elapsed = this.audioContext.currentTime - this.recordingStartTime
        this.onProgress?.(elapsed)
      }
    }, 100) // Report progress every 100ms
  }
  
  private stopProgressReporting(): void {
    if (this.progressInterval !== null) {
      clearInterval(this.progressInterval)
      this.progressInterval = null
    }
  }
  
  private async processRecording(): Promise<void> {
    if (this.recordedChunks.length === 0) {
      console.warn('[MediaRecorderWrapper] No recorded chunks to process')
      this.isProcessing = false
      return
    }
    
    // Create a defensive copy of chunks immediately to prevent any loss
    const chunksToProcess = [...this.recordedChunks]
    console.log('[MediaRecorderWrapper] Created defensive copy of', chunksToProcess.length, 'chunks')
    
    // Verify we captured the chunks
    if (chunksToProcess.length === 0) {
      console.error('[MediaRecorderWrapper] ERROR: Chunks were lost before processing!')
      this.isProcessing = false
      return
    }
    
    try {
      // Log chunk information for debugging
      console.log('[MediaRecorderWrapper] Processing', chunksToProcess.length, 'chunks')
      chunksToProcess.forEach((chunk, index) => {
        console.log(`[MediaRecorderWrapper] Chunk ${index}: size=${chunk.size}, type=${chunk.type}`)
      })
      const totalSize = chunksToProcess.reduce((sum, chunk) => sum + chunk.size, 0)
      console.log('[MediaRecorderWrapper] Total size from chunks:', totalSize, 'bytes')
      
      // Get the mime type from the first chunk
      const mimeType = chunksToProcess[0].type || this.getSupportedMimeType()
      console.log('[MediaRecorderWrapper] Using mime type for blob:', mimeType)
      
      // Combine all chunks into a single Blob
      const audioBlob = new Blob(chunksToProcess, { type: mimeType })
      console.log('[MediaRecorderWrapper] Created audio blob, size:', audioBlob.size, 'type:', audioBlob.type)
      
      // Clear the original chunks array only after blob is created
      console.log('[MediaRecorderWrapper] Clearing recordedChunks after blob creation')
      console.trace('[MediaRecorderWrapper] Stack trace for chunk clear after blob')
      this.recordedChunks = []
      
      // Convert Blob to ArrayBuffer
      const arrayBuffer = await audioBlob.arrayBuffer()
      console.log('[MediaRecorderWrapper] Converted to ArrayBuffer, size:', arrayBuffer.byteLength)
      
      // Decode the audio data
      console.log('[MediaRecorderWrapper] Decoding audio data...')
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer)
      console.log('[MediaRecorderWrapper] Decoded audio buffer:', {
        duration: audioBuffer.duration,
        numberOfChannels: audioBuffer.numberOfChannels,
        sampleRate: audioBuffer.sampleRate,
        length: audioBuffer.length
      })
      
      // Create RecordingBuffer format matching AudioBufferRecorder output
      const channelData: Float32Array[] = []
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        channelData.push(audioBuffer.getChannelData(ch))
      }
      
      // Verify we have actual audio data
      let hasAudio = false
      for (let ch = 0; ch < channelData.length; ch++) {
        const maxValue = Math.max(...channelData[ch].slice(0, Math.min(1000, channelData[ch].length)))
        if (maxValue > 0.001) {
          hasAudio = true
        }
        console.log(`[MediaRecorderWrapper] Channel ${ch} max value:`, maxValue)
      }
      
      if (!hasAudio) {
        console.warn('[MediaRecorderWrapper] WARNING: Recording appears to be silent!')
      }
      
      const buffer: RecordingBuffer = {
        trackId: 0, // Will be set by AudioEngine
        sampleRate: audioBuffer.sampleRate,
        numberOfChannels: audioBuffer.numberOfChannels,
        length: audioBuffer.length,
        channelData
      }
      
      console.log('[MediaRecorderWrapper] Recording buffer ready, calling complete callback')
      this.onComplete?.(buffer)
      
    } catch (error) {
      console.error('[MediaRecorderWrapper] Failed to process recording:', error)
    } finally {
      // Clear processing flag
      this.isProcessing = false
      // Now safe to cleanup
      this.cleanup()
    }
  }
  
  private cleanup(): void {
    // Disconnect audio nodes
    if (this.inputGain) {
      try {
        this.inputGain.disconnect()
      } catch (e) {
        // Ignore disconnect errors
      }
    }
    
    // Stop any tracks in the media stream
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
    
    // Only clear recorded chunks if we're not processing
    if (!this.isProcessing) {
      console.log('[MediaRecorderWrapper] Clearing recordedChunks in cleanup()')
      console.trace('[MediaRecorderWrapper] Stack trace for chunk clear in cleanup()')
      this.recordedChunks = []
    }
    
    // Clear MediaRecorder
    this.mediaRecorder = null
  }
  
  setProgressCallback(callback: (time: number) => void): void {
    this.onProgress = callback
  }
  
  setCompleteCallback(callback: (buffer: RecordingBuffer) => void): void {
    this.onComplete = callback
  }
  
  setNoiseFloor(value: number): void {
    // Not applicable for MediaRecorder - this was specific to AudioWorklet implementation
  }
  
  dispose(): void {
    console.log('[MediaRecorderWrapper] dispose() called')
    console.log('[MediaRecorderWrapper] Current state - isRecording:', this.isRecording, 'isProcessing:', this.isProcessing)
    console.log('[MediaRecorderWrapper] Current chunks:', this.recordedChunks.length)
    
    // If we're still processing, don't cleanup yet
    if (this.isProcessing) {
      console.log('[MediaRecorderWrapper] Still processing, skipping cleanup in dispose')
      return
    }
    
    this.stop()
    this.cleanup()
  }
}