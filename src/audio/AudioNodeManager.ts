// Audio node creation and management
import { TrackNodes } from './types'

export class AudioNodeManager {
  private audioContext: AudioContext
  public masterGain: GainNode
  public masterAnalyser: AnalyserNode
  public inputGain: GainNode
  public inputAnalyser: AnalyserNode
  public trackNodes: Map<number, TrackNodes> = new Map()
  
  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    
    // Create master nodes
    this.masterGain = audioContext.createGain()
    this.masterGain.gain.value = 1
    
    this.masterAnalyser = audioContext.createAnalyser()
    this.masterAnalyser.fftSize = 2048
    this.masterAnalyser.smoothingTimeConstant = 0.8
    
    // Create input nodes
    this.inputGain = audioContext.createGain()
    this.inputGain.gain.value = 0.8 // Slightly reduce input gain to prevent clipping
    
    this.inputAnalyser = audioContext.createAnalyser()
    this.inputAnalyser.fftSize = 2048
    
    // Connect master chain
    this.masterGain.connect(this.masterAnalyser)
    this.masterAnalyser.connect(audioContext.destination)
  }
  
  createTrackNodes(trackCount: number = 4): void {
    for (let trackId = 1; trackId <= trackCount; trackId++) {
      const gainNode = this.audioContext.createGain()
      const panNode = this.audioContext.createStereoPanner()
      const analyserNode = this.audioContext.createAnalyser()
      
      // Configure nodes
      gainNode.gain.value = 1
      panNode.pan.value = 0
      analyserNode.fftSize = 2048
      
      // Connect chain: source -> gain -> pan -> analyser -> master
      gainNode.connect(panNode)
      panNode.connect(analyserNode)
      analyserNode.connect(this.masterGain)
      
      this.trackNodes.set(trackId, {
        gainNode,
        panNode,
        analyserNode
      })
    }
  }
  
  getTrackNodes(trackId: number): TrackNodes | undefined {
    return this.trackNodes.get(trackId)
  }
  
  setTrackGain(trackId: number, gain: number, time?: number): void {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      const targetTime = time ?? this.audioContext.currentTime
      nodes.gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(1, gain)), 
        targetTime
      )
    }
  }
  
  setTrackPan(trackId: number, pan: number, time?: number): void {
    const nodes = this.trackNodes.get(trackId)
    if (nodes) {
      const targetTime = time ?? this.audioContext.currentTime
      nodes.panNode.pan.setValueAtTime(
        Math.max(-1, Math.min(1, pan)), 
        targetTime
      )
    }
  }
  
  connectInput(source: MediaStreamAudioSourceNode): void {
    console.log('[AudioNodeManager] Connecting input source...')
    source.connect(this.inputGain)
    this.inputGain.connect(this.inputAnalyser)
    // Important: DO NOT connect inputGain to any output here
    // The recorder will handle the connection
    console.log('[AudioNodeManager] Input connected (not to output to prevent feedback)')
  }
  
  disconnectInput(source: MediaStreamAudioSourceNode): void {
    try {
      source.disconnect(this.inputGain)
      this.inputGain.disconnect(this.inputAnalyser)
    } catch (e) {
      // Node may already be disconnected
    }
  }
  
  getInputLevel(): number {
    const dataArray = new Uint8Array(this.inputAnalyser.frequencyBinCount)
    this.inputAnalyser.getByteFrequencyData(dataArray)
    
    // Calculate average level
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    
    return sum / dataArray.length / 255 // Normalize to 0-1
  }
  
  dispose(): void {
    // Disconnect all nodes
    this.trackNodes.forEach(nodes => {
      nodes.gainNode.disconnect()
      nodes.panNode.disconnect()
      nodes.analyserNode.disconnect()
    })
    
    this.masterGain.disconnect()
    this.masterAnalyser.disconnect()
    this.inputGain.disconnect()
    this.inputAnalyser.disconnect()
    
    this.trackNodes.clear()
  }
}

// Crossfade utility for smooth transitions
export class Crossfader {
  private audioContext: AudioContext
  private fadeTime: number
  
  constructor(audioContext: AudioContext, fadeTime: number = 0.05) {
    this.audioContext = audioContext
    this.fadeTime = fadeTime
  }
  
  fadeIn(gainNode: GainNode, targetGain: number = 1): void {
    const now = this.audioContext.currentTime
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(targetGain, now + this.fadeTime)
  }
  
  fadeOut(gainNode: GainNode): void {
    const now = this.audioContext.currentTime
    gainNode.gain.cancelScheduledValues(now)
    gainNode.gain.setValueAtTime(gainNode.gain.value, now)
    gainNode.gain.linearRampToValueAtTime(0, now + this.fadeTime)
  }
  
  crossfade(fromNode: GainNode, toNode: GainNode, duration?: number): void {
    const fadeTime = duration ?? this.fadeTime
    const now = this.audioContext.currentTime
    
    // Fade out from
    fromNode.gain.cancelScheduledValues(now)
    fromNode.gain.setValueAtTime(fromNode.gain.value, now)
    fromNode.gain.linearRampToValueAtTime(0, now + fadeTime)
    
    // Fade in to
    toNode.gain.cancelScheduledValues(now)
    toNode.gain.setValueAtTime(0, now)
    toNode.gain.linearRampToValueAtTime(1, now + fadeTime)
  }
}