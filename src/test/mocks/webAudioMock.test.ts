import { 
  MockAudioContext, 
  MockGainNode,
  MockAnalyserNode,
  MockMediaStream,
  MockMediaStreamTrack,
  setupWebAudioMocks 
} from './webAudioMock';

describe('Web Audio Mock', () => {
  beforeEach(() => {
    setupWebAudioMocks();
  });

  describe('MockAudioContext', () => {
    it('creates audio context with correct properties', () => {
      const context = new MockAudioContext();
      expect(context.currentTime).toBe(0);
      expect(context.sampleRate).toBe(44100);
      expect(context.state).toBe('running');
    });

    it('creates gain node', () => {
      const context = new MockAudioContext();
      const gainNode = context.createGain();
      
      expect(gainNode).toBeInstanceOf(MockGainNode);
      expect(gainNode.gain.value).toBe(1);
    });

    it('creates analyser node', () => {
      const context = new MockAudioContext();
      const analyserNode = context.createAnalyser();
      
      expect(analyserNode).toBeInstanceOf(MockAnalyserNode);
      expect(analyserNode.fftSize).toBe(2048);
      expect(analyserNode.frequencyBinCount).toBe(1024);
    });

    it('creates stereo panner node', () => {
      const context = new MockAudioContext();
      const pannerNode = context.createStereoPanner();
      
      expect(pannerNode.pan.value).toBe(0);
    });

    it('creates media stream source', () => {
      const context = new MockAudioContext();
      const stream = new MockMediaStream();
      const sourceNode = context.createMediaStreamSource(stream);
      
      expect(sourceNode.mediaStream).toBe(stream);
      expect(sourceNode.numberOfInputs).toBe(0);
      expect(sourceNode.numberOfOutputs).toBe(1);
    });

    it('advances time correctly', () => {
      const context = new MockAudioContext();
      expect(context.currentTime).toBe(0);
      
      context.advanceTime(1.5);
      expect(context.currentTime).toBe(1.5);
    });

    it('handles context state changes', async () => {
      const context = new MockAudioContext();
      expect(context.state).toBe('running');
      
      await context.suspend();
      expect(context.state).toBe('suspended');
      
      await context.resume();
      expect(context.state).toBe('running');
      
      await context.close();
      expect(context.state).toBe('closed');
    });
  });

  describe('Node connections', () => {
    it('connects nodes correctly', () => {
      const context = new MockAudioContext();
      const gain1 = context.createGain();
      const gain2 = context.createGain();
      
      gain1.connect(gain2);
      expect(gain1.isConnectedTo(gain2)).toBe(true);
    });

    it('disconnects nodes correctly', () => {
      const context = new MockAudioContext();
      const gain1 = context.createGain();
      const gain2 = context.createGain();
      
      gain1.connect(gain2);
      gain1.disconnect(gain2);
      
      expect(gain1.isConnectedTo(gain2)).toBe(false);
    });

    it('disconnects all nodes when no target specified', () => {
      const context = new MockAudioContext();
      const gain1 = context.createGain();
      const gain2 = context.createGain();
      const gain3 = context.createGain();
      
      gain1.connect(gain2);
      gain1.connect(gain3);
      gain1.disconnect();
      
      expect(gain1.isConnectedTo(gain2)).toBe(false);
      expect(gain1.isConnectedTo(gain3)).toBe(false);
    });
  });

  describe('MockAnalyserNode', () => {
    it('provides time domain data', () => {
      const context = new MockAudioContext();
      const analyser = context.createAnalyser();
      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      
      analyser.setTimeDomainData(testData);
      
      const output = new Float32Array(4);
      analyser.getFloatTimeDomainData(output);
      
      expect(output[0]).toBeCloseTo(0.1, 5);
      expect(output[1]).toBeCloseTo(0.2, 5);
      expect(output[2]).toBeCloseTo(0.3, 5);
      expect(output[3]).toBeCloseTo(0.4, 5);
    });

    it('converts float time domain data to byte', () => {
      const context = new MockAudioContext();
      const analyser = context.createAnalyser();
      const testData = new Float32Array([0, 1, -1, 0.5]);
      
      analyser.setTimeDomainData(testData);
      
      const output = new Uint8Array(4);
      analyser.getByteTimeDomainData(output);
      
      // Convert from [-1, 1] to [0, 255]
      // 0 -> 127.5 (floor to 127)
      // 1 -> 255
      // -1 -> 0
      // 0.5 -> 191.25 (floor to 191)
      expect(Array.from(output)).toEqual([127, 255, 0, 191]);
    });
  });

  describe('MockMediaStream', () => {
    it('creates media stream with tracks', () => {
      const track1 = new MockMediaStreamTrack();
      const track2 = new MockMediaStreamTrack();
      const stream = new MockMediaStream([track1, track2]);
      
      expect(stream.getTracks()).toHaveLength(2);
      expect(stream.getAudioTracks()).toHaveLength(2);
      expect(stream.active).toBe(true);
    });

    it('adds and removes tracks', () => {
      const stream = new MockMediaStream();
      const track = new MockMediaStreamTrack();
      
      stream.addTrack(track);
      expect(stream.getTracks()).toHaveLength(1);
      
      stream.removeTrack(track);
      expect(stream.getTracks()).toHaveLength(0);
    });

    it('clones stream with tracks', () => {
      const track = new MockMediaStreamTrack();
      const stream = new MockMediaStream([track]);
      const cloned = stream.clone();
      
      expect(cloned).not.toBe(stream);
      expect(cloned.getTracks()).toHaveLength(1);
      expect(cloned.getTracks()[0]).not.toBe(track);
    });
  });

  describe('getUserMedia mock', () => {
    it('returns media stream with audio track', async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      expect(stream).toBeInstanceOf(MockMediaStream);
      expect(stream.getAudioTracks()).toHaveLength(1);
      expect(stream.getAudioTracks()[0].kind).toBe('audio');
    });

    it('enumerates devices', async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      expect(devices).toHaveLength(1);
      expect(devices[0]).toMatchObject({
        deviceId: 'default',
        kind: 'audioinput',
        label: 'Default Audio Input',
        groupId: 'default-group'
      });
    });
  });

  describe('MockAudioParam', () => {
    it('sets value at time', () => {
      const context = new MockAudioContext();
      const gain = context.createGain();
      
      gain.gain.setValueAtTime(0.5, 1.0);
      expect(gain.gain.value).toBe(1); // Value doesn't change immediately in our mock
    });

    it('schedules linear ramp', () => {
      const context = new MockAudioContext();
      const gain = context.createGain();
      
      gain.gain.linearRampToValueAtTime(0, 2.0);
      // Mock doesn't implement actual ramping, just records the event
    });

    it('cancels scheduled values', () => {
      const context = new MockAudioContext();
      const gain = context.createGain();
      
      gain.gain.setValueAtTime(0.5, 1.0);
      gain.gain.setValueAtTime(0.7, 2.0);
      gain.gain.cancelScheduledValues(1.5);
      
      // Mock implementation tracks automation events
    });
  });
});