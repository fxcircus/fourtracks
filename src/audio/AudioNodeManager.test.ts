import { AudioNodeManager, Crossfader } from './AudioNodeManager';
import { MockAudioContext, MockGainNode, MockAnalyserNode, MockStereoPannerNode, MockMediaStreamAudioSourceNode } from '../test/mocks/webAudioMock';

describe('AudioNodeManager', () => {
  let audioContext: MockAudioContext;
  let nodeManager: AudioNodeManager;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    nodeManager = new AudioNodeManager(audioContext as any);
  });

  afterEach(() => {
    nodeManager.dispose();
  });

  describe('initialization', () => {
    it('creates master nodes correctly', () => {
      expect(nodeManager.masterGain).toBeDefined();
      expect(nodeManager.masterAnalyser).toBeDefined();
      expect(nodeManager.inputGain).toBeDefined();
      expect(nodeManager.inputAnalyser).toBeDefined();
    });

    it('connects master chain to destination', () => {
      const masterGain = nodeManager.masterGain as MockGainNode;
      const masterAnalyser = nodeManager.masterAnalyser as MockAnalyserNode;
      
      expect(masterGain.isConnectedTo(masterAnalyser)).toBe(true);
      expect(masterAnalyser.isConnectedTo(audioContext.destination)).toBe(true);
    });

    it('sets correct initial values', () => {
      const masterGain = nodeManager.masterGain as MockGainNode;
      const inputGain = nodeManager.inputGain as MockGainNode;
      
      expect(masterGain.gain.value).toBe(1);
      expect(inputGain.gain.value).toBe(1);
    });

    it('configures analysers correctly', () => {
      const masterAnalyser = nodeManager.masterAnalyser as MockAnalyserNode;
      const inputAnalyser = nodeManager.inputAnalyser as MockAnalyserNode;
      
      expect(masterAnalyser.fftSize).toBe(2048);
      expect(masterAnalyser.smoothingTimeConstant).toBe(0.8);
      expect(inputAnalyser.fftSize).toBe(2048);
    });
  });

  describe('track node creation', () => {
    it('creates nodes for specified number of tracks', () => {
      nodeManager.createTrackNodes(4);
      
      expect(nodeManager.trackNodes.size).toBe(4);
      
      for (let i = 1; i <= 4; i++) {
        const nodes = nodeManager.getTrackNodes(i);
        expect(nodes).toBeDefined();
        expect(nodes?.gainNode).toBeDefined();
        expect(nodes?.panNode).toBeDefined();
        expect(nodes?.analyserNode).toBeDefined();
      }
    });

    it('creates track nodes with correct initial values', () => {
      nodeManager.createTrackNodes(2);
      
      const track1 = nodeManager.getTrackNodes(1);
      const gainNode = track1?.gainNode as MockGainNode;
      const panNode = track1?.panNode as MockStereoPannerNode;
      
      expect(gainNode.gain.value).toBe(1);
      expect(panNode.pan.value).toBe(0);
    });

    it('connects track nodes in correct order', () => {
      nodeManager.createTrackNodes(1);
      
      const nodes = nodeManager.getTrackNodes(1);
      const gainNode = nodes?.gainNode as MockGainNode;
      const panNode = nodes?.panNode as MockStereoPannerNode;
      const analyserNode = nodes?.analyserNode as MockAnalyserNode;
      
      expect(gainNode.isConnectedTo(panNode)).toBe(true);
      expect(panNode.isConnectedTo(analyserNode)).toBe(true);
      expect(analyserNode.isConnectedTo(nodeManager.masterGain)).toBe(true);
    });

    it('can create custom number of tracks', () => {
      nodeManager.createTrackNodes(8);
      expect(nodeManager.trackNodes.size).toBe(8);
    });
  });

  describe('track controls', () => {
    beforeEach(() => {
      nodeManager.createTrackNodes(4);
    });

    describe('setTrackGain', () => {
      it('sets track gain value', () => {
        nodeManager.setTrackGain(1, 0.5);
        
        const nodes = nodeManager.getTrackNodes(1);
        const gainNode = nodes?.gainNode as MockGainNode;
        
        expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(
          0.5,
          audioContext.currentTime
        );
      });

      it('clamps gain values between 0 and 1', () => {
        nodeManager.setTrackGain(1, -0.5);
        const nodes1 = nodeManager.getTrackNodes(1);
        const gainNode1 = nodes1?.gainNode as MockGainNode;
        expect(gainNode1.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));

        nodeManager.setTrackGain(2, 1.5);
        const nodes2 = nodeManager.getTrackNodes(2);
        const gainNode2 = nodes2?.gainNode as MockGainNode;
        expect(gainNode2.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
      });

      it('schedules gain change at specified time', () => {
        const futureTime = audioContext.currentTime + 1;
        nodeManager.setTrackGain(1, 0.7, futureTime);
        
        const nodes = nodeManager.getTrackNodes(1);
        const gainNode = nodes?.gainNode as MockGainNode;
        
        expect(gainNode.gain.setValueAtTime).toHaveBeenCalledWith(0.7, futureTime);
      });

      it('ignores invalid track IDs', () => {
        expect(() => nodeManager.setTrackGain(999, 0.5)).not.toThrow();
      });
    });

    describe('setTrackPan', () => {
      it('sets track pan value', () => {
        nodeManager.setTrackPan(1, -0.5);
        
        const nodes = nodeManager.getTrackNodes(1);
        const panNode = nodes?.panNode as MockStereoPannerNode;
        
        expect(panNode.pan.setValueAtTime).toHaveBeenCalledWith(
          -0.5,
          audioContext.currentTime
        );
      });

      it('clamps pan values between -1 and 1', () => {
        nodeManager.setTrackPan(1, -1.5);
        const nodes1 = nodeManager.getTrackNodes(1);
        const panNode1 = nodes1?.panNode as MockStereoPannerNode;
        expect(panNode1.pan.setValueAtTime).toHaveBeenCalledWith(-1, expect.any(Number));

        nodeManager.setTrackPan(2, 1.5);
        const nodes2 = nodeManager.getTrackNodes(2);
        const panNode2 = nodes2?.panNode as MockStereoPannerNode;
        expect(panNode2.pan.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
      });

      it('schedules pan change at specified time', () => {
        const futureTime = audioContext.currentTime + 2;
        nodeManager.setTrackPan(1, 0.3, futureTime);
        
        const nodes = nodeManager.getTrackNodes(1);
        const panNode = nodes?.panNode as MockStereoPannerNode;
        
        expect(panNode.pan.setValueAtTime).toHaveBeenCalledWith(0.3, futureTime);
      });

      it('ignores invalid track IDs', () => {
        expect(() => nodeManager.setTrackPan(999, 0)).not.toThrow();
      });
    });
  });

  describe('input management', () => {
    it('connects input source correctly', () => {
      const source = audioContext.createMediaStreamSource(new MediaStream());
      const mockSource = source as MockMediaStreamAudioSourceNode;
      
      nodeManager.connectInput(mockSource);
      
      expect(mockSource.isConnectedTo(nodeManager.inputGain)).toBe(true);
      expect((nodeManager.inputGain as MockGainNode).isConnectedTo(nodeManager.inputAnalyser)).toBe(true);
    });

    it('disconnects input source correctly', () => {
      const source = audioContext.createMediaStreamSource(new MediaStream());
      const mockSource = source as MockMediaStreamAudioSourceNode;
      
      nodeManager.connectInput(mockSource);
      nodeManager.disconnectInput(mockSource);
      
      expect(mockSource.isConnectedTo(nodeManager.inputGain)).toBe(false);
    });

    it('handles disconnecting already disconnected source', () => {
      const source = audioContext.createMediaStreamSource(new MediaStream());
      const mockSource = source as MockMediaStreamAudioSourceNode;
      
      // Should not throw
      expect(() => nodeManager.disconnectInput(mockSource)).not.toThrow();
    });
  });

  describe('disposal', () => {
    it('disconnects all nodes on dispose', () => {
      nodeManager.createTrackNodes(2);
      
      const track1 = nodeManager.getTrackNodes(1);
      const track2 = nodeManager.getTrackNodes(2);
      
      const disconnectSpies = [
        jest.spyOn(track1!.gainNode, 'disconnect'),
        jest.spyOn(track1!.panNode, 'disconnect'),
        jest.spyOn(track1!.analyserNode, 'disconnect'),
        jest.spyOn(track2!.gainNode, 'disconnect'),
        jest.spyOn(track2!.panNode, 'disconnect'),
        jest.spyOn(track2!.analyserNode, 'disconnect'),
        jest.spyOn(nodeManager.masterGain, 'disconnect'),
        jest.spyOn(nodeManager.masterAnalyser, 'disconnect'),
        jest.spyOn(nodeManager.inputGain, 'disconnect'),
        jest.spyOn(nodeManager.inputAnalyser, 'disconnect')
      ];
      
      nodeManager.dispose();
      
      disconnectSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled();
      });
    });

    it('clears track nodes on dispose', () => {
      nodeManager.createTrackNodes(4);
      nodeManager.dispose();
      
      expect(nodeManager.trackNodes.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('returns undefined for non-existent track', () => {
      nodeManager.createTrackNodes(4);
      expect(nodeManager.getTrackNodes(5)).toBeUndefined();
      expect(nodeManager.getTrackNodes(0)).toBeUndefined();
      expect(nodeManager.getTrackNodes(-1)).toBeUndefined();
    });

    it('handles creating zero tracks', () => {
      nodeManager.createTrackNodes(0);
      expect(nodeManager.trackNodes.size).toBe(0);
    });

    it('overwrites existing tracks when creating new ones', () => {
      nodeManager.createTrackNodes(2);
      const firstTrack1 = nodeManager.getTrackNodes(1);
      
      nodeManager.createTrackNodes(3);
      const secondTrack1 = nodeManager.getTrackNodes(1);
      
      expect(nodeManager.trackNodes.size).toBe(3);
      expect(firstTrack1).not.toBe(secondTrack1);
    });
  });
});

describe('Crossfader', () => {
  let audioContext: MockAudioContext;
  let crossfader: Crossfader;
  let gainNode1: MockGainNode;
  let gainNode2: MockGainNode;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    crossfader = new Crossfader(audioContext as any);
    gainNode1 = audioContext.createGain() as MockGainNode;
    gainNode2 = audioContext.createGain() as MockGainNode;
  });

  describe('fadeIn', () => {
    it('fades in from 0 to target gain', () => {
      crossfader.fadeIn(gainNode1 as any);
      
      expect(gainNode1.gain.cancelScheduledValues).toHaveBeenCalledWith(audioContext.currentTime);
      expect(gainNode1.gain.setValueAtTime).toHaveBeenCalledWith(0, audioContext.currentTime);
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        audioContext.currentTime + 0.05
      );
    });

    it('fades in to custom target gain', () => {
      crossfader.fadeIn(gainNode1 as any, 0.7);
      
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0.7,
        audioContext.currentTime + 0.05
      );
    });

    it('uses default fade time', () => {
      const customFader = new Crossfader(audioContext as any, 0.1);
      customFader.fadeIn(gainNode1 as any);
      
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        audioContext.currentTime + 0.1
      );
    });
  });

  describe('fadeOut', () => {
    it('fades out to 0', () => {
      gainNode1.gain.value = 0.8;
      crossfader.fadeOut(gainNode1 as any);
      
      expect(gainNode1.gain.cancelScheduledValues).toHaveBeenCalledWith(audioContext.currentTime);
      expect(gainNode1.gain.setValueAtTime).toHaveBeenCalledWith(0.8, audioContext.currentTime);
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        audioContext.currentTime + 0.05
      );
    });
  });

  describe('crossfade', () => {
    it('crossfades between two nodes', () => {
      gainNode1.gain.value = 1;
      gainNode2.gain.value = 0;
      
      crossfader.crossfade(gainNode1 as any, gainNode2 as any);
      
      // From node fades out
      expect(gainNode1.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(gainNode1.gain.setValueAtTime).toHaveBeenCalledWith(1, audioContext.currentTime);
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        audioContext.currentTime + 0.05
      );
      
      // To node fades in
      expect(gainNode2.gain.cancelScheduledValues).toHaveBeenCalled();
      expect(gainNode2.gain.setValueAtTime).toHaveBeenCalledWith(0, audioContext.currentTime);
      expect(gainNode2.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        audioContext.currentTime + 0.05
      );
    });

    it('uses custom crossfade duration', () => {
      crossfader.crossfade(gainNode1 as any, gainNode2 as any, 0.2);
      
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        audioContext.currentTime + 0.2
      );
      expect(gainNode2.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        audioContext.currentTime + 0.2
      );
    });
  });

  describe('timing', () => {
    it('schedules fades at correct times', () => {
      const startTime = audioContext.currentTime;
      
      // Advance time
      audioContext.advanceTime(1);
      
      crossfader.fadeIn(gainNode1 as any);
      
      expect(gainNode1.gain.setValueAtTime).toHaveBeenCalledWith(0, startTime + 1);
      expect(gainNode1.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        1,
        startTime + 1.05
      );
    });
  });
});