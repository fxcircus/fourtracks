import { useEffect, useRef } from 'react'
import './AudioWaveform.css'

interface AudioWaveformProps {
  analyserNode: AnalyserNode | null
  isActive: boolean
  height?: number
  color?: string
}

export function AudioWaveform({ 
  analyserNode, 
  isActive, 
  height = 100,
  color = '#00ff00'
}: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()

  useEffect(() => {
    if (!analyserNode || !isActive || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyserNode.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw)

      analyserNode.getByteTimeDomainData(dataArray)

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.lineWidth = 2
      ctx.strokeStyle = color
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0

      // Calculate RMS to determine if there's actual signal
      let rms = 0
      for (let i = 0; i < bufferLength; i++) {
        const normalized = (dataArray[i] - 128) / 128
        rms += normalized * normalized
      }
      rms = Math.sqrt(rms / bufferLength)

      // Only draw waveform if there's meaningful signal
      if (rms > 0.001) { // -60dB threshold
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0
          const y = v * canvas.height / 2

          if (i === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }

          x += sliceWidth
        }
        ctx.stroke()
      } else {
        // Draw flat line when no signal
        ctx.beginPath()
        ctx.moveTo(0, canvas.height / 2)
        ctx.lineTo(canvas.width, canvas.height / 2)
        ctx.strokeStyle = color + '33' // 20% opacity
        ctx.stroke()
      }
      
      // Draw center reference line
      ctx.strokeStyle = color + '22' // ~13% opacity
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [analyserNode, isActive, color])

  return (
    <div className="audio-waveform">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={height}
        className="waveform-canvas"
      />
    </div>
  )
}