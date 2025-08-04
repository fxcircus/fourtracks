// Debug utility for testing audio recording
export async function testAudioRecording() {
  console.log('=== Audio Recording Debug Test ===')
  
  try {
    // 1. Check browser support
    console.log('1. Checking browser support...')
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not supported in this browser')
    }
    console.log('✓ Browser supports getUserMedia')
    
    // 2. Check for audio devices
    console.log('\n2. Enumerating audio devices...')
    const devices = await navigator.mediaDevices.enumerateDevices()
    const audioInputs = devices.filter(d => d.kind === 'audioinput')
    console.log(`✓ Found ${audioInputs.length} audio input devices:`)
    audioInputs.forEach((device, i) => {
      console.log(`  ${i + 1}. ${device.label || 'Unnamed'} (${device.deviceId})`)
    })
    
    // 3. Request microphone access
    console.log('\n3. Requesting microphone access...')
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    })
    console.log('✓ Got media stream:', stream.id)
    
    // 4. Check audio tracks
    const audioTracks = stream.getAudioTracks()
    console.log(`✓ Stream has ${audioTracks.length} audio tracks:`)
    audioTracks.forEach((track, i) => {
      const settings = track.getSettings()
      console.log(`  Track ${i + 1}:`, {
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings
      })
    })
    
    // 5. Create audio context and analyze
    console.log('\n4. Creating audio context...')
    const audioContext = new AudioContext()
    console.log('✓ Audio context created:', {
      state: audioContext.state,
      sampleRate: audioContext.sampleRate,
      baseLatency: audioContext.baseLatency
    })
    
    // 6. Connect to analyser
    console.log('\n5. Connecting audio nodes...')
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    source.connect(analyser)
    console.log('✓ Audio nodes connected')
    
    // 7. Analyze audio levels
    console.log('\n6. Analyzing audio levels for 3 seconds...')
    console.log('   (Make some noise!)')
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    let maxLevel = 0
    let samples = 0
    
    const checkLevels = () => {
      analyser.getByteTimeDomainData(dataArray)
      
      let sum = 0
      let max = 0
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = Math.abs(dataArray[i] - 128) / 128
        sum += normalized
        max = Math.max(max, normalized)
      }
      
      const avg = sum / dataArray.length
      maxLevel = Math.max(maxLevel, max)
      samples++
      
      if (samples % 10 === 0) {
        console.log(`   Level: ${(max * 100).toFixed(1)}% (avg: ${(avg * 100).toFixed(1)}%)`)
      }
    }
    
    const interval = setInterval(checkLevels, 100)
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    clearInterval(interval)
    
    console.log(`\n✓ Analysis complete. Max level detected: ${(maxLevel * 100).toFixed(1)}%`)
    
    if (maxLevel < 0.01) {
      console.warn('⚠️  WARNING: No audio detected! Check your microphone.')
    }
    
    // Cleanup
    stream.getTracks().forEach(track => track.stop())
    await audioContext.close()
    
    console.log('\n=== Test Complete ===')
    return true
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

// Run test in console: 
// import('./debug-recording').then(m => m.testAudioRecording())