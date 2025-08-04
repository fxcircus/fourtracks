// Mock implementation of Web Audio API for testing

export class MockAudioContext {
  public currentTime = 0;
  public sampleRate = 44100;
  public baseLatency = 0.01; // 10ms default latency
  public destination: MockAudioDestinationNode;
  public state: AudioContextState = 'running';
  private _nodes: Set<MockAudioNode> = new Set();

  constructor() {
    this.destination = new MockAudioDestinationNode(this);
  }

  createGain(): MockGainNode {
    const node = new MockGainNode(this);
    this._nodes.add(node);
    return node;
  }

  createAnalyser(): MockAnalyserNode {
    const node = new MockAnalyserNode(this);
    this._nodes.add(node);
    return node;
  }

  createMediaStreamSource(stream: MediaStream): MockMediaStreamAudioSourceNode {
    const node = new MockMediaStreamAudioSourceNode(this, stream);
    this._nodes.add(node);
    return node;
  }

  createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBuffer {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }

  createBufferSource(): MockAudioBufferSourceNode {
    const node = new MockAudioBufferSourceNode(this);
    this._nodes.add(node);
    return node;
  }

  createScriptProcessor(
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number
  ): MockScriptProcessorNode {
    const node = new MockScriptProcessorNode(this, bufferSize, numberOfInputChannels, numberOfOutputChannels);
    this._nodes.add(node);
    return node;
  }

  createStereoPanner(): MockStereoPannerNode {
    const node = new MockStereoPannerNode(this);
    this._nodes.add(node);
    return node;
  }

  close(): Promise<void> {
    this.state = 'closed';
    this._nodes.forEach(node => node.disconnect());
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }

  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  // Helper method for testing
  advanceTime(seconds: number): void {
    this.currentTime += seconds;
  }

  // Mock audioWorklet property
  get audioWorklet(): MockAudioWorklet {
    return new MockAudioWorklet();
  }
}

export class MockAudioWorklet {
  addModule(url: string): Promise<void> {
    // Mock implementation - always reject to simulate no AudioWorklet support
    return Promise.reject(new Error('AudioWorklet not supported in test environment'));
  }
}

export class MockAudioNode {
  public context: MockAudioContext;
  public numberOfInputs = 1;
  public numberOfOutputs = 1;
  protected _connections: Set<MockAudioNode> = new Set();

  constructor(context: MockAudioContext) {
    this.context = context;
  }

  connect(destination: MockAudioNode): MockAudioNode {
    this._connections.add(destination);
    return destination;
  }

  disconnect(destination?: MockAudioNode): void {
    if (destination) {
      this._connections.delete(destination);
    } else {
      this._connections.clear();
    }
  }

  // Helper method for testing
  isConnectedTo(node: MockAudioNode): boolean {
    return this._connections.has(node);
  }
}

export class MockAudioDestinationNode extends MockAudioNode {
  public maxChannelCount = 2;
}

export class MockGainNode extends MockAudioNode {
  public gain: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.gain = new MockAudioParam(context, 1);
  }
}

export class MockStereoPannerNode extends MockAudioNode {
  public pan: MockAudioParam;

  constructor(context: MockAudioContext) {
    super(context);
    this.pan = new MockAudioParam(context, 0); // default pan is center (0)
  }
}

export class MockAnalyserNode extends MockAudioNode {
  public fftSize = 2048;
  public frequencyBinCount = 1024;
  public minDecibels = -100;
  public maxDecibels = -30;
  public smoothingTimeConstant = 0.8;
  private _timeDomainData: Float32Array;
  private _frequencyData: Float32Array;

  constructor(context: MockAudioContext) {
    super(context);
    this._timeDomainData = new Float32Array(this.fftSize);
    this._frequencyData = new Float32Array(this.frequencyBinCount);
  }

  getFloatTimeDomainData(array: Float32Array): void {
    array.set(this._timeDomainData.subarray(0, array.length));
  }

  getByteTimeDomainData(array: Uint8Array): void {
    for (let i = 0; i < array.length && i < this._timeDomainData.length; i++) {
      // Convert from [-1, 1] to [0, 255] range
      const normalized = (this._timeDomainData[i] + 1) / 2; // Now in [0, 1]
      array[i] = Math.floor(normalized * 255);
    }
  }

  getFloatFrequencyData(array: Float32Array): void {
    array.set(this._frequencyData.subarray(0, array.length));
  }

  getByteFrequencyData(array: Uint8Array): void {
    for (let i = 0; i < array.length && i < this._frequencyData.length; i++) {
      const normalized = (this._frequencyData[i] - this.minDecibels) / (this.maxDecibels - this.minDecibels);
      array[i] = Math.floor(Math.max(0, Math.min(255, normalized * 255)));
    }
  }

  // Test helper methods
  setTimeDomainData(data: Float32Array): void {
    this._timeDomainData = data;
  }

  setFrequencyData(data: Float32Array): void {
    this._frequencyData = data;
  }
}

export class MockMediaStreamAudioSourceNode extends MockAudioNode {
  public mediaStream: MediaStream;

  constructor(context: MockAudioContext, stream: MediaStream) {
    super(context);
    this.mediaStream = stream;
    this.numberOfOutputs = 1;
    this.numberOfInputs = 0;
  }
}

export class MockAudioBuffer {
  public length: number;
  public sampleRate: number;
  public numberOfChannels: number;
  private _channelData: Float32Array[];

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channelData = Array(numberOfChannels)
      .fill(null)
      .map(() => new Float32Array(length));
  }

  getChannelData(channel: number): Float32Array {
    if (channel >= this.numberOfChannels) {
      throw new Error('Index exceeds number of channels');
    }
    return this._channelData[channel];
  }

  copyFromChannel(destination: Float32Array, channelNumber: number, startInChannel = 0): void {
    const source = this._channelData[channelNumber];
    destination.set(source.subarray(startInChannel, startInChannel + destination.length));
  }

  copyToChannel(source: Float32Array, channelNumber: number, startInChannel = 0): void {
    const destination = this._channelData[channelNumber];
    destination.set(source, startInChannel);
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }
}

export class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: MockAudioBuffer | null = null;
  public loop = false;
  public loopStart = 0;
  public loopEnd = 0;
  public playbackRate: MockAudioParam;
  public onended: ((this: AudioBufferSourceNode, ev: Event) => any) | null = null;
  private _isPlaying = false;
  private _startTime: number | null = null;

  constructor(context: MockAudioContext) {
    super(context);
    this.numberOfInputs = 0;
    this.playbackRate = new MockAudioParam(context, 1);
  }

  start(when = 0, offset = 0, duration?: number): void {
    if (this._isPlaying) {
      throw new Error('Cannot call start more than once');
    }
    this._isPlaying = true;
    this._startTime = this.context.currentTime + when;
    
    // Simulate onended callback
    if (this.buffer && this.onended) {
      const playDuration = duration ?? (this.buffer.duration - offset);
      setTimeout(() => {
        if (this.onended) {
          this.onended.call(this as any, new Event('ended'));
        }
      }, playDuration * 1000);
    }
  }

  stop(when = 0): void {
    if (!this._isPlaying) {
      throw new Error('Cannot call stop without calling start first');
    }
    this._isPlaying = false;
    
    if (this.onended) {
      setTimeout(() => {
        if (this.onended) {
          this.onended.call(this as any, new Event('ended'));
        }
      }, when * 1000);
    }
  }
}

export class MockScriptProcessorNode extends MockAudioNode {
  public bufferSize: number;
  public onaudioprocess: ((this: ScriptProcessorNode, ev: AudioProcessingEvent) => any) | null = null;
  private _isProcessing = false;
  private _processInterval: NodeJS.Timeout | null = null;

  constructor(
    context: MockAudioContext,
    bufferSize: number,
    numberOfInputChannels: number,
    numberOfOutputChannels: number
  ) {
    super(context);
    this.bufferSize = bufferSize;
    this.numberOfInputs = numberOfInputChannels;
    this.numberOfOutputs = numberOfOutputChannels;
  }

  connect(destination: MockAudioNode): MockAudioNode {
    super.connect(destination);
    if (!this._isProcessing) {
      this._startProcessing();
    }
    return destination;
  }

  disconnect(destination?: MockAudioNode): void {
    super.disconnect(destination);
    if (this._connections.size === 0) {
      this._stopProcessing();
    }
  }

  private _startProcessing(): void {
    if (this._isProcessing) return;
    this._isProcessing = true;

    const intervalMs = (this.bufferSize / this.context.sampleRate) * 1000;
    this._processInterval = setInterval(() => {
      if (this.onaudioprocess) {
        const inputBuffer = new MockAudioBuffer(this.numberOfInputs, this.bufferSize, this.context.sampleRate);
        const outputBuffer = new MockAudioBuffer(this.numberOfOutputs, this.bufferSize, this.context.sampleRate);
        
        const event = {
          inputBuffer,
          outputBuffer,
          playbackTime: this.context.currentTime
        } as any;
        
        this.onaudioprocess.call(this as any, event);
      }
    }, intervalMs);
  }

  private _stopProcessing(): void {
    if (!this._isProcessing) return;
    this._isProcessing = false;

    if (this._processInterval) {
      clearInterval(this._processInterval);
      this._processInterval = null;
    }
  }
}

export class MockAudioParam {
  public value: number;
  public defaultValue: number;
  public minValue = -3.4028235e38;
  public maxValue = 3.4028235e38;
  private _context: MockAudioContext;
  private _automationEvents: Array<{ time: number; value: number; type: string }> = [];

  constructor(context: MockAudioContext, defaultValue: number) {
    this._context = context;
    this.value = defaultValue;
    this.defaultValue = defaultValue;
  }

  setValueAtTime(value: number, startTime: number): MockAudioParam {
    this._automationEvents.push({ time: startTime, value, type: 'setValue' });
    return this;
  }

  linearRampToValueAtTime(value: number, endTime: number): MockAudioParam {
    this._automationEvents.push({ time: endTime, value, type: 'linearRamp' });
    return this;
  }

  exponentialRampToValueAtTime(value: number, endTime: number): MockAudioParam {
    this._automationEvents.push({ time: endTime, value, type: 'exponentialRamp' });
    return this;
  }

  setTargetAtTime(target: number, startTime: number, timeConstant: number): MockAudioParam {
    this._automationEvents.push({ time: startTime, value: target, type: 'setTarget' });
    return this;
  }

  cancelScheduledValues(cancelTime: number): MockAudioParam {
    this._automationEvents = this._automationEvents.filter(event => event.time < cancelTime);
    return this;
  }

  cancelAndHoldAtTime(cancelTime: number): MockAudioParam {
    this.cancelScheduledValues(cancelTime);
    return this;
  }
}

// Mock MediaStream and MediaStreamTrack
export class MockMediaStreamTrack {
  public kind: 'audio' | 'video' = 'audio';
  public id: string = Math.random().toString(36).substr(2, 9);
  public enabled = true;
  public muted = false;
  public readyState: 'live' | 'ended' = 'live';
  public onended: ((this: MediaStreamTrack, ev: Event) => any) | null = null;

  stop(): void {
    this.readyState = 'ended';
    if (this.onended) {
      this.onended.call(this, new Event('ended'));
    }
  }

  clone(): MockMediaStreamTrack {
    const cloned = new MockMediaStreamTrack();
    cloned.kind = this.kind;
    return cloned;
  }

  getCapabilities(): MediaTrackCapabilities {
    return {};
  }

  getConstraints(): MediaTrackConstraints {
    return {};
  }

  getSettings(): MediaTrackSettings {
    return {
      deviceId: 'mock-device-id',
      groupId: 'mock-group-id'
    };
  }

  applyConstraints(constraints?: MediaTrackConstraints): Promise<void> {
    return Promise.resolve();
  }
}

export class MockMediaStream {
  private _tracks: MockMediaStreamTrack[] = [];
  public id: string = Math.random().toString(36).substr(2, 9);
  public active = true;

  constructor(tracks?: MockMediaStreamTrack[]) {
    if (tracks) {
      this._tracks = tracks;
    }
  }

  getTracks(): MockMediaStreamTrack[] {
    return [...this._tracks];
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this._tracks.filter(track => track.kind === 'audio');
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this._tracks.filter(track => track.kind === 'video');
  }

  addTrack(track: MockMediaStreamTrack): void {
    this._tracks.push(track);
  }

  removeTrack(track: MockMediaStreamTrack): void {
    const index = this._tracks.indexOf(track);
    if (index !== -1) {
      this._tracks.splice(index, 1);
    }
  }

  clone(): MockMediaStream {
    return new MockMediaStream(this._tracks.map(track => track.clone()));
  }
}

// Helper function to set up Web Audio API mocks
export function setupWebAudioMocks(): void {
  (global as any).AudioContext = MockAudioContext;
  (global as any).webkitAudioContext = MockAudioContext;
  (global as any).MediaStream = MockMediaStream;
  (global as any).MediaStreamTrack = MockMediaStreamTrack;
  
  // Mock getUserMedia
  const mockGetUserMedia = jest.fn().mockImplementation(async (constraints) => {
    const track = new MockMediaStreamTrack();
    return new MockMediaStream([track]);
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: mockGetUserMedia,
      enumerateDevices: jest.fn().mockResolvedValue([
        {
          deviceId: 'default',
          kind: 'audioinput',
          label: 'Default Audio Input',
          groupId: 'default-group'
        }
      ])
    }
  });
}

// Export types for testing
export type MockTypes = {
  AudioContext: MockAudioContext;
  GainNode: MockGainNode;
  AnalyserNode: MockAnalyserNode;
  MediaStreamAudioSourceNode: MockMediaStreamAudioSourceNode;
  AudioBuffer: MockAudioBuffer;
  AudioBufferSourceNode: MockAudioBufferSourceNode;
  ScriptProcessorNode: MockScriptProcessorNode;
  AudioParam: MockAudioParam;
  MediaStream: MockMediaStream;
  MediaStreamTrack: MockMediaStreamTrack;
};