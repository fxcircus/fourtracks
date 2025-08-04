import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioEngine } from '../audio/AudioEngine'
import { AudioEngineState, Track, LevelData } from '../audio/types'

export interface UseAudioEngineResult {
  audioEngine: AudioEngine | null
  state: AudioEngineState
  tracks: Track[]
  isInitialized: boolean
  error: Error | null
  permissionStatus: PermissionState | null
  recordingTime: number
  playbackTime: number
  levelData: LevelData | null
  selectedDeviceId: string | undefined
  initialize: () => Promise<void>
  requestPermission: () => Promise<boolean>
  startRecording: (trackId: number, deviceId?: string) => Promise<void>
  stopRecording: () => Promise<void>
  startPlayback: () => Promise<void>
  stopPlayback: () => Promise<void>
  setTrackVolume: (trackId: number, volume: number) => void
  muteTrack: (trackId: number, muted: boolean) => void
  setSelectedDeviceId: (deviceId: string) => void
}

export function useAudioEngine(): UseAudioEngineResult {
  const audioEngineRef = useRef<AudioEngine | null>(null)
  const [state, setState] = useState<AudioEngineState>(AudioEngineState.IDLE)
  const [tracks, setTracks] = useState<Track[]>([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [levelData, setLevelData] = useState<LevelData | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>()

  useEffect(() => {
    // Create audio engine instance
    const engine = new AudioEngine()
    audioEngineRef.current = engine

    // Set up event listeners
    engine.on('stateChanged', (newState) => {
      setState(newState)
    })

    engine.on('error', (err) => {
      setError(err)
    })

    engine.on('recordingProgress', (_trackId, time) => {
      setRecordingTime(time)
    })
    
    engine.on('recordingComplete', (trackId, duration) => {
      console.log('[useAudioEngine] Recording complete:', { trackId, duration })
      // Force update tracks to show the new recording
      setTracks(engine.getAllTracks())
    })

    engine.on('playbackProgress', (time) => {
      setPlaybackTime(time)
    })

    engine.on('levelUpdate', (levels) => {
      setLevelData(levels)
    })

    // Get initial tracks
    setTracks(engine.getAllTracks())

    // Check initial permission status
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          setPermissionStatus(result.state)
          result.addEventListener('change', () => {
            setPermissionStatus(result.state)
          })
        })
        .catch(() => {
          // Permissions API not supported
        })
    }

    // Cleanup on unmount
    return () => {
      engine.dispose()
    }
  }, [])

  const initialize = useCallback(async (): Promise<void> => {
    if (!audioEngineRef.current || isInitialized) return

    try {
      await audioEngineRef.current.initialize()
      setIsInitialized(true)
      setError(null)
    } catch (err) {
      setError(err as Error)
      setIsInitialized(false)
    }
  }, [isInitialized])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(track => track.stop())
      setPermissionStatus('granted')
      return true
    } catch (err) {
      setPermissionStatus('denied')
      setError(new Error('Microphone permission denied'))
      return false
    }
  }, [])

  const startRecording = useCallback(async (trackId: number, deviceId?: string): Promise<void> => {
    if (!audioEngineRef.current) throw new Error('Audio engine not initialized')
    
    try {
      setRecordingTime(0)
      const inputDeviceId = deviceId || selectedDeviceId
      console.log('[useAudioEngine] Starting recording with device:', inputDeviceId)
      await audioEngineRef.current.startRecording({ trackId, inputDeviceId })
      setError(null)
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [selectedDeviceId])

  const stopRecording = useCallback((): Promise<void> => {
    if (!audioEngineRef.current) return Promise.resolve()
    
    try {
      audioEngineRef.current.stopRecording()
      setRecordingTime(0)
      // Force update tracks to ensure UI reflects the recording
      setTimeout(() => {
        if (audioEngineRef.current) {
          setTracks(audioEngineRef.current.getAllTracks())
        }
      }, 100)
      return Promise.resolve()
    } catch (err) {
      setError(err as Error)
      return Promise.reject(err)
    }
  }, [])

  const startPlayback = useCallback(async (): Promise<void> => {
    if (!audioEngineRef.current) throw new Error('Audio engine not initialized')
    
    try {
      await audioEngineRef.current.startPlayback()
      setError(null)
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [])

  const stopPlayback = useCallback(async (): Promise<void> => {
    if (!audioEngineRef.current) return
    
    try {
      await audioEngineRef.current.stopPlayback()
      setPlaybackTime(0)
    } catch (err) {
      setError(err as Error)
    }
  }, [])

  const setTrackVolume = useCallback((trackId: number, volume: number): void => {
    if (!audioEngineRef.current) return
    audioEngineRef.current.setTrackVolume(trackId, volume)
    setTracks(audioEngineRef.current.getAllTracks())
  }, [])

  const muteTrack = useCallback((trackId: number, muted: boolean): void => {
    if (!audioEngineRef.current) return
    audioEngineRef.current.muteTrack(trackId, muted)
    setTracks(audioEngineRef.current.getAllTracks())
  }, [])


  return {
    audioEngine: audioEngineRef.current,
    state,
    tracks,
    isInitialized,
    error,
    permissionStatus,
    recordingTime,
    playbackTime,
    levelData,
    selectedDeviceId,
    initialize,
    requestPermission,
    startRecording,
    stopRecording,
    startPlayback,
    stopPlayback,
    setTrackVolume,
    muteTrack,
    setSelectedDeviceId,
  }
}