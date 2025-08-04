import './LevelMeter.css'

interface LevelMeterProps {
  peak: number
  rms?: number
  label?: string
  orientation?: 'horizontal' | 'vertical'
}

function LevelMeter({ 
  peak, 
  rms, 
  label, 
  orientation = 'horizontal' 
}: LevelMeterProps) {
  // Ensure values are between 0 and 1
  const clampedPeak = Math.max(0, Math.min(1, peak))
  const clampedRms = rms !== undefined ? Math.max(0, Math.min(1, rms)) : undefined
  
  // Convert to percentage
  const peakPercent = clampedPeak * 100
  const rmsPercent = clampedRms !== undefined ? clampedRms * 100 : 0
  
  // Calculate color based on level
  const getColor = (level: number): string => {
    if (level > 0.95) return '#e74c3c' // Red
    if (level > 0.85) return '#f39c12' // Orange
    return '#27ae60' // Green
  }

  return (
    <div className={`level-meter-container ${orientation}`}>
      {label && <span className="level-meter-label">{label}</span>}
      <div className="level-meter">
        {clampedRms !== undefined && (
          <div 
            className="level-bar rms"
            style={{
              [orientation === 'horizontal' ? 'width' : 'height']: `${rmsPercent}%`
            }}
          />
        )}
        <div 
          className="level-bar peak"
          style={{
            [orientation === 'horizontal' ? 'width' : 'height']: `${peakPercent}%`,
            backgroundColor: getColor(clampedPeak)
          }}
        />
        <div className="level-scale">
          <div className="level-mark" style={{ left: '70%' }} />
          <div className="level-mark" style={{ left: '85%' }} />
          <div className="level-mark" style={{ left: '95%' }} />
        </div>
      </div>
    </div>
  )
}

export default LevelMeter