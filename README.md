# FourTracks

A professional web-based 4-track audio recorder with vintage tape aesthetics and modern digital features.

## Overview

FourTracks is a browser-based multi-track audio recording application built with React, TypeScript, and the Web Audio API. It provides a hardware-inspired interface for recording, mixing, and exporting audio directly in your web browser.

## Features

### Current (Phase 1)
- ✅ Single-track audio recording with Web Audio API
- ✅ Low-latency recording (<10ms target)
- ✅ Real-time waveform visualization
- ✅ Audio level monitoring (peak/RMS)
- ✅ Transport controls (Record/Stop/Play)
- ✅ Volume and mute controls
- ✅ Microphone permission handling
- ✅ Hardware-inspired dark UI theme

### Planned Features
- 4 simultaneous audio tracks
- Per-track pan, solo controls
- Master section with overall volume
- Loop recording with quantization
- Built-in metronome (40-300 BPM)
- Audio effects (reverse, half-speed)
- Export individual tracks or master mix
- 5 visual themes
- Audio device selection
- Keyboard shortcuts
- Local storage for settings and projects

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Modern web browser with Web Audio API support
- Microphone access for recording

### Installation

```bash
# Clone the repository
git clone [repository-url]
cd fourtracks

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Building for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── audio/              # Web Audio API engine
│   ├── AudioEngine.ts
│   ├── AudioNodeManager.ts
│   ├── PlaybackManager.ts
│   └── ...
├── components/         # React components
│   ├── AudioRecorder/
│   ├── TransportControls/
│   ├── WaveformDisplay/
│   └── ...
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
└── types/             # TypeScript types
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate coverage report

### Code Style

- TypeScript with strict mode enabled
- ESLint + Prettier for code formatting
- Maximum 200 lines per file
- Component-based architecture
- Separate CSS files per component

### Testing

The project uses Jest and React Testing Library for testing:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Architecture

FourTracks follows a modular architecture with clear separation of concerns:

- **Audio Engine**: Handles all Web Audio API operations
- **React Components**: UI layer with hardware-inspired design
- **State Management**: React hooks for application state
- **Event System**: Communication between audio engine and UI

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed architecture documentation.

## Browser Support

FourTracks requires a modern browser with Web Audio API support:

- Chrome/Edge 66+
- Firefox 60+
- Safari 14.1+

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## Project Status

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for current development status and [ROADMAP.md](ROADMAP.md) for the complete development plan.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by classic hardware from EHX, Teenage Engineering, and Line6
- Built with the Web Audio API for professional audio quality
- Uses React and TypeScript for a robust, type-safe application