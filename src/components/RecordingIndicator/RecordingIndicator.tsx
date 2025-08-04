import './RecordingIndicator.css'

interface RecordingIndicatorProps {
  isRecording: boolean
  trackId?: number
}

export function RecordingIndicator({ isRecording, trackId }: RecordingIndicatorProps) {
  if (!isRecording) return null
  
  return (
    <div className="recording-indicator">
      <div className="recording-dot" />
      <span className="recording-text">
        Recording{trackId ? ` Track ${trackId}` : ''}...
      </span>
    </div>
  )
}