import { 
  AudioEngineConfig, 
  AudioEngineState, 
  Track,
  RecordingOptions,
  PlaybackOptions,
  AudioEngineEvents,
  AudioEngineEventHandler,
  RecordingBuffer
} from './types'
import { AudioBufferRecorder } from './AudioBufferRecorder'
import { ScriptProcessorRecorder } from './ScriptProcessorRecorder'
import { MediaRecorderWrapper } from './MediaRecorderWrapper'
import { AudioNodeManager } from './AudioNodeManager'
import { LevelMonitor } from './LevelMonitor'
import { PlaybackManager } from './PlaybackManager'

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private tracks: Map<number, Track> = new Map()
  private _state: AudioEngineState = AudioEngineState.IDLE
  private config: AudioEngineConfig
  private debugMode: boolean = true
  
  // Managers
  private nodeManager: AudioNodeManager | null = null
  private levelMonitor: LevelMonitor | null = null
  private playbackManager: PlaybackManager | null = null
  
  // Recording
  private mediaStream: MediaStream | null = null
  private inputSource: MediaStreamAudioSourceNode | null = null
  private recorder: AudioBufferRecorder | ScriptProcessorRecorder | MediaRecorderWrapper | null = null
  private currentRecordingTrack: number = 0
  
  // Events
  private eventHandlers: Map<keyof AudioEngineEvents, Set<Function>> = new Map()

  constructor(config?: Partial<AudioEngineConfig>) {
    this.config = {
      sampleRate: 48000,
      bufferSize: 4096, // Larger buffer size to prevent underruns
      numberOfChannels: 2,
      maxRecordingTime: 300,
      latencyHint: 'interactive',
      ...config
    }
    this.initializeTracks()
  }

  async initialize(): Promise<void> {
    try {
      console.log('[AudioEngine] Starting initialization...', {
        config: this.config,
        userAgent: navigator.userAgent
      })
      
      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
        latencyHint: this.config.latencyHint as AudioContextLatencyCategory
      })
      
      console.log('[AudioEngine] AudioContext created', {
        state: this.audioContext.state,
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency
      })
      
      if (this.audioContext.state === 'suspended') {
        console.log('[AudioEngine] AudioContext suspended, resuming...')
        await this.audioContext.resume()
        console.log('[AudioEngine] AudioContext resumed')
      }
      
      // Initialize managers
      console.log('[AudioEngine] Creating AudioNodeManager...')
      this.nodeManager = new AudioNodeManager(this.audioContext)
      this.nodeManager.createTrackNodes(4)
      console.log('[AudioEngine] Track nodes created')
      
      this.playbackManager = new PlaybackManager(this.audioContext, this.nodeManager)
      this.playbackManager.setEndCallback(() => {
        this.setState(AudioEngineState.STOPPED)
      })
      
      // Setup level monitoring
      this.setupLevelMonitoring()
      
      this.emit('initialized', {
        sampleRate: this.audioContext.sampleRate,
        baseLatency: this.audioContext.baseLatency
      })
      
      console.log('[AudioEngine] Initialization complete')
    } catch (error) {
      console.error('[AudioEngine] Initialization failed:', error)
      this.emit('error', new Error('Failed to initialize audio context'))
      throw error
    }
  }

  async startRecording(options: RecordingOptions): Promise<void> {
    console.log('[AudioEngine] startRecording called', options)
    
    if (!this.audioContext || !this.nodeManager) {
      throw new Error('Audio engine not initialized')
    }

    if (this.recorder) {
      throw new Error('Recording already in progress')
    }

    try {
      // First, enumerate available devices
      await this.logAvailableDevices()
      
      // Request microphone
      console.log('[AudioEngine] Requesting microphone access...', {
        deviceId: options.inputDeviceId,
        channelCount: this.config.numberOfChannels,
        sampleRate: this.config.sampleRate
      })
      
      console.log('[AudioEngine] Requesting getUserMedia with constraints:', {
        channelCount: this.config.numberOfChannels,
        sampleRate: this.config.sampleRate,
        deviceId: options.inputDeviceId,
        echoCancellation: false,
        noiseSuppression: false, // Disable to avoid audio corruption
        autoGainControl: false
      })
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.numberOfChannels,
          sampleRate: this.config.sampleRate,
          deviceId: options.inputDeviceId,
          echoCancellation: false,
          noiseSuppression: false, // Disable to avoid audio corruption
          autoGainControl: false
        }
      })
      
      console.log('[AudioEngine] Got media stream:', {
        id: this.mediaStream.id,
        active: this.mediaStream.active,
        tracks: this.mediaStream.getTracks().map(t => ({
          kind: t.kind,
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
          settings: t.getSettings()
        }))
      })

          // Setup recording chain
      console.log('[AudioEngine] Creating MediaStreamSourceNode...')
      this.inputSource = this.audioContext.createMediaStreamSource(this.mediaStream)
      console.log('[AudioEngine] Connecting input source to node manager...')
      this.nodeManager.connectInput(this.inputSource)
      
      // Create appropriate recorder
      console.log('[AudioEngine] Creating recorder...')
      await this.createRecorder()
      console.log('[AudioEngine] Recorder created:', this.recorder?.constructor.name)
      
      // No noise gate processing - recording raw audio
      
      // Set callbacks
      this.setupRecorderCallbacks(options.trackId)
      
      // Start recording
      console.log('[AudioEngine] Starting recorder...')
      await this.recorder!.start(this.config.numberOfChannels)
      this.currentRecordingTrack = options.trackId
      console.log('[AudioEngine] Recording started on track', options.trackId)
      
      // Update state
      this.setState(AudioEngineState.RECORDING)
      const track = this.tracks.get(options.trackId)
      if (track) track.isRecording = true
      
    } catch (error) {
      console.error('[AudioEngine] Recording start failed:', error)
      this.cleanup()
      this.emit('error', error as Error)
      throw error
    }
  }

  stopRecording(): void {
    console.log('[AudioEngine] stopRecording called')
    
    if (!this.recorder) {
      console.warn('[AudioEngine] No recorder to stop')
      return
    }
    
    console.log('[AudioEngine] Stopping recorder...')
    this.recorder.stop()
    // Don't dispose immediately - let the recorder finish processing
    // The recorder will be cleaned up after the complete callback
    
    const track = this.tracks.get(this.currentRecordingTrack)
    if (track) track.isRecording = false
    
    this.setState(AudioEngineState.IDLE)
  }

  async startPlayback(options?: Partial<PlaybackOptions>): Promise<void> {
    if (!this.audioContext || !this.playbackManager) {
      throw new Error('Audio engine not initialized')
    }
    
    const activeCount = this.playbackManager.start(this.tracks, options)
    
    if (activeCount > 0) {
      this.setState(AudioEngineState.PLAYING)
      this.startPlaybackProgress()
    }
  }

  stopPlayback(): void {
    if (!this.playbackManager) return
    
    this.playbackManager.stop()
    this.tracks.forEach(track => track.isPlaying = false)
    this.setState(AudioEngineState.STOPPED)
  }

  // Track controls
  setTrackVolume(trackId: number, volume: number): void {
    const track = this.tracks.get(trackId)
    if (track && this.nodeManager) {
      track.volume = Math.max(0, Math.min(1, volume))
      this.updateTrackGain(trackId)
    }
  }
  
  setTrackPan(trackId: number, pan: number): void {
    const track = this.tracks.get(trackId)
    if (track && this.nodeManager) {
      track.pan = Math.max(-1, Math.min(1, pan))
      this.nodeManager.setTrackPan(trackId, track.pan)
    }
  }
  
  muteTrack(trackId: number, mute: boolean): void {
    const track = this.tracks.get(trackId)
    if (track) {
      track.isMuted = mute
      this.updateTrackGain(trackId)
    }
  }
  
  soloTrack(trackId: number, solo: boolean): void {
    const track = this.tracks.get(trackId)
    if (track) {
      track.isSolo = solo
      this.tracks.forEach((_, id) => this.updateTrackGain(id))
    }
  }

  // Getters
  getTrack(trackId: number): Track | undefined {
    return this.tracks.get(trackId)
  }

  getAllTracks(): Track[] {
    return Array.from(this.tracks.values())
  }

  getState(): AudioEngineState {
    return this._state
  }
  
  getNodeManager(): AudioNodeManager | null {
    return this.nodeManager
  }

  // Events
  on<K extends keyof AudioEngineEvents>(
    event: K, 
    handler: AudioEngineEventHandler<K>
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)?.add(handler)
  }

  off<K extends keyof AudioEngineEvents>(
    event: K, 
    handler: AudioEngineEventHandler<K>
  ): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  dispose(): void {
    this.stopRecording()
    this.stopPlayback()
    this.cleanup()
    
    this.levelMonitor?.dispose()
    this.playbackManager?.dispose()
    this.nodeManager?.dispose()
    
    this.audioContext?.close()
    this.audioContext = null
    this.eventHandlers.clear()
  }
  
  // Debug method to test audio chain
  async debugAudioChain(): Promise<{
    contextState: string
    hasMediaStream: boolean
    inputLevel: number
    recorderType: string
    isRecording: boolean
    tracks: number
  }> {
    if (!this.audioContext || !this.nodeManager) {
      throw new Error('Audio engine not initialized')
    }
    
    // Get current input level
    const inputLevel = this.nodeManager.getInputLevel()
    
    return {
      contextState: this.audioContext.state,
      hasMediaStream: !!this.mediaStream,
      inputLevel,
      recorderType: this.recorder?.constructor.name || 'none',
      isRecording: this.state === AudioEngineState.RECORDING,
      tracks: this.tracks.size
    }
  }
  
  // Test audio input directly
  async testAudioInput(): Promise<{
    hasSignal: boolean
    maxLevel: number
    avgLevel: number
  }> {
    if (!this.mediaStream || !this.audioContext) {
      throw new Error('No media stream available')
    }
    
    return new Promise((resolve) => {
      const source = this.audioContext!.createMediaStreamSource(this.mediaStream!)
      const analyser = this.audioContext!.createAnalyser()
      analyser.fftSize = 2048
      
      source.connect(analyser)
      
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      
      let maxLevel = 0
      let avgLevel = 0
      let sampleCount = 0
      
      const checkLevel = () => {
        analyser.getByteTimeDomainData(dataArray)
        
        let sum = 0
        let max = 0
        
        for (let i = 0; i < bufferLength; i++) {
          const value = Math.abs(dataArray[i] - 128) / 128 // Normalize to -1 to 1
          sum += value
          if (value > max) max = value
        }
        
        avgLevel = sum / bufferLength
        if (max > maxLevel) maxLevel = max
        
        sampleCount++
        
        if (sampleCount < 50) { // Sample for ~1 second
          requestAnimationFrame(checkLevel)
        } else {
          source.disconnect()
          analyser.disconnect()
          
          resolve({
            hasSignal: maxLevel > 0.01,
            maxLevel,
            avgLevel
          })
        }
      }
      
      checkLevel()
    })
  }

  // Private methods
  private initializeTracks(): void {
    for (let i = 1; i <= 4; i++) {
      this.tracks.set(i, {
        id: i,
        name: `Track ${i}`,
        audioBuffer: null,
        isRecording: false,
        isPlaying: false,
        isMuted: false,
        isSolo: false,
        volume: 1,
        pan: 0,
        peakLevel: 0,
        rmsLevel: 0
      })
    }
  }

  private setupLevelMonitoring(): void {
    if (!this.audioContext || !this.nodeManager) return
    
    this.levelMonitor = new LevelMonitor(
      this.audioContext,
      this.nodeManager.masterAnalyser,
      this.nodeManager.inputAnalyser,
      new Map(Array.from(this.nodeManager.trackNodes.entries()).map(
        ([id, nodes]) => [id, nodes.analyserNode]
      ))
    )
    
    this.levelMonitor.start((levels) => {
      this.emit('levelUpdate', levels)
    })
  }

  private async createRecorder(): Promise<void> {
    if (!this.audioContext || !this.nodeManager) return
    
    // Use MediaRecorderWrapper as primary recorder for better compatibility
    try {
      console.log('[AudioEngine] Creating MediaRecorderWrapper as primary recorder...')
      this.recorder = new MediaRecorderWrapper(
        this.audioContext, 
        this.nodeManager.inputGain
      )
      await this.recorder.initialize()
      console.log('[AudioEngine] MediaRecorderWrapper created successfully')
    } catch (e) {
      console.warn('[AudioEngine] MediaRecorderWrapper failed, trying AudioBufferRecorder:', e)
      
      // Fallback to AudioBufferRecorder
      try {
        console.log('[AudioEngine] Attempting to create AudioBufferRecorder...')
        this.recorder = new AudioBufferRecorder(
          this.audioContext, 
          this.nodeManager.inputGain
        )
        await this.recorder.initialize()
        console.log('[AudioEngine] AudioBufferRecorder created successfully')
      } catch (e2) {
        console.warn('[AudioEngine] AudioBufferRecorder failed, falling back to ScriptProcessor:', e2)
        // Final fallback to ScriptProcessor
        this.recorder = new ScriptProcessorRecorder(
          this.audioContext,
          this.nodeManager.inputGain,
          this.config.bufferSize
        )
        console.log('[AudioEngine] ScriptProcessorRecorder created')
      }
    }
  }

  private setupRecorderCallbacks(trackId: number): void {
    if (!this.recorder) return
    
    console.log('[AudioEngine] Setting up recorder callbacks for track', trackId)
    
    this.recorder.setProgressCallback((time) => {
      if (this.debugMode && Math.floor(time) % 1 === 0) {
        console.log('[AudioEngine] Recording progress:', time.toFixed(2), 'seconds')
      }
      this.emit('recordingProgress', trackId, time)
      if (time >= this.config.maxRecordingTime) {
        console.log('[AudioEngine] Max recording time reached, stopping...')
        this.stopRecording()
      }
    })
    
    this.recorder.setCompleteCallback((buffer) => {
      console.log('[AudioEngine] Recording complete callback received', {
        trackId,
        length: buffer.length,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate
      })
      this.processRecordingBuffer(trackId, buffer)
    })
  }

  private emit<K extends keyof AudioEngineEvents>(
    event: K,
    ...args: Parameters<AudioEngineEvents[K]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    handlers?.forEach(handler => (handler as Function)(...args))
  }

  private setState(state: AudioEngineState): void {
    this._state = state
    this.emit('stateChanged', state)
  }

  private updateTrackGain(trackId: number): void {
    const track = this.tracks.get(trackId)
    if (!track || !this.nodeManager) return
    
    const hasSolo = Array.from(this.tracks.values()).some(t => t.isSolo)
    let gain = track.volume
    
    if (track.isMuted || (hasSolo && !track.isSolo)) {
      gain = 0
    }
    
    this.nodeManager.setTrackGain(trackId, gain)
  }

  private processRecordingBuffer(trackId: number, buffer: RecordingBuffer): void {
    if (!this.audioContext) {
      console.error('[AudioEngine] No audio context for processing buffer')
      return
    }
    
    console.log('[AudioEngine] Processing recording buffer...', {
      trackId,
      bufferLength: buffer.length,
      duration: buffer.length / buffer.sampleRate
    })
    
    const audioBuffer = this.audioContext.createBuffer(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    )
    
    // Check if we have actual audio data
    let hasAudio = false
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const channelData = buffer.channelData[ch]
      audioBuffer.copyToChannel(channelData, ch)
      
      // Check for non-zero samples
      const maxValue = Math.max(...channelData.slice(0, Math.min(1000, channelData.length)))
      if (maxValue > 0) {
        hasAudio = true
      }
      console.log(`[AudioEngine] Channel ${ch} max value:`, maxValue)
    }
    
    if (!hasAudio) {
      console.warn('[AudioEngine] WARNING: Recording buffer contains silence!')
    }
    
    const track = this.tracks.get(trackId)
    if (track) {
      track.audioBuffer = audioBuffer
      console.log('[AudioEngine] Audio buffer assigned to track', trackId)
      this.emit('recordingComplete', trackId, audioBuffer.duration)
      
      // Clean up the recorder after successful processing
      if (this.recorder) {
        console.log('[AudioEngine] Disposing recorder after successful processing')
        this.recorder.dispose()
        this.recorder = null
      }
      
      // Clean up media stream and input
      this.cleanup()
    } else {
      console.error('[AudioEngine] Track not found:', trackId)
    }
  }

  private cleanup(): void {
    if (this.inputSource && this.nodeManager) {
      this.nodeManager.disconnectInput(this.inputSource)
      this.inputSource = null
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
    }
  }

  private startPlaybackProgress(): void {
    const updateProgress = () => {
      if (this._state === AudioEngineState.PLAYING && this.playbackManager) {
        const elapsed = this.playbackManager.getElapsedTime()
        this.emit('playbackProgress', elapsed)
        requestAnimationFrame(updateProgress)
      }
    }
    updateProgress()
  }
  
  // Helper method to enumerate available audio devices
  private async logAvailableDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(d => d.kind === 'audioinput')
      console.log('[AudioEngine] Available audio input devices:', audioInputs.map(d => ({
        deviceId: d.deviceId,
        label: d.label || 'Unnamed device',
        groupId: d.groupId
      })))
    } catch (error) {
      console.error('[AudioEngine] Failed to enumerate devices:', error)
    }
  }
  
  // Public method to get available input devices
  async getInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      return devices.filter(device => device.kind === 'audioinput')
    } catch (error) {
      console.error('[AudioEngine] Failed to get input devices:', error)
      return []
    }
  }
  
}