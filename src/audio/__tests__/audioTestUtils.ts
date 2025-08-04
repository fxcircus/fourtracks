import { MockAudioBuffer, MockAnalyserNode } from '../../test/mocks/webAudioMock';

/**
 * Audio testing utilities for FourTracks
 * Provides helper functions for creating test audio data and analyzing audio properties
 */

/**
 * Generate a sine wave for testing
 */
export function generateSineWave(
  frequency: number,
  duration: number,
  sampleRate: number,
  amplitude: number = 1
): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  const angularFreq = 2 * Math.PI * frequency / sampleRate;
  
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * Math.sin(angularFreq * i);
  }
  
  return buffer;
}

/**
 * Generate white noise for testing
 */
export function generateWhiteNoise(
  duration: number,
  sampleRate: number,
  amplitude: number = 1
): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    buffer[i] = amplitude * (Math.random() * 2 - 1);
  }
  
  return buffer;
}

/**
 * Generate a click/impulse for latency testing
 */
export function generateClick(
  sampleRate: number,
  clickDuration: number = 0.001
): Float32Array {
  const samples = Math.floor(clickDuration * sampleRate);
  const buffer = new Float32Array(samples);
  
  // Create a short burst
  for (let i = 0; i < samples; i++) {
    buffer[i] = 1 - (i / samples);
  }
  
  return buffer;
}

/**
 * Generate a sweep for frequency response testing
 */
export function generateSweep(
  startFreq: number,
  endFreq: number,
  duration: number,
  sampleRate: number
): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(samples);
  
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = startFreq * Math.pow(endFreq / startFreq, t / duration);
    const phase = 2 * Math.PI * freq * t;
    buffer[i] = Math.sin(phase);
  }
  
  return buffer;
}

/**
 * Create a mock audio buffer with test data
 */
export function createTestAudioBuffer(
  audioContext: { sampleRate: number; createBuffer: Function },
  duration: number,
  testSignal: 'sine' | 'noise' | 'silence' | 'click' = 'sine',
  frequency: number = 440
): MockAudioBuffer {
  const buffer = new MockAudioBuffer(2, duration * audioContext.sampleRate, audioContext.sampleRate);
  
  let data: Float32Array;
  switch (testSignal) {
    case 'sine':
      data = generateSineWave(frequency, duration, audioContext.sampleRate);
      break;
    case 'noise':
      data = generateWhiteNoise(duration, audioContext.sampleRate, 0.5);
      break;
    case 'click':
      data = generateClick(audioContext.sampleRate);
      break;
    case 'silence':
    default:
      data = new Float32Array(duration * audioContext.sampleRate);
  }
  
  // Copy to both channels
  buffer.copyToChannel(data, 0);
  buffer.copyToChannel(data, 1);
  
  return buffer;
}

/**
 * Calculate RMS (Root Mean Square) of an audio buffer
 */
export function calculateRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Calculate peak level of an audio buffer
 */
export function calculatePeak(buffer: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < buffer.length; i++) {
    peak = Math.max(peak, Math.abs(buffer[i]));
  }
  return peak;
}

/**
 * Calculate THD (Total Harmonic Distortion) for a sine wave
 */
export function calculateTHD(
  buffer: Float32Array,
  fundamentalFreq: number,
  sampleRate: number
): number {
  // Simplified THD calculation for testing
  // In real implementation, would use FFT
  const rms = calculateRMS(buffer);
  const peak = calculatePeak(buffer);
  
  // Rough approximation based on crest factor
  const crestFactor = peak / rms;
  const idealCrestFactor = Math.sqrt(2); // For pure sine wave
  
  return Math.abs(crestFactor - idealCrestFactor) / idealCrestFactor;
}

/**
 * Detect clipping in audio buffer
 */
export function detectClipping(buffer: Float32Array, threshold: number = 0.99): number {
  let clippedSamples = 0;
  
  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i]) >= threshold) {
      clippedSamples++;
    }
  }
  
  return clippedSamples;
}

/**
 * Measure latency between two buffers (e.g., for round-trip testing)
 */
export function measureLatency(
  reference: Float32Array,
  recorded: Float32Array,
  sampleRate: number
): number | null {
  // Find first peak in reference
  const refThreshold = calculatePeak(reference) * 0.5;
  let refPeakIndex = -1;
  
  for (let i = 0; i < reference.length; i++) {
    if (Math.abs(reference[i]) >= refThreshold) {
      refPeakIndex = i;
      break;
    }
  }
  
  if (refPeakIndex === -1) return null;
  
  // Find corresponding peak in recorded
  const recThreshold = calculatePeak(recorded) * 0.5;
  let recPeakIndex = -1;
  
  for (let i = refPeakIndex; i < recorded.length; i++) {
    if (Math.abs(recorded[i]) >= recThreshold) {
      recPeakIndex = i;
      break;
    }
  }
  
  if (recPeakIndex === -1) return null;
  
  const latencySamples = recPeakIndex - refPeakIndex;
  return (latencySamples / sampleRate) * 1000; // Return in milliseconds
}

/**
 * Verify stereo separation
 */
export function verifyStereoSeparation(
  leftChannel: Float32Array,
  rightChannel: Float32Array
): number {
  let correlation = 0;
  let leftPower = 0;
  let rightPower = 0;
  
  for (let i = 0; i < leftChannel.length; i++) {
    correlation += leftChannel[i] * rightChannel[i];
    leftPower += leftChannel[i] * leftChannel[i];
    rightPower += rightChannel[i] * rightChannel[i];
  }
  
  const normalizedCorrelation = correlation / Math.sqrt(leftPower * rightPower);
  return 1 - Math.abs(normalizedCorrelation); // 0 = mono, 1 = complete separation
}

/**
 * Create analyser test data
 */
export function setAnalyserTestData(
  analyser: MockAnalyserNode,
  level: number = 0.5,
  frequency: number = 1000
): void {
  const fftSize = analyser.fftSize;
  const timeDomainData = new Float32Array(fftSize);
  
  // Generate simple sine wave for time domain
  for (let i = 0; i < fftSize; i++) {
    timeDomainData[i] = level * Math.sin(2 * Math.PI * frequency * i / 44100);
  }
  
  analyser.setTimeDomainData(timeDomainData);
  
  // Set frequency data (simplified)
  const freqData = new Float32Array(analyser.frequencyBinCount);
  const binIndex = Math.floor(frequency / (44100 / fftSize));
  if (binIndex < freqData.length) {
    freqData[binIndex] = -20 + level * 60; // dB value
  }
  
  analyser.setFrequencyData(freqData);
}

/**
 * Wait for a specific number of audio processing cycles
 */
export async function waitForAudioCycles(
  cycles: number,
  bufferSize: number = 256,
  sampleRate: number = 44100
): Promise<void> {
  const cycleDuration = (bufferSize / sampleRate) * 1000; // ms
  await new Promise(resolve => setTimeout(resolve, cycles * cycleDuration));
}

/**
 * Assert audio buffer is silent
 */
export function assertSilent(
  buffer: Float32Array,
  threshold: number = 0.001
): boolean {
  return calculatePeak(buffer) < threshold;
}

/**
 * Assert audio buffers are equal within tolerance
 */
export function assertAudioEqual(
  buffer1: Float32Array,
  buffer2: Float32Array,
  tolerance: number = 0.0001
): boolean {
  if (buffer1.length !== buffer2.length) return false;
  
  for (let i = 0; i < buffer1.length; i++) {
    if (Math.abs(buffer1[i] - buffer2[i]) > tolerance) {
      return false;
    }
  }
  
  return true;
}

/**
 * Performance measurement helper
 */
export class AudioPerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();
  
  startMeasure(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      
      this.measurements.get(label)!.push(duration);
    };
  }
  
  getStats(label: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    median: number;
  } | null {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return null;
    
    const sorted = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    
    return {
      count: times.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / times.length,
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }
  
  reset(label?: string): void {
    if (label) {
      this.measurements.delete(label);
    } else {
      this.measurements.clear();
    }
  }
}