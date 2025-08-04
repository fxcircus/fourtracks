import { AudioBufferRecorder } from './AudioBufferRecorder';
import { MockAudioContext, MockGainNode, MockAudioWorklet } from '../test/mocks/webAudioMock';
import { RecordingBuffer } from './types';

// Mock AudioWorkletNode since it's not in our mocks
class MockAudioWorkletNode {
  public port = {
    postMessage: jest.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null
  };
  public numberOfInputs = 1;
  public numberOfOutputs = 1;
  
  connect = jest.fn();
  disconnect = jest.fn();
}

describe('AudioBufferRecorder', () => {
  let audioContext: MockAudioContext;
  let inputGain: MockGainNode;
  let recorder: AudioBufferRecorder;
  let mockWorkletNode: MockAudioWorkletNode;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    inputGain = audioContext.createGain() as MockGainNode;
    recorder = new AudioBufferRecorder(audioContext as any, inputGain as any);
    
    // Mock AudioWorkletNode constructor
    mockWorkletNode = new MockAudioWorkletNode();
    (global as any).AudioWorkletNode = jest.fn().mockImplementation(() => mockWorkletNode);
  });

  afterEach(() => {
    recorder.dispose();
  });

  describe('initialization', () => {
    it('creates recorder with audio context and input gain', () => {
      expect(recorder).toBeDefined();
      expect(recorder['audioContext']).toBe(audioContext);
      expect(recorder['inputGain']).toBe(inputGain);
    });

    it('attempts to load AudioWorklet module', async () => {
      const addModuleSpy = jest.spyOn(audioContext.audioWorklet, 'addModule')
        .mockResolvedValueOnce(undefined);
      
      await recorder.initialize();
      
      expect(addModuleSpy).toHaveBeenCalledWith('/src/audio/RecorderProcessor.js');
    });

    it('creates AudioWorkletNode on successful initialization', async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      
      await recorder.initialize();
      
      expect(global.AudioWorkletNode).toHaveBeenCalledWith(
        audioContext,
        'recorder-processor',
        expect.objectContaining({
          numberOfInputs: 1,
          numberOfOutputs: 1,
          processorOptions: {
            bufferSize: 128
          }
        })
      );
      
      expect(recorder['workletNode']).toBe(mockWorkletNode);
    });

    it('sets up message handler for worklet port', async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      
      await recorder.initialize();
      
      expect(mockWorkletNode.port.onmessage).toBeDefined();
      expect(typeof mockWorkletNode.port.onmessage).toBe('function');
    });

    it('throws error when AudioWorklet is not supported', async () => {
      // This is already mocked to reject in our mock implementation
      await expect(recorder.initialize()).rejects.toThrow('AudioWorklet not supported');
    });
  });

  describe('start', () => {
    beforeEach(async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
    });

    it('throws error if not initialized', async () => {
      const uninitializedRecorder = new AudioBufferRecorder(audioContext as any, inputGain as any);
      
      await expect(uninitializedRecorder.start()).rejects.toThrow('Recorder not initialized');
    });

    it('throws error if already recording', async () => {
      await recorder.start();
      
      await expect(recorder.start()).rejects.toThrow('Already recording');
    });

    it('connects audio chain correctly', async () => {
      const connectSpy = jest.spyOn(inputGain, 'connect');
      const workletConnectSpy = jest.spyOn(mockWorkletNode, 'connect');
      
      await recorder.start();
      
      expect(connectSpy).toHaveBeenCalledWith(mockWorkletNode);
      expect(workletConnectSpy).toHaveBeenCalledWith(audioContext.destination);
    });

    it('posts start message to worklet', async () => {
      await recorder.start(2);
      
      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'start',
        channelCount: 2
      });
    });

    it('sets recording state', async () => {
      expect(recorder['isRecording']).toBe(false);
      
      await recorder.start();
      
      expect(recorder['isRecording']).toBe(true);
      expect(recorder['recordingStartTime']).toBe(audioContext.currentTime);
    });

    it('uses default channel count', async () => {
      await recorder.start();
      
      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({
        type: 'start',
        channelCount: 2
      });
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
    });

    it('does nothing if not recording', () => {
      recorder.stop();
      
      expect(mockWorkletNode.port.postMessage).not.toHaveBeenCalled();
    });

    it('posts stop message to worklet', async () => {
      await recorder.start();
      recorder.stop();
      
      expect(mockWorkletNode.port.postMessage).toHaveBeenCalledWith({ type: 'stop' });
    });

    it('disconnects audio chain', async () => {
      await recorder.start();
      
      const inputDisconnectSpy = jest.spyOn(inputGain, 'disconnect');
      const workletDisconnectSpy = jest.spyOn(mockWorkletNode, 'disconnect');
      
      recorder.stop();
      
      expect(inputDisconnectSpy).toHaveBeenCalledWith(mockWorkletNode);
      expect(workletDisconnectSpy).toHaveBeenCalled();
    });

    it('updates recording state', async () => {
      await recorder.start();
      recorder.stop();
      
      expect(recorder['isRecording']).toBe(false);
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
    });

    it('handles progress messages', async () => {
      const progressCallback = jest.fn();
      recorder.setProgressCallback(progressCallback);
      
      await recorder.start();
      audioContext.advanceTime(1); // Advance time by 1 second
      
      // Simulate progress message from worklet
      const progressEvent = new MessageEvent('message', {
        data: { type: 'progress', bufferLength: 44100 }
      });
      
      mockWorkletNode.port.onmessage!(progressEvent);
      
      expect(progressCallback).toHaveBeenCalledWith(1); // Current time - start time
    });

    it('handles recording complete messages', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start();
      audioContext.advanceTime(2); // 2 second recording
      
      // Create test recording data
      const testData = [
        new Float32Array(88200), // 2 seconds at 44100Hz
        new Float32Array(88200)
      ];
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: testData }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      expect(completeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 44100,
          numberOfChannels: 2,
          length: 88200,
          channelData: expect.any(Array)
        })
      );
    });

    it('ignores progress when not recording', async () => {
      const progressCallback = jest.fn();
      recorder.setProgressCallback(progressCallback);
      
      // Don't start recording
      const progressEvent = new MessageEvent('message', {
        data: { type: 'progress', bufferLength: 44100 }
      });
      
      mockWorkletNode.port.onmessage!(progressEvent);
      
      expect(progressCallback).not.toHaveBeenCalled();
    });

    it('handles unknown message types', async () => {
      await recorder.start();
      
      const unknownEvent = new MessageEvent('message', {
        data: { type: 'unknown', someData: 'test' }
      });
      
      // Should not throw
      expect(() => mockWorkletNode.port.onmessage!(unknownEvent)).not.toThrow();
    });
  });

  describe('recording data processing', () => {
    beforeEach(async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
    });

    it('processes mono recording correctly', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(1); // Mono recording
      audioContext.advanceTime(1);
      
      const testData = [new Float32Array(44100).fill(0.5)];
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: testData }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.numberOfChannels).toBe(1);
      expect(callArgs.channelData.length).toBe(1);
      expect(callArgs.channelData[0].length).toBe(44100);
    });

    it('processes stereo recording correctly', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(2); // Stereo recording
      audioContext.advanceTime(0.5);
      
      // Simulate interleaved channel data from worklet
      const testData = [
        new Float32Array(22050).fill(0.3), // Left channel
        new Float32Array(22050).fill(0.7)  // Right channel
      ];
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: testData }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.numberOfChannels).toBe(2);
      expect(callArgs.channelData.length).toBe(2);
      expect(callArgs.channelData[0].length).toBe(22050);
      expect(callArgs.channelData[1].length).toBe(22050);
    });

    it('handles empty recording data', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start();
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: [] }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.numberOfChannels).toBe(2); // Default
      expect(callArgs.length).toBe(0);
    });

    it('limits to maximum 2 channels', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(4); // Request 4 channels
      
      // Simulate 4 channel data
      const testData = [
        new Float32Array(1000),
        new Float32Array(1000),
        new Float32Array(1000),
        new Float32Array(1000)
      ];
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: testData }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.numberOfChannels).toBe(2); // Limited to 2
    });
  });

  describe('callbacks', () => {
    it('sets progress callback', () => {
      const callback = jest.fn();
      recorder.setProgressCallback(callback);
      
      expect(recorder['onProgress']).toBe(callback);
    });

    it('sets complete callback', () => {
      const callback = jest.fn();
      recorder.setCompleteCallback(callback);
      
      expect(recorder['onComplete']).toBe(callback);
    });

    it('replaces existing callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      recorder.setProgressCallback(callback1);
      recorder.setProgressCallback(callback2);
      
      expect(recorder['onProgress']).toBe(callback2);
    });
  });

  describe('dispose', () => {
    beforeEach(async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
    });

    it('stops recording on dispose', async () => {
      const stopSpy = jest.spyOn(recorder, 'stop');
      
      await recorder.start();
      recorder.dispose();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('clears worklet node reference', () => {
      recorder.dispose();
      
      expect(recorder['workletNode']).toBeNull();
    });

    it('can be called multiple times safely', () => {
      expect(() => {
        recorder.dispose();
        recorder.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles very long recordings', async () => {
      jest.spyOn(audioContext.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      await recorder.initialize();
      
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start();
      audioContext.advanceTime(300); // 5 minutes
      
      const longData = [
        new Float32Array(44100 * 300), // 5 minutes of audio
        new Float32Array(44100 * 300)
      ];
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: longData }
      });
      
      mockWorkletNode.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.length).toBe(44100 * 300);
    });

    it('handles recording with different sample rates', async () => {
      const context48k = new MockAudioContext();
      context48k.sampleRate = 48000;
      
      const recorder48k = new AudioBufferRecorder(context48k as any, inputGain as any);
      jest.spyOn(context48k.audioWorklet, 'addModule').mockResolvedValueOnce(undefined);
      
      // Create new mock worklet node for this recorder
      const worklet48k = new MockAudioWorkletNode();
      (global as any).AudioWorkletNode = jest.fn().mockImplementation(() => worklet48k);
      
      await recorder48k.initialize();
      
      const completeCallback = jest.fn();
      recorder48k.setCompleteCallback(completeCallback);
      
      await recorder48k.start();
      
      const completeEvent = new MessageEvent('message', {
        data: { type: 'recordingData', data: [new Float32Array(48000)] }
      });
      
      worklet48k.port.onmessage!(completeEvent);
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.sampleRate).toBe(48000);
    });
  });
});