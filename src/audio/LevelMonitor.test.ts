import { LevelMonitor, PeakHold, linearToDb, dbToLinear } from './LevelMonitor';
import { MockAudioContext, MockAnalyserNode } from '../test/mocks/webAudioMock';
import { LevelData } from './types';

describe('LevelMonitor', () => {
  let audioContext: MockAudioContext;
  let masterAnalyser: MockAnalyserNode;
  let inputAnalyser: MockAnalyserNode;
  let trackAnalysers: Map<number, MockAnalyserNode>;
  let levelMonitor: LevelMonitor;

  beforeEach(() => {
    audioContext = new MockAudioContext();
    masterAnalyser = audioContext.createAnalyser() as MockAnalyserNode;
    inputAnalyser = audioContext.createAnalyser() as MockAnalyserNode;
    
    // Create track analysers
    trackAnalysers = new Map();
    for (let i = 1; i <= 4; i++) {
      trackAnalysers.set(i, audioContext.createAnalyser() as MockAnalyserNode);
    }
    
    levelMonitor = new LevelMonitor(
      audioContext as any,
      masterAnalyser as any,
      inputAnalyser as any,
      trackAnalysers as any
    );
  });

  afterEach(() => {
    levelMonitor.dispose();
  });

  describe('initialization', () => {
    it('creates level monitor with correct configuration', () => {
      expect(levelMonitor).toBeDefined();
      expect(levelMonitor['levelData'].length).toBe(masterAnalyser.fftSize);
    });

    it('can be created without input analyser', () => {
      const monitor = new LevelMonitor(
        audioContext as any,
        masterAnalyser as any,
        null,
        trackAnalysers as any
      );
      
      expect(monitor).toBeDefined();
      monitor.dispose();
    });
  });

  describe('start', () => {
    it('starts monitoring and calls callback', (done) => {
      const callback = jest.fn((levels: LevelData) => {
        expect(levels).toBeDefined();
        expect(levels.master).toBeDefined();
        expect(levels.tracks).toBeDefined();
        
        if (callback.mock.calls.length >= 2) {
          levelMonitor.stop();
          done();
        }
      });
      
      levelMonitor.start(callback);
    });

    it('does not start if already active', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      
      levelMonitor.start(callback1);
      levelMonitor.start(callback2); // Should not restart
      
      expect(levelMonitor['onLevelUpdate']).toBe(callback1); // First callback remains
    });

    it('monitors all track levels', (done) => {
      // Set test data for analysers
      const testData = new Float32Array(2048);
      for (let i = 0; i < testData.length; i++) {
        testData[i] = Math.sin(i * 0.01) * 0.5; // Generate test signal
      }
      
      masterAnalyser.setTimeDomainData(testData);
      trackAnalysers.forEach(analyser => {
        analyser.setTimeDomainData(testData);
      });
      
      levelMonitor.start((levels) => {
        expect(Object.keys(levels.tracks).length).toBe(4);
        
        for (let i = 1; i <= 4; i++) {
          expect(levels.tracks[i]).toBeDefined();
          expect(levels.tracks[i].peak).toBeGreaterThanOrEqual(0);
          expect(levels.tracks[i].peak).toBeLessThanOrEqual(1);
          expect(levels.tracks[i].rms).toBeGreaterThanOrEqual(0);
          expect(levels.tracks[i].rms).toBeLessThanOrEqual(1);
        }
        
        levelMonitor.stop();
        done();
      });
    });

    it('includes input levels when available', (done) => {
      const testData = new Float32Array(2048);
      testData.fill(0.3);
      inputAnalyser.setTimeDomainData(testData);
      
      levelMonitor.start((levels) => {
        expect(levels.input).toBeDefined();
        expect(levels.input!.peak).toBeGreaterThan(0);
        expect(levels.input!.rms).toBeGreaterThan(0);
        
        levelMonitor.stop();
        done();
      });
    });
  });

  describe('stop', () => {
    it('stops monitoring', (done) => {
      let callCount = 0;
      
      levelMonitor.start(() => {
        callCount++;
        
        if (callCount === 2) {
          levelMonitor.stop();
          
          // Wait a bit to ensure no more callbacks
          setTimeout(() => {
            expect(callCount).toBe(2);
            done();
          }, 100);
        }
      });
    });

    it('cancels animation frame', () => {
      const cancelSpy = jest.spyOn(global, 'cancelAnimationFrame');
      
      levelMonitor.start(() => {});
      levelMonitor.stop();
      
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('sets isActive to false', () => {
      levelMonitor.start(() => {});
      expect(levelMonitor['isActive']).toBe(true);
      
      levelMonitor.stop();
      expect(levelMonitor['isActive']).toBe(false);
    });
  });

  describe('setInputAnalyser', () => {
    it('updates input analyser', (done) => {
      // Start without input
      const monitor = new LevelMonitor(
        audioContext as any,
        masterAnalyser as any,
        null,
        trackAnalysers as any
      );
      
      monitor.start((levels) => {
        if (!levels.input) {
          // Now add input analyser
          const newInputAnalyser = audioContext.createAnalyser() as MockAnalyserNode;
          newInputAnalyser.setTimeDomainData(new Float32Array(2048).fill(0.5));
          monitor.setInputAnalyser(newInputAnalyser as any);
        } else {
          // Input should now be included
          expect(levels.input).toBeDefined();
          monitor.stop();
          done();
        }
      });
    });

    it('can remove input analyser', (done) => {
      levelMonitor.start((levels) => {
        if (levels.input) {
          // Remove input analyser
          levelMonitor.setInputAnalyser(null);
        } else {
          // Input should be gone
          expect(levels.input).toBeUndefined();
          levelMonitor.stop();
          done();
        }
      });
    });
  });

  describe('calculateLevels', () => {
    it('calculates peak and RMS correctly', () => {
      // Create test signal
      const testData = new Float32Array([0.5, -0.3, 0.8, -0.6, 0.2]);
      
      const levels = levelMonitor['calculateLevels'](testData);
      
      expect(levels.peak).toBe(0.8); // Maximum absolute value
      expect(levels.rms).toBeCloseTo(Math.sqrt((0.25 + 0.09 + 0.64 + 0.36 + 0.04) / 5), 5);
    });

    it('clamps peak to maximum of 1', () => {
      const testData = new Float32Array([1.5, -2.0, 0.5]);
      
      const levels = levelMonitor['calculateLevels'](testData);
      
      expect(levels.peak).toBe(1); // Clamped
      expect(levels.rms).toBeLessThanOrEqual(1);
    });

    it('handles silent signal', () => {
      const testData = new Float32Array(1024); // All zeros
      
      const levels = levelMonitor['calculateLevels'](testData);
      
      expect(levels.peak).toBe(0);
      expect(levels.rms).toBe(0);
    });

    it('handles single sample', () => {
      const testData = new Float32Array([0.7]);
      
      const levels = levelMonitor['calculateLevels'](testData);
      
      expect(levels.peak).toBe(0.7);
      expect(levels.rms).toBe(0.7);
    });
  });

  describe('dispose', () => {
    it('stops monitoring on dispose', () => {
      const stopSpy = jest.spyOn(levelMonitor, 'stop');
      
      levelMonitor.start(() => {});
      levelMonitor.dispose();
      
      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('continuous monitoring', () => {
    it('updates at animation frame rate', (done) => {
      const updates: number[] = [];
      const startTime = performance.now();
      
      levelMonitor.start(() => {
        updates.push(performance.now() - startTime);
        
        if (updates.length >= 5) {
          levelMonitor.stop();
          
          // Check that updates happen at roughly 60fps (16.67ms)
          for (let i = 1; i < updates.length; i++) {
            const delta = updates[i] - updates[i - 1];
            expect(delta).toBeGreaterThan(0);
            expect(delta).toBeLessThan(50); // Allow some variance
          }
          
          done();
        }
      });
    });
  });
});

describe('Utility functions', () => {
  describe('linearToDb', () => {
    it('converts linear values to dB correctly', () => {
      expect(linearToDb(1)).toBeCloseTo(0, 5);
      expect(linearToDb(0.5)).toBeCloseTo(-6.02, 2);
      expect(linearToDb(0.1)).toBeCloseTo(-20, 1);
      expect(linearToDb(2)).toBeCloseTo(6.02, 2);
    });

    it('returns -Infinity for zero or negative values', () => {
      expect(linearToDb(0)).toBe(-Infinity);
      expect(linearToDb(-0.5)).toBe(-Infinity);
    });
  });

  describe('dbToLinear', () => {
    it('converts dB values to linear correctly', () => {
      expect(dbToLinear(0)).toBeCloseTo(1, 5);
      expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
      expect(dbToLinear(-20)).toBeCloseTo(0.1, 3);
      expect(dbToLinear(6)).toBeCloseTo(1.995, 3);
    });

    it('handles extreme values', () => {
      expect(dbToLinear(-100)).toBeCloseTo(0.00001, 6);
      expect(dbToLinear(20)).toBeCloseTo(10, 5);
    });
  });

  describe('round-trip conversion', () => {
    it('maintains values through conversion', () => {
      const testValues = [0.1, 0.5, 1, 2, 10];
      
      testValues.forEach(value => {
        const db = linearToDb(value);
        const linear = dbToLinear(db);
        expect(linear).toBeCloseTo(value, 5);
      });
    });
  });
});

describe('PeakHold', () => {
  let peakHold: PeakHold;

  beforeEach(() => {
    peakHold = new PeakHold();
  });

  describe('update', () => {
    it('holds peak value for specified time', () => {
      const now = performance.now();
      
      const peak1 = peakHold.update('track1', 0.8);
      expect(peak1).toBe(0.8);
      
      // Lower value should return held peak
      const peak2 = peakHold.update('track1', 0.5);
      expect(peak2).toBe(0.8);
    });

    it('updates to higher peak immediately', () => {
      peakHold.update('track1', 0.5);
      const newPeak = peakHold.update('track1', 0.9);
      
      expect(newPeak).toBe(0.9);
    });

    it('resets after hold time expires', (done) => {
      // Create peak hold with short hold time for testing
      const shortHold = new PeakHold();
      shortHold['holdTime'] = 50; // 50ms for testing
      
      shortHold.update('track1', 0.8);
      
      setTimeout(() => {
        const newPeak = shortHold.update('track1', 0.3);
        expect(newPeak).toBe(0.3); // Should reset to new value
        done();
      }, 60);
    });

    it('tracks multiple keys independently', () => {
      peakHold.update('track1', 0.8);
      peakHold.update('track2', 0.6);
      
      expect(peakHold.update('track1', 0.5)).toBe(0.8);
      expect(peakHold.update('track2', 0.4)).toBe(0.6);
    });
  });

  describe('reset', () => {
    it('resets specific key', () => {
      peakHold.update('track1', 0.8);
      peakHold.update('track2', 0.6);
      
      peakHold.reset('track1');
      
      expect(peakHold.update('track1', 0.3)).toBe(0.3); // Reset
      expect(peakHold.update('track2', 0.4)).toBe(0.6); // Still held
    });

    it('resets all keys when no key specified', () => {
      peakHold.update('track1', 0.8);
      peakHold.update('track2', 0.6);
      peakHold.update('master', 0.9);
      
      peakHold.reset();
      
      expect(peakHold.update('track1', 0.3)).toBe(0.3);
      expect(peakHold.update('track2', 0.4)).toBe(0.4);
      expect(peakHold.update('master', 0.5)).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('handles first update for new key', () => {
      const peak = peakHold.update('newKey', 0.7);
      expect(peak).toBe(0.7);
    });

    it('handles zero and negative values', () => {
      const peak1 = peakHold.update('track1', 0);
      expect(peak1).toBe(0);
      
      const peak2 = peakHold.update('track1', -0.5);
      expect(peak2).toBe(0); // Still holds zero as it's higher
    });

    it('handles very small time differences', () => {
      peakHold.update('track1', 0.8);
      
      // Immediate update
      const peak = peakHold.update('track1', 0.5);
      expect(peak).toBe(0.8); // Should still hold
    });
  });
});