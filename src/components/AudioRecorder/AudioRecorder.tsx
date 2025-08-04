import { useEffect, useState, useCallback } from 'react'
import { useAudioEngine } from '../../hooks/useAudioEngine'
import { AudioEngineState } from '../../audio/types'
import { PermissionPrompt } from '../PermissionPrompt'
import { TransportControls } from '../TransportControls'
import { TimeDisplay } from '../TimeDisplay'
import { TrackControls } from '../TrackControls'
import { LevelMeter } from '../LevelMeter'
import { WaveformDisplay } from '../WaveformDisplay'
import { DeviceSelector } from '../DeviceSelector'
import { RecordingIndicator } from '../RecordingIndicator'
import { AudioWaveform } from '../AudioWaveform'
import './AudioRecorder.css'

function AudioRecorder() {
  const {
    audioEngine,
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
  } = useAudioEngine()

  const [selectedTrackId] = useState<number>(1)
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false)

  // Initialize audio engine on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Update tracks with level data
  const tracksWithLevels = tracks.map(track => ({
    ...track,
    peakLevel: levelData?.tracks[track.id]?.peak || 0,
    rmsLevel: levelData?.tracks[track.id]?.rms || 0
  }))

  const selectedTrack = tracksWithLevels.find(t => t.id === selectedTrackId)
  const hasRecording = tracks.some(t => t.audioBuffer !== null)

  const handleRecord = useCallback(async () => {
    if (state === AudioEngineState.RECORDING) {
      await stopRecording()
    } else {
      // Check permission first
      if (permissionStatus !== 'granted') {
        setShowPermissionPrompt(true)
        return
      }

      try {
        await startRecording(selectedTrackId)
      } catch (err) {
        console.error('Failed to start recording:', err)
      }
    }
  }, [state, permissionStatus, selectedTrackId, startRecording, stopRecording])

  const handlePlay = useCallback(async () => {
    if (state === AudioEngineState.PLAYING) {
      await stopPlayback()
    } else {
      try {
        await startPlayback()
      } catch (err) {
        console.error('Failed to start playback:', err)
      }
    }
  }, [state, startPlayback, stopPlayback])

  const handleStop = useCallback(async () => {
    if (state === AudioEngineState.RECORDING) {
      await stopRecording()
    } else if (state === AudioEngineState.PLAYING) {
      await stopPlayback()
    }
  }, [state, stopRecording, stopPlayback])

  const handlePermissionRequest = async () => {
    const granted = await requestPermission()
    if (granted) {
      setShowPermissionPrompt(false)
      // Start recording after permission granted
      await startRecording(selectedTrackId)
    }
  }
  
  const runDebugTest = async () => {
    try {
      const { testAudioRecording } = await import('../../audio/debug-recording')
      await testAudioRecording()
    } catch (error) {
      console.error('Debug test failed:', error)
    }
  }

  if (!isInitialized) {
    return (
      <div className="audio-recorder loading">
        <div className="loading-message">Initializing audio engine...</div>
      </div>
    )
  }

  return (
    <div className="audio-recorder">
      {showPermissionPrompt && (
        <PermissionPrompt
          permissionStatus={permissionStatus}
          onRequestPermission={handlePermissionRequest}
          onDismiss={() => setShowPermissionPrompt(false)}
        />
      )}

      <div className="recorder-header">
        <h1>FourTracks</h1>
        <RecordingIndicator 
          isRecording={state === AudioEngineState.RECORDING}
          trackId={selectedTrackId}
        />
        <TimeDisplay 
          time={recordingTime} 
          label="Recording Time" 
          isRecording={state === AudioEngineState.RECORDING}
        />
      </div>

      {error && (
        <div className="error-message">
          Error: {error.message}
        </div>
      )}

      <div className="main-content">
        <div className="device-section">
          <DeviceSelector
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={setSelectedDeviceId}
            disabled={state === AudioEngineState.RECORDING}
          />
          
        </div>
        
        <div className="track-section">
          <h2>Track {selectedTrackId}</h2>
          {selectedTrack && (
            <TrackControls
              track={selectedTrack}
              onVolumeChange={(volume) => setTrackVolume(selectedTrackId, volume)}
              onMuteToggle={(muted) => muteTrack(selectedTrackId, muted)}
              disabled={state === AudioEngineState.RECORDING}
            />
          )}
        </div>

        <div className="waveform-section">
          {selectedTrack && (
            <WaveformDisplay
              audioBuffer={selectedTrack.audioBuffer}
              playbackPosition={
                selectedTrack.audioBuffer && state === AudioEngineState.PLAYING
                  ? playbackTime / selectedTrack.audioBuffer.duration
                  : 0
              }
              height={120}
            />
          )}
        </div>

        <div className="transport-section">
          <TransportControls
            state={state}
            hasRecording={hasRecording}
            onRecord={handleRecord}
            onStop={handleStop}
            onPlay={handlePlay}
            disabled={!isInitialized}
          />
        </div>

        <div className="input-level-section">
          <div className="input-levels">
            <h3>Input Level</h3>
            <LevelMeter 
              peak={levelData?.input?.peak || 0}
              rms={levelData?.input?.rms || 0}
              label="Microphone"
            />
            {state === AudioEngineState.RECORDING && levelData?.input && (
              <div className="level-debug">
                Peak: {(levelData.input.peak * 100).toFixed(1)}% | 
                RMS: {(levelData.input.rms * 100).toFixed(1)}%
              </div>
            )}
          </div>
          
          {audioEngine && (
            <div className="waveform-monitor">
              <h3>Input Waveform</h3>
              <AudioWaveform
                analyserNode={audioEngine.getNodeManager()?.inputAnalyser || null}
                isActive={state === AudioEngineState.RECORDING}
                height={80}
                color="#00ff00"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Debug button - remove in production */}
      <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', gap: '10px' }}>
        <button 
          onClick={runDebugTest}
          style={{
            padding: '8px 16px',
            backgroundColor: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Debug Audio
        </button>
        <button 
          onClick={async () => {
            try {
              const debug = await audioEngine.debugAudioChain()
              console.log('🔍 Audio Chain Debug:', debug)
              
              let audioTestResult = 'Not tested'
              if (debug.hasMediaStream) {
                try {
                  console.log('Testing audio input...')
                  const test = await audioEngine.testAudioInput()
                  audioTestResult = `Signal: ${test.hasSignal ? 'YES' : 'NO'}, Max: ${test.maxLevel.toFixed(4)}, Avg: ${test.avgLevel.toFixed(4)}`
                  console.log('Audio test result:', test)
                } catch (e) {
                  audioTestResult = 'Test failed: ' + e.message
                }
              }
              
              alert(`Audio Debug Info:
Context: ${debug.contextState}
Has Stream: ${debug.hasMediaStream}
Input Level: ${debug.inputLevel.toFixed(4)}
Recorder: ${debug.recorderType}
Recording: ${debug.isRecording}
Tracks: ${debug.tracks}

Audio Test: ${audioTestResult}`)
            } catch (err) {
              console.error('Debug failed:', err)
              alert('Debug failed: ' + err.message)
            }
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Quick Debug
        </button>
      </div>
    </div>
  )
}

export default AudioRecorder