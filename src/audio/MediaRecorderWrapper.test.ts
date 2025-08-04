// MediaRecorderWrapper Test
// Run this test manually to verify the MediaRecorder implementation

import { MediaRecorderWrapper } from './MediaRecorderWrapper'

async function testMediaRecorderWrapper() {
  console.log('=== MediaRecorderWrapper Test ===')
  
  try {
    // Create audio context
    const audioContext = new AudioContext()
    console.log('AudioContext created:', {
      sampleRate: audioContext.sampleRate,
      state: audioContext.state
    })
    
    // Create test audio source (oscillator for testing)
    const oscillator = audioContext.createOscillator()
    oscillator.frequency.value = 440 // A4 note
    
    // Create gain node to act as input
    const inputGain = audioContext.createGain()
    inputGain.gain.value = 0.5
    
    // Connect oscillator to gain
    oscillator.connect(inputGain)
    
    // Create recorder
    const recorder = new MediaRecorderWrapper(audioContext, inputGain)
    await recorder.initialize()
    console.log('MediaRecorderWrapper initialized')
    
    // Set up callbacks
    let recordingComplete = false
    recorder.setProgressCallback((time) => {
      console.log('Recording progress:', time.toFixed(2), 'seconds')
    })
    
    recorder.setCompleteCallback((buffer) => {
      console.log('Recording complete:', {
        length: buffer.length,
        channels: buffer.numberOfChannels,
        sampleRate: buffer.sampleRate,
        duration: buffer.length / buffer.sampleRate
      })
      
      // Check for audio data
      let maxValue = 0
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const channelMax = Math.max(...buffer.channelData[ch].slice(0, 1000))
        if (channelMax > maxValue) maxValue = channelMax
      }
      console.log('Max sample value:', maxValue)
      console.log('Has audio:', maxValue > 0.01 ? 'YES' : 'NO')
      
      recordingComplete = true
    })
    
    // Start oscillator
    oscillator.start()
    console.log('Test oscillator started')
    
    // Start recording
    await recorder.start(2)
    console.log('Recording started')
    
    // Record for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Stop recording
    recorder.stop()
    console.log('Recording stopped')
    
    // Stop oscillator
    oscillator.stop()
    
    // Wait for completion
    await new Promise(resolve => {
      const checkComplete = () => {
        if (recordingComplete) {
          resolve(undefined)
        } else {
          setTimeout(checkComplete, 100)
        }
      }
      checkComplete()
    })
    
    console.log('Test completed successfully!')
    
    // Cleanup
    recorder.dispose()
    await audioContext.close()
    
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Export for manual testing
export { testMediaRecorderWrapper }