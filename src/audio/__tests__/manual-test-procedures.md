# FourTracks Audio Engine - Manual Test Procedures

This document outlines manual testing procedures for audio functionality that cannot be fully automated. These tests complement the automated test suite and ensure subjective audio quality and user experience.

## Prerequisites

- FourTracks application running in development mode
- Audio interface or built-in microphone/speakers
- Headphones for monitoring
- Test audio sources (instrument, microphone, audio files)
- Multiple browsers for cross-browser testing (Chrome, Firefox, Safari, Edge)

## 1. Audio Permission and Initialization Tests

### Test 1.1: First-Time Permission Request
1. Clear browser permissions for the application
2. Load the application
3. Click "Start Recording" on any track
4. **Verify:** Browser permission prompt appears
5. Grant permission
6. **Verify:** Recording starts without errors
7. **Verify:** Input level meter shows activity

### Test 1.2: Permission Denial Recovery
1. Clear browser permissions
2. Load the application
3. Click "Start Recording"
4. Deny permission in browser prompt
5. **Verify:** Error message displays clearly
6. **Verify:** Application remains stable
7. Retry recording after granting permission
8. **Verify:** Recording works correctly

### Test 1.3: Audio Context Suspension
1. Load application in Safari or mobile browser
2. **Verify:** Audio context initializes after user interaction
3. Start recording
4. **Verify:** No audio glitches during context resume

## 2. Recording Quality Tests

### Test 2.1: Input Signal Quality
1. Connect a clean audio source (sine wave generator or instrument)
2. Start recording on Track 1
3. Monitor input levels
4. **Verify:** No distortion at nominal levels (-12dB to -6dB)
5. **Verify:** Clean signal with no artifacts
6. Stop recording after 10 seconds
7. Play back recording
8. **Verify:** Playback matches input quality

### Test 2.2: Microphone Recording
1. Use built-in microphone
2. Record speech on Track 1 for 30 seconds
3. **Verify:** Clear speech capture without echo
4. **Verify:** No feedback issues
5. **Verify:** Appropriate noise floor

### Test 2.3: Long Recording Stability
1. Start recording on Track 1
2. Record for 5 minutes (max duration)
3. **Verify:** No memory issues or performance degradation
4. **Verify:** Recording stops automatically at max duration
5. **Verify:** Full recording plays back correctly

### Test 2.4: Multi-Track Recording
1. Record Track 1 with instrument (30 seconds)
2. Play Track 1 while recording Track 2 with vocals
3. **Verify:** No bleed between tracks
4. **Verify:** Tracks stay synchronized
5. Record Tracks 3 and 4 similarly
6. **Verify:** All 4 tracks play in sync

## 3. Playback Quality Tests

### Test 3.1: Simultaneous Playback
1. Record different content on all 4 tracks
2. Play all tracks simultaneously
3. **Verify:** No audio dropouts or glitches
4. **Verify:** Consistent timing between tracks
5. **Verify:** CPU usage remains reasonable

### Test 3.2: Track Controls During Playback
1. Start playback of all tracks
2. Adjust volume faders while playing
3. **Verify:** Smooth volume changes without clicks
4. Adjust pan controls
5. **Verify:** Proper stereo positioning
6. Mute/unmute tracks
7. **Verify:** Instant mute without pops
8. Solo different tracks
9. **Verify:** Solo isolates correct track(s)

### Test 3.3: Loop Playback
1. Enable loop mode
2. Start playback
3. **Verify:** Seamless loop without gaps
4. **Verify:** No clicks at loop points
5. Let loop run for 10+ iterations
6. **Verify:** No timing drift

## 4. Level Monitoring Tests

### Test 4.1: Input Level Accuracy
1. Connect calibrated audio source
2. Send -20dB, -12dB, -6dB, and 0dB test signals
3. **Verify:** Level meters match expected values
4. **Verify:** Peak indicators work correctly
5. **Verify:** No meter lag or stuttering

### Test 4.2: Track Level Monitoring
1. Play tracks with known levels
2. **Verify:** Track meters reflect actual audio levels
3. **Verify:** Master meter shows sum of tracks
4. Mute tracks
5. **Verify:** Muted tracks show no level

### Test 4.3: Peak Hold Behavior
1. Send short transient signals
2. **Verify:** Peak indicators hold for ~2 seconds
3. **Verify:** New peaks update immediately
4. **Verify:** Peak hold resets properly

## 5. Performance and Latency Tests

### Test 5.1: Recording Latency
1. Set up click track or metronome
2. Record clicks while monitoring
3. Measure offset between source and recording
4. **Target:** < 20ms round-trip latency
5. **Verify:** Consistent latency (no jitter)

### Test 5.2: CPU Usage
1. Open browser developer tools → Performance
2. Record on all 4 tracks simultaneously
3. **Verify:** CPU usage < 50% on modern hardware
4. Play all 4 tracks
5. **Verify:** No significant CPU spikes
6. **Verify:** UI remains responsive

### Test 5.3: Memory Usage
1. Open browser developer tools → Memory
2. Perform multiple recording sessions
3. **Verify:** No memory leaks (steady state after GC)
4. Record maximum duration on all tracks
5. **Verify:** Memory usage remains reasonable
6. Clear all tracks
7. **Verify:** Memory is released

## 6. Cross-Browser Compatibility

### Test 6.1: Chrome/Edge (Chromium)
1. Run all basic recording/playback tests
2. **Verify:** AudioWorklet recorder is used
3. **Verify:** Low latency performance

### Test 6.2: Firefox
1. Run all basic recording/playback tests
2. **Verify:** Fallback to ScriptProcessor if needed
3. **Verify:** Acceptable performance

### Test 6.3: Safari
1. Run all basic recording/playback tests
2. **Verify:** Handles webkit prefixes correctly
3. **Verify:** Audio context suspension handled
4. Test on both macOS and iOS

### Test 6.4: Mobile Browsers
1. Test on iOS Safari
2. Test on Android Chrome
3. **Verify:** Touch controls work properly
4. **Verify:** Audio context initialization
5. **Verify:** Performance is acceptable

## 7. Error Recovery Tests

### Test 7.1: Device Disconnection
1. Start recording with external audio interface
2. Disconnect device during recording
3. **Verify:** Graceful error handling
4. **Verify:** Application remains stable
5. Reconnect and verify functionality

### Test 7.2: Browser Tab Suspension
1. Start recording
2. Switch to another tab for 30+ seconds
3. Return to FourTracks tab
4. **Verify:** Recording continued or handled gracefully
5. **Verify:** Playback works correctly

### Test 7.3: Sample Rate Mismatch
1. Change system audio sample rate
2. Reload application
3. **Verify:** Adapts to new sample rate
4. Record and playback
5. **Verify:** No pitch shifting or artifacts

## 8. User Experience Tests

### Test 8.1: Visual Feedback
1. Perform various operations
2. **Verify:** Clear visual feedback for all actions
3. **Verify:** Loading states display properly
4. **Verify:** Error messages are helpful

### Test 8.2: Waveform Display
1. Record audio with varying dynamics
2. **Verify:** Waveform accurately represents audio
3. **Verify:** Waveform updates during recording
4. **Verify:** Zoom/scroll if implemented

### Test 8.3: Transport Controls
1. Test all transport buttons
2. **Verify:** Clear enabled/disabled states
3. **Verify:** Responsive to clicks
4. **Verify:** Keyboard shortcuts work (if implemented)

## 9. Stress Tests

### Test 9.1: Rapid Control Changes
1. Start playback
2. Rapidly adjust volumes and pans
3. **Verify:** No audio artifacts
4. **Verify:** UI remains responsive

### Test 9.2: Quick Start/Stop
1. Rapidly start and stop recording
2. **Verify:** No crashes or hangs
3. **Verify:** State management remains consistent

### Test 9.3: Maximum Load
1. Record maximum duration on all tracks
2. Play all tracks with effects (if implemented)
3. Adjust all controls during playback
4. **Verify:** Acceptable performance
5. **Verify:** No audio dropouts

## Test Report Template

For each manual test session, document:

- Date and time
- Browser and version
- Operating system
- Audio hardware used
- Test cases performed
- Issues found
- Performance observations
- Suggestions for improvement

## Known Limitations

Document any discovered limitations:

- Maximum recording time enforced
- Browser-specific audio API limitations
- Performance constraints on older hardware
- Mobile device restrictions

## Continuous Testing

- Perform full manual test suite before releases
- Quick smoke tests after major changes
- Regular performance profiling
- User feedback collection for subjective quality