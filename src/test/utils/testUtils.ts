import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Add any providers here (Context, Router, etc.)
  return render(ui, { ...options });
}

// Create a user event instance with proper setup
export function setupUser() {
  return userEvent.setup();
}

// Wait for async operations with timeout
export function waitForAsync(ms: number = 100): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to wait for audio context state changes
export async function waitForAudioContextState(
  context: AudioContext,
  expectedState: AudioContextState,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  
  while (context.state !== expectedState) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`AudioContext did not reach state '${expectedState}' within ${timeout}ms`);
    }
    await waitForAsync(100);
  }
}

// Helper to create mock audio buffers with test data
export function createTestAudioBuffer(
  context: AudioContext,
  duration: number = 1,
  frequency: number = 440
): AudioBuffer {
  const sampleRate = context.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(2, length, sampleRate);
  
  // Fill with sine wave
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
    }
  }
  
  return buffer;
}

// Helper to analyze audio buffer
export function analyzeAudioBuffer(buffer: AudioBuffer): {
  duration: number;
  numberOfChannels: number;
  sampleRate: number;
  length: number;
  rms: number[];
  peak: number[];
} {
  const analysis = {
    duration: buffer.duration,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: buffer.sampleRate,
    length: buffer.length,
    rms: [] as number[],
    peak: [] as number[]
  };
  
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    let sum = 0;
    let peak = 0;
    
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i];
      peak = Math.max(peak, Math.abs(data[i]));
    }
    
    analysis.rms.push(Math.sqrt(sum / data.length));
    analysis.peak.push(peak);
  }
  
  return analysis;
}

// Helper for testing level meters
export function generateLevelData(levels: number[]): Float32Array {
  const data = new Float32Array(1024);
  levels.forEach((level, index) => {
    const startIdx = Math.floor((index / levels.length) * data.length);
    const endIdx = Math.floor(((index + 1) / levels.length) * data.length);
    
    for (let i = startIdx; i < endIdx; i++) {
      data[i] = level;
    }
  });
  return data;
}

// Mock performance observer for timing tests
export class MockPerformanceObserver {
  private callback: PerformanceObserverCallback;
  private entries: PerformanceEntry[] = [];
  
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback;
  }
  
  observe(options: { entryTypes: string[] }): void {
    // Mock implementation
  }
  
  disconnect(): void {
    // Mock implementation
  }
  
  takeRecords(): PerformanceEntryList {
    return this.entries;
  }
  
  // Test helper to trigger callback
  triggerEntries(entries: PerformanceEntry[]): void {
    this.entries = entries;
    const list = {
      getEntries: () => entries,
      getEntriesByType: (type: string) => entries.filter(e => e.entryType === type),
      getEntriesByName: (name: string) => entries.filter(e => e.name === name)
    };
    this.callback(list as PerformanceObserverEntryList, this as any);
  }
}

// Helper to test memory usage
export async function measureMemoryUsage(fn: () => Promise<void>): Promise<{
  before: number;
  after: number;
  delta: number;
}> {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const before = process.memoryUsage().heapUsed;
  await fn();
  
  if (global.gc) {
    global.gc();
  }
  
  const after = process.memoryUsage().heapUsed;
  
  return {
    before,
    after,
    delta: after - before
  };
}

// Helper for testing audio node connections
export function getAudioNodeConnections(node: AudioNode): AudioNode[] {
  // This is a mock helper - in real tests with our mock implementation,
  // we can access the internal connections
  if ('isConnectedTo' in node && '_connections' in node) {
    return Array.from((node as any)._connections);
  }
  return [];
}

// Helper for creating mock file inputs
export function createMockFile(
  name: string,
  size: number,
  type: string = 'audio/wav'
): File {
  const content = new ArrayBuffer(size);
  return new File([content], name, { type });
}

// Helper for testing drag and drop
export function createDragEvent(
  type: string,
  files: File[] = []
): DragEvent {
  const dataTransfer = {
    files,
    items: files.map(file => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file
    })),
    types: ['Files'],
    dropEffect: 'copy' as DataTransfer['dropEffect'],
    effectAllowed: 'all' as DataTransfer['effectAllowed'],
    setDragImage: jest.fn(),
    getData: jest.fn(),
    setData: jest.fn(),
    clearData: jest.fn()
  };
  
  return new Event(type, {
    bubbles: true,
    cancelable: true
  }) as DragEvent & { dataTransfer: typeof dataTransfer };
}

// Re-export commonly used testing utilities
export * from '@testing-library/react';
export { userEvent };