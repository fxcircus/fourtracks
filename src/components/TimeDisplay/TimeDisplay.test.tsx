import { render, screen } from '@testing-library/react';
import TimeDisplay from './TimeDisplay';

describe('TimeDisplay', () => {
  it('renders time in MM:SS.MS format', () => {
    render(<TimeDisplay time={65.456} />);
    expect(screen.getByText('01:05.45')).toBeInTheDocument();
  });

  it('displays label when provided', () => {
    render(<TimeDisplay time={0} label="Recording Time" />);
    expect(screen.getByText('Recording Time')).toBeInTheDocument();
  });

  it('formats zero time correctly', () => {
    render(<TimeDisplay time={0} />);
    expect(screen.getByText('00:00.00')).toBeInTheDocument();
  });

  it('handles fractional seconds correctly', () => {
    render(<TimeDisplay time={12.999} />);
    expect(screen.getByText('00:12.99')).toBeInTheDocument();
  });

  it('applies recording class when isRecording is true', () => {
    const { container } = render(<TimeDisplay time={0} isRecording={true} />);
    const timeDisplay = container.querySelector('.time-display');
    expect(timeDisplay).toHaveClass('recording');
  });

  it('does not apply recording class when isRecording is false', () => {
    const { container } = render(<TimeDisplay time={0} isRecording={false} />);
    const timeDisplay = container.querySelector('.time-display');
    expect(timeDisplay).not.toHaveClass('recording');
  });

  it('handles large time values correctly', () => {
    render(<TimeDisplay time={3661.123} />); // 1 hour, 1 minute, 1.123 seconds
    expect(screen.getByText('61:01.12')).toBeInTheDocument();
  });

  it('rounds milliseconds down correctly', () => {
    render(<TimeDisplay time={1.996} />);
    expect(screen.getByText('00:01.99')).toBeInTheDocument();
  });
});