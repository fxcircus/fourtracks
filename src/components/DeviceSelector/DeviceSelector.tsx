import { useEffect, useState } from 'react'
import './DeviceSelector.css'

interface DeviceSelectorProps {
  selectedDeviceId?: string
  onDeviceChange: (deviceId: string) => void
  disabled?: boolean
}

export function DeviceSelector({ 
  selectedDeviceId, 
  onDeviceChange, 
  disabled = false 
}: DeviceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load devices on mount and when devices change
  useEffect(() => {
    let mounted = true

    const loadDevices = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // First, check if we have permission by trying to get a stream
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
        } catch (err) {
          console.log('[DeviceSelector] No permission yet, devices may not have labels')
        }
        
        // Now enumerate devices
        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = allDevices.filter(device => device.kind === 'audioinput')
        
        console.log('[DeviceSelector] Found audio input devices:', audioInputs.map(d => ({
          id: d.deviceId,
          label: d.label || 'Unnamed device'
        })))
        
        if (mounted) {
          setDevices(audioInputs)
          
          // If no device is selected and we have devices, select the default
          if (!selectedDeviceId && audioInputs.length > 0) {
            const defaultDevice = audioInputs.find(d => d.deviceId === 'default') || audioInputs[0]
            onDeviceChange(defaultDevice.deviceId)
          }
        }
      } catch (err) {
        console.error('[DeviceSelector] Error loading devices:', err)
        if (mounted) {
          setError('Failed to load audio devices')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    loadDevices()

    // Listen for device changes
    const handleDeviceChange = () => {
      console.log('[DeviceSelector] Device change detected')
      loadDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      mounted = false
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [selectedDeviceId, onDeviceChange])

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = event.target.value
    console.log('[DeviceSelector] Device selected:', deviceId)
    onDeviceChange(deviceId)
  }

  if (isLoading) {
    return (
      <div className="device-selector loading">
        <label>Input Device</label>
        <div className="loading-message">Loading devices...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="device-selector error">
        <label>Input Device</label>
        <div className="error-message">{error}</div>
      </div>
    )
  }

  return (
    <div className="device-selector">
      <label htmlFor="audio-input-select">Input Device</label>
      <select 
        id="audio-input-select"
        value={selectedDeviceId || ''} 
        onChange={handleChange}
        disabled={disabled}
      >
        {devices.length === 0 ? (
          <option value="">No audio devices found</option>
        ) : (
          devices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Device ${device.deviceId.substring(0, 8)}...`}
            </option>
          ))
        )}
      </select>
      
      {devices.length === 0 && (
        <div className="help-text">
          Make sure your microphone is connected and permissions are granted
        </div>
      )}
    </div>
  )
}