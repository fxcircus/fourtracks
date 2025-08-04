import { Track } from '../../audio/types'
import './TrackControls.css'

interface TrackControlsProps {
  track: Track
  onVolumeChange: (volume: number) => void
  onMuteToggle: (muted: boolean) => void
  disabled?: boolean
}

function TrackControls({
  track,
  onVolumeChange,
  onMuteToggle,
  disabled = false
}: TrackControlsProps) {
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value)
    onVolumeChange(volume)
  }

  const handleMuteClick = () => {
    onMuteToggle(!track.isMuted)
  }

  return (
    <div className="track-controls">
      <div className="track-controls-header">
        <span className="track-name">{track.name}</span>
        <div className="track-status">
          {track.isRecording && <span className="status-indicator recording">REC</span>}
          {track.isPlaying && <span className="status-indicator playing">PLAY</span>}
        </div>
      </div>

      <div className="track-controls-main">
        <button
          className={`mute-button ${track.isMuted ? 'muted' : ''}`}
          onClick={handleMuteClick}
          disabled={disabled}
          aria-label={track.isMuted ? 'Unmute' : 'Mute'}
        >
          {track.isMuted ? 'M' : 'M'}
        </button>

        <div className="volume-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={track.volume}
            onChange={handleVolumeChange}
            disabled={disabled || track.isMuted}
            className="volume-slider"
            aria-label="Volume"
          />
          <div className="volume-value">
            {Math.round(track.volume * 100)}%
          </div>
        </div>
      </div>

      <div className="level-meters">
        <div className="level-meter">
          <div 
            className="level-bar peak" 
            style={{ width: `${track.peakLevel * 100}%` }}
          />
        </div>
        <div className="level-meter">
          <div 
            className="level-bar rms" 
            style={{ width: `${track.rmsLevel * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default TrackControls