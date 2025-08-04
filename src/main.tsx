import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './components/App'
import './index.css'

console.log('🎵 FourTracks Audio Recorder Starting...')
console.log('Debug info: Check console for audio logs')
console.log('If no audio is captured, click "Debug Audio" button')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)