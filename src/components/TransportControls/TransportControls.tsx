import { AudioEngineState } from '../../audio/types'
import './TransportControls.css'

interface TransportControlsProps {
  state: AudioEngineState
  hasRecording: boolean
  onRecord: () => void
  onStop: () => void
  onPlay: () => void
  disabled?: boolean
}

function TransportControls({
  state,
  hasRecording,
  onRecord,
  onStop,
  onPlay,
  disabled = false
}: TransportControlsProps) {
  const isRecording = state === AudioEngineState.RECORDING
  const isPlaying = state === AudioEngineState.PLAYING

  return (
    <div className="transport-controls">
      <button
        className={`transport-button record ${isRecording ? 'active' : ''}`}
        onClick={onRecord}
        disabled={disabled || isPlaying}
        aria-label="Record"
      >
        <div className="record-icon" />
      </button>

      <button
        className="transport-button stop"
        onClick={onStop}
        disabled={disabled || state === AudioEngineState.IDLE}
        aria-label="Stop"
      >
        <div className="stop-icon" />
      </button>

      <button
        className={`transport-button play ${isPlaying ? 'active' : ''}`}
        onClick={onPlay}
        disabled={disabled || isRecording || !hasRecording}
        aria-label="Play"
      >
        <div className="play-icon" />
      </button>
    </div>
  )
}

export default TransportControls