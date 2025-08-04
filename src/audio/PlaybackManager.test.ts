import { PlaybackManager, TransportControls } from './PlaybackManager';
import { AudioNodeManager } from './AudioNodeManager';
import { Track } from './types';
import { MockAudioContext, MockAudioBufferSourceNode, MockAudioBuffer } from '../test/mocks/webAudioMock';

describe('PlaybackManager', () => {
  let audioContext: MockAudioContext;
  let nodeManager: AudioNodeManager;
  let playbackManager: PlaybackManager;
  let tracks: Map<number, Track>;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    nodeManager = new AudioNodeManager(audioContext as any);
    nodeManager.createTrackNodes(4);
    playbackManager = new PlaybackManager(audioContext as any, nodeManager);
    
    // Create test tracks
    tracks = new Map();
    for (let i = 1; i <= 4; i++) {
      const buffer = new MockAudioBuffer(2, 44100 * 2, 44100); // 2 second buffer
      tracks.set(i, {
        id: i,
        name: `Track ${i}`,
        audioBuffer: i <= 2 ? buffer as any : null, // Only first 2 tracks have audio
        isRecording: false,
        isPlaying: false,
        isMuted: false,
        isSolo: false,
        volume: 1,
        pan: 0,
        peakLevel: 0,
        rmsLevel: 0
      });
    }
  });

  afterEach(() => {
    playbackManager.dispose();
  });

  describe('start', () => {
    it('starts playback for tracks with audio buffers', () => {
      const activeCount = playbackManager.start(tracks);
      
      expect(activeCount).toBe(2); // Only 2 tracks have buffers
      expect(tracks.get(1)?.isPlaying).toBe(true);
      expect(tracks.get(2)?.isPlaying).toBe(true);
      expect(tracks.get(3)?.isPlaying).toBe(false);
      expect(tracks.get(4)?.isPlaying).toBe(false);
    });

    it('skips muted tracks', () => {
      tracks.get(1)!.isMuted = true;
      
      const activeCount = playbackManager.start(tracks);
      
      expect(activeCount).toBe(1); // Only track 2 plays
      expect(tracks.get(1)?.isPlaying).toBe(false);
      expect(tracks.get(2)?.isPlaying).toBe(true);
    });

    it('creates buffer source nodes for each playing track', () => {
      const createSourceSpy = jest.spyOn(audioContext, 'createBufferSource');
      
      playbackManager.start(tracks);
      
      expect(createSourceSpy).toHaveBeenCalledTimes(2);
    });

    it('connects sources to track nodes', () => {
      playbackManager.start(tracks);
      
      // Verify connections were made (implementation detail)
      expect(playbackManager['playbackSources'].size).toBe(2);
    });

    it('applies playback options', () => {
      const options = {
        loop: true,
        startTime: 0.5,
        endTime: 1.5
      };
      
      playbackManager.start(tracks, options);
      
      // Get the created source nodes
      const sources = Array.from(playbackManager['playbackSources'].values());
      sources.forEach(source => {
        expect(source.loop).toBe(true);
      });
    });

    it('stops existing playback before starting new', () => {
      const stopSpy = jest.spyOn(playbackManager, 'stop');
      
      playbackManager.start(tracks);
      playbackManager.start(tracks); // Start again
      
      expect(stopSpy).toHaveBeenCalledTimes(2); // Called before each start
    });

    it('handles tracks without audio buffers', () => {
      tracks.get(1)!.audioBuffer = null;
      tracks.get(2)!.audioBuffer = null;
      
      const activeCount = playbackManager.start(tracks);
      
      expect(activeCount).toBe(0);
    });

    it('sets up onended callback for each source', () => {
      playbackManager.start(tracks);
      
      const sources = Array.from(playbackManager['playbackSources'].values());
      sources.forEach(source => {
        expect(source.onended).toBeDefined();
      });
    });

    it('triggers end callback when all tracks finish', () => {
      const endCallback = jest.fn();
      playbackManager.setEndCallback(endCallback);
      
      playbackManager.start(tracks);
      
      // Simulate all tracks ending
      const sources = Array.from(playbackManager['playbackSources'].entries());
      sources.forEach(([trackId, source]) => {
        // Trigger onended
        if (source.onended) {
          source.onended.call(source as any, new Event('ended'));
        }
      });
      
      expect(endCallback).toHaveBeenCalled();
    });

    it('updates track playing state when individual track ends', () => {
      playbackManager.start(tracks);
      
      // Get source for track 1
      const source = playbackManager['playbackSources'].get(1);
      if (source?.onended) {
        source.onended.call(source as any, new Event('ended'));
      }
      
      expect(tracks.get(1)?.isPlaying).toBe(false);
      expect(tracks.get(2)?.isPlaying).toBe(true);
    });
  });

  describe('stop', () => {
    it('stops all playing sources', () => {
      playbackManager.start(tracks);
      
      const sources = Array.from(playbackManager['playbackSources'].values());
      const stopSpies = sources.map(source => jest.spyOn(source, 'stop'));
      
      playbackManager.stop();
      
      stopSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('disconnects all sources', () => {
      playbackManager.start(tracks);
      
      const sources = Array.from(playbackManager['playbackSources'].values());
      const disconnectSpies = sources.map(source => jest.spyOn(source, 'disconnect'));
      
      playbackManager.stop();
      
      disconnectSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('clears playback sources map', () => {
      playbackManager.start(tracks);
      expect(playbackManager['playbackSources'].size).toBe(2);
      
      playbackManager.stop();
      expect(playbackManager['playbackSources'].size).toBe(0);
    });

    it('handles stopping when nothing is playing', () => {
      expect(() => playbackManager.stop()).not.toThrow();
    });

    it('handles errors during stop gracefully', () => {
      playbackManager.start(tracks);
      
      // Make stop throw an error
      const source = playbackManager['playbackSources'].get(1);
      if (source) {
        source.stop = jest.fn().mockImplementation(() => {
          throw new Error('Already stopped');
        });
      }
      
      expect(() => playbackManager.stop()).not.toThrow();
    });
  });

  describe('pause', () => {
    it('stops playback when pause is called', () => {
      const stopSpy = jest.spyOn(playbackManager, 'stop');
      
      playbackManager.start(tracks);
      playbackManager.pause();
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('getElapsedTime', () => {
    it('returns 0 when not playing', () => {
      expect(playbackManager.getElapsedTime()).toBe(0);
    });

    it('calculates elapsed time correctly', () => {
      playbackManager.start(tracks);
      
      // Advance audio context time
      audioContext.advanceTime(1.5);
      
      expect(playbackManager.getElapsedTime()).toBe(1.5);
    });

    it('returns 0 after stopping', () => {
      playbackManager.start(tracks);
      audioContext.advanceTime(1);
      playbackManager.stop();
      
      expect(playbackManager.getElapsedTime()).toBe(0);
    });
  });

  describe('isPlaying', () => {
    it('returns false when not playing', () => {
      expect(playbackManager.isPlaying()).toBe(false);
    });

    it('returns true when playing', () => {
      playbackManager.start(tracks);
      expect(playbackManager.isPlaying()).toBe(true);
    });

    it('returns false after stopping', () => {
      playbackManager.start(tracks);
      playbackManager.stop();
      expect(playbackManager.isPlaying()).toBe(false);
    });
  });

  describe('setEndCallback', () => {
    it('sets end callback', () => {
      const callback = jest.fn();
      playbackManager.setEndCallback(callback);
      
      expect(playbackManager['onEnded']).toBe(callback);
    });

    it('replaces existing callback', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      playbackManager.setEndCallback(callback1);
      playbackManager.setEndCallback(callback2);
      
      expect(playbackManager['onEnded']).toBe(callback2);
    });
  });

  describe('dispose', () => {
    it('stops playback on dispose', () => {
      const stopSpy = jest.spyOn(playbackManager, 'stop');
      
      playbackManager.start(tracks);
      playbackManager.dispose();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('clears end callback', () => {
      playbackManager.setEndCallback(() => {});
      playbackManager.dispose();
      
      expect(playbackManager['onEnded']).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('handles empty tracks map', () => {
      const emptyTracks = new Map<number, Track>();
      const activeCount = playbackManager.start(emptyTracks);
      
      expect(activeCount).toBe(0);
    });

    it('handles tracks with very short buffers', () => {
      const shortBuffer = new MockAudioBuffer(2, 100, 44100); // Very short buffer
      tracks.get(1)!.audioBuffer = shortBuffer as any;
      
      const activeCount = playbackManager.start(tracks);
      expect(activeCount).toBe(2);
    });

    it('respects startTime and endTime options', () => {
      const startSpy = jest.spyOn(MockAudioBufferSourceNode.prototype, 'start');
      
      playbackManager.start(tracks, {
        startTime: 0.5,
        endTime: 1.5
      });
      
      expect(startSpy).toHaveBeenCalledWith(0, 0.5, 1); // duration = endTime - startTime
    });

    it('handles invalid node manager state', () => {
      // Remove track nodes to simulate invalid state
      nodeManager.trackNodes.clear();
      
      const activeCount = playbackManager.start(tracks);
      expect(activeCount).toBe(0); // No tracks can play without nodes
    });
  });
});

describe('TransportControls', () => {
  let audioContext: MockAudioContext;
  let nodeManager: AudioNodeManager;
  let playbackManager: PlaybackManager;
  let transportControls: TransportControls;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    nodeManager = new AudioNodeManager(audioContext as any);
    playbackManager = new PlaybackManager(audioContext as any, nodeManager);
    transportControls = new TransportControls(audioContext as any, playbackManager);
  });

  describe('setLoop', () => {
    it('enables looping', () => {
      transportControls.setLoop(true);
      expect(transportControls['isLooping']).toBe(true);
    });

    it('disables looping', () => {
      transportControls.setLoop(true);
      transportControls.setLoop(false);
      expect(transportControls['isLooping']).toBe(false);
    });

    it('sets loop start and end points', () => {
      transportControls.setLoop(true, 1.5, 3.5);
      
      expect(transportControls['isLooping']).toBe(true);
      expect(transportControls['loopStart']).toBe(1.5);
      expect(transportControls['loopEnd']).toBe(3.5);
    });

    it('updates loop points independently', () => {
      transportControls.setLoop(true, 1, 5);
      transportControls.setLoop(true, 2); // Update only start
      
      expect(transportControls['loopStart']).toBe(2);
      expect(transportControls['loopEnd']).toBe(5);
      
      transportControls.setLoop(true, undefined, 4); // Update only end
      expect(transportControls['loopStart']).toBe(2);
      expect(transportControls['loopEnd']).toBe(4);
    });
  });

  describe('getTransportTime', () => {
    it('delegates to playback manager', () => {
      const getElapsedSpy = jest.spyOn(playbackManager, 'getElapsedTime').mockReturnValue(2.5);
      
      const time = transportControls.getTransportTime();
      
      expect(getElapsedSpy).toHaveBeenCalled();
      expect(time).toBe(2.5);
    });
  });

  describe('seek', () => {
    it('stops playback if currently playing', () => {
      const isPlayingSpy = jest.spyOn(playbackManager, 'isPlaying').mockReturnValue(true);
      const stopSpy = jest.spyOn(playbackManager, 'stop');
      
      transportControls.seek(5);
      
      expect(isPlayingSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('does not stop if not playing', () => {
      jest.spyOn(playbackManager, 'isPlaying').mockReturnValue(false);
      const stopSpy = jest.spyOn(playbackManager, 'stop');
      
      transportControls.seek(5);
      
      expect(stopSpy).not.toHaveBeenCalled();
    });
  });
});