// Playback management for audio tracks
import { Track, PlaybackOptions } from './types'
import { AudioNodeManager } from './AudioNodeManager'

export class PlaybackManager {
  private audioContext: AudioContext
  private nodeManager: AudioNodeManager
  private playbackSources: Map<number, AudioBufferSourceNode> = new Map()
  private playbackStartTime: number = 0
  private onEnded?: () => void
  
  constructor(audioContext: AudioContext, nodeManager: AudioNodeManager) {
    this.audioContext = audioContext
    this.nodeManager = nodeManager
  }
  
  start(
    tracks: Map<number, Track>, 
    options?: Partial<PlaybackOptions>
  ): number {
    // Stop any current playback
    this.stop()
    
    const playOptions = {
      loop: false,
      startTime: 0,
      endTime: 0,
      ...options
    }
    
    this.playbackStartTime = this.audioContext.currentTime
    let activeCount = 0
    
    // Start playback for each track with audio
    tracks.forEach((track, trackId) => {
      if (track.audioBuffer && !track.isMuted) {
        const source = this.audioContext.createBufferSource()
        source.buffer = track.audioBuffer
        source.loop = playOptions.loop
        
        const trackNode = this.nodeManager.getTrackNodes(trackId)
        if (trackNode) {
          source.connect(trackNode.gainNode)
          
          // Handle playback end
          source.onended = () => {
            this.playbackSources.delete(trackId)
            track.isPlaying = false
            
            if (this.playbackSources.size === 0) {
              this.onEnded?.()
            }
          }
          
          // Calculate playback duration
          const duration = playOptions.endTime || track.audioBuffer.duration
          const playDuration = duration - playOptions.startTime
          
          // Start playback
          source.start(0, playOptions.startTime, playDuration)
          
          this.playbackSources.set(trackId, source)
          track.isPlaying = true
          activeCount++
        }
      }
    })
    
    return activeCount
  }
  
  stop(): void {
    this.playbackSources.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch (e) {
        // Source may already be stopped
      }
    })
    
    this.playbackSources.clear()
  }
  
  pause(): void {
    // Web Audio API doesn't support pause directly
    // Would need to implement by stopping and tracking position
    this.stop()
  }
  
  getElapsedTime(): number {
    if (this.playbackSources.size === 0) return 0
    return this.audioContext.currentTime - this.playbackStartTime
  }
  
  isPlaying(): boolean {
    return this.playbackSources.size > 0
  }
  
  setEndCallback(callback: () => void): void {
    this.onEnded = callback
  }
  
  dispose(): void {
    this.stop()
    this.onEnded = undefined
  }
}

// Transport controls for more advanced playback features
export class TransportControls {
  private audioContext: AudioContext
  private playbackManager: PlaybackManager
  private isLooping: boolean = false
  private loopStart: number = 0
  private loopEnd: number = 0
  
  constructor(
    audioContext: AudioContext, 
    playbackManager: PlaybackManager
  ) {
    this.audioContext = audioContext
    this.playbackManager = playbackManager
  }
  
  setLoop(enabled: boolean, start?: number, end?: number): void {
    this.isLooping = enabled
    if (start !== undefined) this.loopStart = start
    if (end !== undefined) this.loopEnd = end
  }
  
  getTransportTime(): number {
    return this.playbackManager.getElapsedTime()
  }
  
  seek(time: number): void {
    // Stop current playback and restart from new position
    const wasPlaying = this.playbackManager.isPlaying()
    if (wasPlaying) {
      this.playbackManager.stop()
      // Would need to restart from new position
    }
  }
}