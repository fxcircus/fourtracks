# FourTracks Troubleshooting Guide

## No Audio Recording / Silent Recording

If you're experiencing issues with audio recording (no input levels, silent recordings), follow these steps:

### 1. Check Browser Console
Open Developer Tools (F12) and look for:
- `🎵 FourTracks Audio Recorder Starting...` message
- Any error messages in red
- Audio device enumeration logs

### 2. Use Debug Audio Button
Click the "Debug Audio" button in the UI to run comprehensive tests:
- Browser audio support
- Available audio devices
- Permission status
- Audio level detection

### 3. Common Issues and Solutions

#### No Input Level Display
- **Check microphone permissions**: Browser may have blocked access
- **Select correct device**: Use the device dropdown to select your microphone
- **Check system audio settings**: Ensure microphone is not muted at OS level

#### AudioWorklet Not Supported
The app will automatically fall back to ScriptProcessor. You'll see:
```
[AudioEngine] AudioWorklet not supported, using ScriptProcessor fallback
```
This is normal and recording should still work.

#### Permission Denied
- Click the microphone icon in the browser address bar
- Allow microphone access for localhost:3000
- Refresh the page

#### No Audio Devices Found
- Check if microphone is properly connected
- Try a different browser (Chrome/Edge recommended)
- Check system privacy settings

### 4. Browser Compatibility
Best results with:
- Chrome/Edge 66+
- Firefox 60+
- Safari 14.1+

### 5. Manual Testing
1. Open browser console (F12)
2. Run this test:
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Microphone access granted');
    stream.getTracks().forEach(track => {
      console.log('Track:', track.label);
      track.stop();
    });
  })
  .catch(err => console.error('❌ Microphone access failed:', err));
```

### 6. Check Audio Context State
In console, check if audio context is running:
```javascript
// After clicking record once
window.audioContext = document.querySelector('audio-recorder')?.audioEngine?.audioContext;
console.log('Audio Context State:', window.audioContext?.state);
```

### 7. Enable Verbose Logging
The app includes detailed logging. Look for:
- `[AudioEngine]` - Core audio engine logs
- `[ScriptProcessorRecorder]` - Recording process logs
- `[AudioNodeManager]` - Audio routing logs
- `[DeviceSelector]` - Device enumeration logs

### Still Not Working?

1. Try a different browser
2. Test with a different microphone/headset
3. Ensure no other application is using the microphone
4. Check browser security settings for localhost
5. Try HTTPS: Some browsers require secure context for audio

### Debug Information to Provide
If reporting an issue, include:
- Browser name and version
- Operating system
- Console error messages
- Output from "Debug Audio" button
- Which step in the recording process fails