// STT - Speech to Text using system tools

export interface SttResult {
  success: true
  text: string
  confidence: number
}

export type SttError = { success: false; error: string }
export type SttOutput = SttResult | SttError

/**
 * Speech-to-Text using system tools.
 * macOS: speech_recognition (Requires permission)
 * Linux: pocketsphinx / whisper
 */
export async function speechToText(audioPath: string): Promise<SttOutput> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      // macOS: use Apple Speech Recognition (requires permission)
      return { success: false, error: 'macOS speech recognition requires additional setup' }
    } else if (platform === 'linux') {
      // Try pocketsphinx or whisper
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      try {
        const { stdout } = await execAsync(`pocketsphinx_continuous -infile ${audioPath} 2>/dev/null`)
        return { success: true, text: stdout.trim(), confidence: 0.8 }
      } catch {
        return { success: false, error: 'pocketsphinx not installed' }
      }
    }

    return { success: false, error: 'Platform not supported' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * Record audio from microphone.
 * macOS: sox / arecord
 */
export async function recordAudio(duration: number = 5, outputPath: string = '/tmp/stt input.wav'): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      await execAsync(`sox -d -r 16000 -c 1 ${outputPath} trim 0 ${duration}`)
      return { success: true, path: outputPath }
    } else if (platform === 'linux') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      try {
        await execAsync(`arecord -f cd -d ${duration} -t wav ${outputPath}`)
        return { success: true, path: outputPath }
      } catch {
        return { success: false, error: 'arecord not available' }
      }
    }

    return { success: false, error: 'Platform not supported' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function createSttTools() {
  return {
    stt: speechToText,
    record_audio: recordAudio,
  }
}