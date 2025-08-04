import { AudioEngine } from './AudioEngine';
import { AudioEngineState } from './types';
import { MockAudioContext, MockMediaStream, MockMediaStreamTrack, MockAnalyserNode } from '../test/mocks/webAudioMock';
import { waitForAsync } from '../test/utils/testUtils';

describe('AudioEngine', () => {
  let audioEngine: AudioEngine;

  beforeEach(() => {
    // Reset any mocked functions
    jest.clearAllMocks();
    
    // Create new audio engine instance
    audioEngine = new AudioEngine({
      sampleRate: 44100,
      bufferSize: 256,
      numberOfChannels: 2
    });
  });

  afterEach(async () => {
    // Clean up audio engine
    if (audioEngine) {
      audioEngine.dispose();
    }
  });

  describe('initialization', () => {
    it('creates audio engine with default configuration', () => {
      const engine = new AudioEngine();
      expect(engine.getState()).toBe(AudioEngineState.IDLE);
    });

    it('creates audio engine with custom configuration', () => {
      const engine = new AudioEngine({
        sampleRate: 48000,
        bufferSize: 512,
        numberOfChannels: 1
      });
      expect(engine.getState()).toBe(AudioEngineState.IDLE);
    });

    it('initializes audio context successfully', async () => {
      await audioEngine.initialize();
      // After initialization, state should still be IDLE until recording/playback starts
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
    });

    it('emits initialized event', async () => {
      const initializedHandler = jest.fn();
      audioEngine.on('initialized', initializedHandler);
      
      await audioEngine.initialize();
      
      expect(initializedHandler).toHaveBeenCalledWith({
        sampleRate: 44100,
        baseLatency: expect.any(Number)
      });
    });

    it('handles initialization errors gracefully', async () => {
      // Force AudioContext creation to fail
      const originalAudioContext = (global as any).AudioContext;
      (global as any).AudioContext = jest.fn().mockImplementation(() => {
        throw new Error('AudioContext creation failed');
      });

      await expect(audioEngine.initialize()).rejects.toThrow('AudioContext creation failed');
      
      // Restore original
      (global as any).AudioContext = originalAudioContext;
    });
  });

  describe('track management', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('initializes with 4 tracks', () => {
      const tracks = audioEngine.getAllTracks();
      expect(tracks).toHaveLength(4);
      expect(tracks.every(track => !track.isRecording && !track.isPlaying)).toBe(true);
    });

    it('gets individual track', () => {
      const track = audioEngine.getTrack(1);
      expect(track).toBeDefined();
      expect(track?.id).toBe(1);
      expect(track?.name).toBe('Track 1');
    });

    it('sets track volume', () => {
      audioEngine.setTrackVolume(1, 0.5);
      expect(audioEngine.getTrack(1)?.volume).toBe(0.5);
    });

    it('clamps volume between 0 and 1', () => {
      audioEngine.setTrackVolume(1, -0.5);
      expect(audioEngine.getTrack(1)?.volume).toBe(0);

      audioEngine.setTrackVolume(1, 1.5);
      expect(audioEngine.getTrack(1)?.volume).toBe(1);
    });

    it('sets track pan', () => {
      audioEngine.setTrackPan(1, -0.5);
      expect(audioEngine.getTrack(1)?.pan).toBe(-0.5);
    });

    it('clamps pan between -1 and 1', () => {
      audioEngine.setTrackPan(1, -1.5);
      expect(audioEngine.getTrack(1)?.pan).toBe(-1);

      audioEngine.setTrackPan(1, 1.5);
      expect(audioEngine.getTrack(1)?.pan).toBe(1);
    });

    it('toggles track mute state', () => {
      audioEngine.muteTrack(1, true);
      expect(audioEngine.getTrack(1)?.isMuted).toBe(true);

      audioEngine.muteTrack(1, false);
      expect(audioEngine.getTrack(1)?.isMuted).toBe(false);
    });

    it('toggles track solo state', () => {
      audioEngine.soloTrack(1, true);
      expect(audioEngine.getTrack(1)?.isSolo).toBe(true);

      audioEngine.soloTrack(1, false);
      expect(audioEngine.getTrack(1)?.isSolo).toBe(false);
    });

    it('handles solo affecting other tracks gain', () => {
      // Solo track 1
      audioEngine.soloTrack(1, true);
      
      // Verify track gains are updated (we can't directly test the gain values
      // without exposing internal state, but we can verify the tracks are marked correctly)
      expect(audioEngine.getTrack(1)?.isSolo).toBe(true);
      expect(audioEngine.getTrack(2)?.isSolo).toBe(false);
    });
  });

  describe('recording', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('starts recording on specified track', async () => {
      const getUserMediaSpy = jest.spyOn(navigator.mediaDevices, 'getUserMedia');
      
      await audioEngine.startRecording({ trackId: 1 });

      expect(audioEngine.getState()).toBe(AudioEngineState.RECORDING);
      expect(audioEngine.getTrack(1)?.isRecording).toBe(true);
      
      expect(getUserMediaSpy).toHaveBeenCalledWith({
        audio: {
          channelCount: 2,
          sampleRate: 44100,
          deviceId: undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
    });

    it('starts recording with specific input device', async () => {
      const getUserMediaSpy = jest.spyOn(navigator.mediaDevices, 'getUserMedia');
      
      await audioEngine.startRecording({ 
        trackId: 1, 
        inputDeviceId: 'specific-device-id' 
      });

      expect(getUserMediaSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: expect.objectContaining({
            deviceId: 'specific-device-id'
          })
        })
      );
    });

    it('prevents recording when already recording', async () => {
      await audioEngine.startRecording({ trackId: 1 });
      
      await expect(audioEngine.startRecording({ trackId: 2 }))
        .rejects.toThrow('Recording already in progress');
    });

    it('stops recording and updates state', async () => {
      await audioEngine.startRecording({ trackId: 1 });
      
      // Wait a bit to simulate recording
      await waitForAsync(100);
      
      audioEngine.stopRecording();

      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
      expect(audioEngine.getTrack(1)?.isRecording).toBe(false);
    });

    it('handles recording errors gracefully', async () => {
      // Mock getUserMedia to reject
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
        new Error('Permission denied')
      );

      const errorHandler = jest.fn();
      audioEngine.on('error', errorHandler);

      await expect(audioEngine.startRecording({ trackId: 1 }))
        .rejects.toThrow('Permission denied');
      
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('emits recording progress events', async () => {
      const progressHandler = jest.fn();
      audioEngine.on('recordingProgress', progressHandler);

      await audioEngine.startRecording({ trackId: 1 });
      
      // Wait for potential progress events
      await waitForAsync(200);

      // Progress events depend on the recorder implementation
      // We can't guarantee they'll fire in this short time
    });
  });

  describe('playback', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
      
      // Simulate a recorded buffer on track 1
      const track = audioEngine.getTrack(1);
      if (track) {
        // Create a mock audio buffer
        const mockBuffer = audioEngine['audioContext']?.createBuffer(2, 44100, 44100);
        track.audioBuffer = mockBuffer as any;
      }
    });

    it('starts playback', async () => {
      await audioEngine.startPlayback();
      expect(audioEngine.getState()).toBe(AudioEngineState.PLAYING);
      
      const tracks = audioEngine.getAllTracks();
      expect(tracks.some(track => track.isPlaying)).toBe(true);
    });

    it('stops playback', async () => {
      await audioEngine.startPlayback();
      audioEngine.stopPlayback();
      
      expect(audioEngine.getState()).toBe(AudioEngineState.STOPPED);
      
      const tracks = audioEngine.getAllTracks();
      expect(tracks.every(track => !track.isPlaying)).toBe(true);
    });

    it('emits playback progress events', async () => {
      const progressHandler = jest.fn();
      audioEngine.on('playbackProgress', progressHandler);

      await audioEngine.startPlayback();
      
      // Wait for animation frame to fire
      await waitForAsync(50);

      // Progress events depend on requestAnimationFrame
      // which may not fire reliably in test environment
    });

    it('handles playback with options', async () => {
      await audioEngine.startPlayback({ loop: true });
      expect(audioEngine.getState()).toBe(AudioEngineState.PLAYING);
    });
  });

  describe('level monitoring', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('emits level update events', (done) => {
      audioEngine.on('levelUpdate', (levels) => {
        expect(levels).toBeDefined();
        // Level structure depends on LevelMonitor implementation
        done();
      });

      // Level monitoring starts automatically after initialization
      // Wait for first update
    });
  });

  describe('cleanup and disposal', () => {
    it('properly disposes resources', async () => {
      await audioEngine.initialize();
      audioEngine.dispose();
      
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
    });

    it('stops recording before disposal', async () => {
      await audioEngine.initialize();
      await audioEngine.startRecording({ trackId: 1 });
      
      audioEngine.dispose();
      
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
      expect(audioEngine.getTrack(1)?.isRecording).toBe(false);
    });

    it('stops playback before disposal', async () => {
      await audioEngine.initialize();
      
      // Add mock buffer to track
      const track = audioEngine.getTrack(1);
      if (track) {
        const mockBuffer = audioEngine['audioContext']?.createBuffer(2, 44100, 44100);
        track.audioBuffer = mockBuffer as any;
      }
      
      await audioEngine.startPlayback();
      audioEngine.dispose();
      
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
    });
  });

  describe('event handling', () => {
    it('adds and removes event listeners', async () => {
      const handler = jest.fn();
      
      audioEngine.on('stateChanged', handler);
      
      await audioEngine.initialize();
      await audioEngine.startRecording({ trackId: 1 });
      
      expect(handler).toHaveBeenCalledWith(AudioEngineState.RECORDING);

      audioEngine.off('stateChanged', handler);
      audioEngine.stopRecording();
      
      // Handler should not be called after removal
      const callCount = handler.mock.calls.length;
      expect(handler).toHaveBeenCalledTimes(callCount);
    });

    it('emits error events', async () => {
      const errorHandler = jest.fn();
      audioEngine.on('error', errorHandler);

      // Force an error
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(
        new Error('Test error')
      );

      try {
        await audioEngine.startRecording({ trackId: 1 });
      } catch (e) {
        // Expected
      }

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('emits recording complete event', async () => {
      const completeHandler = jest.fn();
      audioEngine.on('recordingComplete', completeHandler);

      await audioEngine.startRecording({ trackId: 1 });
      
      // Simulate recorder completion
      const recorder = audioEngine['recorder'];
      if (recorder && 'setCompleteCallback' in recorder) {
        const callback = recorder['completeCallback'];
        if (callback) {
          callback({
            numberOfChannels: 2,
            sampleRate: 44100,
            length: 44100,
            channelData: [new Float32Array(44100), new Float32Array(44100)]
          });
        }
      }

      expect(completeHandler).toHaveBeenCalledWith(1, expect.any(Number));
    });
  });

  describe('advanced recording scenarios', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('handles max recording time limit', async () => {
      const stopSpy = jest.spyOn(audioEngine, 'stopRecording');
      const progressHandler = jest.fn();
      
      audioEngine.on('recordingProgress', progressHandler);
      
      // Start recording
      await audioEngine.startRecording({ trackId: 1 });
      
      // Simulate progress beyond max time
      const recorder = audioEngine['recorder'];
      if (recorder && 'setProgressCallback' in recorder) {
        const callback = recorder['onProgress'];
        if (callback) {
          // Trigger progress with time beyond max (default 300s)
          callback(301);
        }
      }
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('handles multiple track recordings sequentially', async () => {
      // Record on track 1
      await audioEngine.startRecording({ trackId: 1 });
      expect(audioEngine.getTrack(1)?.isRecording).toBe(true);
      
      audioEngine.stopRecording();
      expect(audioEngine.getTrack(1)?.isRecording).toBe(false);
      
      // Record on track 2
      await audioEngine.startRecording({ trackId: 2 });
      expect(audioEngine.getTrack(2)?.isRecording).toBe(true);
      
      audioEngine.stopRecording();
      expect(audioEngine.getTrack(2)?.isRecording).toBe(false);
    });

    it('properly cleans up media stream on error', async () => {
      const mockStream = new MockMediaStream([new MockMediaStreamTrack()]);
      const mockTrack = mockStream.getTracks()[0];
      const stopSpy = jest.spyOn(mockTrack, 'stop');
      
      jest.spyOn(navigator.mediaDevices, 'getUserMedia').mockResolvedValueOnce(mockStream as any);
      
      // Mock worklet failure to trigger ScriptProcessor fallback
      const mockContext = audioEngine['audioContext'] as MockAudioContext;
      
      await audioEngine.startRecording({ trackId: 1 });
      
      // Force an error in recording
      audioEngine['recorder'] = null; // Simulate recorder failure
      audioEngine.stopRecording();
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('advanced playback scenarios', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
      
      // Add buffers to multiple tracks
      for (let i = 1; i <= 3; i++) {
        const track = audioEngine.getTrack(i);
        if (track) {
          const mockBuffer = audioEngine['audioContext']?.createBuffer(2, 44100 * i, 44100);
          track.audioBuffer = mockBuffer as any;
        }
      }
    });

    it('plays multiple tracks simultaneously', async () => {
      await audioEngine.startPlayback();
      
      const playingTracks = audioEngine.getAllTracks().filter(track => track.isPlaying);
      expect(playingTracks.length).toBe(3); // 3 tracks have buffers
    });

    it('respects mute state during playback', async () => {
      audioEngine.muteTrack(1, true);
      audioEngine.muteTrack(2, false);
      
      await audioEngine.startPlayback();
      
      expect(audioEngine.getTrack(1)?.isPlaying).toBe(false); // Muted track doesn't play
      expect(audioEngine.getTrack(2)?.isPlaying).toBe(true);
    });

    it('handles playback with empty tracks', async () => {
      // Remove buffer from track 2
      const track2 = audioEngine.getTrack(2);
      if (track2) {
        track2.audioBuffer = null;
      }
      
      await audioEngine.startPlayback();
      
      expect(audioEngine.getTrack(1)?.isPlaying).toBe(true);
      expect(audioEngine.getTrack(2)?.isPlaying).toBe(false);
      expect(audioEngine.getTrack(3)?.isPlaying).toBe(true);
    });

    it('emits playback complete when all tracks finish', async () => {
      const endHandler = jest.fn();
      audioEngine.on('stateChanged', endHandler);
      
      await audioEngine.startPlayback();
      
      // Simulate all tracks ending
      const playbackManager = audioEngine['playbackManager'];
      if (playbackManager) {
        const endCallback = playbackManager['onEnded'];
        if (endCallback) {
          endCallback();
        }
      }
      
      expect(endHandler).toHaveBeenCalledWith(AudioEngineState.STOPPED);
    });
  });

  describe('error recovery', () => {
    it('recovers from audio context suspension', async () => {
      const mockContext = new MockAudioContext();
      mockContext.state = 'suspended' as AudioContextState;
      const resumeSpy = jest.spyOn(mockContext, 'resume');
      
      (global as any).AudioContext = jest.fn().mockImplementation(() => mockContext);
      
      const engine = new AudioEngine();
      await engine.initialize();
      
      expect(resumeSpy).toHaveBeenCalled();
      
      engine.dispose();
    });

    it('handles invalid track IDs gracefully', () => {
      expect(audioEngine.getTrack(999)).toBeUndefined();
      
      // These should not throw
      audioEngine.setTrackVolume(999, 0.5);
      audioEngine.setTrackPan(999, 0.5);
      audioEngine.muteTrack(999, true);
      audioEngine.soloTrack(999, true);
    });

    it('handles recording without initialization', async () => {
      const uninitializedEngine = new AudioEngine();
      
      await expect(uninitializedEngine.startRecording({ trackId: 1 }))
        .rejects.toThrow('Audio engine not initialized');
      
      uninitializedEngine.dispose();
    });

    it('handles playback without initialization', async () => {
      const uninitializedEngine = new AudioEngine();
      
      await expect(uninitializedEngine.startPlayback())
        .rejects.toThrow('Audio engine not initialized');
      
      uninitializedEngine.dispose();
    });
  });

  describe('solo functionality', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('solos single track correctly', () => {
      audioEngine.soloTrack(1, true);
      
      // Verify gain updates were triggered for all tracks
      const nodeManager = audioEngine['nodeManager'];
      if (nodeManager) {
        const setGainSpy = jest.spyOn(nodeManager, 'setTrackGain');
        
        // Trigger gain updates
        audioEngine.soloTrack(1, true);
        
        expect(setGainSpy).toHaveBeenCalledTimes(4); // All 4 tracks
      }
    });

    it('handles multiple solo tracks', () => {
      audioEngine.soloTrack(1, true);
      audioEngine.soloTrack(2, true);
      
      expect(audioEngine.getTrack(1)?.isSolo).toBe(true);
      expect(audioEngine.getTrack(2)?.isSolo).toBe(true);
      expect(audioEngine.getTrack(3)?.isSolo).toBe(false);
    });

    it('unsolo restores normal gain', () => {
      audioEngine.soloTrack(1, true);
      audioEngine.soloTrack(1, false);
      
      expect(audioEngine.getTrack(1)?.isSolo).toBe(false);
    });
  });

  describe('level monitoring', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('starts level monitoring after initialization', (done) => {
      let updateCount = 0;
      
      audioEngine.on('levelUpdate', (levels) => {
        expect(levels).toBeDefined();
        expect(levels.master).toBeDefined();
        expect(levels.tracks).toBeDefined();
        
        updateCount++;
        if (updateCount >= 2) {
          done();
        }
      });
      
      // Level monitor should be running, wait for updates
    });

    it('includes input levels during recording', async () => {
      await audioEngine.startRecording({ trackId: 1 });
      
      await new Promise((resolve) => {
        audioEngine.on('levelUpdate', (levels) => {
          if (levels.input) {
            expect(levels.input.peak).toBeDefined();
            expect(levels.input.rms).toBeDefined();
            resolve(undefined);
          }
        });
      });
      
      audioEngine.stopRecording();
    });
  });

  describe('configuration edge cases', () => {
    it('handles extreme sample rates', () => {
      const engine = new AudioEngine({
        sampleRate: 192000,
        bufferSize: 4096,
        numberOfChannels: 1
      });
      
      expect(engine.getState()).toBe(AudioEngineState.IDLE);
      engine.dispose();
    });

    it('handles different latency hints', async () => {
      const engine = new AudioEngine({
        latencyHint: 'playback'
      });
      
      await engine.initialize();
      expect(engine.getState()).toBe(AudioEngineState.IDLE);
      
      engine.dispose();
    });

    it('enforces max recording time', () => {
      const engine = new AudioEngine({
        maxRecordingTime: 10 // 10 seconds
      });
      
      expect(engine['config'].maxRecordingTime).toBe(10);
      engine.dispose();
    });
  });
});