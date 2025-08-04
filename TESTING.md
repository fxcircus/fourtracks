# Testing Setup for FourTracks

This document describes the testing infrastructure for the FourTracks audio recorder project.

## Overview

The project uses Jest and React Testing Library for comprehensive testing of both React components and the Web Audio API implementation.

## Test Configuration

### Jest Configuration (`jest.config.ts`)
- TypeScript support via `ts-jest`
- JSdom environment for DOM testing
- CSS module mocking with `identity-obj-proxy`
- Custom setup file for test environment configuration
- Coverage thresholds set to 70% for all metrics

### TypeScript Configuration (`tsconfig.test.json`)
- Extends the main TypeScript config
- Includes Jest types
- Configured for CommonJS module output for Jest compatibility

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests in CI mode
npm run test:ci

# Run specific test file
npm test path/to/test/file.test.ts
```

## Test Structure

### Component Tests
Located alongside components in `*.test.tsx` files:
- Render testing with React Testing Library
- User interaction testing
- Props validation
- CSS class and style testing

Example:
```typescript
import { render, screen } from '@testing-library/react';
import Component from './Component';

test('renders correctly', () => {
  render(<Component prop="value" />);
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Audio Engine Tests
Located in `src/audio/*.test.ts`:
- Web Audio API mocking
- Async operation testing
- State management testing
- Event emission testing

## Web Audio API Mocking

The project includes comprehensive mocks for the Web Audio API in `src/test/mocks/webAudioMock.ts`:

### Available Mocks
- `MockAudioContext` - Full AudioContext implementation
- `MockGainNode` - Gain control node
- `MockAnalyserNode` - Audio analysis node
- `MockStereoPannerNode` - Stereo panning node
- `MockScriptProcessorNode` - Script processor (legacy)
- `MockMediaStream` & `MockMediaStreamTrack` - Media stream handling
- `MockAudioBuffer` & `MockAudioBufferSourceNode` - Audio buffer playback

### Usage
The mocks are automatically initialized in the test setup file:
```typescript
import { setupWebAudioMocks } from './mocks/webAudioMock';

// In your test
beforeEach(() => {
  setupWebAudioMocks();
});
```

## Test Utilities

Located in `src/test/utils/testUtils.ts`:

### Rendering Utilities
- `renderWithProviders` - Render with app providers
- `setupUser` - Create user event instance

### Async Utilities
- `waitForAsync` - Wait for async operations
- `waitForAudioContextState` - Wait for audio context state changes

### Audio Testing Utilities
- `createTestAudioBuffer` - Create test audio buffers
- `analyzeAudioBuffer` - Analyze buffer contents
- `generateLevelData` - Generate level meter test data
- `getAudioNodeConnections` - Test node connections

### File/Drag Testing
- `createMockFile` - Create mock file objects
- `createDragEvent` - Create drag and drop events

## Writing Tests

### Component Test Example
```typescript
import { render, screen } from '@testing-library/react';
import { setupUser } from '@/test/utils/testUtils';
import AudioRecorder from './AudioRecorder';

describe('AudioRecorder', () => {
  it('starts recording on button click', async () => {
    const user = setupUser();
    render(<AudioRecorder />);
    
    const recordButton = screen.getByRole('button', { name: /record/i });
    await user.click(recordButton);
    
    expect(screen.getByText(/recording/i)).toBeInTheDocument();
  });
});
```

### Audio Engine Test Example
```typescript
import { AudioEngine } from './AudioEngine';
import { waitForAsync } from '@/test/utils/testUtils';

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(async () => {
    engine = new AudioEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  it('records audio to buffer', async () => {
    await engine.startRecording({ trackId: 1 });
    await waitForAsync(1000); // Record for 1 second
    await engine.stopRecording();
    
    const track = engine.getTrack(1);
    expect(track?.audioBuffer).toBeDefined();
  });
});
```

## Best Practices

1. **Mock External APIs**: Always mock Web Audio API, getUserMedia, and other browser APIs
2. **Clean Up**: Dispose of audio resources in `afterEach` hooks
3. **Async Testing**: Use proper async/await patterns for audio operations
4. **Isolation**: Each test should be independent and not affect others
5. **Descriptive Names**: Use clear, descriptive test names that explain the behavior
6. **Coverage**: Aim for high coverage but prioritize meaningful tests

## Debugging Tests

1. **Console Output**: Temporarily add `console.log` statements
2. **Debug Mode**: Run Jest with `--detectOpenHandles` to find hanging operations
3. **Single Test**: Use `.only` to run a single test in isolation
4. **Verbose Output**: Run with `--verbose` flag for detailed output

## Known Limitations

1. **AudioWorklet**: Not supported in jsdom, tests fall back to ScriptProcessor
2. **Timing**: Some timing-dependent tests may be flaky in CI environments
3. **Audio Playback**: Actual audio playback cannot be tested, only the API calls

## Continuous Integration

The test suite is designed to run in CI environments:
- Uses `--ci` flag for optimized CI running
- Limits worker processes to prevent resource exhaustion
- Generates coverage reports for tracking
- Fails on test failures or coverage threshold violations