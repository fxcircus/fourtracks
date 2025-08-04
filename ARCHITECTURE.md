# FourTracks Architecture Guide

## Overview

FourTracks follows a strict modular architecture with component-based design. Each module is limited to 200 lines to ensure maintainability and clear separation of concerns.

## Directory Structure

```
/src
  /audio                 # Core audio processing modules
    - AudioEngine.ts    # Main audio context manager
    - Track.ts          # Individual track logic
    - TrackManager.ts   # Multi-track coordination
    - Recorder.ts       # Recording functionality
    - Player.ts         # Playback functionality
    - MixingEngine.ts   # Audio mixing logic
    - Transport.ts      # Playback control
    - Metronome.ts      # Timing reference
    
  /effects              # Audio effect processors
    - EffectChain.ts    # Effect routing
    - ReverseEffect.ts  # Reverse audio effect
    - HalfSpeedEffect.ts # Speed manipulation
    
  /components           # React UI components
    /track              # Track-related components
      - TrackStrip.tsx
      - TrackControls.tsx
      - VolumeSlider.tsx
      - PanKnob.tsx
      
    /transport          # Transport controls
      - TransportBar.tsx
      - PlayButton.tsx
      - RecordButton.tsx
      - Timeline.tsx
      
    /visualization      # Visual feedback
      - WaveformDisplay.tsx
      - TapeReel.tsx
      - BeatIndicator.tsx
      
    /common             # Shared components
      - Button.tsx
      - Slider.tsx
      - Knob.tsx
      
  /hooks                # Custom React hooks
    - useAudioContext.ts
    - useTrack.ts
    - useKeyboardShortcuts.ts
    
  /services             # Business logic services
    - StorageService.ts
    - ExportService.ts
    - DeviceService.ts
    
  /themes               # Visual theme definitions
    - ThemeProvider.tsx
    - themes/
      - vintage.ts
      - modern.ts
      - minimal.ts
      - neon.ts
      - classic.ts
      
  /types                # TypeScript definitions
    - audio.types.ts
    - ui.types.ts
    - project.types.ts
    
  /utils                # Utility functions
    - audioHelpers.ts
    - formatters.ts
    - validators.ts
    
  /constants            # App-wide constants
    - audio.constants.ts
    - ui.constants.ts
```

## Core Principles

### 1. Single Responsibility
Each module handles one specific aspect of functionality. No module should exceed 200 lines.

### 2. Dependency Injection
Modules receive dependencies through constructors or props, not global imports.

### 3. Event-Driven Communication
Components communicate through events and callbacks, not direct coupling.

### 4. Immutable State
Audio parameters and UI state are treated as immutable, with changes creating new states.

### 5. Progressive Enhancement
Each phase adds features without breaking existing functionality.

## Audio Architecture

### Audio Signal Flow
```
Microphone Input
    ↓
AudioEngine (manages context)
    ↓
Recorder (per track)
    ↓
Track (storage & state)
    ↓
Effects Chain (optional)
    ↓
Track Mixer (volume/pan)
    ↓
Master Mixer
    ↓
Output (speakers)
```

### Key Audio Modules

**AudioEngine**
- Manages Web Audio API context
- Handles device selection
- Coordinates audio nodes
- Monitors performance

**Track**
- Stores audio buffer
- Manages track state
- Handles solo/mute logic
- Interfaces with effects

**MixingEngine**
- Combines track outputs
- Applies master effects
- Manages gain staging
- Handles routing

## Component Architecture

### Component Hierarchy
```
App
├── Header
│   ├── Logo
│   └── ThemeSwitcher
├── MainWorkspace
│   ├── TracksContainer
│   │   └── TrackStrip (×4)
│   │       ├── TrackControls
│   │       ├── WaveformDisplay
│   │       └── EffectRack
│   ├── MasterSection
│   │   ├── MasterVolume
│   │   └── MasterEffects
│   └── TransportBar
│       ├── PlaybackControls
│       ├── Timeline
│       └── MetronomeControls
└── Footer
    ├── DeviceSelector
    └── StatusBar
```

### State Management
- Local component state for UI
- Context API for audio engine access
- Custom hooks for complex state logic
- No external state management library

## Data Flow

### Recording Flow
1. User grants microphone permission
2. AudioEngine creates input stream
3. Recorder captures audio chunks
4. Track stores buffer data
5. WaveformDisplay renders visuals
6. UI updates recording state

### Playback Flow
1. User triggers playback
2. Transport coordinates timing
3. Tracks sync to playhead
4. Audio routes through mixers
5. Effects apply in real-time
6. Master output to speakers

## Performance Considerations

### Audio Thread
- Minimize processing in audio callbacks
- Use Web Workers for heavy computation
- Pre-calculate effect parameters
- Efficient buffer management

### UI Thread
- React.memo for expensive components
- Virtual scrolling for long waveforms
- RequestAnimationFrame for animations
- Debounced control updates

### Memory Management
- Limit recording buffer sizes
- Garbage collection strategies
- Lazy load visual themes
- Efficient waveform sampling

## Testing Strategy

### Unit Tests
- Pure functions in utils/
- Audio processing logic
- Component rendering
- State transitions

### Integration Tests
- Audio pipeline flow
- User interaction sequences
- File import/export
- Cross-component communication

### Performance Tests
- Latency measurements
- Memory usage tracking
- Frame rate monitoring
- Load testing with 4 tracks

## Security & Privacy

- No server communication
- Local storage only
- Explicit permission requests
- No third-party tracking
- Secure audio contexts

## Browser Compatibility

### Required APIs
- Web Audio API
- MediaDevices API
- Canvas API
- Local Storage API
- File API

### Target Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Extension Points

Each phase should maintain these extension points:
- Effect plugin system
- Theme customization
- Keyboard shortcut mapping
- Export format plugins
- UI component overrides

---

This architecture ensures clean separation of concerns while maintaining the flexibility to add features incrementally through the development phases.