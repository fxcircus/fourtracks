import { AudioEngine } from '../AudioEngine';
import { AudioEngineState } from '../types';
import { 
  MockAudioContext, 
  MockMediaStream, 
  MockMediaStreamTrack,
  setupWebAudioMocks 
} from '../../test/mocks/webAudioMock';
import { waitForAsync } from '../../test/utils/testUtils';
import {
  generateSineWave,
  createTestAudioBuffer,
  calculateRMS,
  AudioPerformanceMonitor,
  setAnalyserTestData
} from './audioTestUtils';

// Setup mocks before all tests
beforeAll(() => {
  setupWebAudioMocks();
});

describe('AudioEngine Integration Tests', () => {
  let audioEngine: AudioEngine;
  let performanceMonitor: AudioPerformanceMonitor;

  beforeEach(() => {
    audioEngine = new AudioEngine({
      sampleRate: 44100,
      bufferSize: 256,
      numberOfChannels: 2
    });
    performanceMonitor = new AudioPerformanceMonitor();
  });

  afterEach(() => {
    audioEngine.dispose();
  });

  describe('Full Recording and Playback Cycle', () => {
    it('completes a full record-playback cycle successfully', async () => {
      // Initialize
      await audioEngine.initialize();
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);

      // Start recording on track 1
      const recordStart = performanceMonitor.startMeasure('recording');
      await audioEngine.startRecording({ trackId: 1 });
      recordStart();
      
      expect(audioEngine.getState()).toBe(AudioEngineState.RECORDING);
      expect(audioEngine.getTrack(1)?.isRecording).toBe(true);

      // Simulate recording for 1 second
      await waitForAsync(1000);

      // Stop recording
      audioEngine.stopRecording();
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
      expect(audioEngine.getTrack(1)?.isRecording).toBe(false);

      // Simulate recorded buffer
      const track = audioEngine.getTrack(1);
      if (track && audioEngine['audioContext']) {
        const testBuffer = createTestAudioBuffer(
          audioEngine['audioContext'],
          1,
          'sine',
          440
        );
        track.audioBuffer = testBuffer as any;
      }

      // Start playback
      const playbackStart = performanceMonitor.startMeasure('playback');
      await audioEngine.startPlayback();
      playbackStart();

      expect(audioEngine.getState()).toBe(AudioEngineState.PLAYING);
      expect(audioEngine.getTrack(1)?.isPlaying).toBe(true);

      // Let it play for a bit
      await waitForAsync(500);

      // Stop playback
      audioEngine.stopPlayback();
      expect(audioEngine.getState()).toBe(AudioEngineState.STOPPED);

      // Check performance
      const recordStats = performanceMonitor.getStats('recording');
      const playbackStats = performanceMonitor.getStats('playback');
      
      expect(recordStats?.avg).toBeLessThan(100); // Should start quickly
      expect(playbackStats?.avg).toBeLessThan(50);
    });

    it('handles multi-track recording and synchronized playback', async () => {
      await audioEngine.initialize();

      // Record on multiple tracks sequentially
      for (let trackId = 1; trackId <= 3; trackId++) {
        await audioEngine.startRecording({ trackId });
        await waitForAsync(500);
        audioEngine.stopRecording();

        // Add test buffer
        const track = audioEngine.getTrack(trackId);
        if (track && audioEngine['audioContext']) {
          const testBuffer = createTestAudioBuffer(
            audioEngine['audioContext'],
            0.5,
            'sine',
            440 * trackId // Different frequency for each track
          );
          track.audioBuffer = testBuffer as any;
        }
      }

      // Play all tracks together
      await audioEngine.startPlayback();

      const playingTracks = audioEngine.getAllTracks().filter(t => t.isPlaying);
      expect(playingTracks.length).toBe(3);

      // Verify all tracks started at the same time
      const playbackManager = audioEngine['playbackManager'];
      expect(playbackManager?.isPlaying()).toBe(true);
    });
  });

  describe('Track Control Integration', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
      
      // Add test buffers to all tracks
      for (let i = 1; i <= 4; i++) {
        const track = audioEngine.getTrack(i);
        if (track && audioEngine['audioContext']) {
          track.audioBuffer = createTestAudioBuffer(
            audioEngine['audioContext'],
            1,
            'sine',
            220 * i
          ) as any;
        }
      }
    });

    it('applies volume changes during playback', async () => {
      await audioEngine.startPlayback();

      // Change volumes while playing
      audioEngine.setTrackVolume(1, 0.5);
      audioEngine.setTrackVolume(2, 0.25);
      audioEngine.setTrackVolume(3, 0.75);
      audioEngine.setTrackVolume(4, 0);

      // Verify volumes are applied
      expect(audioEngine.getTrack(1)?.volume).toBe(0.5);
      expect(audioEngine.getTrack(2)?.volume).toBe(0.25);
      expect(audioEngine.getTrack(3)?.volume).toBe(0.75);
      expect(audioEngine.getTrack(4)?.volume).toBe(0);

      // Verify gain nodes are updated
      const nodeManager = audioEngine['nodeManager'];
      const track1Nodes = nodeManager?.getTrackNodes(1);
      expect(track1Nodes?.gainNode.gain.setValueAtTime).toHaveBeenCalledWith(
        0.5,
        expect.any(Number)
      );
    });

    it('handles solo/mute combinations correctly', async () => {
      await audioEngine.startPlayback();

      // Solo track 1
      audioEngine.soloTrack(1, true);

      // Verify gain adjustments
      const nodeManager = audioEngine['nodeManager'];
      
      // Track 1 should be at full volume
      expect(nodeManager?.setTrackGain).toHaveBeenCalledWith(1, 1);
      
      // Other tracks should be muted
      expect(nodeManager?.setTrackGain).toHaveBeenCalledWith(2, 0);
      expect(nodeManager?.setTrackGain).toHaveBeenCalledWith(3, 0);
      expect(nodeManager?.setTrackGain).toHaveBeenCalledWith(4, 0);

      // Add another solo track
      audioEngine.soloTrack(2, true);

      // Both solo tracks should be audible
      expect(audioEngine.getTrack(1)?.isSolo).toBe(true);
      expect(audioEngine.getTrack(2)?.isSolo).toBe(true);

      // Mute a solo track
      audioEngine.muteTrack(1, true);

      // Track 1 should be muted even though it's soloed
      expect(nodeManager?.setTrackGain).toHaveBeenCalledWith(1, 0);
    });

    it('applies pan settings correctly', async () => {
      await audioEngine.startPlayback();

      // Pan tracks to different positions
      audioEngine.setTrackPan(1, -1);   // Full left
      audioEngine.setTrackPan(2, -0.5); // Half left
      audioEngine.setTrackPan(3, 0.5);  // Half right
      audioEngine.setTrackPan(4, 1);    // Full right

      // Verify pan values
      const nodeManager = audioEngine['nodeManager'];
      expect(nodeManager?.setTrackPan).toHaveBeenCalledWith(1, -1);
      expect(nodeManager?.setTrackPan).toHaveBeenCalledWith(2, -0.5);
      expect(nodeManager?.setTrackPan).toHaveBeenCalledWith(3, 0.5);
      expect(nodeManager?.setTrackPan).toHaveBeenCalledWith(4, 1);
    });
  });

  describe('Level Monitoring Integration', () => {
    beforeEach(async () => {
      await audioEngine.initialize();
    });

    it('provides continuous level updates during recording', async () => {
      const levelUpdates: any[] = [];
      
      audioEngine.on('levelUpdate', (levels) => {
        levelUpdates.push({
          ...levels,
          timestamp: performance.now()
        });
      });

      // Set test data on analysers
      const nodeManager = audioEngine['nodeManager'];
      if (nodeManager) {
        setAnalyserTestData(nodeManager.masterAnalyser as any, 0.7);
        setAnalyserTestData(nodeManager.inputAnalyser as any, 0.5);
        
        nodeManager.trackNodes.forEach((nodes, trackId) => {
          setAnalyserTestData(nodes.analyserNode as any, 0.3 + trackId * 0.1);
        });
      }

      await audioEngine.startRecording({ trackId: 1 });
      await waitForAsync(200); // Collect some updates

      audioEngine.stopRecording();

      // Verify we got level updates
      expect(levelUpdates.length).toBeGreaterThan(5);

      // Verify update structure
      const lastUpdate = levelUpdates[levelUpdates.length - 1];
      expect(lastUpdate.master).toBeDefined();
      expect(lastUpdate.tracks).toBeDefined();
      expect(lastUpdate.input).toBeDefined();

      // Verify update rate (should be ~60fps)
      if (levelUpdates.length > 2) {
        const avgDelta = (levelUpdates[levelUpdates.length - 1].timestamp - 
                         levelUpdates[0].timestamp) / (levelUpdates.length - 1);
        expect(avgDelta).toBeLessThan(30); // Should be faster than 30ms
      }
    });

    it('excludes input levels when not recording', async () => {
      let hasInputLevel = false;
      
      audioEngine.on('levelUpdate', (levels) => {
        if (levels.input) {
          hasInputLevel = true;
        }
      });

      // Wait for updates without recording
      await waitForAsync(100);

      expect(hasInputLevel).toBe(false);
    });
  });

  describe('Error Recovery Integration', () => {
    it('recovers from permission denial', async () => {
      await audioEngine.initialize();

      // Mock permission denial
      jest.spyOn(navigator.mediaDevices, 'getUserMedia')
        .mockRejectedValueOnce(new DOMException('Permission denied'));

      const errorHandler = jest.fn();
      audioEngine.on('error', errorHandler);

      // Try to record
      await expect(audioEngine.startRecording({ trackId: 1 }))
        .rejects.toThrow('Permission denied');

      expect(errorHandler).toHaveBeenCalled();
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);

      // Mock permission granted
      jest.spyOn(navigator.mediaDevices, 'getUserMedia')
        .mockResolvedValueOnce(new MockMediaStream([new MockMediaStreamTrack()]) as any);

      // Should be able to record now
      await audioEngine.startRecording({ trackId: 1 });
      expect(audioEngine.getState()).toBe(AudioEngineState.RECORDING);
    });

    it('handles audio context failure gracefully', async () => {
      const errorContext = new MockAudioContext();
      errorContext.state = 'closed' as AudioContextState;
      
      (global as any).AudioContext = jest.fn().mockImplementation(() => errorContext);

      const errorEngine = new AudioEngine();
      
      await expect(errorEngine.initialize()).rejects.toThrow();
      
      errorEngine.dispose();
    });
  });

  describe('Memory Management', () => {
    it('properly cleans up resources after multiple cycles', async () => {
      await audioEngine.initialize();

      // Track object counts
      const initialNodeCount = audioEngine['nodeManager']?.trackNodes.size;

      // Perform multiple record/playback cycles
      for (let i = 0; i < 5; i++) {
        // Record
        await audioEngine.startRecording({ trackId: (i % 4) + 1 });
        await waitForAsync(100);
        audioEngine.stopRecording();

        // Add test buffer
        const track = audioEngine.getTrack((i % 4) + 1);
        if (track && audioEngine['audioContext']) {
          track.audioBuffer = createTestAudioBuffer(
            audioEngine['audioContext'],
            0.1,
            'noise'
          ) as any;
        }

        // Playback
        await audioEngine.startPlayback();
        await waitForAsync(50);
        audioEngine.stopPlayback();
      }

      // Verify no resource leaks
      const finalNodeCount = audioEngine['nodeManager']?.trackNodes.size;
      expect(finalNodeCount).toBe(initialNodeCount);

      // Verify media streams are cleaned up
      expect(audioEngine['mediaStream']).toBeNull();
      expect(audioEngine['inputSource']).toBeNull();
      expect(audioEngine['recorder']).toBeNull();
    });

    it('releases all resources on dispose', async () => {
      await audioEngine.initialize();

      // Start various operations
      await audioEngine.startRecording({ trackId: 1 });
      
      // Get references to managers
      const nodeManager = audioEngine['nodeManager'];
      const levelMonitor = audioEngine['levelMonitor'];
      const playbackManager = audioEngine['playbackManager'];
      const context = audioEngine['audioContext'];

      // Spy on cleanup methods
      const nodeDisposeSpy = jest.spyOn(nodeManager!, 'dispose');
      const levelDisposeSpy = jest.spyOn(levelMonitor!, 'dispose');
      const playbackDisposeSpy = jest.spyOn(playbackManager!, 'dispose');
      const contextCloseSpy = jest.spyOn(context!, 'close');

      // Dispose
      audioEngine.dispose();

      // Verify all cleanup methods called
      expect(nodeDisposeSpy).toHaveBeenCalled();
      expect(levelDisposeSpy).toHaveBeenCalled();
      expect(playbackDisposeSpy).toHaveBeenCalled();
      expect(contextCloseSpy).toHaveBeenCalled();

      // Verify state
      expect(audioEngine.getState()).toBe(AudioEngineState.IDLE);
      expect(audioEngine['audioContext']).toBeNull();
    });
  });

  describe('Performance Benchmarks', () => {
    it('maintains performance with maximum load', async () => {
      await audioEngine.initialize();

      const loadTestMonitor = new AudioPerformanceMonitor();

      // Add buffers to all tracks
      for (let i = 1; i <= 4; i++) {
        const track = audioEngine.getTrack(i);
        if (track && audioEngine['audioContext']) {
          // Create 5-minute buffer (max duration)
          track.audioBuffer = createTestAudioBuffer(
            audioEngine['audioContext'],
            300,
            'noise'
          ) as any;
        }
      }

      // Measure playback start time
      const startMeasure = loadTestMonitor.startMeasure('playback-start');
      await audioEngine.startPlayback();
      startMeasure();

      // Perform many control changes
      const controlMeasure = loadTestMonitor.startMeasure('control-changes');
      
      for (let i = 0; i < 100; i++) {
        const trackId = (i % 4) + 1;
        audioEngine.setTrackVolume(trackId, Math.random());
        audioEngine.setTrackPan(trackId, Math.random() * 2 - 1);
        
        if (i % 10 === 0) {
          audioEngine.muteTrack(trackId, i % 20 === 0);
        }
      }
      
      controlMeasure();

      // Check performance
      const startStats = loadTestMonitor.getStats('playback-start');
      const controlStats = loadTestMonitor.getStats('control-changes');

      expect(startStats?.avg).toBeLessThan(100); // Should start within 100ms
      expect(controlStats?.avg).toBeLessThan(50); // Control changes should be fast

      audioEngine.stopPlayback();
    });
  });
});