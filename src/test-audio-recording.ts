// Test script for audio recording noise issues
import { AudioEngine } from './audio/AudioEngine'

export async function testAudioRecording() {
  console.log('=== Audio Recording Test ===')
  
  const engine = new AudioEngine({
    sampleRate: 48000,
    bufferSize: 4096,
    numberOfChannels: 2,
    latencyHint: 'interactive'
  })
  
  try {
    // Initialize engine
    await engine.initialize()
    console.log('✓ Audio engine initialized')
    
    // Get debug info
    const debugInfo = await engine.debugAudioChain()
    console.log('Debug info:', debugInfo)
    
    // Set up recording callbacks
    engine.on('recordingProgress', (trackId, time) => {
      if (Math.floor(time) % 1 === 0) {
        console.log(`Recording progress: ${time.toFixed(1)}s`)
      }
    })
    
    engine.on('recordingComplete', (trackId, duration) => {
      console.log(`✓ Recording complete on track ${trackId}, duration: ${duration.toFixed(2)}s`)
      
      // Analyze the recorded buffer
      const track = engine.getTrack(trackId)
      if (track?.audioBuffer) {
        analyzeRecordingForNoise(track.audioBuffer)
      }
    })
    
    engine.on('error', (error) => {
      console.error('❌ Error:', error)
    })
    
    // Start recording on track 1
    console.log('Starting 5-second recording test...')
    await engine.startRecording({ trackId: 1 })
    
    // Record for 5 seconds
    setTimeout(() => {
      console.log('Stopping recording...')
      engine.stopRecording()
      
      // Clean up
      setTimeout(() => {
        engine.dispose()
        console.log('✓ Test complete')
      }, 1000)
    }, 5000)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    engine.dispose()
  }
}

function analyzeRecordingForNoise(buffer: AudioBuffer) {
  console.log('\n=== Noise Analysis ===')
  console.log(`Sample rate: ${buffer.sampleRate}`)
  console.log(`Duration: ${buffer.duration}s`)
  console.log(`Channels: ${buffer.numberOfChannels}`)
  
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch)
    
    // Analyze for clicking patterns
    let clickCount = 0
    let maxJump = 0
    let totalEnergy = 0
    
    for (let i = 1; i < data.length; i++) {
      const jump = Math.abs(data[i] - data[i-1])
      if (jump > 0.1) { // Sudden jump indicates click
        clickCount++
      }
      if (jump > maxJump) {
        maxJump = jump
      }
      totalEnergy += Math.abs(data[i])
    }
    
    const avgEnergy = totalEnergy / data.length
    const clickRate = clickCount / buffer.duration
    
    console.log(`\nChannel ${ch}:`)
    console.log(`- Average energy: ${avgEnergy.toFixed(6)}`)
    console.log(`- Click count: ${clickCount}`)
    console.log(`- Click rate: ${clickRate.toFixed(1)} clicks/second`)
    console.log(`- Max sample jump: ${maxJump.toFixed(4)}`)
    
    // Check for regular patterns (periodic noise)
    const fftSize = 2048
    const samples = data.slice(0, fftSize)
    const hasPeriodicNoise = checkForPeriodicNoise(samples)
    console.log(`- Periodic noise detected: ${hasPeriodicNoise ? 'YES' : 'NO'}`)
  }
}

function checkForPeriodicNoise(samples: Float32Array): boolean {
  // Simple autocorrelation to detect periodic patterns
  const maxLag = Math.floor(samples.length / 4)
  let maxCorrelation = 0
  
  for (let lag = 1; lag < maxLag; lag++) {
    let correlation = 0
    for (let i = 0; i < samples.length - lag; i++) {
      correlation += samples[i] * samples[i + lag]
    }
    correlation /= samples.length - lag
    
    if (Math.abs(correlation) > maxCorrelation) {
      maxCorrelation = Math.abs(correlation)
    }
  }
  
  // If we find strong correlation at non-zero lag, there's periodic noise
  return maxCorrelation > 0.1
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAudioRecording()
}