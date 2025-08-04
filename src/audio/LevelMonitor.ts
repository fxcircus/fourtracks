// Level monitoring for audio signals
import { LevelData } from './types'

export class LevelMonitor {
  private audioContext: AudioContext
  private masterAnalyser: AnalyserNode
  private inputAnalyser: AnalyserNode | null
  private trackAnalysers: Map<number, AnalyserNode>
  private animationFrameId: number | null = null
  private levelData: Float32Array
  private onLevelUpdate?: (levels: LevelData) => void
  private isActive: boolean = false
  
  constructor(
    audioContext: AudioContext,
    masterAnalyser: AnalyserNode,
    inputAnalyser: AnalyserNode | null,
    trackAnalysers: Map<number, AnalyserNode>
  ) {
    this.audioContext = audioContext
    this.masterAnalyser = masterAnalyser
    this.inputAnalyser = inputAnalyser
    this.trackAnalysers = trackAnalysers
    this.levelData = new Float32Array(masterAnalyser.fftSize)
  }
  
  start(callback: (levels: LevelData) => void): void {
    if (this.isActive) return
    
    this.isActive = true
    this.onLevelUpdate = callback
    this.monitor()
  }
  
  stop(): void {
    this.isActive = false
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }
  
  setInputAnalyser(analyser: AnalyserNode | null): void {
    this.inputAnalyser = analyser
  }
  
  private monitor(): void {
    if (!this.isActive) return
    
    const levels: LevelData = {
      tracks: {},
      master: { peak: 0, rms: 0 }
    }
    
    // Monitor master levels
    this.masterAnalyser.getFloatTimeDomainData(this.levelData)
    levels.master = this.calculateLevels(this.levelData)
    
    // Monitor track levels
    this.trackAnalysers.forEach((analyser, trackId) => {
      const data = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(data)
      levels.tracks[trackId] = this.calculateLevels(data)
    })
    
    // Monitor input if available
    if (this.inputAnalyser) {
      const inputData = new Float32Array(this.inputAnalyser.fftSize)
      this.inputAnalyser.getFloatTimeDomainData(inputData)
      levels.input = this.calculateLevels(inputData)
    }
    
    this.onLevelUpdate?.(levels)
    this.animationFrameId = requestAnimationFrame(() => this.monitor())
  }
  
  private calculateLevels(data: Float32Array): { peak: number; rms: number } {
    let peak = 0
    let sum = 0
    
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i])
      peak = Math.max(peak, abs)
      sum += abs * abs
    }
    
    const rms = Math.sqrt(sum / data.length)
    
    return {
      peak: Math.min(1, peak),
      rms: Math.min(1, rms)
    }
  }
  
  dispose(): void {
    this.stop()
  }
}

// Utility functions for decibel conversion
export function linearToDb(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : -Infinity
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

// Peak hold functionality for meters
export class PeakHold {
  private peaks: Map<string, { value: number; time: number }> = new Map()
  private holdTime: number = 2000 // 2 seconds
  
  update(key: string, value: number): number {
    const now = performance.now()
    const current = this.peaks.get(key)
    
    if (!current || value > current.value) {
      this.peaks.set(key, { value, time: now })
      return value
    }
    
    // Return held peak if within hold time
    if (now - current.time < this.holdTime) {
      return current.value
    }
    
    // Reset if hold time expired
    this.peaks.set(key, { value, time: now })
    return value
  }
  
  reset(key?: string): void {
    if (key) {
      this.peaks.delete(key)
    } else {
      this.peaks.clear()
    }
  }
}