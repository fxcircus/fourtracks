// Shared types across the application

export interface AppConfig {
  maxTracks: number
  maxRecordingDuration: number // in seconds
  defaultSampleRate: number
  defaultBitDepth: number
}

export interface UITheme {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  audioInputDevice?: string
  audioOutputDevice?: string
  monitoringEnabled: boolean
}