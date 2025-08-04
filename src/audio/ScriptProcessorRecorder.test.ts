import { ScriptProcessorRecorder } from './ScriptProcessorRecorder';
import { MockAudioContext, MockGainNode, MockScriptProcessorNode, MockAudioBuffer } from '../test/mocks/webAudioMock';
import { RecordingBuffer } from './types';

describe('ScriptProcessorRecorder', () => {
  let audioContext: MockAudioContext;
  let inputGain: MockGainNode;
  let recorder: ScriptProcessorRecorder;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    inputGain = audioContext.createGain() as MockGainNode;
    recorder = new ScriptProcessorRecorder(audioContext as any, inputGain as any);
  });

  afterEach(() => {
    recorder.dispose();
  });

  describe('initialization', () => {
    it('creates recorder with default buffer size', () => {
      expect(recorder).toBeDefined();
      expect(recorder['bufferSize']).toBe(256);
    });

    it('creates recorder with custom buffer size', () => {
      const customRecorder = new ScriptProcessorRecorder(
        audioContext as any,
        inputGain as any,
        512
      );
      
      expect(customRecorder['bufferSize']).toBe(512);
      customRecorder.dispose();
    });
  });

  describe('start', () => {
    it('creates script processor node', async () => {
      const createProcessorSpy = jest.spyOn(audioContext, 'createScriptProcessor');
      
      await recorder.start(2);
      
      expect(createProcessorSpy).toHaveBeenCalledWith(256, 2, 2);
      expect(recorder['processor']).toBeDefined();
    });

    it('throws error if already recording', async () => {
      await recorder.start();
      
      await expect(recorder.start()).rejects.toThrow('Already recording');
    });

    it('connects audio chain correctly', async () => {
      await recorder.start();
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      
      expect(inputGain.isConnectedTo(processor)).toBe(true);
      expect(processor.isConnectedTo(audioContext.destination)).toBe(true);
    });

    it('sets recording state', async () => {
      expect(recorder['isRecording']).toBe(false);
      
      await recorder.start();
      
      expect(recorder['isRecording']).toBe(true);
      expect(recorder['recordingStartTime']).toBe(audioContext.currentTime);
      expect(recorder['recordingBuffer']).toEqual([]);
    });

    it('uses default channel count', async () => {
      const createProcessorSpy = jest.spyOn(audioContext, 'createScriptProcessor');
      
      await recorder.start();
      
      expect(createProcessorSpy).toHaveBeenCalledWith(256, 2, 2);
    });

    it('sets up audio processing callback', async () => {
      await recorder.start();
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      expect(processor.onaudioprocess).toBeDefined();
      expect(typeof processor.onaudioprocess).toBe('function');
    });
  });

  describe('audio processing', () => {
    it('captures audio data during processing', async () => {
      await recorder.start(2);
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      
      // Create test audio buffer
      const testBuffer = new MockAudioBuffer(2, 256, 44100);
      testBuffer.copyToChannel(new Float32Array(256).fill(0.5), 0);
      testBuffer.copyToChannel(new Float32Array(256).fill(-0.5), 1);
      
      // Simulate audio processing event
      const event = {
        inputBuffer: testBuffer,
        outputBuffer: new MockAudioBuffer(2, 256, 44100),
        playbackTime: audioContext.currentTime
      };
      
      processor.onaudioprocess!.call(processor as any, event as any);
      
      expect(recorder['recordingBuffer'].length).toBe(2);
      expect(recorder['recordingBuffer'][0][0]).toBe(0.5);
      expect(recorder['recordingBuffer'][1][0]).toBe(-0.5);
    });

    it('ignores processing when not recording', async () => {
      await recorder.start();
      recorder['isRecording'] = false;
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      const testBuffer = new MockAudioBuffer(2, 256, 44100);
      
      const event = {
        inputBuffer: testBuffer,
        outputBuffer: new MockAudioBuffer(2, 256, 44100),
        playbackTime: audioContext.currentTime
      };
      
      processor.onaudioprocess!.call(processor as any, event as any);
      
      expect(recorder['recordingBuffer'].length).toBe(0);
    });

    it('calls progress callback during processing', async () => {
      const progressCallback = jest.fn();
      recorder.setProgressCallback(progressCallback);
      
      await recorder.start();
      audioContext.advanceTime(1); // Advance by 1 second
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      const testBuffer = new MockAudioBuffer(2, 256, 44100);
      
      const event = {
        inputBuffer: testBuffer,
        outputBuffer: new MockAudioBuffer(2, 256, 44100),
        playbackTime: audioContext.currentTime
      };
      
      processor.onaudioprocess!.call(processor as any, event as any);
      
      expect(progressCallback).toHaveBeenCalledWith(1);
    });

    it('accumulates multiple buffers', async () => {
      await recorder.start(1); // Mono
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      
      // Process multiple buffers
      for (let i = 0; i < 5; i++) {
        const testBuffer = new MockAudioBuffer(1, 256, 44100);
        testBuffer.copyToChannel(new Float32Array(256).fill(i * 0.1), 0);
        
        const event = {
          inputBuffer: testBuffer,
          outputBuffer: new MockAudioBuffer(1, 256, 44100),
          playbackTime: audioContext.currentTime + i * (256 / 44100)
        };
        
        processor.onaudioprocess!.call(processor as any, event as any);
      }
      
      expect(recorder['recordingBuffer'].length).toBe(5);
    });
  });

  describe('stop', () => {
    it('does nothing if not recording', () => {
      recorder.stop();
      
      expect(recorder['processor']).toBeNull();
    });

    it('stops recording and processes data', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(2);
      
      // Simulate some recording
      const processor = recorder['processor'] as MockScriptProcessorNode;
      for (let i = 0; i < 10; i++) {
        const testBuffer = new MockAudioBuffer(2, 256, 44100);
        testBuffer.copyToChannel(new Float32Array(256).fill(0.1), 0);
        testBuffer.copyToChannel(new Float32Array(256).fill(0.2), 1);
        
        recorder['recordingBuffer'].push(
          new Float32Array(testBuffer.getChannelData(0)),
          new Float32Array(testBuffer.getChannelData(1))
        );
      }
      
      audioContext.advanceTime(0.058); // ~10 buffers worth of time
      
      recorder.stop();
      
      expect(completeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          sampleRate: 44100,
          numberOfChannels: 2,
          channelData: expect.any(Array)
        })
      );
      
      expect(recorder['isRecording']).toBe(false);
    });

    it('disconnects audio chain', async () => {
      await recorder.start();
      
      const processor = recorder['processor'] as MockScriptProcessorNode;
      const inputDisconnectSpy = jest.spyOn(inputGain, 'disconnect');
      const processorDisconnectSpy = jest.spyOn(processor, 'disconnect');
      
      recorder.stop();
      
      expect(inputDisconnectSpy).toHaveBeenCalledWith(processor);
      expect(processorDisconnectSpy).toHaveBeenCalled();
      expect(recorder['processor']).toBeNull();
    });

    it('calculates correct buffer length', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start();
      audioContext.advanceTime(2); // 2 seconds
      
      recorder.stop();
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.length).toBe(88200); // 2 seconds at 44100Hz
    });
  });

  describe('organizeChannelData', () => {
    it('organizes stereo data correctly', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(2);
      
      // Add interleaved stereo data
      recorder['recordingBuffer'] = [
        new Float32Array(256).fill(0.1), // Left channel, chunk 1
        new Float32Array(256).fill(0.2), // Right channel, chunk 1
        new Float32Array(256).fill(0.3), // Left channel, chunk 2
        new Float32Array(256).fill(0.4), // Right channel, chunk 2
      ];
      
      audioContext.advanceTime(512 / 44100); // Time for 2 chunks
      
      recorder.stop();
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      const leftChannel = callArgs.channelData[0];
      const rightChannel = callArgs.channelData[1];
      
      // Check first chunk values
      expect(leftChannel[0]).toBe(0.1);
      expect(leftChannel[255]).toBe(0.1);
      expect(leftChannel[256]).toBe(0.3); // Second chunk starts
      
      expect(rightChannel[0]).toBe(0.2);
      expect(rightChannel[255]).toBe(0.2);
      expect(rightChannel[256]).toBe(0.4);
    });

    it('handles mono data correctly', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(1);
      
      recorder['recordingBuffer'] = [
        new Float32Array(256).fill(0.5),
        new Float32Array(256).fill(0.6),
        new Float32Array(256).fill(0.7),
      ];
      
      audioContext.advanceTime(768 / 44100);
      
      recorder.stop();
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.numberOfChannels).toBe(2); // Always outputs 2 channels
      expect(callArgs.channelData.length).toBe(2);
      
      const channel = callArgs.channelData[0];
      expect(channel[0]).toBe(0.5);
      expect(channel[256]).toBe(0.6);
      expect(channel[512]).toBe(0.7);
    });

    it('handles buffer overflow correctly', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start(2);
      
      // Add more data than the duration
      recorder['recordingBuffer'] = [
        new Float32Array(1000).fill(0.1),
        new Float32Array(1000).fill(0.2),
        new Float32Array(1000).fill(0.3),
        new Float32Array(1000).fill(0.4),
      ];
      
      audioContext.advanceTime(1500 / 44100); // Less time than data
      
      recorder.stop();
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.length).toBe(Math.floor(1500 / 44100 * 44100));
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
  });

  describe('dispose', () => {
    it('stops recording on dispose', async () => {
      const stopSpy = jest.spyOn(recorder, 'stop');
      
      await recorder.start();
      recorder.dispose();
      
      expect(stopSpy).toHaveBeenCalled();
    });

    it('can be called multiple times safely', () => {
      expect(() => {
        recorder.dispose();
        recorder.dispose();
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles very small buffer sizes', async () => {
      const smallRecorder = new ScriptProcessorRecorder(
        audioContext as any,
        inputGain as any,
        128
      );
      
      await smallRecorder.start();
      
      const processor = smallRecorder['processor'] as MockScriptProcessorNode;
      expect(processor.bufferSize).toBe(128);
      
      smallRecorder.dispose();
    });

    it('handles large buffer sizes', async () => {
      const largeRecorder = new ScriptProcessorRecorder(
        audioContext as any,
        inputGain as any,
        4096
      );
      
      await largeRecorder.start();
      
      const processor = largeRecorder['processor'] as MockScriptProcessorNode;
      expect(processor.bufferSize).toBe(4096);
      
      largeRecorder.dispose();
    });

    it('handles empty recording', async () => {
      const completeCallback = jest.fn();
      recorder.setCompleteCallback(completeCallback);
      
      await recorder.start();
      recorder.stop(); // Stop immediately
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.length).toBe(0);
      expect(callArgs.channelData[0].length).toBe(0);
    });

    it('handles different sample rates', async () => {
      const context48k = new MockAudioContext();
      context48k.sampleRate = 48000;
      
      const recorder48k = new ScriptProcessorRecorder(
        context48k as any,
        inputGain as any
      );
      
      const completeCallback = jest.fn();
      recorder48k.setCompleteCallback(completeCallback);
      
      await recorder48k.start();
      context48k.advanceTime(1);
      recorder48k.stop();
      
      const callArgs = completeCallback.mock.calls[0][0] as RecordingBuffer;
      expect(callArgs.sampleRate).toBe(48000);
      expect(callArgs.length).toBe(48000);
      
      recorder48k.dispose();
    });
  });
});