import { useEffect, useRef, useCallback } from 'react'
import './WaveformDisplay.css'

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null
  playbackPosition?: number // 0 to 1
  height?: number
  waveformColor?: string
  playheadColor?: string
}

function WaveformDisplay({
  audioBuffer,
  playbackPosition = 0,
  height = 100,
  waveformColor = '#00ff00',
  playheadColor = '#ffffff'
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size based on container
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    canvas.width = rect.width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, rect.width, height)

    if (!audioBuffer) {
      // Draw empty state
      ctx.strokeStyle = waveformColor + '33' // 20% opacity
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(rect.width, height / 2)
      ctx.stroke()
      
      // Draw text
      ctx.fillStyle = waveformColor + '66' // 40% opacity
      ctx.font = '12px monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No Recording', rect.width / 2, height / 2)
      return
    }

    // Get audio data
    const channelData = audioBuffer.getChannelData(0)
    const samplesPerPixel = Math.floor(channelData.length / rect.width)
    
    // Visual noise floor (hide very low-level signals in display)
    const visualNoiseFloor = 0.002 // -54dB
    
    // Draw waveform
    ctx.strokeStyle = waveformColor
    ctx.lineWidth = 1
    ctx.beginPath()

    let hasDrawnPoint = false
    for (let x = 0; x < rect.width; x++) {
      const sampleIndex = x * samplesPerPixel
      
      // Find min/max in this pixel's sample range
      let min = 1
      let max = -1
      let peakAbs = 0
      
      for (let i = 0; i < samplesPerPixel; i++) {
        const sample = channelData[sampleIndex + i] || 0
        min = Math.min(min, sample)
        max = Math.max(max, sample)
        peakAbs = Math.max(peakAbs, Math.abs(sample))
      }

      // Apply visual noise floor - don't draw if signal is too quiet
      if (peakAbs < visualNoiseFloor) {
        min = 0
        max = 0
      }

      // Scale to canvas height
      const yMin = (1 - min) * height / 2
      const yMax = (1 - max) * height / 2

      if (!hasDrawnPoint) {
        ctx.moveTo(x, (yMin + yMax) / 2)
        hasDrawnPoint = true
      }
      
      ctx.lineTo(x, yMax)
      ctx.lineTo(x, yMin)
    }

    ctx.stroke()
    
    // Draw center line
    ctx.strokeStyle = waveformColor + '33' // 20% opacity
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(rect.width, height / 2)
    ctx.stroke()

    // Draw playhead
    if (playbackPosition > 0 && playbackPosition <= 1) {
      const playheadX = rect.width * playbackPosition
      
      // Draw shadow
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
      
      // Draw playhead
      ctx.strokeStyle = playheadColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()
    }
  }, [audioBuffer, playbackPosition, height, waveformColor, playheadColor])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      animationRef.current = requestAnimationFrame(drawWaveform)
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [drawWaveform])

  // Draw waveform when buffer or position changes
  useEffect(() => {
    drawWaveform()
  }, [drawWaveform])

  return (
    <div className="waveform-display">
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        style={{ width: '100%', height: `${height}px` }}
      />
    </div>
  )
}

export default WaveformDisplay