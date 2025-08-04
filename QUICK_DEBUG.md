# Quick Debug Guide for FourTracks Audio Issues

## Console Commands to Test Audio

Copy and paste these commands into your browser console to debug audio issues:

### 1. Test Basic Microphone Access
```javascript
// Test if browser can access microphone
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Mic access granted');
    const track = stream.getTracks()[0];
    console.log('Track:', track.label, 'Settings:', track.getSettings());
    
    // Create a simple audio test
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    const data = new Uint8Array(analyser.frequencyBinCount);
    
    // Check levels for 2 seconds
    let maxLevel = 0;
    const checkLevel = () => {
      analyser.getByteTimeDomainData(data);
      const max = Math.max(...data) - 128;
      if (max > maxLevel) maxLevel = max;
    };
    
    const interval = setInterval(checkLevel, 100);
    
    setTimeout(() => {
      clearInterval(interval);
      console.log(`Max level detected: ${maxLevel} (${maxLevel > 5 ? '✅ Audio detected' : '❌ No audio detected'})`);
      stream.getTracks().forEach(t => t.stop());
    }, 2000);
    
    console.log('Speak into microphone for 2 seconds...');
  })
  .catch(err => console.error('❌ Mic access failed:', err));
```

### 2. List All Audio Devices
```javascript
// List available audio devices
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    console.log('Audio Input Devices:');
    audioInputs.forEach((device, i) => {
      console.log(`${i + 1}. ${device.label || 'Unnamed'} (${device.deviceId})`);
    });
  });
```

### 3. Test Specific Device
```javascript
// Test a specific device (replace deviceId with one from the list above)
async function testDevice(deviceId) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } }
    });
    console.log('✅ Device connected:', stream.getTracks()[0].label);
    
    // Quick audio level check
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    source.connect(analyser);
    
    const data = new Uint8Array(analyser.frequencyBinCount);
    
    console.log('Monitoring audio levels for 3 seconds...');
    
    const interval = setInterval(() => {
      analyser.getByteTimeDomainData(data);
      const max = Math.max(...data) - 128;
      const min = Math.min(...data) - 128;
      const range = max - min;
      
      if (range > 10) {
        console.log(`📊 Audio detected! Range: ${range}`);
      }
    }, 100);
    
    setTimeout(() => {
      clearInterval(interval);
      stream.getTracks().forEach(t => t.stop());
      console.log('Test complete');
    }, 3000);
    
  } catch (err) {
    console.error('❌ Device test failed:', err);
  }
}

// Usage: testDevice('deviceId-from-list')
```

### 4. Test ScriptProcessor Recording
```javascript
// Direct test of ScriptProcessor recording
async function testScriptProcessor() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 2, 2);
  
  let maxLevel = 0;
  let sampleCount = 0;
  
  processor.onaudioprocess = (e) => {
    const inputBuffer = e.inputBuffer;
    const leftChannel = inputBuffer.getChannelData(0);
    
    const max = Math.max(...Array.from(leftChannel).map(Math.abs));
    if (max > maxLevel) maxLevel = max;
    
    if (sampleCount % 10 === 0) {
      console.log(`Sample ${sampleCount}: Max level = ${max.toFixed(4)}`);
    }
    sampleCount++;
  };
  
  source.connect(processor);
  processor.connect(audioContext.destination);
  
  console.log('Recording for 5 seconds...');
  
  setTimeout(() => {
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach(t => t.stop());
    console.log(`Recording complete. Max level detected: ${maxLevel.toFixed(4)}`);
    console.log(maxLevel > 0.001 ? '✅ Audio was captured' : '❌ No audio detected');
  }, 5000);
}

// Run: testScriptProcessor()
```

### 5. Check FourTracks Audio Engine State
```javascript
// Get the audio engine instance from the React component
const audioRecorder = document.querySelector('.audio-recorder');
if (audioRecorder && audioRecorder.__reactInternalInstance) {
  const engine = audioRecorder.__reactInternalInstance.memoizedProps.audioEngine;
  console.log('Audio Engine:', engine);
  
  // Try debug
  engine.debugAudioChain().then(console.log).catch(console.error);
}
```

## Common Issues and Solutions

1. **No audio levels showing**
   - Check if the correct microphone is selected in the dropdown
   - Ensure microphone is not muted at OS level
   - Try a different browser

2. **Permission denied**
   - Click the lock icon in address bar and allow microphone
   - Check browser settings for microphone permissions

3. **Silent recording**
   - Run test #1 above to verify microphone works
   - Check if you see "ScriptProcessor fallback" in console
   - Try speaking louder during recording

4. **Device not appearing**
   - Refresh the page after connecting microphone
   - Check system privacy settings
   - Try incognito/private mode

## Next Steps

1. Run tests 1-4 in order
2. Note which tests pass/fail
3. Check console for any error messages
4. If test #1 works but FourTracks doesn't, the issue is in the app
5. If test #1 fails, the issue is browser/system permissions