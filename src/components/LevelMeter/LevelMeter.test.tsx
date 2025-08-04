import { render, screen } from '@testing-library/react';
import LevelMeter from './LevelMeter';

describe('LevelMeter', () => {
  it('renders with peak level', () => {
    const { container } = render(<LevelMeter peak={0.5} />);
    const peakBar = container.querySelector('.level-bar.peak');
    
    expect(peakBar).toBeInTheDocument();
    expect(peakBar).toHaveStyle({ width: '50%' });
  });

  it('renders with both peak and RMS levels', () => {
    const { container } = render(<LevelMeter peak={0.8} rms={0.6} />);
    
    const peakBar = container.querySelector('.level-bar.peak');
    const rmsBar = container.querySelector('.level-bar.rms');
    
    expect(peakBar).toHaveStyle({ width: '80%' });
    expect(rmsBar).toHaveStyle({ width: '60%' });
  });

  it('clamps values between 0 and 1', () => {
    const { container } = render(<LevelMeter peak={1.5} rms={-0.5} />);
    
    const peakBar = container.querySelector('.level-bar.peak');
    const rmsBar = container.querySelector('.level-bar.rms');
    
    expect(peakBar).toHaveStyle({ width: '100%' });
    expect(rmsBar).toHaveStyle({ width: '0%' });
  });

  it('displays label when provided', () => {
    render(<LevelMeter peak={0.5} label="Input" />);
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('applies correct color based on peak level', () => {
    const { rerender, container } = render(<LevelMeter peak={0.5} />);
    let peakBar = container.querySelector('.level-bar.peak');
    expect(peakBar).toHaveStyle({ backgroundColor: '#27ae60' }); // Green

    rerender(<LevelMeter peak={0.9} />);
    peakBar = container.querySelector('.level-bar.peak');
    expect(peakBar).toHaveStyle({ backgroundColor: '#f39c12' }); // Orange

    rerender(<LevelMeter peak={0.98} />);
    peakBar = container.querySelector('.level-bar.peak');
    expect(peakBar).toHaveStyle({ backgroundColor: '#e74c3c' }); // Red
  });

  it('renders in vertical orientation', () => {
    const { container } = render(<LevelMeter peak={0.7} orientation="vertical" />);
    
    const meterContainer = container.querySelector('.level-meter-container');
    const peakBar = container.querySelector('.level-bar.peak');
    
    expect(meterContainer).toHaveClass('vertical');
    expect(peakBar).toHaveStyle({ height: '70%' });
  });

  it('renders level scale marks', () => {
    const { container } = render(<LevelMeter peak={0.5} />);
    const levelMarks = container.querySelectorAll('.level-mark');
    
    expect(levelMarks).toHaveLength(3);
    expect(levelMarks[0]).toHaveStyle({ left: '70%' });
    expect(levelMarks[1]).toHaveStyle({ left: '85%' });
    expect(levelMarks[2]).toHaveStyle({ left: '95%' });
  });

  it('does not render RMS bar when RMS is undefined', () => {
    const { container } = render(<LevelMeter peak={0.5} />);
    const rmsBar = container.querySelector('.level-bar.rms');
    
    expect(rmsBar).not.toBeInTheDocument();
  });
});