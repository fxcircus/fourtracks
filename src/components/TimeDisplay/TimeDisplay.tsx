import './TimeDisplay.css'

interface TimeDisplayProps {
  time: number // time in seconds
  label?: string
  isRecording?: boolean
}

function TimeDisplay({ time, label, isRecording = false }: TimeDisplayProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  return (
    <div className={`time-display ${isRecording ? 'recording' : ''}`}>
      {label && <span className="time-label">{label}</span>}
      <div className="time-value">{formatTime(time)}</div>
    </div>
  )
}

export default TimeDisplay