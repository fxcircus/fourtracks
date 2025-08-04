# FourTracks - Immediate Next Steps

## Day 1: Environment Setup

### 1. Initialize Project
```bash
npm create vite@latest fourtracks -- --template react-ts
cd fourtracks
npm install
```

### 2. Install Core Dependencies
```bash
# Development dependencies
npm install -D @types/node vitest @vitest/ui @testing-library/react @testing-library/jest-dom

# Linting and formatting
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier

# Additional types
npm install -D @types/web-audio-api
```

### 3. Configure ESLint with 200-line rule
Create `.eslintrc.cjs`:
```javascript
module.exports = {
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'prettier'],
  rules: {
    'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
    'prettier/prettier': 'error'
  }
}
```

### 4. Create Folder Structure
```bash
mkdir -p src/{audio,components/{track,transport,visualization,common},hooks,services,themes,types,utils,constants,effects}
```

## Day 2: Core Audio Setup

### 1. Create AudioEngine.ts
```typescript
// src/audio/AudioEngine.ts
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  async initialize(): Promise<void> {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
  }

  getContext(): AudioContext {
    if (!this.context) throw new Error('Audio context not initialized');
    return this.context;
  }

  getMasterGain(): GainNode {
    if (!this.masterGain) throw new Error('Master gain not initialized');
    return this.masterGain;
  }
}
```

### 2. Create Permission Handler
```typescript
// src/components/PermissionHandler.tsx
import { useState } from 'react';

export const PermissionHandler: React.FC<{ onGranted: () => void }> = ({ onGranted }) => {
  const [status, setStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setStatus('granted');
      onGranted();
    } catch {
      setStatus('denied');
    }
  };

  if (status === 'granted') return null;

  return (
    <div className="permission-handler">
      <h2>Microphone Access Required</h2>
      <p>FourTracks needs access to your microphone to record audio.</p>
      <button onClick={requestPermission}>Grant Permission</button>
      {status === 'denied' && <p>Permission denied. Please check your browser settings.</p>}
    </div>
  );
};
```

### 3. Create Basic App Structure
```typescript
// src/App.tsx
import { useState, useEffect } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { PermissionHandler } from './components/PermissionHandler';

function App() {
  const [audioEngine] = useState(() => new AudioEngine());
  const [isReady, setIsReady] = useState(false);

  const handlePermissionGranted = async () => {
    await audioEngine.initialize();
    setIsReady(true);
  };

  if (!isReady) {
    return <PermissionHandler onGranted={handlePermissionGranted} />;
  }

  return (
    <div className="app">
      <h1>FourTracks</h1>
      <p>Audio engine initialized. Ready for Phase 1 development!</p>
    </div>
  );
}

export default App;
```

## Day 3: Testing Setup

### 1. Configure Vitest
Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

### 2. Create Test Setup
```typescript
// src/test/setup.ts
import '@testing-library/jest-dom';

// Mock Web Audio API
global.AudioContext = vi.fn().mockImplementation(() => ({
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 }
  })),
  destination: {}
}));
```

### 3. Write First Test
```typescript
// src/audio/AudioEngine.test.ts
import { describe, it, expect } from 'vitest';
import { AudioEngine } from './AudioEngine';

describe('AudioEngine', () => {
  it('should initialize audio context', async () => {
    const engine = new AudioEngine();
    await engine.initialize();
    expect(engine.getContext()).toBeDefined();
  });
});
```

## Day 4: CI/CD Setup

### 1. Create GitHub Actions Workflow
Create `.github/workflows/ci.yml`:
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

### 2. Update package.json Scripts
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "preview": "vite preview"
  }
}
```

## Phase 1 Development Checklist

### Core Audio Features
- [ ] Create Recorder.ts module
- [ ] Implement audio buffer management
- [ ] Create Player.ts module
- [ ] Handle start/stop recording logic
- [ ] Implement playback functionality

### UI Components
- [ ] Create RecordButton component
- [ ] Create PlayButton component
- [ ] Create basic track display
- [ ] Add recording time display
- [ ] Style with basic CSS

### Testing
- [ ] Test recording functionality
- [ ] Test playback functionality
- [ ] Test error handling
- [ ] Test UI interactions
- [ ] Achieve 80% coverage

### Documentation
- [ ] Update PROJECT_STATUS.md
- [ ] Document audio flow
- [ ] Create component docs
- [ ] Update architecture notes

## Quick Commands

```bash
# Start development
npm run dev

# Run tests
npm run test

# Check code quality
npm run lint

# Build for production
npm run build
```

## Key Files to Track

1. `/Users/roy/Desktop/dev/fourtracks/PROJECT_STATUS.md` - Update daily
2. `/Users/roy/Desktop/dev/fourtracks/ROADMAP.md` - Reference for phases
3. `/Users/roy/Desktop/dev/fourtracks/ARCHITECTURE.md` - Design decisions
4. `/Users/roy/Desktop/dev/fourtracks/NEXT_STEPS.md` - This file

---

Remember: Each phase must produce a working application. Start simple, test everything, and maintain clean architecture!