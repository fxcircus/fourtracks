import './PermissionPrompt.css'

interface PermissionPromptProps {
  permissionStatus: PermissionState | null
  onRequestPermission: () => void
  onDismiss?: () => void
}

function PermissionPrompt({ 
  permissionStatus, 
  onRequestPermission,
  onDismiss 
}: PermissionPromptProps) {
  if (permissionStatus === 'granted') return null

  return (
    <div className="permission-prompt-overlay">
      <div className="permission-prompt">
        <div className="permission-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        
        <h2>Microphone Access Required</h2>
        
        {permissionStatus === 'denied' ? (
          <>
            <p className="permission-error">
              Microphone access was denied. Please enable microphone permissions 
              in your browser settings to use the recorder.
            </p>
            <div className="permission-actions">
              <button onClick={onDismiss} className="permission-button secondary">
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              FourTracks needs access to your microphone to record audio.
              Click "Allow" when prompted by your browser.
            </p>
            <div className="permission-actions">
              <button onClick={onRequestPermission} className="permission-button primary">
                Request Microphone Access
              </button>
              {onDismiss && (
                <button onClick={onDismiss} className="permission-button secondary">
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PermissionPrompt