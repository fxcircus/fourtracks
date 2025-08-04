// Audio-related type definitions

export interface Track {
  id: number
  name: string
  audioBuffer: AudioBuffer | null
  isRecording: boolean
  isPlaying: boolean
  isMuted: boolean
  isSolo: boolean
  volume: number
  pan: number
  peakLevel: number
  rmsLevel: number
}

export interface AudioEngineConfig {
  sampleRate: number
  bufferSize: number
  numberOfChannels: number
  maxRecordingTime: number // in seconds
  latencyHint: 'interactive' | 'balanced' | 'playback'
}

export interface RecordingOptions {
  trackId: number
  inputDeviceId?: string
}

export interface PlaybackOptions {
  loop: boolean
  startTime: number
  endTime: number
}

export enum AudioEngineState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped'
}

export interface AudioEngineEvents {
  stateChanged: (state: AudioEngineState) => void
  recordingProgress: (trackId: number, time: number) => void
  playbackProgress: (time: number) => void
  error: (error: Error) => void
  levelUpdate: (levels: LevelData) => void
  initialized: (info: { sampleRate: number; baseLatency: number }) => void
  recordingComplete: (trackId: number, duration: number) => void
}

export type AudioEngineEventHandler<K extends keyof AudioEngineEvents> = 
  AudioEngineEvents[K]

export interface TrackNodes {
  gainNode: GainNode
  panNode: StereoPannerNode
  analyserNode: AnalyserNode
}

export interface AudioNodeMap {
  [trackId: number]: TrackNodes
}

export interface LevelData {
  input?: {
    peak: number
    rms: number
  }
  tracks: {
    [trackId: number]: {
      peak: number
      rms: number
    }
  }
  master: {
    peak: number
    rms: number
  }
}

export interface RecordingBuffer {
  trackId: number
  sampleRate: number
  numberOfChannels: number
  length: number
  channelData: Float32Array[]
}