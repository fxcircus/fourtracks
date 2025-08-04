export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20)
}

export function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(0.00001, linear))
}

export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter(device => device.kind === 'audioinput')
  } catch (error) {
    console.error('Failed to get audio devices:', error)
    return []
  }
}

export function createAudioBuffer(
  context: AudioContext,
  duration: number,
  numberOfChannels: number = 2
): AudioBuffer {
  const sampleRate = context.sampleRate
  const length = sampleRate * duration
  return context.createBuffer(numberOfChannels, length, sampleRate)
}