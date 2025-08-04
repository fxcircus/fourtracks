// Example usage of the AudioEngine for single-track recording

import { AudioEngine, AudioEngineState } from './index'

async function setupAudioRecorder() {
  // Create audio engine with low-latency configuration
  const audioEngine = new AudioEngine({
    sampleRate: 48000,
    bufferSize: 256,
    numberOfChannels: 2,
    maxRecordingTime: 300,
    latencyHint: 'interactive'
  })
  
  // Initialize the engine
  await audioEngine.initialize()
  
  // Subscribe to events
  audioEngine.on('initialized', (info) => {
    console.log(`Audio initialized - Sample Rate: ${info.sampleRate}Hz, Latency: ${info.baseLatency * 1000}ms`)
  })
  
  audioEngine.on('stateChanged', (state) => {
    console.log(`State changed: ${state}`)
  })
  
  audioEngine.on('recordingProgress', (trackId, time) => {
    console.log(`Recording track ${trackId}: ${time.toFixed(2)}s`)
  })
  
  audioEngine.on('recordingComplete', (trackId, duration) => {
    console.log(`Recording complete on track ${trackId}: ${duration.toFixed(2)}s`)
  })
  
  audioEngine.on('levelUpdate', (levels) => {
    // Update VU meters
    if (levels.input) {
      console.log(`Input level: ${(levels.input.peak * 100).toFixed(0)}%`)
    }
    
    Object.entries(levels.tracks).forEach(([trackId, level]) => {
      console.log(`Track ${trackId} level: ${(level.peak * 100).toFixed(0)}%`)
    })
  })
  
  audioEngine.on('playbackProgress', (time) => {
    console.log(`Playback: ${time.toFixed(2)}s`)
  })
  
  audioEngine.on('error', (error) => {
    console.error('Audio engine error:', error)
  })
  
  return audioEngine
}

// Example: Recording workflow
async function recordingExample() {
  const audioEngine = await setupAudioRecorder()
  
  // Start recording on track 1
  try {
    await audioEngine.startRecording({
      trackId: 1,
      // inputDeviceId: 'specific-device-id' // Optional
    })
    
    // Record for 5 seconds
    setTimeout(() => {
      audioEngine.stopRecording()
      
      // After recording, play it back
      setTimeout(() => {
        audioEngine.startPlayback({
          loop: false,
          startTime: 0
        })
      }, 1000)
    }, 5000)
    
  } catch (error) {
    console.error('Failed to start recording:', error)
  }
}

// Example: Track control
function trackControlExample(audioEngine: AudioEngine) {
  // Set track 1 volume to 75%
  audioEngine.setTrackVolume(1, 0.75)
  
  // Pan track 1 slightly to the left
  audioEngine.setTrackPan(1, -0.3)
  
  // Mute track 2
  audioEngine.muteTrack(2, true)
  
  // Solo track 1
  audioEngine.soloTrack(1, true)
}

// Example: Multi-track workflow (future)
async function multiTrackExample(audioEngine: AudioEngine) {
  // Record track 1
  await audioEngine.startRecording({ trackId: 1 })
  
  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))
  audioEngine.stopRecording()
  
  // Playback track 1 while recording track 2
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  audioEngine.startPlayback() // Plays track 1
  await audioEngine.startRecording({ trackId: 2 }) // Record track 2
  
  // Wait 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000))
  audioEngine.stopRecording()
  audioEngine.stopPlayback()
}

// Export for use in components
export { setupAudioRecorder, recordingExample, trackControlExample, multiTrackExample }